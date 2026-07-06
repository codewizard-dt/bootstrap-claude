#!/usr/bin/env node
'use strict';

/**
 * serena-first-glob-guard.js — PreToolUse hook (matcher: Glob)
 *
 * HARD BLOCK: Glob patterns that search for code symbols by filename.
 * Closes the gap where an agent bypasses serena-first-guard (Grep matcher)
 * and serena-first-read-guard (Read matcher) by using Glob to locate files
 * containing a symbol name.
 *
 * Allowed:
 *   - Extension patterns:        src/**\/*.ts, *.tsx, **\/*.json
 *   - Concept patterns:          *subdomain*, *auth*, **\/middleware*
 *   - Short / all-lowercase:     *modal*, *form*, auth/**
 *   - Config / framework files:  tsconfig.json, next.config.ts
 *
 * Blocked:
 *   - PascalCase symbol:         *UserService*, **\/*Modal.tsx, *TabsClient*
 *   - camelCase symbol:          *createOrder*, *handleSubmit*
 *   - snake_case function (3+):  *get_user_sessions*, *write_audit_log*
 *
 * Philosophy: if you know the symbol name, use Serena's find_symbol. Glob
 *   is for broad file discovery by extension or concept, not for
 *   symbol-based search.
 */

const {
  buildSuggestion, buildStructuredBlockResponse,
  extractSymbolsFromPattern,
  getStateFilePath, readStateFile, shouldEnforceSerena, isOutsideProject,
} = require('./lib/serena');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }

  if (data.tool_name !== 'Glob') process.exit(0);

  // Fail-open: skip enforcement when Serena is unhealthy for this project.
  if (!shouldEnforceSerena(readStateFile(getStateFilePath()))) process.exit(0);

  // String coercion: non-string input would throw on .trim() and fail-open.
  const pattern = String(data.tool_input?.pattern ?? '').trim();
  if (!pattern) process.exit(0);

  const searchPath = String(data.tool_input?.path ?? '').trim();

  // Enforcement is scoped to the project root — a glob rooted outside it
  // passes through regardless of pattern (Serena can't reach outside).
  if (searchPath && isOutsideProject(searchPath)) process.exit(0);

  // ── Allow: non-code paths (anchored — bare substring would let
  //    "myknowledge-vaultxxx" bypass detection) ──────────────────────────
  const NON_CODE_PATH = /(?:^|[\/\\])(?:knowledge-vault|\.task|\.claude|node_modules|supabase[\/\\]migrations|\.git)(?:[\/\\]|$)/i;
  if (NON_CODE_PATH.test(searchPath)) process.exit(0);
  if (NON_CODE_PATH.test(pattern)) process.exit(0);

  // Extract alphabetic tokens from the pattern (strip *, /, ., brackets, etc.)
  // and keep those that name code symbols.
  const symbolTokens = extractSymbolsFromPattern(pattern, {
    splitRe: /[*/.\\{}\[\]()!?,\s|+-]+/, allowlist: 'glob', stripZeroWidth: true,
  });
  if (symbolTokens.length === 0) process.exit(0);

  const suggestions = symbolTokens.map(sym => {
    const intent = /^[A-Z]/.test(sym) ? 'symbol_search' : 'references';
    return `  ${sym}:\n${buildSuggestion(sym, intent, '    ')}`;
  }).join('\n');

  const msg =
    `\n⛔ SERENA-FIRST BLOCK: Glob pattern contains ${symbolTokens.length} code symbol(s)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Pattern: ${pattern}\n` +
    `Symbols: ${symbolTokens.join(', ')}\n\n` +
    `Serena is always connected. Searching files by symbol name is Serena territory:\n` +
    `${suggestions}\n\n` +
    `If you need to find files by extension or concept, use lowercase\n` +
    `(e.g. "*subdomain*", "src/**/*.ts") — those are allowed.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  process.stderr.write(msg);

  const intent = /^[A-Z]/.test(symbolTokens[0]) ? 'symbol_search' : 'references';
  console.log(JSON.stringify(buildStructuredBlockResponse({
    hook: 'serena-first-glob-guard',
    symbols: symbolTokens,
    intent,
    reason: `SERENA-FIRST: Glob pattern contains code symbol(s) [${symbolTokens.join(', ')}]. Use Serena tools instead of filename-based symbol search.`,
  })));
});
