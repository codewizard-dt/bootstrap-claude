---
id: BUG-0005
title: mv-absolute-path-block resolves the project root from process.cwd() instead of data.cwd
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

# BUG-0005 — `mv-absolute-path-block` resolves the project root from `process.cwd()` instead of `data.cwd`

Found during `TASK-039` (hook commenting pass). Known before the pass; filed now
so it has an ID that the inline annotation can cite.

## Summary

`lib/hooks/mv-absolute-path-block.js:20-21` establishes the project root from
the hook process's own working directory:

```js
const cwd = process.cwd();
const cwdWithSep = cwd + path.sep;
```

Every other Bash-surface guard in `lib/hooks/` prefers `data.cwd` — the session
cwd carried in the PreToolUse payload — and falls back to `process.cwd()` only
when it is absent:

| File | Line | Code |
|------|------|------|
| `protected-write-guard.js` | 189 | `const baseDir = typeof data.cwd === 'string' && data.cwd ? data.cwd : process.cwd();` |
| `claude-settings-guard.js` | 192 | same shape |
| `interpreter-indirection-guard.js` | 579 | `const cwd = typeof data.cwd === 'string' && data.cwd ? data.cwd : '';` |
| `serena-pre-delegation.js` | 95 | `const cwd = String(data.cwd ?? process.cwd());` |
| `serena-session-reset.js` | 29-32 | seeds from `process.cwd()`, then overrides with `data.cwd` |
| **`mv-absolute-path-block.js`** | **20** | **`const cwd = process.cwd();` — no `data.cwd` at all** |

`protected-write-guard.js:187-188` states the reason explicitly: *"the session's
cwd, not the hook process's — they are different"*. Nothing in the repo records
why `mv-absolute-path-block.js` diverges.

## Environment

- Platform: any; Node-based PreToolUse hook, matcher `Bash`, `if: Bash(mv *)`
- Component: `lib/hooks/mv-absolute-path-block.js`
- Version: repo at 2.17.0, commit `b85cbe9`

## Steps to Reproduce

The observable failure requires the hook process's cwd to differ from the
session cwd. That divergence is not guaranteed on every harness version, which
is why this is filed as a correctness/consistency defect rather than a
demonstrated one.

1. Confirm the divergence exists in your harness: add a temporary PreToolUse
   hook that prints `process.cwd()` alongside `JSON.parse(stdin).cwd` and
   compare them.
2. If they differ, run a `mv` whose absolute path is inside the **session**
   project root but outside the hook process's cwd, e.g. from a session rooted
   at `/Users/x/Repositories/bootstrap-claude`:

   ```
   mv /Users/x/Repositories/bootstrap-claude/a.md /Users/x/Repositories/bootstrap-claude/b.md
   ```

3. Observe the verdict.

## Expected Behavior

The in-project test at `:36` —
`arg.startsWith('/') && arg !== cwd && !arg.startsWith(cwdWithSep)` — should be
evaluated against the **session's** project root, so an absolute path inside the
project the user is working in is allowed and one outside it is denied.

## Actual Behavior

The test is evaluated against whatever directory the hook process happens to
have been spawned in. When the two agree, behaviour is correct — which is why
this has gone unnoticed. When they differ, the guard misclassifies in **both**
directions: an in-project absolute path is denied (friction), and an
out-of-project absolute path that happens to sit under the hook process's cwd is
allowed (the guard's whole purpose, defeated).

## Reproducibility

- `sometimes` — depends on whether the harness spawns hooks with the session cwd
- First seen: known before TASK-039; filed 2026-08-06
- Last seen: 2026-08-06

## Impact

The guard's single job is "is this absolute path inside the project?" and it
answers using a root it may not own. Severity `medium`: the failure is
conditional on harness behaviour, and the deny path is advisory (it tells the
user to use a relative path), but a silently wrong project root in a
path-scoping guard is exactly the class of defect the sibling guards were
already corrected for.

## Workaround

> Use relative paths for `mv`, which the guard's own deny message already asks
> for.

## Notes for the fixer

- One-line change, copying the established shape:
  `const cwd = typeof data.cwd === 'string' && data.cwd ? data.cwd : process.cwd();`
- Regression test: feed the hook a payload with `cwd` set to a directory
  different from the test runner's cwd and assert the verdict follows `data.cwd`.
- Fix alongside `[[BUG-0006]]` (same file) so the file is touched once.

## Root Cause Analysis

> _(filled at /bug-close)_

## Resolution

> _(filled at /bug-close)_

## Related

- Origin: `[[TASK-039]]`
- Same file: `[[BUG-0006]]`
- Reference implementation: `lib/hooks/protected-write-guard.js:187-189`
