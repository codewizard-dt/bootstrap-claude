---
name: trash-prd
description: Move a cancelled PRD to .docs/prd/trashed/, surface linked ADRs/tasks for separate review, and update all references
model: claude-sonnet-4-6
argument-hint: <path/to/prd.md, NNN-slug, or NNN>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**
**Read `.docs/prd/README.md` first** — it defines the PRD lifecycle and the `trashed` terminal status.

# Trash PRD

Move a cancelled or invalidated PRD to `.docs/prd/trashed/`, update all references, and **surface** any linked ADRs and tasks so the user can act on them independently. This skill never auto-cascades downstream — the PRD layer cannot transitively cancel decisions or work that may have value on their own.

---

**PRD**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the PRD File

Parse `$ARGUMENTS` to locate the PRD:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `.docs/prd/active/003-search.md`) | Confirm the file exists via `mcp__serena__find_file` or `mcp__serena__list_dir`. If missing, STOP. |
| `<NNN-slug>` (e.g. `003-search`) | Search `.docs/prd/active/` first, then `.docs/prd/archived/` for `<NNN-slug>.md`. |
| `<NNN>` (e.g. `3` or `003`) | Pad to 3 digits. Use `mcp__serena__find_file` with mask `NNN-*.md` across `.docs/prd/active/` and `.docs/prd/archived/`. |
| Description (e.g. `search`) | Search both directories. If ambiguous, list matches and ask via `AskUserQuestion`. |
| Empty / missing | List every PRD across `.docs/prd/active/` and `.docs/prd/archived/` and ask the user via `AskUserQuestion`. |

Determine which directory the PRD currently lives in (`active/` or `archived/`). Extract the file's `NNN-slug` identifier.

### Step 2: Read the PRD and Identify Linked Downstream Artifacts

1. `Read` the resolved PRD file in full.
2. Extract `## Linked ADRs` table rows — collect each `ADR-NNNN#DM` reference.
3. Extract `## Linked Tasks` table rows — collect each task path.
4. For each linked ADR, use `mcp__serena__list_dir` and `Read` to verify the ADR file exists and capture the per-decision status (`proposed` / `accepted` / `superseded`).
5. For each linked task, verify the file exists in `.docs/tasks/active/` or `.docs/tasks/completed/` and capture its status.
6. Build a downstream artifacts table:

| Artifact | Type | Current Status | Suggested User Action |
|----------|------|----------------|------------------------|
| ADR-0007#D2 | linked ADR | accepted | Review independently — accepted ADRs are immutable; if no longer needed, write a deprecating successor via `/create-adr` |
| ADR-0008#D1 | linked ADR | proposed | Review independently — consider whether to abandon, finalize, or modify via `/create-adr` |
| `.docs/tasks/active/004-foo.md` | linked task | WIP | Run `/trash-task .docs/tasks/active/004-foo.md` if the task is also cancelled |
| `.docs/tasks/completed/003-bar.md` | linked task | done | No action — completed work stands |

### Step 3: Confirm With the User

Use `AskUserQuestion` to confirm the move. Show:

- The PRD file to be trashed (full path)
- The downstream artifacts table from Step 2
- Ask: **"Move this PRD to trashed? (yes / no)"**

**Do NOT ask whether to trash the linked ADRs or tasks** — they are surfaced as suggestions only. The PRD layer cannot transitively cancel decisions or work that may have independent value.

If the user did not supply a trash reason in `$ARGUMENTS`, also ask: **"Reason for trashing this PRD? (one line)"**

If the user says **No** to the move, STOP.

### Step 4: Move the PRD File

Use `git mv <source> .docs/prd/trashed/<filename>` to preserve git history. Fall back to `mv` only if `git mv` fails.

**Preserve the filename — do not rename.**

### Step 5: Update References Across the Project

Use `mcp__serena__search_for_pattern` (or `Grep` as fallback) to find references to the PRD's filename across:

- `.docs/prd/README.md` (PRD index)
- `PROJECT_STATUS.md`
- All ADR files in `.docs/adr/` (looking for `Source PRD:` cross-links)
- All task files in `.docs/tasks/active/` and `.docs/tasks/completed/` (looking for `**PRD**:` lines)

For each reference found:

| Reference location | Update rule |
|--------------------|-------------|
| **PRD index row in `.docs/prd/README.md`** | Update the `Status` column to `trashed` and update the `File` column path to `trashed/<filename>`. **The row stays in the index** for traceability — never delete it. |
| **Cross-link in an ADR or task** (`Source PRD:` / `**PRD**:`) | Update the path to `trashed/<filename>`. **Never delete the cross-link** — it documents historical lineage. |

Use `Edit` for each replacement — **one `Edit` call per file**. Never use `sed`, `awk`, `perl -i`, or `echo >>`. See `.docs/guides/mcp-tools.md` "Common anti-patterns".

### Step 6: Update the PRD Body Status and Add Trash Callout

After the move, the PRD itself still says `Status: draft` or `Status: approved`. Edit the file at its new `trashed/` location:

1. Flip the `Status:` field to `trashed`.
2. Insert a top-of-file callout directly under the H1 (mirroring the `/finalize-adr` supersession callout pattern):

   ```markdown
   > **Trashed on YYYY-MM-DD.** Reason: <one-line reason given by user>.
   ```

Use today's date (`2026-05-05` format). The reason comes from `$ARGUMENTS` or the `AskUserQuestion` answer in Step 3.

### Step 7: Report Completion

Output a tabular summary:

| Field | Value |
|-------|-------|
| PRD | `PRD-NNN <title>` |
| Old path | `<original>` |
| New path | `.docs/prd/trashed/<filename>` |
| References updated | <count> |
| Status flipped | yes (was: <old>, now: trashed) |
| Linked ADRs surfaced for review | <count> |
| Linked tasks surfaced for review | <count> |

Then list the suggested next-action commands (one per surfaced artifact, where applicable):

```
To act on linked tasks (each independently):
  /trash-task .docs/tasks/active/004-foo.md  # if also cancelled

To act on linked ADRs (each independently):
  # Accepted ADRs are immutable — write a deprecating successor:
  /create-adr deprecate <topic> (supersedes ADR-NNNN#DM)
  # Proposed ADRs may be left, finalized, or modified
```

Also include undo instructions:

```
To undo, move back:  git mv .docs/prd/trashed/<filename> .docs/prd/active/<filename>
                     # then re-edit Status and remove the trash callout
```

---

## Output Formatting Rules

1. Use tables for the downstream artifacts list and the completion report — never paragraph prose.
2. **One `Edit` call per cross-reference update** — never bulk rewrites.
3. **Cross-links in ADRs/tasks are updated, never deleted** — they preserve historical lineage.
4. **The PRD index row is updated, never deleted** — PRDs in `trashed` status remain in the log for traceability.
5. **The skill never auto-trashes or auto-deprecates downstream artifacts** — it surfaces them with suggested commands.
6. **`git mv` preferred over `mv`** to preserve git history; fall back only on failure.

---

## Critical Rules

1. **Never auto-cascade** to linked ADRs or tasks. Surface them as suggestions only.
2. **Index rows are preserved** — flip status to `trashed`, do not delete the row.
3. **Cross-links are preserved** — update paths to `trashed/`, do not delete the references.
4. **Use `git mv`** to preserve history; fall back to `mv` only if `git mv` fails.
5. **Never use `sed` / `awk` / `perl -i` / `echo >>`** — always `Edit`. See `.docs/guides/mcp-tools.md` "Common anti-patterns".
6. **Confirm with the user before any move** — `AskUserQuestion` is mandatory before any filesystem change.
7. Maximum 3 sub-processes at a time if delegating any step.
8. Always terminate background processes when done.
