#!/usr/bin/env node
'use strict';

/**
 * serena-first-guard.js — PreToolUse / Grep
 *
 * Blocks: the built-in Grep tool when its pattern names a code symbol
 *   (camelCase, PascalCase, 3+-part snake_case, dotted member access, or a
 *   kebab component name) and the search is rooted inside the project.
 *   Suggests the equivalent Serena call for each symbol found.
 * Why a hook: the verdict depends on *classifying an argument string* — a
 *   settings.json rule can match a tool name or a path, never "this pattern
 *   looks like an identifier". A hook can also answer with the exact
 *   find_symbol / find_referencing_symbols call to make instead, which a deny
 *   rule has no channel for.
 * Fails: open — unparseable stdin, a non-string pattern, an out-of-project
 *   `path`, or `health.should_enforce === false` all pass the Grep through.
 * False positives: grepping for a *string literal* shaped like an identifier —
 *   a log message, a JSON key, a CSS-in-JS class — escape hatch: scope the
 *   search with `glob` to a non-enforced extension or `path` to one of the
 *   exempt directories below, or loosen the pattern into something that reads
 *   as a regex (`handleSubmit` → `handle.*Submit`; the `*` trips
 *   rejectRegexSpecials and the token stops counting as a symbol).
 * See README.md § "Serena-first enforcement hooks (ported from
 * `claude-code-lsp-enforcement-kit`)" for the full rationale.
 */

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

  // Directories where an identifier-shaped match is not code, so redirecting to
  // Serena would be useless: the knowledge vault and docs (prose that *quotes*
  // symbol names), .task / .claude (agent scratch), node_modules (Serena
  // indexes the project, not its dependencies), logs (identifiers appear in
  // every stack trace), and generated SQL migrations.
  //
  // This is a near-duplicate of ALLOW_PATH_PATTERNS in lib/serena.js but NOT
  // the same set — it adds `logs?/` and `knowledge-vault`, and drops
  // build/dist/out/public/scripts/coverage/__tests__ — so swapping in the
  // shared constant would silently change this hook's behaviour in both
  // directions. That is why the tempting de-duplication has not been made.
  //
  // KNOWN DEFECT, left in place: unlike NON_CODE_PATH in
  // serena-first-glob-guard.js this regex is unanchored, so `myknowledge-vault/`
  // and `mydocs/` also match and skip enforcement. The glob guard carries a
  // comment about fixing exactly this bug on its side; this side was missed.
  if (/knowledge-vault|\.task[\\/]|\.claude[\\/]|node_modules|logs?[\\/]|docs?[\\/]|supabase[\\/]migrations/i.test(searchPath)) {
    process.exit(0);
  }

  // A search already scoped to a data/config extension needs no symbol
  // enforcement — Serena has no symbol index for those files. The extension
  // list is only a cheap pre-filter; the actual decision is the second step,
  // which pulls the extension back out and defers to the project's *enabled*
  // Serena languages (.serena/project.yml), so a project that really does
  // index e.g. `sh` or `sql` keeps enforcement on those globs.
  //
  // `.md` is absent from the list, so markdown-scoped Greps stay enforced —
  // the same stance as the read guard's `enforceMarkdown: true`. (Whether the
  // two were aligned deliberately is not recorded anywhere; they agree today.)
  //
  // Both regexes are unanchored, and a brace list defeats the second one: for
  // `**/*.{ts,json}` the first regex matches on `.json`, but the second finds
  // no `.<letters><delimiter>` sequence at all, leaving ext '' → exit 0. A
  // mixed code/non-code brace glob is therefore never enforced.
  if (/\.(txt|log|json|jsonc|yaml|yml|env|csv|toml|xml|sql|sh|css|scss)/i.test(glob)) {
    const m = glob.match(/\.([a-z0-9]+)(?:[^a-z0-9]|$)/i);
    const ext = m ? m[1].toLowerCase() : '';
    if (!ext || !getEnabledExtensionsSet().has(ext)) process.exit(0);
  }

  // Fast path, not an independent policy: isCodeSymbol already rejects tokens
  // shorter than 4 chars, and no token split out of a <4-char pattern can be
  // >= 4, so this changes no verdict — it only skips the split and allocation
  // for the very common short pattern. Lowering the floor is inert. RAISING it
  // is not: at 8, the 7-char pattern `getUser` would exit here and never be
  // classified at all.
  if (pattern.length < 4) process.exit(0);

  // Call-site dialect. isCodeSymbol / extractSymbolsFromPattern in
  // lib/serena.js serve three guards whose pattern languages differ; every
  // option below encodes one fact about Grep's syntax specifically.
  //
  //   splitRe: '|' — a LITERAL pipe split, not a regex one. A Grep pattern is
  //     a regex, and top-level alternation is the only decomposition that is
  //     safe without parsing it: `getUser|setUser` is two candidates. Anything
  //     else stays glued to its token — which is what forces the next option.
  //   allowlist: 'guard' — the skip list tuned for Grep tokens: TODO/FIXME/
  //     HACK/XXX/NOTE markers, `console.`, import/export/from/`require(`,
  //     comment and shell-comment prefixes, URLs, leading digits,
  //     SCREAMING_CASE constants, any short all-lowercase word, a quoted
  //     string, and "use client"/"use server". Every one is something you
  //     legitimately grep for AS TEXT. The 'bash' and 'glob' dialects carry
  //     different lists because their call sites see different token shapes —
  //     they are not three copies of one list that drifted.
  //   rejectRegexSpecials: true — because tokens arrive raw and unsplit, a
  //     token containing regex metacharacters is a regex construct, not an
  //     identifier. Without it, `handleSubmit\(` would be reported as the
  //     symbol `handleSubmit\(`: a blocked-but-legitimate regex search, plus a
  //     suggested Serena call naming a symbol that does not exist. The glob
  //     guard does not pass this because its tokenizer already strips those
  //     characters, so no token there can contain one.
  //   kebabComponents: true — the carve-out saying some kebab tokens ARE
  //     symbols: `user-modal`, `actions-order` name components and modules
  //     worth finding symbolically, while `text-sm` / `bg-white` are Tailwind
  //     classes. Exactly inverted in the glob guard, where a kebab token is a
  //     filename convention and is always rejected.
  //   dottedSymbol: true — `router.push`, `mcp.Tool`: member access is a
  //     natural thing to grep for and does name a real symbol. The glob guard
  //     cannot enable it, since a `.` there is an extension separator its
  //     tokenizer splits on.
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
  //
  // This is also what performs the block: the process ends normally (exit 0)
  // and the `decision: 'block'` envelope is what stops the call. Note the
  // divergence from serena-write-guard.js, which emits the same envelope AND
  // exits 2. Claude Code honours either signal, so both hooks block; nothing in
  // the repo records why the two files chose differently.
  const intent = /^[A-Z]/.test(symbolParts[0]) ? 'symbol_search' : 'references';
  console.log(JSON.stringify(buildStructuredBlockResponse({
    hook: 'serena-first-guard',
    symbols: symbolParts,
    intent,
    reason: `SERENA-FIRST: Pattern contains code symbol(s) [${symbolParts.join(', ')}]. Use Serena tools:\n${suggestions}`,
  })));
});
