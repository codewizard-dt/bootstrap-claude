#!/usr/bin/env node
// Repeatable checks for lib/scripts/install-obsidian.sh (TASK-053).
// Zero-dependency: node:test + node:assert only, matching test/run-project-sync.test.js
// and test/prompt-stickiness.test.js's spawnSync + curated-env + PATH-stub-bin harness.
//
// Run: npm test   (or: node --test test/install-obsidian.test.js)
//
// Scope: the STATIC/behavioral contract of the installer — flag parsing, guard
// structure (never aborts on a failed step), the non-interactive prefs-gating
// mirror of register_optional_mcp, OS-branch dispatch, plugin-fetch edge cases,
// and idempotency of the community-plugins.json merge. This intentionally does
// NOT re-run the real network-dependent happy path (real brew/flatpak install,
// real GitHub releases) — that was already exercised manually and recorded in
// TASK-058 (happy path) and TASK-059 (non-fatal-failure / declined-prompt
// paths). Every scenario here is chosen specifically because neither of those
// manual runs exercised it: no --project-dir, Linux/flatpak branches, malformed
// or partial GitHub release payloads, and running the installer twice in a row
// to prove the enable-in-vault merge is idempotent.
//
// One case (BUG-0011) intentionally asserts the CORRECT required behavior —
// manifest.json must land in the plugin directory — which is currently unmet.
// See wiki/work/bugs/BUG-0011-obsidian-plugin-manifest-not-copied.md.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const INSTALL_OBSIDIAN = path.join(REPO, 'lib', 'scripts', 'install-obsidian.sh');
const PREFS_JS = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs.js');
const NODE_DIR = path.dirname(process.execPath);

function scratchDir(prefix) {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function cleanup(...dirs) {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
}

function writeBin(binDir, name, script) {
  fs.mkdirSync(binDir, { recursive: true });
  const file = path.join(binDir, name);
  fs.writeFileSync(file, script);
  fs.chmodSync(file, 0o755);
  return file;
}

// PATH honoring TASK-059's own established "simulate tool absence" convention
// (its Notes literally use `PATH=/usr/bin:/bin`): the stub bin dir first, then
// just enough of the real system to find bash/coreutils/curl and the real
// node binary — deliberately excluding /opt/homebrew, /usr/local, and other
// brew/flatpak-managed dirs so an "absent" stub is genuinely unresolvable.
function minimalPath(stubBin) {
  return `${stubBin}:${NODE_DIR}:/usr/bin:/bin`;
}

function curatedEnv(home, stubBin) {
  const env = { HOME: home, PATH: minimalPath(stubBin) };
  for (const k of ['TMPDIR', 'LANG', 'LC_ALL']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  return env;
}

function prefsCli(args, env) {
  const r = spawnSync(process.execPath, [PREFS_JS, ...args], { encoding: 'utf8', env });
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function seedGlobalPref(env, key, value) {
  const res = prefsCli(['--set', key, '--value', String(value), '--global'], env);
  assert.equal(res.status, 0, `seed --set ${key}=${value} (global) failed: ${res.stderr}`);
}

function seedProjectPref(env, projectDir, key, value) {
  const res = prefsCli(['--set', key, '--value', String(value), '--project', projectDir], env);
  assert.equal(res.status, 0, `seed --set ${key}=${value} (project) failed: ${res.stderr}`);
}

function run(args, { env, input } = {}) {
  const r = spawnSync('bash', [INSTALL_OBSIDIAN, ...args], {
    encoding: 'utf8',
    env,
    ...(input === undefined ? {} : { input }),
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function communityPluginsPath(projectDir) {
  return path.join(projectDir, '.obsidian', 'community-plugins.json');
}

function readCommunityPlugins(projectDir) {
  const p = communityPluginsPath(projectDir);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function graphJsonPath(projectDir) {
  return path.join(projectDir, '.obsidian', 'graph.json');
}

// --- curl stub for the plugin-fetch tests --------------------------------------
//
// Real calls this stub must answer:
//   curl -fsSL https://api.github.com/repos/<owner>/<repo>/releases/latest -o <tmp>
//   curl -fsSL <asset browser_download_url from the release JSON> -o <tmp-or-real-path>
//
// We control every browser_download_url in the canned release JSON, so assets
// are addressed by an unambiguous "stub:<name>" marker in the URL rather than
// guessing real GitHub asset URL shapes.
const CURL_STUB = [
  '#!/usr/bin/env bash',
  'outfile=""',
  'url=""',
  'args=("$@")',
  'n=${#args[@]}',
  'for ((i=0;i<n;i++)); do',
  '  if [ "${args[$i]}" = "-o" ]; then outfile="${args[$((i+1))]}"; fi',
  'done',
  'for a in "${args[@]}"; do',
  '  case "$a" in',
  '    -*) continue ;;',
  '    "$outfile") continue ;;',
  '    *) url="$a"; break ;;',
  '  esac',
  'done',
  'case "$url" in',
  '  */releases/latest) cp "$STUB_RELEASE_JSON" "$outfile" ;;',
  '  *stub:manifest*) cp "$STUB_MANIFEST_FILE" "$outfile" ;;',
  '  *stub:main*) cp "$STUB_MAIN_FILE" "$outfile" ;;',
  '  *stub:styles*) cp "$STUB_STYLES_FILE" "$outfile" ;;',
  '  *) echo "curl stub: unrecognized url: $url" >&2; exit 1 ;;',
  'esac',
  '',
].join('\n');

function writeJson(dir, name, obj) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

/**
 * Build a scratch bin/ with the curl stub, plus a scratch "assets" dir holding
 * the canned release.json / manifest.json / main.js / styles.css this run
 * should serve. `assets` fields left undefined omit that asset from the
 * release JSON's `assets` array (so _gh_release_asset_url legitimately
 * returns empty for it, with no curl call ever made for that file).
 */
function pluginFetchEnv(home, { manifestId = 'stub-plugin', includeManifest = true, includeMain = true, includeStyles = true, manifestBody } = {}) {
  const scratch = scratchDir('install-obsidian-assets-');
  const binDir = path.join(scratch, 'bin');
  writeBin(binDir, 'curl', CURL_STUB);

  const assets = [];
  if (includeManifest) assets.push({ name: 'manifest.json', browser_download_url: 'https://stub.test/stub:manifest' });
  if (includeMain) assets.push({ name: 'main.js', browser_download_url: 'https://stub.test/stub:main' });
  if (includeStyles) assets.push({ name: 'styles.css', browser_download_url: 'https://stub.test/stub:styles' });

  const releaseFile = writeJson(scratch, 'release.json', { assets });
  const manifestFile = writeJson(
    scratch,
    'manifest.json',
    manifestBody !== undefined ? manifestBody : { id: manifestId, name: 'Stub Plugin', version: '1.0.0' }
  );
  const mainFile = path.join(scratch, 'main.js');
  fs.writeFileSync(mainFile, 'console.log("stub plugin");\n');
  const stylesFile = path.join(scratch, 'styles.css');
  fs.writeFileSync(stylesFile, 'body { color: red; }\n');

  const env = {
    ...curatedEnv(home, binDir),
    STUB_RELEASE_JSON: releaseFile,
    STUB_MANIFEST_FILE: manifestFile,
    STUB_MAIN_FILE: mainFile,
    STUB_STYLES_FILE: stylesFile,
  };
  return { env, scratch };
}

// =================================================================================
// Argument parsing / guard structure
// =================================================================================

test('install-obsidian.sh: no --project-dir given skips plugin install with a WARNING, exits 0', () => {
  const home = scratchDir('install-obsidian-home-');
  const binDir = path.join(scratchDir('install-obsidian-bin-'), 'bin');
  // App path is irrelevant to this case — avoid touching real brew/flatpak by
  // routing it through the harmless "unrecognized OS" fallback.
  writeBin(binDir, 'uname', ['#!/usr/bin/env bash', 'echo TestOS', ''].join('\n'));
  const env = curatedEnv(home, binDir);

  const res = run([], { env });

  assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
  assert.ok(
    res.stdout.includes('WARNING: no --project-dir given — skipping Obsidian plugin install.'),
    `missing the no-project-dir warning:\n${res.stdout}`
  );
  cleanup(home, path.dirname(binDir));
});

// =================================================================================
// Non-interactive prefs-gating mirror (register_optional_mcp contract)
// =================================================================================

test('install-obsidian.sh: non-interactive + stored obsidian.installApp=false skips app install and never calls uname', () => {
  const home = scratchDir('install-obsidian-home-');
  const binDir = path.join(scratchDir('install-obsidian-bin-'), 'bin');
  const log = path.join(binDir, 'uname.log');
  writeBin(binDir, 'uname', ['#!/usr/bin/env bash', `echo called >> ${JSON.stringify(log)}`, 'echo TestOS', ''].join('\n'));
  const env = curatedEnv(home, binDir);
  seedGlobalPref(env, 'obsidian.installApp', 'false');

  const res = run([], { env }); // no --project-dir: plugin gate short-circuits harmlessly too

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stdout.includes('obsidian.installApp: skipped (remembered decline — change with /bootstrap-config)'),
    `missing remembered-decline message:\n${res.stdout}`
  );
  assert.ok(!fs.existsSync(log), '_install_obsidian_app ran (called uname) despite a stored `false`');
  cleanup(home, path.dirname(binDir));
});

test('install-obsidian.sh: non-interactive + stored obsidian.plugins=false at the project selector skips plugin install and never calls curl', () => {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const binDir = path.join(scratchDir('install-obsidian-bin-'), 'bin');
  const log = path.join(binDir, 'curl.log');
  writeBin(binDir, 'curl', ['#!/usr/bin/env bash', `echo called >> ${JSON.stringify(log)}`, 'exit 1', ''].join('\n'));
  writeBin(binDir, 'uname', ['#!/usr/bin/env bash', 'echo TestOS', ''].join('\n'));
  const env = curatedEnv(home, binDir);
  seedGlobalPref(env, 'obsidian.installApp', 'false'); // keep the app half out of scope for this case
  seedProjectPref(env, projectDir, 'obsidian.plugins', 'false');
  // TASK-061: obsidian.graphDefaults defaults to proceeding when unset, and its
  // gate would otherwise create .obsidian/ (for graph.json) on its own — keep it
  // out of scope too so this test stays isolated to plugin-install behavior.
  seedProjectPref(env, projectDir, 'obsidian.graphDefaults', 'false');

  const res = run(['--project-dir', projectDir], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stdout.includes('obsidian.plugins: skipped (remembered decline — change with /bootstrap-config)'),
    `missing remembered-decline message:\n${res.stdout}`
  );
  assert.ok(!fs.existsSync(log), '_install_obsidian_plugin ran (called curl) despite a stored `false`');
  assert.ok(!fs.existsSync(path.join(projectDir, '.obsidian')), '.obsidian/ was created despite a declined plugin install');
  cleanup(home, projectDir, path.dirname(binDir));
});

test('install-obsidian.sh: non-interactive with NO stored preference proceeds with app install (unset does not divert, only an explicit false does)', () => {
  const home = scratchDir('install-obsidian-home-');
  const binDir = path.join(scratchDir('install-obsidian-bin-'), 'bin');
  writeBin(binDir, 'uname', ['#!/usr/bin/env bash', 'echo TestOS', ''].join('\n'));
  const env = curatedEnv(home, binDir); // nothing seeded — obsidian.installApp is unset

  const res = run([], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stdout.includes("Obsidian: no automated installer for 'TestOS' — install manually from https://obsidian.md/download"),
    `_install_obsidian_app was not invoked even though no preference was stored:\n${res.stdout}`
  );
  cleanup(home, path.dirname(binDir));
});

// =================================================================================
// App-install OS dispatch (Linux/flatpak branches — never exercised by the real
// macOS verification runs in TASK-058/TASK-059)
// =================================================================================

test('install-obsidian.sh: Linux + flatpak already listing Obsidian short-circuits and never calls `flatpak install`', () => {
  const home = scratchDir('install-obsidian-home-');
  const binDir = path.join(scratchDir('install-obsidian-bin-'), 'bin');
  const installLog = path.join(binDir, 'flatpak-install.log');
  writeBin(binDir, 'uname', ['#!/usr/bin/env bash', 'echo Linux', ''].join('\n'));
  writeBin(
    binDir,
    'flatpak',
    [
      '#!/usr/bin/env bash',
      'if [ "$1" = "list" ]; then echo "md.obsidian.Obsidian  Obsidian  stable"; exit 0; fi',
      `if [ "$1" = "install" ]; then echo called >> ${JSON.stringify(installLog)}; exit 0; fi`,
      'exit 1',
      '',
    ].join('\n')
  );
  const env = curatedEnv(home, binDir);

  const res = run([], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stdout.includes('Obsidian (flatpak) already installed — skipping.'),
    `missing the already-installed short-circuit message:\n${res.stdout}`
  );
  assert.ok(!fs.existsSync(installLog), '`flatpak install` was invoked despite the already-installed short-circuit');
  cleanup(home, path.dirname(binDir));
});

test('install-obsidian.sh: Linux + flatpak absent from PATH warns and continues rather than erroring', () => {
  const home = scratchDir('install-obsidian-home-');
  const binDir = path.join(scratchDir('install-obsidian-bin-'), 'bin');
  writeBin(binDir, 'uname', ['#!/usr/bin/env bash', 'echo Linux', ''].join('\n'));
  // Deliberately no `flatpak` stub, and minimalPath() excludes brew/flatpak-
  // managed dirs, so `command -v flatpak` genuinely fails here.
  const env = curatedEnv(home, binDir);

  const res = run([], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stdout.includes('WARNING: flatpak not found — install Obsidian manually from https://obsidian.md/download'),
    `missing the flatpak-absent warning:\n${res.stdout}`
  );
  cleanup(home, path.dirname(binDir));
});

// =================================================================================
// Plugin-fetch edge cases (malformed/partial GitHub release payloads — never
// exercised by the real runs, which always saw well-formed real releases)
// =================================================================================

function runPluginScenario(opts) {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const { env, scratch } = pluginFetchEnv(home, opts);
  seedGlobalPref(env, 'obsidian.installApp', 'false'); // keep app-install out of scope
  const res = run(['--project-dir', projectDir], { env });
  return { res, home, projectDir, scratch };
}

test('install-obsidian.sh: release with no manifest.json asset warns and skips the plugin (exit 0)', () => {
  const { res, home, projectDir, scratch } = runPluginScenario({ includeManifest: false });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stderr.includes('latest release has no manifest.json asset (or the release JSON was malformed) — skipping plugin.'),
    `missing the no-manifest warning on stderr:\n${res.stderr}`
  );
  assert.equal(readCommunityPlugins(projectDir), null, 'community-plugins.json should not exist — every plugin was skipped');
  cleanup(home, projectDir, scratch);
});

test("install-obsidian.sh: manifest.json missing its 'id' field warns and skips the plugin (exit 0)", () => {
  const { res, home, projectDir, scratch } = runPluginScenario({ manifestBody: { name: 'Stub Plugin', version: '1.0.0' } });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stderr.includes("manifest.json is missing/malformed its 'id' field — skipping plugin."),
    `missing the malformed-id warning on stderr:\n${res.stderr}`
  );
  assert.equal(readCommunityPlugins(projectDir), null);
  cleanup(home, projectDir, scratch);
});

test('install-obsidian.sh: release with no main.js asset warns and skips the plugin (exit 0)', () => {
  const { res, home, projectDir, scratch } = runPluginScenario({ includeMain: false });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stderr.includes('latest release has no main.js asset — skipping plugin.'),
    `missing the no-main.js warning on stderr:\n${res.stderr}`
  );
  assert.equal(readCommunityPlugins(projectDir), null);
  cleanup(home, projectDir, scratch);
});

test('install-obsidian.sh: release with no styles.css asset still installs successfully (styles.css is optional)', () => {
  const { res, home, projectDir, scratch } = runPluginScenario({ includeStyles: false });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(!/styles\.css/.test(res.stdout), `unexpected styles.css warning on an intentionally-optional asset:\n${res.stdout}`);
  const pluginDir = path.join(projectDir, '.obsidian', 'plugins', 'stub-plugin');
  assert.ok(fs.existsSync(path.join(pluginDir, 'main.js')), 'main.js was not installed');
  assert.ok(!fs.existsSync(path.join(pluginDir, 'styles.css')), 'styles.css should not exist — the release had none');
  assert.deepStrictEqual(readCommunityPlugins(projectDir), ['stub-plugin']);
  cleanup(home, projectDir, scratch);
});

// =================================================================================
// BUG-0011: manifest.json is required in the plugin directory for Obsidian to
// load the plugin, but _install_obsidian_plugin never copies it there. This
// case asserts the REQUIRED behavior (per Test Integrity: test the contract,
// not the bug) and is expected to FAIL until BUG-0011 is fixed.
// =================================================================================

test('install-obsidian.sh: BUG-0011 — a fully successful plugin install must leave manifest.json in the plugin directory', () => {
  const { res, home, projectDir, scratch } = runPluginScenario({});

  assert.equal(res.status, 0, res.stderr);
  const pluginDir = path.join(projectDir, '.obsidian', 'plugins', 'stub-plugin');
  assert.ok(
    fs.existsSync(path.join(pluginDir, 'manifest.json')),
    'manifest.json is missing from the plugin directory — see BUG-0011 ' +
      '(wiki/work/bugs/BUG-0011-obsidian-plugin-manifest-not-copied.md). ' +
      '_install_obsidian_plugin downloads manifest.json only to parse the id ' +
      'and never copies it into $plugin_dir, so Obsidian cannot load the plugin.'
  );
  cleanup(home, projectDir, scratch);
});

// =================================================================================
// Idempotency of the enable-in-vault community-plugins.json merge
// =================================================================================

test('install-obsidian.sh: running the installer twice enables the same id idempotently — no duplicates, "already enabled" the second time', () => {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const { env, scratch } = pluginFetchEnv(home, {});
  seedGlobalPref(env, 'obsidian.installApp', 'false');

  const first = run(['--project-dir', projectDir], { env });
  assert.equal(first.status, 0, first.stderr);
  assert.deepStrictEqual(readCommunityPlugins(projectDir), ['stub-plugin']);

  const second = run(['--project-dir', projectDir], { env });
  assert.equal(second.status, 0, second.stderr);
  assert.ok(
    second.stdout.includes(`stub-plugin: already enabled in ${communityPluginsPath(projectDir)}.`),
    `second run did not report the id as already enabled:\n${second.stdout}`
  );
  assert.deepStrictEqual(
    readCommunityPlugins(projectDir),
    ['stub-plugin'],
    'community-plugins.json gained a duplicate entry on the second run'
  );

  cleanup(home, projectDir, scratch);
});

test('install-obsidian.sh: a malformed (non-array) community-plugins.json warns and is left byte-for-byte unchanged', () => {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const { env, scratch } = pluginFetchEnv(home, {});
  seedGlobalPref(env, 'obsidian.installApp', 'false');

  const obsidianDir = path.join(projectDir, '.obsidian');
  fs.mkdirSync(obsidianDir, { recursive: true });
  const malformed = '{"not":"an array"}';
  fs.writeFileSync(communityPluginsPath(projectDir), malformed);

  const res = run(['--project-dir', projectDir], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    /is not a JSON array — skipping enable for stub-plugin\./.test(res.stderr),
    `missing the not-an-array warning on stderr:\n${res.stderr}`
  );
  assert.strictEqual(
    fs.readFileSync(communityPluginsPath(projectDir), 'utf8'),
    malformed,
    'the malformed file was rewritten instead of being left untouched'
  );

  cleanup(home, projectDir, scratch);
});

// =================================================================================
// TASK-059: the real INTERACTIVE decline flow (prompt_yn_sticky, as opposed to the
// non-interactive stored-`false` mirror covered above) and an actual install-
// command FAILURE (as opposed to a tool simply being absent from PATH, also
// covered above). TASK-059 exercised both by hand once — a real `--interactive`
// run with piped `n`/`n`, and a real `brew install --cask obsidian` failure with
// `brew` stripped from PATH — and recorded the findings in its Notes section;
// these two cases make both claims mechanically repeatable. See UAT-059.
// =================================================================================

test('install-obsidian.sh --interactive: declining all three prompts leaves .obsidian/ untouched and never installs', () => {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const binDir = path.join(scratchDir('install-obsidian-bin-'), 'bin');
  // BOOTSTRAP_ASSUME_TTY=1 + piped `n\nn\nn\n` is the repo's established
  // non-interactive simulation of an interactive decline
  // (test/prompt-stickiness.test.js), applied here so the real
  // prompt_yn_sticky path is what's under test, not the prefs_get mirror.
  // TASK-061 added a third interactive prompt (graph defaults), so three
  // declines are piped in, one per prompt: app install, plugin install, then
  // graph defaults.
  const env = { ...curatedEnv(home, binDir), BOOTSTRAP_ASSUME_TTY: '1' };

  const obsidianDir = path.join(projectDir, '.obsidian');
  assert.ok(!fs.existsSync(obsidianDir), 'scratch project dir already had a .obsidian/ before the run');

  const res = run(['--interactive', '--project-dir', projectDir], { env, input: 'n\nn\nn\n' });

  assert.equal(res.status, 0, `declining all three prompts must not abort the script: ${res.stderr}`);
  assert.ok(res.stdout.includes('Skipping Obsidian app install.'), `app-install decline message missing:\n${res.stdout}`);
  assert.ok(
    res.stdout.includes('Skipping Obsidian plugin install.'),
    `plugin-install decline message missing:\n${res.stdout}`
  );
  assert.ok(
    res.stdout.includes('Skipping Obsidian graph defaults install.'),
    `graph-defaults decline message missing:\n${res.stdout}`
  );
  assert.ok(
    !fs.existsSync(obsidianDir),
    'a .obsidian/ directory was created despite declining every prompt — a decline must leave no partial writes'
  );

  cleanup(home, projectDir, path.dirname(binDir));
});

test('install-obsidian.sh: Linux + a failing `flatpak install` warns and continues rather than erroring', () => {
  const home = scratchDir('install-obsidian-home-');
  const binDir = path.join(scratchDir('install-obsidian-bin-'), 'bin');
  writeBin(binDir, 'uname', ['#!/usr/bin/env bash', 'echo Linux', ''].join('\n'));
  // Unlike the "flatpak absent from PATH" case above, flatpak IS resolvable
  // here (so `command -v flatpak` succeeds and the code reaches the actual
  // install line) but the install itself fails — the `cmd || echo WARNING`
  // idiom this case targets, mirroring the real `brew install --cask obsidian`
  // failure TASK-059 provoked on macOS by stripping `brew` from PATH.
  writeBin(
    binDir,
    'flatpak',
    [
      '#!/usr/bin/env bash',
      'if [ "$1" = "list" ]; then exit 1; fi',
      'if [ "$1" = "install" ]; then echo "stub flatpak install failing" >&2; exit 1; fi',
      'exit 1',
      '',
    ].join('\n')
  );
  const env = curatedEnv(home, binDir);

  const res = run([], { env });

  assert.equal(res.status, 0, `an install-command failure must not abort the script: ${res.stderr}`);
  assert.ok(
    res.stdout.includes(
      "WARNING: 'flatpak install -y flathub md.obsidian.Obsidian' failed — install Obsidian manually from https://obsidian.md/download"
    ),
    `missing the failed-install WARNING:\n${res.stdout}`
  );
  cleanup(home, path.dirname(binDir));
});

// =================================================================================
// TASK-061: .obsidian/graph.json defaults — write-if-absent install of the
// graph-view styling template, and its own non-interactive prefs gate
// (obsidian.graphDefaults), mirroring the obsidian.plugins coverage above.
// Every case here keeps obsidian.installApp and obsidian.plugins out of scope
// via a stored `false` so only _install_obsidian_graph_defaults is under test —
// no curl stub needed, since the graph defaults path never touches the network.
// =================================================================================

test('install-obsidian.sh: a fresh vault (no pre-existing .obsidian/graph.json) gets the file written with exactly 9 colorGroups and "search": "path:wiki"', () => {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const env = curatedEnv(home, path.join(scratchDir('install-obsidian-bin-'), 'bin'));
  seedGlobalPref(env, 'obsidian.installApp', 'false');
  seedProjectPref(env, projectDir, 'obsidian.plugins', 'false');

  assert.ok(!fs.existsSync(graphJsonPath(projectDir)), 'scratch project dir already had a graph.json before the run');

  const res = run(['--project-dir', projectDir], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(graphJsonPath(projectDir)), 'graph.json was not written into a fresh vault');
  const graph = JSON.parse(fs.readFileSync(graphJsonPath(projectDir), 'utf8'));
  assert.strictEqual(graph.search, 'path:wiki', 'graph.json must scope the graph to path:wiki');
  assert.ok(Array.isArray(graph.colorGroups), 'graph.json colorGroups must be an array');
  assert.strictEqual(graph.colorGroups.length, 9, 'expected exactly 9 colorGroups entries (3 knowledge + 6 work families)');

  cleanup(home, projectDir);
});

test('install-obsidian.sh: an existing .obsidian/graph.json is left byte-for-byte unchanged (write-if-absent)', () => {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const env = curatedEnv(home, path.join(scratchDir('install-obsidian-bin-'), 'bin'));
  seedGlobalPref(env, 'obsidian.installApp', 'false');
  seedProjectPref(env, projectDir, 'obsidian.plugins', 'false');

  const obsidianDir = path.join(projectDir, '.obsidian');
  fs.mkdirSync(obsidianDir, { recursive: true });
  const customized = '{"this is":"the user\'s own customization","search":"path:something-else"}';
  fs.writeFileSync(graphJsonPath(projectDir), customized);

  const res = run(['--project-dir', projectDir], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stdout.includes('.obsidian/graph.json already present — leaving your customization in place, skipping.'),
    `missing the already-present skip message:\n${res.stdout}`
  );
  assert.strictEqual(
    fs.readFileSync(graphJsonPath(projectDir), 'utf8'),
    customized,
    'an existing graph.json was overwritten instead of being left in place'
  );

  cleanup(home, projectDir);
});

test('install-obsidian.sh: non-interactive + stored obsidian.graphDefaults=false at the project selector skips the graph defaults install', () => {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const env = curatedEnv(home, path.join(scratchDir('install-obsidian-bin-'), 'bin'));
  seedGlobalPref(env, 'obsidian.installApp', 'false'); // keep the app half out of scope for this case
  seedProjectPref(env, projectDir, 'obsidian.plugins', 'false'); // keep the plugin half out of scope too
  seedProjectPref(env, projectDir, 'obsidian.graphDefaults', 'false');

  const res = run(['--project-dir', projectDir], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    res.stdout.includes('obsidian.graphDefaults: skipped (remembered decline — change with /bootstrap-config)'),
    `missing remembered-decline message:\n${res.stdout}`
  );
  assert.ok(
    !fs.existsSync(graphJsonPath(projectDir)),
    '_install_obsidian_graph_defaults ran (wrote graph.json) despite a stored `false`'
  );

  cleanup(home, projectDir);
});

test('install-obsidian.sh: non-interactive with NO stored obsidian.graphDefaults preference proceeds with the graph defaults install (unset does not divert, only an explicit false does)', () => {
  const home = scratchDir('install-obsidian-home-');
  const projectDir = scratchDir('install-obsidian-project-');
  const env = curatedEnv(home, path.join(scratchDir('install-obsidian-bin-'), 'bin'));
  seedGlobalPref(env, 'obsidian.installApp', 'false');
  seedProjectPref(env, projectDir, 'obsidian.plugins', 'false');
  // obsidian.graphDefaults intentionally left unset

  const res = run(['--project-dir', projectDir], { env });

  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    fs.existsSync(graphJsonPath(projectDir)),
    `graph.json was not written even though no preference was stored:\n${res.stdout}`
  );

  cleanup(home, projectDir);
});


test('lib/scripts/templates/obsidian/graph.json: colorGroups carry the exact query + rgb pairs documented in TASK-061, and no group targets raw/', () => {
  // TASK-061's Approach table pins nine exact {path, hex} pairs, each with an
  // rgb integer that must be computed via parseInt(hex, 16) — not guessed.
  // The installer-level tests above only assert colorGroups.length === 9 and
  // the top-level search filter; they never checked which nine paths/colors
  // landed in the array, so a swapped hue, a transposed digit in an rgb
  // integer, or an accidental raw/ entry would still pass those. This reads
  // the static template file directly (no installer run needed — it is a
  // pure data-shape assertion) and pins the full table.
  const templatePath = path.join(REPO, 'lib', 'scripts', 'templates', 'obsidian', 'graph.json');
  const graph = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  const expected = [
    ['path:wiki/knowledge/sources', 0x90b8e8],
    ['path:wiki/knowledge/concepts', 0x5a8fd6],
    ['path:wiki/knowledge/entities', 0x2f5fa8],
    ['path:wiki/work/tasks', 0xf2b84b],
    ['path:wiki/work/bugs', 0xe2703a],
    ['path:wiki/work/decisions', 0xd4914b],
    ['path:wiki/work/roadmaps', 0xc9762e],
    ['path:wiki/work/requirements', 0xe8975c],
    ['path:wiki/work/uat', 0xb85c3e],
  ];

  assert.strictEqual(graph.search, 'path:wiki', 'template search filter must scope the graph to path:wiki');
  assert.strictEqual(graph.colorGroups.length, 9, 'expected exactly 9 colorGroups entries');

  for (const [query, rgb] of expected) {
    const entry = graph.colorGroups.find((g) => g.query === query);
    assert.ok(entry, `no colorGroups entry found for query "${query}"`);
    assert.deepStrictEqual(
      entry.color,
      { a: 1, rgb },
      `colorGroups entry for "${query}" has the wrong color (expected {a:1, rgb:${rgb}})`
    );
  }

  assert.ok(
    !graph.colorGroups.some((g) => typeof g.query === 'string' && g.query.startsWith('path:raw')),
    'colorGroups must not include an entry for raw/ — the path:wiki search filter already excludes it from the graph'
  );
});
