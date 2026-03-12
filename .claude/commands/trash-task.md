---
description: Move a task and its related UAT files to trashed directories
argument-hint: <path/to/task-file.md>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Trash Task

Move a task file (and any related UAT files) to their respective `trashed/` directories, then update all references.

---

**Task File**: $ARGUMENTS

---

## Instructions

### Step 1: Validate the Task File

1. Confirm the file at `$ARGUMENTS` exists (use Serena `list_dir` or `find_file`)
2. If the file does not exist, STOP and report the error
3. Determine which directory the task currently lives in (`active/`, `pending-uat/`, or `completed/`)
4. Extract the task's number-slug identifier (e.g., `3-user-auth` from `3-user-auth.md`)

### Step 2: Find Related UAT Files

Using the task's number-slug identifier, search for matching UAT files:

1. Check `.docs/uat/pending/` for `<number>-<slug>.uat.md`
2. Check `.docs/uat/completed/` for `<number>-<slug>.uat.md`
3. Collect all matches — there may be zero, one, or multiple related UAT files

### Step 3: Confirm with the User

Before moving anything, use `AskUserQuestion` to confirm. Show:

- **Task file** to be trashed: `$ARGUMENTS`
- **UAT file(s)** to be trashed (list each, or "None found")
- Ask: **"Move these files to trashed? (Yes/No)"**

If the user says **No**, STOP.

### Step 4: Move Files

1. **Ensure directories exist**:
   - `mkdir -p .docs/tasks/trashed/`
   - `mkdir -p .docs/uat/trashed/`

2. **Move the task file**:
   - Use `git mv <source> .docs/tasks/trashed/<filename>` (fall back to `mv` if `git mv` fails)

3. **Move related UAT files** (if any):
   - Use `git mv <source> .docs/uat/trashed/<filename>` for each (fall back to `mv` if `git mv` fails)

### Step 5: Update References

Search for and update any references to the moved files across the project:

1. Use Serena's `search_for_pattern` to find all references to the trashed task filename and UAT filename(s) across:
   - `.docs/tasks/README.md` (task index)
   - `PROJECT_STATUS.md`
   - Other task files that may cross-reference this task
   - Any UAT files that reference the task

2. For each reference found:
   - If in an index or status file: **remove the line** or update the path to reflect the new `trashed/` location
   - If in another task/UAT file's `Source task` or `UAT` link: **update the path** to `trashed/`

3. Use Serena's file editing tools (`replace_content`) to make the updates

### Step 6: Report Completion

Report what was done:

- Task file moved: `<old path>` → `.docs/tasks/trashed/<filename>`
- UAT file(s) moved: `<old path>` → `.docs/uat/trashed/<filename>` (or "None")
- References updated: list each file that was modified

Suggest next steps:
```
To undo, move files back:  git mv .docs/tasks/trashed/<filename> <original-directory>/
To permanently delete:     rm .docs/tasks/trashed/<filename>
```
