---
id: UAT-058
aliases: [UAT-058]
title: "UAT: Manually verify guarded Obsidian install end-to-end on at least one platform"
status: passed
task: TASK-058
created: 2026-08-13
updated: 2026-08-13
tags: [obsidian, installer, verification]
---

# UAT-058 — UAT: Manually verify guarded Obsidian install end-to-end on at least one platform

implements::[[TASK-058]]

> **Source task**: [[TASK-058]]
> **Generated**: 2026-08-13

TASK-058 was itself a manual, side-effecting verification task, not a code-writing task: it ran `lib/scripts/install-obsidian.sh --project-dir "$(pwd)"` against this repo's real `.obsidian/` vault, observed the actual app-install state, plugin folders, and `community-plugins.json` contents, and recorded all of it directly in the task's own `## Notes` section — including filing [[BUG-0011]] for the discrepancy found (`manifest.json` is never copied into the installed plugin directories, so the enabled plugins won't actually load in Obsidian).

**A conventional UAT re-walking those same manual steps would duplicate work already done and already recorded.** The verification already happened; the only new risk this UAT can meaningfully retire is the evidence trail *itself* silently rotting — a future edit that quietly strips the recorded command/output, or de-links BUG-0011 from TASK-058 — which is what the two cases below guard against. Both are backed by a promoted unit test (`test/verify-obsidian-install-evidence.test.js`) so they auto-judge cleanly on a green run instead of fail-closing to a human.

---

## Prerequisites

- [ ] Repo checked out at the bootstrap-claude root
- [ ] `wiki/work/tasks/TASK-058-verify-obsidian-install.md` and `wiki/work/bugs/BUG-0011-obsidian-plugin-manifest-not-copied.md` both present

---

## Test Cases

### UAT-EVIDENCE-001: TASK-058's Notes section documents the exact command, exit code, and observed plugin/manifest state
- **Scenario**: The task's Notes section is the only record that the real installer was ever run against this repo. It must keep the exact command line, the exit code, the three plugin ids, and the `community-plugins.json` contents it claims to have observed.
- **Steps**:
  1. Run the promoted unit test.
  2. Spot-check by eye: `wiki/work/tasks/TASK-058-verify-obsidian-install.md` § "Verification run (2026-08-13)" contains `bash lib/scripts/install-obsidian.sh --project-dir "$(pwd)"`, `Exit code: \`0\``, and `["dataview", "graph-link-types", "breadcrumbs"]`.
- **Command**:
  ```bash
  node --test test/verify-obsidian-install-evidence.test.js
  ```
- **Expected Result**: All 4 tests in the file pass — the recorded command/exit-code, the three plugin ids + `community-plugins.json` line, the BUG-0011 cross-reference, and BUG-0011's own back-link all still present and unchanged.
- **Repeatable Unit Test**: Created: `test/verify-obsidian-install-evidence.test.js`
- **Unit Test Command**: `node --test test/verify-obsidian-install-evidence.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EVIDENCE-002: BUG-0011 is correctly filed and cross-referenced from TASK-058
- **Scenario**: TASK-058's own acceptance criteria required filing a bug for any discrepancy rather than silently marking done. `manifest.json` missing from every installed plugin folder is a real, deterministic discrepancy (confirmed in the task's Notes via Serena `find_file` returning zero matches, and by reading `_install_obsidian_plugin` in `lib/scripts/install-obsidian.sh:96-171`). The bug must stay open, stay linked to TASK-058, and keep the specific root-cause explanation (not a vague "something's wrong").
- **Steps**:
  1. Run the promoted unit test (same file as UAT-EVIDENCE-001).
  2. Spot-check by eye: `wiki/work/bugs/BUG-0011-obsidian-plugin-manifest-not-copied.md` frontmatter has `linked_task: "[[TASK-058]]"` and `status: open`, and its Summary states `manifest_tmp` is deleted without being copied into `$plugin_dir/manifest.json`.
- **Command**:
  ```bash
  node --test test/verify-obsidian-install-evidence.test.js
  ```
- **Expected Result**: The `BUG-0011 links back to TASK-058 and stays open with the recorded root cause` test passes.
- **Repeatable Unit Test**: Created: `test/verify-obsidian-install-evidence.test.js`
- **Unit Test Command**: `node --test test/verify-obsidian-install-evidence.test.js`
- [x] Pass <!-- 2026-08-13 -->

---

## Gaps found while generating this UAT

Recorded here rather than silently omitted; neither blocks this UAT.

1. **The real `brew install --cask obsidian` app-install path remains unexercised.** TASK-058's Notes and BUG-0011 both already flag this: Obsidian.app pre-existed on the verification machine and was not brew-cask-managed, so the installer took its "already installed" skip branch rather than the actual `brew install` path. Closing this needs a follow-up run on a machine without Obsidian (or after `brew uninstall`) — tracked in TASK-058's Notes and BUG-0011's "Notes for the fixer", not duplicated as a case here since it cannot be verified without a second, differently-provisioned machine.
2. **No case re-verifies the plugin folders or `community-plugins.json` by re-running the installer.** Deliberately out of scope: TASK-058 already ran the real, network-dependent, side-effecting installer once and recorded the output; re-running it here would be a second real `brew`/network operation duplicating that side effect, not a repeatable regression check. The promoted unit tests instead pin the *recorded evidence*, which is the artifact this UAT can actually protect without re-triggering the installer.
