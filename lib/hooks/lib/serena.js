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
 *
 * ── This is a library, not a hook ─────────────────────────────────────────
 * It is never wired in lib/scripts/templates/settings-hooks.json, has no
 * stdin/stdout contract, and must never call process.exit — every consumer is
 * fail-open, and an uncaught throw here would take down a tool call the hook
 * was never meant to gate. Hence the swallowed catches throughout: silent
 * degradation is the correct failure mode for this file specifically.
 *
 * Nine hooks require it (all siblings in ../, installed to ~/.claude/hooks/):
 *   serena-first-guard.js       Grep         symbol detection
 *   serena-first-glob-guard.js  Glob         symbol detection ('glob' dialect)
 *   serena-bash-grep-block.js   Bash         symbol detection ('bash') + paths
 *   serena-first-read-guard.js  Read         state file, gates, isAllowedPath
 *   serena-edit-guard.js        Edit|MultiEdit   isAllowedPath + block copy
 *   serena-write-guard.js       Write            isAllowedPath + block copy
 *   serena-usage-tracker.js     PostToolUse(+Failure)  state file, health
 *   serena-session-reset.js     SessionStart     state file path
 *   serena-pre-delegation.js    Agent            fail-open gate only
 * A behaviour change here lands in all nine at once and there is no way to roll
 * one back independently — which is why the call-site differences are expressed
 * as explicit `opts` (see isCodeSymbol's dialect table) rather than as branches
 * on who is calling.
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
 * Minimal presence check: scans the known MCP config stores for a `serena` key
 * — top-level mcpServers plus ~/.claude.json projects[<cwd>].mcpServers (local
 * scope, the bootstrap default). Returns true if Serena is registered.
 */
function hasSerena() {
  const candidates = [
    path.join(HOME, '.claude.json'),
    path.join(HOME, '.claude', 'settings.json'),
    path.join(HOME, '.claude', 'mcp.json'),
    path.join(HOME, '.mcp.json'),
    path.join(process.cwd(), '.mcp.json'),
  ];
  const hasSerenaKey = (servers) => {
    if (!servers || typeof servers !== 'object') return false;
    for (const name of Object.keys(servers)) {
      if (String(name).toLowerCase() === SERENA_TOKEN) return true;
    }
    return false;
  };
  for (const p of candidates) {
    const data = readJsonSilent(p);
    if (hasSerenaKey(data?.mcpServers)) return true;
    // Local-scope servers (the bootstrap default for serena) live in
    // ~/.claude.json under projects[<abs path>].mcpServers, not top-level.
    const projects = data?.projects;
    if (projects && typeof projects === 'object') {
      const cwd = process.cwd();
      for (const [projPath, proj] of Object.entries(projects)) {
        if ((cwd === projPath || cwd.startsWith(projPath + path.sep)) && hasSerenaKey(proj?.mcpServers)) {
          return true;
        }
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

/**
 * Write the state file atomically (temp file + rename, same directory so the
 * rename is same-filesystem) — a torn write can never leave invalid JSON on
 * disk. mkdir -p, silent failure — hooks must never throw.
 */
function writeStateFile(fp, data) {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    const tmp = `${fp}.tmp.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, fp);
  } catch { /* silent */ }
}

/** Default shape of the per-project state file before any hook has written it. */
function defaultFlag() {
  return {
    cwd: process.cwd(), warmup_done: false, nav_count: 0, read_count: 0,
    read_files: [], warmup_block_count: 0,
  };
}

/** Default shape of the state file's `health` sub-object. */
function defaultHealth() {
  return { should_enforce: true, healthy: true, error_count: 0, last_error: null, last_check: 0, notified: false };
}

// ── Advisory locking (dependency-free) ──────────────────────────────────────
// The state file is written by two independent hook scripts
// (serena-usage-tracker.js and serena-first-read-guard.js) on the same path
// with no other coordination between them. acquireLock/releaseLock/
// updateStateFile give both callers a short-lived, self-healing mutex around
// the full read-modify-write cycle, so concurrent writers can no longer lose
// each other's updates. This fails open by design — a hook that can't get
// the lock within budget proceeds unlocked rather than hanging; hooks must
// never block indefinitely.
// Why these three numbers. The critical section is a read, a JSON.parse, an
// in-memory mutate and an atomic rename — sub-millisecond in practice. A lock
// still held after LOCK_STALE_MS (750ms) is therefore not contended, it is
// orphaned by a hook process that died mid-cycle; nothing auto-releases a plain
// marker file, so without a staleness rule one crash wedges every later state
// write for the rest of the session. 750ms sits far enough above the real cost
// that clearing a genuinely live holder takes a pathological stall.
//
// LOCK_RETRY_BUDGET_MS (250ms) is the other side of the trade: it caps what a
// *waiting* hook adds to a tool call it was never meant to slow down. On
// exhaustion the caller proceeds unlocked and best-effort — a lost counter
// update is cheap, a PreToolUse hook that hangs is not. Being well under
// LOCK_STALE_MS means a waiter normally gives up rather than clearing a lock
// whose holder is merely slow. (Staleness is judged from the lock file's own
// mtime, not from how long this waiter has waited, so a waiter that arrives late
// in a stale lock's life still clears it immediately — that is the self-heal
// working, not a violation of the budget.)
//
// The backoff ladder tops out at 80ms, so the budget covers about five wakeups:
// enough to yield to a real holder, few enough that waiting is never the cost.
const LOCK_STALE_MS = 750;
const LOCK_RETRY_BUDGET_MS = 250;
const LOCK_BACKOFF_MS = [10, 20, 40, 80];

/** Block the current thread for `ms` ms without spawning a process (no execSync). */
function blockingSleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const until = Date.now() + ms;
    while (Date.now() < until) { /* busy-wait fallback */ }
  }
}

/**
 * Acquire an exclusive lock at `${fp}.lock`. Returns the lock path on
 * success, or null if the retry budget was exhausted (caller proceeds
 * unlocked, best-effort). Self-heals a lock orphaned by a crashed hook
 * process — nothing auto-releases a plain marker file, so a lock older than
 * LOCK_STALE_MS is forcibly cleared and retried immediately.
 */
function acquireLock(fp) {
  const lockPath = `${fp}.lock`;
  const deadline = Date.now() + LOCK_RETRY_BUDGET_MS;
  let attempt = 0;
  while (true) {
    try {
      fs.closeSync(fs.openSync(lockPath, 'wx'));
      return lockPath;
    } catch (err) {
      if (err && err.code !== 'EEXIST') return null;
    }
    try {
      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age > LOCK_STALE_MS) {
        try { fs.unlinkSync(lockPath); } catch {}
        continue; // retry immediately after clearing a stale lock
      }
    } catch { /* lock disappeared between attempts — retry */ }
    if (Date.now() >= deadline) return null;
    blockingSleep(LOCK_BACKOFF_MS[Math.min(attempt, LOCK_BACKOFF_MS.length - 1)]);
    attempt++;
  }
}

/** Best-effort lock release. Never throws. */
function releaseLock(lockPath) {
  if (!lockPath) return;
  try { fs.unlinkSync(lockPath); } catch { /* silent */ }
}

/**
 * Locked read-modify-write cycle for the state file. `mutatorFn(data)`
 * mutates `data` in place and/or returns a replacement object; the result is
 * written atomically. `defaultFactory()` supplies the initial object when no
 * state file exists yet. Callers must derive their field updates from `data`
 * as passed to `mutatorFn` (the freshly-locked read) — never from a snapshot
 * read before the lock was acquired, or a concurrent writer's update can
 * still be lost even though the write itself is now atomic.
 */
function updateStateFile(fp, defaultFactory, mutatorFn) {
  const lockPath = acquireLock(fp);
  try {
    const data = readStateFile(fp) || defaultFactory();
    const result = mutatorFn(data) || data;
    writeStateFile(fp, result);
    return result;
  } finally {
    releaseLock(lockPath);
  }
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
 * bad query / no matches / benign config-related decline — keep enforcing)
 * or a 'transport'-level failure (process down/unreachable — assess health).
 * A null/empty payload (no content to classify at all) defaults to
 * 'transport' so health still gets assessed in that genuinely ambiguous
 * case. Any other UNRECOGNIZED payload defaults to 'tool': receiving one at
 * all already proves the round-trip completed, which is proof of life, not
 * evidence of a dead transport.
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

  // Tool-level: the server answered, the query just didn't resolve, or it
  // declined for a benign/config reason (e.g. the file's language isn't
  // enabled in .serena/project.yml — a normal, expected response).
  // The alternation is grouped by what Serena's error strings actually say, not
  // by an error taxonomy: query misses ("not found", "no results", "no matching",
  // "no symbol", "could not find"), path misses ("does not exist", "no such
  // file/symbol/path/directory"), the "error at <location>" form emitted for a
  // bad location, and — the group that matters most — the language-config
  // declines ("cannot extract symbols", "active languages", "unsupported
  // language", "no language server"). A file whose language is not enabled in
  // .serena/project.yml fails on EVERY call, so misfiling that group as
  // transport would shell out to pgrep on each one and, the first time the probe
  // came back empty, disable Serena-first enforcement for the whole project on
  // the strength of a perfectly healthy server declining a file type.
  if (/not found|no results|no matching|no symbol|could not find|error searching|error finding|does not exist|no such (?:file|symbol|path|directory)|error at |cannot extract symbols|active languages|unsupported language|no language server/i.test(s)) {
    return 'tool';
  }
  // Transport-level: the server is unreachable / the pipe broke.
  // Transport-level: nothing in this alternation describes a query, only a pipe.
  // `closed`, `reset` and `connection` are bare because they arrive with no
  // stable prefix ("connection closed", "transport closed", "socket reset").
  //
  // Ordering is load-bearing: a single error string can match both lists
  // ("connection to the language server closed: symbol not found"), and first
  // match wins, so the narrower tool-level test must run first. Swapping the two
  // blocks would route ordinary query misses that merely mention a connection
  // into the health-assessment path.
  if (/timeout|timed out|connection|refused|econnrefused|socket|epipe|closed|disconnect|not connected|unreachable|reset|broken pipe|hang/i.test(s)) {
    return 'transport';
  }
  // Unknown ⇒ tool-level. This hook only runs because the MCP round-trip
  // completed with a payload to classify, which already proves the server
  // responded — never proof of a dead transport. A missed real transport
  // failure just delays detection to the next failed call; defaulting to
  // 'transport' instead risked treating an ordinary, unanticipated tool
  // error as grounds to assess (and previously, kill) a live process. See
  // raw/research/serena-mcp-disconnect/index.md for the incident this fixes.
  return 'tool';
}

/** Build a pgrep pattern matching a Serena server bound to `projectDir`. */
function serenaProcPattern(projectDir) {
  // Escape regex metacharacters (pgrep uses extended regex), then escape
  // single quotes for safe single-quote shell wrapping.
  const escaped = String(projectDir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `serena start-mcp-server.*${escaped}`.replace(/'/g, `'\\''`);
}

/**
 * True if a Serena MCP server process for `projectDir` is currently running.
 * Diagnostic only — this is never used to decide whether to terminate the
 * process. A process that just answered a tool call (even with an error) has
 * already proven it is alive and responsive, not hung; there is also no
 * documented way to reconnect a stdio MCP server mid-session, so killing one
 * has no realistic upside and a confirmed, irreversible downside. See
 * raw/research/serena-mcp-disconnect/index.md.
 */
function isSerenaProcessAlive(projectDir) {
  try {
    execSync(`pgrep -f '${serenaProcPattern(projectDir)}'`, { stdio: 'pipe' });
    return true;
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

// Zero-width and bidi formatting characters. They render as nothing, so
// `create<ZWSP>Order` is visually identical to `createOrder` while every ASCII
// shape regex below fails to match it — a single pasted character is enough to
// walk a symbol search past the guards. Stripping is opt-in (`stripZeroWidth`)
// because the three call sites handle it differently: the Glob guard sets the
// flag, the Bash guard strips them in its own `clean` callback before tokens
// ever reach here, and the Grep guard (serena-first-guard.js) does NEITHER.
//
// SUSPECTED DEFECT — annotated, deliberately not fixed in this comments-only
// pass. That third case leaves the exact bypass this constant exists to close
// still open on the Grep surface: a zero-width character inside a Grep pattern
// token is neither stripped nor rejected (it is not a regex metacharacter, so
// rejectRegexSpecials does not catch it). The fix is one option at that call
// site, but it needs its own regression test rather than riding along here.
const SYMBOL_ZERO_WIDTH = /[­​-‏⁠-⁤﻿]/g;

// Why this list is ~150 entries long, and what earns a place on it. The Glob
// guard hands over a pattern already shredded into fragments — `src/**/*Modal.tsx`
// becomes `src`, `Modal`, `tsx` — and by the time a fragment reaches
// isCodeSymbol there is no context left to distinguish "this was the extension"
// from "this was a symbol". So every fragment a legitimate file-discovery glob
// routinely produces has to be named here, or the guard blocks ordinary work:
// extensions, directory names, file stems, framework/tool config stems, and the
// directive words people search for. The length is the cost of exact matching;
// each entry is one word that would otherwise be judged on its shape alone.
//
// The bar for adding an entry: the token shows up in globs people write to find
// files by location or kind, and nobody writes it meaning a symbol. `Modal`
// fails that test (it is a real component name) and is deliberately absent;
// `middleware`, `providers`, and `transformers` pass it and are present even
// though each is also a plausible identifier — because here a false block costs
// a real search while a false allow costs only a slower route to the same files.
//
// Matched lowercased and EXACTLY. Substring matching would exempt `UserService`
// for containing `service`, which is the entire class of token this guard exists
// to catch. (`next` and `turbo` appear under two group headings; Set membership
// makes the duplicate inert.)
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

// ── The kebab carve-out (Grep dialect only) ────────────────────────────────
// A kebab token is normally a filename, not a symbol, and the Glob dialect
// rejects the shape outright for exactly that reason. The Grep dialect cannot
// afford to: in a React/Next codebase the component and its file share a name,
// so a developer greps `user-modal` meaning the component. These three regexes
// triage that, and they are tested in the order they are declared.
//
// KEBAB_TAILWIND_PREFIX — the dominant false positive by volume, and the reason
// the carve-out needs a reject list at all. A Tailwind project's markup is
// wall-to-wall `text-sm`, `bg-white`, `hover:bg-gray-100`, `max-w-md`,
// `data-state` — every one a kebab token of symbol-ish length. Grepping a
// utility class is a styling search over markup, never a symbol lookup, and
// Serena has nothing better to offer for it, so these must fall through to Grep
// or the guard makes CSS work impossible. The list is the Tailwind utility
// prefix set (spacing, sizing, colour, layout, typography, transition, and the
// `hover:`/`focus:`/`active:`/`group-` state variants); it is not exhaustive,
// it stops where class attributes stop.
//
// KEBAB_COMPONENT_SUFFIX — the inverse judgement. A kebab token ending in a
// UI-part noun (`user-modal`, `date-picker`, `nav-bar`, `error-boundary`) names
// something that exists as a symbol, so Serena can answer for it. The trailing
// `s?` covers the plural filename convention (`user-cards`). The agent-role tail
// (`-runner`, `-reviewer`, `-checker`, `-resolver`, `-guard`, `-enforcer`) is
// not decoration: this repo and the kit it was ported from name their own
// subagents and hook scripts that way, so it is the local vocabulary and the
// tokens actually get searched for.
//
// KEBAB_DOMAIN_PREFIX — the same call from the other end. A token whose FIRST
// segment is a code-layer word (`actions-`, `helpers-`, `utils-`, `hooks-`,
// `types-`, `constants-`, `validations-`, `services-`) is naming code whatever
// follows it, so the suffix never has to be enumerated.
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
  // Ordering: strip zero-width first, then measure. Measuring first would let a
  // padded 3-character name clear the floor and then fail every shape test below
  // — allowed, but for the wrong reason, and silently.
  //
  // The 4-character floor and the whitespace reject are the two rules every
  // dialect shares. Below 4 characters the shape tests stop discriminating (`ab`,
  // `x1`, `Foo` are as likely to be prose as code) and find_symbol is not the
  // better tool for such a name anyway. Whitespace means the token is a phrase,
  // and a phrase is a text search — which is precisely what Grep is for.
  if (opts.stripZeroWidth) s = s.replace(SYMBOL_ZERO_WIDTH, '');
  if (s.length < 4) return false;
  if (/\s/.test(s)) return false;

  // Grep dialect only. Its tokens arrive raw, so one still carrying `(`, `[`,
  // `\`, `^`, `$`, `*`, `+`, `?` or `&` is a regex fragment, not a name — and
  // Serena's find_symbol takes a name, not a pattern. Blocking there would trade
  // a working regex search for a tool that cannot express it. The other two
  // dialects never need this: the Bash call site strips the same metacharacters
  // in `clean`, and the Glob splitRe consumes them as delimiters.
  if (opts.rejectRegexSpecials && /[&?+[\]{}()\\^$*]/.test(s)) return false;

  // ── The three allowlist dialects ─────────────────────────────────────────
  // This is the entire false-positive surface of three hooks, so the differences
  // below are deliberate rather than drift. Every dialect answers one question —
  // "would blocking this token cost the caller a search Serena cannot do?" — for
  // a different input shape:
  //
  //   'guard'  serena-first-guard.js (Grep). Tokens are raw pattern fragments,
  //            split on `|` and nothing else, so they can still be comment
  //            markers, quoted strings, JS keywords, or call syntax. Hence the
  //            widest reject list (`^//`, `^#`, `^.`, `^['"` + backtick`]`,
  //            `require(`, `console.`, `use client|server`): every one of those
  //            is a thing people grep for, and none of them is a symbol name.
  //   'bash'   serena-bash-grep-block.js (a grep/rg command line). The call site
  //            has already stripped regex metacharacters in its `clean`
  //            callback, so the list is shorter — but it adds
  //            `^[a-z]+-[a-z]+`, rejecting kebab outright. A shell grep for
  //            `user-modal` is usually hunting a filename or a CSS class, and
  //            this dialect never sets kebabComponents, so the two agree.
  //   'glob'   serena-first-glob-guard.js (a file glob). Tokens are path
  //            fragments, so prefix rules do not apply; it uses GLOB_SKIP_EXACT
  //            — an exact-match vocabulary of everything a legitimate glob
  //            produces — plus a full kebab-filename reject, because inside a
  //            glob a kebab token IS a filename.
  //
  // Passing no allowlist (the default) applies none of this: only the shared
  // floors above and the shape tests below. Nothing in this repo calls it that
  // way. It is the honest default for a new call site that has not yet decided
  // what its tokens look like, and it is also the STRICTEST — with no rejects it
  // calls more things symbols and therefore blocks more.
  //
  // Two rules recur in all three lists and carry most of the weight:
  // `^[A-Z_]{3,}$` (SCREAMING_SNAKE is a constant or an env var — grep is the
  // right tool, find_symbol is not) and `^[a-z]{1,8}$` (a short all-lowercase
  // word is too generic to be worth a symbol lookup). `^\d` and `^http` appear
  // in the two prefix-based dialects; the glob dialect covers the same ground by
  // exact match (`http`, `https` are in GLOB_SKIP_EXACT).
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
    // Ordering trap: the kebab-filename reject below sits ABOVE the
    // kebabComponents carve-out further down, so a caller passing both
    // `allowlist: 'glob'` and `kebabComponents: true` would never reach the
    // carve-out and every kebab component name would be allowed. No call site
    // does that today — the two options are mutually exclusive by intent, and
    // nothing here enforces it.
    if (GLOB_SKIP_EXACT.has(s.toLowerCase())) return false;
    if (/^[a-z]{1,8}$/.test(s)) return false;
    if (/^[A-Z_]{3,}$/.test(s)) return false;
    if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(s)) return false; // kebab filenames
  }

  // Guard's kebab carve-out: some kebab tokens ARE symbols.
  // Reached only from the Grep dialect — it is the sole call site that sets
  // kebabComponents. The `^[a-z]+-[a-z]/` test scopes the block to lowercase
  // kebab; anything else falls straight through to the shape tests below.
  //
  // Overlaps resolve top-down, and there are real ones: `grid-item` and
  // `text-field` carry a Tailwind prefix *and* a component suffix, and the
  // prefix wins, so they are treated as styling and the Grep is allowed. That
  // error direction is the cheap one — a permitted Grep costs a slower route to
  // the same lines, while a wrong block costs a search Serena cannot perform.
  //
  // The trailing `return false` is the actual policy of this block: an
  // unrecognised kebab token is a filename until proven otherwise.
  if (opts.kebabComponents && /^[a-z]+-[a-z]/.test(s)) {
    if (KEBAB_TAILWIND_PREFIX.test(s)) return false;
    if (KEBAB_COMPONENT_SUFFIX.test(s)) return true;
    if (KEBAB_DOMAIN_PREFIX.test(s)) return true;
    return false;
  }

  // The shapes that mean "this is an identifier". What each one is really doing:
  //   camelCase   requires an interior capital; the `{3,}` bound only restates
  //               the shared 4-character floor above.
  //   PascalCase  requires the *second* character to be a letter, so `S3Client`
  //               and `X11Server` are not recognised. That miss is real; no
  //               rationale for excluding a digit there is recoverable from the
  //               code or the README — verify before relying on it either way.
  //   snake_case  demands three or more segments AND 9+ characters, because
  //               two-segment snake (`user_id`, `my_var`, `is_open`) is far more
  //               often a column, a flag, or a variable than a function anyone
  //               would navigate to — and blocking those would break routine
  //               grepping of SQL and config text.
  //   dotted      Grep-only (`mcp.Tool`, `router.push`): a module-qualified name.
  //               The Bash dialect splits on `.` and the Glob dialect treats it
  //               as a path separator, so the raw-token dialect is the only one
  //               that can ever see one intact.
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
// The tokenizer belongs to the call site, not to this function, because the
// three pattern syntaxes disagree about what a delimiter is:
//   Grep  splitRe '|'              regex alternation and nothing else; a dot
//                                  stays inside the token (see dottedSymbol).
//   Bash  splitRe /\\?\||\./       alternation plus dots — a shell grep pattern
//                                  keeps `mcp.Tool` as one token, and the
//                                  call site's `clean` strips the dot, which
//                                  would manufacture `mcpTool`, a camelCase
//                                  false positive out of thin air.
//   Glob  splitRe /[*/.\\{}...]+/  all punctuation — a glob is a path, and its
//                                  punctuation is structure, not content.
// Choosing wrong does not fail loudly: it silently changes which tokens exist,
// and therefore which searches get blocked. `opts` is forwarded whole to
// isCodeSymbol, so a call site's splitRe and its dialect must be picked together
// — see the dialect table in isCodeSymbol.
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
  acquireLock,
  releaseLock,
  updateStateFile,
  defaultFlag,
  defaultHealth,
  shouldEnforceSerena,
  isOutsideProject,
  // Health / failure handling
  classifySerenaFailure,
  isSerenaProcessAlive,
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
