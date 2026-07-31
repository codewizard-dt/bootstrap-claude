---
id: TASK-035
title: "Reorder install-global.sh — local steps first, MCPs last and guarded, invoke hooks-wiring merge"
status: done
created: 2026-07-31
updated: 2026-07-31
depends_on: [TASK-033]
blocks: [TASK-038]
parallel_safe_with: [TASK-034]
uat: "[[UAT-035]]"
tags: [install, hooks, shell]
---

# TASK-035 — Reorder install-global.sh — local steps first, MCPs last and guarded, invoke hooks-wiring merge

derived_from::[[ROADMAP-004]]

## Objective

Fix the ordering hazard in `lib/scripts/install-global.sh`: today MCP install runs *first* (lines 21-25) under `set -euo pipefail`, so any MCP failure (npm error, `claude mcp add` failure) aborts the script before hooks, skills, or settings ever get installed. Reorder so all local/offline-safe steps (hooks, skills, deny merge, hooks-wiring merge, fileSuggestion) run first and always complete, then run MCP install last, guarded so a failure warns instead of aborting. Also close the silent-skip hole where a missing `lib/hooks` directory produces no output at all, and wire in the new `merge-settings-hooks.js` script (built in ROADMAP-004 Phase 1 / TASK-033) so settings.json hook registration is no longer a manual copy-paste from `lib/hooks/README.md`.

## Approach

The approved plan at `~/.claude/plans/ok-now-parallel-cerf.md` ("Changes → 3. install-global.sh") is authoritative for this task. It specifies the new step order and the exact guard/wiring patterns to use — in particular, reuse the fileSuggestion capture-and-`case` pattern already present at `install-global.sh:93-104` as the model for invoking `merge-settings-hooks.js` (capture combined stdout+stderr, echo it back, `case` on the outcome string to decide whether to print the restart-reminder line), and reuse the same warn-and-continue idiom for the new MCP guard at the end of the script.

Keep `set -euo pipefail` semantics intact everywhere except the two guarded points (hooks-dir-missing warning, MCP-install failure) — those are the only two steps allowed to fail without aborting the script; the deny merge, hooks-wiring merge, and fileSuggestion merge scripts already exit 0 on every outcome by contract, so they need no additional guarding.

## Steps

- [x] Read `~/.claude/plans/ok-now-parallel-cerf.md` section "Changes → 3. install-global.sh" in full before editing, to confirm no detail has drifted since this task was filed.
- [x] Reorder `lib/scripts/install-global.sh` into this sequence:
  1. **Hooks rsync** (was step 2, now step 1) — keep the existing `if [ -d "$TEMPLATE_DIR/lib/hooks" ]` rsync block, but add an `else` branch: `echo "Warning: $TEMPLATE_DIR/lib/hooks not found — hook scripts NOT installed" >&2`.
  2. **Skills rsync + orphan cleanup** (was step 3) — unchanged logic, just moved earlier.
  3. **Deny merge** (was step 4) — unchanged logic (`node "$SCRIPT_DIR/merge-settings-deny.js"`).
  4. **New: hooks-wiring merge** — run `node "$SCRIPT_DIR/merge-settings-hooks.js"`, following the capture-output-and-`case` pattern at the current lines 93-104 (capture combined stdout+stderr into a variable, echo it if non-empty, then `case` on the message: when the outcome matches created/applied phrasing — e.g. contains `"hooks wiring: created"` or `"hooks wiring: N change(s) applied"` — print `"Restart Claude Code sessions to activate hook changes."`; when it matches the up-to-date phrasing, print nothing extra or an equivalent quiet confirmation).
  5. **fileSuggestion `--set-key` merge** (was step 5) — unchanged logic, just renumbered.
  6. **MCPs — moved to LAST**, guarded so a failure cannot abort the script:
     ```bash
     if [ "$SKIP_MCPS" = false ]; then
       echo "Checking global MCP servers (user scope)..."
       if ! "$SCRIPT_DIR/install-mcps.sh"; then
         echo "Warning: MCP install failed — hooks, skills, and settings were installed; re-run 'bootstrap install' to retry MCPs." >&2
       fi
       echo ""
     fi
     ```
     Preserve the existing `--skip-mcps` flag/`SKIP_MCPS` variable behavior — it still fully skips this block when passed.
- [x] Update the step comment numbers (`# 1.` … `# 6.`) throughout the file to match the new order so they stay accurate documentation, not just executable code.
- [x] Update the final summary echo (currently line 107, `"Global setup complete (MCPs + hooks + skills + deny list + file suggestion)."`) to reflect the new step list, including hooks wiring — e.g. `"Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + MCPs)."` or equivalent that names every step actually run.
- [x] Confirm `set -euo pipefail` remains at the top of the file and that no other step in the file was inadvertently made non-fatal — only the hooks-dir-missing case and the MCP-install-failure case should tolerate failure.
- [x] Verify with `bash -n lib/scripts/install-global.sh` (syntax check only, no execution).
- [x] Verify with a fake-HOME smoke run: `HOME=<scratch-dir> bash lib/scripts/install-global.sh --skip-mcps` — confirm it completes without touching MCPs, installs hooks/skills, and merges deny + hooks-wiring + fileSuggestion into `<scratch-dir>/.claude/settings.json` without error. Use a directory under the session scratchpad, never the real `$HOME`.
- [x] Re-run the same fake-HOME smoke command a second time and confirm idempotence — no crash, and messaging indicates "already up to date" / no-op for the merges that have nothing left to change.
- **Post-archive fix (2026-07-31):** the step-4 restart-reminder `case` pattern literally matched `'change(s) applied'`, which the merge script never prints (`hooks wiring: N change[s] applied`) — pattern corrected to `*'hooks wiring: created'*|*' applied'*` and pinned by a new test in `test/install-global.test.js`.
- [x] If `merge-settings-hooks.js` does not yet exist when this task is executed (i.e. TASK-033 has not landed), stop and flag the blocking dependency rather than stubbing it — this task assumes TASK-033's script is present and working. *(Verified present — TASK-033 landed; wiring worked in both smoke runs.)*

<!-- Updated: 2026-07-31 -->
<!-- Execution notes: fake-HOME smoke runs performed under the session scratchpad
     (task035-home). Run 1: hooks + skills rsynced, deny list created (116 entries),
     "hooks wiring: created" + restart reminder, fileSuggestion set, exit 0, MCPs
     untouched. Run 2: all merges reported "already up to date", settings.json
     byte-identical (cmp), no restart reminder, exit 0. -->

