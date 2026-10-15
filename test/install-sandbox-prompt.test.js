// Repeatable checks for install-global.sh step 7b — the sandbox opt-in
// question (TASK-0107, key sandbox.scaffold).
// Zero-dependency: node:test + node:assert only.
//
// Run: npm test   (or: node --test test/install-sandbox-prompt.test.js)
//
// HERMETIC. Every install-global.sh run here uses a scratch HOME under
// os.tmpdir(), `--skip-mcps` (so nothing reaches the network), and a scratch
// cwd. The developer's real ~/.claude is never read or written: HOME is
// redirected for the script AND for the node helpers it spawns, and
// assertScratchHome() refuses to run a single test if the redirect did not take.
//
// The seam: BOOTSTRAP_ASSUME_TTY=1 makes lib.sh's has_tty true although
// spawnSync hands the child a pipe; answers are then read from that piped
// stdin. The step-7 skill-preference batch runs BEFORE step 7b and would
// swallow stdin lines, so every interactive test pre-seeds those seven keys
// in the scratch store and feeds only the sandbox answer. The non-interactive
// test seeds nothing, because its point is that no store file appears at all.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const INSTALL_GLOBAL = path.join(REPO, 'lib', 'scripts', 'install-global.sh');
const PREFS_JS = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs.js');
const TEMPLATE = path.join(REPO, 'lib', 'scripts', 'templates', 'settings-sandbox.json');
const SCHEMA = path.join(REPO, 'lib', 'scripts', 'templates', 'bootstrap-prefs-schema.json');

// Step 7's seven keys, each with a value that settles it. Seeded so the batch
// asks nothing and stdin reaches step 7b untouched.
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

function scratchHome() {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'install-sandbox-')));
  if (/\s/.test(home)) {
    throw new Error(`scratch path contains whitespace: ${home} — lib.sh word-splits selectors`);
  }
  return home;
}

// Curated env: only HOME and PATH (plus locale/tmp when present). Inheriting
// process.env would carry BOOTSTRAP_ASSUME_TTY or the real HOME by accident.
function curatedEnv(home) {
  const env = { HOME: home, PATH: process.env.PATH };
  for (const k of ['TMPDIR', 'LANG', 'LC_ALL']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  return env;
}

const prefsPath = (home) => path.join(home, '.claude', 'bootstrap-prefs.json');
const settingsPath = (home) => path.join(home, '.claude', 'settings.json');

function readPrefs(home) {
  const f = prefsPath(home);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

function readSettings(home) {
  const f = settingsPath(home);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
}

// Refuse to run against anything that is not the scratch dir. The prefs helper
// prints the global values-file path it resolved; it must live under `home`.
function assertScratchHome(home, env) {
  assert.ok(home.startsWith(fs.realpathSync(os.tmpdir())), `scratch HOME is not under tmpdir: ${home}`);
  // --global alone omits the path; the two-layer trailer only prints with
  // --project, so pass the scratch HOME itself as the (read-only) project.
  const r = spawnSync('node', [PREFS_JS, '--list', '--project', home], { encoding: 'utf8', env });
  assert.strictEqual(r.status, 0, `redirect probe failed: ${r.stderr}`);
  assert.ok(
    r.stdout.includes(prefsPath(home)),
    `refusing to run: the HOME redirect did not resolve to the scratch store:\n${r.stdout}`
  );
  assert.ok(!fs.existsSync(prefsPath(home)), 'the read-only probe created a prefs file');
}

function seedSkillPrefs(home, env) {
  for (const [key, value] of Object.entries(SKILL_PREFS)) {
    const r = spawnSync('node', [PREFS_JS, '--set', key, '--value', value, '--global'], {
      encoding: 'utf8',
      env,
    });
    assert.strictEqual(r.status, 0, `could not seed ${key}=${value}: ${r.stderr}`);
  }
}

function withScratch({ seed = true } = {}, body) {
  const home = scratchHome();
  const env = curatedEnv(home);
  try {
    assertScratchHome(home, env);
    if (seed) seedSkillPrefs(home, env);
    return body({ home, env });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

// cwd is the scratch HOME, never the repo, so nothing relative can land in this
// checkout. `input` is required so a test always states what stdin holds.
function run({ home, env }, { input, tty = true }) {
  assert.strictEqual(typeof input, 'string', 'run() requires an explicit stdin string');
  const childEnv = { ...env };
  if (tty) childEnv.BOOTSTRAP_ASSUME_TTY = '1';
  else delete childEnv.BOOTSTRAP_ASSUME_TTY;
  const r = spawnSync('bash', [INSTALL_GLOBAL, '--skip-mcps'], {
    encoding: 'utf8',
    env: childEnv,
    cwd: home,
    input,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function assertOk(r, label) {
  assert.strictEqual(r.status, 0, `${label} failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
}

test('non-interactive run asks nothing, writes no sandbox key and no prefs file', () => {
  withScratch({ seed: false }, (S) => {
    const r = run(S, { input: 'y\ny\ny\ny\ny\ny\ny\ny\n', tty: false });
    assertOk(r, 'non-tty run');
    assert.ok(
      r.stdout.includes('Non-interactive terminal: skipping the sandbox question.'),
      `the non-interactive note is missing:\n${r.stdout}`
    );
    assert.ok(!r.stdout.includes(QUESTION), 'the question was printed without a tty');
    assert.ok(!('sandbox' in readSettings(S.home)), 'a sandbox key was written without a tty');
    assert.strictEqual(readPrefs(S.home), null, 'a prefs file was created by an unattended run');
  });
});

test('answering no stores sandbox.scaffold=false and writes no sandbox key', () => {
  withScratch({}, (S) => {
    const r = run(S, { input: 'n\n' });
    assertOk(r, 'no run');
    assert.ok(r.stdout.includes(QUESTION), `the question was not asked:\n${r.stdout}`);
    assert.ok(r.stdout.includes('sandbox.scaffold = false'), `no confirmation line:\n${r.stdout}`);
    assert.strictEqual(readPrefs(S.home)['sandbox.scaffold'], false);
    assert.ok(!('sandbox' in readSettings(S.home)), 'a "no" answer still wrote a sandbox key');
  });
});

test('answering skip stores nothing, leaves settings alone, and the question recurs', () => {
  withScratch({}, (S) => {
    const r1 = run(S, { input: 's\n' });
    assertOk(r1, 'skip run');
    assert.ok(r1.stdout.includes(QUESTION), 'the question was not asked on run 1');
    assert.match(r1.stdout, /sandbox\.scaffold left unanswered/);
    assert.ok(!('sandbox.scaffold' in readPrefs(S.home)), 'skip recorded an answer');
    assert.ok(!('sandbox' in readSettings(S.home)), 'skip wrote a sandbox key');

    // Run 2 must ask again; answer no so the recurrence is observable as a write.
    const r2 = run(S, { input: 'n\n' });
    assertOk(r2, 'second run');
    assert.ok(r2.stdout.includes(QUESTION), `the skipped question did not recur:\n${r2.stdout}`);
    assert.strictEqual(readPrefs(S.home)['sandbox.scaffold'], false);
  });
});

test('answering yes merges the template into settings.json and stores true', () => {
  withScratch({}, (S) => {
    const r = run(S, { input: 'y\n' });
    assertOk(r, 'yes run');
    const template = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
    assert.deepStrictEqual(readSettings(S.home).sandbox, template, 'settings.json sandbox differs from the template');
    assert.strictEqual(readPrefs(S.home)['sandbox.scaffold'], true);
    assert.ok(r.stdout.includes('"sandbox" set'), `the merge outcome line is missing:\n${r.stdout}`);
    assert.ok(r.stdout.includes('sandbox.scaffold = true'));
    assert.ok(
      r.stdout.includes('Restart Claude Code sessions to pick up the sandbox.'),
      `the restart reminder is missing after a fresh merge:\n${r.stdout}`
    );
    assert.match(r.stdout, /Global setup complete \(.*\+ sandbox\)\./, 'the summary does not claim sandbox');
  });
});

test('a pre-existing different sandbox value is preserved and reported, yet true is recorded', () => {
  withScratch({}, (S) => {
    fs.mkdirSync(path.join(S.home, '.claude'), { recursive: true });
    const existing = { sandbox: { enabled: false, excludedCommands: ['mine *'] } };
    fs.writeFileSync(settingsPath(S.home), JSON.stringify(existing, null, 2) + '\n');

    const r = run(S, { input: 'y\n' });
    assertOk(r, 'pre-existing run');
    assert.deepStrictEqual(readSettings(S.home).sandbox, existing.sandbox, 'the user\'s sandbox value was overwritten');
    assert.match(r.stdout + r.stderr, /already defines "sandbox"/);
    assert.strictEqual(readPrefs(S.home)['sandbox.scaffold'], true);
    assert.ok(
      !r.stdout.includes('Restart Claude Code sessions to pick up the sandbox.'),
      'the restart reminder was printed although nothing changed'
    );
  });
});

test('an already-stored answer is never re-asked', () => {
  withScratch({}, (S) => {
    const seed = spawnSync('node', [PREFS_JS, '--set', 'sandbox.scaffold', '--value', 'false', '--global'], {
      encoding: 'utf8',
      env: S.env,
    });
    assert.strictEqual(seed.status, 0, `could not seed sandbox.scaffold: ${seed.stderr}`);

    // POISON: a `y` on stdin would enable the sandbox if the question fired.
    const r = run(S, { input: 'y\ny\ny\n' });
    assertOk(r, 'stored-answer run');
    assert.ok(!r.stdout.includes(QUESTION), `a settled question was re-asked:\n${r.stdout}`);
    assert.ok(r.stdout.includes('Already answered'));
    assert.strictEqual(readPrefs(S.home)['sandbox.scaffold'], false, 'the stored answer changed');
    assert.ok(!('sandbox' in readSettings(S.home)), 'a settled "no" still wrote a sandbox key');
  });
});

test('settings-sandbox.json is minimal: enabled + docker excludedCommands, no policy blocks', () => {
  const template = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  assert.ok('enabled' in template, 'template is missing `enabled`');
  assert.strictEqual(template.enabled, true);
  assert.ok(Array.isArray(template.excludedCommands), 'excludedCommands is not an array');
  assert.ok(template.excludedCommands.includes('docker *'), 'docker * is not excluded');
  assert.ok(template.excludedCommands.includes('docker-compose *'), 'docker-compose * is not excluded');
  for (const policy of ['filesystem', 'network', 'credentials']) {
    assert.ok(!(policy in template), `template must not impose a ${policy} policy`);
  }
});

test('schema: sandbox.scaffold is asked by install-global.sh and has no non-null default', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
  const entry = schema['sandbox.scaffold'];
  assert.ok(entry, 'sandbox.scaffold is missing from the prefs schema');
  assert.strictEqual(entry.askedBy, 'install-global.sh');
  assert.ok(
    entry.default === null || entry.default === undefined,
    `a default would make the question look answered: ${JSON.stringify(entry.default)}`
  );
});
