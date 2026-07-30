#!/usr/bin/env node
// Repeatable checks for the @-autocomplete picker (lib/scripts/templates/file-suggestion.sh).
// Zero-dependency: node:test + node:assert only, matching test/settings-deny.test.js.
//
// Run: npm test   (or: node --test test/)
//
// Companion to UAT-029. Everything here is hermetic — each test builds a throwaway
// git repo under os.tmpdir() and runs the picker against it. Nothing reads or writes
// ~/.claude, and no test depends on THIS repo's .git/info/exclude (which has no
// bootstrap sentinel; wiki/ is tracked here because this is the template repo).
//
// What lives in UAT-029 instead: anything needing a live Claude Code session (the
// `@` picker is an interactive UI affordance with no headless trigger) and anything
// needing a tty (merge-gitignore.sh exits early without one, so its normalizer
// cannot be driven from a test runner).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const PICKER = path.join(REPO, 'lib', 'scripts', 'templates', 'file-suggestion.sh');
const SENTINEL = '# bootstrap wiki & agent state (machine-local)';
const CANONICAL = [SENTINEL, '.serena/', 'raw/', 'wiki/'].join('\n') + '\n';

// Every fixture path contains "hot", so a single query exercises all of them at once
// and an over-broad re-include shows up as an extra line rather than as silence.
const FIXTURE_FILES = [
  'src/hotsrc.txt',
  'wiki/hot.md',
  'raw/hotraw.md',
  '.serena/hotcache.txt',
  'secret/secret-hotel.txt',
];

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'filesug-uat-'));
}

// Build a throwaway git repo. `exclude` is written verbatim to .git/info/exclude;
// pass null to leave the file absent.
function mkRepo({ exclude = null, files = FIXTURE_FILES, git = true } = {}) {
  const dir = scratchDir();
  for (const rel of files) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${rel}\n`);
  }
  if (git) {
    const init = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(init.status, 0, `git init failed: ${init.stderr}`);
    if (exclude !== null) {
      fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.git', 'info', 'exclude'), exclude);
    }
  }
  return dir;
}

// Run the picker the way Claude Code does: query on stdin as JSON, project root in
// CLAUDE_PROJECT_DIR, results on stdout. `cmd` defaults to `bash <template>`;
// pass an installed path to exercise the shebang and the +x bit instead.
function pick(dir, query, { cmd = null, env = {}, stdin = undefined } = {}) {
  const input = stdin !== undefined ? stdin : JSON.stringify({ query });
  const [file, args] = cmd ? [cmd, []] : ['bash', [PICKER]];
  const res = spawnSync(file, args, {
    input,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env },
  });
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    lines: res.stdout.split('\n').filter((l) => l !== ''),
  };
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- the core mechanism -------------------------------------------------------

test('canonical sentinel block: the excluded wiki dirs are re-included in results', () => {
  const dir = mkRepo({ exclude: CANONICAL });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  // These three are invisible to the base `rg --files` listing precisely because
  // .git/info/exclude hides them; seeing them proves the re-include pass fired.
  assert.ok(res.lines.includes('wiki/hot.md'), `wiki/hot.md missing from: ${res.lines}`);
  assert.ok(res.lines.includes('raw/hotraw.md'), `raw/hotraw.md missing from: ${res.lines}`);
  assert.ok(res.lines.includes('.serena/hotcache.txt'), `.serena/hotcache.txt missing from: ${res.lines}`);
  // And the ordinary tracked file still comes through the base listing.
  assert.ok(res.lines.includes('src/hotsrc.txt'), `src/hotsrc.txt missing from: ${res.lines}`);

  cleanup(dir);
});

test('re-inclusion is sentinel-scoped: a user exclusion ABOVE the block stays hidden', () => {
  const dir = mkRepo({ exclude: `secret/\n${CANONICAL}` });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.lines.includes('wiki/hot.md'), 'sentinel-scoped path not re-included');
  assert.ok(
    !res.lines.includes('secret/secret-hotel.txt'),
    `a user's own exclusion leaked into the picker: ${res.lines}`
  );

  cleanup(dir);
});

test('re-inclusion stops at the next comment line: entries below it stay hidden', () => {
  const dir = mkRepo({ exclude: `${CANONICAL}# my own stuff\nsecret/\n` });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.lines.includes('wiki/hot.md'), 'sentinel-scoped path not re-included');
  assert.ok(
    !res.lines.includes('secret/secret-hotel.txt'),
    `block did not terminate at the next comment: ${res.lines}`
  );

  cleanup(dir);
});

// --- the bug the step-6 normalization exists to fix ---------------------------
// These two reproduce the FAILURE, not the fix. Without them a green suite cannot
// distinguish "re-inclusion works" from "these files were visible all along".

test('BUG REPRO A — three paths present but no sentinel: the wiki dirs are invisible', () => {
  // secret/ is the adversarial control: an ordinary user exclusion that must stay
  // hidden in every state, so "nothing re-included" is distinguishable from "the
  // whole exclude file was ignored".
  const dir = mkRepo({ exclude: 'secret/\n.serena/\nraw/\nwiki/\n' });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.deepStrictEqual(
    res.lines.sort(),
    ['src/hotsrc.txt'],
    'without the sentinel the picker must NOT re-include — that is the bug merge-gitignore.sh normalization repairs'
  );

  cleanup(dir);
});

test('BUG REPRO B — paths split above/below the sentinel: only the ones beneath it come back', () => {
  const dir = mkRepo({ exclude: `secret/\nraw/\nwiki/\n${SENTINEL}\n.serena/\n` });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.deepStrictEqual(
    res.lines.sort(),
    ['.serena/hotcache.txt', 'src/hotsrc.txt'],
    'only paths beneath the sentinel are re-included — raw/ and wiki/ stay dark'
  );

  cleanup(dir);
});

test('normalizing REPRO B to canonical form makes all three visible again', () => {
  // The picker-side half of the step-6 contract: canonical form is the shape that
  // works, regardless of how the file got there.
  const broken = mkRepo({ exclude: `raw/\nwiki/\n${SENTINEL}\n.serena/\n` });
  const before = pick(broken, 'hot');
  assert.ok(!before.lines.includes('wiki/hot.md'), 'precondition: wiki/ starts invisible');

  fs.writeFileSync(path.join(broken, '.git', 'info', 'exclude'), CANONICAL);
  const after = pick(broken, 'hot');

  assert.ok(after.lines.includes('wiki/hot.md'));
  assert.ok(after.lines.includes('raw/hotraw.md'));
  assert.ok(after.lines.includes('.serena/hotcache.txt'));

  cleanup(broken);
});

test('a scrambled-order canonical block still parses — order within the block is not load-bearing for the picker', () => {
  const dir = mkRepo({ exclude: `${SENTINEL}\nwiki/\n.serena/\nraw/\n` });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  for (const f of ['wiki/hot.md', 'raw/hotraw.md', '.serena/hotcache.txt']) {
    assert.ok(res.lines.includes(f), `${f} missing from: ${res.lines}`);
  }

  cleanup(dir);
});

test('raw/private/ under the sentinel does not drag in a sibling named raw/ — entries are whole paths', () => {
  const files = FIXTURE_FILES.concat(['raw/private/hotpriv.txt']);
  // Everything is excluded; only raw/private/ sits under the sentinel.
  const dir = mkRepo({
    exclude: `secret/\n.serena/\nraw/\nwiki/\n${SENTINEL}\nraw/private/\n`,
    files,
  });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.deepStrictEqual(
    res.lines.sort(),
    ['raw/private/hotpriv.txt', 'src/hotsrc.txt'],
    'exactly the sentinel-listed subdir comes back — not its parent raw/, not the other bootstrap dirs'
  );

  cleanup(dir);
});

// --- defensive contract -------------------------------------------------------

test('a sentinel entry naming a directory this project does not have is skipped silently', () => {
  const dir = mkRepo({ exclude: `${SENTINEL}\n.serena/\nraw/\nwiki/\nnot-here/\n` });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.stderr, '', 'the picker must never emit stderr chatter');
  assert.ok(res.lines.includes('wiki/hot.md'));

  cleanup(dir);
});

test('absolute and parent-traversal sentinel entries are refused', () => {
  const dir = mkRepo({ exclude: `${SENTINEL}\n/etc/\n../\n..\nwiki/\n` });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.lines.includes('wiki/hot.md'), 'the legitimate entry was dropped too');
  for (const line of res.lines) {
    assert.ok(!line.startsWith('/'), `absolute path escaped into results: ${line}`);
    assert.ok(!line.startsWith('..'), `parent-traversal path escaped into results: ${line}`);
  }

  cleanup(dir);
});

test('hostile queries exit 0 and are matched literally, never as a flag or a regex', () => {
  const dir = mkRepo({ exclude: CANONICAL });

  for (const q of ['-v', '*', '[', '.*', '--help', 'a" b', '-e', '$(touch pwned)']) {
    const res = pick(dir, q);
    assert.strictEqual(res.status, 0, `query ${JSON.stringify(q)} exited ${res.status}: ${res.stderr}`);
    // No fixture path contains any of these substrings, so a literal match yields
    // nothing. `-v` printing everything would mean grep read it as invert-match;
    // `.*` or `*` printing everything would mean the filter is a regex/glob.
    assert.deepStrictEqual(
      res.lines,
      [],
      `query ${JSON.stringify(q)} was not treated as a literal substring: ${res.lines}`
    );
  }
  assert.ok(!fs.existsSync(path.join(dir, 'pwned')), 'query was evaluated by the shell');

  cleanup(dir);
});

test('results are capped at 15', () => {
  const files = [];
  for (let i = 0; i < 30; i++) files.push(`wiki/cap-${String(i).padStart(2, '0')}.md`);
  const dir = mkRepo({ exclude: CANONICAL, files });

  const res = pick(dir, 'cap');
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(res.lines.length, 15, `expected the 15-result cap, got ${res.lines.length}`);

  cleanup(dir);
});

test('empty, absent, and unparseable queries all degrade to list mode with exit 0', () => {
  const dir = mkRepo({ exclude: CANONICAL });

  for (const stdin of ['{"query":""}', '{}', '', 'not json at all']) {
    const res = pick(dir, null, { stdin });
    assert.strictEqual(res.status, 0, `stdin ${JSON.stringify(stdin)} exited ${res.status}`);
    assert.ok(res.lines.length > 0, `stdin ${JSON.stringify(stdin)} produced no listing`);
    assert.ok(res.lines.length <= 15, 'list mode must still honour the cap');
  }

  cleanup(dir);
});

test('a project with no .git/info/exclude gets a plain listing and exits 0', () => {
  const dir = mkRepo({ exclude: null });
  const res = pick(dir, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.lines.includes('src/hotsrc.txt'));

  cleanup(dir);
});

test('a non-git directory falls through to find, with no ./ prefix on results', () => {
  const dir = mkRepo({ git: false });
  // Strip rg so the fallback chain is actually exercised rather than short-circuited.
  const res = pick(dir, 'hot', { env: { PATH: '/usr/bin:/bin' } });

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.lines.includes('src/hotsrc.txt'), `find fallback output: ${res.lines}`);
  for (const line of res.lines) {
    assert.ok(!line.startsWith('./'), `find fallback leaked a ./ prefix: ${line}`);
  }

  cleanup(dir);
});

test('with rg unavailable, the git ls-files fallback reproduces the same re-inclusion', () => {
  const dir = mkRepo({ exclude: CANONICAL });
  const gitDir = spawnSync('git', ['--exec-path'], { encoding: 'utf8' });
  assert.strictEqual(gitDir.status, 0, 'git is required for this test');

  // A PATH with git but (almost certainly) no rg. Guard rather than assume.
  const noRg = spawnSync('sh', ['-c', 'command -v rg'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: '/usr/bin:/bin' },
  });
  assert.notStrictEqual(noRg.status, 0, 'rg is on the minimal PATH; this test cannot isolate the fallback');

  const res = pick(dir, 'hot', { env: { PATH: '/usr/bin:/bin' } });
  assert.strictEqual(res.status, 0, res.stderr);
  for (const f of ['wiki/hot.md', 'raw/hotraw.md', '.serena/hotcache.txt', 'src/hotsrc.txt']) {
    assert.ok(res.lines.includes(f), `${f} missing from the non-rg path: ${res.lines}`);
  }

  cleanup(dir);
});

// --- the installed artifact ---------------------------------------------------

test('the picker runs from its installed location, invoked directly (shebang + exec bit)', () => {
  const home = scratchDir();
  const installed = path.join(home, '.claude', 'file-suggestion.sh');
  fs.mkdirSync(path.dirname(installed), { recursive: true });
  fs.copyFileSync(PICKER, installed);
  fs.chmodSync(installed, 0o755);

  const dir = mkRepo({ exclude: CANONICAL });
  // No `bash` prefix: if the shebang or the +x bit were wrong this would not run.
  const res = pick(dir, 'hot', { cmd: installed });

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.lines.includes('wiki/hot.md'), 're-inclusion did not fire from the installed copy');

  cleanup(home);
  cleanup(dir);
});

test('the shipped template is executable in the repo, so the install copy inherits a sane mode', () => {
  const mode = fs.statSync(PICKER).mode & 0o111;
  assert.notStrictEqual(mode, 0, 'file-suggestion.sh must be executable');
});
