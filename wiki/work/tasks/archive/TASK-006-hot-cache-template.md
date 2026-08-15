---
id: TASK-006
aliases: [TASK-006]
title: "Add wiki/hot.md template to lib/scripts/templates/wiki/"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: [TASK-007, TASK-008]
parallel_safe_with: [TASK-009]
uat: "[[UAT-006]]"
tags: [wiki-tooling, session-continuity]
---

# TASK-006 — Add `wiki/hot.md` template to `lib/scripts/templates/wiki/`

## Objective

Scaffold a `hot.md` template into `lib/scripts/templates/wiki/` (copy-once, like the rest of that directory) so both this repo and future synced projects get a session-handoff "hot cache" file: a small, always-read-first summary of what changed last session, per `wiki/knowledge/concepts/llm-wiki-hot-cache.md`. This task creates the template and file only — wiring `/wiki-ingest` to refresh it (TASK-007) and `/primer` to read it first (TASK-008) are separate, dependent tasks.

## Approach

Per the concept page, the pattern (converged on independently by two gist reimplementations) is a small file with a fixed structure, capped around ~500 words, regenerated at the end of every wiki-writing session:

```
# Hot Cache

_Last updated: YYYY-MM-DD_

## Key Recent Facts
- ...

## Recent Changes
- Created: ...
- Updated: ...
- Flagged: ...

## Active Threads
- ...
```

`lib/scripts/templates/wiki/` currently has: `conventions.md`, `log.md`, `index.md` at the top level, plus per-family subdirectories. `hot.md` belongs alongside those three top-level files (same directory, same copy-once semantics as the rest of `sync-wiki-scaffold.sh`'s scaffold).

## Steps

### 1. Create the template file  <!-- agent: general-purpose -->

- [x] `Write` `lib/scripts/templates/wiki/hot.md` with the structure above, plus a one-line comment (or intro sentence) explaining its purpose and that it's meant to be fully regenerated each session, not appended to
- [x] Check `lib/scripts/sync-wiki-scaffold.sh` for how the other top-level template files (`conventions.md`, `log.md`, `index.md`) are copied in (copy-once vs. always-refresh) and add `hot.md` to the same copy-once list so it isn't silently overwritten once a project starts customizing it
- [x] Also create `wiki/hot.md` in **this repo** directly (since this repo is the template's own dogfood instance and won't otherwise pick up the new scaffold file automatically) — seed it with a short real summary of the current session's work (ROADMAP-001 creation + TASK-001..TASK-00N upgrades) as a first example of the pattern

### 2. Verify  <!-- agent: general-purpose -->

- [x] Confirm `lib/scripts/sync-wiki-scaffold.sh` references the new file correctly (run its dry-run/test path if one exists, or read the script's copy-once logic to confirm the new entry matches the existing pattern)
- [x] Confirm `wiki/hot.md` exists in this repo with real content, not just a copy of the empty template
