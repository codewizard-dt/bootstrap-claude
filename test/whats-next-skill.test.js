#!/usr/bin/env node
// Contract checks for TASK-0126's cross-family survey skill:
// lib/skills/whats-next/SKILL.md. Zero-dependency: node:test +
// node:assert/strict only, mirroring test/assess-skills-contract.test.js.
//
// Run: node --test test/whats-next-skill.test.js
//
// WHY THIS IS TESTED AT ALL. Skills are markdown-as-program: the SKILL.md IS
// what a future agent executes, so a drifted phrase is a silent behaviour
// change and nothing can be verified by running it. /whats-next is the one
// skill that ranks ALL open work across every family, and it is meant to be
// STRICTLY read-only (stricter than roadmap-assess / bug-assess: no prompts, no
// auto-close, no log or index write, no handoff to another skill). This suite
// pins: (1) the frontmatter tier equals roadmap-assess's (read from that file
// at test time, never hardcoded); (2) the Prereqs grammar; (3) the read-only
// contract - Constraints block, the permitted-tools line, no log/index append,
// the "never run a Unit Test Command" sentence; (4) shared docs are pointed at
// by path rather than restated; (5) the verified Serena sweep pitfalls stay
// encoded in the text (a regression there silently returns nothing or floods
// the context); (6) the five ranking tiers, in order, then the Blocked list,
// and roadmap membership stated as NOT a ranking input; (7) the
// start-satisfied vs close-satisfied dependency rule; (8) every suggested
// `/command` resolves to a real skill; (9) the three registration rows.
//
// SCOPE - repo-local files only. The machine-local ~/.claude/skills/ copy is
// deliberately not inspected.
//
// HERMETIC: read-only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO, 'lib', 'skills');
const NAME = 'whats-next';

function skillPath(name) {
  return path.join(SKILLS_DIR, name, 'SKILL.md');
}

function readFile(p) {
  assert.ok(fs.existsSync(p), `${path.relative(REPO, p)} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function readSkill(name) {
  return readFile(skillPath(name));
}

// Splits a SKILL.md into the frontmatter map (between the first two `---`
// lines) and the body that follows it.
function splitFrontmatter(text) {
  const all = text.split('\n');
  assert.equal(all[0].trim(), '---', 'file must open with a --- frontmatter fence');
  const close = all.indexOf('---', 1);
  assert.ok(close > 0, 'frontmatter has no closing --- fence');
  const fm = {};
  for (const line of all.slice(1, close)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return { fm, body: all.slice(close + 1).join('\n') };
}

// Text of a `## <heading>` section, up to the next `## ` heading.
function sectionText(body, headingRe) {
  const idx = body.search(headingRe);
  assert.ok(idx >= 0, `missing section matching ${headingRe}`);
  const rest = body.slice(idx).split('\n').slice(1).join('\n');
  const next = rest.search(/^## /m);
  return next >= 0 ? rest.slice(0, next) : rest;
}

const PREREQS_GRAMMAR =
  /^\*\*Prereqs:\*\* obey `wiki\/guides\/mcp-tools\.md`( \+ `wiki\/work\/(tasks|bugs|uat)\/lifecycle\.md`)?(; run \/primer if not done this session)?\.$/;

const TEXT = readSkill(NAME);
const { fm: FM, body: BODY } = splitFrontmatter(TEXT);
const MODEL = splitFrontmatter(readSkill('roadmap-assess')).fm;

// ---- 1. Frontmatter contract ---------------------------------------------

test('whats-next: SKILL.md exists and name equals the directory name', () => {
  assert.ok(fs.existsSync(skillPath(NAME)), 'lib/skills/whats-next/SKILL.md missing');
  assert.equal(FM.name, NAME);
});

test('whats-next: tier keys equal roadmap-assess frontmatter', () => {
  for (const key of ['category', 'model', 'disable-model-invocation', 'user-invocable']) {
    assert.ok(MODEL[key] !== undefined, `roadmap-assess has no ${key}`);
    assert.equal(FM[key], MODEL[key], `${key} must match roadmap-assess`);
  }
});

test('whats-next: argument-hint present', () => {
  assert.ok(FM['argument-hint'], 'argument-hint missing');
  assert.match(FM['argument-hint'], /--limit/);
  assert.match(FM['argument-hint'], /--family/);
});

test('whats-next: description starts "Survey ALL open work"', () => {
  assert.ok(FM.description, 'description missing');
  assert.ok(FM.description.startsWith('Survey ALL open work'), `got: ${FM.description}`);
});

// ---- 2. Prereqs grammar --------------------------------------------------

test('whats-next: first body line is a Prereqs line matching the boilerplate grammar', () => {
  const first = BODY.split('\n').find((l) => l.trim() !== '');
  assert.match(first, PREREQS_GRAMMAR);
  const lifecycleRefs = first.match(/wiki\/work\/[a-z]+\/lifecycle\.md/g) || [];
  assert.equal(lifecycleRefs.length, 1, 'only one lifecycle.md reference is legal');
});

// ---- 3. Read-only contract -----------------------------------------------

test('whats-next: Constraints block declares Read-only', () => {
  const c = sectionText(BODY, /^## Constraints\s*$/m);
  assert.ok(c.includes('Read-only'), 'Constraints must contain "Read-only"');
});

test('whats-next: Permitted tools line lists exactly the four read tools', () => {
  const c = sectionText(BODY, /^## Constraints\s*$/m);
  const line = c.split('\n').find((l) => l.includes('Permitted tools:'));
  assert.ok(line, 'missing "Permitted tools:" line');
  const tools = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  assert.deepEqual(tools, ['list_dir', 'find_file', 'search_for_pattern', 'Read']);
  assert.doesNotMatch(line, /\b(AskUserQuestion|Skill|Edit|Write|Bash)\b/);
});

test('whats-next: never instructs an append to wiki/log.md or an index file', () => {
  const offenders = TEXT.split('\n').filter((l) => /(append|add).*(wiki\/log\.md|index\.md)/i.test(l));
  assert.deepEqual(offenders, []);
});

test('whats-next: carries the "never run a case\'s Unit Test Command" sentence', () => {
  assert.match(TEXT, /never run a case.s `?Unit Test Command`?/i);
});

test('whats-next: does not define a --go flag', () => {
  assert.doesNotMatch(FM['argument-hint'], /--go/);
});

// ---- 4. Shared docs pointed at, not restated -----------------------------

test('whats-next: references the ID-RESOLUTION.md Family table by path', () => {
  assert.ok(TEXT.includes('lib/skills/_shared/ID-RESOLUTION.md'), 'must cite lib/skills/_shared/ID-RESOLUTION.md');
  assert.match(TEXT, /Family table/);
  const offenders = TEXT.split('\n').filter((l) => l.includes('PREFIX-<pad4>') && l.includes('find_file'));
  assert.deepEqual(offenders, [], 'must not restate the mask algorithm');
});

test("whats-next: references roadmap-next's Parse a roadmap procedure by path and does not copy it", () => {
  assert.ok(TEXT.includes('lib/skills/roadmap-next/SKILL.md'), 'must cite lib/skills/roadmap-next/SKILL.md');
  assert.ok(TEXT.includes('Parse a roadmap'), 'must name the "Parse a roadmap" procedure');
  assert.ok(!TEXT.includes('candidate_items'), 'must not restate the procedure (candidate_items)');
  assert.ok(!TEXT.includes('capped at 9'), 'must not restate the procedure (candidate cap)');
  assert.doesNotMatch(TEXT, /## Phase N/, 'must not restate the procedure (phase parsing)');
});

// ---- 5. Sweep pitfalls encoded -------------------------------------------

test('whats-next: sweep pitfalls are encoded', () => {
  assert.ok(TEXT.includes('[^\\n]*'), 'missing the [^\\n]* pattern');
  assert.match(TEXT, /never `\.\*`/i, 'must warn against `.*`');
  assert.match(TEXT, /multiline=false/, 'must warn about multiline=false with ^ anchors');
  assert.ok(TEXT.includes('wiki/work/tasks/TASK-*.md'), 'missing full-path glob example');
  assert.match(TEXT, /full repo-relative path/i);
  assert.ok(TEXT.includes('archive/'), 'missing archive/ exclusion');
  assert.match(TEXT, /paths_exclude_glob/);
  assert.match(TEXT, /empty sweep[^\n]*WARNING/i, 'missing the empty-sweep warning');
  assert.match(TEXT, /Sweep by frontmatter, never by index text/i);
});

// ---- 6. Tier order & roadmap membership ----------------------------------

test('whats-next: five tiers appear in order, then the Blocked list', () => {
  const step3 = sectionText(BODY, /^## Step 3:/m);
  const order = ["Fix what's broken", "Finish what's started", 'Unblock', 'Start ready work', 'Triage & hygiene', 'Blocked'];
  let pos = -1;
  for (const name of order) {
    const at = step3.indexOf(name, pos + 1);
    assert.ok(at > pos, `tier "${name}" missing or out of order in Step 3`);
    pos = at;
  }
  assert.match(step3, /never a numeric score/i);
});

test('whats-next: roadmap membership is stated as not a ranking input', () => {
  assert.match(TEXT, /roadmap membership is a display column, not a ranking input/i);
});

// ---- 7. Dependency semantics ---------------------------------------------

test('whats-next: start-satisfied vs close-satisfied rule and pending-uat are named', () => {
  assert.match(TEXT, /start-satisfied/i);
  assert.match(TEXT, /close-satisfied/i);
  assert.match(TEXT, /soft-blocked/i);
  const step2 = sectionText(BODY, /^## Step 2:/m);
  assert.match(step2, /`pending-uat`/, 'Step 2 must name pending-uat in the rule');
  assert.match(step2, /start-satisfied[^\n]*`pending-uat`[^\n]*`done`/i);
});

// ---- 8. Next-command contract --------------------------------------------

test('whats-next: every suggested /command resolves to an existing skill', () => {
  // Token must sit at line start or after whitespace / backtick / open paren,
  // and must not continue into a path (`/`) or a file extension (`.md`).
  const re = /(?<![^\s`(])\/([a-z][a-z0-9-]*)/g;
  const found = new Set();
  let m;
  while ((m = re.exec(BODY)) !== null) {
    const next = BODY[m.index + m[0].length];
    const after = BODY[m.index + m[0].length + 1];
    if (next === '/') continue; // path-like hit
    if (next === '.' && after && /\w/.test(after)) continue; // file-like hit
    found.add(m[1]);
  }
  assert.ok(found.size > 0, 'no suggested commands found');
  for (const cmd of found) {
    assert.ok(fs.existsSync(skillPath(cmd)), `/${cmd} has no lib/skills/${cmd}/SKILL.md`);
  }
  const expected = [
    'tackle', 'uat-auto', 'uat-walk', 'uat-create', 'bug-assess', 'bug-triage', 'task-create',
    'bug-close', 'adr-finalize', 'adr-extract', 'prd-finalize', 'roadmap-next',
  ];
  for (const cmd of expected) {
    assert.ok(found.has(cmd), `expected /${cmd} among suggested commands (got: ${[...found].join(', ')})`);
  }
  assert.ok(!found.has('power-mode') || fs.existsSync(skillPath('power-mode')), '/power-mode must resolve');
});

// ---- 9. Registration contract --------------------------------------------

test('whats-next: registered in lib/skills/README.md', () => {
  const t = readFile(path.join(SKILLS_DIR, 'README.md'));
  assert.match(t, new RegExp('^\\| `' + NAME + '` \\|', 'm'));
});

test('whats-next: registered in CLAUDE.md Custom Commands', () => {
  const t = readFile(path.join(REPO, 'CLAUDE.md'));
  // The command cell may carry an argument hint: | `/whats-next [--limit N] ...` |
  assert.match(t, new RegExp('^\\| `/' + NAME + '[ `][^|]*\\|', 'm'));
});

test('whats-next: listed on the researching line of the Serena skills memory', () => {
  const t = readFile(path.join(REPO, '.serena', 'memories', 'skills', 'format-and-model-selection.md'));
  const line = t.split('\n').find((l) => l.includes('**researching**'));
  assert.ok(line, 'no **researching** line in the memory');
  assert.ok(line.includes('`' + NAME + '`'), `${NAME} not on the researching line`);
});
