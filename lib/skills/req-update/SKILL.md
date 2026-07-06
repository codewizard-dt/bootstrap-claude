---
name: req-update
description: Amend an approved requirement with a tracked Amendment block (append-only); apply direct edits to drafts; set retired/superseded status; surface downstream decision/task impact
category: planning
model: claude-sonnet-4-6
argument-hint: <path/to/req.md, NNN-slug, or NNN> [optional change description]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`; run /primer if not done this session.

# Update Requirement

Amend an existing requirement with a change. The mechanics depend on the requirement's status:

| Requirement Status | Behavior |
|--------------------|----------|
| `draft` | Apply edits directly in place — drafts are mutable |
| `approved` | Append an `## Amendment N` block; insert surgical `[amended N]` markers in affected sections; **never rewrite original prose** |
| `approved` (retiring) | Set `status: retired`, append reason to `## Notes`, update wiki index, append log entry — use `/req-retire` for a dedicated retirement flow |
| `retired` / `superseded` | Refuse general amendments — these requirements are no longer authoritative; suggest `/req-create` for new scope |

**Approved requirements are immutable in substance.** The amendment block is the audit trail. Original sections stay readable in their original form; markers point readers to the amendment that updated them. Amendments are themselves immutable once written — never edit a prior amendment block; append a new one.

**Check `wiki/work/requirements/lifecycle.md` first.** It defines the requirement format and status lifecycle; the `## Amendments` convention and the "Amendment Avoidance" anti-pattern this skill exists to prevent live there and in recent REQ files.

---

**Input**: $ARGUMENTS

---

## Step 1: Resolve the requirement file and parse change instructions

Parse `$ARGUMENTS`:
- **First token** — the file reference: `<path>`, `<NNN-slug>`, or `<NNN>`
- **Remaining text** — free-form change instructions describing what the user wants to amend

Resolution table:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `wiki/work/requirements/REQ-003-billing-portal.md`) | Use as-is |
| `<NNN-slug>` (e.g. `003-billing-portal`) | Search `wiki/work/requirements/` for `<NNN-slug>.md` (Serena `find_file`) |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits; search `wiki/work/requirements/` for files starting with that number; if ambiguous, list matches and ask the user via `AskUserQuestion` |
| Empty | List every requirement in `wiki/work/requirements/` and ask the user via `AskUserQuestion` to pick |

If the file cannot be located, **stop** and report — do not invent or create.

If the **change instructions are empty**, use `AskUserQuestion` to elicit them before proceeding. A `/req-update` invocation without a described change is malformed.

---

## Step 2: Read the requirement and check status

1. **Read** the requirement file with `Read`.
2. **Locate the `status:` field** in the YAML frontmatter.
3. **Branch on status:**

   | Status | Action |
   |--------|--------|
   | `draft` | Continue to Step 3 (you will take the **direct-edit branch** in Step 4) |
   | `approved` | Continue to Step 3 (you will take the **amendment branch** in Step 4); also check if the user intends to retire (see retiring branch below) |
   | `retired` | **STOP.** Tell the user: "REQ-NNN is retired. Run `/req-create` for any new scope." |
   | `superseded` | **STOP.** Tell the user: "REQ-NNN was superseded. Update the successor requirement instead." |

**Retiring branch** (when the user indicates they want to mark the requirement as retired):
1. Ask for the retirement reason via `AskUserQuestion`
2. Set `status: retired` in frontmatter
3. Append reason to `## Notes` section: *"Retired YYYY-MM-DD: <reason>"*
4. Update `updated` in frontmatter to today's date
5. Remove the requirement's row from `wiki/work/requirements/index.md` (terminal status — active index only)
6. Append to `wiki/log.md`: `## [YYYY-MM-DD] req-retired | REQ-NNN <title> — <reason>`
7. Skip to Step 10 (report)

---

## Step 3: Determine change scope and impact

Before any edit is applied, fully characterize the change. Use `AskUserQuestion` to gather (in this order):

1. **Affected sections** — which requirement sections does this change touch?

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
   | stakeholders | Reviewer set changed |

2. **Reason category** — pick one:

   | Category | When applicable |
   |----------|-----------------|
   | `new evidence` | User research, support tickets, or analytics changed the picture |
   | `scope clarification` | Original wording was ambiguous; this nails it down |
   | `stakeholder request` | A named stakeholder asked for the change |
   | `external constraint` | Legal, compliance, vendor change |
   | `discovered ambiguity` | Implementation revealed an unanswered question |

3. **Downstream impact** — read the requirement's `## Linked Decisions` and `## Linked Tasks` tables.
   - **If linked decisions exist:** list them and ask whether the change might invalidate any decision
   - **If linked tasks exist:** list them and ask whether the change affects their scope
   - If neither table has rows, skip — but still surface "no downstream artifacts" in the Step 10 report

---

## Step 4: Branch on status

### Branch A — `draft` requirement (direct-edit, mutable)

1. **Apply each distinct change with one `Edit` call.** Never bulk-rewrite.
2. **Update `updated`** in frontmatter to today's date.
3. If the change involves **adding or removing user stories, success metrics, or non-goals**, surface a one-line reminder: *"This requirement is still `draft`. When you're ready to approve, run `/req-finalize <path>` to re-audit completeness."*
4. **Skip Steps 5–8.** Proceed directly to Step 9 (downstream impact) and Step 10 (report).

### Branch B — `approved` requirement (amendment-only, append-only)

Approved requirements are immutable in substance. The original sections are not rewritten; instead:

- A new `## Amendment N` block is appended under the file's `## Amendments` heading
- Surgical `[amended N]` markers are inserted in the affected sections pointing to the amendment block
- The original prose stays readable in its original form

Determine **N**:

1. Scan the requirement for existing `## Amendment N` H2 blocks
2. `N` = (highest existing amendment number) + 1, or `1` if none exist

Continue to Step 5.

---

## Step 5: Compose the amendment block (approved-requirement branch only)

Draft the amendment block in your working context. Format:

```markdown
## Amendment N (YYYY-MM-DD)

- **Reason**: <reason category from Step 3>
- **Affected sections**: <comma-separated list from Step 3>
- **Stakeholders consulted**: <names or roles>
- **Downstream impact**: <decision/task IDs that may need review, or "none">

### Changes

| Section | Before (summary) | After (summary) | Rationale |
|---------|------------------|-----------------|-----------|
| Problem Statement | <one-line summary of original> | <one-line summary of amended> | <why> |

### Detailed Diff (optional)

<Free-form prose for the substance of the change.>
```

Rules:
- One row in the `### Changes` table per affected section
- `### Detailed Diff` is optional but recommended when the substance is non-trivial
- Use today's date in the H2

**Confirm the amendment-block content with the user via `AskUserQuestion` before writing.** Amendments are append-only and themselves immutable.

---

## Step 6: Apply surgical `[amended N]` markers (approved-requirement branch only)

For each affected section in the original requirement body, insert an inline marker pointing to the new amendment. **Do not rewrite the original prose.**

Marker patterns by section type:

| Section type | Marker pattern |
|--------------|----------------|
| Table row | Append `[amended N — see below]` to the relevant cell |
| Prose paragraph | Append `_(See [Amendment N](#amendment-N-yyyy-mm-dd).)_` at end of paragraph |
| Bulleted/numbered list item | Append `[amended N]` to the line |

Apply each marker with one `Edit` call. Use unique surrounding text in `old_string`.

---

## Step 7: Append the amendment block to the file (approved-requirement branch only)

1. **Read** the file again (state may have changed after Step 6's edits).
2. **Locate the `## Amendments` heading.**
   - If the file still has the placeholder comment, append the new block beneath the comment
   - If previous amendments exist, append the new block after the last existing `## Amendment` block
3. **Use `Edit`** to insert the block.
4. **Never** use `sed`, `echo >>`, `cat <<EOF`, or `Write` for a full-file rewrite. Only `Edit`.

---

## Step 8: Update `updated` and the wiki index

1. **Update the requirement's `updated` field** in frontmatter to today's date via `Edit`.
2. **Edit `wiki/work/requirements/index.md`** only if amendment-relevant columns changed (Title, Owner). Typically the index row stays stable for amendments.

Append to `wiki/log.md`:

```
## [YYYY-MM-DD] req-updated | REQ-NNN <title> — Amendment N
```

---

## Step 9: Surface downstream impact

Print a tabular report listing every linked decision and linked task that might need review:

| Artifact | Type | Status | Suggested Action |
|----------|------|--------|------------------|
| `DEC-0007#D2` | linked decision | accepted | Review whether amendment invalidates the decision; if so, write a successor via `/decision-create` |
| `wiki/work/tasks/TASK-004-billing-checkout.md` | linked task | in-progress | Review whether amendment changes the task scope; if so, run `/task-update ...` |

If there are no linked artifacts, print: *"No downstream decisions or tasks linked. No further action."*

This skill **does not auto-update or auto-deprecate** downstream artifacts.

---

## Step 10: Report completion

Print a single tabular summary:

| Field | Value |
|-------|-------|
| File | `<path>` |
| Branch taken | `direct-edit (draft)`, `amendment (approved)`, or `retired` |
| Amendment number | `N` (or `—` for direct-edit/retired) |
| `[amended N]` markers added | count (or `—`) |
| Sections touched | comma-separated list |
| Downstream artifacts flagged | count |
| Log entry | appended to wiki/log.md |
| Suggested next steps | `/req-finalize ...` (drafts), `/task-update ...`, `/decision-create ...`, etc. |

---

## Output Formatting Rules (mandatory)

1. **Tables not bullets** — the amendment block's `### Changes` section, the downstream-impact report, and the completion summary are all tables
2. **Approved requirements are append-only in substance** — original sections must remain readable; markers point to amendments, they do not replace text
3. **Surgical `Edit` calls** — one `Edit` per distinct change; never bulk rewrites
4. **Never use `sed`, `echo >>`, `cat <<EOF`** — always `Edit`
5. **Amendments are themselves immutable** once written — never edit a prior `## Amendment N` block
6. **Refuse general amendments on `retired` / `superseded` status** — suggest `/req-create` for new scope
7. **Confirm amendment-block content** with the user via `AskUserQuestion` before writing

---

## CRITICAL Rules

1. **Approved requirements are immutable in substance** — appending amendments is the ONLY allowed change
2. **Original prose stays visible** — `[amended N]` markers point to amendments; they do not replace the original content
3. **Amendment blocks are themselves append-only** — never edit a prior amendment block
4. **Refuse on terminal statuses** (`retired`, `superseded`) — suggest `/req-create` for new scope
5. **Never auto-update downstream artifacts** — surface linked decisions and tasks for user review
6. **Never use `sed`/`echo >>`/`cat <<EOF`** — always `Edit`
7. **Maximum 3 sub-processes at a time** if delegating
8. **Always terminate processes when done**
