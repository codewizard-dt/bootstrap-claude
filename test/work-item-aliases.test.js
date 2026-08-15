#!/usr/bin/env node
// Repeatable checks for TASK-064's one-time backfill: every existing
// work-item file across all 6 wiki/work/ families (tasks, uat, bugs,
// decisions, roadmaps, requirements), in both the active directory and its
// archive/, must carry an `aliases:` frontmatter field whose value mirrors
// that file's own `id:` field exactly (same casing, same hyphenation).
//
// Zero-dependency: node:test + node:assert only, matching the sibling
// skill-content suites (test/task-typed-links.test.js,
// test/skill-frontmatter-aliases.test.js).
//
// Run: npm test   (or: node --test test/work-item-aliases.test.js)
//
// WHY THIS IS TESTED AT ALL. Obsidian's wikilink click-resolver matches only
// real filenames, never frontmatter fields on their own — but it DOES honor
// the native `aliases:` property once present. Work-item files are named
// `TASK-NNN-slug.md`, not bare `TASK-NNN.md`, so a bare `[[TASK-NNN]]` link
// never resolves on click unless the target file's frontmatter carries a
// matching alias. TASK-064 backfilled this onto every pre-existing file; this
// suite pins that outcome as a re-runnable regression check, so a future
// script or manual edit that strips or mismatches an alias is caught instead
// of silently reintroducing dead wikilinks.
//
// SCOPE — the existing work-item files under wiki/work/ (this task's own
// backfill). Does NOT cover the 6 SKILL.md frontmatter templates that
// scaffold *new* work items (that's TASK-065 / test/skill-frontmatter-aliases.test.js)
// or the Alias Linker plugin install (a separate roadmap phase, TASK-063).
//
// EXCLUSIONS mirrored from the task: index.md, lifecycle.md, archive/index.md,
// .gitkeep, and wiki/work/uat/screenshots/ (not a work-item directory) carry
// no `id:` field and are not expected to have `aliases:`.
//
// HERMETIC: reads repo-local files under wiki/work/ only. No subprocess, no
// writes, no network.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const WORK_ROOT = path.join(REPO, 'wiki', 'work');

const FAMILIES = ['tasks', 'uat', 'bugs', 'decisions', 'roadmaps', 'requirements'];

const EXCLUDED_BASENAMES = new Set(['index.md', 'lifecycle.md', '.gitkeep']);

/** Recursively collect every .md file under `dir`, skipping excluded names
 * and the uat/screenshots/ directory (not a work-item directory). */
function collectMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'screenshots') continue; // wiki/work/uat/screenshots/
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md') && !EXCLUDED_BASENAMES.has(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Extract the raw frontmatter block (text between the first and second `---`
 * lines) from a markdown file's contents, or null if not present. */
function extractFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return match ? match[1] : null;
}

/** Parse the `id:` value out of a frontmatter block, or null if absent. */
function parseId(frontmatter) {
  const match = frontmatter.match(/^id:\s*(\S+)\s*$/m);
  return match ? match[1] : null;
}

/** Parse the `aliases:` value(s) out of a frontmatter block. Supports both
 * the inline single-line list form (`aliases: [TASK-009]`) and the YAML
 * block-list form (`aliases:\n  - TASK-009`). Returns an array of strings,
 * or null if no `aliases:` field is present at all. */
function parseAliases(frontmatter) {
  const inline = frontmatter.match(/^aliases:\s*\[([^\]]*)\]\s*$/m);
  if (inline) {
    return inline[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const blockMatch = frontmatter.match(/^aliases:\s*\n((?:^\s*-\s*.+\n?)+)/m);
  if (blockMatch) {
    return blockMatch[1]
      .split('\n')
      .map((line) => line.match(/^\s*-\s*(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => m[1]);
  }
  return null;
}

// Build the full inventory: every .md file under each family directory,
// recursively (archive/ lives inside each family dir so this one pass covers
// both active and archived files), minus exclusions and uat/screenshots/.
function buildInventory() {
  const files = [];
  for (const family of FAMILIES) {
    const familyDir = path.join(WORK_ROOT, family);
    files.push(...collectMarkdownFiles(familyDir));
  }
  return files;
}

test('inventory: at least one work-item file with an id: field exists under wiki/work/', () => {
  const files = buildInventory();
  assert.ok(files.length > 0, 'expected to find markdown files under wiki/work/<family>/');
  const withId = files.filter((f) => {
    const fm = extractFrontmatter(fs.readFileSync(f, 'utf8'));
    return fm && parseId(fm) !== null;
  });
  assert.ok(withId.length > 0, 'expected at least one work-item file to carry an id: field');
});

test('every work-item file with an id: field also has a matching aliases: field', () => {
  const files = buildInventory();
  const missing = [];
  const mismatched = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const fm = extractFrontmatter(text);
    if (!fm) continue; // no frontmatter at all — not a work-item file
    const id = parseId(fm);
    if (id === null) continue; // meta/index-like file slipped through — no id, nothing to check

    const aliases = parseAliases(fm);
    if (aliases === null) {
      missing.push(path.relative(REPO, file));
      continue;
    }
    if (!aliases.includes(id)) {
      mismatched.push(`${path.relative(REPO, file)} (id: ${id}, aliases: [${aliases.join(', ')}])`);
    }
  }

  assert.deepEqual(missing, [], `files with id: but no aliases: field:\n${missing.join('\n')}`);
  assert.deepEqual(mismatched, [], `files where aliases: does not include the file's own id::\n${mismatched.join('\n')}`);
});

test('meta/index files (index.md, lifecycle.md, archive/index.md, .gitkeep) are excluded and never carry an id: field', () => {
  // Walk every family directory's raw entries (not filtered by
  // collectMarkdownFiles) specifically to find the excluded basenames, then
  // assert they have no id: field — proving TASK-064's sweep correctly left
  // them untouched rather than merely "the walker skips them".
  const offenders = [];
  for (const family of FAMILIES) {
    const familyDir = path.join(WORK_ROOT, family);
    for (const sub of ['', 'archive']) {
      const dir = sub ? path.join(familyDir, sub) : familyDir;
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !EXCLUDED_BASENAMES.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.name === '.gitkeep') continue; // never has frontmatter
        const fm = extractFrontmatter(fs.readFileSync(full, 'utf8'));
        if (fm && parseId(fm) !== null) offenders.push(path.relative(REPO, full));
      }
    }
  }
  assert.deepEqual(offenders, [], `excluded meta files unexpectedly carry an id: field:\n${offenders.join('\n')}`);
});

test('per-family sanity: tasks, uat, and bugs families each have at least one file with aliases: (roadmaps too)', () => {
  // Guards against the walker silently matching zero files in a family
  // (e.g. a path typo) and the two tests above vacuously passing.
  const nonEmptyFamilies = ['tasks', 'uat', 'bugs', 'roadmaps'];
  for (const family of nonEmptyFamilies) {
    const familyDir = path.join(WORK_ROOT, family);
    const files = collectMarkdownFiles(familyDir);
    const withAliases = files.filter((f) => {
      const fm = extractFrontmatter(fs.readFileSync(f, 'utf8'));
      return fm && parseAliases(fm) !== null;
    });
    assert.ok(withAliases.length > 0, `expected at least one file with aliases: in wiki/work/${family}/ (found 0 — possible path/walker regression)`);
  }
});
