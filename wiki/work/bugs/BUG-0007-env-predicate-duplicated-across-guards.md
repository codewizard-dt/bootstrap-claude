---
id: BUG-0007
title: isBlockedEnvFile is duplicated byte-for-byte across two .env guards
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

# BUG-0007 — `isBlockedEnvFile` is duplicated byte-for-byte across two `.env` guards

Found during `TASK-039` (hook commenting pass). Known before the pass —
`lib/hooks/README.md:522-525` already lists it as an outstanding extraction —
filed now so it has an ID that the inline annotation can cite.

## Summary

The predicate that decides which files count as secret exists twice, identically:

- `lib/hooks/env-file-guard.js:6-13` (guards the `Read` / `Write` / `Edit` /
  `MultiEdit` file-tool surface)
- `lib/hooks/env-content-read-guard.js:91-98` (guards the `Bash` surface —
  `cat`, `grep`, `strings`, `xxd`, … against `.env`)

```js
function isBlockedEnvFile(filePath) {
  if (!filePath) return false;
  const basename = path.basename(String(filePath));
  // Block .env exactly, and .env.* variants (e.g. .env.local, .env.production)
  // Allow .env.example — the one permitted exception
  return basename === '.env' ||
    (basename.startsWith('.env.') && basename !== '.env.example');
}
```

Only the `env-content-read-guard.js` copy carries the warning
(`:86-90`): *"KEPT BYTE-IDENTICAL WITH env-file-guard.js:6-13. If the allow-list
changes, change it in both places or in neither."* The `env-file-guard.js` copy
has no such note — so an edit made in the file that does not know it is a copy
silently splits the definition of "secret".

`lib/hooks/README.md:522-525` records the same thing and says the extraction was
"left undone here because it means editing a live shipped control for a
refactor."

## Environment

- Platform: any; Node-based PreToolUse hooks
- Components: `lib/hooks/env-file-guard.js`, `lib/hooks/env-content-read-guard.js`
- Version: repo at 2.17.0, commit `b85cbe9`

## Steps to Reproduce

Drift is latent, not currently observable — the two copies agree today. To
demonstrate the failure mode:

1. Extend the allow-list in `env-file-guard.js` only, e.g. also permit
   `.env.sample`:

   ```js
   return basename === '.env' ||
     (basename.startsWith('.env.') && basename !== '.env.example'
       && basename !== '.env.sample');
   ```

2. `Read(".env.sample")` → **allowed** (file-tool surface updated).
3. `cat .env.sample` → **denied** (Bash surface still on the old list).

The reverse edit produces the inverse and more dangerous split: a file the Bash
guard now treats as non-secret while the file-tool guard still blocks it, or
vice versa, with no test to catch it.

## Expected Behavior

One definition of "which files are `.env` secrets", shared by both guards —
ideally a module under `lib/hooks/lib/` alongside `command-parse.js` — so the
two controls cannot disagree.

The definition should also stay aligned with the gitignore this repo ships
(`lib/scripts/templates/gitignore:23-25`: `.env`, `.env.*`, `!.env.example`),
which is what the annotation at `env-content-read-guard.js:88-90` points out.

## Actual Behavior

Two independent copies, one of which is unaware it is a copy. No test asserts
they agree.

## Reproducibility

- `always` (the duplication); the drift itself is latent
- First seen: recorded in `lib/hooks/README.md` before TASK-039; filed 2026-08-06
- Last seen: 2026-08-06

## Impact

Two `.env` controls that disagree about which files are secret is worse than one
control — a divergence would produce a surface where secrets are readable by one
route and blocked by another, and the block would give false assurance.
Severity `medium`: no current defect in behaviour, real risk on the next edit,
and the affected asset is credentials.

## Workaround

> Until extracted: when changing either copy, change both, and grep for
> `isBlockedEnvFile` before committing.

## Notes for the fixer

- Extract into `lib/hooks/lib/env-files.js` (or add to the existing
  `lib/hooks/lib/command-parse.js` if a new module is unwanted) and import from
  both guards.
- Note both hooks are **installed globally** to `~/.claude/hooks/` by
  `lib/scripts/install-global.sh`; a new file under `lib/hooks/lib/` must be
  copied by the installer too. Verify the installer's copy logic covers `lib/`
  subdirectories before assuming the require resolves post-install — this is the
  real cost that has kept the extraction undone.
- Update `lib/hooks/README.md:522-525` (the "Follow-up" paragraph) when done.
- Regression test: one shared table of cases asserted against **both** hooks, so
  a future divergence fails the suite rather than shipping.

## Root Cause Analysis

> _(filled at /bug-close)_

## Resolution

> _(filled at /bug-close)_

## Related

- Origin: `[[TASK-039]]`
- Existing write-up: `lib/hooks/README.md:522-525`
