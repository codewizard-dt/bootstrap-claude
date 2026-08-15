---
id: BUG-0001
aliases: [BUG-0001]
title: Grep guard skips Serena enforcement for paths that merely contain a non-code directory name
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

# BUG-0001 — Grep guard skips Serena enforcement for paths that merely contain a non-code directory name

Found during `TASK-039` (hook commenting pass). The defect is already annotated
in the source as `KNOWN DEFECT, left in place` at
`lib/hooks/serena-first-guard.js:69-72`; this bug exists so it gets a triage, a
fix, and a regression test rather than living on as a comment.

## Summary

`lib/hooks/serena-first-guard.js:73` tests the Grep tool's `path` argument
against an **unanchored** alternation of non-code directory names. Any path
whose name merely *contains* one of those words matches, and the hook exits 0 —
Serena-first enforcement is skipped entirely for that Grep, whatever symbol the
pattern names.

The sibling `lib/hooks/serena-first-glob-guard.js:74` solves the same problem
with an anchored `NON_CODE_PATH` regex and carries a comment
(`anchored — bare substring would let "myknowledge-vaultxxx" bypass detection`)
saying it was fixed there specifically. This side was missed.

## Environment

- Platform: any (macOS/Linux); Node-based PreToolUse hook
- Component: `lib/hooks/serena-first-guard.js` (PreToolUse / `Grep`)
- Version: repo at 2.17.0, commit `b85cbe9`

## Steps to Reproduce

1. In a project with Serena healthy (`shouldEnforceSerena()` true), create a
   directory whose name contains a listed word but is not one of them, e.g.
   `myknowledge-vault/`, `mydocs/`, or `applogs/`.
2. Issue a Grep whose pattern is unambiguously a code symbol and whose `path`
   is that directory:

   ```
   Grep(pattern="createOrderHandler", path="mydocs/src")
   ```

3. Observe the hook's verdict.

The offending line:

```js
if (/knowledge-vault|\.task[\\/]|\.claude[\\/]|node_modules|logs?[\\/]|docs?[\\/]|supabase[\\/]migrations/i.test(searchPath)) {
  process.exit(0);
}
```

`myknowledge-vault` matches `knowledge-vault`; `mydocs/` matches `docs?[\\/]`;
`applogs/` matches `logs?[\\/]`. None of them are the directories the exemption
was written for.

## Expected Behavior

Only a path whose **components** are one of the exempt directories should skip
enforcement — the same semantics the Glob guard already implements:

```js
/(?:^|[\/\\])(?:knowledge-vault|\.task|\.claude|node_modules|supabase[\/\\]migrations|\.git)(?:[\/\\]|$)/i
```

`Grep(pattern="createOrderHandler", path="mydocs/src")` should be blocked with a
`find_referencing_symbols` suggestion.

## Actual Behavior

The hook exits 0 and the Grep runs unenforced. There is no stderr output and no
structured block envelope — the skip is silent, so nothing in the transcript
signals that a guard declined.

## Reproducibility

- `always`
- First seen: 2026-08-06 (TASK-039 commenting pass)
- Last seen: 2026-08-06

## Impact

Enforcement is bypassed **completely and silently** for any Grep rooted in a
directory with an unlucky name. Serena-first is agent guidance rather than a
security boundary (the hook's own docstring says so), which is why this is
`high` and not `critical` — but a guard that can be switched off by naming a
directory `mydocs/` is not enforcing anything in that tree, and the failure is
invisible.

## Workaround

> Scope the Grep's `path` to a directory whose name does not contain any of the
> listed words. No workaround is needed to *bypass* the guard — bypass is the
> defect.

## Notes for the fixer

- The comment block at `:63-67` explains why this list is deliberately **not**
  the shared `ALLOW_PATH_PATTERNS` from `lib/serena.js` (different membership in
  both directions). Anchoring must preserve that membership — it adds `logs?/`
  and `docs?/`, which the Glob guard's list does not have.
- Anchoring `docs?/` and `logs?/` is the behaviour-changing part: today a path
  like `src/docs-legacy` is exempt and after the fix it would not be. Decide
  that explicitly.
- Regression test belongs alongside the existing hook tests; assert that
  `myknowledge-vault/`, `mydocs/`, `applogs/` block while `docs/`, `./docs/x`,
  `logs/`, `node_modules/` still pass.

## Root Cause Analysis

> _(filled at /bug-close)_

## Resolution

> _(filled at /bug-close)_

## Related

- Origin: `[[TASK-039]]`
- Correct implementation to copy: `lib/hooks/serena-first-glob-guard.js:74`
- Siblings: `[[BUG-0002]]`, `[[BUG-0003]]`
