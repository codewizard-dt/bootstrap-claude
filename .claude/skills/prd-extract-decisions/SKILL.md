---
name: prd-extract-decisions
description: Extract Architecturally Significant Requirements from an approved PRD, cross-check existing ADRs, and propose Decision Group candidates for /adr-create
model: claude-sonnet-4-6
effort: high
argument-hint: <path/to/prd.md, NNN-slug, or NNN>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


# PRD to Decisions

Bridge an **approved** PRD into the architectural decision pipeline. This skill walks the PRD, extracts **Architecturally Significant Requirements (ASRs)**, cross-checks them against the existing ADL, groups remaining ASRs into Decision Group candidates, and writes both sides of the bidirectional cross-link: placeholder rows in the PRD's `## Linked ADRs` table and `Source PRD:` back-links on any existing ADR that already covers an ASR.

This skill **never** invokes `/adr-create` itself. It surfaces the commands the user runs next, one per confirmed Decision Group — the same pattern `/adr-finalize` uses to suggest `/task-add`. The user remains in control of which ADRs to write, when, and with what scope.

**Read `.docs/prd/README.md` AND `.docs/adr/README.md` first.** The PRD README defines the boundary rule (PRDs ask for outcomes, ADRs admit trade-offs) and the `## Linked ADRs` table format. The ADR README defines what an ASR is, when an ADR is warranted, the Decision Group concept, the Tags/Decision-Area model, and the Tier-1 tag-overlap signal this skill uses to detect existing coverage.

---

**Target**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the PRD file

Parse `$ARGUMENTS` to identify the PRD:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `.docs/prd/003-onboarding.md`) | Use as-is; verify the file exists |
| `<NNN-slug>` (e.g. `003-onboarding`) | `mcp__serena__find_file` with mask `003-onboarding.md` under `.docs/prd/` |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits; `mcp__serena__find_file` with mask `NNN-*.md` under `.docs/prd/` |
| Empty / missing | List every PRD in `.docs/prd/` whose `Status` is `approved`, one row per PRD, and ask the user via `AskUserQuestion` to pick one |

Search **only** `.docs/prd/` (top-level live files). PRDs in `archived/`, `superseded/`, or `trashed/` do not produce new decisions — refuse to run on them in Step 2.

If the file cannot be located, **stop** and report — do not invent or create.

### Step 2: Verify status is `approved`

Read the PRD's front-matter `Status` line. Refuse to continue with explicit guidance for any non-approved status:

| Current Status | Action |
|----------------|--------|
| `approved` | Continue to Step 3 |
| `draft` | Stop. Tell the user: "This PRD is still in draft. Run `/prd-finalize <path>` first to flip it to `approved`, then re-run `/prd-extract-decisions`." |
| `archived` | Stop. Tell the user: "This PRD is closed and the work landed. If a new architectural decision is needed, write a new PRD via `/prd-create`." |
| `superseded` | Stop. Tell the user: "This PRD has been superseded. Run `/prd-extract-decisions` against the successor PRD instead." |
| `trashed` | Stop. Tell the user: "This PRD was cancelled. No decisions should be derived from it." |

### Step 3: Read the PRD and extract ASR candidates

Walk the PRD section by section and identify statements that imply architectural decisions. Use the ASR taxonomy from `.docs/adr/README.md` — anything that affects structure, NFRs, dependencies, interfaces, construction techniques, or hard-to-reverse choices.

Scan with this map:

| Source Section in PRD | What to scan for | Likely ADR category |
|-----------------------|------------------|---------------------|
| Problem Statement | Mentions of scale, latency, integration boundaries, multi-tenancy | Structure, NFRs |
| Goals + Success Metrics | Quantitative thresholds (p95 latency, throughput, availability, error budget) | NFRs |
| User Stories acceptance criteria | Cross-system integrations, real-time requirements, transactional boundaries | Interfaces, NFRs |
| Constraints | Regulatory, compliance, vendor-mandated, contractual | Dependencies, security |
| Assumptions | Existing-system dependencies the PRD relies on | Dependencies |
| Non-Goals | What is NOT being built — informs scope of decisions, prevents over-broad ADRs | Scope-bounding |

Build a candidate-ASR table. Every row must trace to a specific PRD location — quote or paraphrase verbatim, never invent:

| ASR# | ASR Statement (from PRD) | Source Section | Likely Decision Area | Likely ADR Category |
|------|--------------------------|----------------|----------------------|---------------------|
| A1 | "p95 search latency < 200ms with 10k active users" | SM-2 | search-infrastructure | NFR / Structure |
| A2 | "Must comply with SOC 2 access controls" | Constraint 1 | auth-and-access | Dependencies / Security |
| A3 | "Onboarding flow integrates with HRIS providers" | US-3 AC#2 | hris-integration | Interfaces |

**Boundary enforcement:** If an ASR statement smuggles a solution ("use Redis", "switch to GraphQL"), reformulate it as the underlying outcome ("session lookups must be < 5ms p99", "client schemas must evolve without redeploys") before adding it to the table. The PRD asks for outcomes; the ADR will admit the trade-offs.

If a candidate is borderline (e.g. a UI tweak with no real architectural impact), exclude it and note the exclusion — better to surface fewer real ASRs than dilute the table.

### Step 4: Cross-check existing ADRs

For each candidate ASR, check whether an existing `accepted` decision already covers it. This prevents proposing duplicate decisions and ensures bidirectional linkage to prior work.

**Procedure:**

1. `mcp__serena__list_dir` on `.docs/adr/` (and any subdirectories) to enumerate ADR files
2. `Read` each ADR file and walk every `## D*` block; collect blocks where `Status: accepted` (or recently `proposed`, noted separately)
3. For each candidate ASR, score each ADR decision block using the same Tier-1 tag-overlap signal `/adr-create` and `/adr-finalize` use:

   | Tier | Signal | Detection |
   |------|--------|-----------|
   | 1 | Tag overlap on the decision block | ≥ 1 shared tag with the ASR's likely decision area |
   | 2 | Decision sub-title noun-phrase overlap | Substantial overlap |
   | 3 | File-slug stem overlap | Only when the ADR is a single-decision file |

4. Build the existing-coverage table:

   | ASR# | Existing ADR Coverage | Coverage Status | Action |
   |------|----------------------|-----------------|--------|
   | A1 | none | — | propose new ADR |
   | A2 | ADR-0003#D2 (tags: auth, soc2) | accepted | reuse — no new ADR; add Source PRD back-link |
   | A3 | ADR-0005#D1 (tags: hris) | proposed | propose new ADR if A3's scope is broader; otherwise extend the proposed decision via the user's next `/adr-create` invocation |

A `proposed` candidate is **not** a substitute for new coverage — flag it for the user, but do not assume it will be accepted as-is. The user decides in Step 6 whether to widen the proposed decision or write a separate one.

### Step 5: Group ASRs into Decision Group candidates

Apply the "When to Group vs Split" table from `.docs/adr/README.md` to the ASRs **not already covered** by accepted ADRs. ASRs covered in Step 4 are excluded from new groups.

Group when shared context, deciders, or tight coupling argues for one file. Split when decision areas, audiences, or timelines diverge. Default to splitting when in doubt — merging two related ADRs later is cheaper than untangling a fat one.

Output the proposed grouping table:

| Group | ASRs | Suggested ADR Slug | Rationale (group/split signal) |
|-------|------|--------------------|--------------------------------|
| G1 | A1 | search-infrastructure | Single decision area, single decider set |
| G2 | A3 | hris-integration | Distinct decision area; different reviewers from G1 |

If a single ASR justifies its own ADR, write it as a one-ASR group — that is the common case, not an edge case.

### Step 6: Present and confirm via `AskUserQuestion`

Show the user three tables in this order:

1. The full ASR table from Step 3 (with the existing-coverage column folded in from Step 4)
2. The proposed grouping from Step 5
3. A per-group action prompt

For **each proposed group**, ask: "Create this as an ADR now?" with options:

| Option | Meaning |
|--------|---------|
| `yes` | Confirm the group; the skill will write a placeholder row in the PRD and the user will run `/adr-create` next |
| `defer` | Keep the ASRs in the PRD's `## Linked ADRs` table as `not yet created`; user will write the ADR later |
| `merge into <Gx>` | Combine this group with another listed group |
| `split` | Break this group into multiple smaller groups (user specifies) |
| `skip — already covered` | Drop the group; the ASR is handled by an existing ADR (Step 4 coverage) |
| `skip — non-architectural` | Drop the group; the requirement is shallow enough to handle directly via `/task-add --prd PRD-NNN` |

Allow the user to override grouping in either direction. The user's confirmed plan — the final list of (group, ASRs, status: create-now / defer / skip) — is the contract for Steps 7–8.

### Step 7: Update the PRD's `## Linked ADRs` section

Use `Read` then `Edit` to populate the PRD's `## Linked ADRs` table. The edit is **surgical** — replace only the placeholder row inside that section, never rewrite the file.

For each row in the confirmed plan:

| ASR | ADR | Status |
|-----|-----|--------|
| A1: <verbatim statement> | _to be created via `/adr-create group: search-infrastructure`_ | not yet created |
| A2: <verbatim statement> | [ADR-0003#D2](../../adr/0003-auth-and-access.md#d2-...) | accepted |
| A3: <verbatim statement> | _to be created via `/adr-create hris-integration`_ | not yet created |

Rules for the row content:

| Column | Rule |
|--------|------|
| `ASR` | The ASR ID and verbatim (or near-verbatim) statement from Step 3 |
| `ADR` | If covered by existing ADR: anchor link to the decision block. If creating new: italicized placeholder with the exact `/adr-create` command the user will run |
| `Status` | `accepted` / `proposed` / `not yet created` — matches the underlying ADR's current state, or `not yet created` for placeholders |

Also update the PRD's front-matter `Last updated` to today's date. Both edits use `Read` + `Edit` — never `sed`, `echo >>`, or `cat <<EOF`.

### Step 8: Update existing ADRs that reuse PRD ASRs

For each ASR marked as "covered by existing ADR" in Step 4 and confirmed by the user in Step 6, edit the referenced ADR's `### Links` section to add a `Source PRD:` line.

For each affected ADR file:

1. `Read` the file
2. Locate the target decision's `### Links` section
3. Check whether `Source PRD: PRD-NNN` already exists in that block — **skip if present** (idempotent)
4. `Edit` to append a new line: `- Source PRD: [PRD-NNN](../prd/NNN-slug.md)`

Touch only the target decision's `### Links`. Sibling decisions in the same ADR file are out of scope. Do not modify any decision's status, metadata, or content beyond the `### Links` append.

### Step 9: Report and instruct

Print a tabular completion report:

| Field | Value |
|-------|-------|
| PRD | `PRD-NNN <title>` |
| ASRs identified | count |
| ASRs covered by existing ADRs | count (linked back) |
| New ADR groups proposed | count |
| New ADR groups confirmed by user | count |
| ASRs deferred | count |
| ASRs skipped as non-architectural | count |
| PRD `## Linked ADRs` updated | yes |
| Existing ADR back-links added | count |

Then list the **next-action commands**, one per confirmed new group:

```
To create the proposed ADRs, run each:
  /adr-create group: search-infrastructure (from PRD-NNN)
  /adr-create hris-integration (from PRD-NNN)

After each /adr-create completes, return to PRD-NNN's `## Linked ADRs` table
and update the placeholder row with the actual `ADR-NNNN#DM` reference.
```

If any ASRs were skipped as non-architectural, also surface:

```
The following ASRs are best handled directly as tasks (no ADR needed):
  /task-add --prd PRD-NNN "<short description for ASR Ax>"
```

The skill does **not** auto-invoke `/adr-create` or `/task-add`. It surfaces the commands; the user runs them.

---

## Output Formatting Rules (mandatory — these override any default style)

1. **Tables, not bullets.** ASR identification, existing-coverage analysis, and grouping proposals are all tables. If you find yourself writing `- A1: ...` / `- A2: ...`, stop and convert to a row in the ASR table.
2. **Never auto-invoke `/adr-create` or `/task-add`.** Surface the exact commands; the user runs them. Same pattern as `/adr-finalize` Step 7.
3. **Never invent ASRs.** Every entry in the ASR table must trace to a specific PRD section, quoted or paraphrased verbatim. If a section yields nothing, leave it out — do not pad.
4. **Boundary rule is enforced strictly.** PRDs ask for outcomes, ADRs admit trade-offs. If a candidate ASR sounds like a solution ("use Redis", "switch to gRPC"), reformulate it as the underlying outcome before adding it to the table.
5. **PRD edits are surgical.** Use `Read` then `Edit` to update only the `## Linked ADRs` table and the `Last updated` line. Never rewrite the file. Same for ADR back-link edits — only the `### Links` section of the target decision.
6. **Idempotent back-links.** If `Source PRD: PRD-NNN` already exists in an ADR's `### Links`, skip the edit. Re-running this skill against the same PRD must not duplicate links.

---

## CRITICAL Rules

1. **Refuse to run on PRDs not in `approved` status.** Step 2 is a hard gate — `draft`, `archived`, `superseded`, `trashed` all stop with explicit guidance.
2. **Never invent ASRs.** Every candidate is grounded in a specific PRD section with a quoted or paraphrased statement.
3. **Never auto-create ADRs.** Surface them as commands the user runs. The skill is a bridge, not a generator.
4. **Cross-check existing ADRs before proposing duplicates.** Step 4 is mandatory — propose a new ADR only when no `accepted` decision in the same decision area already covers the ASR.
5. **Bidirectional linkage is the contract.** The PRD's `## Linked ADRs` and any existing ADR's `### Links` must both reflect the relationship. Re-running the skill is idempotent.
6. **Per-decision tag overlap is the existing-coverage signal.** Match the same Tier-1 logic `/adr-create` and `/adr-finalize` use. Do not invent a different heuristic.
7. **Maximum 3 sub-processes at a time** if delegating research or coverage analysis.
8. **Always terminate processes when done** (any spawned readers, search helpers).
9. **Never use `sed`/`echo >>`/`cat <<EOF`** — always `Read` + `Edit`.
