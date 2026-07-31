#!/usr/bin/env node
// Repeatable checks for the canonical hooks-wiring template and its merge script.
// Zero-dependency: node:test + node:assert only, mirroring test/settings-deny.test.js.
//
// Run: npm test   (or: node --test test/)
//
// Companion to UAT-033 (whose inline node -e repros seeded several cases here).
// Two halves, matching the plan at ~/.claude/plans/ok-now-parallel-cerf.md
// ("Changes -> 6. Tests"):
//   1. Template invariants — static assertions on settings-hooks.json itself.
//   2. Merge behavior — each case spawns merge-settings-hooks.js against a
//      mkdtemp scratch target. The real ~/.claude/settings.json is never
//      read or written: every invocation passes explicit --target (and
//      --source where a custom fixture template is needed).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const TEMPLATE = path.join(REPO, 'lib', 'scripts', 'templates', 'settings-hooks.json');
const MERGE = path.join(REPO, 'lib', 'scripts', 'merge-settings-hooks.js');
const HOOKS_DIR = path.join(REPO, 'lib', 'hooks');

// Sibling writers for the three-writer install-order test.
const DENY_TEMPLATE = path.join(REPO, 'lib', 'scripts', 'templates', 'settings-deny.json');
const DENY_MERGE = path.join(REPO, 'lib', 'scripts', 'merge-settings-deny.js');
const SUGGESTION = '{"type":"command","command":"~/.claude/file-suggestion.sh"}';

const templateText = fs.readFileSync(TEMPLATE, 'utf8');
const template = JSON.parse(templateText);
const denyEntries = JSON.parse(fs.readFileSync(DENY_TEMPLATE, 'utf8'));

const EXPECTED_EVENTS = ['SessionStart', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure'];
const COMMAND_RE = /^node ~\/\.claude\/hooks\/([\w-]+)\.js$/;

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-merge-'));
}

function run(args) {
  return spawnSync(process.execPath, [MERGE, ...args], { encoding: 'utf8' });
}

function runDeny(args) {
  return spawnSync(process.execPath, [DENY_MERGE, ...args], { encoding: 'utf8' });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Every {block, entry} pair in a template-shaped hooks object, flattened.
function allEntries(tpl) {
  const out = [];
  for (const eventName of Object.keys(tpl)) {
    for (const block of tpl[eventName]) {
      for (const entry of block.hooks) {
        out.push({ eventName, block, entry });
      }
    }
  }
  return out;
}

function entryBasename(entry) {
  const m = COMMAND_RE.exec(entry.command);
  return m ? m[1] : null;
}

function blocksContaining(tpl, basename) {
  const hits = [];
  for (const eventName of Object.keys(tpl)) {
    for (const block of tpl[eventName]) {
      if (block.hooks.some((h) => entryBasename(h) === basename)) {
        hits.push({ eventName, block });
      }
    }
  }
  return hits;
}

// --- template invariants ------------------------------------------------------

test('template is valid JSON and a plain object (not an array like settings-deny.json)', () => {
  const parsed = JSON.parse(templateText); // throws = fail
  assert.strictEqual(typeof parsed, 'object');
  assert.notStrictEqual(parsed, null);
  assert.ok(!Array.isArray(parsed), 'hooks template must be an object, not a bare array');
});

test('template ships exactly the 4 event keys — a stray or typo\'d event fails loudly', () => {
  assert.deepStrictEqual(
    Object.keys(template).sort(),
    [...EXPECTED_EVENTS].sort(),
    `unexpected event keys: ${Object.keys(template).join(', ')}`
  );
});

test('every command is exactly "node ~/.claude/hooks/<file>.js"', () => {
  for (const { eventName, entry } of allEntries(template)) {
    assert.strictEqual(entry.type, 'command', `${eventName}: entry without type "command"`);
    assert.match(
      entry.command,
      COMMAND_RE,
      `${eventName}: command not in canonical form: ${JSON.stringify(entry.command)}`
    );
  }
});

test('bijection: template commands <-> lib/hooks/*.js (excluding lib/ and README)', () => {
  const files = fs
    .readdirSync(HOOKS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.js'))
    .map((d) => d.name.replace(/\.js$/, ''));
  const fileSet = new Set(files);

  const wired = new Set(
    allEntries(template)
      .map(({ entry }) => entryBasename(entry))
      .filter(Boolean)
  );

  const unwired = [...fileSet].filter((f) => !wired.has(f)).sort();
  const dangling = [...wired].filter((w) => !fileSet.has(w)).sort();

  assert.deepStrictEqual(unwired, [], `hook files present but not wired in the template: ${unwired.join(', ')}`);
  assert.deepStrictEqual(dangling, [], `template wires hooks with no matching lib/hooks file: ${dangling.join(', ')}`);
});

test('env-content-read-guard keeps its own triple-matcher block, not merged elsewhere', () => {
  const hits = blocksContaining(template, 'env-content-read-guard');
  assert.strictEqual(hits.length, 1, 'env-content-read-guard must appear in exactly one block');
  const { eventName, block } = hits[0];
  assert.strictEqual(eventName, 'PreToolUse');
  assert.strictEqual(
    block.matcher,
    'Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*',
    'triple-matcher (Bash + both Serena surfaces) drifted — see lib/hooks/README.md wiring'
  );
  assert.strictEqual(block.hooks.length, 1, 'the guard must own its block alone, not share a different tool\'s block');
});

test('claude-settings-guard matcher is exactly "Edit|Write|NotebookEdit|MultiEdit"', () => {
  const hits = blocksContaining(template, 'claude-settings-guard');
  assert.strictEqual(hits.length, 1, 'claude-settings-guard must appear in exactly one block');
  assert.strictEqual(hits[0].block.matcher, 'Edit|Write|NotebookEdit|MultiEdit');
});

test('mv-absolute-path-block keeps its if: "Bash(mv *)" conditional', () => {
  const entries = allEntries(template).filter(({ entry }) => entryBasename(entry) === 'mv-absolute-path-block');
  assert.strictEqual(entries.length, 1, 'mv-absolute-path-block must appear exactly once');
  assert.strictEqual(entries[0].entry.if, 'Bash(mv *)', 'the mv guard\'s if conditional was dropped or changed');
});

// --- merge behavior -----------------------------------------------------------

test('merge creates a valid settings file when the target does not exist', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'nested', 'settings.json');

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout.trim(), 'hooks wiring: created');

  const created = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepStrictEqual(created.hooks, template, 'created hooks must be a deep copy of the template');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('merge preserves existing keys and tab indentation on a target with no hooks key', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(target, JSON.stringify({ model: 'opusplan', env: { FOO: 'bar' } }, null, '\t') + '\n');

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stdout.trim(), 'hooks wiring: created');

  const text = fs.readFileSync(target, 'utf8');
  assert.match(text, /\n\t"model"/, 'tab indentation not preserved');

  const after = JSON.parse(text);
  assert.strictEqual(after.model, 'opusplan', 'unrelated key dropped');
  assert.deepStrictEqual(after.env, { FOO: 'bar' }, 'unrelated key mutated');
  assert.deepStrictEqual(after.hooks, template);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('merge is idempotent — a second run reports up to date and is byte-identical', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');

  const first = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(first.status, 0, first.stderr);
  const before = fs.readFileSync(target, 'utf8');

  const second = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(second.status, 0, second.stderr);
  assert.strictEqual(second.stdout.trim(), 'hooks wiring already up to date');
  assert.strictEqual(fs.readFileSync(target, 'utf8'), before, 'no-op run rewrote the file');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('drifted matcher on a pure-owned block is rewritten in place, no duplicate block', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const hooks = clone(template);
  hooks.PreToolUse.find((b) => b.matcher === 'Grep').matcher = 'OldGrepMatcher';
  fs.writeFileSync(target, JSON.stringify({ hooks }, null, 2) + '\n');

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /~ PreToolUse matcher adopted: OldGrepMatcher -> Grep/);
  assert.match(res.stdout, /hooks wiring: 1 change applied/);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.strictEqual(after.hooks.PreToolUse.length, template.PreToolUse.length, 'block count grew — a duplicate was appended');
  assert.deepStrictEqual(after.hooks, template, 'after adoption the hooks object must equal the template exactly');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('drifted owned entry is replaced in place at the same array position', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const hooks = clone(template);
  const bash = hooks.PreToolUse.find((b) => b.matcher === 'Bash');
  const idx = bash.hooks.findIndex((h) => h.command.includes('mv-absolute-path-block.js'));
  delete bash.hooks[idx].if;
  fs.writeFileSync(target, JSON.stringify({ hooks }, null, 2) + '\n');

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /~ PreToolUse\/mv-absolute-path-block replaced/);
  assert.match(res.stdout, /hooks wiring: 1 change applied/);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  const afterBash = after.hooks.PreToolUse.find((b) => b.matcher === 'Bash');
  assert.strictEqual(afterBash.hooks[idx].if, 'Bash(mv *)', 'entry not repaired at its original index');
  assert.deepStrictEqual(after.hooks, template);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('mixed block: user entry and its position untouched; repo entries updated and appended', () => {
  const dir = scratchDir();
  const source = path.join(scratchDir(), 'tpl.json');
  const entryA = { type: 'command', command: 'node ~/.claude/hooks/serena-bash-grep-block.js' };
  const entryB = { type: 'command', command: 'node ~/.claude/hooks/git-protected-ops-block.js' };
  fs.writeFileSync(source, JSON.stringify({ PreToolUse: [{ matcher: 'Bash', hooks: [entryA, entryB] }] }, null, 2) + '\n');

  const foreign = { type: 'command', command: 'node /Users/me/custom/my-guard.js' };
  const driftedA = { ...entryA, timeout: 99 };
  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(
    target,
    JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [foreign, driftedA] }] } }, null, 2) + '\n'
  );

  const res = run(['--target', target, '--source', source]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /~ PreToolUse\/serena-bash-grep-block replaced/);
  assert.match(res.stdout, /\+ PreToolUse\/git-protected-ops-block appended/);
  assert.match(res.stdout, /hooks wiring: 2 changes applied/);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.strictEqual(after.hooks.PreToolUse.length, 1, 'no extra block may be created');
  const block = after.hooks.PreToolUse[0];
  assert.deepStrictEqual(block.hooks[0], foreign, 'user entry moved or modified');
  assert.deepStrictEqual(block.hooks[1], entryA, 'drifted repo entry not replaced in place');
  assert.deepStrictEqual(block.hooks[2], entryB, 'missing repo entry not appended after the user entry');
  assert.strictEqual(block.hooks.length, 3);

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(path.dirname(source), { recursive: true, force: true });
});

test('relocated repo hook in a mixed block: left in place, warned, not duplicated, no write', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const hooks = clone(template);
  hooks.PreToolUse = hooks.PreToolUse.filter((b) => b.matcher !== 'Grep');
  hooks.PreToolUse.push({
    matcher: 'Grep|MyCustom',
    hooks: [
      { type: 'command', command: 'node /Users/me/custom/my-guard.js' },
      { type: 'command', command: 'node ~/.claude/hooks/serena-first-guard.js' },
    ],
  });
  const before = JSON.stringify({ hooks }, null, 2) + '\n';
  fs.writeFileSync(target, before);

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(
    res.stderr,
    /PreToolUse\/serena-first-guard appears relocated into a user-modified block/,
    'warning must name the relocated hook'
  );
  assert.strictEqual(res.stdout.trim(), 'hooks wiring already up to date', 'relocation-only run must be a no-op');
  assert.strictEqual(fs.readFileSync(target, 'utf8'), before, 'relocation-only run must not write the file');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('foreign blocks and non-shipped events survive a run that writes other changes', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const hooks = clone(template);
  // Force a real change so the file is rewritten — the strong version of "untouched".
  const bash = hooks.PreToolUse.find((b) => b.matcher === 'Bash');
  bash.hooks = bash.hooks.filter((h) => !h.command.includes('protected-write-guard.js'));

  const foreignBlock = {
    matcher: 'WebFetch',
    hooks: [{ type: 'command', command: 'node /Users/me/custom/fetch-audit.js' }],
  };
  hooks.PreToolUse.push(clone(foreignBlock));
  const foreignEvent = [{ matcher: '*', hooks: [{ type: 'command', command: 'node /Users/me/custom/prompt-hook.js' }] }];
  hooks.UserPromptSubmit = clone(foreignEvent);
  fs.writeFileSync(target, JSON.stringify({ hooks }, null, 2) + '\n');

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /\+ PreToolUse\/protected-write-guard appended/);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepStrictEqual(after.hooks.UserPromptSubmit, foreignEvent, 'non-template event was touched');
  const afterForeign = after.hooks.PreToolUse.filter((b) => b.matcher === 'WebFetch');
  assert.deepStrictEqual(afterForeign, [foreignBlock], 'fully-foreign block was touched');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('a new hook shipped in the template is appended into the existing matched block', () => {
  const dir = scratchDir();
  const source = path.join(dir, 'tpl.json');
  const entryA = { type: 'command', command: 'node ~/.claude/hooks/serena-first-guard.js' };
  const entryNew = { type: 'command', command: 'node ~/.claude/hooks/serena-first-glob-guard.js' };
  fs.writeFileSync(source, JSON.stringify({ PreToolUse: [{ matcher: 'Grep', hooks: [entryA, entryNew] }] }, null, 2) + '\n');

  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(
    target,
    JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Grep', hooks: [entryA] }] } }, null, 2) + '\n'
  );

  const res = run(['--target', target, '--source', source]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /\+ PreToolUse\/serena-first-glob-guard appended/);
  assert.match(res.stdout, /hooks wiring: 1 change applied/);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.strictEqual(after.hooks.PreToolUse.length, 1, 'append must land in the existing block, not a new one');
  assert.deepStrictEqual(after.hooks.PreToolUse[0].hooks, [entryA, entryNew]);

  fs.rmSync(dir, { recursive: true, force: true });
});

// The deferred-push guard (post-UAT-033 fix): a fresh placeholder block whose every
// template entry turns out to be relocated must NOT be persisted as an empty
// {matcher, hooks: []} block when the same run writes a real change elsewhere.
test('compound run: fully-relocated block leaves no empty placeholder block on disk', () => {
  const dir = scratchDir();
  const source = path.join(dir, 'tpl.json');
  fs.writeFileSync(
    source,
    JSON.stringify(
      {
        PreToolUse: [
          { matcher: 'Grep', hooks: [{ type: 'command', command: 'node ~/.claude/hooks/serena-first-guard.js' }] },
          { matcher: 'Glob', hooks: [{ type: 'command', command: 'node ~/.claude/hooks/serena-first-glob-guard.js' }] },
        ],
      },
      null,
      2
    ) + '\n'
  );

  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(
    target,
    JSON.stringify(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Grep|Glob',
              hooks: [
                { type: 'command', command: 'node ~/.claude/hooks/serena-first-guard.js' },
                { type: 'command', command: 'node /Users/me/custom/my-guard.js' },
              ],
            },
          ],
        },
      },
      null,
      2
    ) + '\n'
  );

  const res = run(['--target', target, '--source', source]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stderr, /PreToolUse\/serena-first-guard appears relocated/);
  assert.match(res.stdout, /\+ PreToolUse\/serena-first-glob-guard appended/, 'the real change must still land');

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  const empty = after.hooks.PreToolUse.filter((b) => Array.isArray(b.hooks) && b.hooks.length === 0);
  assert.deepStrictEqual(empty, [], `empty placeholder block persisted to disk: ${JSON.stringify(empty)}`);
  assert.strictEqual(after.hooks.PreToolUse.length, 2, 'expected exactly the mixed block plus the appended Glob block');

  fs.rmSync(dir, { recursive: true, force: true });
});

// The deferred-push guard only withholds blocks the run itself created: an empty
// block the USER already had on disk is pre-existing state and must survive.
test('a pre-existing user empty block is not pruned by the deferred-push guard', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const userEmpty = { matcher: 'MyThing', hooks: [] };
  fs.writeFileSync(target, JSON.stringify({ hooks: { PreToolUse: [clone(userEmpty)] } }, null, 2) + '\n');

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /hooks wiring: \d+ changes applied/);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepStrictEqual(after.hooks.PreToolUse[0], userEmpty, 'user\'s own empty block was pruned or modified');
  assert.strictEqual(after.hooks.PreToolUse.length, 1 + template.PreToolUse.length);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('merge leaves a malformed JSON target untouched and still exits 0', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const garbage = '{ this is not json ';
  fs.writeFileSync(target, garbage);

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, 'must exit 0 — install-global.sh runs under set -e');
  assert.match(res.stderr, /could not parse/);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), garbage, 'malformed target was modified');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('merge skips when hooks is not an object, leaving the file untouched, exit 0', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const original = JSON.stringify({ hooks: 'nope' }, null, 2) + '\n';
  fs.writeFileSync(target, original);

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stderr, /"hooks" is not an object/);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), original);

  fs.rmSync(dir, { recursive: true, force: true });
});

// install-global.sh writes the SAME settings.json three times in a row: deny merge,
// hooks wiring, then the fileSuggestion --set-key registration. Each run re-reads
// and re-serialises the whole file, so any writer could silently drop another's
// work. Mirrors the two-writer install-order test in test/settings-deny.test.js.
test('three-writer install order — deny, hooks, --set-key: all survive; re-run is byte-identical', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(target, JSON.stringify({ model: 'opusplan' }, null, 2) + '\n');

  const deny = runDeny(['--target', target, '--source', DENY_TEMPLATE]);
  assert.strictEqual(deny.status, 0, deny.stderr);
  const hooksRes = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(hooksRes.status, 0, hooksRes.stderr);
  const key = runDeny(['--target', target, '--set-key', 'fileSuggestion', '--set-value', SUGGESTION]);
  assert.strictEqual(key.status, 0, key.stderr);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepStrictEqual(after.permissions.deny, denyEntries, 'a later writer dropped deny entries');
  assert.deepStrictEqual(after.hooks, template, 'a later writer dropped or mangled the hooks wiring');
  assert.deepStrictEqual(after.fileSuggestion, JSON.parse(SUGGESTION));
  assert.strictEqual(after.model, 'opusplan', 'unrelated key lost across the three writes');

  // Re-running the full sequence is a no-op on all three halves.
  const before = fs.readFileSync(target, 'utf8');
  runDeny(['--target', target, '--source', DENY_TEMPLATE]);
  const secondHooks = run(['--target', target, '--source', TEMPLATE]);
  assert.match(secondHooks.stdout, /already up to date/);
  runDeny(['--target', target, '--set-key', 'fileSuggestion', '--set-value', SUGGESTION]);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), before, 'a second full install rewrote the file');

  fs.rmSync(dir, { recursive: true, force: true });
});
