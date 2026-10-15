#!/usr/bin/env node
// State checks for TASK-0115 (UAT-0115): the wiki-side and wording consequences
// of removing /req-update and /task-update. Zero-dependency: node:test +
// node:assert only.
//
// Run: node --test test/req-task-update-removal-state.test.js
//
// Complements test/req-task-update-removed.test.js (which pins that the skill
// directories and every live mention are gone). This suite pins the remaining
// TASK-0115 outcomes: the requirements lifecycle template/local copies stay
// byte-identical after the shared edit, the pending-UAT trap (TASK-0094 /
// UAT-0094) was resolved by trashing and archiving both, the ROADMAP-0014
// checkbox for TASK-0094 is gone, and the removed-pointer wording now says to
// edit files directly.
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(REPO, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(REPO, ...p));

function statusOf(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  assert.ok(fm, 'file must have frontmatter');
  const m = /^status:\s*(\S+)\s*$/m.exec(fm[1]);
  assert.ok(m, 'frontmatter must have a status line');
  return m[1];
}

function findByPrefix(dir, prefix) {
  return fs.readdirSync(path.join(REPO, dir)).filter((f) => f.startsWith(prefix) && f.endsWith('.md'));
}

test('requirements lifecycle.md: local copy and template copy are byte-identical', () => {
  const local = fs.readFileSync(path.join(REPO, 'wiki/work/requirements/lifecycle.md'));
  const tpl = fs.readFileSync(path.join(REPO, 'lib/scripts/templates/wiki/work/requirements/lifecycle.md'));
  assert.ok(local.equals(tpl), 'the two requirements lifecycle.md copies must not drift');
});

test('requirements lifecycle.md says approved changes are made by editing the file directly', () => {
  for (const p of ['wiki/work/requirements/lifecycle.md', 'lib/scripts/templates/wiki/work/requirements/lifecycle.md']) {
    const text = read(p);
    assert.match(text, /changes are made by editing the file directly/, `${p} must state the direct-edit rule`);
    assert.match(text, /\/prd-create[\s\S]*\/prd-deprecate/, `${p} must keep the supersede path`);
  }
});

test('TASK-0094 is archived with status trashed and is not left in the active tasks dir', () => {
  assert.deepEqual(findByPrefix('wiki/work/tasks', 'TASK-0094-'), [], 'TASK-0094 must not remain in active tasks/');
  const archived = findByPrefix('wiki/work/tasks/archive', 'TASK-0094-');
  assert.equal(archived.length, 1, 'exactly one archived TASK-0094 file');
  assert.equal(statusOf(read('wiki/work/tasks/archive', archived[0])), 'trashed');
});

test('UAT-0094 is archived with status trashed and is not left in the active uat dir', () => {
  assert.deepEqual(findByPrefix('wiki/work/uat', 'UAT-0094-'), [], 'UAT-0094 must not remain in active uat/');
  const archived = findByPrefix('wiki/work/uat/archive', 'UAT-0094-');
  assert.equal(archived.length, 1, 'exactly one archived UAT-0094 file');
  assert.equal(statusOf(read('wiki/work/uat/archive', archived[0])), 'trashed');
});

test('active tasks and uat family indexes carry no TASK-0094 / UAT-0094 line', () => {
  assert.doesNotMatch(read('wiki/work/tasks/index.md'), /^- \[TASK-0094 /m);
  assert.doesNotMatch(read('wiki/work/uat/index.md'), /^- \[UAT-0094 /m);
});

test('ROADMAP-0014 has no checklist item for TASK-0094', () => {
  const roadmap = fs.readdirSync(path.join(REPO, 'wiki/work/roadmaps')).filter((f) => f.startsWith('ROADMAP-0014-'));
  assert.equal(roadmap.length, 1, 'exactly one ROADMAP-0014 file');
  const offenders = read('wiki/work/roadmaps', roadmap[0])
    .split('\n')
    .filter((line) => /^\s*- \[[ xX]\]/.test(line) && /TASK-0094/.test(line));
  assert.deepEqual(offenders, []);
});

test('the retired retire-redirect test file is gone', () => {
  assert.ok(!exists('test/req-update-retire-redirect.test.js'));
});

test('task-assess and prd-finalize replace the removed pointers with edit-directly wording', () => {
  const assess = read('lib/skills/task-assess/SKILL.md');
  assert.match(assess, /edit the task file directly/);
  assert.match(assess, /edit the task file's frontmatter directly/);
  const finalize = read('lib/skills/prd-finalize/SKILL.md');
  assert.match(finalize, /changes are made by editing the file directly/);
  assert.match(finalize, /creating a new requirement with `\/prd-create` and deprecating the old one with `\/prd-deprecate`/);
});
