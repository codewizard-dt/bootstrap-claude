#!/usr/bin/env node
// Contract checks for the task dependency-link documentation in task-create and
// task-assess (originally TASK-057's typed-link reconciliation; updated for
// TASK-0102, which moved the dependency schema into a single home).
// Zero-dependency: node:test + node:assert only, mirroring the sibling
// skill-content suites (test/bootstrap-config-skill.test.js,
// test/scripts-readme-prefs-docs.test.js).
//
// Run: npm test   (or: node --test test/task-typed-links.test.js)
//
// WHY THIS IS TESTED AT ALL. The SKILL.md markdown IS the program a future
// agent executes. TASK-0102 removed the legacy `> **Depends on**:` blockquote
// wording; the dependency schema now lives once in
// wiki/work/tasks/lifecycle.md ("Dependency fields"). The risk is drift back
// to duplicated schema text: task-assess Step 2e must read the dependency
// fields from YAML frontmatter and defer to lifecycle.md rather than restate
// the schema or re-document the typed-link lines, and task-create must keep
// describing the depends_on::/blocks:: body lines as an optional mirror of the
// frontmatter arrays (no backfill of pre-existing task files).
//
// SCOPE — the two SKILL.md files above, and nothing else. Does not touch
// wiki/conventions.md's typed-link vocabulary.
//
// HERMETIC: reads two repo-local files. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TASK_ASSESS_SKILL = path.join(REPO, 'lib', 'skills', 'task-assess', 'SKILL.md');
const TASK_CREATE_SKILL = path.join(REPO, 'lib', 'skills', 'task-create', 'SKILL.md');

function readSkill(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function step2eSection(text) {
  const start = text.indexOf('### 2e. Read the Dependency Fields');
  const end = text.indexOf('### 2f. Build the Node Record');
  assert.ok(start !== -1, 'Step 2e heading must exist');
  assert.ok(end !== -1, 'Step 2f heading must exist');
  assert.ok(start < end, 'Step 2e must precede Step 2f');
  return text.slice(start, end);
}

test('task-assess/SKILL.md Step 2e no longer documents the typed-link lines', () => {
  const section = step2eSection(readSkill(TASK_ASSESS_SKILL));
  assert.doesNotMatch(
    section,
    /depends_on::|blocks::/,
    'task-assess/SKILL.md Step 2e must not document depends_on::/blocks:: typed-link lines (schema lives in lifecycle.md)'
  );
});

test('task-assess/SKILL.md Step 2e reads the dependency fields from YAML frontmatter, not the blockquote', () => {
  const section = step2eSection(readSkill(TASK_ASSESS_SKILL));
  assert.match(
    section,
    /YAML frontmatter[^\n]*`depends_on`, `blocks`, and `parallel_safe_with`/,
    'task-assess/SKILL.md Step 2e must read depends_on/blocks/parallel_safe_with from YAML frontmatter'
  );
  assert.doesNotMatch(
    section,
    /blockquote|Depends on\*\*/i,
    'task-assess/SKILL.md Step 2e must not reference the legacy blockquote'
  );
});

test('task-assess/SKILL.md Step 2e defers to lifecycle.md "Dependency fields" for the schema', () => {
  const section = step2eSection(readSkill(TASK_ASSESS_SKILL));
  assert.match(
    section,
    /`wiki\/work\/tasks\/lifecycle\.md` \("Dependency fields"\)/,
    'task-assess/SKILL.md Step 2e must point at lifecycle.md "Dependency fields" instead of restating the schema'
  );
});

test('task-create/SKILL.md body template renders implements:: then (optionally relates_to::) then depends_on:: then blocks::, in order', () => {
  const text = readSkill(TASK_CREATE_SKILL);
  // TASK-0091 introduced an optional relates_to::[[<slug>]] line that sits
  // between implements:: and depends_on:: (same "context link" slot as
  // implements::), so the three original lines are no longer guaranteed to
  // be strictly consecutive — only strictly ordered, with at most one
  // optional line between implements:: and depends_on::.
  assert.match(
    text,
    /implements::\[\[ADR-NNNN#DM\]\][^\n]*\n(?:relates_to::\[\[<slug>\]\][^\n]*\n)?depends_on::\[\[TASK-NNNN?\]\][^\n]*\nblocks::\[\[TASK-NNNN?\]\]/,
    'the template must render implements:: then (optionally relates_to::) then depends_on:: then blocks:: in order'
  );
});

test('task-create/SKILL.md prose documents the dependency-link placement rule sourced from Step 5', () => {
  const text = readSkill(TASK_CREATE_SKILL);
  assert.match(
    text,
    /\*\*Dependency links\*\* \(from the Step 5 data, no re-derivation needed\): insert one `depends_on::\[\[TASK-NNN\]\]` line per dependency and one `blocks::\[\[TASK-NNN\]\]` line per blocked task/,
    'task-create/SKILL.md must document sourcing dependency links from the existing Step 5 data'
  );
});

test('task-create/SKILL.md describes the typed-link lines as an optional frontmatter mirror, with no backfill', () => {
  const text = readSkill(TASK_CREATE_SKILL);
  assert.match(
    text,
    /These lines are an optional graph-view mirror of the frontmatter arrays \(see `wiki\/work\/tasks\/lifecycle\.md`, "Dependency fields"\); creating them here does not backfill any pre-existing task file/,
    'task-create/SKILL.md must state the typed-link lines mirror the frontmatter arrays (per lifecycle.md "Dependency fields") and do not backfill existing tasks'
  );
});
