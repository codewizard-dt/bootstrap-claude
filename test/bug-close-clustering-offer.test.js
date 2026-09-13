#!/usr/bin/env node
// Contract checks for TASK-0087's extension to bug-close's Step 10 clustering
// check. Zero-dependency: node:test + node:assert only, mirroring the sibling
// skill-content suites (test/task-typed-links.test.js,
// test/wiki-work-naming-convention.test.js).
//
// Run: npm test   (or: node --test test/bug-close-clustering-offer.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0087 is a documentation-only change to
// lib/skills/bug-close/SKILL.md — the markdown IS the program a future agent
// executes. Step 10 already computed a clustering signal (related recent
// closes sharing Tags) but discarded it, only printing an observation. The
// risk this pins: (1) the >=2-related-closes branch must actually prompt via
// AskUserQuestion with the exact templated question, (2) a "yes" answer must
// invoke Skill task-add without --roadmap (no roadmap context exists here),
// (3) the <=1-related-close path must stay a silent no-op — this task must
// not change the report's shape for the common case, and (4) the pre-existing
// unconditional report bullets (Bug ID/title, status transition, resolution
// summary) must remain flat, top-level, and un-gated by the new branch.
//
// SCOPE — lib/skills/bug-close/SKILL.md Step 10 only. Does not touch the
// machine-local ~/.claude/skills/bug-close/SKILL.md copy (install-global.sh
// overwrites that on next sync; this repo's copy is the only source of
// truth) — see UAT-0087 for the manual confirmation of that boundary.
//
// HERMETIC: reads one repo-local file. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const BUG_CLOSE_SKILL = path.join(REPO, 'lib', 'skills', 'bug-close', 'SKILL.md');

function readSkill(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function step10Section(text) {
  const start = text.indexOf('### Step 10: Report Completion');
  assert.ok(start !== -1, 'Step 10: Report Completion heading not found');
  // Step 10 is the last step in the file, so take everything to EOF.
  return text.slice(start);
}

test('bug-close/SKILL.md Step 10 keeps the base report bullets flat, unconditional, and ahead of the clustering-check bullet', () => {
  const section = step10Section(readSkill(BUG_CLOSE_SKILL));
  const idxBugIdTitle = section.indexOf('- Bug ID, title');
  const idxStatusTransition = section.indexOf('- Old status');
  const idxResolutionSummary = section.indexOf('- Resolution summary');
  const idxClusteringBullet = section.indexOf('For `verified`: a one-line clustering check');

  assert.ok(idxBugIdTitle !== -1, 'missing "Bug ID, title" bullet');
  assert.ok(idxStatusTransition !== -1, 'missing "Old status -> new status" bullet');
  assert.ok(idxResolutionSummary !== -1, 'missing "Resolution summary" bullet');
  assert.ok(idxClusteringBullet !== -1, 'missing the verified-case clustering-check bullet');

  // Ordering: the three base bullets must all precede the clustering bullet,
  // proving they are unconditional top-level items the clustering logic
  // cannot gate.
  assert.ok(idxBugIdTitle < idxClusteringBullet, '"Bug ID, title" must precede the clustering-check bullet');
  assert.ok(idxStatusTransition < idxClusteringBullet, '"Old status -> new status" must precede the clustering-check bullet');
  assert.ok(idxResolutionSummary < idxClusteringBullet, '"Resolution summary" must precede the clustering-check bullet');
});

test('bug-close/SKILL.md Step 10 prompts for a regression-prevention task on 2+ related closes', () => {
  const section = step10Section(readSkill(BUG_CLOSE_SKILL));
  assert.match(
    section,
    /If the clustering check finds \*\*2 or more\*\* related recent closes \(not counting the bug just closed\), use `AskUserQuestion` to ask inline:/,
    'must gate the prompt on >=2 related closes, explicitly excluding the bug just closed'
  );
  assert.ok(
    section.includes('N related bugs closed recently with tag(s) <tags> — <BUG-NNNN titles>. File a regression-prevention task? (y/n)'),
    'must use the exact templated inline question'
  );
});

test('bug-close/SKILL.md Step 10 "yes" branch files a regression task via Skill task-add without --roadmap', () => {
  const section = step10Section(readSkill(BUG_CLOSE_SKILL));
  assert.match(
    section,
    /On yes: invoke `Skill` `task-add` with a description referencing the clustered bug IDs and shared tag\(s\)/,
    'yes branch must invoke Skill task-add with a description referencing the clustered bug IDs and shared tags'
  );
  assert.ok(
    section.includes('Do not pass `--roadmap`'),
    'yes branch must explicitly instruct not to pass --roadmap (no roadmap context exists here)'
  );
});

test('bug-close/SKILL.md Step 10 "no" branch (or <=1 related close) stays a silent no-op, unchanged from before this task', () => {
  const section = step10Section(readSkill(BUG_CLOSE_SKILL));
  assert.ok(
    section.includes('On no (or ≤1 related close): unchanged from today — print the clustering observation and stop, no prompt.'),
    'no/<=1-related-close branch must explicitly preserve the pre-existing silent behavior'
  );
});

test('bug-close/SKILL.md Step 10 new sub-bullets are nested under the verified clustering-check bullet, not top-level', () => {
  const section = step10Section(readSkill(BUG_CLOSE_SKILL));
  const lines = section.split('\n');
  const clusteringLineIdx = lines.findIndex((l) => l.includes('For `verified`: a one-line clustering check'));
  assert.ok(clusteringLineIdx !== -1, 'clustering-check bullet line not found');

  const nextThree = lines.slice(clusteringLineIdx + 1, clusteringLineIdx + 4);
  assert.strictEqual(nextThree.length, 3, 'expected exactly 3 lines immediately following the clustering-check bullet');
  for (const line of nextThree) {
    assert.match(line, /^  - /, `expected a 2-space-indented nested bullet, got: ${JSON.stringify(line)}`);
  }
});

test('bug-close/SKILL.md Step 10 fixed-status branch is unaffected by the new verified-branch sub-bullets', () => {
  const section = step10Section(readSkill(BUG_CLOSE_SKILL));
  assert.ok(
    section.includes('For `fixed`: remind the user to re-run `/bug-close` once verification lands.'),
    'the fixed-status bullet must remain present and unchanged'
  );
});

test('the machine-local ~/.claude/skills/bug-close/SKILL.md copy is never the edit target (source-of-truth note)', () => {
  const section = step10Section(readSkill(BUG_CLOSE_SKILL));
  // This is a documentation-boundary check on the repo copy itself, not a
  // filesystem check of the user's home directory (which would not be
  // hermetic and is out of scope for this suite). It asserts the repo's own
  // SKILL.md still carries no instruction to edit the machine-local copy.
  assert.ok(
    !section.toLowerCase().includes('~/.claude/skills/bug-close/skill.md'),
    'Step 10 must not reference editing the machine-local skill copy'
  );
});
