---
title: Hot Cache
updated: 2026-09-13
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-09-13_

## Key Recent Facts

- **ROADMAP-0014 created (2026-09-13)**: `wiki/work/roadmaps/ROADMAP-0014-wiki-skill-deduplication-fixes.md`, 3 phases / 9 inline placeholder items, executing the `wiki-skill-boilerplate-duplication` fix list. Phase 1 (req-update/req-retire bug fix, bug-file schema-drift fix), Phase 2 (wiki-tidy rewrite, shared archive-item + ID-resolution docs, shared boilerplate doc, power-mode shrink), Phase 3 (new Decision Group for the decision-supersession-algorithm consolidation, plus a task-dependency-format cleanup **gated on `DEC-0001#D4`** — do not tackle that item until D4 is accepted). `linked_decisions: [DEC-0001]`. **The `req-*`→`requirement-*` rename was deliberately excluded** — the user chose to defer it after reviewing the research; it remains available at `raw/research/req-to-requirement-rename/` and `knowledge/concepts/skill-family-rename-pattern.md` for a future roadmap. Next: `/roadmap-next wiki/work/roadmaps/ROADMAP-0014-wiki-skill-deduplication-fixes.md` to materialize its items into task files.
- **`req-*` → `requirement-*` rename researched but deferred (2026-09-13)**: this repo already executed this exact class of rename twice (`adr-*`→`decision-*`, `prd-*`→`req-*`) via `install-global.sh`'s `ORPHAN_SKILLS` array — a known-working 7-step pattern, not novel risk, whenever it's picked back up. Found a pre-existing, unrelated doc-drift bug along the way: `CLAUDE.md`'s command table is missing a `/req-retire` row (not yet fixed — was going to be bundled into the now-deferred rename).
- **ROADMAP-0013 in active execution via `/power-mode` (2026-09-13, concurrent session)**: materialized to `TASK-0086`–`TASK-0093`. Last known: `TASK-0086`, `TASK-0089`, `TASK-0090`, `TASK-0091` were `pending-uat`/UAT-generated; `TASK-0088` blocked on `DEC-0001#D1`. Check `wiki/work/tasks/index.md` for current state.
- **DEC-0001 (D1-D4, all `proposed`)**: blocks `TASK-0088` and ROADMAP-0014's task-dependency-format item. Next: `/decision-finalize` per block.
- **TASK-0085 (`status: todo`)**: fixes `bug-file`/`roadmap-create` stale bare-filename instructions + 4-digit ID standardization. Not yet confirmed tackled.
- **`wiki/log.md` is well past the ~500-line rotation threshold (now 980+)** — `/wiki-rotate-log` increasingly overdue.
- **Local branch remains ahead of `origin/main`** (uncommitted work across today's sessions) — a `/git-commit` is due.

## Recent Changes

- Created (2026-09-13): `wiki/work/roadmaps/ROADMAP-0014-wiki-skill-deduplication-fixes.md`; `raw/research/req-to-requirement-rename/{index,sources}.md`; `knowledge/sources/req-to-requirement-rename.md`; `knowledge/concepts/skill-family-rename-pattern.md`. Updated: `wiki/work/roadmaps/index.md` (+1 row), `wiki/index.md` (Sources + Concepts), `wiki/log.md`.
- Concurrently (2026-09-13, separate session): ROADMAP-0013's `TASK-0086` fix-forward + disclosure; `TASK-0089`/`TASK-0090` finalized after an orchestration interruption; `TASK-0091` implemented + `UAT-0091` generated.
- Earlier same day: skill-simplification research ingested; cross-family synergy research ingested; `ROADMAP-0013` + `DEC-0001` (first Decision Group) created and materialized to 8 tasks; `ROADMAP-010` completed and archived.

## Active Threads

- **ROADMAP-0014 (0/9, active, just created)**: not yet started. Next: `/roadmap-next wiki/work/roadmaps/ROADMAP-0014-wiki-skill-deduplication-fixes.md` to materialize tasks; its Phase 3 dependency-format item must wait on `DEC-0001#D4`.
- **ROADMAP-0013 (in progress, being driven by a concurrent session)**: re-check `wiki/work/tasks/index.md` before acting.
- **DEC-0001 (D1-D4, all `proposed`)**: blocks `TASK-0088` and ROADMAP-0014's dependency-format item. Next: `/decision-finalize` per block.
- **req-* → requirement-* rename**: researched, deliberately deferred — not on any roadmap. Revisit via a future `/roadmap-create` or `/task-add` when wanted.
- **TASK-0085 (todo)**: not yet confirmed tackled — check for an in-progress teammate session first.
- **ROADMAP-012 (0/3, active)** and **ROADMAP-011 (0/4, active)**: not yet started.
- **Not yet on any roadmap**: worktree isolation, a PostToolUse prompt-injection scanner, a statusline, plugin-marketplace candidate (awaits `/decision-create`); an observability guide.
- **ROADMAP-010 (done, archived)**, **ROADMAP-009 (closed, archived)**, **ROADMAP-001 (11/12, active, sole item deliberately deferred)**.
- **TASK-031 (todo)**, **TASK-074 (todo)**, **TASK-067 (pending-uat)**, **TASK-039 (pending-uat)**, **BUG-0001–0008 (open, older, unrelated)**.
- **`wiki/log.md` rotation overdue** — run `/wiki-rotate-log`.
