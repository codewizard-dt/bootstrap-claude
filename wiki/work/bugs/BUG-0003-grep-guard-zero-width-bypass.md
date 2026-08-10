---
id: BUG-0003
title: Zero-width character bypass is open on the Grep surface
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

# BUG-0003 — Zero-width character bypass is open on the Grep surface

Found during `TASK-039` (hook commenting pass); annotated in the source at
`lib/hooks/lib/serena.js:702-707` as `SUSPECTED DEFECT`. Re-reading the three
call sites confirms it: this is not suspected, it is present.

## Summary

`SYMBOL_ZERO_WIDTH` (`lib/hooks/lib/serena.js:708`) exists to stop a symbol
being smuggled past the classifier by splicing an invisible character into it —
`create<ZWSP>Order` renders identically to `createOrder` but matches none of the
ASCII camelCase / PascalCase shape regexes in `isCodeSymbol`.

Stripping is **opt-in**, and only two of the three guards opt in:

| Guard | Zero-width handling |
|-------|--------------------|
| `serena-first-glob-guard.js:110` | passes `stripZeroWidth: true` |
| `serena-bash-grep-block.js:368` | strips in its own `clean` callback |
| `serena-first-guard.js:138-141` (Grep) | **neither** |

The Grep guard passes `rejectRegexSpecials: true`, which does not help: a
zero-width character is not a regex metacharacter, so the reject list
(`( [ \ ^ $ * + ? &`) never sees it. The token is neither stripped nor rejected;
it simply fails every shape test and is classified as "not a symbol".

## Environment

- Platform: any; Node-based PreToolUse hook
- Component: `lib/hooks/serena-first-guard.js` (PreToolUse / `Grep`), classifier
  in `lib/hooks/lib/serena.js`
- Version: repo at 2.17.0, commit `b85cbe9`

## Steps to Reproduce

1. Serena healthy for the project.
2. Issue a Grep whose pattern is a code symbol with a U+200B ZERO WIDTH SPACE
   spliced into it — visually identical to the plain symbol:

   ```
   Grep(pattern="create​OrderHandler")
   ```

   (Any character in `SYMBOL_ZERO_WIDTH` works: U+00AD, U+200B–U+200F,
   U+2060–U+2064, U+FEFF.)
3. Compare with the same Grep without the invisible character, which blocks.
4. Compare with the equivalent Glob — `Glob(pattern="*create​OrderHandler*")`
   — which **does** block, because that guard sets `stripZeroWidth`.

## Expected Behavior

The Grep guard should strip zero-width characters before classification, so
`create<ZWSP>OrderHandler` is classified as the symbol `createOrderHandler` and
blocked with a `find_referencing_symbols` suggestion — matching what the Glob
and Bash guards already do.

## Actual Behavior

`extractSymbolsFromPattern` returns an empty array, `symbolParts.length === 0`,
and the hook exits 0. The Grep runs unenforced, silently.

## Reproducibility

- `always`
- First seen: 2026-08-06 (TASK-039 commenting pass)
- Last seen: 2026-08-06

## Impact

This is the one bypass in the group that is **deliberately reachable** — the
upstream kit's CHANGELOG 2.1.0 records it as a security finding ("Unicode
zero-width character bypass") and it was fixed on the Bash and Glob surfaces but
not on Grep. Grep is the highest-traffic surface of the three. Severity `high`:
enforcement is fully skipped and the trigger is invisible in the transcript, so
neither the user nor a reviewer can see why the guard did not fire.

## Workaround

> None applicable — this is a hole, not a false positive.

## Notes for the fixer

- The fix is one option at the call site: add `stripZeroWidth: true` to the
  options object at `lib/hooks/serena-first-guard.js:138-141`.
- Check for interaction with `rejectRegexSpecials: true` and the length floor —
  `isCodeSymbol` (`lib/hooks/lib/serena.js:815-825`) already documents that
  stripping must happen **before** the `s.length < 4` measurement, and it does,
  so ordering is already correct.
- The comment at `lib/hooks/lib/serena.js:697-707` and the
  `stripZeroWidth` note at `serena-first-glob-guard.js:103-108` (which asks
  whether the asymmetry was deliberate) should both be updated when this is
  fixed — the answer becomes "no, it was a gap".
- Regression test: assert that a ZWSP-spliced symbol blocks on Grep, Glob, and
  Bash alike, for at least one character from each of the four ranges in
  `SYMBOL_ZERO_WIDTH`.

## Root Cause Analysis

> _(filled at /bug-close)_

## Resolution

> _(filled at /bug-close)_

## Related

- Origin: `[[TASK-039]]`
- Siblings: `[[BUG-0001]]`, `[[BUG-0002]]`
- Constant: `SYMBOL_ZERO_WIDTH` in `lib/hooks/lib/serena.js:708`
