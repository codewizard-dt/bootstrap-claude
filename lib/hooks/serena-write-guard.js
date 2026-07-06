#!/usr/bin/env node
'use strict';

// serena-write-guard.js — PreToolUse hook (matcher: Write)
// Blocks Write on existing code files. New files (no fs path yet) are allowed through.
// Allowlist: markdown, JSON, YAML, config files, test files, and known exempt paths.

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

  // Fail-open: skip enforcement when Serena is unhealthy for this project.
  if (!shouldEnforceSerena(readStateFile(getStateFilePath()))) process.exit(0);

  const filePath = String((data.tool_input || {}).file_path ?? '').trim();

  // Fail-open: if we can't determine the path, let the call through.
  if (!filePath) process.exit(0);

  // Enforcement is scoped to the project root — Serena can't reach outside it.
  if (isOutsideProject(filePath)) process.exit(0);

  if (isAllowedPath(filePath, { allowMarkdown: true })) process.exit(0);

  // New files have no symbols to preserve — native Write is the right tool.
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

  process.exit(2);
});
