#!/usr/bin/env node
// Repeatable checks for lib/scripts/bootstrap-prefs-tui.js.
//
// Zero-dependency: node:test + node:assert only, matching test/bootstrap-prefs.test.js.
// Run: npm test   (or: node --test test/bootstrap-prefs-tui.test.js)
//
// SCOPE: the pure helpers (parseValues, resolveEntry, permittedLayers,
// parseListOutput), the menu driven end to end through piped stdin, scope
// enforcement (the engine's BUG-0009 refusal must reach the user and write
// nothing), both dynamic families, and the "engine is the only writer" rule.
//
// HERMETIC — NO TEST MAY READ OR WRITE THE REAL ~/.claude. Every TUI/engine
// process gets a scratch HOME (the engine resolves the global layer with
// os.homedir(), which follows HOME) and a scratch project dir under
// os.tmpdir() with no .git ancestor, passed with `--project`. A scratch schema
// (--schema) keeps menu numbering deterministic and independent of the shipped
// schema, whose contents legitimately change.
//
// SCRIPTING THE MENU: input is a queue of lines, so every answer is a menu
// number. Key-picker numbers are not hardcoded; keyNumber() derives them from
// the engine's real --list output through the module's own buildKeyOptions, so
// the scripts survive a reordering of the fixture. Value pickers, layer pickers
// and the main menu numbers are fixed by the fixture and asserted in comments.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const TUI = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs-tui.js');
const ENGINE = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs.js');
const tui = require(TUI);

const FIXTURE_SCHEMA = {
  'alpha.skill': {
    scope: 'either',
    consumer: 'skill',
    summary: 'How /alpha behaves when it finishes.',
    detail: 'Controls the /alpha command. One of three modes.',
    values: 'auto | confirm | never',
    default: 'auto',
    askedBy: '/alpha',
  },
  'beta.global': {
    scope: 'global',
    consumer: 'installer',
    summary: 'Whether the installer sets up beta.',
    detail: 'Machine-wide installer answer for beta.',
    values: 'true | false',
    default: null,
    askedBy: 'install-global.sh',
  },
  'gamma.project': {
    scope: 'project',
    consumer: 'installer',
    summary: 'Which gamma flavour this project uses.',
    detail: 'Project-only installer answer for gamma.',
    values: 'sibling | dedicated',
    default: null,
    askedBy: 'setup-project.sh',
  },
  'guides.*': {
    scope: 'project',
    consumer: 'installer',
    summary: 'Remembered install answer per optional guide.',
    detail: 'One key per guide, e.g. guides.evals-framework.md or guides.type-checking-templates.',
    values: 'true | false',
    default: null,
    askedBy: 'sync-wiki-scaffold.sh',
    dynamic: true,
  },
  'gitignore.section.*': {
    scope: 'project',
    consumer: 'installer',
    summary: 'Permanently declined .gitignore template sections.',
    detail: 'One key per titled section; only false is ever stored.',
    values: 'false',
    default: null,
    askedBy: 'merge-gitignore.sh',
    dynamic: true,
  },
};

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-tui-'));
}

// A hermetic world: scratch HOME, scratch project, scratch schema.
function world(schemaObj = FIXTURE_SCHEMA) {
  const root = scratchDir();
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  const schemaFile = path.join(root, 'schema-fixture.json');
  fs.writeFileSync(schemaFile, JSON.stringify(schemaObj, null, 2) + '\n');
  return {
    root,
    home,
    project,
    schemaFile,
    env: { ...process.env, HOME: home },
    projectFile: path.join(project, '.claude', 'bootstrap-prefs.json'),
    globalFile: path.join(home, '.claude', 'bootstrap-prefs.json'),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function withWorld(fn, schemaObj) {
  const w = world(schemaObj);
  try {
    return fn(w);
  } finally {
    w.cleanup();
  }
}

// Runs the TUI with `lines` piped to stdin. Default args pin the project layer
// (--project <dir>) and use the scratch schema.
function runTui(w, lines, extraArgs, opts = {}) {
  const args = extraArgs || ['--project', w.project];
  const res = spawnSync(process.execPath, [TUI, ...args, '--schema', w.schemaFile], {
    encoding: 'utf8',
    env: w.env,
    input: `${lines.join('\n')}\n`,
    ...opts,
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, all: res.stdout + res.stderr };
}

function runEngineIn(w, args) {
  const res = spawnSync(process.execPath, [ENGINE, ...args, '--schema', w.schemaFile], {
    encoding: 'utf8',
    env: w.env,
  });
  return { status: res.status, stdout: res.stdout.trim(), stderr: res.stderr.trim() };
}

function listOutput(w) {
  return runEngineIn(w, ['--list', '--project', w.project]).stdout;
}

// The number the key picker shows for `key` (or for the family/free action).
function keyNumber(w, mode, match) {
  const rows = tui.parseListOutput(listOutput(w)).rows;
  const schema = JSON.parse(fs.readFileSync(w.schemaFile, 'utf8'));
  const { options } = tui.buildKeyOptions(rows, schema, { mode, pin: 'project' });
  const idx = options.findIndex(match);
  assert.ok(idx >= 0, `key picker has no matching option (${mode})`);
  return String(idx + 1);
}

const byKey = (key) => (o) => o.action === 'key' && o.key === key;
const byFamily = (pattern) => (o) => o.action === 'family' && o.pattern === pattern;

// Main menu: 1 Edit, 2 Reset, 3 View again, 4 Quit.
const EDIT = '1';
const RESET = '2';
const QUIT = '4';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

test('parseValues: auto | confirm | never yields three options and no ask', () => {
  const values = tui.parseValues({ values: 'auto | confirm | never' });
  assert.deepStrictEqual(values, ['auto', 'confirm', 'never']);
  assert.ok(!values.includes('ask'));
});

test('parseValues: a single value (false) yields one option', () => {
  assert.deepStrictEqual(tui.parseValues({ values: 'false' }), ['false']);
});

test('parseValues: no entry or no values string yields []', () => {
  assert.deepStrictEqual(tui.parseValues(null), []);
  assert.deepStrictEqual(tui.parseValues({}), []);
});

test('parseValues: the shipped gitCommit.versionBump has no separate ask; gitignore.section.* is false only', () => {
  const schema = tui.loadSchema(tui.DEFAULT_SCHEMA);
  const bump = tui.parseValues(tui.resolveEntry(schema, 'gitCommit.versionBump'));
  assert.deepStrictEqual(bump, ['auto', 'confirm', 'never']);
  const section = tui.parseValues(tui.resolveEntry(schema, 'gitignore.section.some-slug'));
  assert.deepStrictEqual(section, ['false']);
});

test('resolveEntry: exact match, pattern row, and both dynamic families by prefix', () => {
  assert.strictEqual(tui.resolveEntry(FIXTURE_SCHEMA, 'alpha.skill'), FIXTURE_SCHEMA['alpha.skill']);
  assert.strictEqual(tui.resolveEntry(FIXTURE_SCHEMA, 'guides.*'), FIXTURE_SCHEMA['guides.*']);
  assert.strictEqual(
    tui.resolveEntry(FIXTURE_SCHEMA, 'guides.evals-framework.md'),
    FIXTURE_SCHEMA['guides.*']
  );
  assert.strictEqual(
    tui.resolveEntry(FIXTURE_SCHEMA, 'gitignore.section.claude-code-machine-local'),
    FIXTURE_SCHEMA['gitignore.section.*']
  );
});

test('resolveEntry: unknown keys and a bare prefix do not match a family', () => {
  assert.strictEqual(tui.resolveEntry(FIXTURE_SCHEMA, 'nope.key'), null);
  assert.strictEqual(tui.resolveEntry(FIXTURE_SCHEMA, 'guides.'), null);
  assert.strictEqual(tui.resolveEntry(FIXTURE_SCHEMA, 'guidesfoo'), null);
});

test('resolveEntry: a non-dynamic pattern-looking key does not act as a family', () => {
  const schema = { 'plain.*': { scope: 'either', consumer: 'installer' } };
  assert.strictEqual(tui.resolveEntry(schema, 'plain.thing'), null);
});

test('permittedLayers: scope project offers the project layer only', () => {
  const r = tui.permittedLayers({ scope: 'project' }, '/p', null);
  assert.deepStrictEqual(r.layers, [{ layer: 'project', args: ['--project', '/p'] }]);
  assert.strictEqual(r.error, null);
});

test('permittedLayers: scope global offers the global layer only', () => {
  const r = tui.permittedLayers({ scope: 'global' }, '/p', null);
  assert.deepStrictEqual(r.layers, [{ layer: 'global', args: ['--global'] }]);
  assert.strictEqual(r.error, null);
});

test('permittedLayers: scope either offers both, project first, when a project exists', () => {
  const r = tui.permittedLayers({ scope: 'either' }, '/p', null);
  assert.deepStrictEqual(
    r.layers.map((l) => l.layer),
    ['project', 'global']
  );
  assert.strictEqual(r.error, null);
});

test('permittedLayers: scope either with no project dir offers global only', () => {
  const r = tui.permittedLayers({ scope: 'either' }, null, null);
  assert.deepStrictEqual(
    r.layers.map((l) => l.layer),
    ['global']
  );
});

test('permittedLayers: scope project with no project dir is an error, never a global fallback', () => {
  const r = tui.permittedLayers({ scope: 'project' }, null, null);
  assert.deepStrictEqual(r.layers, []);
  assert.match(r.error, /project/i);
  assert.match(r.error, /--project/);
});

test('permittedLayers: a pin restricts the result and is kept even against the scope', () => {
  const pinnedProject = tui.permittedLayers({ scope: 'global' }, '/p', 'project');
  assert.deepStrictEqual(
    pinnedProject.layers.map((l) => l.layer),
    ['project']
  );
  const pinnedGlobal = tui.permittedLayers({ scope: 'either' }, '/p', 'global');
  assert.deepStrictEqual(
    pinnedGlobal.layers.map((l) => l.layer),
    ['global']
  );
  const noProject = tui.permittedLayers({ scope: 'either' }, null, 'project');
  assert.deepStrictEqual(noProject.layers, []);
  assert.ok(noProject.error);
});

test('parseArgs: flags, operands, and usage errors', () => {
  assert.deepStrictEqual(
    { ...tui.parseArgs(['--project', '/p', '--schema', '/s']), error: null },
    { help: false, global: false, project: '/p', schema: '/s', pin: 'project', error: null }
  );
  assert.strictEqual(tui.parseArgs(['--global']).pin, 'global');
  assert.ok(tui.parseArgs(['--bogus']).error);
  assert.ok(tui.parseArgs(['--project']).error);
  assert.ok(tui.parseArgs(['--global', '--project', '/p']).error);
});

// ---------------------------------------------------------------------------
// parseListOutput against real engine output
// ---------------------------------------------------------------------------

test('parseListOutput: every layer annotation, the placeholders, and the unrecognized group', () =>
  withWorld((w) => {
    // project layer: alpha.skill; global layer: beta.global; unrecognized in both
    // files' union; the rest stay unset / default.
    assert.strictEqual(
      runEngineIn(w, ['--set', 'alpha.skill', '--value', 'confirm', '--project', w.project]).status,
      0
    );
    assert.strictEqual(runEngineIn(w, ['--set', 'beta.global', '--value', 'false', '--global']).status, 0);
    fs.writeFileSync(w.projectFile, JSON.stringify({ 'alpha.skill': 'confirm', 'mystery.key': 'hello' }));

    const text = listOutput(w);
    const parsed = tui.parseListOutput(text);
    const row = (k) => parsed.rows.find((r) => r.key === k);

    assert.deepStrictEqual(
      [row('alpha.skill').value, row('alpha.skill').layer, row('alpha.skill').group],
      ['confirm', 'project', 'skill']
    );
    assert.deepStrictEqual([row('beta.global').value, row('beta.global').layer], ['false', 'global']);
    assert.strictEqual(row('gamma.project').layer, 'unset');
    assert.strictEqual(row('gamma.project').value, 'unset');
    assert.ok(row('gamma.project').summary.length > 0, 'schema summary line should attach to its row');

    assert.strictEqual(row('guides.*').placeholder, true);
    assert.strictEqual(row('gitignore.section.*').placeholder, true);

    assert.deepStrictEqual(
      parsed.unrecognized.map((r) => [r.key, r.value, r.layer]),
      [['mystery.key', 'hello', 'project']]
    );
    assert.strictEqual(parsed.unrecognized[0].summary, '');
    assert.ok(parsed.groups.map((g) => g.name).includes('installer'));
    assert.ok(parsed.groups.map((g) => g.name).includes('skill'));
    assert.match(parsed.trailer, /^Layers: project \(/);
  }));

test('parseListOutput: default and target annotations, and the no-project trailer', () =>
  withWorld((w) => {
    // `default`: a key with a schema default and nothing stored.
    const noProject = runEngineIn(w, ['--list']);
    const parsed = tui.parseListOutput(noProject.stdout);
    const alpha = parsed.rows.find((r) => r.key === 'alpha.skill');
    assert.strictEqual(alpha.layer, 'default');
    assert.match(parsed.trailer, /^No --project given/);

    // `target`: --target bypasses layer resolution.
    const target = path.join(w.root, 'target.json');
    fs.writeFileSync(target, JSON.stringify({ 'alpha.skill': 'never' }));
    const t = runEngineIn(w, ['--list', '--target', target]);
    const tParsed = tui.parseListOutput(t.stdout);
    const tAlpha = tParsed.rows.find((r) => r.key === 'alpha.skill');
    assert.deepStrictEqual([tAlpha.value, tAlpha.layer], ['never', 'target']);
    assert.match(tParsed.trailer, /^Showing /);
  }));

test('parseListOutput: concrete dynamic-family keys replace the placeholder row', () =>
  withWorld((w) => {
    assert.strictEqual(
      runEngineIn(w, ['--set', 'guides.evals-framework.md', '--value', 'true', '--project', w.project]).status,
      0
    );
    const parsed = tui.parseListOutput(listOutput(w));
    const guides = parsed.rows.filter((r) => r.key.startsWith('guides.'));
    assert.deepStrictEqual(
      guides.map((r) => [r.key, r.value, r.layer, r.placeholder]),
      [['guides.evals-framework.md', 'true', 'project', false]]
    );
  }));

test('parseListOutput: empty and garbage input yield no rows and a null trailer', () => {
  const parsed = tui.parseListOutput('');
  assert.deepStrictEqual(parsed.rows, []);
  assert.strictEqual(parsed.trailer, null);
});

// ---------------------------------------------------------------------------
// End to end: piped stdin drives the menu
// ---------------------------------------------------------------------------

test('e2e: edit a scope-either key to the project layer, then reset it', () =>
  withWorld((w) => {
    const alpha = keyNumber(w, 'edit', byKey('alpha.skill'));

    // Edit: menu 1 -> key -> value 2 (confirm) -> (project layer is pinned, so no
    // layer question) -> y -> Quit.
    const edited = runTui(w, [EDIT, alpha, '2', 'y', QUIT]);
    assert.strictEqual(edited.status, 0, edited.all);
    assert.match(edited.stdout, /SKILL PREFERENCE/);
    assert.match(edited.stdout, /About to run:\n {2}node .*bootstrap-prefs\.js --set alpha\.skill --value confirm --project /);
    assert.match(edited.stdout, /project: alpha\.skill = confirm/);
    assert.match(edited.stdout, /bootstrap-prefs\.README\.md/);
    assert.match(edited.stdout, /never holds a secret/);
    assert.match(edited.stdout, /Done\./);

    // The engine wrote it; verify independently through the engine and the file.
    assert.deepStrictEqual(readJson(w.projectFile), { 'alpha.skill': 'confirm' });
    assert.strictEqual(runEngineIn(w, ['--get', 'alpha.skill', '--project', w.project]).stdout, 'confirm');
    assert.ok(!fs.existsSync(w.globalFile), 'the global file must not be touched');

    // Reset: menu 2 -> the only stored key is number 1 -> y -> Quit.
    const resetNum = keyNumber(w, 'reset', byKey('alpha.skill'));
    const reset = runTui(w, [RESET, resetNum, 'y', QUIT]);
    assert.strictEqual(reset.status, 0, reset.all);
    assert.match(reset.stdout, /--unset alpha\.skill --project /);
    assert.match(reset.stdout, /project: alpha\.skill unset/);
    assert.deepStrictEqual(readJson(w.projectFile), {});
    assert.strictEqual(
      runEngineIn(w, ['--get', 'alpha.skill', '--project', w.project]).stdout,
      'auto',
      'a reset falls back to the schema default'
    );
  }));

test('e2e: the summary prints before the first prompt, grouped and annotated', () =>
  withWorld((w) => {
    const res = runTui(w, [QUIT]);
    assert.strictEqual(res.status, 0, res.all);
    const iSummary = res.stdout.indexOf('Installer preferences');
    const iSkill = res.stdout.indexOf('Skill preferences');
    const iPrompt = res.stdout.indexOf('What would you like to do?');
    assert.ok(iSummary >= 0 && iSkill > iSummary && iPrompt > iSkill, 'summary must precede the menu');
    assert.match(res.stdout, /alpha\.skill = unset \(falls back to auto\)  \[default\]|alpha\.skill = .*\[default/);
    assert.match(res.stdout, /guides\.\* = unset/);
  }));

test('e2e: quit with no changes writes nothing and says so', () =>
  withWorld((w) => {
    const res = runTui(w, [QUIT]);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.stdout, /No changes\./);
    assert.ok(!fs.existsSync(w.projectFile), 'no project values file');
    assert.ok(!fs.existsSync(path.join(w.project, '.claude')), 'no project .claude dir');
    assert.deepStrictEqual(fs.readdirSync(w.home), [], 'scratch HOME stays empty');
  }));

test('e2e: EOF mid-menu exits 0 with "No changes." and writes nothing', () =>
  withWorld((w) => {
    const res = runTui(w, []);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.stdout, /No changes\./);
    assert.ok(!fs.existsSync(path.join(w.project, '.claude')));
    assert.deepStrictEqual(fs.readdirSync(w.home), []);
  }));

test('e2e: declining the y/N confirmation writes nothing', () =>
  withWorld((w) => {
    const alpha = keyNumber(w, 'edit', byKey('alpha.skill'));
    const res = runTui(w, [EDIT, alpha, '1', 'n', QUIT]);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.stdout, /Cancelled\. Nothing was written\./);
    assert.ok(!fs.existsSync(w.projectFile));
  }));

test('e2e: bad input re-prompts instead of crashing (empty, out of range, non-numeric)', () =>
  withWorld((w) => {
    const res = runTui(w, ['', '99', 'abc', QUIT]);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.stdout, /Please enter a number from 1 to 4/);
    assert.match(res.stdout, /No changes\./);
  }));

test('e2e: with no --project flag the layer picker is offered for a scope-either key', () =>
  withWorld((w) => {
    // cwd is a project (has .claude/), no pin -> both layers offered, project first.
    fs.mkdirSync(path.join(w.project, '.claude'));
    const rows = tui.parseListOutput(listOutput(w)).rows;
    const schema = JSON.parse(fs.readFileSync(w.schemaFile, 'utf8'));
    const { options } = tui.buildKeyOptions(rows, schema, { mode: 'edit', pin: null });
    const alpha = String(options.findIndex(byKey('alpha.skill')) + 1);

    // menu 1 -> key -> value 3 (never) -> layer 2 (global) -> y -> Quit
    const res = runTui(w, [EDIT, alpha, '3', '2', 'y', QUIT], [], { cwd: w.project });
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.stdout, /Project wins over global, per key/);
    assert.match(res.stdout, /--set alpha\.skill --value never --global/);
    assert.deepStrictEqual(readJson(w.globalFile), { 'alpha.skill': 'never' });
    assert.ok(!fs.existsSync(w.projectFile), 'the project file must not be written');
  }));

// ---------------------------------------------------------------------------
// Scope enforcement (BUG-0009 style)
// ---------------------------------------------------------------------------

test('scope: editing a scope:global key while the project layer is pinned surfaces the engine refusal and writes nothing', () =>
  withWorld((w) => {
    const beta = keyNumber(w, 'edit', byKey('beta.global'));

    // menu 1 -> beta.global -> value 1 (true) -> y (layer is pinned: project) -> Quit
    const res = runTui(w, [EDIT, beta, '1', 'y', QUIT]);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.all, /"beta\.global" is scope: global/);
    assert.match(res.all, /Nothing was written\./);
    assert.match(res.stdout, /No changes\./);
    assert.ok(!fs.existsSync(w.projectFile), 'no project values file');
    assert.ok(!fs.existsSync(w.globalFile), 'no global values file');
    assert.ok(!fs.existsSync(path.join(w.project, '.claude')));
  }));

test('scope: --global pin refuses a scope:project key the same way', () =>
  withWorld((w) => {
    const rows = tui.parseListOutput(listOutput(w)).rows;
    const schema = JSON.parse(fs.readFileSync(w.schemaFile, 'utf8'));
    const { options } = tui.buildKeyOptions(rows, schema, { mode: 'edit', pin: 'global' });
    const gamma = String(options.findIndex(byKey('gamma.project')) + 1);

    // gamma.project values: sibling | dedicated -> 1; global layer pinned -> y
    const res = runTui(w, [EDIT, gamma, '1', 'y', QUIT], ['--global']);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.all, /"gamma\.project" is scope: project/);
    assert.ok(!fs.existsSync(w.globalFile));
    assert.ok(!fs.existsSync(w.projectFile));
  }));

// ---------------------------------------------------------------------------
// Dynamic families
// ---------------------------------------------------------------------------

test('dynamic: gitignore.section.<slug> accepts false only, via the typed-slug path', () =>
  withWorld((w) => {
    const family = keyNumber(w, 'edit', byFamily('gitignore.section.*'));

    // menu 1 -> family -> "type a slug" (2) -> name -> value 1 (the only value: false) -> y -> Quit
    const res = runTui(w, [EDIT, family, '2', 'my-section', '1', 'y', QUIT]);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.stdout, /only storable value is `false`/);
    assert.match(res.stdout, /exactly one storable value: false/);
    assert.match(res.stdout, /project: gitignore\.section\.my-section = false/);
    assert.match(res.stdout, /gitignore\.section\.my-section = false \(declined section\)/);
    assert.deepStrictEqual(readJson(w.projectFile), { 'gitignore.section.my-section': false });

    // The engine itself refuses anything but false.
    const bad = runEngineIn(w, [
      '--set',
      'gitignore.section.my-section',
      '--value',
      'true',
      '--project',
      w.project,
    ]);
    assert.strictEqual(bad.status, 1);
    assert.match(bad.stderr, /not a legal value/);
    assert.deepStrictEqual(readJson(w.projectFile), { 'gitignore.section.my-section': false });
  }));

test('dynamic: gitignore.section.* derives its slug through the engine --section-key', () =>
  withWorld((w) => {
    const family = keyNumber(w, 'edit', byFamily('gitignore.section.*'));
    const title = 'Claude Code — local MCP files';
    const expected = runEngineIn(w, ['--section-key', title]).stdout;
    assert.match(expected, /^gitignore\.section\.claude-code-local-mcp-files$/);

    // menu 1 -> family -> "derive" (1) -> title -> value 1 -> y -> Quit
    const res = runTui(w, [EDIT, family, '1', title, '1', 'y', QUIT]);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.stdout, new RegExp(`Derived key: ${expected.replace(/\./g, '\\.')}`));
    assert.deepStrictEqual(readJson(w.projectFile), { [expected]: false });
  }));

test('dynamic: a stored guides.<name> round-trips through edit, the summary, and reset', () =>
  withWorld((w) => {
    const family = keyNumber(w, 'edit', byFamily('guides.*'));

    // menu 1 -> family -> guide name (schema example shown) -> value 1 (true) -> y -> Quit
    const res = runTui(w, [EDIT, family, 'evals-framework.md', '1', 'y', QUIT]);
    assert.strictEqual(res.status, 0, res.all);
    assert.match(res.stdout, /Guide name \(e\.g\. evals-framework\.md/);
    assert.match(res.stdout, /project: guides\.evals-framework\.md = true/);
    assert.deepStrictEqual(readJson(w.projectFile), { 'guides.evals-framework.md': true });
    assert.strictEqual(
      runEngineIn(w, ['--get', 'guides.evals-framework.md', '--project', w.project]).stdout,
      'true'
    );

    // A fresh session lists the stored key individually and keeps the family action.
    const again = runTui(w, [QUIT]);
    assert.match(again.stdout, /guides\.evals-framework\.md = true {2}\[project\]/);
    assert.doesNotMatch(again.stdout, /guides\.\* = unset/);

    // Reset it: the stored key is the only stored row.
    const resetNum = keyNumber(w, 'reset', byKey('guides.evals-framework.md'));
    const reset = runTui(w, [RESET, resetNum, 'y', QUIT]);
    assert.strictEqual(reset.status, 0, reset.all);
    assert.match(reset.stdout, /--unset guides\.evals-framework\.md --project /);
    assert.deepStrictEqual(readJson(w.projectFile), {});
  }));

// ---------------------------------------------------------------------------
// Engine is the only writer
// ---------------------------------------------------------------------------

test('the TUI module never writes a values file or README itself', () => {
  const src = fs.readFileSync(TUI, 'utf8');
  // Strip line comments so the header prose that names the rule does not trip the checks.
  const code = src
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  assert.doesNotMatch(code, /\b(writeFileSync|writeFile|appendFileSync|appendFile|renameSync|rename|createWriteStream|unlinkSync|rmSync|mkdirSync|copyFileSync)\b/);
  assert.doesNotMatch(code, /require\(\s*['"]\.\/bootstrap-prefs(\.js)?['"]\s*\)/);
  assert.match(code, /spawnSync\(process\.execPath, \[ENGINE/);
});
