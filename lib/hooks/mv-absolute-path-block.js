#!/usr/bin/env node
'use strict';

/**
 * mv-absolute-path-block.js — PreToolUse / Bash (wiring adds `if: Bash(mv *)`)
 *
 * Blocks: an `mv` with an absolute-path argument rooted outside the hook's idea
 *   of the project root (see BUG-0005 below — that idea is not the session's) —
 *   the "I thought I was somewhere else" move that lands a file in /etc, /usr,
 *   or a neighbouring repo.
 * Why a hook: whether an absolute path is acceptable depends on where the
 *   project root is, and a settings.json pattern cannot see the project root.
 *   Denying every absolute-path mv would deny the legitimate in-project ones
 *   too, and enumerating the roots worth protecting is precisely the unbounded
 *   list a hook exists to replace. The verdict also has to arrive as a
 *   CORRECTION ("check that you are in the project root") rather than a
 *   prohibition, and a deny rule cannot carry a message at all.
 * Fails: open — unparseable stdin exits 0 silently at the JSON.parse catch
 *   below. A payload that parses to a non-object (`null`) throws on
 *   `data.tool_name` and exits non-zero, which Claude Code reads as a
 *   NON-blocking hook error: stderr is surfaced and the tool call proceeds
 *   anyway. Both paths allow. This file does not use lib/command-parse.js's
 *   readHookInput, so there is no handler-level catch; of the hooks in this
 *   directory only interpreter-indirection-guard.js genuinely fails closed.
 * False positives: a pipeline is not a segment boundary here, so a later
 *   stage's absolute path is attributed to the `mv` —
 *   `mv notes.md archive.md | tee /var/log/mvlog.txt` denies a move that is
 *   entirely in-project (BUG-0006, annotated at the segment split below) —
 *   escape hatch: join with `&&` instead of `|`, which IS a segment boundary,
 *   so the `mv` is then judged on its own two operands.
 * See README.md § Safety / policy hooks for the full rationale.
 */

const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);

  const fullCmd = String(data.tool_input?.command ?? '').trim();
  if (!fullCmd) process.exit(0);

  // BUG-0005 — UNEXPLAINED DIVERGENCE, annotated here and deliberately not fixed.
  // Every sibling guard that needs a project root reads `data.cwd` off the hook
  // payload and falls back to `process.cwd()` only if it is missing
  // (protected-write-guard.js:189, claude-settings-guard.js:192,
  // interpreter-indirection-guard.js:579, serena-pre-delegation.js:95). This one
  // alone asks node and never looks at the payload. `data.cwd` is the
  // authoritative session cwd Claude Code reports for the tool call;
  // `process.cwd()` is merely wherever the node process running this hook was
  // started. When the two differ the check inverts in BOTH directions: absolute
  // paths that really are in-project stop matching `cwdWithSep` and get denied,
  // while paths under node's cwd but outside the session's project get allowed.
  // No comment, commit message, or test explains the choice, which is why it is
  // filed rather than assumed intentional. Do not swap it in passing — it is a
  // behaviour change to a live shipped control and belongs to BUG-0005.
  const cwd = process.cwd();
  const cwdWithSep = cwd + path.sep;

  // Split on command separators and inspect each segment independently.
  //
  // BUG-0006 — DIVERGENCE, annotated and deliberately not fixed: this list is
  // `;`, `&&`, `||` but NOT `|`, whereas lib/command-parse.js's splitSegments
  // (:48) includes the pipe. Read the next three paragraphs before touching it,
  // because the obvious reading of this gap is wrong.
  //
  // It is NOT a bypass. `args` is `tokens.slice(mvIdx + 1)` and runs to the end
  // of the segment, straight through any `|`, so an absolute path still lands in
  // `args` regardless of which pipeline stage wrote it:
  //     echo x | mv /etc/foo /tmp/bar      still denies
  //     cat mv | mv /etc/x /tmp/y          still denies
  //
  // The actual defect is the inverse — FALSE denials. Operands belonging to a
  // later stage are attributed to the `mv`, so a wholly in-project move that
  // merely logs somewhere absolute is refused:
  //     mv notes.md archive.md | tee /var/log/mvlog.txt      denies, wrongly
  //
  // WARNING TO THE NEXT READER: the tempting fix — anchor the verb at the head
  // of each segment, the way absolute-path-guard.js does — would OPEN the bypass
  // this only looks like it has. With `|` still absent from the split,
  // `echo x | mv /etc/foo /tmp/bar` is one segment headed by `echo`, and an
  // anchored check would stop seeing the `mv` entirely. Adding `|` to the split
  // and anchoring the verb are a single change, not two; either one alone makes
  // this hook strictly worse. That coupling is why it is filed as BUG-0006
  // instead of patched in place.
  //
  // One nuance if you go to reproduce any of the above: the shipped wiring gates
  // this hook behind `if: Bash(mv *)` (settings-hooks.json:104), so only commands
  // whose first token is `mv` reach the file at all. `echo x | mv /etc/foo …` is
  // filtered out upstream and never arrives, while the false-denial case does,
  // because it starts with `mv`. The gate lives in settings-hooks.json, not
  // here, so the logic above still has to stand on its own if it is relaxed.
  const segments = fullCmd.split(/;|&&|\|\|/).map(s => s.trim()).filter(Boolean);

  for (const segment of segments) {
    const tokens = segment.split(/\s+/);
    const mvIdx = tokens.findIndex(t => t === 'mv');
    if (mvIdx === -1) continue;

    // Arguments after 'mv', skipping flags (-n, -f, -v, etc.)
    //
    // `!t.startsWith('-')` is a heuristic, not getopt, and it is safe in this
    // one direction: every mv flag that takes a value takes a PATH as that value
    // (`-t /etc/cron.d`, `--target-directory=/etc/cron.d`). Dropping the flag
    // therefore leaves its value behind in `args`, still inspected — the naive
    // failure mode where a flag swallows the very path you wanted to check
    // cannot occur here. The cost is the mirror case: a file whose name starts
    // with `-` is skipped. That is free, because such a name cannot also start
    // with `/`, and an absolute path is the only thing this hook blocks.
    const args = tokens.slice(mvIdx + 1).filter(t => !t.startsWith('-'));

    const offendingArg = args.find(arg => {
      return arg.startsWith('/') && arg !== cwd && !arg.startsWith(cwdWithSep)
    });

    if (offendingArg) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'Please check that you are in the project root directory and then use a relative path instead.',
        },
      }));
      process.exit(0);
    }
  }

  process.exit(0);
});
