---
name: req-finalize
description: Run completeness audit on a draft requirement, resolve gaps via Q&A, and flip status to approved
model: claude-sonnet-4-6
effort: high
argument-hint: <path/to/req.md, NNN-slug, or NNN>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


# Finalize Requirement

Take a single **draft** requirement, surface every required-field gap or unresolved placeholder, resolve those gaps with the user, confirm stakeholder review, then flip the requirement's `status` from `draft` to `approved` in frontmatter.

Once a requirement is approved, it is **immutable in substance**. Future scope changes go through `/req-update`, which appends an `## Amendment N` block rather than rewriting prior content. This command is the one-way gate into that immutable state — get the audit right.

**Check `wiki/work/requirements/lifecycle.md` first.** It defines the required-non-empty fields, the status lifecycle, the file template, and the anti-patterns this audit must catch.

---

**Target**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the requirement file

Parse `$ARGUMENTS` to identify the target file:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `wiki/work/requirements/REQ-003-search.md`) | Use as-is |
| `<NNN-slug>` (e.g. `003-search`) | Search `wiki/work/requirements/` for `NNN-slug.md` |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits; `mcp__serena__find_file` with mask `NNN-*.md` in `wiki/work/requirements/` |
| Empty / missing | List every requirement with `status: draft` across `wiki/work/requirements/` and ask the user via `AskUserQuestion` to pick one |

If the file cannot be located, **stop** and report — do not invent or create.

### Step 2: Read the file and verify status

1. **Read** the requirement with `Read`.
2. **Locate the `status:` field** in the YAML frontmatter.
3. **Verify the status is `draft`**:

   | Current Status | Action |
   |----------------|--------|
   | `draft` | Continue to Step 3 |
   | `approved` | Stop. Tell the user the requirement is already approved and immutable in substance; suggest `/req-update <file> <change>` for any amendment |
   | `retired` | Stop. The requirement is no longer authoritative; finalizing makes no sense |
   | `superseded` | Stop. A successor requirement has replaced this one — finalize the successor instead |

### Step 3: Audit the requirement against the quality bar

Inspect the file section by section and build a gap report. Required-field gaps need user resolution (Step 4); format-correction gaps are fixed in place during Step 5 without asking.

#### Required-field audit

| Required Field | Quality Bar | Failure mode to detect |
|----------------|-------------|------------------------|
| Problem Statement | 2-4 sentences; identifies what is broken, missing, or possible | Empty, single-sentence, or solution smuggled in |
| Goals (≥ 1) | Each row has an outcome-oriented goal AND a `Linked Success Metric` ID | Empty, vibes ("improve performance"), or goals without a metric link |
| Non-Goals (≥ 1) | At least one explicit out-of-scope row with a stated reason | Empty, "N/A", or row with no reason |
| Personas (≥ 1) | Named or named-role persona with context column and primary-goal column filled | "Users", "everyone", "the team" — not personas |
| User Stories (≥ 1) | Format `As <persona>, I want <capability> so that <outcome>`; each story has a non-empty Acceptance Criteria table | Stories without AC; AC written as test cases |
| Success Metrics (≥ 1) | Each row has signal + threshold + timeframe (When measured) | Missing threshold, missing timeframe, or vibes |
| owner | Single accountable name or role | Empty or template text |
| tags | 1-3 short area tags, non-empty | Empty or template `<area-1>, <area-2>` |
| Open Questions | Empty, OR every row has owner + resolution date | Lingering open questions block approval |

#### Format-correction audit (fix in place; no user question needed)

| Gap Type | Detection Pattern |
|----------|-------------------|
| Bullet-list user stories or goals | `- As a user, I want...` style — convert to prose-with-tables |
| Empty placeholder cells | Cells containing `…`, `...`, dashes used as placeholders, or whitespace |
| Placeholder text | `<...>`, `TBD`, `TODO`, `???`, `FIXME`, `[fill in]`, `<!-- ... -->` HTML comments |
| Stale `updated` | Date older than today |
| Anti-pattern: solution in problem statement | Implementation detail appearing in the Problem Statement |

#### Build the audit report

Output to the user **before any edits** as a tabular summary — never bullets:

```
File: wiki/work/requirements/REQ-003-search.md
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
- For Success Metrics, **demand explicit numbers** — refuse to accept "we'll measure later" or "TBD".
- For Personas, **demand a name or named role plus context plus goal** — refuse generic "users", "everyone", "the team".
- For Acceptance Criteria, **demand observable user-facing behavior** — refuse test-case phrasing.
- For Problem Statement, **demand user-visible language** — refuse implementation smuggled in.

If the user genuinely lacks an answer to a required-field gap, **do not fabricate**. Leave status as `draft`, report which gaps remain, and stop.

### Step 5: Apply edits

Use **`Edit`** for every change — never `sed`/`awk`/`echo >>`/`cat <<EOF` rewrites.

Apply edits in this order:

1. **Fill resolved required-field content** — one `Edit` per distinct change.
2. **Convert any bullet-list user stories or goals to the template's prose-and-table form** — one Edit per converted block.
3. **Fill empty placeholder cells** (`…`, `...`, dashes, whitespace).
4. **Strip any remaining placeholder text** (`<...>`, `TBD`, `TODO`, `???`, `FIXME`, `[fill in]`, leftover HTML comments).
5. **Update `updated`** in frontmatter to today's date (single Edit).
6. **Final edit: flip `status: draft` → `status: approved`.** This is the last edit applied — only after every other gap is resolved.

### Step 6: Re-audit checklist before flipping status

Re-read the requirement. Finalization is allowed **only when every box below is checked**:

- [ ] Problem Statement is 2-4 sentences; no implementation detail smuggled in
- [ ] At least 1 Goal row, each linked to a Success Metric ID present in the Success Metrics table
- [ ] At least 1 Non-Goal row with a stated reason
- [ ] At least 1 named (or named-role) Persona with context and primary goal filled
- [ ] At least 1 User Story with a non-empty Acceptance Criteria table; AC describes observable behavior, not test cases
- [ ] At least 1 Success Metric row with signal, threshold, and timeframe all filled
- [ ] `owner` is a single accountable name or role (not template text, not empty)
- [ ] `tags` is non-empty (1-3 area tags)
- [ ] Open Questions is either empty OR every row has owner + resolution date
- [ ] No `<...>`, `TBD`, `TODO`, `???`, `FIXME`, `[fill in]`, or empty placeholder cells remain in any required section
- [ ] No bullet-list user stories or goals remain
- [ ] `updated` is today's date
- [ ] `status: approved` is the **last** edit applied, only after every other check passes

If any item fails, **return to Step 4** or Step 5. **Do not flip status while gaps remain.**

### Step 7: Stakeholder confirmation gate

Before flipping the status edit, use `AskUserQuestion` to ask the user explicitly: have the named **stakeholders** reviewed this requirement, or been notified that approval is imminent?

| User answer | Action |
|-------------|--------|
| Yes — stakeholders have reviewed | Continue; apply the `status: draft` → `status: approved` edit. |
| No — they have not | **Stop.** Leave `status: draft` in place. Report what's blocking and suggest the user circulate the draft before re-running `/req-finalize`. |

### Step 8: Update the wiki index

Edit `wiki/work/requirements/index.md` to update this requirement's row (status text `draft` → `approved`; approved is still active so the row stays):

| Column | New value |
|--------|-----------|
| `Status` | `approved` |

If this requirement's row does not yet exist in the index table, insert a new row using the column format:

| Column | Format |
|--------|--------|
| `ID` | `[REQ-NNN](requirements/NNN-slug.md)` |
| `Title` | The requirement's initiative title |
| `Status` | `approved` |
| `Created` | The requirement's `created:` date |
| `Owner` | The requirement's confirmed owner |
| `Linked Decisions` | `—` (filled later by `/req-extract-decisions`) |
| `Linked Tasks` | `—` (filled later by `/task-add --req`) |

Append to `wiki/log.md`:

```
## [YYYY-MM-DD] req-approved | REQ-NNN <title>
```

Use `Read` then `Edit` for the index update — never `echo >>` or `sed`.

### Step 9: Report completion and suggest next steps

Print a tabular summary:

| Field | Value |
|-------|-------|
| File | `<path>` |
| Title | `<requirement title>` |
| Old → New status | `draft → approved` |
| Required-field gaps resolved | count |
| Format fixes applied | count |
| Stakeholder confirmation | yes |
| Index updated | yes |
| Log entry | appended to wiki/log.md |
| Suggested next steps | see below |

Suggested next steps:

| Suggestion | When to use it |
|------------|----------------|
| `/req-extract-decisions <file>` | The default next step — extract Architecturally Significant Requirements and propose decision candidates |
| `/task-add --req REQ-NNN <description>` | Only when the requirement's scope is small enough to skip decisions entirely |
| `/req-update <file> <change>` | If a scope change surfaces post-approval — appends an `## Amendment N` block; never rewrites |

Do **not** auto-create downstream artifacts — present them as suggestions only.

---

## Output Formatting Rules (mandatory)

1. **Tables not bullets** — every audit summary, gap report, and re-audit checklist uses tables
2. **One Edit per gap** — keep edits surgical; do not rewrite whole sections to fix a single placeholder cell
3. **Never alter approved requirements** — refuse to run on a target whose status is `approved`, `retired`, or `superseded`; suggest `/req-update` for amendments
4. **Status flip is the LAST edit** — apply it only after the Step 6 re-audit checklist passes AND the Step 7 stakeholder gate returns yes
5. **Never fabricate content** — if the user lacks an answer for a required-field gap, leave `status: draft`, report which gaps remain, and stop
6. **Present tense, full sentences** when filling content

---

## CRITICAL Rules

1. **Status flip is one-way and final** — only flip to `approved` after every Step 6 checklist item passes AND Step 7 stakeholder confirmation returns yes
2. **Re-audit MUST run before flipping** — the Step 6 checklist is mandatory; never skip it
3. **Never use `sed`/`awk`/`echo >>`/`cat <<EOF`** — always `Edit`
4. **Never auto-create downstream artifacts** — `/req-extract-decisions`, `/task-add`, decisions, and tasks are user-invoked
5. **Maximum 3 sub-processes at a time** if delegating any sub-step
6. **No fabrication** — refuse to fill content the user could not supply
