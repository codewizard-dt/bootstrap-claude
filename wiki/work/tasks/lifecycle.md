---
title: Tasks Lifecycle
updated: 2026-06-11
---

# Tasks Lifecycle

Execution-ready task files with `## Steps` checklists. ID scheme: **TASK-NNNN** (4-digit, zero-padded). Filename: `TASK-NNNN-slug.md`. UAT test files mirror task naming (**UAT-NNNN**) and live in the sibling [`../uat/`](../uat/) family.

Existing `TASK-NNN` files created before 2026-09-13 keep their 3-digit names permanently; only IDs assigned after that date use 4 digits.

Active files are **never moved** after creation; state lives in the `status:` frontmatter field. Terminal items (`done`, `trashed`) may be moved to [`archive/`](archive/) by `/wiki-archive`. The active set is tracked in [`index.md`](index.md).

## Frontmatter schema

| Key | Required | Notes |
|-----|----------|-------|
| `id` | yes | `TASK-NNNN` |
| `title` | yes | task title |
| `status` | yes | `todo \| in-progress \| done \| trashed` |
| `created` / `updated` | yes | `YYYY-MM-DD` |
| `depends_on` | no | `TASK-NNNN` IDs that must finish first |
| `blocks` | no | `TASK-NNNN` IDs this one gates |
| `parallel_safe_with` | no | `TASK-NNNN` IDs safe to run concurrently |
| `uat` | no | link to the matching `../uat/UAT-NNNN-slug.md` |
| `tags` | no | discovery only |

## Status transitions

```
todo ──▶ in-progress ──▶ done
  │            │
  └────────────┴──▶ trashed
```

- **todo** — created by `/task-add`; not yet started.
- **in-progress** — being executed (`/tackle`). `/tackle` runs **static gates only** (typecheck, `bash -n`, lint, unit tests); runtime/E2E verification is the UAT phase.
- **done** — implementation complete and its UAT passed (`/uat-walk` / `/uat-auto`) or was explicitly skipped (`/uat-skip`).
- **trashed** — terminal; abandoned via `/task-trash` with the reason recorded in the file. The matching UAT is trashed alongside.

A task reaches **done** only when its UAT is all-pass or skipped — see the [UAT lifecycle](../uat/lifecycle.md).
