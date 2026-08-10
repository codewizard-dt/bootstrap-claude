---
id: TASK-045
title: "Wire the sync-wiki-scaffold.sh, install-global.sh, and update-project.sh prompt sites"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [TASK-043]
blocks: [TASK-047]
parallel_safe_with: [TASK-044, TASK-046, TASK-031, TASK-039]
uat: "[[UAT-045]]"
tags: [prefs, install, guides, consent, shell, roadmap-005]
---

# TASK-045 — Wire the sync-wiki-scaffold.sh, install-global.sh, and update-project.sh prompt sites

part_of::[[ROADMAP-005]]

## Objective

Make the three remaining installer prompts outside the MCP and `.gitignore` families sticky: the optional-guide offer in `sync-wiki-scaffold.sh` (`guides.*`, one key per guide), the stale-skill-folder deletion in `install-global.sh` (`skills.pruneOrphans`), and the legacy `.docs/` continue-anyway warning in `update-project.sh` (`update.legacyDocsAck`). Two of these three are today hand-rolled `read -r -p` blocks that do not even go through `prompt_yn`, so this task also brings them onto the shared helper and the `BOOTSTRAP_ASSUME_TTY` seam.

## Approach

**`guides.*` is a dynamic family, and its key literal is computed on purpose.** One key per entry of `OPTIONAL_GUIDES` (`sync-wiki-scaffold.sh:81`), keyed by the **exact entry text including any extension** — today `guides.evals-framework.md` and `guides.type-checking-templates`. The call site must build `guides.$guide` inside the existing loop, never a hard-coded list: enumerating the guides in a second place is exactly the drift the wildcard schema entry exists to prevent. The bijection scan in `test/bootstrap-prefs.test.js` deliberately skips shell-variable keys and excludes `dynamic: true` families from the schema→scripts direction, so a computed key here is correct and needs no test accommodation. Do not "fix" the scan by writing literals.

**Presence on disk beats a stored answer, and that ordering is deliberate.** A guide already in `wiki/guides/` (or in the legacy `.docs/guides/`) is refreshed regardless of the key — the file on disk is the stronger signal, and the schema says so. Keep the existing `[ -e "$GUIDES_DST/$guide" ] || [ -e "$LEGACY_GUIDES/$guide" ]` branch first and untouched; preferences only decide what happens for a guide that is **absent**.

**The stored answer must be consulted before the `INTERACTIVE` guard, not after.** Today the offer is `[ "$INTERACTIVE" = true ] && prompt_yn …`, so a non-interactive run never asks. If the sticky call is simply dropped in behind that guard, a stored `true` would be ignored on every non-interactive run, contradicting the schema's "true delivers the guide into `wiki/guides/` on every run". So the loop becomes an explicit three-way ladder: stored `true` → deliver; stored `false` → skip silently; `ask`/`unset` → today's `INTERACTIVE`-gated prompt through `prompt_yn_sticky`. Both directions are recorded — the declines-only rule belongs to the `gitignore.*` keys only.

**`update.legacyDocsAck` records `true` only, and this is a deliberate asymmetry.** A recorded `false` would make every future `npx bootstrap update` abort at `exit 0` **without asking**, leaving no prompt through which to change your mind — the update command would be bricked until the user found `/bootstrap-config`. The key's name is an *acknowledgement*: a yes is a durable "I know, stop warning me", a no is a per-run decision to go migrate first. So: interactive yes → record `true` and continue; interactive no → abort as today, record nothing; stored `true` → continue with a remembered-answer note and no prompt. `false` stays a legal value that `/bootstrap-config` can set for a user who genuinely wants `update` to keep refusing, and the read path must honour it — it is only never *written* by this prompt.

**`install-global.sh` does not source `lib.sh` today.** It computes `SCRIPT_DIR` with `dirname "$0"` (`:4`) and hand-rolls its prompt with `[ -t 0 ]` + `read -r -p` (`:58-70`). Add `. "$SCRIPT_DIR/lib.sh"` after `SCRIPT_DIR`/`TEMPLATE_DIR` are set, then use `prompt_yn_sticky`. Check for name collisions between `lib.sh`'s functions and anything `install-global.sh` already defines before assuming the source is free. `skills.pruneOrphans` is `scope: global` and this script has no project dir, so the selector is `--global` — the only correct choice here.

**Leave `sync-wiki-scaffold.sh:171` alone.** The CLAUDE.md-vs-CLAUDE.local.md question is the one prompt in the whole repo that is already sticky in both directions, because *both* answers write a sentinel somewhere. It is the model this roadmap generalises, and wiring it to the store would add a second, redundant source of truth that could disagree with the file on disk. `/bootstrap-config` surfaces it read-only in Phase 3. Do not touch it.

**Only record an answer that was actually asked interactively.** TASK-043 makes this structural inside the helpers; it is violated only by hand-rolling a `read` beside a `--set`. Two of the three sites in this task are currently hand-rolled `read` blocks, which makes this the task most likely to reintroduce the bug — convert them fully to `prompt_yn_sticky` rather than bolting a `--set` onto the existing `case`.

## Steps

### 1. Read the ground truth  <!-- agent: general-purpose -->

- [x] Read the guide-tier block in `lib/scripts/sync-wiki-scaffold.sh` (`:63-105`), the orphan-skills block in `lib/scripts/install-global.sh` (`:43-74`), and the legacy-`.docs/` block in `lib/scripts/update-project.sh` (`:17-55`)
- [x] Read the finished `prompt_yn_sticky` / `prefs_get` / `has_tty` in `lib/scripts/lib.sh` (TASK-043)
- [x] Read the `guides.*`, `skills.pruneOrphans` and `update.legacyDocsAck` entries in `lib/scripts/templates/bootstrap-prefs-schema.json` — implement what each `detail` says

**Recon findings that shape steps 2-7:**
- `install-global.sh` defines **zero functions** and no variable colliding with `lib.sh` (whose only global is `BOOTSTRAP_PREFS_JS`) — the source is namespace-safe. `lib.sh`'s only source-time side effect is computing `BOOTSTRAP_PREFS_JS` from its own `${BASH_SOURCE[0]}`, so `install-global.sh`'s `$0`-based `SCRIPT_DIR` needs no change.
- ⚠️ **`test/install-global.test.js` `buildTemplate()` does not copy `lib.sh`** into its scratch template tree. Adding the source aborts all 7 tests under `set -euo pipefail` until `lib.sh` (+ `bootstrap-prefs.js` and `templates/bootstrap-prefs-schema.json` for real stickiness) is added to that copy list.
- ⚠️ **`update-project.sh`'s non-interactive branch today CONTINUES**; `prompt_yn_sticky`'s non-interactive branch answers **no**. A one-for-one swap would invert CI behaviour and abort every headless `update` on a legacy project — the ladder needs its own non-interactive branch.
- `prompt_yn_sticky` prints its remembered-answer notice to **stdout** (unlike `prompt_choice_sticky`/`prompt_scope`, which use stderr) — safe as an `if` condition, never wrap it in `$(...)`.
- `PROJECT_DIR` is guaranteed non-empty in both `sync-wiki-scaffold.sh` (`:25`) and `update-project.sh` (`:12`) — `resolve_project_dir` prints an absolute path or the script exits.
- Bare `[ -t 0 ]` exists only at `install-global.sh:58` and `update-project.sh:45`, both inside blocks steps 3 and 4 replace outright; `sync-wiki-scaffold.sh` has none.
- All three citation pins are **correct today** (`sync-wiki-scaffold.sh:81`, `install-global.sh:59`, `update-project.sh:46`); the test asserts `lines[n-1].includes(pin)` with an explicit 1-based comment.

### 2. Wire the optional-guide loop  <!-- agent: general-purpose -->

- [x] In `lib/scripts/sync-wiki-scaffold.sh`, keep the `for guide in $OPTIONAL_GUIDES` loop and its first branch (already present → `deliver_guide` + the `refreshed (already present — previously opted in)` message) exactly as they are
- [x] For the absent case, build the key as `guides.$guide` — the loop variable, never a literal — and branch on `prefs_get "guides.$guide" "$PROJECT_DIR"`:
  - `true` → `deliver_guide "$guide"` and print a remembered-answer line naming the key
  - `false` → print a remembered-decline line and skip; do **not** print the existing "Opt in any time" nudge, which would be misleading for an answered question
  - anything else (`ask`, `unset`, unrecognized) → today's behavior: `[ "$INTERACTIVE" = true ] && prompt_yn_sticky "guides.$guide" "$PROJECT_DIR" "  Install optional guide '$guide'? [y/N]: "`, else the existing skip message
- [x] Comment why the store is consulted before the `INTERACTIVE` guard rather than behind it
- [x] Confirm `PROJECT_DIR` is non-empty at this point in the script — the guides keys are `scope: project` and an empty selector would write into the installer's cwd

Loop rewritten as a three-way ladder at `sync-wiki-scaffold.sh:96-134`. `bash -n` passes. `OPTIONAL_GUIDES=` **did not move** — still line 81, so that citation needs no repair. The CLAUDE.md-vs-CLAUDE.local.md prompt moved 171 → 200 as pure context (byte-unchanged, still `prompt_yn`). `PROJECT_DIR` confirmed non-empty: `resolve_project_dir` prints `pwd` or the script exits.

### 3. Wire the stale-skill-folder prompt  <!-- agent: general-purpose -->

- [x] Add `. "$SCRIPT_DIR/lib.sh"` to `lib/scripts/install-global.sh` immediately after `TEMPLATE_DIR` is computed (`:5`), and check first that nothing in the script collides with a `lib.sh` function or variable name
- [x] Replace the `if [ -t 0 ]; then read -r -p "Delete these ${#ORPHAN_FOUND[@]} folder(s)? [y/N]: " REPLY; case … esac; else … fi` block (`:58-73`) with a single `prompt_yn_sticky skills.pruneOrphans --global "Delete these ${#ORPHAN_FOUND[@]} folder(s)? [y/N]: "`
- [x] Keep both outcome messages verbatim — the `Removed.` line and the long `Skipped. To remove manually: rm -rf ~/.claude/skills/{…}` hint, which is the user's only escape route if they change their mind before `/bootstrap-config` exists
- [x] Keep the non-interactive message informative: the helper's own note plus the existing `Non-interactive mode: skipping deletion.` line, or one merged line — **took the merged-line option** (see departure below)
- [x] Verify the deletion loop itself is unchanged: this key decides only *whether* the removal runs, never which folders qualify (that list is fixed at `:9-12`)

**Discovered subtask, completed:** `test/install-global.test.js`'s `buildTemplate()` copies a fixed file list into its scratch template tree and did **not** include `lib.sh` — the new source would have aborted all 7 tests under `set -euo pipefail`. Added `lib.sh` and `bootstrap-prefs.js` to the scripts list and `bootstrap-prefs-schema.json` to the templates list, so the sticky path is genuinely exercised under test instead of degrading to `unset`/no-op. `buildTemplate()` is the only tree-builder in the file.

`. "$SCRIPT_DIR/lib.sh"` landed at `:6-7`; line 4 untouched. `Delete these` prompt moved **59 → 70**; `ORPHAN_SKILLS=(` moved 9 → 11 with byte-identical contents; the `rm -rf` loop is byte-identical. `bash -n` passes; `node --test test/install-global.test.js` → **7 pass, 0 fail**.

**Departure:** the literal `Non-interactive mode: skipping deletion.` line is gone. With `prompt_yn_sticky` as the sole `if` condition, a decline and a non-interactive run are the same branch, so keeping the distinct message would mean reintroducing a `has_tty` check and defeating the simplification. A headless run now prints the helper's `  Non-interactive terminal: skipping prompt, answering no.` followed by the verbatim `Skipped. To remove manually: rm -rf ~/.claude/skills/{…}` line — still says nothing was deleted, and now also hands over the removal command the old message withheld.

### 4. Wire the legacy `.docs/` acknowledgement  <!-- agent: general-purpose -->

- [x] In `lib/scripts/update-project.sh`, replace the `if [ -t 0 ]; then read -r -p "Continue with update anyway? [y/N]: " REPLY; case … esac; else … fi` block (`:45-53`) with the sticky form keyed `update.legacyDocsAck`, selector `"$PROJECT_DIR"`
- [x] **Record `true` only.** Implement it so the decline path cannot write: check the stored value first (`true` → continue with a remembered note, no prompt; `false` → keep honouring it as an abort, since `/bootstrap-config` may have set it), and on the interactive prompt record only when the answer is yes
- [x] Comment the reasoning: a recorded `false` would abort every future `update` with no prompt left to change it with, and the key is an acknowledgement rather than a policy
- [x] Keep the `Aborted.` message and the `exit 0` on decline, and keep the whole warning banner (`:32-44`) unchanged — the migrate instruction is the point of the block
- [x] Note that answering yes migrates nothing; it only stops the warning blocking every subsequent update

**Deliberate exception to "convert fully to `prompt_yn_sticky`":** this is the one site that must NOT use it, for two independent reasons. `prompt_yn_sticky` records in both directions, and a persisted `false` here would abort every future `update` at `exit 0` with no prompt left to change it. And its non-interactive branch answers *no*, which would invert today's behaviour and abort every headless `update` on a legacy project. So the ladder reads with `prefs_get`, asks with plain `prompt_yn`, and calls `prefs_set … true` on the yes path only — no decline path can reach a write. The no-tty branch still continues with the verbatim `  Non-interactive mode: continuing with update.` line. `false` stays honoured on read for `/bootstrap-config`'s benefit.

Ladder at `:46-86`. `Continue with update anyway?` moved **46 → 76**. Banner still exactly lines 32-44, byte-identical. `bash -n` passes.

### 5. Adopt the tty seam  <!-- agent: general-purpose -->

- [x] Replace any remaining bare `[ -t 0 ]` / `[ ! -t 0 ]` in these three scripts with `has_tty` / `! has_tty`, so TASK-047 can drive them
- [x] Do not change the `INTERACTIVE` flag logic anywhere — the seam is about tty detection only

Only two bare tty tests existed across the three scripts, both inside blocks steps 3 and 4 replaced outright: `install-global.sh:58` (now gone — `prompt_yn_sticky` owns the detection via `has_tty` internally) and `update-project.sh:45` (now `has_tty`). `sync-wiki-scaffold.sh` had none — it was already on `prompt_yn`. No `INTERACTIVE` logic touched anywhere; `update-project.sh` has no `INTERACTIVE` flag at all.

### 6. Repair the schema citations this task moves  <!-- agent: general-purpose -->

- [x] Re-find the new line numbers for: `OPTIONAL_GUIDES=` in `sync-wiki-scaffold.sh` (was `:81` — it may not move at all; verify rather than assume), `Delete these` in `install-global.sh` (was `:59`; sourcing `lib.sh` will shift it), and `Continue with update anyway?` in `update-project.sh` (was `:46`)
- [x] Update the `sync-wiki-scaffold.sh:81`, `install-global.sh:59` and `update-project.sh:46` citations in `guides.*.detail`, `skills.pruneOrphans.detail` and `update.legacyDocsAck.detail` in `lib/scripts/templates/bootstrap-prefs-schema.json`
- [x] Update the three matching `CITATION_PINS` rows (`test/bootstrap-prefs.test.js:~2371`), keeping each pin substring unchanged
- [x] **Shared-file hazard.** TASK-044 and TASK-046 run concurrently and edit *other* rows of these same two files. Targeted `Edit` on your three rows only, never `Write`, re-read immediately before editing, and leave rows citing scripts you did not modify alone
- [x] `node --test test/bootstrap-prefs.test.js` to confirm the citation test passes

| Pin | Old | New | Action |
|---|---|---|---|
| `sync-wiki-scaffold.sh` / `OPTIONAL_GUIDES=` | 81 | **81** | left alone — genuinely did not move |
| `install-global.sh` / `Delete these` | 59 | **70** | edited |
| `update-project.sh` / `Continue with update anyway?` | 46 | **76** | edited |

Two edits per file, not three. Numbers computed from file content via `split('\n')` index + 1, never from a Serena result. Schema rows touched: `update.legacyDocsAck.detail` (`:42`), `skills.pruneOrphans.detail` (`:125`). Pin rows touched: `:2376`, `:2386`. All `install-mcps.sh:*`, `lib.sh:387` and `merge-gitignore.sh:*` rows verified unchanged in a post-edit sweep. `node --test test/bootstrap-prefs.test.js` → **65 tests: 64 pass, 0 fail, 1 skipped** — matches the TASK-044 baseline; the skip is the `schema -> scripts` test TASK-047 owns.

### 7. Verify  <!-- agent: general-purpose -->

- [x] `bash -n` on all three scripts
- [x] Guides: in a scratch project with `BOOTSTRAP_ASSUME_TTY=1`, decline `evals-framework.md`, confirm `<scratch>/.claude/bootstrap-prefs.json` holds `"guides.evals-framework.md": false` (a JSON boolean, not the string), then re-run and confirm no prompt and no delivery
- [x] Guides: accept the other optional guide, confirm it is delivered, then re-run and confirm the **presence** branch (`refreshed (already present …)`) is what fires — not the stored answer
- [x] `skills.pruneOrphans`: with a fake orphan folder under a redirected `HOME`, decline once, confirm `~/.claude/bootstrap-prefs.json` (in the **scratch** home) holds `false`, and confirm the second run neither prompts nor deletes
- [x] `update.legacyDocsAck`: in a scratch project containing `.docs/tasks/x.md`, decline and confirm the run aborts **and writes no preferences file**; accept and confirm `true` is stored and the next run continues without prompting
- [x] Confirm a non-interactive run of each script creates no preferences file at all
- [x] Confirm `sync-wiki-scaffold.sh:171` (CLAUDE.md vs CLAUDE.local.md) is byte-unchanged
- [x] **Never run any of this against the real `~/.claude/`** — always a redirected `HOME` and a scratch project dir. `install-global.sh` writes to `~/.claude/skills/` and `~/.claude/hooks/` and would rsync over the developer's install
- [x] `npm test` green — `test/install-global.test.js` drives the real `install-global.sh` against a scratch `HOME` and will catch a broken `lib.sh` source immediately

**Verification results — all green, no script changes needed.** Every run used `HOME=<scratch>` plus a stubbed `claude` on `PATH`; `install-global.sh` always got `--skip-mcps`.

- `bash -n`: OK on `sync-wiki-scaffold.sh`, `install-global.sh`, `update-project.sh`.
- **Guides.** Run 1 (`--interactive`, `BOOTSTRAP_ASSUME_TTY=1`, stdin `n`,`y`): evals declined, type-checking-templates delivered. Project store: `{"guides.evals-framework.md": false, "guides.type-checking-templates": true}` — both `typeof boolean`. Run 2 with `y`,`y`,`y` on stdin changed nothing and printed `evals-framework.md: skipped (remembered answer guides.evals-framework.md=false …)` and `type-checking-templates: refreshed (already present — previously opted in).` — the presence branch, not the stored-answer branch. Bonus: deleting the delivered dir and re-running fully headless printed `type-checking-templates: delivered (remembered answer guides.type-checking-templates=true …)`, proving the store is read ahead of the `INTERACTIVE` guard.
- **`skills.pruneOrphans`.** Fake `adr-create`/`prd-create` under a scratch `HOME`; decline → `{"skills.pruneOrphans": false}` (boolean) in the scratch home, folders intact, `Skipped. To remove manually: rm -rf ~/.claude/skills/{…}` printed. Second run with `y` on stdin printed `skills.pruneOrphans: using remembered answer (no) — change with /bootstrap-config`, no prompt, folders still intact.
- **`update.legacyDocsAck`.** Decline → banner, `Aborted.`, `exit 0`, and **no `.claude/` directory at all** in the scratch project. Accept → `update.legacyDocsAck: true` (boolean) recorded before the sync runs; next run printed `update.legacyDocsAck: using remembered answer (yes) — change with /bootstrap-config` and continued past the banner with no prompt.
- **Non-interactive.** All three scripts run with `< /dev/null` and no `BOOTSTRAP_ASSUME_TTY` created **no** preferences file (project or global). Guides printed one `Non-interactive terminal: skipping prompt, answering no.` per guide; `install-global.sh` printed it once then the manual-removal hint; `update-project.sh` printed `Non-interactive mode: continuing with update.` and continued (old behaviour preserved).
- **`sync-wiki-scaffold.sh:171`.** The HEAD line-171 string matches current line **200** byte-for-byte and appears exactly once. `git diff` on the file has a single hunk, entirely inside the `OPTIONAL_GUIDES` loop.
- **Real `$HOME` untouched.** `/Users/davidtaylor/.claude/bootstrap-prefs.json` absent before and after; `~/.claude/settings.json` sha256 `cd03d48c…f67a1` unchanged.
- **`npm test`:** `tests 209 | pass 208 | fail 0 | skipped 1` — identical to the baseline.

## Notes

<!-- Updated: 2026-08-06 -->

**Final wiring — three prompt sites, three key families.**

| Key | Line | Helper | Selector |
|---|---|---|---|
| `guides.$guide` (dynamic) | `sync-wiki-scaffold.sh:128` (asked), ladder at `:96-134` | `prompt_yn_sticky` | `"$PROJECT_DIR"` |
| `skills.pruneOrphans` | `install-global.sh:70` | `prompt_yn_sticky` | `--global` |
| `update.legacyDocsAck` | `update-project.sh:76` | `prefs_get` + plain `prompt_yn` + `prefs_set … true` | `"$PROJECT_DIR"` |

**How `guides.*` resolves to a concrete key.** The call site never names a guide. It builds `guides.$guide` from the `for guide in $OPTIONAL_GUIDES` loop variable, so the key literal is whatever `OPTIONAL_GUIDES` (`sync-wiki-scaffold.sh:81`) holds — today `guides.evals-framework.md` and `guides.type-checking-templates`, extension included. Adding a guide to that one list is the only edit needed; nothing enumerates the guides a second time. Verified end to end: both keys appeared in the scratch project store with the exact expected literals.

**The one site that deliberately does NOT use `prompt_yn_sticky`.** `update.legacyDocsAck` is hand-assembled from `prefs_get` + `prompt_yn` + `prefs_set … true` because the sticky helper is wrong here twice over: it records in both directions (a persisted `false` would abort every future `update` with no prompt left to change it), and its non-interactive branch answers *no* (which would invert today's behaviour and abort every headless `update` on a legacy project). The ladder therefore has its own no-tty branch that continues, and no decline path can reach a write. A stored `false` is still honoured on read, since `/bootstrap-config` may set it deliberately.

**Discovered and fixed outside the written steps:** `test/install-global.test.js`'s `buildTemplate()` copies a fixed file list into its scratch template tree and did not include `lib.sh`. The new `. "$SCRIPT_DIR/lib.sh"` would have aborted all 7 of its tests under `set -euo pipefail`. Added `lib.sh` + `bootstrap-prefs.js` to the scripts list and `bootstrap-prefs-schema.json` to the templates list, so the harness exercises the real sticky path instead of degrading to `unset`/no-op.

**Two harness artifacts, neither a script defect.** Under `BOOTSTRAP_ASSUME_TTY=1` with stdin at EOF, `read` returns empty and a sticky prompt records `false` — the documented EOF path in `lib.sh`'s `has_tty` banner, unreachable at a real tty. And `read -r -p` does not echo its prompt when stdin is a pipe, so prompt text never appears in piped logs; the evidence a prompt fired is the answer being consumed and recorded.

**Left deliberately un-skipped:** the `schema -> scripts: every non-dynamic schema key is referenced` test, same as TASK-044. TASK-046's `gitignore.*` keys are still unwired, so it belongs to TASK-047, which lands last in Phase 2.
