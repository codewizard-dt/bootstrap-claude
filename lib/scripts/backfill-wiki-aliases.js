#!/usr/bin/env node
// Backfill `aliases: [<id>]` onto every wiki/work/ work-item file that has an
// id: field but no aliases: field yet — a repeatable version of TASK-064's
// one-time sweep (see
// wiki/work/tasks/archive/TASK-064-backfill-work-item-aliases.md), run on
// every setup/update so drift (a hand-authored file, an older bootstrap
// checkout, a merge) gets corrected automatically instead of silently
// reintroducing dead Obsidian wikilinks. Root cause is documented in
// wiki/knowledge/sources/obsidian-alias-link-resolution.md: Obsidian's
// wikilink click-resolver matches only real filenames, never frontmatter, so
// a work-item file named "<ID>-slug.md" never resolves a bare "[[<ID>]]"
// link unless its frontmatter carries a matching alias (the Alias Linker
// plugin, bundled by install-obsidian.sh, is what makes that fallback work).
//
// SCOPE: wiki/work/<family>/ only (requirements, decisions, roadmaps, tasks,
// uat, bugs), both the active directory and archive/. Knowledge pages
// (wiki/knowledge/) are deliberately NOT covered — a knowledge page's
// filename already equals its id: slug (e.g. serena-mcp-scope.md has
// id: serena-mcp-scope), so every existing `[[serena-mcp-scope]]`-style link
// already resolves on Obsidian's plain filename match, the very first step
// of resolution, before aliases: is ever consulted. Knowledge-page aliases
// are curated alternate names (e.g. id: andrej-karpathy -> aliases:
// [Karpathy]) added at ingest time by human/LLM judgment, not a mechanical
// function of id: or title: — a script has no safe value to invent there.
//
// IDEMPOTENT AND ADDITIVE-ONLY: a file that already has an aliases: field
// (any value) is left untouched — this only fills a gap, it never corrects
// or overwrites an existing alias.
//
// Always exits 0 — the caller (lib.sh's run_project_sync) must never abort a
// setup/update over a wiki content backfill. Warns to stderr and skips on
// anything unexpected (a project with no wiki/work/ yet, an unreadable or
// unwritable file, a malformed id: line) rather than failing.
//
// Usage: backfill-wiki-aliases.js <path-to-project>

'use strict';

const fs = require('fs');
const path = require('path');

const FAMILIES = ['requirements', 'decisions', 'roadmaps', 'tasks', 'uat', 'bugs'];
const EXCLUDED_BASENAMES = new Set(['index.md', 'lifecycle.md', '.gitkeep']);

/** Recursively collect every .md file under `dir` (active + archive/, since
 * archive/ lives inside each family dir), skipping excluded meta filenames
 * and the wiki/work/uat/screenshots/ directory (not a work-item directory). */
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

/** Extract the frontmatter block from a file's text as
 * { open, block, close, index }, where `index` is the offset of `open` in
 * `text` and `open + block + close` is the exact original frontmatter
 * substring (delimiters included) — enough to splice a change back in
 * without disturbing anything before or after it. Returns null if the file
 * has no `---`-delimited frontmatter at all. */
function extractFrontmatter(text) {
  const match = text.match(/^(---\r?\n)([\s\S]*?\r?\n)(---\r?\n)/);
  if (!match) return null;
  return { open: match[1], block: match[2], close: match[3], index: match.index };
}

function parseId(block) {
  const match = block.match(/^id:\s*(\S+)\s*$/m);
  return match ? match[1] : null;
}

function hasAliases(block) {
  return /^aliases:/m.test(block);
}

/** Insert `aliases: [<id>]` as a new line immediately after the id: line
 * inside the frontmatter block, preserving the file's own line-ending style.
 * Returns the whole updated file text, or null if the id: line could not be
 * located inside the block (should not happen once parseId succeeded, but
 * guarded rather than assumed). */
function insertAliases(text, fm, id) {
  const eol = fm.open.includes('\r\n') ? '\r\n' : '\n';
  const newBlock = fm.block.replace(/^(id:\s*\S+\s*)$/m, (line) => `${line}${eol}aliases: [${id}]`);
  if (newBlock === fm.block) return null;
  const before = text.slice(0, fm.index);
  const after = text.slice(fm.index + fm.open.length + fm.block.length + fm.close.length);
  return `${before}${fm.open}${newBlock}${fm.close}${after}`;
}

function backfillProject(projectDir) {
  const workRoot = path.join(projectDir, 'wiki', 'work');
  if (!fs.existsSync(workRoot)) {
    console.log('  wiki/work/ not found — nothing to backfill.');
    return;
  }

  let totalUpdated = 0;
  for (const family of FAMILIES) {
    const files = collectMarkdownFiles(path.join(workRoot, family));

    for (const file of files) {
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch (err) {
        console.error(`  Warning: could not read ${path.relative(projectDir, file)} (${err.message})`);
        continue;
      }

      const fm = extractFrontmatter(text);
      if (!fm) continue; // no frontmatter — not a work-item file
      const id = parseId(fm.block);
      if (id === null) continue; // meta-like file with no id: — nothing to backfill
      if (hasAliases(fm.block)) continue; // already has aliases: — idempotent skip

      const next = insertAliases(text, fm, id);
      if (next === null) {
        console.error(`  Warning: could not locate an id: line to backfill in ${path.relative(projectDir, file)}`);
        continue;
      }

      try {
        fs.writeFileSync(file, next);
      } catch (err) {
        console.error(`  Warning: could not write ${path.relative(projectDir, file)} (${err.message})`);
        continue;
      }

      console.log(`  + aliases: [${id}] -> ${path.relative(projectDir, file)}`);
      totalUpdated++;
    }
  }

  if (totalUpdated === 0) {
    console.log('  wiki/work/ aliases: all work-item files already up to date.');
  } else {
    console.log(`  wiki/work/ aliases: backfilled ${totalUpdated} file${totalUpdated === 1 ? '' : 's'}.`);
  }
}

const projectDir = process.argv[2];
if (!projectDir) {
  console.error('Usage: backfill-wiki-aliases.js <path-to-project>');
  process.exit(0); // never abort the caller over a usage slip either
} else {
  try {
    backfillProject(projectDir);
  } catch (err) {
    console.error(`  Warning: wiki alias backfill failed unexpectedly (${err.message}) — skipping.`);
  }
}

process.exit(0);
