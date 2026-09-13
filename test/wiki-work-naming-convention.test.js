#!/usr/bin/env node
// Repeatable checks locking in TASK-0085's wiki/work/ naming-convention fixes:
// the bug-file/roadmap-create filename bugs, the added re-verify-before-write
// race guards, and the forward-only 4-digit ID standardization across
// tasks/uat/requirements/roadmaps (bugs/decisions stay 4-digit, unchanged).
// Zero-dependency: node:test + node:assert + node:fs only, mirroring the
// sibling suites.
//
// Run: npm test   (or: node --test test/wiki-work-naming-convention.test.js)
//
// Promoted from UAT-0085 (TASK-0085).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(REPO, relPath), 'utf8');
}

// EDGE-001: bug-file writes/reports the prefixed filename and has the
// re-verify race guard.
test('bug-file SKILL.md uses BUG-NNNN-<slug>.md filenames and has Step 5a re-verify guard', () => {
  const contents = read('lib/skills/bug-file/SKILL.md');
  assert.match(contents, /wiki\/work\/bugs\/BUG-NNNN-<slug>\.md/);
  assert.match(contents, /### Step 5a: Re-verify next bug number/);
});

// EDGE-002: roadmap-create writes/reports 4-digit prefixed filenames with
// zero remaining bare NNN-slug.md / bare ROADMAP-NNN mentions.
test('roadmap-create SKILL.md uses ROADMAP-NNNN-slug.md with no bare 3-digit forms', () => {
  const contents = read('lib/skills/roadmap-create/SKILL.md');
  assert.match(contents, /wiki\/work\/roadmaps\/ROADMAP-NNNN-slug\.md/);
  assert.match(contents, /ROADMAP-0001-ship-billing-portal\.md/);
  assert.match(contents, /ROADMAP-0004-migrate-postgres-17\.md/);
  assert.doesNotMatch(contents, /wiki\/work\/roadmaps\/NNN-slug\.md/);
  assert.doesNotMatch(contents, /`001-ship-billing-portal\.md`/);
  assert.doesNotMatch(contents, /`004-migrate-postgres-17\.md`/);
  assert.doesNotMatch(contents, /ROADMAP-NNN(?!N)/);
});

// EDGE-003: roadmap-next no longer contains the stale 003-billing.md example.
test('roadmap-next SKILL.md drops the stale 003-billing.md -> ROADMAP-003 example', () => {
  const contents = read('lib/skills/roadmap-next/SKILL.md');
  assert.doesNotMatch(contents, /003-billing/);
  assert.doesNotMatch(contents, /ROADMAP-003(?!\d)/);
});

// EDGE-004: task-add describes 4-digit zero-padding and width-agnostic
// (digit-count-independent) scanning.
test('task-add SKILL.md describes 4-digit zero-padding and width-agnostic scanning', () => {
  const contents = read('lib/skills/task-add/SKILL.md');
  assert.match(contents, /zero-pad the result to 4 digits/);
  assert.match(contents, /TASK-<digits>/);
  assert.match(contents, /regardless of digit count/);
});

// EDGE-005: req-create describes REQ-NNNN, has the Step 5a re-verify guard,
// and documents the flat-bullet index-entry format (not a table).
test('req-create SKILL.md uses REQ-NNNN, has Step 5a guard, and flat-bullet index format', () => {
  const contents = read('lib/skills/req-create/SKILL.md');
  assert.match(contents, /wiki\/work\/requirements\/REQ-NNNN-slug\.md/);
  assert.match(contents, /### Step 5a: Re-verify next requirement number/);
  assert.match(
    contents,
    /- \[REQ-NNNN — Title\]\(REQ-NNNN-slug\.md\) — one-line summary · status/
  );
  assert.doesNotMatch(contents, /Row\/columns/);
});

// EDGE-006: decision-create has the Step 4.5 re-verify guard and still
// describes DEC-NNNN (unchanged, still 4-digit).
test('decision-create SKILL.md has Step 4.5 re-verify guard and unchanged DEC-NNNN', () => {
  const contents = read('lib/skills/decision-create/SKILL.md');
  assert.match(contents, /## Step 4\.5: Re-verify next decision number/);
  assert.match(contents, /DEC-NNNN/);
});

// EDGE-007: the 4 changed family lifecycle.md files state 4-digit ID
// schemes; bugs/decisions lifecycle.md are unchanged (still 4-digit).
test('tasks/uat/requirements/roadmaps lifecycle.md files state 4-digit ID schemes', () => {
  assert.match(read('wiki/work/tasks/lifecycle.md'), /TASK-NNNN\*\* \(4-digit, zero-padded\)/);
  assert.match(read('wiki/work/uat/lifecycle.md'), /UAT-NNNN\*\* \(4-digit, zero-padded\)/);
  assert.match(
    read('wiki/work/requirements/lifecycle.md'),
    /REQ-NNNN\*\* \(4-digit, zero-padded, globally unique\)/
  );
  assert.match(
    read('wiki/work/roadmaps/lifecycle.md'),
    /ROADMAP-NNNN\*\* \(4-digit, zero-padded\)/
  );
});

test('bugs/decisions lifecycle.md remain 4-digit and unchanged', () => {
  assert.match(
    read('wiki/work/bugs/lifecycle.md'),
    /BUG-NNNN\*\* \(4-digit, zero-padded, globally unique\)/
  );
  assert.match(
    read('wiki/work/decisions/lifecycle.md'),
    /DEC-NNNN\*\* \(4-digit, zero-padded\)/
  );
});

// EDGE-008: CLAUDE.md and wiki/conventions.md state 4-digit tokens for the
// 4 changed families and leave DEC-NNNN/BUG-NNNN mentions unchanged.
test('CLAUDE.md and wiki/conventions.md use 4-digit tokens with DEC-NNNN/BUG-NNNN unchanged', () => {
  const claude = read('CLAUDE.md');
  const conventions = read('wiki/conventions.md');
  assert.doesNotMatch(claude, /TASK-NNN(?!N)|UAT-NNN(?!N)|REQ-NNN(?!N)|ROADMAP-NNN(?!N)/);
  assert.doesNotMatch(conventions, /TASK-NNN(?!N)|UAT-NNN(?!N)|REQ-NNN(?!N)|ROADMAP-NNN(?!N)/);
  assert.match(claude, /DEC-NNNN/);
  assert.match(claude, /BUG-NNNN/);
  assert.match(conventions, /DEC-NNNN/);
  assert.match(conventions, /BUG-NNNN/);
});

// EDGE-009: comprehensive sweep — zero remaining stale bare-3-digit
// placeholder tokens across lib/skills/**/*.md. The strongest regression
// guard: directly encodes "the mechanical sweep is complete."
test('lib/skills/**/*.md has zero remaining stale 3-digit placeholder tokens', () => {
  const staleRegex = /TASK-NNN(?!N)|UAT-NNN(?!N)|REQ-NNN(?!N)|ROADMAP-NNN(?!N)/;
  const skillsDir = path.join(REPO, 'lib', 'skills');
  const offenders = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const contents = fs.readFileSync(full, 'utf8');
        if (staleRegex.test(contents)) {
          offenders.push(path.relative(REPO, full));
        }
      }
    }
  }

  walk(skillsDir);
  assert.deepStrictEqual(offenders, [], `stale tokens found in: ${offenders.join(', ')}`);
});

// EDGE-010: no existing 3-digit-ID work-item file was renamed or lost.
test('pre-existing 3-digit TASK-001 file still exists at its original filename', () => {
  const archived = path.join(
    REPO,
    'wiki',
    'work',
    'tasks',
    'archive',
    'TASK-001-audit-skill-readme-drift.md'
  );
  assert.strictEqual(fs.existsSync(archived), true, `${archived} should still exist`);
});
