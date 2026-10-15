---
name: prd-deprecate
description: Deprecate a PRD — set status to retired in frontmatter, document the reason, move its index row to Closed, append a log entry. Status-only: the file never moves.
category: planning
model: claude-haiku-4-5-20251001
argument-hint: <wiki/work/requirements/PRD-NNNN-slug.md, PRD-NNNN, NNN-slug, or NNN> [reason]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.
**Read `wiki/work/requirements/lifecycle.md` first** — it defines the PRD lifecycle and terminal states.

# Deprecate PRD

Set a PRD's `status` to `retired`, document why, and move its row in the family index from Active to Closed. The file stays in `wiki/work/requirements/`, so cross-references using `[[PRD-NNNN]]` (and legacy `[[REQ-NNNN]]` links, which still resolve) are unaffected.

This skill is a focused shortcut for the deprecation flow. For supersession (a new PRD replaces this one), create the new PRD with `/prd-create`, then deprecate the old one here.



---

**PRD**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the PRD file

Parse `$ARGUMENTS`:
- **First token(s)** — the file reference: `<path>`, `PRD-NNNN`, `<NNN-slug>`, or `<NNN>`
- **Remaining text** — optional reason for deprecation (may be elicited in Step 3 if absent)

Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: requirements · scope: active · ambiguous: interactive · empty: list every PRD in `wiki/work/requirements/` and ask the user via `AskUserQuestion` to pick

An item still sitting in a legacy holding folder from the older layout is already terminal: if the resolver STOPs and the ID appears in that legacy folder's index, report "already retired" instead of "not found".

If the file cannot be located, **stop** and report.

### Step 2: Read the PRD and verify status

1. **Read** the PRD file with `Read`.
2. **Check `status:` in frontmatter:**

   | Current status | Action |
   |----------------|--------|
   | `draft` | Continue — may be deprecated before approval |
   | `approved` | Continue — most common case |
   | `retired` | **STOP.** Tell the user: "PRD-NNNN is already retired. No action needed." |
   | `superseded` | **STOP.** Tell the user: "PRD-NNNN is already superseded. No action needed." |

3. **Check for downstream artifacts** in `## Linked Decisions` and `## Linked Tasks`:
   - List any linked decisions and their current status
   - List any linked tasks and their current status
   - Build a downstream artifacts table for Step 3

### Step 3: Confirm with the user

Use `AskUserQuestion` to confirm. Show:

- The PRD file to be deprecated (full path, ID, title)
- Current status
- Downstream artifacts table (if any linked decisions or tasks exist):

| Artifact | Type | Current status | Suggested action |
|----------|------|----------------|------------------|
| `[[0007-auth\|ADR-0007#D2]]` | linked decision | accepted | Review independently — accepted decisions are immutable; if no longer needed, write a deprecating successor with `/adr-create deprecate <topic> (supersedes ADR-0007#D2)` |
| `[[004-billing\|TASK-004]]` | linked task | todo | Run `/task-close wiki/work/tasks/TASK-004-billing.md` if the task is also cancelled |

Ask the user:

1. **"Deprecate this PRD? (yes / no)"**
2. **"Reason for deprecating PRD-NNNN?"** (if not provided in `$ARGUMENTS` — required, one line or more)

If the user says **No**, STOP. Do not proceed.

**Do NOT ask whether to deprecate linked decisions or tasks** — they are surfaced as suggestions only. This skill never auto-cascades.

### Step 4: Apply the deprecation edits

Edit only — see `~/.claude/skills/_shared/SKILL-BOILERPLATE.md` § Edit hygiene.

Apply in this order:

1. **Update `status: <current>` → `status: retired`** in frontmatter.
2. **Update `updated: YYYY-MM-DD`** in frontmatter to today's date.
3. **Append the deprecation reason to `## Notes`**:
   - If `## Notes` already has content, append a new paragraph.
   - If `## Notes` is empty or has only a placeholder, replace the placeholder with the deprecation entry:
     ```
     **Deprecated [YYYY-MM-DD]**: <reason provided by user>
     ```
   - If the `## Notes` section does not exist, add it at the end of the file.

### Step 5: Move the row from Active to Closed in the family index

`retired` is a terminal status — **move the PRD's row from Active to Closed** in `wiki/work/requirements/index.md`. This is the in-place close mechanic defined once in `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` § In-place close (roadmaps, decisions, requirements) with `family: requirements`, `terminal_status: retired` — this step is that section's step 2 (Step 4 already did its step 1 and Step 6 writes its own log entry):

1. Delete the row from the Active section.
2. Add the same entry under a `## Closed` heading, using the Active bullet format with the terminal status as the last ` · ` segment:

   ```
   - [PRD-NNNN — Title](PRD-NNNN-slug.md) — one-line summary · retired
   ```

   If the index has no `## Closed` heading yet, create it at the end of the file (with the entry-format line if the Active section carries one). Keep Closed rows in numeric-ID order.

Use `Read` then `Edit`. If the row is already absent from Active, note it and continue.

### Step 6: Append to wiki/log.md

Append one entry to `wiki/log.md`:

```
## [YYYY-MM-DD] prd-deprecated | PRD-NNNN <title> — reason: <one-line summary of reason>
```

Use `Read` then `Edit`.

### Step 7: Surface downstream artifacts for independent action

Print the downstream artifacts table from Step 3 again, with suggested next-action commands:

```
Linked decisions and tasks surfaced for independent review:

To act on linked tasks (each independently):
  /task-close wiki/work/tasks/TASK-004-billing.md   # if task is also cancelled

To act on linked decisions (each independently):
  # Accepted decisions are immutable — write a deprecating successor:
  /adr-create deprecate <topic> (supersedes ADR-0007#D2)
  # Proposed decisions may be left, finalized, or abandoned
```

### Step 8: Report completion

Print a tabular summary:

| Field | Value |
|-------|-------|
| PRD | `PRD-NNNN <title>` |
| File path | `wiki/work/requirements/PRD-NNNN-slug.md` (unchanged) |
| Old status | `draft` or `approved` |
| New status | `retired` |
| Reason | <one-line summary> |
| Family index updated | yes (row moved to Closed) |
| wiki/log.md entry | yes |
| Linked decisions surfaced | count |
| Linked tasks surfaced | count |

---

## Output Formatting Rules

1. Use tables for the downstream artifacts list and the completion report — never paragraph prose.
2. **One `Edit` call per change** — never bulk rewrites.
3. **The file never moves**, so all ID cross-references remain valid.
4. **The skill never auto-deprecates or auto-retires downstream artifacts** — it surfaces them with suggested commands.
5. **The deprecation reason in `## Notes` is permanent** — it is the audit trail for why this PRD was deprecated.

---

## CRITICAL Rules

1. **Status-only.** Set `status: retired` in frontmatter and update the index; **never move the file**.
2. **Never auto-cascade** to linked decisions or tasks. Surface them as suggestions only.
3. **Confirm with the user before any edits** — `AskUserQuestion` is mandatory in Step 3.
4. **Deprecation reason is required** — refuse to deprecate without a documented reason.
5. **Refuse if already retired or superseded** — these are terminal states; running again is a no-op, not an error.
6. Maximum 3 sub-processes at a time if delegating any step.
7. Always terminate background processes when done.
