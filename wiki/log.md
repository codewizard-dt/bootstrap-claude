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
