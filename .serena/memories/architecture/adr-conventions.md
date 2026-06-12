# Decision Conventions (wiki/work/decisions/)

The project's Architecture Decision Log lives in `wiki/work/decisions/`. See `wiki/work/decisions/lifecycle.md` for the canonical schema.

## Non-obvious model choices

### Decision Group (file) vs Decision (block)
- A decision **file** (`DEC-NNNN-slug.md`) is a *Decision Group* — a container for one or more related decisions sharing context.
- A **decision** is the unit of identity, addressed as `DEC-NNNN#DM`.
- The file has **no aggregate status**. Each decision tracks its own status in its block.
- A file may simultaneously hold an `accepted` D1, a `proposed` D2, and a `superseded` D3.
- The group stays listed in `wiki/work/decisions/index.md` while at least one block is `proposed`.

### Stable decision IDs
- Once a block is `D2`, it stays `D2` forever.
- Never renumber siblings.

### Per-decision supersession (atomic two-block edit)
- Supersession operates per decision block, not per file.
- When `DEC-N#DX` supersedes `DEC-M#DY`: update new block's `Supersedes:`, old block's `Status` → `superseded by DEC-N#DX`, decision index, log.
- Sibling blocks are byte-for-byte unchanged.

### Definition of Done (E-C-A-D-R)
Applies per decision: Evidence · Criteria & alternatives · Agreement · Documentation · Realization plan.

## Formatting invariants
- Tables not bullets for comparisons.
- Mermaid for flows/sequences.
- Decision blocks use H2 (`## DM. <title>`) with H3 sub-sections.
- Horizontal rule (`---`) separates decisions.

## Old naming
Was `ADR-NNNN#DM` and `.docs/adr/`. Now `DEC-NNNN#DM` and `wiki/work/decisions/`. Typed link: `implements::[[DEC-NNNN#DM]]` (not `**Implements**: ADR-...`).
