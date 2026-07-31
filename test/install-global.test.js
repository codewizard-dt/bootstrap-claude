#!/usr/bin/env node
// Repeatable checks for lib/scripts/install-global.sh (TASK-035).
// Zero-dependency: node:test + node:assert only, matching test/run-project-sync.test.js.
//
// Run: npm test   (or: node --test test/install-global.test.js)
//
// TASK-035 reordered install-global.sh so all local/offline-safe steps run
// first (hooks rsync -> skills rsync -> deny merge -> hooks-wiring merge ->
// fileSuggestion merge) and the network-dependent MCP install runs LAST,
// guarded so a failure warns instead of aborting under `set -euo pipefail`.
// It also closed the silent-skip hole for a missing lib/hooks directory
// (stderr warning, script continues) and wired in merge-settings-hooks.js.
//
// Everything here runs the REAL install-global.sh, merge-settings-deny.js,
// and merge-settings-hooks.js from a scratch copy of the template tree, with
// a stubbed install-mcps.sh (marker + configurable exit code) and a scratch
// HOME. The real install-mcps.sh is NEVER executed and the real $HOME is
// never touched.
//
// Companion to UAT-035, which holds the live walkthrough of the same
// scenarios against the in-repo script.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const REAL_SCRIPTS = path.join(REPO, 'lib', 'scripts');

// The six step banners install-global.sh prints, in the order TASK-035
// mandates: local/offline-safe steps 1-5 first, MCPs last.
const STEP_BANNERS = [
  'Installing hooks globally (~/.claude/hooks/)...',
  'Installing skills globally (~/.claude/skills/)...',
  'Merging permissions deny list (~/.claude/settings.json)...',
  'Merging hooks wiring (~/.claude/settings.json)...',
  'Installing file suggestion picker (~/.claude/file-suggestion.sh)...',
  'Checking global MCP servers (user scope)...',
];

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'install-global-'));
}

/**
 * Build a scratch template tree containing the REAL install-global.sh and its
 * real merge scripts + templates, a minimal lib/hooks and lib/skills payload,
 * and a stub install-mcps.sh that logs a marker to <dir>/mcps.log and exits
 * with `mcpsExit` (default 0). Set `withHooks: false` to omit lib/hooks and
 * exercise the missing-directory warning path.
 */
function buildTemplate({ mcpsExit = 0, withHooks = true } = {}) {
  const dir = scratchDir();
  const scripts = path.join(dir, 'lib', 'scripts');
  fs.mkdirSync(path.join(scripts, 'templates'), { recursive: true });

  for (const f of ['install-global.sh', 'merge-settings-deny.js', 'merge-settings-hooks.js']) {
    fs.copyFileSync(path.join(REAL_SCRIPTS, f), path.join(scripts, f));
  }
  for (const f of ['settings-deny.json', 'settings-hooks.json', 'file-suggestion.sh']) {
    fs.copyFileSync(
      path.join(REAL_SCRIPTS, 'templates', f),
      path.join(scripts, 'templates', f)
    );
  }
  fs.chmodSync(path.join(scripts, 'install-global.sh'), 0o755);

  const stub = [
    '#!/usr/bin/env bash',
    `echo "install-mcps.sh" >> "${dir}/mcps.log"`,
    mcpsExit === 0 ? 'exit 0' : `echo "stub install-mcps.sh failing" >&2; exit ${mcpsExit}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(scripts, 'install-mcps.sh'), stub);
  fs.chmodSync(path.join(scripts, 'install-mcps.sh'), 0o755);

  if (withHooks) {
    const hooks = path.join(dir, 'lib', 'hooks');
    fs.mkdirSync(hooks, { recursive: true });
    fs.writeFileSync(path.join(hooks, 'dummy-hook.js'), '// test fixture hook\n');
  }

  const skill = path.join(dir, 'lib', 'skills', 'dummy-skill');
  fs.mkdirSync(skill, { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), '# dummy skill fixture\n');

  return dir;
}

function runInstall(templateDir, homeDir, args = []) {
  const r = spawnSync(
    'bash',
    [path.join(templateDir, 'lib', 'scripts', 'install-global.sh'), ...args],
    { encoding: 'utf8', env: { ...process.env, HOME: homeDir } }
  );
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function readSettings(homeDir) {
  return JSON.parse(fs.readFileSync(path.join(homeDir, '.claude', 'settings.json'), 'utf8'));
}

function cleanup(...dirs) {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
}

// --- step order: local steps first, MCPs last ----------------------------------

test('fresh run executes all six steps in the TASK-035 order, MCPs last', () => {
  const tpl = buildTemplate();
  const home = scratchDir();

  const res = runInstall(tpl, home);

  assert.strictEqual(res.status, 0, `install-global.sh did not exit 0: ${res.stderr}`);
  const positions = STEP_BANNERS.map((b) => res.stdout.indexOf(b));
  positions.forEach((p, i) => {
    assert.ok(p !== -1, `step banner missing from output: ${STEP_BANNERS[i]}`);
  });
  for (let i = 1; i < positions.length; i++) {
    assert.ok(
      positions[i] > positions[i - 1],
      `step out of order: "${STEP_BANNERS[i]}" appeared before "${STEP_BANNERS[i - 1]}"`
    );
  }
  assert.ok(
    fs.existsSync(path.join(tpl, 'mcps.log')),
    'stub install-mcps.sh was never invoked'
  );
  assert.ok(
    res.stdout.includes(
      'Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + MCPs).'
    ),
    'final summary line missing or stale'
  );

  cleanup(tpl, home);
});

test('fresh run merges deny list, hooks wiring, and fileSuggestion into settings.json', () => {
  const tpl = buildTemplate();
  const home = scratchDir();

  const res = runInstall(tpl, home);
  assert.strictEqual(res.status, 0, res.stderr);

  const settings = readSettings(home);
  assert.ok(
    Array.isArray(settings.permissions?.deny) && settings.permissions.deny.length > 0,
    'permissions.deny missing or empty after fresh install'
  );
  assert.ok(
    settings.hooks && Object.keys(settings.hooks).length > 0,
    'hooks wiring key missing after fresh install'
  );
  assert.deepStrictEqual(
    settings.fileSuggestion,
    { type: 'command', command: '~/.claude/file-suggestion.sh' },
    'fileSuggestion key missing or wrong after fresh install'
  );
  assert.ok(
    fs.existsSync(path.join(home, '.claude', 'hooks', 'dummy-hook.js')),
    'hook scripts were not rsynced into HOME/.claude/hooks'
  );
  assert.ok(
    fs.existsSync(path.join(home, '.claude', 'skills', 'dummy-skill', 'SKILL.md')),
    'skills were not rsynced into HOME/.claude/skills'
  );
  assert.ok(
    fs.existsSync(path.join(home, '.claude', 'file-suggestion.sh')),
    'file-suggestion.sh was not copied into HOME/.claude'
  );
  assert.ok(
    res.stdout.includes('hooks wiring: created'),
    'fresh hooks-wiring merge did not report "hooks wiring: created"'
  );
  assert.ok(
    res.stdout.includes('Restart Claude Code sessions to activate hook changes.'),
    'restart reminder missing after fresh hooks-wiring merge'
  );

  cleanup(tpl, home);
});

// --- missing lib/hooks: warn on stderr, continue --------------------------------

test('missing lib/hooks warns on stderr and the script still completes', () => {
  const tpl = buildTemplate({ withHooks: false });
  const home = scratchDir();

  const res = runInstall(tpl, home, ['--skip-mcps']);

  assert.strictEqual(res.status, 0, `missing lib/hooks aborted the script: ${res.stderr}`);
  assert.ok(
    res.stderr.includes(`Warning: ${tpl}/lib/hooks not found — hook scripts NOT installed`),
    `expected missing-hooks warning on stderr, got: ${res.stderr}`
  );
  assert.ok(
    res.stdout.includes('Installing skills globally (~/.claude/skills/)...'),
    'skills step did not run after the missing-hooks warning'
  );
  assert.ok(
    fs.existsSync(path.join(home, '.claude', 'settings.json')),
    'settings.json was not created after the missing-hooks warning'
  );
  assert.ok(
    !fs.existsSync(path.join(home, '.claude', 'hooks')),
    'HOME/.claude/hooks should not exist when the template has no lib/hooks'
  );

  cleanup(tpl, home);
});

// --- MCP failure: warn, do not abort, local installs intact ---------------------

test('a failing install-mcps.sh warns but the script still exits 0 with local installs done', () => {
  const tpl = buildTemplate({ mcpsExit: 1 });
  const home = scratchDir();

  const res = runInstall(tpl, home);

  assert.strictEqual(
    res.status,
    0,
    `a guarded MCP failure aborted install-global.sh under set -euo pipefail: ${res.stderr}`
  );
  assert.ok(
    res.stderr.includes(
      "Warning: MCP install failed — hooks, skills, and settings were installed; re-run 'bootstrap install' to retry MCPs."
    ),
    `expected MCP-failure warning missing from stderr: ${res.stderr}`
  );
  assert.ok(
    fs.existsSync(path.join(tpl, 'mcps.log')),
    'the failing stub install-mcps.sh was never invoked'
  );
  const settings = readSettings(home);
  assert.ok(settings.permissions?.deny?.length > 0, 'deny list missing despite MCP failure');
  assert.ok(settings.hooks, 'hooks wiring missing despite MCP failure');
  assert.ok(settings.fileSuggestion, 'fileSuggestion missing despite MCP failure');
  assert.ok(
    fs.existsSync(path.join(home, '.claude', 'hooks', 'dummy-hook.js')),
    'hook scripts missing despite MCP failure'
  );
  assert.ok(
    res.stdout.includes(
      'Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + MCPs).'
    ),
    'final summary missing after guarded MCP failure'
  );

  cleanup(tpl, home);
});

// --- --skip-mcps still fully skips the MCP step ---------------------------------

test('--skip-mcps skips the MCP step entirely', () => {
  const tpl = buildTemplate();
  const home = scratchDir();

  const res = runInstall(tpl, home, ['--skip-mcps']);

  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(
    !res.stdout.includes('Checking global MCP servers'),
    'MCP banner printed despite --skip-mcps'
  );
  assert.ok(
    !fs.existsSync(path.join(tpl, 'mcps.log')),
    'install-mcps.sh ran despite --skip-mcps'
  );

  cleanup(tpl, home);
});

// --- idempotency ----------------------------------------------------------------

test('a second run is a no-op: "already up to date" messages, identical settings.json, no restart nudges', () => {
  const tpl = buildTemplate();
  const home = scratchDir();

  const first = runInstall(tpl, home, ['--skip-mcps']);
  assert.strictEqual(first.status, 0, first.stderr);
  const settingsPath = path.join(home, '.claude', 'settings.json');
  const afterFirst = fs.readFileSync(settingsPath, 'utf8');

  const second = runInstall(tpl, home, ['--skip-mcps']);
  assert.strictEqual(second.status, 0, `second run failed: ${second.stderr}`);
  assert.ok(
    second.stdout.includes('settings.json: deny list already up to date'),
    'second run did not report the deny list as up to date'
  );
  assert.ok(
    second.stdout.includes('hooks wiring already up to date'),
    'second run did not report hooks wiring as up to date'
  );
  assert.ok(
    second.stdout.includes('settings.json: "fileSuggestion" already set'),
    'second run did not report fileSuggestion as already set'
  );
  assert.ok(
    !second.stdout.includes('Restart Claude Code sessions'),
    'second run printed a restart reminder despite no changes'
  );
  const afterSecond = fs.readFileSync(settingsPath, 'utf8');
  assert.strictEqual(afterSecond, afterFirst, 'settings.json changed on an idempotent re-run');

  cleanup(tpl, home);
});

// --- restart reminder fires on the applied path, not just created ----------------

test('re-run after a perturbed hooks wiring reports the applied change and prints the restart reminder', () => {
  const tpl = buildTemplate();
  const home = scratchDir();

  const first = runInstall(tpl, home, ['--skip-mcps']);
  assert.strictEqual(first.status, 0, first.stderr);

  // Perturb the wiring: drop one owned hook block so the next merge has to
  // re-apply it ("hooks wiring: 1 change applied", not "created").
  const settingsPath = path.join(home, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const eventName = Object.keys(settings.hooks)[0];
  assert.ok(eventName, 'no hooks event found in settings.json to perturb');
  assert.ok(settings.hooks[eventName].length > 0, `hooks.${eventName} is empty; nothing to perturb`);
  settings.hooks[eventName].splice(0, 1);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  const second = runInstall(tpl, home, ['--skip-mcps']);
  assert.strictEqual(second.status, 0, `re-run after perturbation failed: ${second.stderr}`);
  assert.ok(
    !second.stdout.includes('hooks wiring: created'),
    'perturbed re-run took the "created" path instead of the applied path'
  );
  assert.ok(
    /hooks wiring: \d+ changes? applied/.test(second.stdout),
    `perturbed re-run did not report an applied change: ${second.stdout}`
  );
  assert.ok(
    second.stdout.includes('Restart Claude Code sessions to activate hook changes.'),
    'restart reminder missing after hooks-wiring changes were applied'
  );

  cleanup(tpl, home);
});
