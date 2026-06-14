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
