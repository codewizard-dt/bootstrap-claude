#!/usr/bin/env node
// Repeatable checks that the `bootstrap config` CLI path is documented where users look
// for it, and that the flags those docs name are the flags bin/cli.js actually accepts.
// Zero-dependency: node:test + node:assert only, mirroring the sibling suites.
//
// Run: node --test test/bootstrap-config-docs.test.js
//
// Promoted from UAT-0106 (TASK-0106, ROADMAP-011 Phase 3). TASK-0106 is docs-only, so a
// drifted flag name is the failure mode: a README that tells users to run
// `bootstrap config --frobnicate` reads as authoritative and fails at the terminal.
//
// Static assertions only: no subprocess, no writes. Deliberately silent on the
// uat-create skill wording, which other tasks own.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const CLI = path.join(REPO, 'bin', 'cli.js');

const DOCS = {
  'README.md': path.join(REPO, 'README.md'),
  'CLAUDE.md': path.join(REPO, 'CLAUDE.md'),
  'lib/skills/bootstrap-config/SKILL.md': path.join(REPO, 'lib', 'skills', 'bootstrap-config', 'SKILL.md'),
};

const FLAG = /--[a-z][a-z-]*/g;
const CONFIG_LINE = /bootstrap config|bin\/cli\.js config/;

function lines(file) {
  return fs.readFileSync(file, 'utf8').split('\n');
}

// Flags the CLI accepts for `config`: the passthrough list that decides routing, plus
// every flag named in the `config` usage text (--value/--global/--project live only there).
function cliConfigFlags() {
  const flags = new Set();
  for (const line of lines(CLI)) {
    if (/PREFS_OPERATION_FLAGS\s*=/.test(line) || /bootstrap config/.test(line)) {
      for (const f of line.match(FLAG) || []) flags.add(f);
    }
  }
  assert.ok(flags.size > 0, 'found no config flags in bin/cli.js');
  return flags;
}

function documentedFlags(file) {
  const flags = new Set();
  for (const line of lines(file)) {
    if (CONFIG_LINE.test(line)) {
      for (const f of line.match(FLAG) || []) flags.add(f);
    }
  }
  return flags;
}

for (const [label, file] of Object.entries(DOCS)) {
  test(`${label} documents bootstrap config with flags matching bin/cli.js`, () => {
    assert.ok(
      lines(file).some((l) => l.includes('bootstrap config')),
      `${label} never mentions "bootstrap config"`
    );
    const cli = cliConfigFlags();
    const documented = documentedFlags(file);
    const unknown = [...documented].filter((f) => !cli.has(f));
    assert.deepStrictEqual(unknown, [], `${label} names flags bin/cli.js does not: ${unknown.join(', ')}`);
    for (const required of ['--get', '--set', '--unset', '--list']) {
      assert.ok(documented.has(required), `${label} does not document ${required} next to "bootstrap config"`);
    }
  });
}

test('README Run Locally block shows the config examples', () => {
  const text = lines(DOCS['README.md']);
  assert.ok(
    text.some((l) => /^node bin\/cli\.js config\s*$/.test(l)),
    'README has no bare `node bin/cli.js config` example'
  );
  const flagged = text.filter((l) => /^node bin\/cli\.js config\s+--/.test(l));
  assert.ok(flagged.length > 0, 'README has no flag-driven `node bin/cli.js config --...` example');
  const cli = cliConfigFlags();
  for (const l of flagged) {
    for (const f of l.match(FLAG) || []) {
      assert.ok(cli.has(f), `README example uses ${f}, which bin/cli.js does not accept: ${l}`);
    }
  }
});

test('bin/cli.js still routes the four documented operation flags', () => {
  const cli = cliConfigFlags();
  for (const f of ['--get', '--set', '--unset', '--list']) {
    assert.ok(cli.has(f), `bin/cli.js no longer accepts ${f}`);
  }
});
