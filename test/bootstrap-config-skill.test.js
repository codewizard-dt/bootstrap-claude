#!/usr/bin/env node
// Contract checks for lib/skills/bootstrap-config/SKILL.md — the user-facing
// front end to the preference store (ROADMAP-005 Phase 3, TASK-048).
//
// Zero-dependency: node:test + node:assert only, matching test/bootstrap-prefs.test.js
// and test/prompt-stickiness.test.js.
// Run: npm test   (or: node --test test/)
//
// WHY A SKILL FILE IS TESTED AT ALL. The markdown IS the program — a model
// executes these instructions, so a wrong flag, an invented value, or a stale
// claim is a real defect with no compiled artefact to catch it. There is no
// type checker for prose, and the failure mode is silent: the skill runs, the
// helper rejects the command, and the user sees a raw error from a tool they
// did not invoke.
//
// SCOPE — THE SKILL'S CLAIMS ABOUT THE HELPER AND THE SCHEMA, and nothing else.
// The helper's own CLI surface belongs to test/bootstrap-prefs.test.js and the
// installer prompt layer to test/prompt-stickiness.test.js. What is unique here
// is the JOIN: every flag the skill spells must exist, every value it offers
// must come from the schema, and every factual claim it makes about the
// helper's behaviour must still be true. Those three drift independently of the
// skill and nothing else notices.
//
// HERMETIC: reads files and runs the helper read-only or against scratch dirs.
// No test may read or write the real ~/.claude/bootstrap-prefs.json.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SKILL = path.join(REPO, 'lib', 'skills', 'bootstrap-config', 'SKILL.md');
const HELPER = path.join(REPO, 'lib', 'scripts', 'bootstrap-prefs.js');
const SCHEMA = path.join(REPO, 'lib', 'scripts', 'templates', 'bootstrap-prefs-schema.json');

function skillText() {
  assert.ok(fs.existsSync(SKILL), `${SKILL} does not exist — TASK-048's single deliverable is missing`);
  return fs.readFileSync(SKILL, 'utf8');
}

function schemaObj() {
  return JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
}

/** Run the helper with a scratch HOME so no test can reach the real store. */
function helper(args, extraEnv = {}) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-config-skill-')));
  try {
    const r = spawnSync(process.execPath, [HELPER, ...args], {
      encoding: 'utf8',
      env: { HOME: home, PATH: process.env.PATH, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', home };
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

test('bootstrap-config: frontmatter matches the specified keys and values exactly', () => {
  const text = skillText();
  const expected = [
    '---',
    'name: bootstrap-config',
    'description: View, edit, and reset the stored bootstrap preferences that decide which installer prompts are asked and how consent-gated skills behave',
    'category: executing',
    'model: claude-haiku-4-5-20251001',
    'argument-hint: [view | edit | reset] [--global | --project]',
    'disable-model-invocation: false',
    'user-invocable: true',
    '---',
  ];
  const actual = text.split('\n').slice(0, expected.length);
  assert.deepEqual(
    actual,
    expected,
    'the frontmatter drifted. `name` is how the command is invoked and `user-invocable` is what makes it ' +
      'appear at all, so a change here silently removes the command rather than altering it'
  );
});

test('bootstrap-config: line 10 is the short Prereqs form', () => {
  const lines = skillText().split('\n');
  assert.equal(
    lines[9],
    '**Prereqs:** obey `wiki/guides/mcp-tools.md`.',
    'line 10 is not the Prereqs line. serena-config is the structural template and carries it at the same ' +
      'position; the /primer clause is deliberately absent here because this command reads no codebase'
  );
});

// ---------------------------------------------------------------------------
// The join: skill -> helper
// ---------------------------------------------------------------------------

test('bootstrap-config: every helper flag the skill spells actually exists in the helper', () => {
  const text = skillText();
  const usage = helper(['--nonexistent-flag']).stderr + helper(['--nonexistent-flag']).stdout;

  // Only flags written as part of a `node <helper> ...` invocation count —
  // prose mentions of "--project" are covered by the same set, and a flag the
  // helper does not know is a hard usage error at run time.
  const invocations = text.split('\n').filter((l) => /node\s+<helper>/.test(l));
  assert.ok(invocations.length > 0, 'the skill contains no `node <helper> ...` invocations at all');

  const flags = new Set();
  for (const line of invocations) {
    for (const m of line.matchAll(/\s(--[a-z-]+)/g)) flags.add(m[1]);
  }
  assert.ok(flags.size > 0, 'no flags were extracted from the skill\'s helper invocations');

  for (const flag of flags) {
    assert.ok(
      usage.includes(flag),
      `the skill invokes \`${flag}\`, which does not appear in the helper's usage block — the command would ` +
        `fail at run time with a usage error the user never asked for`
    );
  }
});

test('bootstrap-config: --set and --unset are always shown with exactly one layer selector', () => {
  const text = skillText();
  const selectors = ['--global', '--project', '--target'];

  for (const line of text.split('\n')) {
    if (!/node\s+<helper>\s+--(set|unset)\b/.test(line)) continue;
    const count = selectors.filter((s) => line.includes(s)).length;
    assert.equal(
      count,
      1,
      `a --set/--unset example carries ${count} layer selectors, not exactly one. Zero and two are both ` +
        `usage errors — the helper refuses to guess which file to write:\n${line}`
    );
  }

  // And the helper really does refuse, in both directions.
  const zero = helper(['--set', 'gitCommit.autoPush', '--value', 'true']);
  assert.equal(zero.status, 1, 'the helper accepted --set with no layer selector');
  assert.match(
    zero.stderr,
    /--set requires exactly one of --global, --project <dir>, --target <path>/,
    'the helper\'s zero-selector error text changed; the skill quotes this contract'
  );
});

test('bootstrap-config: the layer annotations the skill names are the ones --list emits', () => {
  const text = skillText();
  // The skill tells the reader to carry these through verbatim, so an invented
  // one would have the user looking for a bracket that never appears.
  for (const layer of ['[project]', '[global]', '[default]', '[unset]', '[target]']) {
    assert.ok(text.includes(layer), `the skill omits the ${layer} annotation`);
  }

  const helperSrc = fs.readFileSync(HELPER, 'utf8');
  for (const layer of ['project', 'global', 'default', 'unset', 'target']) {
    assert.ok(
      new RegExp(`'${layer}'`).test(helperSrc),
      `the skill promises a [${layer}] annotation the helper never produces`
    );
  }
});

test('bootstrap-config: the abort message for a missing helper is present verbatim', () => {
  const text = skillText();
  assert.ok(
    text.includes(
      'No bootstrap preference helper found. Run `npx @codewizard-dt/bootstrap update` ' +
        '(or `./lib/scripts/install-global.sh --skip-mcps`) to install it, then re-run `/bootstrap-config`.'
    ),
    'the exact abort message is missing or reworded. It names the two commands that fix the situation, and a ' +
      'vaguer message leaves the user with a dead command and no next step'
  );
});

// ---------------------------------------------------------------------------
// The join: skill -> schema
// ---------------------------------------------------------------------------

test('bootstrap-config: the consumer: skill population named in the skill matches the schema exactly', () => {
  const text = skillText();
  const schema = schemaObj();

  const fromSchema = Object.entries(schema)
    .filter(([, e]) => e && typeof e === 'object' && e.consumer === 'skill')
    .map(([k]) => k)
    .sort();

  // The skill names the population inline in Step D so it can attach the heavier
  // warning banner. A key that gained `consumer: skill` and was not added here
  // would silently get the LIGHTER framing — "only affects prompting" — for a
  // change that alters what a slash command does.
  const stepD = text.slice(text.indexOf('## Step D'), text.indexOf('## Step E'));
  for (const key of fromSchema) {
    assert.ok(
      stepD.includes(key),
      `${key} is consumer: skill in the schema but is not in the skill's Step D population list, so it would ` +
        `be presented with the lighter "only affects prompting" framing`
    );
  }

  // And nothing extra: a key listed here that is NOT consumer: skill would
  // over-warn, training the user to ignore the banner.
  for (const m of stepD.matchAll(/`([a-zA-Z]+\.[a-zA-Z.]+)`/g)) {
    const key = m[1];
    if (!Object.prototype.hasOwnProperty.call(schema, key)) continue;
    if (schema[key].dynamic === true) continue;
    assert.equal(
      schema[key].consumer,
      'skill',
      `Step D presents ${key} as a skill preference, but the schema says consumer: ${schema[key].consumer}`
    );
  }
});

test('bootstrap-config: every value the skill offers traces back to a schema `values` string', () => {
  const text = skillText();
  const schema = schemaObj();

  // The two grammars the skill calls out by name. Both are traps the skill
  // exists to prevent, so both must match the schema rather than prose memory.
  const claims = {
    'gitCommit.versionBump': 'auto | confirm | never',
    'gitignore.section.*': 'false',
  };

  for (const [key, expected] of Object.entries(claims)) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(schema, key),
      `${key} is quoted by the skill but is not in the schema`
    );
    assert.equal(
      schema[key].values,
      expected,
      `the skill states ${key} = \`${expected}\`, but the schema says \`${schema[key].values}\`. The schema is ` +
        `the single source of truth and the helper validates against it, so the skill would offer an option ` +
        `guaranteed to exit 1`
    );
    assert.ok(text.includes(expected), `the skill no longer quotes the ${key} grammar \`${expected}\``);
  }

  // The `confirm`-is-the-ask-state rule, asserted as behaviour and not just as
  // prose: offering a separate `ask` produces a hard failure.
  const rejected = helper(['--set', 'gitCommit.versionBump', '--value', 'ask', '--global']);
  assert.equal(rejected.status, 1, 'the helper accepted `ask` for gitCommit.versionBump');

  // gitignore.section.* is false-only: a remembered `true` would let a later
  // template version append to a project's .gitignore without asking.
  const widened = helper(['--set', 'gitignore.section.example', '--value', 'true', '--global']);
  assert.equal(widened.status, 1, 'the helper accepted `true` for a gitignore.section.* key');
});

test('bootstrap-config: `unset` and `null` are refused as values, with the pointer the skill promises', () => {
  // Absence is the entire representation of unset. The skill tells the user the
  // helper refuses these and points at --unset; if that stopped being true the
  // skill would be teaching a workaround for a problem that no longer exists,
  // or worse, hiding one that does.
  for (const value of ['unset', 'null']) {
    const r = helper(['--set', 'gitCommit.autoPush', '--value', value, '--global']);
    assert.equal(r.status, 1, `the helper accepted --value ${value}`);
    assert.match(
      r.stderr,
      /is not a storable value — absence is how a key is unset/,
      `the refusal message for --value ${value} changed`
    );
    assert.match(r.stderr, /--unset gitCommit\.autoPush/, `the refusal for ${value} no longer points at --unset`);
  }

  const text = skillText();
  assert.ok(
    /literal values `unset` and `null` are refused/.test(text),
    'the skill no longer documents the unset/null refusal'
  );
});

// ---------------------------------------------------------------------------
// --set now enforces scope itself (BUG-0009) — the skill's Step E.2 layer
// offer is a UX nicety on top of that, not the only guard. The tripwire that
// used to pin the pre-fix claim ("--set does not enforce scope") was deleted
// here, per its own instruction, once the helper was fixed and the skill text
// updated to match.
// ---------------------------------------------------------------------------

test('bootstrap-config: --set genuinely refuses a global-scope key written into a project layer (BUG-0009)', () => {
  // mcp.braveSearch is scope: global. Writing it into a PROJECT file is exactly
  // the inert state the skill's Step E.2 exists to avoid offering — now backed
  // by the helper's own refusal, not just the skill's layer choice.
  const schema = schemaObj();
  assert.equal(schema['mcp.braveSearch'].scope, 'global', 'mcp.braveSearch is no longer a global-scope key');

  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-config-scope-home-')));
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-config-scope-proj-')));
  try {
    const env = { HOME: home, PATH: process.env.PATH };
    const wrote = spawnSync(
      process.execPath,
      [HELPER, '--set', 'mcp.braveSearch', '--value', 'true', '--project', proj],
      { encoding: 'utf8', env }
    );
    assert.equal(
      wrote.status,
      1,
      'the helper accepted a global-scope key written into a project layer — BUG-0009 regressed'
    );
    assert.ok(
      !fs.existsSync(path.join(proj, '.claude', 'bootstrap-prefs.json')),
      'a rejected --set still created the project values file'
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(proj, { recursive: true, force: true });
  }
});

test('bootstrap-config: the two safety rules are stated, and stated BEFORE the first AskUserQuestion', () => {
  // Both rules are the serena-config inheritance and both have a silent failure
  // mode. Prompting against an unread store produces a confident question about
  // state nobody looked at; writing the values file directly bypasses value
  // validation, true/false JSON coercion, atomic writes, and the regenerated
  // companion all at once.
  const text = skillText();

  const orderingIdx = text.indexOf('**CRITICAL ORDERING RULE**');
  assert.ok(orderingIdx > 0, 'the CRITICAL ORDERING RULE is missing');

  const writesIdx = text.indexOf('**Writes go through the helper.**');
  assert.ok(writesIdx > 0, 'the "Writes go through the helper" rule is missing');

  const firstAsk = text.indexOf('AskUserQuestion');
  assert.ok(firstAsk > 0, 'the skill never mentions AskUserQuestion at all');
  assert.ok(
    orderingIdx < firstAsk,
    'the ordering rule appears AFTER the first AskUserQuestion mention — a reader following the file top-down ' +
      'would reach the prompt before the rule forbidding it'
  );

  // The mandatory escape hatch. serena-config always offers it, and without it
  // a user who opened the command to look has no way out that writes nothing.
  assert.ok(
    /`No changes`[^\n]*exit without writing anything/.test(text),
    'the mandatory "No changes" option is missing or no longer promises to write nothing'
  );
});

test('bootstrap-config: install-global.sh --skip-mcps syncs the skill into a redirected ~/.claude/skills/', () => {
  // TASK-048 step 12's DEFERRED-TO-UAT item. Run against a SCRATCH HOME — never
  // the developer's real ~/.claude/skills/, which is theirs to update when they
  // choose. What this proves is that the sync mechanism picks the new skill up;
  // whether it is live on any particular machine is that machine's business.
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-config-live-')));
  try {
    const r = spawnSync('bash', [path.join(REPO, 'lib', 'scripts', 'install-global.sh'), '--skip-mcps'], {
      encoding: 'utf8',
      env: { HOME: home, PATH: process.env.PATH },
      cwd: home,
      input: '',
    });
    assert.equal(r.status, 0, `install failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

    const installed = path.join(home, '.claude', 'skills', 'bootstrap-config', 'SKILL.md');
    assert.ok(
      fs.existsSync(installed),
      `the sync did not deliver bootstrap-config to ${installed} — the skill would not be offered even after ` +
        `the user runs the installer`
    );
    assert.equal(
      fs.readFileSync(installed, 'utf8'),
      skillText(),
      'the installed copy differs from the repo source'
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('bootstrap-config: the skill directory holds exactly the one file TASK-048 was scoped to create', () => {
  const dir = path.dirname(SKILL);
  const entries = fs.readdirSync(dir).sort();
  assert.deepEqual(
    entries,
    ['SKILL.md'],
    'lib/skills/bootstrap-config/ holds something other than SKILL.md. TASK-048 was scoped to one file; an ' +
      'extra file here is unreviewed scope'
  );
});
