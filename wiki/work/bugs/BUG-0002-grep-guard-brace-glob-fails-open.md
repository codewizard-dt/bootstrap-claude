---
id: BUG-0002
aliases: [BUG-0002]
title: Grep guard fails open on a brace glob mixing code and non-code extensions
status: open
severity: high
priority: "—"
created: 2026-08-06
updated: 2026-08-06
reporter: David Taylor
assignee: unassigned
tags: "—"
linked_task: "[[TASK-039]]"
---

# BUG-0002 — Grep guard fails open on a brace glob mixing code and non-code extensions

Found during `TASK-039` (hook commenting pass); annotated in the source at
`lib/hooks/serena-first-guard.js:88-91`.

## Summary

The extension pre-filter at `lib/hooks/serena-first-guard.js:92-96` is a
two-step test:

```js
if (/\.(txt|log|json|jsonc|yaml|yml|env|csv|toml|xml|sql|sh|css|scss)/i.test(glob)) {
  const m = glob.match(/\.([a-z0-9]+)(?:[^a-z0-9]|$)/i);
  const ext = m ? m[1].toLowerCase() : '';
  if (!ext || !getEnabledExtensionsSet().has(ext)) process.exit(0);
}
```

Step 1 (does the glob mention a non-code extension?) is unanchored and matches
anywhere. Step 2 re-extracts a single extension and defers to the project's
enabled Serena languages. A **brace glob** satisfies step 1 but defeats step 2:
the re-extraction finds no `.<letters><delimiter>` sequence, `ext` is `''`, and
`!ext` short-circuits to `process.exit(0)`.

The result is that symbol enforcement is skipped for the *code* half of a mixed
brace glob.

## Environment

- Platform: any; Node-based PreToolUse hook
- Component: `lib/hooks/serena-first-guard.js` (PreToolUse / `Grep`)
- Version: repo at 2.17.0, commit `b85cbe9`

## Steps to Reproduce

1. Serena healthy for the project (`shouldEnforceSerena()` true).
2. Issue a Grep with a brace glob mixing a code extension and a listed non-code
   extension, and a pattern that is unambiguously a code symbol:

   ```
   Grep(pattern="createOrderHandler", glob="**/*.{ts,json}")
   ```

3. Trace the two regexes against `**/*.{ts,json}`:
   - Step 1: `/\.(…|json|…)/i` matches the `.json` inside the brace list → enter
     the branch.
   - Step 2: `/\.([a-z0-9]+)(?:[^a-z0-9]|$)/i` needs a `.` followed by
     alphanumerics followed by a non-alphanumeric or end-of-string. In
     `**/*.{ts,json}` the only `.` is immediately followed by `{`, so the
     capture group cannot match → `m === null` → `ext === ''`.
   - `!ext` is true → `process.exit(0)`.

## Expected Behavior

A glob that scopes the search to at least one extension Serena indexes should
stay enforced. `Grep(pattern="createOrderHandler", glob="**/*.{ts,json}")`
should block and suggest `find_referencing_symbols`, exactly as
`glob="**/*.ts"` does today.

## Actual Behavior

The hook exits 0 silently. No stderr, no structured block envelope. The `.ts`
half of the search runs with no Serena-first enforcement at all.

Contrast:
- `glob="**/*.ts"` → step 1 does not match → falls through → **enforced**.
- `glob="**/*.json"` → step 1 matches, step 2 extracts `json`, not an enabled
  extension → exits 0 → correctly **not enforced**.
- `glob="**/*.{ts,json}"` → **not enforced** — wrong.

## Reproducibility

- `always`
- First seen: 2026-08-06 (TASK-039 commenting pass)
- Last seen: 2026-08-06

## Impact

A single-character change to a glob (`.ts` → `.{ts,json}`) turns the guard off
for the whole search. It is trivially reachable by accident — brace globs are
idiomatic — and it is exactly the shape an agent trying to route around the
guard would reach for. Silent, complete skip; hence `high`.

## Workaround

> None needed to trigger it. To *keep* enforcement, split the search into one
> Grep per extension.

## Notes for the fixer

- The two regexes answer different questions and the second cannot see brace
  syntax. The likely fix is to extract **every** extension the glob mentions
  (expand braces, or match all `[a-z0-9]+` runs inside `{…}`) and enforce if
  **any** of them is an enabled Serena extension.
- `!ext` currently means "unparseable → allow". That fail-open default is the
  second half of the bug: an unparseable glob combined with a code-symbol
  pattern is the case most worth enforcing, not least.
- Regression test cases: `**/*.{ts,json}` blocks; `**/*.{json,yaml}` passes;
  `**/*.ts` blocks; `**/*.json` passes; `src/**/*.{tsx,css}` blocks.

## Root Cause Analysis

> _(filled at /bug-close)_

## Resolution

> _(filled at /bug-close)_

## Related

- Origin: `[[TASK-039]]`
- Siblings: `[[BUG-0001]]`, `[[BUG-0003]]`
