# Requirements + Decisions Workflow

## Pipeline

```
/prd-create → /prd-finalize → /adr-extract → /adr-create → /adr-finalize → /task-create → /tackle → /uat-create → /uat-walk|/uat-auto
```

The requirements/decisions layer is optional for small/internal work — jump directly to `/task-create` for bug fixes, refactors, single-engineer choices.

## Requirements (wiki/work/requirements/)

| Command | Effect |
|---------|--------|
| `/prd-create` | Socratic Q&A elicitation → `wiki/work/requirements/PRD-NNNN-slug.md` (status: draft) |
| `/prd-finalize` | Completeness audit → status: approved |
| `/req-update` | Append-only Amendment blocks (approved); free edits (draft) |
| `/prd-deprecate` | Flip status: retired; move the row to Closed in the requirements index (file never moves) |
| `/adr-extract` | Extract ASRs from a PRD or any document → propose `/adr-create` candidates |
| `/prd-compile` | Build/verify system from approved requirement |

Approved requirements are amended via append-only `## Amendment N` blocks. Status: draft → approved → retired. Files never move.

## Decisions (wiki/work/decisions/)

Addressed as `ADR-NNNN#DM` (group#block); pre-migration items keep the legacy `DEC-NNNN#DM` form. Status per block: proposed → accepted → superseded, or proposed/accepted → deprecated (withdrawn without a successor).

| Command | Effect |
|---------|--------|
| `/adr-create` | Create Decision Group with 1+ proposed decision blocks |
| `/adr-finalize` | Per-block E-C-A-D-R audit → accepted; updates family index |
| `/adr-deprecate` | Per-block `<file>#DM` → status: deprecated (no successor) with a `> **Deprecated**` callout; file never moves; `superseded` stays `/adr-finalize`-only |
| `/adr-walkthrough` | Review pass — confirms choices, light edits, no status flips |
| `/adr-next` | Find first accepted decision with no task reference |

## Typed links

Tasks reference decisions with: `implements::[[ADR-NNNN#DM]]` (typed link, not old `**Implements**: ADR-...` format).
