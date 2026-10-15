#!/usr/bin/env node
// Cross-reference and drift checks for TASK-0120's three read-only family-survey
// skills (lib/skills/prd-assess, adr-assess, uat-assess), written during UAT-0120
// generation for the acceptance criteria test/assess-skills-contract.test.js does
// not pin: the exact empty-family STOP text, the Closed footer, the report
// sub-block numbering, the precedence ORDER, the status/marker vocabulary against
// the family lifecycle docs and the skills that produce it, the /adr-next fold-in,
// the roadmap-next "Parse a roadmap" anchor the skills cite, the registration row
// placement, the task-specified descriptions, and the strict read-only token
// hygiene of the skill bodies.
// Zero-dependency: node:test + node:assert/strict only.
//
// Run: node --test test/assess-skills-crossrefs.test.js
//
// WHY. Skills are markdown-as-program: the SKILL.md IS what a future agent
// executes, so a drifted phrase is a silent behaviour change and the LLM-run
// behaviour has no machine oracle. These tests pin every part of that behaviour
// that is a stable string or ordering contract. Tags in the test names ([stop],
// [footer], [blocks], [rank], [lifecycle], [vocab], [readonly], [files],
// [registry], [desc], [scan], [fold-in], [anchor], [caller]) let a UAT case
// select one contract with --test-name-pattern.
//
// SCOPE - repo-local files only; the machine-local ~/.claude/skills/ copy is not
// inspected. HERMETIC: read-only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO, 'lib', 'skills');
const NAMES = ['prd-assess', 'adr-assess', 'uat-assess'];

const FAMILY = {
  'prd-assess': { prefix: 'prd', lifecycle: 'wiki/work/requirements/lifecycle.md', rankStep: 4, reportStep: 5 },
  'adr-assess': { prefix: 'adr', lifecycle: 'wiki/work/decisions/lifecycle.md', rankStep: 5, reportStep: 6 },
  'uat-assess': { prefix: 'uat', lifecycle: 'wiki/work/uat/lifecycle.md', rankStep: 4, reportStep: 5 },
};

const STOP = {
  'prd-assess': 'No active PRDs found in wiki/work/requirements/. Use /prd-create <idea> to draft one.',
  'adr-assess': 'No active ADRs found in wiki/work/decisions/. Use /adr-create <topic> to create one.',
  'uat-assess': 'No active UATs found in wiki/work/uat/. Use /uat-create <task> to generate one.',
};

const DESCRIPTION = {
  'prd-assess':
    'Survey all active PRDs together — flag approved requirements with no downstream ADRs or tasks and stale drafts, detect blocking open decisions, and rank them into one prioritized list with a status update for each',
  'adr-assess':
    'Survey all active ADRs together — surface proposed decisions and accepted decisions with no task, follow supersession chains, and rank decision blocks into one prioritized list with a status update for each',
  'uat-assess':
    'Survey all active UATs together — group them by what each is waiting on (failing cases, partial walks, auto-runnable, manual-only cases, stubs), rank by what each unblocks, and give a status update with a suggested next command for each',
};

const PRECEDENCE = {
  'prd-assess': [
    'Approved with no linked ADRs and no linked tasks',
    'Approved and blocked by open decisions',
    'Stale drafts',
    'Fresh drafts',
    'Approved and fully flowing',
  ],
  'adr-assess': [
    'Proposed blocks that gate live work',
    'Accepted blocks with no task',
    'Other proposed blocks',
  ],
  'uat-assess': [
    'Unblocking power',
    'What it waits on',
    '`failed` — a `[FAIL: …]` case that needs a fix',
    '`in-progress` — partially walked',
    '**auto-runnable** headless via `/uat-auto`',
    'needs a human',
    '`stub` — nothing to run',
    '**Age**',
  ],
};

function rel(p) {
  return path.relative(REPO, p);
}

function readRepo(...parts) {
  const p = path.join(REPO, ...parts);
  assert.ok(fs.existsSync(p), `${rel(p)} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function readSkill(name) {
  return readRepo('lib', 'skills', name, 'SKILL.md');
}

function frontmatter(text) {
  const all = text.split('\n');
  assert.equal(all[0].trim(), '---');
  const close = all.indexOf('---', 1);
  assert.ok(close > 0, 'frontmatter has no closing --- fence');
  const fm = {};
  for (const line of all.slice(1, close)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return { fm, body: all.slice(close + 1).join('\n') };
}

function stepBlock(body, n) {
  const start = body.search(new RegExp('^## Step ' + n + ':', 'm'));
  assert.ok(start >= 0, `missing "## Step ${n}:" heading`);
  const rest = body.slice(start).split('\n').slice(1).join('\n');
  const next = rest.search(/^## /m);
  return next >= 0 ? rest.slice(0, next) : rest;
}

// Rows of the markdown table that owns `rowPrefix`, as the row immediately above it.
function previousRowSkill(text, rowPrefixRe) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => rowPrefixRe.test(l));
  assert.ok(idx > 0, `row ${rowPrefixRe} not found`);
  const m = lines[idx - 1].match(/^\| `\/?([a-z][a-z0-9-]*)/);
  assert.ok(m, `row above is not a skill table row: ${lines[idx - 1].slice(0, 80)}`);
  return m[1];
}

for (const name of NAMES) {
  const fam = FAMILY[name];

  test(`[stop] ${name}: empty-family STOP text is the exact specified string`, () => {
    assert.ok(readSkill(name).includes('`' + STOP[name] + '`'), `missing: ${STOP[name]}`);
  });

  test(`[footer] ${name}: terminal items are summarised as "Closed: N (not assessed)"`, () => {
    assert.ok(readSkill(name).includes('`Closed: N (not assessed)`'));
  });

  test(`[blocks] ${name}: report sub-blocks are numbered with their own step (no label mismatch)`, () => {
    const { body } = frontmatter(readSkill(name));
    assert.match(body, new RegExp('^## Step ' + fam.reportStep + ': Report\\s*$', 'm'));
    for (const letter of ['a', 'b', 'c']) {
      assert.match(body, new RegExp('^### ' + fam.reportStep + letter + '\\. ', 'm'), `missing ### ${fam.reportStep}${letter}.`);
    }
    for (const other of [1, 2, 3, 4, 5, 6, 7]) {
      if (other === fam.reportStep) continue;
      assert.doesNotMatch(body, new RegExp('^### ' + other + '[abc]\\. ', 'm'), `stray ### ${other}[abc]. sub-block`);
    }
  });

  test(`[rank] ${name}: precedence labels appear highest-first, inside the Rank step`, () => {
    const { body } = frontmatter(readSkill(name));
    assert.match(body, new RegExp('^## Step ' + fam.rankStep + ': Rank', 'm'));
    const rank = stepBlock(body, fam.rankStep);
    let last = -1;
    for (const label of PRECEDENCE[name]) {
      const at = rank.indexOf(label);
      assert.ok(at >= 0, `missing precedence label: ${label}`);
      assert.ok(at > last, `precedence label out of order: ${label}`);
      last = at;
    }
  });

  test(`[lifecycle] ${name}: points at its family lifecycle.md for status names and the doc holds the names it uses`, () => {
    const text = readSkill(name);
    assert.ok(text.includes(fam.lifecycle), `must cite ${fam.lifecycle}`);
    const lc = readRepo(...fam.lifecycle.split('/'));
    const statuses = {
      'prd-assess': ['draft', 'approved', 'retired'],
      'adr-assess': ['proposed', 'accepted', 'deprecated', 'superseded'],
      'uat-assess': ['pending', 'in-progress', 'passed', 'failed', 'skipped', 'trashed'],
    }[name];
    for (const s of statuses) {
      assert.ok(lc.includes('`' + s + '`') || lc.includes(s), `${fam.lifecycle} does not mention ${s}`);
      assert.ok(text.includes(s), `${name} does not mention ${s}`);
    }
  });

  test(`[readonly] ${name}: no Edit/Write/Bash/AskUserQuestion token except inside a negation, and no allowed-tools key`, () => {
    const { fm, body } = frontmatter(readSkill(name));
    assert.ok(!('allowed-tools' in fm), 'a read-only skill declares no allowed-tools');
    const offenders = body
      .split('\n')
      .filter((l) => /\b(Edit|Write|Bash|AskUserQuestion)\b/.test(l) && !/\b(never|no|not)\b/i.test(l));
    assert.deepEqual(offenders, []);
  });

  test(`[readonly] ${name}: says it never flips a status or creates a file`, () => {
    const text = readSkill(name);
    assert.match(text, /strictly read-only/);
    assert.match(text, /never flips a status/);
    assert.match(text, /never creates a file/);
    assert.match(text, /never asks questions/);
  });

  test(`[files] ${name}: skill directory holds SKILL.md only`, () => {
    assert.deepEqual(fs.readdirSync(path.join(SKILLS_DIR, name)).sort(), ['SKILL.md']);
  });

  test(`[desc] ${name}: frontmatter description is the task-specified text`, () => {
    assert.equal(frontmatter(readSkill(name)).fm.description, DESCRIPTION[name]);
  });

  test(`[registry] ${name}: README and CLAUDE.md rows sit directly under a sibling ${fam.prefix}-* row`, () => {
    const readme = readRepo('lib', 'skills', 'README.md');
    const above = previousRowSkill(readme, new RegExp('^\\| `' + name + '` \\|'));
    assert.ok(above.startsWith(fam.prefix + '-'), `README row is under ${above}, not a ${fam.prefix}-* row`);
    const claude = readRepo('CLAUDE.md');
    const aboveClaude = previousRowSkill(claude, new RegExp('^\\| `/' + name + '` \\|'));
    assert.ok(aboveClaude.startsWith(fam.prefix + '-'), `CLAUDE.md row is under ${aboveClaude}, not a ${fam.prefix}-* row`);
  });

  test(`[registry] ${name}: README and CLAUDE.md rows are marked (read-only) and lead with "Survey all active"`, () => {
    for (const [file, re] of [
      [['lib', 'skills', 'README.md'], new RegExp('^\\| `' + name + '` \\| (.*)$', 'm')],
      [['CLAUDE.md'], new RegExp('^\\| `/' + name + '` \\| (.*)$', 'm')],
    ]) {
      const m = readRepo(...file).match(re);
      assert.ok(m, `row missing in ${file.join('/')}`);
      assert.ok(m[1].startsWith('Survey all active'), `${file.join('/')} purpose must lead with "Survey all active"`);
      assert.ok(/\(read-only\)\s*\|\s*$/.test(m[1]), `${file.join('/')} row must end with "(read-only) |"`);
    }
  });
}

test('[scan] prd-assess searches decisions, tasks and roadmaps under both ID prefixes and aliases', () => {
  const step = stepBlock(frontmatter(readSkill('prd-assess')).body, 3);
  for (const dir of ['wiki/work/decisions/', 'wiki/work/tasks/', 'wiki/work/roadmaps/']) {
    assert.ok(step.includes(dir), `Step 3 must search ${dir}`);
  }
  assert.match(step, /both prefixes/);
  assert.match(step, /every alias/);
  assert.match(step, /linked_requirements/);
  assert.match(step, /linked_prds/);
  assert.match(step, /superseded by/);
});

test('[scan] adr-assess searches tasks for implements:: under both prefixes and aliases, and roadmaps by status', () => {
  const step = stepBlock(frontmatter(readSkill('adr-assess')).body, 3);
  assert.ok(step.includes('implements::[[ADR-NNNN#DM]]'));
  assert.match(step, /both prefixes/);
  assert.match(step, /aliases/);
  assert.match(step, /by `status:`, not location/);
  assert.ok(step.includes('wiki/work/roadmaps/'));
  assert.ok(step.includes('wiki/work/requirements/'));
  assert.ok(step.includes('wiki/work/tasks/'));
});

test('[scan] uat-assess skips archive/, screenshots/, lifecycle.md and index.md in Step 1 and reads status too', () => {
  const step = stepBlock(frontmatter(readSkill('uat-assess')).body, 1);
  for (const skip of ['archive/', 'screenshots/', 'lifecycle.md', 'index.md']) {
    assert.ok(step.includes(skip), `Step 1 must skip ${skip}`);
  }
  assert.match(step, /directly/);
  assert.match(step, /`passed`, `skipped`, `trashed`/);
  assert.match(step, /each file's `status:`/);
});

test('[vocab] uat-assess consumes the marker and unit-test vocabulary the UAT producers emit', () => {
  const skill = readSkill('uat-assess');
  const core = readRepo('lib', 'skills', 'uat-walk', 'UAT-CORE.md');
  const create = readRepo('lib', 'skills', 'uat-create', 'SKILL.md');
  const lifecycle = readRepo('wiki', 'work', 'uat', 'lifecycle.md');
  for (const marker of ['[ ]', '[x]', '[FAIL:', '[SKIP:']) {
    assert.ok(skill.includes(marker), `uat-assess does not name marker ${marker}`);
    assert.ok(lifecycle.includes(marker), `uat lifecycle does not name marker ${marker}`);
  }
  assert.ok(core.includes('[FAIL:') && core.includes('[SKIP:'), 'UAT-CORE.md must emit FAIL and SKIP markers');
  for (const field of ['Unit Test Command', 'Repeatable Unit Test']) {
    assert.ok(skill.includes(field), `uat-assess does not name ${field}`);
    assert.ok(create.includes(field), `uat-create does not emit ${field}`);
  }
  for (const kind of ['Not applicable', 'Blocked', 'Created']) {
    assert.ok(skill.includes(kind), `uat-assess does not name the "${kind}" Repeatable Unit Test value`);
  }
  assert.match(skill, /### UAT-<KIND>-NNN: <title>/);
});

test('[vocab] uat-assess treats an auto-judge deferral as unresolved manual-only, not a failure', () => {
  const step = stepBlock(frontmatter(readSkill('uat-assess')).body, 2);
  assert.match(step, /\[FAIL: auto-judge: … requires human verification\]/);
  assert.match(step, /not a failure/);
  assert.match(step, /manual-only/);
  assert.match(readRepo('lib', 'skills', 'uat-auto', 'SKILL.md'), /requires human verification/);
});

test('[vocab] uat-assess ignores the Prerequisites checkboxes and defines a stub', () => {
  const step = stepBlock(frontmatter(readSkill('uat-assess')).body, 2);
  assert.match(step, /ignore the `## Prerequisites` checkboxes/);
  assert.match(step, /zero `### UAT-…` case headings/);
  assert.match(step, /\/uat-skip/);
});

test('[vocab] adr-assess reads the real block layout: ## D-block H2, Status, Date, Supersedes, Tags, ### Links, Source task(s)', () => {
  const step = stepBlock(frontmatter(readSkill('adr-assess')).body, 2);
  for (const token of ['## D1.', '`Status`', '`Date`', '`Supersedes`', '`Tags`', '### Links', 'Source task(s):']) {
    assert.ok(step.includes(token), `Step 2 must name ${token}`);
  }
  const lifecycle = readRepo('wiki', 'work', 'decisions', 'lifecycle.md');
  assert.ok(lifecycle.includes('status'), 'decisions lifecycle must describe per-decision status');
  const dec = readRepo('wiki', 'work', 'decisions', 'archive', 'DEC-0001-wiki-cross-family-linking-schema.md');
  assert.match(dec, /^## D1\. /m);
  assert.match(dec, /^- \*\*Status\*\*: /m);
  assert.match(dec, /^- \*\*Date\*\*: /m);
  assert.match(dec, /^### Links/m);
  assert.match(dec, /^- Source task\(s\): /m);
});

test('[fold-in] adr-assess folds in the /adr-next check and leaves /adr-next in place', () => {
  const text = readSkill('adr-assess');
  assert.match(text, /folds in the `\/adr-next` check \(accepted with no task\)/);
  assert.match(text, /leaves `\/adr-next` in place/);
  assert.ok(fs.existsSync(path.join(SKILLS_DIR, 'adr-next', 'SKILL.md')), 'adr-next must still exist');
  assert.ok(fs.existsSync(path.join(SKILLS_DIR, 'roadmap-assess', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(SKILLS_DIR, 'bug-assess', 'SKILL.md')));
});

test('[fold-in] adr-assess suggests /task-create --decision and task-create advertises that flag', () => {
  assert.ok(readSkill('adr-assess').includes('`/task-create <description> --decision ADR-NNNN#DM`'));
  assert.match(frontmatter(readSkill('task-create')).fm['argument-hint'], /--decision ADR-NNNN#DM/);
});

test('[anchor] roadmap-next defines the "Parse a roadmap" procedure that adr-assess and uat-assess cite', () => {
  const rn = readRepo('lib', 'skills', 'roadmap-next', 'SKILL.md');
  assert.match(rn, /^### Parse a roadmap\s*$/m);
  for (const name of ['adr-assess', 'uat-assess']) {
    assert.match(readSkill(name), /\*\*Parse a roadmap\*\* procedure defined in `lib\/skills\/roadmap-next\/SKILL\.md`/);
  }
});

test('[caller] ID-RESOLUTION.md Caller-deltas row for uat-assess carries the specified deltas', () => {
  const doc = readRepo('lib', 'skills', '_shared', 'ID-RESOLUTION.md');
  const row = doc
    .slice(doc.indexOf('## Caller deltas'))
    .split('\n')
    .find((l) => l.startsWith('| `uat-assess` |'));
  assert.ok(row, 'uat-assess row missing');
  const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
  assert.equal(cells.length, 5, `expected 5 cells, got ${cells.length}`);
  assert.equal(cells[1], 'tasks');
  assert.equal(cells[2], '`active+archive`');
  assert.equal(cells[3], 'headless');
  assert.match(cells[4], /orphan/);
  assert.match(cells[4], /never STOP/);
  assert.equal(doc.split('\n').filter((l) => l.startsWith('| `uat-assess` |')).length, 1, 'exactly one row');
});

test('[caller] uat-assess wiring line ends with "empty: n/a" and treats a missing task as an orphan, never a STOP', () => {
  const text = readSkill('uat-assess');
  assert.ok(
    text.includes(
      'Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: tasks · scope: active+archive · ambiguous: headless · empty: n/a'
    )
  );
  assert.match(text, /orphan/);
  assert.match(text, /never STOP/);
});
