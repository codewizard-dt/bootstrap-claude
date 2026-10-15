#!/usr/bin/env node
// Contract checks for TASK-0100's shrink of /power-mode's Single-Task Executor
// mode (lib/skills/power-mode/SKILL.md) to a short pointer at
// /tackle -> /uat-create -> /uat-auto. Zero-dependency: node:test +
// node:assert only, mirroring the sibling skill-content suites
// (test/prior-art-scan.test.js, test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/power-mode-single-task-pointer.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0100 is a documentation-only change to one
// SKILL.md — the markdown IS the program a future agent executes. This suite
// pins: (1) the Single-Task Executor section is a pointer (<= 12 non-blank
// lines, no Agent({ blocks, no bypassPermissions/reap machinery), (2) it still
// names the three skills in order and keeps the "without pausing" autonomy
// rule and the acceptable-resting-state rule, (3) the Dispatch bullet and the
// frontmatter description were retargeted while name/argument-hint are intact,
// (4) the Roadmap-to-Completion Orchestrator and the shared sections around it
// were left structurally intact, and (5) the power-mode-skill component page
// reports the outcome and keeps its reverse pointers.
//
// SCOPE — lib/skills/power-mode/SKILL.md, lib/skills/README.md and
// wiki/knowledge/entities/components/power-mode-skill.md. Does not touch the
// machine-local ~/.claude/skills/ copy (install-global.sh overwrites it).
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILL = path.join(REPO, 'lib', 'skills', 'power-mode', 'SKILL.md');
const SKILLS_README = path.join(REPO, 'lib', 'skills', 'README.md');
const COMPONENT_PAGE = path.join(
  REPO, 'wiki', 'knowledge', 'entities', 'components', 'power-mode-skill.md'
);

function readFile(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'file has no frontmatter block');
  return m[1];
}

// Text from `heading` up to the next `\n---\n` separator (or EOF).
function section(text, heading) {
  const start = text.indexOf(heading);
  assert.ok(start !== -1, `heading not found: ${heading}`);
  const end = text.indexOf('\n---\n', start + heading.length);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

const SINGLE = '## Single-Task Executor';
const ROADMAP = '## Roadmap-to-Completion Orchestrator';

test('Single-Task Executor is a short pointer (<= 12 non-blank lines)', () => {
  const body = section(readFile(SKILL), SINGLE);
  const nonBlank = body.split('\n').filter((l) => l.trim() !== '');
  assert.ok(
    nonBlank.length <= 12,
    `Single-Task Executor has ${nonBlank.length} non-blank lines; expected <= 12`
  );
});

test('Single-Task Executor carries no Agent({ blocks or team machinery', () => {
  const body = section(readFile(SKILL), SINGLE);
  assert.ok(!/Agent\(\{/.test(body), 'Agent({ block found in Single-Task Executor');
  assert.ok(!/bypassPermissions/.test(body), 'bypassPermissions found in Single-Task Executor');
  assert.ok(!/ListAgents|TaskStop/.test(body), 'reap machinery found in Single-Task Executor');
  assert.match(body, /no agent team, no reap sweep/);
});

test('Single-Task Executor names /tackle, /uat-create, /uat-auto in order', () => {
  const body = section(readFile(SKILL), SINGLE);
  const tackle = body.indexOf('`/tackle <task-path>`');
  const create = body.indexOf('`/uat-create <task-path>`');
  const auto = body.indexOf('`/uat-auto <uat-path>`');
  assert.ok(tackle !== -1, '/tackle step missing');
  assert.ok(create !== -1, '/uat-create step missing');
  assert.ok(auto !== -1, '/uat-auto step missing');
  assert.ok(tackle < create && create < auto, 'skills are not in tackle -> uat-create -> uat-auto order');
});

test('Single-Task Executor keeps the "without pausing" autonomy rule', () => {
  const body = section(readFile(SKILL), SINGLE);
  assert.match(body, /without pausing, asking questions, or awaiting approval between them/);
  assert.match(body, /in the current session \(Skill tool\)/);
});

test('Single-Task Executor defers closure to UAT-CORE and keeps the resting-state rule', () => {
  const body = section(readFile(SKILL), SINGLE);
  assert.match(body, /Stop after `\/uat-auto` returns/);
  assert.match(body, /UAT-CORE Closure procedure/);
  assert.match(body, /Playwright MCP/);
  assert.match(body, /\[FAIL: auto-judge: \.\.\. requires human verification\]/);
  assert.match(body, /acceptable resting state/);
});

test('Dispatch task bullet is retargeted at the pointer', () => {
  const text = readFile(SKILL);
  const dispatch = section(text, '## Dispatch — Roadmap vs Task');
  assert.ok(
    dispatch.includes(
      '- Path contains `task` or matches `TASK-NNNN` → **Single-Task Executor** ' +
      '(a pointer at the tackle → uat-create → uat-auto pipeline; see below)'
    ),
    'Dispatch task bullet not retargeted'
  );
  assert.ok(
    dispatch.includes('→ **Roadmap-to-Completion Orchestrator** (see below)'),
    'Dispatch roadmap bullet changed'
  );
});

test('frontmatter description is reworded; name and argument-hint untouched', () => {
  const fm = frontmatter(readFile(SKILL));
  assert.match(fm, /^name: power-mode$/m);
  assert.match(fm, /^argument-hint: "\[roadmap-file-path \| task-file-path \| TASK-NNNN\]"$/m);
  assert.match(
    fm,
    /When invoked with a task file path, runs that pipeline once in the current session and stops\.$/m
  );
});

test('surrounding sections are present and in their original order', () => {
  const text = readFile(SKILL);
  const headings = [
    '## Dispatch — Roadmap vs Task',
    '## Parallelization Mandate',
    '## Team Member Requirements',
    '## Agent Lifecycle — Reap Finished and Idle Agents (CRITICAL)',
    SINGLE,
    ROADMAP,
  ];
  let prev = -1;
  for (const h of headings) {
    const idx = text.indexOf(h);
    assert.ok(idx !== -1, `missing heading: ${h}`);
    assert.ok(idx > prev, `heading out of order: ${h}`);
    prev = idx;
  }
});

test('Roadmap-to-Completion Orchestrator is structurally intact', () => {
  const text = readFile(SKILL);
  const roadmap = text.slice(text.indexOf(ROADMAP));
  for (const marker of [
    '**AUTONOMOUS EXECUTION MANDATE:**',
    '### Forbidden actions in orchestrator mode',
    '### Orchestrator loop',
    '**Step 1 — Get the next wave**',
    '**Step 2 — Materialize inline placeholders**',
    '**Step 3 — Three-phase pipeline for the wave**',
    '**Step 4 — Reap and repeat**',
    'Phase 1 — Tackle',
    'Phase 2 — Generate UAT tests',
    'Phase 3 — Run UATs',
  ]) {
    assert.ok(roadmap.includes(marker), `Roadmap section lost marker: ${marker}`);
  }
  const agentBlocks = roadmap.match(/Agent\(\{/g) || [];
  assert.ok(agentBlocks.length >= 5, `Roadmap section has ${agentBlocks.length} Agent({ blocks; expected >= 5`);
});

test('lib/skills/README.md power-mode row still truthful', () => {
  const readme = readFile(SKILLS_README);
  const row = readme.split('\n').find((l) => l.startsWith('| `power-mode` |'));
  assert.ok(row, 'power-mode row missing from lib/skills/README.md');
  assert.match(row, /roadmap or task files/);
  assert.match(row, /tackle → uat-create → uat-auto/);
});

test('component page reports the outcome and keeps its reverse pointers', () => {
  const page = readFile(COMPONENT_PAGE);
  assert.match(frontmatter(page), /^id: power-mode-skill$/m);
  assert.ok(page.includes('implements::[[Multi-Agent Orchestration Patterns]]'), 'implements:: link lost');
  assert.ok(page.includes('relates_to::[[wiki-skill-boilerplate-duplication]]'), 'relates_to:: link lost');
  assert.ok(page.includes('evolved_by::[[TASK-003]]'), 'evolved_by::[[TASK-003]] removed');
  assert.ok(/^evolved_by::\[\[TASK-0100\]\]$/m.test(page), 'evolved_by::[[TASK-0100]] missing');
  assert.ok(!/shrink candidate/i.test(page), 'page still calls the shrink a pending candidate');
  assert.ok(page.includes('[[TASK-0100]]'), 'outcome paragraph does not cite TASK-0100');
  assert.ok(!page.includes('ROADMAP-0013'), 'page must not cite ROADMAP-0013');
  assert.ok(
    !/given a task path it drives that one task/.test(page),
    'first paragraph still says the orchestrator drives a single task'
  );
});
