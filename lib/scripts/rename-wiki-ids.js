#!/usr/bin/env node
// Rename legacy work-item IDs in a project's wiki: DEC-NNNN -> ADR-NNNN
// (wiki/work/decisions/) and REQ-NNNN -> PRD-NNNN (wiki/work/requirements/).
// Run by `bootstrap migrate` (migrate-project.sh) so a project that already
// moved to the wiki layout under the old names catches up with the ADR/PRD
// vocabulary the current skills and lifecycle docs use.
//
// WHAT IT CHANGES
//   1. Filenames: DEC-0003-slug.md -> ADR-0003-slug.md (active dir and
//      archive/), via `git mv` when the project is a git repo and the file is
//      tracked (history preserved), plain rename otherwise.
//   2. References: every occurrence of a renamed ID (`DEC-0003`, as `id:`,
//      `[[DEC-0003#D2]]`, `implements::[[DEC-0003]]`, link text, and link
//      targets like `../decisions/DEC-0003-slug.md`) in every .md file under
//      wiki/, rewritten to the new ID.
//   3. Aliases: each renamed file keeps its old ID as an alias
//      (`aliases: [ADR-0003, DEC-0003]`) so links that cannot be rewritten
//      still resolve.
//   4. wiki/log.md: one appended entry recording the rename.
//
// WHAT IT DELIBERATELY DOES NOT CHANGE
//   - wiki/log.md and wiki/log-*.md existing content (append-only by rule).
//   - raw/ (immutable), and anything outside wiki/.
//   - Text that merely looks like an ID. Only IDs that belong to a file being
//     renamed are rewritten (a PRD listing its own "REQ-1 ... REQ-2"
//     functional requirements is left alone unless a REQ-0001 file exists).
//   - Renamed skill names mentioned in prose.
//
// Idempotent: a second run finds nothing to rename. Aborts before touching
// anything if a rename target already exists (e.g. both DEC-0003 and ADR-0003
// are present).
//
// Usage: rename-wiki-ids.js [--dry-run | --count] <path-to-project>
//   --dry-run  print the plan, change nothing
//   --count    print only the number of files that would be renamed
// Exit: 0 ok (including nothing to do), 1 collision or write failure.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RENAMES = [
  { family: 'decisions', from: 'DEC', to: 'ADR' },
  { family: 'requirements', from: 'REQ', to: 'PRD' },
];
const META_BASENAMES = new Set(['index.md', 'lifecycle.md']);

function isLogFile(relPath) {
  return /^wiki\/log(-[^/]*)?\.md$/.test(relPath.split(path.sep).join('/'));
}

function collectMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMarkdown(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isGitRepo(projectDir) {
  return spawnSync('git', ['-C', projectDir, 'rev-parse', '--git-dir'], { stdio: 'ignore' }).status === 0;
}

/** Build the rename plan: which files move, and the old-ID -> new-ID map. */
function buildPlan(projectDir) {
  const files = [];
  const idMap = new Map();

  for (const { family, from, to } of RENAMES) {
    const familyDir = path.join(projectDir, 'wiki', 'work', family);
    const nameRe = new RegExp(`^(${from})-(\\d+)(.*)\\.md$`);
    const idRe = new RegExp(`^id:\\s*(${from}-\\d+)\\s*$`, 'm');

    for (const file of collectMarkdown(familyDir)) {
      const base = path.basename(file);
      if (META_BASENAMES.has(base)) continue;

      const nameMatch = base.match(nameRe);
      if (nameMatch) {
        const oldId = `${from}-${nameMatch[2]}`;
        const newId = `${to}-${nameMatch[2]}`;
        idMap.set(oldId, newId);
        files.push({ from: file, to: path.join(path.dirname(file), `${to}-${nameMatch[2]}${nameMatch[3]}.md`), oldId, newId });
        continue;
      }

      // Filename already renamed by hand but frontmatter still carries the old ID.
      const fm = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const idMatch = fm && fm[1].match(idRe);
      if (idMatch) idMap.set(idMatch[1], idMatch[1].replace(`${from}-`, `${to}-`));
    }
  }
  return { files, idMap };
}

function findCollisions(files) {
  const seen = new Set();
  const collisions = [];
  for (const f of files) {
    if (fs.existsSync(f.to) || seen.has(f.to)) collisions.push(f);
    seen.add(f.to);
  }
  return collisions;
}

function rewriteReferences(text, idMap) {
  const ids = [...idMap.keys()].map(escapeRegExp).join('|');
  const re = new RegExp(`\\b(${ids})(?![0-9])`, 'g');
  return text.replace(re, (m) => idMap.get(m));
}

/** Ensure a renamed file's frontmatter lists its old ID as an alias. Returns
 * the text unchanged if there is no frontmatter or aliases are block-style. */
function ensureOldAlias(text, oldId, newId) {
  const m = text.match(/^(---\r?\n)([\s\S]*?\r?\n)(---\r?\n)/);
  if (!m) return { text, warned: false };
  const eol = m[1].includes('\r\n') ? '\r\n' : '\n';
  let block = m[2];

  const inline = block.match(/^aliases:[ \t]*\[(.*)\][ \t]*$/m);
  if (inline) {
    const items = inline[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (items.includes(oldId)) return { text, warned: false };
    block = block.replace(inline[0], `aliases: [${[...items, oldId].join(', ')}]`);
  } else if (/^aliases:/m.test(block)) {
    return { text, warned: true };
  } else if (/^id:[ \t]*\S+[ \t]*$/m.test(block)) {
    block = block.replace(/^(id:[ \t]*\S+)[ \t]*$/m, `$1${eol}aliases: [${newId}, ${oldId}]`);
  } else {
    return { text, warned: false };
  }
  return { text: text.slice(0, m.index) + m[1] + block + m[3] + text.slice(m.index + m[0].length), warned: false };
}

function appendLog(projectDir, renamedCount, rewrittenCount) {
  const logPath = path.join(projectDir, 'wiki', 'log.md');
  if (!fs.existsSync(logPath)) return;
  const existing = fs.readFileSync(logPath, 'utf8');
  const date = new Date().toISOString().slice(0, 10);
  const entry =
    `## [${date}] migrate | renamed DEC→ADR and REQ→PRD IDs\n` +
    `Renamed ${renamedCount} file(s) and rewrote references in ${rewrittenCount} file(s) under wiki/. ` +
    `Old IDs kept as aliases on the renamed files; existing log entries left unedited.\n`;
  fs.appendFileSync(logPath, (existing.endsWith('\n') ? '' : '\n') + '\n' + entry);
}

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const countOnly = argv.includes('--count');
  const projectDir = argv.find((a) => !a.startsWith('--'));
  if (!projectDir) {
    console.error('Usage: rename-wiki-ids.js [--dry-run | --count] <path-to-project>');
    return 1;
  }
  if (!fs.existsSync(path.join(projectDir, 'wiki'))) {
    if (countOnly) console.log(0);
    else console.log('  wiki/ not found — nothing to rename.');
    return 0;
  }

  const { files, idMap } = buildPlan(projectDir);
  if (countOnly) {
    console.log(files.length);
    return 0;
  }
  if (idMap.size === 0) {
    console.log('  No DEC-/REQ- work items found — nothing to rename.');
    return 0;
  }

  const collisions = findCollisions(files);
  if (collisions.length > 0) {
    console.error('Error: rename targets already exist — resolve these before migrating:');
    for (const c of collisions) {
      console.error(`  ${path.relative(projectDir, c.from)} -> ${path.relative(projectDir, c.to)}`);
    }
    return 1;
  }

  const oldIdFor = new Map(files.map((f) => [f.to, f.oldId]));
  const wikiFiles = collectMarkdown(path.join(projectDir, 'wiki')).filter(
    (f) => !isLogFile(path.relative(projectDir, f)),
  );

  if (dryRun) {
    console.log(`  ${files.length} file(s) would be renamed:`);
    for (const f of files) console.log(`    ${path.relative(projectDir, f.from)} -> ${path.basename(f.to)}`);
    const refCount = wikiFiles.filter((f) => rewriteReferences(fs.readFileSync(f, 'utf8'), idMap) !== fs.readFileSync(f, 'utf8')).length;
    console.log(`  References would be rewritten in ${refCount} file(s) under wiki/ (log entries untouched).`);
    return 0;
  }

  const useGit = isGitRepo(projectDir);
  for (const f of files) {
    const moved = useGit && spawnSync('git', ['-C', projectDir, 'mv', f.from, f.to], { stdio: 'ignore' }).status === 0;
    if (!moved) fs.renameSync(f.from, f.to);
    console.log(`  renamed ${path.relative(projectDir, f.from)} -> ${path.basename(f.to)}`);
  }

  let rewritten = 0;
  for (const original of wikiFiles) {
    // Renamed files now live at their new path.
    const file = files.find((f) => f.from === original)?.to ?? original;
    const before = fs.readFileSync(file, 'utf8');
    let after = rewriteReferences(before, idMap);
    const oldId = oldIdFor.get(file);
    if (oldId) {
      const res = ensureOldAlias(after, oldId, idMap.get(oldId));
      after = res.text;
      if (res.warned) console.error(`  Warning: ${path.relative(projectDir, file)} has block-style aliases — add ${oldId} by hand.`);
    }
    if (after !== before) {
      fs.writeFileSync(file, after);
      rewritten++;
    }
  }

  appendLog(projectDir, files.length, rewritten);
  console.log(`  Renamed ${files.length} file(s); rewrote references in ${rewritten} file(s).`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
