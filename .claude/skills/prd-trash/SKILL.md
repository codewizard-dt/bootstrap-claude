---
name: prd-trash
description: Delete a cancelled PRD, surface linked ADRs/tasks for separate review, and remove all references
model: claude-haiku-4-5-20251001
argument-hint: <path/to/prd.md, NNN-slug, or NNN>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**
**Read `.docs/prd/README.md` first** — it defines the PRD lifecycle and terminal states.

# Trash PRD

Delete a cancelled or invalidated PRD, remove all references, and **surface** any linked ADRs and tasks so the user can act on them independently. This skill never auto-cascades downstream — the PRD layer cannot transitively cancel decisions or work that may have value on their own.

---

**PRD**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the PRD File

Parse `$ARGUMENTS` to locate the PRD:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `.docs/prd/003-search.md`) | Confirm the file exists via `mcp__serena__find_file` or `mcp__serena__list_dir`. If missing, STOP. |
| `<NNN-slug>` (e.g. `003-search`) | Search `.docs/prd/` first, then `.docs/prd/archived/` for `<NNN-slug>.md`. |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits. Use `mcp__serena__find_file` with mask `NNN-*.md` across `.docs/prd/` and `.docs/prd/archived/`. |
| Description (e.g. `search`) | Search both directories. If ambiguous, list matches and ask via `AskUserQuestion`. |
| Empty / missing | List every PRD in `.docs/prd/` and `.docs/prd/archived/` and ask the user via `AskUserQuestion`. |

Determine which directory the PRD currently lives in (`.docs/prd/` or `archived/`). Extract the file's `NNN-slug` identifier.

### Step 2: Read the PRD and Identify Linked Downstream Artifacts

1. `Read` the resolved PRD file in full.
2. Extract `## Linked ADRs` table rows — collect each `ADR-NNNN#DM` reference.
3. Extract `## Linked Tasks` table rows — collect each task path.
4. For each linked ADR, use `mcp__serena__list_dir` and `Read` to verify the ADR file exists and capture the per-decision status (`proposed` / `accepted` / `superseded`).
5. For each linked task, verify the file exists in `.docs/tasks/` or `.docs/tasks/completed/` and capture its status.
6. Build a downstream artifacts table:

| Artifact | Type | Current Status | Suggested User Action |
|----------|------|----------------|------------------------|
| ADR-0007#D2 | linked ADR | accepted | Review independently — accepted ADRs are immutable; if no longer needed, write a deprecating successor via `/adr-create` |
| ADR-0008#D1 | linked ADR | proposed | Review independently — consider whether to abandon, finalize, or modify via `/adr-create` |
| `.docs/tasks/004-foo.md` | linked task | WIP | Run `/task-trash .docs/tasks/004-foo.md` if the task is also cancelled |
| `.docs/tasks/completed/003-bar.md` | linked task | done | No action — completed work stands |

### Step 3: Confirm With the User

Use `AskUserQuestion` to confirm the deletion. Show:

- The PRD file to be deleted (full path)
- The downstream artifacts table from Step 2
- Ask: **"Delete this PRD? (yes / no)"**

**Do NOT ask whether to trash the linked ADRs or tasks** — they are surfaced as suggestions only. The PRD layer cannot transitively cancel decisions or work that may have independent value.

If the user did not supply a trash reason in `$ARGUMENTS`, also ask: **"Reason for trashing this PRD? (one line)"**

If the user says **No**, STOP.

### Step 4: Delete the PRD File

Use `git rm .docs/prd/<filename>` to remove the file. Fall back to `rm` only if `git rm` fails.

### Step 5: Update References Across the Project

Use `mcp__serena__search_for_pattern` (or `Grep` as fallback) to find references to the PRD's filename across:

- `.docs/prd/README.md` (PRD index)
- `PROJECT_STATUS.md`
- All ADR files in `.docs/adr/` (looking for `Source PRD:` cross-links)
- All task files in `.docs/tasks/` and `.docs/tasks/completed/` (looking for `**PRD**:` lines)

For each reference found:

| Reference location | Update rule |
|--------------------|-------------|
| **PRD index row in `.docs/prd/README.md`** | **Remove the row entirely** — the PRD is deleted, not relocated. |
| **Cross-link in an ADR or task** (`Source PRD:` / `**PRD**:`) | **Remove the cross-link line** — the PRD no longer exists. |

Use `Edit` for each replacement — **one `Edit` call per file**. Never use `sed`, `awk`, `perl -i`, or `echo >>`. See `.docs/guides/mcp-tools.md` "Common anti-patterns".

### Step 6: Report Completion

Output a tabular summary:

| Field | Value |
|-------|-------|
| PRD | `PRD-NNN <title>` |
| Old path | `<original>` |
| New path | deleted |
| References updated | <count> |
| Linked ADRs surfaced for review | <count> |
| Linked tasks surfaced for review | <count> |

Then list the suggested next-action commands (one per surfaced artifact, where applicable):

```
To act on linked tasks (each independently):
  /task-trash .docs/tasks/004-foo.md  # if also cancelled

To act on linked ADRs (each independently):
  # Accepted ADRs are immutable — write a deprecating successor:
  /adr-create deprecate <topic> (supersedes ADR-NNNN#DM)
  # Proposed ADRs may be left, finalized, or modified
```

---

## Output Formatting Rules

1. Use tables for the downstream artifacts list and the completion report — never paragraph prose.
2. **One `Edit` call per cross-reference update** — never bulk rewrites.
3. **Cross-links in ADRs/tasks are removed** — the PRD no longer exists and dead links must not be left behind.
4. **The PRD index row is removed on deletion** — the PRD is gone, not relocated.
5. **The skill never auto-trashes or auto-deprecates downstream artifacts** — it surfaces them with suggested commands.

---

## Critical Rules

1. **Never auto-cascade** to linked ADRs or tasks. Surface them as suggestions only.
2. **Index rows are removed** — the PRD is deleted; remove the row, do not preserve it.
3. **Cross-links are removed** — the PRD no longer exists; remove dead references, do not update paths.
4. **Use `git rm`** to delete the file; fall back to `rm` only if `git rm` fails.
5. **Never use `sed` / `awk` / `perl -i` / `echo >>`** — always `Edit`. See `.docs/guides/mcp-tools.md` "Common anti-patterns".
6. **Confirm with the user before deletion** — `AskUserQuestion` is mandatory before any filesystem change.
7. Maximum 3 sub-processes at a time if delegating any step.
8. Always terminate background processes when done.
