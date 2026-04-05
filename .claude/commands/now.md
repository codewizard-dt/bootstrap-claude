---
description: Execute task with planning and delegation
argument-hint: <task description>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


$ARGUMENTS

---

**Instructions:**

1) Summarize the input from the user, determine desired outcomes, and determine what parts of the codebase to assess.
2) **Research**: If the task involves technology choices, architectural decisions, or unfamiliar patterns, run the `/research` workflow (see `.claude/commands/research.md`) to gather internal and external context before planning.
3) Assess all relevant files (use serena mcp) and make a comprehensive plan to achieve desired outcomes.
4) Delegate each step of the plan to the proper sub-agent.

---

**CRITICAL**

1) Absolute maximum of 3 sub-processes at a time
2) **ALWAYS** terminate processes when done** (dev servers, type checkers, long-running commands)
