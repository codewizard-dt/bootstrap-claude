#!/usr/bin/env node
'use strict';

// git-protected-ops-block.js — PreToolUse hook (matcher: Bash)
//
// Hard-blocks `git stash`, `git restore`, and `git checkout` (and their
// subcommands, e.g. `git stash pop`) in ANY segment of a Bash command.
//
// Why a hook and not a deny rule: the permissions allow/deny engine is
// short-circuited under bypassPermissions mode (power-mode teammates,
// --dangerously-skip-permissions). PreToolUse hooks fire regardless of
// permission mode and for subagent tool calls, so this is the only
// enforcement point that reliably stops these commands everywhere.
//
// Matching is done in JS (not via the hook `if:` filter) so it never depends
// on the same matcher path that lets compound/piped commands slip through.

const BLOCKED_SUBCOMMANDS = new Set(['stash', 'restore', 'checkout']);

// `git` pre-subcommand options that consume the FOLLOWING token as their value.
// We skip both so we land on the real subcommand (e.g. `git -C /repo stash`).
const VALUE_OPTIONS = new Set(['-C', '-c', '--namespace', '--git-dir', '--work-tree', '--exec-path']);

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);

  const fullCmd = String(data.tool_input?.command ?? '').trim();
  if (!fullCmd) process.exit(0);

  // Split on command separators AND pipes, inspecting each segment alone so a
  // blocked command can't hide behind `&&`, `;`, `||`, or `| tail -20`.
  const segments = fullCmd.split(/;|&&|\|\||\|/).map(s => s.trim()).filter(Boolean);

  for (const segment of segments) {
    const tokens = segment.split(/\s+/);
    const gitIdx = tokens.findIndex(t => t === 'git');
    if (gitIdx === -1) continue;

    // Walk tokens after `git`, skipping global options (and the values of
    // options that take one) to find the actual subcommand.
    let i = gitIdx + 1;
    let subcommand = null;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok.startsWith('-')) {
        // `-C /path` / `-c k=v` style: skip the value token too, unless it's
        // an `--opt=value` form (self-contained).
        if (VALUE_OPTIONS.has(tok)) i += 1;
        i += 1;
        continue;
      }
      subcommand = tok;
      break;
    }

    if (subcommand && BLOCKED_SUBCOMMANDS.has(subcommand)) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            `Blocked: \`git ${subcommand}\` is disabled in this environment because it can ` +
            `silently discard or hide uncommitted work. This block is enforced even under ` +
            `bypassed permissions. If you need to set work aside, ask the user.`,
        },
      }));
      process.exit(0);
    }
  }

  process.exit(0);
});
