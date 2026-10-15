#!/usr/bin/env node
// Contract checks for TASK-0115: the /req-update and /task-update skills were
// removed with no replacement. Zero-dependency: node:test + node:assert only.
//
// Run: node --test test/req-task-update-removed.test.js
//
// WHY A DOC-ONLY REMOVAL IS PINNED. The SKILL.md markdown IS the program a
// future agent executes, and skills are discovered by directory name. A removal
// that lives only in the deleted directories is fragile: a stale doc row, a
// wiring line, a hook rule, or a re-synced directory would silently resurrect a
// skill that no longer exists (a command table advertising /req-update, a
// script wiring a deleted skill). This suite fails when either directory
// reappears or any tracked doc/wiring under lib/, README.md, or CLAUDE.md still
// names either skill.
//
// EXCLUDED: lib/scripts/install-global.sh legitimately names both skills — it
// lists them as orphans to clean out of ~/.claude/skills/ (TASK-0122).
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');
const REMOVED = ['req-update', 'task-update'];
const PATTERN = /req-update|task-update/;

const EXCLUDED = new Set([path.join(REPO, 'lib', 'scripts', 'install-global.sh')]);
const IGNORED_DIRS = new Set(['node_modules', '.git']);
const ROOT_DOCS = [
  path.join(REPO, 'README.md'),
  path.join(REPO, 'CLAUDE.md'),
];

function collectFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) collectFiles(full, out);
    } else if (entry.isFile() && !EXCLUDED.has(full)) {
      out.push(full);
    }
  }
  return out;
}

for (const name of REMOVED) {
  test(`lib/skills/${name} does not exist`, () => {
    assert.ok(!fs.existsSync(path.join(SKILLS, name)), `lib/skills/${name} must stay removed`);
  });
}

test('no file under lib/, README.md, CLAUDE.md, or lib/skills/README.md mentions req-update or task-update', () => {
  const files = [
    ...collectFiles(path.join(REPO, 'lib'), []),
    ...ROOT_DOCS.filter((p) => fs.existsSync(p)),
  ];
  assert.ok(files.length > 0, 'scan must cover at least one file');
  const offenders = files
    .filter((p) => PATTERN.test(fs.readFileSync(p, 'utf8')))
    .map((p) => path.relative(REPO, p))
    .sort();
  assert.deepEqual(offenders, [], `stale references to removed skills in: ${offenders.join(', ')}`);
});
