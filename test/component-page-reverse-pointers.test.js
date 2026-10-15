#!/usr/bin/env node
// Contract checks for TASK-0090's implemented_by::/evolved_by:: reverse-pointer
// convention. Zero-dependency: node:test + node:assert only, mirroring the
// sibling wiki-content suites (test/wiki-work-naming-convention.test.js,
// test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/component-page-reverse-pointers.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0090 is a documentation-only change, but it
// edits template-owned infrastructure: wiki/conventions.md is refreshed from
// lib/scripts/templates/wiki/conventions.md, so an edit to only one copy is
// silently overwritten (or silently absent from every downstream project). The
// risks this pins: (1) the two conventions copies drift apart, (2) the
// vocabulary loses one of its original ten link types while gaining the two new
// ones, (3) a backfilled component page cites a work item that does not exist
// (the task's own rule: "use the real archived IDs found, not invented ones"),
// and (4) a backfilled page cites a roadmap/task that never touched the
// component (ROADMAP-0013 must NOT be cited on power-mode-skill.md).
//
// SCOPE — the two conventions.md copies plus power-mode-skill.md and
// bootstrap-prefs-store.md. The "no other component page was backfilled"
// boundary is deliberately NOT asserted here: a later task may legitimately
// backfill more pages, and a permanent test would then fail for the wrong
// reason. UAT-0090 checks that boundary once, as a point-in-time review.
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TEMPLATE_CONVENTIONS = path.join(REPO, 'lib', 'scripts', 'templates', 'wiki', 'conventions.md');
const LOCAL_CONVENTIONS = path.join(REPO, 'wiki', 'conventions.md');
const COMPONENTS_DIR = path.join(REPO, 'wiki', 'knowledge', 'entities', 'components');
const POWER_MODE_PAGE = path.join(COMPONENTS_DIR, 'power-mode-skill.md');
const PREFS_STORE_PAGE = path.join(COMPONENTS_DIR, 'bootstrap-prefs-store.md');

const ORIGINAL_VOCABULARY = [
  'derived_from', 'supersedes', 'superseded_by', 'implements', 'uses',
  'depends_on', 'contradicts', 'relates_to', 'caused', 'fixed',
];
const NEW_VOCABULARY = ['implemented_by', 'evolved_by'];

function read(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function vocabularyLine(text) {
  const line = text.split('\n').find((l) => l.startsWith('**Vocabulary:**'));
  assert.ok(line, 'no "**Vocabulary:**" line found in conventions.md');
  return line;
}

// A stable work-item ID resolves when some file in an active or archive
// directory of its family is named "<ID>-<slug>.md".
function resolveWorkItem(id) {
  const family = id.startsWith('TASK-') ? 'tasks' : id.startsWith('ROADMAP-') ? 'roadmaps' : null;
  assert.ok(family, `unsupported work-item ID family: ${id}`);
  for (const dir of [
    path.join(REPO, 'wiki', 'work', family),
    path.join(REPO, 'wiki', 'work', family, 'archive'),
  ]) {
    if (!fs.existsSync(dir)) continue;
    const hit = fs.readdirSync(dir).find((f) => f.startsWith(`${id}-`) && f.endsWith('.md'));
    if (hit) return path.join(dir, hit);
  }
  return null;
}

function typedTargets(text, rel) {
  const re = new RegExp(`${rel}::\\[\\[([^\\]#|]+)`, 'g');
  return [...text.matchAll(re)].map((m) => m[1]);
}

test('both conventions.md copies list implemented_by and evolved_by in the Typed-links vocabulary', () => {
  for (const [label, p] of [['template', TEMPLATE_CONVENTIONS], ['local', LOCAL_CONVENTIONS]]) {
    const line = vocabularyLine(read(p));
    for (const term of NEW_VOCABULARY) {
      assert.ok(line.includes(`\`${term}\``), `${label} conventions.md vocabulary is missing \`${term}\``);
    }
  }
});

test('the vocabulary keeps all ten original link types (nothing dropped while adding the two new ones)', () => {
  for (const [label, p] of [['template', TEMPLATE_CONVENTIONS], ['local', LOCAL_CONVENTIONS]]) {
    const line = vocabularyLine(read(p));
    for (const term of ORIGINAL_VOCABULARY) {
      assert.ok(line.includes(`\`${term}\``), `${label} conventions.md vocabulary lost original type \`${term}\``);
    }
  }
});

test('both conventions.md copies carry the explanatory note for the reverse-pointer types', () => {
  const note =
    '`implemented_by::[[TASK-NNNN]]` / `evolved_by::[[ROADMAP-NNNN]]` on a `knowledge/entities/components/` page';
  for (const [label, p] of [['template', TEMPLATE_CONVENTIONS], ['local', LOCAL_CONVENTIONS]]) {
    const text = read(p);
    assert.ok(text.includes(note), `${label} conventions.md is missing the reverse-pointer usage note`);
    assert.ok(
      text.includes("the inverse of a task's/roadmap's own `implements::`/`derived_from::` pointing at the concept"),
      `${label} conventions.md note must explain it is the inverse of implements::/derived_from::`
    );
  }
});

test('the template and the local (dogfood) conventions.md are byte-identical', () => {
  assert.strictEqual(
    read(TEMPLATE_CONVENTIONS),
    read(LOCAL_CONVENTIONS),
    'lib/scripts/templates/wiki/conventions.md and wiki/conventions.md have drifted apart; the template is the source of truth and both must be edited together'
  );
});

test('power-mode-skill.md has an evolved_by:: pointer that resolves to a real work item', () => {
  const text = read(POWER_MODE_PAGE);
  const targets = typedTargets(text, 'evolved_by');
  assert.ok(targets.length >= 1, 'power-mode-skill.md must carry at least one evolved_by::[[...]] pointer');
  for (const id of targets) {
    assert.ok(resolveWorkItem(id), `power-mode-skill.md evolved_by::[[${id}]] does not resolve to a task/roadmap file`);
  }
});

test('power-mode-skill.md does not cite ROADMAP-0013, which never modified the component itself', () => {
  const text = read(POWER_MODE_PAGE);
  assert.ok(!/ROADMAP-0013/.test(text), 'power-mode-skill.md must not cite ROADMAP-0013 (accuracy over completeness)');
});

test('power-mode-skill.md evolved_by:: target actually touched lib/skills/power-mode/SKILL.md', () => {
  const targets = typedTargets(read(POWER_MODE_PAGE), 'evolved_by');
  for (const id of targets) {
    const file = resolveWorkItem(id);
    assert.ok(file, `${id} does not resolve`);
    assert.ok(
      read(file).includes('lib/skills/power-mode/SKILL.md'),
      `${id} (${path.relative(REPO, file)}) never mentions lib/skills/power-mode/SKILL.md, so it cannot have evolved the component`
    );
  }
});

test('bootstrap-prefs-store.md has implemented_by:: pointers for TASK-040, TASK-041, and TASK-042, each resolving to a real task', () => {
  const targets = typedTargets(read(PREFS_STORE_PAGE), 'implemented_by');
  for (const id of ['TASK-040', 'TASK-041', 'TASK-042']) {
    assert.ok(targets.includes(id), `bootstrap-prefs-store.md is missing implemented_by::[[${id}]]`);
  }
  for (const id of targets) {
    assert.ok(resolveWorkItem(id), `bootstrap-prefs-store.md implemented_by::[[${id}]] does not resolve to a task file`);
  }
});

// Status is deliberately not asserted: ROADMAP-011 will complete and archive, and
// resolveWorkItem() follows it into archive/, so lifecycle progress stays green.
test('bootstrap-prefs-store.md evolved_by::[[ROADMAP-011]] resolves to the bootstrap-prefs-tui roadmap', () => {
  const targets = typedTargets(read(PREFS_STORE_PAGE), 'evolved_by');
  assert.ok(targets.includes('ROADMAP-011'), 'bootstrap-prefs-store.md is missing evolved_by::[[ROADMAP-011]]');
  const file = resolveWorkItem('ROADMAP-011');
  assert.ok(file, 'ROADMAP-011 does not resolve to a roadmap file');
  assert.ok(read(file).includes('bootstrap-prefs-tui'), 'ROADMAP-011 must be about bootstrap-prefs-tui');
});

test('both backfilled component pages keep their frontmatter and existing typed links intact', () => {
  const power = read(POWER_MODE_PAGE);
  assert.match(power, /^---\nid: power-mode-skill\n/, 'power-mode-skill.md frontmatter id was disturbed');
  assert.ok(power.includes('implements::[[Multi-Agent Orchestration Patterns]]'), 'power-mode-skill.md lost its pre-existing implements:: link');

  const prefs = read(PREFS_STORE_PAGE);
  assert.match(prefs, /^---\nid: bootstrap-prefs-store\n/, 'bootstrap-prefs-store.md frontmatter id was disturbed');
  assert.ok(prefs.includes('derived_from::[[bootstrap-prefs-editor-tui]]'), 'bootstrap-prefs-store.md lost its pre-existing derived_from:: link');
});
