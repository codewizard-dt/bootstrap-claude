---
title: Hot Cache
updated: 2026-07-06
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-07-06_

## Key Recent Facts
- **ROADMAP-001 (wiki tooling improvements) is complete** — all 11 tasks (TASK-001 through TASK-011) executed, UAT-verified (or `/uat-skip`'d with independently re-confirmed evidence when tests fail-closed to human judgment), and archived. Phases 0–3 are fully checked off (11/12 items). Only Phase 4 item 1 (advisory locking for shared wiki index files) remains unchecked — **deliberately deferred** until concrete concurrent-write corruption is observed, not an oversight.
- One real race *was* observed during this run: TASK-005 got archived (implementation + UAT-skip done) but its roadmap checkbox update was lost to a concurrent edit from a parallel agent — a live example of the exact class of bug Phase 4 exists to prevent. Manually corrected; no other races found on verification sweep.
- Net effect of the roadmap: 9 skill files de-drifted off the old `README.md`-as-family-index convention onto the real `index.md`+`lifecycle.md` split; `CLAUDE.md` gained an "Auto Memory vs. wiki" boundary note and an "Optional tooling" (qmd/Hindsight) pointer; `wiki/hot.md` (this file) now exists with a copy-once template and a canonical refresh procedure wired into `/wiki-ingest` (and referenced by `/roadmap-create`, `/task-add`, `/decision-finalize`, `/req-finalize`, `/wiki-query`'s file-back path); `/primer` now reads this file first, before Serena memories; `wiki/conventions.md` §4 activated the `confidence: extracted|inferred|ambiguous` frontmatter key, and both `/wiki-ingest` (populates it) and `/wiki-lint` (flags weak/missing provenance) now use it.
- **ROADMAP-002** (wiki-work HTML dashboard) also exists: 5 phases, 6 inline items, none upgraded to task files yet — needs `/roadmap-next`.

## Recent Changes
- Created: `wiki/work/tasks/TASK-001` through `TASK-011` (all now archived to `tasks/archive/`), matching `wiki/work/uat/UAT-001` through `UAT-011` (all archived to `uat/archive/`).
- Updated: `CLAUDE.md`, `wiki/conventions.md`, `wiki/work/roadmaps/ROADMAP-001-wiki-tooling-improvements.md` (all boxes checked except deferred Phase 4), `wiki/work/roadmaps/index.md` (progress count corrected), 9 `lib/skills/*/SKILL.md` files (README.md-drift fix), `lib/skills/wiki-ingest/SKILL.md` (hot-cache refresh + confidence population), `lib/skills/wiki-lint/SKILL.md` (confidence-provenance check), `lib/skills/primer/SKILL.md` (reads hot.md first).
- Flagged: none outstanding from this run.

## Active Threads
- ROADMAP-001: effectively done. Phase 4 (advisory locking) stays an intentional inline placeholder — do not create a task for it without a concrete concurrent-write incident as justification.
- ROADMAP-002 (dashboard): all 6 items still inline — needs `/roadmap-next` to upgrade to tasks, then implement in phase order.
