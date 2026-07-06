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
const crypto = require('crypto');
const { execSync } = require('child_process');
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
// Single source of truth used by edit-guard, write-guard, bash-grep-block and
// serena-first-read-guard (via isAllowedPath). No hook keeps its own copy.
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

// ── Per-project state file (Serena readiness + health) ──────────────────────
// One file per project cwd: ~/.claude/state/lsp-ready-<md5(cwd).slice(0,12)>.
// Holds warmup/nav counters (read-guard gate) and a `health` sub-object
// (fail-open enforcement). Single source of truth for the three hooks that
// touch it: serena-first-read-guard, serena-usage-tracker, serena-session-reset.
const STATE_DIR = path.join(HOME, '.claude', 'state');
const FLAG_EXPIRY_MS = 24 * 60 * 60 * 1000;

function getStateFilePath(cwd = process.cwd()) {
  const hash = crypto.createHash('md5').update(String(cwd)).digest('hex').slice(0, 12);
  return path.join(STATE_DIR, `lsp-ready-${hash}`);
}

/** Read + parse the state file. Returns null on missing, expired, or parse error. */
function readStateFile(fp) {
  try {
    if (!fs.existsSync(fp)) return null;
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (Date.now() - (d.timestamp || 0) > FLAG_EXPIRY_MS) return null;
    return d;
  } catch { return null; }
}

/** Write the state file (mkdir -p, silent failure — hooks must never throw). */
function writeStateFile(fp, data) {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(data));
  } catch { /* silent */ }
}

/**
 * Enforcement gate for all guards. Enforce (return true) unless the state
 * file explicitly recorded the provider as unhealthy for this project.
 * false ONLY when flag.health.should_enforce === false; null/missing/legacy
 * state ⇒ true (assume healthy).
 */
function shouldEnforceSerena(flag) {
  return !(flag && flag.health && flag.health.should_enforce === false);
}

/**
 * True when `p` resolves to a location OUTSIDE the project root. Serena is
 * registered per-project and can only operate on files inside it, so any tool
 * call targeting a path outside the root must pass through untouched.
 *
 * Resolution: `~` / `~/…` expand to the home dir; relative paths resolve
 * against `projectRoot` (hooks run with cwd = project root). The containment
 * test uses a trailing-separator guard so `/foo/barbaz` is NOT treated as
 * inside `/foo/bar`. The root itself counts as inside.
 *
 * Indeterminate input (empty / non-string) returns false (⇒ enforce): callers
 * decide separately how to treat unresolvable shell-variable paths.
 */
function isOutsideProject(p, projectRoot = process.cwd()) {
  if (!p || typeof p !== 'string') return false;
  let s = p.trim();
  if (!s) return false;
  if (s === '~') s = HOME;
  else if (s.startsWith('~/') || s.startsWith('~\\')) s = path.join(HOME, s.slice(2));
  const root = path.resolve(String(projectRoot));
  const resolved = path.resolve(root, s);
  if (resolved === root) return false;
  return !resolved.startsWith(root + path.sep);
}

// ── Failure classification & process health ─────────────────────────────────

/**
 * Classify a Serena failure payload as a 'tool'-level failure (server alive,
 * bad query / no matches — keep enforcing) or a 'transport'-level failure
 * (process down/unreachable — assess health). Empty and UNKNOWN payloads
 * default to 'transport' so health always gets assessed.
 */
function classifySerenaFailure(errorPayload) {
  if (errorPayload == null) return 'transport';
  let s;
  if (typeof errorPayload === 'string') {
    s = errorPayload;
  } else if (typeof errorPayload === 'object' && !Array.isArray(errorPayload)
             && Object.keys(errorPayload).length === 0) {
    return 'transport'; // empty object payload
  } else {
    try { s = JSON.stringify(errorPayload); } catch { s = String(errorPayload); }
  }
  if (!s || !s.trim()) return 'transport';

  // Tool-level: the server answered, the query just didn't resolve.
  if (/not found|no results|no matching|no symbol|could not find|error searching|error finding|does not exist|no such (?:file|symbol|path|directory)|error at /i.test(s)) {
    return 'tool';
  }
  // Transport-level: the server is unreachable / the pipe broke.
  if (/timeout|timed out|connection|refused|econnrefused|socket|epipe|closed|disconnect|not connected|unreachable|reset|broken pipe|hang/i.test(s)) {
    return 'transport';
  }
  // Unknown ⇒ transport (assess health rather than silently ignore).
  return 'transport';
}

/** Build a pgrep/pkill pattern for a Serena server bound to `projectDir`. */
function serenaProcPattern(projectDir) {
  // Escape regex metacharacters (pgrep uses extended regex), then escape
  // single quotes for safe single-quote shell wrapping.
  const escaped = String(projectDir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `serena start-mcp-server.*${escaped}`.replace(/'/g, `'\\''`);
}

/** True if a Serena MCP server process for `projectDir` is currently running. */
function isSerenaProcessAlive(projectDir) {
  try {
    execSync(`pgrep -f '${serenaProcPattern(projectDir)}'`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort restart of a hung Serena server for `projectDir`: if a process
 * exists it is (presumably hung) killed, we wait ~1s, then re-probe. Returns
 * whether a live process remains afterwards. Never throws; budget < ~2s.
 * There is no documented way to reconnect a stdio MCP server mid-session, so
 * a successful "restart" only happens if the host respawns the process.
 */
function attemptSerenaRestart(projectDir) {
  try {
    if (isSerenaProcessAlive(projectDir)) {
      try { execSync(`pkill -f '${serenaProcPattern(projectDir)}'`, { stdio: 'pipe' }); } catch {}
      try { execSync('sleep 1'); } catch {}
    }
    return isSerenaProcessAlive(projectDir);
  } catch {
    return false;
  }
}

// ── Symbol detection (consolidated) ─────────────────────────────────────────
// Single classification core shared by serena-first-guard (Grep),
// serena-first-glob-guard (Glob) and serena-bash-grep-block (Bash). The three
// call sites tokenize differently (their pattern syntaxes differ) and carry
// slightly different allowlists — those genuine differences are expressed via
// `opts`, so identical inputs yield identical block/allow decisions.

const SYMBOL_ZERO_WIDTH = /[­​-‏⁠-⁤﻿]/g;

// Glob guard's exact-match skip set: extensions, common dirs/stems, framework
// config names, directives. Checked case-insensitively.
const GLOB_SKIP_EXACT = new Set([
  // extensions
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java',
  'vue', 'svelte', 'md', 'mdx', 'json', 'jsonc', 'yaml', 'yml', 'sql',
  'sh', 'bash', 'css', 'scss', 'sass', 'less', 'html', 'htm', 'xml',
  'toml', 'ini', 'env', 'lock', 'log', 'txt', 'csv',
  // common dirs / file stems
  'src', 'app', 'lib', 'libs', 'hooks', 'utils', 'util', 'types',
  'components', 'pages', 'api', 'server', 'client', 'public', 'docs',
  'tests', 'test', 'spec', 'specs', 'dist', 'build', 'out', 'next',
  'turbo', 'cache', 'node_modules', 'coverage', 'scripts', 'config',
  'assets', 'styles', 'fonts', 'images', 'icons', 'locales', 'i18n',
  'middleware', 'services', 'service', 'models', 'model', 'schemas',
  'schema', 'routes', 'route', 'views', 'view', 'store', 'stores',
  'actions', 'action', 'reducers', 'slices', 'providers', 'contexts',
  'layouts', 'layout', 'templates', 'template', 'helpers', 'helper',
  'constants', 'const', 'configs', 'fixtures', 'mocks', 'mock',
  'validations', 'validators', 'transformers',
  // common filenames
  'index', 'main', 'page', 'error', 'loading', 'not-found', 'global',
  'root', 'readme', 'license', 'changelog', 'dockerfile', 'makefile',
  'tsconfig', 'jsconfig', 'package', 'pnpm-lock', 'yarn', 'npm-lock',
  // framework / tool config stems
  'next', 'vite', 'webpack', 'rollup', 'babel', 'jest', 'vitest',
  'tailwind', 'postcss', 'eslint', 'prettier', 'playwright', 'cypress',
  'drizzle', 'prisma', 'supabase', 'turbo', 'nx', 'bun', 'deno',
  // directives / keywords
  'todo', 'fixme', 'hack', 'xxx', 'note', 'import', 'export', 'from',
  'require', 'http', 'https',
]);

// Guard's tailwind-utility prefixes — kebab tokens starting with these are
// styling classes, never symbols.
const KEBAB_TAILWIND_PREFIX = /^(text-|bg-|border-|font-|hover:|focus:|active:|group-|ring-|shadow-|rounded-|flex-|grid-|gap-|space-|divide-|overflow-|whitespace-|break-|leading-|tracking-|align-|justify-|items-|self-|order-|col-|row-|transition-|duration-|ease-|animate-|scale-|rotate-|translate-|origin-|cursor-|select-|resize-|appearance-|outline-|decoration-|underline-|line-|placeholder-|caret-|accent-|sr-|z-|opacity-|w-|h-|p-|m-|px-|py-|pt-|pb-|pl-|pr-|mx-|my-|mt-|mb-|ml-|mr-|max-|min-|inset-|top-|right-|bottom-|left-|float-|data-)/;
const KEBAB_COMPONENT_SUFFIX = /-(modal|form|dialog|sidebar|popover|tab|list|card|button|widget|table|page|layout|header|footer|section|panel|gallery|grid|menu|nav|banner|badge|skeleton|spinner|tooltip|dropdown|select|input|textarea|checkbox|radio|switch|slider|avatar|icon|chip|toast|alert|bar|row|cell|item|field|wrapper|container|provider|context|hook|view|screen|chart|editor|builder|filler|picker|uploader|timeline|breadcrumb|steward|runner|tester|checker|resolver|reviewer|optimizer|detector|guard|enforcer)s?$/;
const KEBAB_DOMAIN_PREFIX = /^(actions?|helpers?|utils?|hooks?|types?|constants?|validations?|services?)-/;

/**
 * Decide whether a single token names a code symbol. Options select the
 * dialect a given call site needs (all default off):
 *   - allowlist: 'guard' | 'bash' | 'glob' — which prefix/skip rules to apply
 *   - rejectRegexSpecials: true — reject tokens containing regex metachars
 *       (Grep guard, whose tokens are raw and unsplit)
 *   - kebabComponents: true — apply the component-suffix carve-out so some
 *       kebab tokens (e.g. user-modal, actions-foo) count as symbols (Grep guard)
 *   - dottedSymbol: true — also accept dotted symbols like `mcp.Tool` (Grep guard)
 *   - stripZeroWidth: true — strip zero-width chars first (Glob guard)
 */
function isCodeSymbol(raw, opts = {}) {
  if (raw == null) return false;
  let s = String(raw);
  if (opts.stripZeroWidth) s = s.replace(SYMBOL_ZERO_WIDTH, '');
  if (s.length < 4) return false;
  if (/\s/.test(s)) return false;

  if (opts.rejectRegexSpecials && /[&?+[\]{}()\\^$*]/.test(s)) return false;

  if (opts.allowlist === 'guard') {
    const allow = [
      /^(TODO|FIXME|HACK|XXX|NOTE)/i,
      /^console\./, /^import\b/, /^require\(/, /^from\b/, /^export\b/,
      /^\/\//, /^#/, /^\./, /^http/i, /^\d/,
      /^[A-Z_]{3,}$/,
      /^[a-z]{1,8}$/,
      /^['"`]/,
      /^use (client|server)/,
    ];
    if (allow.some(rx => rx.test(s))) return false;
  } else if (opts.allowlist === 'bash') {
    const skip = [
      /^(TODO|FIXME|HACK|XXX|NOTE)/i,
      /^console\b/, /^import\b/, /^export\b/, /^http/i, /^\d/,
      /^[A-Z_]{3,}$/, /^[a-z]{1,8}$/, /^[a-z]+-[a-z]+/,
    ];
    if (skip.some(rx => rx.test(s))) return false;
  } else if (opts.allowlist === 'glob') {
    if (GLOB_SKIP_EXACT.has(s.toLowerCase())) return false;
    if (/^[a-z]{1,8}$/.test(s)) return false;
    if (/^[A-Z_]{3,}$/.test(s)) return false;
    if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(s)) return false; // kebab filenames
  }

  // Guard's kebab carve-out: some kebab tokens ARE symbols.
  if (opts.kebabComponents && /^[a-z]+-[a-z]/.test(s)) {
    if (KEBAB_TAILWIND_PREFIX.test(s)) return false;
    if (KEBAB_COMPONENT_SUFFIX.test(s)) return true;
    if (KEBAB_DOMAIN_PREFIX.test(s)) return true;
    return false;
  }

  const isCamelCase   = /^[a-z][a-zA-Z0-9]{3,}$/.test(s) && /[A-Z]/.test(s);
  const isPascalCase  = /^[A-Z][a-zA-Z][a-zA-Z0-9]{2,}$/.test(s);
  const isSnakeCaseFn = /^[a-z]+(_[a-z]+){2,}$/.test(s) && s.length >= 9;
  const isDotted      = opts.dottedSymbol && /^[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*$/i.test(s);

  return isCamelCase || isPascalCase || isSnakeCaseFn || !!isDotted;
}

/**
 * Split a search pattern into tokens and return those that name code symbols.
 * `opts.splitRe` selects the tokenizer (per call site); `opts.clean(token)`
 * optionally cleans each token before trimming. Remaining opts are forwarded
 * to isCodeSymbol.
 */
function extractSymbolsFromPattern(pattern, opts = {}) {
  const p = String(pattern ?? '');
  const splitRe = opts.splitRe || '|';
  const tokens = p.split(splitRe).map(t => {
    if (opts.clean) t = opts.clean(t);
    return t.trim();
  }).filter(Boolean);
  return tokens.filter(t => isCodeSymbol(t, opts));
}

module.exports = {
  // Constants
  SERENA_PREFIX,
  WARMUP_TOOL,
  TOOLS,
  STATE_DIR,
  FLAG_EXPIRY_MS,
  // State file
  getStateFilePath,
  readStateFile,
  writeStateFile,
  shouldEnforceSerena,
  isOutsideProject,
  // Health / failure handling
  classifySerenaFailure,
  isSerenaProcessAlive,
  attemptSerenaRestart,
  // Symbol detection
  isCodeSymbol,
  extractSymbolsFromPattern,
  SYMBOL_ZERO_WIDTH,
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
