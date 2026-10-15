#!/usr/bin/env node
// Contract for the two status-only deprecate skills (TASK-0119): `prd-deprecate`
// (renamed from the old requirements retire skill) and the new `adr-deprecate`.
// Zero-dependency: node:test + node:assert/strict only.
//
// Run: node --test test/deprecate-skills.test.js
//
// WHY THIS IS TESTED. Skills are markdown-as-program: the behavior lives in the
// SKILL.md text, so the only way to keep the contract from drifting is to pin
// its load-bearing phrases. The defining property is that both skills are
// STATUS-ONLY - they flip a status, record the reason, move the family-index row
// to Closed and log, but never move the file (no `git mv`, no `archive/`, and no
// `Bash` tool at all). The supporting facts checked here: the new `deprecated`
// decision status exists in both lifecycle copies and in the dashboard colour
// map, and the shared archive doc no longer lists the retired archiving skill.
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

const OLD_NAME = 'req' + '-retire';

const SKILLS = {
  'prd-deprecate': read('lib/skills/prd-deprecate/SKILL.md'),
  'adr-deprecate': read('lib/skills/adr-deprecate/SKILL.md'),
};

for (const [name, text] of Object.entries(SKILLS)) {
  test(`${name}: SKILL.md exists with name: ${name}`, () => {
    assert.match(frontmatter(text), new RegExp(`^name:\\s*${name}\\s*$`, 'm'));
  });

  test(`${name}: status-only - no git mv, no archive/, no Bash permission`, () => {
    assert.ok(!text.includes('git mv'), `${name} must not mention git mv`);
    assert.ok(!text.includes('archive/'), `${name} must not mention archive/`);
    assert.ok(!/\bBash\b/.test(text), `${name} must not mention Bash`);
    assert.ok(!/^allowed-tools:/m.test(frontmatter(text)), `${name} must not declare allowed-tools`);
  });

  test(`${name}: defers to ID-RESOLUTION.md and SKILL-BOILERPLATE.md § Edit hygiene`, () => {
    assert.ok(text.includes('ID-RESOLUTION.md'), `${name} must reference ID-RESOLUTION.md`);
    assert.ok(
      text.includes('SKILL-BOILERPLATE.md') && /SKILL-BOILERPLATE\.md`?\s*§\s*Edit hygiene/.test(text),
      `${name} must reference SKILL-BOILERPLATE.md § Edit hygiene`
    );
  });

  test(`${name}: moves the index row to the Closed section`, () => {
    assert.match(text, /\bClosed\b/, `${name} must mention the Closed section`);
  });

  test(`${name}: never names the old skill`, () => {
    assert.ok(!new RegExp(OLD_NAME, 'i').test(text));
  });
}

test('prd-deprecate: sets status: retired and writes a prd-deprecated log entry', () => {
  const text = SKILLS['prd-deprecate'];
  assert.match(text, /status: retired/);
  assert.match(text, /prd-deprecated \|/);
});

test('adr-deprecate: sets deprecated, leaves superseded to /adr-finalize, logs adr-deprecated, handles #DM', () => {
  const text = SKILLS['adr-deprecate'];
  assert.match(text, /`deprecated`/);
  assert.match(text, /`superseded` is set only by `\/adr-finalize`/);
  assert.match(text, /adr-deprecated \|/);
  assert.ok(text.includes('#DM'), 'adr-deprecate must handle the #DM suffix');
  assert.match(text, /ADR-NNNN#DM/);
});

test('both decisions lifecycle.md copies list deprecated in the status enum and are byte-identical', () => {
  const local = read('wiki/work/decisions/lifecycle.md');
  const template = read('lib/scripts/templates/wiki/work/decisions/lifecycle.md');
  for (const [label, text] of [['wiki', local], ['template', template]]) {
    const row = text.split('\n').find((l) => /^\|\s*Status\s*\|/.test(l));
    assert.ok(row, `${label} lifecycle.md must have a Status row in the frontmatter table`);
    assert.match(row, /deprecated/, `${label} lifecycle.md status enum must list deprecated`);
  }
  assert.equal(local, template, 'the two decisions lifecycle.md copies must stay byte-identical');
});

test("dashboard.html colour map contains 'deprecated'", () => {
  const html = read('lib/scripts/templates/wiki/dashboard.html');
  assert.ok(html.includes("'deprecated'"), "dashboard.html status colour map must contain 'deprecated'");
});

test('ARCHIVE-WORK-ITEM.md no longer names the retired archiving skill and names prd-deprecate only in the in-place close section', () => {
  const text = read('lib/skills/_shared/ARCHIVE-WORK-ITEM.md');
  assert.ok(!new RegExp(OLD_NAME, 'i').test(text), 'must not name the old skill');
  const inPlace = text.indexOf('## In-place close');
  assert.ok(inPlace !== -1, 'must carry an in-place close section');
  assert.ok(!text.slice(0, inPlace).includes('prd-deprecate'), 'must not name prd-deprecate in the archive sections (status-only, never archives)');
  assert.ok(text.slice(inPlace).includes('prd-deprecate'), 'in-place close Caller deltas must list prd-deprecate');
});
