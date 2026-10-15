#!/usr/bin/env node
// Acceptance-criteria companion to task-lifecycle-pending-uat.test.js
// (TASK-0125 / UAT-0125). The tackle-written suite pins the enum, diagram,
// index headers, /primer sentence and STATUS_TONES key. This file pins what it
// leaves open: the lifecycle prose (bullet order, done-bullet wording, terminal
// vs active), the dashboard tone VALUE, the end-user symptom (every live task
// status is in the enum and gets a badge), the sweep fixes in CLAUDE.md /
// migrate-wiki.md / primer, and the log entry. Zero-dependency.
//
// Run: node --test test/task-lifecycle-pending-uat-crossrefs.test.js
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
const DASHBOARDS = [
  'lib/scripts/templates/wiki/dashboard.html',
  'wiki/dashboard.html',
];
const TONE_SET = new Set(['neutral', 'accent', 'good', 'bad', 'muted']);

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

function loadDashboardStatus(rel) {
  const html = read(rel);
  const tonesAt = html.indexOf('const STATUS_TONES = {');
  assert.notEqual(tonesAt, -1, `"const STATUS_TONES = {" not found in ${rel}`);
  const tones = balancedBlock(html, tonesAt, `STATUS_TONES in ${rel}`) + ';';
  const kw = html.match(/const STATUS_KEYWORDS = [^;\n]+;/);
  assert.ok(kw, `STATUS_KEYWORDS declaration not found in ${rel}`);
  const fnAt = html.indexOf('function statusKeyword(');
  assert.notEqual(fnAt, -1, `"function statusKeyword(" not found in ${rel}`);
  const fn = balancedBlock(html, fnAt, `statusKeyword in ${rel}`);
  const sandbox = vm.createContext({});
  vm.runInContext(
    `${tones}\n${kw[0]}\n${fn}\nthis.statusKeyword = statusKeyword;\nthis.STATUS_TONES = STATUS_TONES;`,
    sandbox
  );
  return { statusKeyword: sandbox.statusKeyword, tones: sandbox.STATUS_TONES };
}

function statusEnum(lifecycleText) {
  const row = lifecycleText.split('\n').find((l) => /^\|\s*`status`\s*\|/.test(l));
  assert.ok(row, 'lifecycle.md must have a `status` frontmatter row');
  const cell = row.match(/`([^`]+)`/g).map((s) => s.slice(1, -1)).find((s) => s.includes('todo'));
  assert.ok(cell, 'status row must list the enum inside backticks');
  return cell.split(/\s*\\?\|\s*/).map((s) => s.trim()).filter(Boolean);
}

for (const rel of LIFECYCLES) {
  test(`[lifecycle-prose] ${rel}: pending-uat bullet sits between in-progress and done and is an active state`, () => {
    const lines = read(rel).split('\n');
    const idx = (marker) => lines.findIndex((l) => l.startsWith(marker));
    const inProgress = idx('- **in-progress**');
    const pendingUat = idx('- **pending-uat**');
    const done = idx('- **done**');
    assert.ok(inProgress !== -1 && pendingUat !== -1 && done !== -1, 'in-progress, pending-uat and done bullets must all exist');
    assert.ok(inProgress < pendingUat && pendingUat < done, 'bullet order must be in-progress, pending-uat, done');

    const bullet = lines[pendingUat];
    assert.match(bullet, /every `## Steps` checkbox is checked/, 'pending-uat bullet must say every Steps checkbox is checked');
    assert.match(bullet, /`\/tackle`/, 'pending-uat bullet must name /tackle as the writer');
    assert.match(bullet, /`\/uat-create`/, 'pending-uat bullet must name /uat-create');
    assert.match(bullet, /`\/uat-walk`/, 'pending-uat bullet must name /uat-walk');
    assert.match(bullet, /`\/uat-auto`/, 'pending-uat bullet must name /uat-auto');
    assert.match(bullet, /active state/i, 'pending-uat bullet must call it an active state');
    assert.match(bullet, /index\.md/, 'pending-uat bullet must say it stays listed in index.md');
  });

  test(`[lifecycle-prose] ${rel}: done means UAT passed or explicitly skipped, and only done/trashed are terminal`, () => {
    const text = read(rel);
    const lines = text.split('\n');
    const done = lines.find((l) => l.startsWith('- **done**'));
    assert.ok(done, 'done bullet must exist');
    assert.match(done, /verification finished/i, 'done bullet must lead with verification finished');
    assert.match(done, /UAT passed/, 'done bullet must mention the UAT passing');
    assert.match(done, /\/uat-skip/, 'done bullet must mention /uat-skip');
    assert.ok(
      text.includes('A task reaches **done** only when its UAT is all-pass or skipped'),
      'closing sentence "A task reaches **done** only when its UAT is all-pass or skipped" must be kept'
    );

    const terminal = lines.find((l) => l.startsWith('Active files are **never moved**'));
    assert.ok(terminal, 'the never-moved / terminal-items paragraph must exist');
    assert.match(terminal, /Terminal items \(`done`, `trashed`\)/, 'only done and trashed may be named terminal');
    assert.doesNotMatch(terminal, /pending-uat/, 'pending-uat must not be described as terminal');
  });

  test(`[lifecycle-prose] ${rel}: trashed is reachable from pending-uat in the diagram`, () => {
    const lines = read(rel).split('\n');
    const at = lines.findIndex((l) => l.includes('in-progress ──▶ pending-uat ──▶ done'));
    assert.notEqual(at, -1, 'diagram flow line must exist');
    assert.ok(lines[at + 1].includes('│'), 'diagram must have a branch row under the flow line');
    const trashed = lines[at + 2];
    assert.match(trashed, /──▶ trashed/, 'diagram must end with an arrow into trashed');
    const drops = (lines[at + 1].match(/│/g) || []).length;
    assert.equal(drops, 3, 'todo, in-progress and pending-uat must each drop to trashed (3 branch marks)');
    const joins = (trashed.match(/[┴┘└]/g) || []).length;
    assert.ok(joins >= 3, 'the trashed row must join all three branches');
  });
}

for (const rel of DASHBOARDS) {
  test(`[tone] ${rel}: pending-uat is an in-flight accent tone, same as in-progress`, () => {
    const { tones } = loadDashboardStatus(rel);
    assert.equal(tones['pending-uat'], 'accent', 'pending-uat must map to the accent tone');
    assert.equal(tones['pending-uat'], tones['in-progress'], 'pending-uat must share in-progress\'s in-flight tone');
    for (const [key, tone] of Object.entries(tones)) {
      assert.ok(TONE_SET.has(tone), `STATUS_TONES['${key}'] = '${tone}' is not in neutral|accent|good|bad|muted`);
    }
  });

  test(`[tone] ${rel}: a "pending-uat · P2" status string still resolves to pending-uat (badge text carries a suffix)`, () => {
    const { statusKeyword } = loadDashboardStatus(rel);
    assert.equal(statusKeyword('pending-uat · P2'), 'pending-uat');
    assert.equal(statusKeyword('PENDING-UAT'), 'pending-uat');
  });
}

test('[live-tasks] every active task file carries a status in the lifecycle enum and gets a dashboard badge', () => {
  const enumValues = statusEnum(read(LIFECYCLES[0]));
  const dir = path.join(REPO, 'wiki', 'work', 'tasks');
  const files = fs.readdirSync(dir).filter((f) => /^TASK-\d+-.+\.md$/.test(f));
  assert.ok(files.length > 0, 'expected active task files under wiki/work/tasks/');

  const helpers = DASHBOARDS.map((rel) => ({ rel, ...loadDashboardStatus(rel) }));
  for (const f of files) {
    const fm = fs.readFileSync(path.join(dir, f), 'utf8').match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fm, `${f} must have frontmatter`);
    const status = (fm[1].match(/^status:\s*(\S+)/m) || [])[1];
    assert.ok(status, `${f} must have a status`);
    assert.ok(enumValues.includes(status), `${f} has status "${status}" outside the lifecycle enum (${enumValues.join(', ')})`);
    for (const { rel, statusKeyword } of helpers) {
      assert.notEqual(statusKeyword(status), null, `${rel}: status "${status}" of ${f} renders with no badge`);
      assert.equal(statusKeyword(status), status, `${rel}: status "${status}" of ${f} resolves to a different keyword`);
    }
  }
});

test('[sweep] other task-status enumerations name pending-uat', () => {
  const claude = read('CLAUDE.md').split('\n').find((l) => l.includes('wiki/work/tasks/lifecycle.md') && l.includes('TASK-NNNN IDs'));
  assert.ok(claude, 'CLAUDE.md must have the tasks/lifecycle.md Key Files bullet');
  assert.match(claude, /todo \| in-progress \| pending-uat \| done \| trashed/, 'CLAUDE.md task enum must list pending-uat between in-progress and done');

  const migrate = read('lib/prompts/migrate-wiki.md').split('\n').find((l) => /tasks: `todo`/.test(l));
  assert.ok(migrate, 'migrate-wiki.md must have the active-tasks status list');
  assert.match(migrate, /tasks: `todo`, `in-progress`, `pending-uat`/, 'migrate-wiki.md active tasks list must include pending-uat');

  const primer = read('lib/skills/primer/SKILL.md');
  assert.match(primer, /one line per `todo`\/`in-progress`\/`pending-uat` task/, 'primer survey sentence must name pending-uat');
  assert.match(primer, /frontmatter `status: todo`, `in-progress` or `pending-uat`/, 'primer consistency check must name pending-uat');
});

test('[log] wiki/log.md records the TASK-0125 edit entry', () => {
  const log = read('wiki/log.md');
  assert.ok(
    log.includes('## [2026-09-20] edit | TASK-0125 document pending-uat task status'),
    'log must carry the "edit | TASK-0125 document pending-uat task status" entry'
  );
});
