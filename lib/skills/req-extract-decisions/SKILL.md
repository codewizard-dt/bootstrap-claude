---
name: req-extract-decisions
description: Extract Architecturally Significant Requirements from an approved requirement, cross-check existing decisions, and propose Decision Group candidates for /decision-create
category: planning
model: claude-opus-4-8
effort: high
argument-hint: <path/to/req.md, NNN-slug, or NNN>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`; run /primer if not done this session.


# Requirement to Decisions

Bridge an **approved** requirement into the architectural decision pipeline. This skill walks the requirement, extracts **Architecturally Significant Requirements (ASRs)**, cross-checks them against the existing decision log, groups remaining ASRs into Decision Group candidates, and writes both sides of the bidirectional cross-link: placeholder rows in the requirement's `## Linked Decisions` table and `Source REQ:` back-links on any existing decision that already covers an ASR.

This skill **never** invokes `/decision-create` itself. It surfaces the commands the user runs next, one per confirmed Decision Group. The user remains in control of which decisions to write, when, and with what scope.

**Check `wiki/work/decisions/lifecycle.md` AND `wiki/work/decisions/` first.** The lifecycle defines the decision format; recent decision files show the `## Linked Decisions` table format with wikilinks and the ASR taxonomy.

---

**Target**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the requirement file

Parse `$ARGUMENTS` to identify the target:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `wiki/work/requirements/REQ-003-onboarding.md`) | Use as-is; verify the file exists |
| `<NNN-slug>` (e.g. `003-onboarding`) | `mcp__serena__find_file` with mask `003-onboarding.md` under `wiki/work/requirements/` |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits; `mcp__serena__find_file` with mask `NNN-*.md` under `wiki/work/requirements/` |
| Empty / missing | List every requirement in `wiki/work/requirements/` whose `status` is `approved`, one row per file, and ask the user via `AskUserQuestion` to pick one |

If the file cannot be located, **stop** and report — do not invent or create.

### Step 2: Verify status is `approved`

Read the requirement's frontmatter `status` field. Refuse to continue with explicit guidance for any non-approved status:

| Current Status | Action |
|----------------|--------|
| `approved` | Continue to Step 3 |
| `draft` | Stop. Tell the user: "This requirement is still in draft. Run `/req-finalize <path>` first, then re-run `/req-extract-decisions`." |
| `retired` | Stop. Tell the user: "This requirement is retired. If a new architectural decision is needed, write a new requirement via `/req-create`." |
| `superseded` | Stop. Tell the user: "This requirement has been superseded. Run `/req-extract-decisions` against the successor requirement instead." |

### Step 3: Read the requirement and extract ASR candidates

Walk the requirement section by section and identify statements that imply architectural decisions. Use the ASR taxonomy — anything that affects structure, NFRs, dependencies, interfaces, construction techniques, or hard-to-reverse choices.

Scan with this map:

| Source Section | What to scan for | Likely decision category |
|----------------|------------------|--------------------------|
| Problem Statement | Mentions of scale, latency, integration boundaries, multi-tenancy | Structure, NFRs |
| Goals + Success Metrics | Quantitative thresholds (p95 latency, throughput, availability, error budget) | NFRs |
| User Stories acceptance criteria | Cross-system integrations, real-time requirements, transactional boundaries | Interfaces, NFRs |
| Constraints | Regulatory, compliance, vendor-mandated, contractual | Dependencies, security |
| Assumptions | Existing-system dependencies the requirement relies on | Dependencies |
| Non-Goals | What is NOT being built — informs scope of decisions, prevents over-broad decisions | Scope-bounding |

Build a candidate-ASR table. Every row must trace to a specific requirement location — quote or paraphrase verbatim, never invent:

| ASR# | ASR Statement (from requirement) | Source Section | Likely Decision Area | Likely Category |
|------|----------------------------------|----------------|----------------------|-----------------|
| A1 | "p95 search latency < 200ms with 10k active users" | SM-2 | search-infrastructure | NFR / Structure |
| A2 | "Must comply with SOC 2 access controls" | Constraint 1 | auth-and-access | Dependencies / Security |
| A3 | "Onboarding flow integrates with HRIS providers" | US-3 AC#2 | hris-integration | Interfaces |

**Boundary enforcement:** If an ASR statement smuggles a solution ("use Redis", "switch to GraphQL"), reformulate it as the underlying outcome ("session lookups must be < 5ms p99", "client schemas must evolve without redeploys") before adding it to the table.

If a candidate is borderline, exclude it and note the exclusion.

### Step 4: Cross-check existing decisions

For each candidate ASR, check whether an existing `accepted` decision already covers it.

**Procedure:**

1. `mcp__serena__list_dir` on `wiki/work/decisions/` to enumerate decision files
2. `Read` each decision file and walk every `## D*` block; collect blocks where `status: accepted` (or recently `proposed`)
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
   | A2 | [[0003-auth-and-access\|DEC-0003#D2]] (tags: auth, soc2) | accepted | reuse — no new decision; add Source REQ back-link |
   | A3 | [[0005-integrations\|DEC-0005#D1]] (tags: hris) | proposed | propose new decision if A3's scope is broader |

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
| `yes` | Confirm the group; the skill will write a placeholder row in the requirement and the user will run `/decision-create` next |
| `defer` | Keep the ASRs in the requirement's `## Linked Decisions` table as `not yet created` |
| `merge into <Gx>` | Combine this group with another listed group |
| `split` | Break this group into multiple smaller groups |
| `skip — already covered` | Drop the group; the ASR is handled by an existing decision |
| `skip — non-architectural` | Drop the group; handle directly via `/task-add --req REQ-NNN` |

### Step 7: Update the requirement's `## Linked Decisions` section

Use `Read` then `Edit` to populate the requirement's `## Linked Decisions` table. The edit is **surgical** — replace only the placeholder row inside that section.

For each row in the confirmed plan, use **wikilink format** for existing decisions:

| ASR | Decision | Status |
|-----|----------|--------|
| A1: <verbatim statement> | _to be created via `/decision-create group: search-infrastructure`_ | not yet created |
| A2: <verbatim statement> | `[[0003-auth-and-access\|DEC-0003#D2]]` | accepted |
| A3: <verbatim statement> | _to be created via `/decision-create hris-integration`_ | not yet created |

Rules for the row content:

| Column | Rule |
|--------|------|
| `ASR` | The ASR ID and verbatim (or near-verbatim) statement from Step 3 |
| `Decision` | If covered by existing decision: wikilink `[[NNNN-slug\|DEC-NNNN#DM]]`. If creating new: italicized placeholder with the exact `/decision-create` command |
| `Status` | `accepted` / `proposed` / `not yet created` |

Also update the requirement's frontmatter `updated` to today's date. Both edits use `Read` + `Edit` — never `sed`, `echo >>`, or `cat <<EOF`.

Append to `wiki/log.md`:

```
## [YYYY-MM-DD] req-extract-decisions | REQ-NNN <title> — N ASRs identified
```

### Step 8: Update existing decisions that reuse requirement ASRs

For each ASR marked as "covered by existing decision" in Step 4 and confirmed by the user in Step 6, edit the referenced decision's `### Links` section to add a `Source REQ:` line.

For each affected decision file:

1. `Read` the file
2. Locate the target decision's `### Links` section
3. Check whether `Source REQ: REQ-NNN` already exists — **skip if present** (idempotent)
4. `Edit` to append: `- Source REQ: [REQ-NNN](../requirements/NNN-slug.md)`

Touch only the target decision's `### Links`. Do not modify any decision's status, metadata, or content beyond the `### Links` append.

### Step 9: Report and instruct

Print a tabular completion report:

| Field | Value |
|-------|-------|
| Requirement | `REQ-NNN <title>` |
| ASRs identified | count |
| ASRs covered by existing decisions | count (linked back) |
| New decision groups proposed | count |
| New decision groups confirmed by user | count |
| ASRs deferred | count |
| ASRs skipped as non-architectural | count |
| Requirement `## Linked Decisions` updated | yes |
| Existing decision back-links added | count |
| Log entry | appended to wiki/log.md |

Then list the **next-action commands**, one per confirmed new group:

```
To create the proposed decisions, run each:
  /decision-create group: search-infrastructure (from REQ-NNN)
  /decision-create hris-integration (from REQ-NNN)

After each /decision-create completes, return to REQ-NNN's `## Linked Decisions` table
and update the placeholder row with the actual wikilink [[NNNN-slug|DEC-NNNN#DM]].
```

If any ASRs were skipped as non-architectural, also surface:

```
The following ASRs are best handled directly as tasks (no decision needed):
  /task-add --req REQ-NNN "<short description for ASR Ax>"
```

The skill does **not** auto-invoke `/decision-create` or `/task-add`. It surfaces the commands; the user runs them.

---

## Output Formatting Rules (mandatory)

1. **Tables, not bullets.** ASR identification, existing-coverage analysis, and grouping proposals are all tables.
2. **Never auto-invoke `/decision-create` or `/task-add`.** Surface the exact commands; the user runs them.
3. **Never invent ASRs.** Every entry in the ASR table must trace to a specific requirement section, quoted or paraphrased verbatim.
4. **Boundary rule is enforced strictly.** Requirements ask for outcomes, decisions admit trade-offs. If a candidate ASR sounds like a solution, reformulate it as the underlying outcome.
5. **Requirement edits are surgical.** Use `Read` then `Edit` to update only the `## Linked Decisions` table and the `updated` field. Never rewrite the file.
6. **Idempotent back-links.** If `Source REQ: REQ-NNN` already exists in a decision's `### Links`, skip the edit. Re-running this skill against the same requirement must not duplicate links.
7. **Wikilinks for existing decisions.** Use `[[NNNN-slug\|DEC-NNNN#DM]]` format in the `## Linked Decisions` table.

---

## CRITICAL Rules

1. **Refuse to run on requirements not in `approved` status.** Step 2 is a hard gate.
2. **Never invent ASRs.** Every candidate is grounded in a specific requirement section.
3. **Never auto-create decisions.** Surface them as commands the user runs.
4. **Cross-check existing decisions before proposing duplicates.** Step 4 is mandatory.
5. **Bidirectional linkage is the contract.** The requirement's `## Linked Decisions` and any existing decision's `### Links` must both reflect the relationship. Re-running is idempotent.
6. **Per-decision tag overlap is the existing-coverage signal.**
7. **Maximum 3 sub-processes at a time** if delegating research or coverage analysis.
8. **Always terminate processes when done.**
9. **Never use `sed`/`echo >>`/`cat <<EOF`** — always `Read` + `Edit`.
