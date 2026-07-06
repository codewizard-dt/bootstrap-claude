---
title: Tasks Lifecycle
updated: 2026-06-11
---

# Tasks Lifecycle

Execution-ready task files with `## Steps` checklists. ID scheme: **TASK-NNN** (3-digit, zero-padded). Filename: `TASK-NNN-slug.md`. UAT test files mirror task naming (**UAT-NNN**) and live in the sibling [`../uat/`](../uat/) family.

Active files are **never moved** after creation; state lives in the `status:` frontmatter field. Terminal items (`done`, `trashed`) may be moved to [`archive/`](archive/) by `/wiki-archive`. The active set is tracked in [`index.md`](index.md).

## Frontmatter schema

| Key | Required | Notes |
|-----|----------|-------|
| `id` | yes | `TASK-NNN` |
| `title` | yes | task title |
| `status` | yes | `todo \| in-progress \| pending-uat \| done \| trashed` |
| `created` / `updated` | yes | `YYYY-MM-DD` |
| `depends_on` | no | `TASK-NNN` IDs that must finish first |
| `blocks` | no | `TASK-NNN` IDs this one gates |
| `parallel_safe_with` | no | `TASK-NNN` IDs safe to run concurrently |
| `uat` | no | link to the matching `../uat/UAT-NNN-slug.md` |
| `tags` | no | discovery only |

## Status transitions

```
todo ──▶ in-progress ──▶ pending-uat ──▶ done
  │            │               │
  └────────────┴───────────────┴──▶ trashed
```

- **todo** — created by `/task-add`; not yet started.
- **in-progress** — being executed (`/tackle`); at least one `## Steps` checkbox still unchecked. `/tackle` runs **static gates only** (typecheck, `bash -n`, lint, unit tests); runtime/E2E verification is the UAT phase.
- **pending-uat** — implementation finished (every `## Steps` checkbox checked); set by `/tackle` right before its UAT-generation gate. UAT has not yet passed or been skipped. `/roadmap-next` surfaces tasks in this state with a `/uat-walk`/`/uat-auto` action instead of `/tackle` — there's nothing left to implement, only to verify.
- **done** — implementation complete and its UAT passed (`/uat-walk` / `/uat-auto`) or was explicitly skipped (`/uat-skip`).
- **trashed** — terminal; abandoned via `/task-trash` with the reason recorded in the file. The matching UAT is trashed alongside.

A task reaches **done** only when its UAT is all-pass or skipped — see the [UAT lifecycle](../uat/lifecycle.md).
