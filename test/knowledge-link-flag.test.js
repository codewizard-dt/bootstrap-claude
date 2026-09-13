#!/usr/bin/env node
// Contract checks for TASK-0091's new optional `--knowledge <slug>` flag on
// /task-add (lib/skills/task-add/SKILL.md) and /bug-file
// (lib/skills/bug-file/SKILL.md). Zero-dependency: node:test + node:assert
// only, mirroring the sibling skill-content suites
// (test/bug-close-clustering-offer.test.js, test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/knowledge-link-flag.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0091 is a documentation-only change to two
// SKILL.md files — the markdown IS the program a future agent executes.
// Both /task-add and /bug-file already support a similar --decision-style
// optional flag; this task adds a parallel --knowledge <slug> flag so a task
// or bug can cite a wiki/knowledge/concepts/ or wiki/knowledge/sources/ page
// at creation time. This suite pins: (1) the flag-detection step exists in
// both skills without renumbering pre-existing steps, (2) it searches both
// wiki/knowledge/concepts/ and wiki/knowledge/sources/ via
// mcp__serena__find_file, (3) an unresolved slug warns and never blocks
// creation, (4) the resolved slug is written as a relates_to::[[<slug>]]
// typed link in the right position in each file's body template, (5) both
// argument-hint frontmatter lines advertise the new flag, and (6) CLAUDE.md's
// Custom Commands table mentions it for both commands.
//
// SCOPE — lib/skills/task-add/SKILL.md, lib/skills/bug-file/SKILL.md, and
// CLAUDE.md only. Does not touch the machine-local ~/.claude/skills/
// copies (install-global.sh overwrites those on next sync; this repo's
// copies are the only source of truth).
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TASK_ADD_SKILL = path.join(REPO, 'lib', 'skills', 'task-add', 'SKILL.md');
const BUG_FILE_SKILL = path.join(REPO, 'lib', 'skills', 'bug-file', 'SKILL.md');
const CLAUDE_MD = path.join(REPO, 'CLAUDE.md');

function readFile(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'frontmatter block not found');
  return match[1];
}

// ---------------------------------------------------------------------------
// task-add/SKILL.md
// ---------------------------------------------------------------------------

test('task-add/SKILL.md argument-hint frontmatter advertises --knowledge <slug>', () => {
  const fm = frontmatter(readFile(TASK_ADD_SKILL));
  const line = fm.split('\n').find((l) => l.startsWith('argument-hint:'));
  assert.ok(line, 'argument-hint line not found');
  assert.match(line, /\[--knowledge <slug>\]/, 'argument-hint must advertise [--knowledge <slug>]');
  // Existing flags must still be present — this is an addition, not a replacement.
  assert.match(line, /\[--decision DEC-NNNN#DM\]/, 'existing --decision hint must be preserved');
  assert.match(line, /\[--roadmap ROADMAP-NNNN\]/, 'existing --roadmap hint must be preserved');
});

test('task-add/SKILL.md adds a knowledge-reference step without renumbering existing Steps 2-4', () => {
  const text = readFile(TASK_ADD_SKILL);
  assert.ok(text.includes('### Step 2: Parse and validate decision reference'), 'Step 2 heading must be unchanged');
  assert.ok(text.includes('### Step 3: Parse and validate roadmap reference'), 'Step 3 heading must be unchanged');
  assert.ok(text.includes('### Step 4: Determine the next task number'), 'Step 4 heading must be unchanged');
  assert.match(
    text,
    /### Step 2b: Parse and validate knowledge reference \(only if `\$ARGUMENTS` contains `--knowledge` or a recognizable concept\/source slug\)/,
    'a new Step 2b heading for the knowledge reference must exist'
  );
});

function taskAddStep2bSection(text) {
  const start = text.indexOf('### Step 2b: Parse and validate knowledge reference');
  assert.ok(start !== -1, 'Step 2b heading not found');
  const end = text.indexOf('### Step 4: Determine the next task number');
  assert.ok(end !== -1 && end > start, 'Step 4 heading not found after Step 2b');
  return text.slice(start, end);
}

test('task-add/SKILL.md Step 2b detects --knowledge <slug> and bare slug forms', () => {
  const section = taskAddStep2bSection(readFile(TASK_ADD_SKILL));
  assert.ok(section.includes('`--knowledge <slug>`'), 'must detect the --knowledge <slug> flag form');
  assert.match(
    section,
    /bare slug matching an existing page filename \(without extension\) in `wiki\/knowledge\/concepts\/` or `wiki\/knowledge\/sources\/`/,
    'must also detect a bare recognizable slug'
  );
});

test('task-add/SKILL.md Step 2b searches both wiki/knowledge/concepts/ and wiki/knowledge/sources/ via mcp__serena__find_file', () => {
  const section = taskAddStep2bSection(readFile(TASK_ADD_SKILL));
  assert.ok(section.includes('mcp__serena__find_file'), 'must use mcp__serena__find_file to locate the page');
  assert.ok(section.includes('wiki/knowledge/concepts/'), 'must search wiki/knowledge/concepts/');
  assert.ok(section.includes('wiki/knowledge/sources/'), 'must search wiki/knowledge/sources/');
});

test('task-add/SKILL.md Step 2b never blocks task creation on an unresolved knowledge slug', () => {
  const section = taskAddStep2bSection(readFile(TASK_ADD_SKILL));
  assert.match(section, /\*\*If not found\*\*: warn the user/, 'unresolved slug must warn, not error');
  assert.ok(
    section.includes('never block task creation on a missing knowledge page'),
    'must explicitly state it never blocks task creation'
  );
});

test('task-add/SKILL.md Step 8 body template adds relates_to::[[<slug>]] alongside implements::', () => {
  const text = readFile(TASK_ADD_SKILL);
  const idxImplements = text.indexOf('implements::[[DEC-NNNN#DM]]');
  const idxRelatesTo = text.indexOf('relates_to::[[<slug>]]');
  const idxDependsOn = text.indexOf('depends_on::[[TASK-NNNN]]');
  assert.ok(idxImplements !== -1, 'implements:: line must still exist in the body template');
  assert.ok(idxRelatesTo !== -1, 'relates_to:: line must exist in the body template');
  assert.ok(idxDependsOn !== -1, 'depends_on:: line must still exist in the body template');
  assert.ok(
    idxImplements < idxRelatesTo && idxRelatesTo < idxDependsOn,
    'relates_to:: must sit between implements:: and depends_on:: in the body template'
  );
});

test('task-add/SKILL.md documents relates_to:: insertion position (after implements::, else after H1)', () => {
  const text = readFile(TASK_ADD_SKILL);
  assert.match(
    text,
    /\*\*Knowledge link\*\* \(only when Step 2b resolved a knowledge reference\): Insert `relates_to::\[\[<slug>\]\]` as a typed link in the same position — immediately after `implements::` when it's present, or immediately after the H1 when it isn't\./,
    'explanatory prose for the knowledge link position must be present verbatim'
  );
});

// ---------------------------------------------------------------------------
// bug-file/SKILL.md
// ---------------------------------------------------------------------------

test('bug-file/SKILL.md argument-hint frontmatter advertises --knowledge <slug>', () => {
  const fm = frontmatter(readFile(BUG_FILE_SKILL));
  const line = fm.split('\n').find((l) => l.startsWith('argument-hint:'));
  assert.ok(line, 'argument-hint line not found');
  assert.match(line, /\[--knowledge <slug>\]/, 'argument-hint must advertise [--knowledge <slug>]');
});

function bugFileStep3Section(text) {
  const start = text.indexOf('### Step 3: Gather Required Fields via Q&A');
  assert.ok(start !== -1, 'Step 3 heading not found');
  const end = text.indexOf('### Step 4: Determine the Next Bug Number');
  assert.ok(end !== -1 && end > start, 'Step 4 heading not found after Step 3');
  return text.slice(start, end);
}

test('bug-file/SKILL.md Step 3 gains an optional, non-required Knowledge exception', () => {
  const section = bugFileStep3Section(readFile(BUG_FILE_SKILL));
  assert.match(
    section,
    /\*\*Knowledge exception\*\* \(optional, non-required\):/,
    'must add a Knowledge exception paragraph marked optional/non-required'
  );
  assert.ok(section.includes('--knowledge <slug>'), 'must detect the --knowledge <slug> flag form');
  assert.ok(section.includes('mcp__serena__find_file'), 'must use mcp__serena__find_file to locate the page');
  assert.ok(section.includes('wiki/knowledge/concepts/'), 'must search wiki/knowledge/concepts/');
  assert.ok(section.includes('wiki/knowledge/sources/'), 'must search wiki/knowledge/sources/');
});

test('bug-file/SKILL.md Step 3 Knowledge exception never blocks bug filing on an unresolved slug', () => {
  const section = bugFileStep3Section(readFile(BUG_FILE_SKILL));
  assert.ok(
    section.includes('never block bug filing on a missing knowledge page'),
    'must explicitly state it never blocks bug filing'
  );
  assert.ok(
    section.includes('If no knowledge reference was given, skip this exception entirely (no `relates_to::` line is written in Step 6).'),
    'must state the skip-when-absent behavior verbatim'
  );
});

test('bug-file/SKILL.md Step 6 inserts relates_to::[[<slug>]] directly under the H1, omitted when unresolved', () => {
  const text = readFile(BUG_FILE_SKILL);
  const start = text.indexOf('### Step 6: Write the Bug File');
  assert.ok(start !== -1, 'Step 6 heading not found');
  const end = text.indexOf('### Step 7: Update the Bug Index');
  assert.ok(end !== -1 && end > start, 'Step 7 heading not found after Step 6');
  const section = text.slice(start, end);

  assert.match(
    section,
    /\*\*Knowledge link\*\* \(only when the Step 3 exception resolved a knowledge reference\): insert `relates_to::\[\[<slug>\]\]` as a typed link directly under the `# BUG-NNNN — <title>` H1 heading/,
    'Knowledge link paragraph must describe insertion directly under the H1'
  );
  assert.ok(
    section.includes('If no knowledge reference was given or resolved, omit the line entirely — do not write an empty placeholder.'),
    'must explicitly state the line is omitted (never an empty placeholder) when unresolved'
  );

  // The illustrative fenced template block (```markdown ... ```) must show
  // relates_to:: between the H1 and body prose — scope to the fence itself
  // since the same phrases also appear in the preceding explanatory prose.
  const fenceStart = section.indexOf('```markdown');
  assert.ok(fenceStart !== -1, 'fenced markdown template block not found');
  const fenceEnd = section.indexOf('```', fenceStart + '```markdown'.length);
  assert.ok(fenceEnd !== -1 && fenceEnd > fenceStart, 'closing fence not found');
  const fence = section.slice(fenceStart, fenceEnd);

  const idxH1 = fence.indexOf('# BUG-NNNN — <title>');
  const idxRelatesTo = fence.indexOf('relates_to::[[<slug>]]');
  const idxBodyProse = fence.indexOf('<body prose begins here>');
  assert.ok(idxH1 !== -1 && idxRelatesTo !== -1 && idxBodyProse !== -1, 'template fence must contain H1, relates_to::, and body prose placeholder');
  assert.ok(idxH1 < idxRelatesTo && idxRelatesTo < idxBodyProse, 'relates_to:: must be templated between the H1 and body prose');
});

// ---------------------------------------------------------------------------
// CLAUDE.md — Custom Commands table
// ---------------------------------------------------------------------------

test('CLAUDE.md Custom Commands table mentions --knowledge <slug> for /task-add and /bug-file', () => {
  const text = readFile(CLAUDE_MD);
  const taskAddRow = text.split('\n').find((l) => l.includes('`/task-add <desc>`'));
  const bugFileRow = text.split('\n').find((l) => l.includes('`/bug-file <description>`'));
  assert.ok(taskAddRow, '/task-add row not found in CLAUDE.md');
  assert.ok(bugFileRow, '/bug-file row not found in CLAUDE.md');
  assert.match(taskAddRow, /--knowledge <slug>/, '/task-add row must mention --knowledge <slug>');
  assert.match(bugFileRow, /--knowledge <slug>/, '/bug-file row must mention --knowledge <slug>');
});

test('the machine-local ~/.claude/skills/ copies are never the edit target (source-of-truth note)', () => {
  const taskAddSection = taskAddStep2bSection(readFile(TASK_ADD_SKILL));
  const bugFileSection = bugFileStep3Section(readFile(BUG_FILE_SKILL));
  assert.ok(
    !taskAddSection.toLowerCase().includes('~/.claude/skills/'),
    'task-add Step 2b must not reference editing the machine-local skill copy'
  );
  assert.ok(
    !bugFileSection.toLowerCase().includes('~/.claude/skills/'),
    'bug-file Step 3 must not reference editing the machine-local skill copy'
  );
});
