#!/usr/bin/env node
// Repeatable checks that the /uat-generate skill was fully renamed to
// /uat-create. Zero-dependency: node:test + node:assert/strict + node:fs +
// node:path only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/uat-create-rename.test.js)
//
// Promoted from TASK-0113 (skill rename /uat-generate -> /uat-create): the
// skill directory moved to lib/skills/uat-create/ with no redirect stub, every
// live reference was rewritten, and the pinned tests were updated. This guards
// against the old name creeping back into live text, the directory
// reappearing, or a skill's frontmatter `name:` drifting from its directory.
//
// The preference key `uatGenerate.promoteTests` is deliberately NOT renamed
// (it is a stored-preference identifier, not the skill name), so its presence
// is asserted rather than swept. The residue sweep matches the hyphenated skill
// token /\buat-generate\b/i only, which does not match `uatGenerate`.
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');
const OLD_NAME = /\buat-generate\b/i;

function frontmatterName(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, `${path.relative(REPO, file)} must start with a frontmatter block`);
  const n = m[1].match(/^name:\s*(.+?)\s*$/m);
  assert.ok(n, `${path.relative(REPO, file)} frontmatter must declare name:`);
  return n[1].replace(/^["']|["']$/g, '');
}

test('lib/skills/uat-create/SKILL.md exists with frontmatter name: uat-create', () => {
  const file = path.join(SKILLS, 'uat-create', 'SKILL.md');
  assert.ok(fs.existsSync(file), `${file} should exist`);
  assert.equal(frontmatterName(file), 'uat-create');
});

test('lib/skills/uat-generate no longer exists (no redirect stub)', () => {
  const dir = path.join(SKILLS, 'uat-generate');
  assert.equal(fs.existsSync(dir), false, `${dir} should have been removed`);
});

test('every lib/skills/*/SKILL.md name: equals its directory name', () => {
  const mismatches = [];
  for (const ent of fs.readdirSync(SKILLS, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name === '_shared') continue;
    const file = path.join(SKILLS, ent.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const name = frontmatterName(file);
    if (name !== ent.name) mismatches.push(`${ent.name}/SKILL.md declares name: ${name}`);
  }
  assert.deepEqual(mismatches, [], `skill name/directory mismatches:\n${mismatches.join('\n')}`);
});

for (const rel of [
  'lib/scripts/templates/bootstrap-prefs-schema.json',
  'lib/scripts/install-global.sh',
  'lib/skills/uat-create/SKILL.md',
]) {
  test(`uatGenerate.promoteTests is still present in ${rel}`, () => {
    const text = fs.readFileSync(path.join(REPO, rel), 'utf8');
    assert.ok(text.includes('uatGenerate.promoteTests'), `${rel} lost uatGenerate.promoteTests`);
  });
}

// Skipped directories (by basename, or by repo-relative prefix).
const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.claude']);
const SKIP_DIR_PATHS = new Set(['.serena/cache']);
const MAX_BYTES = 1024 * 1024;

// Files that may legitimately still contain the old name. Everything else is
// live text and must be clean. Do not widen this list to hide a live hit.
const ALLOWLIST = [
  // Append-only operation log and its rotated archives.
  /^wiki\/log\.md$/,
  /^wiki\/log-[^/]*\.md$/,
  // raw/ is immutable ground truth (includes raw/guides/command-anti-patterns.md).
  /^raw\//,
  // Refreshed verbatim from raw/guides/command-anti-patterns.md by sync-wiki-scaffold.sh.
  /^wiki\/guides\/command-anti-patterns\.md$/,
  // Terminal records under any archive/ directory.
  /(^|\/)archive\//,
  // Work records quoting the old name as it was (includes TASK-0113 itself).
  /^wiki\/work\/tasks\/TASK-[^/]*$/,
  /^wiki\/work\/uat\/UAT-[^/]*$/,
  // Active index rows quote old names in task/UAT titles.
  /^wiki\/work\/tasks\/index\.md$/,
  /^wiki\/work\/uat\/index\.md$/,
  // ROADMAP-0014 names the old skill.
  /^wiki\/work\/roadmaps\//,
  // Per-source snapshots of ingested raw documents.
  /^wiki\/knowledge\/sources\//,
  // Dated commit-history narrative.
  /^wiki\/knowledge\/concepts\/wiki-work-filename-convention\.md$/,
  // This test file necessarily spells the old name.
  /^test\/uat-create-rename\.test\.js$/,
];

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    const rel = path.relative(REPO, abs).split(path.sep).join('/');
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name) || SKIP_DIR_PATHS.has(rel)) continue;
      yield* walk(abs);
    } else if (ent.isFile()) {
      yield { abs, rel };
    }
  }
}

test('residue sweep: no live file mentions uat-generate', () => {
  const offenders = [];
  for (const { abs, rel } of walk(REPO)) {
    if (ALLOWLIST.some((re) => re.test(rel))) continue;
    if (fs.statSync(abs).size > MAX_BYTES) continue;
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) continue;
    buf
      .toString('utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (OLD_NAME.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
  }
  assert.deepEqual(offenders, [], `live files still mention uat-generate:\n${offenders.join('\n')}`);
});

function readRepo(rel) {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

test('skill header: description leads with Create, H1 is UAT Creator, other frontmatter kept', () => {
  const text = readRepo('lib/skills/uat-create/SKILL.md');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
  assert.match(fm, /^description:\s*Create UAT tests in wiki\/work\/uat\/ for a task\s*$/m);
  for (const key of ['category', 'model', 'argument-hint', 'disable-model-invocation', 'user-invocable']) {
    assert.match(fm, new RegExp(`^${key}:`, 'm'), `frontmatter lost ${key}:`);
  }
  assert.match(text, /^# UAT Creator$/m, 'H1 must read "# UAT Creator"');
  assert.doesNotMatch(text, /^# UAT Generator$/m, 'old H1 must be gone');
});

test('preference key is a real schema key and its prose names /uat-create', () => {
  const schema = JSON.parse(readRepo('lib/scripts/templates/bootstrap-prefs-schema.json'));
  assert.ok('uatGenerate.promoteTests' in schema, 'schema key uatGenerate.promoteTests must remain');
  assert.equal(schema['uatGenerate.promoteTests'].summary, 'Where /uat-create writes the unit tests it promotes out of UAT cases');
  assert.ok(readRepo('lib/scripts/install-global.sh').includes('Where should /uat-create write the unit tests'));
});

test('uat lifecycle template and local copy both say pending is created by /uat-create', () => {
  for (const rel of ['lib/scripts/templates/wiki/work/uat/lifecycle.md', 'wiki/work/uat/lifecycle.md']) {
    assert.ok(readRepo(rel).includes('created by `/uat-create`'), `${rel} must say "created by \`/uat-create\`"`);
  }
});

test('pipeline pointers in tackle, roadmap-next, task-create, UAT-CORE, docs name /uat-create', () => {
  const expectations = {
    'lib/skills/tackle/SKILL.md': '/uat-create wiki/work/tasks/',
    'lib/skills/roadmap-next/SKILL.md': '/uat-create <task_path>',
    'lib/skills/task-create/SKILL.md': '/uat-create TASK-NNNN',
    'lib/skills/uat-walk/UAT-CORE.md': '/tackle → /uat-create →',
    'lib/skills/_shared/ID-RESOLUTION.md': '`uat-skip`, `uat-create`',
    'lib/skills/README.md': '| `uat-create` | Create UAT tests',
    'CLAUDE.md': '| `/uat-create <target>` | Create UAT tests',
  };
  const missing = Object.entries(expectations)
    .filter(([rel, needle]) => !readRepo(rel).includes(needle))
    .map(([rel, needle]) => `${rel} lacks ${needle}`);
  assert.deepEqual(missing, [], missing.join('\n'));
});
