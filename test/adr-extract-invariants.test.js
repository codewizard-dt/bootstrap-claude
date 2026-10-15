#!/usr/bin/env node
// Behavioural-contract pins for lib/skills/adr-extract/SKILL.md (TASK-0118,
// generated with UAT-0118). Zero-dependency: node:test + node:assert only.
//
// Complements test/adr-extract-rename-residue.test.js (residue sweep + content
// markers) by pinning the parts of the contract that sweep does not:
//   (a) the Prereqs line is byte-identical to the pre-rename skill's line;
//   (b) frontmatter metadata other than name/description/argument-hint is unchanged;
//   (c) PRD mode keeps the approved gate and the Linked-Decisions / back-link
//       write-back, each scoped to the step that owns it;
//   (d) document mode has no status gate and writes only the log entry;
//   (e) the ID-RESOLUTION.md Caller-deltas table gives adr-extract its own row.
//
// Deliberately silent about prd-deprecate / adr-deprecate and install-global.sh
// (owned by other in-flight tasks).
//
// Run: node --test test/adr-extract-invariants.test.js
//
// HERMETIC: read-only, repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILL = path.join(REPO, 'lib', 'skills', 'adr-extract', 'SKILL.md');
const SHARED = path.join(REPO, 'lib', 'skills', '_shared', 'ID-RESOLUTION.md');

const PREREQS_LINE = '**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.';

const text = () => fs.readFileSync(SKILL, 'utf8');

function frontmatter(t) {
  return t.split(/^---\s*$/m)[1] || '';
}

// The body of a "### Step N" section: from its heading up to the next "### " or
// "## " heading.
function step(t, n) {
  const start = t.search(new RegExp(`^### Step ${n}:`, 'm'));
  assert.ok(start >= 0, `### Step ${n} not found`);
  const afterHeading = t.indexOf('\n', start) + 1;
  const rest = t.slice(afterHeading);
  // "## [" opens the log-line template inside a code fence, not a heading.
  const end = rest.search(/^(### |## (?!\[))/m);
  return end < 0 ? rest : rest.slice(0, end);
}

test('(a) Prereqs line is byte-identical to the pre-rename skill and appears exactly once', () => {
  const lines = text().split('\n').filter((l) => l.startsWith('**Prereqs:**'));
  assert.deepEqual(lines, [PREREQS_LINE]);
});

test('(b) category, model, effort and invocation flags are unchanged', () => {
  const fm = frontmatter(text());
  for (const line of [
    'category: planning',
    'model: claude-opus-5',
    'effort: high',
    'disable-model-invocation: false',
    'user-invocable: true',
  ]) {
    assert.match(fm, new RegExp('^' + line + '\\s*$', 'm'), `frontmatter must keep "${line}"`);
  }
});

test('(c) PRD mode: Step 2 gate continues only on approved and redirects draft/retired/superseded', () => {
  const s2 = step(text(), 2);
  assert.match(s2, /\| `approved` \| Continue to Step 3 \|/);
  assert.match(s2, /\| `draft` \|[^\n]*\/prd-finalize/);
  assert.match(s2, /\| `retired` \|[^\n]*\/prd-create/);
  assert.match(s2, /\| `superseded` \|[^\n]*successor PRD/);
});

test('(c) PRD mode: Step 7 writes the PRD Linked Decisions table and bumps updated', () => {
  const s7 = step(text(), 7);
  assert.match(s7, /\*\*PRD mode:\*\*/);
  assert.match(s7, /## Linked Decisions/);
  assert.match(s7, /`Read` then `Edit`/);
  assert.match(s7, /frontmatter `updated`/);
});

test('(c) PRD mode: Step 8 appends a Source PRD back-link, skipping when a Source PRD or legacy Source REQ line exists', () => {
  const s8 = step(text(), 8);
  assert.match(s8, /- Source PRD: \[PRD-NNNN\]\(\.\.\/requirements\/PRD-NNNN-slug\.md\)/);
  assert.match(s8, /`Source PRD:` line \*\*or a legacy `Source REQ:` line\*\*[^\n]*already exists[^\n]*skip if present/);
});

test('(d) document mode: Step 2 has no status gate', () => {
  assert.match(step(text(), 2), /\*\*Document mode\*\* has no status gate/);
});

test('(d) document mode: Steps 7 and 8 are skipped; only the log entry is appended', () => {
  const t = text();
  assert.match(step(t, 7), /\*\*Document mode\*\* skips this step/);
  assert.match(step(t, 7), /append only the log entry/);
  assert.match(step(t, 8), /\*\*Document mode\*\* skips this step/);
});

test('(d) document mode: a missing file stops with File not found and is never created', () => {
  const s1 = step(text(), 1);
  assert.match(s1, /`File not found: <path>`/);
  assert.match(s1, /never create it/);
});

test('(d) document mode is stated read-only apart from the log entry in the intro and CRITICAL rule 5', () => {
  const t = text();
  assert.match(t, /In \*\*document mode\*\* it is read-only apart from the log entry/);
  assert.match(t, /Document mode is read-only apart from the log entry/);
});

test('(d) the log line is appended in both modes', () => {
  const s7 = step(text(), 7);
  assert.match(s7, /Append to `wiki\/log\.md`[^\n]*both modes/);
  assert.match(s7, /## \[YYYY-MM-DD\] adr-extract \| <PRD-NNNN or document path> <title> — N ASRs identified/);
});

test('(e) ID-RESOLUTION Caller-deltas gives adr-extract its own row (requirements, active, interactive)', () => {
  const rows = fs
    .readFileSync(SHARED, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('|') && l.includes('`adr-extract`'));
  assert.equal(rows.length, 1, 'adr-extract must appear in exactly one table row');
  const cells = rows[0].split('|').map((c) => c.trim());
  assert.equal(cells[1], '`adr-extract`', 'the row must be adr-extract alone, not shared with another skill');
  assert.equal(cells[2], 'requirements');
  assert.equal(cells[3], '`active`');
  assert.equal(cells[4], 'interactive');
  assert.match(cells[5], /PRD mode only/);
  assert.match(cells[5], /status: approved/);
  assert.match(cells[5], /document mode and skips resolution entirely/);
});
