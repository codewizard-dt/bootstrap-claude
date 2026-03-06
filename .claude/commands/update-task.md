---
description: Modify an existing task by expanding or redefining scope
argument-hint: <path/to/task.md> <description of changes>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**


$ARGUMENTS

---

**Instructions:**

1) **Read the task spec**: Read `.docs/tasks/active/README.md` for the required file format and structure. The updated task must continue to follow this spec.

2) **Parse the arguments**: The first argument should be a path to an existing task file. The remaining text describes the desired changes (new scope, additional steps, revised objective, etc.). If no path is provided, list available tasks and ask the user to select one.

3) **Read the existing task**: Read the task file and understand its current objective, approach, prerequisites, and steps. Note which steps are already completed (`[x]`) — these must be preserved.

4) **Research and clarify**: Review codebase context relevant to the proposed changes. If the scope change has multiple valid approaches, use `AskUserQuestion` to present options before proceeding.

5) **Present the changes**: Before modifying the file, present a summary of what will change:
   - Original objective vs. updated objective (if changed)
   - New or modified steps (clearly marked)
   - Removed steps (if any — explain why)
   - Steps that remain unchanged
   Ask the user to confirm before proceeding.

6) **Update the task file**: Apply the changes while preserving:
   - Completed steps (`[x]`) — never remove or uncheck these
   - The task number and filename (do not rename)
   - The overall file format from `.docs/tasks/active/README.md`

7) **Update related docs**: If the task is referenced in `.docs/tasks/README.md` or `PROJECT_STATUS.md`, update the description to reflect the new scope.

8) **Confirm completion**: Report what changed and the updated task file path. Suggest next steps:
   ```
   To implement this task:  /tackle <path/to/task.md>
   ```
