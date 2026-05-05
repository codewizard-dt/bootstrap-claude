---
name: finalize-prd
description: Run completeness audit on a draft PRD, resolve gaps via Q&A, and flip status to approved
model: claude-opus-4-7
effort: high
argument-hint: <path/to/prd.md, NNN-slug, or NNN>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


# Finalize PRD

Take a single **draft** PRD, surface every required-field gap or unresolved placeholder, resolve those gaps with the user, confirm stakeholder review, then flip the PRD's `Status` from `draft` to `approved`.

Once a PRD is approved, it is **immutable in substance**. Future scope changes go through `/update-prd`, which appends an `## Amendment N` block rather than rewriting prior content. This command is the one-way gate into that immutable state — get the audit right.

**Read `.docs/prd/README.md` first.** It defines the required-non-empty fields, the status lifecycle, the file template, and the anti-patterns this audit must catch.

---

**Target**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the PRD file

Parse `$ARGUMENTS` to identify the target PRD file:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `.docs/prd/active/003-search.md`) | Use as-is |
| `<NNN-slug>` (e.g. `003-search`) | Search `.docs/prd/active/` for `NNN-slug.md` |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits; `mcp__serena__find_file` with mask `NNN-*.md` in `.docs/prd/active/` |
| Empty / missing | List every PRD with `Status: draft` across `.docs/prd/active/` (one row per PRD with title and slug) and ask the user via `AskUserQuestion` to pick one |

If the file cannot be located, **stop** and report — do not invent or create.

### Step 2: Read the file and verify status

1. **Read** the PRD with `Read`.
2. **Locate the `Status:` metadata line** in the front matter bullets.
3. **Verify the status is `draft`**:

   | Current Status | Action |
   |----------------|--------|
   | `draft` | Continue to Step 3 |
   | `approved` | Stop. Tell the user the PRD is already approved and immutable in substance; suggest `/update-prd <file> <change>` for any amendment |
   | `archived` | Stop. The PRD is no longer authoritative; finalizing makes no sense |
   | `superseded` | Stop. A successor PRD has replaced this one — finalizing it would corrupt the chain |
   | `trashed` | Stop. The PRD was cancelled before approval |

### Step 3: Audit the PRD against the README's quality bar

Inspect the file section by section and build a gap report. Required-field gaps need user resolution (Step 4); format-correction gaps are fixed in place during Step 5 without asking.

#### Required-field audit

| Required Field | Quality Bar | Failure mode to detect |
|----------------|-------------|------------------------|
| Problem Statement | 2-4 sentences; identifies what is broken, missing, or possible | Empty, single-sentence, or solution smuggled in (e.g. "we need to add a Postgres index on `users.email`") |
| Goals (≥ 1) | Each row has an outcome-oriented goal AND a `Linked Success Metric` ID | Empty, vibes ("improve performance"), or goals without a metric link |
| Non-Goals (≥ 1) | At least one explicit out-of-scope row with a stated reason | Empty, "N/A", or row with no reason |
| Personas (≥ 1) | Named or named-role persona with context column and primary-goal column filled | "Users", "everyone", "the team" — not personas |
| User Stories (≥ 1) | Format `As <persona>, I want <capability> so that <outcome>`; each story has a non-empty Acceptance Criteria table | Stories without AC; AC written as test cases ("test: assert X = Y") |
| Success Metrics (≥ 1) | Each row has signal + threshold + timeframe (When measured) | Missing threshold ("we'll know"), missing timeframe, or vibes |
| Owner | Single accountable name or role | Empty or `<product-lead name or role>` template text |
| Tags | 1-3 short area tags, non-empty | Empty or template `<area-1>, <area-2>` |
| Open Questions | Empty, OR every row has owner + resolution date | Lingering open questions block approval |

#### Format-correction audit (fix in place; no user question needed)

| Gap Type | Detection Pattern |
|----------|-------------------|
| Bullet-list user stories or goals | `- As a user, I want...` style — convert to prose-with-tables per the template |
| Empty placeholder cells | Cells containing `…`, `...`, dashes used as placeholders, or whitespace |
| Placeholder text | `<...>`, `TBD`, `TODO`, `???`, `FIXME`, `[fill in]`, `<!-- ... -->` HTML comments |
| Stale `Last updated` | Date older than today |
| Anti-pattern: solution in problem statement | Implementation detail (framework, schema, library) appearing in the Problem Statement |

#### Build the audit report

Output to the user **before any edits** as a tabular summary — never bullets:

```
File: .docs/prd/active/003-search.md
Title: Federated search across knowledge bases
Current status: draft
Required-field gaps: N
Format-correction gaps: M
```

Followed by a gaps table:

| Priority | Section | Gap | Resolution Strategy |
|----------|---------|-----|---------------------|
| 1 | Problem Statement | Empty | Ask user (Step 4) |
| 2 | Personas | Single row reads "Users" | Ask user (Step 4) |
| 3 | Success Metrics | SM-1 missing threshold | Ask user (Step 4) |
| 4 | User Stories | Bullet list, not prose-with-table | Auto-fix (Step 5) |

### Step 4: Resolve required-field gaps via `AskUserQuestion`

Resolve in this priority order — each layer feeds the next:

| Priority | Gap | Why first |
|----------|-----|-----------|
| 1 | Problem Statement | Everything else flows from this |
| 2 | Personas | Drive user stories |
| 3 | User Stories + Acceptance Criteria | The behavior contract |
| 4 | Success Metrics (signal + threshold + timeframe) | Required for every Goal link |
| 5 | Goal-to-metric linkage | Goals are vibes without metrics |
| 6 | Non-Goals (≥ 1 with reason) | Forces scope discipline |
| 7 | Owner + Stakeholders | Accountability and review surface |
| 8 | Tags | Indexing and downstream queries |
| 9 | Constraints / Assumptions / Open Questions | Lower-stakes; address last |

**Question style:**

- Frame each question with the relevant context already in the file (quote the section being repaired).
- For Success Metrics, **demand explicit numbers** — refuse to accept "we'll measure later" or "TBD". A metric without threshold and timeframe is not a metric.
- For Personas, **demand a name or named role plus context plus goal** — refuse generic "users", "everyone", "the team".
- For Acceptance Criteria, **demand observable user-facing behavior** — refuse test-case phrasing like "assert X = Y".
- For Problem Statement, **demand user-visible language** — refuse implementation smuggled in. ("Login takes 8s for users with > 100k records" — not "add a Postgres index on `users.email`".)

If the user genuinely lacks an answer to a required-field gap, **do not fabricate**. Leave status as `draft`, report which gaps remain, and stop.

Format-correction gaps (bullet→table, stale date, empty placeholder cells) do **not** require questions — fix them in place during Step 5.

### Step 5: Apply edits

Use **`Edit`** for every change — never `sed`/`awk`/`echo >>`/`cat <<EOF` rewrites. Constrain each `old_string` with surrounding text from the section being edited so similar strings elsewhere in the file are not affected.

Apply edits in this order:

1. **Fill resolved required-field content** — one `Edit` per distinct change. Replace the placeholder cell or empty section with the user-confirmed answer in present tense, full sentences.
2. **Convert any bullet-list user stories or goals to the template's prose-and-table form** — one Edit per converted block.
3. **Fill empty placeholder cells** (`…`, `...`, dashes, whitespace).
4. **Strip any remaining placeholder text** (`<...>`, `TBD`, `TODO`, `???`, `FIXME`, `[fill in]`, leftover HTML comments).
5. **Update `Last updated`** to today's date (single Edit on that bullet).
6. **Final edit: flip `Status: draft` → `Status: approved`.** This is the last edit applied — only after every other gap is resolved.

### Step 6: Re-audit checklist before flipping status

Re-read the PRD. Finalization is allowed **only when every box below is checked**:

- [ ] Problem Statement is 2-4 sentences; no implementation detail smuggled in
- [ ] At least 1 Goal row, each linked to a Success Metric ID present in the Success Metrics table
- [ ] At least 1 Non-Goal row with a stated reason
- [ ] At least 1 named (or named-role) Persona with context and primary goal filled
- [ ] At least 1 User Story with a non-empty Acceptance Criteria table; AC describes observable behavior, not test cases
- [ ] At least 1 Success Metric row with signal, threshold, and timeframe all filled
- [ ] Owner is a single accountable name or role (not template text, not empty)
- [ ] Tags is non-empty (1-3 area tags)
- [ ] Open Questions is either empty OR every row has owner + resolution date
- [ ] No `<...>`, `TBD`, `TODO`, `???`, `FIXME`, `[fill in]`, or empty placeholder cells remain in any required section
- [ ] No bullet-list user stories or goals remain — every comparable structure is a table per the template
- [ ] `Last updated` is today's date
- [ ] `Status: approved` is the **last** edit applied, only after every other check passes

If any item fails, **return to Step 4** for the unresolved required-field gap or to Step 5 for the unresolved format-correction gap. **Do not flip status while gaps remain.**

### Step 7: Stakeholder confirmation gate

The README's anti-patterns list calls out **One-Way Sign-off**: "the owner approves the PRD but stakeholders never review". Guard against it.

Before flipping the status edit, use `AskUserQuestion` to ask the user explicitly: have the named **Stakeholders** (the comma-separated list in the front matter) reviewed this PRD, or been notified that approval is imminent?

| User answer | Action |
|-------------|--------|
| Yes — stakeholders have reviewed | Continue; apply the `Status: draft` → `Status: approved` edit (the final edit from Step 5). |
| No — they have not | **Stop.** Leave `Status: draft` in place. Report what's blocking and suggest the user circulate the draft (link to the file) before re-running `/finalize-prd`. |

This gate sits between the re-audit pass (Step 6) and the actual status flip — never bypass it.

### Step 8: Update the PRD index

Edit `.docs/prd/README.md` to update the Index row for this PRD:

| Column | New value |
|--------|-----------|
| `Status` | `approved` |

If this PRD's row does not yet exist in the README's Index table (e.g. the placeholder "_No PRDs yet_" row is still present, or `/create-prd` did not insert one), insert a new row using the column format documented in the README:

| Column | Format |
|--------|--------|
| `File` | `[PRD-NNN](active/NNN-slug.md)` |
| `Title` | The PRD's H1 sub-title (without the `PRD NNN:` prefix) |
| `Status` | `approved` |
| `Created` | The PRD's `Created:` date |
| `Owner` | The PRD's confirmed Owner |
| `Linked ADRs` | `—` (filled later by `/prd-to-decisions`) |
| `Linked Tasks` | `—` (filled later by `/add-task --prd`) |

Use `Read` then `Edit` for the index update — never `echo >>` or `sed`.

### Step 9: Report completion and suggest next steps

Print a tabular summary:

| Field | Value |
|-------|-------|
| File | `<path>` |
| Title | `<PRD title>` |
| Old → New status | `draft → approved` |
| Required-field gaps resolved | count |
| Format fixes applied | count (bullet→table conversions, placeholder strips, etc.) |
| Stakeholder confirmation | yes |
| Index updated | yes |
| Suggested next steps | see below |

Suggested next steps:

| Suggestion | When to use it |
|------------|----------------|
| `/prd-to-decisions <file>` | The default next step — extract Architecturally Significant Requirements and propose ADR candidates |
| `/add-task --prd PRD-NNN <description>` | Only when the PRD's scope is small enough to skip ADRs entirely (no ASRs surface) |
| `/update-prd <file> <change>` | If a scope change surfaces post-approval — appends an `## Amendment N` block; never rewrites |

Do **not** auto-create downstream artifacts — present them as suggestions only.

---

## Output Formatting Rules (mandatory)

1. **Tables not bullets** — every audit summary, gap report, and re-audit checklist uses tables in your output and tables in any edits you apply to the PRD
2. **One Edit per gap** — keep edits surgical; do not rewrite whole sections to fix a single placeholder cell or single sentence
3. **Never alter approved PRDs** — refuse to run on a target whose status is `approved`, `archived`, `superseded`, or `trashed`; suggest `/update-prd` for amendments to approved PRDs
4. **Status flip is the LAST edit** — apply it only after the Step 6 re-audit checklist passes AND the Step 7 stakeholder gate returns yes
5. **Never fabricate content** — if the user lacks an answer for a required-field gap, leave `Status: draft`, report which gaps remain, and stop. Do not invent personas, metrics, or acceptance criteria
6. **Present tense, full sentences** when filling content. "On-call SREs need to triage paging within 90 seconds." Not "Faster triage." or "Triage = quick."

---

## CRITICAL Rules

1. **Status flip is one-way and final** — only flip the PRD to `approved` after every Step 6 checklist item passes AND Step 7 stakeholder confirmation returns yes
2. **Re-audit MUST run before flipping** — the Step 6 checklist is mandatory; never skip it, never flip status while any item is unchecked
3. **Never use `sed`/`awk`/`echo >>`/`cat <<EOF`** — always `Edit` (or `Read` first when needed). File hygiene is non-negotiable
4. **Never auto-create downstream artifacts** — `/prd-to-decisions`, `/add-task`, ADRs, and tasks are user-invoked. This command suggests; the user runs
5. **Maximum 3 sub-processes at a time** if delegating any sub-step
6. **No fabrication** — refuse to fill content the user could not supply. A draft PRD with honest gaps is more useful than an approved PRD with invented metrics or fictional personas
