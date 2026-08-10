#!/usr/bin/env node
// Repeatable checks for the lib/hooks/ commenting standard introduced by TASK-039.
// Zero-dependency: node:test + node:assert only, mirroring test/settings-hooks.test.js.
//
// Run: npm test   (or: node --test 'test/*.test.js')
//
// Companion to UAT-039. What these tests defend:
//
//   1. The comments must SURVIVE. lib/hooks/README.md § Commenting standard records
//      a deliberate, lib/hooks/-scoped suspension of the repo-wide no-comments
//      default. A future agent "cleaning up slop" would silently delete the only
//      record of why ~40 security regexes and a dozen magic numbers have the values
//      they do. These tests make that deletion loud: the standard section, the
//      CLAUDE.md pointer to it, the per-file header prologues, and a comment-share
//      floor are all asserted.
//   2. The comments must not SWALLOW code. The real near-miss during TASK-039 was a
//      header edit that consumed the closing `*/`, silently commenting out the
//      require()s and a constant — and `node --check` still passed, because the file
//      stays valid JS with the block comment simply running on to the next `*/`.
//      `prologue carries no swallowed executable code` is the check that catches it.
//
// What is deliberately NOT here: the strip-comments-and-compare against
// `git show HEAD:<path>` that gated TASK-039's "no behavior changed" verdict. Once
// that work is committed, HEAD *is* the commented version and the comparison passes
// vacuously — it is a one-time acceptance check (UAT-039: UAT-BEHAVIOR-001), not a
// regression test. Encoding it here would produce a test that passes forever for the
// wrong reason.
//
// Also deliberately NOT here: a naive `/*` vs `*/` occurrence count. These files are
// dense with regex literals (`/\*/`, `/^\s*\*\//`), so counting produces false
// failures on healthy files — serena-first-glob-guard.js reads 15 opens / 10 closes
// by that method and is perfectly balanced. The prologue check below is the precise
// version of the same idea.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(REPO, 'lib', 'hooks');
const HOOKS_README = path.join(HOOKS_DIR, 'README.md');
const CLAUDE_MD = path.join(REPO, 'CLAUDE.md');
const BUGS_DIR = path.join(REPO, 'wiki', 'work', 'bugs');

// Hooks that gate nothing. Per README § Commenting standard these use `Does:`
// instead of `Blocks:` and are not required to declare `Fails:` — they cannot
// block a call, so "what happens when the check cannot run" has no answer.
const NON_BLOCKING = new Set(['serena-session-reset.js', 'serena-usage-tracker.js']);

// Known, tracked violations of the "every blocking hook declares Fails:" rule.
// Both files were outside TASK-039's scope (it modified 17 of the 21 .js files).
// deepStrictEqual makes this a ratchet in BOTH directions: a new file that drops
// the field fails, and fixing one of these fails too — with the fix being to
// delete its line from this list. It must only ever shrink.
const FAILS_FIELD_GAPS = ['git-protected-ops-block.js', 'serena-edit-guard.js'];

// Floor, not a snapshot. Every file currently sits at 28%–70% comment lines; 25%
// is set below the lowest so ordinary edits never trip it and only a genuine
// stripping pass does. Raising it toward the current values would turn a
// regression guard into a style ratchet, which is not what the standard asks for.
const MIN_COMMENT_SHARE = 0.25;

// The 8 bugs TASK-039 filed. They are annotated in place in the hook comments, so
// the bug files must outlive the annotations that cite them.
const TASK_039_BUGS = ['BUG-0001', 'BUG-0002', 'BUG-0003', 'BUG-0004', 'BUG-0005', 'BUG-0006', 'BUG-0007', 'BUG-0008'];

const readmeText = fs.readFileSync(HOOKS_README, 'utf8');
const claudeText = fs.readFileSync(CLAUDE_MD, 'utf8');

function hookFiles(dir = HOOKS_DIR, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) hookFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out.sort();
}

const FILES = hookFiles();

function rel(file) {
  return path.relative(REPO, file);
}

// Everything from the top of the file down to the first executable line: shebang
// and 'use strict' skipped, then every comment line (block or //) until real code
// starts. Deliberately spans blank-line-separated comment paragraphs, because
// several headers are written as two or three // blocks (absolute-path-guard.js
// carries its `Fails:` line in the second one).
function prologue(text) {
  const lines = text.split('\n');
  const out = [];
  let inBlock = false;

  for (const raw of lines) {
    const t = raw.trim();

    if (inBlock) {
      out.push(raw);
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (t === '') continue;
    if (t.startsWith('#!') || /^['"]use strict['"];?$/.test(t)) continue;
    if (t.startsWith('//')) {
      out.push(raw);
      continue;
    }
    if (t.startsWith('/*')) {
      out.push(raw);
      if (!t.includes('*/')) inBlock = true;
      continue;
    }
    break; // first executable line
  }
  return out;
}

// Share of non-blank lines that are comment lines.
function commentShare(text) {
  let total = 0;
  let comment = 0;
  let inBlock = false;

  for (const raw of text.split('\n')) {
    const t = raw.trim();
    if (t === '') continue;
    total++;
    if (inBlock) {
      comment++;
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('//')) comment++;
    else if (t.startsWith('/*')) {
      comment++;
      if (!t.includes('*/')) inBlock = true;
    }
  }
  return total === 0 ? 0 : comment / total;
}

// --- per-file header invariants ----------------------------------------------

test('every lib/hooks/**/*.js opens with a header comment naming its own file', () => {
  for (const file of FILES) {
    const head = prologue(fs.readFileSync(file, 'utf8'));
    assert.ok(head.length > 0, `${rel(file)}: no header comment — see lib/hooks/README.md § Commenting standard`);
    assert.ok(
      head.join('\n').includes(path.basename(file)),
      `${rel(file)}: header does not carry the identity line "<file>.js — <event> / <matcher>"`
    );
  }
});

// The exact failure mode that bit TASK-039: an edit eats the header's closing `*/`,
// the block comment runs on to the next one, and the require()s below it stop
// executing. node --check does not catch this (the file is still valid JS), and the
// hook then fails open on every tool call. Any executable-looking line inside the
// leading comment region means the header did not terminate where it should have.
const SWALLOWED_CODE = /^\s*(?:const|let|var|function|class|require\(|module\.exports|process\.|readHookInput\()/;

test('prologue carries no swallowed executable code (unterminated header block guard)', () => {
  for (const file of FILES) {
    const text = fs.readFileSync(file, 'utf8');
    const head = prologue(text);
    const swallowed = head.filter((line) => {
      const t = line.trim();
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return false; // genuine comment body
      return SWALLOWED_CODE.test(t);
    });
    assert.deepStrictEqual(
      swallowed,
      [],
      `${rel(file)}: executable code sits inside the leading comment region — a header block comment was left unterminated`
    );
    assert.ok(
      text.split('\n').length > head.length,
      `${rel(file)}: the entire file is comment — no code survived`
    );
  }
});

test('node --check passes for every lib/hooks/**/*.js', () => {
  for (const file of FILES) {
    const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `${rel(file)}: syntax error\n${res.stderr}`);
  }
});

test('every blocking hook declares "Fails: open|closed" in its header', () => {
  const missing = [];
  for (const file of FILES) {
    const base = path.basename(file);
    // lib/ holds shared modules, not hooks: no event, no matcher, nothing to fail.
    if (path.dirname(file) !== HOOKS_DIR) continue;
    if (NON_BLOCKING.has(base)) continue;
    const head = prologue(fs.readFileSync(file, 'utf8')).join('\n');
    if (!/Fails:\s*(open|closed)\b/.test(head)) missing.push(base);
  }
  assert.deepStrictEqual(
    missing.sort(),
    [...FAILS_FIELD_GAPS].sort(),
    'the set of blocking hooks missing the "Fails:" header field changed — it may only shrink (see FAILS_FIELD_GAPS)'
  );
});

test('every lib/hooks/**/*.js keeps a substantial comment share — the standard is not "cleaned up"', () => {
  for (const file of FILES) {
    const share = commentShare(fs.readFileSync(file, 'utf8'));
    assert.ok(
      share >= MIN_COMMENT_SHARE,
      `${rel(file)}: ${(share * 100).toFixed(0)}% comment lines, below the ${MIN_COMMENT_SHARE * 100}% floor — ` +
        'lib/hooks/ is the one directory where comments are mandatory (README.md § Commenting standard)'
    );
  }
});

// --- the standard itself ------------------------------------------------------

test('lib/hooks/README.md carries the "## Commenting standard" section', () => {
  assert.match(readmeText, /^## Commenting standard$/m, 'the section recording the no-comments exception is gone');

  const section = readmeText.split(/^## Commenting standard$/m)[1].split(/^## /m)[0];
  assert.match(section, /lib\/hooks\//, 'the section must name the directory the exception is scoped to');
  assert.match(section, /does not extend/i, 'the section must state that the exception does not widen to other directories');
  assert.match(section, /clean(?:ed|ing)? (?:them )?up|do not strip/i, 'the section must warn against deleting the comments as slop');

  for (const field of ['Blocks:', 'Why a hook:', 'Fails:', 'False positives:']) {
    assert.ok(section.includes(field), `the header-block template lost its "${field}" field`);
  }
});

test('CLAUDE.md records the lib/hooks/ exception and points at the README section', () => {
  const bullet = claudeText
    .split('\n')
    .find((line) => line.startsWith('- `lib/hooks/`'));
  assert.ok(bullet, 'CLAUDE.md no longer has a `lib/hooks/` key-files bullet');
  assert.match(bullet, /exception[^\n]*no-comments default/i, 'the bullet no longer records the deliberate comment exception');
  assert.match(bullet, /Commenting standard/, 'the bullet no longer points at README.md § Commenting standard');
});

// --- behavior that the comment pass must not have moved -------------------------

// The six command-class guards already have a decision harness with ~100 assertions
// (test/command-class-hooks.test.js), so a comment edit that broke one of them fails
// there. env-file-guard.js had NO coverage and took a 45 -> 87 line rewrite of its
// prologue, including a hand-rolled stdin handler sitting directly under the new
// header block — exactly the shape that swallows code. This pins its decision to the
// .env policy in CLAUDE.md and README.md § Safety / policy hooks, not to its current
// output: .env and every .env.* variant are blocked, .env.example alone is permitted.
function fireEnvGuard(payload) {
  const r = spawnSync(process.execPath, [path.join(HOOKS_DIR, 'env-file-guard.js')], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd: REPO,
  });
  const stdout = (r.stdout || '').trim();
  // No stdout is how a PreToolUse hook says "not my business".
  const decision = stdout ? JSON.parse(stdout).hookSpecificOutput?.permissionDecision : 'allow';
  return { status: r.status, decision, stderr: r.stderr || '' };
}

test('env-file-guard still decides the .env policy after its header rewrite', () => {
  const table = [
    [{ tool_name: 'Read', tool_input: { file_path: '/tmp/proj/.env' } }, 'deny'],
    [{ tool_name: 'Read', tool_input: { file_path: '/tmp/proj/.env.production' } }, 'deny'],
    [{ tool_name: 'Write', tool_input: { file_path: '.env.local' } }, 'deny'],
    [{ tool_name: 'Edit', tool_input: { file_path: 'config/.env.staging' } }, 'deny'],
    [{ tool_name: 'MultiEdit', tool_input: { edits: [{ file_path: 'README.md' }, { file_path: '.env' }] } }, 'deny'],
    [{ tool_name: 'Read', tool_input: { file_path: '/tmp/proj/.env.example' } }, 'allow'],
    [{ tool_name: 'Read', tool_input: { file_path: '/tmp/proj/environment.ts' } }, 'allow'],
    [{ tool_name: 'Bash', tool_input: { command: 'source .env' } }, 'allow'],
  ];
  for (const [payload, expected] of table) {
    const r = fireEnvGuard(payload);
    assert.strictEqual(r.status, 0, `env-file-guard exited ${r.status} (hooks must always exit 0)\n${r.stderr}`);
    assert.strictEqual(
      r.decision,
      expected,
      `env-file-guard → ${r.decision}, expected ${expected}, for ${JSON.stringify(payload)}`
    );
  }
});

// --- the bugs the comments cite ------------------------------------------------

test('BUG-0001…BUG-0008 still exist and every active one is listed in the bugs index', () => {
  const active = fs.readdirSync(BUGS_DIR).filter((f) => f.endsWith('.md'));
  const archiveDir = path.join(BUGS_DIR, 'archive');
  const archived = fs.existsSync(archiveDir) ? fs.readdirSync(archiveDir).filter((f) => f.endsWith('.md')) : [];
  const index = fs.readFileSync(path.join(BUGS_DIR, 'index.md'), 'utf8');

  for (const id of TASK_039_BUGS) {
    const isActive = active.some((f) => f.startsWith(`${id}-`));
    const isArchived = archived.some((f) => f.startsWith(`${id}-`));
    assert.ok(
      isActive || isArchived,
      `${id} is gone — hook comments annotate divergences in place and cite it by id`
    );
    // Family rule: active items are listed in index.md, terminal ones are not.
    if (isActive) {
      assert.ok(index.includes(id), `${id} exists in wiki/work/bugs/ but is missing from its family index`);
    }
  }
});
