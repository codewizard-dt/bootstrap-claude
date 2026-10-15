#!/usr/bin/env node
// Static enforcement of the hard rename of the requirements-extraction skill to
// adr-extract and its re-homing as an ADR-side skill (TASK-0118). Zero-dependency:
// node:test + node:assert only, mirroring the sibling residue suites
// (test/adr-rename-residue.test.js, test/prd-rename-residue.test.js).
//
// Run: node --test test/adr-extract-rename-residue.test.js
//
// WHY THIS IS TESTED AT ALL. Skills are markdown-as-program: a stale reference to
// a skill that no longer exists in a sibling skill, a doc table, a test constant
// or a memory page tells an agent to invoke a missing skill - a silent runtime
// failure. The rename cannot be verified by running anything, so this suite pins
// it: (c) the old directory is gone (no redirect stub) and the new one exists with
// the right frontmatter name, (a) no live code/doc scope references the old name,
// and (d) the new SKILL.md keeps the ASR machinery while carrying the PRD-mode /
// document-mode semantics.
//
// THE TOKENS. The old name and the other skills' old names are built from
// fragments so this file never contains the literals (sibling residue suites
// sweep test/** for them); the file is additionally excluded by path.
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
//   work-item files (TASK-/UAT-/ROADMAP-/BUG-/DEC-/REQ-*) under wiki/work/
//                                   bodies quote the old name as history
//   lib/scripts/install-global.sh   the installer's stale-skill list legitimately
//                                   names removed skills (owned by the prune task)
//   stale-skills.json, prune-stale-skills.js   the same list, once data-driven
//   test/adr-rename-residue.test.js, test/prd-rename-residue.test.js
//                                   sibling residue suites keep the old name as a
//                                   "must not match" fixture in their regex sanity
//                                   checks
//   test/adr-extract-rename-residue.test.js   this file
//
// SCOPE (a): the old name (case-insensitive) must not appear anywhere in
//   lib/**, test/**, bin/**, README.md, CLAUDE.md, ELEVATOR_PITCH.md,
//   .serena/memories/**, wiki/knowledge/{concepts,entities}/**,
//   wiki/conventions.md, wiki/work/*/lifecycle.md.
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

const SELF = 'test/adr-extract-rename-residue.test.js';

const OLD_NAME = ['req', 'extract', 'decisions'].join('-');
const NEW_NAME = 'adr-extract';

const OLD_NAME_RE = new RegExp(OLD_NAME, 'i');

// Directory names never descended into, at any depth.
const EXCLUDED_DIR_NAMES = new Set(['.git', 'node_modules', 'archive']);

// Repo-relative directory paths (posix separators) never descended into.
const EXCLUDED_DIR_PATHS = new Set(['raw', '.docs', '.serena/cache', 'wiki/knowledge/sources']);

// Repo-relative files (posix separators) excluded.
const EXCLUDED_FILES = new Set([
  'wiki/log.md',
  'wiki/hot.md',
  'wiki/index.md',
  'lib/scripts/install-global.sh',
  'test/adr-rename-residue.test.js',
  'test/prd-rename-residue.test.js',
  SELF,
]);

// Pattern-matched exclusions: rotated logs, per-family indexes, the installer's
// stale-skill list once it becomes a data file.
const EXCLUDED_PATTERNS = [
  /^wiki\/log-[^/]*\.md$/,
  /^wiki\/work\/[^/]+\/index\.md$/,
  /(^|\/)stale-skills\.json$/,
  /(^|\/)prune-stale-skills\.js$/,
];

// Work-item filenames (never part of the sweep scope).
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

const SKILL_REL = `lib/skills/${NEW_NAME}/SKILL.md`;

function skillText() {
  return fs.readFileSync(path.join(REPO, ...SKILL_REL.split('/')), 'utf8');
}

function frontmatterOf(text) {
  return text.split(/^---\s*$/m)[1] || '';
}

test('sanity: the old-name regex matches the old name and not the new one or its siblings', () => {
  assert.ok(OLD_NAME_RE.test(`run /${OLD_NAME} now`), 'old name must match');
  assert.ok(OLD_NAME_RE.test(OLD_NAME.toUpperCase()), 'old name must match case-insensitively');
  for (const other of [NEW_NAME, 'adr-create', 'prd-finalize', 'wiki-lint', 'task-create']) {
    assert.ok(!OLD_NAME_RE.test(other), `${other} must not match`);
  }
});

test('(c) old skill directory is gone; adr-extract has SKILL.md with name equal to its directory', () => {
  assert.ok(
    !fs.existsSync(path.join(SKILLS, OLD_NAME)),
    `lib/skills/${OLD_NAME}/ must not exist (hard rename, no stub)`
  );
  assert.ok(fs.existsSync(path.join(REPO, ...SKILL_REL.split('/'))), `${SKILL_REL} must exist`);
  assert.match(
    frontmatterOf(skillText()),
    new RegExp('^name:\\s*' + NEW_NAME + '\\s*$', 'm'),
    `${SKILL_REL} frontmatter name must be ${NEW_NAME}`
  );
});

test('(a) no live code/doc file references the old skill name', () => {
  const files = collect(
    (rel) => SCOPE_A.some((re) => re.test(rel)) && !ITEM_FILE.test(path.posix.basename(rel))
  );
  assert.ok(files.length > 0, 'scope (a) walker matched no files - the sweep is vacuous');
  const hits = findHits(files, (line) => OLD_NAME_RE.test(line));
  assert.deepEqual(hits, [], `stale references to the renamed skill (path:line):\n  ${hits.join('\n  ')}`);
});

// ---------------------------------------------------------------------------
// (d) Content assertions: the new semantics are present and the ASR machinery
// is preserved.
// ---------------------------------------------------------------------------

test('(d) frontmatter advertises PRD and document sources', () => {
  const fm = frontmatterOf(skillText());
  const description = (fm.match(/^description:\s*(.*)$/m) || [])[1] || '';
  const hint = (fm.match(/^argument-hint:\s*(.*)$/m) || [])[1] || '';
  assert.match(description, /PRD/, `${SKILL_REL}: description must mention PRD`);
  assert.match(description, /document/, `${SKILL_REL}: description must mention document`);
  assert.match(hint, /document/, `${SKILL_REL}: argument-hint must mention document`);
});

test('(d) body defines PRD mode and document mode', () => {
  const text = skillText();
  assert.match(text, /PRD mode/, 'body must define PRD mode');
  assert.match(text, /[Dd]ocument mode/, 'body must define document mode');
});

test('(d) exactly one ID-RESOLUTION wiring line, for requirements/active', () => {
  const matches = [...skillText().matchAll(/ID-RESOLUTION\.md — family: ([a-z]+) · scope: (\S+)/g)];
  assert.equal(matches.length, 1, 'expected exactly one ID-RESOLUTION wiring line');
  assert.deepEqual([matches[0][1], matches[0][2]], ['requirements', 'active']);
});

test('(d) PRD mode keeps the approved gate', () => {
  const text = skillText();
  assert.match(text, /\| `approved` \| Continue to Step 3 \|/, 'status gate table must continue on approved');
  assert.match(text, /Refuse to run on a PRD not in `approved` status/, 'CRITICAL rule 1 must gate on approved');
});

test('(d) ASR extraction machinery is preserved', () => {
  const text = skillText();
  for (const marker of [
    'Architecturally Significant Requirements',
    'ASR#',
    'Boundary enforcement',
    'Tag overlap on the decision block',
  ]) {
    assert.ok(text.includes(marker), `${SKILL_REL}: missing ASR machinery marker "${marker}"`);
  }
  assert.match(text, /\| 1 \| Tag overlap on the decision block \|/, 'Tier 1 tag-overlap row must remain');
});

test('(d) back-link is Source PRD with a legacy Source REQ idempotency clause', () => {
  const text = skillText();
  assert.match(text, /- Source PRD: \[PRD-NNNN\]\(\.\.\/requirements\/PRD-NNNN-slug\.md\)/, 'missing Source PRD back-link');
  assert.match(text, /legacy `Source REQ:` line/, 'missing legacy Source REQ idempotency clause');
});

test('(d) emits /adr-create next actions and the adr-extract log line', () => {
  const text = skillText();
  assert.match(text, /\/adr-create group: /, 'missing /adr-create next-action command');
  assert.match(text, /## \[YYYY-MM-DD\] adr-extract \|/, 'missing adr-extract log line');
});

test('(d) body no longer names the old sibling skills', () => {
  const text = skillText();
  const stale = [
    ['decision', 'create'],
    ['req', 'finalize'],
    ['req', 'create'],
  ].map((parts) => '/' + parts.join('-'));
  for (const name of stale) {
    assert.ok(!text.includes(name), `${SKILL_REL}: must not contain ${name}`);
  }
});
