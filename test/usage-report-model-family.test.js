#!/usr/bin/env node
// Checks that the /usage-report declared-vs-observed model flag compares model
// FAMILIES (haiku/sonnet/opus/fable), not exact strings (TASK-0109 follow-up).
// A skill declaring the alias `sonnet` must match an observed `claude-sonnet-5`;
// otherwise the flag cannot verify the haiku/sonnet/opus tier curation.
// Zero-dependency: node:test + node:assert/strict only.
//
// Run: node --test test/usage-report-model-family.test.js
//
// Hermetic: pure-function checks plus one CLI run over test/fixtures/usage-report
// (via the USAGE_REPORT_* env overrides); reads the dashboard template and SKILL.md
// as text. Never touches ~/.claude.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'lib', 'skills', 'usage-report', 'scripts', 'usage-report.js');
const SKILL_MD = path.join(REPO, 'lib', 'skills', 'usage-report', 'SKILL.md');
const DASHBOARD = path.join(REPO, 'lib', 'scripts', 'templates', 'wiki', 'dashboard.html');
const FIXTURE = path.join(__dirname, 'fixtures', 'usage-report');

const { familyOf, modelCheckOf, aggregate } = require(SCRIPT);

test('familyOf maps aliases and full ids to the same family', () => {
  assert.equal(familyOf('sonnet'), 'sonnet');
  assert.equal(familyOf('claude-sonnet-5'), 'sonnet');
  assert.equal(familyOf('Sonnet[1m]'), 'sonnet');
  assert.equal(familyOf('haiku'), 'haiku');
  assert.equal(familyOf('claude-haiku-4-5-20251001'), 'haiku');
  assert.equal(familyOf('opus'), 'opus');
  assert.equal(familyOf('claude-opus-5'), 'opus');
  assert.equal(familyOf('claude-fable-5-1'), 'fable');
});

test('familyOf: inherit, empty, and non-strings have no family; unrecognised ids are unknown', () => {
  for (const v of ['inherit', 'INHERIT', '', '   ', null, undefined, 42]) {
    assert.equal(familyOf(v), null, String(v));
  }
  assert.equal(familyOf('claude-unknown-9'), 'unknown');
  assert.equal(familyOf('opusplan'), 'unknown');
});

test('modelCheckOf: alias vs full id of the same family is a match', () => {
  assert.equal(modelCheckOf('sonnet', ['claude-sonnet-5']), 'match');
  assert.equal(modelCheckOf('claude-haiku-4-5-20251001', ['claude-haiku-4-5-20251001']), 'match');
  assert.equal(modelCheckOf('claude-haiku-4-5-20251001', ['claude-haiku-4-5']), 'match');
  assert.equal(modelCheckOf('opus', ['claude-opus-5', 'claude-opus-4-8']), 'match');
});

test('modelCheckOf: a different observed family is a mismatch', () => {
  assert.equal(modelCheckOf('sonnet', ['claude-haiku-4-5-20251001']), 'mismatch');
  assert.equal(modelCheckOf('haiku', ['claude-sonnet-5']), 'mismatch');
  assert.equal(modelCheckOf('sonnet', ['claude-sonnet-5', 'claude-opus-5']), 'mismatch');
});

test('modelCheckOf: inherit or a missing declared model is undeclared, never a mismatch', () => {
  assert.equal(modelCheckOf(null, ['claude-sonnet-5']), 'undeclared');
  assert.equal(modelCheckOf(undefined, ['claude-sonnet-5']), 'undeclared');
  assert.equal(modelCheckOf('inherit', ['claude-opus-5']), 'undeclared');
});

test('modelCheckOf: unknown model ids are not flagged', () => {
  assert.equal(modelCheckOf('sonnet', ['claude-unknown-9']), 'unknown');
  assert.equal(modelCheckOf('mystery-model', ['claude-sonnet-5']), 'unknown');
  assert.equal(modelCheckOf('sonnet', []), 'unknown');
  assert.equal(modelCheckOf('sonnet', ['claude-sonnet-5', 'claude-unknown-9']), 'match');
});

test('aggregate: bySkill rows carry declaredFamily and modelCheck and keep declaredModel verbatim', () => {
  const rec = (skill, model) => ({
    model, skill, tier: 'other', input: 1, output: 1, cacheCreation: 0, cacheRead: 0, cost: 0.001,
    ts: '2026-01-01T00:00:00.000Z',
  });
  const declared = { aliased: 'sonnet', inheriting: 'inherit', wrong: 'haiku' };
  const out = aggregate(
    [
      rec('aliased', 'claude-sonnet-5'),
      rec('inheriting', 'claude-opus-5'),
      rec('wrong', 'claude-sonnet-5'),
      rec('nodecl', 'claude-sonnet-5'),
    ],
    { declaredModel: (s) => declared[s] || null },
  );
  const row = (s) => out.bySkill.find((r) => r.skill === s);
  assert.equal(row('aliased').declaredModel, 'sonnet');
  assert.equal(row('aliased').declaredFamily, 'sonnet');
  assert.equal(row('aliased').modelCheck, 'match');
  assert.equal(row('inheriting').declaredModel, 'inherit');
  assert.equal(row('inheriting').declaredFamily, null);
  assert.equal(row('inheriting').modelCheck, 'undeclared');
  assert.equal(row('wrong').modelCheck, 'mismatch');
  assert.equal(row('nodecl').declaredFamily, null);
  assert.equal(row('nodecl').modelCheck, 'undeclared');
});

test('CLI over the fixture: alpha matches, beta (haiku declared, opus observed) mismatches, (none) is undeclared', () => {
  const res = spawnSync(process.execPath, [SCRIPT, '--project', '/tmp/fixture-proj'], {
    cwd: REPO,
    encoding: 'utf8',
    env: {
      ...process.env,
      USAGE_REPORT_PROJECTS_DIR: path.join(FIXTURE, 'projects'),
      USAGE_REPORT_SKILLS_DIR: path.join(FIXTURE, 'skills'),
    },
  });
  assert.equal(res.status, 0, res.stderr);
  const report = JSON.parse(res.stdout);
  assert.equal(report.schemaVersion, 1);
  const by = Object.fromEntries(report.bySkill.map((s) => [s.skill, s]));
  assert.equal(by.alpha.modelCheck, 'match');
  assert.equal(by.alpha.declaredFamily, 'sonnet');
  assert.equal(by.beta.modelCheck, 'mismatch');
  assert.equal(by.beta.declaredFamily, 'haiku');
  assert.equal(by['(none)'].modelCheck, 'undeclared');
});

test('consumers display modelCheck instead of comparing exact strings', () => {
  const html = fs.readFileSync(DASHBOARD, 'utf8');
  assert.ok(html.includes("row.modelCheck === 'mismatch'"), 'dashboard reads modelCheck');
  assert.ok(!html.includes('indexOf(row.declaredModel)'), 'dashboard no longer compares exact strings');

  const md = fs.readFileSync(SKILL_MD, 'utf8');
  assert.match(md, /`modelCheck`/);
  assert.match(md, /MISMATCH/);
  assert.ok(!/any key of `models` differs/.test(md), 'SKILL.md no longer compares exact strings');
});
