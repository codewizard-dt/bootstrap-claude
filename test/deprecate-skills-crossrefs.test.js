#!/usr/bin/env node
// Cross-reference and behavior contract for the status-only deprecate skills
// (TASK-0119 / UAT-0119). Complements test/deprecate-skills.test.js, which pins
// the two SKILL.md files' status-only shape, by pinning everything AROUND them:
// frontmatter metadata, the confirm-before-edit / never-cascade / reason-required
// safety rules, adr-deprecate's per-block edit discipline, the sibling skills
// that point at the new skills, the doc tables, the requirements lifecycle
// copies, the terminal-status lists and the Serena memories.
// Zero-dependency: node:test + node:assert/strict only.
//
// Run: node --test test/deprecate-skills-crossrefs.test.js
//
// HERMETIC: read-only, repo files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(REPO, ...rel.split('/')), 'utf8');
}

function frontmatter(text) {
  return text.split(/^---\s*$/m)[1] || '';
}

const PRD = read('lib/skills/prd-deprecate/SKILL.md');
const ADR = read('lib/skills/adr-deprecate/SKILL.md');

test('(a) both skills keep the haiku / planning / user-invocable frontmatter shape', () => {
  for (const [name, text] of [['prd-deprecate', PRD], ['adr-deprecate', ADR]]) {
    const fm = frontmatter(text);
    assert.match(fm, /^category:\s*planning\s*$/m, `${name} category`);
    assert.match(fm, /^model:\s*claude-haiku-4-5-20251001\s*$/m, `${name} model`);
    assert.match(fm, /^user-invocable:\s*true\s*$/m, `${name} user-invocable`);
    assert.match(fm, /^disable-model-invocation:\s*false\s*$/m, `${name} disable-model-invocation`);
    assert.match(fm, /^argument-hint:\s*\S/m, `${name} argument-hint`);
  }
});

test('(a) each skill opens with the standard Prereqs line and names its family lifecycle doc', () => {
  const prereqs = '**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.';
  assert.ok(PRD.includes(prereqs), 'prd-deprecate Prereqs line');
  assert.ok(ADR.includes(prereqs), 'adr-deprecate Prereqs line');
  assert.ok(PRD.includes('wiki/work/requirements/lifecycle.md'), 'prd-deprecate must point at requirements lifecycle');
  assert.ok(ADR.includes('wiki/work/decisions/lifecycle.md'), 'adr-deprecate must point at decisions lifecycle');
});

test('(b) safety rules: confirm before edits, reason required, never auto-cascade, refuse already-terminal', () => {
  for (const [name, text] of [['prd-deprecate', PRD], ['adr-deprecate', ADR]]) {
    assert.match(text, /Confirm with the user before any edits/, `${name}: confirm-before-edit rule`);
    assert.match(text, /AskUserQuestion/, `${name}: AskUserQuestion confirmation`);
    assert.match(text, /Deprecation reason is required/, `${name}: reason-required rule`);
    assert.match(text, /Never auto-cascade/, `${name}: never-auto-cascade rule`);
    assert.match(text, /Maximum 3 sub-processes/, `${name}: sub-process cap`);
    assert.ok(text.includes('/task-close'), `${name}: surfaces /task-close`);
  }
  assert.match(PRD, /Refuse if already retired or superseded/);
  assert.match(ADR, /Refuse if already `deprecated` or `superseded`/);
});

test('(b) prd-deprecate keeps the terminal status name retired and adds the Notes audit trail', () => {
  assert.match(PRD, /`status: retired`|status: retired/);
  assert.match(PRD, /\*\*Deprecated \[YYYY-MM-DD\]\*\*/);
  assert.match(PRD, /wiki\/work\/requirements\/index\.md/);
  assert.match(PRD, /## Closed/);
  assert.match(PRD, /never move the file/);
});

test('(c) adr-deprecate is per-block: touches only the target block and reads proposed|accepted only', () => {
  assert.match(ADR, /Touch only the target block/i);
  assert.match(ADR, /sibling decisions are inviolate|Sibling decisions in the group stay byte-for-byte unchanged/i);
  assert.match(ADR, /\| `proposed` \| Continue/);
  assert.match(ADR, /\| `accepted` \| Continue/);
  assert.match(ADR, /\| `deprecated` \| \*\*STOP\.\*\*/);
  assert.match(ADR, /\| `superseded by …` \| \*\*STOP\.\*\*/);
  assert.match(ADR, /> \*\*Deprecated\*\* on YYYY-MM-DD:/);
  assert.match(ADR, /wiki\/work\/decisions\/index\.md/);
  assert.match(ADR, /a group is Active while any block is `proposed`/);
});

test('(c) adr-deprecate routes replacement decisions to /adr-create + /adr-finalize, not to itself', () => {
  assert.match(ADR, /\/adr-create <topic> \(supersedes ADR-NNNN#DM\)/);
  assert.match(ADR, /\/adr-finalize/);
});

test('(d) decisions lifecycle documents deprecated as a terminal state set via /adr-deprecate', () => {
  for (const p of ['wiki/work/decisions/lifecycle.md', 'lib/scripts/templates/wiki/work/decisions/lifecycle.md']) {
    const text = read(p);
    assert.match(text, /proposed \/ accepted ──▶ deprecated/, `${p}: transition diagram`);
    assert.match(text, /\*\*deprecated\*\* — withdrawn without a successor via `\/adr-deprecate`/, `${p}: deprecated bullet`);
    assert.match(text, /Set only by `\/adr-finalize`\./, `${p}: superseded owned by adr-finalize`);
  }
});

test('(d) requirements lifecycle copies name /prd-deprecate and are byte-identical', () => {
  const local = read('wiki/work/requirements/lifecycle.md');
  const template = read('lib/scripts/templates/wiki/work/requirements/lifecycle.md');
  assert.equal(local, template, 'the two requirements lifecycle.md copies must stay byte-identical');
  assert.match(local, /`\/prd-create`, then `\/prd-deprecate` the old one/);
  assert.match(local, /set via `\/prd-deprecate` \(status-only; the status keeps the name `retired`\)/);
  assert.match(local, /^\| `status` \|.*`draft \\\| approved \\\| retired`/m, 'the requirement status enum must still be draft | approved | retired');
});

test('(e) conventions terminal-status list includes deprecated in both copies', () => {
  for (const p of ['wiki/conventions.md', 'lib/scripts/templates/wiki/conventions.md']) {
    const line = read(p).split('\n').find((l) => l.includes('terminal status'));
    assert.ok(line, `${p} must have a terminal-status sentence`);
    assert.match(line, /`retired`, `deprecated`/, `${p}: deprecated beside retired`);
    assert.match(line, /`accepted`\/`deprecated`\/`superseded`/, `${p}: decisions clause`);
  }
});

test("(e) dashboard colours deprecated 'muted' like retired and superseded", () => {
  const html = read('lib/scripts/templates/wiki/dashboard.html');
  for (const s of ['retired', 'deprecated', 'superseded']) {
    assert.ok(html.includes(`'${s}': 'muted'`), `dashboard.html must map '${s}' to 'muted'`);
  }
});

test('(f) sibling skills point at the new skills', () => {
  const prdFinalize = read('lib/skills/prd-finalize/SKILL.md');
  assert.ok(prdFinalize.includes('deprecating the old one with `/prd-deprecate`'), 'prd-finalize pointer');
  const adrFinalize = read('lib/skills/adr-finalize/SKILL.md');
  assert.ok(
    adrFinalize.includes('To withdraw an accepted decision with no successor, use `/adr-deprecate`'),
    'adr-finalize pointer'
  );
  const adrCreate = read('lib/skills/adr-create/SKILL.md');
  assert.ok(adrCreate.includes('accepted → deprecated via `/adr-deprecate`'), 'adr-create rule 6 widened');
  const walkthrough = read('lib/skills/adr-walkthrough/SKILL.md');
  assert.ok(
    walkthrough.includes('the deprecation transition belongs to `/adr-deprecate`'),
    'adr-walkthrough no-status-flips rule'
  );
});

test('(f) adr-finalize still owns superseded and adr-next skips deprecated', () => {
  const adrFinalize = read('lib/skills/adr-finalize/SKILL.md');
  assert.match(adrFinalize, /superseded/);
  assert.match(read('lib/skills/adr-next/SKILL.md'), /deprecated/);
});

test('(g) ID-RESOLUTION caller-deltas lists both deprecate skills in the right family rows', () => {
  const rows = read('lib/skills/_shared/ID-RESOLUTION.md').split('\n');
  const prdRow = rows.find((l) => l.includes('`prd-deprecate`'));
  const adrRow = rows.find((l) => l.includes('`adr-deprecate`'));
  assert.ok(prdRow, 'a row must name prd-deprecate');
  assert.ok(adrRow, 'a row must name adr-deprecate');
  assert.match(prdRow, /\| requirements \| `active` \| interactive \|/);
  assert.match(adrRow, /\| decisions \| `active` \| interactive \|/);
  assert.match(adrRow, /`#DM` handled per this doc/);
});

test('(h) wiki-archive no longer sweeps decisions (close in place) and says deprecate skills never move files', () => {
  const text = read('lib/skills/wiki-archive/SKILL.md');
  assert.match(text, /Roadmaps, decisions and requirements are closed in place/);
  assert.doesNotMatch(text, /all decisions in the group are/);
  assert.match(text, /`prd-deprecate` \/ `adr-deprecate` are status-only and stay in place/);
});

test('(i) skills README and CLAUDE.md list both commands', () => {
  const readme = read('lib/skills/README.md');
  assert.match(readme, /^\| `prd-deprecate` \|.*file never moves/m);
  assert.match(readme, /^\| `adr-deprecate` \|.*file never moves/m);
  const claude = read('CLAUDE.md');
  assert.match(claude, /^\| `\/prd-deprecate <file> \[reason\]` \|/m);
  assert.match(claude, /^\| `\/adr-deprecate <file>#<DM> \[reason\]` \|/m);
});

test('(j) Serena memories list the new skills and the deprecated ADR status', () => {
  const layer = read('.serena/memories/workflow/prd-layer.md');
  assert.match(layer, /^\| `\/prd-deprecate` \|.*file never moves/m);
  assert.match(layer, /^\| `\/adr-deprecate` \|.*`superseded` stays `\/adr-finalize`-only/m);
  const selection = read('.serena/memories/skills/format-and-model-selection.md');
  const bookkeeping = selection.split('\n').find((l) => l.includes('**Mechanical / bookkeeping**'));
  assert.ok(bookkeeping, 'model table must have a Mechanical / bookkeeping row');
  assert.ok(bookkeeping.includes('`prd-deprecate`') && bookkeeping.includes('`adr-deprecate`'));
  const listed = bookkeeping.split('|')[3].match(/`[a-z-]+`/g).length;
  const total = Number((bookkeeping.match(/\((\d+) total\)/) || [])[1]);
  assert.equal(total, listed, 'the "(N total)" count must match the skills listed in the row');
});
