#!/usr/bin/env node
// Contract checks for TASK-057's typed-link reconciliation between the
// existing Depends-on/Blocks blockquote and rel::[[target]] typed links.
// Zero-dependency: node:test + node:assert only, mirroring the sibling
// skill-content suites (test/bootstrap-config-skill.test.js,
// test/scripts-readme-prefs-docs.test.js).
//
// Run: npm test   (or: node --test test/task-typed-links.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-057 is a documentation-only change to two
// SKILL.md files — the markdown IS the program a future agent executes. The
// risk is narrow but real: task-audit/SKILL.md's own dependency-graph parser
// (Steps 2e/3a/3b/3c) must keep reading ONLY the blockquote — if a future
// edit quietly repoints the parser at the new typed-link lines instead, or
// drops the "additive, not a replacement" framing, task-audit's DFS/wave
// computation silently breaks. Static text assertions pin the two load-
// bearing claims: (1) both SKILL.md files document the additive typed-link
// lines, and (2) task-audit's own note says its parser is unchanged.
//
// SCOPE — the two SKILL.md files TASK-057 touched, and nothing else. Does
// not touch wiki/conventions.md's typed-link vocabulary (a pre-existing gap
// this task surfaced but did not fix — see UAT-057).
//
// HERMETIC: reads two repo-local files. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TASK_AUDIT_SKILL = path.join(REPO, 'lib', 'skills', 'task-audit', 'SKILL.md');
const TASK_ADD_SKILL = path.join(REPO, 'lib', 'skills', 'task-add', 'SKILL.md');

function readSkill(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

test('task-audit/SKILL.md documents the additive depends_on::/blocks:: typed-link lines', () => {
  const text = readSkill(TASK_AUDIT_SKILL);
  assert.match(
    text,
    /task files should also carry one `depends_on::\[\[TASK-NNN\]\]` line per dependency and one `blocks::\[\[TASK-NNN\]\]` line per blocked task/,
    'task-audit/SKILL.md must document that task files should also emit depends_on::/blocks:: typed-link lines'
  );
});

test('task-audit/SKILL.md states its own parser is unchanged and still reads only the blockquote', () => {
  const text = readSkill(TASK_AUDIT_SKILL);
  assert.match(
    text,
    /task-audit`'s own parser continues to read only the blockquote above, unchanged/,
    'task-audit/SKILL.md must explicitly state its DFS/wave-computation parser is unchanged'
  );
});

test('task-audit/SKILL.md places the typed-link note after the blockquote example, inside Step 2e', () => {
  const text = readSkill(TASK_AUDIT_SKILL);
  const step2eIdx = text.indexOf('### 2e. Parse the Dependency Block');
  const noteIdx = text.indexOf('task files should also carry one `depends_on::');
  const step2fIdx = text.indexOf('### 2f. Build the Node Record');
  assert.ok(step2eIdx !== -1, 'Step 2e heading must exist');
  assert.ok(noteIdx !== -1, 'typed-link note must exist');
  assert.ok(step2fIdx !== -1, 'Step 2f heading must exist');
  assert.ok(
    step2eIdx < noteIdx && noteIdx < step2fIdx,
    'the typed-link note must sit inside Step 2e, after the blockquote example and before Step 2f'
  );
});

test('task-add/SKILL.md body template renders depends_on::/blocks:: lines directly after implements::', () => {
  const text = readSkill(TASK_ADD_SKILL);
  assert.match(
    text,
    /implements::\[\[DEC-NNNN#DM\]\][^\n]*\ndepends_on::\[\[TASK-NNN\]\][^\n]*\nblocks::\[\[TASK-NNN\]\]/,
    'the template must render implements:: then depends_on:: then blocks:: on consecutive lines'
  );
});

test('task-add/SKILL.md prose documents the dependency-link placement rule sourced from Step 5', () => {
  const text = readSkill(TASK_ADD_SKILL);
  assert.match(
    text,
    /\*\*Dependency links\*\* \(from the Step 5 data, no re-derivation needed\): insert one `depends_on::\[\[TASK-NNN\]\]` line per dependency and one `blocks::\[\[TASK-NNN\]\]` line per blocked task/,
    'task-add/SKILL.md must document sourcing dependency links from the existing Step 5 data'
  );
});

test('task-add/SKILL.md marks the typed-link lines as additive, not a replacement, with no backfill', () => {
  const text = readSkill(TASK_ADD_SKILL);
  assert.match(
    text,
    /these typed-link lines are additive to the existing `> \*\*Depends on\*\*:`\/`> \*\*Blocks\*\*:` blockquote format, not a replacement, and creating them here does not backfill any pre-existing task file/,
    'task-add/SKILL.md must state the typed-link lines are additive and do not backfill existing tasks'
  );
});
