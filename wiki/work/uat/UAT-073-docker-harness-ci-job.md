---
id: UAT-073
aliases: [UAT-073]
title: "UAT: Wire a GitHub Actions CI job for the Docker fresh-machine harness"
status: pending
task: TASK-073
created: 2026-08-22
updated: 2026-08-22
---

# UAT-073 — UAT: Wire a GitHub Actions CI job for the Docker fresh-machine harness

implements::[[TASK-073]]

> **Source task**: [[TASK-073]]
> **Generated**: 2026-08-22

---

## Prerequisites

- [ ] Repo checked out locally with `.github/workflows/docker-harness.yml` present.
- [ ] Node available for the promoted unit-test commands (`node --test`).
- [ ] A GitHub Actions-capable remote (for the one Manual case) — not required for the other cases, which are static.

---

## Test Cases

### UAT-EDGE-001: Workflow triggers only on `pull_request`, scoped to the two relevant paths
- **Scenario**: The workflow must not run on every push or every path — only PRs touching `test/docker/fresh-machine/**` or `lib/scripts/**`, per the task's explicit "keep CI cost proportional to relevance" requirement.
- **Steps**:
  1. Open `.github/workflows/docker-harness.yml`.
  2. Confirm `on:` has a `pull_request:` block with a `paths:` list containing exactly `test/docker/fresh-machine/**` and `lib/scripts/**`, and no `push:` trigger.
- **Expected Result**: `pull_request` is the only trigger; `paths` is restricted to the two named globs; no unscoped/`push` trigger exists.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (`docker-harness.yml: triggers only on pull_request, scoped to the two relevant paths, never on push or every path`)
- **Unit Test Command**: `node --test test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-002: Job runs on `ubuntu-latest` and checks out the repo before building the image
- **Scenario**: The job must check out the repo first (so `test/docker/fresh-machine/` is present on disk) before attempting to build the image from it.
- **Steps**:
  1. Open `.github/workflows/docker-harness.yml`.
  2. Confirm the job's `runs-on:` is `ubuntu-latest`.
  3. Confirm an `actions/checkout@v4` step appears before the `docker build` step.
- **Expected Result**: `runs-on: ubuntu-latest`; checkout step precedes the build step in file order.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (`docker-harness.yml: job runs on ubuntu-latest and checks out the repo before building`)
- **Unit Test Command**: `node --test test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-003: Image is built with the tag `bootstrap-claude-fresh-machine`, matching `run.sh`'s own `IMAGE_NAME`
- **Scenario**: `run.sh`'s internal `docker image inspect "$IMAGE_NAME"` check (used to skip a redundant rebuild) only works if the CI-built image is tagged with the exact same name `run.sh` itself uses.
- **Steps**:
  1. Open `.github/workflows/docker-harness.yml`; confirm the build step tags the image `bootstrap-claude-fresh-machine` and points the build context at `test/docker/fresh-machine`.
  2. Open `test/docker/fresh-machine/run.sh`; confirm `IMAGE_NAME="bootstrap-claude-fresh-machine"`.
- **Expected Result**: The two tags are identical strings.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (`docker-harness.yml: builds the harness image tagged bootstrap-claude-fresh-machine, matching run.sh's own IMAGE_NAME`)
- **Unit Test Command**: `node --test test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-004: `run.sh setup` runs before `run.sh update`, as separate steps, neither swallowing a non-zero exit
- **Scenario**: The task requires both modes to run non-interactively and fail the job on non-zero exit from either — no `continue-on-error` or manual exit-code handling should mask a failure.
- **Steps**:
  1. Open `.github/workflows/docker-harness.yml`.
  2. Confirm a step running `./test/docker/fresh-machine/run.sh setup` appears before a step running `./test/docker/fresh-machine/run.sh update`.
  3. Confirm no step in the job sets `continue-on-error`.
- **Expected Result**: setup step precedes update step; no `continue-on-error` anywhere in the job (default `run:` step behavior — non-zero exit fails the job — is relied on as-is).
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (`docker-harness.yml: runs "run.sh setup" then "run.sh update" as separate steps, setup before update, each relying on default non-zero-exit step failure`)
- **Unit Test Command**: `node --test test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-005: TASK-071/TASK-072 pending modes are noted, not silently omitted
- **Scenario**: TASK-071 (stale mode) and TASK-072 (idempotency check) were both still `status: todo` at implementation time — the task's acceptance criteria require a one-line comment noting their `run.sh` modes should be added once those tasks land, rather than either blocking this task or silently leaving no trace.
- **Steps**:
  1. Open `.github/workflows/docker-harness.yml`.
  2. Confirm a comment referencing both TASK-071 and TASK-072 is present.
- **Expected Result**: Both task IDs appear in a comment in the workflow file.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (`docker-harness.yml: notes TASK-071/TASK-072 modes are pending rather than silently omitting them`)
- **Unit Test Command**: `node --test test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-006 (Manual): The workflow actually goes green on a real `ubuntu-latest` GitHub Actions runner
- **Scenario**: None of the cases above execute the workflow — they are static YAML-shape assertions only, since a live GitHub Actions runner is not available from this environment. This case is the one genuinely non-unit-testable verification: does `docker build` + `run.sh setup` + `run.sh update` actually succeed on GitHub's infrastructure.
- **Steps**:
  1. Open a pull request that touches a file under `test/docker/fresh-machine/**` or `lib/scripts/**` (or manually dispatch/re-run the workflow against an existing PR) so the `pull_request` trigger fires.
  2. Watch the `Docker Fresh-Machine Harness` job in the PR's checks.
  3. Observe whether the `Run setup mode` and `Run update mode` steps both exit 0.
- **Expected Result**: All four steps (checkout, build, setup, update) complete with exit 0 and the job shows green.
- **Known risk (flagged during implementation, not fixed by this task)**: `test/docker/fresh-machine/README.md`'s "Out of scope for v1" section documents that both `run.sh setup` and `run.sh update` currently exit non-zero at the Serena `project.yml` bootstrap step on a fully non-interactive, decline-only path (no TTY for prompts, as CI provides). If this UAT case is walked before that limitation is resolved, **expect it to fail at that step** — record the observed failure point here rather than treating it as a surprise, and cross-reference the follow-on task that resolves it (likely TASK-071's territory or a dedicated fix) once one exists.
- **Repeatable Unit Test**: Not applicable: requires a live GitHub Actions runner and Docker daemon; cannot be captured as a deterministic `node --test` unit test.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-08-22 -->

---

## Gaps

None of the planned cases were dropped for insufficient research — all four static-shape assertions were verified directly against the actual `.github/workflows/docker-harness.yml` and `test/docker/fresh-machine/run.sh` file contents, and all corresponding unit tests were run and passed. UAT-EDGE-006 is intentionally Manual: no GitHub Actions runner or live Docker daemon is available in this environment, so it cannot be promoted to a unit test or auto-judged from static evidence alone — it fail-closes to human verification by design.

- **Automation reassessment (2026-08-27)**: re-examined and confirmed EDGE-006 has no local promotion path, unlike UAT-060/UAT-072's Docker-dependent Manual cases. This one's entire claim is "does the workflow go green on GitHub's actual infrastructure" — a real PR against a real remote is the only mechanism that can answer it; a local Docker run (even a faithful one) tests the harness, not GitHub Actions' own environment/permissions/network. Stays permanently human-only.
