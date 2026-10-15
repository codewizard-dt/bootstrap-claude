# Decision Conventions (wiki/work/decisions/)

The project's Architecture Decision Log lives in `wiki/work/decisions/`. See `wiki/work/decisions/lifecycle.md` for the canonical schema.

## Non-obvious model choices

### Decision Group (file) vs Decision (block)
- A decision **file** (`ADR-NNNN-slug.md`; legacy `DEC-NNNN-slug.md`) is a *Decision Group* — a container for one or more related decisions sharing context.
- A **decision** is the unit of identity, addressed as `ADR-NNNN#DM` (legacy `DEC-NNNN#DM`).
- The file has **no aggregate status**. Each decision tracks its own status in its block.
- A file may simultaneously hold an `accepted` D1, a `proposed` D2, and a `superseded` D3.
- The group stays listed in `wiki/work/decisions/index.md` while at least one block is `proposed`.

### Stable decision IDs
- Once a block is `D2`, it stays `D2` forever.
- Never renumber siblings.

### Per-decision supersession (atomic two-block edit)
- Supersession operates per decision block, not per file.
- When `ADR-N#DX` supersedes `ADR-M#DY` (legacy `DEC-` forms are still read): update new block's `Supersedes:`, old block's `Status` → `superseded by ADR-N#DX`, decision index, log.
- Sibling blocks are byte-for-byte unchanged.

### Definition of Done (E-C-A-D-R)
Applies per decision: Evidence · Criteria & alternatives · Agreement · Documentation · Realization plan.

## Formatting invariants
- Tables not bullets for comparisons.
- Mermaid for flows/sequences.
- Decision blocks use H2 (`## DM. <title>`) with H3 sub-sections.
- Horizontal rule (`---`) separates decisions.

## Naming
Decisions live in `wiki/work/decisions/` (directory name kept; the old `.docs/adr/` location is gone). `ADR-` is the prefix for all new items (`ADR-NNNN#DM`); `DEC-` is legacy — existing `DEC-` items (today `DEC-0001`) keep their IDs until the `bootstrap update` migration renames them (old ID kept in `aliases:`). There is one number sequence across both prefixes (`adr-create` allocates `max(N)+1` over both), and `lib/skills/_shared/ID-RESOLUTION.md` resolves both prefixes by number. Typed link: `implements::[[ADR-NNNN#DM]]` (legacy `DEC-` targets still resolve; not `**Implements**: ADR-...`).

## Gotcha: adr-create Step 6.2 references a lifecycle.md Index section that doesn't exist
`lib/skills/adr-create/SKILL.md` Step 6.2 instructs adding a row per decision to an "Index" table inside `wiki/work/decisions/lifecycle.md`. Neither the local `wiki/work/decisions/lifecycle.md` nor its template source (`lib/scripts/templates/wiki/work/decisions/lifecycle.md`) has any such section — the file only has "Frontmatter / per-decision schema" and "Status transitions". Do **not** add one: `lifecycle.md` files are template-owned infrastructure (`wiki/conventions.md` §"Template-owned infrastructure") — editing the local copy would be silently overwritten by the next `sync-wiki-scaffold.sh`/`bootstrap update` run, and it's not this decision's job to redesign the template. Active-item tracking already lives correctly in `wiki/work/decisions/index.md` (Step 6.1) — that's sufficient. First hit when drafting `DEC-0001` (2026-09-13); flag to the user as an `adr-create` skill inconsistency rather than silently working around it or silently skipping it.
