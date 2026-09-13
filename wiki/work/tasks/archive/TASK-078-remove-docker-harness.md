---
id: TASK-078
aliases: [TASK-078]
title: "Delete the Docker fresh-machine test harness entirely"
status: done
created: 2026-09-04
updated: 2026-09-13
depends_on: []
blocks: [TASK-081, TASK-084]
parallel_safe_with: [TASK-079, TASK-080]
uat: "[[UAT-062]]"
tags: [docker, cleanup]
---

# TASK-078 — Delete the Docker fresh-machine test harness entirely

implements::[[ROADMAP-010]]
blocks::[[TASK-081]]
blocks::[[TASK-084]]

> **Blocks**: [[TASK-081]], [[TASK-084]]

## Objective

Per ROADMAP-010's decision ("the docker harness testing idea was a fun idea but it's too much hassle"), remove the Docker fresh-machine test harness completely — not just its CI wiring. This means `test/docker/fresh-machine/` (Dockerfile, run.sh, README.md) and `test/docker-fresh-machine.test.js` both go away, along with the harness's pointer row in `lib/scripts/README.md`.

## Approach

Plain deletion via `git rm`, then verify the rest of the suite is unaffected — no other file imports or requires `test/docker-fresh-machine.test.js`, and no other doc links to `test/docker/fresh-machine/README.md` besides the one row being removed here. Archived task/UAT records that reference this work (TASK-060/069/071/072/077 and their UATs) are historical fact and stay untouched — do not edit them.

## Steps

### 1. Delete the harness directory and its test file  <!-- agent: general-purpose -->

- [x] `git rm -r test/docker/fresh-machine/` (removes Dockerfile, run.sh, README.md, and any other files in that directory) — ran as `git rm -rf` since those files had uncommitted local modifications
- [x] `git rm test/docker-fresh-machine.test.js` — ran as `git rm -f` for the same reason
<!-- Updated: 2026-09-03 00:00 -->

### 2. Remove the pointer row in lib/scripts/README.md  <!-- agent: general-purpose -->

- [x] Use `mcp__serena__search_for_pattern` on `lib/scripts/README.md` for `docker/fresh-machine` to find the "Standalone infra scripts (not wired to the CLI)" table row that links to it, and remove that row (`Edit`, not `sed`) — removed the `test/docker/fresh-machine/` row
<!-- Updated: 2026-09-03 00:05 -->

### 3. Verify nothing else references the removed harness  <!-- agent: general-purpose -->

- [x] `mcp__serena__search_for_pattern` across the repo (excluding `wiki/log.md`, `wiki/hot.md`, and `wiki/work/*/archive/`, which are historical records and stay untouched) for `test/docker/fresh-machine` and `docker-fresh-machine.test.js` — no live code/script references found; remaining non-archival doc mentions are ROADMAP-009, TASK-073/UAT-073 (out of scope, handled by later ROADMAP-010 steps), and two knowledge pages (`wiki/knowledge/sources/docker-harness-version-upgrade-testing.md`, `wiki/knowledge/entities/tools/claude-code-authentication.md`) not named in ROADMAP-010's scope — flagged for a follow-up decision, not fixed here
- [x] Run `npm test` and confirm the full suite passes with no missing-file errors — 397/397 passed
<!-- Updated: 2026-09-03 00:12 -->
