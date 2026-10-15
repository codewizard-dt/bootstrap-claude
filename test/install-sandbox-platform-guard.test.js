// Repeatable checks for the platform guard inside install-global.sh step 7b
// (TASK-0107): native Windows shells are skipped with a note and record nothing;
// Linux without bubblewrap/socat only warns. Zero-dependency: node:test + node:assert.
//
// Run: npm test   (or: node --test test/install-sandbox-platform-guard.test.js)
//
// HERMETIC. Scratch HOME, `--skip-mcps`, scratch cwd; the real ~/.claude is never
// touched. The platform is faked with a `uname` shim placed first on PATH that
// answers `uname -s` and delegates every other invocation to the real binary.
// Sibling file test/install-sandbox-prompt.test.js documents the
// BOOTSTRAP_ASSUME_TTY seam and why step 7's seven keys are pre-seeded.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const INSTALL_GLOBAL = path.join(REPO, 'lib', 'scripts', 'install-global.sh');
const PREFS_JS = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs.js');

const SKILL_PREFS = {
  'gitCommit.versionBump': 'never',
  'gitCommit.autoPush': 'false',
  'gitCommit.lint': 'false',
  'research.persistToRaw': 'false',
  'research.autoIngest': 'false',
  'uatGenerate.promoteTests': 'never',
  'gitignore.offerSectionUpdates': 'false',
};

const QUESTION = "Enable Claude Code's sandbox in ~/.claude/settings.json?";

function which(cmd) {
  return spawnSync('bash', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).status === 0;
}

function withFakePlatform(unameS, body) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'install-sandbox-guard-')));
  try {
    const shimDir = path.join(home, 'shim');
    fs.mkdirSync(shimDir);
    const realUname = spawnSync('bash', ['-c', 'command -v uname'], { encoding: 'utf8' }).stdout.trim();
    fs.writeFileSync(
      path.join(shimDir, 'uname'),
      `#!/bin/sh\nif [ "$1" = "-s" ] && [ "$#" -eq 1 ]; then echo '${unameS}'; else exec '${realUname}' "$@"; fi\n`,
      { mode: 0o755 }
    );
    const env = { HOME: home, PATH: `${shimDir}:${process.env.PATH}` };
    for (const k of ['TMPDIR', 'LANG', 'LC_ALL']) {
      if (process.env[k] !== undefined) env[k] = process.env[k];
    }
    for (const [key, value] of Object.entries(SKILL_PREFS)) {
      const r = spawnSync('node', [PREFS_JS, '--set', key, '--value', value, '--global'], { encoding: 'utf8', env });
      assert.strictEqual(r.status, 0, `could not seed ${key}: ${r.stderr}`);
    }
    const r = spawnSync('bash', [INSTALL_GLOBAL, '--skip-mcps'], {
      encoding: 'utf8',
      env: { ...env, BOOTSTRAP_ASSUME_TTY: '1' },
      cwd: home,
      input: 'y\n',
    });
    const settingsFile = path.join(home, '.claude', 'settings.json');
    const prefsFile = path.join(home, '.claude', 'bootstrap-prefs.json');
    return body({
      r,
      settings: fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {},
      prefs: JSON.parse(fs.readFileSync(prefsFile, 'utf8')),
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('native Windows shell: answering yes is skipped with a note, writes no sandbox key, records nothing', () => {
  withFakePlatform('MINGW64_NT-10.0', ({ r, settings, prefs }) => {
    assert.strictEqual(r.status, 0, `install failed:\n${r.stdout}\n${r.stderr}`);
    assert.ok(r.stdout.includes(QUESTION), `the question was not asked:\n${r.stdout}`);
    assert.match(r.stdout, /not supported on native Windows \(use WSL2\)/);
    assert.ok(!('sandbox' in settings), 'a sandbox key was written on native Windows');
    assert.ok(!('sandbox.scaffold' in prefs), 'sandbox.scaffold was recorded although nothing was configured');
    assert.ok(!/\+ sandbox\)/.test(r.stdout), 'the summary claims sandbox although the platform skipped it');
  });
});

// The suite forbids skipped tests, so this branches on what the machine has
// instead: the real bwrap/socat presence decides which side of the guard the
// faked-Linux run exercises, and both sides assert something.
test('Linux: warns on stderr only when bwrap/socat are missing, and always still merges the block and records true', () => {
  const bothInstalled = which('bwrap') && which('socat');
  withFakePlatform('Linux', ({ r, settings, prefs }) => {
    assert.strictEqual(r.status, 0, `install failed:\n${r.stdout}\n${r.stderr}`);
    if (bothInstalled) {
      assert.doesNotMatch(r.stderr, /needs bubblewrap and socat/, 'warned although bwrap and socat are installed');
    } else {
      assert.match(r.stderr, /needs bubblewrap and socat/);
    }
    assert.ok('sandbox' in settings && settings.sandbox.enabled === true, 'the warning blocked the merge');
    assert.strictEqual(prefs['sandbox.scaffold'], true);
  });
});
