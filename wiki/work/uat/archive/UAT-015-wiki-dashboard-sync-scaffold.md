---
id: UAT-015
title: "UAT: Sync dashboard.html into projects as an always-refresh scaffold file"
status: passed
task: TASK-015
created: 2026-07-06
updated: 2026-07-06
---

# UAT-015 — UAT: Sync dashboard.html into projects as an always-refresh scaffold file

implements::[[TASK-015]]

> **Source task**: [[TASK-015]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] `lib/scripts/sync-wiki-scaffold.sh` is executable and reachable at the absolute path used below
- [ ] `lib/scripts/templates/wiki/dashboard.html` exists (delivered by TASK-013)
- [ ] `rsync`, `cmp`, and `mktemp` are available on PATH (standard on macOS/Linux)

---

## Test Cases

### UAT-EDGE-001: Fresh sync delivers dashboard.html matching the template
- **Scenario**: A project with no existing `wiki/dashboard.html` receives the current dashboard client on sync.
- **Steps**:
  1. Create an empty scratch project directory.
  2. Run `sync-wiki-scaffold.sh` against it.
  3. Compare the delivered `wiki/dashboard.html` byte-for-byte against the template source.
- **Command**:
  ```bash
  d=$(mktemp -d); /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/sync-wiki-scaffold.sh "$d" >/dev/null 2>&1; cmp -s "$d/wiki/dashboard.html" /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/templates/wiki/dashboard.html && echo PASS-delivered-and-matches || echo FAIL-missing-or-differs; rm -rf "$d"
  ```
- **Expected Result**: Output is `PASS-delivered-and-matches` — `wiki/dashboard.html` exists in the target and is identical to `lib/scripts/templates/wiki/dashboard.html`.
- **Repeatable Unit Test**: Not applicable: verifies rsync/filesystem sync behavior against real project directories; repo has no shell (bats) test harness and the behavior is integration-level filesystem state.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-002: Always-refresh overwrites a stale dashboard.html
- **Scenario**: An existing project with an out-of-date `wiki/dashboard.html` gets it overwritten by the current template on the next sync (always-refresh, not copy-once).
- **Steps**:
  1. Create a scratch project and run an initial sync.
  2. Corrupt/stale the delivered `wiki/dashboard.html` by overwriting it with placeholder content.
  3. Re-run the sync.
  4. Confirm the file was restored to match the template.
- **Command**:
  ```bash
  d=$(mktemp -d); /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/sync-wiki-scaffold.sh "$d" >/dev/null 2>&1; printf 'STALE\n' > "$d/wiki/dashboard.html"; /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/sync-wiki-scaffold.sh "$d" >/dev/null 2>&1; cmp -s "$d/wiki/dashboard.html" /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/templates/wiki/dashboard.html && echo PASS-refreshed || echo FAIL-stale-not-overwritten; rm -rf "$d"
  ```
- **Expected Result**: Output is `PASS-refreshed` — the stale content is replaced and the file again matches the template, proving dashboard.html is treated as always-refresh.
- **Repeatable Unit Test**: Not applicable: verifies rsync always-refresh behavior against real filesystem state; no shell test harness in this repo.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-003: Copy-once project files are still preserved (regression on the step-2 exclude)
- **Scenario**: Excluding `dashboard.html` from the step-2 copy-once rsync must not break copy-once protection for genuinely project-owned files like `wiki/index.md`.
- **Steps**:
  1. Create a scratch project and run an initial sync.
  2. Edit the delivered `wiki/index.md` to simulate project-owned content.
  3. Re-run the sync.
  4. Confirm the project's `wiki/index.md` edit survived (was NOT overwritten).
- **Command**:
  ```bash
  d=$(mktemp -d); /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/sync-wiki-scaffold.sh "$d" >/dev/null 2>&1; printf 'PROJECT-OWNED-MARKER\n' >> "$d/wiki/index.md"; /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/sync-wiki-scaffold.sh "$d" >/dev/null 2>&1; grep -q 'PROJECT-OWNED-MARKER' "$d/wiki/index.md" && echo PASS-copyonce-preserved || echo FAIL-copyonce-overwritten; rm -rf "$d"
  ```
- **Expected Result**: Output is `PASS-copyonce-preserved` — the project's edit to `wiki/index.md` remains after re-sync, confirming copy-once still holds for project-owned files.
- **Repeatable Unit Test**: Not applicable: verifies rsync `--ignore-existing` copy-once behavior against real filesystem state; no shell test harness in this repo.
- [x] Pass <!-- 2026-07-06 -->
<!-- Renumbered: 2026-07-06 — was UAT-004/TASK-004, collided with the pre-existing archived ROADMAP-001 UAT-004/TASK-004. Renumbered to UAT-015/TASK-015. -->
