---
name: req-retire
description: Retire a requirement — set status to retired in frontmatter, document the reason, move to archive/, append a log entry.
category: planning
model: claude-haiku-4-5-20251001
argument-hint: <wiki/work/requirements/REQ-NNN-slug.md, NNN-slug, or NNN> [reason]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`; run /primer if not done this session.
**Read `wiki/work/requirements/lifecycle.md` first** — it defines the requirement lifecycle, terminal states, and the archive rule.

# Retire Requirement

Set a requirement's `status` to `retired`, document why, then move the file to `wiki/work/requirements/archive/`. After archiving, cross-references using `[[REQ-NNN]]` remain valid — the ID is stable regardless of file location.

This skill is a focused shortcut for the retirement flow. For amendments that don't touch status, use `/req-update`. For supersession (a new requirement replaces this one), use `/req-update` with supersession intent or pass `status: superseded` instructions here.



---

**Requirement**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the requirement file

Parse `$ARGUMENTS`:
- **First token(s)** — the file reference: `<path>`, `<NNN-slug>`, or `<NNN>`
- **Remaining text** — optional reason for retirement (may be elicited in Step 3 if absent)

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `wiki/work/requirements/REQ-003-search.md`) | Use as-is; verify exists via `mcp__serena__find_file` |
| `<NNN-slug>` (e.g. `003-search`) | `mcp__serena__find_file` with mask `003-search.md` under `wiki/work/requirements/` |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits; `mcp__serena__find_file` with mask `NNN-*.md` under `wiki/work/requirements/` |
| Empty / missing | List every requirement in `wiki/work/requirements/` and ask the user via `AskUserQuestion` to pick |

If the file cannot be located, **stop** and report.

### Step 2: Read the requirement and verify status

1. **Read** the requirement file with `Read`.
2. **Check `status:` in frontmatter:**

   | Current status | Action |
   |----------------|--------|
   | `draft` | Continue — may be retired before approval |
   | `approved` | Continue — most common case |
   | `retired` | **STOP.** Tell the user: "REQ-NNN is already retired. No action needed." |
   | `superseded` | **STOP.** Tell the user: "REQ-NNN is already superseded. No action needed." |

3. **Check for downstream artifacts** in `## Linked Decisions` and `## Linked Tasks`:
   - List any linked decisions and their current status
   - List any linked tasks and their current status
   - Build a downstream artifacts table for Step 3

### Step 3: Confirm with the user

Use `AskUserQuestion` to confirm. Show:

- The requirement file to be retired (full path, ID, title)
- Current status
- Downstream artifacts table (if any linked decisions or tasks exist):

| Artifact | Type | Current status | Suggested action |
|----------|------|----------------|------------------|
| `[[0007-auth\|DEC-0007#D2]]` | linked decision | accepted | Review independently — accepted decisions are immutable; if no longer needed, write a deprecating successor |
| `[[004-billing\|TASK-004]]` | linked task | todo | Run `/task-trash wiki/work/tasks/TASK-004-billing.md` if the task is also cancelled |

Ask the user:

1. **"Retire this requirement? (yes / no)"**
2. **"Reason for retiring REQ-NNN?"** (if not provided in `$ARGUMENTS` — required, one line or more)

If the user says **No**, STOP. Do not proceed.

**Do NOT ask whether to retire linked decisions or tasks** — they are surfaced as suggestions only. This skill never auto-cascades.

### Step 4: Apply the retirement edits

Use `Edit` for all changes — never `sed`, `awk`, `echo >>`, `cat <<EOF`, or `Write` for a full-file rewrite.

Apply in this order:

1. **Update `status: <current>` → `status: retired`** in frontmatter.
2. **Update `updated: YYYY-MM-DD`** in frontmatter to today's date.
3. **Append the retirement reason to `## Notes`**:
   - If `## Notes` already has content, append a new paragraph.
   - If `## Notes` is empty or has only a placeholder, replace the placeholder with the retirement entry:
     ```
     **Retired [YYYY-MM-DD]**: <reason provided by user>
     ```
   - If the `## Notes` section does not exist, add it at the end of the file.

### Step 5: Remove from the family index

`retired` is a terminal status — **delete the requirement's row** from `wiki/work/requirements/index.md` (the family index lists active items only).

Use `Read` then `Edit` — never `echo >>` or `sed`. If the row is already absent, note it and continue.

### Step 5.5: Archive the file

Move the file to `archive/` (Bash — `git mv` only):

```
git mv wiki/work/requirements/<file>.md wiki/work/requirements/archive/<file>.md
```

Then append to `wiki/work/requirements/archive/index.md`:

```
| [[REQ-NNN]] | <Title> | retired | YYYY-MM-DD |
```

Use `Read` then `Edit` for the archive index append — never `echo >>`.

### Step 6: Append to wiki/log.md

Append one entry to `wiki/log.md`:

```
## [YYYY-MM-DD] req-retired | REQ-NNN <title> — reason: <one-line summary of reason>
```

Use `Read` then `Edit` — never `echo >>` or `sed`.

### Step 7: Surface downstream artifacts for independent action

Print the downstream artifacts table from Step 3 again, with suggested next-action commands:

```
Linked decisions and tasks surfaced for independent review:

To act on linked tasks (each independently):
  /task-trash wiki/work/tasks/TASK-004-billing.md   # if task is also cancelled

To act on linked decisions (each independently):
  # Accepted decisions are immutable — write a deprecating successor:
  /decision-create deprecate <topic> (supersedes DEC-0007#D2)
  # Proposed decisions may be left, finalized, or abandoned
```

### Step 8: Report completion

Print a tabular summary:

| Field | Value |
|-------|-------|
| Requirement | `REQ-NNN <title>` |
| File path | `wiki/work/requirements/REQ-NNN-slug.md` → `wiki/work/requirements/archive/REQ-NNN-slug.md` |
| Old status | `draft` or `approved` |
| New status | `retired` |
| Reason | <one-line summary> |
| Family index updated | yes (row removed — terminal status) |
| Archive index updated | yes (row appended) |
| wiki/log.md entry | yes |
| Linked decisions surfaced | count |
| Linked tasks surfaced | count |

---

## Output Formatting Rules

1. Use tables for the downstream artifacts list and the completion report — never paragraph prose.
2. **One `Edit` call per change** — never bulk rewrites.
3. **After archiving, cross-references using `[[REQ-NNN]]` remain valid** — the ID is stable regardless of file location.
4. **The skill never auto-retires or auto-deprecates downstream artifacts** — it surfaces them with suggested commands.
5. **The retirement reason in `## Notes` is permanent** — it is the audit trail for why this requirement was retired.

---

## CRITICAL Rules

1. **Archiving (not deletion) is the terminal action.** Set `status: retired` in frontmatter AND move the file to `wiki/work/requirements/archive/` via `git mv`.
2. **Never auto-cascade** to linked decisions or tasks. Surface them as suggestions only.
3. **Confirm with the user before any edits** — `AskUserQuestion` is mandatory in Step 3.
4. **Retirement reason is required** — refuse to retire without a documented reason.
5. **Never use `sed` / `awk` / `echo >>` / `cat <<EOF`** — always `Edit`. `Bash` is permitted only for `git mv`. See `.docs/guides/mcp-tools.md`.
6. **Refuse if already retired or superseded** — these are terminal states; running again is a no-op, not an error.
7. Maximum 3 sub-processes at a time if delegating any step.
8. Always terminate background processes when done.
