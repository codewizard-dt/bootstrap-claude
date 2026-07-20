#!/usr/bin/env node
'use strict';

/**
 * serena-usage-tracker.js — PostToolUse + PostToolUseFailure hook
 *
 * Two jobs, keyed on the outcome of a Serena tool call:
 *
 *   SUCCESS — record readiness in ~/.claude/state/lsp-ready-<hash> (the warmup
 *     / nav counters that serena-first-read-guard.js gates on) and restore the
 *     provider's health to enforcing/healthy.
 *
 *   FAILURE — classify and drive fail-open enforcement:
 *     - tool-level (server alive, bad query / no matches / benign config
 *       decline): record the error, keep enforcing.
 *     - transport-level (process down / unreachable): probe the process
 *       (diagnostic only — never terminated; a hook invocation only exists
 *       because the round-trip completed, so the server already proved it's
 *       alive). If a live process remains, keep enforcing; if none remains,
 *       disable Serena-first enforcement for this project (fail open) and
 *       emit a one-time notice. Enforcement re-enables automatically on the
 *       next successful Serena call.
 *
 * Handles BOTH payload shapes: PostToolUse (`tool_response` / `result`) and
 * PostToolUseFailure (top-level `error`). This dual handling is also the
 * version-compatibility fallback — on Claude Code builds without
 * PostToolUseFailure, failed Serena calls still surface here via the
 * PostToolUse error-shaped `tool_response`.
 *
 * Recognises the standalone `mcp__serena__*` form and the plugin-wrapped
 * `mcp__plugin_<name>_serena__*` form via ./lib/serena.js#isLspProviderTool.
 */

const {
  isLspProviderTool,
  getStateFilePath, updateStateFile, defaultFlag, defaultHealth,
  classifySerenaFailure, isSerenaProcessAlive,
} = require('./lib/serena');

// Serena tools that advance the read-guard gate. The PostToolUse matcher is
// broadened to all Serena tools (so every call feeds health tracking), so the
// nav counters are gated HERE to preserve the read-guard's original behaviour:
// only these navigation/exploration tools bump warmup_done / nav_count.
const NAV_TOOLS = new Set([
  'find_symbol', 'find_referencing_symbols', 'get_symbols_overview',
  'find_file', 'search_for_pattern', 'list_dir',
]);

const UNHEALTHY_NOTICE =
  '⚠️ Serena MCP is unhealthy for this project and no live process was found. ' +
  'Serena-first enforcement is now disabled for this session; standard tools ' +
  '(Read/Grep/Edit) are permitted. It will re-enable automatically when a ' +
  'Serena call succeeds.';

/** Strip the mcp__serena__ / mcp__plugin_<x>_serena__ prefix from a tool name. */
function bareToolName(toolName) {
  const m = /^mcp__(?:plugin_[^_]+_)?serena__(.+)$/.exec(String(toolName));
  return m ? m[1] : '';
}

/**
 * Classify a PostToolUse response payload:
 *   'error' — a positive error signal (is_error flag, error field, "Error:" text)
 *   'empty' — no usable payload (ambiguous — treat as a no-op, never a failure)
 *   'ok'    — a genuine success
 */
function respErrorKind(resp) {
  if (resp == null) return 'empty';
  if (resp.is_error === true || resp.isError === true || resp.error) return 'error';
  if (Array.isArray(resp.content)) {
    for (const item of resp.content) {
      if (item && (item.is_error === true || item.isError === true)) return 'error';
      if (item && item.type === 'tool_result_error') return 'error';
    }
  }
  const s = typeof resp === 'string' ? resp : JSON.stringify(resp);
  if (/^Error[: ]|Error searching|Error finding|Error at /i.test(s)) return 'error';
  if (typeof resp === 'object' && !Array.isArray(resp) && Object.keys(resp).length === 0) return 'empty';
  return 'ok';
}

function summarizeError(payload) {
  let s;
  if (payload == null) s = '';
  else if (typeof payload === 'string') s = payload;
  else { try { s = JSON.stringify(payload); } catch { s = String(payload); } }
  return s.slice(0, 300);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(raw);
    const toolName = data.tool_name || '';
    if (!isLspProviderTool(toolName)) process.exit(0);

    const flagPath = getStateFilePath();

    if (data.error != null) {
      // PostToolUseFailure — definitively a failure.
      handleFailure(flagPath, data.error);
    } else {
      const resp = data.tool_response ?? data.result ?? {};
      const kind = respErrorKind(resp);
      if (kind === 'error') handleFailure(flagPath, resp);
      else if (kind === 'ok') handleSuccess(flagPath, toolName);
      // 'empty' ⇒ ambiguous PostToolUse with no payload: no-op (as before),
      // so a benign empty response never gets misclassified as a failure.
    }
  } catch {}
  process.exit(0);
});

function handleSuccess(flagPath, toolName) {
  updateStateFile(flagPath, defaultFlag, (flag) => {
    // A successful Serena call proves the server is alive — restore health
    // and re-arm the Gate 1 deadlock backstop (see serena-first-read-guard.js).
    flag.health = defaultHealth();
    flag.health.last_check = Date.now();
    flag.warmup_block_count = 0;

    // Only navigation/exploration tools advance the read-guard gate.
    if (NAV_TOOLS.has(bareToolName(toolName))) {
      if (!flag.warmup_done) {
        flag.warmup_done = true;
        flag.cold_start_retries = 0;
      } else {
        flag.nav_count = (flag.nav_count || 0) + 1;
      }
    }

    flag.timestamp = Date.now();
    flag.last_tool = toolName;
    return flag;
  });
}

function handleFailure(flagPath, payload) {
  const kind = classifySerenaFailure(payload);
  const cwd = process.cwd();
  let notice = null;

  updateStateFile(flagPath, defaultFlag, (flag) => {
    const health = flag.health || defaultHealth();
    health.error_count = (health.error_count || 0) + 1;
    health.last_error = summarizeError(payload);
    health.last_check = Date.now();

    // Tool-level failure: the server answered, the query just didn't
    // resolve (or declined for a benign reason). Keep enforcing.
    if (kind === 'tool') {
      flag.health = health;
      flag.timestamp = Date.now();
      return flag;
    }

    // Transport-level failure: diagnostic-only probe. This never terminates
    // the process — a hook invocation only exists because the MCP
    // round-trip completed, so the server necessarily responded and is not
    // "hung." See isSerenaProcessAlive's docstring in lib/serena.js.
    const alive = isSerenaProcessAlive(cwd);
    health.healthy = false;

    if (alive) {
      // A live process remains — keep enforcing, just record the error.
      flag.health = health;
      flag.timestamp = Date.now();
      return flag;
    }

    // No live process — fail open so the agent isn't trapped between a
    // broken Serena and blocked fallbacks.
    health.should_enforce = false;
    if (!health.notified) {
      health.notified = true;
      notice = JSON.stringify({ systemMessage: UNHEALTHY_NOTICE });
    }
    flag.health = health;
    flag.timestamp = Date.now();
    return flag;
  });

  if (notice) console.log(notice);
}
