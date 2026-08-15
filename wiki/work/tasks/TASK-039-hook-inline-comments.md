---
id: TASK-039
aliases: [TASK-039]
title: "Add extensive inline comments to the hook scripts"
status: pending-uat
created: 2026-08-06
updated: 2026-08-06
depends_on: []
blocks: []
parallel_safe_with: [TASK-030, TASK-031]
uat: "[[UAT-039]]"
tags: [hooks, documentation, security]
---

# TASK-039 — Add extensive inline comments to the hook scripts

## Objective

Bring the hook scripts in `lib/hooks/` up to a consistent, high standard of inline documentation, so that the *why* behind each guard's regexes, thresholds, and ordering dependencies is recoverable by the next reader without re-deriving it from the README or from git history. The hooks are security-critical and heuristic-dense; several carry unexplained magic numbers and ~40 undocumented regexes. This task is **comments-only** — no behavioral change to any guard.

## Approach

A survey of all 21 files found the commenting is badly uneven, and that unevenness — not the absolute comment count — is the real problem:

- **Command-class guards** (`protected-write-guard`, `claude-settings-guard`, `env-content-read-guard`, `interpreter-indirection-guard`, `absolute-path-guard`, `package-install-consent`) are already **35–50% comments**, and their file headers near-verbatim restate their per-hook `README.md` sections (compare `protected-write-guard.js:4-66` against `README.md:305-349`). Adding more here produces duplication that will drift out of sync with the README.
- **Serena-first hooks** are the inverse: **4–18% comments** while carrying the densest heuristics in the repo.

So the pass is **targeted, not uniform**: heavy work on the thin-and-heuristic-dense files, gap-fill only on the already-dense guards.

**Deliberate override of the house default.** The no-comments default comes from the harness/global agent rules, **not** from any file in this repo — `CLAUDE.md` and `raw/design-principles.md` do not state it (an earlier draft of this task wrongly cited them; the standard must not bake in that false reference). That default is being **deliberately suspended for `lib/hooks/` only**, because these files encode security decisions whose rationale is not recoverable from the code. Record this in the directory's README so a future agent does not "clean up" the comments as slop. The exception does not extend to any other directory.

**Comment content rule.** Every comment must explain *why*, never *what*. A comment restating a regex in English is worse than no comment. Target these classes specifically:

- why a pattern is in a deny list, and what real command motivated it;
- why a threshold has its value (`prompt.length < 200`, `MAX_WALK = 64`, the 2-hour mtime window, `FREE_READS`/`WARN_AT`);
- known false positives and the escape hatch for each;
- **ordering dependencies** — where moving a check breaks the guard;
- why a tempting simplification was rejected.

**Complement the README, do not copy it.** `README.md` documents group (b) with per-hook prose (Blocks / Why a hook / Why not X / Accepted consequence / Cost / Not covered) but documents the Serena-first group with only a one-line-purpose table. Inline comments should therefore carry the load for the Serena-first files, and defer to the README for group (b) by pointing at it rather than restating it.

**Divergences are documented, not fixed.** The survey flagged likely defects. This task annotates them in place and files bugs; the fixes get their own review and regression tests rather than hiding inside a diff reviewers will skim as "just comments."

## Steps

### 1. Define the comment standard  <!-- agent: Plan --> <!-- Updated: 2026-08-06 -->

- [x] Write the standard down once, at the top of `lib/hooks/README.md`, in a new `## Commenting standard` section
  - Drafted and calibrated. **Text held at `scratchpad/hooks-commenting-standard.md`** — the write itself lands in Step 6 (the Plan agent is read-only by design). Insert after the last line of `## Why hooks (vs. allow/deny permission rules)`, before the `---` preceding `## Scripts`.
- [x] Fix the file-header block shape all files will use — **final template, use this verbatim in Steps 2–3**:
  ```
  /**
   * <file>.js — <event>[ + <event>] / <matcher>
   *
   * Blocks: <the surface it gates, one line>
   * Why a hook: <why a settings.json rule cannot express this>
   * Fails: open|closed — <what happens when the check itself cannot run>
   * False positives: <the known one> — escape hatch: <the rephrase that clears it>
   * See README.md § <exact heading> for the full rationale.
   */
  ```
  - Four changes from the draft, each forced by the calibration file: filename carries `.js` and the event slot repeats (the tracker is wired on two events); non-blocking hooks (`serena-usage-tracker`, `serena-session-reset`) use `Does:` instead of `Blocks:` and may drop `False positives:`; **`Fails: open|closed` is new and required** for anything that can block — command-class guards fail closed, Serena-first guards fail open, and that is invisible on a skim; the escape hatch sits inline on the `False positives:` line so it cannot be dropped.
  - Free-form paragraphs may follow the fields. **Hard cap ~30 lines** — a header approaching its README section's length has become the duplicate this standard exists to prevent.
- [x] Confirm the standard against one already-good file (`serena-usage-tracker.js`, JSDoc 29 ln) so the target is calibrated to something real in the repo, not invented
  - Calibrated against `serena-usage-tracker.js:4-32`. What makes it the target: organised by *decision* (SUCCESS/FAILURE) not by code order; carries the one underivable fact (dual PostToolUse/PostToolUseFailure payload handling doubles as the version-compatibility fallback); and **delegates rather than restates** — `./lib/serena.js#isLspProviderTool` instead of a paragraph. Not one line describes what a line of code does.

### 2. Heavy pass — thin and heuristic-dense files  <!-- agent: general-purpose -->

Work in descending order of value. One file per commit-sized unit; do not batch all nine into one edit.

- [x] `lib/hooks/serena-bash-grep-block.js` (501 ln, ~40 regexes, 6-line header, 18%) — the highest-value file — **done: 501 → 964 ln, 18% → 59% comments; 44 deleted lines all verified to be comments being replaced.** Provenance came from the upstream kit's CHANGELOG, so regex comments cite the version and the actual command that motivated each change (inverse-denylist inversion 3.1.4; `_firstSegIsGrep` 3.1.2 after `git grep -nrE "a|b"` split on the alternation; docker-bypass-before-split 3.1.5; three 2.1.0 security-audit findings).
  - Header block per the standard
  - Annotate the **Phase 1 → 2 → 3 ordering** and what breaks if reordered
  - Per-regex "why": the docker/ssh bypasses, the inverse-denylist pipe bypass, the `rtk` prefix strip, the `tree(?!\w)` false-positive fix, the `(?<!2)>` lookbehind, the sed/awk `-i` negative lookahead
  - Explain the duplicated `targetsCode` / `hasNonCodeTarget` blocks — why duplicated rather than extracted
  - Document `_firstSegReadsCode` and `isExemptDir`'s allowlist
- [x] `lib/hooks/serena-pre-delegation.js` (117 ln, 4%, no header) — nearly all unexplained thresholds — **done: 117 → 240 ln, 4% → 53%; +123/-0.** Warn-vs-block documented as an evidence-kind rule: `block` only where the trigger is read directly from `tool_input`, `warn` where it is inferred from possibly-stale filesystem state.
  - Header block; then justify each: `prompt.length < 200`, the 2-hour `.task/` mtime window, the `20*` folder-name heuristic, the dual phase detection (`state.json` + `00-task.md` regex), the six LSP-CONTEXT regexes
  - Explain the **warn-vs-block** choice for this hook specifically
  - Preserve the existing comment documenting the fixed substring-bypass bug
- [x] `lib/hooks/lib/serena.js` (801 ln) — focus on `isCodeSymbol` + `GLOB_SKIP_EXACT` + kebab regexes (~lines 626-749) — **done: 801 → 1029 ln, 47% comments; +228/-0.** Behaviour verified identical against HEAD across 76 `isCodeSymbol` cases spanning all four dialects plus `extractSymbolsFromPattern` and `classifySerenaFailure` — zero mismatches. Four dialects documented, not three: `'guard'`, `'bash'`, `'glob'`, and the no-allowlist default (which is the *strictest*).
  - Document the **three allowlist dialects** (`'guard'`, `'glob'`, default) and how they differ — this is the entire false-positive surface for three hooks
  - `KEBAB_TAILWIND_PREFIX` / `KEBAB_COMPONENT_SUFFIX` carve-outs: what real input each was added for
  - Why `GLOB_SKIP_EXACT` has ~150 entries and what qualifies for it
  - `classifySerenaFailure` regexes and the "unknown ⇒ tool" default; the advisory-lock staleness constants
- [x] `lib/hooks/serena-first-read-guard.js` (167 ln, 18%, no file header) — **done: 167 → 257 ln, 42%.** Surfaced two invariants the branches silently depend on: `WARN_AT === FREE_READS + 1` (else the warn rung is dead code and the agent is blocked with no notice) and `REQUIRE_NAV_2_AT >= WARN_AT + 2` (else the one-nav window is empty). Gate-1 ordering now states the concrete deadlock rather than "order matters".
  - Justify `FREE_READS`, `WARN_AT`, `REQUIRE_NAV_2_AT`, `WARMUP_BLOCK_LIMIT`
  - Document the `nextReadNum` off-by-one
  - Make the **strict gate ordering** explicit: the health check must precede the null-flag Gate 1 branch — state what deadlock occurs if reversed
- [x] `lib/hooks/serena-first-guard.js` (74 ln, 15%) — **done: 74 → 170 ln, 62%.** Each opt explained as a dialect choice against its Glob-guard counterpart; `pattern.length < 4` documented as a pure fast path (lowering it is inert; raising to 8 would silently un-classify `getUser`).
  - Document the opts handed to `extractSymbolsFromPattern` (`allowlist:'guard'`, `kebabComponents`, `dottedSymbol`, `rejectRegexSpecials`) — each encodes a call-site dialect choice with zero local explanation
  - The hardcoded path/glob denylist regexes at `:36` and `:40`; the `pattern.length < 4` floor
- [x] `lib/hooks/serena-first-glob-guard.js` (94 ln, 35%) — **done: 94 → 139 ln, 54%.** Existing `NON_CODE_PATH` anchoring note kept and extended (it tests both path and pattern, because globs carry their own root).
  - Document the `splitRe` / `allowlist:'glob'` dialect and how it differs from the read-guard's
  - Keep the existing (good) note on why `NON_CODE_PATH` is anchored
- [x] `lib/hooks/serena-write-guard.js` (58 ln, 16%) — **done: 58 → 111 ln, 55%.** Ordering documented as a *cost* ordering (existsSync last, so most Writes never touch disk), not an arbitrary sequence.
  - Why `fs.existsSync` means "new file, nothing to preserve"
  - The ordering: enforce-check → allowlist → existence
  - Why `exit(2)` comes after the JSON write
- [x] `lib/hooks/env-file-guard.js` (45 ln, 9%, no header) — **done: 45 → 87 ln, 49%; zero deleted lines.** `Fails: open` determined by reading the code, not assumed — and the brief's premise was wrong: this file does **not** use `readHookInput`; it predates `lib/command-parse.js` and hand-rolls its own stdin handler.
  - Header block; document the `.env.*` prefix match and the single `.env.example` carve-out
  - **Add the "change both or neither" warning** naming its byte-identical twin at `env-content-read-guard.js:86-93` (only the twin currently carries it — `README.md:522-525` flags this as an outstanding extraction)
- [x] `lib/hooks/mv-absolute-path-block.js` (53 ln, 13%) — **done: 53 → 134 ln, 64%.** Also hand-rolls its own stdin handler; `Fails: open`. BUG-0005 annotated with the four siblings that prefer `data.cwd`; BUG-0006 annotated with the corrected framing plus the warning that adding `|` to the split and anchoring the verb are one change, not two.
  - Document the `!t.startsWith('-')` flag-dropping heuristic
  - Annotate the two divergences per Step 4 (do not fix them here)
- [x] `lib/hooks/env-content-read-guard.js` — minimal additive back-reference so both sides of the duplicated `.env` predicate cite each other and BUG-0007
- [x] `lib/hooks/lib/serena-languages.js` (158 ln, 22%) — light touch — **done: 158 → 251 ln, 53%.** Zero-dependency rationale *verified* not assumed: `package.json` declares no dependencies at all, and `install-global.sh` rsyncs hooks to `~/.claude/hooks/` where there is no `node_modules` on the resolution path, so a `require('js-yaml')` would throw `MODULE_NOT_FOUND` on every hook-triggering tool call. Also documented a non-obvious consequence: an empty language set makes `isAllowedPath` fall back to static `CODE_EXTENSIONS`, so "no languages configured" **widens** enforcement rather than disabling it.
  - The hand-rolled YAML list parser: why hand-rolled rather than a dependency, and which two forms (inline + block) it accepts
  - Keep the existing `null` vs `[]` semantics note; document project-overrides-global precedence

### 3. Light pass — already-dense guards  <!-- agent: general-purpose --> <!-- Updated: 2026-08-06 -->

Gap-fill only. **Do not rewrite existing headers**, and do not restate README prose.

**Outcome: the verification pass held — 49 lines added, 1 changed, zero non-comment lines touched across all 7 files.** Nearly every named item was already documented; only one was genuinely missing. No existing header was rewritten.

- [x] `lib/hooks/interpreter-indirection-guard.js` (576 ln, 35%) — all four items VERIFIED (`:316-323` reproduced forms + `:325-335` explicit NOT-reproduced list; `:86-91` `MAX_INLINE_DEPTH`; `:213-219`/`:268-270`/`:395-398` fail-closed; `:350-360` memoized load). Added the `Fails: closed` line — **the only file where that claim is true.**
- [x] `lib/hooks/protected-write-guard.js` — VERIFIED `:94` and `:108-110` (the empty `core.fsmonitor=` is the remediation, not an instance); CVE refs `:31`
- [x] `lib/hooks/claude-settings-guard.js` — VERIFIED `:85-94` and `:80-83`; removed-bootstrap-carve-out history left byte-identical
- [x] `lib/hooks/env-content-read-guard.js` — VERIFIED `:139-147`/`:156-159`, `:268-279`, `:30-46`, `:295-297`. One line *changed*: the cross-reference `absolute-path-guard.js:118` → `:123`, which this step's own header insertion shifted
- [x] `lib/hooks/absolute-path-guard.js` — VERIFIED `:18-49` (including the accepted `/bin/rm file.txt` consequence), `:118-122`, `:78-81`
- [x] `lib/hooks/package-install-consent.js` — VERIFIED `:69-73`, `:59-63`
- [x] `lib/hooks/lib/command-parse.js` — the one genuine gap. The quoting-unaware `splitSegments` limitation was stated in two *callers* but never in the shared helper every caller inherits it from. ADDED to the `splitSegments` docblock.

> **Correction to this step's premise.** The brief asserted "command-class guards fail CLOSED" and told the agent to add that line where absent. Measured against the field's own definition — *what happens when the check itself cannot run* — that is true of **`interpreter-indirection-guard.js` only**. The other five fail **open**: they share `readHookInput`, whose double try/catch exits 0 on any throw, and `command-parse.js:6-8` states fail-open as the deliberate module-wide contract. The agent correctly refused to write the false claim and recorded `Fails: open` with the useful distinction — the *infrastructure* fails open, while ambiguous *matches* block. Making those five actually fail closed is a behavior change, out of scope here.

### 4. Record divergences found while reading  <!-- agent: general-purpose -->

Annotate in place, then file bugs. **Change no behavior in this task.**

- [x] `mv-absolute-path-block.js`: uses `process.cwd()` where every sibling guard uses `data.cwd` — annotate as an unexplained divergence and cross-reference the bug ID
- [x] `mv-absolute-path-block.js`: splits segments on `;`, `&&`, `||` but **not** `|` — annotate; note this is a possible bypass, not a confirmed one
- [x] `env-file-guard.js` / `env-content-read-guard.js`: duplicated `.env` predicate with no shared extraction — annotate both sides
- [x] Run `/bug-file` for each confirmed divergence; put the resulting `BUG-NNNN` into the corresponding inline annotation — **8 bugs filed, BUG-0001…BUG-0008** (the bugs family was empty, so numbering starts at 0001; next free is BUG-0009). Security: **BUG-0001** unanchored denylist, **BUG-0002** mixed-brace-glob fail-open, **BUG-0003** zero-width bypass, **BUG-0004** `decision:'warn'` no-op (suspected). Divergences: **BUG-0005** `process.cwd()`, **BUG-0006** missing `|` split, **BUG-0007** duplicated `.env` predicate. **BUG-0008** = consolidated 10-item cleanup.
- [x] If a reading turns up a divergence **not** listed above, add it here rather than fixing it inline

> **BUG-0006 is not a bypass — the suspicion was wrong.** Verified before filing: `args` is `tokens.slice(mvIdx + 1)` and runs to the end of the segment, spanning any `|`, so `echo x | mv /etc/foo /tmp/bar` and `cat mv | mv /etc/x /tmp/y` all still deny correctly. The real defect is the inverse — arguments from later pipeline stages are attributed to the `mv`, so `mv notes.md archive.md | tee /var/log/mvlog.txt` **falsely denies**. Filed `low`, with a warning to the fixer that anchoring the verb at the segment head (the tempting fix) would actually open the hole this was suspected of.

> **Skill/lifecycle drift found while filing:** the `bug-file` skill specifies `status: new`, which is not in `wiki/work/bugs/lifecycle.md`'s status set. The agent followed the lifecycle (`status: open`). Worth reconciling in the skill — not in scope here.

#### Discovered during Step 2 <!-- Updated: 2026-08-06 -->

The reading pass surfaced **16 further suspected defects** — over five times what this task anticipated. All are annotated in place; **none are fixed**.

> **What a checked box means below:** *annotated in place and filed as a bug* — this task's definition of done. It does **not** mean fixed. Every fix is tracked by its BUG id and gets its own triage, patch, and regression test. Filing strategy (chosen 2026-08-06): the four enforcement-skipping findings filed individually so each is independently triageable; the correctness/cosmetic remainder consolidated into one checklist bug.

**Security-relevant — enforcement silently skipped:**
- [x] `serena-first-guard.js:36` — the non-code path denylist is **unanchored**, unlike `NON_CODE_PATH` in the glob guard. `myknowledge-vault/`, `mydocs/`, `mylogs/` all match and skip enforcement entirely. The glob guard carries a comment about fixing exactly this; this side was missed.
- [x] `serena-first-guard.js:40-44` — a brace glob mixing code and non-code extensions **fails open**. For `**/*.{ts,json}` the first regex matches on `.json`, but extension re-extraction leaves `ext === ''` → `exit(0)`; symbol enforcement is skipped for the `.ts` half.
- [x] `serena-first-guard.js` — **zero-width bypass still open on the Grep surface.** `SYMBOL_ZERO_WIDTH` exists to stop `create<ZWSP>Order`; the Glob guard sets `stripZeroWidth` and the Bash guard strips in its `clean` callback, but this guard does neither and `rejectRegexSpecials` does not catch zero-width chars.
- [x] `serena-pre-delegation.js` — **`decision: 'warn'` may be a no-op.** `warn` is not a documented PreToolUse decision value; the sibling warn path in `serena-first-read-guard.js:40` uses `{systemMessage}` instead. If unrecognized, that entire path emits nothing and the hook is effectively forced-explorer/worktree-only.

**Correctness — wrong verdict text or latent breakage:**
- [x] `serena-bash-grep-block.js` — `sed -i.bak` falls through the wrong branch: the `-i` lookahead accepts `\s`, `$`, or `nplace`, so the fused GNU spelling is treated as a *read* by Phase 2. It still blocks, but under the wrong verb with a read suggestion for a write.
- [x] `serena-bash-grep-block.js` — `ls` target extraction uses `cmd.indexOf('ls')` (first literal "ls" anywhere) rather than the regex match position, so a segment where "ls" first appears inside another word slices mid-token and reports a garbage target. Affects the message, not the verdict.
- [x] `serena-bash-grep-block.js` — `buildFsBlockResult`'s allowlist note advertises `.docs/` (not exempt) and omits `.task/`, `dist/`, `build/` (all exempt). Message/logic drift.
- [x] `serena-write-guard.js:57` and `serena-first-read-guard.js`'s `emitBlock` — `process.exit(2)` immediately after `console.log`/`stderr.write`. On POSIX these are async to a pipe, so the payload can truncate: the block still lands via exit code 2, but the reason text telling the agent what to do instead may be lost.
- [x] `serena-first-read-guard.js:122` — `nextReadNum` is the unchanged total on the `alreadyRead` path, not that file's ladder position. Harmless only because the short-circuit exits before any gate reads it; re-ordering that branch makes the off-by-one live.
- [x] `serena-first-read-guard.js` — the gate decision reads the pre-lock snapshot while `persistRead` recomputes under the lock, so concurrent Reads can both clear the same rung. Benign under fail-open policy, but `lib/serena.js`'s own `updateStateFile` docstring warns against exactly this pattern.

**Live false positives (now documented with escape hatches, not fixed):**
- [x] `serena-bash-grep-block.js` — the `(?<!2)>` arrow-function case (already pinned by UAT-033/034, which is why their inline scripts are arrow-free).
- [x] `serena-bash-grep-block.js` — `\bgrep\b` matches **this file's own name** in a git pathspec, so `git log -- lib/hooks/serena-bash-grep-block.js` blocks. The Step 2 agent hit this twice while working. Workaround: a glob omitting the word.

**Found during Step 3's light pass:**
- [x] `package-install-consent.js` — **bare `uvx <pkg>` is ungated.** `matchedInstall` returns null when `uvxSource` finds no `--from`, so `uvx ruff` is allowed. By the file's own reasoning at `:97` ("`uvx --from X` fetches and runs X, so it is an install in everything but name"), bare `uvx <pkg>` fetches and runs from PyPI identically. Not recoverable whether this is a deliberate scope choice or an oversight. Note: gating it would require rethinking the `SERENA_SOURCE` carve-out, which is currently expressed only in `--from` terms.

**Cosmetic / dead code:**
- [x] `serena-bash-grep-block.js` — `serenaCall` in the Phase 1 grep block is computed and never read (both messages use `suggestions`); `path` is required and never referenced; `if (hasNonCodeTarget && !targetsCode)` has a redundant conjunct (`!targetsCode` is already inside `hasNonCodeTarget`).
- [x] `lib/serena.js` — `allowlist:'glob'` + `kebabComponents` are silently incompatible (the glob branch's kebab reject sits above the carve-out, making it unreachable). No call site does this today; nothing enforces it.

**Not a defect, but worth recording:** `.task/` is an external orchestration convention carried over from `claude-code-lsp-enforcement-kit`. Nothing in this repo produces `.task/20*/state.json`, so on a bootstrap-claude checkout the entire phase-scan branch in `serena-pre-delegation.js` never fires.

### 5. Verify no behavior changed  <!-- agent: general-purpose --> <!-- Updated: 2026-08-06 -->

**Verdict: BEHAVIOR UNCHANGED.** The decisive gate was a comment-stripped comparison of `git show HEAD:<path>` against the working tree for all 17 modified `.js` files — **17/17 byte-identical**. The stripper is trustworthy rather than merely asserted: it classified **zero** slashes as division and hit **zero** ambiguous cases, so the one place such a tool can silently corrupt dense-regex files never had to make a judgment call; every stripped output passes `node --check`; stripping is idempotent across all 34 inputs; and it throws on an unterminated block comment (the exact failure mode that bit Step 2) and threw on nothing.

- [x] `node --check` every modified file — a stray `*/` inside a regex is the realistic failure mode for this task — 17/17 OK
- [x] ⚠️ **`node --check` is NOT sufficient on its own — proven during Step 2.** An agent's header edit consumed the closing `*/`, silently commenting out the `require`s and an entire constant. **`node --check` still passed** (the file stays valid JS; the block comment just runs on to the next `*/`). Only a deleted-line audit caught it. So for **every** modified file, run `git diff -U0` and confirm **every deleted line is a comment line** — that check, not the syntax check, is the real gate for this task.
- [x] Run the existing test suite (141 tests) and confirm the count and pass state are unchanged — **`npm test`: 144 pass, 0 fail, 0 cancelled.** Unchanged relative to HEAD: 144 − 3 = 141, matching the `108→141` baseline at b85cbe9; the +3 is the untracked `test/npm-pack-contents.test.js`. An earlier agent's apparent failure was an artifact of running `node --test test/` instead of the configured `node --test 'test/*.test.js'` — that invocation picks up files the glob deliberately excludes.
- [x] `git diff --stat` — confirm the diff is additive; any deleted non-comment line is a mistake unless it is a comment being replaced — **17 `.js` files, +1445/−78; all 78 deletions are comment or blank lines, 0 non-comment.**
- [x] Spot-check two guards end-to-end against their README-documented block cases (one Serena-first, one command-class) to confirm they still fire — `claude-settings-guard.js` (matcher matches the documented tool set; the removed bootstrap carve-out is genuinely gone — no cwd-dependent branch at the `deny()`; carve-out canary tests among the 144 passing) and `serena-first-glob-guard.js` (full chain intact through to `buildStructuredBlockResponse` still returning `decision: 'block'`). Incidental live confirmation: the verifying agent's own `grep -n` against the README was blocked by `serena-bash-grep-block.js` post-edit.
- [x] Run `./lib/scripts/install-global.sh --skip-mcps` to sync the commented hooks to `~/.claude/hooks/`, since the installed copy is an rsync and does not update itself

### 6. Close out  <!-- agent: general-purpose --> <!-- Updated: 2026-08-06 -->

- [x] Add the `## Commenting standard` section from Step 1 to `lib/hooks/README.md` — landed at `README.md:35`, verbatim except the `Fails:` bullet, which was amended to the corrected finding (infrastructure fails **open** across nearly every guard; an ambiguous *match* fails closed; `interpreter-indirection-guard.js` is the sole genuinely fail-closed guard)
- [x] **Fix stale line citations in `lib/hooks/README.md`** — 5 corrected: `serena-bash-grep-block.js:126/160/189` → `:312/393/454`; `env-file-guard.js:39` → `:81`; `env-file-guard.js:6-13` → `:48-55`. None had to be downgraded to a symbol name
- [x] Update `CLAUDE.md`'s `lib/hooks/` bullet to mention that hook scripts carry inline rationale comments by deliberate exception to the repo-wide no-comments default
- [x] Append the operation to `wiki/log.md`

> **Left deliberately unchanged — a repo-wide citation convention question.** Every remaining non-`.js` citation in `lib/hooks/README.md` is off by exactly one against 1-based line numbers (`setup-runner.sh:73`→74, `startup.sh:25`/`:37`→26/38, `install-mcps.sh:321`→322, `:197`/`:297`→198/298, `bootstrap-serena.sh:35`/`:51`→36/52, `SKILL.md:29`→30, `templates/gitignore:23-25`→24-26). The uniformity says these were generated from Serena's 0-based output rather than having drifted. None was invalidated by this task, so they were left alone rather than half-flipping the file to a second convention. **Worth a deliberate decision.**
>
> Also stale from this task's own line growth: `wiki/log.md:398` and possibly `BUG-0007` cite `lib/hooks/README.md:522-525`, which the standard's insertion shifted by ~93 lines. The log is append-only so it was not edited.

## Notes

- **Scope boundary:** `lib/hooks/` only. Do not comment `lib/scripts/`, `lib/skills/`, or `bin/` — the exception to the no-comments default is scoped to this directory and widening it silently would be a real regression.
- **Interaction with TASK-031:** that task adopts `/sandbox` and may add or rewire guards. It does not conflict logically with a comments-only pass, but if both run concurrently expect textual merge conflicts in whichever hook files it touches.
