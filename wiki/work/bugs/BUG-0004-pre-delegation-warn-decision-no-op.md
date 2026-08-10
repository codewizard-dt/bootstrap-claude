---
id: BUG-0004
title: serena-pre-delegation emits decision 'warn', which may be an unrecognized no-op
status: open
severity: medium
priority: "—"
created: 2026-08-06
updated: 2026-08-06
reporter: David Taylor
assignee: unassigned
tags: "—"
linked_task: "[[TASK-039]]"
---

# BUG-0004 — serena-pre-delegation emits decision `warn`, which may be an unrecognized no-op

Found during `TASK-039` (hook commenting pass); annotated in the source at
`lib/hooks/serena-pre-delegation.js:216-223`.

**This finding is SUSPECTED, not confirmed.** It rests on a claim about what
PreToolUse decision values the Claude Code harness accepts, which has not been
verified against the harness. See "How to confirm" below — do not fix on the
strength of the reasoning alone.

## Summary

`lib/hooks/serena-pre-delegation.js:224` chooses between two decision values:

```js
const decision = (isForcedExplorer || isolation === 'worktree') ? 'block' : 'warn';
console.log(JSON.stringify({ decision, reason: [...].join('\n') }));
```

`block` is the honored legacy PreToolUse form. `warn` is not a value Claude Code
documents for PreToolUse. Two pieces of corroborating evidence inside this repo:

1. The sibling warn path — `serena-first-read-guard.js:96`,
   `emitWarning(msg)` — uses `console.log(JSON.stringify({ systemMessage: msg }))`
   instead. That is the shape the other Serena hook reaches for when it wants to
   warn rather than block.
2. Every blocking Serena hook additionally calls `process.exit(2)`
   (`serena-write-guard.js:109`, `serena-first-read-guard.js:97`,
   `serena-bash-grep-block.js:155`) — `serena-pre-delegation.js` exits 0 on both
   branches and relies entirely on the JSON envelope.

If `warn` is silently discarded, the entire generic implement-phase path emits
nothing, and this hook is effectively forced-explorer/worktree-only.

## Environment

- Platform: any; Node-based PreToolUse hook, matcher `Agent`
- Component: `lib/hooks/serena-pre-delegation.js`
- Version: repo at 2.17.0, commit `b85cbe9`

## Steps to Reproduce

The `warn` branch is hard to reach in this repo, which is itself part of the
problem — `lib/hooks/serena-pre-delegation.js:145-151` records that the `.task/`
convention is external and never produced here. To reach it:

1. Create `.task/2026-08-06-x/state.json` containing `{"phase":"implement"}` in
   the project root (mtime must be within the last 2 hours).
2. Spawn an Agent whose `subagent_type` is **not** on `FORCE_LSP_CONTEXT_AGENTS`
   or `EXEMPT_AGENTS`, whose `isolation` is not `worktree`, and whose `prompt`
   is ≥ 200 characters and contains no `## LSP CONTEXT` heading and none of the
   four `file.ext:NN` claim forms.
3. Observe whether anything is surfaced to the session.

Direct harness check (faster, and the one that actually settles it):

```
echo '{"decision":"warn","reason":"probe"}'
```

from a trivial PreToolUse hook, and observe whether "probe" reaches the
transcript.

## Expected Behavior

The implement-phase path is documented at `:206-214` as deliberately advisory —
it should surface a message telling the agent to add `## LSP CONTEXT`, without
stopping the delegation.

## Actual Behavior

Unknown, and that is the bug. Two possibilities:

- `warn` is honored → hook behaves as designed, and this should be closed
  `cannot-reproduce` with the harness behaviour recorded.
- `warn` is unrecognized → the JSON is discarded, nothing is emitted, and the
  advisory path has never done anything. The hook's docstring
  (`:10-12`, "implement-phase delegations") then overstates its coverage.

## Reproducibility

- `once` — reasoned from code, not yet observed at runtime
- First seen: 2026-08-06 (TASK-039 commenting pass)
- Last seen: 2026-08-06

## How to confirm

1. Check the Claude Code hooks documentation for the accepted PreToolUse
   `decision` values (and whether `hookSpecificOutput.permissionDecision` is now
   the canonical form).
2. Run the one-line probe above and check the transcript.
3. If `warn` is a no-op, the fix is to switch that branch to
   `{ systemMessage: … }`, matching `serena-first-read-guard.js:96`.

## Impact

If confirmed: one of the hook's two enforcement paths has been inert since it
was written, so the `.task/` scan, the two-hour freshness window, and the
`state.json` / `00-task.md` phase parsing at `:115-174` are all dead weight. No
security consequence — this hook is explicitly agent guidance and fails open by
design. Severity `medium` because the cost is a silently missing feature plus
~60 lines of code that appear load-bearing and are not.

## Workaround

> Forced explorers and worktree-isolated runs still block correctly. Adding
> `## LSP CONTEXT` to Agent prompts by hand achieves the intended outcome
> regardless.

## Root Cause Analysis

> _(filled at /bug-close)_

## Resolution

> _(filled at /bug-close)_

## Related

- Origin: `[[TASK-039]]`
- Sibling warn implementation to copy: `lib/hooks/serena-first-read-guard.js:96`
