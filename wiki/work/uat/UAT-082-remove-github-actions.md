---
id: UAT-082
aliases: [UAT-082]
title: "UAT: Delete all GitHub Actions workflows from this repo"
status: pending
task: TASK-079
created: 2026-09-04
updated: 2026-09-04
---

# UAT-082 — UAT: Delete all GitHub Actions workflows from this repo

implements::[[TASK-079]]

> **Source task**: [[TASK-079]]
> **Generated**: 2026-09-04
> **Deviation**: TASK-079's own mirrored number, `UAT-079`, is already taken — it belongs to TASK-077's UAT (`wiki/work/uat/archive/UAT-079-docker-harness-pass-fail-lines.md`, itself a prior non-collision workaround), and the next number up, `UAT-080`, is taken by TASK-080's UAT. `UAT-081` is skipped deliberately: TASK-081 ("Remove deployment-strategy.md and strip every deploy/CI doc reference") is `status: in-progress` and concurrently being tackled in this same session, and will need `UAT-081` for its own `/uat-generate` shortly. `UAT-082` is the first ID clear of that race — it is permanently free because TASK-082 ("Trash TASK-073 and UAT-073") is a `/task-trash` operation that does not generate its own UAT file. Uses the same next-free-ID precedent already established by UAT-079's own Deviation note.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ available on `PATH` (every case below runs `node --test` against real files on disk — no network, no GitHub Actions runner, no Docker needed)
- [ ] `npm test` baseline green before starting

---

## Test Cases

### UAT-EDGE-001: `.github/workflows/docker-harness.yml` no longer exists
- **Scenario**: TASK-079 Step 1 ran `git rm .github/workflows/docker-harness.yml` per ROADMAP-010's "no GitHub Actions should run against this repo at all."
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts `fs.existsSync()` is `false` for `.github/workflows/docker-harness.yml`.
- **Expected Result**: File absent.
- **Repeatable Unit Test**: Created: `test/github-actions-removed.test.js` (test: `.github/workflows/docker-harness.yml no longer exists`)
- **Unit Test Command**: `node --test --test-name-pattern="docker-harness.yml no longer exists" test/github-actions-removed.test.js`
- [ ] Pass

### UAT-EDGE-002: `.github/workflows/security.yml` no longer exists
- **Scenario**: TASK-079 Step 1 ran `git rm .github/workflows/security.yml` (the Gitleaks secret-scanning workflow).
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts `fs.existsSync()` is `false` for `.github/workflows/security.yml`.
- **Expected Result**: File absent.
- **Repeatable Unit Test**: Created: `test/github-actions-removed.test.js` (test: `.github/workflows/security.yml no longer exists`)
- **Unit Test Command**: `node --test --test-name-pattern="security.yml no longer exists" test/github-actions-removed.test.js`
- [ ] Pass

### UAT-EDGE-003: Root `.gitleaks.toml` no longer exists
- **Scenario**: TASK-079 Step 1 ran `git rm .gitleaks.toml` — the config `security.yml` depended on, now orphaned along with it.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts `fs.existsSync()` is `false` for the repo-root `.gitleaks.toml`.
- **Expected Result**: File absent.
- **Repeatable Unit Test**: Created: `test/github-actions-removed.test.js` (test: `root .gitleaks.toml no longer exists`)
- **Unit Test Command**: `node --test --test-name-pattern="root .gitleaks.toml no longer exists" test/github-actions-removed.test.js`
- [ ] Pass

### UAT-EDGE-004: `.github/workflows/` has no remaining files
- **Scenario**: TASK-079 Step 1's fourth checkbox required confirming `.github/workflows/` has no remaining files after the two `git rm`s — an empty (or, since git does not track empty directories, entirely absent) directory is the correct end state, not a lingering third workflow file.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts either the directory does not exist, or `fs.readdirSync()` on it returns an empty array.
- **Expected Result**: `.github/workflows/` is absent or empty — currently absent (git does not track empty dirs).
- **Repeatable Unit Test**: Created: `test/github-actions-removed.test.js` (test: `.github/workflows/ has no remaining files (an empty/absent directory is fine)`)
- **Unit Test Command**: `node --test --test-name-pattern="no remaining files" test/github-actions-removed.test.js`
- [ ] Pass

### UAT-EDGE-005: `package.json`'s `files` array no longer lists `.github/` or `.gitleaks.toml`
- **Scenario**: TASK-079 Step 2 found and fixed an orphaned stale reference: `package.json`'s `"files"` publish array still listed `.github/` and `.gitleaks.toml` even after both were deleted from the repo, which would have silently no-op'd on `npm pack`/`npm publish` (nothing to include) but left a misleading manifest entry.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts no entry in `package.json`'s `files` array starts with `.github` or contains `.gitleaks.toml`.
- **Expected Result**: No matching entries; `files` is `["bin/", "lib/", "raw/", "!raw/research/", "!raw/companies/", "!raw/*.pdf"]`.
- **Repeatable Unit Test**: Created: `test/github-actions-removed.test.js` (test: `package.json "files" array no longer lists .github/ or .gitleaks.toml`)
- **Unit Test Command**: `node --test --test-name-pattern="files.*array no longer lists" test/github-actions-removed.test.js`
- [ ] Pass

---

## Gaps

- **No case re-verifies the remaining repo-wide references to `docker-harness.yml`/`security.yml`/`.gitleaks.toml`** (in `README.md`, `CLAUDE.md`, `lib/scripts/README.md`, `lib/prompts/README.md`, `raw/guides/deployment-strategy.md`, `bin/cli.js`, `wiki/work/tasks/TASK-073-*`, `wiki/work/uat/UAT-073-*`) — deliberate, not an oversight. TASK-079's own Step 2 notes record these as explicitly out of this task's scope, belonging instead to TASK-080 (deploy feature removal) and TASK-081 (deploy doc references, currently in-progress) and TASK-082 (trashing TASK-073/UAT-073). Asserting on them here would duplicate those tasks' own future UAT coverage against not-yet-landed work.
- **`.serena/memories/project/overview.md`** still describes `setup-deployment.sh` as copying `.github/` + `.gitleaks.toml` — flagged by TASK-079 as ambiguous (not claimed by any task) and deliberately left untouched per "err on not touching." Not covered by a test case for the same reason.
