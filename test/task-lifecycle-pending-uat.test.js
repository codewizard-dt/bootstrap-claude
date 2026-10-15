#!/usr/bin/env node
// Lockstep guard for the `pending-uat` task status (TASK-0125): it must be
// documented in both tasks/lifecycle.md copies (wiki/ and template), both
// tasks/index.md headers, /primer's consistency check, and both dashboard
// tone maps -- and every status /tackle writes must be a member of the
// lifecycle enum. Zero-dependency: node:test + node:assert + node:vm only.
//
// Run: node --test test/task-lifecycle-pending-uat.test.js
//
// HERMETIC: read-only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(REPO, ...rel.split('/')), 'utf8');
}

const LIFECYCLES = [
  'wiki/work/tasks/lifecycle.md',
  'lib/scripts/templates/wiki/work/tasks/lifecycle.md',
];
const INDEXES = [
  'wiki/work/tasks/index.md',
  'lib/scripts/templates/wiki/work/tasks/index.md',
];
const DASHBOARDS = [
  'lib/scripts/templates/wiki/dashboard.html',
  'wiki/dashboard.html',
];

function statusEnum(lifecycleText) {
  const row = lifecycleText.split('\n').find((l) => /^\|\s*`status`\s*\|/.test(l));
  assert.ok(row, 'lifecycle.md must have a `status` frontmatter row');
  const m = row.match(/`([^`]+)`/g);
  const cell = m && m.map((s) => s.slice(1, -1)).find((s) => s.includes('todo'));
  assert.ok(cell, 'status row must list the enum inside backticks');
  return cell.split(/\s*\\?\|\s*/).map((s) => s.trim()).filter(Boolean);
}

// Returns source text from `startIdx` (which must sit at or before the opening
// brace) through the matching closing brace, via a balanced-brace scan.
function balancedBlock(src, startIdx, what) {
  const open = src.indexOf('{', startIdx);
  assert.notEqual(open, -1, `extraction failed: no opening brace for ${what}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  assert.fail(`extraction failed: unbalanced braces for ${what}`);
}

function extractStatusHelpers(html, label) {
  const tonesAt = html.indexOf('const STATUS_TONES = {');
  assert.notEqual(tonesAt, -1, `extraction failed: "const STATUS_TONES = {" not found in ${label}`);
  const tones = balancedBlock(html, tonesAt, `STATUS_TONES in ${label}`) + ';';

  const kwMatch = html.match(/const STATUS_KEYWORDS = [^;\n]+;/);
  assert.ok(kwMatch, `extraction failed: STATUS_KEYWORDS declaration not found in ${label}`);

  const fnAt = html.indexOf('function statusKeyword(');
  assert.notEqual(fnAt, -1, `extraction failed: "function statusKeyword(" not found in ${label}`);
  const fn = balancedBlock(html, fnAt, `statusKeyword in ${label}`);

  return { tones, keywords: kwMatch[0], fn };
}

test('both tasks lifecycle.md copies are byte-identical and document pending-uat', () => {
  const [local, template] = LIFECYCLES.map(read);
  assert.equal(local, template, 'wiki/work/tasks/lifecycle.md must stay in lockstep with its template copy');

  const order = statusEnum(local);
  const inProgress = order.indexOf('in-progress');
  const pendingUat = order.indexOf('pending-uat');
  const done = order.indexOf('done');
  assert.ok(pendingUat !== -1, `status enum must contain pending-uat (got: ${order.join(', ')})`);
  assert.ok(
    inProgress !== -1 && inProgress < pendingUat && pendingUat < done,
    `pending-uat must sit between in-progress and done in the enum (got: ${order.join(', ')})`
  );

  assert.ok(
    local.split('\n').some((l) => l.includes('in-progress ──▶ pending-uat ──▶ done')),
    'lifecycle diagram must contain the line "in-progress ──▶ pending-uat ──▶ done"'
  );
});

for (const rel of INDEXES) {
  test(`${rel} header names pending-uat among the active statuses`, () => {
    const line = read(rel).split('\n').find((l) => /Lists \*\*only active\*\* tasks \(/.test(l));
    assert.ok(line, `${rel} must contain the "Lists **only active** tasks (...)" sentence`);
    const listed = line.match(/Lists \*\*only active\*\* tasks \(([^)]*)\)/)[1];
    assert.match(listed, /`pending-uat`/, `${rel} active-status list must name pending-uat (got: ${listed})`);
  });
}

test('primer consistency check names pending-uat', () => {
  const line = read('lib/skills/primer/SKILL.md').split('\n').find((l) => l.includes('Consistency check'));
  assert.ok(line, 'lib/skills/primer/SKILL.md must contain a line with "Consistency check"');
  assert.match(line, /pending-uat/, 'primer consistency-check sentence must name pending-uat');
});

for (const rel of DASHBOARDS) {
  test(`${rel}: STATUS_TONES has pending-uat and statusKeyword keeps word-boundary rules`, () => {
    const html = read(rel);
    const { tones, keywords, fn } = extractStatusHelpers(html, rel);
    assert.match(tones, /'pending-uat'\s*:/, `STATUS_TONES in ${rel} must have a 'pending-uat' key`);

    const sandbox = vm.createContext({});
    vm.runInContext(`${tones}\n${keywords}\n${fn}\nthis.statusKeyword = statusKeyword;`, sandbox);
    const statusKeyword = sandbox.statusKeyword;
    assert.equal(typeof statusKeyword, 'function', `statusKeyword must evaluate to a function in ${rel}`);

    assert.equal(statusKeyword('pending-uat'), 'pending-uat');
    assert.equal(statusKeyword('todo'), 'todo');
    assert.equal(statusKeyword('pending'), 'pending', 'bare "pending" must not be swallowed by pending-uat');
  });
}

test('every task status written by /tackle is a member of the lifecycle enum', () => {
  const enumValues = statusEnum(read(LIFECYCLES[0]));
  const tackle = read('lib/skills/tackle/SKILL.md');
  const written = ['pending-uat', 'in-progress'];
  for (const status of written) {
    assert.ok(
      new RegExp('`' + status + '`').test(tackle),
      `lib/skills/tackle/SKILL.md must still write status \`${status}\``
    );
    assert.ok(
      enumValues.includes(status),
      `tackle writes status "${status}" but lifecycle enum is: ${enumValues.join(', ')}`
    );
  }
});
