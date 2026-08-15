---
id: TASK-007
aliases: [TASK-007]
title: "Update /wiki-ingest (and other wiki-writing skills) to refresh wiki/hot.md"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-006]
blocks: []
parallel_safe_with: [TASK-008, TASK-009]
uat: "[[UAT-007]]"
tags: [wiki-tooling, session-continuity]
---

# TASK-007 — Update `/wiki-ingest` (and other wiki-writing skills) to refresh `wiki/hot.md`

## Objective

Once `wiki/hot.md` exists (TASK-006), it needs to actually get refreshed — otherwise it goes stale immediately and the pattern is dead on arrival. Add a final step to `/wiki-ingest` (`lib/skills/wiki-ingest/SKILL.md`) that regenerates `wiki/hot.md`, and extend the same pattern to other wiki-writing skills where it clearly applies.

## Approach

`lib/skills/wiki-ingest/SKILL.md` currently ends at **Step 7: Append to the Log**. Add a **Step 8: Refresh the Hot Cache** that regenerates `wiki/hot.md` in full (not append — per TASK-006, hot.md is a regenerated summary, not a log) using: the most recent N `wiki/log.md` entries, the pages just touched by this ingest, and any open threads worth surfacing. Cap at ~500 words per the concept page (`wiki/knowledge/concepts/llm-wiki-hot-cache.md`).

**Scope call for "other wiki-writing skills"**: the roadmap item names `/wiki-ingest` explicitly and leaves the rest open. At minimum, wire it into `/wiki-ingest` (required). Beyond that, extend to skills that create durable, cross-session-relevant wiki state: `/roadmap-create`, `/task-add`, `/decision-finalize`, `/req-finalize` are good candidates (they mark meaningful "what changed" events). Skills that only *read* the wiki (`/wiki-query`, `/wiki-lint`) should NOT refresh hot.md except when `/wiki-query` files a new page back (its own documented behavior) — that's a write, same as ingest. Do not wire every skill mechanically; each addition should be a one-line "final step: refresh wiki/hot.md" pointing at a single shared procedure description (to avoid duplicating the regeneration logic across N skill files) — define that shared procedure once, likely inline in `wiki-ingest`'s Step 8, and have the others reference it by name rather than re-explain it.

## Steps

### 1. Add Step 8 to /wiki-ingest  <!-- agent: general-purpose -->

- [x] `Edit` `lib/skills/wiki-ingest/SKILL.md` to add `## Step 8: Refresh the Hot Cache` after the existing Step 7, with the full regeneration procedure (read current `wiki/hot.md` if present for continuity of "Active Threads", read recent `wiki/log.md` entries, rewrite all four sections, overwrite the file)
- [x] Update the skill's frontmatter `description` if it now undersells what the skill does (currently: "Process a source from raw/ into the wiki — write a summary page, update affected entity and concept pages, and record the ingest in the index and log" — decide if adding "and refresh the hot cache" is warranted)

### 2. Extend to other wiki-writing skills  <!-- agent: general-purpose -->

- [x] For each of `/roadmap-create`, `/task-add`, `/decision-finalize`, `/req-finalize`: add a short final step referencing the same hot-cache-refresh procedure defined in `/wiki-ingest` Step 8 (by name/link, not duplicated text)
- [x] For `/wiki-query`: only add the refresh to the "file the answer back as a new page" branch, not the read-only answer path

### 3. Verify  <!-- agent: general-purpose -->

- [x] Manually run through `/wiki-ingest`'s new Step 8 mentally against this session's own work (the wiki-tooling-improvements ingest) and confirm the resulting `wiki/hot.md` content would sensibly summarize it
- [x] Confirm no skill was wired to refresh hot.md on a read-only path
