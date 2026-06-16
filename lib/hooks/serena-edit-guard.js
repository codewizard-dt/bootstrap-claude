#!/usr/bin/env node
'use strict';

/**
 * serena-edit-guard.js — PreToolUse hook (matcher: Edit, MultiEdit)
 *
 * HARD BLOCK: Edit / MultiEdit on code files.
 * Directs agents to Serena's symbol-level edit tools instead.
 *
 * Policy:
 *   - Block any Edit or MultiEdit call whose file_path resolves to a code file.
 *   - Suggest  mcp__serena__replace_symbol_body  as the primary tool,
 *              mcp__serena__replace_content       as the line-based fallback.
 *   - Allowed (pass-through): markdown, JSON, YAML, env, SQL, CSS, HTML,
 *     config files, test files, paths under .task/, .claude/, node_modules/.
 *   - No Serena state is read — this is a pure path-based policy gate.
 */

const { isAllowedPath, buildEditSuggestion, buildStructuredBlockResponse } = require('./lib/serena');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch (e) { process.exit(0); }

  const tool = data.tool_name;
  if (tool !== 'Edit' && tool !== 'MultiEdit') process.exit(0);

  const filePath = String(data.tool_input?.file_path ?? '').trim();
  if (!filePath) process.exit(0);

  if (isAllowedPath(filePath, { allowMarkdown: true })) process.exit(0);

  // ── Build suggestion text ─────────────────────────────────────────────────
  const suggestion = buildEditSuggestion(filePath);

  const reason =
    `SERENA-FIRST: ${tool} on a code file is blocked. ` +
    `Use Serena's symbol-level edit tools instead:\n${suggestion}`;

  process.stderr.write(
    `\n⛔ SERENA-FIRST BLOCK [serena-edit-guard]: ${tool} on code file\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `File: ${filePath}\n\n` +
    `Primary — symbol-level edit (preferred):\n` +
    `  mcp__serena__replace_symbol_body(<symbol_name>, "${filePath}")\n\n` +
    `Fallback — line/content-based edit:\n` +
    `  mcp__serena__replace_content("${filePath}", mode="literal", needle=..., repl=...)\n\n` +
    `Edit remains allowed on: .md, .json, .yaml, .env, .sql, .css, .html,\n` +
    `  config files (tsconfig, package.json, next.config.*), test files,\n` +
    `  and paths under .task/, .claude/, node_modules/.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  );

  console.log(JSON.stringify(buildStructuredBlockResponse({
    hook: 'serena-edit-guard',
    symbols: [],
    intent: 'symbol_edit_body',
    reason,
  })));

  process.exit(2);
});
