#!/usr/bin/env node
// Contract checks for TASK-0088's extension to task-create's Step 5 dependency
// scan and Step 8 frontmatter template. Zero-dependency: node:test +
// node:assert only, mirroring the sibling skill-content suites
// (test/bug-close-clustering-offer.test.js, test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/task-create-origin-bug-scan.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0088 is a documentation-only change to
// lib/skills/task-create/SKILL.md — the markdown IS the program a future agent
// executes. The risks this pins: (1) Step 5 must scan wiki/work/bugs/index.md
// for ACTIVE bugs only, additively (the task-to-task scan is unchanged) and
// skip silently when there is nothing to scan; (2) a match must surface as an
// "Origin bug" row in the same AskUserQuestion round-trip, not a second
// prompt; (3) Step 8 must add a singular optional `origin_bug` key (DEC-0001#D1
// accepted shape) and populate it only from a user-confirmed match; (4) the
// bug-side `linked_task` write-back must stay OUT of task-create (owned by
// /bug-triage and /bug-close).
//
// SCOPE — lib/skills/task-create/SKILL.md Step 5 and Step 8 only. Does not touch
// the machine-local ~/.claude/skills/task-create/SKILL.md copy (install-global.sh
// overwrites that on next sync; this repo's copy is the only source of truth).
//
// HERMETIC: reads one repo-local file. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TASK_CREATE_SKILL = path.join(REPO, 'lib', 'skills', 'task-create', 'SKILL.md');

function readSkill() {
  assert.ok(fs.existsSync(TASK_CREATE_SKILL), `${TASK_CREATE_SKILL} does not exist`);
  return fs.readFileSync(TASK_CREATE_SKILL, 'utf8');
}

function section(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  assert.ok(start !== -1, `${startHeading} heading not found`);
  const end = text.indexOf(endHeading, start + startHeading.length);
  assert.ok(end !== -1, `${endHeading} heading not found after ${startHeading}`);
  return text.slice(start, end);
}

const step5 = (t) => section(t, '### Step 5: Identify dependencies', '### Step 6:');
const step8 = (t) => section(t, '### Step 8: Create the task file', '**Body structure**');

test('task-create Step 5 scans wiki/work/bugs/index.md for open/triaged/in-progress bugs', () => {
  const s = step5(readSkill());
  assert.ok(s.includes('`wiki/work/bugs/index.md`'), 'Step 5 must read wiki/work/bugs/index.md');
  assert.ok(
    s.includes('active rows (status `open`/`triaged`/`in-progress`)'),
    'Step 5 must restrict the scan to active bug statuses open/triaged/in-progress'
  );
  assert.match(s, /plausibly matches the new task's objective/, 'Step 5 must match on plausible objective fit');
});

test('task-create Step 5 bug scan is additive: the task-to-task detection is preserved', () => {
  const s = step5(readSkill());
  assert.ok(s.includes('This scan is additive'), 'Step 5 must declare the bug scan additive');
  assert.ok(s.includes('the task-to-task dependency detection above is unchanged'), 'Step 5 must state task-to-task detection is unchanged');
  for (const kind of ['**depends_on**', '**blocks**', '**parallel_safe_with**']) {
    assert.ok(s.includes(kind), `Step 5 must still define ${kind}`);
  }
  assert.ok(
    s.indexOf('**parallel_safe_with**') < s.indexOf('`wiki/work/bugs/index.md`'),
    'the bug scan must come after (not replace) the task dependency bullets'
  );
});

test('task-create Step 5 skips the bug scan silently when the index is missing or has no active rows', () => {
  const s = step5(readSkill());
  assert.ok(
    s.includes('Skip silently if `wiki/work/bugs/index.md` is missing or has no active rows.'),
    'Step 5 must skip silently on a missing/empty bugs index'
  );
});

test('task-create Step 5 surfaces the origin bug as an "Origin bug" row in the same AskUserQuestion table', () => {
  const s = step5(readSkill());
  assert.ok(s.includes('`AskUserQuestion`'), 'Step 5 must confirm via AskUserQuestion');
  assert.ok(
    s.includes('add an "Origin bug" row (`BUG-NNNN` and its title) alongside the depends_on/blocks/parallel_safe_with rows'),
    'Step 5 must add an "Origin bug" row alongside the existing rows'
  );
  assert.ok(s.includes('in the same round-trip'), 'Step 5 must confirm the bug link in the same round-trip');
  assert.equal(
    (s.match(/AskUserQuestion/g) || []).length,
    1,
    'Step 5 must use a single AskUserQuestion (no extra prompt for the bug link)'
  );
  assert.ok(s.includes('Store the confirmed `BUG-NNNN` (or none) for Step 8.'), 'Step 5 must hand the confirmed bug to Step 8');
});

test('task-create Step 8 frontmatter template carries origin_bug: "" beside the dependency keys and before uat', () => {
  const s = step8(readSkill());
  const fm = s.match(/```yaml\n---\n([\s\S]*?)\n---\n```/);
  assert.ok(fm, 'Step 8 frontmatter yaml block not found');
  const lines = fm[1].split('\n');
  const idx = (key) => lines.findIndex((l) => l.startsWith(`${key}:`));
  assert.ok(idx('origin_bug') !== -1, 'frontmatter must include origin_bug');
  assert.equal(lines[idx('origin_bug')], 'origin_bug: ""', 'origin_bug must default to an empty string, not a list');
  assert.ok(idx('parallel_safe_with') < idx('origin_bug'), 'origin_bug must follow parallel_safe_with');
  assert.ok(idx('origin_bug') < idx('uat'), 'origin_bug must precede uat');
  for (const key of ['depends_on', 'blocks', 'parallel_safe_with', 'uat', 'tags']) {
    assert.ok(idx(key) !== -1, `existing key ${key} must remain in the template`);
  }
});

test('task-create Step 8 populates origin_bug only from the user-confirmed BUG-NNNN and keeps it singular', () => {
  const s = step8(readSkill());
  assert.ok(s.includes('optional, singular field (per `DEC-0001#D1`)'), 'must cite DEC-0001#D1 and describe the field as optional and singular');
  assert.ok(s.includes('the `BUG-NNNN` ID the user confirmed as this task\'s origin in Step 5'), 'must populate from the Step 5 confirmation');
  assert.ok(s.includes('leave it `""` when no origin bug was confirmed'), 'must leave the field empty when nothing was confirmed');
  assert.ok(s.includes('Do not write it as a list.'), 'must forbid list form');
});

test('task-create does not write the bug-side linked_task back-link (owned by /bug-triage and /bug-close)', () => {
  const text = readSkill();
  const s = step8(text);
  assert.ok(
    s.includes('The bug side\'s `linked_task` is not written here — that back-link is owned by `/bug-triage` and `/bug-close`.'),
    'Step 8 must state the linked_task write-back is intentionally left to the bug-side skills'
  );
  for (const line of text.split('\n').filter((l) => l.includes('linked_task'))) {
    assert.ok(line.includes('not written here'), `every linked_task mention must be the out-of-scope note, got: ${line}`);
  }
});

test('task-create SKILL.md never names the machine-local skill copy as an edit target', () => {
  assert.ok(
    !readSkill().toLowerCase().includes('~/.claude/skills/task-create/skill.md'),
    'the repo copy must not reference editing the machine-local ~/.claude/skills/task-create/SKILL.md'
  );
});
