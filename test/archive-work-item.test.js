#!/usr/bin/env node
// Contract checks for TASK-0097's shared ARCHIVE-WORK-ITEM.md reference doc and
// the six skills wired to it. Zero-dependency: node:test + node:assert only,
// mirroring the sibling skill-content suites (test/bug-close-clustering-offer.test.js,
// test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/archive-work-item.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0097 is a documentation-only change — the
// markdown IS the program a future agent executes. The "archive a work item"
// mechanic (flip status, `git mv` into archive/, drop the active-index row,
// append the archive/index.md row, append a log entry) used to be written out
// independently in six skills and had drifted: wiki-archive used a plain `mv`,
// bug-close wrote a `verified` status that bugs/lifecycle.md does not define,
// and bug-triage's reject path appended to wiki/log.md twice. The risk this
// pins: (1) the shared doc keeps its load-bearing anchors (`git mv`,
// `archive/index.md`, `lifecycle.md`), (2) all six skills keep pointing at it
// instead of re-inlining the mechanic, (3) no skill regrows an inline
// `git mv wiki/work/...` / `mv wiki/work/...` command, (4) the drift decisions
// stay resolved (no plain `mv`, no `verified` status, one log entry on
// bug-triage's reject path).
//
// SCOPE — the shared doc plus the six wired SKILL.md files under lib/skills/.
// Does not touch the machine-local ~/.claude/skills/ copies (install-global.sh
// overwrites those on next sync; this repo is the only source of truth).
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');
const SHARED_DOC = path.join(SKILLS, '_shared', 'ARCHIVE-WORK-ITEM.md');
// roadmap-next left this list in TASK-0121: roadmaps close in place (see
// test/in-place-close.test.js), only tasks/uat/bugs archive.
const WIRED_SKILLS = ['task-assess', 'task-close', 'bug-triage', 'bug-close', 'wiki-archive'];

function skillPath(name) {
  return path.join(SKILLS, name, 'SKILL.md');
}

function readFile(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

test('_shared/ARCHIVE-WORK-ITEM.md exists and carries its load-bearing anchors', () => {
  const text = readFile(SHARED_DOC);
  for (const anchor of ['git mv', 'archive/index.md', 'lifecycle.md']) {
    assert.ok(text.includes(anchor), `ARCHIVE-WORK-ITEM.md must contain ${JSON.stringify(anchor)}`);
  }
});

for (const name of WIRED_SKILLS) {
  test(`${name}/SKILL.md references ARCHIVE-WORK-ITEM.md`, () => {
    const text = readFile(skillPath(name));
    assert.ok(text.includes('ARCHIVE-WORK-ITEM.md'), `${name}/SKILL.md must point at ARCHIVE-WORK-ITEM.md`);
  });

  test(`${name}/SKILL.md carries no inline git mv / mv of wiki/work/ paths`, () => {
    const text = readFile(skillPath(name));
    assert.ok(!text.includes('git mv wiki/work/'), `${name}/SKILL.md must not inline "git mv wiki/work/"`);
    assert.doesNotMatch(
      text,
      /(^|[\s`])mv\s+wiki\/work\//m,
      `${name}/SKILL.md must not inline a bare "mv wiki/work/" command`
    );
  });
}

test('wiki-archive/SKILL.md contains no plain mv of wiki/work/ (drift resolved to git mv via the shared doc)', () => {
  const text = readFile(skillPath('wiki-archive'));
  assert.ok(!text.includes('mv wiki/work/'), 'wiki-archive/SKILL.md must not contain "mv wiki/work/"');
});

test('bug-close/SKILL.md uses no `verified` status (bugs/lifecycle.md defines `closed`, not `verified`)', () => {
  const text = readFile(skillPath('bug-close'));
  // Prose such as "not yet verified" is fine; a status usage is not.
  assert.doesNotMatch(text, /`verified`/, 'bug-close/SKILL.md must not use a backticked `verified` status');
  assert.doesNotMatch(text, /status:\s*verified/i, 'bug-close/SKILL.md must not set `status: verified`');
  assert.doesNotMatch(text, /Status\s*(→|->)\s*`?verified/i, 'bug-close/SKILL.md must not transition Status to verified');
  assert.doesNotMatch(text, /For `verified`/, 'bug-close/SKILL.md must not gate a branch on `verified`');
});

test('bug-triage/SKILL.md Step 7a delegates the archive move and does not write wiki/log.md (Step 9 owns the single entry)', () => {
  const text = readFile(skillPath('bug-triage'));
  const start = text.indexOf('#### Step 7a');
  assert.ok(start !== -1, 'Step 7a heading not found');
  const rest = text.slice(start);
  const nextHeading = rest.slice(1).search(/\n#{1,4} /);
  assert.ok(nextHeading !== -1, 'no heading found after Step 7a');
  const block = rest.slice(0, nextHeading + 1);

  assert.ok(block.includes('ARCHIVE-WORK-ITEM.md'), 'Step 7a must reference ARCHIVE-WORK-ITEM.md');
  assert.ok(block.includes('`log: skip`'), 'Step 7a must pass `log: skip` to the shared procedure');
  assert.ok(!block.includes('wiki/log.md'), 'Step 7a must not contain a wiki/log.md append instruction');

  // The single log entry lives in Step 9.
  const step9 = text.slice(text.indexOf('### Step 9'));
  assert.ok(step9.includes('wiki/log.md'), 'Step 9 must still append the single wiki/log.md entry');
});


test('_shared/ARCHIVE-WORK-ITEM.md documents the five-step Procedure and defers terminal sets to lifecycle.md', () => {
  const text = readFile(SHARED_DOC);
  for (const heading of ['## Inputs', '## Procedure', '## Row and log formats', '## Caller deltas', '## CRITICAL rules', '## Other consumers (not yet wired)']) {
    assert.ok(text.includes(heading), `ARCHIVE-WORK-ITEM.md must contain heading ${JSON.stringify(heading)}`);
  }
  const procedure = text.slice(text.indexOf('## Procedure'), text.indexOf('## Row and log formats'));
  for (let n = 1; n <= 5; n++) {
    assert.match(procedure, new RegExp(`^${n}\\. `, 'm'), `Procedure must have numbered step ${n}`);
  }
  assert.match(procedure, /do not hardcode the per-family sets/, 'Procedure step 1 must defer terminal sets to lifecycle.md');
});

test('_shared/ARCHIVE-WORK-ITEM.md archive row is four-column and the default log entry uses the archive op', () => {
  const text = readFile(SHARED_DOC);
  assert.ok(text.includes('| [[ID]] | <title> | <terminal_status> | YYYY-MM-DD |'), 'four-column archive row missing');
  assert.ok(text.includes('## [YYYY-MM-DD] archive | <ID> — <terminal_status>, moved to archive'), 'default log entry missing');
});

test('_shared/ARCHIVE-WORK-ITEM.md Caller deltas name all five archiving consumers (no roadmap-next) and bug-triage passes log: skip', () => {
  const text = readFile(SHARED_DOC);
  const deltas = text.slice(text.indexOf('## Caller deltas'), text.indexOf('## CRITICAL rules'));
  for (const name of WIRED_SKILLS) {
    assert.ok(deltas.includes(`\`${name}\``), `Caller deltas must list ${name}`);
  }
  assert.ok(!deltas.includes('`roadmap-next`'), 'archive Caller deltas must not list roadmap-next (roadmaps close in place)');
  const archiveRow = deltas.split('\n').find((l) => l.includes('`wiki-archive`'));
  assert.ok(archiveRow, 'wiki-archive delta row missing');
  assert.ok(!/\bany\b/.test(archiveRow.split('|')[2]), 'wiki-archive family cell must not say `any`');
  assert.match(archiveRow.split('|')[2], /`tasks`.*`uat`.*`bugs`/, 'wiki-archive family cell must list tasks, uat, bugs');
  const triageRow = deltas.split('\n').find((l) => l.includes('`bug-triage`'));
  assert.ok(triageRow && triageRow.includes('log: skip'), 'bug-triage delta row must pass log: skip');
});

test('task-assess passes terminal_status done and task-close passes trashed with log op task-trashed', () => {
  const audit = readFile(skillPath('task-assess'));
  assert.ok(audit.includes('`terminal_status: done`'), 'task-assess must pass terminal_status: done');
  const trash = readFile(skillPath('task-close'));
  assert.ok(trash.includes('`terminal_status: trashed`'), 'task-close must pass terminal_status: trashed');
  assert.ok(trash.includes('task-trashed'), 'task-close must keep the task-trashed log op');
  assert.ok(trash.includes('`family: uat`'), 'task-close must also archive related UAT files');
});

test('_shared/ARCHIVE-WORK-ITEM.md Inputs `family` row lists exactly tasks, uat, bugs', () => {
  const text = readFile(SHARED_DOC);
  const inputs = text.slice(text.indexOf('## Inputs'), text.indexOf('## Procedure'));
  const row = inputs.split('\n').find((l) => l.startsWith('| `family` |'));
  assert.ok(row, '`family` Inputs row not found');
  const oneOf = row.match(/One of ((?:`[a-z]+`(?:, )?)+)/);
  assert.ok(oneOf, '`family` row must open with "One of `a`, `b`, `c`"');
  const listed = [...oneOf[1].matchAll(/`([a-z]+)`/g)].map((m) => m[1]);
  assert.deepEqual(listed, ['tasks', 'uat', 'bugs']);
});

test('roadmap-next points at the in-place close section (family: roadmaps, terminal_status: done), not the archive procedure', () => {
  const roadmap = readFile(skillPath('roadmap-next'));
  assert.ok(roadmap.includes('ARCHIVE-WORK-ITEM.md'), 'roadmap-next must reference ARCHIVE-WORK-ITEM.md');
  assert.ok(roadmap.includes('In-place close'), 'roadmap-next must point at the In-place close section');
  assert.ok(roadmap.includes('`family: roadmaps`') && roadmap.includes('`terminal_status: done`'), 'roadmap-next parameters missing');
});

test('bug-close passes the documented family and terminal status', () => {
  const bugClose = readFile(skillPath('bug-close'));
  assert.ok(bugClose.includes('`family: bugs`'), 'bug-close must pass family: bugs');
  assert.match(bugClose, /terminal_status: closed \| wontfix \| cannot-reproduce/, 'bug-close must map outcomes to closed|wontfix|cannot-reproduce');
});

test('wiki-archive keeps its own single batch log entry and passes log: skip per item', () => {
  const text = readFile(skillPath('wiki-archive'));
  assert.ok(text.includes('`log: skip`'), 'wiki-archive must pass log: skip per item');
  assert.ok(text.includes('## Step 5'), 'wiki-archive must keep its Step 5 batch log entry');
});

test('lib/skills/README.md names UAT-CORE.md and the _shared/ directory', () => {
  const text = readFile(path.join(SKILLS, 'README.md'));
  assert.ok(text.includes('uat-walk/UAT-CORE.md'), 'README must name uat-walk/UAT-CORE.md');
  assert.ok(text.includes('_shared/'), 'README must name the _shared/ directory');
});

test('wiki-skill-boilerplate-duplication knowledge page lists ARCHIVE-WORK-ITEM.md and links TASK-0097', () => {
  const text = readFile(path.join(REPO, 'wiki', 'knowledge', 'concepts', 'wiki-skill-boilerplate-duplication.md'));
  assert.ok(text.includes('ARCHIVE-WORK-ITEM.md'), 'knowledge page must reference ARCHIVE-WORK-ITEM.md');
  assert.ok(text.includes('implemented_by::[[TASK-0097]]'), 'knowledge page must carry implemented_by::[[TASK-0097]]');
});
