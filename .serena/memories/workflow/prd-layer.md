# PRD Layer — Requirements → Decision → Implementation Pipeline

This project implements a spec-driven development pipeline. PRDs sit upstream of ADRs and tasks, capturing **what to build and why** (product perspective) before architectural decisions are made.

## Pipeline

```
/prd-create → /prd-finalize → /prd-extract-decisions → /adr-create → /adr-finalize → /task-add → /tackle → /uat-*
   draft        approved        ASRs identified     proposed       accepted       WIP        done    verified
```

## The 5 PRD skills

| Skill | Purpose |
|-------|---------|
| `/prd-create` | Socratic Q&A elicitation → `.docs/prd/active/NNN-slug.md` (status: draft) |
| `/prd-finalize` | Completeness audit + stakeholder gate → flip to approved |
| `/prd-extract-decisions` | Extract Architecturally Significant Requirements (ASRs); propose Decision Groups; surface `/adr-create` commands; bidirectional cross-link |
| `/prd-update` | Append-only `## Amendment N` for approved PRDs; direct edits for drafts; surface downstream ADR/task impact |
| `/prd-trash` | Move to `.docs/prd/trashed/`; never auto-cascades to linked ADRs/tasks |

## Boundary rule (load-bearing invariant)

**"A PRD never justifies architecture. An ADR never redefines product scope."** (from Joel Parker Henderson's PRD↔ADR pattern.)

- PRDs vocab: outcomes, personas, user behavior, business value
- ADRs vocab: trade-offs, options, technical drivers, consequences
- Tasks vocab: file paths, function names, steps

If a PRD specifies "use Redis", lift it to an ADR. If an ADR specifies "users can reset via SMS", lift it to a PRD.

## Immutability model

| Layer | Mutability after acceptance |
|-------|------------------------------|
| PRD draft | Mutable (direct edits via `/prd-update`) |
| PRD approved | Immutable in substance — changes via append-only `## Amendment N` blocks; `[amended N]` markers point at amendments without rewriting original prose |
| ADR proposed | Mutable until finalized |
| ADR accepted | Immutable; only path to change is a successor ADR that supersedes it |

The amendment philosophy for PRDs is a softer parallel to ADR supersession: original wording is preserved verbatim with markers pointing forward to the amendment block.

## Cross-linking

| Direction | Mechanism |
|-----------|-----------|
| PRD → ADRs | `/prd-extract-decisions` populates the PRD's `## Linked ADRs` table |
| ADR → PRD | `/prd-extract-decisions` adds `Source PRD: PRD-NNN` to each ADR's `### Links` section |
| PRD → tasks | `/task-add --prd PRD-NNN` populates the PRD's `## Linked Tasks` table |
| Task → PRD | `/task-add --prd` adds `**PRD**: PRD-NNN ([file](...))` to the task |

## Format spec

Authoritative format: `.docs/prd/README.md` defines required-non-empty fields, status lifecycle, file template, index, and anti-patterns. All 5 PRD skills reference it and must remain consistent with it.

## Key anti-patterns enforced by the skills

- **PRD-as-Spec** — implementation details smuggled into PRD body (`/prd-finalize` rejects)
- **Vague Personas** — "users", "everyone", "the team" rejected
- **Vibe Goals** — goals without measurable Success Metrics rejected
- **Missing Non-Goals** — empty `## Non-Goals` section is a hard fail
- **Amendment Avoidance** — rewriting approved PRDs instead of using `/prd-update`
- **Phantom Linkage** — only `/prd-extract-decisions` and `/task-add --prd` populate the linkage tables

## When to skip the PRD layer

For small/internal work, jump directly to `/task-add` (or `/adr-create` if architecturally significant). The PRD README's "When NOT to Write a PRD" table defines the threshold: bug fixes, refactors, one-line config changes, decisions purely about *how*.

## References

- `.docs/prd/README.md` — authoritative format spec
- `.docs/adr/README.md` — sibling decision-record spec
- `CLAUDE.md` Custom Commands table — full command catalog
