#!/usr/bin/env node
// Contract checks for TASK-0102: the task dependency-field format lives in ONE
// place (the "Dependency fields" paragraph of tasks/lifecycle.md) and the two
// skills that touch dependencies point at it instead of restating it.
// Zero-dependency: node:test + node:assert only, mirroring the sibling
// skill-content suites (test/wiki-lint-taskless-decisions.test.js).
//
// Run: npm test   (or: node --test test/task-dependency-single-source.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0102 is a documentation-only change to
// SKILL.md and lifecycle.md files — the markdown IS the program a future agent
// executes. The risks pinned here: (1) the legacy "**Depends on**" /
// "**Parallel-safe with**" blockquote format creeping back into task-create
// or task-assess as a second, drifting source of truth; (2) those
// skills losing their pointer to lifecycle.md's "Dependency fields"; (3)
// task-assess Step 2e reverting to body-blockquote parsing (missing_block);
// (4) either lifecycle.md copy (template + this repo's own) losing the
// "Dependency fields" paragraph or the depends_on / blocks / parallel_safe_with
// schema rows.
//
// SCOPE — repo copies only (lib/skills/, lib/scripts/templates/, wiki/); never
// the machine-local ~/.claude/skills/ copies (install-global.sh overwrites
// those on next sync).
//
// HERMETIC: reads repo-local files. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');
const TASK_CREATE = path.join(SKILLS, 'task-create', 'SKILL.md');
const TASK_ASSESS = path.join(SKILLS, 'task-assess', 'SKILL.md');
const LIFECYCLE_TEMPLATE = path.join(REPO, 'lib', 'scripts', 'templates', 'wiki', 'work', 'tasks', 'lifecycle.md');
const LIFECYCLE_REPO = path.join(REPO, 'wiki', 'work', 'tasks', 'lifecycle.md');

function read(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.ok(start !== -1, `marker not found: ${startMarker}`);
  const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : -1;
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

const SKILL_FILES = [TASK_CREATE, TASK_ASSESS];

for (const file of SKILL_FILES) {
  const rel = path.relative(REPO, file);

  test(`${rel} does not restate the blockquote dependency format`, () => {
    const text = read(file);
    assert.ok(!text.includes('**Depends on**'), 'must not contain "**Depends on**"');
    assert.ok(!text.includes('**Parallel-safe with**'), 'must not contain "**Parallel-safe with**"');
  });

  test(`${rel} points at tasks/lifecycle.md "Dependency fields"`, () => {
    assert.match(
      read(file),
      /lifecycle\.md[^\n]*Dependency fields|Dependency fields[^\n]*lifecycle\.md/,
      'must reference tasks/lifecycle.md alongside "Dependency fields"'
    );
  });
}

test('task-assess Step 2e reads frontmatter and no longer mentions missing_block', () => {
  const text = read(TASK_ASSESS);
  const step2e = between(text, '### 2e.', '\n### ');
  assert.match(step2e, /frontmatter/i, 'Step 2e must mention frontmatter');
  assert.doesNotMatch(text, /missing_block/, 'missing_block (body-blockquote parsing) must be gone from task-assess');
});

for (const file of [LIFECYCLE_TEMPLATE, LIFECYCLE_REPO]) {
  const rel = path.relative(REPO, file);

  test(`${rel} has a "Dependency fields" label`, () => {
    assert.match(read(file), /Dependency fields/, 'must contain "Dependency fields"');
  });

  test(`${rel} still lists depends_on, blocks, parallel_safe_with in its schema table`, () => {
    const text = read(file);
    for (const key of ['depends_on', 'blocks', 'parallel_safe_with']) {
      assert.match(text, new RegExp('^\\|\\s*`' + key + '`\\s*\\|', 'm'), `schema table row for ${key} missing`);
    }
  });
}
