#!/usr/bin/env node
// Contract checks for TASK-0092's new "### 2.11 Typed-link target resolution
// (MEDIUM)" check in /wiki-lint (lib/skills/wiki-lint/SKILL.md). Zero-dependency:
// node:test + node:assert only, mirroring the sibling skill-content suites
// (test/knowledge-link-flag.test.js, test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/wiki-lint-typed-link-resolution.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0092 is a documentation-only change to one
// SKILL.md file — the markdown IS the program a future agent executes. The
// existing 2.5 check only validates the keyword before `::`; 2.11 validates
// that the target after it actually resolves. This suite pins: (1) 2.11 exists
// right after 2.10 and before Step 3, (2) it reuses 2.5's `::[[` scan rather
// than defining a second scanner, (3) it resolves the three target classes
// (decision incl. #DM anchor, work-family IDs, knowledge slugs) with both the
// active dir and archive/ in scope, (4) the dangling and superseded report
// lines match the task's specified wording and severities, (5) Steps 3 and 4
// are structurally unchanged and 2.11's output follows the shared
// `[SEVERITY] <finding-type> — <detail>` shape, and (6) 2.5 itself is intact.
//
// SCOPE — lib/skills/wiki-lint/SKILL.md only. Does not touch the machine-local
// ~/.claude/skills/wiki-lint/ copy (install-global.sh overwrites it on next
// sync; this repo's copy is the only source of truth). Section boundaries are
// located by heading text, not number arithmetic, so a later sibling check
// (e.g. TASK-0093's 2.12) landing after 2.11 does not break the suite.
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILL = path.join(REPO, 'lib', 'skills', 'wiki-lint', 'SKILL.md');

const H_2_5 = '### 2.5 Typed-link vocabulary (LOW)';
const H_2_10 = '### 2.10 Provenance / confidence (LOW)';
const H_2_11 = '### 2.11 Typed-link target resolution (MEDIUM)';
const H_STEP_3 = '## Step 3: Report findings';
const H_STEP_4 = '## Step 4: Propose fixes';
const H_STEP_5 = '## Step 5: Apply approved fixes only';

function readSkill() {
  assert.ok(fs.existsSync(SKILL), `${SKILL} does not exist`);
  return fs.readFileSync(SKILL, 'utf8');
}

// Slice from `startHeading` to the nearest following heading of either
// `### 2.` or `## Step` depth, whichever comes first.
function section(text, startHeading) {
  const start = text.indexOf(startHeading);
  assert.ok(start !== -1, `heading not found: ${startHeading}`);
  const rest = text.slice(start + startHeading.length);
  const next = rest.search(/\n(?:### 2\.\d+ |## Step )/);
  return next === -1 ? text.slice(start) : text.slice(start, start + startHeading.length + next);
}

// ---------------------------------------------------------------------------
// Placement and heading
// ---------------------------------------------------------------------------

test('wiki-lint/SKILL.md has the 2.11 heading with MEDIUM severity', () => {
  const text = readSkill();
  assert.ok(text.includes(H_2_11), `expected heading: ${H_2_11}`);
});

test('2.11 sits immediately after 2.10 and before Step 3', () => {
  const text = readSkill();
  const i10 = text.indexOf(H_2_10);
  const i11 = text.indexOf(H_2_11);
  const iStep3 = text.indexOf(H_STEP_3);
  assert.ok(i10 !== -1, '2.10 heading must still exist');
  assert.ok(i11 !== -1, '2.11 heading must exist');
  assert.ok(iStep3 !== -1, 'Step 3 heading must still exist');
  assert.ok(i10 < i11 && i11 < iStep3, '2.11 must be after 2.10 and before Step 3');
  const between = text.slice(i10 + H_2_10.length, i11);
  assert.ok(
    !/\n### 2\.\d+ /.test(between),
    'no other 2.N check may sit between 2.10 and 2.11'
  );
});

// ---------------------------------------------------------------------------
// Reuses 2.5's scan
// ---------------------------------------------------------------------------

test('2.11 reuses the 2.5 `::[[` scan via mcp__serena__search_for_pattern instead of a second scanner', () => {
  const s = section(readSkill(), H_2_11);
  assert.ok(s.includes('Reuse the `::[[` scan from 2.5'), 'must state it reuses the 2.5 scan');
  assert.ok(s.includes('mcp__serena__search_for_pattern'), 'must name mcp__serena__search_for_pattern');
  assert.ok(s.includes('wiki/'), 'scan must cover wiki/');
  assert.ok(s.includes('validates the target'), 'must distinguish target validation from 2.5 keyword validation');
});

// ---------------------------------------------------------------------------
// Resolution logic — decision targets
// ---------------------------------------------------------------------------

test('2.11 resolves ADR-NNNN / ADR-NNNN#DM (and legacy DEC-NNNN / DEC-NNNN#DM) targets against decisions/ and decisions/archive/', () => {
  const s = section(readSkill(), H_2_11);
  assert.ok(s.includes('`ADR-NNNN`'), 'must cover bare ADR-NNNN targets');
  assert.ok(s.includes('`ADR-NNNN#DM`'), 'must cover ADR-NNNN#DM anchored targets');
  assert.ok(s.includes('`DEC-NNNN`'), 'must still cover legacy bare DEC-NNNN targets');
  assert.ok(s.includes('`DEC-NNNN#DM`'), 'must still cover legacy DEC-NNNN#DM anchored targets');
  assert.ok(s.includes('wiki/work/decisions/'), 'must search wiki/work/decisions/');
  assert.ok(s.includes('wiki/work/decisions/archive/'), 'must also search wiki/work/decisions/archive/');
  assert.ok(s.includes('mcp__serena__find_file'), 'must locate the file via mcp__serena__find_file');
});

test('2.11 confirms the #DM decision block exists in the file (H2 `## DM.` with a Status line)', () => {
  const s = section(readSkill(), H_2_11);
  assert.match(s, /If a `#DM` anchor is present, confirm that decision block exists in the file/);
  assert.ok(s.includes('## DM.'), 'must describe the block as an H2 matching `## DM.`');
  assert.ok(s.includes('- **Status**:'), 'must require the block to carry a `- **Status**:` line');
});

// ---------------------------------------------------------------------------
// Resolution logic — work-family targets
// ---------------------------------------------------------------------------

test('2.11 resolves every work-family ID type against its active dir or archive/', () => {
  const s = section(readSkill(), H_2_11);
  for (const id of ['TASK-NNNN', 'BUG-NNNN', 'UAT-NNNN', 'REQ-NNNN', 'PRD-NNNN', 'ROADMAP-NNNN']) {
    assert.ok(s.includes(`\`${id}\``), `must cover ${id} targets`);
  }
  assert.ok(s.includes('wiki/work/<family>/'), 'must resolve in the family directory');
  assert.ok(s.includes('wiki/work/<family>/archive/'), 'must also resolve in the family archive/');
  assert.ok(s.includes('mcp__serena__find_file'), 'must locate the file via mcp__serena__find_file');
});

// ---------------------------------------------------------------------------
// Resolution logic — knowledge slugs
// ---------------------------------------------------------------------------

test('2.11 resolves bare knowledge slugs by id:/aliases:/filename under wiki/knowledge/', () => {
  const s = section(readSkill(), H_2_11);
  assert.ok(s.includes('bare slugs'), 'must cover bare-slug targets');
  assert.ok(s.includes('[[typed-wiki-links]]'), 'must give the bare-slug example');
  assert.match(s, /`id:`/, 'must accept a matching id: frontmatter value');
  assert.match(s, /`aliases:`/, 'must accept a matching aliases: entry');
  assert.ok(s.includes('wiki/knowledge/'), 'must search under wiki/knowledge/');
});

// ---------------------------------------------------------------------------
// Reporting format and severities
// ---------------------------------------------------------------------------

test('2.11 reports unresolved targets as [MEDIUM] dangling typed link with file:line and keyword::[[target]]', () => {
  const s = section(readSkill(), H_2_11);
  assert.ok(
    s.includes(
      '`[MEDIUM] dangling typed link — <file>:<line> — <keyword>::[[<target>]] does not resolve to any existing page or work item`'
    ),
    'dangling-link report line must match the specified wording exactly'
  );
});

test('2.11 reports links to superseded decisions separately as informational [LOW], not broken', () => {
  const s = section(readSkill(), H_2_11);
  assert.ok(
    s.includes('`[LOW] typed link to superseded decision — <file>:<line> — consider updating to ADR-N#DX`'),
    'superseded-link report line must match the specified wording exactly'
  );
  assert.ok(s.includes('superseded by ADR-N#DX'), 'must key off the `superseded by ADR-N#DX` status text');
  assert.ok(s.includes('superseded by DEC-N#DX'), 'must still accept the legacy `superseded by DEC-N#DX` status text');
  assert.match(s, /informational, not broken/, 'must state the superseded case is informational, not broken');
  assert.match(s, /still resolves/, 'must state the superseded link still resolves');
});

test('2.11 report lines follow the shared `[SEVERITY] <finding-type> — <detail>` shape', () => {
  const s = section(readSkill(), H_2_11);
  const lines = [...s.matchAll(/`(\[(?:HIGH|MEDIUM|LOW)\][^`]*)`/g)].map((m) => m[1]);
  assert.equal(lines.length, 2, 'expected exactly two report-line templates (dangling, superseded)');
  for (const line of lines) {
    assert.match(line, /^\[(HIGH|MEDIUM|LOW)\] [^—]+ — .+/, `report line has the wrong shape: ${line}`);
  }
  assert.ok(lines[0].startsWith('[MEDIUM]'), 'dangling link must be MEDIUM');
  assert.ok(lines[1].startsWith('[LOW]'), 'superseded-decision link must be LOW');
});

// ---------------------------------------------------------------------------
// Steps 3 and 4 need no structural change
// ---------------------------------------------------------------------------

test('Step 3 groups findings by HIGH / MEDIUM / LOW using the shared [SEVERITY] shape (picks up 2.11 unchanged)', () => {
  const text = readSkill();
  const i3 = text.indexOf(H_STEP_3);
  const i4 = text.indexOf(H_STEP_4);
  assert.ok(i3 !== -1 && i4 > i3, 'Step 3 and Step 4 headings must exist in order');
  const step3 = text.slice(i3, i4);
  assert.ok(step3.includes('Group by severity (HIGH / MEDIUM / LOW)'), 'Step 3 must group by all three severities');
  assert.match(step3, /\[HIGH\] family-index drift — /, 'Step 3 must keep its `[SEVERITY] type — detail` example');
  assert.ok(step3.includes('Summarize total counts per severity.'), 'Step 3 must still summarize counts per severity');
});

test('Step 4 and Step 5 are structurally unchanged (fix proposals still HIGH-only, approval-gated)', () => {
  const text = readSkill();
  const i4 = text.indexOf(H_STEP_4);
  const i5 = text.indexOf(H_STEP_5);
  assert.ok(i4 !== -1 && i5 > i4, 'Step 4 and Step 5 headings must exist in order');
  const step4 = text.slice(i4, i5);
  assert.ok(step4.includes('For each HIGH finding, propose the exact `Edit` operation'), 'Step 4 must still iterate HIGH findings');
  assert.ok(step4.includes('Do not apply without approval.'), 'Step 4 must still forbid unapproved edits');
  assert.ok(step4.includes('**"Which findings should I fix?"**'), 'Step 4 must still ask which findings to fix');
});

// ---------------------------------------------------------------------------
// Neighbours and source-of-truth
// ---------------------------------------------------------------------------

test('2.5 keyword-vocabulary check is intact (2.11 extends its scan, does not replace it)', () => {
  const s = section(readSkill(), H_2_5);
  assert.ok(s.includes('`::[[`'), '2.5 must still define the `::[[` scan');
  assert.ok(s.includes('wiki/conventions.md'), '2.5 must still validate against wiki/conventions.md');
  assert.ok(s.includes('Report unknown keywords.'), '2.5 must still report unknown keywords');
});

test('2.11 never points the edit at the machine-local ~/.claude/skills/ copy', () => {
  const s = section(readSkill(), H_2_11);
  assert.ok(
    !s.toLowerCase().includes('~/.claude/skills/'),
    '2.11 must not reference the machine-local skill copy'
  );
});
