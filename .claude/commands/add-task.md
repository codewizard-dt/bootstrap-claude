---
description: Add a new task to .docs/tasks
argument-hint: <task description>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


$ARGUMENTS

---

**Instructions:**

1) **Read the task spec**: Read `.docs/tasks/active/README.md` for the required file format, naming convention, and example output. Follow it exactly.

2) **Summarize the user input**: Extract the core task objective, scope, and any specific requirements from the provided arguments.

3) **Assess existing tasks**: Check `.docs/tasks/active/`, `.docs/tasks/pending-uat/`, and `.docs/tasks/completed/` to determine the next task number.

4) **Research**: Before planning, conduct thorough internal and external research:
   - **Internal**: Review `PROJECT_STATUS.md`, `CLAUDE.md`, and any related existing code to understand constraints and dependencies. Use Serena's `get_symbols_overview`, `find_symbol`, and `search_for_pattern` to explore relevant files and understand current patterns, data flow, and conventions.
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

7) **Create the task file**: After user confirmation, create a fully detailed, execution-ready task file in `.docs/tasks/active/` following the format specified in `.docs/tasks/active/README.md`.

   **CRITICAL — The task file IS the plan.** `/tackle` will execute steps verbatim without re-planning. Every step must include:
   - **Specific file paths** to create or modify
   - **Function/component names** to implement
   - **Agent type annotation** on each section header (e.g., `### 1. Create API Route  <!-- agent: general-purpose -->`)
   - **Enough implementation detail** that an agent can execute without ambiguity or further research
   - **Sub-details** as plain-text indented lines under checkboxes for acceptance criteria

   Agent type annotations use an HTML comment on the section header line:
   ```markdown
   ### 1. Section Name  <!-- agent: general-purpose -->
   ```
   Valid agent types: `general-purpose`, `Explore`, `Plan`

8) **Update the task index**: Add a reference to the new task in `.docs/tasks/README.md` under the "Active Tasks" section (create the file if it doesn't exist).

9) **Update `PROJECT_STATUS.md`**: If it exists, update any references to this task or add it under the appropriate phase.

10) **Confirm completion**: Report the created task file path and summary to the user. Suggest next steps:
   ```
   To implement this task:  /tackle .docs/tasks/active/<number>-<slug>.md
   ```
   Note: `/tackle` will move the task to `pending-uat/` on completion, then offer to run `/uat-generator`.
