---
title: Roadmaps Lifecycle
updated: 2026-06-11
---

# Roadmaps Lifecycle

Execution-plan roadmaps: a goal, phases, and a hybrid checklist where each item is either a **task link** (`[TASK-NNNN](../tasks/TASK-NNNN-slug.md)`) or an **inline** checkbox item. ID scheme: **ROADMAP-NNNN** (4-digit, zero-padded). Filename: `ROADMAP-NNNN-slug.md`.

Existing `ROADMAP-NNN` files created before 2026-09-13 keep their 3-digit names permanently; only IDs assigned after that date use 4 digits.

Active files are **never moved** after creation; state lives in the `status:` frontmatter field. Terminal items (`done`) may be moved to [`archive/`](archive/) by `/wiki-archive`. The active set is tracked in [`index.md`](index.md).

## Frontmatter schema

| Key | Required | Notes |
|-----|----------|-------|
| `id` | yes | `ROADMAP-NNNN` |
| `title` | yes | roadmap goal |
| `status` | yes | `active \| done` |
| `created` / `updated` | yes | `YYYY-MM-DD` |
| `owner` | no | accountable person/role |
| `linked_requirements` | no | `REQ-NNNN` back-links |
| `linked_decisions` | no | `DEC-NNNN` back-links |
| `tags` | no | discovery only |

## Status transitions

```
active ──▶ done
```

- **active** — at least one unchecked item remains. Items are added by editing the roadmap file directly, at creation via `/roadmap-create`, or via `/task-add --roadmap ROADMAP-NNNN` (auto-links a new task); task-linked items auto-check when their task completes.
- **done** — every checklist item is checked. Completion is implicit; flip `status` to `done` when the last box is ticked.
