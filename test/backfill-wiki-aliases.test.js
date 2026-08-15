#!/usr/bin/env node
// Repeatable checks for lib/scripts/backfill-wiki-aliases.js — the
// repeatable, every-update version of TASK-064's one-time aliases: sweep
// (see wiki/work/tasks/archive/TASK-064-backfill-work-item-aliases.md and
// its regression pin, test/work-item-aliases.test.js).
//
// Zero-dependency: node:test + node:assert only, matching the sibling
// suites. Unlike work-item-aliases.test.js (which asserts on THIS repo's
// own wiki content), this suite exercises the SCRIPT against a disposable
// scratch project dir — it must behave correctly on any project, not just
// this one, since it now runs on every `bootstrap update`.
//
// Run: npm test   (or: node --test test/backfill-wiki-aliases.test.js)

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'lib', 'scripts', 'backfill-wiki-aliases.js');

function scratchProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-wiki-aliases-'));
}

function writeFile(projectDir, relPath, content) {
  const full = path.join(projectDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function readFile(projectDir, relPath) {
  return fs.readFileSync(path.join(projectDir, relPath), 'utf8');
}

function runBackfill(projectDir) {
  const r = spawnSync('node', [SCRIPT, projectDir], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const TASK_NO_ALIASES = [
  '---',
  'id: TASK-901',
  'title: "Example task"',
  'status: todo',
  '---',
  '',
  '# TASK-901 — Example task',
  '',
].join('\n');

test('backfills aliases: [<id>] immediately after the id: line for a file missing it', () => {
  const projectDir = scratchProject();
  writeFile(projectDir, 'wiki/work/tasks/TASK-901-example.md', TASK_NO_ALIASES);

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);

  const text = readFile(projectDir, 'wiki/work/tasks/TASK-901-example.md');
  const lines = text.split('\n');
  assert.strictEqual(lines[1], 'id: TASK-901');
  assert.strictEqual(lines[2], 'aliases: [TASK-901]', `expected aliases: line right after id:, got:\n${text}`);
  // Nothing else in the file should have moved or changed.
  assert.strictEqual(lines[3], 'title: "Example task"');
  assert.ok(text.includes('# TASK-901 — Example task'), 'body content must be preserved untouched');

  cleanup(projectDir);
});

test('is idempotent: a file that already has aliases: (inline form) is left byte-for-byte untouched', () => {
  const projectDir = scratchProject();
  const original = [
    '---',
    'id: TASK-902',
    'aliases: [TASK-902]',
    'title: "Already backfilled"',
    '---',
    '',
    'body',
    '',
  ].join('\n');
  writeFile(projectDir, 'wiki/work/tasks/TASK-902-already.md', original);

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);

  const text = readFile(projectDir, 'wiki/work/tasks/TASK-902-already.md');
  assert.strictEqual(text, original, 'a file already carrying aliases: must not be rewritten at all');

  cleanup(projectDir);
});

test('is idempotent: a file with block-list aliases: is left untouched (no duplicate field added)', () => {
  const projectDir = scratchProject();
  const original = [
    '---',
    'id: TASK-903',
    'aliases:',
    '  - TASK-903',
    'title: "Block form"',
    '---',
    '',
    'body',
    '',
  ].join('\n');
  writeFile(projectDir, 'wiki/work/tasks/TASK-903-block.md', original);

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);

  const text = readFile(projectDir, 'wiki/work/tasks/TASK-903-block.md');
  assert.strictEqual(text, original);

  cleanup(projectDir);
});

test('running the script twice in a row produces no further change on the second run', () => {
  const projectDir = scratchProject();
  writeFile(projectDir, 'wiki/work/bugs/BUG-9001-example.md', [
    '---',
    'id: BUG-9001',
    'title: "Example bug"',
    '---',
    '',
    'body',
    '',
  ].join('\n'));

  const first = runBackfill(projectDir);
  assert.strictEqual(first.status, 0, first.stderr);
  const afterFirst = readFile(projectDir, 'wiki/work/bugs/BUG-9001-example.md');
  assert.ok(afterFirst.includes('aliases: [BUG-9001]'));

  const second = runBackfill(projectDir);
  assert.strictEqual(second.status, 0, second.stderr);
  const afterSecond = readFile(projectDir, 'wiki/work/bugs/BUG-9001-example.md');
  assert.strictEqual(afterSecond, afterFirst, 'second run must not change a file the first run already fixed');
  assert.ok(
    second.stdout.includes('already up to date'),
    `expected an "already up to date" report on the second run, got: ${second.stdout}`
  );

  cleanup(projectDir);
});

test('backfills files inside a family archive/ subdirectory the same as active ones', () => {
  const projectDir = scratchProject();
  writeFile(projectDir, 'wiki/work/uat/archive/UAT-950-archived.md', [
    '---',
    'id: UAT-950',
    'status: passed',
    '---',
    '',
  ].join('\n'));

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);

  const text = readFile(projectDir, 'wiki/work/uat/archive/UAT-950-archived.md');
  assert.ok(text.includes('aliases: [UAT-950]'), `expected archive/ file to be backfilled, got:\n${text}`);

  cleanup(projectDir);
});

test('skips index.md, lifecycle.md, and .gitkeep even when present alongside real work-item files', () => {
  const projectDir = scratchProject();
  const indexContent = '---\nid: should-not-be-touched\n---\n\n# Tasks Index\n';
  writeFile(projectDir, 'wiki/work/tasks/index.md', indexContent);
  writeFile(projectDir, 'wiki/work/tasks/lifecycle.md', indexContent);
  writeFile(projectDir, 'wiki/work/tasks/.gitkeep', '');
  writeFile(projectDir, 'wiki/work/tasks/TASK-904-real.md', TASK_NO_ALIASES.replace('TASK-901', 'TASK-904'));

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);

  assert.strictEqual(readFile(projectDir, 'wiki/work/tasks/index.md'), indexContent, 'index.md must never be touched');
  assert.strictEqual(
    readFile(projectDir, 'wiki/work/tasks/lifecycle.md'),
    indexContent,
    'lifecycle.md must never be touched'
  );
  assert.ok(
    readFile(projectDir, 'wiki/work/tasks/TASK-904-real.md').includes('aliases: [TASK-904]'),
    'the real work-item file alongside them must still be backfilled'
  );

  cleanup(projectDir);
});

test('skips wiki/work/uat/screenshots/ — not a work-item directory', () => {
  const projectDir = scratchProject();
  const screenshotNote = '---\nid: not-a-work-item\n---\n';
  writeFile(projectDir, 'wiki/work/uat/screenshots/notes.md', screenshotNote);

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);

  assert.strictEqual(
    readFile(projectDir, 'wiki/work/uat/screenshots/notes.md'),
    screenshotNote,
    'files under uat/screenshots/ must never be touched'
  );

  cleanup(projectDir);
});

test('never touches wiki/knowledge/ — knowledge-page aliases are curated, not mechanically backfilled', () => {
  const projectDir = scratchProject();
  const knowledgePage = [
    '---',
    'id: some-concept',
    'title: Some Concept',
    'updated: 2026-08-15',
    '---',
    '',
    'body',
    '',
  ].join('\n');
  writeFile(projectDir, 'wiki/knowledge/concepts/some-concept.md', knowledgePage);

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);

  assert.strictEqual(
    readFile(projectDir, 'wiki/knowledge/concepts/some-concept.md'),
    knowledgePage,
    'wiki/knowledge/ must be entirely out of scope for this script'
  );

  cleanup(projectDir);
});

test('covers all 6 work families', () => {
  const projectDir = scratchProject();
  const fixtures = {
    'wiki/work/requirements/REQ-900-x.md': 'id: REQ-900',
    'wiki/work/decisions/0900-x.md': 'id: DEC-0900',
    'wiki/work/roadmaps/ROADMAP-900-x.md': 'id: ROADMAP-900',
    'wiki/work/tasks/TASK-900-x.md': 'id: TASK-900',
    'wiki/work/uat/UAT-900-x.md': 'id: UAT-900',
    'wiki/work/bugs/BUG-9000-x.md': 'id: BUG-9000',
  };
  for (const [relPath, idLine] of Object.entries(fixtures)) {
    writeFile(projectDir, relPath, `---\n${idLine}\n---\n\nbody\n`);
  }

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);

  for (const [relPath, idLine] of Object.entries(fixtures)) {
    const id = idLine.slice('id: '.length);
    const text = readFile(projectDir, relPath);
    assert.ok(text.includes(`aliases: [${id}]`), `${relPath} was not backfilled:\n${text}`);
  }

  cleanup(projectDir);
});

test('does not crash and exits 0 when the project has no wiki/work/ at all', () => {
  const projectDir = scratchProject();

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.toLowerCase().includes('nothing to backfill'), `expected a no-op message, got: ${res.stdout}`);

  cleanup(projectDir);
});

test('exits 0 with a usage note when called with no project-dir argument', () => {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok((r.stderr || '').includes('Usage:'), `expected a usage message on stderr, got: ${r.stderr}`);
});

test('a file with no frontmatter at all is left untouched (not a work-item file)', () => {
  const projectDir = scratchProject();
  const plain = '# Just a markdown file\n\nNo frontmatter here.\n';
  writeFile(projectDir, 'wiki/work/tasks/TASK-905-no-frontmatter.md', plain);

  const res = runBackfill(projectDir);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(readFile(projectDir, 'wiki/work/tasks/TASK-905-no-frontmatter.md'), plain);

  cleanup(projectDir);
});
