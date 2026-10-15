#!/usr/bin/env node
// Invariants of the decisions-family ADR rename (TASK-0117) that the sibling
// suites do not pin: the two decisions lifecycle.md copies stay in lockstep,
// the pre-existing DEC-0001 item and the wiki/work/decisions/ directory are
// intact, and adr-create's Step 4.5 re-verify guard uses the same both-prefix
// allocation rule as Step 2. Zero-dependency: node:test + node:assert only.
//
// Run: node --test test/adr-rename-invariants.test.js
//
// NOTE: the DEC-0001 assertions describe the state between TASK-0117 and the
// `update` migration that renames DEC- items to ADR-. Whoever lands that
// migration updates the DEC-0001 test below in the same change.
//
// HERMETIC: read-only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(REPO, ...rel.split('/')), 'utf8');
}

test('both decisions lifecycle.md copies (wiki/ and template) are byte-identical', () => {
  const local = read('wiki/work/decisions/lifecycle.md');
  const template = read('lib/scripts/templates/wiki/work/decisions/lifecycle.md');
  assert.equal(local, template, 'wiki/work/decisions/lifecycle.md must stay in lockstep with its template copy');
  assert.match(local, /ADR-NNNN/, 'lifecycle must state the ADR-NNNN ID scheme');
  assert.match(local, /DEC-NNNN/, 'lifecycle must say pre-existing DEC-NNNN items keep their IDs until migration');
});

test('DEC-0001 keeps its file name, id and aliases, and the decisions directory is intact', () => {
  const dir = path.join(REPO, 'wiki', 'work', 'decisions');
  for (const entry of ['lifecycle.md', 'index.md', 'archive']) {
    assert.ok(fs.existsSync(path.join(dir, entry)), `wiki/work/decisions/${entry} must still exist`);
  }
  const file = 'wiki/work/decisions/archive/DEC-0001-wiki-cross-family-linking-schema.md';
  assert.ok(fs.existsSync(path.join(REPO, file)), `${file} must exist under its original DEC- name`);
  const frontmatter = read(file).split(/^---\s*$/m)[1] || '';
  assert.match(frontmatter, /^id:\s*DEC-0001\s*$/m, 'DEC-0001 id must be unchanged');
  assert.match(frontmatter, /^aliases:\s*\[DEC-0001\]\s*$/m, 'DEC-0001 aliases must be unchanged');
});

test('adr-create Step 4.5 re-verify repeats the both-prefix max(N)+1 allocation rule', () => {
  const text = read('lib/skills/adr-create/SKILL.md');
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => /^Repeat § Number allocation step 6/.test(l));
  assert.ok(idx !== -1, 'adr-create: Step 4.5 re-verify line not found');
  const line = lines[idx];
  assert.ok(line.includes('ADR-') && line.includes('legacy `DEC-`'), `adr-create.md:${idx + 1}: re-verify must count ADR- and legacy DEC-`);
  assert.ok(line.includes('max(N)+1'), `adr-create.md:${idx + 1}: re-verify must use max(N)+1`);
});
