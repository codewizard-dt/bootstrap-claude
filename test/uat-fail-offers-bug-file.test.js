#!/usr/bin/env node
// Contract checks for TASK-0086's /bug-create affordance on a [FAIL] verdict in
// /uat-walk (interactive offer) and /uat-auto (informational summary line).
// Zero-dependency: node:test + node:assert only, mirroring the sibling
// skill-content suites (test/bug-close-clustering-offer.test.js,
// test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/uat-fail-offers-bug-file.test.js)
//
// WHY THIS IS TESTED AT ALL. TASK-0086 is a documentation-only change to two
// SKILL.md files — the markdown IS the program a future agent executes. The
// risks this pins: (1) /uat-walk's Fail action must OFFER (never force) a
// bug report, defaulting to no, and must not block the walkthrough;
// (2) the yes branch must hand /bug-create a pre-filled $ARGUMENTS built from
// the test's own fields; (3) /uat-auto must stay headless — its bug-create
// suggestion is summary text only, attached to verifiable failures and never
// to "requires human verification" ones; (4) /uat-auto-plus is explicitly out
// of scope and must stay untouched.
//
// SCOPE — lib/skills/{uat-walk,uat-auto,uat-auto-plus}/SKILL.md only. Does not
// touch the machine-local ~/.claude/skills/ copies (install-global.sh
// overwrites those on next sync; this repo is the source of truth).
//
// HERMETIC: reads repo-local files. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');

function readSkill(name) {
  const p = path.join(SKILLS, name, 'SKILL.md');
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

function failBullet(walkText) {
  const line = walkText.split('\n').find((l) => l.startsWith('- **Fail** →'));
  assert.ok(line, 'uat-walk Verdict actions "- **Fail** →" bullet not found');
  return line;
}

function section(text, heading, nextHeadingPrefix) {
  const start = text.indexOf(heading);
  assert.ok(start !== -1, `${heading} heading not found`);
  const rest = text.slice(start + heading.length);
  const end = rest.search(new RegExp(`\\n${nextHeadingPrefix}`));
  return end === -1 ? rest : rest.slice(0, end);
}

test('uat-walk Fail action asks "File a bug for this? (y/n)" inline, defaulting to no', () => {
  const bullet = failBullet(readSkill('uat-walk'));
  assert.ok(
    bullet.includes('ask inline "File a bug for this? (y/n)"'),
    'Fail bullet must ask the exact inline question'
  );
  assert.ok(
    bullet.includes('default no if the user doesn\'t answer explicitly'),
    'Fail bullet must default to no absent an explicit answer'
  );
});

test('uat-walk offer is recorded after the fail note is written, not before', () => {
  const bullet = failBullet(readSkill('uat-walk'));
  const idxRecord = bullet.indexOf('mark `- [FAIL:');
  const idxOffer = bullet.indexOf('File a bug for this?');
  assert.ok(idxRecord !== -1, 'Fail bullet must still record the [FAIL: ...] marker');
  assert.ok(idxOffer !== -1, 'Fail bullet must contain the bug-create offer');
  assert.ok(idxRecord < idxOffer, 'the [FAIL: ...] marker must be recorded before the bug-create offer');
  assert.ok(bullet.includes('Once recorded'), 'offer must be gated on the failure having been recorded');
});

test('uat-walk yes branch invokes Skill bug-create with a pre-filled $ARGUMENTS description', () => {
  const bullet = failBullet(readSkill('uat-walk'));
  assert.ok(bullet.includes('On yes: invoke `Skill` `bug-create`'), 'yes branch must invoke Skill bug-create');
  for (const field of ['`Description`', '`Steps`', '`EXPECTED`']) {
    assert.ok(bullet.includes(field), `pre-filled description must draw from the test's ${field} field`);
  }
  assert.ok(bullet.includes('fail note as `Actual Behavior`'), 'fail note must be passed as Actual Behavior');
  assert.ok(bullet.includes('`$ARGUMENTS`'), 'content must be passed as the skill\'s $ARGUMENTS');
});

test('uat-walk offer never blocks the walkthrough', () => {
  const bullet = failBullet(readSkill('uat-walk'));
  assert.ok(
    bullet.includes('After `/bug-create` completes (or the user says no), continue to the next test without delay.'),
    'both the yes and no paths must continue to the next test'
  );
});

test('uat-walk keeps the offer inline and does not introduce AskUserQuestion', () => {
  const text = readSkill('uat-walk');
  assert.ok(text.includes('Prompt **inline** — never `AskUserQuestion`.'), 'inline-only convention must remain');
  assert.ok(!failBullet(text).includes('AskUserQuestion'), 'Fail bullet must not use AskUserQuestion');
});

test('uat-walk Pass, Skip, and Fix-now verdict actions carry no bug-create offer', () => {
  const actions = section(readSkill('uat-walk'), '### Verdict actions (per test)', '---');
  const others = actions.split('\n').filter((l) => /^- \*\*(Pass|Skip|Fix now)\*\*/.test(l));
  assert.strictEqual(others.length, 3, 'expected Pass, Skip, and Fix now bullets');
  for (const line of others) {
    assert.ok(!line.includes('bug-create'), `non-Fail verdict must not mention bug-create: ${line}`);
  }
});

test('uat-auto Summary format suggests /bug-create for a verifiable failure, nested under it', () => {
  const summary = section(readSkill('uat-auto'), '## Summary format', '## Rules');
  const lines = summary.split('\n');
  const idx = lines.findIndex((l) => l.includes('UAT-API-003: Delete Position'));
  assert.ok(idx !== -1, 'verifiable-failure example line not found');
  assert.match(
    lines[idx + 1],
    /^ {4}→ \/bug-create "UAT-API-003: HTTP 500 received, expected 204"$/,
    'suggestion must be an indented "→ /bug-create" line directly under the failure, citing test id and symptom'
  );
});

test('uat-auto Summary format omits the /bug-create suggestion for "requires human verification" failures', () => {
  const summary = section(readSkill('uat-auto'), '## Summary format', '## Rules');
  const lines = summary.split('\n');
  const idx = lines.findIndex((l) => l.includes('requires human verification'));
  assert.ok(idx !== -1, 'human-verification example line not found');
  assert.ok(
    !(lines[idx + 1] || '').includes('/bug-create'),
    'a human-verification failure is unverifiable-by-design and must not get a bug-create suggestion'
  );
  assert.strictEqual(
    summary.split('\n').filter((l) => l.includes('/bug-create')).length,
    1,
    'exactly one suggestion line expected in the example summary'
  );
});

test('uat-auto Rules keep "No user interaction, ever" and mark bug-create suggestions informational only', () => {
  const rules = section(readSkill('uat-auto'), '## Rules', '\\*\\*Start now');
  assert.ok(rules.includes('**No user interaction, ever**'), '"No user interaction, ever" rule must remain');
  assert.ok(
    rules.includes('Bug-create suggestions in the summary are informational text only — never call `/bug-create` itself.'),
    'Rules must state the suggestion is informational and /bug-create is never invoked'
  );
});

test('uat-auto never invokes the bug-create skill (no Skill call, no AskUserQuestion)', () => {
  const text = readSkill('uat-auto');
  assert.ok(!/invoke `Skill` `bug-create`/.test(text), 'uat-auto must not invoke Skill bug-create');
  assert.ok(!text.includes('File a bug for this?'), 'uat-auto must not carry the interactive offer');
});

test('uat-auto-plus is out of scope and carries no bug-create affordance', () => {
  assert.ok(!readSkill('uat-auto-plus').includes('bug-create'), 'uat-auto-plus must remain untouched by TASK-0086');
});
