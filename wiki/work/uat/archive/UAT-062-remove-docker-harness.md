---
id: UAT-062
aliases: [UAT-062]
title: "UAT: Delete the Docker fresh-machine test harness entirely"
status: passed
task: TASK-078
created: 2026-09-04
updated: 2026-09-13
---

# UAT-062 — UAT: Delete the Docker fresh-machine test harness entirely

implements::[[TASK-078]]

> **Source task**: [[TASK-078]]
> **Generated**: 2026-09-04

**Numbering note**: this UAT is `UAT-062`, not `UAT-078`, because `UAT-078` was already claimed by an earlier UAT (`UAT-078-docker-harness-live-hook-mode`, verifying `TASK-076`, archived `status: passed`). `UAT-062` was the lowest fully-unused number in the family. Recorded here rather than silently deviating, following the precedent set in `UAT-077-package-install-consent-preference.md`.

---

## Prerequisites

- [x] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude` with TASK-078's changes applied (harness files removed via `git rm`, pointer row removed from `lib/scripts/README.md`)
- [x] Node.js available (`node --test` support)

---

## Test Cases

### UAT-EDGE-001: Harness directory and test file are gone
- **Scenario**: `test/docker/fresh-machine/` (Dockerfile, run.sh, README.md) and `test/docker-fresh-machine.test.js` must no longer exist in the working tree.
- **Steps**:
  1. Check `test/docker/fresh-machine/` does not exist.
  2. Check `test/docker-fresh-machine.test.js` does not exist.
- **Expected Result**: Both paths are absent (deleted via `git rm`, confirmed staged under "Changes to be committed" as `deleted:`).
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js`
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-002: lib/scripts/README.md pointer row is removed
- **Scenario**: The "Standalone infra scripts (not wired to the CLI)" table in `lib/scripts/README.md` must no longer contain the row linking to `test/docker/fresh-machine/`.
- **Steps**:
  1. Read `lib/scripts/README.md`.
  2. Search for the substring `docker/fresh-machine`.
- **Expected Result**: No match — the row (`| [`test/docker/fresh-machine/`](../../test/docker/fresh-machine/README.md) | Docker-based harness... |`) is gone; the rest of the file (including the `startup.sh` row above it and the `## templates/` section after it) is unchanged.
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js`
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-003: No live code, script, or non-archival doc still references the removed harness
- **Scenario**: Repo-wide search for `test/docker/fresh-machine` and `docker-fresh-machine.test.js` finds no reference outside historical/archival records.
- **Steps**:
  1. Search the repo for `test/docker/fresh-machine`.
  2. Search the repo for `docker-fresh-machine.test.js`.
  3. For each match, classify as historical (`wiki/log.md`, `wiki/hot.md`, `wiki/work/*/archive/`, `raw/` — all immutable/historical by CLAUDE.md rules) vs. live (anything else).
- **Expected Result**: Zero live-code or live-script matches. Live *documentation* matches are limited to items already tracked by ROADMAP-010's own later steps (`wiki/work/roadmaps/ROADMAP-009-docker-fresh-machine-harness.md`, `wiki/work/tasks/TASK-073-docker-harness-ci-job.md`, `wiki/work/uat/UAT-073-docker-harness-ci-job.md` — out of scope for TASK-078) plus two knowledge pages not named in ROADMAP-010's scope (`wiki/knowledge/sources/docker-harness-version-upgrade-testing.md`, `wiki/knowledge/entities/tools/claude-code-authentication.md` — flagged as a follow-up, not a regression from this task).
- **Repeatable Unit Test**: Not applicable: requires human/agent judgment to classify each match as historical vs. live vs. "already tracked by a different task" — not a deterministic single-assertion check.
- [x] Pass <!-- 2026-09-13: mcp__serena__search_for_pattern for both strings repo-wide found only historical hits (wiki/log.md, wiki/work/*/archive/, raw/research/), the removal regression test itself (test/docker-harness-removed.test.js, asserting absence), and the already-named exceptions (ROADMAP-009, TASK-073/UAT-073, docker-harness-version-upgrade-testing.md, claude-code-authentication.md) plus this removal's own task/roadmap/index records describing the work — no live/broken references found. -->

### UAT-EDGE-004: Full test suite passes with no missing-file errors
- **Scenario**: Deleting the harness and its test file must not break the rest of the suite (no dangling `require`/import of the deleted test file, no other test depending on the deleted fixtures).
- **Steps**:
  1. Run `npm test` from the repo root.
- **Expected Result**: Full suite passes (0 failures); no missing-file or module-not-found errors referencing `test/docker/fresh-machine/` or `test/docker-fresh-machine.test.js`.
- **Repeatable Unit Test**: Not applicable: this case *is* "run the full test suite" — the individual regression checks it depends on are already captured by `test/docker-harness-removed.test.js` (UAT-EDGE-001/002); a suite-wide run is the aggregate signal, not a new assertion to promote.
- [x] Pass <!-- 2026-09-13: `npm test` run from repo root — 407/407 tests passing, 0 failures, no missing-file or module-not-found errors. -->

---

## Gaps

None. All four planned cases from TASK-078's own checklist were covered; two (file/dir deletion, README pointer removal) were promoted to a real, deterministic, repeatable unit test (`test/docker-harness-removed.test.js`, verified green — 3/3 passing at generation time); the remaining two (repo-wide reference sweep, full suite run) are judgment-based / aggregate checks and are recorded as manual UAT cases per Step 3 of TASK-078.
