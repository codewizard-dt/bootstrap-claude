'use strict';

/**
 * command-parse.js — shared parsing helpers for PreToolUse hooks
 *
 * Every helper here is fail-open: malformed input exits 0 silently rather than
 * throwing, because a hook that exits non-zero breaks the tool call it was
 * never meant to gate.
 */

/**
 * Accumulate the hook payload from stdin, parse it, and hand it to `handler`.
 * Unparseable input exits 0 without output. `handler` is expected to end the
 * process itself when it decides to deny; the trailing exit covers the
 * allow path.
 */
function readHookInput(handler) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { raw += d; });
  process.stdin.on('end', () => {
    let data;
    try { data = JSON.parse(raw); } catch { process.exit(0); }
    // The handler is guarded too, not just the parse: `null`, a number, or a
    // string are all valid JSON that no hook's `data.tool_name` survives. A
    // throw here would exit non-zero, which Claude Code reads as a hook failure
    // and which breaks the very tool call the hook exists to let through.
    // `deny()` exits before returning, so a real denial never reaches the catch.
    try { handler(data); } catch { process.exit(0); }
    process.exit(0);
  });
}

/**
 * Split a command into independently-inspectable segments. Pipes are included
 * alongside the separators so a blocked command cannot hide behind
 * `&&`, `;`, `||`, or `| tail -20`.
 *
 * QUOTING-UNAWARE, and every caller inherits it: the split is a plain regex, so
 * a separator inside quotes still splits (`grep "A|B" .env` becomes `grep "A`
 * and `B" .env`). That direction errs toward more segments and therefore toward
 * blocking, never toward allowing — but a rule that inspects only the FIRST
 * token of a segment can lose its match when a token is torn in half, which is
 * why env-content-read-guard.js re-runs its check over the whole command when
 * it sees both a quote and a pipe.
 */
function splitSegments(cmd) {
  return String(cmd ?? '').split(/;|&&|\|\||\|/).map(s => s.trim()).filter(Boolean);
}

function tokenize(segment) {
  return String(segment ?? '').trim().split(/\s+/).filter(Boolean);
}

function deny(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: String(reason),
    },
  }));
  process.exit(0);
}

module.exports = {
  readHookInput,
  splitSegments,
  tokenize,
  deny,
};
