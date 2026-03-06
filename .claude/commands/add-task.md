---
description: Add a new task to .docs/tasks
argument-hint: <task description>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**


$ARGUMENTS

---

**Instructions:**

1) **Read the task spec**: Read `.docs/tasks/active/README.md` for the required file format, naming convention, and example output. Follow it exactly.

2) **Summarize the user input**: Extract the core task objective, scope, and any specific requirements from the provided arguments.

3) **Assess existing tasks**: Check `.docs/tasks/active/`, `.docs/tasks/pending-uat/`, and `.docs/tasks/completed/` to determine the next task number.

4) **Research**: Before planning, conduct thorough internal and external research:
   - **Internal**: Review `PROJECT_STATUS.md`, `CLAUDE.md`, and any related existing code to understand constraints and dependencies.
   - **External**: Use **Brave Search MCP** and/or **Context7 MCP** to research:
     - Known weaknesses, pitfalls, and common failure modes for this type of task
     - Relevant packages, libraries, or frameworks that could be used
     - Recommended algorithms, patterns, or architectural approaches
     - Best practices and lessons learned from the broader community
   - Synthesize findings into a clear picture of the trade-offs, risks, and viable solutions.

5) **Clarify approach**: Present your research findings and **always ask clarifying questions if there are multiple valid approaches** — use `AskUserQuestion` to present options with descriptions (informed by the research) before committing to an approach.

6) **Present your plan**: Before creating the task file, present a summary of the planned task structure to the user. Include:
   - Core objective
   - Key architecture/design decisions (informed by clarifying questions)
   - High-level step breakdown
   Ask the user to confirm before proceeding.

7) **Create the task file**: After user confirmation, create a new task file in `.docs/tasks/active/` following the format specified in `.docs/tasks/active/README.md`.

8) **Update the task index**: Add a reference to the new task in `.docs/tasks/README.md` under the "Active Tasks" section (create the file if it doesn't exist).

9) **Update `PROJECT_STATUS.md`**: If it exists, update any references to this task or add it under the appropriate phase.

10) **Confirm completion**: Report the created task file path and summary to the user. Suggest next steps:
   ```
   To implement this task:  /tackle .docs/tasks/active/<number>-<slug>.md
   ```
   Note: `/tackle` will move the task to `pending-uat/` on completion, then offer to run `/uat-generator`.
