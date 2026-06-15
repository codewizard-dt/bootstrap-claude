---
name: task-trash
description: Trash a task and its related UAT files — moves them to archive/ and removes all active-index references
category: planning
model: claude-haiku-4-5-20251001
argument-hint: <path/to/task-file.md>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `wiki/work/tasks/lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Trash Task

Move a task file (and any related UAT files) to `archive/`, then remove all active-index references. No files are ever deleted — archiving is the terminal action.

---

**Task File**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the Task File

Parse `$ARGUMENTS` to locate the task file:

1. **If a file path is provided** (e.g., `wiki/work/tasks/3-user-auth.md`):
   - Confirm the file exists (use Serena `find_file` or `list_dir`)
   - If the file does not exist, STOP and report the error

2. **If a number-slug is provided** (e.g., `3-user-auth`):
   - Search `wiki/work/tasks/` for `<number-slug>.md`
   - If not found, check `wiki/work/tasks/  `
   - If still not found, STOP and report the error

3. **If only a description or number is provided** (e.g., `user auth` or `3`):
   - Search `wiki/work/tasks/` and `wiki/work/tasks/  ` for a matching task file
   - If ambiguous, list matches and ask the user to clarify
   - If no match found, STOP and report the error

4. Determine which directory the task currently lives in (`wiki/work/tasks/` or `completed/`)
5. Extract the task's **number-slug identifier** (e.g., `3-user-auth` from `3-user-auth.md`)

### Step 2: Find Related UAT Files

Using the task's number-slug identifier, search for matching UAT files:

1. Check `wiki/work/uat/` for `<number>-<slug>.uat.md`
2. Check `wiki/work/uat/  ` for `<number>-<slug>.uat.md`
3. Collect all matches — there may be zero, one, or multiple related UAT files

### Step 3: Confirm with the User

Before moving anything, use `AskUserQuestion` to confirm. Show:

- **Task file** to be trashed: `$ARGUMENTS`
- **UAT file(s)** to be trashed (list each, or "None found")
- Ask: **"Archive these files as trashed? (Yes/No)"**

If the user says **No**, STOP.

### Step 4: Set status and archive files

1. **Update `status: <current>` → `status: trashed`** in the task file frontmatter using `Edit`.

2. **Archive the task file** (Bash — `git mv` only):
   ```
   git mv wiki/work/tasks/<file>.md wiki/work/tasks/archive/<file>.md
   ```
   Then append to `wiki/work/tasks/archive/index.md`:
   ```
   | [[TASK-NNN]] | <Title> | trashed | YYYY-MM-DD |
   ```

3. **For each related UAT file** (if any):
   - Update `status: <current>` → `status: trashed` in UAT frontmatter using `Edit`.
   - Archive it (Bash — `git mv` only):
     ```
     git mv wiki/work/uat/<UAT-file>.md wiki/work/uat/archive/<UAT-file>.md
     ```
   - Append to `wiki/work/uat/archive/index.md`:
     ```
     | [[UAT-NNN]] | <Title> | trashed | YYYY-MM-DD |
     ```

### Step 5: Update Active Indexes

Remove the task's row from `wiki/work/tasks/index.md`. If there is a matching UAT row in `wiki/work/uat/index.md`, remove it too.

Use `Read` then `Edit` — never `echo >>` or `sed`. If a row is already absent, note it and continue.

**Do NOT remove references from roadmaps, decisions, or other files** — `[[TASK-NNN]]` and `[[UAT-NNN]]` IDs remain valid regardless of file location.

### Step 6: Append to wiki/log.md

Append one entry to `wiki/log.md`:

```
## [YYYY-MM-DD] task-trashed | TASK-NNN <title> — archived to wiki/work/tasks/archive/
```

Use `Read` then `Edit` — never `echo >>`.

### Step 7: Report Completion

Report what was done:

| Field | Value |
|-------|-------|
| Task file | `wiki/work/tasks/<file>.md` → `wiki/work/tasks/archive/<file>.md` |
| UAT file(s) | `wiki/work/uat/<file>.md` → `wiki/work/uat/archive/<file>.md` (or "None") |
| Active index rows removed | task index, UAT index (as applicable) |
| Archive index rows added | task archive index, UAT archive index (as applicable) |
| wiki/log.md entry | yes |
