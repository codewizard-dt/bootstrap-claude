---
id: TASK-037
title: "Document automated hooks wiring — lib/hooks/README.md is no longer a manual-paste instruction sheet"
status: done
created: 2026-07-31
updated: 2026-07-31
depends_on: [TASK-032, TASK-033, TASK-035, TASK-036]
blocks: [TASK-038]
parallel_safe_with: []
uat: "[[UAT-037]]"
tags: [docs, hooks, install]
---

# TASK-037 — Document automated hooks wiring — lib/hooks/README.md is no longer a manual-paste instruction sheet

derived_from::[[ROADMAP-004]]

## Objective

Once TASK-032/033 ship `lib/scripts/templates/settings-hooks.json` + `merge-settings-hooks.js`, and TASK-035/036 reorder `install-global.sh`/`lib.sh` so hook wiring happens automatically on every `install`/`setup`/`update`, the prose in `lib/hooks/README.md` (and the step-order claims in `lib/scripts/README.md` and root `CLAUDE.md`) will be describing a process that no longer exists: "wiring is a one-time manual paste" and "MCP install runs first". This task brings all three docs back in line with the shipped behavior, with `lib/scripts/templates/settings-hooks.json` established as the single source of truth for the wiring JSON (no more duplicated-and-driftable copy inside the README).

## Approach

The implementation plan at `/Users/davidtaylor/.claude/plans/ok-now-parallel-cerf.md` (§5, "`lib/hooks/README.md` — single source of truth") is authoritative for what changes and why:

- **Header (`lib/hooks/README.md:7-10`) and closing reminder (`:900-903`)** currently tell the reader that `install-global.sh` copies the hook *scripts* but never registers them — "Registration is the one-time manual step above." That is now false: `install-global.sh` also runs `merge-settings-hooks.js`, which wires `hooks` into `~/.claude/settings.json` on every run. Both passages need rewriting to say so.
- **The inline JSON block (`:723-877`)** is a byte-for-byte copy of `lib/scripts/templates/settings-hooks.json` (that template was extracted *from* this block — see plan §1). Once the template exists, the README copy is a duplicate that will drift the moment someone edits one but not the other. Replace it with a pointer to the template file rather than keeping two copies in sync by hand.
- **New notes to add** alongside the pointer, per plan §2's merge algorithm: the merge never touches user-added blocks or hooks (foreign entries/blocks are never modified, reordered, or removed); edits a user makes directly to an *owned* entry (one whose `command` matches `~/.claude/hooks/<name>.js` and whose basename appears in the template) are overwritten on the next `install`/`setup`/`update` run, because the template owns its own blocks — the escape hatch is to point that hook's `command` somewhere else so it no longer matches an owned entry.
- **Keep, verbatim, the matcher-gotcha prose (`:879-898`)** — the three notes about `env-content-read-guard.js`'s dual-surface matcher, `claude-settings-guard.js`'s file-tool-only matcher, and the four `if:`-less Bash-matched guards. This documents *why the template looks the way it does*, which stays true whether the JSON is inline or in a template file — it does not describe the manual-paste process, so it is not stale.
- **Step-order sweep**: plan §3 reorders `install-global.sh` (hooks rsync → skills → deny merge → **new: hooks wiring** → fileSuggestion → MCPs last, guarded) and plan §4 reorders `lib.sh`'s `run_project_sync()` (`install-global.sh --skip-mcps` first, then the interactive MCP step, guarded, so wiki scaffold / mcp-guide / Serena bootstrap still run even if MCPs fail). Any doc prose that lists MCP install as the *first* step of `setup`/`update`/`install`, or that summarizes `run_project_sync` as "MCPs → skills/hooks → wiki scaffold → gitignore → Serena", is now describing the old order and must be corrected. Confirmed locations to check (there may be others — this is not necessarily exhaustive):
  - `lib/scripts/README.md` line ~10 (`setup-project.sh` row: "runs the full new-project sequence: MCP install (interactive), global skills/hooks install, …")
  - `lib/scripts/README.md` line ~12 (`install-global.sh` row: needs to mention the hooks-wiring merge step and that MCPs now run last/guarded)
  - `lib/scripts/README.md` line ~22 (`lib.sh` row: "`run_project_sync` (the common setup/update sequence: MCPs → skills/hooks → wiki scaffold → gitignore → Serena)")
  - Root `CLAUDE.md` lines ~70-72 (the `setup`/`update`/`install` bullet descriptions) and ~82-84 (manual-setup step 5, "Install MCPs and skills globally")
  - Root `CLAUDE.md` line ~173 (`lib/hooks/` bullet: "wiring is a one-time manual step") and ~175 (`install-global.sh` bullet: doesn't yet mention hooks wiring)
- Do **not** touch anything under `raw/` — `raw/design-principles.md`, `raw/llm-wiki.md`, etc. are immutable ground-truth documents, not in scope here regardless of what a grep turns up.

## Steps

- [x] Re-read the shipped state of `lib/scripts/templates/settings-hooks.json` and `lib/scripts/merge-settings-hooks.js` (from TASK-032/033) and the reordered `lib/scripts/install-global.sh` / `lib/scripts/lib.sh` (from TASK-035/036) so the docs describe what actually shipped, not just the plan's proposal — confirm file paths, script names, and behavior notes (never-touches-foreign, owned-entry-overwrite-on-next-run) match reality before writing prose
- [x] Rewrite `lib/hooks/README.md` header (currently lines ~7-10) to state that `install-global.sh` now both rsyncs the hook scripts to `~/.claude/hooks/` **and** wires them into `~/.claude/settings.json` via `merge-settings-hooks.js` — manual pasting is no longer required
- [x] Replace the inline `~/.claude/settings.json` wiring JSON (currently lines ~723-877, under "## Required `~/.claude/settings.json` wiring") with a pointer to `lib/scripts/templates/settings-hooks.json` as the single source of truth, plus a short note that this file is what `merge-settings-hooks.js` reads and merges on every `install`/`setup`/`update` run
- [x] Add explicit merge-semantics notes next to the pointer: (a) the merge never modifies, reorders, or removes foreign (user-added) blocks or hooks; (b) direct edits to an *owned* entry (basename matches a template hook and lives at `~/.claude/hooks/<name>.js`) are overwritten the next time the merge runs, because the template owns its blocks — to opt a hook out of that, point its `command` at a different path so it no longer matches an owned entry
- [x] Keep the matcher-gotcha prose (currently lines ~879-898 — the three notes on `env-content-read-guard.js`'s dual matcher, `claude-settings-guard.js`'s file-tool-only matcher, and the four `if:`-less Bash guards) intact and in place; only adjust surrounding cross-references if the line-shift from replacing the JSON block changes what it's pointing at
- [x] Rewrite the closing reminder (currently lines ~900-903) to drop "Registration is the one-time manual step above" and instead state that registration now happens automatically on every `install-global.sh` run (via `merge-settings-hooks.js`), and that a fresh install or wiring change prints a restart-your-session note
- [x] Update `lib/scripts/README.md`: the `setup-project.sh` row (step-order text listing "MCP install (interactive)" first), the `install-global.sh` row (add the hooks-wiring merge step and note MCPs now run last and are non-fatal on failure), and the `lib.sh` row's `run_project_sync` summary (old order "MCPs → skills/hooks → wiki scaffold → gitignore → Serena" needs to reflect hooks/skills/deny/hooks-wiring running via `install-global.sh --skip-mcps` first, then the guarded interactive MCP step, then wiki scaffold / mcp-guide / Serena bootstrap)
- [x] Update root `CLAUDE.md`: the `setup`/`update`/`install` npm-command bullets (~lines 70-72), manual-setup step 5 "Install MCPs and skills globally" (~lines 82-84, if its description implies MCPs install before hooks), the `lib/hooks/` key-files bullet (~line 173 — drop "wiring is a one-time manual step" and the "does NOT register them" framing), and the `install-global.sh` key-files bullet (~line 175 — add that it also merges hook wiring via `merge-settings-hooks.js` and templates/settings-hooks.json)
- [x] Grep/search (Serena `search_for_pattern`, not shell grep) across `lib/hooks/README.md`, `lib/scripts/README.md`, and `CLAUDE.md` for any other residual "manual", "by hand", "one-time step", or MCP-install-first phrasing this task's targeted line numbers may have missed — line numbers will have shifted after earlier edits in this same task, so re-search rather than trusting the original offsets
- [x] Do a final consistency read-through of all three files together: confirm no doc still claims wiring is manual, no doc still lists MCP install before hooks/skills in `setup`/`update`/`install`'s described order, the matcher-gotcha prose is untouched, and the settings-hooks.json pointer is the only place the wiring JSON's *shape* is described (no second inline copy reintroduced)
- [x] Confirm no file outside `lib/hooks/README.md`, `lib/scripts/README.md`, and `CLAUDE.md` was edited, and that nothing under `raw/` was touched

## Findings discovered during execution (out of scope here — code untouched)

- **Restart reminder never fires on the "changes applied" path** — `install-global.sh` line ~94 matches `*'change(s) applied'*` literally, but `merge-settings-hooks.js` prints `1 change applied` / `N changes applied`, so only the `created` path triggers the reminder. One-line shell fix; candidate for TASK-038 or a bug file.
- **Opt-out via re-pointing `command` is weaker than planned** — re-pointing protects the edited entry from overwrite, but the next merge run re-appends the stock template entry alongside it (basename no longer matches, so the relocation check doesn't suppress re-insertion). `lib/hooks/README.md` documents the shipped behavior, not the plan's stronger claim.

<!-- Updated: 2026-07-31 -->

