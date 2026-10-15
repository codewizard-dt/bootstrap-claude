#!/usr/bin/env node
// Behavioural-contract checks for /whats-next (TASK-0126) that the shipped
// suite test/whats-next-skill.test.js leaves open. Zero-dependency: node:test +
// node:assert/strict only, read-only, no subprocess.
//
// Run: node --test test/whats-next-skill-crossrefs.test.js
//
// WHY THIS IS TESTED AT ALL. Skills are markdown-as-program: SKILL.md IS what a
// future agent executes, so a drifted phrase is a silent behaviour change. The
// shipped suite pins frontmatter, the read-only Constraints block, sweep
// pitfalls and tier names. This file pins the parts that decide WHAT the report
// says: the per-state Next mapping (not merely that each /command exists), the
// tier membership rules, the within-tier sort order, the wave rules, the
// report section order, the STOP text, that every cited shared doc / sibling
// skill section really exists (a dangling pointer is a silent no-op), and the
// log entry. Each test name carries a tag so a UAT case can select it:
// [next-map] [tiers] [order] [waves] [report] [stop] [refs] [readonly] [log].

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILL = path.join(REPO, 'lib', 'skills', 'whats-next', 'SKILL.md');

function read(rel) {
  const p = path.join(REPO, rel);
  assert.ok(fs.existsSync(p), `${rel} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

const TEXT = fs.readFileSync(SKILL, 'utf8');

// Text of a `## <heading>` (or `### `) section, up to the next heading of the
// same or higher level.
function section(text, headingRe, level = 2) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => headingRe.test(l));
  assert.ok(start >= 0, `missing section matching ${headingRe}`);
  const stop = new RegExp('^#{1,' + level + '} ');
  let end = lines.length;
  let fenced = false;
  for (let i = start + 1; i < lines.length; i++) {
    // Headings inside ``` fences are report examples, not section boundaries.
    if (lines[i].startsWith('```')) { fenced = !fenced; continue; }
    if (!fenced && stop.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

// ---- [next-map] state -> command mapping ---------------------------------

test('[next-map] every item state maps to its specified command', () => {
  const next = section(TEXT, /^### 5c\./, 3);
  const expected = [
    [/task `in-progress` or `todo`/, '/tackle <path>'],
    [/task `pending-uat`, UAT exists/, '/uat-auto <uat>'],
    [/task `pending-uat`, UAT exists/, '/uat-walk <uat>'],
    [/task `pending-uat`, no UAT yet/, '/uat-create <task>'],
    [/bug `open`/, '/bug-assess'],
    [/bug `open`/, '/bug-triage BUG-NNNN'],
    [/bug `triaged`/, '/bug-triage BUG-NNNN'],
    [/bug `triaged`/, '/task-create <description>'],
    [/bug `in-progress`/, '/bug-close BUG-NNNN'],
    [/proposed ADR block/, '/adr-finalize <file>#DM'],
    [/accepted ADR block with no task/, '/task-create --decision ADR-NNNN#DM'],
    [/approved PRD with no downstream/, '/adr-extract <file>'],
    [/draft PRD/, '/prd-finalize <file>'],
    [/roadmap with every item checked/, '/roadmap-next <roadmap>'],
    [/inline roadmap item/, '/roadmap-next <roadmap>'],
  ];
  for (const [stateRe, cmd] of expected) {
    const line = next.split('\n').find((l) => stateRe.test(l));
    assert.ok(line, `no Next line for ${stateRe}`);
    assert.ok(line.includes('`' + cmd + '`'), `${stateRe} must map to ${cmd}; got: ${line}`);
  }
});

test('[next-map] /uat-auto is chosen only when every unresolved case is unit-backed', () => {
  assert.match(TEXT, /`\/uat-auto <uat>` when every unresolved case is unit-backed, otherwise `\/uat-walk <uat>`/);
  assert.match(TEXT, /unit-backed when it carries a `Unit Test Command` line or a `Repeatable Unit Test: Created` line/);
});

// ---- [tiers] tier membership ---------------------------------------------

test('[tiers] Tier 1 is bugs in-progress, P0/P1 or critical', () => {
  const row = TEXT.split('\n').find((l) => /^\| 1 \| Fix what's broken/.test(l));
  assert.ok(row, 'Tier 1 row missing');
  assert.match(row, /bugs `in-progress`/);
  assert.match(row, /P0 or P1/);
  assert.match(row, /`severity: critical`/);
});

test('[tiers] Tier 2 holds in-progress and pending-uat tasks; untriaged bug batch only when high/critical', () => {
  const row = TEXT.split('\n').find((l) => /^\| 2 \| Finish what's started/.test(l));
  assert.ok(row, 'Tier 2 row missing');
  assert.match(row, /tasks `in-progress`/);
  assert.match(row, /tasks `pending-uat`/);
  assert.match(row, /untriaged bugs as \*\*one batch row\*\*/);
  assert.match(row, /only when any of them is `high` or `critical`/);
});

test('[tiers] Tier 3 unblock, Tier 4 start-ready and Tier 5 triage hold the specified items', () => {
  const rows = TEXT.split('\n');
  const t3 = rows.find((l) => /^\| 3 \| Unblock/.test(l));
  const t4 = rows.find((l) => /^\| 4 \| Start ready work/.test(l));
  const t5 = rows.find((l) => /^\| 5 \| Triage & hygiene/.test(l));
  assert.ok(t3 && t4 && t5, 'Tier 3/4/5 rows missing');
  assert.match(t3, /proposed ADR blocks/);
  assert.match(t3, /approved PRDs with no downstream/);
  assert.match(t4, /`todo` tasks whose `depends_on` edges are all start-satisfied/);
  assert.match(t4, /inline roadmap items/);
  assert.match(t5, /untriaged bugs/);
  assert.match(t5, /stale drafts/);
  assert.match(t5, /index drift/);
});

test('[tiers] blocked items are never ranked as actionable', () => {
  assert.match(TEXT, /separate \*\*Blocked\*\* list[^\n]*never ranked as actionable/);
  assert.match(TEXT, /cycle members/);
});

// ---- [order] within-tier sort --------------------------------------------

test('[order] within a tier: depth desc, fan-out desc, age asc, ID asc', () => {
  const line = TEXT.split('\n').find((l) => l.startsWith('**Within a tier**'));
  assert.ok(line, 'Within-a-tier line missing');
  const keys = ['`downstream_depth` descending', '`fan_out` descending', 'age ascending', 'ID ascending'];
  let pos = -1;
  for (const k of keys) {
    const at = line.indexOf(k, pos + 1);
    assert.ok(at > pos, `"${k}" missing or out of order in: ${line}`);
    pos = at;
  }
});

// ---- [waves] wave rules ---------------------------------------------------

test('[waves] two waves, default cap 5, --limit overrides, task pipeline only', () => {
  const step4 = section(TEXT, /^## Step 4:/);
  assert.match(step4, /Tier 1-4/);
  assert.match(step4, /task pipeline/);
  assert.match(step4, /\*\*Wave 1\*\*/);
  assert.match(step4, /\*\*Wave 2\*\*/);
  assert.match(step4, /`--limit N` items, default 5/);
  assert.match(step4, /Omit Wave 3\+/);
  assert.match(step4, /skipping bug batches, ADR, PRD and roadmap rows/);
  assert.match(TEXT, /`--limit N` caps each wave \(default 5\)/);
});

test('[waves] collision safety is left to /power-mode, not predicted', () => {
  assert.match(section(TEXT, /^## Step 4:/), /`\/power-mode`'s own protocol at execution time/);
});

// ---- [report] section order and columns ----------------------------------

test('[report] Step 5 sections 5a-5e appear in order', () => {
  const step5 = section(TEXT, /^## Step 5:/);
  const heads = ['### 5a. Snapshot', '### 5b. Waves', '### 5c. Ranked table', '### 5d. Blocked', '### 5e. Warnings'];
  let pos = -1;
  for (const h of heads) {
    const at = step5.indexOf(h, pos + 1);
    assert.ok(at > pos, `"${h}" missing or out of order`);
    pos = at;
  }
  assert.match(step5, /with no preamble/);
});

test('[report] ranked table has the seven specified columns in order', () => {
  assert.ok(
    TEXT.includes('| Rank | Item | Family | Roadmap | Why | Unblocks | Next |'),
    'ranked table header must be Rank · Item · Family · Roadmap · Why · Unblocks · Next'
  );
});

test('[report] warnings cover cycles, asymmetric edges, stale refs, index drift, orphans, empty-sweep', () => {
  const w = section(TEXT, /^### 5e\./, 3);
  for (const re of [/cycles/i, /asymmetric edges/i, /stale references/i, /index drift/i, /orphan count/i, /empty-sweep suspicion/i]) {
    assert.match(w, re);
  }
  assert.match(w, /N of M active tasks sit outside every active roadmap/);
  assert.match(TEXT, /`A ← B \(no matching blocks\)`/);
});

test('[report] snapshot includes a WIP-by-state histogram over tasks and UATs', () => {
  const s = section(TEXT, /^### 5a\./, 3);
  assert.match(s, /WIP-by-state histogram/);
  for (const st of ['`todo`', '`in-progress`', '`pending-uat`']) assert.ok(s.includes(st), `histogram missing ${st}`);
});

// ---- [stop] empty-state text ---------------------------------------------

test('[stop] STOP text fires only when every family is genuinely empty', () => {
  assert.ok(
    TEXT.includes('No open work found — nothing to rank. Use /task-create, /bug-create or /roadmap-create to add some.'),
    'exact STOP text missing'
  );
  assert.match(TEXT, /Only when every family is genuinely empty, STOP/);
});

// ---- [refs] cited docs and sibling sections really exist ------------------

test('[refs] every shared doc and sibling-skill section the skill points at exists', () => {
  assert.match(read('lib/skills/_shared/ID-RESOLUTION.md'), /^## Family table/m);
  assert.match(read('lib/skills/roadmap-next/SKILL.md'), /^### Parse a roadmap/m);
  for (const [skill, headRe] of [
    ['adr-assess', /^## Step \d+: Rank/m],
    ['prd-assess', /^## Step \d+: Rank/m],
    ['uat-assess', /^## Step \d+: Rank/m],
    ['bug-assess', /^## Step \d+: Rank/m],
  ]) {
    assert.match(read(`lib/skills/${skill}/SKILL.md`), headRe, `${skill} has no Rank step to defer to`);
  }
  for (const cited of ['lib/skills/adr-assess/SKILL.md', 'lib/skills/prd-assess/SKILL.md', 'lib/skills/uat-assess/SKILL.md', 'lib/skills/bug-assess/SKILL.md']) {
    assert.ok(TEXT.includes(cited), `skill must cite ${cited}`);
  }
});

test('[refs] roadmap sweep runs only the Parse procedure, never the writing procedures', () => {
  assert.match(TEXT, /never its Upgrade-inline-items, Parallelism-analysis or Close-a-fully-complete-roadmap procedures, which write files/);
});

// ---- [readonly] no write path anywhere ------------------------------------

test('[readonly] no allowed-tools grant, no --go, no AskUserQuestion/Skill permission in frontmatter', () => {
  const close = TEXT.split('\n').indexOf('---', 1);
  const fmText = TEXT.split('\n').slice(0, close).join('\n');
  assert.doesNotMatch(fmText, /allowed-tools/i);
  assert.doesNotMatch(fmText, /AskUserQuestion|\bSkill\b/);
  assert.doesNotMatch(TEXT, /--go\b/, 'v1 must not mention or define a --go flag');
});

test('[readonly] the skill states it never calls the *-assess skills or flips a status', () => {
  assert.match(TEXT, /never runs a case, never flips a status, never creates or edits a file, never asks questions, and never calls the `\*-assess` skills/);
});

test('[readonly] the power-mode handoff is deferred, in one Constraints sentence', () => {
  const c = section(TEXT, /^## Constraints\s*$/);
  const hits = c.split('\n').filter((l) => /`\/power-mode`/.test(l));
  assert.equal(hits.length, 1);
  assert.match(hits[0], /awaits a task-ID-list dispatch/);
});

// ---- [log] wiki/log.md entry ----------------------------------------------

test('[log] wiki/log.md carries the TASK-0126 edit entry', () => {
  const log = read('wiki/log.md');
  assert.match(log, /^## \[2026-09-20\] edit \| TASK-0126 \/whats-next skill added$/m);
});
