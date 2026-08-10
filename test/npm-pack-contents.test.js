#!/usr/bin/env node
// Repeatable checks on the published tarball's file listing (npm pack --dry-run).
// Zero-dependency: node:test + node:assert only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/)
//
// Promoted from UAT-038 (TASK-038 step 5, ROADMAP-004 release gate): the
// hooks-wiring artifacts must ship in the tarball, and the /research and
// /research-company landing zones (raw/research/, raw/companies/) plus raw
// PDFs must never leak into it — the leak was real before commit 99fbba's
// `files` negations, so this guards the `package.json` "files" field against
// regression. Extended by ROADMAP-005 to cover the bootstrap-prefs runtime
// artifacts (helper + schema), which install-global.sh copies into ~/.claude/.
// Dry-run only: nothing is written to the repo or the registry.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

// One pack per suite run; --json puts the full file listing on stdout.
const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: REPO,
  encoding: 'utf8',
});

test('npm pack --dry-run succeeds and reports a file listing', () => {
  assert.strictEqual(result.status, 0, `npm pack failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.ok(Array.isArray(parsed) && parsed.length === 1, 'expected a single-tarball JSON report');
  assert.ok(Array.isArray(parsed[0].files) && parsed[0].files.length > 0, 'expected a non-empty files array');
});

function packedPaths() {
  return JSON.parse(result.stdout)[0].files.map((f) => f.path);
}

test('tarball ships the runtime artifacts a consumer install depends on', () => {
  const files = packedPaths();
  for (const required of [
    'lib/scripts/templates/settings-hooks.json',
    'lib/scripts/merge-settings-hooks.js',
    'lib/scripts/templates/settings-deny.json',
    'lib/scripts/merge-settings-deny.js',
    // install-global.sh step 6 installs these to ~/.claude/bootstrap-prefs.js
    // and ~/.claude/templates/bootstrap-prefs-schema.json. A missing file is
    // invisible in-repo (the sources are right there) and only breaks
    // `npx @codewizard-dt/bootstrap install` for consumers.
    'lib/scripts/bootstrap-prefs.js',
    'lib/scripts/templates/bootstrap-prefs-schema.json',
  ]) {
    assert.ok(files.includes(required), `tarball is missing ${required}`);
  }
});

test('tarball leaks nothing from raw/research/, raw/companies/, or raw PDFs', () => {
  const leaks = packedPaths().filter(
    (p) => p.startsWith('raw/research/') || p.startsWith('raw/companies/') || /\.pdf$/i.test(p)
  );
  assert.deepStrictEqual(leaks, [], `landing-zone/PDF leakage into the tarball: ${leaks.join(', ')}`);
});
