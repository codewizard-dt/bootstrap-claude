---
description: Add a new task to .docs/tasks
argument-hint: <task description>
---

$ARGUMENTS

---

**Instructions:**

1) **Summarize the user input**: Extract the core task objective, scope, and any specific requirements from the provided arguments.

2) **Assess existing tasks**: Read `.docs/tasks/README.md` to understand the current task structure and numbering. Check `.docs/tasks/active/` for existing active tasks to determine the next task number or appropriate naming.

3) **Research and clarify**: Before planning, review existing documentation and codebase context relevant to the task. Check `PROJECT_STATUS.md`, `CLAUDE.md`, and any related existing code to understand constraints and dependencies. **Always ask clarifying questions if there are multiple valid approaches** — use `AskUserQuestion` to present options with descriptions before committing to an approach.

4) **Present your plan**: Before creating the task file, present a summary of the planned task structure to the user. Include:
   - Core objective
   - Key architecture/design decisions (informed by clarifying questions)
   - High-level step breakdown
   Ask the user to confirm before proceeding.

5) **Create the task file**: After user confirmation, create a new task file in `.docs/tasks/active/` following the naming convention `<number>-<short-description>.md`. The file should contain a comprehensive outlined plan with checkboxes compatible with `/tackle`. Structure it as:
   - Title and objective
   - Tech stack / approach notes
   - Prerequisites (if any)
   - Step-by-step checklist with `- [ ]` items
   - Grouped by logical sections (e.g., "Component Changes", "Page Updates", "Schema Updates")

6) **Update the task index**: Add a reference to the new task in `.docs/tasks/README.md` under the "Active Tasks" section.

7) **Update `PROJECT_STATUS.md`**: Update any references to this task, or add the task if it's not there. Assess the proper location and place it in an existing phase or note it as a standalone task.

8) **Confirm completion**: Report the created task file path and summary to the user. Suggest next steps:
   ```
   To implement this task:  /tackle .docs/tasks/active/<number>-<slug>.md
   To generate UAT tests:   /uat-generator .docs/tasks/active/<number>-<slug>.md
   ```
