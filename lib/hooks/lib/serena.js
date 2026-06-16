'use strict';

/**
 * serena.js — shared helper for Serena-first enforcement hooks
 *
 * Single-provider helper that maps high-level intents to Serena MCP tool
 * names and produces block-message copy that consumers render verbatim.
 *
 * Supported intents (see TOOLS map):
 *   Navigation:  definition, references, symbol_search, implementation,
 *                incoming_calls, overview
 *   Symbolic edit: symbol_edit_body, insert_before, insert_after, rename,
 *                  safe_delete
 *   Line-based edit: line_edit, line_range_edit, line_insert, line_delete
 *   Filesystem:  create_file, list_dir, find_file
 *   Unmapped:    hover, diagnostics, outgoing_calls (Serena has no direct
 *                equivalent — consumers fall back to symbol_search)
 *
 * Serena (https://github.com/oraios/serena — MIT) provides high-level
 * symbolic tools with multi-language support via solidlsp.
 *
 * Claude Code MCP tool naming has two forms:
 *   mcp__serena__<tool>                          — standalone server
 *   mcp__plugin_<plugin>_serena__<tool>          — plugin-bundled server
 *
 * Both forms are recognised by isLspProviderTool / getTrackerToolNameRegex.
 *
 * This module also centralises the allowlist policy (file extensions,
 * config filenames, path patterns, test patterns) used to decide whether
 * a path should bypass code-enforcement. `isAllowedPath(filePath)` is the
 * single source of truth; edit-guard, write-guard and bash-grep-block all
 * import from here.
 *
 * No network, no MCP runtime introspection, no dependency on Serena being
 * installed — detection (if used) reads user-level Claude Code config.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getEnabledExtensionsSet } = require('./serena-languages');

const HOME = os.homedir();

// ── Serena constants ───────────────────────────────────────────────────────
const SERENA_PREFIX = 'mcp__serena__';
const SERENA_LABEL  = 'Serena';
const SERENA_TOKEN  = 'serena';

// First tool to call when understanding a file. Doubles as Gate 1 warmup.
const WARMUP_TOOL  = 'get_symbols_overview';
const WARMUP_NOTE  = "Serena's 'first tool to understand a file'";

// Abstract navigation intent → Serena tool name.
// Intents with no direct Serena equivalent fall back to find_symbol.
const TOOLS = {
  // Navigation / read-side intents
  definition:       'find_symbol',
  references:       'find_referencing_symbols',
  symbol_search:    'find_symbol',
  implementation:   'find_symbol',
  incoming_calls:   'find_referencing_symbols',
  overview:         'get_symbols_overview',
  // Symbolic edit intents
  symbol_edit_body: 'replace_symbol_body',
  insert_before:    'insert_before_symbol',
  insert_after:     'insert_after_symbol',
  rename:           'rename_symbol',
  safe_delete:      'safe_delete_symbol',
  // Line-based edit intents
  line_edit:        'replace_content',
  line_range_edit:  'replace_lines',
  line_insert:      'insert_at_line',
  line_delete:      'delete_lines',
  // File / filesystem intents
  create_file:      'create_text_file',
  list_dir:         'list_dir',
  find_file:        'find_file',
  // Intents Serena does not expose directly — consumers should fall back
  // to symbol_search when these are null.
  hover:            null,
  diagnostics:      null,
  outgoing_calls:   null,
};

// Plugin-wrapped form (compiled once at module load).
const PLUGIN_WRAPPED_RE = new RegExp(`^mcp__plugin_[^_]+_${SERENA_TOKEN}__`);

// ── Allowlist policy (centralised) ─────────────────────────────────────────
// Single source of truth used by edit-guard, write-guard and bash-grep-block.
// Keep these regexes byte-identical to the copies in serena-first-read-guard.js
// so behaviour cannot drift between hooks.
const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp)$/i;
const ALLOW_NON_CODE_EXT = /\.(md|txt|log|json|jsonc|yaml|yml|env|csv|toml|xml|sql|sh|css|scss|html|lock|ini|conf|cfg)$/i;
const ALLOW_CONFIG_PATTERNS = /(\.config\.|tsconfig|next\.config|vite\.config|webpack\.config|rollup\.config|babel\.config|jest\.config|vitest\.config|tailwind\.config|postcss\.config|eslint|prettier|package\.json|pnpm-lock|yarn\.lock)/i;
const ALLOW_PATH_PATTERNS = /(^|\/)(\.task|\.claude|\.git|node_modules|build|dist|out|public|scripts|docs?|knowledge-vault|supabase\/migrations|coverage|\.next|\.turbo|__tests__|__mocks__)(\/|$)/i;
const ALLOW_TEST_PATTERNS = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|py)$/i;

/**
 * Returns true if the given path should bypass code-enforcement hooks.
 *
 * A path is allowed when it either:
 *   - has a non-code extension (.md, .json, .yaml, .env, .sql, .css, .html …)
 *   - matches a known config filename (tsconfig.json, package.json, next.config.*)
 *   - lives under a reserved path (.task/, .claude/, node_modules/, __tests__/ …)
 *   - is a test file (*.test.*, *.spec.*)
 *   - has no recognised code extension at all
 *
 * Options:
 *   - enforceMarkdown: when true, `.md` / `.mdx` files are NOT exempt by extension
 *     (path-pattern exemptions still apply). Used by the read guard so markdown
 *     reads must go through Serena warmup.
 *   - allowMarkdown: when true, `.md` / `.mdx` files are ALWAYS exempt, overriding
 *     language-aware enforcement. Used by the edit and write guards so markdown
 *     edits go through native tools regardless of Serena language config.
 *
 * Empty / non-string input returns true (fail-open for hooks that should
 * not block absent input — callers are expected to guard earlier).
 */
function isAllowedPath(filePath, opts = {}) {
  if (!filePath || typeof filePath !== 'string') return true;

  const enforceMarkdown = opts.enforceMarkdown === true;
  const allowMarkdown = opts.allowMarkdown === true;
  const isMarkdown = /\.(md|mdx)$/i.test(filePath);

  // Edit/write callers pass `allowMarkdown: true` → always exempt .md / .mdx,
  // overriding any language-aware enforcement.
  if (isMarkdown && allowMarkdown) return true;

  if (!(isMarkdown && enforceMarkdown)) {
    const enabledExts = getEnabledExtensionsSet();
    if (enabledExts.size > 0) {
      // Language-aware: only enforce files whose extension belongs to an enabled language
      const ext = path.extname(filePath).slice(1).toLowerCase();
      if (!ext || !enabledExts.has(ext)) return true;
    } else {
      // Fallback (no languages configured): use static extension list
      if (ALLOW_NON_CODE_EXT.test(filePath)) return true;
      if (!CODE_EXTENSIONS.test(filePath)) return true;
    }
  }

  if (ALLOW_CONFIG_PATTERNS.test(path.basename(filePath))) return true;
  if (ALLOW_PATH_PATTERNS.test(filePath)) return true;
  if (ALLOW_TEST_PATTERNS.test(filePath)) return true;
  return false;
}

// ── Config-file readers ────────────────────────────────────────────────────
function readJsonSilent(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Minimal presence check: scans ~/.claude.json mcpServers for a `serena` key.
 * Returns true if Serena is registered as an MCP server.
 */
function hasSerena() {
  const candidates = [
    path.join(HOME, '.claude.json'),
    path.join(HOME, '.claude', 'settings.json'),
    path.join(HOME, '.claude', 'mcp.json'),
    path.join(HOME, '.mcp.json'),
    path.join(process.cwd(), '.mcp.json'),
  ];
  for (const p of candidates) {
    const data = readJsonSilent(p);
    const servers = data?.mcpServers;
    if (servers && typeof servers === 'object') {
      for (const name of Object.keys(servers)) {
        if (String(name).toLowerCase() === SERENA_TOKEN) return true;
      }
    }
  }
  return false;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the list of active providers. Kept for backward compatibility
 * with existing consumers; in Serena-only mode this is always ['serena'].
 */
function detectProviders() {
  return ['serena'];
}

function resolveTool(intent) {
  return TOOLS[intent] || TOOLS.symbol_search;
}

/**
 * Build a single-line Serena suggestion for a symbol and navigation intent.
 */
function buildSuggestion(symbol, intent, indent = '  ') {
  const tool = resolveTool(intent);
  const safeSym = String(symbol).replace(/"/g, '\\"');
  return `${indent}${SERENA_PREFIX}${tool}("${safeSym}")`;
}

/**
 * Warmup instructions for Gate 1 in serena-first-read-guard.js.
 * Returns an array of human-readable lines.
 */
function buildWarmupInstructions(indent = '  ') {
  return [
    `${indent}${SERENA_PREFIX}${WARMUP_TOOL}(<any project file>)`,
    `${indent}  → ${WARMUP_NOTE}`,
  ];
}

/**
 * Build a copy-pasteable Serena warmup call parametrized by the actual file.
 */
function buildFileWarmupCall(filePath, indent = '  ') {
  if (!filePath) return '';
  const safeFile = String(filePath).replace(/"/g, '\\"');
  return `${indent}${SERENA_PREFIX}${WARMUP_TOOL}("${safeFile}")`;
}

/**
 * Build a two-line edit suggestion (symbolic + line-based).
 */
function buildEditSuggestion(filePath, symbolHint, indent = '  ') {
  const safeFile = String(filePath ?? '').replace(/"/g, '\\"');
  const lineBased =
    `${indent}${SERENA_PREFIX}replace_content("${safeFile}", mode="literal", needle=..., repl=...)`;
  if (symbolHint) {
    const safeSym = String(symbolHint).replace(/"/g, '\\"');
    const symbolic =
      `${indent}${SERENA_PREFIX}replace_symbol_body("${safeSym}", "${safeFile}")`;
    return `${symbolic}\n${lineBased}`;
  }
  return lineBased;
}

/**
 * Build a create_text_file suggestion for new code files.
 */
function buildWriteSuggestion(filePath, indent = '  ') {
  const safeFile = String(filePath ?? '').replace(/"/g, '\\"');
  return `${indent}${SERENA_PREFIX}create_text_file("${safeFile}", ...)`;
}

/**
 * Map a detected bash command to its Serena equivalent(s).
 */
function buildBashFsSuggestion(command, indent = '  ') {
  const cmd = String(command ?? '');
  const lines = [];
  const push = (line) => lines.push(`${indent}${line}`);

  // ls / tree / find -type d  →  list_dir
  const lsMatch = /\b(?:ls|tree)\b(?:\s+(?:-[A-Za-z]+\s+)*)*([^\s|;&<>]+)?/.exec(cmd);
  const findDirMatch = /\bfind\b\s+([^\s|;&<>]+)[^|;&<>]*-type\s+d\b/.exec(cmd);
  if (/\b(?:ls|tree)\b/.test(cmd) || findDirMatch) {
    const dir = (findDirMatch && findDirMatch[1]) || (lsMatch && lsMatch[1]) || '.';
    const safeDir = String(dir).replace(/"/g, '\\"');
    push(`${SERENA_PREFIX}list_dir("${safeDir}")`);
  }

  // find -name "<pattern>"  →  find_file
  const findNameMatch = /\bfind\b\s+([^\s|;&<>]+)[^|;&<>]*-name\s+(['"]?)([^'"\s|;&<>]+)\2/.exec(cmd);
  if (findNameMatch) {
    const dir = findNameMatch[1] || '.';
    const pattern = findNameMatch[3];
    const safeDir = String(dir).replace(/"/g, '\\"');
    const safePat = String(pattern).replace(/"/g, '\\"');
    push(`${SERENA_PREFIX}find_file("${safePat}", "${safeDir}")`);
  }

  // cat / head / tail  →  get_symbols_overview (code) or Read (md/config)
  const catMatch = /\b(?:cat|head|tail)\b(?:\s+(?:-[A-Za-z0-9]+\s*\S*\s*))*\s*([^\s|;&<>]+)/.exec(cmd);
  if (catMatch) {
    const file = catMatch[1];
    const safeFile = String(file).replace(/"/g, '\\"');
    if (isAllowedPath(file)) {
      push(`Read("${safeFile}")   # markdown/config — native Read is fine`);
    } else {
      push(`${SERENA_PREFIX}get_symbols_overview("${safeFile}")`);
    }
  }

  // sed -i / awk -i inplace / perl -i  →  replace_content
  const sedMatch = /\bsed\b\s+[^\n]*-i\b[^\n]*?\s(['"]?)([^'"\s|;&<>]+)\1\s*$/m.exec(cmd);
  const awkMatch = /\bawk\b\s+[^\n]*-i\s+inplace\b[^\n]*?\s(['"]?)([^'"\s|;&<>]+)\1\s*$/m.exec(cmd);
  const perlMatch = /\bperl\b\s+[^\n]*-i\b[^\n]*?\s(['"]?)([^'"\s|;&<>]+)\1\s*$/m.exec(cmd);
  const inplaceMatch = sedMatch || awkMatch || perlMatch;
  if (inplaceMatch || /\bsed\b[^\n]*-i\b/.test(cmd) || /\bawk\b[^\n]*-i\s+inplace\b/.test(cmd) || /\bperl\b[^\n]*-i\b/.test(cmd)) {
    const file = inplaceMatch ? inplaceMatch[2] : '<path>';
    const safeFile = String(file).replace(/"/g, '\\"');
    const modeHint = /\bsed\b/.test(cmd) || /\bperl\b/.test(cmd) ? 'regex' : 'literal';
    push(`${SERENA_PREFIX}replace_content("${safeFile}", mode="${modeHint}", needle=..., repl=...)`);
  }

  // echo ... >> <file>  →  insert_at_line or Edit
  const echoMatch = /\becho\b[^\n]*?>>\s*([^\s|;&<>]+)/.exec(cmd);
  if (echoMatch) {
    const file = echoMatch[1];
    const safeFile = String(file).replace(/"/g, '\\"');
    if (isAllowedPath(file)) {
      push(`Edit("${safeFile}", ...)   # markdown/config — native Edit is fine`);
    } else {
      push(`${SERENA_PREFIX}insert_at_line("${safeFile}", line, content)`);
    }
  }

  if (lines.length === 0) return '';
  return lines.join('\n');
}

/**
 * Returns a regex fragment that matches Serena tool_name strings.
 */
function getTrackerToolNameRegex() {
  return `mcp__(?:plugin_[^_]+_)?${SERENA_TOKEN}__`;
}

/**
 * Check whether a tool_name string is a Serena tool call.
 */
function isLspProviderTool(toolName) {
  if (!toolName || typeof toolName !== 'string') return false;
  if (!toolName.startsWith('mcp__')) return false;
  if (toolName.startsWith(SERENA_PREFIX)) return true;
  if (PLUGIN_WRAPPED_RE.test(toolName)) return true;
  return false;
}

/**
 * Structured suggestion list for programmatic consumers.
 */
function buildStructuredSuggestions(symbol, intent) {
  const tool = resolveTool(intent);
  const safeSym = String(symbol).replace(/"/g, '\\"');
  return [{
    provider:    'serena',
    label:       SERENA_LABEL,
    tool:        `${SERENA_PREFIX}${tool}`,
    args:        { query: String(symbol) },
    displayTool: `${SERENA_PREFIX}${tool}("${safeSym}")`,
  }];
}

/**
 * Assemble a structured block response for blocking hooks.
 */
function buildStructuredBlockResponse({ hook, symbols, intent, reason }) {
  const providers = detectProviders();
  const suggestions = [];
  const symbolList = Array.isArray(symbols) ? symbols : [];
  for (const sym of symbolList) {
    for (const s of buildStructuredSuggestions(sym, intent)) {
      suggestions.push({ symbol: String(sym), ...s });
    }
  }
  return {
    decision: 'block',
    reason:   String(reason ?? ''),
    hook:     String(hook ?? ''),
    symbols:  symbolList.map(String),
    intent:   String(intent ?? ''),
    providers,
    suggestions,
  };
}

module.exports = {
  // Constants
  SERENA_PREFIX,
  WARMUP_TOOL,
  TOOLS,
  // Allowlist policy (centralised — single source of truth)
  CODE_EXTENSIONS,
  ALLOW_NON_CODE_EXT,
  ALLOW_CONFIG_PATTERNS,
  ALLOW_PATH_PATTERNS,
  ALLOW_TEST_PATTERNS,
  isAllowedPath,
  getEnabledExtensionsSet,
  // Presence detection
  hasSerena,
  detectProviders,
  // Intent resolution
  resolveTool,
  // Message builders
  buildSuggestion,
  buildWarmupInstructions,
  buildFileWarmupCall,
  buildEditSuggestion,
  buildWriteSuggestion,
  buildBashFsSuggestion,
  buildStructuredSuggestions,
  buildStructuredBlockResponse,
  // Tool-name matchers
  getTrackerToolNameRegex,
  isLspProviderTool,
};
