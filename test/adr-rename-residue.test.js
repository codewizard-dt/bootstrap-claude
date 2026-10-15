#!/usr/bin/env node
// Static enforcement of the hard rename of the decisions family's skills to the
// ADR names (TASK-0117). Zero-dependency: node:test + node:assert only,
// mirroring the sibling residue suites (test/prd-rename-residue.test.js,
// test/task-create-rename-residue.test.js).
//
// Run: node --test test/adr-rename-residue.test.js
//
// WHY THIS IS TESTED AT ALL. Skills are markdown-as-program: a stale reference
// to an old skill name in a sibling skill, a doc table, a test constant or a
// knowledge page tells an agent to invoke a skill that no longer exists - a
// silent runtime failure. The rename cannot be verified by running anything,
// so this suite pins it: (c) the old skill directories are gone (no redirect
// stub) and the new ones exist with the right frontmatter name, (a) no live
// code/doc scope references the old names, (b) no work item still points at an
// old skill's live path, and (d) the ID-resolution table and adr-create keep
// the current-then-legacy prefix design (ADR new, DEC legacy, one number
// sequence across both).
//
// THE TOKENS. The old names are built from fragments so this file never
// contains the literals; the file is additionally excluded from the sweep by
// path.
//
// NOT MATCHED ON PURPOSE. The bare `DEC-` prefix is legitimate legacy wording
// (the existing DEC-0001 item keeps its ID until the update migration renames
// it), so only the four old skill names are swept, never the prefix. The
// sibling skill owned by another task keeps its name for now (it is renamed
// separately) and must not trip the sweep; the regex is sanity-checked below.
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
//   test/adr-rename-residue.test.js this file
// Work-item files (TASK-/UAT-/ROADMAP-/BUG-/DEC-/REQ-/PRD-/ADR-*) are never part
// of scope (a); scope (b) reads them.
//
// SCOPE (a): the old names (case-insensitive) must not appear anywhere in
//   lib/**, test/**, bin/**, README.md, CLAUDE.md, ELEVATOR_PITCH.md,
//   .serena/memories/**, wiki/knowledge/{concepts,entities}/**,
//   wiki/conventions.md, wiki/work/*/lifecycle.md.
// SCOPE (b): the literal live-path forms `lib/skills/<old>` and `skills/<old>`
//   must not appear in any non-archive wiki/work/** file, so that tackle /
//   uat-walk against an open item still resolves. Scope (b) deliberately
//   re-includes the work-item files that scope (a) leaves out. One exemption:
//   TASK-0117's own file, whose inventory and test-design prose has to quote
//   the old directory paths in order to describe this rename.
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

const SELF = 'test/adr-rename-residue.test.js';

const RENAMES = [
  { oldName: ['decision', 'create'].join('-'), newName: 'adr-create' },
  { oldName: ['decision', 'finalize'].join('-'), newName: 'adr-finalize' },
  { oldName: ['decision', 'walkthrough'].join('-'), newName: 'adr-walkthrough' },
  { oldName: ['decision', 'next'].join('-'), newName: 'adr-next' },
];
const OLD_NAMES = RENAMES.map((r) => r.oldName);
const NEW_NAMES = RENAMES.map((r) => r.newName);

// The token must be exactly one of the four old names.
const OLD_NAME_RE = new RegExp('(?:' + OLD_NAMES.join('|') + ')', 'i');

const SCOPE_B_LITERALS = OLD_NAMES.flatMap((n) => ['lib/skills/' + n, 'skills/' + n]);

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
  /^bin\//,
  /^README\.md$/,
  /^CLAUDE\.md$/,
  /^ELEVATOR_PITCH\.md$/,
  /^\.serena\/memories\//,
  /^wiki\/knowledge\/(concepts|entities)\//,
  /^wiki\/conventions\.md$/,
  /^wiki\/work\/[^/]+\/lifecycle\.md$/,
];

// Scope (b): work items under wiki/work/ (archive/ is already not walked).
const SCOPE_B = /^wiki\/work\//;

// The one work item that narrates this rename and so must quote the old paths.
const NARRATING_ITEM = /^TASK-0117-/;

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

test('sanity: the old-name regex matches the four old names and nothing else', () => {
  for (const name of OLD_NAMES) {
    assert.ok(OLD_NAME_RE.test(`run /${name} now`), `${name} must match`);
    assert.ok(OLD_NAME_RE.test(name.toUpperCase()), `${name} must match case-insensitively`);
  }
  for (const other of ['req-extract-decisions', 'adr-extract', 'wiki-lint', 'decision-group', 'task-create']) {
    assert.ok(!OLD_NAME_RE.test(other), `${other} must not match`);
  }
  for (const newName of NEW_NAMES) {
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

test('(b) no work item points at an old skill live path', () => {
  const files = collect(
    (rel) => SCOPE_B.test(rel) && !NARRATING_ITEM.test(path.posix.basename(rel))
  );
  assert.ok(files.length > 0, 'scope (b) walker matched no files - the sweep is vacuous');
  const hits = findHits(files, (line) => {
    const lower = line.toLowerCase();
    return SCOPE_B_LITERALS.some((lit) => lower.includes(lit));
  });
  assert.deepEqual(hits, [], `work items still citing an old skill path (path:line):\n  ${hits.join('\n  ')}`);
});

test('(d) ID-RESOLUTION decisions row has prefix ADR and lists the legacy DEC prefix', () => {
  const rel = 'lib/skills/_shared/ID-RESOLUTION.md';
  const { idx, line } = lineOf(readRepo(rel), /^\|\s*decisions\s*\|/);
  assert.ok(idx !== -1, `${rel}: no decisions family-table row`);
  const cells = line.split('|').map((c) => c.trim());
  assert.equal(cells[3], '`ADR`', `${rel}:${idx + 1}: prefix cell must be \`ADR\`, got ${cells[3]}`);
  assert.match(cells[4] || '', /legacy[^|]*`DEC`/i, `${rel}:${idx + 1}: Notes must list the legacy \`DEC\` prefix`);
});

test('(d) SKILL-BOILERPLATE decisions row has prefix ADR- and counts legacy DEC-', () => {
  const rel = 'lib/skills/_shared/SKILL-BOILERPLATE.md';
  const { idx, line } = lineOf(readRepo(rel), /^\|\s*decisions\s*\|/);
  assert.ok(idx !== -1, `${rel}: no decisions allocation row`);
  const cells = line.split('|').map((c) => c.trim());
  assert.equal(cells[3], '`ADR-`', `${rel}:${idx + 1}: prefix cell must be \`ADR-\`, got ${cells[3]}`);
  assert.match(line, /legacy `DEC-`/, `${rel}:${idx + 1}: row must say legacy \`DEC-\` filenames are counted`);
});

test('(d) adr-create states the both-prefix number allocation', () => {
  const rel = 'lib/skills/adr-create/SKILL.md';
  const text = readRepo(rel);
  const { idx, line } = lineOf(text, /one number sequence across both prefixes/);
  assert.ok(idx !== -1, `${rel}: no "one number sequence across both prefixes" statement`);
  assert.ok(line.includes('ADR-NNNN-*'), `${rel}:${idx + 1}: allocation must count ADR-NNNN-* filenames`);
  assert.ok(line.includes('DEC-NNNN-*'), `${rel}:${idx + 1}: allocation must count legacy DEC-NNNN-* filenames`);
  assert.ok(line.includes('max(N)+1'), `${rel}:${idx + 1}: allocation must be max(N)+1`);
  for (const needle of ['ADR-NNNN-<group-slug>.md', 'id: ADR-NNNN', 'aliases: [ADR-NNNN]']) {
    assert.ok(text.includes(needle), `${rel}: missing new-item wording ${needle}`);
  }
});
