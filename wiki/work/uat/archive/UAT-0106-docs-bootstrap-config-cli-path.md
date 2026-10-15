---
id: UAT-0106
aliases: [UAT-0106]
title: "UAT: Document `bootstrap config` as the non-Claude-Code path for editing preferences"
status: passed
task: TASK-0106
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0106 — UAT: Document `bootstrap config` as the non-Claude-Code path for editing preferences

implements::[[TASK-0106]]

> **Source task**: [[TASK-0106]]
> **Generated**: 2026-09-19

TASK-0106 is documentation-only, so every case is a static check that runs a file-scoped `node --test` command with a `--test-name-pattern` that selects exactly one test. The promoted tests live in `test/bootstrap-config-docs.test.js` (new) and `test/bootstrap-config-skill.test.js` (existing).

---

## Prerequisites

- [ ] Node.js is available (`node --version`) and the working directory is the repository root
- [ ] TASK-0104 has landed: `bin/cli.js` wires the `config` subcommand

---

## Test Cases

### UAT-DOC-001: README.md documents `bootstrap config` with flags that match bin/cli.js
- **Scenario**: `README.md` mentions `bootstrap config` (the CLI Entry Point paragraph) and every `--flag` named on a line that mentions it is a flag `bin/cli.js` accepts for `config`; `--get`, `--set`, `--unset`, and `--list` are all documented.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly one test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='^README\.md documents' test/bootstrap-config-docs.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`; exit code 0.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^README\.md documents' test/bootstrap-config-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-DOC-002: README.md Run Locally block shows the config examples
- **Scenario**: The Deployment > Run Locally block contains a bare `node bin/cli.js config` line and at least one flag-driven `node bin/cli.js config --...` line, and every flag in those examples is one `bin/cli.js` accepts.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly one test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='^README Run Locally' test/bootstrap-config-docs.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`; exit code 0.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^README Run Locally' test/bootstrap-config-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-DOC-003: CLAUDE.md Setup Workflow documents `bootstrap config` with matching flags
- **Scenario**: `CLAUDE.md` mentions `bootstrap config` (the Setup Workflow bullet and the `/bootstrap-config` row pointer) and every `--flag` on those lines is accepted by `bin/cli.js`; `--get`, `--set`, `--unset`, and `--list` are all documented.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly one test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='^CLAUDE\.md documents' test/bootstrap-config-docs.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`; exit code 0.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^CLAUDE\.md documents' test/bootstrap-config-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-DOC-004: /bootstrap-config SKILL.md cross-references `bootstrap config` with matching flags
- **Scenario**: `lib/skills/bootstrap-config/SKILL.md` mentions `bootstrap config` as the terminal equivalent and every `--flag` on that line is accepted by `bin/cli.js`; `--get`, `--set`, `--unset`, and `--list` are all documented.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly one test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='^lib/skills/bootstrap-config/SKILL\.md documents' test/bootstrap-config-docs.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`; exit code 0.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^lib/skills/bootstrap-config/SKILL\.md documents' test/bootstrap-config-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: The documented flag surface still exists in bin/cli.js
- **Scenario**: Guards the docs against upstream drift. If `bin/cli.js` stops routing `--get`, `--set`, `--unset`, or `--list`, the three docs above would describe flags that no longer exist, so this fails first.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly one test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='^bin/cli\.js still routes' test/bootstrap-config-docs.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`; exit code 0.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^bin/cli\.js still routes' test/bootstrap-config-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: SKILL.md frontmatter and argument-hint are unchanged by the cross-reference edit
- **Scenario**: TASK-0106 Step 4 forbids altering the SKILL's frontmatter, `argument-hint`, or Step A-G text. The existing skill contract test pins the frontmatter keys and values exactly.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly one test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='^bootstrap-config: frontmatter matches' test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`; exit code 0.
- **Repeatable Unit Test**: Not applicable: pre-existing test in `test/bootstrap-config-skill.test.js` already covers this; no new test needed
- **Unit Test Command**: `node --test --test-name-pattern='^bootstrap-config: frontmatter matches' test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Every helper flag the SKILL spells still exists in bootstrap-prefs.js
- **Scenario**: The new SKILL sentence names `--get` / `--set <key> --value <v>` / `--unset` / `--list`. The existing skill contract test confirms every flag the skill spells is a real flag of the helper, so the added sentence cannot introduce a phantom flag.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly one test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='^bootstrap-config: every helper flag' test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`; exit code 0.
- **Repeatable Unit Test**: Not applicable: pre-existing test in `test/bootstrap-config-skill.test.js` already covers this; no new test needed
- **Unit Test Command**: `node --test --test-name-pattern='^bootstrap-config: every helper flag' test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-09-19 -->
