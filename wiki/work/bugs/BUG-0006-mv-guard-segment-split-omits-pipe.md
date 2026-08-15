---
id: BUG-0006
aliases: [BUG-0006]
title: mv-absolute-path-block splits segments on ; && || but not |
status: open
severity: low
priority: "—"
created: 2026-08-06
updated: 2026-08-06
reporter: David Taylor
assignee: unassigned
tags: "—"
linked_task: "[[TASK-039]]"
---

# BUG-0006 — `mv-absolute-path-block` splits segments on `;` `&&` `||` but not `|`

Found during `TASK-039` (hook commenting pass). Known before the pass; filed now
so it has an ID that the inline annotation can cite.

**Flagged as a POSSIBLE bypass — and on investigation it is NOT one.** The
verification is recorded below because it changes what the fix should be. Do not
file this as a security hole.

## Summary

`lib/hooks/mv-absolute-path-block.js:25`:

```js
const segments = fullCmd.split(/;|&&|\|\|/).map(s => s.trim()).filter(Boolean);
```

`\|\|` matches `||`. A single `|` is not a separator, so a pipeline stays one
segment. Sibling guards using `lib/hooks/lib/command-parse.js#splitSegments`
handle `|` differently; `serena-bash-grep-block.js:135-142` omits it too but
documents the reason (Phase 1 needs the pipeline whole).
`mv-absolute-path-block.js` documents nothing.

## Environment

- Platform: any; Node-based PreToolUse hook, matcher `Bash`, `if: Bash(mv *)`
- Component: `lib/hooks/mv-absolute-path-block.js`
- Version: repo at 2.17.0, commit `b85cbe9`

## Verification — why this is not a bypass

The per-segment scan does not stop at a pipe:

```js
const mvIdx = tokens.findIndex(t => t === 'mv');
const args = tokens.slice(mvIdx + 1).filter(t => !t.startsWith('-'));
```

`args` runs from the first `mv` token to the **end of the segment**, spanning any
`|` in between. Traced cases:

| Command | Tokens after first `mv` | Verdict |
|---------|------------------------|---------|
| `echo x \| mv /etc/foo /tmp/bar` | `/etc/foo`, `/tmp/bar` | denied — correct |
| `mv a b \| mv /etc/x /tmp/y` | `a`, `b`, `\|`, `mv`, `/etc/x`, `/tmp/y` | denied — correct |
| `cat mv \| mv /etc/x /tmp/y` | `\|`, `mv`, `/etc/x`, `/tmp/y` | denied — correct |

No spelling was found where hiding the `mv` behind a `|` evades the check.

## Steps to Reproduce (the real, opposite defect)

The observable consequence is over-inclusion, not under-inclusion: arguments
from a *later* pipeline stage are attributed to the `mv`.

1. Run a command where a benign `mv` is piped into something that mentions an
   out-of-project absolute path:

   ```
   mv notes.md archive.md | tee /var/log/mvlog.txt
   ```

2. Token scan: `mvIdx` = 0; `args` = `notes.md`, `archive.md`, `|`, `tee`,
   `/var/log/mvlog.txt`. The last token starts with `/` and is outside the
   project.

## Expected Behavior

The guard should judge only the `mv` invocation's own operands. The command
above moves two relative in-project paths and should be allowed.

## Actual Behavior

Denied, with `"Please check that you are in the project root directory and then
use a relative path instead."` — advice that does not apply to the command the
user ran, because the offending path belongs to `tee`.

## Reproducibility

- `always` (for the false-positive case above)
- First seen: known before TASK-039; filed 2026-08-06
- Last seen: 2026-08-06

## Impact

A false positive on piped `mv` commands. Low frequency (piping `mv` is uncommon)
and low cost (one rephrase, and the deny message is advisory). No bypass. This
also applies to `;`-free `&`-backgrounded commands and to `<`/`>` redirect
targets, which are likewise not separators here. Severity `low`.

## Workaround

> Split the pipeline into two Bash calls, or run the `mv` on its own.

## Notes for the fixer

- Two candidate fixes, and they are not equivalent:
  1. Add `|` (and `&`) to the split regex — cheap, and consistent with
     `command-parse.js#splitSegments`. This narrows `args` to the pipeline stage
     the `mv` is actually in.
  2. Bound `args` at the first shell-operator token instead of running to the
     end of the segment — more precise, and also fixes `<` / `>` operands.
- Whichever is chosen, keep the "find `mv` anywhere in the segment" behaviour —
  that is what makes the traced bypass cases above land correctly, and anchoring
  the verb at the segment head would open the hole this bug was suspected of.
- Regression test both directions: `echo x | mv /etc/foo /tmp/bar` must still
  deny; `mv notes.md archive.md | tee /var/log/mvlog.txt` must allow.
- Fix alongside `[[BUG-0005]]` (same file) so the file is touched once.

## Root Cause Analysis

> _(filled at /bug-close)_

## Resolution

> _(filled at /bug-close)_

## Related

- Origin: `[[TASK-039]]`
- Same file: `[[BUG-0005]]`
- Comparable documented choice: `lib/hooks/serena-bash-grep-block.js:135-142`
