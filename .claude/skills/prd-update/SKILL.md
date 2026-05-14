---
name: prd-update
description: Amend an approved PRD with a tracked Amendment block (append-only); apply direct edits to drafts; surface downstream ADR/task impact
model: claude-sonnet-4-6
argument-hint: <path/to/prd.md, NNN-slug, or NNN> [optional change description]
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Update PRD

Amend an existing PRD with a change. The mechanics depend on the PRD's status:

| PRD Status | Behavior |
|------------|----------|
| `draft` | Apply edits directly in place — drafts are mutable |
| `approved` | Append an `## Amendment N` block; insert surgical `[amended N]` markers in affected sections; **never rewrite original prose** |
| `archived` / `superseded` / `trashed` | Refuse — these PRDs are no longer authoritative; suggest `/prd-create` for new scope |

**Approved PRDs are immutable in substance.** The amendment block is the audit trail. Original sections stay readable in their original form; markers point readers to the amendment that updated them. Amendments are themselves immutable once written — never edit a prior amendment block; append a new one.

**Read `.docs/prd/README.md` first.** It defines the PRD format, the `## Amendments` section convention, and the "Amendment Avoidance" anti-pattern that this skill exists to prevent.

---

**Input**: $ARGUMENTS

---

## Step 1: Resolve the PRD file and parse change instructions

Parse `$ARGUMENTS`:
- **First token** — the file reference: `<path>`, `<NNN-slug>`, or `<NNN>`
- **Remaining text** — free-form change instructions describing what the user wants to amend

Resolution table:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `.docs/prd/003-billing-portal.md`) | Use as-is. **Refuse paths in `archived/`, `superseded/`, `trashed/`** — those statuses block updates anyway |
| `<NNN-slug>` (e.g. `003-billing-portal`) | Search `.docs/prd/` for `<NNN-slug>.md` (Serena `find_file`) |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits; search `.docs/prd/` for files starting with that number; if ambiguous, list matches and ask the user via `AskUserQuestion` |
| Empty | List every PRD in `.docs/prd/` and ask the user via `AskUserQuestion` to pick |

If the file cannot be located, **stop** and report — do not invent or create.

If the **change instructions are empty**, use `AskUserQuestion` to elicit them before proceeding. A `/prd-update` invocation without a described change is malformed.

---

## Step 2: Read the PRD and check status

1. **Read** the PRD file with `Read`.
2. **Locate the `Status:` line** in the front-matter bullets.
3. **Branch on status:**

   | Status | Action |
   |--------|--------|
   | `draft` | Continue to Step 3 (you will take the **direct-edit branch** in Step 4) |
   | `approved` | Continue to Step 3 (you will take the **amendment branch** in Step 4) |
   | `archived` | **STOP.** Tell the user: "PRD-NNN is archived; the product work landed and the PRD is preserved as historical reference. Run `/prd-create` for any new scope." |
   | `superseded` | **STOP.** Tell the user: "PRD-NNN was superseded by `<successor>`. Update the successor PRD instead." |
   | `trashed` | **STOP.** Tell the user: "PRD-NNN is trashed and no longer authoritative. Run `/prd-create` for new scope." |

Do not proceed past terminal statuses. Refusal is correct behavior.

---

## Step 3: Determine change scope and impact

Before any edit is applied, fully characterize the change. Use `AskUserQuestion` to gather (in this order):

1. **Affected sections** — which PRD sections does this change touch?

   | Candidate section | Typical reason for amendment |
   |-------------------|------------------------------|
   | Problem Statement | New evidence reframes the problem |
   | Goals | A goal added, removed, or rephrased |
   | Non-Goals | Scope tightened or loosened |
   | Personas | New persona discovered or one removed |
   | User Stories | Story added, removed, or acceptance criteria changed |
   | Success Metrics | Threshold or signal updated |
   | Constraints | New regulatory or business constraint |
   | Assumptions | Assumption invalidated |
   | Open Questions | Resolution arrived |
   | Stakeholders | Reviewer set changed |

2. **Reason category** — pick one (used as the `Reason` field in the amendment block):

   | Category | When applicable |
   |----------|-----------------|
   | `new evidence` | User research, support tickets, or analytics changed the picture |
   | `scope clarification` | Original wording was ambiguous; this nails it down |
   | `stakeholder request` | A named stakeholder asked for the change |
   | `external constraint` | Legal, compliance, vendor change |
   | `discovered ambiguity` | Implementation revealed an unanswered question |

3. **Downstream impact** — read the PRD's `## Linked ADRs` and `## Linked Tasks` tables.
   - **If linked ADRs exist:** list them in a table and ask whether the change might invalidate any decision (a "yes" answer surfaces the ADR for review in Step 9)
   - **If linked tasks exist:** list them in a table and ask whether the change affects their scope (a "yes" answer surfaces the task in Step 9)
   - If neither table has rows, skip — but still surface "no downstream artifacts" in the Step 9 report

Persist all three answers (affected sections, reason category, downstream-impact list) — they feed Steps 5, 6, and 9.

---

## Step 4: Branch on status

### Branch A — `draft` PRD (direct-edit, mutable)

Drafts are mutable; apply the change in place.

1. **Apply each distinct change with one `Edit` call.** Never bulk-rewrite. Constrain `old_string` matches to the section being edited by including unique surrounding text.
2. **Update `Last updated`** on the PRD's front-matter bullet to today's date.
3. If the change involves **adding or removing user stories, success metrics, or non-goals**, surface a one-line reminder: *"This PRD is still `draft`. When you're ready to approve, run `/prd-finalize <path>` to re-audit completeness."*
4. **Skip Steps 5–8.** Proceed directly to Step 9 (downstream impact) and Step 10 (report).

### Branch B — `approved` PRD (amendment-only, append-only)

Approved PRDs are immutable in substance. The original sections are not rewritten; instead:

- A new `## Amendment N` block is appended under the file's `## Amendments` heading
- Surgical `[amended N]` markers are inserted in the affected sections pointing to the amendment block
- The original prose stays readable in its original form

Determine **N**:

1. Scan the PRD for existing `## Amendment N` H2 blocks
2. `N` = (highest existing amendment number) + 1, or `1` if none exist

Continue to Step 5.

---

## Step 5: Compose the amendment block (approved-PRD branch only)

Draft the amendment block in your working context. Format:

```markdown
## Amendment N (YYYY-MM-DD)

- **Reason**: <reason category from Step 3>
- **Affected sections**: <comma-separated list from Step 3>
- **Stakeholders consulted**: <names or roles>
- **Downstream impact**: <ADR/task IDs that may need review, or "none">

### Changes

| Section | Before (summary) | After (summary) | Rationale |
|---------|------------------|-----------------|-----------|
| Problem Statement | <one-line summary of original> | <one-line summary of amended> | <why> |
| ... | ... | ... | ... |

### Detailed Diff (optional)

<Free-form prose for the substance of the change. Use code-fenced quote blocks if reproducing original wording is helpful for the audit trail.>
```

Rules:
- One row in the `### Changes` table per affected section
- `Before (summary)` and `After (summary)` are one-liners — the full original text stays in the section itself, unchanged
- `### Detailed Diff` is optional but recommended when the substance is non-trivial
- Use today's date in the H2 (`YYYY-MM-DD`)

**Confirm the amendment-block content with the user via `AskUserQuestion` before writing.** Amendments are append-only and themselves immutable, so a faulty amendment cannot be silently corrected later — only superseded by a further amendment.

---

## Step 6: Apply surgical `[amended N]` markers (approved-PRD branch only)

For each affected section in the original PRD body, insert an inline marker pointing to the new amendment. **Do not rewrite the original prose.** The marker is a pointer, not a replacement.

Marker patterns by section type:

| Section type | Marker pattern | Example |
|--------------|----------------|---------|
| Table row (Goals, Non-Goals, Success Metrics, etc.) | Append `[amended N — see below]` to the relevant cell | `\| 2 \| Reduce time-to-checkout by 30% [amended 2 — see below] \| SM-2 \|` |
| Prose paragraph (Problem Statement, etc.) | Append `_(See [Amendment N](#amendment-N-yyyy-mm-dd).)_` at end of paragraph | `... why now. _(See [Amendment 2](#amendment-2-2026-05-12).)_` |
| Bulleted/numbered list item | Append `[amended N]` to the line | `- Casey, the on-call SRE [amended 2]` |
| User Story acceptance-criterion row | Append `[amended N — see below]` to the criterion cell | as table-row pattern above |

Apply each marker with one `Edit` call. Use unique surrounding text in `old_string` so the match cannot collide with a similar phrase elsewhere.

Original prose remains visible. Readers see the original wording **and** a pointer to the amendment.

---

## Step 7: Append the amendment block to the file (approved-PRD branch only)

1. **Read** the file again (state may have changed after Step 6's edits).
2. **Locate the `## Amendments` heading.**
   - If the file still has the placeholder comment `<!-- Amendments appear here as `## Amendment 1`, `## Amendment 2`, etc. -->`, append the new block beneath the comment
   - If previous amendments exist, append the new block after the last existing `## Amendment` block
3. **Use `Edit`** to insert the block. The `old_string` should be the comment line or the trailing text of the last existing amendment; the `new_string` is the original `old_string` plus a blank line plus the full amendment block from Step 5.
4. **Never** use `sed`, `echo >>`, `cat <<EOF`, or `Write` for a full-file rewrite. Only `Edit`.

---

## Step 8: Update `Last updated` and the PRD index

1. **Update the PRD's `Last updated` field** to today's date via `Edit`.
2. **Edit `.docs/prd/README.md`** only if amendment-relevant columns changed:

   | Column | Update on amendment? |
   |--------|----------------------|
   | `File` | No |
   | `Title` | Only if title amended (rare) |
   | `Status` | No (still `approved`) |
   | `Created` | Never (immutable) |
   | `Owner` | Only if amendment changed Owner |
   | `Linked ADRs` | No (those tables only update via `/prd-extract-decisions`) |
   | `Linked Tasks` | No (those tables only update via `/task-add --prd`) |

   Typically the index row stays stable for amendments. For `draft` PRDs, the index row was set when the PRD was created; only update if a tracked column actually changed.

---

## Step 9: Surface downstream impact

Print a tabular report listing every linked ADR and linked task that might need review based on Step 3's "Affected sections":

| Artifact | Type | Status | Suggested Action |
|----------|------|--------|------------------|
| `ADR-0007#D2` | linked ADR | accepted | Review whether amendment invalidates the decision; if so, write a successor via `/adr-create` and finalize via `/adr-finalize` to supersede |
| `.docs/tasks/004-billing-checkout.md` | linked task | WIP | Review whether amendment changes the task scope; if so, run `/task-update .docs/tasks/004-billing-checkout.md "<change summary>"` |
| `.docs/tasks/completed/002-prior-feature.md` | linked task | done | No action — already shipped under prior scope |

If there are no linked artifacts, print: *"No downstream ADRs or tasks linked. No further action."*

This skill **does not auto-update or auto-deprecate** downstream artifacts. Surfacing them is the deliberate boundary — the user decides whether each artifact needs a follow-up command.

---

## Step 10: Report completion

Print a single tabular summary:

| Field | Value |
|-------|-------|
| File | `<path>` |
| Branch taken | `direct-edit (draft)` or `amendment (approved)` |
| Amendment number | `N` (or `—` for direct-edit) |
| `[amended N]` markers added | count (or `—` for direct-edit) |
| Sections touched | comma-separated list |
| Downstream artifacts flagged | count (linked ADRs + linked tasks needing review) |
| Suggested next steps | `/prd-finalize ...` (drafts), `/task-update ...`, `/adr-create ...`, etc. |

If the branch was `direct-edit (draft)` and the change was substantive, include the reminder: *"Run `/prd-finalize <path>` when ready to approve."*

---

## Output Formatting Rules (mandatory)

1. **Tables not bullets** — the amendment block's `### Changes` section, the downstream-impact report, and the completion summary are all tables
2. **Approved PRDs are append-only in substance** — original sections must remain readable in their original form; markers point to amendments, they do not replace text
3. **Surgical `Edit` calls** — one `Edit` per distinct change; never bulk rewrites
4. **Never use `sed`, `echo >>`, `cat <<EOF`** — always `Edit`
5. **Amendments are themselves immutable** once written — never edit a prior `## Amendment N` block; if the amendment itself was wrong, append a further amendment that supersedes it
6. **Refuse on `archived` / `superseded` / `trashed` status** — these PRDs are no longer authoritative; suggest `/prd-create` for new scope
7. **Confirm amendment-block content** with the user via `AskUserQuestion` before writing, since amendments are append-only

---

## CRITICAL Rules

1. **Approved PRDs are immutable in substance** — appending amendments is the ONLY allowed change; original prose is not rewritten
2. **Original prose stays visible** — `[amended N]` markers point to amendments; they do not replace the original content
3. **Amendment blocks are themselves append-only** — never edit a prior amendment block
4. **Refuse on terminal statuses** (`archived`, `superseded`, `trashed`) — these PRDs are no longer authoritative
5. **Never auto-update downstream artifacts** — surface linked ADRs and tasks for user review; do not run `/task-update` or `/adr-create` on the user's behalf
6. **Never use `sed`/`echo >>`/`cat <<EOF`** — always `Edit`
7. **Maximum 3 sub-processes at a time** if delegating
8. **Always terminate processes when done**
