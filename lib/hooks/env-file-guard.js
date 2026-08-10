#!/usr/bin/env node
'use strict';

/**
 * env-file-guard.js — PreToolUse / Read|Write|Edit|MultiEdit
 *
 * Blocks: file-tool reads and writes of any .env file, at any path in the tree.
 * Why a hook: a deny rule matches one literal spelling. settings-deny.json
 *   carries Read entries for `.env` and `.env.local` only (:58-59), so
 *   `.env.production` and every future suffix would each need their own line,
 *   and Write/Edit/MultiEdit are not covered by them at all. The harder half is
 *   the `.env.example` carve-out: it is a hole INSIDE the pattern, and a deny
 *   list has no "except" — an allow entry does not override a deny entry. "Every
 *   `.env.` variant but one" is only expressible in code. A hook also returns a
 *   reason, and the reason is what points at the permitted alternative
 *   (`source .env`) — the difference between a policy and a wall people route
 *   around.
 * Fails: open — unparseable stdin exits 0 silently at the JSON.parse catch
 *   below. A payload that parses but is not an object (`null`, a number) throws
 *   out of the `const { tool_name, tool_input } = data` destructure and exits
 *   non-zero, which Claude Code treats as a NON-blocking hook error: stderr is
 *   surfaced to the user but the tool call still proceeds. So both failure paths
 *   allow — one quietly, one loudly. This file predates lib/command-parse.js and
 *   does not use its readHookInput, so it has no handler-level catch to make the
 *   second path silent the way the command-class guards do.
 * False positives: the test is a basename prefix, so `.env.template`,
 *   `.env.sample`, and even a doc named `.env.local.md` are all treated as live
 *   secrets — escape hatch: name the file so its basename does not begin with
 *   `.env.` (`env.template` and `example.env` both pass cleanly), or use the one
 *   permitted spelling, `.env.example`.
 * See README.md § Safety / policy hooks for the full rationale.
 */

const path = require('path');

// KEPT BYTE-IDENTICAL WITH env-content-read-guard.js:86-98. If the allow-list
// changes, change it in both places or in neither — two .env controls that
// disagree about which files are secret is worse than one control. It also
// matches the gitignore this repo ships (`.env`, `.env.*`, `!.env.example`), so
// "secret" is defined the same way by the guard and by the thing that keeps the
// file out of git.
//
// BUG-0007 tracks extracting this into lib/ so the two copies cannot drift.
// Until it lands the duplication is load-bearing and this warning is the only
// thing holding it together — README.md:522-525 records why it was deferred
// (extraction means editing two live shipped controls for a pure refactor).
// Until now only the twin carried the warning; both sides do from here on.
function isBlockedEnvFile(filePath) {
  if (!filePath) return false;
  const basename = path.basename(String(filePath));
  // Block .env exactly, and .env.* variants (e.g. .env.local, .env.production)
  // Allow .env.example — the one permitted exception
  return basename === '.env' ||
    (basename.startsWith('.env.') && basename !== '.env.example');
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }

  const { tool_name, tool_input } = data;
  let blocked = null;

  if (['Read', 'Write', 'Edit'].includes(tool_name)) {
    const fp = tool_input?.file_path;
    if (isBlockedEnvFile(fp)) blocked = fp;
  } else if (tool_name === 'MultiEdit') {
    const edits = Array.isArray(tool_input?.edits) ? tool_input.edits : [];
    const bad = edits.find(e => isBlockedEnvFile(e?.file_path));
    if (bad) blocked = bad.file_path;
  }

  if (blocked) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `.env policy: "${blocked}" cannot be read or written. Only .env.example is permitted. You may source an .env file in a Bash command to use its variables.`
      }
    }) + '\n');
  }

  process.exit(0);
});
