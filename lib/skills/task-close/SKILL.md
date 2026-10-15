---
name: task-close
description: Close out an abandoned task and its related UAT files — sets status trashed, moves them to archive/, and removes all active-index references
category: planning
model: claude-haiku-4-5-20251001
argument-hint: <path/to/task-file.md>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/tasks/lifecycle.md`; run /primer if not done this session.

# Close Task

Move a task file (and any related UAT files) to `archive/`, then remove all active-index references. No files are ever deleted — archiving is the terminal action.

---

**Task File**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the Task File

Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: tasks · scope: active+archive · ambiguous: interactive (list matches, ask the user to clarify) · empty: STOP and report the error

Then:

1. Determine which directory the task currently lives in (`wiki/work/tasks/` or `wiki/work/tasks/archive/`)
2. Extract the task's **number-slug identifier** (e.g., `TASK-0003-user-auth` from `TASK-0003-user-auth.md`)

### Step 2: Find Related UAT Files

Using the task's number-slug identifier, search for matching UAT files:

1. Check `wiki/work/uat/` for `<number>-<slug>.uat.md`
2. Check `wiki/work/uat/archive/` for `<number>-<slug>.uat.md`
3. Collect all matches — there may be zero, one, or multiple related UAT files

### Step 3: Confirm with the User

Before moving anything, use `AskUserQuestion` to confirm. Show:

- **Task file** to be trashed: `$ARGUMENTS`
- **UAT file(s)** to be trashed (list each, or "None found")
- Ask: **"Archive these files as trashed? (Yes/No)"**

If the user says **No**, STOP.

### Step 4: Archive the task and its UAT files

Read `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` now. Run its Procedure for the task (`family: tasks`, `terminal_status: trashed`, log op `task-trashed`), then once per related UAT file (`family: uat`, `terminal_status: trashed`, `log: skip`).

The task's log entry (the procedure's `log` input) is:

```
## [YYYY-MM-DD] task-trashed | TASK-NNNN <title> — archived to wiki/work/tasks/archive/
```

**Do NOT remove references from roadmaps, decisions, or other files** — `[[TASK-NNNN]]` and `[[UAT-NNNN]]` IDs remain valid regardless of file location.

### Step 5: Report Completion

Report what was done:

| Field | Value |
|-------|-------|
| Task file | `wiki/work/tasks/<file>.md` → `wiki/work/tasks/archive/<file>.md` |
| UAT file(s) | `wiki/work/uat/<file>.md` → `wiki/work/uat/archive/<file>.md` (or "None") |
| Active index rows removed | task index, UAT index (as applicable) |
| Archive index rows added | task archive index, UAT archive index (as applicable) |
| wiki/log.md entry | yes |
