---
id: TASK-029
title: "Ship fileSuggestion @-autocomplete restoration for info/exclude'd wiki dirs"
status: pending-uat
created: 2026-07-29
updated: 2026-07-29
depends_on: []
blocks: []
parallel_safe_with: [TASK-027, TASK-028]
uat: "[[UAT-029]]"
tags: [claude-code, autocomplete, settings-merge, install-global]
---

# TASK-029 — Ship fileSuggestion @-autocomplete restoration

derived_from::[[git-exclude-at-autocomplete]]

## Objective

Restore Claude Code `@` file autocomplete for the bootstrap-hidden dirs (`.serena/`, `raw/`, `wiki/`) that `.git/info/exclude` currently blinds. Ship a `fileSuggestion` custom-picker script that re-includes only the sentinel-scoped excluded paths, register it globally via a settings merge in `install-global.sh`, and correct the over-broad "invisible to the tools" claims in prompt/comment text. Research basis: `raw/research/git-exclude-at-autocomplete/index.md` — the built-in picker honors `info/exclude` and (recent versions) suggests only git-tracked files; the documented `fileSuggestion` settings key replaces the picker entirely.

## Approach

- Keep `.git/info/exclude` as the git mechanism (unchanged) — fix the picker side only.
- **Sentinel-scoped re-inclusion**: the script re-includes only paths listed under the `# bootstrap wiki & agent state (machine-local)` sentinel comment in `.git/info/exclude` (written by `merge-gitignore.sh:154-157`), so a user's other deliberately-hidden entries stay hidden, and non-bootstrap projects get built-in-equivalent listing.
- **Merge mechanism**: generalize the existing `lib/scripts/merge-settings-deny.js` with a key-merge mode rather than a new script (user-confirmed; was already on the backlog). Never clobber an existing different `fileSuggestion` — warn and skip.
- Defensive script contract (community-verified, not fully spec'd in docs): stdin JSON `{"query": ...}`, `CLAUDE_PROJECT_DIR` env, newline-separated relative paths on stdout, ≤15 results, always exit 0. Restart required to pick up the setting.
- Global `~/.claude/settings.json` registration (not per-project) — the script degrades to plain listing outside bootstrap projects.

## Steps

### 1. Generalize merge-settings-deny.js with a key-merge mode  <!-- agent: general-purpose -->

- [x] In `lib/scripts/merge-settings-deny.js`, add a `--set-key <name> --set-value <json>` mode alongside the default deny-list merge (flags are additive to the existing `--target`/`--source` test seams).
  - Behavior: parse target settings; if `settings[name]` is **absent**, set it to the parsed JSON value and write atomically (preserve indentation, exit 0 semantics — reuse the existing write path); if **present and deep-equal**, no-op; if **present and different**, print a one-line warning naming the key and the skipped value, change nothing, exit 0.
  - Keep the default invocation (no flags) byte-identical in behavior — the deny merge is battle-tested (UAT-026) and must not regress.
- [x] Extend `test/settings-deny.test.js` (zero-dep `node:test`, same style): absent-key set, deep-equal no-op (byte-identical file), present-different skip+warn, malformed-target fail-safe (exit 0, file untouched), and a regression case proving default deny-merge behavior is unchanged.

<!-- Updated: 2026-07-29 -->
> **Step 1 done.** `merge-settings-deny.js --set-key <name> --set-value <json> [--target <path>]`.
> - Absent → set + atomic write, indentation preserved. Deep-equal → no write, byte-identical. Present-different → one-line stderr warning naming the skipped value, file untouched, exit 0. `--set-key` present → **deny merge does not run** (early exit before the canonical-template load), asserted by a test.
> - **Deep-equal is a hand-rolled structural compare** (`:58`), not `JSON.stringify` equality — a test writes `{command,type}` and passes `{"type":…,"command":…}`, which would spuriously warn-and-skip under stringify comparison.
> - **Deliberate asymmetry on malformed input:** malformed `--set-value` (or a half-supplied flag pair) exits **1** — it is a usage error from our own `install-global.sh` call site and must be loud. A malformed *target* exits **0** untouched, because the caller runs under `set -euo pipefail`.
> - Refactored the inline read/parse/indent/write into `readTarget`/`parseSettings`/`detectIndent`/`writeSettings` shared by both modes; the default path performs the same operations in the same order with the same output strings. Guarded by a new regression test running the no-flag invocation against a tab-indented file with a pre-existing user rule — asserts tabs preserved, user rule still at index 0, canonical 116 appended verbatim in order, unrelated keys intact, no `fileSuggestion` leakage.
> - 8 new tests; suite **69 → 77, all green**. Every case uses `fs.mkdtemp` + `--target`; the real `~/.claude/settings.json` was never touched.

### 2. Create the file-suggestion template script  <!-- agent: general-purpose -->

- [x] New file `lib/scripts/templates/file-suggestion.sh` (bash, executable, no `jq`/`fzf` dependency):
  - Read all of stdin; extract `query` with a POSIX-safe `sed` JSON pull (`.*"query"[[:space:]]*:[[:space:]]*"\([^"]*\)".*`); empty/missing stdin or query → empty query (list mode).
  - `cd "${CLAUDE_PROJECT_DIR:-.}"` (fail → exit 0 silently).
  - Base listing: `rg --files 2>/dev/null`; if `rg` is absent, fall back to `git ls-files --cached --others --exclude-standard 2>/dev/null` and, if that also fails (not a git repo), `find . -type f -not -path './.git/*'` with the `./` prefix stripped.
  - Re-include pass: if `.git/info/exclude` exists, collect the lines **after** the exact sentinel `# bootstrap wiki & agent state (machine-local)` up to the next `#`-comment line or EOF (expected values like `.serena/`, `raw/`, `wiki/`); for each existing dir, append `rg --files --no-ignore <dir> 2>/dev/null` (fallback `find <dir> -type f`).
  - Pipe the union through `sort -u`, then filter case-insensitively with `grep -iF -- "$QUERY"` when the query is non-empty, then `head -15`.
  - Every branch exits 0; no stderr chatter (the picker consumes stdout only).
- [x] Smoke-test in this repo (~~which has the sentinel block in `.git/info/exclude`~~ — **it does not; see findings**): `echo '{"query":"hot"}' | bash lib/scripts/templates/file-suggestion.sh` with `CLAUDE_PROJECT_DIR=$(pwd)` must print `wiki/hot.md`; `echo '{"query":"zzznope"}' | ...` must print nothing and exit 0; `bash -n` gate.

<!-- Updated: 2026-07-29 -->
> **Step 2 done.** `lib/scripts/templates/file-suggestion.sh` created (executable).
> - **⚠️ PREMISE CORRECTION — this task's step 2 checkbox was wrong.** *This repo does **not** have the sentinel block in `.git/info/exclude`* — its exclude file holds only `.context/` and a `# claude-code-runtime` block, and `wiki/` is git-tracked here because this **is** the template repo. So `wiki/hot.md` in the required smoke test came from the base `rg --files` listing, **not the re-include pass**. The smoke test passes but proves nothing about the feature's core mechanism. **Whoever writes the UAT must not assume this repo exercises re-inclusion.**
> - The agent therefore verified the real path in a **hermetic scratch git repo** (`mktemp -d`, nothing written in this repo, no network) — 11 cases, all pass. The load-bearing one: with `wiki/` under the sentinel and thus invisible to base `rg --files`, `wiki/hot.md` still appeared, proving it came from re-inclusion. Scoping verified tight: a user's own *pre*-sentinel exclude entry stays hidden, as does an entry after the next `#` comment line; a sentinel entry naming a nonexistent dir is skipped silently.
> - Fallback chain exercised: `rg` removed from `PATH` → `git ls-files` branch gives the same result; non-git dir → `find` branch works with `./` stripped.
> - **Three independent exit-0 guarantees**, and SIGPIPE was directly tested (40+ file tree truncated to 15): (a) `pipefail`/`set -e` deliberately unset, so pipeline status is `head`'s — a SIGPIPE'd `sort`/`rg`, or `grep` returning 1 on no-match, cannot surface; (b) `exec 2>/dev/null` at the top blocks a `Broken pipe` message reaching the picker; (c) unconditional `exit 0` as the last statement.
> - Hostile queries (`-v`, `*`, `[`, `.*`, `--help`, `a" b`) all exit 0 and none is interpreted as a flag or regex — `grep -iF --` doing its job.
> - Added beyond spec: a `[ ! -t 0 ]` guard before `cat`, else a manual invocation with no pipe hangs.
> - Sentinel text confirmed against `merge-gitignore.sh:155-158` before parsing. Base branch on this machine: `rg` (ripgrep 15.1.0).
> - Gates: `bash -n` clean, `npm test` 77/77 (no JS added).

### 3. Wire installation in install-global.sh  <!-- agent: general-purpose -->

- [x] In `lib/scripts/install-global.sh`, after the deny-list merge block (`lib/scripts/install-global.sh:77-81`): copy `templates/file-suggestion.sh` → `~/.claude/file-suggestion.sh` (`chmod +x`; overwrite is fine — the script is template-owned), then invoke `node "$SCRIPT_DIR/merge-settings-deny.js" --set-key fileSuggestion --set-value '{"type":"command","command":"~/.claude/file-suggestion.sh"}'`.
  - Echo a note on the skip+warn path (pre-existing different `fileSuggestion`) and, on fresh registration, print: restart Claude Code sessions to pick up the new file suggestion command.

<!-- Updated: 2026-07-29 -->
> **Step 3 done.** `install-global.sh` +24/−1 (step 5 block, after the deny merge).
> - **Exit status is useless for branching here** — the merge exits 0 on all three outcomes — so the install captures **stdout+stderr combined** (`2>&1`) and substring-matches. Combined capture is *required*: the skip warning goes to stderr, so a stdout-only capture could not distinguish "present-different" from "unreadable target". Trade-off accepted: the warning now surfaces on stdout, which keeps it visible rather than swallowed in a console installer.
> - Patterns are non-overlapping by construction — `"fileSuggestion" already set` does not contain `"fileSuggestion" set` (the word `already` intervenes), and the skip warning contains `"fileSuggestion" —`.
> - Messages: fresh → *"Restart Claude Code sessions to pick up the new file suggestion command."*; already-set → none; present-different → *"Keeping your existing …"*; **anything unrecognised → silence**, never a wrong message.
> - Verified hermetically against scratch `--target` files with the **exact** invocation and `case` logic under `set -euo pipefail` — 6/6: fresh set, idempotent byte-identical re-run, present-different skip+untouched, **key-reordered deep-equal → `already set` with no spurious clobber warning**, unparseable target → fail-safe with no follow-up line, and a settings file with a pre-existing `permissions.deny` → key appended with unrelated keys preserved. The single-quoted `--set-value` never reaches the exit-1 usage path, so this line cannot break installs.
> - Beyond the checkbox: the closing banner now reads `… + file suggestion`.
> - `~/.claude/settings.json` never targeted; `~/.claude/file-suggestion.sh` still absent — nothing in this session wrote to the live config.
> - Gates: `bash -n` clean; `node --test test/settings-deny.test.js` 23/23.

### 4. Correct over-broad "invisible to the tools" prose  <!-- agent: general-purpose -->

- [x] `lib/scripts/merge-gitignore.sh:137-143` comment block: replace the "invisible to those tools" rationale with the narrowed claim — invisible to **Serena** (GitignoreParser reads only `.gitignore` files); ripgrep-class tools and the Claude Code `@` picker DO honor `info/exclude`, which is why `install-global.sh` registers a `fileSuggestion` script that re-includes the sentinel-scoped paths.
- [x] `lib/scripts/merge-gitignore.sh:151` prompt text: adjust the parenthetical (currently "keeps them visible to Serena/Claude") to "visible to Serena; @-autocomplete restored via the installed fileSuggestion script".
- [x] `lib/scripts/templates/gitignore:137-141` maintainer note: same narrowing + pointer to the fileSuggestion mechanism.
- [x] `lib/scripts/README.md`: update the `merge-gitignore.sh` row (remove the "would blind … Claude Grep" over-claim, mention the fileSuggestion pairing) and the `install-global.sh` + `merge-settings-deny.js` rows (new copy step + `--set-key` mode).
- [x] Root `CLAUDE.md` (this repo, Key Files section): extend the `install-global.sh` bullet with the fileSuggestion script copy + settings-key merge. Do NOT touch `wiki/knowledge/concepts/git-ignore-tool-visibility.md` — already corrected during the 2026-07-29 ingest.

<!-- Updated: 2026-07-29 -->
> **Step 4 done** — documentation only, no behavior change. The narrowed claim, phrased consistently across all four files: `.git/info/exclude` is **invisible to Serena** (its `GitignoreParser` reads only files named `.gitignore`, so the dirs stay navigable) but **not invisible to every tool** — ripgrep-class walkers and Claude Code's `@` picker do honor it, which is why `install-global.sh` registers a `fileSuggestion` picker re-including the sentinel-scoped paths.
> - `merge-gitignore.sh:139-148` comment + `:156` prompt parenthetical; `templates/gitignore:138-144` maintainer note; `lib/scripts/README.md` rows for `merge-gitignore.sh` (over-claim dropped → "would blind Serena on the wiki"), `install-global.sh`, and `merge-settings-deny.js` (`--set-key` semantics); `CLAUDE.md:175`.
> - Careful detail: the merge-gitignore comment refers **forward** to the sentinel block the script itself writes 8 lines later, so nothing asserts that any particular repo already has one — step 2's premise correction stays honored.
> - **Scope addition, accepted:** a `templates/file-suggestion.sh` row was added to the `templates/` table, since that table documents every template individually and the new `install-global.sh` row referenced one with no entry.
> - Gates: `bash -n` clean on `merge-gitignore.sh`, `install-global.sh`, `file-suggestion.sh`; `test/settings-deny.test.js` 23/23. `npm test` 74/77 — **the same three pre-existing TASK-028 interpreter failures**, unchanged in name and count, no new ones (this step touched no JS).

### 6. Normalize pre-existing `.git/info/exclude` entries under the sentinel  <!-- agent: general-purpose -->

**Why this step exists (found and reproduced 2026-07-30, before shipping).** `file-suggestion.sh` re-includes **only** the lines beneath the sentinel. `merge-gitignore.sh` gates on *"are any of the three paths missing?"* and its inner loop appends only paths absent from the file **anywhere** — so a path already present *above* the sentinel never moves beneath it and is silently invisible to the picker. Two reachable failure modes, both verified in a hermetic scratch repo:

| Pre-existing state | Picker showed |
|---|---|
| **A.** three paths hand-added, no sentinel | `src/hotsrc.txt` only — `wiki/` and `raw/` invisible |
| **B.** `raw/`+`wiki/` above, sentinel + `.serena/` beneath | `src/hotsrc.txt` only — still missing both |
| **C.** control, all three beneath sentinel | ✅ all three visible |

**Case B is reachable through the shipped code path**, not just hand-editing: with `raw/` and `wiki/` already excluded, only `.serena/` counts as missing → prompt fires → sentinel written → only `.serena/` appended beneath it. The user gets a picker that looks installed and silently shows nothing new.

**The fix: normalize to canonical form.** Canonical = the sentinel line, immediately followed by `.serena/`, `raw/`, `wiki/` in that exact order.

- [x] Add a canonical-form check to `lib/scripts/merge-gitignore.sh`. If the file already ends up canonical, **do nothing** (idempotent — a re-run must leave the file byte-identical)
- [x] If not canonical, **scrub then re-append**: remove every occurrence of the sentinel line and of the three exact path lines from anywhere in the file, then append the sentinel followed by the three paths in order at the **bottom** of the file
  - Match the three paths as **exact whole lines** (`.serena/`, `raw/`, `wiki/`) — never substring-match, or `raw/` would eat a user's `raw/private/`
  - **Preserve every other line verbatim, in its original order.** This file may hold the user's own deliberate exclusions; they are not ours to reorder or drop
  - Do not leave a trailing blank-line mess: collapse a blank run created by the scrub back to at most one, and ensure the file ends with exactly one newline
- [x] **Prompt only when it would newly exclude something.** If all three paths are already present (any order, any position), this is a pure repair — git's behavior is unchanged, only the picker's view of it — so normalize **without** prompting and echo one line saying what was reorganized. If at least one path is absent, keep the existing consent prompt, then normalize fully on accept
- [x] Extend the hermetic verification from step 2 with the normalization cases: A (no sentinel), B (split above/below), C (already canonical → byte-identical no-op), a file with **only** user entries and none of ours, a file where a user entry sits *beneath* the sentinel, correct order restored from a scrambled order, and a missing/empty `.git/info/exclude`. For each, assert both the resulting file content **and** that `file-suggestion.sh` then surfaces `wiki/`, `raw/`, and `.serena/` files
- [x] `bash -n lib/scripts/merge-gitignore.sh`; `npm test` stays green

<!-- Updated: 2026-07-30 -->
> **Step 6 done — 35/35 hermetic assertions.** `merge-gitignore.sh` only (+~110/−12). Four awk helpers (no bash arrays — the script already uses the bash-3.2 `${POSITIONAL[@]+…}` idiom, so macOS `/bin/bash` 3.2 is in scope and `${#arr[@]}` under `set -u` would break there).
> - `exclude_is_canonical` requires the sentinel and each path **exactly once**, the three lines immediately after the sentinel in order, and the following line (if any) to be a `#` comment. `exclude_normalize` drops every occurrence of the sentinel and the three **exact whole lines** (`$0 == "raw/"`, so `raw/private/` survives — case K), keeps everything else verbatim and in order, appends the canonical block, writes via `mktemp` + `mv -f` (atomic — a partial write must never eat a user's exclusions) and restores the original mode (BSD then GNU `stat`; case N verifies 640 survives).
> - **Blank handling is adjacency-aware, not a global collapse** — a blank is dropped only when the scrub itself bridged it (`dropped && prev_blank`), so a user's own deliberate double blank survives (case J).
> - **Decision tree:** canonical → no-op byte-identical; ≥1 path absent → existing consent prompt, then full normalize on accept; all three present but wrong shape → normalize **without** prompting, echoing `reordered … under the bootstrap sentinel (git unchanged; restores @-autocomplete)`.
>
> **The three judgment calls:**
> 1. **Trailing content after the block IS canonical — with a qualification.** A `#` comment plus more entries after `wiki/` is fine (the picker's awk stops at the next `#`), verified byte-identical in case C2. But a **non-comment** line straight after `wiki/` is *not* canonical, because the picker would keep reading and re-include it. A blank there is also non-canonical — a blank does not terminate the picker's block.
> 2. **A user entry beneath the sentinel gets normalized out, with a printed warning.** Reasoning accepted: the user excluded that path from git *on purpose*; the picker showing it was an accident of block adjacency, so stranding it above restores their intent and matches every other exclusion in the file. Git behavior is unchanged. Because it does change what `@` shows, `exclude_apply` prints a two-line note naming the entry rather than doing it quietly (case E, and a second run is byte-identical).
> 3. **The non-tty concern is structurally moot.** `merge-gitignore.sh:39-42` exits 0 whenever `--interactive` is absent *or* `[ ! -t 0 ]`, long before `GIT_EXCLUDE` is touched — the unprompted repair path is unreachable non-interactively (case M asserts untouched file + early-exit notice). `lib.sh:167` `prompt_yn` is independently safe too.
> - **Cases A and B print picker output BEFORE the fix as well, reproducing the bug in-harness** — A showed only `src/hotsrc.txt`, B showed `.serena/hotcache.txt` + `src/hotsrc.txt`, matching the step-6 reproduction table exactly. After the fix both show all four hot files while the adversarial `secret-hotel.txt` stays hidden.
> - Harness note (not a code issue): on macOS `script` flushes EOF ahead of piped input, so the prompt-accept cases first read empty and answered "n"; fixed by delaying the answer. No production code changed between runs.
> - Gates: `bash -n` clean, `npm test` 79/79. **This repo's `.git/info/exclude` md5-identical before and after**; `git status` shows only `M lib/scripts/merge-gitignore.sh`.

### 5. Verify  <!-- agent: general-purpose -->

- [CONTINGENT: green for TASK-029; suite red pending TASK-028 step 4] `npm test` green (existing 69 + new cases from step 1).
- [x] `bash -n` on `install-global.sh`, `merge-gitignore.sh`, `templates/file-suggestion.sh`.
- [x] Hermetic install check with a scratch `--target` settings file: fresh set, idempotent re-run (byte-identical), pre-existing-different skip+warn — **never merge into the real `~/.claude/settings.json` during verification** (precedent: UAT-026).

<!-- Updated: 2026-07-29 -->
> **Step 5 done — TASK-029 implementation complete.** 23/23 end-to-end assertions pass.
> - **The interaction neither step 2 nor step 3 could see:** the install writes to `~/.claude/settings.json` **twice** (deny merge, then key merge). Verified they do not clobber each other — after registering `fileSuggestion`, all **116 deny entries survived**.
> - **The installed picker works from `~/.claude/`**, invoked directly (not `bash <path>`, so the `+x` bit and shebang are both load-bearing), against a scratch git repo whose `.git/info/exclude` carries the real sentinel: `{"query":"hot"}` → `wiki/hot.md`, exit 0. **Re-inclusion fires from the installed location**, not just in-repo — the failure mode that would have made this feature silently useless.
> - **Adversarial scoping fixture:** `private-hotel.txt` planted *above* the sentinel also matches `"hot"`. It stayed hidden. The picker surfaces sentinel-scoped dirs without leaking a user's own exclusions.
> - **Safety was proven, not assumed:** `os.homedir()` (which `merge-settings-deny.js:33` uses for its default target) was confirmed to follow a redirected `HOME`, and the harness aborts before writing if that ever stops holding. Post-run re-check: real `~/.claude/file-suggestion.sh` still absent; real `settings.json` mtime unchanged, still 117 deny entries and **no** `fileSuggestion` key. **The feature is not live on this machine until someone runs the installer.**
> - **Tilde expansion resolved by evidence, not testing:** whether Claude Code expands a literal `~` in `fileSuggestion.command` is its behavior, not ours. `raw/research/git-exclude-at-autocomplete/sources.md` [S9] shows the official settings reference's own example is verbatim `{"fileSuggestion":{"type":"command","command":"~/.claude/file-suggestion.sh"}}` — we match the documented string exactly.
> - **Residual, for UAT:** the restart-and-type-`@` loop in a live session is the one thing no automated check covers. Worth one manual confirmation after a real `install-global.sh` run.
