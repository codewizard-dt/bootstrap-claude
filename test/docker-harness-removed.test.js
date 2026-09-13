#!/usr/bin/env node
// Repeatable checks that the Docker fresh-machine test harness is fully removed.
// Zero-dependency: node:test + node:assert + node:fs only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/docker-harness-removed.test.js)
//
// Promoted from UAT-062 (TASK-078, ROADMAP-010): test/docker/fresh-machine/
// (Dockerfile, run.sh, README.md) and test/docker-fresh-machine.test.js were
// deleted via git rm, and the pointer row referencing them was removed from
// lib/scripts/README.md. This guards against any of it regressing back in.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

test('test/docker/fresh-machine/ directory no longer exists', () => {
  const dir = path.join(REPO, 'test', 'docker', 'fresh-machine');
  assert.strictEqual(fs.existsSync(dir), false, `${dir} should have been deleted`);
});

test('test/docker-fresh-machine.test.js no longer exists', () => {
  const file = path.join(REPO, 'test', 'docker-fresh-machine.test.js');
  assert.strictEqual(fs.existsSync(file), false, `${file} should have been deleted`);
});

test('lib/scripts/README.md no longer references the Docker fresh-machine harness', () => {
  const readme = path.join(REPO, 'lib', 'scripts', 'README.md');
  const contents = fs.readFileSync(readme, 'utf8');
  assert.doesNotMatch(
    contents,
    /docker\/fresh-machine/,
    'lib/scripts/README.md must not reference test/docker/fresh-machine/ anymore'
  );
});
