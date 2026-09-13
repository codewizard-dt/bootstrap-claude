#!/usr/bin/env node
// Repeatable checks that the /bootstrap deploy feature is fully removed from bin/cli.js.
// Zero-dependency: node:test + node:assert only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/cli-deploy-removed.test.js)
//
// Promoted from UAT-080 (TASK-080, ROADMAP-010): the `deploy`/`deployment`
// SCRIPTS entries and their usage/help text were removed from bin/cli.js when
// lib/scripts/setup-deployment.sh and lib/prompts/setup-deployment.md were
// deleted. This guards against the wiring or usage text regressing back in.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const CLI = path.join(REPO, 'bin', 'cli.js');

test('node bin/cli.js with no args prints usage without mentioning deploy/deployment', () => {
  const result = spawnSync(process.execPath, [CLI], { cwd: REPO, encoding: 'utf8' });
  assert.strictEqual(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.doesNotMatch(result.stderr, /deploy/i, 'usage text must not mention deploy/deployment');
  for (const cmd of ['setup', 'update', 'install', 'migrate', 'typechecks', 'dashboard']) {
    assert.match(result.stderr, new RegExp(`\\b${cmd}\\b`), `usage text must still list "${cmd}"`);
  }
});

test('node bin/cli.js deploy falls through to the unknown-command usage path', () => {
  const result = spawnSync(process.execPath, [CLI, 'deploy'], { cwd: REPO, encoding: 'utf8' });
  assert.strictEqual(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.match(result.stderr, /^Usage: bootstrap <command>/, 'expected the usage/error path, not the old deploy script');
  assert.doesNotMatch(result.stderr, /deploy/i, 'usage text must not mention deploy/deployment');
});
