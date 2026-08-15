#!/usr/bin/env node
// Contract checks for TASK-065 (ROADMAP-008 Phase 1): every work-item
// frontmatter template a SKILL.md renders must now also emit an
// `aliases: [<ID>]` line/row/bullet mirroring that file's own `id:` value.
// Zero-dependency: node:test + node:assert only, mirroring the sibling
// skill-content suites (test/task-typed-links.test.js,
// test/bootstrap-config-skill.test.js).
//
// Run: npm test   (or: node --test test/skill-frontmatter-aliases.test.js)
//
// WHY THIS IS TESTED AT ALL. Obsidian's wikilink click-resolver matches only
// real filenames, never frontmatter fields on their own — but it DOES honor
// the native `aliases:` property once present. Work-item files are named
// `TASK-NNN-slug.md`, not bare `TASK-NNN.md`, so a bare `[[TASK-NNN]]` link
// never resolves on click unless the target file's frontmatter carries a
// matching alias. These 6 SKILL.md files are templates: the markdown IS the
// program that scaffolds new work-item files, so if a future edit silently
// drops or mis-shapes the `aliases:` line, every work item created from that
// point on loses this behavior with no signal until someone notices a broken
// wikilink. Static text assertions pin the additive claim in each file's own
// template idiom (YAML block / prose bullet / markdown table).
//
// SCOPE — the 6 SKILL.md files TASK-065 touched, and nothing else. Does not
// touch wiki/work/*/lifecycle.md schema docs, existing work-item files
// (that's TASK-064's backfill), or the Alias Linker plugin install (a
// separate roadmap phase).
//
// HERMETIC: reads six repo-local files. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const TASK_ADD_SKILL = path.join(REPO, 'lib', 'skills', 'task-add', 'SKILL.md');
const UAT_GENERATE_SKILL = path.join(REPO, 'lib', 'skills', 'uat-generate', 'SKILL.md');
const REQ_CREATE_SKILL = path.join(REPO, 'lib', 'skills', 'req-create', 'SKILL.md');
const BUG_FILE_SKILL = path.join(REPO, 'lib', 'skills', 'bug-file', 'SKILL.md');
const ROADMAP_CREATE_SKILL = path.join(REPO, 'lib', 'skills', 'roadmap-create', 'SKILL.md');
const DECISION_CREATE_SKILL = path.join(REPO, 'lib', 'skills', 'decision-create', 'SKILL.md');

function readSkill(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

test('task-add/SKILL.md frontmatter template inserts aliases: [TASK-NNN] directly after id: TASK-NNN', () => {
  const text = readSkill(TASK_ADD_SKILL);
  assert.match(
    text,
    /id: TASK-NNN\naliases: \[TASK-NNN\]\ntitle: "<task title>"/,
    'task-add/SKILL.md must render aliases: [TASK-NNN] between id: TASK-NNN and title:'
  );
});

test('uat-generate/SKILL.md frontmatter template inserts aliases: [UAT-NNN] directly after id: UAT-NNN', () => {
  const text = readSkill(UAT_GENERATE_SKILL);
  assert.match(
    text,
    /id: UAT-NNN\naliases: \[UAT-NNN\]\ntitle: "UAT: \[Task Title\]"/,
    'uat-generate/SKILL.md must render aliases: [UAT-NNN] between id: UAT-NNN and title:'
  );
});

test('req-create/SKILL.md frontmatter template inserts aliases: [REQ-NNN] directly after id: REQ-NNN', () => {
  const text = readSkill(REQ_CREATE_SKILL);
  assert.match(
    text,
    /id: REQ-NNN\naliases: \[REQ-NNN\]\ntype: requirement/,
    'req-create/SKILL.md must render aliases: [REQ-NNN] between id: REQ-NNN and type:'
  );
});

test('bug-file/SKILL.md Step 6 field list carries an aliases: [BUG-NNNN] bullet after Last updated', () => {
  const text = readSkill(BUG_FILE_SKILL);
  assert.match(
    text,
    /- `Last updated`: today's date\n- `aliases: \[BUG-NNNN\]` — mirrors this file's own id: field so Obsidian's wikilink resolver can find it by short ID \(ROADMAP-008\)/,
    'bug-file/SKILL.md must document writing an aliases: [BUG-NNNN] bullet in the Step 6 field list'
  );
});

test('roadmap-create/SKILL.md Step 6 field table carries an aliases row after Status', () => {
  const text = readSkill(ROADMAP_CREATE_SKILL);
  assert.match(
    text,
    /\| `Status` \| `active` \|\n\| `aliases` \| `\[ROADMAP-NNN\]` — mirrors the file's own `id:` value \|/,
    'roadmap-create/SKILL.md must document an aliases row in the Step 6 field table, after Status'
  );
});

test('decision-create/SKILL.md Step 5 template opens with a new frontmatter block carrying aliases: [DEC-NNNN]', () => {
  const text = readSkill(DECISION_CREATE_SKILL);
  assert.match(
    text,
    /```markdown\n---\nid: DEC-NNNN\naliases: \[DEC-NNNN\]\n---\n\n# DEC-NNNN: <Decision-Group Title>/,
    'decision-create/SKILL.md must open its generated-file template with a --- id: DEC-NNNN / aliases: [DEC-NNNN] / --- frontmatter block before the H1'
  );
});

test('decision-create/SKILL.md new frontmatter block does not add title/created/updated/tags keys', () => {
  const text = readSkill(DECISION_CREATE_SKILL);
  const blockMatch = text.match(/```markdown\n---\n([\s\S]*?)\n---\n/);
  assert.ok(blockMatch, 'decision-create/SKILL.md must have a --- delimited frontmatter block inside the Step 5 fence');
  const blockLines = blockMatch[1].split('\n');
  assert.deepEqual(
    blockLines,
    ['id: DEC-NNNN', 'aliases: [DEC-NNNN]'],
    'the new block must contain only id: and aliases: — no title/created/updated/tags keys (out of scope for TASK-065)'
  );
});
