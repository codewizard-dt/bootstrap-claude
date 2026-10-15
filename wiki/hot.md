---
title: Hot Cache
updated: 2026-09-20
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-09-20_

## Key Recent Facts

- **`/whats-next` researched (2026-09-20, not built)**: `raw/research/whats-next/` → `knowledge/sources/whats-next.md` + `knowledge/concepts/cross-family-work-prioritization.md`. Recommends a new **read-only cross-family advisor** ranking ALL open work (tasks in or out of a roadmap, UATs, bugs, ADR blocks, PRDs) by tiers (fix broken → finish in-flight → unblock → start ready → triage) then downstream dependency depth, with an explicit `--go` handoff to `power-mode` (which needs a new task-ID-list dispatch). Live measure: 14 of 40 open tasks+bugs are outside every roadmap. Build after ROADMAP-0014 Phase 4 lands and `install-global.sh` runs; suggested `depends_on: [TASK-0114, TASK-0120]`.
- **Tasks filed from that research (2026-09-20)**: `TASK-0125` (document `pending-uat` — missing from both `tasks/lifecycle.md` copies, index headers, `/primer`'s check and the dashboard tone map, so 24 tasks render unbadged; blocks 0126) and `TASK-0126` (build `/whats-next` v1, report-only; `depends_on` 0114, 0120, 0125; `--go` deferred until `/power-mode` takes a task-ID list). Both `todo`, off any roadmap.
- **Serena sweep gotchas** recorded on `entities/tools/serena.md`: use `[^\n]*` not `.*`, no `multiline=false` with `^`, full repo-relative include globs.
- **ROADMAP-0014 Phase 4 is in flight**: renames done through TASK-0117; TASK-0118/0119/0120 `pending-uat`, TASK-0121 `in-progress`, TASK-0122/0123/0124 `todo`. Family index progress figures are stale (ROADMAP-0014 shows 0/9; the file has 9 of 23 task-links checked).
- **Active work snapshot (2026-09-20, before TASK-0125/0126)**: 31 active tasks (24 `pending-uat`, 6 `todo`, 1 `in-progress`), 24 pending UATs (none walked), 9 open untriaged bugs, 5 active roadmaps, 0 active PRDs/ADRs.
- **`wiki/log.md` is far past the ~500-line rotation threshold (1,240+)** — `/wiki-rotate-log` overdue.
- **Local branch is well ahead of `origin/main`** (large uncommitted working tree from ROADMAP-0014) — a `/git-commit` is due.

## Recent Changes

- Created (2026-09-20): `wiki/work/tasks/TASK-0125-document-pending-uat-task-status.md`, `TASK-0126-build-whats-next-skill.md` (+ `tasks/index.md`, `log.md`); `raw/research/whats-next/{index,sources}.md`; `knowledge/sources/whats-next.md`; `knowledge/concepts/cross-family-work-prioritization.md`. Updated: `knowledge/entities/tools/serena.md`, `knowledge/entities/components/power-mode-skill.md`, `wiki/index.md`, `wiki/log.md`.
- 2026-09-19/20: ROADMAP-0014 Phase 4 tasks created and UATs generated (`UAT-0116`–`UAT-0120`); `TASK-0116`/`0117` done; shared `_shared/ARCHIVE-WORK-ITEM.md`, `ID-RESOLUTION.md`, `SKILL-BOILERPLATE.md` landed.
- 2026-09-19: `DEC-0001` D1–D4 all accepted and archived; `power-mode` gained the Agent Lifecycle reap-sweep (reap rules cover only agents the orchestrator itself spawned, not nested children).

## Active Threads

- **ROADMAP-0014 (active, Phase 4)**: drive the rename chain to completion; run UATs for `0118`→`0120`, continue `0121`.
- **ROADMAP-0013 (0/8)**: `TASK-0086`–`0093` all `pending-uat`.
- **ROADMAP-011 (2/4)** and **ROADMAP-012 (1/3)**: index says 0/4 and 0/3 — files are ahead.
- **ROADMAP-001 (11/12)**: sole remaining item deliberately deferred.
- **Not on any roadmap**: `TASK-031`, `-039`, `-074`, `-075`, `-0085`; `BUG-0001`–`0008`, `0012` (all `open`, untriaged); worktree isolation, PostToolUse prompt-injection scanner, statusline, plugin-marketplace candidate.
- **`TASK-0125` → `TASK-0126` (`/whats-next`)**: created, `todo`, not on any roadmap.
