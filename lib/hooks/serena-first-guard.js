#!/usr/bin/env node
'use strict';

// serena-first-guard.js — PreToolUse hook (matcher: Grep)
// Blocks Grep on code symbols. Suggests the equivalent Serena tool call.

const {
  buildSuggestion, buildStructuredBlockResponse, getEnabledExtensionsSet,
  extractSymbolsFromPattern,
  getStateFilePath, readStateFile, shouldEnforceSerena, isOutsideProject,
} = require('./lib/serena');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch (e) { process.exit(0); }

  if (data.tool_name !== 'Grep') process.exit(0);

  // Fail-open: skip enforcement when Serena is unhealthy for this project.
  if (!shouldEnforceSerena(readStateFile(getStateFilePath()))) process.exit(0);

  const params  = data.tool_input || {};
  // String coercion: non-string pattern (number, array, etc.) would throw on .trim()
  // and fail-open — Claude Code treats crash as passthrough. See security review.
  const pattern = String(params.pattern ?? '').trim();
  const searchPath = String(params.path ?? '');
  const glob    = String(params.glob ?? '');

  // Enforcement is scoped to the project root — a search rooted outside it
  // passes through regardless of pattern (Serena can't reach outside).
  if (searchPath && isOutsideProject(searchPath)) process.exit(0);

  if (/knowledge-vault|\.task[\\/]|\.claude[\\/]|node_modules|logs?[\\/]|docs?[\\/]|supabase[\\/]migrations/i.test(searchPath)) {
    process.exit(0);
  }

  if (/\.(txt|log|json|jsonc|yaml|yml|env|csv|toml|xml|sql|sh|css|scss)/i.test(glob)) {
    const m = glob.match(/\.([a-z0-9]+)(?:[^a-z0-9]|$)/i);
    const ext = m ? m[1].toLowerCase() : '';
    if (!ext || !getEnabledExtensionsSet().has(ext)) process.exit(0);
  }

  if (pattern.length < 4) process.exit(0);

  const symbolParts = extractSymbolsFromPattern(pattern, {
    splitRe: '|', allowlist: 'guard', rejectRegexSpecials: true,
    kebabComponents: true, dottedSymbol: true,
  });

  if (symbolParts.length === 0) process.exit(0);

  const suggestions = symbolParts.map(sym => {
    const intent = /^[A-Z]/.test(sym) ? 'symbol_search' : 'references';
    return `  ${sym}:\n${buildSuggestion(sym, intent, '    ')}`;
  }).join('\n');

  process.stderr.write(
    `\n⛔ SERENA-FIRST BLOCK: ${symbolParts.length} code symbol(s) in Grep — use Serena instead\n` +
    `Symbols: ${symbolParts.join(', ')}\nSerena tools:\n${suggestions}\n\n`
  );

  // Emit structured JSON for programmatic consumers (monitoring, dashboards, IDE plugins).
  // `decision` and `reason` fields remain backward compatible.
  const intent = /^[A-Z]/.test(symbolParts[0]) ? 'symbol_search' : 'references';
  console.log(JSON.stringify(buildStructuredBlockResponse({
    hook: 'serena-first-guard',
    symbols: symbolParts,
    intent,
    reason: `SERENA-FIRST: Pattern contains code symbol(s) [${symbolParts.join(', ')}]. Use Serena tools:\n${suggestions}`,
  })));
});
