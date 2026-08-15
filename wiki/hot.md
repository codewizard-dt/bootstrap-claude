---
title: Hot Cache
updated: 2026-08-15
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-15_

## Key Recent Facts

- **ROADMAP-007 created**: Obsidian Graph View Defaults & Dataview Query Examples (`wiki/work/roadmaps/ROADMAP-007-obsidian-graph-view-defaults.md`, `active`, 0/2 items checked). Closes out the two still-open Next Steps from the same-day `obsidian-graph-defaults` research: Phase 1 ships a default `.obsidian/graph.json` template into `install-obsidian.sh` (`colorGroups` per wiki family + a `"search": "path:wiki"` default filter, write-if-absent); Phase 2 authors example Dataview query blocks in `wiki/work/*/index.md` templates. Both items are inline placeholders — `/roadmap-next` will auto-create their task files.
- **New research ingested: Obsidian Graph View Styling & Shippable Wiki Defaults** (`wiki/knowledge/sources/obsidian-graph-defaults.md`). Headline finding: `.obsidian/graph.json`'s `colorGroups` is a **native, zero-plugin** Obsidian feature — a hand-authored color template keyed to `wiki/knowledge/*`/`wiki/work/*`/`raw/` beats auto-detecting plugins (Graph Styler, Auto Tag Graph Colors) for precision, and fits `install-obsidian.sh`'s existing write-if-absent, sticky-preference pattern. Now actioned by ROADMAP-007 above.
- **TASK-060 created**: Docker fresh-machine test harness for `setup`/`update` (`wiki/work/tasks/TASK-060-docker-fresh-machine-harness.md`, status `todo`). Planned location `test/docker/fresh-machine/` — a generic `ubuntu:24.04`-based image, bootstrap-claude checkout mounted (not copied) at run time. Task-creation only — no Dockerfile/run.sh/README content written yet.
- **All three open bugs from two sessions ago are fixed, verified, and archived: [[BUG-0009]], [[BUG-0010]], [[BUG-0011]].** Only [[BUG-0001]] through [[BUG-0008]] remain open (older hook-guard findings, unrelated).
- **Suite: 341/341 pass, 0 fail** as of the last verified run (no code changed by this or the prior two sessions — task/roadmap creation and research/wiki-ingest only).
- **ROADMAP-001 (11/12, active)** — wiki tooling improvements; Phase 4 advisory locking deliberately deferred, no urgency.

## Recent Changes

- Created (2026-08-15): `wiki/work/roadmaps/ROADMAP-007-obsidian-graph-view-defaults.md`. Updated `wiki/work/roadmaps/index.md` and `wiki/log.md`.
- Ingested (2026-08-15): `raw/research/obsidian-graph-defaults/` → `wiki/knowledge/sources/obsidian-graph-defaults.md`. Created: `wiki/knowledge/concepts/obsidian-graph-view-styling.md`, `wiki/knowledge/entities/tools/graph-styler.md`, `wiki/knowledge/entities/tools/auto-tag-graph-colors.md`. Updated: `wiki/knowledge/entities/tools/obsidian.md`, `wiki/knowledge/entities/tools/graph-link-types.md`, `wiki/index.md`, `wiki/log.md`.
- Created (2026-08-15): TASK-060 — Docker fresh-machine test harness. Added to `wiki/work/tasks/index.md`, logged in `wiki/log.md`. No implementation yet.
- Fixed + committed (2026-08-14, `9722eb8`): BUG-0009 (`lib/scripts/bootstrap-prefs.js` scope enforcement) and BUG-0010 (`lib/scripts/install-global.sh` message accuracy). Verified + archived.

## Active Threads

- **ROADMAP-007 (active, 0/2)** — ready for `/roadmap-next`, which will create task files for both inline items (Phase 1: graph.json template; Phase 2: Dataview query examples) before they can be tackled.
- **TASK-060 (todo)** — Docker fresh-machine harness, ready for `/tackle`. No dependencies; `parallel_safe_with: [TASK-031, TASK-039]`.
- **Unresolved `update`-specific bug under active investigation**: the user stepped away to re-test a `prompt_yn`/interactive-read issue on `update-project.sh` on a different physical machine. Not yet filed as a formal BUG — no root cause confirmed yet. TASK-060's harness is intended to make this class of bug reproducible going forward. Treat this as a top-priority thread to pick back up when the user returns with results.
- **Large amount of uncommitted work has accumulated** across three sessions (ROADMAP-006's tasks, two research ingests, `research.autoIngest`, TASK-060, and now the Obsidian graph-defaults research + ROADMAP-007). Consider `/git-commit` (with its version-bump flow) when ready to package it.
- **ROADMAP-001 (11/12, active)** — Phase 4 advisory locking deliberately deferred, no urgency.
- **TASK-031 (todo)** — Tier 3 `/sandbox`; note `install-global.sh` + `merge-settings-hooks.js` are TWO settings-writing scripts the measurement must account for.
- **TASK-039 (pending-uat)** — hook inline comments; implementation done, needs `/uat-walk` or `/uat-auto`, not `/tackle`.
- **BUG-0001 through BUG-0008 (open, older, unrelated)** — hook-guard findings from an earlier audit, not touched recently.
- **Small doc cleanup still pending**: `raw/guides/dataview-queries.md` + `wiki/guides/dataview-queries.md`'s "Once TASK-053 lands..." conditional phrasing — TASK-053 has been closed for a while, safe to clean up whenever convenient.
