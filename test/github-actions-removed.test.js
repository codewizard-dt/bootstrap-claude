#!/usr/bin/env node
// Repeatable checks that all GitHub Actions workflows and Gitleaks config are
// fully removed from this repo. Zero-dependency: node:test + node:assert +
// node:fs only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/github-actions-removed.test.js)
//
// Promoted from UAT-082 (TASK-079, ROADMAP-010): .github/workflows/docker-harness.yml,
// .github/workflows/security.yml, and the root .gitleaks.toml were deleted via
// git rm, and package.json's "files" array no longer lists .github/ or
// .gitleaks.toml. This guards against any of it regressing back in.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

test('.github/workflows/docker-harness.yml no longer exists', () => {
  const file = path.join(REPO, '.github', 'workflows', 'docker-harness.yml');
  assert.strictEqual(fs.existsSync(file), false, `${file} should have been deleted`);
});

test('.github/workflows/security.yml no longer exists', () => {
  const file = path.join(REPO, '.github', 'workflows', 'security.yml');
  assert.strictEqual(fs.existsSync(file), false, `${file} should have been deleted`);
});

test('root .gitleaks.toml no longer exists', () => {
  const file = path.join(REPO, '.gitleaks.toml');
  assert.strictEqual(fs.existsSync(file), false, `${file} should have been deleted`);
});

test('.github/workflows/ has no remaining files (an empty/absent directory is fine)', () => {
  const dir = path.join(REPO, '.github', 'workflows');
  if (!fs.existsSync(dir)) {
    return; // absent entirely — satisfies "no remaining files"
  }
  const remaining = fs.readdirSync(dir);
  assert.deepStrictEqual(remaining, [], `.github/workflows/ should be empty, found: ${remaining.join(', ')}`);
});

test('package.json "files" array no longer lists .github/ or .gitleaks.toml', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const leaks = pkg.files.filter((f) => f.startsWith('.github') || f.includes('.gitleaks.toml'));
  assert.deepStrictEqual(leaks, [], `package.json "files" still references removed CI files: ${leaks.join(', ')}`);
});
