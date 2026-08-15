---
id: TASK-008
aliases: [TASK-008]
title: "Update /primer to read wiki/hot.md first, before Serena memories"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-006, TASK-003]
blocks: []
parallel_safe_with: []
uat: "[[UAT-008]]"
tags: [wiki-tooling, session-continuity]
---

# TASK-008 — Update `/primer` to read `wiki/hot.md` first, before Serena memories

## Objective

`/primer` (`lib/skills/primer/SKILL.md`) exists to "refresh codebase context" but currently starts straight from Serena memories (Step 1: Discover & Read Memories). Once `wiki/hot.md` exists (TASK-006), `/primer` should read it *first* — it's the cheapest, most targeted "what happened last session" signal, cheaper than scanning `wiki/log.md` or rebuilding context from Serena memories alone.

## Approach

**Depends on both TASK-006 and TASK-003** — TASK-006 must land first (the file must exist to read), and TASK-003 also edits this same file (`lib/skills/primer/SKILL.md`, fixing its Step 4 README.md-drift bug). Do TASK-003's fix first, then layer this change on top, to avoid two tasks racing on the same file. If TASK-003 hasn't landed yet when this is tackled, stop and wait rather than editing around the stale Step 4.

Insert a new **Step 0: Read the Hot Cache** before the current Step 1, reading `wiki/hot.md` if it exists (skip gracefully if it doesn't — e.g. a project that hasn't run TASK-006's scaffold sync yet) and using its contents to prime context before diving into Serena memories. This doesn't replace Serena memory reading — it's a cheap first pass, per `wiki/knowledge/concepts/llm-wiki-hot-cache.md`'s framing of `/primer` as "the natural place to also read a hot-cache file first, once one exists."

## Steps

### 1. Confirm TASK-003 has landed  <!-- agent: general-purpose -->

- [x] Read `lib/skills/primer/SKILL.md`'s current Step 4 — if it still references `wiki/work/tasks/README.md`'s structured table (the TASK-003 bug), stop and flag that TASK-003 needs to complete first

### 2. Add Step 0: Read the Hot Cache  <!-- agent: general-purpose -->

- [x] `Edit` `lib/skills/primer/SKILL.md` to insert a new step before the current "Step 1: Discover & Read Memories": check `wiki/hot.md` exists via `mcp__serena__find_file`; if present, `Read` it and treat its "Key Recent Facts" and "Active Threads" sections as a first-pass context primer; if absent, skip silently (no warning — this is optional session continuity, not a hard requirement)
- [x] Renumber the subsequent steps (old Step 1 → Step 1, unchanged; the new step is "Step 0" or folded in as "Step 1" with the rest bumped — pick whichever reads more naturally without renumbering everything downstream unnecessarily)

### 3. Verify  <!-- agent: general-purpose -->

- [x] Confirm the new step gracefully no-ops when `wiki/hot.md` doesn't exist (important for any project that hasn't adopted TASK-006's scaffold yet)
- [x] Confirm this step doesn't duplicate or conflict with TASK-003's fixed Step 4 (task-index consistency check) — they should be independent checks
