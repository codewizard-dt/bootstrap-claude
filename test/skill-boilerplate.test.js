#!/usr/bin/env node
// Contract checks for TASK-0099's shared skill boilerplate doc
// (lib/skills/_shared/SKILL-BOILERPLATE.md) and the SKILL.md files that consume
// it. Zero-dependency: node:test + node:assert/strict only, mirroring the
// sibling skill-content suites (test/task-create-origin-bug-scan.test.js,
// test/prior-art-scan.test.js).
//
// Run: npm test   (or: node --test test/skill-boilerplate.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0099 is a documentation-only change: the
// Prereqs grammar, Edit hygiene rules, and Number allocation algorithm that
// were restated across ~25 SKILL.md files now live once in the shared doc, and
// each skill points at a section by name. The markdown IS the program a future
// agent executes, so drift is silent. This suite pins: (1) the doc exists with
// its three load-bearing headings; (2) every inline `**Prereqs:**` line still
// matches the one grammar (the line stays inline on purpose - it is the
// instruction to read mcp-tools.md - so only a test can keep it from drifting);
// (3) the five number-allocation consumers point at the doc and no longer
// restate the algorithm; (4) the hygiene consumers point at the doc and no
// longer restate the "never sed/awk" sentence; (5) the doc carries no bare
// 3-digit ID placeholders (TASK-NNN etc.; the convention is 4-digit NNNN).
//
// DELIBERATE EXCLUSIONS from the hygiene-consumer list:
//   - task-close: has no hygiene text to dedupe.
//   - uat-* skills and uat-walk/UAT-CORE.md: they carry their own "Bash
//     hygiene" / File-integrity rules specific to UAT runs, not this doc.
//   - power-mode: its line ~48 keeps a self-contained subagent `IMPORTANT:`
//     prompt footer ("Never use ls, cat, find, grep, sed, awk ...") ON PURPOSE.
//     That text is pasted verbatim into spawned agents' prompts, which cannot
//     follow a pointer to a shared doc, so it must stay self-contained.
//
// SCOPE — lib/skills/_shared/SKILL-BOILERPLATE.md and lib/skills/*/SKILL.md.
// Does not touch the machine-local ~/.claude/skills/ copies (install-global.sh
// overwrites those on next sync; this repo's copies are the only source of
// truth).
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO, 'lib', 'skills');
const BOILERPLATE = path.join(SKILLS_DIR, '_shared', 'SKILL-BOILERPLATE.md');
const DOC_REF = '_shared/SKILL-BOILERPLATE.md';

function readFile(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function readSkill(name) {
  return readFile(path.join(SKILLS_DIR, name, 'SKILL.md'));
}

function lines(text) {
  return text.split(/\r?\n/);
}

// Grammar for the inline Prereqs line (see SKILL-BOILERPLATE.md "Prereqs").
const PREREQS_GRAMMAR =
  /^\*\*Prereqs:\*\* obey `wiki\/guides\/mcp-tools\.md`( \+ `wiki\/work\/(tasks|bugs|uat)\/lifecycle\.md`)?(; run \/primer if not done this session)?\.$/;

const ALLOCATION_CONSUMERS = ['task-create', 'roadmap-create', 'bug-create', 'prd-create', 'adr-create'];

const HYGIENE_CONSUMERS = [
  'git-commit', 'update-docs', 'adr-extract', 'adr-create',
  'bug-triage', 'prd-finalize', 'uat-skip', 'adr-walkthrough', 'bug-create',
  'adr-finalize', 'prd-create', 'roadmap-create', 'tackle',
  'prd-deprecate', 'adr-deprecate', 'bug-close',
];

// A restated hygiene sentence: "never ... sed ... awk" on one line.
const RESTATED_HYGIENE = /never .*sed.*awk/i;

// Allow-list of consumer lines that legitimately match RESTATED_HYGIENE. Scanning
// the 15 consumers above found NO matching line: update-docs says only "(never
// `perl -i`)" and tackle's Serena-mandate line reads "Never bash `ls`/`cat`/
// `find`/`grep`/`sed`" (no `awk`, so it does not match). The list is therefore
// empty. Each entry, if ever added, is { file, includes, why }; a stale entry
// (one that no longer matches any line) fails the suite so the list cannot rot.
// The only other repo-wide matches are in NON-consumers by design: power-mode
// (self-contained subagent prompt), uat-auto / uat-auto-plus / UAT-CORE (UAT
// Bash-hygiene rules), _shared/ARCHIVE-WORK-ITEM.md and the boilerplate doc.
const HYGIENE_ALLOWLIST = [];

test('SKILL-BOILERPLATE.md exists and has the three shared sections', () => {
  const doc = readFile(BOILERPLATE);
  for (const heading of ['## Prereqs', '## Edit hygiene', '## Number allocation']) {
    assert.ok(
      lines(doc).some((l) => l.trim() === heading),
      `SKILL-BOILERPLATE.md must contain the heading "${heading}"`
    );
  }
});

test('every inline **Prereqs:** line in a SKILL.md matches the grammar', () => {
  const skills = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();

  let found = 0;
  const offenders = [];
  for (const name of skills) {
    lines(readSkill(name)).forEach((line, i) => {
      if (!line.startsWith('**Prereqs:**')) return;
      found += 1;
      if (!PREREQS_GRAMMAR.test(line)) offenders.push(`lib/skills/${name}/SKILL.md:${i + 1}: ${line}`);
    });
  }

  assert.ok(found > 0, 'no SKILL.md with a **Prereqs:** line was found (vacuous pass guard)');
  assert.deepEqual(offenders, [], `Prereqs lines violating the grammar:\n${offenders.join('\n')}`);
});

for (const name of ALLOCATION_CONSUMERS) {
  test(`${name} points at the shared Number allocation section and does not restate it`, () => {
    const text = readSkill(name);
    assert.ok(text.includes(DOC_REF), `${name}/SKILL.md must reference ${DOC_REF}`);
    assert.ok(text.includes('§ Number allocation'), `${name}/SKILL.md must reference "§ Number allocation"`);
    assert.ok(
      !text.includes('zero-pad the result to 4 digits'),
      `${name}/SKILL.md still restates the allocation algorithm ("zero-pad the result to 4 digits")`
    );
  });
}

test('hygiene consumers point at the shared Edit hygiene section', () => {
  const offenders = [];
  for (const name of HYGIENE_CONSUMERS) {
    const text = readSkill(name);
    if (!text.includes(DOC_REF)) offenders.push(`${name}: missing ${DOC_REF}`);
    if (!text.includes('§ Edit hygiene')) offenders.push(`${name}: missing "§ Edit hygiene"`);
  }
  assert.deepEqual(offenders, [], `hygiene consumers not wired:\n${offenders.join('\n')}`);
});

test('hygiene consumers do not restate the "never sed/awk" sentence (outside the allow-list)', () => {
  const offenders = [];
  const used = new Set();
  for (const name of HYGIENE_CONSUMERS) {
    lines(readSkill(name)).forEach((line, i) => {
      if (!RESTATED_HYGIENE.test(line)) return;
      const idx = HYGIENE_ALLOWLIST.findIndex((a) => a.file === name && line.includes(a.includes));
      if (idx !== -1) {
        used.add(idx);
        return;
      }
      offenders.push(`lib/skills/${name}/SKILL.md:${i + 1}: ${line}`);
    });
  }
  assert.deepEqual(offenders, [], `restated hygiene sentences:\n${offenders.join('\n')}`);
  const stale = HYGIENE_ALLOWLIST.filter((_, i) => !used.has(i)).map((a) => `${a.file}: ${a.includes}`);
  assert.deepEqual(stale, [], `stale allow-list entries (no longer match any line):\n${stale.join('\n')}`);
});

test('SKILL-BOILERPLATE.md contains no bare 3-digit ID placeholders', () => {
  const doc = readFile(BOILERPLATE);
  const offenders = [];
  lines(doc).forEach((line, i) => {
    for (const re of [/TASK-NNN(?!N)/, /UAT-NNN(?!N)/, /PRD-NNN(?!N)/, /ROADMAP-NNN(?!N)/]) {
      if (re.test(line)) offenders.push(`line ${i + 1}: ${line}`);
    }
  });
  assert.deepEqual(offenders, [], `3-digit placeholders (use NNNN):\n${offenders.join('\n')}`);
});
