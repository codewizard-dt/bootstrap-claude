#!/usr/bin/env node
// Contract checks for TASK-0093: /adr-next's task-less-accepted-decision
// check folded into /wiki-lint as check 2.12, referenced (not restated) from
// /wiki-tidy Phase 1, and cross-referenced from /adr-next. Zero-dependency:
// node:test + node:assert only, mirroring the sibling skill-content suites
// (test/bug-close-clustering-offer.test.js, test/prior-art-scan.test.js).
//
// Run: npm test   (or: node --test test/wiki-lint-taskless-decisions.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0093 is a documentation-only change to three
// SKILL.md files — the markdown IS the program a future agent executes. The
// risks pinned here: (1) 2.12 must exist, in numeric order, with the ported
// scan logic and the "report EVERY instance" contract that distinguishes it
// from /adr-next's stop-at-first design; (2) wiki-tidy's check count must
// match wiki-lint's real check count (13, 2.0-2.12 — NOT the "12" the task text
// originally guessed, because wiki-lint has always had 2.0 through 2.10 plus
// the 2.11 added by TASK-0092) and must reference, not inline, the logic;
// (3) /adr-next must gain the cross-reference line without any behavior
// change (still Haiku, still stops at the first gap).
//
// SCOPE — repo copies under lib/skills/ only; never the machine-local
// ~/.claude/skills/ copies (install-global.sh overwrites those on next sync).
//
// HERMETIC: reads three repo-local files. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');
const LINT = path.join(SKILLS, 'wiki-lint', 'SKILL.md');
const TIDY = path.join(SKILLS, 'wiki-tidy', 'SKILL.md');
const NEXT = path.join(SKILLS, 'adr-next', 'SKILL.md');

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

function check212(text) {
  return between(text, '### 2.12 ', '## Step 3');
}

test('wiki-lint has "### 2.12 Task-less accepted decisions (MEDIUM)" after 2.10 and 2.11, before Step 3', () => {
  const text = read(LINT);
  const i210 = text.indexOf('### 2.10 ');
  const i211 = text.indexOf('### 2.11 ');
  const i212 = text.indexOf('### 2.12 Task-less accepted decisions (MEDIUM)');
  const iStep3 = text.indexOf('## Step 3');
  assert.ok(i210 !== -1, '2.10 heading missing');
  assert.ok(i211 !== -1, '2.11 heading missing');
  assert.ok(i212 !== -1, 'exact 2.12 heading "### 2.12 Task-less accepted decisions (MEDIUM)" missing');
  assert.ok(i210 < i211 && i211 < i212, '2.12 must follow 2.10 and 2.11 in numeric order');
  assert.ok(i212 < iStep3, '2.12 must sit inside Step 2, before "## Step 3"');
  assert.strictEqual((text.match(/^### 2\.12 /gm) || []).length, 1, '2.12 must appear exactly once');
});

test('wiki-lint 2.12 ports the adr-next Step 2 scan logic (D-block parse, accepted-only, Links/Source task(s) test)', () => {
  const section = check212(read(LINT));
  assert.ok(section.includes('decision file in `wiki/work/decisions/`'), 'must scan wiki/work/decisions/');
  assert.ok(section.includes('excluding `lifecycle.md`'), 'must exclude lifecycle.md');
  assert.ok(section.includes('include `archive/`'), 'must include archive/');
  assert.ok(section.includes('## D\\d+\\.'), 'must parse decision blocks by the ## D\\d+\\. H2 pattern');
  assert.ok(section.includes('Status: accepted'), 'must gate on Status: accepted');
  for (const skipped of ['proposed', 'deprecated', 'superseded by']) {
    assert.ok(section.includes(skipped), `must skip non-accepted status: ${skipped}`);
  }
  assert.ok(section.includes('### Links'), 'must inspect the ### Links section');
  assert.ok(section.includes('Source task(s):'), 'must inspect the Source task(s): line');
  assert.match(section, /absent/, 'must treat an absent Links section as task-less');
  assert.match(section, /blank \/ contains only a placeholder/, 'must treat blank/placeholder Source task(s) as task-less');
  assert.ok(section.includes('none yet'), 'must name the "none yet" placeholder (the form DEC-0001 actually uses)');
});

test('wiki-lint 2.12 reports EVERY task-less accepted decision (contrast with adr-next stop-at-first)', () => {
  const section = check212(read(LINT));
  assert.match(section, /report \*\*every\*\* task-less accepted decision found across all decision files/);
  assert.ok(section.includes('/adr-next'), 'must contrast itself with /adr-next');
  assert.ok(section.includes('stops at the first gap'), 'must state adr-next stops at the first gap');
  assert.ok(section.includes('report all, fix none without approval'), 'must keep the lint report-only contract');
  assert.doesNotMatch(section, /stop at the \*\*first\*\*/i, '2.12 must not adopt the stop-at-first behavior');
});

test('wiki-lint 2.12 uses the exact MEDIUM report format', () => {
  const section = check212(read(LINT));
  assert.ok(
    section.includes('[MEDIUM] task-less accepted decision — ADR-NNNN#DM (<title>) has no Source task(s) link'),
    'report line must match the task-specified format exactly'
  );
});

test('wiki-lint check headings run contiguously 2.0-2.12 (13 checks)', () => {
  const nums = [...read(LINT).matchAll(/^### 2\.(\d+) /gm)].map((m) => Number(m[1]));
  assert.deepStrictEqual(nums, Array.from({ length: 13 }, (_, i) => i), 'expected headings 2.0 through 2.12, in order, once each');
});

test('wiki-tidy Phase 1 says "all 13 checks, 2.0–2.12" — matching wiki-lint, not the stale 10 nor the task text\'s 12', () => {
  const phase1 = between(read(TIDY), '## Phase 1: Lint', '## Phase 2');
  assert.ok(phase1.includes('Run all 13 checks, 2.0–2.12'), 'Phase 1 must say "Run all 13 checks, 2.0–2.12"');
  assert.doesNotMatch(phase1, /all 10 checks/, 'stale "all 10 checks" wording must be gone');
  assert.doesNotMatch(phase1, /all 12 checks/, 'must not use the miscounted "all 12 checks"');
});

test('wiki-tidy Phase 1 names the previously-missing checks (provenance, typed-link target resolution, task-less accepted decisions)', () => {
  const phase1 = between(read(TIDY), '## Phase 1: Lint', '## Phase 2');
  assert.ok(phase1.includes('provenance/confidence'), 'must name the 2.10 provenance check omitted by the old list');
  assert.ok(phase1.includes('typed-link target resolution'), 'must name the 2.11 check');
  assert.ok(phase1.includes('task-less accepted decisions'), 'must name the 2.12 check');
});

test('wiki-tidy references (does not restate) the 2.12 logic', () => {
  const phase1 = between(read(TIDY), '## Phase 1: Lint', '## Phase 2');
  assert.ok(phase1.includes('each check\'s logic lives in `/wiki-lint`'), 'must point at /wiki-lint for check logic');
  for (const inlined of ['Source task(s):', '### Links', '## D\\d+', 'Status: accepted']) {
    assert.ok(!phase1.includes(inlined), `Phase 1 must not inline check logic (found: ${inlined})`);
  }
});

test('wiki-tidy check-name list has one entry per wiki-lint check (13)', () => {
  const phase1 = between(read(TIDY), '## Phase 1: Lint', '## Phase 2');
  const list = phase1.match(/\(([^)]*task-less accepted decisions)\)/);
  assert.ok(list, 'parenthesised check-name list ending in "task-less accepted decisions" not found');
  assert.strictEqual(list[1].split(',').length, 13, 'list must enumerate 13 check names');
});

test('adr-next carries the verbatim 2.12 cross-reference between the description and "## Step 0"', () => {
  const text = read(NEXT);
  const line =
    'This same check now also runs as part of `/wiki-lint` (check 2.12) for scheduled sweeps across every decision file at once — use this skill directly when you want just the next single gap, fast.';
  const iLine = text.indexOf(line);
  const iIntro = text.indexOf('Scan accepted decisions for ones missing a task reference');
  const iStep0 = text.indexOf('## Step 0');
  assert.ok(iLine !== -1, 'cross-reference line missing or altered');
  assert.ok(iIntro !== -1 && iIntro < iLine, 'cross-reference must come after the description');
  assert.ok(iLine < iStep0, 'cross-reference must come before "## Step 0"');
  assert.strictEqual(text.split(line).length - 1, 1, 'cross-reference must appear exactly once');
});

test('adr-next behavior is unchanged: still Haiku, still narrow, still stops at the first gap', () => {
  const text = read(NEXT);
  assert.match(text, /^model: claude-haiku-4-5-20251001$/m, 'must remain a Haiku-model skill');
  assert.match(text, /^description: Find the first accepted decision missing a task reference; surface suggested \/task-create command$/m);
  assert.ok(text.includes('Stop at the **first** gap — do not enumerate all gaps.'), 'must still stop at the first gap');
  assert.ok(text.includes('## Step 2: Scan Each File for Task-less Accepted Decisions'), 'Step 2 scan logic must remain');
  assert.ok(text.includes('## Step 3: Verify the Task File Actually Exists'), 'Step 3 broken-link verification must remain');
});
