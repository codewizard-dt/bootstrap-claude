#!/usr/bin/env node
// Repeatable verification of the `bootstrap config` terminal UI (TASK-0105).
//
// Zero-dependency: node:test + node:assert only, matching test/bootstrap-prefs.test.js.
// Run: npm test   (or: node --test test/bootstrap-prefs-tui-verification.test.js)
//
// SCOPE: the user-visible behaviour of lib/scripts/bootstrap-prefs-tui.js and of
// `bin/cli.js config ...` against the SHIPPED schema (lib/scripts/templates/
// bootstrap-prefs-schema.json), driven as a black box through piped stdin:
// view-first summary rows, the edit happy path, the enum grammar (no separate
// `ask`), installer-vs-skill consumer banners, reset (an unset key is not
// offered; the both-layers question), robustness (bad input re-prompts, EOF
// mid-flow exits 0 and writes nothing), the layer statement/question per key
// scope, the no-project-directory refusal, the CLI passthrough and its exit-code
// and stderr parity with the engine, and both dynamic key families (guides.*,
// gitignore.section.*). The engine (lib/scripts/bootstrap-prefs.js) remains the
// only writer; assertions on stored state go through the values files and the
// engine's own --get/--list.
//
// DRIVER CHOICE (option A): spawnSync(process.execPath, [TUI, ...args], { input,
// env, timeout }) with the whole answer script piped to stdin. Reason: the TUI's
// createReader() queues every readline 'line' event and drains the queue before
// it sees EOF, so piped answers are never dropped, and on a non-TTY stdin each
// prompt echoes its answer (`Choose [1-4]: 4`), which makes the transcript a
// faithful, assertable record of prompt order. No pseudo-terminal, no extra
// dependency. Every existing TUI test uses this driver, so the two files agree on
// what "the TUI's behaviour" is.
//
// COMPLEMENTS, DOES NOT DUPLICATE: test/bootstrap-prefs-tui.test.js pins the TUI's
// pure helpers and its menus against a FIXTURE schema (deterministic numbering,
// independent of what the shipped schema contains); test/cli-config-subcommand.test.js
// pins how bin/cli.js routes `config` arguments. This file instead runs the LIVE
// schema end to end, so it is the one that fails when a shipped key's scope,
// grammar or consumer changes in a way that breaks the experience. Where a claim
// is already asserted there, this file only re-asserts it if the live schema
// changes the outcome.
//
// KEY-PICKER NUMBERING: menu numbers depend on the live schema, so they are never
// hardcoded. pickerNumbers() runs the TUI once with `1` (Edit) or `2` (Reset) and
// then EOF — EOF at the key picker exits 0 with nothing written — and parses the
// printed `  N) <key> — ...` lines by label. That keeps the numbering black-box
// (it is what the user actually sees) rather than re-deriving it through the
// module's own buildKeyOptions, which would test the code against itself. The
// probe must be re-run after any state change that can alter the list (a write, or
// reset mode which hides keys with nothing stored).
//
// HERMETIC — NO TEST MAY READ OR WRITE THE REAL ~/.claude. Every TUI/engine/CLI
// process gets a scratch HOME (the engine resolves the global layer with
// os.homedir(), which follows HOME) and a scratch project dir under os.tmpdir().
// withLayers() probes the redirect with a READ-ONLY `--list` first and refuses to
// run the body if the printed global path is outside the scratch HOME. Never pass
// `--schema`: these tests must see the live schema (the TUI only forwards
// `--schema` to the engine when it differs from the default).
//
// DELIBERATELY MANUAL (two residual checks that a piped, non-TTY driver cannot
// verify and that are recorded in the task's UAT rather than here):
//   1. Visual rendering in a real TTY, including 80-column wrapping of long
//      summaries and the group headings.
//   2. Ctrl-C/SIGINT in a real terminal restores the terminal state and leaves no
//      partial write. (Piped EOF is covered here and exits 0 with nothing written;
//      raw-mode SIGINT is not reachable without a pty.)
//
// DIVERGENCES from the task text, found while investigating (assert reality):
//   1. There is no separate mode question: "No changes" is main-menu item 4
//      (`Quit (No changes)`), reading `Quit` after a write.
//   2. `--unset` of a scope-inert key planted in the wrong layer works only via
//      the engine / `bootstrap config --unset <k> --project <dir>`; the TUI's
//      --list resolves such a key as `[unset]` and hides it in reset mode (it
//      appears under `Not listed`). Tested via engine/CLI. Potential limitation,
//      reported not patched.
//   3. There is no text "only --unset re-offers a declined section"; the real
//      wording is "deliberately never recorded" (family flow) and the reset
//      preamble "will ask that question again".
//   4. The empty guides.* family note does not name OPTIONAL_GUIDES; that appears
//      in the schema detail printed after choosing the family.
//   5. A `maybe` typo cannot be typed in the TUI (only schema values are offered),
//      so the illegal-value rejection is tested via the engine/CLI
//      (`is not a legal value for guides.x — expected one of: true, false`).
//   6. The TUI itself rejects the engine passthrough flags (--get/--set/--unset/
//      --list/--section-key: exit 2 `unknown argument`); "directly on the TUI"
//      only applies to the --global/--project pins. Passthrough is a CLI concern.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const TUI = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs-tui.js');
const CLI = path.join(REPO, 'bin', 'cli.js');
const HELPER = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs.js');
const SCHEMA = path.join(REPO, 'lib', 'scripts', 'templates', 'bootstrap-prefs-schema.json');
const TEMPLATE_GITIGNORE = path.join(REPO, 'lib', 'scripts', 'templates', 'gitignore');

// BUG-0009 pins: the two keys whose scope is asserted on purpose. Everything
// else is picked from the live schema by property (keysWhere).
const GLOBAL_KEY = 'mcp.braveSearch'; // scope: global
const PROJECT_KEY = 'mcp.serena'; // scope: project

// Main menu numbers (the fixed four-item menu).
const EDIT = '1';
const RESET = '2';
const VIEW = '3';
const QUIT = '4';

const EM_DASH = '—';

// ---------------------------------------------------------------------------
// Fixture: scratch HOME + scratch project + scratch bare cwd
// ---------------------------------------------------------------------------

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-tui-v-'));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// L = { env, home, projectDir, bareDir, globalValues, projectValues }.
//   home        scratch $HOME (the global layer lives at <home>/.claude/...)
//   projectDir  scratch project checkout (the project layer, no .git ancestor)
//   bareDir     a third scratch dir with no .git and no .claude — use as `cwd`
//               (opts.cwd) to test the "no project directory found" path
// The redirect probe runs first and is read-only; a failed redirect throws before
// any body code can write to the developer's real store.
function withLayers(body) {
  const home = scratchDir();
  const projectDir = scratchDir();
  const bareDir = scratchDir();
  const L = {
    env: { ...process.env, HOME: home },
    home,
    projectDir,
    bareDir,
    globalValues: path.join(home, '.claude', 'bootstrap-prefs.json'),
    projectValues: path.join(projectDir, '.claude', 'bootstrap-prefs.json'),
  };
  try {
    const probe = helper(L, ['--list', '--project', projectDir]);
    assert.strictEqual(probe.status, 0, probe.stderr);
    const trailer = probe.stdout.match(/^Layers: project \((.+)\) then global \((.+)\)\.$/m);
    assert.ok(trailer, `--list did not print the two-layer trailer:\n${probe.stdout}`);
    assert.strictEqual(trailer[1], L.projectValues, '--project did not resolve to the scratch project file');
    assert.strictEqual(
      trailer[2],
      L.globalValues,
      'HOME redirect did not take — refusing to run: a --global write would have hit the real store'
    );
    return body(L);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(bareDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

function shape(res) {
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  return { status: res.status, signal: res.signal, error: res.error, stdout, stderr, all: stdout + stderr };
}

// The TUI, script piped to stdin. `args` defaults to pinning the scratch project
// layer; pass [] for an unpinned run (project discovery from opts.cwd) or
// ['--global'] for the global pin. NEVER add --schema here (live schema).
function tui(L, lines, args, opts = {}) {
  const argv = args === undefined ? ['--project', L.projectDir] : args;
  return shape(
    spawnSync(process.execPath, [TUI, ...argv], {
      encoding: 'utf8',
      env: L.env,
      input: `${lines.join('\n')}\n`,
      timeout: 15000,
      ...opts,
    })
  );
}

// `bin/cli.js config <args>` (no stdin script; pass opts.input to drive the TUI).
function cli(L, args, opts = {}) {
  return shape(
    spawnSync(process.execPath, [CLI, 'config', ...args], {
      encoding: 'utf8',
      env: L.env,
      timeout: 15000,
      ...opts,
    })
  );
}

// The engine directly. stdout/stderr are trimmed (whole-line assertions).
function helper(L, args, opts = {}) {
  const res = spawnSync(process.execPath, [HELPER, ...args], {
    encoding: 'utf8',
    env: L.env,
    timeout: 15000,
    ...opts,
  });
  return { status: res.status, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() };
}

// ---------------------------------------------------------------------------
// Schema helpers (the LIVE schema)
// ---------------------------------------------------------------------------

const SCHEMA_OBJ = readJson(SCHEMA);

// Concrete (non-dynamic) keys whose entry satisfies pred(entry, key). E.g.
//   keysWhere((e) => e.scope === 'either' && e.consumer === 'skill')
// Dynamic family rows (guides.*, gitignore.section.*) are excluded — use
// familyPatterns() for those.
function keysWhere(pred) {
  return Object.keys(SCHEMA_OBJ).filter((k) => !SCHEMA_OBJ[k].dynamic && pred(SCHEMA_OBJ[k], k));
}

function familyPatterns() {
  return Object.keys(SCHEMA_OBJ).filter((k) => SCHEMA_OBJ[k].dynamic);
}

// The storable values of an entry, split on `|` (the TUI offers exactly these).
function valuesOf(key) {
  return String(SCHEMA_OBJ[key].values)
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Key-picker numbering (black-box; see the header)
// ---------------------------------------------------------------------------

// Runs the TUI to the key picker (Edit or Reset) and parses the numbered options
// by label. Returns { numbers: Map<keyOrPattern, '<n>'>, free: '<n>'|null,
// text: <transcript> }. Family options are keyed by their pattern (`guides.*`),
// concrete keys by name. `mode` is 'edit' | 'reset'. `args` as for tui().
function pickerNumbers(L, mode, args, opts) {
  const res = tui(L, [mode === 'reset' ? RESET : EDIT], args, opts);
  assert.strictEqual(res.status, 0, `key-picker probe failed:\n${res.all}`);
  const numbers = new Map();
  let free = null;
  for (const line of res.stdout.split('\n')) {
    const m = line.match(/^\s+(\d+)\) (\S+) — /);
    if (m) numbers.set(m[2], m[1]);
    const f = line.match(/^\s+(\d+)\) Enter a key by name\s*$/);
    if (f) free = f[1];
  }
  return { numbers, free, text: res.stdout };
}

// The menu number the picker shows for `key` (a concrete key or a family pattern
// such as `guides.*`). Throws with the transcript when the key is not offered.
function pickKey(L, mode, key, args, opts) {
  const { numbers, text } = pickerNumbers(L, mode, args, opts);
  const n = numbers.get(key);
  assert.ok(n, `the ${mode} key picker does not offer ${key}:\n${text}`);
  return n;
}

// The number of the "Enter a key by name" option.
function freeEntryNumber(L, mode, args, opts) {
  const { free, text } = pickerNumbers(L, mode, args, opts);
  assert.ok(free, `the ${mode} key picker has no "Enter a key by name" option:\n${text}`);
  return free;
}

// ---------------------------------------------------------------------------
// Transcript / state helpers
// ---------------------------------------------------------------------------

// Parses the state-summary rows (`  <key> = <shown>  [<layer>]`) out of TUI output
// into Map<key, { shown, layer }>. First occurrence wins (the summary is
// re-printed by "View again" and after writes). Layer is the exact bracket text,
// e.g. `project`, `global`, `unset`, `default: no stored answer`.
function summaryRows(text) {
  const rows = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^ {2}(\S+) = (.*?) {2}\[([^\]]+)\]\s*$/);
    if (m && !rows.has(m[1])) rows.set(m[1], { shown: m[2], layer: m[3] });
  }
  return rows;
}

// Nothing was written anywhere: neither values file (nor a companion README).
function assertNothingWritten(L, why = '') {
  for (const [name, file] of [
    ['global values file', L.globalValues],
    ['project values file', L.projectValues],
    ['global README', path.join(L.home, '.claude', 'bootstrap-prefs.README.md')],
    ['project README', path.join(L.projectDir, '.claude', 'bootstrap-prefs.README.md')],
  ]) {
    assert.strictEqual(fs.existsSync(file), false, `${name} exists but nothing should have been written ${why}`);
  }
}

// A clean EOF/quit: exit 0, no stack trace, no `Error:` line on stderr.
function assertCleanExit(res, why = '') {
  assert.strictEqual(res.status, 0, `expected exit 0 ${why}:\n${res.all}`);
  assert.ok(!/^\s+at .*\(.*:\d+:\d+\)/m.test(res.stderr), `stack trace on stderr ${why}:\n${res.stderr}`);
  assert.ok(!/^Error:/m.test(res.stderr), `Error: on stderr ${why}:\n${res.stderr}`);
}

// Mirrors the awk banner split in merge-gitignore.sh — banner delimiters come in
// pairs, and the first `# ` comment after an odd dash line is the title. Copied
// from test/bootstrap-prefs.test.js (a test file is not importable).
function templateSectionTitles() {
  const lines = fs.readFileSync(TEMPLATE_GITIGNORE, 'utf8').split('\n');
  const titles = [];
  let dash = 0;
  let n = 0;
  const seen = new Set();
  for (const line of lines) {
    if (line.startsWith('# -----')) {
      dash++;
      if (dash % 2 === 1) n++;
      continue;
    }
    if (n > 0 && dash % 2 === 1 && line.startsWith('# ') && !seen.has(n)) {
      seen.add(n);
      titles.push(line.replace(/^# +/, ''));
    }
  }
  return titles;
}

// ---------------------------------------------------------------------------
// Scaffold / smoke tests
// ---------------------------------------------------------------------------

test('scaffold: the scratch HOME redirect is honoured and the TUI quits cleanly with no changes', () => {
  withLayers((L) => {
    const res = tui(L, [QUIT]);
    assertCleanExit(res, 'quitting the main menu');
    assert.match(res.stdout, /What would you like to do\?/);
    assert.match(res.stdout, /4\) Quit \(No changes\)/);
    assert.match(res.stdout, /^No changes\.$/m);
    assertNothingWritten(L, 'after a quit');
  });
});

test('scaffold: the two BUG-0009 pin keys still have the scope the tests rely on', () => {
  assert.strictEqual(SCHEMA_OBJ[GLOBAL_KEY].scope, 'global', `${GLOBAL_KEY} is no longer global-scoped`);
  assert.strictEqual(SCHEMA_OBJ[PROJECT_KEY].scope, 'project', `${PROJECT_KEY} is no longer project-scoped`);
  assert.ok(keysWhere((e) => e.scope === 'either' && e.consumer === 'skill').length > 0, 'no either-scope skill key');
  assert.deepStrictEqual(familyPatterns().sort(), ['gitignore.section.*', 'guides.*']);
  assert.ok(templateSectionTitles().length > 0, 'no banner titles parsed out of templates/gitignore');
});

test('scaffold: pickerNumbers/pickKey derive live numbers that reach the chosen key', () => {
  withLayers((L) => {
    const { numbers, free, text } = pickerNumbers(L, 'edit');
    assert.ok(numbers.has(GLOBAL_KEY) && numbers.has(PROJECT_KEY), `pins missing from the picker:\n${text}`);
    assert.ok(numbers.has('guides.*') && numbers.has('gitignore.section.*'), 'family options missing');
    assert.ok(free, 'no "Enter a key by name" option');
    assert.notStrictEqual(numbers.get(GLOBAL_KEY), numbers.get(PROJECT_KEY));

    const res = tui(L, [EDIT, pickKey(L, 'edit', PROJECT_KEY)]);
    assertCleanExit(res, 'EOF at the value picker');
    assert.match(res.stdout, /New value for mcp\.serena\?/);
    assertNothingWritten(L, 'after EOF at the value picker');
  });
});

// ---- Step 3: interactive menu flow ----
//
// Only the gaps left by test/bootstrap-prefs-tui.test.js (fixture schema) are
// covered here, all against the LIVE schema: view-first row detail, the edit happy
// path, enum grammar, consumer banners, reset, input robustness and the companion.

const EITHER_SKILL_KEYS = keysWhere((e) => e.scope === 'either' && e.consumer === 'skill');
const VERSION_BUMP = 'gitCommit.versionBump';
const BOTH_LAYERS = (key) =>
  `${key} is stored in BOTH layers. Clearing the project layer alone re-exposes the global answer instead of re-opening the question; clear both (one reset per layer) to re-open it.`;

function seed(L, key, value, layer) {
  const target = layer === 'global' ? ['--global'] : ['--project', L.projectDir];
  const res = helper(L, ['--set', key, '--value', value, ...target]);
  assert.strictEqual(res.status, 0, `seeding ${key}=${value} in the ${layer} layer failed: ${res.stderr}`);
}

// An UNPINNED run: the TUI discovers the project as the nearest ancestor of cwd
// holding .claude/ (or .git), so both layers are writable and scope-either keys
// ask "Which layer?".
function unpinned(L) {
  fs.mkdirSync(path.join(L.projectDir, '.claude'), { recursive: true });
  return { args: [], opts: { cwd: L.projectDir } };
}

// The options printed by the LAST value picker in a transcript, `(current)`
// stripped, `0) Back / No changes` excluded.
function offeredValues(text) {
  const at = text.lastIndexOf('New value for');
  assert.ok(at >= 0, `no value picker in the transcript:\n${text}`);
  const out = [];
  for (const line of text.slice(at).split('\n').slice(1)) {
    if (/^Choose \[/.test(line)) break;
    const m = line.match(/^\s+(\d+)\) (.*?)(?:  \(current\))?\s*$/);
    if (m && m[1] !== '0') out.push(m[2]);
  }
  return out;
}

// Everything printed after the engine's post-write `Changed rows` header.
function changedRowsBlock(text) {
  const at = text.indexOf('Changed rows (as the engine now reports them):');
  assert.ok(at >= 0, `no "Changed rows" block in the transcript:\n${text}`);
  return text.slice(at);
}

// --- view-first ordering and row detail ---

test('view-first: the grouped summary precedes the first prompt and every row carries key, value, [layer] and summary', () => {
  withLayers((L) => {
    const res = tui(L, [QUIT]);
    assertCleanExit(res, 'quitting straight after the summary');
    const lines = res.stdout.split('\n');
    const inst = lines.findIndex((l) => l.startsWith('Installer preferences — read by the setup/update scripts'));
    const skill = lines.findIndex((l) =>
      l.startsWith('Skill preferences — read by slash commands at run time; changing these changes what a command does')
    );
    const prompt = lines.findIndex((l) => l.includes('What would you like to do?'));
    assert.ok(inst >= 0 && skill > inst && prompt > skill, `group order wrong: ${inst}/${skill}/${prompt}:\n${res.stdout}`);
    assert.ok(!res.stdout.includes('Unrecognized keys — present in a values file'), 'empty Unrecognized group must not print');

    const rows = summaryRows(res.stdout);
    for (const key of keysWhere(() => true)) {
      const row = rows.get(key);
      assert.ok(row, `no summary row for ${key}:\n${res.stdout}`);
      assert.match(row.layer, /^(default: no stored answer|project|global|target|unset)$/, `${key} layer bracket`);
      const i = lines.findIndex((l) => l.startsWith(`  ${key} = `));
      assert.strictEqual(lines[i + 1], `      ${SCHEMA_OBJ[key].summary}`, `${key} is not followed by its schema summary`);
      assert.ok(i < prompt, `${key} row printed after the first prompt`);
      if (SCHEMA_OBJ[key].consumer === 'skill') assert.ok(i > skill, `${key} (skill) is not in the Skill group`);
      else assert.ok(i > inst && i < skill, `${key} (installer) is not in the Installer group`);
    }
    for (const pattern of familyPatterns()) {
      assert.ok(rows.has(pattern), `no placeholder row for the ${pattern} family`);
    }
  });
});

test('view-first: a stored false is a remembered decline, distinct from an unset installer key', () => {
  withLayers((L) => {
    seed(L, PROJECT_KEY, 'false', 'project');
    seed(L, GLOBAL_KEY, 'false', 'global');
    seed(L, 'gitCommit.autoPush', 'false', 'project');
    const res = tui(L, [QUIT]);
    assertCleanExit(res);
    const rows = summaryRows(res.stdout);
    assert.deepStrictEqual(rows.get(PROJECT_KEY), { shown: 'false (remembered decline)', layer: 'project' });
    assert.deepStrictEqual(rows.get(GLOBAL_KEY), { shown: 'false (remembered decline)', layer: 'global' });
    const unsetRow = rows.get('mcp.context7');
    assert.strictEqual(unsetRow.layer, 'unset');
    assert.match(unsetRow.shown, /^unset \(not answered yet, the installer will ask\)$/);
    assert.notStrictEqual(unsetRow.shown, rows.get(PROJECT_KEY).shown);
    const skillFalse = rows.get('gitCommit.autoPush');
    assert.strictEqual(skillFalse.shown, 'false', 'a skill key stored false is plain false, not a "decline"');
    assert.strictEqual(skillFalse.layer, 'project');
  });
});

test('view-first: an unrecognized key in a values file gets its own group after the skill group, untouched', () => {
  withLayers((L) => {
    fs.mkdirSync(path.dirname(L.projectValues), { recursive: true });
    const before = `${JSON.stringify({ 'zzz.custom': 'x' }, null, 2)}\n`;
    fs.writeFileSync(L.projectValues, before);
    const res = tui(L, [QUIT]);
    assertCleanExit(res);
    const lines = res.stdout.split('\n');
    const skill = lines.findIndex((l) => l.startsWith('Skill preferences — read by slash commands'));
    const unrec = lines.findIndex((l) =>
      l.startsWith('Unrecognized keys — present in a values file, absent from the schema (kept untouched)')
    );
    const prompt = lines.findIndex((l) => l.includes('What would you like to do?'));
    assert.ok(skill >= 0 && unrec > skill && prompt > unrec, `Unrecognized group misplaced:\n${res.stdout}`);
    assert.deepStrictEqual(summaryRows(res.stdout).get('zzz.custom'), { shown: 'x', layer: 'project' });
    assert.strictEqual(fs.readFileSync(L.projectValues, 'utf8'), before, 'quitting must leave the values file untouched');
  });
});

test('no-changes exit: Back out of the key picker, then Quit, writes nothing (no values file, no companion)', () => {
  withLayers((L) => {
    const res = tui(L, [EDIT, '0', QUIT]);
    assertCleanExit(res, 'backing out then quitting');
    assert.match(res.stdout, /Which preference do you want to edit\?/);
    assert.match(res.stdout, /^No changes\.$/m);
    assertNothingWritten(L, 'after backing out of the key picker');
  });
});

// --- edit happy path and grammar ---

test('edit: every scope-either key prints its detail in full and offers exactly its schema values', () => {
  withLayers((L) => {
    const u = unpinned(L);
    const { numbers } = pickerNumbers(L, 'edit', u.args, u.opts);
    for (const key of EITHER_SKILL_KEYS) {
      const n = numbers.get(key);
      assert.ok(n, `${key} is not offered by the unpinned edit picker`);
      const res = tui(L, [EDIT, n], u.args, u.opts);
      assertCleanExit(res, `EOF at the ${key} value picker`);
      assert.ok(res.stdout.includes(SCHEMA_OBJ[key].detail), `${key}: the schema detail was not printed in full`);
      assert.deepStrictEqual(offeredValues(res.stdout), valuesOf(key), `${key}: offered values differ from the schema values`);
    }
    assertNothingWritten(L, 'after only looking at value pickers');
  });
});

test('edit happy path: pick a scope-either key, choose the GLOBAL layer, confirm — value lands there and Changed rows shows it', () => {
  withLayers((L) => {
    assert.strictEqual(SCHEMA_OBJ[VERSION_BUMP].scope, 'either');
    const u = unpinned(L);
    const n = pickKey(L, 'edit', VERSION_BUMP, u.args, u.opts);
    const res = tui(L, [EDIT, n, '3', '2', 'y', QUIT], u.args, u.opts);
    assertCleanExit(res, 'a full edit flow');
    assert.ok(res.stdout.includes(SCHEMA_OBJ[VERSION_BUMP].detail), 'detail paragraph missing');
    assert.deepStrictEqual(offeredValues(res.stdout), ['auto', 'confirm', 'never']);
    assert.match(res.stdout, /This key can live in either layer\. Project wins over global, per key\./);
    assert.match(res.stdout, /Which layer\?/);
    assert.match(res.stdout, /--set gitCommit\.versionBump --value never --global/);
    assert.match(res.stdout, /^global: gitCommit\.versionBump = never$/m);
    assert.deepStrictEqual(readJson(L.globalValues), { [VERSION_BUMP]: 'never' });
    assert.strictEqual(fs.existsSync(L.projectValues), false, 'the project layer must not be written');
    assert.deepStrictEqual(summaryRows(changedRowsBlock(res.stdout)).get(VERSION_BUMP), { shown: 'never', layer: 'global' });
    assert.match(res.stdout, /4\) Quit\n/, 'after a write the main-menu quit item reads "Quit"');
    assert.match(res.stdout, /^Done\.$/m);
  });
});

test('edit happy path: choosing the PROJECT layer writes the project file only', () => {
  withLayers((L) => {
    const u = unpinned(L);
    const n = pickKey(L, 'edit', VERSION_BUMP, u.args, u.opts);
    const res = tui(L, [EDIT, n, '2', '1', 'y', QUIT], u.args, u.opts);
    assertCleanExit(res, 'a full edit flow');
    assert.deepStrictEqual(readJson(L.projectValues), { [VERSION_BUMP]: 'confirm' });
    assert.strictEqual(fs.existsSync(L.globalValues), false, 'the global layer must not be written');
    assert.deepStrictEqual(summaryRows(changedRowsBlock(res.stdout)).get(VERSION_BUMP), { shown: 'confirm', layer: 'project' });
  });
});

test('grammar: gitCommit.versionBump offers exactly auto, confirm, never — there is no separate ask option', () => {
  withLayers((L) => {
    assert.deepStrictEqual(valuesOf(VERSION_BUMP), ['auto', 'confirm', 'never']);
    const n = pickKey(L, 'edit', VERSION_BUMP);
    const res = tui(L, [EDIT, n, '2', 'y', QUIT]);
    assertCleanExit(res);
    assert.deepStrictEqual(offeredValues(res.stdout), ['auto', 'confirm', 'never']);
    assert.ok(!/^\s+\d+\) ask\b/m.test(res.stdout), `an "ask" option was offered:\n${res.stdout}`);
    assert.match(res.stdout, /--set gitCommit\.versionBump --value confirm --project /);
    assert.deepStrictEqual(readJson(L.projectValues), { [VERSION_BUMP]: 'confirm' });

    const bad = helper(L, ['--set', VERSION_BUMP, '--value', 'ask', '--project', L.projectDir]);
    assert.notStrictEqual(bad.status, 0, 'the engine must reject `ask` for versionBump');
    assert.deepStrictEqual(readJson(L.projectValues), { [VERSION_BUMP]: 'confirm' }, 'a rejected value must not change the file');
  });
});

test('confirm-cancel: n and an empty answer both cancel; nothing is written, not even the companion', () => {
  withLayers((L) => {
    const n = pickKey(L, 'edit', VERSION_BUMP);
    for (const answer of ['n', '']) {
      const res = tui(L, [EDIT, n, '2', answer, QUIT]);
      assertCleanExit(res, `answering the confirm with ${JSON.stringify(answer)}`);
      assert.match(res.stdout, /About to run:/);
      assert.match(res.stdout, /Cancelled\. Nothing was written\./);
      assert.ok(!res.stdout.includes('Changed rows'), 'a cancelled change must not report changed rows');
      assertNothingWritten(L, `after cancelling with ${JSON.stringify(answer)}`);
    }
  });
});

// --- consumer banners ---

test('banner: every skill key prints the SKILL PREFERENCE banner; every installer key prints the installer text and not the skill banner', () => {
  withLayers((L) => {
    const { numbers } = pickerNumbers(L, 'edit');
    for (const key of keysWhere(() => true)) {
      const n = numbers.get(key);
      assert.ok(n, `${key} is not offered by the pinned edit picker`);
      const res = tui(L, [EDIT, n]);
      assertCleanExit(res, `EOF at the ${key} value picker`);
      const entry = SCHEMA_OBJ[key];
      if (entry.consumer === 'skill') {
        assert.match(res.stdout, /This is a SKILL PREFERENCE\. Changing it changes what a slash command actually does the next time it runs — not merely whether the installer asks you a question\./, key);
        assert.match(res.stdout, /^(Affected command: \/\S+|Affects: .+)$/m, `${key}: no "Affected command"/"Affects" line`);
        assert.ok(!res.stdout.includes('This is an installer preference.'), `${key}: skill key printed the installer text`);
      } else {
        assert.match(
          res.stdout,
          /This is an installer preference\. It only affects whether .+ \(a setup\/update script\) prompts you; it does not change what any slash command does\./,
          key
        );
        assert.ok(!res.stdout.includes('SKILL PREFERENCE'), `${key}: installer key printed the skill banner`);
      }
    }
    assertNothingWritten(L, 'after only reading banners');
  });
});

// --- reset ---

test('reset: only stored keys are offered; an unset key is listed under "Not listed"; confirming deletes the key (absent, never null)', () => {
  withLayers((L) => {
    const empty = tui(L, [RESET]);
    assertCleanExit(empty);
    assert.match(empty.stdout, /Nothing is stored in a writable layer, so there is nothing to reset\./);

    seed(L, PROJECT_KEY, 'true', 'project');
    const { numbers, text } = pickerNumbers(L, 'reset');
    assert.ok(numbers.has(PROJECT_KEY), `the stored key is not offered:\n${text}`);
    assert.ok(!numbers.has(GLOBAL_KEY), `the unset key ${GLOBAL_KEY} must not be offered by reset:\n${text}`);
    assert.match(text, /Not listed — nothing stored in a writable layer \(project\), so there is nothing to reset: /);
    assert.match(text, new RegExp(`${GLOBAL_KEY.replace('.', '\\.')} \\[unset\\]`), 'the unset key is named under Not listed');

    const res = tui(L, [RESET, numbers.get(PROJECT_KEY), 'y', QUIT]);
    assertCleanExit(res, 'a full reset flow');
    assert.match(res.stdout, /Reset deletes the key from the values file\. The next installer run or skill invocation will ask that question again\./);
    assert.match(res.stdout, /^project: mcp\.serena unset — the question is re-opened$/m);
    assert.deepStrictEqual(summaryRows(changedRowsBlock(res.stdout)).get(PROJECT_KEY).layer, 'unset');
    const stored = readJson(L.projectValues);
    assert.ok(!Object.prototype.hasOwnProperty.call(stored, PROJECT_KEY), `the key must be deleted, got ${JSON.stringify(stored)}`);
    assert.ok(!fs.readFileSync(L.projectValues, 'utf8').includes('null'), 'a reset must never leave a null behind');
  });
});

test('reset: a key stored in BOTH layers (unpinned) triggers the both-layers question; clearing one layer re-exposes the other', () => {
  withLayers((L) => {
    const key = 'gitCommit.autoPush';
    seed(L, key, 'true', 'project');
    seed(L, key, 'false', 'global');
    const u = unpinned(L);
    const n = pickKey(L, 'reset', key, u.args, u.opts);
    const res = tui(L, [RESET, n, '1', 'y', QUIT], u.args, u.opts);
    assertCleanExit(res, 'a both-layers reset');
    assert.ok(res.stdout.includes(BOTH_LAYERS(key)), `the both-layers question is missing:\n${res.stdout}`);
    assert.match(res.stdout, /Which layer\?/);
    assert.ok(!Object.prototype.hasOwnProperty.call(readJson(L.projectValues), key), 'the project layer key must be gone');
    assert.strictEqual(readJson(L.globalValues)[key], false, 'the global answer must be untouched');
    assert.deepStrictEqual(summaryRows(changedRowsBlock(res.stdout)).get(key), { shown: 'false', layer: 'global' });
  });
});

// KNOWN DEFECT (filed as BUG-0012, not patched; TASK-0105 Step 3): storedLayers() in
// bootstrap-prefs-tui.js decides "stored in BOTH layers" from `--get <key>
// --global` != `unset`. For a key WITH a schema default (every scope-either key is
// one) the engine answers the resolved default (e.g. `false`), not `unset`, so a
// skill key stored ONLY in the project layer is wrongly reported as stored in both
// and offers a spurious Global choice. Only a default-less key is probed correctly,
// so the negative case is asserted with the installer key mcp.serena.
test('reset: a default-less key stored in only ONE layer (unpinned) does not get the both-layers question', () => {
  withLayers((L) => {
    seed(L, PROJECT_KEY, 'true', 'project');
    const u = unpinned(L);
    const n = pickKey(L, 'reset', PROJECT_KEY, u.args, u.opts);
    const res = tui(L, [RESET, n, 'y', QUIT], u.args, u.opts);
    assertCleanExit(res, 'a single-layer unpinned reset');
    assert.ok(!res.stdout.includes('is stored in BOTH layers'), `single-layer key got the both-layers question:\n${res.stdout}`);
    assert.match(res.stdout, /Layer: Project layer /);
    assert.ok(!Object.prototype.hasOwnProperty.call(readJson(L.projectValues), PROJECT_KEY));
  });
});

// --- input robustness ---

const RE_RANGE = /Please enter a number from 1 to \d+ \(or 0 to go back\)\./g;

test('robustness: bad input at the key picker and the value picker re-prompts, then the flow still completes', () => {
  withLayers((L) => {
    const n = pickKey(L, 'edit', VERSION_BUMP);
    const res = tui(L, [EDIT, 'abc', '999', '-1', n, 'zzz', '99', '2', 'y', QUIT]);
    assertCleanExit(res, 'bad input then a valid flow');
    const keyPicker = res.stdout.slice(0, res.stdout.indexOf('New value for'));
    const valuePicker = res.stdout.slice(res.stdout.indexOf('New value for'));
    assert.ok((keyPicker.match(RE_RANGE) || []).length >= 3, `key picker did not re-prompt three times:\n${keyPicker}`);
    assert.ok((valuePicker.match(RE_RANGE) || []).length >= 2, `value picker did not re-prompt twice:\n${valuePicker}`);
    assert.match(valuePicker, /Please enter a number from 1 to 3 \(or 0 to go back\)\./);
    assert.deepStrictEqual(readJson(L.projectValues), { [VERSION_BUMP]: 'confirm' });
  });
});

test('robustness: bad input backed out with 0 writes nothing', () => {
  withLayers((L) => {
    const n = pickKey(L, 'edit', VERSION_BUMP);
    const res = tui(L, [EDIT, n, 'zzz', '0', QUIT]);
    assertCleanExit(res);
    assert.ok((res.stdout.match(RE_RANGE) || []).length >= 1, `expected a re-prompt:\n${res.stdout}`);
    assertNothingWritten(L, 'after bad input and Back');
  });
});

test('robustness: EOF mid-flow (after the key pick, after the value pick, at the layer question, at the confirm) exits 0 and writes nothing', () => {
  withLayers((L) => {
    const pinnedN = pickKey(L, 'edit', VERSION_BUMP);
    const u = unpinned(L);
    const unpinnedN = pickKey(L, 'edit', VERSION_BUMP, u.args, u.opts);
    const stages = [
      ['after the key pick (value picker)', [EDIT, pinnedN], undefined, undefined, /New value for gitCommit\.versionBump\?/],
      ['after the value pick, pinned (confirm)', [EDIT, pinnedN, '3'], undefined, undefined, /Apply this change\? \[y\/N\]/],
      ['after the value pick, unpinned (layer question)', [EDIT, unpinnedN, '3'], u.args, u.opts, /Which layer\?/],
      ['after the layer pick, unpinned (confirm)', [EDIT, unpinnedN, '3', '1'], u.args, u.opts, /Apply this change\? \[y\/N\]/],
    ];
    for (const [label, lines, args, opts, reached] of stages) {
      const res = tui(L, lines, args, opts);
      assertCleanExit(res, label);
      assert.match(res.stdout, reached, `${label}: the flow did not reach the expected prompt:\n${res.stdout}`);
      assert.ok(!res.stdout.includes('Changed rows'), `${label}: EOF must not apply the change`);
      assert.match(res.stdout, /^No changes\.$/m, `${label}: no closing line`);
      assertNothingWritten(L, label);
    }
  });
});

test('robustness: EOF at the reset confirm leaves the stored value untouched', () => {
  withLayers((L) => {
    seed(L, PROJECT_KEY, 'true', 'project');
    const before = fs.readFileSync(L.projectValues, 'utf8');
    const n = pickKey(L, 'reset', PROJECT_KEY);
    const res = tui(L, [RESET, n]);
    assertCleanExit(res, 'EOF at the reset confirm');
    assert.match(res.stdout, /Apply this change\? \[y\/N\]/);
    assert.strictEqual(fs.readFileSync(L.projectValues, 'utf8'), before, 'EOF must not modify the values file');
  });
});

// --- companion README ---

test('companion: a successful write generates bootstrap-prefs.README.md next to the values file and says it is generated output', () => {
  withLayers((L) => {
    const projectRun = tui(L, [EDIT, pickKey(L, 'edit', PROJECT_KEY), '1', 'y', QUIT]);
    assertCleanExit(projectRun);
    const projectReadme = path.join(path.dirname(L.projectValues), 'bootstrap-prefs.README.md');
    assert.ok(fs.existsSync(projectReadme), 'the project companion README was not generated');
    assert.ok(fs.readFileSync(projectReadme, 'utf8').trim().length > 0, 'the project companion README is empty');
    assert.match(
      projectRun.stdout,
      /bootstrap-prefs\.README\.md next to the project values file was regenerated\. It is generated output — read it, never hand-edit it\./
    );
    assert.strictEqual(fs.existsSync(path.join(L.home, '.claude', 'bootstrap-prefs.README.md')), false, 'a project write must not create the global companion');

    const globalRun = tui(L, [EDIT, pickKey(L, 'edit', GLOBAL_KEY, ['--global']), '1', 'y', QUIT], ['--global']);
    assertCleanExit(globalRun);
    assert.ok(fs.existsSync(path.join(L.home, '.claude', 'bootstrap-prefs.README.md')), 'the global companion README was not generated');
    assert.match(globalRun.stdout, /bootstrap-prefs\.README\.md next to the global values file was regenerated\. It is generated output/);
  });
});

// ---- Step 4: scope enforcement (BUG-0009-style refusal) ----
//
// A key's `scope` (global | project | either) decides which layer may hold it. The
// interactive TUI must never OFFER a forbidden layer, and the engine (reached
// directly or through `bootstrap config --set ...`) must refuse one. Only the
// BUG-0009 pin keys are used here: GLOBAL_KEY (scope: global) and PROJECT_KEY
// (scope: project); scope-either keys come from the live schema by property.

// A scratch project checkout that carries a project marker (.git) so an UNPINNED
// run rooted there discovers it. Returns { args, opts } for tui()/pickerNumbers().
function unpinnedInGitProject(L) {
  fs.mkdirSync(path.join(L.projectDir, '.git'), { recursive: true });
  return { args: [], opts: { cwd: L.projectDir } };
}

// Plants `key` in `file` bypassing the scope check (`--target` is scope-exempt),
// the way a hand-edited or legacy values file could hold a scope-inert key.
function plant(L, key, value, file) {
  const res = helper(L, ['--set', key, '--value', value, '--target', file]);
  assert.strictEqual(res.status, 0, `planting ${key} in ${file} failed: ${res.stderr}`);
}

// --- the interactive layer statement/question follows the key's scope ---

test('scope: a scope:global key states the global layer only — no layer question, no project layer text (unpinned)', () => {
  withLayers((L) => {
    assert.strictEqual(SCHEMA_OBJ[GLOBAL_KEY].scope, 'global');
    const u = unpinnedInGitProject(L);
    const n = pickKey(L, 'edit', GLOBAL_KEY, u.args, u.opts);
    const res = tui(L, [EDIT, n, '1', 'y', QUIT], u.args, u.opts);
    assertCleanExit(res, 'an unpinned edit of a global key');
    assert.match(res.stdout, /^Layer: Global layer \(.+bootstrap-prefs\.json\) — applies to every project that has no project answer for the key$/m);
    assert.ok(!res.stdout.includes('Which layer?'), `a single permitted layer must not be asked about:\n${res.stdout}`);
    assert.ok(!res.stdout.includes('Layer: Project layer'), 'the forbidden project layer was mentioned as the layer');
    assert.ok(!res.stdout.includes('This key can live in either layer'), 'a global key must not be described as either-layer');
    assert.match(res.stdout, /--set mcp\.braveSearch --value true --global/);
    assert.ok(!/--set mcp\.braveSearch .*--project/.test(res.stdout), 'the confirm command must not target the project layer');
    assert.deepStrictEqual(readJson(L.globalValues), { [GLOBAL_KEY]: true });
    assert.strictEqual(fs.existsSync(L.projectValues), false, 'the project layer must not be written');
  });
});

test('scope: a scope:project key states the project layer only — no layer question, no global layer text (unpinned)', () => {
  withLayers((L) => {
    assert.strictEqual(SCHEMA_OBJ[PROJECT_KEY].scope, 'project');
    const u = unpinnedInGitProject(L);
    const n = pickKey(L, 'edit', PROJECT_KEY, u.args, u.opts);
    const res = tui(L, [EDIT, n, '1', 'y', QUIT], u.args, u.opts);
    assertCleanExit(res, 'an unpinned edit of a project key');
    assert.match(res.stdout, /^Layer: Project layer \(.+bootstrap-prefs\.json\) — applies to this project only and wins over global, per key$/m);
    assert.ok(!res.stdout.includes('Which layer?'), `a single permitted layer must not be asked about:\n${res.stdout}`);
    assert.ok(!res.stdout.includes('Layer: Global layer'), 'the forbidden global layer was mentioned as the layer');
    assert.ok(!res.stdout.includes('This key can live in either layer'), 'a project key must not be described as either-layer');
    assert.match(res.stdout, /--set mcp\.serena --value true --project /);
    assert.ok(!/--set mcp\.serena .*--global/.test(res.stdout), 'the confirm command must not target the global layer');
    assert.deepStrictEqual(readJson(L.projectValues), { [PROJECT_KEY]: true });
    assert.strictEqual(fs.existsSync(L.globalValues), false, 'the global layer must not be written');
  });
});

test('scope: a scope:either key offers both layers with the "Project wins over global, per key" explanation (unpinned)', () => {
  withLayers((L) => {
    const u = unpinnedInGitProject(L);
    const key = EITHER_SKILL_KEYS[0];
    assert.ok(key, 'no scope-either skill key in the live schema');
    const n = pickKey(L, 'edit', key, u.args, u.opts);
    const res = tui(L, [EDIT, n, '1'], u.args, u.opts);
    assertCleanExit(res, 'EOF at the layer question');
    assert.match(res.stdout, /^This key can live in either layer\. Project wins over global, per key\.$/m);
    const at = res.stdout.indexOf('Which layer?');
    assert.ok(at >= 0, `the layer question was not asked:\n${res.stdout}`);
    const question = res.stdout.slice(at);
    assert.match(question, /^\s+1\) Project\b/m, 'the project layer is not offered');
    assert.match(question, /^\s+2\) Global\b/m, 'the global layer is not offered');
    assert.ok(!res.stdout.includes('Layer: Project layer') && !res.stdout.includes('Layer: Global layer'), 'a two-layer key must not state a single layer');
    assertNothingWritten(L, 'after EOF at the layer question');
  });
});

// --- no project directory: refuse, never fall back to global ---

test('scope: no project directory + a scope:project key — "Cannot edit", aborts before the value picker, never falls back to global', () => {
  withLayers((L) => {
    const cwd = { cwd: L.bareDir };
    const n = pickKey(L, 'edit', PROJECT_KEY, [], cwd);
    const res = tui(L, [EDIT, n, '1', 'y', QUIT], [], cwd);
    assertCleanExit(res, 'refusing a project key with no project directory');
    assert.match(
      res.stdout,
      /Cannot edit mcp\.serena: This key is project-scoped but no project directory was found \(no \.git or \.claude\/ above the current directory and no --project given\)\. Run from a project, or pass --project <dir>\./
    );
    assert.match(res.stdout, /^Nothing was written\.$/m);
    assert.ok(!res.stdout.includes('New value for'), `the refusal must come before the value picker:\n${res.stdout}`);
    assert.ok(!res.stdout.includes('Apply this change?'), 'a refused edit must not reach the confirm');
    assert.strictEqual(fs.existsSync(L.globalValues), false, 'a project-scoped key must NOT fall back to the global layer');
    assertNothingWritten(L, 'after the no-project-directory refusal');
  });
});

test('scope: no project directory — a scope:global key still writes the global layer (positive control)', () => {
  withLayers((L) => {
    const cwd = { cwd: L.bareDir };
    const n = pickKey(L, 'edit', GLOBAL_KEY, [], cwd);
    const res = tui(L, [EDIT, n, '1', 'y', QUIT], [], cwd);
    assertCleanExit(res, 'a global key with no project directory');
    assert.ok(!res.stdout.includes('Cannot edit'), `a global key must not be refused:\n${res.stdout}`);
    assert.deepStrictEqual(readJson(L.globalValues), { [GLOBAL_KEY]: true });
    assert.strictEqual(fs.existsSync(L.projectValues), false, 'no project file may be created');
  });
});

// --- passthrough refusal through `bootstrap config` ---

test('passthrough: `config --set <global key> --project <dir>` exits 1 naming the key, scope: global and --global; nothing is written', () => {
  withLayers((L) => {
    const res = cli(L, ['--set', GLOBAL_KEY, '--value', 'true', '--project', L.projectDir]);
    assert.strictEqual(res.status, 1, res.all);
    assert.ok(res.stderr.includes(GLOBAL_KEY), `stderr does not name the key:\n${res.stderr}`);
    assert.ok(res.stderr.includes('scope: global'), `stderr does not state scope: global:\n${res.stderr}`);
    assert.ok(res.stderr.includes('--global'), `stderr does not point at --global:\n${res.stderr}`);
    assertNothingWritten(L, 'after a refused global-key write into the project layer');
  });
});

test('passthrough: `config --set <project key> --global` exits 1 naming scope: project and --project <dir>; nothing is written', () => {
  withLayers((L) => {
    const res = cli(L, ['--set', PROJECT_KEY, '--value', 'true', '--global']);
    assert.strictEqual(res.status, 1, res.all);
    assert.ok(res.stderr.includes(PROJECT_KEY), `stderr does not name the key:\n${res.stderr}`);
    assert.ok(res.stderr.includes('scope: project'), `stderr does not state scope: project:\n${res.stderr}`);
    assert.ok(res.stderr.includes('--project <dir>'), `stderr does not point at --project <dir>:\n${res.stderr}`);
    assertNothingWritten(L, 'after a refused project-key write into the global layer');
  });
});

test('passthrough: the TUI itself does not accept --set (exit 2, unknown argument) — passthrough is a CLI concern', () => {
  withLayers((L) => {
    const res = tui(L, [], ['--set', GLOBAL_KEY, '--value', 'true', '--project', L.projectDir]);
    assert.strictEqual(res.status, 2, res.all);
    assert.match(res.stderr, /^Error: unknown argument: --set$/m);
    assertNothingWritten(L, 'after the TUI rejected --set');
  });
});

test('passthrough: the CLI exit status and stderr equal the engine\'s own — the wrapper neither swallows nor rewrites the refusal', () => {
  withLayers((L) => {
    const cases = [
      ['--set', GLOBAL_KEY, '--value', 'true', '--project', L.projectDir],
      ['--set', PROJECT_KEY, '--value', 'true', '--global'],
    ];
    for (const args of cases) {
      const direct = helper(L, args);
      const wrapped = cli(L, args);
      assert.strictEqual(direct.status, 1, `the engine should refuse ${args.join(' ')}: ${direct.stderr}`);
      assert.strictEqual(wrapped.status, direct.status, `exit status differs for ${args.join(' ')}`);
      assert.ok(direct.stderr.length > 0, 'the engine refusal printed nothing to stderr');
      assert.strictEqual(wrapped.stderr.trim(), direct.stderr, `stderr differs for ${args.join(' ')}`);
    }
    assertNothingWritten(L, 'after both refusals');
  });
});

// --- --target stays exempt from the scope check ---

test('passthrough: --target is scope-exempt — a global-scope key is written to exactly that file, neither layer is touched', () => {
  withLayers((L) => {
    const target = path.join(L.bareDir, 'scratch-values.json');
    const res = cli(L, ['--set', GLOBAL_KEY, '--value', 'true', '--target', target]);
    assert.strictEqual(res.status, 0, res.all);
    assert.deepStrictEqual(readJson(target), { [GLOBAL_KEY]: true });
    assertNothingWritten(L, 'a --target write must not touch either layer');
  });
});

// --- --unset stays permissive ---

test('passthrough: --unset is permissive — a scope-inert key planted in the WRONG layer can still be removed via the CLI', () => {
  withLayers((L) => {
    // A global-scope key hiding in the PROJECT file.
    plant(L, GLOBAL_KEY, 'true', L.projectValues);
    assert.deepStrictEqual(readJson(L.projectValues), { [GLOBAL_KEY]: true });
    const a = cli(L, ['--unset', GLOBAL_KEY, '--project', L.projectDir]);
    assert.strictEqual(a.status, 0, a.all);
    const afterProject = readJson(L.projectValues);
    assert.ok(!Object.prototype.hasOwnProperty.call(afterProject, GLOBAL_KEY), `the key must be deleted, got ${JSON.stringify(afterProject)}`);

    // A project-scope key hiding in the GLOBAL file.
    plant(L, PROJECT_KEY, 'true', L.globalValues);
    assert.deepStrictEqual(readJson(L.globalValues), { [PROJECT_KEY]: true });
    const b = cli(L, ['--unset', PROJECT_KEY, '--global']);
    assert.strictEqual(b.status, 0, b.all);
    const afterGlobal = readJson(L.globalValues);
    assert.ok(!Object.prototype.hasOwnProperty.call(afterGlobal, PROJECT_KEY), `the key must be deleted, got ${JSON.stringify(afterGlobal)}`);
    for (const file of [L.projectValues, L.globalValues]) {
      assert.ok(!fs.readFileSync(file, 'utf8').includes('null'), 'an unset must never leave a null behind');
    }
  });
});

// KNOWN TUI LIMITATION (contract divergence 2; reported, not patched): a scope-inert
// key planted in the wrong layer is resolved as `[unset]` by the engine's --list, so
// the TUI's reset picker does not offer it — it is named under "Not listed". The
// only way to remove it is `bootstrap config --unset` (asserted above).
test('reset: a scope-inert key planted in the wrong layer is not offered by the TUI (listed under "Not listed")', () => {
  withLayers((L) => {
    plant(L, GLOBAL_KEY, 'true', L.projectValues);
    const { numbers, text } = pickerNumbers(L, 'reset');
    assert.ok(!numbers.has(GLOBAL_KEY), `the scope-inert key must not be offered by reset:\n${text}`);
    assert.match(text, /Not listed — nothing stored in a writable layer \(project\), so there is nothing to reset: .*mcp\.braveSearch \[unset\]/);
  });
});

// ---- Step 5: dynamic families (guides.*, gitignore.section.*) ----
//
// The two schema entries flagged `dynamic` are patterns, not keys: `guides.<name>`
// (one remembered install answer per optional guide, true|false) and
// `gitignore.section.<slug>` (one key per titled .gitignore template section,
// grammar `false` only). Only what test/bootstrap-prefs-tui.test.js does not already
// pin against its fixture schema is asserted here, against the LIVE schema.

const GUIDES_FAMILY = 'guides.*';
const SECTION_FAMILY = 'gitignore.section.*';
const GUIDE_EVALS = 'guides.evals-framework.md';
const GUIDE_TYPECHECK = 'guides.type-checking-templates';
const GUIDES_EMPTY_NOTE =
  'family: one key per optional guide (guides.<name>) holding the remembered install answer for that guide. None stored yet.';
const SECTION_EMPTY_NOTE =
  'family: one key per .gitignore section (gitignore.section.<slug>); each holds only `false`, a permanently declined section. None stored yet.';

// The em-dash banner title of a real template section and the slug the ENGINE
// derives for it (never re-derived here).
function emDashSection(L) {
  const title = templateSectionTitles().find((t) => t.includes(` ${EM_DASH} `));
  assert.ok(title, 'no template section title containing " — " to exercise slug fidelity');
  const res = helper(L, ['--section-key', title]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.startsWith('gitignore.section.'), `unexpected --section-key output: ${res.stdout}`);
  return { title, slug: res.stdout };
}

// --- guides.* ---

test('guides.*: with no concrete keys stored the summary shows the family row and explanation, not a bare literal ".*"', () => {
  withLayers((L) => {
    const res = tui(L, [QUIT]);
    assertCleanExit(res);
    const rows = summaryRows(res.stdout);
    assert.strictEqual(rows.get(GUIDES_FAMILY).shown, 'unset');
    assert.strictEqual(rows.get(GUIDES_FAMILY).layer, 'unset');
    assert.ok(res.stdout.includes(`      ${GUIDES_EMPTY_NOTE}`), `the guides.* explanation line is missing:\n${res.stdout}`);
    assert.ok(!/^ {2}\.\* = /m.test(res.stdout), 'a bare ".*" row was printed');
    assert.ok(![...rows.keys()].some((k) => k.startsWith('guides.') && k !== GUIDES_FAMILY), 'no concrete guides key should be listed');
  });
});

test('guides.*: stored concrete keys are listed individually with their layer, the false as a remembered decline, and the placeholder is gone', () => {
  withLayers((L) => {
    seed(L, GUIDE_EVALS, 'true', 'project');
    seed(L, GUIDE_TYPECHECK, 'false', 'project');
    const res = tui(L, [QUIT]);
    assertCleanExit(res);
    const rows = summaryRows(res.stdout);
    assert.deepStrictEqual(rows.get(GUIDE_EVALS), { shown: 'true', layer: 'project' });
    assert.deepStrictEqual(rows.get(GUIDE_TYPECHECK), { shown: 'false (remembered decline)', layer: 'project' });
    assert.ok(!rows.has(GUIDES_FAMILY), 'the guides.* placeholder row must be replaced by the concrete keys');
    assert.ok(!res.stdout.includes(GUIDES_EMPTY_NOTE), 'the "None stored yet" note must not print once a guide is stored');
    assert.ok(rows.has(SECTION_FAMILY), 'the other family placeholder must be unaffected');
  });
});

test('guides.*: set through the TUI offers exactly true and false, round-trips through the engine, and reset deletes the key (absent, never null)', () => {
  withLayers((L) => {
    const family = pickKey(L, 'edit', GUIDES_FAMILY);
    const res = tui(L, [EDIT, family, 'evals-framework.md', '1', 'y', QUIT]);
    assertCleanExit(res, 'a guides.* set');
    assert.match(res.stdout, /Guide name \(e\.g\. evals-framework\.md or type-checking-templates\), b to go back:/);
    assert.deepStrictEqual(offeredValues(res.stdout), ['true', 'false']);
    assert.match(res.stdout, /--set guides\.evals-framework\.md --value true --project /);
    assert.deepStrictEqual(readJson(L.projectValues), { [GUIDE_EVALS]: true });
    assert.strictEqual(helper(L, ['--get', GUIDE_EVALS, '--project', L.projectDir]).stdout, 'true');
    assert.strictEqual(fs.existsSync(L.globalValues), false, 'the global layer must not be written');

    const resetN = pickKey(L, 'reset', GUIDE_EVALS);
    const reset = tui(L, [RESET, resetN, 'y', QUIT]);
    assertCleanExit(reset, 'a guides.* reset');
    assert.match(reset.stdout, /--unset guides\.evals-framework\.md --project /);
    const stored = readJson(L.projectValues);
    assert.ok(!Object.prototype.hasOwnProperty.call(stored, GUIDE_EVALS), `the key must be deleted, got ${JSON.stringify(stored)}`);
    assert.ok(!fs.readFileSync(L.projectValues, 'utf8').includes('null'), 'a reset must never leave a null behind');
  });
});

test('guides.*: a --global pin is refused by the engine (scope: project) and nothing is written', () => {
  withLayers((L) => {
    const family = pickKey(L, 'edit', GUIDES_FAMILY, ['--global']);
    const res = tui(L, [EDIT, family, 'evals-framework.md', '1', 'y', QUIT], ['--global']);
    assertCleanExit(res, 'a refused global guides.* write');
    assert.match(res.stdout, /--set guides\.evals-framework\.md --value true --global/);
    assert.ok(res.stdout.includes('scope: project'), `the engine refusal (scope: project) was not shown:\n${res.stdout}`);
    assert.match(res.stdout, /^Nothing was written\.$/m);
    assert.ok(!res.stdout.includes('Changed rows'), 'a refused write must not report changed rows');
    assertNothingWritten(L, 'after the refused global guides.* write');
  });
});

test('guides.*: "Enter a key by name" accepts a typed concrete guides key that is not stored, and the ENGINE (not the TUI) rejects an illegal value', () => {
  withLayers((L) => {
    const free = freeEntryNumber(L, 'edit');
    const res = tui(L, [EDIT, free, GUIDE_EVALS, '2', 'y', QUIT]);
    assertCleanExit(res, 'a typed concrete guides key');
    assert.match(res.stdout, /Key name \(b to go back\): /);
    assert.match(res.stdout, /New value for guides\.evals-framework\.md\?/);
    assert.deepStrictEqual(offeredValues(res.stdout), ['true', 'false']);
    assert.deepStrictEqual(readJson(L.projectValues), { [GUIDE_EVALS]: false });
  });
  // Contract divergence 5: `maybe` cannot be typed at the TUI's value picker (only
  // schema values are offered), so the typo is rejected at the engine/CLI.
  withLayers((L) => {
    const bad = cli(L, ['--set', GUIDE_EVALS, '--value', 'maybe', '--project', L.projectDir]);
    assert.strictEqual(bad.status, 1, bad.all);
    assert.ok(
      bad.stderr.includes(`"maybe" is not a legal value for ${GUIDE_EVALS} ${EM_DASH} expected one of: true, false`),
      `the legal-value list is missing:\n${bad.stderr}`
    );
    assertNothingWritten(L, 'after the engine rejected a typo\'d guides value');
  });
});

// --- gitignore.section.* ---

test('gitignore.section.*: an em-dash template title derives, through the TUI, exactly the slug the engine reports and stores it as false', () => {
  withLayers((L) => {
    const { title, slug } = emDashSection(L);
    const family = pickKey(L, 'edit', SECTION_FAMILY);
    const res = tui(L, [EDIT, family, '1', title, '1', 'y', QUIT]);
    assertCleanExit(res, 'a derived gitignore.section.* slug');
    assert.match(res.stdout, /Section banner title \(b to go back\): /);
    assert.ok(res.stdout.includes(`Derived key: ${slug}`), `the TUI did not show "Derived key: ${slug}":\n${res.stdout}`);
    assert.deepStrictEqual(readJson(L.projectValues), { [slug]: false });
    assert.strictEqual(helper(L, ['--get', slug, '--project', L.projectDir]).stdout, 'false');
    assert.strictEqual(summaryRows(changedRowsBlock(res.stdout)).get(slug).shown, 'false (declined section)');
  });
});

test('gitignore.section.*: the grammar is false-only — single-value picker, "never recorded" explanation, engine refuses true and a global pin', () => {
  withLayers((L) => {
    const family = pickKey(L, 'edit', SECTION_FAMILY);
    const res = tui(L, [EDIT, family, '2', 'my-section']);
    assertCleanExit(res, 'EOF at the false-only value picker');
    assert.match(res.stdout, /The only storable value is `false`/);
    assert.match(res.stdout, /an accepted section is deliberately never recorded/);
    assert.match(res.stdout, /gitignore\.section\.my-section has exactly one storable value: false\./);
    assert.deepStrictEqual(offeredValues(res.stdout), ['false']);
    assertNothingWritten(L, 'after only looking at the false-only picker');

    const key = 'gitignore.section.my-section';
    const yes = cli(L, ['--set', key, '--value', 'true', '--project', L.projectDir]);
    assert.strictEqual(yes.status, 1, yes.all);
    assert.ok(yes.stderr.includes('is not a legal value') && yes.stderr.includes('expected one of: false'), yes.stderr);
    assertNothingWritten(L, 'after the engine refused true');

    const global = cli(L, ['--set', key, '--value', 'false', '--global']);
    assert.strictEqual(global.status, 1, global.all);
    assert.ok(global.stderr.includes('scope: project'), `stderr does not state scope: project:\n${global.stderr}`);
    assert.strictEqual(fs.existsSync(L.globalValues), false, 'the global values file must not exist');
    assertNothingWritten(L, 'after the engine refused a global write');

    const no = cli(L, ['--set', key, '--value', 'false', '--project', L.projectDir]);
    assert.strictEqual(no.status, 0, no.all);
    assert.deepStrictEqual(readJson(L.projectValues), { [key]: false });
    assert.strictEqual(fs.existsSync(L.globalValues), false, 'the global layer must stay unwritten');
  });
});

test('gitignore.section.*: a stored false is reset through the TUI — the key is deleted (absent, never null) and the question is asked again', () => {
  withLayers((L) => {
    const { slug } = emDashSection(L);
    seed(L, slug, 'false', 'project');
    const rows = summaryRows(tui(L, [QUIT]).stdout);
    assert.deepStrictEqual(rows.get(slug), { shown: 'false (declined section)', layer: 'project' });
    assert.ok(!rows.has(SECTION_FAMILY), 'the placeholder row must be replaced by the stored slug');

    const n = pickKey(L, 'reset', slug);
    const res = tui(L, [RESET, n, 'y', QUIT]);
    assertCleanExit(res, 'a gitignore.section.* reset');
    assert.match(res.stdout, /will ask that question again\./);
    assert.match(res.stdout, new RegExp(`--unset ${slug.replace(/\./g, '\\.')} --project `));
    const stored = readJson(L.projectValues);
    assert.ok(!Object.prototype.hasOwnProperty.call(stored, slug), `the key must be deleted, got ${JSON.stringify(stored)}`);
    assert.ok(!fs.readFileSync(L.projectValues, 'utf8').includes('null'), 'a reset must never leave a null behind');
    assert.ok(summaryRows(tui(L, [QUIT]).stdout).has(SECTION_FAMILY), 'the empty family placeholder must return once the slug is reset');
  });
});

// --- neighbours of the family prefixes ---

test('families: guidesX.foo and gitignore.sectionX.bar are Unrecognized keys, not guides.* / gitignore.section.* rows (prefix match is anchored on the dot)', () => {
  withLayers((L) => {
    plant(L, 'guidesX.foo', 'x', L.projectValues);
    plant(L, 'gitignore.sectionX.bar', 'x', L.projectValues);
    const res = tui(L, [QUIT]);
    assertCleanExit(res);
    const lines = res.stdout.split('\n');
    const unrec = lines.findIndex((l) => l.startsWith('Unrecognized keys — present in a values file, absent from the schema (kept untouched)'));
    const prompt = lines.findIndex((l) => l.includes('What would you like to do?'));
    assert.ok(unrec >= 0 && prompt > unrec, `no Unrecognized group:\n${res.stdout}`);
    const rows = summaryRows(res.stdout);
    for (const key of ['guidesX.foo', 'gitignore.sectionX.bar']) {
      assert.deepStrictEqual(rows.get(key), { shown: 'x', layer: 'project' }, key);
      const i = lines.findIndex((l) => l.startsWith(`  ${key} = `));
      assert.ok(i > unrec && i < prompt, `${key} is not in the Unrecognized group`);
    }
    // The family placeholders are still the empty-state rows: nothing was claimed by the lookalikes.
    assert.strictEqual(rows.get(GUIDES_FAMILY).shown, 'unset');
    assert.strictEqual(rows.get(SECTION_FAMILY).shown, 'unset');
    assert.ok(res.stdout.includes(GUIDES_EMPTY_NOTE) && res.stdout.includes(SECTION_EMPTY_NOTE), 'a lookalike key must not clear the "None stored yet" notes');
    assert.ok(!res.stdout.includes('(declined section)'), 'gitignore.sectionX.bar must not be described as a declined section');
  });
});
