#!/usr/bin/env node
// Repeatable checks locking in TASK-0095: bug-create writes new bugs with
// status `open` (matching wiki/work/bugs/lifecycle.md), not the legacy `new`.
// Zero-dependency: node:test + node:assert + node:fs + node:path only,
// mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/bug-file-status-open.test.js)
//
// Promoted from TASK-0095.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(REPO, relPath), 'utf8');
}

const SKILL = 'lib/skills/bug-create/SKILL.md';
const LIFECYCLE = 'wiki/work/bugs/lifecycle.md';

test('bug-create SKILL.md uses status `open` in intro, Step 6 bullet, and Step 8 report', () => {
  const contents = read(SKILL);
  assert.match(contents, /with status `open`/);
  assert.match(contents, /^- `Status: open`$/m);
  assert.match(contents, /^- Status: `open`$/m);
});

test('bug-create SKILL.md has no remaining legacy status `new`', () => {
  const contents = read(SKILL);
  assert.doesNotMatch(contents, /Status: `?new\b/);
  assert.doesNotMatch(contents, /with status `new`/);
  assert.doesNotMatch(contents, /- Status: `new`/);
});

test('bug-create Step 6 status is a member of the lifecycle.md status enum, and open is first', () => {
  const lifecycle = read(LIFECYCLE);
  const row = lifecycle.split('\n').find((l) => /^\|\s*`status`\s*\|/.test(l));
  assert.ok(row, 'status row not found in lifecycle.md frontmatter table');

  const enumCell = row.match(/`([^`]+)`\s*\|?\s*$/);
  assert.ok(enumCell, 'status enum not parseable from lifecycle.md row');
  const members = enumCell[1].split(/\s*\\?\|\s*/).map((s) => s.trim()).filter(Boolean);
  assert.ok(members.length > 1, 'status enum should have multiple members');
  assert.strictEqual(members[0], 'open');

  const skill = read(SKILL);
  const written = skill.match(/^- `Status: ([a-z-]+)`$/m);
  assert.ok(written, 'Step 6 Status bullet not found in bug-create SKILL.md');
  assert.ok(
    members.includes(written[1]),
    `bug-create writes status "${written[1]}" which is not in lifecycle enum: ${members.join(', ')}`
  );
});

test('bug-create Step 7 inherits the Step 6 status, and bug-triage/bug-assess key on `open`', () => {
  const skill = read(SKILL);
  assert.match(skill, /`<status>` is the status you set in Step 6/);

  assert.match(read('lib/skills/bug-triage/SKILL.md'), /If `status: open` or `status: triaged`/);
  assert.match(read('lib/skills/bug-assess/SKILL.md'), /at least one bug is `status: open`/);
});
