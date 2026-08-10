---
id: BUG-0008
title: Hook-audit cleanup — cosmetic, dead-code, and latent defects found during TASK-039
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

# BUG-0008 — Hook-audit cleanup: cosmetic, dead-code, and latent defects found during TASK-039

Consolidated holder for the remaining findings from the `TASK-039` hook
commenting pass. Every item here is either **message-only**, **dead code**, or
**latent** (harmless today because something upstream short-circuits). None of
them changes a block/allow verdict, which is why they share one bug instead of
getting nine.

The verdict-changing findings were filed separately: `[[BUG-0001]]`,
`[[BUG-0002]]`, `[[BUG-0003]]`, `[[BUG-0004]]`, `[[BUG-0005]]`, `[[BUG-0006]]`,
`[[BUG-0007]]`.

## Environment

- Platform: any; Node-based PreToolUse hooks
- Components: `lib/hooks/serena-bash-grep-block.js`,
  `lib/hooks/serena-write-guard.js`, `lib/hooks/serena-first-read-guard.js`,
  `lib/hooks/lib/serena.js`, `lib/hooks/package-install-consent.js`
- Version: repo at 2.17.0, commit `b85cbe9`

## Reproducibility

- `always` for items 1-4 and 8; items 5-7 are latent (see each)
- First seen: 2026-08-06 (TASK-039 commenting pass)
- Last seen: 2026-08-06

---

## Checklist

### 1. `sed -i.bak` falls through the wrong phase — wrong verb, wrong suggestion

`lib/hooks/serena-bash-grep-block.js:630`. The Phase 2 read rule's
read/write divider is `(?![^\n]*?\s-i(?:\s|$|nplace))`: after `-i` it accepts
whitespace, end-of-string, or `nplace`. The fused GNU spelling `-i.bak` matches
none of the three, so the lookahead does **not** fire and Phase 2 claims the
command as a read.

- **Repro:** `sed -i.bak 's/a/b/' src/app.ts`
- **Observed:** blocked by `buildFsBlockResult(..., 'sed', 'src/app.ts')` —
  reported as filesystem *exploration*, suggesting a read tool.
- **Expected:** fall through to Phase 3 and block via
  `buildInplaceBlockResult(..., 'sed -i', ...)`, suggesting
  `mcp__serena__replace_content`.
- **Severity:** cosmetic — it still blocks. The message tells the user to read a
  file they were trying to write.
- Note Phase 3's own detector at `:661` has the same gap
  (`\bsed\s+(?:-E\s+)?-i\b` — `\b` after `i` matches before the `.`, so `-i.bak`
  *does* satisfy Phase 3), which is why the block lands at all. Fixing the Phase
  2 lookahead is the correct side to change.

### 2. `ls` target extraction uses `indexOf('ls')`, not the regex match position

`lib/hooks/serena-bash-grep-block.js:522`:

```js
const afterLs = cmd.slice(cmd.indexOf('ls') + 2).trim();
```

`cmd.indexOf('ls')` finds the first literal `ls` **anywhere**, including inside
another word, while the verdict came from the `\bls\b` regex at `:514`.

- **Repro:** a segment where `ls` first appears inside another token before the
  real verb — e.g. `cd tools && ls src` (after the `&&` split, a segment like
  `tools_ls src`; more directly, any single segment containing `tools` before
  the `ls` verb).
- **Observed:** the slice starts mid-token and `lsTarget` is a garbage fragment,
  which is then printed in the block message.
- **Expected:** slice from the regex match index (`lsMatch.index +
  lsMatch[0].length`), as the `tree` branch at `:540-541` already does with
  `cmd.search()`.
- **Severity:** message-only — `isExemptDir` still decides on whatever was
  extracted, so the block/allow verdict does not change; the *reported target*
  does.

### 3. `buildFsBlockResult`'s allowlist note contradicts `isExemptDir`

`lib/hooks/serena-bash-grep-block.js:900`:

```js
const allowNote = 'Allowlist: .docs/, .claude/, .serena/, node_modules/, .git/.';
```

`isExemptDir` (`:838-843`) exempts `.claude`, `.serena`, `.task`,
`node_modules`, `dist`, `build`, `.git`. So the note **advertises `.docs/`**
(not exempt) and **omits `.task/`, `dist/`, `build/`** (all exempt).

- **Repro:** `ls src/` → block message names `.docs/` as an escape hatch;
  `ls .docs/` is then still blocked.
- **Expected:** the note lists exactly what `isExemptDir` exempts.
- **Severity:** message-only, but actively misleading — it sends the agent to an
  escape hatch that does not exist.

### 4. Dead code in `serena-bash-grep-block.js`

Three items, all no-ops:

- `:481-485` — `serenaCall` is computed from `buildBashFsSuggestion(...)` and
  **never read**; both message strings below it use `suggestions` instead.
  Deleting it changes nothing, but the alternative reading — that one of the two
  messages was meant to use the FS-style suggestion — is a decision, not a tidy-up.
  Resolve which before deleting.
- `:38` — `const path = require('path')` is never referenced in the file.
- `:459` — `if (hasNonCodeTarget && !targetsCode)`: the `&& !targetsCode`
  conjunct is already baked into `hasNonCodeTarget` at `:453-455`. Redundant;
  reads as a second condition and is not one.

### 5. `process.exit(2)` immediately after writing the reason — possible truncation

`lib/hooks/serena-write-guard.js:109` and `lib/hooks/serena-first-read-guard.js:97`
(`emitBlock`):

```js
function emitBlock(msg) { process.stderr.write(msg); process.exit(2); }
```

On POSIX, stdout/stderr to a **pipe** are asynchronous. `process.exit()`
terminates without flushing, so a long payload can be truncated.

- **Latent:** exit code 2 blocks regardless, so the verdict is never wrong. What
  can be lost is the reason text — the part that tells the agent what to do
  instead, which for the read guard is the whole ladder explanation plus a
  concrete Serena call.
- **Repro attempt:** run the hook with stderr piped and a payload long enough to
  exceed the pipe buffer (64 KB on Linux, 8–64 KB on macOS). The current
  messages are well under that, which is why no truncation has been observed —
  so this is a latent hazard rather than a live bug.
- **Fix:** use `process.exitCode = 2` and let the process end naturally, or pass
  a completion callback to `write()`.
- The write guard already documents this at `:104-108` and notes it emits
  *both* the `decision: 'block'` envelope and exit 2, while
  `serena-first-guard.js` emits only the envelope — that inconsistency should be
  settled in the same pass.

### 6. `nextReadNum` is the wrong ordinal on the `alreadyRead` path

`lib/hooks/serena-first-read-guard.js:203`:

```js
const nextReadNum = alreadyRead ? readFiles.length : readFiles.length + 1;
```

On the `alreadyRead` path the value is the **unchanged session total**, not that
file's original position on the ladder.

- **Latent:** safe only because the `navCount >= 2 || alreadyRead` branch at
  `:209` exits before any gate reads the value. Move or reorder that branch and
  the off-by-one becomes live, mis-gating repeat Reads by one rung.
- Already annotated at `:193-198`. Options: compute the correct ordinal, or make
  the coupling explicit (assert / restructure so the value is unreachable on
  that path).

### 7. Gate decision reads the pre-lock snapshot

`lib/hooks/serena-first-read-guard.js:130` reads `flag` once, and the gates at
`:209-253` all judge against that snapshot, while `persistRead` (`:100-111`)
recomputes inside `updateStateFile`'s lock.

- Two Reads racing in the same tick compute the same `nextReadNum` and can both
  clear the same rung.
- **Latent / benign** under fail-open policy — no write is lost, only the gate
  verdict is best-effort. But `updateStateFile`'s own docstring
  (`lib/hooks/lib/serena.js:544-547`) warns against exactly this pattern:
  *"Callers must derive their field updates from `data` as passed to
  `mutatorFn` (the freshly-locked read) — never from a snapshot read before the
  lock was acquired."*
- Decide whether the docstring's rule should be relaxed for gate *reads*, or the
  guard restructured to decide inside the lock. Already annotated at `:199-202`.

### 8. `allowlist: 'glob'` + `kebabComponents` are silently incompatible

`lib/hooks/lib/serena.js:890-899` and `:916-921`. The `'glob'` branch's
kebab-filename reject (`/^[a-z]{1,8}$/`, `GLOB_SKIP_EXACT`, and the full kebab
reject) sits **above** the `kebabComponents` carve-out, so a caller passing both
would never reach the carve-out and every kebab component name would be allowed.

- No call site does this today — the two options are mutually exclusive by
  intent, and nothing enforces it.
- **Fix options:** throw on the invalid combination, or reorder so the carve-out
  is reachable. Already annotated at `:891-896`.

### 9. Bare `uvx <pkg>` is ungated

`lib/hooks/package-install-consent.js:105-123`. `matchedInstall` returns `null`
for `uvx` when `uvxSource` finds no `--from`:

```js
if (name === 'uvx') {
  const source = uvxSource(tokens);
  if (source === null) return null;              // ← bare `uvx ruff` allowed
  return SERENA_SOURCE.test(source) ? null : 'uvx --from';
}
```

- **Repro:** `uvx ruff check .` → allowed, no consent prompt.
  `uvx --from ruff ruff check .` → denied pending consent.
- By the file's own reasoning at `:99-104`, bare `uvx` "fetches and runs a
  package by the same reasoning" — i.e. it pulls from PyPI and executes it,
  identically.
- **SUSPECTED, not confirmed:** whether this is a deliberate scope choice or an
  oversight is not recoverable from the file or from `lib/hooks/README.md`. The
  annotation at `:100-104` says so explicitly. **Confirm intent before
  changing** — check git history for when the `uvx` branch was added and whether
  the Serena carve-out predates it.
- Gating it is not a one-liner: the sole allowlisted source (`SERENA_SOURCE`,
  `:77`) is expressed purely in `--from` terms, so admitting bare `uvx` into the
  gate requires deciding how (or whether) a bare invocation can ever be
  allowlisted.

### 10. Two live false positives — document, do not fix

Both are already annotated and both have escape hatches; recorded here so a
future pass does not "fix" them without understanding the cost.

- **The `(?<!2)>` arrow-function case.**
  `lib/hooks/serena-bash-grep-block.js:718`. A JS arrow function whose body
  mentions a `.js` file — `x => require("a.js")` — presents as `>` followed by a
  code-extension token and reads as a redirect into source.
  - **Repro:** `node -e 'const f = x => require("a.js"); f(1)'` → blocked as an
    overwrite of `a.js`.
  - This is **pinned by UAT-033 and UAT-034**, whose inline scripts are
    deliberately arrow-free. Any fix must re-check those.
  - The naive fix (extending the lookbehind to `(?<![2=])`) would also stop
    catching genuine `x=>foo.ts` style redirects. Documented at `:706-717`.
- **`\bgrep\b` matching the guard's own filename in a git pathspec.**
  `lib/hooks/serena-bash-grep-block.js:228`. The VCS bypass re-admits a segment
  to Phase 1 if it contains a grep-family word anywhere, and the `-` delimiters
  in `serena-bash-grep-block.js` make `-grep-` satisfy `\bgrep\b`.
  - **Repro:** `git log -- lib/hooks/serena-bash-grep-block.js` → blocked on
    Phase 1's `lib/` fallback.
  - **Escape hatch:** a pathspec glob that omits the word, e.g.
    `git log -- 'lib/hooks/serena-bash-*.js'`.
  - Narrowing this to "grep is an actual command token" needs quote-aware
    parsing. Documented at `:222-227` and in the file docstring at `:25-27`.

---

## Impact

No verdict changes; the guards block and allow the same commands today with all
ten items present. The costs are: two block messages that name the wrong verb or
a non-existent escape hatch (items 1, 3), one that prints a garbage target
(item 2), roughly 15 lines of code that read as load-bearing and are not
(item 4), two latent hazards that become live if nearby code is reordered
(items 5, 6), one documented-pattern violation (item 7), one invalid-combination
trap in a shared helper (item 8), one possible coverage gap of unknown intent
(item 9), and two known false positives with standing constraints on UAT
authoring (item 10). Severity `low`.

## Workaround

> Items 1-4 and 8 have no user-facing workaround needed. Item 9: run `uvx
> --from <pkg> <cmd>` if a consent prompt is wanted. Item 10: escape hatches are
> listed inline.

## Notes for the fixer

Items are independent — take them one at a time, each with its own regression
test. Suggested order (cheapest and safest first): 3, 4, 2, 1, 8, 5, 6, 7, then
9 (needs an intent decision) and 10 (documentation only, or a scoped fix with
UAT-033/034 re-verified).

## Root Cause Analysis

> _(filled at /bug-close)_

## Resolution

> _(filled at /bug-close)_

## Related

- Origin: `[[TASK-039]]`
- Verdict-changing siblings: `[[BUG-0001]]` … `[[BUG-0007]]`
- Standing constraint: `UAT-033`, `UAT-034` (arrow-free inline scripts)
