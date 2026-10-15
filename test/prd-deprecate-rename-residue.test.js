#!/usr/bin/env node
// Static enforcement of the hard rename of the old requirements retire skill to
// `prd-deprecate` (TASK-0119). Zero-dependency: node:test + node:assert only,
// mirroring test/bug-create-rename-residue.test.js.
//
// Run: node --test test/prd-deprecate-rename-residue.test.js
//
// WHY THIS IS TESTED. A stale reference to the old skill name in a sibling
// skill, doc table, test constant or knowledge page tells an agent to invoke a
// skill that no longer exists - a silent runtime failure. This suite pins that
// (1) the old skill directory is gone (no redirect stub) and the two deprecate
// skills exist with the right frontmatter name, (2) no live code/doc scope names
// the old skill, and (3) no non-excluded file cites its live path.
//
// THE TOKEN. The old name is built from fragments so this file never contains
// the literal; the file is additionally excluded from the sweep by path.
//
// ALLOWLIST. Two files legitimately keep the old token and are allowlisted by
// exact path plus a distinguishing line fragment (see ALLOWED_MENTIONS): a
// knowledge page that narrates the rename and resolved historical notes, and a
// sibling residue test that uses the old name as a negative example.
//
// EXCLUDED LOCATIONS (immutable or point-in-time records):
//   .git/, node_modules/, raw/, .docs/, .serena/cache/, any archive/ directory,
//   wiki/log.md and wiki/log-*.md, wiki/hot.md, wiki/index.md,
//   wiki/knowledge/sources/, wiki/work/*/index.md, the historical work-item
//   files wiki/work/<family>/{TASK,UAT,ROADMAP,BUG,DEC,REQ}-*.md, and this file.
//
// HERMETIC: read-only walk of the repo. No subprocess, no git, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');

const OLD_NAME = 'req' + '-retire';
const SELF = 'test/prd-deprecate-rename-residue.test.js';
const OLD_NAME_RE = new RegExp(OLD_NAME, 'i');

const EXCLUDED_DIR_NAMES = new Set(['.git', 'node_modules', 'archive']);
const EXCLUDED_DIR_PATHS = new Set(['raw', '.docs', '.serena/cache', 'wiki/knowledge/sources']);
const EXCLUDED_FILES = new Set(['wiki/log.md', 'wiki/hot.md', 'wiki/index.md', SELF]);
const EXCLUDED_PATTERNS = [
  /^wiki\/log-[^/]*\.md$/,
  /^wiki\/work\/[^/]+\/index\.md$/,
  /^wiki\/work\/(tasks|uat|roadmaps|bugs|decisions|requirements)\/(TASK|UAT|ROADMAP|BUG|DEC|REQ)-[^/]*\.md$/,
];

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

const LIVE_PATH_LITERALS = ['lib/skills/' + OLD_NAME, 'skills/' + OLD_NAME];

// Explicit, path-specific exceptions to scope (a): a line is tolerated only when
// it sits in `file` AND contains `lineIncludes`.
const ALLOWED_MENTIONS = [
  {
    file: 'wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md',
    lineIncludes: '`' + OLD_NAME + '` became status-only in [[TASK-0119]]',
  },
  {
    file: 'wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md',
    lineIncludes: '`/' + OLD_NAME + '` performs',
  },
  {
    file: 'wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md',
    lineIncludes: '`req-update`/`' + OLD_NAME + '` correctness bug',
  },
  {
    file: 'test/prd-rename-residue.test.js',
    lineIncludes: "'" + OLD_NAME + "', '" + ['req', 'extract', 'decisions'].join('-') + "', '/" + OLD_NAME + " foo'",
  },
];

function isAllowed(rel, line) {
  return ALLOWED_MENTIONS.some((a) => a.file === rel && line.includes(a.lineIncludes));
}

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

function readText(abs) {
  try {
    const buf = fs.readFileSync(abs);
    return buf.includes(0) ? null : buf.toString('utf8');
  } catch {
    return null;
  }
}

function collect(filter) {
  const out = [];
  for (const { abs, rel } of walk('')) {
    if (!filter(rel)) continue;
    const text = readText(abs);
    if (text === null) continue;
    out.push({ rel, text });
  }
  return out;
}

function findHits(files, matches) {
  const hits = [];
  for (const { rel, text } of files) {
    text.split('\n').forEach((line, i) => {
      if (matches(line) && !isAllowed(rel, line)) hits.push(`${rel}:${i + 1}`);
    });
  }
  return hits;
}

test('scope (a): no live code/doc file references the old skill name', () => {
  const files = collect((rel) => SCOPE_A.some((re) => re.test(rel)));
  assert.ok(files.length > 0, 'scope (a) walker matched no files - the sweep is vacuous');
  const hits = findHits(files, (line) => OLD_NAME_RE.test(line));
  assert.deepEqual(hits, [], `stale references to the renamed skill:\n  ${hits.join('\n  ')}`);
});

test('scope (b): no non-excluded file cites the old skill live path', () => {
  const files = collect(() => true);
  assert.ok(files.length > 0, 'scope (b) walker matched no files - the sweep is vacuous');
  const hits = findHits(files, (line) => LIVE_PATH_LITERALS.some((lit) => line.includes(lit)));
  assert.deepEqual(hits, [], `files still citing the old skill path:\n  ${hits.join('\n  ')}`);
});

test('old skill directory is gone; prd-deprecate and adr-deprecate exist with matching names', () => {
  assert.ok(
    !fs.existsSync(path.join(SKILLS, OLD_NAME)),
    'the old skill directory must not exist (hard rename, no stub)'
  );
  for (const name of ['prd-deprecate', 'adr-deprecate']) {
    const skill = path.join(SKILLS, name, 'SKILL.md');
    assert.ok(fs.existsSync(skill), `lib/skills/${name}/SKILL.md must exist`);
    const fm = fs.readFileSync(skill, 'utf8').split(/^---\s*$/m)[1] || '';
    assert.match(fm, new RegExp(`^name:\\s*${name}\\s*$`, 'm'), `frontmatter name must be ${name}`);
  }
});
