#!/usr/bin/env node
// Repeatable checks for the STICKY PROMPT LAYER — lib/scripts/lib.sh's
// prompt_yn_sticky / prompt_choice_sticky / prompt_scope / prefs_get / prefs_set
// and the installer scripts that call them.
//
// Zero-dependency: node:test + node:assert only, matching test/bootstrap-prefs.test.js
// and test/run-project-sync.test.js.
// Run: npm test   (or: node --test test/)
//
// SCOPE — THE SHELL PROMPT LAYER, NOT THE HELPER CLI. This file owns exactly one
// question: was a prompt SHOWN, and was an answer RECORDED. Whether a prompt
// appears, whether stdin was consumed, whether a decline persisted, whether a
// remembered answer suppressed the question next run. test/bootstrap-prefs.test.js
// already owns bootstrap-prefs.js's CLI surface — the slugifier, the four-state
// model (absent = `unset` / a settled value / `false` / `ask`), layer resolution
// and its scope constraints, the exit-code contract, value-grammar validation,
// the companion README, and schema bijection. If an assertion can be made
// WITHOUT a prompt in it, it belongs in that file, not this one. Duplicating it
// here buys nothing and doubles the cost of every future schema change.
//
// HERMETICITY — THE RULE, VERBATIM: NO TEST MAY READ OR WRITE THE REAL
// ~/.claude/bootstrap-prefs.json, THIS REPO'S .gitignore, OR THIS REPO'S
// .git/info/exclude.
//
// Why those three specifically: this file drives real shell scripts whose whole
// job is to write to $HOME/.claude/ and to a project's .gitignore and
// .git/info/exclude. A stored `false` permanently suppresses a prompt, so a test
// write would plant a preference the developer never gave — and there would be
// no symptom, because the prompt it silenced is exactly the thing that would
// have told them. None of those three files is in this repo's diff surface
// (the store lives outside the repo; .git/info/exclude is untracked by
// construction), so the damage would not show up in review either.
//
// THE RISK IS ONE-WAY AND MUST BE CHECKED BEFORE ANY WRITE. If a redirected HOME
// failed to take, the bad write has already happened by the time an assertion
// could notice. withScratchEnv() therefore runs a READ-ONLY
// `bootstrap-prefs.js --list --project <scratch>` probe first — whose trailer
// prints the exact paths the helper resolved — and REFUSES to run the body
// unless both named paths are inside the scratch dirs. The probe must stay
// first, and must stay read-only. Same posture as
// test/bootstrap-prefs.test.js's withLayers().
//
// Everything lands under fs.mkdtempSync and is rm'd in a finally.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
// Used only by the non-interactive section at the bottom of this file, to prove a
// store was not rewritten by hashing it rather than by re-parsing it: a rewrite
// that happened to produce equivalent JSON is still a write, and `deepEqual` on
// the parsed object would call it clean.
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const LIB_SH = path.join(REPO, 'lib', 'scripts', 'lib.sh');
const PREFS_JS = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs.js');

// Both layers put their files at <dir>/.claude/<basename> — globalFile() and
// projectFile() (bootstrap-prefs.js:182-188) differ only in which <dir> they are
// handed, which is why one pair of helpers below covers the scratch HOME and the
// scratch project alike.
const CLAUDE_DIR = '.claude';
const VALUES_BASENAME = 'bootstrap-prefs.json';
const COMPANION_BASENAME = 'bootstrap-prefs.README.md';

// The trailer --list prints when (and only when) --project is given and --target
// is not. Its two captures are the exact paths the helper resolved for the two
// layers — the only self-reported evidence of where a write would land.
const LAYERS_TRAILER = /^Layers: project \((.+)\) then global \((.+)\)\.$/m;

// ---------------------------------------------------------------------------
// Scratch dirs
// ---------------------------------------------------------------------------

/**
 * An fs.mkdtempSync dir, realpath'd, guaranteed whitespace-free.
 *
 * REALPATH IS LOAD-BEARING, NOT TIDINESS. On macOS os.tmpdir() is
 * /var/folders/... and /var is a symlink to /private/var. The helper echoes back
 * whatever path it was handed (it never realpaths), and os.homedir() returns
 * $HOME verbatim — so as long as every path this file produces is realpath'd
 * ONCE, here, the redirect probe compares like with like. Realpath'ing only one
 * side would make the probe refuse to run on a perfectly good redirect.
 *
 * WHITESPACE IS ALSO LOAD-BEARING. lib.sh's _prefs_selector_args is substituted
 * UNQUOTED so it word-splits into `--project <dir>` (lib.sh:600-626, and its own
 * banner says so). A space in the path would split into bogus extra arguments
 * and the failure would look like a stickiness bug rather than a harness bug.
 */
function scratchDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  if (/\s/.test(dir)) {
    throw new Error(
      `scratch path contains whitespace: ${dir}\n` +
        'lib.sh substitutes _prefs_selector_args UNQUOTED, so a space word-splits ' +
        'into bogus arguments — refusing to run rather than report a fake failure.'
    );
  }
  return dir;
}

function cleanup(...dirs) {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

/**
 * A CURATED child env — deliberately NOT `{ ...process.env, HOME: home }`.
 *
 * Two reasons. First, the non-interactive claim (the load-bearing one) is a claim
 * about a run with NO BOOTSTRAP_ASSUME_TTY; inheriting the whole parent env means
 * a variable set anywhere up the chain — an outer harness, a shell profile, a
 * previous experiment — silently turns that test into an interactive one and it
 * passes for the wrong reason. Second, a curated env is the honest simulation of
 * an installer run: only what a shell genuinely needs to find node, bash and git.
 *
 * BOOTSTRAP_ASSUME_TTY is ABSENT here, always. It is added per call by
 * runShell's `tty: true` option, never globally, so each test states which side
 * of the seam it is testing.
 */
function curatedEnv(home) {
  const env = { HOME: home, PATH: process.env.PATH };
  // Passed through only when the parent actually has them: TMPDIR because the
  // scripts and node both write temp files, LANG/LC_ALL because several prompts
  // and stored notices carry an em dash (U+2014) and a C locale would not change
  // bash's byte handling but does change some tools' error text.
  for (const k of ['TMPDIR', 'LANG', 'LC_ALL']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  delete env.BOOTSTRAP_ASSUME_TTY;
  return env;
}

// ---------------------------------------------------------------------------
// bootstrap-prefs.js — used ONLY to seed and inspect, never as the thing under test
// ---------------------------------------------------------------------------

// spawnSync, not execFileSync: bootstrap-prefs.js signals whose fault a failure
// is through its exit code (0 = the world is odd, 1 = the caller is wrong), and
// execFileSync would throw the non-zero cases away before we could assert on them.
function prefsCli(args, env) {
  const r = spawnSync(process.execPath, [PREFS_JS, ...args], { encoding: 'utf8', env });
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

/**
 * Seed a stored answer into one of the two scratch layers, the same way a
 * previous installer run would have. `layer` is 'global' (scratch HOME) or
 * 'project' (scratch project dir).
 *
 * Goes through the real CLI rather than writing JSON directly so a seeded value
 * is one the grammar actually accepts — a test seeded with a value the helper
 * would have rejected proves nothing about the sticky path. (Planting a
 * deliberately ILLEGAL value is a different job and needs --target; see
 * test/bootstrap-prefs.test.js for that surface.)
 */
function seedPref(S, layer, key, value) {
  const selector = layer === 'global' ? ['--global'] : ['--project', S.projectDir];
  const res = prefsCli(['--set', key, '--value', String(value), ...selector], S.env);
  assert.equal(res.status, 0, `seed --set ${key}=${value} (${layer}) failed: ${res.stderr}`);
  const file = prefsFile(layer === 'global' ? S.home : S.projectDir);
  assert.ok(fs.existsSync(file), `the ${layer} seed did not land in ${file}`);
  return res;
}

// ---------------------------------------------------------------------------
// Values file / companion
// ---------------------------------------------------------------------------

function prefsFile(dir) {
  return path.join(dir, CLAUDE_DIR, VALUES_BASENAME);
}

function companionFile(dir) {
  return path.join(dir, CLAUDE_DIR, COMPANION_BASENAME);
}

/** The stored object for a layer, or null when nothing has ever been written. */
function readPrefs(dir) {
  const file = prefsFile(dir);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * THE STRONGEST NO-WRITE ASSERTION AVAILABLE, and the reason it checks two files.
 *
 * The companion README is regenerated on every successful --set and --unset, and
 * is NEVER created by a read (--get/--list are read-only, proven in
 * test/bootstrap-prefs.test.js). So a companion sitting next to a missing values
 * file is not a curiosity — it is proof that a write path executed and got
 * further than it should have. Asserting only on the values file would miss a
 * write that was rolled back, or one that landed under a different key shape.
 */
function assertNoPrefsFile(dir, label = dir) {
  assert.ok(
    !fs.existsSync(prefsFile(dir)),
    `${label}: a values file exists at ${prefsFile(dir)} — an answer was recorded that should not have been.\n` +
      `contents: ${fs.existsSync(prefsFile(dir)) ? fs.readFileSync(prefsFile(dir), 'utf8') : ''}`
  );
  assert.ok(
    !fs.existsSync(companionFile(dir)),
    `${label}: no values file, but the companion ${COMPANION_BASENAME} exists at ${companionFile(dir)} — ` +
      'the companion is only ever written by --set/--unset, so a write path ran.'
  );
}

// ---------------------------------------------------------------------------
// The redirect probe
// ---------------------------------------------------------------------------

/**
 * READ-ONLY. Asks the helper where it thinks the two layer files are, and throws
 * unless both answers are inside the scratch dirs.
 *
 * Named and exported-by-position (rather than inlined into withScratchEnv) so
 * the refusal itself is testable: a probe that could never refuse is decoration,
 * and this is the one mechanism standing between a broken redirect and the
 * developer's own preference store.
 */
function assertRedirectLandedInScratch(env, home, projectDir) {
  const probe = prefsCli(['--list', '--project', projectDir], env);
  assert.equal(probe.status, 0, `redirect probe failed to run: ${probe.stderr}`);

  const trailer = probe.stdout.match(LAYERS_TRAILER);
  assert.ok(trailer, `--list did not print the two-layer trailer:\n${probe.stdout}`);

  assert.equal(
    trailer[1],
    prefsFile(projectDir),
    'refusing to run: --project did not resolve to the scratch project file, so a project write would have hit ' +
      'a directory this test does not own'
  );
  assert.equal(
    trailer[2],
    prefsFile(home),
    'refusing to run: the HOME redirect did not take, so a --global write would have hit the REAL store at ' +
      '~/.claude/bootstrap-prefs.json'
  );

  // The probe is read-only; if it created anything, the "read-only" premise the
  // whole hermeticity argument rests on is wrong and every later no-write
  // assertion in this file is measuring the wrong baseline.
  assertNoPrefsFile(projectDir, 'scratch project (after read-only probe)');
  assertNoPrefsFile(home, 'scratch HOME (after read-only probe)');
}

// ---------------------------------------------------------------------------
// withScratchEnv
// ---------------------------------------------------------------------------

/**
 * Runs `body(S)` against a scratch HOME and a scratch project dir, both removed
 * in a finally, having first PROVED the redirect landed.
 *
 * S = {
 *   home,        scratch dir standing in for $HOME (global layer)
 *   projectDir,  scratch dir standing in for a project checkout (project layer)
 *   env,         curated env with HOME redirected and NO BOOTSTRAP_ASSUME_TTY
 *   globalValues / projectValues,   the two values-file paths
 * }
 *
 * The seam is not baked into S.env on purpose — runShell(snippet, { tty: true })
 * adds it per call, so a test that means "no tty" cannot accidentally inherit an
 * interactive one.
 */
function withScratchEnv(body) {
  const home = scratchDir('prompt-sticky-home-');
  const projectDir = scratchDir('prompt-sticky-project-');
  const env = curatedEnv(home);
  const S = {
    home,
    projectDir,
    env,
    globalValues: prefsFile(home),
    projectValues: prefsFile(projectDir),
  };
  try {
    // BEFORE ANY WRITE. Do not move, do not make it conditional.
    assertRedirectLandedInScratch(env, home, projectDir);
    return body(S);
  } finally {
    cleanup(home, projectDir);
  }
}

// ---------------------------------------------------------------------------
// runShell
// ---------------------------------------------------------------------------

/**
 * Source the REAL lib/scripts/lib.sh in a `set -euo pipefail` wrapper and run
 * `snippet` inside it — the test/run-project-sync.test.js:79-99 pattern, which
 * is also exactly how install-global.sh and friends consume the library.
 *
 * Sourcing the real file (rather than copying it to a scratch tree) is
 * deliberate: BOOTSTRAP_PREFS_JS is derived from lib.sh's OWN ${BASH_SOURCE[0]}
 * at source time (lib.sh:22), so a copied lib.sh without a sibling
 * bootstrap-prefs.js + templates/bootstrap-prefs-schema.json degrades prefs_get
 * to `unset` and prefs_set to a silent no-op — which would make every stickiness
 * test pass by not testing anything. Only the VALUES files need to be scratch,
 * and HOME + the --project selector already do that.
 *
 * Options:
 *   input  string written to the child's stdin. UNDER `tty: true` YOU ALMOST
 *          ALWAYS WANT THIS: `read` still runs with the seam on, so stdin at EOF
 *          yields an empty reply, and an empty reply to a sticky yes/no records
 *          `false`. A seam-enabled test with no input silently tests the EOF
 *          path instead of the answer it meant to give.
 *   env    REQUIRED and explicit — there is no default, because the only
 *          plausible default (process.env) carries the real HOME.
 *   tty    adds BOOTSTRAP_ASSUME_TTY=1 for this call only. has_tty (lib.sh:181-194)
 *          is `[ -t 0 ] || [ "$BOOTSTRAP_ASSUME_TTY" = "1" ]`, and spawnSync hands
 *          the child a pipe, so without this no prompt body is reachable at all.
 *   cwd    defaults to the throwaway wrapper dir, NOT the repo root: a script
 *          that writes something relative to cwd must not be able to land it in
 *          this checkout.
 *
 * Returns { status, stdout, stderr } UNTRIMMED. Trimming is wrong here — several
 * claims in this file are about exact bytes on stdout (prompt_choice_sticky's
 * stdout is its return value, so a stray leading space or an extra line IS the
 * bug), and a trim would hide precisely those.
 */
function runShell(snippet, { input, env, tty = false, cwd } = {}) {
  if (!env) {
    throw new Error('runShell requires an explicit env — use withScratchEnv(S => ...) and pass S.env');
  }
  const childEnv = tty ? { ...env, BOOTSTRAP_ASSUME_TTY: '1' } : { ...env };
  if (!tty) delete childEnv.BOOTSTRAP_ASSUME_TTY;

  const dir = scratchDir('prompt-sticky-wrapper-');
  try {
    const wrapper = path.join(dir, 'wrapper.sh');
    fs.writeFileSync(
      wrapper,
      ['#!/usr/bin/env bash', 'set -euo pipefail', `. "${LIB_SH}"`, snippet, ''].join('\n')
    );
    fs.chmodSync(wrapper, 0o755);
    const r = spawnSync('bash', [wrapper], {
      encoding: 'utf8',
      env: childEnv,
      cwd: cwd || dir,
      ...(input === undefined ? {} : { input }),
    });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  } finally {
    cleanup(dir);
  }
}

// ===========================================================================
// HARNESS SMOKE TESTS
// ===========================================================================
//
// These prove the harness, not the product. Every behavioural test that follows
// is only as trustworthy as the four claims below: the redirect probe can
// actually refuse, the no-write assertion can actually fire, the tty seam is
// plumbed per call, and a value seeded on the Node side is visible to lib.sh on
// the shell side. Each of those, if silently broken, produces a green suite that
// measures nothing.

test('harness: the redirect probe refuses when the resolved global path is not the expected scratch HOME', () => {
  // Two scratch homes, and the probe is asked to verify the WRONG one. Nothing
  // here touches the real store: proving the refusal with the developer's real
  // HOME would mean running --list against their own file, which this file's
  // banner forbids.
  const realish = scratchDir('prompt-sticky-other-home-');
  const expected = scratchDir('prompt-sticky-home-');
  const projectDir = scratchDir('prompt-sticky-project-');
  try {
    assert.throws(
      () => assertRedirectLandedInScratch(curatedEnv(realish), expected, projectDir),
      /HOME redirect did not take/,
      'the probe accepted a global path outside the expected scratch HOME — it would not stop a real leak'
    );
    // And it passes when the env and the expectation agree.
    assert.doesNotThrow(() => assertRedirectLandedInScratch(curatedEnv(expected), expected, projectDir));
  } finally {
    cleanup(realish, expected, projectDir);
  }
});

test('harness: assertNoPrefsFile fires on a lone companion README, not just on the values file', () => {
  const dir = scratchDir('prompt-sticky-nowrite-');
  try {
    assertNoPrefsFile(dir); // virgin dir: passes

    fs.mkdirSync(path.join(dir, CLAUDE_DIR), { recursive: true });
    fs.writeFileSync(companionFile(dir), '# stray companion\n');
    assert.throws(
      () => assertNoPrefsFile(dir),
      /the companion is only ever written by --set\/--unset/,
      'a stray companion with no values file went unnoticed — that is the tell that a write path ran'
    );

    fs.writeFileSync(prefsFile(dir), '{}\n');
    assert.throws(() => assertNoPrefsFile(dir), /a values file exists/);
  } finally {
    cleanup(dir);
  }
});

test('harness: the tty seam is per call — has_tty is false by default and true only with tty:true', () => {
  withScratchEnv((S) => {
    const snippet = 'if has_tty; then echo TTY; else echo NOTTY; fi';

    const off = runShell(snippet, { env: S.env });
    assert.equal(off.status, 0, off.stderr);
    assert.equal(
      off.stdout,
      'NOTTY\n',
      'the default env granted a tty — every "records nothing" test would then be testing the interactive path'
    );

    const on = runShell(snippet, { env: S.env, tty: true });
    assert.equal(on.status, 0, on.stderr);
    assert.equal(on.stdout, 'TTY\n', 'BOOTSTRAP_ASSUME_TTY=1 did not reach the child — no prompt body is reachable');

    // The seam must not leak back into the shared env object.
    assert.equal(S.env.BOOTSTRAP_ASSUME_TTY, undefined, 'runShell mutated the caller env');
  });
});

test('harness: a pref seeded into the scratch HOME is read back by lib.sh prefs_get through runShell', () => {
  withScratchEnv((S) => {
    assertNoPrefsFile(S.home, 'scratch HOME');

    const before = runShell('prefs_get mcp.braveSearch --global', { env: S.env });
    assert.equal(before.status, 0, before.stderr);
    assert.equal(before.stdout, 'unset\n', 'an unanswered key must read as the literal word unset');
    assertNoPrefsFile(S.home, 'scratch HOME after a read');

    seedPref(S, 'global', 'mcp.braveSearch', true);
    assert.deepEqual(readPrefs(S.home), { 'mcp.braveSearch': true }, 'the seed stored a JSON boolean, not a string');
    assert.equal(readPrefs(S.projectDir), null, 'a --global seed leaked into the project layer');

    const after = runShell('prefs_get mcp.braveSearch --global', { env: S.env });
    assert.equal(after.status, 0, after.stderr);
    assert.equal(
      after.stdout,
      'true\n',
      'lib.sh did not see the seeded value — BOOTSTRAP_PREFS_JS or the HOME redirect is not reaching the shell layer, ' +
        'and every stickiness test would pass by reading `unset` forever'
    );
  });
});

// ===========================================================================
// prompt_yn_sticky — was the question ASKED, and was the answer RECORDED
// ===========================================================================
//
// READ THIS BEFORE CHANGING ANY ASSERTION BELOW. Bash's `read -r -p` writes its
// prompt string ONLY when it is talking to a terminal. spawnSync hands the child
// a PIPE, so even with BOOTSTRAP_ASSUME_TTY=1 (which gates has_tty, not the
// terminal itself — lib.sh:181-194) the prompt text NEVER reaches stdout or
// stderr. That is a property of the harness, not of the helper, and it is not
// behaviour worth asserting as correct.
//
// The consequence is that `assert(!stdout.includes(PROMPT_MARKER))` is
// VACUOUSLY TRUE IN BOTH DIRECTIONS and proves nothing on its own. It is kept
// because it is free and would catch a future refactor that starts echoing the
// prompt with `echo` instead of `read -p`, but it is never the evidence for
// either claim. The real evidence is behavioural, and comes in two shapes:
//
//   PROMPT SUPPRESSED  -> POISON INPUT. Feed stdin an answer that WOULD flip the
//                         outcome if it were consumed. A seeded `true` fed `n`
//                         that still returns 0 proves stdin was never read.
//
//   PROMPT SHOWN       -> BOTH BRANCHES. Run the same snippet twice, once with
//                         `y` and once with `n`, and require different outcomes.
//                         A test that only supplies `y` cannot tell "prompted and
//                         got yes" apart from "defaulted to yes".
//
// AND EVERY TTY-ENABLED TEST THAT REACHES A PROMPT MUST SUPPLY `input`. Under
// BOOTSTRAP_ASSUME_TTY=1 with stdin at EOF, `read` returns an empty reply and a
// sticky yes/no records `false` (TASK-045 harness artifact #1). That is an EOF
// path unreachable at a real terminal — never lean on it as expected behaviour.

// mcp.braveSearch: scope `global`, grammar `true | false`, default null. The
// null default is what makes an unseeded read resolve to the literal `unset`
// rather than to a settled answer, which is the state checkbox 4 needs.
const YN_KEY = 'mcp.braveSearch';

// gitCommit.autoPush: the only shape that can carry the `ask` state through
// prompt_yn_sticky's ladder — grammar `true | false | ask`. mcp.braveSearch
// CANNOT be seeded to `ask`; its own grammar rejects the value, so the ask test
// is forced onto a `scope: either` key read with a --project selector.
const ASK_KEY = 'gitCommit.autoPush';

// A string that appears nowhere in lib.sh, so finding it anywhere is
// unambiguous evidence the prompt argument was echoed rather than handed to
// `read -p`. See the banner: its ABSENCE proves nothing.
const PROMPT_MARKER = 'PROMPT-MARKER-DO-NOT-ECHO';
const YN_PROMPT = `  ${PROMPT_MARKER} Install Brave Search? [y/N]: `;

const REAL_SCHEMA = path.join(REPO, 'lib', 'scripts', 'templates', 'bootstrap-prefs-schema.json');

/**
 * `st=0; <call> || st=$?; echo RC=$st` — the return code, captured without
 * letting `set -euo pipefail` abort the wrapper on the perfectly valid `1` that
 * means "no". A bare call would kill the shell and every assertion with it.
 */
function stickySnippet(key, selector, prompt) {
  return [
    'st=0',
    `prompt_yn_sticky ${key} ${selector} ${JSON.stringify(prompt)} || st=$?`,
    'echo "RC=$st"',
  ].join('\n');
}

/** The RC=<n> marker stickySnippet prints, as a number. */
function returnCode(res) {
  const m = res.stdout.match(/^RC=(\d+)$/m);
  assert.ok(m, `the snippet did not reach its RC marker:\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`);
  return Number(m[1]);
}

/**
 * Plant a value the REAL schema does not accept into one of the scratch layers.
 *
 * `--target` alone does NOT do this. Validation in bootstrap-prefs.js:688-696 is
 * keyed on the SCHEMA ENTRY, not on the layer, so `--set mcp.braveSearch --value
 * maybe --target <file>` exits 1 exactly like `--global` would. (The TASK-047
 * Step 1 digest says otherwise; the source is authoritative and was checked.)
 * The write therefore goes through `--target` PLUS a `--schema` fixture that
 * clones the real entry with its `values` grammar removed — allowedValues()
 * returns null for a non-string `values` and permits anything.
 *
 * That combination is also the honest model of the situation this branch exists
 * for: a value written by a build whose grammar was wider, read back by a build
 * whose grammar is narrower. lib.sh reads it through the REAL schema, because
 * prefs_get never passes --schema.
 *
 * `dir` picks WHICH layer file the value is planted in, and it is not cosmetic:
 * bootstrap-prefs.js resolution is scope-constrained, so a `scope: project` key
 * planted in the scratch HOME would never be read back through a `--project`
 * selector and the test would silently exercise `unset` instead of the
 * unrecognized-value branch. It defaults to S.home, which is where every
 * `scope: global` key (mcp.braveSearch and friends) must go.
 */
function plantUnrecognizedValue(S, key, value, dir = S.home) {
  const where = dir === S.home ? 'scratch HOME' : 'scratch project';
  const schema = JSON.parse(fs.readFileSync(REAL_SCHEMA, 'utf8'));
  assert.ok(schema[key], `${key} is not in the real schema — this fixture is modelled on a real entry`);

  // The guard that stops this test going vacuous if the grammar is ever widened
  // to include <value>: prove the real grammar rejects it before bypassing it.
  const rejected = prefsCli(['--set', key, '--value', value, '--target', prefsFile(dir)], S.env);
  assert.equal(
    rejected.status,
    1,
    `the real schema now ACCEPTS ${key}=${value} — this test no longer plants an unrecognized value:\n${rejected.stdout}`
  );
  assertNoPrefsFile(dir, `${where} after a rejected --set`);

  // The fixture is a throwaway schema, not a values file, so it lives beside the
  // scratch HOME rather than inside either layer's .claude/ directory — where
  // assertNoPrefsFile would otherwise have to learn to ignore it.
  const fixture = path.join(S.home, 'loosened-schema-fixture.json');
  fs.writeFileSync(fixture, JSON.stringify({ [key]: { ...schema[key], values: null } }, null, 2) + '\n');

  const res = prefsCli(
    ['--set', key, '--value', value, '--target', prefsFile(dir), '--schema', fixture],
    S.env
  );
  assert.equal(res.status, 0, `planting ${key}=${value} failed: ${res.stderr}`);
  assert.equal(readPrefs(dir)[key], value, `${key} did not land as the raw string ${value}`);
}

test('prompt_yn_sticky: a remembered `true` returns 0, prints the notice, and never reads stdin', () => {
  withScratchEnv((S) => {
    seedPref(S, 'global', YN_KEY, true);

    // POISON. `n` is the opposite of the seeded answer: if `read` ever ran, this
    // reply would be consumed and the helper would return 1. Returning 0 is the
    // real proof the prompt was skipped — not the absent prompt text.
    const r = runShell(stickySnippet(YN_KEY, '--global', YN_PROMPT), {
      env: S.env,
      tty: true,
      input: 'n\n',
    });

    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      returnCode(r),
      0,
      'a remembered `true` did not return 0 — either the store was not consulted, or the poison `n` on stdin ' +
        'was consumed, which means the prompt ran when it should have been suppressed'
    );
    assert.match(
      r.stdout,
      /^\s*mcp\.braveSearch: using remembered answer \(yes\) — change with \/bootstrap-config\s*$/m,
      'the remembered-answer notice is missing from stdout (it goes to stdout here, unlike _sticky_lookup\'s)'
    );
    // Cheap regression guard only — see this section's banner. Under a pipe this
    // holds whether or not the prompt fired, so it is NOT the suppression proof.
    assert.ok(!r.stdout.includes(PROMPT_MARKER), 'the prompt text was echoed to stdout');
    assert.ok(!r.stderr.includes(PROMPT_MARKER), 'the prompt text was echoed to stderr');

    // The remembered answer must survive being used.
    assert.deepEqual(readPrefs(S.home), { [YN_KEY]: true }, 'reading a remembered answer rewrote the store');
  });
});

test('prompt_yn_sticky: a remembered `false` returns 1, prints the notice, and never reads stdin', () => {
  withScratchEnv((S) => {
    seedPref(S, 'global', YN_KEY, false);

    // POISON, mirrored: `y` would flip this to 0 if stdin were consumed.
    const r = runShell(stickySnippet(YN_KEY, '--global', YN_PROMPT), {
      env: S.env,
      tty: true,
      input: 'y\n',
    });

    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      returnCode(r),
      1,
      'a remembered `false` did not return 1 — the poison `y` on stdin was consumed, so the prompt ran ' +
        'and the whole point of remembering a decline is gone'
    );
    assert.match(
      r.stdout,
      /^\s*mcp\.braveSearch: using remembered answer \(no\) — change with \/bootstrap-config\s*$/m,
      'the remembered-decline notice is missing from stdout'
    );
    assert.ok(!r.stdout.includes(PROMPT_MARKER), 'the prompt text was echoed to stdout');
    assert.ok(!r.stderr.includes(PROMPT_MARKER), 'the prompt text was echoed to stderr');

    assert.deepEqual(readPrefs(S.home), { [YN_KEY]: false }, 'reading a remembered decline rewrote the store');
  });
});

test('prompt_yn_sticky: a stored `ask` prompts every run and the reply does NOT overwrite it', () => {
  // THE CONFLATION TRAP, on the shell side. `ask` and `unset` both lead to a
  // prompt, which makes them easy to collapse into one branch — and a collapsed
  // `ask` is silently destroyed by the very next reply, in whichever direction
  // that reply happened to go. So both replies are exercised: either one
  // overwriting the stored `ask` is the bug.
  for (const [reply, expected] of [
    ['y\n', 0],
    ['n\n', 1],
  ]) {
    withScratchEnv((S) => {
      seedPref(S, 'project', ASK_KEY, 'ask');

      const r = runShell(stickySnippet(ASK_KEY, S.projectDir, YN_PROMPT), {
        env: S.env,
        tty: true,
        input: reply,
      });

      assert.equal(r.status, 0, r.stderr);
      // BOTH BRANCHES. y -> 0 and n -> 1 together prove the reply was read; one
      // of them alone could not tell a prompt apart from a fixed default.
      assert.equal(
        returnCode(r),
        expected,
        `a stored \`ask\` fed ${JSON.stringify(reply)} returned the wrong code — the prompt did not run, ` +
          'or its reply was ignored'
      );
      assert.doesNotMatch(
        r.stdout,
        /using remembered answer/,
        '`ask` printed a remembered-answer notice — it is a settled answer meaning "keep asking", not a settled yes/no'
      );

      // THE ASSERTION THIS TEST EXISTS FOR.
      assert.deepEqual(
        readPrefs(S.projectDir),
        { [ASK_KEY]: 'ask' },
        `the reply ${JSON.stringify(reply)} overwrote a stored \`ask\` — the user asked to be asked every time and ` +
          'answering once took that away'
      );
      assertNoPrefsFile(S.home, 'scratch HOME (an `ask` reply must not be recorded in the other layer either)');
    });
  }
});

test('prompt_yn_sticky: an unanswered key prompts, honours the reply, and records a JSON boolean', () => {
  for (const [reply, expectedCode, expectedStored] of [
    ['y\n', 0, true],
    ['n\n', 1, false],
  ]) {
    withScratchEnv((S) => {
      assertNoPrefsFile(S.home, 'scratch HOME before the prompt');

      const r = runShell(stickySnippet(YN_KEY, '--global', YN_PROMPT), {
        env: S.env,
        tty: true,
        input: reply,
      });

      assert.equal(r.status, 0, r.stderr);
      // BOTH BRANCHES again: y -> 0, n -> 1. Only the pair proves a prompt ran.
      assert.equal(
        returnCode(r),
        expectedCode,
        `an unset key fed ${JSON.stringify(reply)} returned the wrong code — the reply was not read`
      );
      assert.doesNotMatch(r.stdout, /using remembered answer/, 'an unset key printed a remembered-answer notice');
      assert.ok(!r.stdout.includes(PROMPT_MARKER), 'the prompt text was echoed to stdout');

      const stored = readPrefs(S.home);
      assert.ok(stored, `nothing was recorded — an interactively given answer must settle an unset key`);
      assert.deepEqual(stored, { [YN_KEY]: expectedStored }, 'the wrong value was recorded');
      // TYPE, not just truthiness. The string "false" is TRUTHY in every shell
      // test lib.sh performs, so a stringified decline reads back as a settled
      // YES on the next run — the exact inversion this grammar exists to stop.
      assert.equal(
        typeof stored[YN_KEY],
        'boolean',
        `${YN_KEY} was stored as ${typeof stored[YN_KEY]} (${JSON.stringify(stored[YN_KEY])}), not a JSON boolean`
      );
      assert.equal(readPrefs(S.projectDir), null, 'a --global answer leaked into the project layer');
    });
  }
});

test('prompt_yn (via prompt_yn_sticky): a bare Enter honours the bracket default the prompt text displays', () => {
  // Every prompt in this codebase signals its default via bracket
  // capitalization — "[Y/n]" or "[y/N]" — but until this fix, an empty reply
  // ALWAYS meant "no" regardless of what the brackets promised, silently
  // declining a "[Y/n]" prompt on a bare Enter. Two keys, two bracket
  // spellings, same empty reply: the code (not just the label) must differ.
  for (const [prompt, expectedCode, expectedStored] of [
    [`  ${PROMPT_MARKER} Install the thing? [Y/n]: `, 0, true],
    [`  ${PROMPT_MARKER} Install the thing? [y/N]: `, 1, false],
  ]) {
    withScratchEnv((S) => {
      const r = runShell(stickySnippet(YN_KEY, '--global', prompt), {
        env: S.env,
        tty: true,
        input: '\n',
      });

      assert.equal(r.status, 0, r.stderr);
      assert.equal(
        returnCode(r),
        expectedCode,
        `a bare Enter against ${JSON.stringify(prompt)} returned the wrong code — the bracket default was not honoured`
      );

      const stored = readPrefs(S.home);
      assert.deepEqual(
        stored,
        { [YN_KEY]: expectedStored },
        `a bare Enter against ${JSON.stringify(prompt)} recorded the wrong value`
      );
    });
  }
});

test('prompt_yn_sticky: an unrecognized stored value warns on stderr and falls back to prompting', () => {
  // Not "silently treat it as a decline". A stored value the current grammar has
  // no branch for (menu reordered, grammar narrowed under an old answer) must
  // re-ask: guessing `no` would suppress a question the user never declined.
  for (const [reply, expectedCode, expectedStored] of [
    ['y\n', 0, true],
    ['n\n', 1, false],
  ]) {
    withScratchEnv((S) => {
      plantUnrecognizedValue(S, YN_KEY, 'maybe');

      const r = runShell(stickySnippet(YN_KEY, '--global', YN_PROMPT), {
        env: S.env,
        tty: true,
        input: reply,
      });

      assert.equal(r.status, 0, r.stderr);
      assert.match(
        r.stderr,
        /^\s*Warning: mcp\.braveSearch holds unrecognized value "maybe" — treating it as unset\.\s*$/m,
        `the unrecognized-value warning is missing from stderr (it must NOT go to stdout):\n${r.stderr}`
      );
      assert.doesNotMatch(r.stdout, /Warning: /, 'the warning went to stdout, where a caller could capture it as data');

      // BOTH BRANCHES: y -> 0, n -> 1 proves it fell back to a real prompt
      // rather than short-circuiting to a decline.
      assert.equal(
        returnCode(r),
        expectedCode,
        `an unrecognized stored value fed ${JSON.stringify(reply)} returned the wrong code — it was treated as a ` +
          'settled answer instead of falling back to the prompt'
      );
      assert.doesNotMatch(r.stdout, /using remembered answer/, 'an unrecognized value printed a remembered-answer notice');

      // "treating it as unset" is literal: the reply settles the key, replacing
      // the junk with a value the grammar accepts.
      assert.deepEqual(
        readPrefs(S.home),
        { [YN_KEY]: expectedStored },
        'the interactively given answer did not replace the unrecognized value'
      );
      assert.equal(typeof readPrefs(S.home)[YN_KEY], 'boolean', 'the replacement was not a JSON boolean');
    });
  }
});

// ===========================================================================
// NO TTY — THE STRONGEST CLAIM IN THIS FILE
// ===========================================================================
//
// WHY THIS SECTION OUTRANKS EVERY OTHER SECTION HERE.
//
// "A remembered answer suppresses the prompt" fails LOUDLY. The first human who
// runs the installer is asked a question they already answered, says so, and it
// gets fixed the same day.
//
// "A non-interactive run records NOTHING" fails SILENTLY AND PERMANENTLY. One CI
// run — or one `bash setup.sh </dev/null`, or one invocation from an editor task
// runner — writes a `false`, and from that moment the prompt never appears again
// on that machine. There is no symptom to notice, because the symptom IS the
// missing prompt. There is nothing in a diff to review, because the store lives
// outside the repo. And there is no prompt left through which the user could
// change their mind: the mechanism that would let them undo the bad write is
// exactly the mechanism the bad write disabled. An unattended decline that
// persists is strictly worse than the re-prompting this whole layer exists to
// remove — which is why lib.sh makes the rule STRUCTURAL, returning before
// prefs_set rather than guarding it with a flag (lib.sh:217-305, :400-516).
//
// SO THE ASSERTION IS NOT "the auto-answer was not applied". It is: THE VALUES
// FILE DOES NOT EXIST, AND NEITHER DOES ITS bootstrap-prefs.README.md COMPANION,
// IN EITHER LAYER. The companion is the second half on purpose — it is
// regenerated by every successful --set/--unset and never by a read, so a
// companion beside a missing values file is proof that a write path executed and
// got further than it should have. That is what assertNoPrefsFile checks, and it
// is checked against BOTH the scratch project and the scratch HOME, because a
// helper that wrote to the wrong layer would still have written.
//
// EVERY TEST BELOW SUPPLIES `input` IT EXPECTS TO BE IGNORED. That is deliberate,
// and it is stronger evidence than supplying none: with stdin at EOF, "the branch
// never reached `read`" and "there was nothing to read" are indistinguishable.
// Feeding an answer that WOULD flip the outcome, and getting the non-interactive
// outcome anyway, proves the no-tty branch short-circuits BEFORE `read`.
//
// THE STREAM SPLIT IS ASSERTED, NOT INCIDENTAL. prompt_yn_sticky returns its
// answer as an exit status, so its note goes to STDOUT; prompt_choice_sticky
// returns its answer ON STDOUT, so its note must go to STDERR or the caller's
// `$( )` would capture the diagnostic AS the answer. Hence the choice tests below
// capture through `$( )` and require the captured value to be exactly the name.

// mcp.playwrightConflict: scope `project`, grammar `shared | alongside | skip`,
// default null. The null default is what makes an unseeded read resolve to the
// literal `unset` and fall through to the no-tty branch — a key with a non-null
// default (gitCommit.versionBump, say) would be answered by _sticky_lookup as a
// `hit:` and would never reach the branch under test.
const CHOICE_KEY = 'mcp.playwrightConflict';
const CHOICE_NAMES = ['shared', 'alongside', 'skip'];

// `skip` — the answer that changes nothing — is the honest default for a conflict
// menu, and it is deliberately NOT the value seeded in the honoured-store test
// below, so "the stored answer came back" cannot be confused with "the default
// came back".
const CHOICE_DEFAULT = 'skip';
const CHOICE_PROMPT = `  ${PROMPT_MARKER} Playwright conflict — [1] shared [2] alongside [3] skip: `;

// gitignore.offerSectionUpdates: the only key in the real schema whose grammar
// carries `ask` ALONGSIDE a set of names prompt_choice_sticky can legally resolve
// (`true | false | ask`). Its real consumer is a slash command rather than this
// helper, which is fine — what is under test is lib.sh's shared _sticky_lookup
// ladder (lib.sh:518-575), not that call site. mcp.playwrightConflict cannot be
// used here: its own grammar rejects the value `ask`.
const ASK_CHOICE_KEY = 'gitignore.offerSectionUpdates';
const ASK_CHOICE_NAMES = ['true', 'false', 'ask'];
const ASK_CHOICE_DEFAULT = 'true';

/**
 * `out="$(prompt_choice_sticky ...)"; printf 'OUT=[%s]\n' "$out"` — the call in
 * the exact form its real callers use.
 *
 * Capturing through `$( )` is the point, not a convenience: prompt_choice_sticky
 * documents stdout AS its return value, so routing the capture through a shell
 * command substitution is what turns "a notice leaked to stdout" into a visible
 * failure — the leak would appear INSIDE the brackets. Asserting on the child's
 * raw stdout alone would let a notice printed after the name pass unnoticed.
 */
function choiceSnippet(key, selector, defaultName, prompt, names) {
  return [
    `out="$(prompt_choice_sticky ${key} ${selector} ${defaultName} ${JSON.stringify(prompt)} ${names.join(' ')})"`,
    `printf 'OUT=[%s]\\n' "$out"`,
  ].join('\n');
}

/**
 * A byte-level fingerprint of a layer's two files, for proving a read did not
 * rewrite them.
 *
 * SHA-256 OF THE RAW BYTES, NOT THE PARSED OBJECT. A rewrite that happened to
 * produce equivalent JSON is still a write — it means the helper reached
 * prefs_set — and comparing parsed objects would call that clean. Key order,
 * indentation, and the trailing newline are all part of the evidence.
 *
 * mtimeMs IS THE LOAD-BEARING FIELD HERE, NOT A FREEBIE. Measured against the
 * real helper: re-setting a key to the value it already holds exits 0 and leaves
 * the values file BYTE-IDENTICAL (same sha256, same size) while advancing the
 * mtime of both the values file and its companion. That idempotent rewrite is
 * precisely the shape a regression in this section would take — a helper that
 * read `true` and then wrote `true` straight back — so a bytes-only comparison
 * would report it clean. mtime is the only signal that catches it.
 *
 * It also cannot flake in the direction that matters. The assertion is that the
 * mtime did NOT change, and an untouched file's mtime cannot change on its own;
 * the failure mode of a coarse-granularity filesystem is a missed detection, not
 * a spurious failure. (Asserting a mtime DID advance would be the flaky
 * direction, and nothing here does that.)
 */
function storeFingerprint(dir) {
  return [prefsFile(dir), companionFile(dir)].map((file) => {
    if (!fs.existsSync(file)) return { file, exists: false };
    const st = fs.statSync(file);
    return {
      file,
      exists: true,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      size: st.size,
      mtimeMs: st.mtimeMs,
    };
  });
}

/** The seam must be absent, not merely falsy — see curatedEnv's banner. */
function assertNoTtySeam(S) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(S.env, 'BOOTSTRAP_ASSUME_TTY'),
    false,
    'BOOTSTRAP_ASSUME_TTY is present in the curated env — every test in this section would then be exercising ' +
      'the INTERACTIVE path and passing for the wrong reason'
  );
}

const YN_NO_TTY_NOTE = '  Non-interactive terminal: skipping prompt, answering no.';

test('prompt_yn_sticky: no tty and no stored answer — returns 1, ignores stdin, and records NOTHING in either layer', () => {
  withScratchEnv((S) => {
    assertNoTtySeam(S);
    assertNoPrefsFile(S.home, 'scratch HOME before the run');
    assertNoPrefsFile(S.projectDir, 'scratch project before the run');

    const r = runShell(stickySnippet(YN_KEY, '--global', YN_PROMPT), {
      env: S.env,
      // NO `tty: true` — this is the whole point of the test.
      // POISON: `y` is the answer that would flip the result to 0 if the branch
      // ever reached `read`. Getting 1 anyway proves it short-circuited first.
      input: 'y\n',
    });

    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      returnCode(r),
      1,
      'a no-tty run did not answer no — either has_tty was true (the seam leaked in), or the `y` on stdin was ' +
        'consumed, which means a prompt ran with nobody there to see it'
    );

    // WHOLE-STDOUT equality, not a substring match. It pins three things at once:
    // the note's exact text, that it is on STDOUT (prompt_yn_sticky returns its
    // answer as a status, so stdout is free for the notice), and that it appears
    // EXACTLY ONCE. prompt_yn has a non-interactive branch printing the identical
    // line; prompt_yn_sticky's own check returns before delegating, so a second
    // copy of this line would mean that early return was removed.
    assert.equal(
      r.stdout,
      `${YN_NO_TTY_NOTE}\nRC=1\n`,
      'unexpected stdout — a duplicated note means prompt_yn_sticky fell through to prompt_yn instead of returning'
    );
    assert.equal(r.stderr, '', `the no-tty path must be silent on stderr, got:\n${r.stderr}`);
    assert.ok(!r.stdout.includes(PROMPT_MARKER), 'the prompt text was echoed to stdout');
    assert.ok(!r.stderr.includes(PROMPT_MARKER), 'the prompt text was echoed to stderr');

    // THE ASSERTION THIS TEST EXISTS FOR — and it is about the FILES, not about
    // the answer. See this section's banner: a persisted non-interactive decline
    // is invisible, permanent, and leaves no prompt through which to reverse it.
    assertNoPrefsFile(S.home, 'scratch HOME after a no-tty run');
    assertNoPrefsFile(S.projectDir, 'scratch project after a no-tty run');
  });
});

test('prompt_choice_sticky: no tty and no stored answer — echoes the default on stdout, notes on stderr, records NOTHING', () => {
  withScratchEnv((S) => {
    assertNoTtySeam(S);
    assertNoPrefsFile(S.home, 'scratch HOME before the run');
    assertNoPrefsFile(S.projectDir, 'scratch project before the run');

    const r = runShell(choiceSnippet(CHOICE_KEY, S.projectDir, CHOICE_DEFAULT, CHOICE_PROMPT, CHOICE_NAMES), {
      env: S.env,
      // POISON: a LEGAL name that is not the default. If `read` ran, the capture
      // below would read `alongside` — a wrong answer that would then have been
      // recorded and re-used forever.
      input: 'alongside\n',
    });

    assert.equal(r.status, 0, r.stderr);

    // EXACTLY the default name inside the brackets, and nothing else on stdout.
    // Any notice on stdout would land inside `OUT=[...]` and be returned to the
    // caller AS the answer, which is why the note lives on stderr.
    assert.equal(
      r.stdout,
      `OUT=[${CHOICE_DEFAULT}]\n`,
      'stdout is not exactly the default name — either the no-tty note leaked onto stdout (where a caller captures ' +
        'it as data) or the poison `alongside` on stdin was consumed'
    );
    assert.match(
      r.stderr,
      /^\s*Non-interactive terminal: skipping prompt, choosing skip\.\s*$/m,
      `the no-tty note is missing from stderr (it must NOT go to stdout):\n${r.stderr}`
    );
    assert.ok(!r.stderr.includes(PROMPT_MARKER), 'the prompt text was echoed to stderr');

    // THE ASSERTION THIS TEST EXISTS FOR.
    assertNoPrefsFile(S.projectDir, 'scratch project after a no-tty run');
    assertNoPrefsFile(S.home, 'scratch HOME after a no-tty run');
  });
});

test('prompt_yn_sticky: no tty still READS the store — a remembered `true` is honoured and the file is not rewritten', () => {
  // THE OTHER HALF OF THE CLAIM. "Records nothing without a tty" must not have
  // been implemented by skipping the store entirely: a CI run that ignored a
  // user's remembered `yes` would silently stop installing something they asked
  // for. So the read path is proven to still run with no tty.
  //
  // ONLY THE `true` DIRECTION CAN PROVE THIS. A seeded `false` also returns 1 —
  // which is exactly what the no-tty auto-answer returns — so it could not tell
  // "the store was read" apart from "the store was ignored". `true` returning 0
  // is only reachable through the store.
  withScratchEnv((S) => {
    assertNoTtySeam(S);
    seedPref(S, 'global', YN_KEY, true);
    const before = storeFingerprint(S.home);

    const r = runShell(stickySnippet(YN_KEY, '--global', YN_PROMPT), {
      env: S.env,
      input: 'n\n', // POISON, and also the answer the no-tty branch would give.
    });

    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      returnCode(r),
      0,
      'a remembered `true` was not honoured without a tty — the no-tty branch fired BEFORE the store lookup, so ' +
        'an unattended run would silently ignore an answer the user did give'
    );
    assert.match(
      r.stdout,
      /^\s*mcp\.braveSearch: using remembered answer \(yes\) — change with \/bootstrap-config\s*$/m,
      'the remembered-answer notice is missing from stdout'
    );
    assert.doesNotMatch(
      r.stdout,
      /Non-interactive terminal/,
      'the no-tty note was printed as well — the ladder must return on a hit, before the has_tty check'
    );

    // BYTES, not the parsed object: a rewrite producing equivalent JSON is still
    // a write, and would mean prefs_set was reached on a path that must not reach it.
    assert.deepEqual(
      storeFingerprint(S.home),
      before,
      'reading a remembered answer rewrote the store (bytes and/or mtime changed) — a read must never write'
    );
    assertNoPrefsFile(S.projectDir, 'scratch project (a --global read must not create the other layer)');
  });
});

test('prompt_choice_sticky: no tty still READS the store — a remembered name is honoured and the file is not rewritten', () => {
  withScratchEnv((S) => {
    assertNoTtySeam(S);
    // `shared` is deliberately NOT CHOICE_DEFAULT: if the store were being
    // ignored, the no-tty branch would answer `skip`, and the assertion below
    // would catch it. Seeding the default would make this test unfalsifiable.
    seedPref(S, 'project', CHOICE_KEY, 'shared');
    const before = storeFingerprint(S.projectDir);

    const r = runShell(choiceSnippet(CHOICE_KEY, S.projectDir, CHOICE_DEFAULT, CHOICE_PROMPT, CHOICE_NAMES), {
      env: S.env,
      input: 'alongside\n', // POISON
    });

    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      r.stdout,
      'OUT=[shared]\n',
      'the remembered name did not come back on stdout — `skip` here means the no-tty branch fired before the ' +
        'store lookup, `alongside` means stdin was consumed, and anything longer means a notice leaked to stdout'
    );
    assert.match(
      r.stderr,
      /^\s*mcp\.playwrightConflict: using remembered answer \(shared\) — change with \/bootstrap-config\s*$/m,
      `_sticky_lookup's remembered-answer notice is missing from stderr:\n${r.stderr}`
    );
    assert.doesNotMatch(
      r.stderr,
      /Non-interactive terminal/,
      'the no-tty note was printed as well — the ladder must return on a hit, before the has_tty check'
    );

    assert.deepEqual(
      storeFingerprint(S.projectDir),
      before,
      'reading a remembered answer rewrote the store (bytes and/or mtime changed) — a read must never write'
    );
    assertNoPrefsFile(S.home, 'scratch HOME (a --project read must not create the other layer)');
  });
});

test('prompt_yn_sticky: a stored `ask` with no tty answers no, leaves the `ask` intact, and records NOTHING', () => {
  // PINNING REAL BEHAVIOUR, NOT ENDORSING IT. `ask` means "keep asking" — but
  // there is no tty to ask on. lib.sh:217-305 sets record=false for `ask` and
  // then hits the same `if ! has_tty` return as `unset`, so the observable
  // outcome is identical to an unanswered key: note on stdout, return 1, no
  // write. The two states differ only in what is left on disk afterwards, and
  // that difference is what the fingerprint below protects.
  //
  // Do NOT "improve" lib.sh to make this read better. The important half is
  // already right: an `ask` is not consumed, downgraded, or overwritten by a run
  // that never actually asked anything.
  withScratchEnv((S) => {
    assertNoTtySeam(S);
    seedPref(S, 'project', ASK_KEY, 'ask');
    const before = storeFingerprint(S.projectDir);

    const r = runShell(stickySnippet(ASK_KEY, S.projectDir, YN_PROMPT), {
      env: S.env,
      input: 'y\n', // POISON
    });

    assert.equal(r.status, 0, r.stderr);
    assert.equal(returnCode(r), 1, 'a stored `ask` with no tty must fall through to the same auto-no as `unset`');
    assert.equal(r.stdout, `${YN_NO_TTY_NOTE}\nRC=1\n`, 'unexpected stdout for a stored `ask` with no tty');
    assert.doesNotMatch(
      r.stdout,
      /using remembered answer/,
      '`ask` printed a remembered-answer notice — it is a settled "keep asking", not a settled yes/no'
    );

    // THE ASSERTION THIS TEST EXISTS FOR: the `ask` survives byte-for-byte. A run
    // with nobody watching must not be able to settle a question the user
    // explicitly asked to be re-asked.
    assert.deepEqual(
      storeFingerprint(S.projectDir),
      before,
      'a no-tty run rewrote a stored `ask` — the user asked to be asked every time and an unattended run took it away'
    );
    assert.deepEqual(readPrefs(S.projectDir), { [ASK_KEY]: 'ask' }, 'the stored `ask` did not survive');
    assertNoPrefsFile(S.home, 'scratch HOME (a no-tty `ask` must not be recorded in the other layer either)');
  });
});

test('prompt_choice_sticky: a stored `ask` with no tty chooses the default, leaves the `ask` intact, and records NOTHING', () => {
  // Same pinning as above, through the shared _sticky_lookup ladder: `ask` is
  // returned as its own token (lib.sh:518-575), record is cleared, and the
  // has_tty check then produces the default — observably identical to `unset`.
  withScratchEnv((S) => {
    assertNoTtySeam(S);
    seedPref(S, 'project', ASK_CHOICE_KEY, 'ask');
    const before = storeFingerprint(S.projectDir);

    const r = runShell(
      choiceSnippet(ASK_CHOICE_KEY, S.projectDir, ASK_CHOICE_DEFAULT, CHOICE_PROMPT, ASK_CHOICE_NAMES),
      {
        env: S.env,
        // POISON: `false` is a legal name here and is not the default.
        input: 'false\n',
      }
    );

    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      r.stdout,
      `OUT=[${ASK_CHOICE_DEFAULT}]\n`,
      'a stored `ask` with no tty must resolve to the default name and nothing else'
    );
    assert.match(
      r.stderr,
      /^\s*Non-interactive terminal: skipping prompt, choosing true\.\s*$/m,
      `the no-tty note is missing from stderr:\n${r.stderr}`
    );
    assert.doesNotMatch(r.stderr, /using remembered answer/, '`ask` printed a remembered-answer notice');

    assert.deepEqual(
      storeFingerprint(S.projectDir),
      before,
      'a no-tty run rewrote a stored `ask` — an unattended run settled a question the user asked to keep being asked'
    );
    assert.deepEqual(readPrefs(S.projectDir), { [ASK_CHOICE_KEY]: 'ask' }, 'the stored `ask` did not survive');
    assertNoPrefsFile(S.home, 'scratch HOME (a no-tty `ask` must not be recorded in the other layer either)');
  });
});

// ===========================================================================
// prompt_choice_sticky — THE INTERACTIVE RESOLVER, AND WHAT IT STORES
// ===========================================================================
//
// The section above proved the no-tty half. This one drives the branch a real
// user reaches: the prompt actually runs, a reply is resolved to a name, and the
// NAME — never the digit that selected it — is what lands in the store.
//
// STDOUT IS THE RETURN VALUE, AND THAT IS THE FRAGILE PART. prompt_choice_sticky
// documents stdout as its output (lib.sh:400-516), so ANY diagnostic printed
// there is captured by the caller's `$( )` AS THE ANSWER — an installer would
// then branch on, and record, a string like
// "  mcp.playwrightConflict: using remembered answer (shared) …". That is why
// every test below goes through choiceSnippet's `out="$(...)"; printf 'OUT=[%s]'`
// capture and asserts the WHOLE of stdout byte-for-byte via
// assertCapturedName(), rather than merely searching stdout for the name.
//
// ONE LIMIT OF THE CAPTURE, STATED SO NOBODY OVERREADS IT: `$( )` strips trailing
// newlines, so an extra blank line AFTER the name is invisible here. Everything
// else is not — a notice printed before the name lands inside the brackets, and
// leading or interior whitespace survives verbatim.
//
// THE PROMPT-TEXT RULE FROM THE prompt_yn_sticky BANNER APPLIES UNCHANGED: under
// spawnSync's pipe, `read -r -p` emits nothing anywhere, so asserting the prompt
// is absent proves nothing in either direction. Evidence a prompt RAN is that two
// different replies produce two different resolved names; evidence a prompt was
// SUPPRESSED is that poison stdin is ignored. Both shapes appear below.
//
// DIGITS ARE AN INPUT FORM, NOT A STORED VALUE. mcp.playwrightConflict's schema
// entry says so in as many words ("Values are stored by name, never as the raw
// menu digits 1/2/3, so the meaning survives a menu reorder"), and the
// unrecognized-value test at the end of this section is the other half of that
// design: it shows what a stored value that no longer matches a name actually
// does, which is exactly what a stored `2` would do after a reorder — except
// that a `2` would still resolve, silently, to the wrong option.

/**
 * The default name is chosen PER CASE so it never equals the expected answer.
 *
 * Without that, `input '3' -> 'skip'` with default `skip` is unfalsifiable: a
 * helper that ignored stdin entirely and always echoed the default would pass
 * it. Picking a default the case is not expecting turns every row into a real
 * two-outcome test.
 */
function otherName(name) {
  const other = CHOICE_NAMES.find((n) => n !== name);
  assert.ok(other, `no alternative default available for ${name}`);
  return other;
}

/**
 * The whole-stdout assertion for a `$( )`-captured choice.
 *
 * Two claims, deliberately separate. First, stdout is EXACTLY `OUT=[<name>]\n`
 * — one line, nothing before it, nothing after it; this is what fails if a
 * notice, a warning, or the no-tty note is ever moved to stdout. Second, the
 * captured text is a member of the legal name list, asserted on its own so the
 * failure message distinguishes "captured the wrong option" from "captured
 * diagnostic prose". A leading space is caught by both.
 */
function assertCapturedName(r, expected, names = CHOICE_NAMES) {
  assert.ok(names.includes(expected), `test bug: ${expected} is not one of ${names.join('|')}`);

  const m = r.stdout.match(/^OUT=\[([^\]]*)\]\n$/);
  assert.ok(
    m,
    'stdout is not exactly one OUT=[...] line — something other than the resolved name reached stdout, and a real ' +
      `caller's $( ) would have captured it AS the answer:\n${JSON.stringify(r.stdout)}`
  );
  assert.ok(
    names.includes(m[1]),
    `the captured value ${JSON.stringify(m[1])} is not one of the legal names (${names.join(' | ')}) — a diagnostic, ` +
      'a prompt echo, or stray whitespace was returned to the caller as its answer'
  );
  assert.equal(m[1], expected, 'the wrong name was resolved');
  assert.equal(r.stdout, `OUT=[${expected}]\n`, 'unexpected bytes on stdout');
}

test('prompt_choice_sticky: a digit selects the Nth name, and the NAME is what is stored — never the digit', () => {
  // 1/2/3 -> shared/alongside/skip, the menu order mcp.playwrightConflict's own
  // schema detail documents. The stored value is the point: a stored `2` would
  // still resolve after a menu reorder, and would resolve to the wrong option.
  for (const [input, expected] of [
    ['1\n', 'shared'],
    ['2\n', 'alongside'],
    ['3\n', 'skip'],
  ]) {
    withScratchEnv((S) => {
      assertNoPrefsFile(S.projectDir, 'scratch project before the prompt');
      const defaultName = otherName(expected); // never the expected answer — see otherName

      const r = runShell(choiceSnippet(CHOICE_KEY, S.projectDir, defaultName, CHOICE_PROMPT, CHOICE_NAMES), {
        env: S.env,
        tty: true,
        input,
      });

      assert.equal(r.status, 0, r.stderr);
      assertCapturedName(r, expected);
      assert.doesNotMatch(r.stdout, /using remembered answer/, 'an unset key printed a remembered-answer notice');
      assert.ok(!r.stdout.includes(PROMPT_MARKER), 'the prompt text was echoed to stdout');

      const stored = readPrefs(S.projectDir);
      assert.ok(stored, 'nothing was recorded — an interactively given answer must settle an unset key');
      assert.deepEqual(stored, { [CHOICE_KEY]: expected }, 'the wrong value was recorded');

      // THE ASSERTIONS THIS TEST EXISTS FOR, spelled out rather than folded into
      // the deepEqual above so a regression names itself.
      const value = stored[CHOICE_KEY];
      assert.equal(typeof value, 'string', `${CHOICE_KEY} was stored as ${typeof value}, not a string`);
      assert.equal(value, expected, 'the stored value is not the resolved name');
      assert.notEqual(value, Number(input.trim()), 'the raw menu digit was stored as a number');
      assert.notEqual(value, input.trim(), 'the raw menu digit was stored as a string');

      assert.equal(readPrefs(S.home), null, 'a --project answer leaked into the global layer');
    });
  }
});

test('prompt_choice_sticky: an exact name resolves to itself and is stored verbatim', () => {
  // The other accepted input form. Typing the name must not depend on the menu
  // order at all — which is what makes a name-keyed store survive a reorder.
  for (const expected of CHOICE_NAMES) {
    withScratchEnv((S) => {
      const defaultName = otherName(expected);

      const r = runShell(choiceSnippet(CHOICE_KEY, S.projectDir, defaultName, CHOICE_PROMPT, CHOICE_NAMES), {
        env: S.env,
        tty: true,
        input: `${expected}\n`,
      });

      assert.equal(r.status, 0, r.stderr);
      assertCapturedName(r, expected);
      assert.deepEqual(readPrefs(S.projectDir), { [CHOICE_KEY]: expected }, 'the typed name was not recorded verbatim');
      assert.equal(readPrefs(S.home), null, 'a --project answer leaked into the global layer');
    });
  }
});

test('prompt_choice_sticky: empty, EOF, an out-of-range digit and garbage all resolve to the declared default — and the default IS recorded', () => {
  // PINNING REAL BEHAVIOUR. Accepting the default is recorded exactly like any
  // other answer: `resolved` starts at <default-name> and the same
  // `if [ "$record" = true ]` gate at the bottom of prompt_choice_sticky
  // (lib.sh:400-516) writes it. There is no "only record a non-default reply"
  // rule — the sole thing that suppresses the write is record=false, which comes
  // from a stored `ask` (the test after this one) or from the no-tty return.
  // That is deliberate: pressing Enter IS an answer, and re-asking a question the
  // user has already waved through is the behaviour this layer exists to remove.
  //
  // ON THE `EOF` ROW. Under BOOTSTRAP_ASSUME_TTY=1 with stdin at EOF, `read`
  // returns non-zero with an empty reply, which `|| reply=""` absorbs. At a REAL
  // terminal this row is the user pressing Enter — the coincidence that a closed
  // pipe produces the same empty reply is a harness artifact and is NOT the thing
  // being asserted; the `empty line` row above it is the honest version of the
  // same claim, and both are here so neither carries the case alone.
  //
  // These rows cannot disambiguate "prompted and got no usable answer" from
  // "never prompted" on their own — the expected outcome IS the default. The
  // digit and exact-name tests above are what establish that a prompt runs at
  // all; these pin where the unusable replies land.
  for (const [label, input] of [
    ['empty line', '\n'],
    ['EOF (no stdin at all)', undefined],
    ['digit outside 1..N', '9\n'],
    ['garbage', 'banana\n'],
  ]) {
    withScratchEnv((S) => {
      assertNoPrefsFile(S.projectDir, 'scratch project before the prompt');

      const r = runShell(choiceSnippet(CHOICE_KEY, S.projectDir, CHOICE_DEFAULT, CHOICE_PROMPT, CHOICE_NAMES), {
        env: S.env,
        tty: true,
        ...(input === undefined ? {} : { input }),
      });

      assert.equal(r.status, 0, `${label}: ${r.stderr}`);
      assertCapturedName(r, CHOICE_DEFAULT);
      assert.doesNotMatch(r.stderr, /Non-interactive terminal/, `${label}: the no-tty note fired with the seam on`);
      assert.doesNotMatch(r.stdout, /using remembered answer/, `${label}: an unset key printed a remembered notice`);

      // "records nothing beyond that default's own rules": the default, in the
      // selector's layer, under this key, and nothing else anywhere.
      assert.deepEqual(
        readPrefs(S.projectDir),
        { [CHOICE_KEY]: CHOICE_DEFAULT },
        `${label}: an interactively accepted default must be recorded — exactly once, exactly as the default name`
      );
      assert.equal(typeof readPrefs(S.projectDir)[CHOICE_KEY], 'string', `${label}: the default was not stored as a string`);
      assert.equal(readPrefs(S.home), null, `${label}: a --project answer leaked into the global layer`);
    });
  }
});

test('prompt_choice_sticky: a stored `ask` prompts every run and the reply does NOT overwrite it', () => {
  // The one case where an interactively given answer is NOT recorded, and the
  // reason checkbox 3's "beyond that default's own rules" needs stating: record
  // is cleared by the `ask` token from _sticky_lookup (lib.sh:518-575), so the
  // resolved name is returned and then deliberately dropped.
  //
  // BOTH INPUT FORMS, both resolving AWAY from the default (`true`), so each row
  // independently proves the prompt ran: a helper that ignored stdin would echo
  // `true` here.
  for (const input of ['false\n', '2\n']) {
    withScratchEnv((S) => {
      seedPref(S, 'project', ASK_CHOICE_KEY, 'ask');
      const before = storeFingerprint(S.projectDir);

      const r = runShell(
        choiceSnippet(ASK_CHOICE_KEY, S.projectDir, ASK_CHOICE_DEFAULT, CHOICE_PROMPT, ASK_CHOICE_NAMES),
        { env: S.env, tty: true, input }
      );

      assert.equal(r.status, 0, r.stderr);
      assertCapturedName(r, 'false', ASK_CHOICE_NAMES);
      assert.doesNotMatch(
        r.stderr,
        /using remembered answer/,
        '`ask` printed a remembered-answer notice — it is a settled "keep asking", not a settled choice'
      );

      // THE ASSERTION THIS TEST EXISTS FOR: bytes AND mtime, because a rewrite
      // of `ask` back to `ask` is still a write and would mean prefs_set was
      // reached on a path that must never reach it.
      assert.deepEqual(
        storeFingerprint(S.projectDir),
        before,
        `the reply ${JSON.stringify(input)} rewrote a stored \`ask\` — the user asked to be asked every time and ` +
          'answering once took that away'
      );
      assert.deepEqual(readPrefs(S.projectDir), { [ASK_CHOICE_KEY]: 'ask' }, 'the stored `ask` did not survive');
      assertNoPrefsFile(S.home, 'scratch HOME (an `ask` reply must not be recorded in the other layer either)');
    });
  }
});

test('prompt_choice_sticky: a remembered name suppresses the prompt even WITH a tty, and never reads stdin', () => {
  // The no-tty section already proved the store is consulted when nobody is
  // there. This is the case that actually matters to a user: the terminal is
  // interactive, `read` is reachable, and the question must still not be asked.
  //
  // POISON: `alongside` is a LEGAL name and is neither the seeded answer nor the
  // default, so it is distinguishable from both failure modes. Getting `shared`
  // back is the proof — the absent prompt text proves nothing under a pipe.
  withScratchEnv((S) => {
    seedPref(S, 'project', CHOICE_KEY, 'shared');
    const before = storeFingerprint(S.projectDir);

    const r = runShell(choiceSnippet(CHOICE_KEY, S.projectDir, CHOICE_DEFAULT, CHOICE_PROMPT, CHOICE_NAMES), {
      env: S.env,
      tty: true,
      input: 'alongside\n',
    });

    assert.equal(r.status, 0, r.stderr);
    assertCapturedName(r, 'shared');
    assert.match(
      r.stderr,
      /^\s*mcp\.playwrightConflict: using remembered answer \(shared\) — change with \/bootstrap-config\s*$/m,
      `_sticky_lookup's remembered-answer notice is missing from stderr (it must NOT go to stdout):\n${r.stderr}`
    );
    assert.doesNotMatch(r.stdout, /using remembered answer/, 'the notice went to stdout, where $( ) captures it as data');
    assert.ok(!r.stdout.includes(PROMPT_MARKER), 'the prompt text was echoed to stdout');

    assert.deepEqual(
      storeFingerprint(S.projectDir),
      before,
      'using a remembered name rewrote the store (bytes and/or mtime changed) — a read must never write'
    );
    assertNoPrefsFile(S.home, 'scratch HOME (a --project read must not create the other layer)');
  });
});

test('prompt_choice_sticky: a stored value matching no legal name warns on stderr and re-prompts', () => {
  // THE MENU-REORDER CASE THE NAME-KEYED STORE EXISTS TO SURVIVE. A value written
  // by an older build — an option since renamed or removed — must not be handed
  // back to a caller that has no branch for it, and must not be silently
  // downgraded to the default either. _sticky_lookup (lib.sh:518-575) warns and
  // degrades it to `unset`, so the question is genuinely re-asked.
  //
  // `headless` is a syntactically fine string that is simply not one of
  // shared|alongside|skip. plantUnrecognizedValue writes it into the PROJECT
  // layer because mcp.playwrightConflict is `scope: project` — planted in the
  // scratch HOME it would never be read back, and this test would quietly become
  // a duplicate of the unset-key test above. It also proves the real grammar
  // still rejects the value before bypassing that grammar, so the fixture cannot
  // go vacuous if the schema is ever widened.
  for (const [input, expected] of [
    ['shared\n', 'shared'],
    ['2\n', 'alongside'],
  ]) {
    withScratchEnv((S) => {
      plantUnrecognizedValue(S, CHOICE_KEY, 'headless', S.projectDir);

      const r = runShell(choiceSnippet(CHOICE_KEY, S.projectDir, CHOICE_DEFAULT, CHOICE_PROMPT, CHOICE_NAMES), {
        env: S.env,
        tty: true,
        input,
      });

      assert.equal(r.status, 0, r.stderr);
      assert.match(
        r.stderr,
        /^\s*Warning: mcp\.playwrightConflict holds unrecognized value "headless" — treating it as unset\.\s*$/m,
        `the unrecognized-value warning is missing from stderr (it must NOT go to stdout):\n${r.stderr}`
      );

      // BOTH REPLIES, and neither is the default: `shared` and `alongside`
      // together prove it fell back to a real prompt rather than short-circuiting
      // to `skip`. The capture assertion is also what would catch the warning
      // leaking onto stdout, where it would be returned AS the answer.
      assertCapturedName(r, expected);
      assert.doesNotMatch(r.stdout, /Warning: /, 'the warning went to stdout, where a caller could capture it as data');
      assert.doesNotMatch(r.stdout, /using remembered answer/, 'an unrecognized value printed a remembered-answer notice');

      // "treating it as unset" is literal: the reply settles the key, replacing
      // the junk with a name the current grammar accepts.
      assert.deepEqual(
        readPrefs(S.projectDir),
        { [CHOICE_KEY]: expected },
        'the interactively given answer did not replace the unrecognized value'
      );
      assert.equal(typeof readPrefs(S.projectDir)[CHOICE_KEY], 'string', 'the replacement was not stored as a string');
      assertNoPrefsFile(S.home, 'scratch HOME (a --project answer must not touch the other layer)');
    });
  }
});


// ===========================================================================
// END TO END — THE REAL lib/scripts/merge-gitignore.sh, AGAINST REAL GIT REPOS
// ===========================================================================
//
// Everything above drives lib.sh's helpers through a synthetic wrapper. This
// section drives the SHIPPED SCRIPT, unmodified, with `--interactive`, against a
// scratch directory that has actually been `git init`'d — because three of the
// behaviours under test only exist once a real `.git/` directory does:
// `.git/info/exclude` is only offered when `[ -d "$PROJECT_DIR/.git" ]`
// (merge-gitignore.sh:352), `prefs.gitTracking`'s `[2] exclude` branch refuses to
// write without one (:465), and the sentinel-canonicality repair (:363) is what
// makes the second run silent.
//
// WHAT ONLY AN END-TO-END RUN CAN PROVE. The wrapper tests can show that
// `prompt_yn_sticky` records a decline. They cannot show that merge-gitignore.sh
// records it UNDER THE KEY IT LATER READS BACK — that key is computed at run time
// by `node bootstrap-prefs.js --section-key "$TITLE"` (:201) from a banner title
// parsed out of the template by awk (:50-65). Three independent pieces of string
// handling sit between the title in the template and the key in the store, and a
// drift in any one of them re-asks a question the user already declined, forever,
// with no error anywhere. The assertion below is therefore not "a key was
// written" but "the key written is byte-identical to what `--section-key` returns
// for that exact title" — computed here by invoking the same CLI, and checked for
// all offered sections at once, including the one whose title carries an EM DASH
// (U+2014), which is the character that breaks a byte-wise slugifier.
//
// COUNT YOUR PROMPTS OR YOUR TEST IS A LIE. Under BOOTSTRAP_ASSUME_TTY=1 with
// stdin at EOF, bash's `read` returns an empty reply and a sticky yes/no records
// `false` (TASK-045 harness artifact #1). So a run that supplies FEWER lines than
// it has prompts does not fail — it silently answers the tail with EOF-declines
// and stores them, and every assertion downstream is measuring an artifact. Every
// run below therefore supplies exactly one line per prompt it will reach, and the
// count is DERIVED from the template rather than hardcoded:
//
//   one per offered section  (merge-gitignore.sh:217)
//   + 1 for .git/info/exclude (:375)
//   + 1 for the prefs.gitTracking menu (:435)
//
// The master gate at :170 is NOT in that list, and must not be added to it:
// `gitignore.offerSectionUpdates` is `scope: either` with schema default `true`,
// so a virgin project takes the `true` arm at :162 and the opening question is
// never asked. A test that budgets a line for it shifts every later answer by one.
//
// AND THE ALIGNMENT IS ASSERTED, NOT ASSUMED. The first test accepts exactly ONE
// section and declines the rest: if stdin were off by a line, a DIFFERENT section
// would be merged and the store would carry a different key set. That is the
// evidence that the run consumed one line per prompt — stronger than counting
// prompt strings, which under a pipe never appear at all (`read -r -p` writes its
// prompt only to a terminal; see the prompt_yn_sticky banner above).
//
// SECOND-RUN EVIDENCE IS POISON STDIN, NOT SILENCE. "The section was not offered
// again" is proven by re-running with a stdin full of `y` — an answer that WOULD
// merge lines, WOULD rewrite .git/info/exclude, and WOULD record a choice if any
// prompt still fired — and finding all three files byte-identical afterwards.
//
// HERMETICITY, THE THIRD FILE. This section is the only one in this file that
// runs code whose job is to append to a `.gitignore` and a `.git/info/exclude`,
// and this checkout has both. `withRepoFilesUntouched` hashes THIS REPO's two
// files before the body and re-hashes them after, so a botched path — a relative
// target, a cwd that leaked, a `$PROJECT_DIR` that resolved to the repo root —
// fails an assertion here instead of landing as an unreviewed edit in the
// developer's working tree. It is not decoration: `assertRedirectLandedInScratch`
// guards the preference store and says nothing about these two.

const MERGE_GITIGNORE = path.join(REPO, 'lib', 'scripts', 'merge-gitignore.sh');
const TEMPLATE_GITIGNORE = path.join(REPO, 'lib', 'scripts', 'templates', 'gitignore');

// The two files in THIS checkout that merge-gitignore.sh is in the business of
// writing to. Guarded by hash, never written, and `.git/info/exclude` is allowed
// to be absent — absent-stays-absent is a valid state and is checked as one.
const REPO_GUARDED_FILES = [path.join(REPO, '.gitignore'), path.join(REPO, '.git', 'info', 'exclude')];

// The line merge-gitignore.sh:215 prints immediately BEFORE each section prompt.
// It is the only externally visible marker that a section was OFFERED: the prompt
// itself (`  Add these to .gitignore? [y/N]: `) goes through `read -r -p` and is
// therefore invisible under spawnSync's pipe.
const SECTION_OFFERED = /^ {2}\.gitignore section '(.+)' would add \d+ line\(s\):$/gm;

// merge-gitignore.sh:210 — the remembered-decline line, printed INSTEAD of the
// preview above, which is what "not offered again" looks like from outside.
const SECTION_REMEMBERED = /^ {2}\.gitignore section '(.+)': skipped \(remembered answer (\S+)=false — change with \/bootstrap-config\)\.$/gm;

const PREFS_VALUES_PATH = '.claude/bootstrap-prefs.json';
const PREFS_README_PATH = '.claude/bootstrap-prefs.README.md';

// The one sentinel merge-gitignore.sh:262 shares between the wiki/agent-state
// dirs and the bootstrap-prefs files. Written proactively — every interactive
// run against a git repo ensures this line exists in .git/info/exclude even
// when every exclude-affecting prompt is declined, so a fresh scratch repo's
// FIRST run is what creates it, not a later accepted prompt.
const GIT_EXCLUDE_SENTINEL = '# bootstrap machine-local (autocomplete-visible)';

/**
 * The template's sections, parsed the same way merge-gitignore.sh:50-65 parses
 * them, so the offered set and the prompt count are DERIVED rather than pinned.
 *
 * Mirrors the awk exactly: `# -----` banner lines come in pairs and every ODD one
 * opens a section; the first `# ` comment seen while the dash count is odd is the
 * title. `entries` applies section_missing_count's filter (:75-84) — leading
 * whitespace stripped, blanks and `#` comments dropped — because a section with
 * no entries is never offered at all and must not be budgeted a stdin line.
 */
function templateSections() {
  const sections = [];
  let dash = 0;
  let cur = null;
  for (const line of fs.readFileSync(TEMPLATE_GITIGNORE, 'utf8').split('\n')) {
    if (/^# -----/.test(line)) {
      dash += 1;
      if (dash % 2 === 1) {
        cur = { title: null, entries: [] };
        sections.push(cur);
      }
      continue;
    }
    if (!cur) continue;
    if (dash % 2 === 1 && cur.title === null && /^# /.test(line)) {
      cur.title = line.replace(/^# +/, '');
      continue;
    }
    const trimmed = line.replace(/^[ \t]+/, '');
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    cur.entries.push(line);
  }
  return sections;
}

/** The sections a virgin project is actually offered, in prompt order. */
function offeredSections() {
  const offered = templateSections().filter((s) => s.entries.length > 0);
  assert.ok(offered.length > 1, `the template parsed to ${offered.length} offered section(s) — the parser is broken`);
  for (const s of offered) {
    assert.ok(s.title, `a section has no title — merge-gitignore.sh would fall back to "section N" and the key would differ`);
  }
  const titles = offered.map((s) => s.title);
  assert.equal(new Set(titles).size, titles.length, 'two template sections share a title — they would share a preference key');
  return offered;
}

/** Locate a section by exact title, failing loudly if the template renamed it. */
function sectionIndex(offered, title) {
  const i = offered.findIndex((s) => s.title === title);
  assert.ok(
    i !== -1,
    `no template section titled ${JSON.stringify(title)} — it was renamed or removed; ` +
      `available: ${offered.map((s) => JSON.stringify(s.title)).join(', ')}`
  );
  return i;
}

/**
 * THE KEY THE PRODUCTION SCRIPT WILL COMPUTE, computed the same way it does.
 *
 * merge-gitignore.sh:201 shells out to `node bootstrap-prefs.js --section-key
 * "$TITLE"`, so this is the same CLI on the same string — which is the point.
 * Hardcoding the expected slug would test this test's idea of the rule; invoking
 * the CLI tests that the script and the helper agree on it, which is the thing
 * that can actually drift.
 */
function sectionKeyFor(S, title) {
  const r = prefsCli(['--section-key', title], S.env);
  assert.equal(r.status, 0, `--section-key ${JSON.stringify(title)} failed: ${r.stderr}`);
  assert.match(r.stdout, /^gitignore\.section\.[a-z0-9-]+$/, `--section-key returned an unusable key: ${JSON.stringify(r.stdout)}`);
  return r.stdout;
}

/**
 * `git init` in the scratch project — a REAL one, because `[ -d .git ]` is the
 * gate on two of the three branches under test.
 *
 * GIT_CONFIG_GLOBAL and GIT_CONFIG_SYSTEM are pinned at /dev/null so the
 * developer's own ~/.gitconfig and /etc/gitconfig cannot reach this repo (HOME is
 * already the scratch dir, which covers most of it; these two cover the rest,
 * including a GIT_CONFIG_GLOBAL exported in the parent shell). `-c
 * init.defaultBranch=main` only silences the hint.
 *
 * NO COMMIT IS EVER MADE, which is why no user.name/user.email is set: a commit
 * would need an identity, and nothing in merge-gitignore.sh reads git history —
 * it only ever tests for the directory and appends to .git/info/exclude.
 */
function gitInitScratch(dir, env) {
  const r = spawnSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q', dir], {
    encoding: 'utf8',
    env: { ...env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  assert.equal(r.status, 0, `git init failed in ${dir}: ${r.stderr}`);
  assert.ok(
    fs.existsSync(path.join(dir, '.git')) && fs.statSync(path.join(dir, '.git')).isDirectory(),
    `${dir}/.git is not a directory — merge-gitignore.sh would skip both git-dependent branches and the test would ` +
      'pass by never reaching them'
  );
}

/**
 * Run the REAL script with `--interactive`, the tty seam on, and an explicit
 * stdin.
 *
 * `input` is REQUIRED, including when it is the empty string. There is no default:
 * omitting stdin and supplying an empty stdin are different claims (see this
 * section's banner on EOF-declines), and a defaulted one would make it impossible
 * to tell which a given call meant.
 *
 * cwd is the scratch HOME — never the repo root and never the project — so a
 * relative path escaping the script would land somewhere this test owns and can
 * see, rather than in the checkout.
 */
function runMergeGitignore(S, projectDir, input) {
  assert.equal(typeof input, 'string', 'runMergeGitignore requires an explicit stdin string');
  const r = spawnSync('bash', [MERGE_GITIGNORE, '--interactive', projectDir], {
    encoding: 'utf8',
    env: { ...S.env, BOOTSTRAP_ASSUME_TTY: '1' },
    cwd: S.home,
    input,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * One stdin line per prompt the run will reach, in the order it reaches them.
 *
 * `accept(title)` decides each section; `infoExclude` the .git/info/exclude
 * question; `gitTracking` the 1/2/3 menu. The section answers are generated FROM
 * the offered list, so adding a section to the template cannot silently
 * de-align the two answers that follow it.
 */
function answerScript(offered, { accept, infoExclude, gitTracking }) {
  const lines = offered.map((s) => (accept(s.title) ? 'y' : 'n'));
  lines.push(infoExclude ? 'y' : 'n');
  lines.push(String(gitTracking));
  return lines.map((l) => `${l}\n`).join('');
}

/**
 * Stdin that would visibly change the world if ANY prompt still fired: every line
 * is `y`. A section prompt answered `y` merges lines into .gitignore; the
 * .git/info/exclude question answered `y` rewrites that file; and the
 * prefs.gitTracking menu given a non-digit, non-name reply resolves to its
 * declared default `exclude` AND RECORDS IT, advancing the store's mtime. So all
 * three prompt classes are detectable by the fingerprints taken around the run.
 */
const POISON_STDIN = 'y\n'.repeat(24);

/** Titles offered (preview shown) in a run's stdout, in order. */
function titlesOffered(stdout) {
  return [...stdout.matchAll(SECTION_OFFERED)].map((m) => m[1]);
}

/** [title, key] pairs the run reported as skipped-by-remembered-answer. */
function titlesRememberedSkipped(stdout) {
  return [...stdout.matchAll(SECTION_REMEMBERED)].map((m) => [m[1], m[2]]);
}

/** The `gitignore.section.*` keys in a layer's store, in insertion order. */
function storedSectionKeys(dir) {
  const stored = readPrefs(dir);
  if (!stored) return [];
  return Object.keys(stored).filter((k) => k.startsWith('gitignore.section.'));
}

function fileLines(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8').split('\n');
}

/** Exact whole-line membership — the same test grep -qFx makes. */
function hasExactLine(file, line) {
  const lines = fileLines(file);
  return lines !== null && lines.includes(line);
}

/**
 * A hash-only fingerprint for the untouched-file guard. Deliberately NOT
 * storeFingerprint: mtime is exactly right for "a read must not rewrite the
 * store", and exactly wrong here — these are files the test never opens for
 * writing, and an unrelated tool touching the checkout would turn a real
 * hermeticity guard into a flake. Content identity is the claim.
 */
function fingerprintFiles(files) {
  return files.map((file) => {
    if (!fs.existsSync(file)) return { file, exists: false };
    return {
      file,
      exists: true,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    };
  });
}

/**
 * Hash `files`, run `body`, re-hash, and REPORT A CHANGE AHEAD OF ANY FAILURE THE
 * BODY ITSELF PRODUCED.
 *
 * The ordering is the design. If the body throws AND a guarded file changed, the
 * guard failure is the one that gets raised — a modified checkout is a bigger
 * problem than whichever assertion noticed something odd first, and it is the one
 * that would otherwise be discovered days later in an unexplained diff. The
 * body's error is appended to the message so nothing is lost. If the guard is
 * clean, the body's error is rethrown untouched.
 */
function withFilesUntouched(files, body) {
  const before = fingerprintFiles(files);
  let bodyError = null;
  try {
    body();
  } catch (err) {
    bodyError = err;
  }
  const after = fingerprintFiles(files);
  try {
    assert.deepEqual(
      after,
      before,
      'a guarded file was modified by this test — the run wrote outside its scratch dirs:\n' +
        `before: ${JSON.stringify(before, null, 2)}\nafter:  ${JSON.stringify(after, null, 2)}`
    );
  } catch (guardError) {
    if (bodyError) guardError.message += `\n\n(the test body ALSO failed: ${bodyError.message})`;
    throw guardError;
  }
  if (bodyError) throw bodyError;
}

/** withFilesUntouched, bound to this checkout's .gitignore and .git/info/exclude. */
function withRepoFilesUntouched(body) {
  return withFilesUntouched(REPO_GUARDED_FILES, body);
}

/**
 * withScratchEnv + a real `git init` of the scratch project + the repo-file
 * guard, in that order, so no test can forget one.
 */
function withGitScratch(body) {
  return withRepoFilesUntouched(() => {
    withScratchEnv((S) => {
      gitInitScratch(S.projectDir, S.env);
      // git init must not have created a preference store, or the "nothing was
      // recorded" assertions below would start from a dirty baseline.
      assertNoPrefsFile(S.projectDir, 'scratch project after git init');
      assertNoPrefsFile(S.home, 'scratch HOME after git init');
      body(S);
    });
  });
}

test('harness: the untouched-file guard fires on a changed, a created, and a deleted file — and outranks a body failure', () => {
  // CHECKBOX 5 IS ONLY WORTH ANYTHING IF THIS GUARD CAN FAIL. Everything below
  // runs against SCRATCH files: proving the guard by damaging the repo's own
  // .gitignore is exactly what it exists to prevent.
  const dir = scratchDir('prompt-sticky-guard-');
  try {
    const present = path.join(dir, 'present');
    const absent = path.join(dir, 'absent');
    fs.writeFileSync(present, 'original\n');
    const files = [present, absent];

    // Clean run: no change, body's return path is untouched.
    assert.doesNotThrow(() => withFilesUntouched(files, () => {}));

    // Content change.
    assert.throws(
      () => withFilesUntouched(files, () => fs.writeFileSync(present, 'tampered\n')),
      /a guarded file was modified by this test/
    );
    fs.writeFileSync(present, 'original\n');

    // ABSENT-STAYS-ABSENT IS A VALID STATE, and creating the file is a violation.
    // This is the case that matters for .git/info/exclude, which a checkout may
    // legitimately not have.
    assert.throws(
      () => withFilesUntouched(files, () => fs.writeFileSync(absent, 'created\n')),
      /a guarded file was modified by this test/
    );
    fs.rmSync(absent);

    // Deletion.
    assert.throws(() => withFilesUntouched(files, () => fs.rmSync(present)), /a guarded file was modified by this test/);
    fs.writeFileSync(present, 'original\n');

    // A body failure with clean files is rethrown verbatim...
    assert.throws(() => withFilesUntouched(files, () => { throw new Error('BODY-FAILED'); }), /BODY-FAILED/);

    // ...but damage OUTRANKS it, carrying the body's message along.
    assert.throws(
      () =>
        withFilesUntouched(files, () => {
          fs.writeFileSync(present, 'tampered\n');
          throw new Error('BODY-FAILED');
        }),
      (err) => /a guarded file was modified/.test(err.message) && /BODY-FAILED/.test(err.message)
    );
  } finally {
    cleanup(dir);
  }
});

test('merge-gitignore.sh e2e: every prompt is answered from scripted stdin, in order, and exactly one section is merged', () => {
  // THE ALIGNMENT TEST. Accepting exactly ONE section and declining the rest is
  // what makes an off-by-one in stdin detectable: a shifted script merges a
  // different section and stores a different key set, and both are asserted.
  withGitScratch((S) => {
    const offered = offeredSections();
    const accepted = offered[sectionIndex(offered, 'Jupyter / Notebooks')];

    const excludeBefore = fingerprintFiles([path.join(S.projectDir, '.git', 'info', 'exclude')]);
    assert.ok(!fs.existsSync(path.join(S.projectDir, '.gitignore')), 'the scratch project already has a .gitignore');

    const r = runMergeGitignore(
      S,
      S.projectDir,
      answerScript(offered, { accept: (t) => t === accepted.title, infoExclude: true, gitTracking: 3 })
    );

    assert.equal(r.status, 0, `the run did not exit 0:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    // Every offered section was actually offered, in template order. If this
    // count and the answer count ever disagree, the tail of the run was answered
    // by EOF and everything below is measuring an artifact.
    assert.deepEqual(
      titlesOffered(r.stdout),
      offered.map((s) => s.title),
      'the set/order of offered sections does not match the template — the stdin script and the prompts are misaligned'
    );

    // THE ALIGNMENT ASSERTION: exactly the accepted section's entries landed.
    const gitignore = path.join(S.projectDir, '.gitignore');
    assert.ok(fs.existsSync(gitignore), 'the accepted section did not create a .gitignore');
    for (const entry of accepted.entries) {
      assert.ok(hasExactLine(gitignore, entry), `${JSON.stringify(entry)} from the accepted section is missing from .gitignore`);
    }
    for (const s of offered) {
      if (s === accepted) continue;
      for (const entry of s.entries) {
        assert.ok(
          !hasExactLine(gitignore, entry),
          `${JSON.stringify(entry)} came from the DECLINED section ${JSON.stringify(s.title)} — stdin was consumed ` +
            'out of step, so a section the user declined was merged'
        );
      }
    }

    // The accepted .git/info/exclude answer: the sentinel block exists and holds
    // the three paths, which is the ONLY externally visible effect of that `y`.
    const gitExclude = path.join(S.projectDir, '.git', 'info', 'exclude');
    for (const p of ['# bootstrap machine-local (autocomplete-visible)', '.serena/', 'raw/', 'wiki/']) {
      assert.ok(hasExactLine(gitExclude, p), `${JSON.stringify(p)} is missing from .git/info/exclude — the accepted prompt did nothing`);
    }
    assert.notDeepEqual(fingerprintFiles([gitExclude]), excludeBefore, '.git/info/exclude was not touched at all');

    // And the `3` (neither) answer: the prefs paths were left visible to git.
    assert.ok(!hasExactLine(gitignore, PREFS_VALUES_PATH), '`neither` still wrote the values path into .gitignore');
    assert.ok(!hasExactLine(gitExclude, PREFS_VALUES_PATH), '`neither` still wrote the values path into .git/info/exclude');

    // The store is the fourth, independent view of the same alignment: one
    // declined key per declined section, none for the accepted one, and the
    // choice recorded by name.
    const stored = readPrefs(S.projectDir);
    assert.ok(stored, 'nothing was recorded at all — the run never reached a prompt');
    assert.deepEqual(
      storedSectionKeys(S.projectDir),
      offered.filter((s) => s !== accepted).map((s) => sectionKeyFor(S, s.title)),
      'the recorded declines do not match the sections that were declined'
    );
    assert.equal(stored['prefs.gitTracking'], 'neither', 'the menu digit 3 did not resolve to the name `neither`');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(stored, 'gitignore.infoExclude'),
      'accepting .git/info/exclude recorded a key — that branch is declines-only (merge-gitignore.sh:367-372)'
    );
    assertNoPrefsFile(S.home, 'scratch HOME (merge-gitignore.sh writes the PROJECT layer only)');
  });
});

test('merge-gitignore.sh e2e: a declined section stores exactly the key --section-key computes, and a second run does not offer it', () => {
  // CHECKBOX 2. Declining EVERY section makes this the strongest available form
  // of the claim: the whole stored key set is compared against the whole set the
  // CLI computes from the same titles, in order — which covers the section whose
  // banner carries an em dash (U+2014), the character that makes a byte-wise
  // slugifier emit three dashes where the helper emits one. A mismatch there is
  // invisible at run time and re-asks a declined question forever.
  withGitScratch((S) => {
    const offered = offeredSections();

    // The em-dash section must genuinely be in play, or this test quietly stops
    // covering the case it was written for.
    const emDashTitle = offered.map((s) => s.title).find((t) => t.includes('—'));
    assert.ok(emDashTitle, 'no template section title contains an em dash — the Unicode slug case is no longer covered');

    const r1 = runMergeGitignore(
      S,
      S.projectDir,
      answerScript(offered, { accept: () => false, infoExclude: false, gitTracking: 1 })
    );
    assert.equal(r1.status, 0, `run 1 did not exit 0:\nstdout:\n${r1.stdout}\nstderr:\n${r1.stderr}`);

    // THE ASSERTION THIS TEST EXISTS FOR: stored key === `--section-key <title>`,
    // for every declined title, byte for byte.
    const expectedKeys = offered.map((s) => sectionKeyFor(S, s.title));
    assert.deepEqual(
      storedSectionKeys(S.projectDir),
      expectedKeys,
      'the keys merge-gitignore.sh stored are not the keys bootstrap-prefs.js --section-key computes for the same ' +
        'titles — the decline is recorded under a key nothing reads, so the section is offered again forever'
    );
    const emDashKey = sectionKeyFor(S, emDashTitle);
    assert.equal(
      readPrefs(S.projectDir)[emDashKey],
      false,
      `the em-dash section was not recorded under ${emDashKey} — a byte-wise slugifier would emit three dashes here`
    );
    assert.doesNotMatch(emDashKey, /--/, 'the em dash collapsed to more than one dash in the computed key');

    const filesBefore = fingerprintFiles([
      path.join(S.projectDir, '.gitignore'),
      path.join(S.projectDir, '.git', 'info', 'exclude'),
    ]);
    const storeBefore = storeFingerprint(S.projectDir);

    // SECOND RUN, POISON STDIN. Any prompt that still fires eats a `y` and
    // changes one of the three fingerprints below.
    const r2 = runMergeGitignore(S, S.projectDir, POISON_STDIN);
    assert.equal(r2.status, 0, `run 2 did not exit 0:\nstdout:\n${r2.stdout}\nstderr:\n${r2.stderr}`);

    assert.deepEqual(
      titlesOffered(r2.stdout),
      [],
      'a section was offered again after being declined — the remembered answer did not match the key it was stored under'
    );
    assert.deepEqual(
      titlesRememberedSkipped(r2.stdout).map(([title, key]) => [title, key]),
      offered.map((s) => [s.title, sectionKeyFor(S, s.title)]),
      'the second run did not report every section as skipped-by-remembered-answer, under the computed key'
    );

    assert.deepEqual(
      fingerprintFiles([path.join(S.projectDir, '.gitignore'), path.join(S.projectDir, '.git', 'info', 'exclude')]),
      filesBefore,
      'the second run changed .gitignore or .git/info/exclude while being fed nothing but `y` — a prompt fired'
    );
    assert.deepEqual(
      storeFingerprint(S.projectDir),
      storeBefore,
      'the second run rewrote the store (bytes and/or mtime) — an already-answered question was asked and recorded again'
    );
  });
});

test('merge-gitignore.sh e2e: an accepted section records NO gitignore.section.* key — declines-only, end to end', () => {
  // CHECKBOX 3, and it is the promise at the top of merge-gitignore.sh (:10):
  // NOTHING is added to a project's .gitignore without asking. A remembered
  // `true` would append on the next run with nobody asked — which is why the
  // schema's grammar for this family is the single token `false` and why the
  // accept branch (:218-222) records nothing at all.
  //
  // ACCEPTING EVERY SECTION is what makes "no key" unambiguous: the assertion is
  // that the family is EMPTY, not that one particular key is missing.
  withGitScratch((S) => {
    const offered = offeredSections();

    const r = runMergeGitignore(
      S,
      S.projectDir,
      answerScript(offered, { accept: () => true, infoExclude: true, gitTracking: 3 })
    );
    assert.equal(r.status, 0, `the run did not exit 0:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    // The accepts really happened: every entry of every section is in .gitignore.
    const gitignore = path.join(S.projectDir, '.gitignore');
    for (const s of offered) {
      for (const entry of s.entries) {
        assert.ok(hasExactLine(gitignore, entry), `${JSON.stringify(entry)} from ${JSON.stringify(s.title)} was not merged`);
      }
    }

    // THE ASSERTION THIS TEST EXISTS FOR.
    assert.deepEqual(
      storedSectionKeys(S.projectDir),
      [],
      'an ACCEPTED section recorded a gitignore.section.* key — a remembered accept would append to .gitignore on the ' +
        'next run without asking, breaking the promise at merge-gitignore.sh:10'
    );
    // Same rule, same run, different key: accepting .git/info/exclude is also
    // declines-only. The whole store is pinned so nothing else crept in either.
    assert.deepEqual(
      readPrefs(S.projectDir),
      { 'prefs.gitTracking': 'neither' },
      'the only thing an all-accept run may record is the prefs.gitTracking choice'
    );

    // A second run must not re-offer them — but here the reason is that nothing
    // is MISSING any more, not that a decline was remembered. Poison stdin proves
    // it the same way.
    const filesBefore = fingerprintFiles([gitignore, path.join(S.projectDir, '.git', 'info', 'exclude')]);
    const r2 = runMergeGitignore(S, S.projectDir, POISON_STDIN);
    assert.equal(r2.status, 0, `run 2 did not exit 0:\nstdout:\n${r2.stdout}\nstderr:\n${r2.stderr}`);
    assert.deepEqual(titlesOffered(r2.stdout), [], 'a fully-merged section was offered again');
    assert.deepEqual(
      fingerprintFiles([gitignore, path.join(S.projectDir, '.git', 'info', 'exclude')]),
      filesBefore,
      'the second run changed .gitignore or .git/info/exclude while being fed nothing but `y`'
    );
  });
});

test('merge-gitignore.sh e2e: prefs.gitTracking — each option routes the two prefs paths to .gitignore, to .git/info/exclude, or nowhere, and none is re-asked', () => {
  // CHECKBOX 4. THREE SEPARATE SCRATCH REPOS, one per option, because the answer
  // is sticky by design: the second repo would read the first repo's stored
  // choice and never reach the menu. (`prefs.gitTracking`'s schema default is
  // `null` precisely so an unanswered key reaches it at all — TASK-046 changed it
  // from `"exclude"`, which made the menu unreachable.)
  //
  // EVERY SECTION IS DECLINED and .git/info/exclude is declined too, so the only
  // thing that touches either file in each run is the menu answer itself. That is
  // what lets the two negative assertions per case be exact.
  const cases = [
    { digit: 1, name: 'gitignore', where: 'gitignore' },
    { digit: 2, name: 'exclude', where: 'exclude' },
    { digit: 3, name: 'neither', where: 'nowhere' },
  ];

  for (const { digit, name, where } of cases) {
    withGitScratch((S) => {
      const offered = offeredSections();
      const gitignore = path.join(S.projectDir, '.gitignore');
      const gitExclude = path.join(S.projectDir, '.git', 'info', 'exclude');

      const r = runMergeGitignore(
        S,
        S.projectDir,
        answerScript(offered, { accept: () => false, infoExclude: false, gitTracking: digit })
      );
      assert.equal(r.status, 0, `[${name}] the run did not exit 0:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

      // The digit resolved to the NAME, which is what the store must hold — a
      // stored `2` would still resolve after a menu reorder, to the wrong option.
      assert.equal(readPrefs(S.projectDir)['prefs.gitTracking'], name, `[${name}] the digit ${digit} resolved to the wrong name`);

      const inGitignore = hasExactLine(gitignore, PREFS_VALUES_PATH) && hasExactLine(gitignore, PREFS_README_PATH);
      const inExclude = hasExactLine(gitExclude, PREFS_VALUES_PATH) && hasExactLine(gitExclude, PREFS_README_PATH);

      if (where === 'gitignore') {
        assert.ok(inGitignore, '[gitignore] both prefs paths should be in .gitignore');
        assert.ok(hasExactLine(gitignore, '# bootstrap preferences (remembered installer answers)'), '[gitignore] the header line is missing');
        assert.ok(!inExclude, '[gitignore] the prefs paths also reached .git/info/exclude');
        assert.ok(!hasExactLine(gitExclude, PREFS_VALUES_PATH), '[gitignore] the values path leaked into .git/info/exclude');
        // Option 1 must touch .gitignore only — but the shared sentinel is now
        // written proactively regardless of any prompt answer, so a scratch repo's
        // FIRST run (this one) is what creates it, on top of whatever `git init`
        // itself seeds into .git/info/exclude (its own C-project boilerplate
        // comments). The check is "sentinel present, nothing bootstrap-managed
        // under it" rather than exact whole-file content, which would be pinned
        // to git's template and break on an unrelated git version bump.
        assert.ok(
          hasExactLine(gitExclude, GIT_EXCLUDE_SENTINEL),
          '[gitignore] the proactively-written shared sentinel is missing from .git/info/exclude'
        );
        for (const p of ['.serena/', 'raw/', 'wiki/', PREFS_VALUES_PATH, PREFS_README_PATH]) {
          assert.ok(
            !hasExactLine(gitExclude, p),
            `[gitignore] ${p} reached .git/info/exclude — option 1 must touch .gitignore only`
          );
        }
      } else if (where === 'exclude') {
        assert.ok(inExclude, '[exclude] both prefs paths should be in .git/info/exclude');
        assert.ok(hasExactLine(gitExclude, GIT_EXCLUDE_SENTINEL), '[exclude] the shared sentinel header line is missing');
        assert.ok(
          !fs.existsSync(gitignore),
          '[exclude] a .gitignore was created — every section was declined and option 2 must not write one'
        );
      } else {
        assert.ok(
          !fs.existsSync(gitignore),
          '[neither] a .gitignore was created — `neither` is a pure no-op that leaves prior state untouched'
        );
        assert.ok(!inExclude, '[neither] the prefs paths reached .git/info/exclude');
        assert.ok(!hasExactLine(gitExclude, PREFS_VALUES_PATH), '[neither] the values path leaked into .git/info/exclude');
        // Same proactive-sentinel reasoning as the `gitignore` branch above.
        assert.ok(
          hasExactLine(gitExclude, GIT_EXCLUDE_SENTINEL),
          '[neither] the proactively-written shared sentinel is missing from .git/info/exclude'
        );
        for (const p of ['.serena/', 'raw/', 'wiki/', PREFS_VALUES_PATH, PREFS_README_PATH]) {
          assert.ok(!hasExactLine(gitExclude, p), `[neither] ${p} reached .git/info/exclude`);
        }
      }

      // NOT RE-ASKED. Poison stdin again: if the menu fired, a `y` is neither a
      // digit nor a legal name, so it resolves to the declared default `exclude`
      // AND IS RECORDED — which moves the store's mtime even where it would not
      // change a file. Both fingerprints are checked for that reason.
      const filesBefore = fingerprintFiles([gitignore, gitExclude]);
      const storeBefore = storeFingerprint(S.projectDir);

      const r2 = runMergeGitignore(S, S.projectDir, POISON_STDIN);
      assert.equal(r2.status, 0, `[${name}] run 2 did not exit 0:\nstdout:\n${r2.stdout}\nstderr:\n${r2.stderr}`);
      assert.match(
        r2.stderr,
        new RegExp(`^\\s*prefs\\.gitTracking: using remembered answer \\(${name}\\) — change with /bootstrap-config\\s*$`, 'm'),
        `[${name}] the remembered-answer notice is missing from stderr — the menu was asked again:\n${r2.stderr}`
      );
      assert.deepEqual(
        fingerprintFiles([gitignore, gitExclude]),
        filesBefore,
        `[${name}] the second run changed .gitignore or .git/info/exclude while being fed nothing but \`y\``
      );
      assert.deepEqual(
        storeFingerprint(S.projectDir),
        storeBefore,
        `[${name}] the second run rewrote the store (bytes and/or mtime) — the menu was answered and recorded again`
      );
    });
  }
});

test('merge-gitignore.sh e2e: a project with only the legacy prefs-exclude sentinel converges onto the shared sentinel once the wiki-dirs prompt also runs', () => {
  // THE EXACT BUG REPORTED: a project that only ever went through the
  // prefs.gitTracking `[2] exclude` path (and never accepted the wiki-dirs
  // prompt) ends up with the OLD, separately-named
  // `# bootstrap preferences (machine-local)` header and none of .serena/,
  // raw/, wiki/ under it — so file-suggestion.sh's single hardcoded SENTINEL
  // never matches that header and @-autocomplete never re-includes anything.
  // Seed exactly that legacy shape by hand (simulating an existing project from
  // before the two mechanisms were unified), then run the current
  // merge-gitignore.sh and confirm BOTH mechanisms converge onto one block.
  withGitScratch((S) => {
    const gitExclude = path.join(S.projectDir, '.git', 'info', 'exclude');
    fs.mkdirSync(path.dirname(gitExclude), { recursive: true });
    fs.writeFileSync(gitExclude, ['# bootstrap preferences (machine-local)', PREFS_VALUES_PATH, PREFS_README_PATH, ''].join('\n'));

    const offered = offeredSections();
    const r = runMergeGitignore(
      S,
      S.projectDir,
      answerScript(offered, { accept: () => false, infoExclude: true, gitTracking: 2 })
    );
    assert.equal(r.status, 0, `the run did not exit 0:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    assert.ok(
      !hasExactLine(gitExclude, '# bootstrap preferences (machine-local)'),
      'the legacy pre-unification sentinel header was not scrubbed'
    );
    const sentinelCount = fileLines(gitExclude).filter((l) => l === GIT_EXCLUDE_SENTINEL).length;
    assert.equal(sentinelCount, 1, `the shared sentinel must appear exactly once after convergence, found ${sentinelCount}`);
    for (const p of ['.serena/', 'raw/', 'wiki/', PREFS_VALUES_PATH, PREFS_README_PATH]) {
      assert.ok(
        hasExactLine(gitExclude, p),
        `${p} is missing after convergence — the wiki-dirs and prefs-exclude mechanisms did not merge into one block`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// The master review gate — gitignore.offerSectionUpdates
// ---------------------------------------------------------------------------
//
// The one Phase 2 key with `scope: either`, so it is read directly with a
// project-dir selector rather than through a single-selector prompt helper.
// Three resolved values, three behaviours (merge-gitignore.sh:158-177):
//
//   false   skip the whole section pass, no prompt at all
//   true    run the pass WITHOUT the opening question — every section is still
//           offered by title, so nothing is appended silently (schema default)
//   ask     today's opening `Review .gitignore updates?` question
//
// The `true` path is what every other e2e case in this file already exercises,
// since it is the resolved default. The two below cover the other two, and the
// first also pins the cross-key independence claim: DECLINING THE SECTION PASS
// MUST LEAVE THE .git/info/exclude MECHANISM FULLY WORKING. Those are three
// separate questions, and the schema cross-references them in all three
// directions precisely so nobody collapses them into one switch.

test('merge-gitignore.sh e2e: a stored `false` master gate skips the section pass but leaves .git/info/exclude working', () => {
  withGitScratch((S) => {
    seedPref(S, 'project', 'gitignore.offerSectionUpdates', false);
    const gitignore = path.join(S.projectDir, '.gitignore');
    const gitExclude = path.join(S.projectDir, '.git', 'info', 'exclude');

    // Sections are skipped, so the FIRST prompt this run reaches is the
    // .git/info/exclude one. Answer it yes, then choose `neither` for the
    // gitTracking menu so the only thing that touches either file is the
    // exclude accept itself.
    const r = runMergeGitignore(S, S.projectDir, 'y\n3\n');
    assert.equal(r.status, 0, `the run did not exit 0:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    assert.match(
      r.stdout,
      /\.gitignore: skipped entirely — no sections offered\. \(remembered answer gitignore\.offerSectionUpdates=false/,
      `the stored decline was not honoured:\n${r.stdout}`
    );
    assert.deepEqual(titlesOffered(r.stdout), [], 'a section was previewed despite the master gate being off');
    assert.ok(!fs.existsSync(gitignore), 'a .gitignore was created while the whole section pass was skipped');

    // THE CROSS-KEY CLAIM: the exclude mechanism still ran and still worked.
    for (const p of ['.serena/', 'raw/', 'wiki/']) {
      assert.ok(
        hasExactLine(gitExclude, p),
        `${p} did not reach .git/info/exclude — declining the SECTION pass disabled the exclude prompt, but they are ` +
          'three separate questions and declining one must never disable another'
      );
    }
  });
});

test('merge-gitignore.sh e2e: a stored `ask` master gate restores the opening question, and declining it records `false`', () => {
  withGitScratch((S) => {
    seedPref(S, 'project', 'gitignore.offerSectionUpdates', 'ask');

    // First stdin line answers the OPENING gate (decline), then the exclude
    // question, then the gitTracking menu.
    const r = runMergeGitignore(S, S.projectDir, 'n\nn\n3\n');
    assert.equal(r.status, 0, `the run did not exit 0:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    // THE DISCRIMINATOR between "asked and declined" and "skipped from the
    // store": the remembered-skip line carries a `(remembered answer …)` suffix
    // and this one must not. Without this, a gate that silently skipped would
    // look identical to one that was genuinely asked.
    assert.match(
      r.stdout,
      /^\.gitignore: skipped entirely — no sections offered\.$/m,
      `the opening question was not asked — an \`ask\` must always prompt:\n${r.stdout}`
    );
    assert.doesNotMatch(
      r.stdout,
      /skipped entirely — no sections offered\. \(remembered answer/,
      'the run reported a remembered skip, so the stored `ask` was treated as a settled `false`'
    );
    assert.deepEqual(titlesOffered(r.stdout), [], 'sections were offered after the opening gate was declined');

    // Declines-only wiring for THIS prompt: the decline is recorded, and it
    // overwrites the `ask` — which is correct here and is exactly what the
    // schema's declines-only rule prescribes for this key.
    assert.equal(
      readPrefs(S.projectDir)['gitignore.offerSectionUpdates'],
      false,
      'declining the opening gate did not record `false`, so it would be asked again every run'
    );
  });
});

// ===========================================================================
// prompt_scope — THE OPT-IN THAT MUST STAY OPT-IN, AND ITS OWN RESOLVER
// ===========================================================================
//
// prompt_scope is the one sticky helper that EXISTED BEFORE the sticky layer,
// and it kept its own resolver on purpose. Two claims below are regression
// guards rather than feature tests:
//
//   1. THE BARE FORM MUST MAKE ZERO PREFS CALLS. bootstrap-serena.sh and
//      install-mcps.sh:94 both call `prompt_scope "$name"` with no key. If the
//      sticky path ever leaked into that form, those callers would start reading
//      and writing a preference store on machines that may not even have the
//      helper — and the symptom would be invisible.
//
//   2. THE RESOLVER IS FIRST-LETTER, NOT EXACT-NAME. `[pP]*` is project and
//      everything else is user. That rule is PUBLISHED to users in
//      bootstrap-prefs-schema.json's mcp.context7Scope detail. Routing this
//      function through prompt_choice_sticky (which matches a digit index or an
//      EXACT name) would silently turn a bare `p` into `user` — the exact
//      regression lib.sh:327-337's banner exists to prevent. This test fails if
//      someone "simplifies" the two resolvers into one.
//
// The spy shim is what makes claim 1 falsifiable. BOOTSTRAP_PREFS_JS is a plain
// global assigned at source time (lib.sh:23), so a snippet can repoint it at a
// script that LOGS ITS ARGV. An empty log is then positive evidence that no
// prefs call happened — strictly stronger than "no file was created", which a
// read-only call would also satisfy.

const SCOPE_KEY = 'mcp.context7Scope'; // scope=global, grammar `user | project`

/**
 * A fake bootstrap-prefs.js that appends its argv to <log> and answers `unset`.
 *
 * It must be a real file AND runnable by node: prefs_get guards on
 * `[ -f "$BOOTSTRAP_PREFS_JS" ]` and then invokes `node "$BOOTSTRAP_PREFS_JS"`,
 * so a non-file or a non-JS stub would take the degradation branch and the test
 * would pass for the wrong reason.
 */
function writePrefsSpy(dir) {
  const log = path.join(dir, 'argv.log');
  const js = path.join(dir, 'prefs-spy.js');
  fs.writeFileSync(
    js,
    [
      "'use strict';",
      "const fs = require('node:fs');",
      `fs.appendFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(' ') + '\\n');`,
      "process.stdout.write('unset\\n');",
      '',
    ].join('\n')
  );
  return { js, log, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim() : '') };
}

test('prompt_scope: the bare form resolves by FIRST LETTER and makes zero prefs calls', () => {
  withScratchEnv((S) => {
    const spyDir = scratchDir('prompt-sticky-spy-');
    try {
      const spy = writePrefsSpy(spyDir);

      // Seven scripted replies, then an eighth iteration that hits EOF. `p` and
      // `pineapple` are the discriminating cases: neither is a digit nor the
      // exact name `project`, so prompt_choice_sticky's resolver would answer
      // `user` for both.
      const replies = ['p', 'P', 'project', 'pineapple', 'u', '', 'garbage'];
      const r = runShell(
        [
          `BOOTSTRAP_PREFS_JS=${JSON.stringify(spy.js)}`,
          'for i in 1 2 3 4 5 6 7 8; do',
          `  printf 'SCOPE=[%s]\\n' "$(prompt_scope demo)"`,
          'done',
        ].join('\n'),
        { env: S.env, tty: true, input: replies.map((x) => `${x}\n`).join('') }
      );

      assert.equal(r.status, 0, `the bare form aborted:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
      assert.equal(
        r.stdout,
        ['project', 'project', 'project', 'project', 'user', 'user', 'user', 'user']
          .map((s) => `SCOPE=[${s}]\n`)
          .join(''),
        'the first-letter resolver changed. `p` or `pineapple` answering `user` means prompt_scope was routed through ' +
          "prompt_choice_sticky's exact-name/digit resolver — the regression lib.sh:327-337 exists to prevent, and it " +
          "contradicts the rule bootstrap-prefs-schema.json publishes to users"
      );

      assert.equal(
        spy.calls(),
        '',
        'the bare form invoked bootstrap-prefs.js — prompt_scope with no key must not read or write a store, or ' +
          'bootstrap-serena.sh and install-mcps.sh:94 start touching preferences their callers never opted into'
      );
      assertNoPrefsFile(S.home, 'scratch HOME (the bare form must not create a store)');
      assertNoPrefsFile(S.projectDir, 'scratch project (the bare form must not create a store)');
    } finally {
      cleanup(spyDir);
    }
  });
});

test('prompt_scope: a key with NO selector warns, answers normally, and records nothing', () => {
  // Both arguments are required to opt in. A key with no selector has no layer
  // to read or write, so lib.sh:371-373 warns rather than guessing one — a
  // guessed layer is how a project answer ends up in the global store.
  withScratchEnv((S) => {
    const spyDir = scratchDir('prompt-sticky-spy-');
    try {
      const spy = writePrefsSpy(spyDir);

      const r = runShell(
        [
          `BOOTSTRAP_PREFS_JS=${JSON.stringify(spy.js)}`,
          `printf 'SCOPE=[%s]\\n' "$(prompt_scope demo ${SCOPE_KEY})"`,
        ].join('\n'),
        { env: S.env, tty: true, input: 'p\n' }
      );

      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout, 'SCOPE=[project]\n', 'the reply was not honoured, or a notice leaked onto stdout');
      assert.match(
        r.stderr,
        /prompt_scope given "mcp\.context7Scope" with no selector — answering normally and remembering nothing/,
        `the no-selector warning is missing from stderr:\n${r.stderr}`
      );
      assert.equal(spy.calls(), '', 'a prefs call was made despite there being no layer to make it against');
      assertNoPrefsFile(S.home, 'scratch HOME');
      assertNoPrefsFile(S.projectDir, 'scratch project');
    } finally {
      cleanup(spyDir);
    }
  });
});

test('prompt_scope: the sticky form records the answer, then replays it with stdout carrying ONLY the scope', () => {
  withScratchEnv((S) => {
    assertNoPrefsFile(S.home, 'scratch HOME before the run');

    // Run 1: unanswered → asks, honours `p`, records the NAME `project`.
    const first = runShell(`printf 'SCOPE=[%s]\\n' "$(prompt_scope demo ${SCOPE_KEY} --global)"`, {
      env: S.env,
      tty: true,
      input: 'p\n',
    });
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout, 'SCOPE=[project]\n', 'run 1 did not honour the reply');
    assert.deepEqual(
      readPrefs(S.home),
      { [SCOPE_KEY]: 'project' },
      'the resolved NAME was not what got stored — a first-letter reply must be normalised to a legal name'
    );
    assert.equal(readPrefs(S.projectDir), null, 'a --global write leaked into the project layer');

    const after = storeFingerprint(S.home);

    // Run 2: remembered → no prompt, and stdin is POISONED with the other answer
    // so a consumed line would visibly change the result.
    const second = runShell(`printf 'SCOPE=[%s]\\n' "$(prompt_scope demo ${SCOPE_KEY} --global)"`, {
      env: S.env,
      tty: true,
      input: 'u\n',
    });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(
      second.stdout,
      'SCOPE=[project]\n',
      '`user` here means stdin was consumed (the question was re-asked); anything longer means the remembered-answer ' +
        'notice leaked onto stdout, where the caller captures it AS the scope'
    );
    assert.match(
      second.stderr,
      /^\s*mcp\.context7Scope: using remembered answer \(project\) — change with \/bootstrap-config\s*$/m,
      `the remembered-answer notice is missing from stderr:\n${second.stderr}`
    );
    assert.deepEqual(storeFingerprint(S.home), after, 'replaying a remembered scope rewrote the store');
  });
});

test('prompt_scope: no tty answers `user`, prints no note, and records NOTHING even with a key and selector', () => {
  withScratchEnv((S) => {
    assertNoTtySeam(S);

    const r = runShell(`printf 'SCOPE=[%s]\\n' "$(prompt_scope demo ${SCOPE_KEY} --global)"`, {
      env: S.env,
      // POISON: `p` would flip the answer if the branch ever reached `read`.
      input: 'p\n',
    });

    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'SCOPE=[user]\n', 'the no-tty branch did not answer `user`, or stdin was consumed');
    // This question has never printed a non-interactive note; adding one would
    // change installer output that other tests and users read.
    assert.doesNotMatch(r.stderr, /Non-interactive terminal/, 'prompt_scope gained a non-interactive note it never had');

    // THE LOAD-BEARING RULE: one unattended run must not bake a scope into the
    // store. lib.sh:375-381 returns BEFORE prefs_set, so the write is
    // unreachable by return rather than skipped by a flag.
    assertNoPrefsFile(S.home, 'scratch HOME — an unattended run recorded a scope nobody chose');
    assertNoPrefsFile(S.projectDir, 'scratch project');
  });
});

// ===========================================================================
// prefs_get / prefs_set — A BROKEN PREFERENCE LAYER MUST NOT COST AN INSTALL
// ===========================================================================
//
// Every consumer of lib.sh runs under `set -euo pipefail`, where an unguarded
// non-zero status kills the script. Both wrappers are written so the WORST case
// is a lost preference, never a lost install.

test('prefs_get/prefs_set: a missing helper degrades to `unset` and a silent no-op, without aborting the caller', () => {
  withScratchEnv((S) => {
    const missing = path.join(S.projectDir, 'no-such-bootstrap-prefs.js');
    assert.ok(!fs.existsSync(missing), 'the "missing" helper path exists — the test would prove nothing');

    const r = runShell(
      [
        `BOOTSTRAP_PREFS_JS=${JSON.stringify(missing)}`,
        `printf 'GET=[%s]\\n' "$(prefs_get ${SCOPE_KEY} --global)"`,
        `prefs_set ${SCOPE_KEY} --global project`,
        "echo 'REACHED_END'",
      ].join('\n'),
      { env: S.env }
    );

    assert.equal(
      r.status,
      0,
      `a partial install aborted the caller under set -euo pipefail:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`
    );
    assert.match(r.stdout, /^GET=\[unset\]$/m, 'a missing helper must read as the literal word `unset`, not empty');
    assert.match(r.stdout, /^REACHED_END$/m, 'execution stopped before the end — the guard is not returning 0');
    assertNoPrefsFile(S.home, 'scratch HOME');
  });
});

// ===========================================================================
// install-mcps.sh e2e — THE PLAYWRIGHT CONFLICT MENU, THE ROADMAP'S HEADLINE BUG
// ===========================================================================
//
// This is the prompt ROADMAP-005 exists for. Options [1] and [2] BOTH end with a
// registered `playwright-shared` PLUS a live project `playwright`, and the gating
// condition ("is `playwright` installed, and at what scope?") cannot tell those
// two end states apart — so before this work it fell straight back into the menu
// on every single run, forever, no matter what the user answered. Remembering the
// answer is the entire fix.
//
// THE SECOND DEFECT THESE TESTS PIN. The store's grammar is `shared | alongside |
// skip` — NAMES, so a remembered answer survives a menu reorder — while the
// original `case` matched the digits `1` / `2` / `*`. A stored name fed into the
// digit comparison misses every branch, falls through to `*`, and SILENTLY
// BEHAVES LIKE `skip`: the user's answer discarded, no error, and no visible
// difference from a correct run. Test 1 below is what makes that unfixable
// silently — it drives the second run entirely from the store and asserts the
// `shared` branch's two side effects actually happened.
//
// WHY REAL STUBS RATHER THAN A UNIT TEST. install-mcps.sh's whole job is to shell
// out to `claude mcp`, so the prompt logic cannot be observed without letting the
// script run end to end. `claude` and `uname` are therefore stubbed onto PATH:
// `claude` logs its argv and answers `mcp get` from an env var, and `uname`
// reports Linux so _add_playwright takes its one-line stdio branch instead of
// running `npm install -g` and `launchctl` (install-mcps.sh:223-226). NO REAL MCP
// IS EVER REGISTERED, and the argv log is what every side-effect assertion reads.

const INSTALL_MCPS = path.join(REPO, 'lib', 'scripts', 'install-mcps.sh');

/**
 * A PATH directory holding stubbed `claude` and `uname`, plus the argv log.
 *
 * The `claude` stub answers `mcp get <name>`: exit 0 with a `Scope:` line for the
 * server named in STUB_INSTALLED_MCP (that is what mcp_installed and mcp_scope_of
 * parse, lib.sh:52-85), exit 1 for everything else. `mcp add` / `mcp remove` log
 * and succeed. Every invocation is appended to the log, so "no registration
 * happened" is checked positively rather than inferred.
 */
function writeMcpStubs(dir) {
  const log = path.join(dir, 'claude-argv.log');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin, { recursive: true });

  fs.writeFileSync(
    path.join(bin, 'claude'),
    [
      '#!/usr/bin/env bash',
      `printf '%s\\n' "$*" >> ${JSON.stringify(log)}`,
      'if [ "${1:-}" = "mcp" ] && [ "${2:-}" = "get" ]; then',
      '  if [ -n "${STUB_INSTALLED_MCP:-}" ] && [ "${3:-}" = "$STUB_INSTALLED_MCP" ]; then',
      '    echo "  Scope: ${STUB_INSTALLED_SCOPE:-Project} config"',
      '    exit 0',
      '  fi',
      '  exit 1',
      'fi',
      'exit 0',
      '',
    ].join('\n')
  );
  fs.chmodSync(path.join(bin, 'claude'), 0o755);

  // Linux keeps _add_playwright on its single-command stdio branch. A Darwin
  // answer here would run `npm install -g @playwright/mcp@latest` for real.
  fs.writeFileSync(path.join(bin, 'uname'), ['#!/usr/bin/env bash', 'echo Linux', ''].join('\n'));
  fs.chmodSync(path.join(bin, 'uname'), 0o755);

  return {
    bin,
    log,
    calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []),
    addCalls: () => {
      const all = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
      return all.filter((l) => l.startsWith('mcp add'));
    },
  };
}

/** Run the REAL install-mcps.sh with stubs on PATH and an explicit stdin. */
function runInstallMcps(S, stubs, { args, input, tty = true, stubInstalled, stubScope }) {
  assert.equal(typeof input, 'string', 'runInstallMcps requires an explicit stdin string');
  const env = {
    ...S.env,
    PATH: `${stubs.bin}:${S.env.PATH}`,
    ...(tty ? { BOOTSTRAP_ASSUME_TTY: '1' } : {}),
    ...(stubInstalled ? { STUB_INSTALLED_MCP: stubInstalled } : {}),
    ...(stubScope ? { STUB_INSTALLED_SCOPE: stubScope } : {}),
  };
  if (!tty) delete env.BOOTSTRAP_ASSUME_TTY;
  const r = spawnSync('bash', [INSTALL_MCPS, ...args], {
    encoding: 'utf8',
    env,
    cwd: S.home, // never the repo, never the project
    input,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * A scratch project that reaches the TEAM-OWNED conflict branch: a git repo whose
 * .mcp.json registers `playwright` and is TRACKED (`git add` puts it in the index,
 * which is what `git ls-files --error-unmatch` at install-mcps.sh:474 tests).
 *
 * Serena, brave-search and context7 are pre-declined in the store so their
 * prompts resolve from a remembered answer and consume NO stdin — leaving stdin
 * to mean exactly one thing: the conflict menu. An off-by-one there would
 * otherwise answer the wrong question and the test would pass for the wrong
 * reason.
 */
function seedConflictProject(S) {
  gitInitScratch(S.projectDir, S.env);
  fs.writeFileSync(
    path.join(S.projectDir, '.mcp.json'),
    JSON.stringify({ mcpServers: { playwright: { command: 'npx', args: ['@playwright/mcp'] } } }, null, 2) + '\n'
  );
  const add = spawnSync('git', ['-C', S.projectDir, 'add', '.mcp.json'], {
    encoding: 'utf8',
    env: { ...S.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  assert.equal(add.status, 0, `git add .mcp.json failed: ${add.stderr}`);

  seedPref(S, 'global', 'mcp.braveSearch', false);
  seedPref(S, 'global', 'mcp.context7', false);
  seedPref(S, 'project', 'mcp.serena', false);
}

test('install-mcps.sh e2e: the Playwright conflict menu stores the NAME for a digit reply, and is never asked twice', () => {
  withGitScratch((S) => {
    const stubDir = scratchDir('prompt-sticky-mcpstub-');
    try {
      const stubs = writeMcpStubs(stubDir);
      seedConflictProject(S);

      // ---- Run 1: the menu is asked, answered with the DIGIT `1`. ----
      const r1 = runInstallMcps(S, stubs, {
        args: ['--interactive', '--project-dir', S.projectDir],
        input: '1\n',
        stubInstalled: 'playwright',
        stubScope: 'Project',
      });
      assert.equal(r1.status, 0, `run 1 failed:\nstdout:\n${r1.stdout}\nstderr:\n${r1.stderr}`);

      // The team-owned branch was genuinely reached (its menu text is the marker;
      // the prompt itself is invisible under a pipe).
      assert.match(
        r1.stdout,
        /this project's committed \.mcp\.json registers its own playwright server/,
        `the conflict branch was never reached — the rest of this test would be vacuous:\n${r1.stdout}`
      );

      // THE DEFECT THIS PINS: a digit was typed, but a NAME was stored.
      assert.equal(
        readPrefs(S.projectDir)['mcp.playwrightConflict'],
        'shared',
        'the conflict answer was not stored as the name `shared`. A stored `1` would still RESOLVE on the next run ' +
          'and would resolve to the wrong branch the day the menu is reordered'
      );

      // The `shared` branch's TWO side effects, not just one.
      assert.ok(
        stubs.addCalls().some((c) => c.includes('playwright-shared')),
        `the shared branch did not register playwright-shared:\n${stubs.calls().join('\n')}`
      );
      const settingsLocal = path.join(S.projectDir, '.claude', 'settings.local.json');
      assert.ok(fs.existsSync(settingsLocal), 'the project playwright entry was not disabled machine-locally');
      assert.deepEqual(
        JSON.parse(fs.readFileSync(settingsLocal, 'utf8')).disabledMcpjsonServers,
        ['playwright'],
        'disabledMcpjsonServers does not name playwright'
      );
      // The team's committed file is NEVER edited.
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(S.projectDir, '.mcp.json'), 'utf8')).mcpServers.playwright.command,
        'npx',
        "the project's committed .mcp.json was modified — it is team config and must never be touched"
      );

      const addsAfterRun1 = stubs.addCalls().length;

      // ---- Run 2: EMPTY stdin. The menu must not be asked at all. ----
      // Empty rather than poisoned is the sharper probe here: if the menu fired,
      // EOF resolves to the declared default `skip`, so the `shared` branch would
      // NOT run again and the assertions below would fail loudly.
      const r2 = runInstallMcps(S, stubs, {
        args: ['--interactive', '--project-dir', S.projectDir],
        input: '',
        stubInstalled: 'playwright',
        stubScope: 'Project',
      });
      assert.equal(r2.status, 0, `run 2 failed:\nstdout:\n${r2.stdout}\nstderr:\n${r2.stderr}`);

      assert.match(
        r2.stderr,
        /^\s*mcp\.playwrightConflict: using remembered answer \(shared\) — change with \/bootstrap-config\s*$/m,
        `the remembered-answer notice is missing — the menu was asked again, which IS the roadmap's headline bug:\n` +
          `stdout:\n${r2.stdout}\nstderr:\n${r2.stderr}`
      );
      assert.doesNotMatch(
        r2.stdout,
        /playwright: left untouched\./,
        'run 2 took the skip branch — a stored NAME fell through the `case` to `*`, which is exactly the ' +
          'name-vs-digit defect behaving like `skip` with no error'
      );
      assert.ok(
        stubs.addCalls().length > addsAfterRun1,
        'run 2 registered nothing — the remembered `shared` answer did not drive the shared branch'
      );
    } finally {
      cleanup(stubDir);
    }
  });
});

test('install-mcps.sh e2e: a stored `skip` leaves everything untouched and registers nothing', () => {
  withGitScratch((S) => {
    const stubDir = scratchDir('prompt-sticky-mcpstub-');
    try {
      const stubs = writeMcpStubs(stubDir);
      seedConflictProject(S);
      seedPref(S, 'project', 'mcp.playwrightConflict', 'skip');

      // POISON: `1` would take the shared branch if the menu still fired.
      const r = runInstallMcps(S, stubs, {
        args: ['--interactive', '--project-dir', S.projectDir],
        input: '1\n',
        stubInstalled: 'playwright',
        stubScope: 'Project',
      });
      assert.equal(r.status, 0, `run failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

      assert.match(r.stdout, /playwright: left untouched\./, `the skip branch did not run:\n${r.stdout}`);
      assert.deepEqual(
        stubs.addCalls(),
        [],
        `a stored \`skip\` registered something:\n${stubs.calls().join('\n')}`
      );
      assert.ok(
        !fs.existsSync(path.join(S.projectDir, '.claude', 'settings.local.json')),
        'a stored `skip` disabled the project entry — skip must touch nothing'
      );
    } finally {
      cleanup(stubDir);
    }
  });
});

test('install-mcps.sh e2e: a non-interactive run asks nothing and records NOTHING in either layer', () => {
  // install-global.sh runs this script WITHOUT --interactive. That path must never
  // write a preference: one unattended run baking in a decision is exactly the
  // failure this roadmap exists to remove, and there would be no prompt left to
  // change it with.
  withGitScratch((S) => {
    const stubDir = scratchDir('prompt-sticky-mcpstub-');
    try {
      const stubs = writeMcpStubs(stubDir);
      assertNoTtySeam(S);

      const r = runInstallMcps(S, stubs, { args: [], input: '', tty: false });
      assert.equal(r.status, 0, `non-interactive run failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

      assertNoPrefsFile(S.home, 'scratch HOME after a non-interactive run');
      assertNoPrefsFile(S.projectDir, 'scratch project after a non-interactive run');
    } finally {
      cleanup(stubDir);
    }
  });
});

test('install-mcps.sh e2e: a stored decline suppresses the NON-INTERACTIVE auto-install too', () => {
  // The regression this closes: `bootstrap install` installs every missing MCP
  // unprompted, so without the prefs_get check a user who declined Brave Search
  // during an interactive `setup` would have it silently installed by the very
  // next `install`. Reading is allowed on this path; writing is not.
  withGitScratch((S) => {
    const stubDir = scratchDir('prompt-sticky-mcpstub-');
    try {
      const stubs = writeMcpStubs(stubDir);
      seedPref(S, 'global', 'mcp.braveSearch', false);
      const before = storeFingerprint(S.home);

      const r = runInstallMcps(S, stubs, { args: [], input: '', tty: false });
      assert.equal(r.status, 0, `run failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

      assert.match(
        r.stdout,
        /brave-search: skipped \(remembered decline — change with \/bootstrap-config\)/,
        `the stored decline was ignored on the non-interactive path:\n${r.stdout}`
      );
      assert.deepEqual(
        stubs.addCalls().filter((c) => c.includes('brave-search')),
        [],
        `brave-search was registered despite a stored decline:\n${stubs.calls().join('\n')}`
      );
      assert.deepEqual(
        storeFingerprint(S.home),
        before,
        'the non-interactive path rewrote the store — it may read a preference, never record one'
      );
    } finally {
      cleanup(stubDir);
    }
  });
});

// ===========================================================================
// sync-wiki-scaffold.sh / install-global.sh / update-project.sh e2e
// ===========================================================================
//
// The three prompt sites outside the MCP and .gitignore families. Each carries a
// design decision that is invisible in normal use and therefore worth pinning:
//
//   guides.*              the key literal is COMPUTED from the loop variable, and
//                         the store is read AHEAD of the INTERACTIVE guard.
//   skills.pruneOrphans   a decline is remembered, and the second run must
//                         neither prompt nor delete.
//   update.legacyDocsAck  records `true` ONLY. A persisted `false` from this
//                         prompt would abort every future `update` with no prompt
//                         left to change it with — the one asymmetry in Phase 2.

const SYNC_SCAFFOLD = path.join(REPO, 'lib', 'scripts', 'sync-wiki-scaffold.sh');
const INSTALL_GLOBAL = path.join(REPO, 'lib', 'scripts', 'install-global.sh');
const UPDATE_PROJECT = path.join(REPO, 'lib', 'scripts', 'update-project.sh');

// The two entries of OPTIONAL_GUIDES (sync-wiki-scaffold.sh:81). The extension is
// PART OF THE KEY — `guides.evals-framework.md`, not `guides.evals-framework` —
// because the key is built as `guides.$guide` straight from the loop variable.
const GUIDE_FILE = 'evals-framework.md';
const GUIDE_DIR = 'type-checking-templates';

function runScaffold(S, { args, input, tty = true }) {
  assert.equal(typeof input, 'string', 'runScaffold requires an explicit stdin string');
  const env = { ...S.env, ...(tty ? { BOOTSTRAP_ASSUME_TTY: '1' } : {}) };
  if (!tty) delete env.BOOTSTRAP_ASSUME_TTY;
  const r = spawnSync('bash', [SYNC_SCAFFOLD, ...args, S.projectDir], {
    encoding: 'utf8',
    env,
    cwd: S.home,
    input,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

test('sync-wiki-scaffold.sh e2e: guides.* keys are built from the loop variable, and each answer is remembered by its exact key', () => {
  withScratchEnv((S) => {
    // Run 1: decline the file guide, accept the directory guide. Two different
    // answers in one run is what proves the key literal tracks the loop variable
    // rather than being written once — a hard-coded key would record both under
    // the same name and the second assertion would catch it.
    const r1 = runScaffold(S, { args: ['--interactive'], input: 'n\ny\n' });
    assert.equal(r1.status, 0, `run 1 failed:\nstdout:\n${r1.stdout}\nstderr:\n${r1.stderr}`);

    const stored = readPrefs(S.projectDir);
    assert.deepEqual(
      stored,
      { [`guides.${GUIDE_FILE}`]: false, [`guides.${GUIDE_DIR}`]: true },
      'the two guides did not record under their exact computed keys. The extension is part of the key, and a ' +
        'hard-coded literal list here is precisely the drift the wildcard schema entry exists to prevent'
    );
    // JSON booleans, not strings: a stored "false" would be truthy in every shell
    // test and read back as a settled `true`.
    assert.equal(typeof stored[`guides.${GUIDE_FILE}`], 'boolean', 'the decline stored a string, not a JSON boolean');
    assert.equal(typeof stored[`guides.${GUIDE_DIR}`], 'boolean', 'the accept stored a string, not a JSON boolean');

    assert.ok(
      !fs.existsSync(path.join(S.projectDir, 'wiki', 'guides', GUIDE_FILE)),
      'the declined guide was delivered anyway'
    );
    assert.ok(
      fs.existsSync(path.join(S.projectDir, 'wiki', 'guides', GUIDE_DIR)),
      'the accepted guide was not delivered'
    );

    // Run 2, POISON stdin: every line is `y`, so any prompt that still fired
    // would flip the declined guide to delivered.
    const r2 = runScaffold(S, { args: ['--interactive'], input: 'y\ny\ny\ny\n' });
    assert.equal(r2.status, 0, `run 2 failed:\nstdout:\n${r2.stdout}\nstderr:\n${r2.stderr}`);

    assert.match(
      r2.stdout,
      new RegExp(`${GUIDE_FILE.replace('.', '\\.')}: skipped \\(remembered answer guides\\.${GUIDE_FILE.replace('.', '\\.')}=false`),
      `the declined guide was re-offered:\n${r2.stdout}`
    );
    assert.ok(
      !fs.existsSync(path.join(S.projectDir, 'wiki', 'guides', GUIDE_FILE)),
      'the second run delivered the declined guide — the remembered answer was ignored'
    );
    // The ACCEPTED guide must come back through the PRESENCE branch, not the
    // stored-answer branch: a file on disk is the stronger signal, and the user
    // opts out by deleting it.
    assert.match(
      r2.stdout,
      new RegExp(`${GUIDE_DIR}: refreshed \\(already present — previously opted in\\)`),
      `the delivered guide did not take the presence branch:\n${r2.stdout}`
    );
  });
});

test('sync-wiki-scaffold.sh e2e: a stored `true` delivers the guide on a NON-INTERACTIVE run', () => {
  // THE ORDERING CLAIM. The store is read AHEAD of the `INTERACTIVE` guard, not
  // behind it. Behind it, a stored `true` would be silently ignored on every
  // headless run — so the answer the user recorded once would only take effect
  // when they were sitting at a tty, which is exactly the case where they would
  // have been asked anyway. The schema says `true` delivers on EVERY run.
  withScratchEnv((S) => {
    assertNoTtySeam(S);
    seedPref(S, 'project', `guides.${GUIDE_FILE}`, true);

    // No --interactive AND no tty seam: nothing here can prompt.
    const r = runScaffold(S, { args: [], input: '', tty: false });
    assert.equal(r.status, 0, `run failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    assert.match(
      r.stdout,
      new RegExp(`${GUIDE_FILE.replace('.', '\\.')}: delivered \\(remembered answer guides\\.${GUIDE_FILE.replace('.', '\\.')}=true`),
      `a stored \`true\` did not deliver on a non-interactive run — the store is being read behind the ` +
        `INTERACTIVE guard instead of ahead of it:\n${r.stdout}`
    );
    assert.ok(
      fs.existsSync(path.join(S.projectDir, 'wiki', 'guides', GUIDE_FILE)),
      'the remembered opt-in did not put the guide on disk'
    );
    // The OTHER guide is unanswered and there is no tty: it must stay absent and
    // must not have been recorded.
    assert.ok(
      !fs.existsSync(path.join(S.projectDir, 'wiki', 'guides', GUIDE_DIR)),
      'an unanswered guide was delivered on a headless run'
    );
    assert.deepEqual(
      readPrefs(S.projectDir),
      { [`guides.${GUIDE_FILE}`]: true },
      'the headless run recorded an answer for the guide it never asked about'
    );
  });
});

test('install-global.sh e2e: a skills.pruneOrphans decline is remembered, and the second run neither prompts nor deletes', () => {
  withScratchEnv((S) => {
    const skillsDir = path.join(S.home, '.claude', 'skills');
    const orphans = ['adr-create', 'prd-create'].map((n) => path.join(skillsDir, n));
    for (const o of orphans) {
      fs.mkdirSync(o, { recursive: true });
      fs.writeFileSync(path.join(o, 'SKILL.md'), '# stale\n');
    }

    const run = (input) =>
      spawnSync('bash', [INSTALL_GLOBAL, '--skip-mcps'], {
        encoding: 'utf8',
        env: { ...S.env, BOOTSTRAP_ASSUME_TTY: '1' },
        cwd: S.home,
        input,
      });

    // Run 1: decline.
    const r1 = run('n\n');
    assert.equal(r1.status, 0, `run 1 failed:\nstdout:\n${r1.stdout}\nstderr:\n${r1.stderr}`);
    assert.match(r1.stdout, /Stale skill folders detected/, `the orphan block never ran:\n${r1.stdout}`);
    assert.match(r1.stdout, /Skipped\. To remove manually: rm -rf/, 'the manual-removal escape route is missing');
    assert.equal(
      readPrefs(S.home)['skills.pruneOrphans'],
      false,
      'the decline was not recorded at --global (this script has no project dir, so global is the only correct layer)'
    );
    for (const o of orphans) assert.ok(fs.existsSync(o), `${o} was deleted despite the decline`);

    // Run 2: POISON stdin with `y` — a re-asked prompt would delete the folders.
    const r2 = run('y\n');
    assert.equal(r2.status, 0, `run 2 failed:\nstdout:\n${r2.stdout}\nstderr:\n${r2.stderr}`);
    assert.match(
      r2.stdout,
      /skills\.pruneOrphans: using remembered answer \(no\) — change with \/bootstrap-config/,
      `the prompt was asked again:\n${r2.stdout}`
    );
    for (const o of orphans) {
      assert.ok(fs.existsSync(o), `${o} was deleted on the second run — the remembered decline was ignored`);
    }
  });
});

test('update-project.sh e2e: update.legacyDocsAck records `true` only — a decline writes NOTHING', () => {
  // THE ASYMMETRY, AND WHY IT IS NOT AN OVERSIGHT. Every other Phase 2 key
  // records in both directions. This one must not: a persisted `false` would
  // abort every future `update` at `exit 0` — silently, with no prompt left to
  // change your mind with — bricking the update command until the user found
  // /bootstrap-config. The key is an ACKNOWLEDGEMENT, so a yes is durable and a
  // no is a per-run decision to go migrate first.
  withScratchEnv((S) => {
    fs.mkdirSync(path.join(S.projectDir, '.docs', 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(S.projectDir, '.docs', 'tasks', 'x.md'), '# legacy\n');

    const run = (input) =>
      spawnSync('bash', [UPDATE_PROJECT, S.projectDir], {
        encoding: 'utf8',
        env: { ...S.env, BOOTSTRAP_ASSUME_TTY: '1' },
        cwd: S.home,
        input,
      });

    const r = run('n\n');
    assert.equal(r.status, 0, 'a decline must exit 0, not fail');
    assert.match(r.stdout, /WARNING: legacy \.docs\/ artifact content detected/, 'the legacy banner did not print');
    assert.match(r.stdout, /^Aborted\.$/m, `the decline did not abort:\n${r.stdout}`);

    // THE ASSERTION THIS TEST EXISTS FOR.
    assertNoPrefsFile(
      S.projectDir,
      'scratch project after a DECLINED legacy-docs prompt — a recorded `false` would abort every future update ' +
        'with no prompt left to change it with'
    );
    assertNoPrefsFile(S.home, 'scratch HOME');
  });
});

test('update-project.sh e2e: a stored `false` is still honoured on READ, so /bootstrap-config can set it deliberately', () => {
  // `false` is never WRITTEN by the prompt, but it stays a legal value: a user
  // who genuinely wants `update` to keep refusing on this project must be able to
  // set it. Read and write are deliberately asymmetric here, and this is the half
  // that would be easy to drop while "simplifying" the ladder.
  withScratchEnv((S) => {
    fs.mkdirSync(path.join(S.projectDir, '.docs', 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(S.projectDir, '.docs', 'tasks', 'x.md'), '# legacy\n');
    seedPref(S, 'project', 'update.legacyDocsAck', false);
    const before = storeFingerprint(S.projectDir);

    // POISON: `y` would continue past the banner if the prompt still fired.
    const r = spawnSync('bash', [UPDATE_PROJECT, S.projectDir], {
      encoding: 'utf8',
      env: { ...S.env, BOOTSTRAP_ASSUME_TTY: '1' },
      cwd: S.home,
      input: 'y\n',
    });

    assert.equal(r.status, 0, 'honouring a stored decline must exit 0');
    assert.match(
      r.stdout,
      /update\.legacyDocsAck: honouring recorded answer \(no\) — change with \/bootstrap-config/,
      `a stored \`false\` was not honoured on read:\n${r.stdout}`
    );
    assert.match(r.stdout, /^Aborted\.$/m, 'the run continued despite a stored decline');
    assert.deepEqual(
      storeFingerprint(S.projectDir),
      before,
      'honouring a stored decline rewrote the store — this path must read only'
    );
  });
});

test('prefs_set: an illegal value surfaces the error, does not abort, and leaves the stored value intact', () => {
  // bootstrap-prefs.js exits 1 only when the CALLER is wrong. lib.sh:644-657
  // leaves its stderr visible so the bug shows up in the log, but swallows the
  // status so a typo in an installer cannot cost the user their setup.
  withScratchEnv((S) => {
    seedPref(S, 'global', SCOPE_KEY, 'project');
    const before = storeFingerprint(S.home);

    const r = runShell(
      [`prefs_set ${SCOPE_KEY} --global bogusvalue`, "echo 'REACHED_END'"].join('\n'),
      { env: S.env }
    );

    assert.equal(r.status, 0, `an illegal preference value aborted the caller:\nstderr:\n${r.stderr}`);
    assert.match(r.stdout, /^REACHED_END$/m, 'execution stopped at the failed write');
    assert.match(
      r.stderr,
      /bogusvalue/,
      `the helper's own error was swallowed — a mistyped value must stay visible in the log:\n${r.stderr}`
    );
    assert.match(
      r.stderr,
      /Warning: could not record preference/,
      `lib.sh's own warning is missing from stderr:\n${r.stderr}`
    );

    assert.deepEqual(
      readPrefs(S.home),
      { [SCOPE_KEY]: 'project' },
      'the rejected write clobbered the previously stored value'
    );
    assert.deepEqual(storeFingerprint(S.home), before, 'the rejected write still rewrote the store file');
  });
});

// ===========================================================================
// install-global.sh — the SKILL-CONSENT preferences pass (TASK-030 steps 6+7)
// ===========================================================================
//
// Phase 2 wired `consumer: installer` keys, each asked in situ by the script
// that owns it. This section owns the OTHER population: the six
// `consumer: skill` keys, asked once as a batch by install-global.sh's
// preferences pass, plus the step-6 copy earlier in the file that makes them
// readable from an arbitrary project at all.
//
// THREE CLAIMS, EACH A TRAP THAT WAS REAL BEFORE IT WAS PINNED:
//
//   1. "UNANSWERED" CANNOT BE MEASURED WITH prefs_get. Five of these six keys
//      carry a NON-NULL schema default, and resolve() falls through to it
//      (bootstrap-prefs.js:376-378), so prefs_get reports every one of them as
//      settled on a machine that has never answered anything. A prefs_get-based
//      pass asks NOTHING, FOREVER, and the install looks clean while doing it.
//      prefs_stored_global reads --list's [layer] column instead, which is the
//      only surface that separates a stored [global] answer from a [default].
//
//   2. A RE-RUN RE-ASKS ONLY THE UNANSWERED. A stored `false` and a stored
//      `ask` are both SETTLED ANSWERS. Re-prompting a decline is the exact
//      annoyance this whole mechanism exists to remove, so the re-run tests
//      POISON stdin — every line is an answer that would visibly change the
//      store if any prompt still fired.
//
//   3. AN UNATTENDED RUN RECORDS NOTHING. The tty guard wraps the whole pass,
//      so a headless install does not even reach the read probe and no values
//      file is created. One CI run must never bake in an answer.

// The five `consumer: skill` keys, in the order install-global.sh asks them.
// versionBump is FIRST and is the odd one out: its grammar is auto/confirm/never
// and `confirm` IS its ask state, so it has no `ask` value and does not go
// through settle_skill_pref.
const SKILL_PREF_KEYS = [
  'gitCommit.versionBump',
  'gitCommit.autoPush',
  'research.persistToRaw',
  'research.autoIngest',
  'uatGenerate.promoteTests',
  'gitignore.offerSectionUpdates',
];

/**
 * Run install-global.sh --skip-mcps against the scratch HOME.
 *
 * --skip-mcps keeps the run offline and local-only. cwd is S.home rather than
 * the repo so nothing relative can land in this checkout, matching the
 * skills.pruneOrphans test above.
 */
function runInstallGlobal(S, { input, tty = true }) {
  assert.equal(typeof input, 'string', 'runInstallGlobal requires an explicit stdin string');
  const env = { ...S.env, ...(tty ? { BOOTSTRAP_ASSUME_TTY: '1' } : {}) };
  if (!tty) delete env.BOOTSTRAP_ASSUME_TTY;
  const r = spawnSync('bash', [INSTALL_GLOBAL, '--skip-mcps'], {
    encoding: 'utf8',
    env,
    cwd: S.home,
    input,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

test('prefs_stored_global: distinguishes a stored [global] answer from a schema [default] — which prefs_get cannot', () => {
  // THE LOAD-BEARING DISCOVERY, pinned in both directions on ONE key so the
  // contrast is unarguable: same key, same moment, two helpers, two answers.
  withScratchEnv((S) => {
    const key = 'uatGenerate.promoteTests'; // schema default: "dedicated" (non-null)

    // Nothing stored anywhere yet.
    assertNoPrefsFile(S.home, 'scratch HOME before the probe');

    const before = runShell(
      [
        `if prefs_stored_global ${key}; then echo 'STORED=yes'; else echo 'STORED=no'; fi`,
        `echo "GET=$(prefs_get ${key} --global)"`,
      ].join('\n'),
      { env: S.env }
    );
    assert.equal(before.status, 0, `probe failed:\nstderr:\n${before.stderr}`);

    assert.match(
      before.stdout,
      /^STORED=no$/m,
      `prefs_stored_global claimed a never-answered key was stored:\n${before.stdout}`
    );
    // The whole reason prefs_stored_global exists: prefs_get says `dedicated`
    // here, because the SCHEMA says dedicated — not because the user ever did.
    assert.match(
      before.stdout,
      /^GET=dedicated$/m,
      'prefs_get did not fall through to the schema default — if this key lost its non-null default the ' +
        'contrast this test documents is gone, and so is the reason prefs_stored_global exists'
    );
    // The probe must not have materialised a file: --list is read-only, and a
    // pass that created an empty store on every run would be a silent write.
    assertNoPrefsFile(S.home, 'scratch HOME after the read-only probe');

    // Now store the SAME value the default already reports. prefs_get is
    // unchanged (true before, true after) while prefs_stored_global flips —
    // proving it reads the layer, not the value.
    seedPref(S, 'global', key, 'dedicated');

    const after = runShell(
      [
        `if prefs_stored_global ${key}; then echo 'STORED=yes'; else echo 'STORED=no'; fi`,
        `echo "GET=$(prefs_get ${key} --global)"`,
      ].join('\n'),
      { env: S.env }
    );
    assert.equal(after.status, 0, `probe failed:\nstderr:\n${after.stderr}`);
    assert.match(
      after.stdout,
      /^STORED=yes$/m,
      `prefs_stored_global did not see a value it had just stored:\n${after.stdout}`
    );
    assert.match(after.stdout, /^GET=dedicated$/m, 'prefs_get changed answer, defeating the point of the contrast');
  });
});

test('prefs_stored_global: a stored `false` counts as ANSWERED — the direction that stops a decline re-asking forever', () => {
  // `false` is the value most likely to be mistaken for "no answer": it is
  // falsy in every shell test, and gitCommit.autoPush's schema default is
  // `false` too, so value-based reasoning cannot tell the two apart at all.
  withScratchEnv((S) => {
    const key = 'gitCommit.autoPush';
    seedPref(S, 'global', key, false);

    const r = runShell(
      [
        `if prefs_stored_global ${key}; then echo 'STORED=yes'; else echo 'STORED=no'; fi`,
        `echo "GET=$(prefs_get ${key} --global)"`,
      ].join('\n'),
      { env: S.env }
    );
    assert.equal(r.status, 0, `probe failed:\nstderr:\n${r.stderr}`);
    assert.match(
      r.stdout,
      /^STORED=yes$/m,
      'a stored `false` was reported as unanswered — this is the bug that makes a decline re-ask forever, ' +
        `which is the entire failure ROADMAP-005 exists to remove:\n${r.stdout}`
    );
    // The value-based view is genuinely ambiguous here, which is why the layer
    // column is the only correct signal.
    assert.match(r.stdout, /^GET=false$/m, 'a stored `false` did not read back as false');
  });
});

test('prefs_stored_global: a PROJECT-layer answer does not count as answered for a pass that writes --global', () => {
  // The pass records at --global (install-global.sh takes no project path), so
  // "already answered" must mean "answered IN THE LAYER I WOULD WRITE TO".
  // Counting a project answer would let one checkout suppress the machine-wide
  // question permanently.
  withScratchEnv((S) => {
    const key = 'research.persistToRaw';
    seedPref(S, 'project', key, false);

    const r = runShell(
      [`if prefs_stored_global ${key}; then echo 'STORED=yes'; else echo 'STORED=no'; fi`].join('\n'),
      { env: S.env }
    );
    assert.equal(r.status, 0, `probe failed:\nstderr:\n${r.stderr}`);
    assert.match(
      r.stdout,
      /^STORED=no$/m,
      `a project-layer answer satisfied a global-layer question:\n${r.stdout}`
    );
    assertNoPrefsFile(S.home, 'scratch HOME (the global layer was never written)');
  });
});

test('prompt_letter_choice: resolves on the FIRST LETTER, is case-insensitive, and falls back to the declared default', () => {
  // The resolver contract, isolated from the store. prompt_choice_sticky matches
  // a digit or an EXACT name; this matches the first letter, because the sync
  // prompts print `[y]es / [n]o / [a]sk` and typing `y` must not fall through.
  withScratchEnv((S) => {
    const cases = [
      ['y', 'yes'],
      ['yes', 'yes'],
      ['Y', 'yes'],
      ['n', 'no'],
      ['NOPE', 'no'], // first letter only — the rest is ignored by construction
      ['a', 'ask'],
      ['s', 'skip'],
      ['', 'skip'], // bare Enter -> the declared default
      ['zzz', 'skip'], // unmatched -> the declared default
    ];
    for (const [reply, expected] of cases) {
      const r = runShell("prompt_letter_choice skip '  pick: ' yes no ask skip", {
        env: S.env,
        tty: true,
        input: `${reply}\n`,
      });
      assert.equal(r.status, 0, `reply ${JSON.stringify(reply)} aborted:\nstderr:\n${r.stderr}`);
      // STDOUT IS THE RETURN VALUE — the resolved name and nothing else. The
      // prompt itself goes to stderr via read -r -p, so a stray byte on stdout
      // would be captured by the caller as part of the answer.
      assert.equal(
        r.stdout,
        `${expected}\n`,
        `reply ${JSON.stringify(reply)} resolved wrongly, or leaked something onto stdout: ${JSON.stringify(r.stdout)}`
      );
    }
    // Purely a resolver: it must never touch the store in either layer.
    assertNoPrefsFile(S.home, 'scratch HOME after prompt_letter_choice');
    assertNoPrefsFile(S.projectDir, 'scratch project after prompt_letter_choice');
  });
});

test('prompt_letter_choice: EOF resolves to the default without aborting a `set -euo pipefail` caller', () => {
  // `read` returns non-zero at EOF; without the `|| reply=""` guard the whole
  // installer would die mid-pass on a closed stdin.
  withScratchEnv((S) => {
    const r = runShell(
      ["answer=\"$(prompt_letter_choice skip '  pick: ' yes no ask skip)\"", 'echo "ANSWER=$answer"', "echo 'REACHED_END'"].join('\n'),
      { env: S.env, tty: true, input: '' }
    );
    assert.equal(r.status, 0, `EOF aborted the caller:\nstderr:\n${r.stderr}`);
    assert.match(r.stdout, /^ANSWER=skip$/m, `EOF did not resolve to the declared default:\n${r.stdout}`);
    assert.match(r.stdout, /^REACHED_END$/m, 'execution stopped at the EOF read');
  });
});

test('install-global.sh e2e: step 6 installs the helper AND its schema in the layout that keeps defaults working', () => {
  // Skills run inside ARBITRARY projects and cannot reach lib/scripts/. The
  // schema must land in <helper dir>/templates/ specifically, because
  // bootstrap-prefs.js resolves it that way — a flattened copy would make every
  // skill's no---schema invocation silently lose validation AND defaults.
  withScratchEnv((S) => {
    const r = runInstallGlobal(S, { input: 's\ns\ns\ns\ns\ns\n' });
    assert.equal(r.status, 0, `install failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    const helper = path.join(S.home, '.claude', 'bootstrap-prefs.js');
    const schema = path.join(S.home, '.claude', 'templates', 'bootstrap-prefs-schema.json');
    assert.ok(fs.existsSync(helper), `step 6 did not install the helper at ${helper}`);
    assert.ok(
      fs.existsSync(schema),
      `the schema is not at <helper dir>/templates/ — a skill invoking the helper with no --schema flag would ` +
        `lose validation and every default:\n${schema}`
    );
    assert.equal(
      fs.readFileSync(helper, 'utf8'),
      fs.readFileSync(PREFS_JS, 'utf8'),
      'the installed helper is not a faithful copy of lib/scripts/bootstrap-prefs.js'
    );

    // THE POINT OF THE LAYOUT, exercised the way a skill actually does it:
    // invoke the INSTALLED copy with NO --schema and confirm a default resolves.
    const viaInstalled = spawnSync(
      process.execPath,
      [helper, '--get', 'uatGenerate.promoteTests', '--project', S.projectDir],
      { encoding: 'utf8', env: S.env }
    );
    assert.equal(viaInstalled.status, 0, `the installed helper failed to run: ${viaInstalled.stderr}`);
    assert.equal(
      (viaInstalled.stdout || '').trim(),
      'dedicated',
      'the installed helper did not resolve the schema default — the templates/ layout is broken, and every ' +
        'skill call site that omits --schema would read `unset` instead of the documented default'
    );
  });
});

test('install-global.sh e2e: a fresh interactive run settles all six keys, and each answer lands as its correct JSON type', () => {
  withScratchEnv((S) => {
    // One distinct answer per key, deliberately covering all four storable
    // shapes: a string grammar, a boolean true, a boolean false, and `ask`.
    //
    // `b` is uatGenerate.promoteTests' SIBLING option. Its prompt spells that
    // option `beside` rather than `sibling` because prompt_letter_choice matches
    // on first letter and takes the first listed name that matches — offering
    // `sibling` next to `skip` would make one of the two untypable. The stored
    // value is still `sibling`; only the option name differs.
    //
    // `ask` coverage moved to gitignore.offerSectionUpdates (final `a`) when
    // promoteTests' grammar changed from true|false|ask to a location choice
    // that has no ask state. Without that move this test would silently stop
    // exercising the `ask` shape at all.
    //
    // research.autoIngest sits between persistToRaw and promoteTests — the same
    // position it holds in install-global.sh's asking order — and is answered
    // `y` (true) here, giving the boolean-true shape a second, independent key.
    const r = runInstallGlobal(S, { input: 'n\ny\nn\ny\nb\na\n' });
    assert.equal(r.status, 0, `install failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    for (const key of SKILL_PREF_KEYS) {
      assert.ok(
        r.stdout.includes(key),
        `${key} was never mentioned by the pass — a key silently dropped from the batch is unaskable ` +
          `forever:\n${r.stdout}`
      );
    }

    assert.deepEqual(
      readPrefs(S.home),
      {
        'gitCommit.versionBump': 'never',
        'gitCommit.autoPush': true,
        'research.persistToRaw': false,
        'research.autoIngest': true,
        'uatGenerate.promoteTests': 'sibling',
        'gitignore.offerSectionUpdates': 'ask',
      },
      'the six answers did not round-trip. Note the types: `false` must be a JSON boolean, since a stored ' +
        '"false" string is truthy in every shell test and reads back as a settled true'
    );

    // Recorded at the GLOBAL layer only — this script takes no project path, so
    // a project-layer write would be a machine-wide answer parked where only one
    // checkout can see it.
    assertNoPrefsFile(S.projectDir, 'scratch project (install-global.sh must never write a project layer)');

    // The recovery pointers are printed BECAUSE questions were asked.
    assert.match(r.stdout, /Change an answer:\s+node ~\/\.claude\/bootstrap-prefs\.js --set/, 'the --set pointer is missing');
    assert.match(r.stdout, /Re-open a question:\s+node ~\/\.claude\/bootstrap-prefs\.js --unset/, 'the --unset pointer is missing');
    assert.match(r.stdout, /Or run \/bootstrap-config\./, 'the /bootstrap-config pointer is missing');
  });
});

test('install-global.sh e2e: a re-run re-asks ONLY the unanswered key — stored `false` and `ask` are never re-asked', () => {
  // THE CENTRAL REQUIREMENT OF ROADMAP-005, and the reason stdin is poisoned:
  // every line of run 2 is an answer that would visibly rewrite the store if any
  // settled question fired again.
  withScratchEnv((S) => {
    // Run 1: answer five, SKIP the sixth. `s` records nothing, so
    // gitignore.offerSectionUpdates stays genuinely unanswered.
    //
    // The run-1 set deliberately contains BOTH a stored `false` and a stored
    // `ask`, because those are the two shapes a naive "is it set?" check gets
    // wrong. `ask` sits on gitCommit.autoPush here — it used to sit on
    // uatGenerate.promoteTests, which no longer has an ask state now that its
    // grammar answers WHERE tests go rather than whether to write them. The
    // second `n` is research.autoIngest, giving `false` a second independent
    // key alongside research.persistToRaw. `d` is promoteTests' dedicated-folder
    // option.
    const r1 = runInstallGlobal(S, { input: 'a\na\nn\nn\nd\ns\n' });
    assert.equal(r1.status, 0, `run 1 failed:\nstdout:\n${r1.stdout}\nstderr:\n${r1.stderr}`);

    const afterRun1 = {
      'gitCommit.versionBump': 'auto',
      'gitCommit.autoPush': 'ask',
      'research.persistToRaw': false,
      'research.autoIngest': false,
      'uatGenerate.promoteTests': 'dedicated',
    };
    assert.deepEqual(
      readPrefs(S.home),
      afterRun1,
      'a skipped question recorded something. `skip` must write NOTHING — absence is the only representation ' +
        'of unset, and a stray keystroke must not settle a question permanently'
    );
    assert.match(
      r1.stdout,
      /gitignore\.offerSectionUpdates left unanswered/,
      `the skip was not reported as leaving the question open:\n${r1.stdout}`
    );

    // Run 2: POISON. Every line is `y`. If versionBump re-asked it would become
    // `skip`-or-something-else; if autoPush/persistToRaw/autoIngest/promoteTests
    // re-asked they would all become `true`.
    const r2 = runInstallGlobal(S, { input: 'y\ny\ny\ny\ny\ny\n' });
    assert.equal(r2.status, 0, `run 2 failed:\nstdout:\n${r2.stdout}\nstderr:\n${r2.stderr}`);

    assert.deepEqual(
      readPrefs(S.home),
      { ...afterRun1, 'gitignore.offerSectionUpdates': true },
      'run 2 changed a settled answer. Exactly one key was unanswered, so exactly one key may change — a stored ' +
        '`false` (research.persistToRaw, research.autoIngest) and a stored `ask` (gitCommit.autoPush) are ' +
        'SETTLED ANSWERS'
    );

    // Not merely "the value survived": the settled questions must not have been
    // PRINTED either. A re-asked question the user answers identically is still
    // a re-asked question.
    for (const key of [
      'gitCommit.versionBump',
      'gitCommit.autoPush',
      'research.persistToRaw',
      'research.autoIngest',
      'uatGenerate.promoteTests',
    ]) {
      assert.ok(
        !r2.stdout.includes(key),
        `${key} was mentioned again on the re-run — it is already settled and must be silent:\n${r2.stdout}`
      );
    }
    assert.ok(
      r2.stdout.includes('gitignore.offerSectionUpdates'),
      `the one genuinely unanswered key was NOT re-asked:\n${r2.stdout}`
    );

    // Run 3: everything is settled. The pass must ask nothing and say so.
    const r3 = runInstallGlobal(S, { input: 'y\ny\ny\ny\ny\ny\n' });
    assert.equal(r3.status, 0, `run 3 failed:\nstdout:\n${r3.stdout}\nstderr:\n${r3.stderr}`);
    assert.match(
      r3.stdout,
      /All skill preferences already answered — nothing to ask\./,
      `run 3 did not report a fully-settled store:\n${r3.stdout}`
    );
    assert.deepEqual(
      readPrefs(S.home),
      { ...afterRun1, 'gitignore.offerSectionUpdates': true },
      'run 3 rewrote the store despite asking nothing'
    );
    // The closing pointers are printed ONLY when something was asked, so a
    // no-op run stays quiet.
    assert.ok(
      !/Change an answer:/.test(r3.stdout),
      `the recovery pointers were printed on a run that asked nothing:\n${r3.stdout}`
    );
  });
});

test('install-global.sh e2e: a NON-INTERACTIVE run asks nothing and writes no preferences file at all', () => {
  // The tty guard wraps the WHOLE pass, so an unattended run never even reaches
  // the read probe. Asserting "no file" (rather than "no answers") is what
  // proves the guard is above the probe rather than inside the loop.
  withScratchEnv((S) => {
    assertNoTtySeam(S);

    const r = runInstallGlobal(S, { input: 'y\ny\ny\ny\ny\ny\n', tty: false });
    assert.equal(r.status, 0, `install failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    assert.match(
      r.stdout,
      /Non-interactive terminal: skipping the preference questions\. Every unanswered key keeps today's behavior\./,
      `the pass did not announce that it was skipping:\n${r.stdout}`
    );
    assertNoPrefsFile(S.home, 'scratch HOME after a non-interactive install');
    assertNoPrefsFile(S.projectDir, 'scratch project after a non-interactive install');

    // Step 6 still ran — installing the helper is unconditional, and only the
    // QUESTIONS are tty-gated.
    assert.ok(
      fs.existsSync(path.join(S.home, '.claude', 'bootstrap-prefs.js')),
      'the helper install was skipped along with the prompts — step 6 is not tty-gated and must always run'
    );
  });
});

test('install-global.sh e2e: a NON-INTERACTIVE run still installs the schema in the templates/ layout that keeps defaults working', () => {
  // The step-6 test above already covers the tty:true direction, so this one
  // exists purely for the headless direction — the one a careless edit breaks.
  // Moving the step 6 copy inside step 7's `else` arm, where the QUESTIONS
  // legitimately live, would still pass every existing test in this file: the
  // interactive twin would keep finding the schema, and the non-interactive twin
  // above only ever looks for the helper. Every skill running under an unattended
  // install would then invoke a helper with no schema beside it and silently read
  // `unset` in place of every documented default.
  withScratchEnv((S) => {
    assertNoTtySeam(S);

    const r = runInstallGlobal(S, { input: 'y\ny\ny\ny\ny\ny\n', tty: false });
    assert.equal(r.status, 0, `install failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    const helper = path.join(S.home, '.claude', 'bootstrap-prefs.js');
    const schema = path.join(S.home, '.claude', 'templates', 'bootstrap-prefs-schema.json');
    assert.ok(
      fs.existsSync(schema),
      `a headless install did not put the schema at <helper dir>/templates/ — step 6 has been pulled inside ` +
        `the tty guard, and no unattended install resolves a default any more:\n${schema}`
    );
    // Hashed rather than parsed: the claim is "a faithful copy", and a schema that
    // happens to parse to an equivalent object is still not the file the helper's
    // own path resolution was written against.
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(schema)).digest('hex'),
      crypto.createHash('sha256').update(fs.readFileSync(REAL_SCHEMA)).digest('hex'),
      'the installed schema is not byte-identical to lib/scripts/templates/bootstrap-prefs-schema.json'
    );

    // THE SAME PROBE THE INTERACTIVE TWIN USES, run on a headless install: invoke
    // the INSTALLED copy with NO --schema flag and confirm a default still resolves.
    const viaInstalled = spawnSync(
      process.execPath,
      [helper, '--get', 'uatGenerate.promoteTests', '--project', S.projectDir],
      { encoding: 'utf8', env: S.env }
    );
    assert.equal(viaInstalled.status, 0, `the installed helper failed to run: ${viaInstalled.stderr}`);
    assert.equal(
      (viaInstalled.stdout || '').trim(),
      'dedicated',
      'the installed helper did not resolve the schema default after a NON-INTERACTIVE install — the templates/ ' +
        'layout only survives when someone is watching, which is the opposite of what step 6 promises'
    );

    // The other half of the step-6-unguarded / step-7-guarded split, in the same
    // run: helper AND schema installed, and still not one answer recorded.
    assertNoPrefsFile(S.home, 'scratch HOME after a non-interactive install');
    assertNoPrefsFile(S.projectDir, 'scratch project after a non-interactive install');
  });
});

test('install-global.sh e2e: gitCommit.versionBump offers auto/confirm/never and has no `ask` value', () => {
  // `confirm` IS this key's ask state. Offering both would create two spellings
  // of one state, and the schema grammar deliberately omits `ask`.
  withScratchEnv((S) => {
    const r = runInstallGlobal(S, { input: 'c\ns\ns\ns\ns\ns\n' });
    assert.equal(r.status, 0, `install failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    // THE GRAMMAR IS ASSERTED AGAINST THE SCRIPT SOURCE, NOT THE CAPTURED
    // OUTPUT, and that is forced rather than lazy: `read -r -p` displays its
    // prompt ONLY when stdin is a terminal (bash manual, read -p). Every test
    // here drives the script through a pipe, so the prompt string is emitted on
    // neither stdout nor stderr and cannot be observed at runtime at all. The
    // behavioural half of this key's contract is asserted below, where it IS
    // observable: `c` resolves to `confirm`, and the helper rejects `ask`.
    const installGlobalSrc = fs.readFileSync(INSTALL_GLOBAL, 'utf8');
    assert.match(
      installGlobalSrc,
      /\[a\]uto \/ \[c\]onfirm each time \/ \[n\]ever \/ \[s\]kip for now:/,
      'the versionBump prompt no longer offers the documented auto/confirm/never grammar'
    );
    assert.ok(
      !/\[a\]sk[^]{0,80}versionBump|versionBump[^]{0,200}\[a\]sk me every time/.test(installGlobalSrc),
      'the versionBump prompt offers an `ask` option — `confirm` IS this key\'s ask state, and a second ' +
        'spelling of one state is exactly what the grammar omits on purpose'
    );
    assert.deepEqual(
      readPrefs(S.home),
      { 'gitCommit.versionBump': 'confirm' },
      'the `confirm` answer did not round-trip, or a skipped sibling recorded something'
    );

    // The helper's own grammar must agree — the prompt and the schema are two
    // copies of one contract and this is where they are compared.
    const rejected = prefsCli(['--set', 'gitCommit.versionBump', '--value', 'ask', '--global'], S.env);
    assert.equal(
      rejected.status,
      1,
      'the schema accepted `ask` for gitCommit.versionBump — `confirm` is this key\'s ask state and a second ' +
        'spelling of it would split the grammar'
    );
  });
});
