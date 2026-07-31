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

// The exact sequence run_project_sync calls its six sub-scripts in, as of the
// TASK-036 reorder. install-global.sh MUST precede install-mcps.sh — that is
// the ordering half of the fix under test.
const STEP_ORDER = [
  'install-global.sh',
  'install-mcps.sh',
  'sync-wiki-scaffold.sh',
  'merge-gitignore.sh',
  'build-mcp-guide.sh',
  'bootstrap-serena.sh',
];

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run-project-sync-'));
}

/**
 * Build a stub script_dir where every one of the six sub-scripts run_project_sync
 * invokes is a marker script that appends its own name to `<dir>/order.log` and
 * then exits with the code `exitCodes[name]` (default 0). `merge-gitignore.sh`
 * ignores its args the same way the real one does when called with --interactive.
 */
function buildScriptDir(exitCodes = {}) {
  const dir = scratchDir();
  for (const name of STEP_ORDER) {
    const code = exitCodes[name] ?? 0;
    const script = [
      '#!/usr/bin/env bash',
      `echo "${name}" >> "${dir}/order.log"`,
      code === 0 ? 'exit 0' : `echo "stub ${name} failing" >&2; exit ${code}`,
      '',
    ].join('\n');
    const file = path.join(dir, name);
    fs.writeFileSync(file, script);
    fs.chmodSync(file, 0o755);
  }
  return dir;
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
