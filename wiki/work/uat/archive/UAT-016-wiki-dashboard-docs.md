---
id: UAT-016
title: "UAT: Document the dashboard command in README.md, lib/scripts/README.md, and CLAUDE.md"
status: passed
task: TASK-016
created: 2026-07-06
updated: 2026-07-06
---

# UAT-016 — UAT: Document the dashboard command in README.md, lib/scripts/README.md, and CLAUDE.md

implements::[[TASK-016]]

> **Source task**: [[TASK-016]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Repository checked out at the branch containing TASK-016's doc edits
- [ ] Run all commands from the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`)

---

## Test Cases

This is a documentation-only task, so every test is a deterministic content check against the three doc files. Commands are run from the repo root and each asserts that a specific, accurate piece of dashboard documentation is present (or that stale placeholder text is gone). The command's stdout / exit status is the observable result.

### UAT-DOC-001: README.md enumerates the `dashboard` command
- **Description**: The CLI Entry Point section of `README.md` must list `dashboard` alongside the other `bootstrap` commands.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  grep -n '`dashboard`' README.md
  ```
- **Expected Result**: At least one match — the CLI Entry Point "Inputs" line now includes `` `dashboard` `` in the command enumeration.
- **Repeatable Unit Test**: Not applicable: prose/markdown documentation content, no code logic or test harness to assert against.
- [x] Pass <!-- 2026-07-06 -->

### UAT-DOC-002: README.md Run Locally shows the dashboard example with default port and override
- **Description**: The Run Locally block must show how to launch the dashboard, the default port 4317, and a port override example.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  grep -nE 'node bin/cli.js dashboard( 4400)?|localhost:4317' README.md
  ```
- **Expected Result**: Multiple matches — the two `node bin/cli.js dashboard` example lines (bare + `4400` override) and the `http://localhost:4317` default-port comment all present in the Run Locally section.
- **Repeatable Unit Test**: Not applicable: prose/markdown documentation content.
- [x] Pass <!-- 2026-07-06 -->

### UAT-DOC-003: lib/scripts/README.md has the accurate `wiki-dashboard-server.js` row
- **Description**: The "CLI-facing scripts" table row for `wiki-dashboard-server.js` must document the real `dashboard` command — default port 4317 and the `bootstrap dashboard 4400` override — not the old forthcoming placeholder.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  grep -nE 'wiki-dashboard-server\.js.*4317|bootstrap dashboard 4400' lib/scripts/README.md
  ```
- **Expected Result**: At least one match on the table row — it names port 4317 and the `bootstrap dashboard 4400` override in the accurate final row.
- **Repeatable Unit Test**: Not applicable: prose/markdown documentation content.
- [x] Pass <!-- 2026-07-06 -->

### UAT-DOC-004: CLAUDE.md Setup Workflow lists the `dashboard [port]` command
- **Description**: The Setup Workflow bullet list in the root `CLAUDE.md` must include a `dashboard [port]` entry pointing at `wiki-dashboard-server.js` with the default port.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  grep -nE 'bootstrap dashboard \[port\].*wiki-dashboard-server\.js|dashboard.*4317' CLAUDE.md
  ```
- **Expected Result**: At least one match — the Setup Workflow list now carries the `npx @codewizard-dt/bootstrap dashboard [port]` bullet referencing the server script and default port 4317.
- **Repeatable Unit Test**: Not applicable: prose/markdown documentation content.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-005: No stale placeholder text remains in lib/scripts/README.md
- **Scenario**: TASK-012 left a placeholder row marked "forthcoming, TASK-014" with "full docs owned by TASK-015"; TASK-016 must have replaced it, leaving no stale placeholder.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  grep -nE 'forthcoming, TASK-014|owned by TASK-015' lib/scripts/README.md
  ```
- **Expected Result**: No matches (grep exits non-zero / prints nothing) — the placeholder text is gone, confirming the row was replaced rather than duplicated.
- **Repeatable Unit Test**: Not applicable: prose/markdown documentation content.
- [x] Pass <!-- 2026-07-06 -->

---

## Gaps

None. All acceptance criteria for this docs task are covered by deterministic content checks. The dashboard server's runtime behavior (actual port binding, no-cache headers, path-traversal defense, live polling) is out of scope for TASK-016 — it belongs to TASK-017 (manual dashboard verification) and the TASK-012/TASK-014 UATs.
<!-- Renumbered: 2026-07-06 — was UAT-005/TASK-005, collided with the pre-existing archived ROADMAP-001 UAT-005/TASK-005. Renumbered to UAT-016/TASK-016. -->
