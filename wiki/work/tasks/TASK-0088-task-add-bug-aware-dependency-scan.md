---
id: TASK-0088
aliases: [TASK-0088]
title: "task-add's dependency scan also checks wiki/work/bugs/, writing origin_bug"
status: pending-uat
created: 2026-09-13
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: [TASK-0086, TASK-0087, TASK-0089, TASK-0090, TASK-0092, TASK-0093]
uat: "[[UAT-0088]]"
tags: [tasks, bugs, skill-affordance]
---

# TASK-0088 — task-add's dependency scan also checks wiki/work/bugs/, writing origin_bug

relates_to::[[wiki-work-family-cross-linking-gaps]]

## ⚠️ Blocked on DEC-0001#D1 — check before implementing

This task writes to a task frontmatter field, `origin_bug`, that **does not exist yet**. It is formalized in `wiki/work/decisions/archive/DEC-0001-wiki-cross-family-linking-schema.md#D1` (archived once all four decisions were accepted; D1 was accepted 2026-09-18). **Before writing any code for this task**, `Read` that decision block's `Status:` field:

- If still `proposed` (or any status other than `accepted`): **stop here**, leave this task's `status: todo` unchanged, and report: "Blocked on DEC-0001#D1 being accepted — the `origin_bug` field this task writes doesn't exist in the schema yet. Re-run `/tackle` on this task after `/adr-finalize wiki/work/decisions/DEC-0001-wiki-cross-family-linking-schema.md#D1`." Do not implement a partial version against a field name that might still change during finalization.
- If `accepted`: proceed with the steps below, using exactly the field name and shape `DEC-0001#D1`'s accepted "Decision Outcome" specifies (it may differ slightly from the draft `origin_bug`/`linked_task` naming below if the finalize audit changed it — always defer to the accepted decision text over this task's own wording).

## Objective

`lib/skills/task-add/SKILL.md` Step 5 ("Identify dependencies") currently only scans `wiki/work/tasks/` for `depends_on`/`blocks`/`parallel_safe_with` candidates — it never checks `wiki/work/bugs/` for a related open or triaged bug that motivated this task. Once DEC-0001#D1 lands, extend the scan so a task created to fix a known bug records that provenance structurally (`origin_bug`) instead of only in free-form prose, mirroring the pattern `bug-close`'s `linked_task`-reading logic already assumes exists.

## Approach

**Source-of-truth note**: edit `lib/skills/task-add/SKILL.md` in this repo, never `~/.claude/skills/task-add/SKILL.md` — the latter is a machine-local copy installed by `install-global.sh`, overwritten on the next sync.

Add a second scan alongside the existing task-index scan in Step 5, not a replacement — the task-to-task dependency detection stays exactly as-is.

## Steps

### 1. Extend Step 5's scan to include open bugs <!-- agent: general-purpose -->

- [x] In `lib/skills/task-add/SKILL.md` Step 5, after "Review active tasks by listing `wiki/work/tasks/`...", add: also read `wiki/work/bugs/index.md` and scan its active rows (status `open`/`triaged`/`in-progress`) for one whose title/summary plausibly matches the new task's objective (same "plausible match" judgment call `roadmap-next`'s inline-upgrade step already uses for tasks).
- [x] If a match is found, include it in the same compact table Step 5 already presents via `AskUserQuestion` — add an "Origin bug" row alongside the existing depends_on/blocks/parallel_safe_with rows, so the user confirms or rejects the bug link in the same round-trip.

### 2. Write the field per DEC-0001#D1's accepted shape <!-- agent: general-purpose -->

- [x] In `lib/skills/task-add/SKILL.md` Step 8 (frontmatter template), add the accepted field (per the blocked-check above — expected to be `origin_bug: ""` or similar, singular optional) alongside the existing `depends_on`/`blocks`/`parallel_safe_with` keys.
- [x] If the user confirmed an origin bug in Step 5's table, populate the field with that `BUG-NNNN` reference when writing the task file.

### 3. Symmetric write-back to the bug file (only if DEC-0001#D1's accepted text specifies it) <!-- agent: general-purpose -->

- [x] Check whether DEC-0001#D1's accepted "🔁 Follow-up" consequence includes updating the bug side (`linked_task`) automatically from `task-add`, or leaves that to `/bug-close`/`/bug-triage` alone. If `task-add` is in scope per the accepted text, add a step here to `Edit` the matched bug file's `linked_task` field to point back at the new `TASK-NNNN`. If out of scope, skip this and note it explicitly in the completion report as intentionally left to the bug-side skills.
  - Result: out of scope. The accepted Follow-up names only `/bug-close` Step 9 and `/bug-triage` for the bug side; `task-add` write-back intentionally left to those skills.
<!-- Updated: 2026-09-19 -->
