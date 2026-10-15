#!/usr/bin/env node
// Static enforcement of the hard rename of the requirements family's skills to
// the PRD names (TASK-0116). Zero-dependency: node:test + node:assert only,
// mirroring the sibling residue suites (test/bug-create-rename-residue.test.js,
// test/task-create-rename-residue.test.js).
//
// Run: node --test test/prd-rename-residue.test.js
//
// WHY THIS IS TESTED AT ALL. Skills are markdown-as-program: a stale reference
// to an old skill name in a sibling skill, a doc table, a test constant or a
// knowledge page tells an agent to invoke a skill that no longer exists - a
// silent runtime failure. The rename cannot be verified by running anything,
// so this suite pins it: (c) the old skill directories are gone (no redirect
// stub) and the new ones exist with the right frontmatter name, (a) no live
// code/doc scope references the old names, (b) no open work item still points
// at an old skill's live path, and (d) the new-item wording (PRD-NNNN ids) is in
// place while the legacy REQ fallback is still documented.
//
// THE TOKENS. The old names are built from fragments so this file never
// contains the literals; the file is additionally excluded from the sweep by
// path.
//
// NOT MATCHED ON PURPOSE. The two sibling skills owned by other tasks keep their
// names for now (they are renamed separately) and must not trip the sweep; the
// anchored regex is sanity-checked against them below.
//
// EXCLUDED LOCATIONS (immutable or point-in-time records of work done under the
// old names - rewriting would falsify history):
//   .git/, node_modules/            VCS internals and vendored dependencies
//   raw/                            immutable ground-truth sources
//   .docs/                          dated skill scratch/audit reports
//   .serena/cache/                  generated language-server symbol cache
//   wiki/log.md, wiki/log-*.md      append-only operation log
//   wiki/hot.md, wiki/index.md      generated hot cache / historical catalog
//   wiki/knowledge/sources/         frozen summaries of immutable raw/ docs
//   any archive/ directory          terminal work items, frozen on archival
//   wiki/work/*/index.md            family indexes quote item titles verbatim
//   stale-skills.json, prune-stale-skills.js   the installer's stale-skill list
//   test/prd-rename-residue.test.js this file
// Work-item files (TASK-/UAT-/ROADMAP-/BUG-/DEC-/REQ-/PRD-/ADR-*) are never part
// of scope (a); scope (b) reads them, restricted to non-terminal statuses.
//
// SCOPE (a): the old names (case-insensitive) must not appear anywhere in
//   lib/**, test/**, README.md, CLAUDE.md, .serena/memories/**,
//   wiki/knowledge/{concepts,entities}/**, wiki/conventions.md,
//   wiki/work/*/lifecycle.md.
// SCOPE (b): the literal live-path forms `lib/skills/<old>` and `skills/<old>`
//   must not appear in any non-archive wiki/work/** item whose frontmatter
//   status is not terminal, so that tackle/uat-walk against an open item still
//   resolves. Two allowances: this rename's own narrating items (TASK/UAT-0116),
//   and a line that annotates the old path with a `(now \`prd-...\`)` pointer,
//   which already tells the reader where the skill went.
//
// SCOPE - repo-local files only. The machine-local ~/.claude/skills/ copy is
// deliberately not inspected.
//
// HERMETIC: read-only walk of the repo. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');

const SELF = 'test/prd-rename-residue.test.js';

const RENAMES = [
  { oldName: ['req', 'create'].join('-'), newName: 'prd-create' },
  { oldName: ['req', 'finalize'].join('-'), newName: 'prd-finalize' },
  { oldName: ['req', 'compile'].join('-'), newName: 'prd-compile' },
];
const OLD_NAMES = RENAMES.map((r) => r.oldName);

// Anchored so the still-unrenamed siblings never match: the token must be one
// of exactly the three old names, bounded on both sides.
const OLD_NAME_RE = new RegExp('\\b(?:' + OLD_NAMES.join('|') + ')\\b', 'i');

const SCOPE_B_LITERALS = OLD_NAMES.flatMap((n) => ['lib/skills/' + n, 'skills/' + n]);
const NOW_POINTER = '(now `prd-';

// Directory names never descended into, at any depth.
const EXCLUDED_DIR_NAMES = new Set(['.git', 'node_modules', 'archive']);

// Repo-relative directory paths (posix separators) never descended into.
const EXCLUDED_DIR_PATHS = new Set(['raw', '.docs', '.serena/cache', 'wiki/knowledge/sources']);

// Repo-relative files (posix separators) excluded.
const EXCLUDED_FILES = new Set(['wiki/log.md', 'wiki/hot.md', 'wiki/index.md', SELF]);

// Pattern-matched exclusions: rotated logs, per-family indexes, the installer's
// stale-skill list (which legitimately names the removed skills).
const EXCLUDED_PATTERNS = [
  /^wiki\/log-[^/]*\.md$/,
  /^wiki\/work\/[^/]+\/index\.md$/,
  /(^|\/)stale-skills\.json$/,
  /(^|\/)prune-stale-skills\.js$/,
];

// Work-item filenames (never part of scope (a)).
const ITEM_FILE = /^(TASK|UAT|ROADMAP|BUG|DEC|REQ|PRD|ADR)-/;

// Scope (a): live code and docs.
const SCOPE_A = [
  /^lib\//,
  /^test\//,
  /^README\.md$/,
  /^CLAUDE\.md$/,
  /^\.serena\/memories\//,
  /^wiki\/knowledge\/(concepts|entities)\//,
  /^wiki\/conventions\.md$/,
  /^wiki\/work\/[^/]+\/lifecycle\.md$/,
];

// Scope (b): open work items under wiki/work/ (archive/ is already not walked).
const SCOPE_B = /^wiki\/work\//;

// Work items that narrate this rename and so must quote the old paths.
const NARRATING_ITEMS = /^(TASK|UAT)-0116-/;

const TERMINAL_STATUSES = new Set([
  'done',
  'passed',
  'skipped',
  'trashed',
  'closed',
  'wontfix',
  'duplicate',
  'cannot-reproduce',
  'retired',
]);

function isExcludedDir(rel, name) {
  return EXCLUDED_DIR_NAMES.has(name) || EXCLUDED_DIR_PATHS.has(rel);
}

function isExcludedFile(rel) {
  return EXCLUDED_FILES.has(rel) || EXCLUDED_PATTERNS.some((re) => re.test(rel));
}

function* walk(rel) {
  const abs = rel === '' ? REPO : path.join(REPO, ...rel.split('/'));
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const childRel = rel === '' ? ent.name : rel + '/' + ent.name;
    if (ent.isDirectory()) {
      if (isExcludedDir(childRel, ent.name)) continue;
      yield* walk(childRel);
    } else if (ent.isFile()) {
      if (isExcludedFile(childRel)) continue;
      yield { abs: path.join(abs, ent.name), rel: childRel };
    }
  }
}

// Unreadable or binary files (a NUL byte in the buffer) are treated as absent.
function readText(abs) {
  try {
    const buf = fs.readFileSync(abs);
    return buf.includes(0) ? null : buf.toString('utf8');
  } catch {
    return null;
  }
}

// Read the `status:` value from the leading frontmatter block, or null.
function frontmatterStatus(text) {
  if (!/^---\r?\n/.test(text)) return null;
  const end = text.indexOf('\n---', 3);
  const block = end === -1 ? text : text.slice(0, end);
  const m = block.match(/^status:\s*["']?([A-Za-z-]+)["']?\s*$/m);
  return m ? m[1].toLowerCase() : null;
}

function findHits(files, matches) {
  const hits = [];
  for (const { rel, text } of files) {
    text.split('\n').forEach((line, i) => {
      if (matches(line)) hits.push(`${rel}:${i + 1}`);
    });
  }
  return hits;
}

function collect(filter) {
  const out = [];
  for (const { abs, rel } of walk('')) {
    if (!filter(rel)) continue;
    const text = readText(abs);
    if (text === null) continue;
    out.push({ abs, rel, text });
  }
  return out;
}

function readRepo(rel) {
  return fs.readFileSync(path.join(REPO, ...rel.split('/')), 'utf8');
}

function lineOf(text, re) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => re.test(l));
  return { idx, line: idx === -1 ? '' : lines[idx] };
}

test('sanity: the old-name regex is anchored and does not match the unrenamed siblings', () => {
  for (const name of OLD_NAMES) {
    assert.ok(OLD_NAME_RE.test(`run /${name} now`), `${name} must match`);
    assert.ok(OLD_NAME_RE.test(name.toUpperCase()), `${name} must match case-insensitively`);
  }
  for (const other of ['req-retire', 'req-extract-decisions', '/req-retire foo', 'prereq-created', 'req-created']) {
    assert.ok(!OLD_NAME_RE.test(other), `${other} must not match`);
  }
  for (const newName of RENAMES.map((r) => r.newName)) {
    assert.ok(!OLD_NAME_RE.test(newName), `${newName} must not match`);
  }
});

test('(c) old skill directories are gone; each new skill has SKILL.md with name equal to its directory', () => {
  for (const { oldName, newName } of RENAMES) {
    assert.ok(
      !fs.existsSync(path.join(SKILLS, oldName)),
      `lib/skills/${oldName}/ must not exist (hard rename, no stub)`
    );
    const skill = path.join(SKILLS, newName, 'SKILL.md');
    assert.ok(fs.existsSync(skill), `lib/skills/${newName}/SKILL.md must exist`);
    const frontmatter = fs.readFileSync(skill, 'utf8').split(/^---\s*$/m)[1] || '';
    assert.match(
      frontmatter,
      new RegExp('^name:\\s*' + newName + '\\s*$', 'm'),
      `lib/skills/${newName}/SKILL.md frontmatter name must be ${newName}`
    );
  }
});

test('(a) no live code/doc file references an old skill name', () => {
  const files = collect(
    (rel) => SCOPE_A.some((re) => re.test(rel)) && !ITEM_FILE.test(path.posix.basename(rel))
  );
  assert.ok(files.length > 0, 'scope (a) walker matched no files - the sweep is vacuous');
  const hits = findHits(files, (line) => OLD_NAME_RE.test(line));
  assert.deepEqual(hits, [], `stale references to the renamed skills (path:line):\n  ${hits.join('\n  ')}`);
});

test('(b) no open work item points at an old skill live path', () => {
  const files = collect((rel) => {
    if (!SCOPE_B.test(rel)) return false;
    return !NARRATING_ITEMS.test(path.posix.basename(rel));
  }).filter(({ text }) => !TERMINAL_STATUSES.has(frontmatterStatus(text)));
  assert.ok(files.length > 0, 'scope (b) walker matched no files - the sweep is vacuous');
  const hits = findHits(
    files,
    (line) =>
      SCOPE_B_LITERALS.some((lit) => line.toLowerCase().includes(lit)) && !line.includes(NOW_POINTER)
  );
  assert.deepEqual(hits, [], `open work items still citing an old skill path (path:line):\n  ${hits.join('\n  ')}`);
});

test('(d) prd-create documents PRD-NNNN new-item wording and no REQ-NNNN', () => {
  const rel = 'lib/skills/prd-create/SKILL.md';
  const text = readRepo(rel);
  for (const needle of ['PRD-NNNN-slug.md', 'id: PRD-NNNN', 'aliases: [PRD-NNNN]']) {
    assert.ok(text.includes(needle), `${rel}: missing ${needle}`);
  }
  const hits = findHits([{ rel, text }], (line) => line.includes('REQ-NNNN'));
  assert.deepEqual(hits, [], `${rel}: legacy REQ-NNNN wording (path:line):\n  ${hits.join('\n  ')}`);
});

test('(d) both requirements lifecycle copies state ID scheme PRD-NNNN and stay in lockstep', () => {
  const copies = ['wiki/work/requirements/lifecycle.md', 'lib/scripts/templates/wiki/work/requirements/lifecycle.md'];
  const normalized = [];
  for (const rel of copies) {
    const text = readRepo(rel);
    const { idx, line } = lineOf(text, /ID scheme:/);
    assert.ok(idx !== -1, `${rel}: no "ID scheme:" line`);
    assert.match(line, /ID scheme:\s*\*\*PRD-NNNN\*\*/, `${rel}:${idx + 1}: ID scheme must be PRD-NNNN`);
    normalized.push(text.replace(/^updated:.*$/m, 'updated: X'));
  }
  assert.equal(
    normalized[0],
    normalized[1],
    `${copies[0]} and ${copies[1]} differ beyond the frontmatter updated: line`
  );
});

test('(d) ID-RESOLUTION requirements row has prefix PRD and mentions the legacy REQ fallback', () => {
  const rel = 'lib/skills/_shared/ID-RESOLUTION.md';
  const { idx, line } = lineOf(readRepo(rel), /^\|\s*requirements\s*\|/);
  assert.ok(idx !== -1, `${rel}: no requirements family-table row`);
  const cells = line.split('|').map((c) => c.trim());
  assert.equal(cells[3], '`PRD`', `${rel}:${idx + 1}: prefix cell must be \`PRD\`, got ${cells[3]}`);
  assert.match(cells[4] || '', /legacy[^|]*`REQ`/i, `${rel}:${idx + 1}: Notes must mention the legacy \`REQ\` fallback`);
});

test('(d) SKILL-BOILERPLATE requirements row has prefix PRD-', () => {
  const rel = 'lib/skills/_shared/SKILL-BOILERPLATE.md';
  const { idx, line } = lineOf(readRepo(rel), /^\|\s*requirements\s*\|/);
  assert.ok(idx !== -1, `${rel}: no requirements allocation row`);
  const cells = line.split('|').map((c) => c.trim());
  assert.equal(cells[3], '`PRD-`', `${rel}:${idx + 1}: prefix cell must be \`PRD-\`, got ${cells[3]}`);
});
