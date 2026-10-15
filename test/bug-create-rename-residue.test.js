#!/usr/bin/env node
// Static enforcement of the hard rename of the old file-named bug skill to
// `bug-create` (TASK-0114). Zero-dependency: node:test + node:assert only,
// mirroring the sibling residue suite (test/task-create-rename-residue.test.js).
//
// Run: node --test test/bug-create-rename-residue.test.js
//
// WHY THIS IS TESTED AT ALL. Skills are markdown-as-program: a stale reference
// to the old skill name in a sibling skill, a doc table, a test constant or a
// knowledge page tells an agent to invoke a skill that no longer exists - a
// silent runtime failure. The rename cannot be verified by running anything,
// so this suite pins it: (1) the old skill directory is gone (no redirect
// stub) and the new one exists with the right frontmatter name, (2) no live
// code/doc scope references the old name, and (3) no open work item still
// points at the old skill's live path.
//
// THE TOKEN. The old name is built from fragments so this file never contains
// the literal; the file is additionally excluded from the sweep by path.
//
// RETAINED ON PURPOSE (not residue). Two task-slug-derived identifiers keep the
// old token because IDs and slugs are stable identifiers (wiki conventions:
// link by ID/alias, never re-slug) and open UATs cite the two test filenames:
//   uat-fail-offers-<token>   (TASK-0086 / UAT-0086 slug, its test file)
//   <token>-status-open       (TASK-0095 / UAT-0095 slug, its test file)
// These are blanked from each file's text before the sweep runs.
//
// EXCLUDED LOCATIONS (immutable or point-in-time records of work done under the
// old name - rewriting would falsify history):
//   .git/, node_modules/            VCS internals and vendored dependencies
//   raw/                            immutable ground-truth sources
//   .docs/                          dated skill scratch/audit reports
//   .serena/cache/                  generated language-server symbol cache
//   wiki/log.md, wiki/log-*.md      append-only operation log
//   wiki/hot.md, wiki/index.md      generated hot cache / historical catalog
//   wiki/knowledge/sources/         frozen summaries of immutable raw/ docs
//   any archive/ directory          terminal work items, frozen on archival
//   wiki/work/*/index.md            family indexes quote item titles verbatim
//   test/bug-create-rename-residue.test.js   this file
//
// SCOPE (a): the old name (case-insensitive) must not appear anywhere in
//   lib/**, test/**, README.md, CLAUDE.md, .serena/memories/**,
//   wiki/knowledge/{concepts,entities}/**, wiki/conventions.md,
//   wiki/work/*/lifecycle.md.
// SCOPE (b): the literal live-path forms `lib/skills/<token>` and
//   `skills/<token>` must not appear in any non-archive wiki/work/** file, so
//   that tackle/uat-walk against an open item still resolves. Work items whose
//   frontmatter status is terminal, and the rename's own narrating items
//   (TASK/UAT-0114 and -0115), are excluded - they necessarily quote the old
//   path as history.
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

const OLD_NAME = 'bug' + '-file';
const SELF = 'test/bug-create-rename-residue.test.js';

// Retained task-slug identifiers, blanked before matching (case-insensitive).
const RETAINED_SLUGS = new RegExp(
  ['uat-fail-offers-' + OLD_NAME, OLD_NAME + '-status-open'].join('|'),
  'gi'
);
const OLD_NAME_RE = new RegExp(OLD_NAME, 'i');

// Directory names never descended into, at any depth.
const EXCLUDED_DIR_NAMES = new Set(['.git', 'node_modules', 'archive']);

// Repo-relative directory paths (posix separators) never descended into.
const EXCLUDED_DIR_PATHS = new Set(['raw', '.docs', '.serena/cache', 'wiki/knowledge/sources']);

// Repo-relative files (posix separators) excluded.
const EXCLUDED_FILES = new Set(['wiki/log.md', 'wiki/hot.md', 'wiki/index.md', SELF]);

// Pattern-matched exclusions: rotated log archives and per-family indexes.
const EXCLUDED_PATTERNS = [/^wiki\/log-[^/]*\.md$/, /^wiki\/work\/[^/]+\/index\.md$/];

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
const SCOPE_B_LITERALS = ['lib/skills/' + OLD_NAME, 'skills/' + OLD_NAME];

// Work items that narrate the rename itself and so must quote the old path.
const NARRATING_ITEMS = /^(TASK|UAT)-(0114|0115)-/;

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
    const cleaned = text.replace(RETAINED_SLUGS, '');
    cleaned.split('\n').forEach((line, i) => {
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

test('old skill directory is gone; lib/skills/bug-create/SKILL.md exists with name: bug-create', () => {
  assert.ok(
    !fs.existsSync(path.join(SKILLS, OLD_NAME)),
    'the old skill directory must not exist (hard rename, no stub)'
  );
  const skill = path.join(SKILLS, 'bug-create', 'SKILL.md');
  assert.ok(fs.existsSync(skill), 'lib/skills/bug-create/SKILL.md must exist');
  const frontmatter = fs.readFileSync(skill, 'utf8').split(/^---\s*$/m)[1] || '';
  assert.match(frontmatter, /^name:\s*bug-create\s*$/m, 'frontmatter name must be bug-create');
});

test('scope (a): no live code/doc file references the old skill name', () => {
  const files = collect((rel) => SCOPE_A.some((re) => re.test(rel)));
  assert.ok(files.length > 0, 'scope (a) walker matched no files - the sweep is vacuous');
  const hits = findHits(files, (line) => OLD_NAME_RE.test(line));
  assert.deepEqual(hits, [], `stale references to the renamed skill:\n  ${hits.join('\n  ')}`);
});

test('scope (b): no open work item points at the old skill live path', () => {
  const files = collect((rel) => {
    if (!SCOPE_B.test(rel)) return false;
    return !NARRATING_ITEMS.test(path.posix.basename(rel));
  }).filter(({ text }) => !TERMINAL_STATUSES.has(frontmatterStatus(text)));
  assert.ok(files.length > 0, 'scope (b) walker matched no files - the sweep is vacuous');
  const hits = findHits(files, (line) => SCOPE_B_LITERALS.some((lit) => line.includes(lit)));
  assert.deepEqual(hits, [], `open work items still citing the old skill path:\n  ${hits.join('\n  ')}`);
});
