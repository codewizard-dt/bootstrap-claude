#!/usr/bin/env node
// Contract checks for TASK-0089's optional prior-art scan step in
// /adr-create (lib/skills/adr-create/SKILL.md) and /roadmap-create
// (lib/skills/roadmap-create/SKILL.md). Zero-dependency: node:test +
// node:assert only, mirroring the sibling skill-content suites
// (test/knowledge-link-flag.test.js, test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/prior-art-scan.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0089 is a documentation-only change to two
// SKILL.md files — the markdown IS the program a future agent executes. An ad
// hoc /adr-create or /roadmap-create never checked whether relevant
// synthesis already exists in wiki/knowledge/, so existing research went
// silently uncited. This suite pins: (1) each skill's Step 1 reads wiki/index.md's
// "### Concepts" and "### Sources" sections and runs
// mcp__serena__search_for_pattern across wiki/knowledge/concepts/ and
// wiki/knowledge/sources/, (2) the scan is optional, cheap, and skips silently
// (no "no prior art found" clutter), (3) hits are confirmed with the user rather
// than cited unconfirmed, (4) a confirmed hit lands as derived_from::[[<slug>]]
// in a decision and as the `derived_from:` frontmatter field in a roadmap, and
// (5) the index sections and search directories the skills point at exist.
//
// SCOPE — lib/skills/adr-create/SKILL.md, lib/skills/roadmap-create/SKILL.md,
// and the repo-local wiki paths they reference. Does not touch the
// machine-local ~/.claude/skills/ copies (install-global.sh overwrites those on
// next sync; this repo's copies are the only source of truth).
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const DECISION_SKILL = path.join(REPO, 'lib', 'skills', 'adr-create', 'SKILL.md');
const ROADMAP_SKILL = path.join(REPO, 'lib', 'skills', 'roadmap-create', 'SKILL.md');
const WIKI_INDEX = path.join(REPO, 'wiki', 'index.md');

function readFile(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function section(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.ok(start !== -1, `heading not found: ${startMarker}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.ok(end !== -1, `heading not found after ${startMarker}: ${endMarker}`);
  return text.slice(start, end);
}

function decisionStep1(text) {
  return section(text, '## Step 1: Parse topic, recall context', '## Step 1.5:');
}

function decisionStep4(text) {
  return section(text, '## Step 4: Clarify with the user', '## Step 4.5:');
}

function roadmapStep1(text) {
  return section(text, '### Step 1: Parse the topic and recall project context', '### Step 2:');
}

function roadmapStep3(text) {
  return section(text, '### Step 3: Socratic Q&A', '### Step 4:');
}

function roadmapStep6(text) {
  return section(text, '### Step 6: Write the roadmap file', '### Step 7:');
}

// The single prior-art bullet inside a Step 1 section.
function scanItem(step1) {
  const line = step1.split('\n').find((l) => /prior-art scan/i.test(l));
  assert.ok(line, 'Step 1 must contain a prior-art scan item');
  return line;
}

// ---------------------------------------------------------------------------
// adr-create/SKILL.md
// ---------------------------------------------------------------------------

test('adr-create Step 1 scan reads wiki/index.md Concepts and Sources sections and searches both knowledge dirs via Serena', () => {
  const item = scanItem(decisionStep1(readFile(DECISION_SKILL)));
  assert.ok(item.includes('wiki/index.md'), 'must read wiki/index.md');
  assert.ok(item.includes('### Concepts'), 'must name the "### Concepts" section');
  assert.ok(item.includes('### Sources'), 'must name the "### Sources" section');
  assert.ok(item.includes('mcp__serena__search_for_pattern'), 'must use mcp__serena__search_for_pattern');
  assert.ok(item.includes('wiki/knowledge/concepts/'), 'must search wiki/knowledge/concepts/');
  assert.ok(item.includes('wiki/knowledge/sources/'), 'must search wiki/knowledge/sources/');
});

test('adr-create Step 1 scan is optional, cheap, skips silently, and is not a /research substitute', () => {
  const item = scanItem(decisionStep1(readFile(DECISION_SKILL)));
  assert.match(item, /optional/i, 'must be marked optional');
  assert.match(item, /cheap/i, 'must be marked cheap');
  assert.match(item, /skip silently if nothing plausible turns up/, 'must skip silently when nothing is found');
  assert.match(item, /not a `\/research` substitute/, 'must state it is not a /research substitute');
  assert.doesNotMatch(item, /no prior[- ]art (was )?found/i, 'must not instruct printing a "no prior art found" message');
});

test('adr-create scan never cites a hit unconfirmed — confirmation happens in Step 4', () => {
  const item = scanItem(decisionStep1(readFile(DECISION_SKILL)));
  assert.match(item, /confirmed with the user in Step 4, never cited unconfirmed/);
});

test('adr-create Step 4 asks the user to confirm a surfaced page and skips the question when nothing was found', () => {
  const step4 = decisionStep4(readFile(DECISION_SKILL));
  assert.match(step4, /\*\*Prior art\*\*/, 'Step 4 must contain a Prior art question');
  assert.match(
    step4,
    /Found `wiki\/knowledge\/concepts\/<slug>\.md` — relevant\?/,
    'must surface the candidate page as a relevance question'
  );
  assert.match(
    step4,
    /Skip this question entirely when the scan found nothing plausible/,
    'must skip the question entirely when the scan found nothing'
  );
});

test('adr-create Step 4 writes derived_from::[[<slug>]] into Shared Context or the block Context on confirmation', () => {
  const step4 = decisionStep4(readFile(DECISION_SKILL));
  assert.ok(step4.includes('derived_from::[[<slug>]]'), 'must write a derived_from::[[<slug>]] typed link');
  assert.match(step4, /on confirmation/, 'must only add the link on confirmation');
  assert.ok(step4.includes('Shared Context'), 'must allow placement in Shared Context');
  assert.ok(step4.includes('### Context (decision-specific)'), 'must allow placement in the block Context section');
});

test('adr-create keeps its mandatory /research requirement and prior steps intact', () => {
  const text = readFile(DECISION_SKILL);
  assert.ok(
    text.includes('**Run `/research <topic>` on the decision topic BEFORE drafting any decision block. Do not skip.**'),
    'the mandatory /research directive must be preserved'
  );
  const step1 = decisionStep1(text);
  assert.ok(step1.includes('mcp__serena__list_memories') || step1.includes('list_memories'), 'existing memory recall must be preserved');
  assert.ok(step1.includes('wiki/work/decisions/lifecycle.md'), 'existing lifecycle read must be preserved');
});

// ---------------------------------------------------------------------------
// roadmap-create/SKILL.md
// ---------------------------------------------------------------------------

test('roadmap-create Step 1 scan reads wiki/index.md Concepts and Sources sections and searches both knowledge dirs via Serena', () => {
  const item = scanItem(roadmapStep1(readFile(ROADMAP_SKILL)));
  assert.ok(item.includes('wiki/index.md'), 'must read wiki/index.md');
  assert.ok(item.includes('### Concepts'), 'must name the "### Concepts" section');
  assert.ok(item.includes('### Sources'), 'must name the "### Sources" section');
  assert.ok(item.includes('mcp__serena__search_for_pattern'), 'must use mcp__serena__search_for_pattern');
  assert.ok(item.includes('wiki/knowledge/concepts/'), 'must search wiki/knowledge/concepts/');
  assert.ok(item.includes('wiki/knowledge/sources/'), 'must search wiki/knowledge/sources/');
});

test('roadmap-create Step 1 scan is optional, cheap, skips silently, and is not a /research substitute', () => {
  const item = scanItem(roadmapStep1(readFile(ROADMAP_SKILL)));
  assert.match(item, /optional/i, 'must be marked optional');
  assert.match(item, /cheap/i, 'must be marked cheap');
  assert.match(item, /skip silently if nothing plausible turns up/, 'must skip silently when nothing is found');
  assert.match(item, /not a `\/research` substitute/, 'must state it is not a /research substitute');
  assert.doesNotMatch(item, /no prior[- ]art (was )?found/i, 'must not instruct printing a "no prior art found" message');
});

test('roadmap-create Step 1 scan feeds the derived_from frontmatter field only after confirmation in Step 3', () => {
  const item = scanItem(roadmapStep1(readFile(ROADMAP_SKILL)));
  assert.match(item, /confirmed with the user during Step 3's Q&A, never cited unconfirmed/);
  assert.ok(item.includes('`derived_from:`'), 'must name the derived_from: frontmatter field');
});

test('roadmap-create Step 3 folds the prior-art confirmation into the Q&A batch and drops rejected candidates silently', () => {
  const step3 = roadmapStep3(readFile(ROADMAP_SKILL));
  assert.match(step3, /prior-art scan surfaced candidate concept\/source pages/, 'must reference the Step 1 scan hits');
  assert.match(step3, /confirmation question/, 'must ask a confirmation question');
  assert.match(step3, /unconfirmed or rejected candidates are dropped silently/, 'must drop unconfirmed candidates silently');
  assert.match(step3, /never cited without confirmation/, 'must never cite without confirmation');
});

test('roadmap-create Step 6 populates derived_from from confirmed hits, omitting the field (never inventing) otherwise', () => {
  const step6 = roadmapStep6(readFile(ROADMAP_SKILL));
  const row = step6.split('\n').find((l) => l.startsWith('| `derived_from`'));
  assert.ok(row, 'Step 6 field table must have a derived_from row');
  assert.match(row, /wiki\/knowledge\/\{concepts,sources\}/, 'row must scope slugs to concepts/sources pages');
  assert.match(row, /omit the field entirely if none were confirmed/, 'row must omit the field when none confirmed');
  assert.match(row, /never invent entries/, 'row must forbid inventing entries');
});

test('roadmap-create keeps its mandatory /research requirement and existing Step 1 context reads', () => {
  const text = readFile(ROADMAP_SKILL);
  assert.ok(
    text.includes('**Run `/research <topic>` on the roadmap topic BEFORE any Q&A or file creation. Do not skip this step.**'),
    'the mandatory /research directive must be preserved'
  );
  const step1 = roadmapStep1(text);
  assert.ok(step1.includes('mcp__serena__list_memories'), 'existing memory recall must be preserved');
  assert.ok(step1.includes('wiki/work/roadmaps/lifecycle.md'), 'existing lifecycle read must be preserved');
});

// ---------------------------------------------------------------------------
// The wiki paths both skills point at must exist
// ---------------------------------------------------------------------------

test('wiki/index.md has the "### Concepts" and "### Sources" sections the scan reads', () => {
  const text = readFile(WIKI_INDEX);
  assert.match(text, /^### Concepts\s*$/m, 'wiki/index.md must have a "### Concepts" heading');
  assert.match(text, /^### Sources\s*$/m, 'wiki/index.md must have a "### Sources" heading');
});

test('wiki/knowledge/concepts/ and wiki/knowledge/sources/ exist as the scan search targets', () => {
  for (const dir of ['concepts', 'sources']) {
    const p = path.join(REPO, 'wiki', 'knowledge', dir);
    assert.ok(fs.existsSync(p) && fs.statSync(p).isDirectory(), `wiki/knowledge/${dir}/ must exist`);
  }
});

test('the machine-local ~/.claude/skills/ copies are never referenced as the edit target by the scan text', () => {
  const decisionScan = scanItem(decisionStep1(readFile(DECISION_SKILL)));
  const roadmapScan = scanItem(roadmapStep1(readFile(ROADMAP_SKILL)));
  assert.ok(!decisionScan.toLowerCase().includes('~/.claude/skills/'), 'adr-create scan must not reference ~/.claude/skills/');
  assert.ok(!roadmapScan.toLowerCase().includes('~/.claude/skills/'), 'roadmap-create scan must not reference ~/.claude/skills/');
});
