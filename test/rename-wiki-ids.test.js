#!/usr/bin/env node
// Repeatable checks for lib/scripts/rename-wiki-ids.js — the DEC->ADR /
// REQ->PRD ID rename that `bootstrap migrate` runs on already-migrated wiki
// projects. Exercises the SCRIPT against disposable scratch project dirs.
//
// Run: npm test   (or: node --test test/rename-wiki-ids.test.js)

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'lib', 'scripts', 'rename-wiki-ids.js');

function scratchProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rename-wiki-ids-'));
}

function writeFile(projectDir, relPath, content) {
  const full = path.join(projectDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function readFile(projectDir, relPath) {
  return fs.readFileSync(path.join(projectDir, relPath), 'utf8');
}

function exists(projectDir, relPath) {
  return fs.existsSync(path.join(projectDir, relPath));
}

function run(projectDir, ...flags) {
  const r = spawnSync('node', [SCRIPT, ...flags, projectDir], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function fixture() {
  const p = scratchProject();
  writeFile(p, 'wiki/work/decisions/DEC-0003-wiki-model.md',
    '---\nid: DEC-0003\naliases: [DEC-0003]\nstatus: accepted\n---\n\n# DEC-0003 — Wiki model\n');
  writeFile(p, 'wiki/work/decisions/archive/DEC-0001-old.md',
    '---\nid: DEC-0001\n---\n\n# DEC-0001 — Old\n');
  writeFile(p, 'wiki/work/requirements/REQ-0002-auth.md',
    '---\nid: REQ-0002\naliases: [REQ-0002]\n---\n\n# REQ-0002\n\nREQ-1 users can log in. REQ-2 users can log out.\n');
  writeFile(p, 'wiki/work/tasks/TASK-0009-x.md',
    '---\nid: TASK-0009\n---\n\nimplements::[[DEC-0003#D2]] and derived_from::[[REQ-0002]]\n' +
    'See [DEC-0003 — Wiki model](../decisions/DEC-0003-wiki-model.md).\nNot an ID: DEC-00031, XDEC-0003.\n');
  writeFile(p, 'wiki/log.md', '# Log\n\n## [2026-01-01] ingest | DEC-0003\nOld entry mentions DEC-0003.\n');
  writeFile(p, 'raw/note.md', 'raw mentions DEC-0003\n');
  return p;
}

test('renames files in active dir and archive/, and rewrites references', () => {
  const p = fixture();
  const res = run(p);
  assert.strictEqual(res.status, 0, res.stderr);

  assert.ok(exists(p, 'wiki/work/decisions/ADR-0003-wiki-model.md'));
  assert.ok(exists(p, 'wiki/work/decisions/archive/ADR-0001-old.md'));
  assert.ok(exists(p, 'wiki/work/requirements/PRD-0002-auth.md'));
  assert.ok(!exists(p, 'wiki/work/decisions/DEC-0003-wiki-model.md'));
  assert.ok(!exists(p, 'wiki/work/requirements/REQ-0002-auth.md'));

  const task = readFile(p, 'wiki/work/tasks/TASK-0009-x.md');
  assert.match(task, /implements::\[\[ADR-0003#D2\]\]/);
  assert.match(task, /derived_from::\[\[PRD-0002\]\]/);
  assert.match(task, /\[ADR-0003 — Wiki model\]\(\.\.\/decisions\/ADR-0003-wiki-model\.md\)/);
  cleanup(p);
});

test('does not touch look-alike text, log entries, or raw/', () => {
  const p = fixture();
  run(p);

  const task = readFile(p, 'wiki/work/tasks/TASK-0009-x.md');
  assert.match(task, /DEC-00031, XDEC-0003/);
  assert.match(readFile(p, 'wiki/log.md'), /Old entry mentions DEC-0003\./);
  assert.strictEqual(readFile(p, 'raw/note.md'), 'raw mentions DEC-0003\n');

  const prd = readFile(p, 'wiki/work/requirements/PRD-0002-auth.md');
  assert.match(prd, /REQ-1 users can log in\. REQ-2 users can log out\./, 'unrelated REQ-N labels stay');
  cleanup(p);
});

test('keeps the old ID as an alias, adding aliases when absent', () => {
  const p = fixture();
  run(p);
  assert.match(readFile(p, 'wiki/work/decisions/ADR-0003-wiki-model.md'), /^id: ADR-0003\naliases: \[ADR-0003, DEC-0003\]$/m);
  assert.match(readFile(p, 'wiki/work/decisions/archive/ADR-0001-old.md'), /^id: ADR-0001\naliases: \[ADR-0001, DEC-0001\]$/m);
  assert.match(readFile(p, 'wiki/work/requirements/PRD-0002-auth.md'), /^aliases: \[PRD-0002, REQ-0002\]$/m);
  cleanup(p);
});

test('appends a log entry without editing existing entries', () => {
  const p = fixture();
  run(p);
  const log = readFile(p, 'wiki/log.md');
  assert.ok(log.startsWith('# Log\n\n## [2026-01-01] ingest | DEC-0003\nOld entry mentions DEC-0003.\n'));
  assert.match(log, /## \[\d{4}-\d{2}-\d{2}\] migrate \| renamed DEC→ADR and REQ→PRD IDs/);
  cleanup(p);
});

test('is idempotent: second run has nothing to do and changes nothing', () => {
  const p = fixture();
  run(p);
  const logAfterFirst = readFile(p, 'wiki/log.md');
  const res = run(p);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /nothing to rename/);
  assert.strictEqual(readFile(p, 'wiki/log.md'), logAfterFirst);
  cleanup(p);
});

test('--dry-run reports the plan and changes nothing', () => {
  const p = fixture();
  const res = run(p, '--dry-run');
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /3 file\(s\) would be renamed/);
  assert.ok(exists(p, 'wiki/work/decisions/DEC-0003-wiki-model.md'));
  assert.ok(!exists(p, 'wiki/work/decisions/ADR-0003-wiki-model.md'));
  cleanup(p);
});

test('--count prints only the number of files to rename', () => {
  const p = fixture();
  assert.strictEqual(run(p, '--count').stdout.trim(), '3');
  run(p);
  assert.strictEqual(run(p, '--count').stdout.trim(), '0');
  cleanup(p);
});

test('aborts with exit 1 and changes nothing when a target already exists', () => {
  const p = fixture();
  writeFile(p, 'wiki/work/decisions/ADR-0003-wiki-model.md', '---\nid: ADR-0003\n---\n');
  const res = run(p);
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /rename targets already exist/);
  assert.ok(exists(p, 'wiki/work/decisions/DEC-0003-wiki-model.md'));
  assert.ok(exists(p, 'wiki/work/requirements/REQ-0002-auth.md'), 'no partial rename');
  cleanup(p);
});

test('project with no wiki/ exits 0 with nothing to do', () => {
  const p = scratchProject();
  const res = run(p);
  assert.strictEqual(res.status, 0);
  assert.strictEqual(run(p, '--count').stdout.trim(), '0');
  cleanup(p);
});
