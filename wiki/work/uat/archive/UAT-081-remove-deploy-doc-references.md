---
id: UAT-081
aliases: [UAT-081]
title: "UAT: Remove deployment-strategy.md and strip every deploy/CI doc reference"
status: passed
task: TASK-081
created: 2026-09-13
updated: 2026-09-13
---

# UAT-081 — UAT: Remove deployment-strategy.md and strip every deploy/CI doc reference

implements::[[TASK-081]]

> **Source task**: [[TASK-081]]
> **Generated**: 2026-09-13

**Scope note.** TASK-081 is a documentation-only pass: `git rm raw/guides/deployment-strategy.md`, plus stripping every doc reference to the `/bootstrap deploy` feature and this repo's own removed GitHub Actions scaffolding across `lib/scripts/README.md`, `lib/prompts/README.md`, `CLAUDE.md`, `lib/scripts/sync-wiki-scaffold.sh`, `lib/scripts/setup-project.sh`, the root `README.md`, and 5 additional files found during the task's own repo-wide sweep (`lib/scripts/migrate-project.sh`, `wiki/work/tasks/TASK-031-sandbox-tier3.md`, `wiki/knowledge/concepts/permission-mode-control-survival.md`, `wiki/knowledge/sources/bypass-mode-enforcement.md`, `.serena/memories/project/overview.md`). Every case below is **EDGE** — there is no API, UI, or integration surface to exercise; the assertions are all "this text must / must not exist" checks against the edited files, matching the pattern of the sibling removal suites (`test/cli-deploy-removed.test.js`, `test/github-actions-removed.test.js`, `test/docker-harness-removed.test.js`).

**Deliberately narrow patterns.** A bare `/deploy/i` grep false-positives on ordinary English — `.serena/memories/project/overview.md` legitimately says "meant to be **deploy**ed into other project repositories." Every case below matches the specific feature name (`setup-deployment`, `deployment-strategy`) or the exact removed-feature phrase (`bootstrap deploy`), never a bare "deploy".

**Deliberately out of scope (not tested here).** Two items the task itself flagged as *discovered but not actioned*, and one architecture-diagram byproduct, are intentionally left alone and are not asserted against:
- `lib/scripts/README.md`'s "Standalone infra scripts (not wired to the CLI)" section still documents `setup-runner.sh`/`startup.sh` and its intro prose still says "...for a project that used `deploy`." — flagged by the task as a scope decision needing its own follow-up task, not one of TASK-081's three checkboxes.
- The root README's architecture mermaid diagram now has orphaned `PROMPTS`/`RAW` nodes (their only edges came from the removed `DEPLOY` node) — flagged as a follow-up, not part of the literal DEPLOY/WORKFLOWS/GHA-node-removal scope.
- Historical/citation mentions of `deploy`/`setup-deployment` in `wiki/log.md`, `wiki/hot.md`, `wiki/work/*/archive/**`, `raw/research/**`, and this task/roadmap's own active files (`TASK-081`, `ROADMAP-010`, `wiki/work/tasks/index.md`, `wiki/work/roadmaps/index.md`) are legitimate past-tense records of a feature that *used to* exist, not live claims that it still does — the task's own Step 6 verification excluded exactly this set, and re-asserting against it here would be testing prose, not behavior.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ available on `PATH`
- [ ] `npm test` baseline green before starting (409/409 prior to this UAT's promoted test; 421/421 after)

**Safety.** Every case below only reads files with `fs.readFileSync` — no network, no writes, no scratch directories, no real Claude Code session.

---

## Test Cases

### UAT-EDGE-001: `raw/guides/deployment-strategy.md` no longer exists
- **Scenario**: The guide the removed `deploy` feature used to copy into consumer projects must be gone from disk (git-removed), not just unreferenced.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it checks `fs.existsSync` on `raw/guides/deployment-strategy.md` and asserts `false`.
- **Expected Result**: The file does not exist.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `raw/guides/deployment-strategy.md no longer exists`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="raw/guides/deployment-strategy.md no longer exists" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-002: `lib/scripts/README.md` no longer references `setup-deployment.sh`
- **Scenario**: The CLI-facing scripts table's `setup-deployment.sh` row must be gone (TASK-078 had already removed the harness's own row in the same file — this checks the file's post-both-edits state, not an assumed prior version).
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `lib/scripts/README.md` and asserts no `setup-deployment` substring anywhere in the file.
- **Expected Result**: No match for `setup-deployment` in `lib/scripts/README.md`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `lib/scripts/README.md no longer references setup-deployment.sh`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="lib/scripts/README.md no longer references setup-deployment.sh" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-003: `lib/prompts/README.md` no longer references `setup-deployment.md`
- **Scenario**: The prompt-templates table's `setup-deployment.md` row must be gone.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `lib/prompts/README.md` and asserts no `setup-deployment` substring anywhere in the file.
- **Expected Result**: No match for `setup-deployment` in `lib/prompts/README.md`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `lib/prompts/README.md no longer references setup-deployment.md`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="lib/prompts/README.md no longer references setup-deployment.md" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-004: `CLAUDE.md` no longer describes the deploy feature as live
- **Scenario**: The `npx @codewizard-dt/bootstrap deploy` Setup Workflow bullet, the `lib/scripts/setup-deployment.sh` Key Files bullet, and the `deployment-strategy.md` mention in the `raw/guides/` Key Files bullet must all be gone.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `CLAUDE.md` and asserts no match for `bootstrap deploy`, `setup-deployment`, or `deployment-strategy` anywhere in the file.
- **Expected Result**: None of the three patterns appear in `CLAUDE.md`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `CLAUDE.md no longer references the deploy command, setup-deployment.sh, or deployment-strategy.md`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="CLAUDE.md no longer references the deploy command" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-005: `lib/scripts/sync-wiki-scaffold.sh` no longer contains legacy `deployment-strategy.md` migration logic
- **Scenario**: The block that used to move or delete a legacy `.docs/guides/deployment-strategy.md` based on whether `deploy` artifacts were present must be gone — there is no longer a deploy feature to migrate artifacts for.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `lib/scripts/sync-wiki-scaffold.sh` and asserts no `deployment-strategy` substring anywhere in the file.
- **Expected Result**: No match for `deployment-strategy` in `sync-wiki-scaffold.sh`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `lib/scripts/sync-wiki-scaffold.sh no longer contains legacy deployment-strategy.md migration logic`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="sync-wiki-scaffold.sh no longer contains legacy" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-006: `lib/scripts/setup-project.sh` no longer suggests running `bootstrap deploy`
- **Scenario**: The "Optional: run 'npx @codewizard-dt/bootstrap deploy'" suggestion line must be gone.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `lib/scripts/setup-project.sh` and asserts no `bootstrap deploy` substring anywhere in the file.
- **Expected Result**: No match for `bootstrap deploy` in `setup-project.sh`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `lib/scripts/setup-project.sh no longer suggests running bootstrap deploy`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="setup-project.sh no longer suggests running bootstrap deploy" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-007: Root `README.md` no longer has a "GitHub Actions Templates" or "CI/CD Pipeline" section
- **Scenario**: The sections describing GitHub Actions scaffolding (tech stack/dependencies bullets) and the CI/CD Pipeline Configuration (security scanning, container build/push workflow templates) must be gone or rewritten to no longer claim the feature exists.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `README.md` and asserts no match for `GitHub Actions Templates` or `CI/CD Pipeline`.
- **Expected Result**: Neither heading/phrase appears in `README.md`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `README.md no longer has a GitHub Actions Templates or CI/CD Pipeline section`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="README.md no longer has a GitHub Actions Templates" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-008: Root `README.md` architecture diagram(s) no longer have `DEPLOY`/`WORKFLOWS`/`GHA` nodes
- **Scenario**: The removed deploy/CI feature's nodes must be gone from the mermaid architecture diagram(s).
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `README.md` and asserts no standalone-word match for `DEPLOY`, `WORKFLOWS`, or `GHA`.
- **Expected Result**: None of the three node identifiers appear in `README.md`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `README.md architecture diagram(s) no longer have DEPLOY/WORKFLOWS/GHA nodes`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="README.md architecture diagram" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-009: Root `README.md` no longer claims `.github/workflows/security.yml` or `build.yml` run or exist
- **Scenario**: References to these removed workflow files running or existing must be gone.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `README.md` and asserts no match for `.github/workflows/security.yml` or `.github/workflows/build.yml`.
- **Expected Result**: Neither path appears in `README.md`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `README.md no longer references .github/workflows/security.yml or build.yml running or existing`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="README.md no longer references .github" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-010: Root `README.md` no longer has a `GITHUB_TOKEN` row or GitHub-Actions-dependent observability/testing claims
- **Scenario**: The `GITHUB_TOKEN` environment-variable row and any row assuming GitHub Actions runs against this repo, plus the Observability/Testing sections citing "GitHub Actions logs" or "Security workflow should pass in GitHub Actions" as checks, must be gone or updated.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `README.md` and asserts no match for `GITHUB_TOKEN`, `GitHub Actions logs`, or `Security workflow should pass`.
- **Expected Result**: None of the three patterns appear in `README.md`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `README.md no longer has a GITHUB_TOKEN row or GitHub-Actions-dependent observability/testing claims`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="README.md no longer has a GITHUB_TOKEN row" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-011: Root `README.md` states npm publish is the only release process
- **Scenario**: A positive assertion, not just an absence check — the Deployment/operations section must actually say this project no longer offers GitHub Actions scaffolding and that publishing to npm by hand is the release process, not merely lack the old section.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `README.md` and asserts a match for "does not offer GitHub Actions scaffolding or any other CI/CD automation as a feature".
- **Expected Result**: The exact phrase is present in `README.md`.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `README.md states npm publish is the only release process`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="README.md states npm publish is the only release process" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-012: The 5 files found during the task's own repo-wide sweep no longer describe the deploy feature as live
- **Scenario**: Beyond the 6 files edited in the task's steps 2-5, the task's own verify step found and fixed 5 additional stale live references: `lib/scripts/migrate-project.sh`, `wiki/work/tasks/TASK-031-sandbox-tier3.md`, `wiki/knowledge/concepts/permission-mode-control-survival.md`, `wiki/knowledge/sources/bypass-mode-enforcement.md`, and `.serena/memories/project/overview.md`.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads all 5 files and asserts none of them match `bootstrap deploy`, `setup-deployment`, or `deployment-strategy`.
- **Expected Result**: None of the three patterns appear in any of the 5 files.
- **Repeatable Unit Test**: Created: `test/deploy-doc-references-removed.test.js` (test: `the repo-wide sweep files no longer describe the removed deploy feature as live`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="the repo-wide sweep files no longer describe the removed deploy feature as live" test/deploy-doc-references-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-013: Full suite is green after the promoted test file is added
- **Scenario**: The task's own Notes record `npm test`: 409/409 passing at completion, before this UAT's 12 new promoted cases existed. This case re-confirms the full suite is still green with the new test file included.
- **Steps**:
  1. Run `npm test` from the repo root.
  2. Confirm the final summary line reports 0 failures.
- **Expected Result**: 421/421 tests passing (409 pre-existing + 12 new in `test/deploy-doc-references-removed.test.js`).
- **Repeatable Unit Test**: Not applicable: this case is the full-suite command itself, not a single promotable assertion — each individual assertion it depends on is already promoted and covered by UAT-EDGE-001 through UAT-EDGE-012 above.
- **Unit Test Command**: `npm test`
- [x] Pass <!-- 2026-09-13 -->

---

## Gaps

- **None outstanding.** Every step of TASK-081 (all 6 numbered sections, including its "Discovered during execution" notes) maps to a test case above, except the two items the task itself explicitly flagged as *not yet actioned* — `lib/scripts/README.md`'s "Standalone infra scripts" section still referencing a project "that used `deploy`", and the orphaned `PROMPTS`/`RAW` nodes in the README's architecture diagram — which are deliberately left untested per the task's own scope note (see the "Deliberately out of scope" callout above).
