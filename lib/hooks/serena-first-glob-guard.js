#!/usr/bin/env node
'use strict';

/**
 * serena-first-glob-guard.js — PreToolUse / Glob
 *
 * Blocks: Glob patterns that encode a code symbol in a filename. This closes
 *   the gap where an agent blocked from grepping for a symbol
 *   (serena-first-guard) and from Reading the file (serena-first-read-guard)
 *   reaches the same place by globbing for the symbol's *filename* instead.
 * Why a hook: the verdict is a classification of the `pattern` argument —
 *   settings.json can match the Glob tool or a path, never "this glob spells
 *   an identifier". The block also names the find_symbol call to use instead.
 * Fails: open — unparseable stdin, an empty or non-string pattern, an
 *   out-of-project `path`, or `health.should_enforce === false` all pass the
 *   Glob through untouched.
 * False positives: a file you want to OPEN rather than navigate, whose name is
 *   legitimately PascalCase (`*Dockerfile*`, `**\/*Modal.tsx`) — escape hatch:
 *   search by extension or concept in lowercase (`*modal*`, `src/**\/*.tsx`),
 *   which the 'glob' dialect below always allows.
 * Philosophy: if you know the symbol name, use Serena's find_symbol. Glob is
 *   for broad file discovery by extension or concept, not symbol lookup.
 * See README.md § "Serena-first enforcement hooks (ported from
 * `claude-code-lsp-enforcement-kit`)" for the full rationale.
 */

// Worked examples of the line the 'glob' dialect draws, kept as the
// regression cases to reason from when changing GLOB_SKIP_EXACT:
//   Allowed:
//     - Extension patterns:        src/**/*.ts, *.tsx, **/*.json
//     - Concept patterns:          *subdomain*, *auth*, **/middleware*
//     - Short / all-lowercase:     *modal*, *form*, auth/**
//     - Config / framework files:  tsconfig.json, next.config.ts
//   Blocked:
//     - PascalCase symbol:         *UserService*, **/*Modal.tsx, *TabsClient*
//     - camelCase symbol:          *createOrder*, *handleSubmit*
//     - snake_case function (3+):  *get_user_sessions*, *write_audit_log*

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
  // Tested against BOTH the `path` param and the pattern itself, because a
  // glob routinely carries its own root (`node_modules/**/*.js`) with no path
  // param at all — checking only `path` would miss every such call.
  // The equivalent list in serena-first-guard.js is unanchored and sees only
  // the path; that divergence is flagged as a known defect on that side.
  const NON_CODE_PATH = /(?:^|[\/\\])(?:knowledge-vault|\.task|\.claude|node_modules|supabase[\/\\]migrations|\.git)(?:[\/\\]|$)/i;
  if (NON_CODE_PATH.test(searchPath)) process.exit(0);
  if (NON_CODE_PATH.test(pattern)) process.exit(0);

  // Extract alphabetic tokens from the pattern (strip *, /, ., brackets, etc.)
  // and keep those that name code symbols.
  //
  // Call-site dialect — the counterpart to serena-first-guard.js's Grep
  // dialect. The differences below are the whole point, not drift:
  //   splitRe: /[*/.\\{}\[\]()!?,\s|+-]+/ — a glob is punctuation-dense and
  //     every one of those characters is a separator here rather than part of
  //     a name, so splitting on all of them leaves bare identifier candidates:
  //     `src/**/*UserService*.tsx` → ['src', 'UserService', 'tsx']. Because the
  //     tokenizer has already removed the metacharacters, this call site does
  //     not need `rejectRegexSpecials`; the Grep guard splits only on '|',
  //     keeps them, and therefore does.
  //   allowlist: 'glob' — after that split an ordinary glob sheds tokens that
  //     look symbol-ish in isolation (`src`, `ts`, `tsconfig`, `middleware`,
  //     `playwright`), so this dialect adds GLOB_SKIP_EXACT: an exact-match set
  //     of extensions, directory stems, framework config names and directives.
  //     The Grep dialect needs no such set — its tokens are whole patterns, so
  //     prefix rules suffice. This dialect also rejects EVERY kebab token,
  //     precisely inverting the Grep dialect's kebabComponents carve-out: in a
  //     glob, `user-modal` is a filename convention; in a Grep pattern it is
  //     the component's name.
  //   dottedSymbol is likewise not passed: `.` is an extension separator here
  //     and splitRe consumes it before any classification can see it.
  //   stripZeroWidth: true — strips zero-width and soft-hyphen characters
  //     first, so an invisible character cannot break a name out of the
  //     camelCase / PascalCase shapes isCodeSymbol tests for. Only this guard
  //     passes it. NOTE: the reason for the asymmetry is not recoverable from
  //     the code or the README — a zero-width char in a glob matches no real
  //     filename, so this reads as classifier hardening rather than a
  //     Glob-specific need. Verify before copying it to, or removing it from,
  //     the other guards.
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
