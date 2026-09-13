---
id: UAT-080
aliases: [UAT-080]
title: "UAT: Remove the /bootstrap deploy feature code"
status: passed
task: TASK-080
created: 2026-09-04
updated: 2026-09-13
---

# UAT-080 — UAT: Remove the /bootstrap deploy feature code

implements::[[TASK-080]]

> **Source task**: [[TASK-080]]
> **Generated**: 2026-09-04

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude` with TASK-080's changes applied (files removed, `bin/cli.js` edited)
- [ ] Node.js available on `PATH`

---

## Test Cases

### UAT-EDGE-001: Deploy/deployment files are gone from the repo
- **Scenario**: `lib/scripts/setup-deployment.sh` and `lib/prompts/setup-deployment.md` no longer exist after the `/bootstrap deploy` feature removal.
- **Steps**:
  1. Run the command below as-is.
  ```bash
  git -C /Users/davidtaylor/Repositories/bootstrap-claude ls-files -- lib/scripts/setup-deployment.sh lib/prompts/setup-deployment.md
  ```
- **Expected Result**: Empty output (neither file is tracked in git any longer).
- **Repeatable Unit Test**: Not applicable: asserts on repo/git file-tracking state, not deterministic business logic; a unit test would just re-shell out to git with no added rigor over the manual `git ls-files` check.
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-002: Usage text no longer mentions deploy, and every remaining command still lists
- **Scenario**: `node bin/cli.js` with no arguments prints usage/help text that omits any mention of `deploy`/`deployment`, while still listing `setup`, `update`, `install`, `migrate`, `typechecks`, and `dashboard`.
- **Steps**:
  1. Run the command below as-is.
  2. Read the printed usage text and confirm no line mentions `deploy` or `deployment`.
  3. Confirm all six remaining commands (`setup`, `update`, `install`, `migrate`, `typechecks`, `dashboard`) are still listed with descriptions.
  ```bash
  node /Users/davidtaylor/Repositories/bootstrap-claude/bin/cli.js
  ```
- **Expected Result**: Exit code 1; usage text lists exactly the six remaining commands with descriptions; no occurrence of "deploy" (case-insensitive) anywhere in the output.
- **Repeatable Unit Test**: Created: `test/cli-deploy-removed.test.js`
- **Unit Test Command**: `node --test test/cli-deploy-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-003: `bootstrap deploy` falls through to the unknown-command path
- **Scenario**: Running the CLI with the now-removed `deploy` command no longer invokes `setup-deployment.sh` — it falls through to the same unknown-command usage/error path as any other invalid command.
- **Steps**:
  1. Run the command below as-is.
  2. Confirm the output is the standard usage block (starting with `Usage: bootstrap <command>`), not deploy-specific output, and the process exits non-zero.
  ```bash
  node /Users/davidtaylor/Repositories/bootstrap-claude/bin/cli.js deploy
  ```
- **Expected Result**: Exit code 1; stderr begins with `Usage: bootstrap <command>`; no mention of `deploy`/`deployment` in the printed usage text; no attempt to exec `lib/scripts/setup-deployment.sh` (which no longer exists, so any such attempt would fail with a different error, e.g. ENOENT).
- **Repeatable Unit Test**: Created: `test/cli-deploy-removed.test.js`
- **Unit Test Command**: `node --test test/cli-deploy-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->
