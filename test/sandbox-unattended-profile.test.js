// Repeatable checks for the unattended-runs sandbox profile (TASK-031 step 3):
// lib/scripts/templates/settings-sandbox-unattended.json, and its delivery by
// install-global.sh step 6b.
// Zero-dependency: node:test + node:assert only.
//
// Run: npm test   (or: node --test test/sandbox-unattended-profile.test.js)
//
// The profile, the docs and the installer source are read as text. Where
// install-global.sh is actually RUN (the two "installer" tests at the end), it is
// hermetic: a scratch HOME under os.tmpdir(), `--skip-mcps`, a curated env, and a
// non-tty stdin, so the developer's real ~/.claude is never read or written.
// Whether a live sandboxed session actually blocks the script-file settings write
// is TASK-031 step 4 (UAT, manual), not this file.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const TEMPLATES = path.join(REPO, 'lib', 'scripts', 'templates');
const PROFILE = path.join(TEMPLATES, 'settings-sandbox-unattended.json');
const STARTER = path.join(TEMPLATES, 'settings-sandbox.json');
const INSTALL_GLOBAL = path.join(REPO, 'lib', 'scripts', 'install-global.sh');

const PROFILE_TEXT = fs.readFileSync(PROFILE, 'utf8');
const PROFILE_JSON = JSON.parse(PROFILE_TEXT);
const SANDBOX = PROFILE_JSON.sandbox;

// Keys that would either re-open the boundary or break this repo's bypass
// surface / hooks / deny list (TASK-031 step 2, TASK-0107 scope decisions).
const FORBIDDEN_KEYS = [
  'disableBypassPermissionsMode',
  'allowManagedPermissionRulesOnly',
  'allowManagedHooksOnly',
  'allowUnixSockets',
  'allowAllUnixSockets',
  'allowAppleEvents',
  'tlsTerminate',
];

test('profile is a wrapper-form settings file with a top-level sandbox object', () => {
  assert.deepStrictEqual(Object.keys(PROFILE_JSON), ['sandbox']);
  assert.strictEqual(typeof SANDBOX, 'object');
  assert.ok(SANDBOX !== null && !Array.isArray(SANDBOX));
});

test('profile fails closed: enabled, failIfUnavailable, no unsandboxed escape, strict allowlist', () => {
  assert.strictEqual(SANDBOX.enabled, true);
  assert.strictEqual(SANDBOX.failIfUnavailable, true);
  assert.strictEqual(SANDBOX.allowUnsandboxedCommands, false);
  assert.strictEqual(SANDBOX.network.strictAllowlist, true);
});

test('profile carries no excludedCommands (a matching compound command would run fully unsandboxed)', () => {
  if ('excludedCommands' in SANDBOX) {
    assert.ok(Array.isArray(SANDBOX.excludedCommands));
    assert.strictEqual(SANDBOX.excludedCommands.length, 0);
  }
  assert.ok(!/docker/i.test(PROFILE_TEXT), 'no docker exclusions or hosts in the unattended profile');
});

test('profile does not disable filesystem isolation', () => {
  assert.ok(!('disabled' in (SANDBOX.filesystem || {})));
});

test('profile contains none of the forbidden keys anywhere in its text', () => {
  for (const key of FORBIDDEN_KEYS) {
    assert.ok(!PROFILE_TEXT.includes(key), `${key} must not appear in the profile`);
  }
});

test('credentials.files entries all have a path and deny mode, and cover ~/.aws/credentials', () => {
  const files = SANDBOX.credentials.files;
  assert.ok(Array.isArray(files) && files.length > 0);
  for (const entry of files) {
    assert.strictEqual(typeof entry.path, 'string');
    assert.ok(entry.path.length > 0);
    assert.strictEqual(entry.mode, 'deny');
  }
  assert.ok(files.some((entry) => entry.path === '~/.aws/credentials'));
});

test('credentials.envVars entries are named deny-mode entries', () => {
  const envVars = SANDBOX.credentials.envVars;
  assert.ok(Array.isArray(envVars) && envVars.length > 0);
  for (const entry of envVars) {
    assert.strictEqual(typeof entry.name, 'string');
    assert.strictEqual(entry.mode, 'deny');
  }
});

test('every filesystem and credentials path is home-prefixed or absolute, never ./ or bare', () => {
  // In user-scope settings a bare or ./ path resolves under ~/.claude, not the
  // project, so a "protect ~/.ssh" entry written as ".ssh" would protect nothing.
  const fsBlock = SANDBOX.filesystem || {};
  const paths = [];
  for (const value of Object.values(fsBlock)) {
    if (Array.isArray(value)) paths.push(...value);
  }
  paths.push(...SANDBOX.credentials.files.map((entry) => entry.path));
  assert.ok(paths.length > 0);
  for (const p of paths) {
    assert.strictEqual(typeof p, 'string');
    assert.ok(!p.startsWith('./'), `${p} must not be ./-relative`);
    assert.ok(p.startsWith('~/') || p.startsWith('/'), `${p} must start with ~/ or /`);
  }
  assert.ok(SANDBOX.filesystem.denyRead.includes('~/.ssh'));
  assert.ok(SANDBOX.filesystem.denyRead.includes('~/.gnupg'));
});

test('install-global.sh copies the profile into ~/.claude/templates and never merges it into settings', () => {
  const src = fs.readFileSync(INSTALL_GLOBAL, 'utf8');
  assert.ok(src.includes('settings-sandbox-unattended.json'));
  assert.match(
    src,
    /cp\s+"[^"\n]*settings-sandbox-unattended\.json"\s+"\$HOME\/\.claude\/templates\/settings-sandbox-unattended\.json"/,
  );
  const setKeyLines = src.split('\n').filter((line) => line.includes('--set-key'));
  assert.ok(setKeyLines.length > 0, 'sanity: the installer still uses --set-key for other keys');
  for (const line of setKeyLines) {
    assert.ok(!line.includes('unattended'), `profile must not be passed to --set-key: ${line.trim()}`);
  }
});

test('the TASK-0107 starter settings-sandbox.json still exists and parses', () => {
  assert.ok(fs.existsSync(STARTER));
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(STARTER, 'utf8')));
});


test('no template and no installer step sets a managed-settings footgun key', () => {
  // These three keys would break this repo's own bypass surface, deny list, or
  // hooks (TASK-031 step 2). The README may NAME them as recorded footguns; no
  // shipped template or installer source may SET them.
  const forbidden = ['disableBypassPermissionsMode', 'allowManagedPermissionRulesOnly', 'allowManagedHooksOnly'];
  const jsonTemplates = fs.readdirSync(TEMPLATES).filter((f) => f.endsWith('.json'));
  assert.ok(jsonTemplates.includes('settings-sandbox-unattended.json'), 'sanity: scanning the templates dir');
  const sources = [
    ...jsonTemplates.map((f) => path.join(TEMPLATES, f)),
    INSTALL_GLOBAL,
    path.join(REPO, 'lib', 'scripts', 'merge-settings-deny.js'),
    path.join(REPO, 'lib', 'scripts', 'merge-settings-hooks.js'),
  ];
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    for (const key of forbidden) {
      assert.ok(!text.includes(key), `${path.relative(REPO, file)} references ${key}`);
    }
  }
});

test('the profile is published in the npm tarball (lib/ shipped, no negation touches lib/)', () => {
  const files = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).files;
  assert.ok(files.includes('lib/'));
  const negations = files.filter((f) => f.startsWith('!'));
  assert.ok(negations.length > 0, 'sanity: package.json still carries its raw/ negations');
  for (const pattern of negations) {
    assert.ok(!pattern.startsWith('!lib'), `${pattern} would exclude part of lib/`);
  }
});

const read = (...p) => fs.readFileSync(path.join(REPO, ...p), 'utf8');

test('lib/hooks/README.md has a Tier 3 section that states the sandbox limits plainly', () => {
  const readme = read('lib', 'hooks', 'README.md');
  const start = readme.indexOf('## Tier 3: sandbox');
  assert.ok(start !== -1, 'no "## Tier 3: sandbox" heading');
  const end = readme.indexOf('\n## ', start + 1);
  const section = readme.slice(start, end === -1 ? undefined : end);
  assert.match(section, /Bash and its child processes only/i);
  assert.match(section, /Credentials are readable by default/i);
  assert.match(section, /does not terminate TLS/i);
  assert.match(section, /native Windows and WSL1 are\s+unsupported/i);
  assert.match(section, /Not sufficient on its own for fully unattended runs/i);
  assert.match(section, /No `excludedCommands`/);
  assert.match(section, /must run outside the sandbox/i);
  assert.ok(section.includes('claude --settings ~/.claude/templates/settings-sandbox-unattended.json'));
});

test('the residual-risk sentences no longer call the sandbox a promissory note', () => {
  for (const [label, text] of [
    ['lib/hooks/claude-settings-guard.js', read('lib', 'hooks', 'claude-settings-guard.js')],
    ['lib/hooks/README.md', read('lib', 'hooks', 'README.md')],
    ['lib/scripts/README.md', read('lib', 'scripts', 'README.md')],
  ]) {
    assert.ok(!/only real containment/i.test(text), `${label} still says the sandbox is "the only real containment"`);
  }
  const guard = read('lib', 'hooks', 'claude-settings-guard.js');
  assert.ok(guard.includes('settings-sandbox-unattended.json'), 'guard header does not point at the shipped profile');
  assert.match(guard, /Tier 3/);
});

test('lib/scripts/README.md documents the unattended profile, its launcher, and the CLAUDE_CONFIG_DIR proof requirement', () => {
  const readme = read('lib', 'scripts', 'README.md');
  assert.match(readme, /## Unattended-run sandbox profile/);
  assert.ok(readme.includes('claude --settings ~/.claude/templates/settings-sandbox-unattended.json --dangerously-skip-permissions'));
  assert.match(readme, /copied, never merged/i);
  assert.ok(readme.includes('CLAUDE_CONFIG_DIR=<scratch>/.claude'));
});

test('CLAUDE.md mentions the unattended profile in the install bullet and the install-global.sh entry', () => {
  const claude = read('CLAUDE.md');
  const hits = claude.split('\n').filter((line) => line.includes('settings-sandbox-unattended.json'));
  assert.ok(hits.some((l) => l.includes('npx @codewizard-dt/bootstrap install')), 'Setup Workflow install bullet');
  assert.ok(hits.some((l) => l.startsWith('- `lib/scripts/install-global.sh`')), 'Key Files install-global.sh entry');
  assert.ok(hits.every((l) => /never merged|never merges|copies \(never merges\)/i.test(l)), 'a mention drops the never-merged caveat');
});

// --- installer (hermetic: scratch HOME, --skip-mcps, curated env, non-tty stdin) ---

function scratchHome() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-unattended-')));
}

function runInstaller(script, home, cwd) {
  assert.ok(home.startsWith(fs.realpathSync(os.tmpdir())), `scratch HOME is not under tmpdir: ${home}`);
  const env = { HOME: home, PATH: process.env.PATH };
  for (const k of ['TMPDIR', 'LANG', 'LC_ALL']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  return spawnSync('bash', [script, '--skip-mcps'], { encoding: 'utf8', env, cwd, input: '' });
}

test('installer: copies the profile byte-identical into the scratch ~/.claude/templates and writes no sandbox key', () => {
  const home = scratchHome();
  try {
    const r = runInstaller(INSTALL_GLOBAL, home, home);
    assert.strictEqual(r.status, 0, `install-global.sh exited ${r.status}\n${r.stderr}`);
    const installed = path.join(home, '.claude', 'templates', 'settings-sandbox-unattended.json');
    assert.ok(fs.existsSync(installed), 'profile was not copied into the scratch ~/.claude/templates');
    assert.strictEqual(fs.readFileSync(installed, 'utf8'), PROFILE_TEXT, 'installed copy differs from the shipped profile');
    assert.match(r.stdout, /claude --settings ~\/\.claude\/templates\/settings-sandbox-unattended\.json/);
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
    assert.ok(!('sandbox' in settings), 'a non-interactive run must not merge any sandbox key into settings.json');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('installer: a missing profile template only warns — the rest of the install still completes', () => {
  const home = scratchHome();
  const tree = fs.mkdtempSync(path.join(home, 'tree-'));
  try {
    fs.cpSync(path.join(REPO, 'lib'), path.join(tree, 'lib'), { recursive: true });
    fs.rmSync(path.join(tree, 'lib', 'scripts', 'templates', 'settings-sandbox-unattended.json'));
    const r = runInstaller(path.join(tree, 'lib', 'scripts', 'install-global.sh'), home, home);
    assert.strictEqual(r.status, 0, `a missing optional template aborted the install (exit ${r.status})\n${r.stderr}`);
    assert.match(r.stderr, /settings-sandbox-unattended\.json not found/);
    assert.ok(!fs.existsSync(path.join(home, '.claude', 'templates', 'settings-sandbox-unattended.json')));
    assert.ok(fs.existsSync(path.join(home, '.claude', 'settings.json')), 'later install steps did not run');
    assert.match(r.stdout, /Global setup complete/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
