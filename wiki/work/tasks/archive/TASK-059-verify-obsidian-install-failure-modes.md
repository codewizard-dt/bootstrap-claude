---
id: TASK-059
title: "Confirm setup/update stay non-fatal on Obsidian install failure and declining leaves everything untouched"
status: done
created: 2026-08-13
updated: 2026-08-14
depends_on: [TASK-053, TASK-055]
blocks: []
parallel_safe_with: [TASK-058]
uat: "[[UAT-059]]"
tags: [obsidian, installer, verification]
---

# TASK-059 — Confirm setup/update stay non-fatal on Obsidian install failure and declining leaves everything untouched

## Objective

Confirm two negative-path properties of the new Obsidian installer (from TASK-053, wired in by TASK-055 — both must be `status: done` first): (a) a simulated failure inside `install-obsidian.sh` (e.g. `brew`/`flatpak` missing, or a forced network/API failure) does not abort `run_project_sync()` / `setup-project.sh` / `update-project.sh`; and (b) answering "no" to the `obsidian.installApp`/`obsidian.plugins` prompts leaves the project directory and machine state completely unchanged — no partial `.obsidian/` writes, no app-install attempt.

## Approach

This is a real manual verification task (not code-writing) focused on failure/decline paths, complementary to TASK-058's happy-path verification. Run against this repo's own project root. Record findings and file a `/bug-file` for any regression found (e.g. a fatal abort where a warning was expected, or leftover state after a decline).

## Steps

### 1. Simulate failure paths <!-- agent: general-purpose -->

- [x] Run `install-obsidian.sh` with an induced failure — e.g. `PATH=/usr/bin:/bin bash lib/scripts/install-obsidian.sh --interactive --project-dir "$(pwd)"` (stripping `brew`/`flatpak` off PATH), or another failure mode TASK-053's actual implementation makes easiest to simulate (check the finished script for its exact guard points first).
  - [x] Confirm the script itself still exits 0 and prints a WARNING rather than aborting, AND confirm the calling `run_project_sync()`/`update-project.sh` guard (from TASK-055) also doesn't abort the overall setup/update run.

### 2. Simulate declined prompts <!-- agent: general-purpose -->

- [x] Run with automated "no" answers to both the `obsidian.installApp` and `obsidian.plugins` prompts — match this repo's existing test seams for driving `prompt_yn`/`prompt_yn_sticky` non-interactively (check `lib/scripts/lib.sh` and this repo's `tests/` directory, if one exists, for the established convention before improvising a new one).
  - [x] Confirm no `.obsidian/` directory was created (or, if one already existed, that it was left byte-for-byte unchanged) and no app-install command was ever invoked.

### 3. Record and report <!-- agent: general-purpose -->

- [x] Record findings in this task's `## Notes` section or a companion UAT file (per `wiki/work/uat/lifecycle.md`'s convention for manual-verification tasks).
  - [x] File any regression found via `/bug-file` rather than silently accepting a fatal failure or leftover state as acceptable. (No regression found — nothing to file.)

<!-- Updated: 2026-08-13 -->

## Notes

Derived from `raw/research/obsidian-setup-automation/index.md`'s Constraints section ("`run_project_sync()` must stay non-fatal end-to-end") and Risks & Mitigations, and `wiki/work/roadmaps/ROADMAP-006-obsidian-plugin-automation.md` Phase 4. Depends on TASK-053 (script) and TASK-055 (wiring) both being done first.

### Verification findings

**Step 1 — Simulated failure paths.** Verdict: non-fatal as designed, no defect.

- `lib/scripts/install-obsidian.sh` (`set -euo pipefail`): `_install_obsidian_app()`'s Darwin/Linux branches all end in `cmd || echo "  WARNING: ..."` — the `||` guarantees the function returns 0 even when `brew`/`flatpak` fail or are absent. The top-level call site (around lines 228-240) adds a second, redundant guard: `_install_obsidian_app || echo "  WARNING: Obsidian app install failed — continuing."`.
- `lib/scripts/lib.sh` `run_project_sync()` (TASK-055 wiring, ~lines 149-184) calls it as `if ! "$script_dir/install-obsidian.sh" --interactive --project-dir "$project_dir"; then echo "Warning: Obsidian install failed — continuing; re-run update to retry." >&2; fi` — the canonical `set -e`-safe idiom, correct given the real caller (`update-project.sh`) runs under `set -euo pipefail`.
- Real execution hit a confound: this machine already has `/Applications/Obsidian.app` installed (mtime months old, pre-existing — not TASK-058 residue), so the real script's `-d /Applications/Obsidian.app` early-return short-circuits before reaching `brew`. Worked around by (a) sourcing the real function definitions in isolation with `PATH=/usr/bin:/bin` and confirming the early-return path (`Obsidian.app already installed — skipping.`, exit 0), and (b) running the literal Darwin failure line verbatim (`brew install --cask obsidian || echo "WARNING..."` with brew stripped from PATH) which produced `brew: command not found` followed by the WARNING and exit code 0 — confirming the actual failure branch a brew-less machine would hit. A structural test of the `run_project_sync` guard against a stand-in script forced to `exit 1` also stayed non-fatal (printed the Warning line, continued, final exit 0).
- Deliberately did **not** run `install-obsidian.sh` or `run_project_sync()`/`update-project.sh` directly against this repo's real `--project-dir`, because `.obsidian/` already exists here and the plugin-install gate defaults to `install_plugins=true` when unset — a real run would trigger genuine plugin downloads into `.obsidian/plugins/`, risking collision with TASK-058's concurrent happy-path run in the same directory (TASK-058 has since finished — index now shows it `pending-uat`).
- No bug filed for this step — behavior matched the design.

**Step 2 — Simulated declined prompts.** Verdict: declines left state untouched as expected, no defect.

- `has_tty()` (`lib/scripts/lib.sh:197-199`) is `[ -t 0 ] || [ "${BOOTSTRAP_ASSUME_TTY:-}" = "1" ]`; `prompt_yn` auto-answers "no" without reading stdin when non-tty, or reads via `read -r -p` when tty (real or forced). `prompt_yn_sticky` (`lib.sh:257-311`) checks the stored preference first and short-circuits on `true`/`false`; on `unset` it prompts and records the answer.
- Confirmed the repo's established test-seam convention (`test/prompt-stickiness.test.js`): `BOOTSTRAP_ASSUME_TTY=1` set **on the child process itself**, combined with piped stdin (`n\nn\n`). A first attempt (`BOOTSTRAP_ASSUME_TTY=1 printf 'n\nn\n' | bash install-obsidian.sh ...`) was a shell pitfall — the env var only attached to `printf`, not the piped `bash`, so it exercised the automatic non-tty decline path rather than the interactive `read` path. Corrected form: `printf 'n\nn\n' | BOOTSTRAP_ASSUME_TTY=1 bash lib/scripts/install-obsidian.sh --interactive --project-dir "$(pwd)"` — exit code 0, output `Skipping Obsidian app install.` / `Skipping Obsidian plugin install.`.
- Verified `obsidian.installApp`/`obsidian.plugins` were `unset` in both prefs stores before the run (so `prompt_yn_sticky` wasn't short-circuited by a stale value from another run).
- SHA-256 manifest of `.obsidian/` (already populated at repo root from TASK-058's concurrent happy-path run, which had by then finished) was byte-for-byte identical before and after both runs. Code trace confirmed `_install_obsidian_app` and the plugin-install loop were never reached — the gate's own "Skipping..." messages print exactly when `prompt_yn_sticky` returns non-zero, before those functions are called.
- **Side effect (not a `.obsidian/` defect, but noted and cleaned up):** the real interactive decline caused `prompt_yn_sticky` to record the answer via its ask-once mechanism — this wrote `"obsidian.installApp": false` into the user's real global `~/.claude/bootstrap-prefs.json` and created a new `<repo>/.claude/bootstrap-prefs.json` with `{"obsidian.plugins": false}`. This is correct, intended sticky-preference behavior, not a bug — but since it was a byproduct of a verification run rather than a genuine user decision, both were reverted after confirming the verdict (global prefs file's `obsidian.installApp` key removed; the newly-created repo-level prefs file, which was untracked and didn't exist before this task, was deleted) to avoid silently suppressing Obsidian install in future real runs.
- No bug filed for this step — behavior matched the design.

### Overall verdict

Both negative-path properties hold: (a) an induced app-install failure stays non-fatal (script exits 0 with a WARNING; the `run_project_sync()` calling guard from TASK-055 also stays non-fatal via `if ! cmd; then warn; fi`), and (b) declining both prompts leaves `.obsidian/` byte-for-byte unchanged and never invokes `brew`/`flatpak`. No regression found; no `/bug-file` filed. One process note: this task's own real-execution side effect (sticky-preference writes) was identified and reverted rather than left in place.
