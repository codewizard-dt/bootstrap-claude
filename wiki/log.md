# Wiki Log

Append-only record of wiki operations — ingests, queries filed back, lint passes, scaffolding. **Never edit existing entries**; only append new ones at the bottom.

Entry format (consistent prefix keeps the log greppable — `grep "^## \[" log.md | tail -5`):

```
## [YYYY-MM-DD] <op> | <subject>
1–3 sentences on what happened.
```

Operations: `scaffold`, `ingest`, `query`, `lint`, `decision`, `task`, `bug`, `requirement`, `roadmap`.

---

## [2026-06-11] scaffold | Two-domain wiki + raw/ layer created
Created the `wiki/` knowledge base in the two-domain form (`knowledge/` + `work/`) with index/log MOC, conventions, and per-family lifecycle docs. Relocated ground-truth docs into the immutable `raw/` layer. Skill rewiring and `.docs/` content migration deferred to follow-up tasks.

## [2026-06-11] scaffold | UAT un-nested, per-family active indexes added
UAT promoted to its own work family at `work/uat/` (own lifecycle, statuses `pending|in-progress|passed|failed|skipped|trashed`). Every work family gained an `index.md` listing only active items; the home index now links to family indexes instead of listing work items. `trashed` added as a terminal status for tasks and UAT (`/task-trash` flips status — no file moves).

## [2026-06-14] scaffold | Archive subdirs and log rotation added
Added `archive/` subdirectory (with `archive/index.md`) to all 6 work families. Updated `lifecycle.md` files to clarify that active files are never moved but terminal items may be moved to `archive/` by `/wiki-archive`. Added two new skills: `/wiki-archive` (batch-moves terminal items) and `/wiki-rotate-log` (rotates log.md to dated segment files at ~400 entries). Updated `conventions.md` with §5 Archiving and §6 Log rotation. The "files are never moved" rule is now "active files are never moved" — link safety is preserved because links use stable IDs not paths.

## [2026-07-06] ingest | Research: Improving the LLM Wiki tooling
Ingested from `raw/research/wiki-tooling-improvements/index.md` (+ `sources.md`). Key claims: Claude Code's native Auto Memory has no bridge to this repo's wiki; independent gist reimplementations converged on a hot-cache session-handoff file, provenance tagging, and multi-writer locking, none of which this repo has yet; dedicated agent-memory frameworks (Mem0/Zep/Letta/Hindsight) solve a different problem than this wiki and shouldn't be adopted as a default. 5 entity pages touched (1 person, 4 tools), 4 concept pages touched, 1 new source summary page.

## [2026-07-06] roadmap | ROADMAP-001 created — Improve wiki tooling based on 2026-07-06 research
Created `wiki/work/roadmaps/ROADMAP-001-wiki-tooling-improvements.md` (5 phases, 11 inline items, all pending task-file creation via `/roadmap-next`). Phases: audit/fix skill-template drift, documentation bridge (Auto Memory vs. wiki), session-continuity hot cache, provenance/confidence tagging, and deferred concurrency-safety locking. Derived from the same-day research ingest above. Owner: David Taylor.
