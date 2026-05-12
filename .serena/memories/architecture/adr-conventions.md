# ADR Conventions (this project)

The project's Architecture Decision Log lives in `.docs/adr/`. The data model deviates from vanilla MADR/Nygard in important, non-obvious ways. Always read `.docs/adr/README.md` before working on ADR-related commands or files — it is the canonical spec.

## Non-obvious model choices

### Decision Group (file) vs Decision (block)
- An ADR **file** is a *Decision Group* — a container for **one or more** related decisions sharing context.
- A **decision** is the unit of identity, not the file. Decisions are addressed as `ADR-NNNN#DM` where `NNNN` is the file number and `DM` is the intra-file sequence (`D1`, `D2`, …).
- The file has **no aggregate status**. Each decision tracks its own `Status`, `Date`, `Deciders`, `Tags`, `Supersedes`.
- A file may simultaneously hold an `accepted` D1, a `proposed` D2, and a `superseded` D3.

### Stable decision IDs
- Once a block is `D2`, it stays `D2` forever — even if `D1` is later marked `deprecated`.
- Never renumber siblings. Anchor links (`#dM-title`) depend on stable IDs.

### Per-decision supersession (atomic two-block edit)
- Supersession operates **per decision**, never per file. The unit is the decision block.
- When `ADR-N#DX` supersedes `ADR-M#DY`, **four sites** must change atomically:
  1. New block's metadata: `Supersedes: ADR-M#DY`
  2. New block's `### Links` section
  3. Old block's `Status` → `superseded by ADR-N#DX` plus a callout under that block's H2 (NOT under the file's H1)
  4. Index (two rows updated) and relationship graph (new node + edge + class flip)
- The superseded block's **siblings are byte-for-byte unchanged**. Sibling-cascade edits are an anti-pattern.

### Decision Area detection (for supersession check)
Order of signals used by `/adr-finalize` Step 2.5:
1. Tag overlap on the decision blocks (≥ 1 shared tag) — strongest
2. Decision sub-title noun-phrase overlap
3. File-slug stem overlap (only when both are sole `D1` of single-decision files)
4. Explicit `Supersedes:` already set in the metadata — authoritative
5. User confirmation when ambiguous

`Tags` is **mandatory and non-empty** on every decision block — this is what makes future supersession detection work.

### Definition of Done (E-C-A-D-R) — applied per decision
A single decision can flip `proposed → accepted` only when all five pass:
- **E**vidence (real research cited in `### Context`)
- **C**riteria & alternatives (≥ 2 viable options + non-empty drivers)
- **A**greement (deciders ratified, chosen option bolded in `### Decision Outcome`)
- **D**ocumentation (no placeholders/TBDs/asymmetric tables/bullet comparisons)
- **R**ealization & review plan (`### Validation` has measurable signal + threshold + timeframe)

## Formatting invariants (hard rules)
- **Tables not bullets** for every comparison — applies to both authored ADRs and command output.
- **Mermaid for any flow/sequence/before-after** decision; only purely static choices may skip.
- **Present tense, full sentences** ("We will use Redis as the session cache").
- **Decision blocks use H2** (`## DM. <title>`) with H3 sub-sections (`### Context`, `### Decision Outcome`, etc.). Horizontal rule (`---`) separates decisions.
- **Shared Context** is a file-level section above D1 — encouraged to avoid restating context in each block.

## Chain invariant
**At most one `accepted` decision per decision area** across the entire log. `/finalize-adr` enforces this; if it cannot resolve which decision supersedes which, it leaves status as `proposed` and reports rather than creating parallel `accepted` decisions.

## Companion review skill: `/adr-walkthrough`

A lighter, non-finalizing review pass for ADR files. Walks every `D*` block one at a time; for each `proposed` decision asks the user via `AskUserQuestion` to **Confirm / Change / Defer / Skip**. Sibling blocks are untouched, status is never flipped (that stays with `/adr-finalize`), and supersession + index + relationship-graph work is explicitly out of scope. Useful when an ADR file has multiple proposed decisions and the user wants to align on the choices in one pass before sending each through the E-C-A-D-R gate.

## Why this matters for command authors
- `/adr-create` writes a file with N decision blocks; each block needs full metadata.
- `/adr-finalize` argument is `<file>#<DM>` (e.g. `0007-session#D2`) and operates on **one block at a time**. Bare-path inputs auto-resolve only if the file has exactly one proposed decision.
- The ADR `.docs/adr/.gitkeep` propagates via `sync-docs-scaffold.sh`; ADR files themselves are project-specific and never copied by the template scripts.
- The README in `.docs/adr/` is the canonical spec. CLAUDE.md and `project/overview` memory point at it; do not duplicate the spec in those files.
