#!/usr/bin/env node
// Contract checks for TASK-0121: roadmaps, decisions (ADRs) and requirements (PRDs)
// close IN PLACE instead of being archived. Zero-dependency: node:test +
// node:assert only, same style as test/archive-work-item.test.js.
//
// Run: npm test   (or: node --test test/in-place-close.test.js)
//
// WHY THIS IS TESTED AT ALL. The SKILL.md / shared-doc markdown IS the program a
// future agent executes. TASK-0097 wired one "archive a work item" procedure
// (`git mv` into archive/, append archive/index.md) for every family; TASK-0121
// narrowed it to tasks/uat/bugs and added a separate in-place-close mechanic
// (status flip + move the family-index row from `## Active` to `## Closed`, no
// `git mv`, no archive/). The risks this pins: (a) the shared doc keeps the
// in-place section and never regrows a `git mv` in it, and its archive `Inputs`
// stay narrowed to tasks/uat/bugs; (b) no roadmap/decision/requirement closer
// quietly regrows `git mv wiki/work/<in-place family>` or an
// `<in-place family>/archive/index.md` append; (c) the wiki-archive / wiki-tidy
// sweeps do not list the in-place families as sweep targets; (d) the two copies
// of each in-place lifecycle.md (template = source of truth, and this repo's
// local copy) stay byte-identical and describe Closed; (e) the dashboard still
// splits a family index at `## Closed`.
//
// SCOPE — repo-local files under lib/, wiki/work/. Does not touch ~/.claude.
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');
const SHARED_DOC = path.join(SKILLS, '_shared', 'ARCHIVE-WORK-ITEM.md');
const TEMPLATE_WORK = path.join(REPO, 'lib', 'scripts', 'templates', 'wiki', 'work');
const DASHBOARD = path.join(REPO, 'lib', 'scripts', 'templates', 'wiki', 'dashboard.html');

const IN_PLACE = ['roadmaps', 'decisions', 'requirements'];
const IN_PLACE_RE = '(?:roadmaps|decisions|requirements)';

function readFile(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

const rel = (p) => path.relative(REPO, p);
const skillPath = (name) => path.join(SKILLS, name, 'SKILL.md');

// ---------------------------------------------------------------------------
// (a) ARCHIVE-WORK-ITEM.md
// ---------------------------------------------------------------------------

function inPlaceSection() {
  const text = readFile(SHARED_DOC);
  const start = text.indexOf('## In-place close (roadmaps, decisions, requirements)');
  assert.ok(start !== -1, 'ARCHIVE-WORK-ITEM.md must have an "## In-place close (roadmaps, decisions, requirements)" section');
  return text.slice(start);
}

test('(a) ARCHIVE-WORK-ITEM.md has the In-place close section with Procedure, Row format, Caller deltas, CRITICAL rules', () => {
  const section = inPlaceSection();
  for (const heading of ['### Procedure', '### Row format', '### Caller deltas', '### CRITICAL rules']) {
    assert.ok(section.includes(heading), `In-place close section must contain ${JSON.stringify(heading)}`);
  }
  assert.ok(section.includes('## Active') && section.includes('## Closed'), 'section must describe the Active -> Closed row move');
});

test('(a) the In-place close section never instructs a git mv or an archive/ write', () => {
  const section = inPlaceSection();
  assert.doesNotMatch(section, /git mv\s+wiki\/work\//, 'no `git mv wiki/work/...` command inside the in-place section');
  // "git mv" and "archive/index.md" may appear in the in-place section only inside a prohibition.
  for (const [needle, label] of [[/git mv/, 'git mv'], [/archive\/index\.md/, 'archive/index.md']]) {
    for (const line of section.split('\n')) {
      if (!needle.test(line)) continue;
      assert.match(line, /\b(?:no|never)\b/i, `"${label}" may appear in the in-place section only in a prohibition: ${line}`);
    }
  }
  assert.match(section, /Never `git mv`/, 'CRITICAL rules must forbid git mv for these families');
  assert.match(section, /Never create `archive\/`/, 'CRITICAL rules must forbid creating archive/ for these families');
});

test('(a) the archive Inputs `family` row is restricted to tasks, uat, bugs', () => {
  const text = readFile(SHARED_DOC);
  const inputs = text.slice(text.indexOf('## Inputs'), text.indexOf('## Procedure'));
  const row = inputs.split('\n').find((l) => l.startsWith('| `family` |'));
  assert.ok(row, '`family` Inputs row not found');
  const oneOf = row.match(/One of ((?:`[a-z]+`(?:, )?)+)/);
  assert.ok(oneOf, '`family` row must open with "One of `a`, `b`, `c`"');
  const listed = [...oneOf[1].matchAll(/`([a-z]+)`/g)].map((m) => m[1]);
  assert.deepEqual(listed, ['tasks', 'uat', 'bugs']);
  assert.ok(row.includes('In-place close') || row.includes('in-place close'), '`family` row must point the other families at the in-place close section');
});

test('(a) the in-place Caller deltas name every closer with the right family', () => {
  const section = inPlaceSection();
  const deltas = section.slice(section.indexOf('### Caller deltas'), section.indexOf('### CRITICAL rules'));
  const expectations = [
    ['roadmap-next', 'roadmaps'],
    ['roadmap-assess', 'roadmaps'],
    ['prd-deprecate', 'requirements'],
    ['adr-deprecate', 'decisions'],
    ['adr-finalize', 'decisions'],
    ['uat-skip', 'roadmaps'],
    ['UAT-CORE.md', 'roadmaps'],
  ];
  for (const [consumer, family] of expectations) {
    const row = deltas.split('\n').find((l) => l.includes(`\`${consumer}\``));
    assert.ok(row, `in-place Caller deltas must list ${consumer}`);
    assert.ok(row.includes(`\`${family}\``), `${consumer} must pass family ${family}`);
  }
});

// ---------------------------------------------------------------------------
// (b) closers do not regrow the archive mechanic for the in-place families
// ---------------------------------------------------------------------------

const CLOSER_FILES = [
  skillPath('roadmap-next'),
  skillPath('roadmap-assess'),
  skillPath('uat-skip'),
  path.join(SKILLS, 'uat-walk', 'UAT-CORE.md'),
  skillPath('prd-deprecate'),
  skillPath('adr-deprecate'),
  skillPath('adr-finalize'),
];

for (const file of CLOSER_FILES) {
  test(`(b) ${rel(file)} has no git mv / archive/index.md append for roadmaps, decisions, requirements`, () => {
    const text = readFile(file);
    assert.doesNotMatch(text, new RegExp(`git mv\\s+wiki/work/${IN_PLACE_RE}`), 'must not `git mv` an in-place-family file');
    assert.doesNotMatch(text, new RegExp(`git mv[^\\n]*${IN_PLACE_RE}/archive`), 'must not `git mv` into an in-place-family archive/');
    assert.doesNotMatch(
      text,
      new RegExp(`${IN_PLACE_RE}/archive/index\\.md`),
      'must not reference an in-place-family archive/index.md'
    );
    assert.doesNotMatch(
      text,
      new RegExp(`wiki/work/${IN_PLACE_RE}/archive/(?!\\s)[A-Za-z]`),
      'must not write a file under an in-place-family archive/'
    );
  });
}

for (const name of ['roadmap-next', 'prd-deprecate', 'adr-deprecate', 'adr-finalize']) {
  test(`(b) ${name}/SKILL.md points at the shared in-place close procedure`, () => {
    const text = readFile(skillPath(name));
    assert.ok(text.includes('ARCHIVE-WORK-ITEM.md'), `${name} must reference ARCHIVE-WORK-ITEM.md`);
    assert.ok(/in-place close/i.test(text), `${name} must reference the In-place close section`);
  });
}

test('(b) roadmap-assess delegates closing to the roadmap-next "Close a fully-complete roadmap" procedure and reports a Closed section', () => {
  const text = readFile(skillPath('roadmap-assess'));
  assert.ok(text.includes('Close a fully-complete roadmap'), 'roadmap-assess must name the Close procedure');
  assert.ok(text.includes('lib/skills/roadmap-next/SKILL.md'), 'roadmap-assess must point at roadmap-next for the procedure');
  assert.ok(readFile(skillPath('roadmap-next')).includes('Close a fully-complete roadmap'), 'roadmap-next must define the Close procedure');
  assert.ok(text.includes('Closed this run'), 'roadmap-assess must report a "Closed this run" section');
  assert.doesNotMatch(text, /Archive a fully-complete roadmap|Archived this run/, 'roadmap-assess must not keep the old archive wording');
});

// ---------------------------------------------------------------------------
// (c) wiki-archive / wiki-tidy sweep only tasks, uat, bugs
// ---------------------------------------------------------------------------

function section(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.ok(start !== -1, `${startMarker} not found`);
  const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : text.length;
  assert.ok(end !== -1, `${endMarker} not found after ${startMarker}`);
  return text.slice(start, end);
}

const namesInPlace = (s) => IN_PLACE.filter((f) => new RegExp(`\\b${f}\\b`).test(s));

test('(c) wiki-archive family sweep lists name only tasks, uat, bugs', () => {
  const text = readFile(skillPath('wiki-archive'));

  // Usage: the accepted `family` values (the sentence before the "closed in place" STOP message).
  const usage = section(text, '## Usage', '## Step 1');
  const familyLine = usage.split('\n').find((l) => l.startsWith('`family` — one of'));
  assert.ok(familyLine, 'Usage `family` line not found');
  const accepted = familyLine.split('If `family`')[0];
  assert.deepEqual(namesInPlace(accepted), [], 'accepted `family` values must not include in-place families');
  for (const f of ['tasks', 'uat', 'bugs']) assert.ok(accepted.includes(`\`${f}\``), `accepted family list must include ${f}`);

  // Step 1: the "scan" sentence and the terminal-status list.
  const step1 = section(text, '## Step 1', '## Step 2');
  const scanLine = step1.split('\n').find((l) => /archiving families/.test(l));
  assert.ok(scanLine, 'Step 1 must scan "the N archiving families"');
  assert.deepEqual(namesInPlace(scanLine), [], 'Step 1 scan line must not list in-place families');
  const terminalList = step1.split('\n').filter((l) => /^- \*\*[a-z]+\*\*:/.test(l));
  assert.deepEqual(
    terminalList.map((l) => l.match(/^- \*\*([a-z]+)\*\*/)[1]),
    ['tasks', 'uat', 'bugs'],
    'Step 1 terminal-status list must cover exactly tasks, uat, bugs'
  );

  // Step 2 (scan) and Steps 3-6 (move) never mention the in-place families.
  const scanAndMove = section(text, '## Step 2', '## CRITICAL rules');
  assert.deepEqual(namesInPlace(scanAndMove), [], 'Steps 2-6 must not mention in-place families');
});

test('(c) wiki-archive still tells the user the in-place families have nothing to archive, and reports stray archive/ dirs without moving them', () => {
  const text = readFile(skillPath('wiki-archive'));
  assert.match(text, /closed in place[^\n]*nothing to archive/, 'missing the "closed in place — nothing to archive" message');
  assert.match(text, /Stray-archive note/, 'missing the stray-archive note');
  assert.match(text, /do not move anything/, 'stray-archive note must not move anything');
});

test('(c) wiki-tidy Phase 2 sweep lists name only tasks, uat, bugs', () => {
  const text = readFile(skillPath('wiki-tidy'));
  const description = text.match(/^description:.*$/m)[0];
  assert.deepEqual(namesInPlace(description), [], 'wiki-tidy description must not list in-place families');

  const phase2 = section(text, '## Phase 2: Archive', '## Phase 3');
  const scanLine = phase2.split('\n').find((l) => /^Scan the .* archiving families/.test(l));
  assert.ok(scanLine, 'Phase 2 must have a "Scan the N archiving families" line');
  assert.deepEqual(namesInPlace(scanLine), [], 'Phase 2 scan line must not list in-place families');
  for (const f of ['tasks', 'uat', 'bugs']) assert.ok(scanLine.includes(`\`${f}\``), `Phase 2 scan line must include ${f}`);

  const fence = phase2.match(/Archive candidates:\n([\s\S]*?)```/);
  assert.ok(fence, 'Phase 2 "Archive candidates:" summary block not found');
  assert.deepEqual(namesInPlace(fence[1]), [], 'Archive candidates summary must not list in-place families');

  // Anywhere the in-place families ARE mentioned in Phase 2, it must be the "close in place / never swept" note.
  const mentions = phase2.split('\n').filter((l) => namesInPlace(l).length > 0);
  for (const l of mentions) {
    assert.match(l, /close in place|never swept|never move/i, `Phase 2 mentions an in-place family outside the "closed in place" note: ${l.slice(0, 80)}`);
  }
});

// ---------------------------------------------------------------------------
// (d) lifecycle.md: two byte-identical copies per family, both describing Closed
// ---------------------------------------------------------------------------

for (const fam of IN_PLACE) {
  test(`(d) ${fam}/lifecycle.md: template and local copies are byte-identical and mention Closed`, () => {
    const templateCopy = path.join(TEMPLATE_WORK, fam, 'lifecycle.md');
    const localCopy = path.join(REPO, 'wiki', 'work', fam, 'lifecycle.md');
    const a = fs.readFileSync(templateCopy);
    const b = fs.readFileSync(localCopy);
    assert.ok(a.equals(b), `${rel(templateCopy)} and ${rel(localCopy)} differ`);
    const text = a.toString('utf8');
    assert.match(text, /\*\*Closed\*\*/, 'lifecycle.md must describe the **Closed** index section');
    assert.match(text, /never moved/, 'lifecycle.md must say finished items are never moved');
    assert.doesNotMatch(text, /moved to `?archive\//i, 'lifecycle.md must not tell items to move to archive/');
  });
}

// ---------------------------------------------------------------------------
// (e) dashboard splits a family index at ## Closed
// ---------------------------------------------------------------------------

test('(e) dashboard template splits a family index.md at the literal "## Closed" heading', () => {
  const text = readFile(DASHBOARD);
  assert.ok(text.includes('splitClosedSection'), 'dashboard must define splitClosedSection');
  assert.ok(text.includes('/^## Closed\\s*$/'), 'dashboard must anchor the split on the literal /^## Closed\\s*$/ heading');
  const fn = section(text, 'function splitClosedSection', '\n    }\n');
  assert.ok(fn.includes('## Closed'), 'splitClosedSection must key on "## Closed"');
  assert.match(text, /IN_PLACE_FAMILIES/, 'dashboard must know which families close in place');
  for (const fam of IN_PLACE) assert.ok(text.includes(`'${fam}'`), `dashboard IN_PLACE_FAMILIES must include ${fam}`);
});
