#!/usr/bin/env node
// Contract checks for TASK-0120's three read-only family-survey skills:
// lib/skills/prd-assess/, lib/skills/adr-assess/ and lib/skills/uat-assess/.
// Zero-dependency: node:test + node:assert/strict only, mirroring the sibling
// skill-content suites (test/task-close-rename.test.js,
// test/skill-boilerplate.test.js).
//
// Run: npm test   (or: node --test test/assess-skills-contract.test.js)
//
// WHY THIS IS TESTED AT ALL. Skills are markdown-as-program: the SKILL.md IS
// what a future agent executes, so a drifted phrase is a silent behaviour
// change and nothing can be verified by running it. These three skills are the
// `assess` action for the prd / adr / uat families and are meant to mirror
// `roadmap-assess`/`bug-assess` while being STRICTLY read-only (stricter than
// either model: no auto-archive, no batch triage, no log or index write). This
// suite pins: (1) the frontmatter tier equals roadmap-assess's (read from that
// file at test time, never hardcoded); (2) the read-only contract - the
// Constraints block, the permitted-tools line, no log/index append, and the
// "never run a Unit Test Command" sentence in uat-assess only; (3) the shared
// docs are pointed at rather than restated (ID-RESOLUTION wiring line, the
// roadmap-next Parse procedure by path); (4) each family's ranking signals and
// its `archive/` stance (prd/adr never mention it - status, not directory,
// decides; uat keeps it); (5) every suggested `/command` resolves to a real
// skill, which pins the post-rename names and catches a stale pre-rename one;
// (6) the three registration rows (skills README, CLAUDE.md, Serena memory).
//
// SCOPE - repo-local files only. The machine-local ~/.claude/skills/ copy is
// deliberately not inspected.
//
// HERMETIC: read-only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO, 'lib', 'skills');
const NAMES = ['prd-assess', 'adr-assess', 'uat-assess'];

function skillPath(name) {
  return path.join(SKILLS_DIR, name, 'SKILL.md');
}

function readFile(p) {
  assert.ok(fs.existsSync(p), `${path.relative(REPO, p)} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function readSkill(name) {
  return readFile(skillPath(name));
}

// Splits a SKILL.md into the frontmatter block (between the first two `---`
// lines) and the body that follows it.
function splitFrontmatter(text) {
  const all = text.split('\n');
  assert.equal(all[0].trim(), '---', 'file must open with a --- frontmatter fence');
  const close = all.indexOf('---', 1);
  assert.ok(close > 0, 'frontmatter has no closing --- fence');
  const fm = {};
  for (const line of all.slice(1, close)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return { fm, body: all.slice(close + 1).join('\n') };
}

function constraintsText(body) {
  const idx = body.search(/^## Constraints\s*$/m);
  assert.ok(idx >= 0, 'missing "## Constraints" heading');
  const rest = body.slice(idx).split('\n').slice(1).join('\n');
  const next = rest.search(/^## /m);
  return next >= 0 ? rest.slice(0, next) : rest;
}

const MODEL = splitFrontmatter(readSkill('roadmap-assess')).fm;
const WIRING =
  'Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: tasks · scope: active+archive · ambiguous: headless';

for (const name of NAMES) {
  // ---- 1. Frontmatter contract -------------------------------------------

  test(`${name}: SKILL.md exists`, () => {
    assert.ok(fs.existsSync(skillPath(name)), `lib/skills/${name}/SKILL.md missing`);
  });

  test(`${name}: frontmatter name equals the directory name`, () => {
    assert.equal(splitFrontmatter(readSkill(name)).fm.name, name);
  });

  test(`${name}: description starts "Survey all active"`, () => {
    const { description } = splitFrontmatter(readSkill(name)).fm;
    assert.ok(description, 'description missing');
    assert.ok(description.startsWith('Survey all active'), `got: ${description}`);
  });

  test(`${name}: tier keys equal roadmap-assess's frontmatter`, () => {
    const { fm } = splitFrontmatter(readSkill(name));
    for (const key of ['category', 'model', 'disable-model-invocation', 'user-invocable']) {
      assert.ok(MODEL[key] !== undefined, `roadmap-assess has no ${key}`);
      assert.equal(fm[key], MODEL[key], `${key} must match roadmap-assess`);
    }
  });

  test(`${name}: no argument-hint key`, () => {
    assert.ok(!('argument-hint' in splitFrontmatter(readSkill(name)).fm));
  });

  test(`${name}: first body line is the inline Prereqs line`, () => {
    const first = splitFrontmatter(readSkill(name)).body.split('\n').find((l) => l.trim() !== '');
    assert.match(first, /^\*\*Prereqs:\*\* obey `wiki\/guides\/mcp-tools\.md`/);
  });

  // ---- 2. Read-only contract ---------------------------------------------

  test(`${name}: Constraints block declares Read-only`, () => {
    const c = constraintsText(splitFrontmatter(readSkill(name)).body);
    assert.ok(c.includes('Read-only'), 'Constraints must contain "Read-only"');
  });

  test(`${name}: Permitted tools line is the four read tools only`, () => {
    const c = constraintsText(splitFrontmatter(readSkill(name)).body);
    const line = c.split('\n').find((l) => l.includes('Permitted tools:'));
    assert.ok(line, 'missing "Permitted tools:" line');
    for (const tool of ['list_dir', 'find_file', 'search_for_pattern', 'Read']) {
      assert.ok(line.includes(tool), `Permitted tools must name ${tool}`);
    }
    assert.doesNotMatch(line, /\b(Edit|Write|Bash|AskUserQuestion)\b/);
  });

  test(`${name}: never instructs an append to wiki/log.md or an index file`, () => {
    const offenders = readSkill(name)
      .split('\n')
      .filter((l) => /(append|add).*(wiki\/log\.md|index\.md)/i.test(l));
    assert.deepEqual(offenders, []);
  });

  test(`${name}: "never run ... Unit Test Command" sentence ${name === 'uat-assess' ? 'present' : 'absent'}`, () => {
    const has = /never run .*Unit Test Command/i.test(readSkill(name));
    assert.equal(has, name === 'uat-assess');
  });

  // ---- 3. Shared-doc contract --------------------------------------------

  test(`${name}: points at ID-RESOLUTION / lifecycle / Family table, no restated mask algorithm`, () => {
    const text = readSkill(name);
    assert.ok(
      /_shared\/ID-RESOLUTION\.md/.test(text) || /lifecycle\.md/.test(text) || /Family table/.test(text),
      'must reference ID-RESOLUTION.md, a lifecycle.md, or the Family table'
    );
    const offenders = text.split('\n').filter((l) => l.includes('PREFIX-<pad4>') && l.includes('find_file'));
    assert.deepEqual(offenders, []);
  });

  if (name === 'adr-assess' || name === 'uat-assess') {
    test(`${name}: references roadmap-next's Parse procedure by path and does not copy its steps`, () => {
      const text = readSkill(name);
      assert.ok(text.includes('lib/skills/roadmap-next/SKILL.md'), 'must cite lib/skills/roadmap-next/SKILL.md');
      assert.ok(text.includes('Parse a roadmap'), 'must name the "Parse a roadmap" procedure');
      assert.ok(!text.includes('candidate_items'), 'must not restate the procedure (candidate_items)');
      assert.ok(!text.includes('capped at 9'), 'must not restate the procedure (candidate cap)');
      assert.doesNotMatch(text, /## Phase N/, 'must not restate the procedure (phase parsing)');
    });
  }

  // ---- 4. Family-signal contract -----------------------------------------

  if (name === 'prd-assess') {
    test(`${name}: family signals`, () => {
      const t = readSkill(name);
      assert.match(t, /Approved with no linked ADRs and no linked tasks/);
      assert.match(t, /no linked ADRs/i);
      assert.match(t, /Stale-draft threshold: 30 days/);
      assert.match(t, /`status: draft` with `updated` older than 30 days/);
      assert.match(t, /Approved and blocked by open decisions/);
      assert.match(t, /still `proposed`/);
      assert.ok(t.includes('PRD-'), 'must mention the PRD- prefix');
      assert.ok(t.includes('REQ-'), 'must mention the legacy REQ- prefix');
      assert.ok(!t.includes('archive/'), 'must not mention archive/ - status decides active vs closed');
    });
  }

  if (name === 'adr-assess') {
    test(`${name}: family signals`, () => {
      const t = readSkill(name);
      assert.match(t, /proposed block with no task/, 'proposed-with-no-task not named');
      assert.match(t, /accepted with no task/i, 'accepted-with-no-task not named');
      assert.match(t, /Accepted blocks with no task/);
      assert.match(t, /folds in the `\/adr-next` check/);
      assert.match(t, /Supersedes/);
      assert.match(t, /superseded by/);
      assert.match(t, /\*\*cycle\*\*/);
      assert.match(t, /\*\*asymmetry\*\*/);
      assert.match(t, /age = today . `Date`/);
      assert.ok(t.includes('ADR-'), 'must mention the ADR- prefix');
      assert.ok(t.includes('DEC-'), 'must mention the legacy DEC- prefix');
      assert.ok(t.includes('ADR-NNNN#DM'), 'must rank per block (ADR-NNNN#DM)');
      assert.ok(!t.includes('archive/'), 'must not mention archive/ - status decides active vs closed');
    });
  }

  if (name === 'uat-assess') {
    test(`${name}: family signals`, () => {
      const t = readSkill(name);
      for (const state of ['failed', 'in-progress', 'auto-runnable', 'manual-only', 'stub']) {
        assert.ok(t.includes(state), `wait state "${state}" missing`);
      }
      assert.ok(t.includes('Waits on'), 'Waits on column missing');
      assert.ok(t.includes('Unblocks'), 'Unblocks column missing');
      assert.match(t, /\*\*Age\*\* — oldest `created` first, then `UAT-NNNN` ascending/);
      assert.match(t, /`\[\[TASK-NNNN`.* in `wiki\/work\/roadmaps\/`/, 'task->roadmap lookup missing');
      assert.ok(t.includes('archive/'), 'must keep archive/ (UAT family keeps it)');
      assert.ok(t.includes('screenshots/'), 'must exclude screenshots/');
    });

    test(`${name}: carries the exact ID-RESOLUTION wiring line`, () => {
      assert.ok(
        readSkill(name).split('\n').some((l) => l.startsWith(WIRING)),
        'missing the wiring line'
      );
    });

    test(`${name}: ID-RESOLUTION.md Caller deltas table has a uat-assess row`, () => {
      const doc = readFile(path.join(SKILLS_DIR, '_shared', 'ID-RESOLUTION.md'));
      const idx = doc.indexOf('## Caller deltas');
      assert.ok(idx >= 0, 'Caller deltas heading missing');
      assert.match(doc.slice(idx), /^\| `uat-assess` \|/m);
    });
  }

  // ---- 5. Next-command contract ------------------------------------------

  test(`${name}: every suggested /command resolves to an existing skill`, () => {
    const body = splitFrontmatter(readSkill(name)).body;
    const re = /(?<![\w./-])\/([a-z][a-z0-9]*(?:-[a-z0-9]+)+)/g;
    const found = new Set();
    let m;
    while ((m = re.exec(body)) !== null) {
      const next = body[m.index + m[0].length];
      if (next === '/' || next === '.') continue; // path-like hit
      found.add(m[1]);
    }
    assert.ok(found.size > 0, 'no suggested commands found');
    for (const cmd of found) {
      assert.ok(fs.existsSync(skillPath(cmd)), `/${cmd} has no lib/skills/${cmd}/SKILL.md`);
    }
    const expected = {
      'prd-assess': ['prd-finalize', 'adr-extract', 'adr-finalize'],
      'adr-assess': ['adr-finalize', 'task-create'],
      'uat-assess': ['uat-auto', 'uat-walk', 'uat-create', 'uat-skip'],
    }[name];
    for (const cmd of expected) {
      assert.ok(found.has(cmd), `expected /${cmd} among suggested commands (got: ${[...found].join(', ')})`);
    }
  });

  // ---- 6. Registration contract ------------------------------------------

  test(`${name}: registered in lib/skills/README.md`, () => {
    const t = readFile(path.join(SKILLS_DIR, 'README.md'));
    assert.match(t, new RegExp('^\\| `' + name + '` \\|', 'm'));
  });

  test(`${name}: registered in CLAUDE.md Custom Commands`, () => {
    const t = readFile(path.join(REPO, 'CLAUDE.md'));
    assert.match(t, new RegExp('^\\| `/' + name + '` \\|', 'm'));
  });

  test(`${name}: listed on the researching line of the Serena skills memory`, () => {
    const t = readFile(path.join(REPO, '.serena', 'memories', 'skills', 'format-and-model-selection.md'));
    const line = t.split('\n').find((l) => l.includes('**researching**'));
    assert.ok(line, 'no **researching** line in the memory');
    assert.ok(line.includes('`' + name + '`'), `${name} not on the researching line`);
  });
}
