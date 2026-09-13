---
id: TASK-082
aliases: [TASK-082]
title: "Trash TASK-073 and UAT-073 (descoped by GitHub Actions removal)"
status: todo
created: 2026-09-04
updated: 2026-09-04
depends_on: [TASK-079]
blocks: [TASK-083]
parallel_safe_with: []
uat: ""
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

- [ ] Run `/task-trash wiki/work/tasks/TASK-073-docker-harness-ci-job.md` with reason: "Descoped — GitHub Actions removed from this repo per ROADMAP-010; the CI job this task wired no longer has anything to run against."
- [ ] Confirm both `TASK-073` and `UAT-073` end up with `status: trashed`, are removed from their active `index.md` files, and that ROADMAP-009's `TASK-073` reference is cleaned up as the skill's own procedure dictates
