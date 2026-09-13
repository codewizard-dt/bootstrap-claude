---
id: TASK-082
aliases: [TASK-082]
title: "Trash TASK-073 and UAT-073 (descoped by GitHub Actions removal)"
status: done
created: 2026-09-04
updated: 2026-09-13
depends_on: [TASK-079]
blocks: [TASK-083]
parallel_safe_with: []
uat: "[[UAT-085]]"
tags: [cleanup]
---

# TASK-082 — Trash TASK-073 and UAT-073

implements::[[ROADMAP-010]]
depends_on::[[TASK-079]]
blocks::[[TASK-083]]

> **Depends on**: [[TASK-079]]
> **Blocks**: [[TASK-083]]

## Objective

TASK-073 ("Wire a GitHub Actions CI job for the Docker fresh-machine harness") and its UAT-073 are the only open work items referencing GitHub Actions/CI. Now that TASK-079 has removed all GitHub Actions from this repo, this work is moot. Trash both via the established `/task-trash` mechanism rather than completing or silently deleting them.

## Approach

Use the `task-trash` skill directly — it flips status to `trashed`, removes both files' active-index rows, records the reason, and cleans roadmap/decision references. No manual file editing needed beyond what that skill does.

## Steps

### 1. Trash TASK-073 (and its matching UAT-073)  <!-- agent: general-purpose -->

- [x] Run `/task-trash wiki/work/tasks/TASK-073-docker-harness-ci-job.md` with reason: "Descoped — GitHub Actions removed from this repo per ROADMAP-010; the CI job this task wired no longer has anything to run against."
- [x] Confirm both `TASK-073` and `UAT-073` end up with `status: trashed`, are removed from their active `index.md` files, and that ROADMAP-009's `TASK-073` reference is cleaned up as the skill's own procedure dictates

<!-- Updated: 2026-09-13 -->

**Result:** TASK-073 archived to `wiki/work/tasks/archive/TASK-073-docker-harness-ci-job.md` (`status: trashed`); UAT-073 archived to `wiki/work/uat/archive/UAT-073-docker-harness-ci-job.md` (`status: trashed`). Both removed from `wiki/work/tasks/index.md` and `wiki/work/uat/index.md`. Archive index rows added to `wiki/work/tasks/archive/index.md` and `wiki/work/uat/archive/index.md`. `wiki/log.md` entry appended. ROADMAP-009's `[[TASK-073: ...]]` reference was **intentionally left in place** — `task-trash`'s own procedure (SKILL.md step 5) states stable `[[TASK-NNN]]` IDs remain valid regardless of file location and must not be stripped from roadmaps/decisions; this is the correct "cleaned up per its own procedure" outcome, not an omission.
