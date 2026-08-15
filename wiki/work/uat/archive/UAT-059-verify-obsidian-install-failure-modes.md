---
id: UAT-059
aliases: [UAT-059]
title: "UAT: Confirm setup/update stay non-fatal on Obsidian install failure and declining leaves everything untouched"
status: passed
task: TASK-059
created: 2026-08-13
updated: 2026-08-14
---

# UAT-059 — UAT: Confirm setup/update stay non-fatal on Obsidian install failure and declining leaves everything untouched

implements::[[TASK-059]]

> **Source task**: [[TASK-059]]
> **Generated**: 2026-08-13

**This task was itself a manual verification task, not a code-writing task.** TASK-059's own execution ran the real failure/decline simulations against this repo's installer and recorded detailed, reproducible findings directly in its `## Notes` section — including exact commands, exact output, and a caught-and-reverted side effect (a stray write to the real `~/.claude/bootstrap-prefs.json` during the interactive-decline run, cleaned up before the task closed). A conventional UAT re-walking the same manual steps by hand would be pure duplication of work already done and recorded.

Given that, this UAT does two things instead of re-running a human walkthrough:

1. **Promotes the two properties to real, hermetic, repeatable unit tests** (`test/install-obsidian.test.js`) — something TASK-059's manual run could not do for itself, since it deliberately ran against the real repo/real `$HOME` and had to clean up after itself. `UAT-EDGE-001` and `UAT-EDGE-002` below are unit-backed and auto-judgeable.
2. **Asserts the recorded evidence in TASK-059 itself is present and complete** — `UAT-DOC-001` — since the deviation instructions for this UAT explicitly call for at least this much even when the underlying claims were already verified by hand.

> **Concurrency note**: `test/install-obsidian.test.js` is a shared file that a sibling UAT-generation agent (TASK-058, the happy-path counterpart) was concurrently populating with a much larger suite (OS-branch dispatch, plugin-fetch edge cases, a BUG-0011 regression case, idempotency). This UAT's two cases were merged into that file rather than replacing it. One unrelated case in that file (`BUG-0011 — a fully successful plugin install must leave manifest.json in the plugin directory`) is *expected* to fail until BUG-0011 is fixed — it is not part of this UAT's evidence and is excluded from both commands below via `--test-name-pattern` so it cannot make either case look failed.

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`, Node 18+ on `PATH`, `bash` available
- [ ] TASK-053 and TASK-059 both present (`lib/scripts/install-obsidian.sh` exists; `wiki/work/tasks/TASK-059-verify-obsidian-install-failure-modes.md` exists with its `## Notes` section)
- [ ] `npm test` baseline green before starting

---

## Test Cases

### UAT-EDGE-001: A simulated app-install-command failure inside `install-obsidian.sh` stays non-fatal
- **Scenario**: TASK-059 Step 1 — a `brew`/`flatpak` install-command failure inside `_install_obsidian_app` must warn and return 0 rather than aborting the script (the `cmd || echo WARNING` idiom at `lib/scripts/install-obsidian.sh` lines 40-41 and 52-53).
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it invokes the real, unmodified `install-obsidian.sh` with `uname` stubbed to `Linux` and a stub `flatpak` binary that resolves (so `command -v flatpak` succeeds and the code reaches the real install line, rather than the separate "not found" line) but whose `install` subcommand exits 1 — chosen over PATH-stripping because it is host-independent (some CI images ship a real `flatpak`; TASK-059's own manual run separately proved the Darwin/`brew` instance of the identical idiom for real, on this machine, with `brew` stripped from `PATH`).
  3. Confirm the process exits 0 and stdout contains the exact WARNING line for a failed `flatpak install`.
- **Expected Result**: Exit 0; `_install_obsidian_app`'s failure path warns and returns 0; no abort under `set -euo pipefail`.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: Linux + a failing \`flatpak install\` warns and continues rather than erroring`)
- **Unit Test Command**: `node --test --test-name-pattern="a failing \`flatpak install\` warns" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-002: Declining both `obsidian.installApp`/`obsidian.plugins` prompts leaves `.obsidian/` untouched and never installs
- **Scenario**: TASK-059 Step 2 — answering "no" to both prompts must not create any part of `.obsidian/` and must never reach an app-install or plugin-install command.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it invokes the real, unmodified `lib/scripts/install-obsidian.sh --interactive --project-dir <scratch>` with `BOOTSTRAP_ASSUME_TTY=1` and piped `n\nn\n` — the repo's established non-interactive-simulation seam (`test/prompt-stickiness.test.js`), applied against a scratch `$HOME` and a scratch project dir so the run cannot touch the real `~/.claude/bootstrap-prefs.json` or this repo's own `.obsidian/`.
  3. Confirm the process exits 0, prints both "Skipping Obsidian app install." and "Skipping Obsidian plugin install.", and that `<scratch-project>/.obsidian/` does not exist after the run.
- **Expected Result**: Exit 0; both decline messages printed; no `.obsidian/` directory created; no app-install or plugin-install command reached.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh --interactive: declining both prompts leaves .obsidian/ untouched and never installs`)
- **Unit Test Command**: `node --test --test-name-pattern="declining both prompts leaves .obsidian" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-DOC-001: TASK-059's own Notes section documents both paths and the prefs-cleanup verification
- **Scenario**: Since TASK-059's real-execution findings are the primary evidence for this UAT rather than a fresh walkthrough, this case asserts that evidence is actually present and complete in the task file, rather than merely claimed in this UAT.
- **Steps**:
  1. Open `wiki/work/tasks/TASK-059-verify-obsidian-install-failure-modes.md`.
  2. Confirm the `## Notes` section contains a "Step 1 — Simulated failure paths" subsection with the exact command(s) run and their output/verdict.
  3. Confirm it contains a "Step 2 — Simulated declined prompts" subsection with the exact command(s) run (including the corrected `BOOTSTRAP_ASSUME_TTY=1` placement) and their output/verdict.
  4. Confirm it explicitly states the `~/.claude/bootstrap-prefs.json` / repo-level prefs side effect was identified and reverted (not merely that it occurred).
  5. Confirm an "Overall verdict" statement is present.
- **Expected Result**: All four elements (Step 1 findings, Step 2 findings, cleanup confirmation, overall verdict) are present in the Notes section as of the `2026-08-13` update.
- **Repeatable Unit Test**: Not applicable: this checks the prose completeness of a specific task file's Notes section (a one-time documentation-completeness audit), not deterministic business logic — the two behavioral properties it references are already unit-tested directly in UAT-EDGE-001/002.
- [x] Pass <!-- 2026-08-14 -->

---

## Gaps

- No case re-runs the Darwin (`brew`)-specific failure branch as an automated unit test — the app-install-already-present check (`[ -d /Applications/Obsidian.app ]`) is a hardcoded absolute path that cannot be redirected into a scratch dir without root, so it is not portably mockable in CI. TASK-059's manual run already exercised this exact branch for real (PATH-stripped `brew`, verbatim command, confirmed WARNING + exit 0) — see its Notes, Step 1, third bullet. The Linux/`flatpak` instance of the identical `cmd || echo WARNING` idiom is what UAT-EDGE-001 automates instead.
- No case re-verifies the plugin-install loop's own per-plugin failure handling (`_install_obsidian_plugin`'s curl/JSON-parse warn-and-skip chain) — that is out of TASK-059's scope (which covers the app-install failure path and the decline path only, not plugin-download failure modes) and was not claimed as verified in its Notes.

---

Next steps:
```
To walk through tests interactively:  /uat-walk wiki/work/uat/UAT-059-verify-obsidian-install-failure-modes.md
To run tests headlessly:              /uat-auto wiki/work/uat/UAT-059-verify-obsidian-install-failure-modes.md
```
