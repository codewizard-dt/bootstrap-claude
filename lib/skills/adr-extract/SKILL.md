---
name: adr-extract
description: Extract Architecturally Significant Requirements from a PRD (or any document), cross-check existing ADRs, and propose Decision Group candidates for /adr-create
category: planning
model: claude-opus-5
effort: high
argument-hint: <PRD ID / NNNN-slug / NNNN / path, or path to any document>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.


# ADR Candidates from a Source Document

Bridge a **PRD (must be `approved`) or any other document** into the architectural decision pipeline. This skill walks the source, extracts **Architecturally Significant Requirements (ASRs)**, cross-checks them against the existing ADR log, and groups remaining ASRs into Decision Group candidates. In **PRD mode** it writes both sides of the bidirectional cross-link: placeholder rows in the PRD's `## Linked Decisions` table and `Source PRD:` back-links on any existing ADR that already covers an ASR. In **document mode** it is read-only apart from the log entry.

This skill **never** invokes `/adr-create` itself. It surfaces the commands the user runs next, one per confirmed Decision Group. The user remains in control of which decisions to write, when, and with what scope.

**Check `wiki/work/decisions/lifecycle.md` AND `wiki/work/decisions/` first.** The lifecycle defines the decision format; recent decision files show the wikilink format and the ASR taxonomy. In PRD mode, the PRD's `## Linked Decisions` table is the other side of the linkage.

---

**Target**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the source

Pick the mode from the argument **before any lookup**:

| Argument | Mode | Resolution |
|----------|------|------------|
| Empty, an ID (`PRD-NNNN`, legacy `REQ-NNNN`), `NNNN-slug`, or a bare number | **PRD mode** | Resolve via ID-RESOLUTION (below) |
| A path under `wiki/work/requirements/` | **PRD mode** | Resolve via ID-RESOLUTION (below) |
| A path (contains `/` or ends `.md`) **not** under `wiki/work/requirements/` | **Document mode** | Confirm the file exists with `find_file`; skip ID-RESOLUTION and the status gate |

**PRD mode:** Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: requirements · scope: active · ambiguous: interactive · empty: list every requirement in `wiki/work/requirements/` whose `status` is `approved`, one row per file, and ask the user via `AskUserQuestion` to pick one

**Document mode:** if the file does not exist, **stop** with `File not found: <path>` — never create it.

If the file cannot be located, **stop** and report — do not invent or create.

### Step 2: Verify the source is eligible

**Document mode** has no status gate — continue to Step 3.

**PRD mode:** read the PRD's frontmatter `status` field. Refuse to continue with explicit guidance for any non-approved status:

| Current Status | Action |
|----------------|--------|
| `approved` | Continue to Step 3 |
| `draft` | Stop. Tell the user: "This PRD is still in draft. Run `/prd-finalize <path>` first, then re-run `/adr-extract`." |
| `retired` | Stop. Tell the user: "This PRD is retired. If a new architectural decision is needed, write a new PRD via `/prd-create`." |
| `superseded` | Stop. Tell the user: "This PRD has been superseded. Run `/adr-extract` against the successor PRD instead." |

### Step 3: Read the source and extract ASR candidates

Walk the source section by section and identify statements that imply architectural decisions. Use the ASR taxonomy — anything that affects structure, NFRs, dependencies, interfaces, construction techniques, or hard-to-reverse choices.

Scan with this map. For a non-PRD document, scan every heading section with the same taxonomy; the Source Section column carries the document's own section title.

| Source Section | What to scan for | Likely decision category |
|----------------|------------------|--------------------------|
| Problem Statement | Mentions of scale, latency, integration boundaries, multi-tenancy | Structure, NFRs |
| Goals + Success Metrics | Quantitative thresholds (p95 latency, throughput, availability, error budget) | NFRs |
| User Stories acceptance criteria | Cross-system integrations, real-time requirements, transactional boundaries | Interfaces, NFRs |
| Constraints | Regulatory, compliance, vendor-mandated, contractual | Dependencies, security |
| Assumptions | Existing-system dependencies the source relies on | Dependencies |
| Non-Goals | What is NOT being built — informs scope of decisions, prevents over-broad decisions | Scope-bounding |

Build a candidate-ASR table. Every row must trace to a specific source location — quote or paraphrase verbatim, never invent:

| ASR# | ASR Statement (from source) | Source Section | Likely Decision Area | Likely Category |
|------|-----------------------------|----------------|----------------------|-----------------|
| A1 | "p95 search latency < 200ms with 10k active users" | SM-2 | search-infrastructure | NFR / Structure |
| A2 | "Must comply with SOC 2 access controls" | Constraint 1 | auth-and-access | Dependencies / Security |
| A3 | "Onboarding flow integrates with HRIS providers" | US-3 AC#2 | hris-integration | Interfaces |

**Boundary enforcement:** If an ASR statement smuggles a solution ("use Redis", "switch to GraphQL"), reformulate it as the underlying outcome ("session lookups must be < 5ms p99", "client schemas must evolve without redeploys") before adding it to the table.

If a candidate is borderline, exclude it and note the exclusion.

### Step 4: Cross-check existing decisions

For each candidate ASR, check whether an existing `accepted` decision already covers it.

**Procedure:**

1. `mcp__serena__list_dir` on `wiki/work/decisions/` to enumerate decision files (fully-decided groups stay in this directory, listed under `## Closed` in the index; include a legacy holding subfolder if one exists)
2. `Read` each decision file and walk every `## D*` block; collect blocks where `status: accepted` (or recently `proposed`) — select by block status, never by directory or index section
3. For each candidate ASR, score each decision block using Tier-1 tag-overlap signal:

   | Tier | Signal | Detection |
   |------|--------|-----------|
   | 1 | Tag overlap on the decision block | ≥ 1 shared tag with the ASR's likely decision area |
   | 2 | Decision sub-title noun-phrase overlap | Substantial overlap |
   | 3 | File-slug stem overlap | Only when the decision is a single-decision file |

4. Build the existing-coverage table:

   | ASR# | Existing Decision Coverage | Coverage Status | Action |
   |------|---------------------------|-----------------|--------|
   | A1 | none | — | propose new decision |
   | A2 | [[ADR-0003-auth-and-access\|ADR-0003#D2]] (tags: auth, soc2) | accepted | reuse — no new decision; add Source PRD back-link (PRD mode) |
   | A3 | [[ADR-0005-integrations\|ADR-0005#D1]] (tags: hris) | proposed | propose new decision if A3's scope is broader |

A `proposed` candidate is **not** a substitute for new coverage — flag it for the user.

### Step 5: Group ASRs into Decision Group candidates

Group ASRs **not already covered** by accepted decisions.

Group when shared context, deciders, or tight coupling argues for one file. Split when decision areas, audiences, or timelines diverge. Default to splitting when in doubt.

Output the proposed grouping table:

| Group | ASRs | Suggested Decision Slug | Rationale (group/split signal) |
|-------|------|-----------------------|--------------------------------|
| G1 | A1 | search-infrastructure | Single decision area, single decider set |
| G2 | A3 | hris-integration | Distinct decision area; different reviewers from G1 |

### Step 6: Present and confirm via `AskUserQuestion`

Show the user three tables in this order:

1. The full ASR table from Step 3 (with the existing-coverage column folded in from Step 4)
2. The proposed grouping from Step 5
3. A per-group action prompt

For **each proposed group**, ask: "Create this as a decision now?" with options:

| Option | Meaning |
|--------|---------|
| `yes` | Confirm the group; in PRD mode the skill will write a placeholder row in the PRD and the user will run `/adr-create` next |
| `defer` | Keep the ASRs in the PRD's `## Linked Decisions` table as `not yet created` (document mode: list them in the report) |
| `merge into <Gx>` | Combine this group with another listed group |
| `split` | Break this group into multiple smaller groups |
| `skip — already covered` | Drop the group; the ASR is handled by an existing decision |
| `skip — non-architectural` | Drop the group; handle directly via `/task-create` (`--req PRD-NNNN` when the source is a PRD) |

### Step 7: Update the PRD's Linked-Decisions section (PRD mode only)

**Document mode** skips this step: there is no PRD to hold the table. Print the same table in the Step 9 report instead, and append only the log entry below.

**PRD mode:** use `Read` then `Edit` to populate the PRD's `## Linked Decisions` table. The edit is **surgical** — replace only the placeholder row inside that section.

For each row in the confirmed plan, use **wikilink format** for existing decisions:

| ASR | Decision | Status |
|-----|----------|--------|
| A1: <verbatim statement> | _to be created via `/adr-create group: search-infrastructure`_ | not yet created |
| A2: <verbatim statement> | `[[ADR-0003-auth-and-access\|ADR-0003#D2]]` | accepted |
| A3: <verbatim statement> | _to be created via `/adr-create hris-integration`_ | not yet created |

Rules for the row content:

| Column | Rule |
|--------|------|
| `ASR` | The ASR ID and verbatim (or near-verbatim) statement from Step 3 |
| `Decision` | If covered by existing decision: wikilink `[[ADR-NNNN-slug\|ADR-NNNN#DM]]` (a not-yet-migrated file keeps its legacy `DEC-NNNN` form). If creating new: italicized placeholder with the exact `/adr-create` command |
| `Status` | `accepted` / `proposed` / `not yet created` |

Also update the PRD's frontmatter `updated` to today's date. Both edits use `Read` + `Edit`.

Append to `wiki/log.md` (re-read it immediately before editing) — both modes:

```
## [YYYY-MM-DD] adr-extract | <PRD-NNNN or document path> <title> — N ASRs identified
```

### Step 8: Update existing ADRs that reuse source ASRs (PRD mode only)

**Document mode** skips this step.

For each ASR marked as "covered by existing decision" in Step 4 and confirmed by the user in Step 6, edit the referenced decision's `### Links` section to add a `Source PRD:` line.

For each affected decision file:

1. `Read` the file
2. Locate the target decision's `### Links` section
3. Check whether a `Source PRD:` line **or a legacy `Source REQ:` line** for the same item (matched by its current ID or an alias) already exists — **skip if present** (idempotent)
4. `Edit` to append: `- Source PRD: [PRD-NNNN](../requirements/PRD-NNNN-slug.md)`

Touch only the target decision's `### Links`. Do not modify any decision's status, metadata, or content beyond the `### Links` append.

### Step 9: Report and instruct

Print a tabular completion report:

| Field | Value |
|-------|-------|
| Source | `PRD-NNNN <title>` or the document path |
| Source mode | `PRD` / `document` |
| ASRs identified | count |
| ASRs covered by existing decisions | count (linked back in PRD mode) |
| New decision groups proposed | count |
| New decision groups confirmed by user | count |
| ASRs deferred | count |
| ASRs skipped as non-architectural | count |
| PRD Linked-Decisions table updated | yes (PRD mode) / n/a (document mode) |
| Existing decision back-links added | count (PRD mode) / n/a (document mode) |
| Log entry | appended to wiki/log.md |

Then list the **next-action commands**, one per confirmed new group. In document mode, suffix each `(from <document path>)`:

```
To create the proposed decisions, run each:
  /adr-create group: search-infrastructure (from PRD-NNNN)
  /adr-create hris-integration (from PRD-NNNN)

After each /adr-create completes, return to PRD-NNNN's `## Linked Decisions` table
and update the placeholder row with the actual wikilink [[ADR-NNNN-slug|ADR-NNNN#DM]].
```

(The return-to-the-table note applies in PRD mode only.)

If any ASRs were skipped as non-architectural, also surface. In PRD mode:

```
The following ASRs are best handled directly as tasks (no decision needed):
  /task-create --req PRD-NNNN "<short description for ASR Ax>"
```

In document mode, list those ASRs in a plain list without a `--req` form.

The skill does **not** auto-invoke `/adr-create` or `/task-create`. It surfaces the commands; the user runs them.

---

## Output Formatting Rules (mandatory)

1. **Tables, not bullets.** ASR identification, existing-coverage analysis, and grouping proposals are all tables.
2. **Never auto-invoke `/adr-create` or `/task-create`.** Surface the exact commands; the user runs them.
3. **Never invent ASRs.** Every entry in the ASR table must trace to a specific source section, quoted or paraphrased verbatim.
4. **Boundary rule is enforced strictly.** Sources ask for outcomes, decisions admit trade-offs. If a candidate ASR sounds like a solution, reformulate it as the underlying outcome.
5. **PRD edits are surgical.** Use `Read` then `Edit` to update only the `## Linked Decisions` table and the `updated` field. Never rewrite the file.
6. **Idempotent back-links.** If a `Source PRD:` line (or a legacy `Source REQ:` line) for the same item already exists in a decision's `### Links`, skip the edit. Re-running this skill against the same PRD must not duplicate links.
7. **Wikilinks for existing decisions.** Use `[[ADR-NNNN-slug\|ADR-NNNN#DM]]` format in the `## Linked Decisions` table.

---

## CRITICAL Rules

1. **Refuse to run on a PRD not in `approved` status.** Step 2 is a hard gate (document mode has no status gate).
2. **Never invent ASRs.** Every candidate is grounded in a specific source section.
3. **Never auto-create decisions.** Surface them as commands the user runs.
4. **Cross-check existing decisions before proposing duplicates.** Step 4 is mandatory.
5. **Bidirectional linkage is the contract in PRD mode.** The PRD's `## Linked Decisions` and any existing decision's `### Links` must both reflect the relationship. Re-running is idempotent. Document mode is read-only apart from the log entry.
6. **Per-decision tag overlap is the existing-coverage signal.**
7. **Maximum 3 sub-processes at a time** if delegating research or coverage analysis.
8. **Always terminate processes when done.**
9. Edit only — see `~/.claude/skills/_shared/SKILL-BOILERPLATE.md` § Edit hygiene.
