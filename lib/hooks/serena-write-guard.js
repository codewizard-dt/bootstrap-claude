#!/usr/bin/env node
'use strict';

/**
 * serena-write-guard.js — PreToolUse / Write
 *
 * Blocks: Write on an EXISTING in-project code file, where a whole-file write
 *   would clobber symbolic content Serena indexes. New files pass straight
 *   through. Allowlist: markdown, JSON, YAML, config files, test files, and
 *   the known exempt paths in lib/serena.js.
 * Why a hook: the verdict turns on a filesystem fact — does the target already
 *   exist — that no settings.json pattern can consult. A path rule would have
 *   to deny both the create and the overwrite, or neither.
 * Fails: open — unparseable stdin, an empty path, an out-of-project path, or
 *   `health.should_enforce === false` all pass the Write through.
 * False positives: a deliberate full-file regeneration of an existing code
 *   file (codegen output, a rewrite from scratch) — escape hatch: use the
 *   Serena call printed in the block message, or delete the file first so the
 *   new-file path applies.
 * See README.md § "Serena-first enforcement hooks (ported from
 * `claude-code-lsp-enforcement-kit`)" for the full rationale.
 */

const fs = require('fs');
const {
  isAllowedPath, buildEditSuggestion, buildStructuredBlockResponse,
  getStateFilePath, readStateFile, shouldEnforceSerena, isOutsideProject,
} = require('./lib/serena');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch (e) { process.exit(0); }

  if (data.tool_name !== 'Write') process.exit(0);

  // ORDERING: health check → path extraction → out-of-project → allowlist →
  // existence. This is a cost ordering, not a correctness one — unlike the read
  // guard there is no state ladder here to deadlock, so no step can trap the
  // agent by running late. Each step is cheaper and more total than the next,
  // and existsSync is the only filesystem call in the file: keeping it last
  // means the majority of Write calls (markdown, JSON, config, tests) are
  // decided without touching the disk at all.
  //
  // Fail-open: skip enforcement when Serena is unhealthy for this project.
  if (!shouldEnforceSerena(readStateFile(getStateFilePath()))) process.exit(0);

  const filePath = String((data.tool_input || {}).file_path ?? '').trim();

  // Fail-open: if we can't determine the path, let the call through.
  if (!filePath) process.exit(0);

  // Enforcement is scoped to the project root — Serena can't reach outside it.
  if (isOutsideProject(filePath)) process.exit(0);

  // allowMarkdown: true — .md / .mdx are ALWAYS exempt from write enforcement,
  // overriding isAllowedPath's language-aware branch even in a project that has
  // markdown enabled as a Serena language. Note the read guard passes the
  // opposite flag (enforceMarkdown: true): reading docs should route through
  // Serena so the agent orients before it reads, but authoring them through a
  // symbol-editing tool buys nothing.
  if (isAllowedPath(filePath, { allowMarkdown: true })) process.exit(0);

  // New files have no symbols to preserve — native Write is the right tool.
  // The guard exists because Write REPLACES a file wholesale, destroying both
  // the symbol structure Serena indexes and any content the agent did not
  // re-type. A path that does not exist yet has neither, so there is nothing to
  // clobber and Serena's create_text_file offers nothing native Write does not.
  // fs.existsSync is racy in principle — the file could appear between this
  // check and the Write — but the cost of losing that race is one missed
  // guidance nudge. Serena-first is agent guidance, not a security boundary,
  // so the race does not justify an open/O_EXCL dance.
  if (!fs.existsSync(filePath)) process.exit(0);

  // --- BLOCKED (file exists — Write would clobber symbolic content) ---
  const suggestion = buildEditSuggestion(filePath);
  const reason =
    `serena-write-guard: Writing to existing code file "${filePath}" directly is blocked.\n` +
    `Use Serena's edit tools instead:\n${suggestion}\n\n` +
    `Allowlist policy: .md, .json, .yaml, .env, .sql, .css, .html, config files,\n` +
    `test files (*.test.*, *.spec.*), and paths under .task/, .claude/, node_modules/.`;

  process.stderr.write(`\n⛔ SERENA-WRITE BLOCK: Direct Write to existing code file — use Serena instead\n` +
    `File: ${filePath}\nSuggested call:\n${suggestion}\n\n`);

  console.log(JSON.stringify(buildStructuredBlockResponse({
    hook: 'serena-write-guard',
    symbols: [],
    intent: 'write',
    reason,
  })));

  // exit(2) comes LAST, after both writes, because process.exit() terminates
  // immediately — anything emitted after it is simply lost, so the structured
  // envelope on stdout and the human-readable message on stderr have to be
  // handed over first.
  //
  // It is also belt-and-braces: the `decision: 'block'` envelope above blocks
  // the call on its own (that is the only signal serena-first-guard.js sends),
  // and exit code 2 blocks independently. Nothing in the repo records why this
  // hook emits both signals while its siblings emit one.
  //
  // SUSPECTED DEFECT, deliberately not fixed here: on POSIX, stdout/stderr to a
  // pipe are asynchronous, so process.exit() immediately after a console.log
  // can truncate the payload. serena-first-read-guard.js's emitBlock has the
  // same shape. Exit code 2 would still block, but the reason text could be
  // lost — which is the part that tells the agent what to do instead.
  process.exit(2);
});
