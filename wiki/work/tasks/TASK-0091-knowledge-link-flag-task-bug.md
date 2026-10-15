---
id: TASK-0091
aliases: [TASK-0091]
title: "Add an optional knowledge-link flag to /task-add and /bug-file"
status: pending-uat
created: 2026-09-13
updated: 2026-09-13
depends_on: []
blocks: []
parallel_safe_with: [TASK-0086, TASK-0087, TASK-0089, TASK-0090, TASK-0092, TASK-0093]
uat: "[[UAT-0091]]"
tags: [tasks, bugs, knowledge, skill-affordance]
---

# TASK-0091 — Add an optional knowledge-link flag to /task-add and /bug-file

relates_to::[[wiki-work-family-cross-linking-gaps]]

## ⚠️ Shares a file with TASK-0088 — do not tackle simultaneously

Both this task and `TASK-0088` edit `lib/skills/task-add/SKILL.md`. They touch different sections (this task adds a new optional flag near the existing `--decision`/`--roadmap` handling in Steps 2–3; `TASK-0088` extends Step 5's dependency scan), but running both `/tackle` passes concurrently risks a lost edit if both agents read-then-write the same file in overlapping windows. **Run these two tasks sequentially, never in the same parallel batch** — this is an orchestration note, not a logical dependency, so `depends_on`/`blocks` are deliberately left empty.

## Objective

`/task-add` already supports `--decision DEC-NNNN#DM` and `--roadmap ROADMAP-NNNN` to link a new task at creation time. Add a parallel optional flag so a task (or bug) can cite a `wiki/knowledge/concepts/` or `wiki/knowledge/sources/` page the same way, instead of that link only happening when the work item happens to originate from a `/research` cycle.

## Approach

**Source-of-truth note**: edit `lib/skills/task-add/SKILL.md` and `lib/skills/bug-create/SKILL.md` in this repo, never their `~/.claude/skills/` counterparts — those are machine-local copies installed by `install-global.sh`, overwritten on the next sync.

Match the existing flag-parsing pattern exactly (detect token, strip it, resolve the file, store for later steps) rather than inventing a new mechanism.

## Steps

### 1. Add `--knowledge <slug>` to task-add <!-- agent: general-purpose -->

- [x] In `lib/skills/task-add/SKILL.md`, add a new step alongside "### Step 2: Parse and validate decision reference" and "### Step 3: Parse and validate roadmap reference" (call it Step 2b or similar — do not renumber the existing steps) that detects `--knowledge <slug>` or a bare recognizable concept/source slug, strips it, and locates the page via `mcp__serena__find_file` across `wiki/knowledge/concepts/` and `wiki/knowledge/sources/`.
- [x] If found, in Step 8's body template add a `relates_to::[[<slug>]]` line alongside the existing `implements::[[DEC-NNNN#DM]]` line (same position, immediately after the H1).
- [x] If not found, warn and continue without the link — never block task creation on a missing knowledge page.

<!-- Updated: 2026-09-13 (Step 2b inserted between existing Step 3 and Step 4; Step 8 body template + prose updated; argument-hint left untouched for Step 3 of this task) -->

### 2. Add the same flag to bug-create <!-- agent: general-purpose -->

- [x] In `lib/skills/bug-create/SKILL.md`, add the identical `--knowledge <slug>` handling in "### Step 3: Gather Required Fields via Q&A" (as an optional, non-required field alongside the existing `linked_task` exception handling).
- [x] Store the resolved page reference and write it into the bug file body (bug files don't currently have a typed-link line near the top the way tasks do — add one, e.g. directly under the H1, following the same `relates_to::[[<slug>]]` convention).

<!-- Updated: 2026-09-13 (Knowledge exception added to Step 3 Q&A; relates_to::[[<slug>]] template added to Step 6 body write; argument-hint left untouched for Step 3 of this task) -->

### 3. Document the new flags <!-- agent: general-purpose -->

- [x] Update both skills' `argument-hint:` frontmatter to include `[--knowledge <slug>]`.
- [x] If `CLAUDE.md`'s Custom Commands table describes `/task-add`'s or `/bug-create`'s flags, update those one-line descriptions to mention the new optional flag.

<!-- Updated: 2026-09-13 (argument-hint updated in both SKILL.md files; CLAUDE.md Custom Commands table rows for /task-add and /bug-file updated to mention --knowledge <slug>) -->
