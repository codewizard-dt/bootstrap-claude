#!/usr/bin/env node
// Content checks for UAT-0102 (TASK-0102): the per-skill and per-lifecycle
// wording that test/task-dependency-single-source.test.js does not pin. That
// suite proves the blockquote format is gone and each skill points at
// lifecycle.md "Dependency fields"; this one proves the replacement text says
// the right thing (what the paragraph must state, how task-assess reads and
// reports dependencies) and that no residue is left
// anywhere under lib/skills/.
// Zero-dependency: node:test + node:assert only.
//
// Run: node --test test/task-dependency-fields-content.test.js
//
// SCOPE — repo copies only (lib/skills/, lib/scripts/templates/, wiki/).
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

function dependencyParagraph(file) {
  const text = read(file);
  const para = between(text, '**Dependency fields.**', '\n\n');
  return para;
}

for (const file of [LIFECYCLE_TEMPLATE, LIFECYCLE_REPO]) {
  const rel = path.relative(REPO, file);

  test(`${rel} "Dependency fields" paragraph sits after the schema table and before Status transitions`, () => {
    const text = read(file);
    const table = text.indexOf('| `parallel_safe_with` |');
    const para = text.indexOf('**Dependency fields.**');
    const transitions = text.indexOf('## Status transitions');
    assert.ok(table !== -1 && para !== -1 && transitions !== -1, 'table row, paragraph, and transitions heading must all exist');
    assert.ok(table < para && para < transitions, 'order must be schema table -> Dependency fields -> Status transitions');
  });

  test(`${rel} paragraph states arrays of TASK-NNNN IDs, [] when empty, and sole authoritative machine-read (DEC-0001#D4)`, () => {
    const para = dependencyParagraph(file);
    assert.match(para, /YAML arrays of `TASK-NNNN` IDs/);
    assert.match(para, /`\[\]` when empty/);
    assert.match(para, /sole authoritative, machine-read/);
    assert.match(para, /DEC-0001#D4/);
  });

  test(`${rel} paragraph states edge symmetry is flagged, never auto-corrected`, () => {
    const para = dependencyParagraph(file);
    assert.match(para, /symmetric/);
    assert.match(para, /if A lists B in `blocks`, B lists A in `depends_on`/);
    assert.match(para, /never auto-corrects/);
  });

  test(`${rel} paragraph states the body typed-link lines are an optional mirror never read by tooling`, () => {
    const para = dependencyParagraph(file);
    assert.match(para, /`depends_on::\[\[TASK-NNNN\]\]`/);
    assert.match(para, /`blocks::\[\[TASK-NNNN\]\]`/);
    assert.match(para, /optional mirror/);
    assert.match(para, /never read by tooling/);
  });

  test(`${rel} paragraph declares the blockquote and "## Dependencies" headings not part of the schema, in 4-6 lines`, () => {
    const para = dependencyParagraph(file);
    assert.match(para, /legacy `> \*\*Depends on\*\*:` blockquote/);
    assert.match(para, /`## Dependencies` body headings are not part of the schema/);
    const lines = para.split('\n').filter((l) => l.trim() !== '').length;
    assert.ok(lines >= 4 && lines <= 6, `paragraph must be 4-6 lines, got ${lines}`);
  });

  test(`${rel} status transition list is untouched by TASK-0102`, () => {
    const text = read(file);
    assert.match(text, /`todo \\\| in-progress \\\| done \\\| trashed`/, 'status enumeration row must be intact');
  });
}

test('the two lifecycle.md copies carry an identical "Dependency fields" paragraph', () => {
  assert.equal(dependencyParagraph(LIFECYCLE_REPO), dependencyParagraph(LIFECYCLE_TEMPLATE));
});

test('task-create Step 8 defers to lifecycle.md for populating the arrays and drops the inline restatement', () => {
  const text = read(TASK_CREATE);
  assert.match(
    text,
    /Populate `depends_on`, `blocks`, and `parallel_safe_with` from Step 5 per the schema in `wiki\/work\/tasks\/lifecycle\.md` \("Dependency fields"\)\./
  );
  assert.doesNotMatch(text, /as lists of `TASK-NNNN` IDs \(empty list if none\)/, 'old inline restatement must be gone');
});

test('task-create "Dependency links" paragraph drops the blockquote aside and points at lifecycle.md as an optional graph-view mirror', () => {
  const text = read(TASK_CREATE);
  const para = between(text, '**Dependency links**', '\n\n');
  assert.doesNotMatch(para, /additive to the existing/, 'blockquote aside must be gone');
  assert.doesNotMatch(para, /blockquote/i, 'no blockquote mention may remain');
  assert.match(para, /optional graph-view mirror of the frontmatter arrays/);
  assert.match(para, /lifecycle\.md/);
  assert.match(para, /insert one `depends_on::\[\[TASK-\d*N+\]\]` line per dependency/, 'placement instruction is retained');
});

test('task-create keeps its Step 5 relation definitions and the frontmatter skeleton (out of scope for TASK-0102)', () => {
  const text = read(TASK_CREATE);
  const step5 = between(text, '### Step 5: Identify dependencies', '\n### Step 6');
  assert.match(step5, /\*\*depends_on\*\* it/);
  assert.match(step5, /\*\*blocks\*\* it/);
  assert.match(step5, /\*\*parallel_safe_with\*\* it/);
  const step8 = between(text, '### Step 8: Create the task file', '\n### Step 9');
  for (const line of ['depends_on: []', 'blocks: []', 'parallel_safe_with: []', 'origin_bug: ""']) {
    assert.ok(step8.includes(line), `frontmatter skeleton must keep "${line}"`);
  }
});

test('task-assess Step 2e is titled "Read the Dependency Fields" and keeps its two behaviour rules', () => {
  const text = read(TASK_ASSESS);
  assert.match(text, /### 2e\. Read the Dependency Fields/);
  assert.doesNotMatch(text, /### 2e\. Parse the Dependency Block/);
  const step2e = between(text, '### 2e.', '\n### ');
  assert.match(step2e, /`depends_on`, `blocks`, and `parallel_safe_with`/);
  assert.match(step2e, /"Dependency fields"/);
  assert.match(step2e, /missing key is treated as an empty list/i);
  assert.match(step2e, /`missing_deps`/);
});

test('task-assess Step 2e no longer carries blockquote example, link-pattern bullets, or the typed-link going-forward paragraph', () => {
  const step2e = between(read(TASK_ASSESS), '### 2e.', '\n### ');
  assert.doesNotMatch(step2e, /```/, 'no blockquote example fence');
  assert.doesNotMatch(step2e, /may be `none`/);
  assert.doesNotMatch(step2e, /\[NNN-slug\]\(NNN-slug\.md\)/);
  assert.doesNotMatch(step2e, /Going forward/);
  assert.doesNotMatch(step2e, /`depends_on::\[\[/, 'typed-link mirror is documented once in lifecycle.md, not here');
});

test('task-assess Step 2f node record uses TASK-NNNN IDs and missing_deps', () => {
  const text = read(TASK_ASSESS);
  const step2f = between(text, '### 2f.', '\n### ');
  assert.match(step2f, /id: "TASK-NNNN"/);
  assert.match(step2f, /depends_on: \["TASK-NNNN", \.\.\.\]/);
  assert.match(step2f, /blocks: \["TASK-NNNN", \.\.\.\]/);
  assert.match(step2f, /parallel_safe: \["TASK-NNNN", \.\.\.\]/);
  assert.match(step2f, /missing_deps: true\/false/);
  assert.match(step2f, /Note tasks missing dependency fields/);
  assert.match(step2f, /edit the task file/);
});

test('task-assess 2d item 3 reads dependents from frontmatter', () => {
  const step2d = between(read(TASK_ASSESS), '### 2d.', '\n### ');
  assert.match(step2d, /in their `depends_on` \/ `blocks` frontmatter/);
});

test('task-assess Step 4 reports "Missing dependency fields" (not "Missing dependency block") with a TASK-NNNN stale-reference example', () => {
  const text = read(TASK_ASSESS);
  const issues = between(text, '### 4e. Issues Found', '\n### ');
  assert.match(issues, /\*\*Missing dependency fields\*\* — task frontmatter has none of `depends_on` \/ `blocks` \/ `parallel_safe_with`/);
  assert.match(issues, /Missing dependency fields — edit the task file's frontmatter directly/);
  assert.match(issues, /Stale reference: depends_on "TASK-\d+"/);
  assert.doesNotMatch(text, /Missing dependency block/);
  assert.doesNotMatch(text, /Fix missing dependency blocks/);
});

test('task-assess Step 3 graph logic still exists (format-agnostic, untouched)', () => {
  const text = read(TASK_ASSESS);
  assert.match(text, /^## Step 3/m);
});

test('no residual blockquote-dependency-format text anywhere under lib/skills/', () => {
  const offenders = [];
  const pattern = /Depends on\*\*|Parallel-safe with|missing_block|dependency block/;
  const stack = [SKILLS];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.md') && pattern.test(fs.readFileSync(full, 'utf8'))) {
        offenders.push(path.relative(REPO, full));
      }
    }
  }
  assert.deepEqual(offenders, [], `residual restatements in: ${offenders.join(', ')}`);
});
