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
const SENTINEL = '# bootstrap machine-local (autocomplete-visible)';
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

// A linked worktree's .git is a `gitdir: <path>` pointer FILE, not a directory —
// its own info/exclude does not exist. The real, shared exclude file lives in the
// main checkout's common git dir. mkWorktree() builds a main checkout (via mkRepo)
// plus a linked `git worktree add` checkout of it, so tests can run the picker from
// either side. `worktreeFiles` are written directly under the worktree path (not
// committed — the sentinel dirs are untracked, so a worktree's own working copy of
// them has to be created the same way mkRepo() creates them for the main checkout).
function mkWorktree({ exclude = CANONICAL, mainFiles = FIXTURE_FILES, worktreeFiles = FIXTURE_FILES } = {}) {
  const main = mkRepo({ exclude, files: mainFiles });
  const worktree = scratchDir();
  const add = spawnSync('git', ['worktree', 'add', worktree, '-b', 'wt-branch'], {
    cwd: main,
    encoding: 'utf8',
  });
  assert.strictEqual(add.status, 0, `git worktree add failed: ${add.stderr}`);
  for (const rel of worktreeFiles) {
    const abs = path.join(worktree, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${rel}\n`);
  }
  return { main, worktree };
}

function cleanupWorktree({ main, worktree }) {
  // Both are throwaway dirs under os.tmpdir(); plain rmSync is sufficient (no other
  // test or process shares this main checkout's git metadata).
  cleanup(worktree);
  cleanup(main);
}

// Regression proof that the TASK-066 fix actually matters: derive a "pre-fix" copy
// of the LIVE template by reverting only its two hunks, rather than hand-maintaining
// a separate stale copy of the old logic. If the surrounding code has since changed
// shape, the `assert.notStrictEqual` below fails loudly (telling a future maintainer
// to re-derive the revert) instead of silently testing nothing. The real, committed
// lib/scripts/templates/file-suggestion.sh is never touched.
function revertFix(bug) {
  const original = fs.readFileSync(PICKER, 'utf8');
  let out = original;

  if (bug === 'bug1' || bug === 'both') {
    const fixed = `  common_dir=$(git rev-parse --git-common-dir 2>/dev/null) || return 0
  exclude_file="$common_dir/info/exclude"
  [ -f "$exclude_file" ] || return 0
  awk -v sentinel="$SENTINEL" '
    $0 == sentinel { in_block = 1; next }
    in_block && /^[[:space:]]*#/ { in_block = 0 }
    in_block { print }
  ' "$exclude_file"`;
    const preFix = `  [ -f .git/info/exclude ] || return 0
  awk -v sentinel="$SENTINEL" '
    $0 == sentinel { in_block = 1; next }
    in_block && /^[[:space:]]*#/ { in_block = 0 }
    in_block { print }
  ' .git/info/exclude`;
    const reverted = out.replace(fixed, preFix);
    assert.notStrictEqual(reverted, out, 'sentinel_entries() has drifted — update the bug1 revert pattern in this test');
    out = reverted;
  }

  if (bug === 'bug2' || bug === 'both') {
    const reverted = out
      .replace('rg --files --no-ignore --follow "$dir"', 'rg --files --no-ignore "$dir"')
      .replace('find -L "$dir" -type f', 'find "$dir" -type f');
    assert.notStrictEqual(reverted, out, 'list_reincluded() has drifted — update the bug2 revert pattern in this test');
    out = reverted;
  }

  const dir = scratchDir();
  const scratchPicker = path.join(dir, 'file-suggestion-prefix.sh');
  fs.writeFileSync(scratchPicker, out);
  fs.chmodSync(scratchPicker, 0o755);
  return scratchPicker;
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

test('hostile queries exit 0 and are never read as a flag, a glob, or a regex', () => {
  const dir = mkRepo({ exclude: CANONICAL });

  // Matching is subsequence-based, so "returns nothing" is NOT the property under
  // test — a query whose characters genuinely appear in order should match. What
  // must hold is that every metacharacter is escaped before it reaches grep, and
  // that a leading dash is an operand rather than an option.
  //
  // These have no subsequence in any fixture path, so they must still yield zero.
  // `.*` or `*` returning everything would mean the query reached grep unescaped;
  // `--help` returning anything (or exiting non-zero) would mean the `--` operand
  // guard is missing.
  for (const q of ['*', '[', '.*', '--help', '^', '$', '(', ')', '\\', '$(touch pwned)']) {
    const res = pick(dir, q);
    assert.strictEqual(res.status, 0, `query ${JSON.stringify(q)} exited ${res.status}: ${res.stderr}`);
    assert.deepStrictEqual(
      res.lines,
      [],
      `query ${JSON.stringify(q)} was not escaped before reaching grep: ${res.lines}`
    );
  }
  assert.ok(!fs.existsSync(path.join(dir, 'pwned')), 'query was evaluated by the shell');

  // `-e` DOES have a subsequence here: secret/secret-hotel.txt has a "-" followed
  // later by an "e". That is correct fuzzy behaviour, not a flag leak. The leak
  // would look different — grep reading `-e` as the pattern flag would either error
  // or swallow the real pattern and emit every line, so assert it neither.
  const dashE = pick(dir, '-e');
  assert.strictEqual(dashE.status, 0, `query "-e" exited ${dashE.status}: ${dashE.stderr}`);
  assert.deepStrictEqual(dashE.lines, ['secret/secret-hotel.txt'], 'query "-e" did not subsequence-match');

  // `-v` would invert the match if grep read it as an option, printing everything
  // except the hits. No fixture path has a "-" followed by a "v", so it must be empty.
  const dashV = pick(dir, '-v');
  assert.strictEqual(dashV.status, 0, `query "-v" exited ${dashV.status}: ${dashV.stderr}`);
  assert.deepStrictEqual(dashV.lines, [], 'query "-v" was read as grep --invert-match');

  cleanup(dir);
});

test('matching is subsequence-based, so a path-shaped query without the separators still hits', () => {
  // The regression this pins: replacing the built-in picker replaces its matcher
  // too. Under a plain `grep -F` substring filter BOTH of these return nothing —
  // neither "wikitasks" nor "wiki/tasks" appears contiguously in the real path —
  // which is strictly worse than the picker being replaced.
  const dir = mkRepo({
    exclude: CANONICAL,
    files: ['wiki/work/tasks/TASK-001-example.md', 'src/unrelated.txt'],
  });

  for (const q of ['wikitasks', 'wiki/tasks', 'wiki/work/tasks', 'tasks', 'wktsk']) {
    const res = pick(dir, q);
    assert.strictEqual(res.status, 0, `query ${JSON.stringify(q)} exited ${res.status}`);
    assert.ok(
      res.lines.includes('wiki/work/tasks/TASK-001-example.md'),
      `query ${JSON.stringify(q)} did not subsequence-match the task path: ${JSON.stringify(res.lines)}`
    );
  }

  cleanup(dir);
});

test('contiguous matches rank above merely-subsequence ones', () => {
  // Named so the contiguous hit sorts LAST alphabetically: `sort -u` alone would
  // put aa/ first, so seeing zz/ first can only be the ranking pass.
  const dir = mkRepo({
    exclude: CANONICAL,
    files: ['aa/t-a-s-k-s.md', 'zz/tasks-real.md'],
  });

  const res = pick(dir, 'tasks');
  assert.strictEqual(res.status, 0, `exited ${res.status}: ${res.stderr}`);
  assert.deepStrictEqual(
    res.lines,
    ['zz/tasks-real.md', 'aa/t-a-s-k-s.md'],
    'contiguous match did not outrank the subsequence-only match'
  );

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

// --- git worktrees (TASK-066) --------------------------------------------------

test('a linked git worktree resolves the shared .git/info/exclude via --git-common-dir, so sentinel re-inclusion still fires', () => {
  const { main, worktree } = mkWorktree();
  const res = pick(worktree, 'hot');

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.lines.includes('wiki/hot.md'), `wiki/hot.md missing from: ${res.lines}`);
  assert.ok(res.lines.includes('raw/hotraw.md'), `raw/hotraw.md missing from: ${res.lines}`);
  assert.ok(res.lines.includes('.serena/hotcache.txt'), `.serena/hotcache.txt missing from: ${res.lines}`);
  assert.ok(res.lines.includes('src/hotsrc.txt'), `src/hotsrc.txt missing from: ${res.lines}`);

  cleanupWorktree({ main, worktree });
});

test('BUG REPRO — pre-fix hardcoded .git/info/exclude path is blind from a linked git worktree', () => {
  // Verified by hand against this exact scenario: a linked worktree's `.git` is a
  // `gitdir: <path>` pointer FILE, so `[ -f .git/info/exclude ]` (relative to the
  // worktree cwd) never resolves, and sentinel_entries() silently returns nothing —
  // the picker degrades to a plain listing with the sentinel dirs invisible, exactly
  // as if there were no sentinel block at all (see "BUG REPRO A" above).
  const { main, worktree } = mkWorktree();
  const broken = revertFix('bug1');

  const res = pick(worktree, 'hot', { cmd: broken });
  assert.strictEqual(res.status, 0, res.stderr);
  // secret/secret-hotel.txt is not under the sentinel (CANONICAL never excludes
  // it), so it comes through the ordinary base listing either way — only the
  // sentinel-scoped re-inclusion (wiki/, raw/, .serena/) is what's under test here.
  assert.deepStrictEqual(
    res.lines.sort(),
    ['secret/secret-hotel.txt', 'src/hotsrc.txt'],
    'pre-fix sentinel_entries() should find nothing from a linked worktree — it is looking for ' +
      '.git/info/exclude relative to the worktree, which does not exist'
  );

  cleanup(path.dirname(broken));
  cleanupWorktree({ main, worktree });
});

test('a symlinked sentinel dir inside a linked worktree is still traversed for suggestions', () => {
  // wiki/ itself is a symlink here (not one of mkWorktree's plain worktreeFiles),
  // pointing at a separate real directory holding the fixture file.
  const worktreeFiles = FIXTURE_FILES.filter((f) => !f.startsWith('wiki/'));
  const { main, worktree } = mkWorktree({ worktreeFiles });
  const target = scratchDir();
  fs.writeFileSync(path.join(target, 'linkedhot.md'), 'linkedhot\n');
  fs.symlinkSync(target, path.join(worktree, 'wiki'));

  const res = pick(worktree, 'hot');
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.lines.includes('wiki/linkedhot.md'), `symlinked wiki/ contents missing from: ${res.lines}`);

  cleanup(target);
  cleanupWorktree({ main, worktree });
});

test('BUG REPRO — pre-fix find fallback (no -L) cannot see a symlinked sentinel dir', () => {
  // Verified by hand: when rg is present, it already dereferences a symlink passed
  // directly as its OWN command-line argument (as `list_reincluded()` does — `dir`
  // is exactly the sentinel entry), so `--follow` makes no observable difference for
  // this exact shape via rg. `-L` on the FIND FALLBACK is what changes behaviour —
  // plain `find wiki -type f` on a symlinked `wiki/` prints nothing, `find -L wiki
  // -type f` prints the contents — so this repro forces that fallback (PATH stripped
  // of rg, same technique as the "non-git directory falls through to find" test
  // above) to get a deterministic, hand-verified before/after.
  const worktreeFiles = FIXTURE_FILES.filter((f) => !f.startsWith('wiki/'));
  const { main, worktree } = mkWorktree({ worktreeFiles });
  const target = scratchDir();
  fs.writeFileSync(path.join(target, 'linkedhot.md'), 'linkedhot\n');
  fs.symlinkSync(target, path.join(worktree, 'wiki'));
  const restrictedPath = { PATH: '/usr/bin:/bin' };

  const fixed = pick(worktree, 'hot', { env: restrictedPath });
  assert.strictEqual(fixed.status, 0, fixed.stderr);
  assert.ok(fixed.lines.includes('wiki/linkedhot.md'), `find -L fallback missed the symlink: ${fixed.lines}`);

  const broken = revertFix('bug2');
  const res = pick(worktree, 'hot', { cmd: broken, env: restrictedPath });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(
    !res.lines.includes('wiki/linkedhot.md'),
    `pre-fix find (no -L) unexpectedly saw the symlinked dir: ${res.lines}`
  );

  cleanup(target);
  cleanup(path.dirname(broken));
  cleanupWorktree({ main, worktree });
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
