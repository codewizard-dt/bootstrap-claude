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

// Promoted from UAT-084 (TASK-084, ROADMAP-010): the knowledge-base summary
// page for the (now-removed) harness must carry a retirement callout rather
// than silently going stale, and its wiki/index.md entry must flag it too.

test('docker-fresh-machine-test-harness.md carries a retirement callout', () => {
  const page = path.join(
    REPO,
    'wiki',
    'knowledge',
    'sources',
    'docker-fresh-machine-test-harness.md'
  );
  const contents = fs.readFileSync(page, 'utf8');
  assert.match(
    contents,
    /> \*\*Retired \(2026-09-04\):\*\* The Docker fresh-machine harness this page describes was removed entirely/,
    'docker-fresh-machine-test-harness.md must carry the retirement callout'
  );
});

test('wiki/index.md marks the Docker harness source page as retired', () => {
  const indexFile = path.join(REPO, 'wiki', 'index.md');
  const contents = fs.readFileSync(indexFile, 'utf8');
  const line = contents
    .split('\n')
    .find((l) => l.includes('docker-fresh-machine-test-harness.md'));
  assert.ok(line, 'wiki/index.md must still list the Docker harness source page');
  assert.match(
    line,
    /\(retired\)/,
    'wiki/index.md entry for the Docker harness source page must be marked (retired)'
  );
});

// Promoted from UAT-083 (TASK-083, ROADMAP-010): ROADMAP-009 must be closed
// as `done` with an explicit reverted-not-completed Notes entry (not a silent
// success), archived out of the active roadmaps directory, and reflected in
// both the active and archive roadmap indexes.

test('ROADMAP-009 file lives under wiki/work/roadmaps/archive/, not the active directory', () => {
  const activePath = path.join(
    REPO,
    'wiki',
    'work',
    'roadmaps',
    'ROADMAP-009-docker-fresh-machine-harness.md'
  );
  const archivedPath = path.join(
    REPO,
    'wiki',
    'work',
    'roadmaps',
    'archive',
    'ROADMAP-009-docker-fresh-machine-harness.md'
  );
  assert.strictEqual(
    fs.existsSync(activePath),
    false,
    'ROADMAP-009 must not remain in the active wiki/work/roadmaps/ directory'
  );
  assert.strictEqual(
    fs.existsSync(archivedPath),
    true,
    'ROADMAP-009 must exist under wiki/work/roadmaps/archive/'
  );
});

test('ROADMAP-009 frontmatter is status: done and carries the reverted-not-completed Notes entry', () => {
  const archivedPath = path.join(
    REPO,
    'wiki',
    'work',
    'roadmaps',
    'archive',
    'ROADMAP-009-docker-fresh-machine-harness.md'
  );
  const contents = fs.readFileSync(archivedPath, 'utf8');
  assert.match(
    contents,
    /^status: done$/m,
    'ROADMAP-009 frontmatter must be status: done'
  );
  assert.match(
    contents,
    /\*\*2026-09-04\*\*: The Docker fresh-machine harness this roadmap built was fully removed per \[\[ROADMAP-010\]\][\s\S]*?This roadmap is closed as `done` because every checklist item was in fact completed and verified at the time, not because the harness survives — see ROADMAP-010 for the reversal\./,
    'ROADMAP-009 must carry the explicit reverted-not-completed Notes entry'
  );
});

test('wiki/work/roadmaps/index.md no longer has an active-item row for ROADMAP-009', () => {
  const indexFile = path.join(REPO, 'wiki', 'work', 'roadmaps', 'index.md');
  const contents = fs.readFileSync(indexFile, 'utf8');
  // ROADMAP-010's own row legitimately mentions "ROADMAP-009" in its summary
  // prose, so assert on the absence of ROADMAP-009's own list-entry link
  // (its slugged filename), not a bare substring match on the ID.
  assert.doesNotMatch(
    contents,
    /ROADMAP-009-docker-fresh-machine-harness\.md/,
    'wiki/work/roadmaps/index.md (active items only) must not have a row linking ROADMAP-009\'s file'
  );
});

test('wiki/work/roadmaps/archive/index.md lists ROADMAP-009 as done', () => {
  const archiveIndex = path.join(REPO, 'wiki', 'work', 'roadmaps', 'archive', 'index.md');
  const contents = fs.readFileSync(archiveIndex, 'utf8');
  const line = contents.split('\n').find((l) => l.includes('[[ROADMAP-009]]'));
  assert.ok(line, 'wiki/work/roadmaps/archive/index.md must list ROADMAP-009');
  assert.match(line, /\| done \|/, 'ROADMAP-009 archive index row must show Final Status = done');
  assert.match(
    line,
    /\| 2026-09-04 \|/,
    'ROADMAP-009 archive index row must show Archived = 2026-09-04'
  );
});
