---
name: tackle
description: Execute an outlined task file step-by-step with subagent delegation
model: claude-sonnet-4-6
argument-hint: <path/to/task.md, number-slug, or description>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/task-lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Tackle Outline

Execute a pre-planned task file step-by-step. The task file IS the plan — no re-planning needed. Each step section specifies its agent type via `<!-- agent: TYPE -->` annotation. This command reads, executes, and updates.

---

**Outline File**: $ARGUMENTS

---

## Step 0: Resolve the Task File

Parse `$ARGUMENTS` to locate the task file:

1. **If a file path is provided** (e.g., `.docs/tasks/3-user-auth.md`):
   - Confirm the file exists (use Serena `find_file` or `list_dir`)
   - If the file does not exist, fall through to case 4

2. **If a number-slug is provided** (e.g., `3-user-auth`):
   - Search `.docs/tasks/` for `<number-slug>.md`
   - If not found, fall through to case 4

3. **If only a description or number is provided** (e.g., `user auth` or `3`):
   - Search `.docs/tasks/` for a matching task file
   - If ambiguous, list matches and ask the user to clarify
   - If no match found, fall through to case 4

4. **If `$ARGUMENTS` is empty OR the input above did not resolve to a task file** — survey active tasks from the index and recommend, do NOT auto-pick:
   - **Read only `.docs/tasks/README.md`** using the `Read` tool. This file is the canonical task index and already contains the columns the survey needs (`#`, `Slug`, `Progress`, `UAT`, `Flags`, `Objective`). Do **NOT** read individual task files in `.docs/tasks/` for the survey — that's what the index exists to prevent.
   - **If the README is missing, has no `## Active Tasks` table, or the table is missing the expected columns**, STOP and report: `Task index at .docs/tasks/README.md is not bootstrapped. Run /primer to bootstrap it, or invoke /tackle <path-or-slug> directly.` Do not fall back to scanning every task file.
   - Use `mcp__serena__list_dir` on `.docs/uat/` only to sanity-check the index's `UAT` column against on-disk reality. If they disagree, trust the disk and quietly note the drift in your output (don't block on it).
   - If the **Active Tasks** table is empty, STOP and report "No active tasks to tackle".
   - **Tool discipline** — DO NOT enumerate, count, grep, or aggregate across `.docs/tasks/` with `bash`, `Read`, or any other tool. The whole point of this gate is to avoid that work. The index row is authoritative for the survey; the only acceptable per-file read is on the chosen task in Step 1.
   - **If the index appears stale** (e.g. you noticed a row with `Progress: 0/0`, missing rows for files in `.docs/tasks/`, or an obviously stale `UAT` column), warn the user inline with one sentence — `Index may be stale: <observation>. Treating its rows as authoritative for now.` — and continue. Do not fix the index pre-emptively; whichever skill mutated state without updating the index should be fixed instead.
   - Present the index's Active rows back to the user as a compact table (you may copy the index table verbatim or compress it). Use `—` for empty cells.
   - Below the table, output a **Recommendation** section ranking the top 1–3 candidates with one-line reasoning each, using this priority order (highest first):
     1. **In-progress tasks without a pending UAT** — at least one `[x]` checkbox, not all complete, no pending UAT (finish what's started)
     2. **Unblock-able tasks** — `[BLOCKED: ...]`/`[FAILED: ...]` whose blocker is plausibly resolvable now (skip if blocker is clearly still outstanding)
     3. **Lowest-numbered fully-pending task** — all `[ ]` checkboxes, no pending UAT, lowest `<NNN>` prefix
     - Tasks with a **pending UAT** must be excluded from the recommendation list and instead surfaced under a separate `**Awaiting UAT**:` line that suggests `/uat-walk .docs/uat/<NNN>-<slug>.uat.md` for each.
   - Use `AskUserQuestion` to ask the user which task to tackle. Offer the top recommendation as the first option (label it `(Recommended)`), include up to 2 additional candidates as further options, and rely on the auto-provided `Other` for free-form input. Use the `header` field for the task number-slug.
   - If `$ARGUMENTS` was non-empty but unresolved, prefix the survey output with one line: `Input \`<arguments>\` did not match an active task — surveying all active tasks instead.`
   - Once the user answers, resolve their choice to a task file path and use it as the outline for all subsequent steps. Do NOT proceed to Step 1 until the user has chosen.

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

**Exceptions** — standard Read/Edit/Write tools are permitted for markdown and config files (JSON, YAML, `.env`). Code files must use Serena. File/directory exploration must always use Serena tools (`list_dir`, `find_file`, `search_for_pattern`) — never `bash` commands like `ls`, `cat`, `find`, `grep`, or `sed`.

**Verification scope**: Static gates only (bash -n, typecheck, lint, unit tests). Runtime/E2E verification is the UAT phase's job — see .docs/guides/command-anti-patterns.md#verification-belongs-to-the-right-phase.

Every sub-agent prompt **MUST** include this instruction:
> "Use Serena for all code exploration and editing, and for all file/directory exploration of any type. Standard `Read`/`Edit`/`Write` are permitted for markdown and config files only. Never use `bash` `ls`/`cat`/`find`/`grep`/`sed`. See `.docs/guides/mcp-tools.md` for the full tool reference."

---

## Cycle Overview

This command is a pure executor. It does NOT plan — the task file already contains the full plan with agent annotations. The cycle is:

```
┌─────────────────────────────────────────────────────────┐
│  1. READ OUTLINE  →  2. EXECUTE NEXT STEP  →  3. UPDATE │
│         ↑                                       │       │
│         └───────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Read and Parse the Outline

**Delegate this step** to an `Explore` sub-agent. The sub-agent reads and parses the outline, then returns a structured summary. The main agent should NOT read the outline directly.

- Use MCP Serena to read the outline file
- If the file does not exist or is empty, STOP and report the error
- Parse the structure to identify:
  - **Completed items**: Marked with `[x]`, `- [x]`, `[DONE]`, or strikethrough `~~text~~`
  - **In-progress items**: Marked with `[ ]`, `- [ ]`, `[WIP]`, or similar
  - **Not started items**: Unmarked list items or sections without status markers
  - **Blocked items**: Marked with `[BLOCKED]` or similar
- For each step section (`### N. ...`), extract the **agent type** from the `<!-- agent: TYPE -->` annotation
  - If no annotation exists, default to `general-purpose`
- Return: ordered list of sections with their status and agent type

### Completion Check
- If ALL items are marked complete:
  - Report success and STOP
  - Output: "All tasks in outline complete!"

---

## Step 2: Execute the Next Incomplete Step

**Delegate this step** to the sub-agent type specified in the task file's `<!-- agent: TYPE -->` annotation for that section. All implementation work runs in a sub-agent — never in the main context.

### Identify the Next Step

From the parsed outline (Step 1), pick the next step using this priority:
1. **Fix blockers first**: If any item is marked blocked, investigate why
2. **Continue in-progress work**: If something is WIP, prioritize completing it
3. **Start next incomplete item**: The first section with incomplete checkboxes

### Delegate Directly — No Re-Planning

The task file already contains all necessary detail. Pass the step's checkboxes and sub-details verbatim to the sub-agent. Do NOT research, re-plan, or ask clarifying questions — those were handled during `/task-add`.

**CRITICAL**

1) Absolute maximum of 3 sub-processes at a time
2) **ALWAYS** terminate processes when done (dev servers, type checkers, long-running commands)

### Subagent Requirements

When delegating, **every** sub-agent prompt MUST include:

1. **MCP Serena mandate**: "Use MCP Serena for all code exploration and editing. Do NOT use Read, Edit, Grep, or Glob on code files. See `.docs/guides/mcp-tools.md` for the full tool reference."
2. **The exact checkboxes and sub-details** from the task file section — pass them verbatim
3. **Run static gates only** after completing the work:
   - For shell scripts: run `bash -n <script>` to syntax-check
   - For typed codebases: run the project's typecheck command (e.g., `pnpm typecheck`, `make types-backend`, `mypy`, etc.)
   - Lint and unit tests are also permitted static gates
   - **Do NOT** perform runtime/end-to-end verification inside `/tackle`: no creating scratch dirs, no running helper scripts against real paths, no curl calls, no rsync dry-runs, no spawning servers, no fixture seeding, no asserting on file contents produced by the code you just wrote
   - Anything that requires *executing* the code to observe behavior belongs in the UAT phase (generated by `/uat-generate`, walked through by `/uat-walk` or `/uat-auto`). If a step as written calls for runtime verification, mark it `[DEFERRED-TO-UAT]` and move on
   - **ALL type errors are caused by your changes. No exceptions.** The codebase is committed clean before every `/tackle` cycle. There are zero pre-existing type errors.
   - **NEVER run `git stash` to "verify" if errors are pre-existing** — this is banned.
4. **Report completion status** (success, partial, or failure with reason)

### Example Delegation

```
Task tool invocation:
  subagent_type: "general-purpose"   ← read from <!-- agent: general-purpose -->
  prompt: |
    **MANDATORY**: Use MCP Serena for all code exploration and editing.
    Do NOT use Read, Edit, Grep, or Glob on code files.
    See `.docs/guides/mcp-tools.md` for the full tool reference.

    Complete these tasks from the outline:

    ### 1. Create API Route

    - [ ] Create `src/pages/api/contact.ts` with POST handler
    - [ ] Validate request body: name (required), email (required, valid format), message (required)
    - [ ] Return 200 on success, 400 on validation failure
      - Use Zod for validation schema

    ### 4. Verification

    After completing the above, run static gates only:
    - `bash -n ./script.sh` (syntax check shell scripts, if any)
    - `pnpm typecheck` (or equivalent)
    Do NOT run the script against a real path — that belongs in UAT.
```

---

## Step 3: Update the Outline with Status

**Do this step directly in the main agent context** — do NOT delegate to a sub-agent. This is a simple text replacement that does not warrant the overhead of a sub-agent.

⛔ **HARD RULE — update immediately, never batch.** The moment a sub-agent from Step 2 returns (success, partial, or failure), the *next thing you do* is flip that step's checkboxes in the outline file. Do NOT dispatch the next step's sub-agent, do NOT continue the cycle, do NOT defer updates to the end of the task. The update for step N must land on disk before step N+1 begins. If you find yourself queuing multiple completed steps without updates, stop and flush them now.

After the sub-agent from Step 2 completes (or fails), update the outline file using the native `Edit` tool:

### Status Markers to Use
- `[x]` or `- [x]` - Task completed successfully
- `[WIP]` - Work in progress (if partially done)
- `[BLOCKED: reason]` - Blocked by something
- `[FAILED: reason]` - Failed, needs attention

### Update Process

1. Use the **`Edit`** tool — call it once per checkbox line. **Never** reach for `sed`, `awk`, `perl -i`, or `echo` to update task files, no matter how many checkboxes need flipping. Ten `Edit` calls is correct; one `sed` is wrong (and will trigger an approval prompt every time).
2. Add a timestamp comment: `<!-- Updated: YYYY-MM-DD HH:MM -->`
3. If subtasks were discovered during execution, add them to the outline
4. **Update `.docs/tasks/README.md`** — flip this task's `Progress` column to the new `<done>/<total>` count and update its `Flags` column if a `[WIP]`, `[BLOCKED: ...]`, `[FAILED: ...]`, or `[DEFERRED-TO-UAT]` marker was added or cleared. One `Edit` call per changed cell. Skip if neither column changed. The index is `/tackle`'s no-args survey source — letting it drift defeats the whole point of having it.

> **Note**: Markdown files use the native `Edit` tool — Serena's symbolic editor doesn't apply to prose, and shell editors (`sed` etc.) are forbidden. See `.docs/guides/mcp-tools.md` "Common anti-patterns" for the full rule.

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

## Step 4: Repeat the Cycle

After updating the outline:

1. **Return to Step 1** - Read the updated outline
2. **Execute the next step** - Step 2
3. **Update** - Step 3
4. **Continue** until all tasks are complete or you are interrupted

**One step per cycle.** Step 2 → Step 3 → Step 2 → Step 3. Never run Step 2 twice in a row. The outline file must visibly progress between every sub-agent dispatch — that's how the user (and any interrupting `/tackle` resumption) sees real-time progress.

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

### No Re-Planning
- `/tackle` is an executor, NOT a planner — all planning was done in `/task-add`
- Do NOT research, re-plan, break down steps further, or ask clarifying questions
- If a step is too vague to execute, mark it `[BLOCKED: step needs more detail]` and move on
- The task file's agent annotations and step details are authoritative

### Mandatory Delegation
- **ALL steps** (read, execute, update) MUST be delegated to sub-agents (except Step 3: outline update)
- The main agent's role is strictly orchestration: receive results, decide next action, delegate
- NEVER read source code, edit files, or run commands directly in the main context
- This preserves the main context window for decision-making and prevents token bloat

---

## Begin Execution

Now execute the cycle:

1. Read the outline at: `$ARGUMENTS`
2. Identify the first incomplete step (using agent annotation from `<!-- agent: TYPE -->`)
3. Delegate to the annotated agent type
4. Update the outline
5. Repeat until done

### Step 6: UAT Generation Gate (HARD STOP)

⛔ **This gate MUST run before declaring completion. Never skip it, never reorder it.**

Once all outline steps are complete, ask the user: **"Generate UAT tests for this task?"** using `AskUserQuestion`:
- **Yes** — Run `/uat-generate .docs/tasks/<filename>` to create a UAT file in `.docs/uat/` matching this task's naming
- **No** — Skip UAT generation

**Wait** for the user's answer (and for `/uat-generate` to finish, if invoked) before proceeding to Step 6b.

### Step 6b: Type-Check Gate

Before declaring completion, try each of the following in order and stop at the first one that succeeds (exit 0) or fails with type errors. Skip to the next only if a command is not found / the target does not exist.

1. `Skill(typecheck)`
2. `make typecheck`

Suppress all output from commands that are not found or whose targets don't exist — only surface output when a command runs and produces type errors. If none of the above are available, skip silently and proceed.

**On failure**: If type checks surface errors, report them to the user, mark the relevant task step `[FAILED: type errors]` in the outline, and **do not proceed** to the banner. The user must resolve the errors (or explicitly instruct you to skip) before continuing.

**On pass or skip**: proceed to the banner.

### Banner: Output Completion Banner

Output this banner verbatim so the user knows tackle has finished all implementation steps:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TACKLE COMPLETED — all steps done
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 7: Suggest UAT

If UAT was generated in Step 6, suggest: `/uat-walk .docs/uat/<file>.uat.md`

**Start now - read the outline and begin the first cycle.**
