#!/usr/bin/env node
// Repeatable checks that the `config` subcommand in bin/cli.js is wired correctly.
// Zero-dependency: node:test + node:assert + spawnSync only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/cli-config-subcommand.test.js)
//
// Promoted from TASK-0104: `bootstrap config` with no operation flag routes to the
// interactive TUI (lib/scripts/bootstrap-prefs-tui.js); any of --get/--set/--unset/
// --list/--section-key routes to the scripting engine (lib/scripts/bootstrap-prefs.js)
// with args passed through verbatim. Every spawn that could write uses a scratch HOME
// under os.tmpdir(), so the real ~/.claude is never touched.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const CLI = path.join(REPO, 'bin', 'cli.js');
const ENGINE = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs.js');

function scratchDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('node bin/cli.js with no args prints usage listing config, exit 1', () => {
  const result = spawnSync(process.execPath, [CLI], { cwd: REPO, encoding: 'utf8' });
  assert.strictEqual(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.match(result.stderr, /\bconfig\b/, 'usage text must list "config"');
});

test('config --list delegates to the prefs engine with identical output', () => {
  const dir = scratchDir('bootstrap-config-list-');
  try {
    const file = path.join(dir, 'prefs.json');
    fs.writeFileSync(file, '{}');
    const viaCli = spawnSync(process.execPath, [CLI, 'config', '--list', '--target', file], {
      cwd: REPO,
      encoding: 'utf8',
    });
    const direct = spawnSync(process.execPath, [ENGINE, '--list', '--target', file], {
      cwd: REPO,
      encoding: 'utf8',
    });
    assert.strictEqual(direct.status, 0, `engine exit ${direct.status}: ${direct.stderr}`);
    assert.strictEqual(viaCli.status, 0, `cli exit ${viaCli.status}: ${viaCli.stderr}`);
    assert.ok(viaCli.stdout.length > 0, 'expected non-empty --list output');
    assert.strictEqual(viaCli.stdout, direct.stdout, 'cli stdout must match engine stdout');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('config --set refuses invalid writes and leaves the global prefs file uncreated', () => {
  const home = scratchDir('bootstrap-config-home-');
  try {
    const prefsFile = path.join(home, '.claude', 'bootstrap-prefs.json');
    const env = { ...process.env, HOME: home, USERPROFILE: home };

    const unsettable = spawnSync(
      process.execPath,
      [CLI, 'config', '--set', 'some.key', '--value', 'unset', '--global'],
      { cwd: REPO, encoding: 'utf8', env }
    );
    assert.notStrictEqual(unsettable.status, 0, 'expected a non-zero exit for value "unset"');
    assert.strictEqual(unsettable.status, 1, `expected exit code 1, got ${unsettable.status}`);
    assert.match(unsettable.stderr, /is not a storable value/);
    assert.ok(!fs.existsSync(prefsFile), 'global prefs file must not be created on refusal');

    // mcp.serena is scope: project in the schema, so the global layer must refuse it.
    const wrongScope = spawnSync(
      process.execPath,
      [CLI, 'config', '--set', 'mcp.serena', '--value', 'true', '--global'],
      { cwd: REPO, encoding: 'utf8', env }
    );
    assert.strictEqual(wrongScope.status, 1, `expected exit code 1, got ${wrongScope.status}`);
    assert.match(wrongScope.stderr, /is scope:/);
    assert.ok(!fs.existsSync(prefsFile), 'global prefs file must not be created on scope refusal');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('config with no operation flag routes to the TUI, not the scripting engine', () => {
  const home = scratchDir('bootstrap-config-tui-home-');
  const cwd = scratchDir('bootstrap-config-tui-cwd-');
  try {
    fs.mkdirSync(path.join(cwd, '.git'));
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    const result = spawnSync(process.execPath, [CLI, 'config'], {
      cwd,
      encoding: 'utf8',
      env,
      input: '',
      timeout: 15000,
    });
    assert.ok(!result.error, `spawn error (likely timeout): ${result.error && result.error.message}`);
    assert.strictEqual(typeof result.status, 'number', `expected a numeric exit status, signal=${result.signal}`);
    assert.doesNotMatch(
      result.stderr,
      /one of --get, --set, --unset, --list/,
      'no-args config must reach the TUI, not the engine usage error'
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('config propagates the routed script exit code unchanged', () => {
  const engineUsage = spawnSync(process.execPath, [CLI, 'config', '--get'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.strictEqual(engineUsage.status, 1, `engine usage error must exit 1, got ${engineUsage.status}`);
  assert.match(engineUsage.stderr, /--get requires an argument/);

  const tuiUnknown = spawnSync(process.execPath, [CLI, 'config', '--bogus'], {
    cwd: REPO,
    encoding: 'utf8',
    input: '',
    timeout: 15000,
  });
  assert.strictEqual(tuiUnknown.status, 2, `TUI unknown-argument error must exit 2, got ${tuiUnknown.status}`);
  assert.match(tuiUnknown.stderr, /unknown argument: --bogus/);
});
