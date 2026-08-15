#!/usr/bin/env node
// Repeatable checks for run_project_sync() in lib/scripts/lib.sh (TASK-036).
// Zero-dependency: node:test + node:assert only, matching test/settings-deny.test.js.
//
// Run: npm test   (or: node --test test/)
//
// TASK-036 reordered run_project_sync so the offline-safe install-global.sh
// --skip-mcps step runs BEFORE the interactive install-mcps.sh step, and
// guarded the latter so a non-zero exit only warns instead of aborting the
// whole function under `set -euo pipefail` (both setup-project.sh and
// update-project.sh source lib.sh under that same option). All of that is a
// pure function of which of six sub-scripts run, in what order, and whether
// a failure in one specific step (install-mcps.sh) stops the rest — so it is
// fully unit-testable against the REAL lib.sh with a stubbed script_dir.
// Nothing here touches $HOME or a real project; the six sub-scripts named by
// run_project_sync are replaced by markers that log to a scratch file.
//
// Companion to UAT-036. What lives there instead: the live end-to-end proof
// with the real sub-scripts (real install-global.sh, real bootstrap-serena.sh
// hitting a live `claude --print`), which needs a scratch $HOME and network
// access and is not something a hermetic unit test should do.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const LIB_SH = path.join(REPO, 'lib', 'scripts', 'lib.sh');

// The exact sequence run_project_sync calls its sub-scripts in, as of the
// TASK-036 reorder plus the TASK-055 Obsidian step and the wiki-alias
// backfill step. install-global.sh MUST precede install-mcps.sh — that is
// the ordering half of the TASK-036 fix. install-obsidian.sh MUST sit
// between merge-gitignore.sh and build-mcp-guide.sh — that is the TASK-055
// call-site contract. backfill-wiki-aliases.js MUST sit between
// merge-gitignore.sh and install-obsidian.sh — the wiki scaffold (and any
// work-item file it delivers or a caller has already authored) must exist
// before the backfill runs, and the Alias Linker plugin install is what
// makes the aliases: it writes actually resolve in Obsidian.
const STEP_ORDER = [
  'install-global.sh',
  'install-mcps.sh',
  'sync-wiki-scaffold.sh',
  'merge-gitignore.sh',
  'backfill-wiki-aliases.js',
  'install-obsidian.sh',
  'build-mcp-guide.sh',
  'bootstrap-serena.sh',
];

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run-project-sync-'));
}

/**
 * Build a stub script_dir where every one of the sub-scripts run_project_sync
 * invokes is a marker script that appends its own name to `<dir>/order.log` and
 * then exits with the code `exitCodes[name]` (default 0). `merge-gitignore.sh`
 * ignores its args the same way the real one does when called with --interactive.
 *
 * backfill-wiki-aliases.js is invoked by lib.sh as `node "$script_dir/<name>"
 * "$project_dir"`, not executed directly via its own shebang — so its stub
 * must be valid Node, not a bash script wearing a .js extension.
 */
function buildScriptDir(exitCodes = {}) {
  const dir = scratchDir();
  for (const name of STEP_ORDER) {
    const code = exitCodes[name] ?? 0;
    const orderLog = path.join(dir, 'order.log');
    const argsLog = path.join(dir, `${name}.args.log`);
    const script = name.endsWith('.js')
      ? [
          '#!/usr/bin/env node',
          `require('fs').appendFileSync(${JSON.stringify(orderLog)}, ${JSON.stringify(name)} + '\\n');`,
          // One argument per line, matching the bash stubs' args.log format.
          `require('fs').writeFileSync(${JSON.stringify(argsLog)}, process.argv.slice(2).join('\\n') + '\\n');`,
          code === 0
            ? 'process.exit(0);'
            : `console.error(${JSON.stringify(`stub ${name} failing`)}); process.exit(${code});`,
          '',
        ].join('\n')
      : [
          '#!/usr/bin/env bash',
          `echo "${name}" >> "${dir}/order.log"`,
          // One argument per line, for tests that need to assert on the exact
          // flags a step was invoked with (e.g. install-obsidian.sh matching the
          // install-mcps.sh call convention). Additive only — does not change
          // order.log, so it cannot affect the pre-existing ordering assertions.
          `printf '%s\\n' "$@" > "${dir}/${name}.args.log"`,
          code === 0 ? 'exit 0' : `echo "stub ${name} failing" >&2; exit ${code}`,
          '',
        ].join('\n');
    const file = path.join(dir, name);
    fs.writeFileSync(file, script);
    fs.chmodSync(file, 0o755);
  }
  return dir;
}

function readArgsLog(dir, name) {
  const p = path.join(dir, `${name}.args.log`);
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l !== '');
}

/**
 * Source the REAL lib.sh and call run_project_sync(projectDir, scriptDir) inside
 * a `set -euo pipefail` wrapper — matching exactly how setup-project.sh and
 * update-project.sh invoke it. A wrapper-level "WRAPPER_EXIT_OK" marker after the
 * call proves the shell did not abort at (or inside) run_project_sync.
 */
function runProjectSync(scriptDir, projectDir) {
  const wrapper = path.join(scriptDir, '_wrapper.sh');
  fs.writeFileSync(
    wrapper,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `. "${LIB_SH}"`,
      `run_project_sync "${projectDir}" "${scriptDir}"`,
      'echo "WRAPPER_EXIT_OK"',
      '',
    ].join('\n')
  );
  fs.chmodSync(wrapper, 0o755);
  const r = spawnSync('bash', [wrapper], { encoding: 'utf8' });
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function readOrderLog(dir) {
  const p = path.join(dir, 'order.log');
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l !== '');
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- the ordering half of the fix ---------------------------------------------

test('install-global.sh --skip-mcps runs before the interactive install-mcps.sh step', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, `wrapper did not exit 0: ${res.stderr}`);
  assert.ok(res.stdout.includes('WRAPPER_EXIT_OK'), 'run_project_sync aborted the sourcing script');
  assert.deepStrictEqual(
    readOrderLog(scriptDir),
    STEP_ORDER,
    'the six sub-scripts did not run in the expected order'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

// --- the guard half of the fix -------------------------------------------------

test('a failing install-mcps.sh only warns — it does not abort run_project_sync', () => {
  const scriptDir = buildScriptDir({ 'install-mcps.sh': 1 });
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(
    res.status,
    0,
    `a guarded install-mcps.sh failure aborted the whole run under set -euo pipefail: ${res.stderr}`
  );
  assert.ok(res.stdout.includes('WRAPPER_EXIT_OK'), 'run_project_sync aborted the sourcing script');
  assert.ok(
    res.stderr.includes(
      'Warning: MCP install failed — continuing with wiki sync; re-run update to retry MCPs.'
    ),
    `expected warning missing from stderr: ${res.stderr}`
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('downstream steps still run in order after install-mcps.sh fails', () => {
  const scriptDir = buildScriptDir({ 'install-mcps.sh': 1 });
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, res.stderr);
  assert.deepStrictEqual(
    readOrderLog(scriptDir),
    STEP_ORDER,
    'a failed MCP install must not skip sync-wiki-scaffold.sh, merge-gitignore.sh, build-mcp-guide.sh, or bootstrap-serena.sh'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('a successful install-mcps.sh prints no warning (the guard only fires on real failure)', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(
    !res.stderr.includes('Warning: MCP install failed'),
    'the warning fired even though the stub install-mcps.sh succeeded'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

// --- scope of the guard: only install-mcps.sh is non-fatal ---------------------

test('a failure in a different step (sync-wiki-scaffold.sh) still aborts the function', () => {
  const scriptDir = buildScriptDir({ 'sync-wiki-scaffold.sh': 1 });
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.notStrictEqual(
    res.status,
    0,
    'a failing sync-wiki-scaffold.sh must still abort under set -euo pipefail — only install-mcps.sh is guarded'
  );
  assert.ok(!res.stdout.includes('WRAPPER_EXIT_OK'), 'the wrapper should not have reached its final echo');
  const log = readOrderLog(scriptDir);
  assert.ok(log.includes('install-global.sh'), 'install-global.sh should still have run');
  assert.ok(log.includes('install-mcps.sh'), 'install-mcps.sh should still have run');
  assert.ok(log.includes('sync-wiki-scaffold.sh'), 'sync-wiki-scaffold.sh should still have been invoked');
  assert.ok(
    !log.includes('bootstrap-serena.sh'),
    'bootstrap-serena.sh ran after an unguarded failure should have aborted the sequence first'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

// --- TASK-055: install-obsidian.sh call-site contract --------------------------
//
// Companion to UAT-055 and to TASK-059's manual verification of the runtime
// failure/decline behavior of the real install-obsidian.sh script. These
// tests cover the STATIC/STRUCTURAL contract only — the exact position of
// the call inside run_project_sync(), the exact guard shape, the exact
// invocation flags, and that the rest of the function is undisturbed. They
// deliberately do not re-exercise the live non-fatal-failure or decline
// behavior of the real script, which TASK-059 already verified end to end.

test('install-obsidian.sh runs after merge-gitignore.sh and before build-mcp-guide.sh (TASK-055 call-site)', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, `wrapper did not exit 0: ${res.stderr}`);
  const log = readOrderLog(scriptDir);
  const gitignoreIdx = log.indexOf('merge-gitignore.sh');
  const obsidianIdx = log.indexOf('install-obsidian.sh');
  const buildGuideIdx = log.indexOf('build-mcp-guide.sh');
  assert.ok(gitignoreIdx !== -1 && obsidianIdx !== -1 && buildGuideIdx !== -1, `one of the three steps did not run: ${log}`);
  assert.ok(
    gitignoreIdx < obsidianIdx && obsidianIdx < buildGuideIdx,
    `install-obsidian.sh must sit strictly between merge-gitignore.sh and build-mcp-guide.sh, got order: ${log}`
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('install-obsidian.sh is invoked with --interactive --project-dir "<project_dir>" (matches the install-mcps.sh call convention)', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, `wrapper did not exit 0: ${res.stderr}`);
  const args = readArgsLog(scriptDir, 'install-obsidian.sh');
  assert.deepStrictEqual(
    args,
    ['--interactive', '--project-dir', projectDir],
    `install-obsidian.sh was not invoked with the expected flags, got: ${JSON.stringify(args)}`
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('run_project_sync prints the "Checking Obsidian setup..." banner before invoking install-obsidian.sh', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, `wrapper did not exit 0: ${res.stderr}`);
  assert.ok(
    res.stdout.includes('Checking Obsidian setup...'),
    `expected banner missing from stdout: ${res.stdout}`
  );
  const bannerIdx = res.stdout.indexOf('Checking Obsidian setup...');
  const guideIdx = res.stdout.indexOf('Building MCP tools guide...');
  assert.ok(
    bannerIdx !== -1 && guideIdx !== -1 && bannerIdx < guideIdx,
    'the Obsidian banner must print before the MCP guide build banner'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('a failing install-obsidian.sh only warns — it does not abort run_project_sync', () => {
  const scriptDir = buildScriptDir({ 'install-obsidian.sh': 1 });
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(
    res.status,
    0,
    `a guarded install-obsidian.sh failure aborted the whole run under set -euo pipefail: ${res.stderr}`
  );
  assert.ok(res.stdout.includes('WRAPPER_EXIT_OK'), 'run_project_sync aborted the sourcing script');
  assert.ok(
    res.stderr.includes('Warning: Obsidian install failed — continuing; re-run update to retry.'),
    `expected warning missing from stderr: ${res.stderr}`
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('downstream steps still run in order after install-obsidian.sh fails', () => {
  const scriptDir = buildScriptDir({ 'install-obsidian.sh': 1 });
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, res.stderr);
  assert.deepStrictEqual(
    readOrderLog(scriptDir),
    STEP_ORDER,
    'a failed Obsidian install must not skip build-mcp-guide.sh or bootstrap-serena.sh'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('a successful install-obsidian.sh prints no warning (the guard only fires on real failure)', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(
    !res.stderr.includes('Warning: Obsidian install failed'),
    'the warning fired even though the stub install-obsidian.sh succeeded'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

// --- wiki-alias backfill call-site contract --------------------------------
//
// backfill-wiki-aliases.js is a repeatable version of TASK-064's one-time
// sweep (see test/backfill-wiki-aliases.test.js for the script's own
// behavior). These tests cover only the STATIC/STRUCTURAL contract of its
// call site inside run_project_sync(): exact position, exact invocation
// form (via `node`, not direct exec), and that it is UNGUARDED — unlike
// install-mcps.sh/install-obsidian.sh, it carries no `if ! ...; then warn;
// fi` wrapper, because the script itself always exits 0 (same contract as
// merge-settings-deny.js/merge-settings-hooks.js), so a stub that exits
// non-zero here must abort the whole sequence exactly like an unguarded step
// (sync-wiki-scaffold.sh) does.

test('backfill-wiki-aliases.js runs after merge-gitignore.sh and before install-obsidian.sh', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, `wrapper did not exit 0: ${res.stderr}`);
  const log = readOrderLog(scriptDir);
  const gitignoreIdx = log.indexOf('merge-gitignore.sh');
  const backfillIdx = log.indexOf('backfill-wiki-aliases.js');
  const obsidianIdx = log.indexOf('install-obsidian.sh');
  assert.ok(gitignoreIdx !== -1 && backfillIdx !== -1 && obsidianIdx !== -1, `one of the three steps did not run: ${log}`);
  assert.ok(
    gitignoreIdx < backfillIdx && backfillIdx < obsidianIdx,
    `backfill-wiki-aliases.js must sit strictly between merge-gitignore.sh and install-obsidian.sh, got order: ${log}`
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('backfill-wiki-aliases.js is invoked as `node <script> "<project_dir>"` with the project dir as its sole argument', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, `wrapper did not exit 0: ${res.stderr}`);
  const args = readArgsLog(scriptDir, 'backfill-wiki-aliases.js');
  assert.deepStrictEqual(
    args,
    [projectDir],
    `backfill-wiki-aliases.js was not invoked with the expected argument, got: ${JSON.stringify(args)}`
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('run_project_sync prints the "Backfilling wiki work-item aliases..." banner before invoking backfill-wiki-aliases.js', () => {
  const scriptDir = buildScriptDir();
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.strictEqual(res.status, 0, `wrapper did not exit 0: ${res.stderr}`);
  assert.ok(
    res.stdout.includes('Backfilling wiki work-item aliases...'),
    `expected banner missing from stdout: ${res.stdout}`
  );
  const bannerIdx = res.stdout.indexOf('Backfilling wiki work-item aliases...');
  const obsidianBannerIdx = res.stdout.indexOf('Checking Obsidian setup...');
  assert.ok(
    bannerIdx !== -1 && obsidianBannerIdx !== -1 && bannerIdx < obsidianBannerIdx,
    'the wiki-alias-backfill banner must print before the Obsidian setup banner'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});

test('a failing backfill-wiki-aliases.js still aborts run_project_sync — it is UNGUARDED, unlike install-mcps.sh/install-obsidian.sh', () => {
  const scriptDir = buildScriptDir({ 'backfill-wiki-aliases.js': 1 });
  const projectDir = scratchDir();

  const res = runProjectSync(scriptDir, projectDir);

  assert.notStrictEqual(
    res.status,
    0,
    'a failing backfill-wiki-aliases.js must still abort under set -euo pipefail — it carries no guard'
  );
  assert.ok(!res.stdout.includes('WRAPPER_EXIT_OK'), 'the wrapper should not have reached its final echo');
  const log = readOrderLog(scriptDir);
  assert.ok(log.includes('backfill-wiki-aliases.js'), 'backfill-wiki-aliases.js should still have been invoked');
  assert.ok(
    !log.includes('install-obsidian.sh'),
    'install-obsidian.sh ran after an unguarded failure should have aborted the sequence first'
  );

  cleanup(scriptDir);
  cleanup(projectDir);
});
