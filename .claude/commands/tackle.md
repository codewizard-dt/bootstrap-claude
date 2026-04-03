---
description: Tackle an outlined task file step-by-step
argument-hint: <path/to/task.md, number-slug, or description>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Tackle Outline

Execute tasks from an outlined `*.md` file in cycles, delegating each step to a subagent.

---

**Outline File**: $ARGUMENTS

---

## Step 0: Resolve the Task File

Parse `$ARGUMENTS` to locate the task file:

1. **If a file path is provided** (e.g., `.docs/tasks/active/3-user-auth.md`):
   - Confirm the file exists (use Serena `find_file` or `list_dir`)
   - If the file does not exist, STOP and report the error

2. **If a number-slug is provided** (e.g., `3-user-auth`):
   - Search `.docs/tasks/active/` for `<number-slug>.md`
   - If not found, STOP and report the error

3. **If only a description or number is provided** (e.g., `user auth` or `3`):
   - Search `.docs/tasks/active/` for a matching task file
   - If ambiguous, list matches and ask the user to clarify
   - If no match found, STOP and report the error

Use the resolved file path as the outline for all subsequent steps.

---

IMPORTANT: Adhere to all rules in '.docs/guides/mcp-tools.md'

## MANDATORY: MCP Serena for All Code Operations

All sub-agents delegated from this command **MUST** use MCP Serena tools for code exploration and editing. This is non-negotiable.

| Operation | MUST Use | NEVER Use |
|-----------|----------|-----------|
| Explore code structure | Serena `get_symbols_overview` | `Read` on code files |
| Find function/class | Serena `find_symbol` | `Grep` on code files |
| Edit code | Serena symbolic or file/line tools | Standard `Edit` on code files |
| Search code | Serena `search_for_pattern` | `Grep` |
| Find files | Serena `find_file`, `list_dir` | `Glob`, `find` |
| Library docs | Context7 MCP | `WebSearch` / `WebFetch` |

**Exceptions** — standard Read/Edit/Write tools are permitted ONLY for non-code files (JSON, YAML, config). Markdown files must use Serena.

Every sub-agent prompt **MUST** include this instruction:
> "Use MCP Serena for all code exploration and editing, including markdown files. Do NOT use Read, Edit, Grep, or Glob on code or markdown files. See `.docs/guides/mcp-tools.md` for the full tool reference."

---

## Cycle Overview

> **MANDATORY**: Every step in this cycle MUST be delegated to a sub-agent. The main agent orchestrates only — it reads sub-agent results, decides what to do next, and delegates again. This keeps the main context window clean and prevents token bloat.

This command runs in a continuous loop until all tasks are complete or interrupted:

```
┌──────────────────────────────────────────────────────────────────┐
│  1. DELEGATE: READ  → 2. DELEGATE: PLAN → 3. DELEGATE: EXECUTE  │
│         ↑                                           │            │
│         │                                           ↓            │
│         └──────────── 4. DELEGATE: UPDATE ──────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Read and Parse the Outline

**Delegate this step** to an `Explore` sub-agent. The sub-agent reads and parses the outline, then returns a structured summary of task statuses. The main agent should NOT read the outline directly.

- Use MCP Serena to read the outline file at: `$ARGUMENTS`
- If the file does not exist or is empty, STOP and report the error
- Parse the structure to identify:
  - **Completed items**: Marked with `[x]`, `- [x]`, `[DONE]`, or strikethrough `~~text~~`
  - **In-progress items**: Marked with `[ ]`, `- [ ]`, `[WIP]`, or similar
  - **Not started items**: Unmarked list items or sections without status markers
  - **Blocked items**: Marked with `[BLOCKED]` or similar

---

## Step 2: Find the Smallest Next Step

**Delegate this step** to a `Plan` sub-agent. Provide the sub-agent with the parsed summary from Step 1. The sub-agent analyzes priorities and returns the next actionable task with a recommended agent type. The main agent should NOT analyze the outline directly.

The sub-agent analyzes the outline to find the next actionable task:

### Priority Order
1. **Fix blockers first**: If any item is marked blocked, investigate why
2. **Continue in-progress work**: If something is WIP, prioritize completing it
3. **Start next incomplete item**: Find the first unmarked/incomplete task

### Determine the "Smallest Step"
- If a task has sub-items, work on the first incomplete sub-item
- If a task is high-level (e.g., "Implement feature X"), break it down into:
  - Component work → delegate to `component-architect`
  - Style/theme work → delegate to `style-theme-guardian`
  - MDX/article content → delegate to `mdx-content-handler`
  - Codebase exploration → delegate to `Explore`
  - Implementation planning → delegate to `Plan`
  - General tasks → delegate to `general-purpose`
- Always choose the smallest, most atomic task that can be completed independently

### Completion Check
- If ALL items are marked complete:
  - Move the task file: `git mv .docs/tasks/active/<filename>.md .docs/tasks/pending-uat/<filename>.md` (fall back to `mv` if `git mv` fails)
  - Report success and STOP
  - Output: "All tasks in outline complete! Task moved to pending-uat."

---

## Step 3: Delegate to Appropriate Subagent(s)

**Delegate this step** to the appropriate specialized sub-agent identified in Step 2. All implementation work runs in a sub-agent — never in the main context.

### Research Before Implementing

Before creating a plan or delegating work, gather implementation context:

1. **Review existing code**: Use Serena's `get_symbols_overview`, `find_symbol`, and `search_for_pattern` to explore relevant files and symbols. Understand current patterns, data flow, and conventions before making changes. Do NOT use Read/Grep/Glob on code files.
2. **Check project context**: Review `PROJECT_STATUS.md`, `CLAUDE.md`, and any related existing code to understand constraints and dependencies.
3. **Library/framework lookups**: **NEVER search `node_modules/` for exports, types, or usage examples.** Use Context7 MCP (`resolve-library-id` → `query-docs`) for library documentation and Brave Search MCP for general web research. Searching `node_modules/` wastes tokens and produces unreliable results.
4. **Clarify ambiguous implementation details**: If there are multiple valid approaches to implementing a task (e.g., component structure, data model changes, API design), use `AskUserQuestion` to present options with descriptions before committing to an approach. Do not guess — ask.

### Plan and Delegate

Create a plan on how to complete the task. For each step of your plan, delegate to an appropriate sub-agent:

**CRITICAL**

1) Absolute maximum of 3 sub-processes at a time
2) **ALWAYS** terminate processes when done (dev servers, type checkers, long-running commands)


### Agent Selection Guide

| Task Type | Agent | Indicators |
|-----------|-------|------------|
| Component creation/editing | `component-architect` | Files in `src/components/`, React islands, UI components |
| Style/theme changes | `style-theme-guardian` | Files in `src/styles/`, CSS custom properties, theme tokens |
| MDX content/articles | `mdx-content-handler` | MDX files, content collections, article templates, FrontMatter CMS |
| Codebase exploration | `Explore` | "Where is", "how does", "find all", understanding code |
| Implementation design | `Plan` | Architecture decisions, feature design, multi-file changes |
| General/unclear | `general-purpose` | Default for multi-step research or unclear tasks |

### Subagent Requirements

When delegating, **every** sub-agent prompt MUST include:

1. **MCP Serena mandate**: "Use MCP Serena for all code exploration and editing. Do NOT use Read, Edit, Grep, or Glob on code files. See `.docs/guides/mcp-tools.md` for the full tool reference."
2. **Execute the specific task** described in the outline item
3. **Run quality gates** after completing the work:
   - After any code changes: `pnpm typecheck`
   - **Assume all type errors are caused by your changes.** The codebase passes typecheck before each `/tackle` cycle (enforced by `/update` and `/git-commit`). Do NOT run `git stash` to check if errors are pre-existing — they are not. Fix them.
4. **Report completion status** (success, partial, or failure with reason)

### Example Delegation

```
Task tool invocation:
  subagent_type: "component-architect"
  prompt: |
    **MANDATORY**: Use MCP Serena for all code exploration and editing.
    Do NOT use Read, Edit, Grep, or Glob on code files.
    See `.docs/guides/mcp-tools.md` for the full tool reference.

    Complete this task from the outline:

    Task: "Update Header component to fix H1 misuse"

    Requirements from outline:
    - Change logo wrapper from h1 to div
    - Maintain existing styling
    - Verify no accessibility regressions

    After completing the work:
    1. Run `pnpm typecheck` to verify no type errors
    2. If typecheck fails, fix the errors — they are from your changes (do NOT git stash to check)
    3. Report success or any issues encountered
```

---

## Step 4: Update the Outline with Status

**Delegate this step** to a `general-purpose` sub-agent. Provide the sub-agent with the completion status from Step 3 and instruct it to update the outline file. The main agent should NOT edit the outline directly.

After the subagent completes (or fails), update the outline file:

### Status Markers to Use
- `[x]` or `- [x]` - Task completed successfully
- `[WIP]` - Work in progress (if partially done)
- `[BLOCKED: reason]` - Blocked by something
- `[FAILED: reason]` - Failed, needs attention

### Update Process

1. Use MCP Serena's `replace_content` tool to update the task status
2. Add a timestamp comment if helpful: `<!-- Updated: YYYY-MM-DD HH:MM -->`
3. If subtasks were discovered during execution, add them to the outline

### Example Update

Before:
```markdown
- [ ] Fix Header H1 misuse (change logo wrapper from h1 to div)
```

After:
```markdown
- [x] Fix Header H1 misuse (change logo wrapper from h1 to div) <!-- Completed: 2026-03-02 -->
```

---

## Step 5: Repeat the Cycle

After updating the outline:

1. **Return to Step 1** - Read the updated outline
2. **Find the next incomplete task** - Step 2
3. **Delegate** - Step 3
4. **Update** - Step 4
5. **Continue** until all tasks are complete or you are interrupted

---

## Important Rules

### Process Management
- Maximum of 3 concurrent subagents at a time
- **ALWAYS terminate ALL processes and sub-agents when done** — dev servers, type checkers, long-running commands, background tasks. No exceptions.
- After EVERY sub-agent completes, verify it has been terminated before proceeding
- If a subagent hangs, terminate it immediately and mark the task as blocked
- The main agent must NEVER run implementation commands directly — always delegate

### Error Handling
- If a subagent fails, mark the task with `[FAILED: reason]`
- Do not retry failed tasks automatically - continue with next available task
- If all remaining tasks are blocked/failed, STOP and report status

### Progress Reporting
After each cycle, briefly report:
- What was just completed
- What will be tackled next
- Overall progress (X of Y tasks complete)

### Stopping Conditions
- All tasks marked as `[x]` complete
- User interrupts with Ctrl+C
- All remaining tasks are blocked or failed
- Outline file becomes invalid or unreadable

### Mandatory Delegation
- **ALL steps** (read, plan, execute, update) MUST be delegated to sub-agents
- The main agent's role is strictly orchestration: receive results, decide next action, delegate
- NEVER read source code, edit files, or run commands directly in the main context
- This preserves the main context window for decision-making and prevents token bloat

---

## Example Outline Format

The outline file should follow this general structure:

```markdown
# Task: SEO Quick Technical Wins

## On-Page Fixes
- [ ] Fix Header H1 misuse (change logo h1 to div)
- [ ] Fix duplicate ID on pricing page
- [ ] Fix portal page meta description curly quotes
- [ ] Add logo.png to public directory

## Schema Improvements
- [ ] Remove empty sameAs array from JSON-LD
- [ ] Expand areaServed to include surrounding cities
- [ ] Fix NAP inconsistency across all pages

## Page Title Updates
- [ ] Add "Austin, TX" to services page title
- [ ] Add "Austin, TX" to about page title
- [ ] Add "Austin, TX" to contact page title
- [ ] Add "Austin, TX" to pricing page title
```

---

## Pre-Execution: Check Pending UAT Queue

Before starting the cycle, check if there are tasks awaiting UAT:

1. Use Serena's `list_dir` tool on `.docs/tasks/pending-uat/` to list files
2. Count the number of task files (exclude `.gitkeep` or other non-task files)
3. If there are **1 or more** task files:
   - Use `AskUserQuestion` to show: **"There are X task(s) awaiting UAT. Are you sure you want to execute this task now?"**
   - If the user says **No** — STOP execution and suggest: `Run /uat-walkthrough on a pending UAT file first.`
   - If the user says **Yes** — proceed with the cycle below
4. If there are **0** task files, proceed immediately

---

## Begin Execution

Now execute the cycle:

1. Read the outline at: `$ARGUMENTS`
2. Identify the first incomplete task
3. Delegate to the appropriate agent(s)
4. Update the outline
5. Repeat until done
6. **Move the task file**: `git mv .docs/tasks/active/<filename>.md .docs/tasks/pending-uat/<filename>.md` (fall back to `mv` if `git mv` fails)
7. Ask the user: **"Generate UAT tests for this task?"** using `AskUserQuestion`:
   - **Yes** — Run `/uat-generator .docs/tasks/pending-uat/<filename>` to create a UAT file in `.docs/uat/pending/` matching this task's naming
   - **No** — Skip UAT generation
8. Run the `/update` skill (this ensures any generated UAT file is included in the documentation update)
9. If UAT was generated in step 7, suggest: `/uat-walkthrough .docs/uat/pending/<file>.uat.md`

**Start now - read the outline and begin the first cycle.**
