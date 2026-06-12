# Requirements + Decisions Workflow

## Pipeline

```
/req-create → /req-finalize → /req-extract-decisions → /decision-create → /decision-finalize → /task-add → /tackle → /uat-generate → /uat-walk|/uat-auto
```

The requirements/decisions layer is optional for small/internal work — jump directly to `/task-add` for bug fixes, refactors, single-engineer choices.

## Requirements (wiki/work/requirements/)

| Command | Effect |
|---------|--------|
| `/req-create` | Socratic Q&A elicitation → `wiki/work/requirements/REQ-NNN-slug.md` (status: draft) |
| `/req-finalize` | Completeness audit → status: approved |
| `/req-update` | Append-only Amendment blocks (approved); free edits (draft) |
| `/req-retire` | Flip status: retired; remove from requirements index |
| `/req-extract-decisions` | Extract ASRs → propose `/decision-create` candidates |
| `/req-compile` | Build/verify system from approved requirement |

Approved requirements are amended via append-only `## Amendment N` blocks. Status: draft → approved → retired. Files never move.

## Decisions (wiki/work/decisions/)

Addressed as `DEC-NNNN#DM` (group#block). Status per block: proposed → accepted → superseded.

| Command | Effect |
|---------|--------|
| `/decision-create` | Create Decision Group with 1+ proposed decision blocks |
| `/decision-finalize` | Per-block E-C-A-D-R audit → accepted; updates family index |
| `/decision-walkthrough` | Review pass — confirms choices, light edits, no status flips |
| `/decision-next` | Find first accepted decision with no task reference |

## Typed links

Tasks reference decisions with: `implements::[[DEC-NNNN#DM]]` (typed link, not old `**Implements**: ADR-...` format).
