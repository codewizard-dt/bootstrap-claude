---
name: task-trash
description: Delete a task and its related UAT files, then remove all references
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

Delete a task file (and any related UAT files), then remove all references to them.

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
- Ask: **"Delete these files? (Yes/No)"**

If the user says **No**, STOP.

### Step 4: Delete Files

1. **Delete the task file**:
   - Use `git rm <source>` (fall back to `rm` if `git rm` fails)

2. **Delete related UAT files** (if any):
   - Use `git rm <source>` for each (fall back to `rm` if `git rm` fails)

### Step 5: Update References

Search for and update any references to the moved files across the project:

1. Use Serena's `search_for_pattern` to find all references to the trashed task filename and UAT filename(s) across:
   - `wiki/work/tasks/README.md` (task index)
   - `PROJECT_STATUS.md`
   - Other task files that may cross-reference this task
   - Any UAT files that reference the task

2. For each reference found:
   - If in `wiki/work/tasks/README.md`: **delete the task's row** from the Active Tasks table entirely (the index has no Completed table — completed tasks live in `wiki/work/tasks/  `). If the task was already completed and so has no row in the index, the row-removal is a silent no-op. **Then check the header**: if the **Last task:** line at the top of the README references this task, `Edit` it to remove the reference (set it to `—` or the previous task). Do **not** decrement **Next task number** — it only ever goes up.
   - If in another status/index file: **remove the line entirely** — the file no longer exists.
   - If in another task/UAT file's `Source task` or `UAT` link: **remove the link line entirely** — the referenced file is gone.

3. Use the **`Edit`** tool to make the updates — one `Edit` call per replacement. **Never** use `sed`, `awk`, or `perl -i` to bulk-rewrite paths across files, even when many references need updating. See `.docs/guides/mcp-tools.md` "Common anti-patterns".

### Step 6: Report Completion

Report what was done:

- Task file deleted: `<old path>`
- UAT file(s) deleted: `<old path>` (or "None")
- References updated: list each file that was modified
