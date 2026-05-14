---
name: task-add
description: Create a structured, execution-ready task file in .docs/tasks/active/
model: claude-sonnet-4-6
argument-hint: <task description> [--adr ADR-NNNN#DM] [--roadmap ROADMAP-NNN]
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/task-lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


$ARGUMENTS

---

**Instructions:**

1) **Read the task spec**: Read `.docs/tasks/active/README.md` for the required file format, naming convention, and example output. Follow it exactly.

2) **Summarize the user input**: Extract the core task objective, scope, and any specific requirements from the provided arguments.

2.5) **Parse and validate ADR reference** (only if `$ARGUMENTS` contains an ADR reference):
   - Detect an ADR reference in any of these forms anywhere in `$ARGUMENTS`:
     - `ADR-NNNN#DM` (e.g. `ADR-0007#D2`) — specific decision
     - `NNNN#DM` (e.g. `0007#D2`) — specific decision
     - `--adr ADR-NNNN#DM` or `--adr NNNN#DM` flag — specific decision
     - `ADR-NNNN` (no `#DM`, e.g. `ADR-0007`) — **auto-detect** (see below)
     - `--adr ADR-NNNN` (no `#DM`) — **auto-detect** (see below)
   - Extract the task description by removing the ADR token (and `--adr` flag if present) from `$ARGUMENTS`.
   - Locate the ADR file: use Serena `mcp__serena__find_file` to find `NNNN-*.md` in `.docs/adr/`.
   - Read the file.

   **If a specific `#DM` was given**: find that decision block directly.

   **If no `#DM` was given (auto-detect)**: walk the decision blocks (`## D1.`, `## D2.`, …) in order and find the first one where:
     1. `Status: accepted`
     2. The decision's `### Links` section has no `Source task(s):` line (i.e. no task has been assigned yet)
   - If every accepted decision already has a task reference, STOP and tell the user:
     > All accepted decisions in ADR-NNNN already have implementation tasks. No new task needed.
   - If no accepted decisions exist at all, STOP and tell the user:
     > ADR-NNNN has no accepted decisions. Run `/adr-finalize` on a proposed decision first.
   - Use the auto-detected decision as if the user had specified it explicitly.

   - **Refuse if the resolved decision is not `accepted`**: if `Status:` is `proposed`, `deprecated`, or `superseded`, STOP and tell the user:
     > Cannot create a task for ADR-NNNN#DM — decision status is `<status>`.
     > Tasks can only implement **accepted** decisions. Run `/adr-finalize <file>#DM` first.
   - If the decision is `accepted`, store `(adr_file_path, decision_id, decision_anchor)` for use in steps 7 and 8.5.
   - If no ADR reference is present in `$ARGUMENTS`: skip this step entirely. All subsequent ADR steps are no-ops.

2.6) **Parse and validate roadmap reference** (only if `$ARGUMENTS` contains a roadmap reference):
   - Detect a roadmap reference in any of these forms anywhere in `$ARGUMENTS`:
     - `ROADMAP-NNN` (e.g. `ROADMAP-001`) — bare token
     - `--roadmap ROADMAP-NNN` or `--roadmap NNN` — flag form
   - Extract the task description by removing the roadmap token (and `--roadmap` flag if present) from `$ARGUMENTS`.
   - Locate the roadmap file: use Serena `mcp__serena__find_file` to find `NNN-*.md` in `.docs/roadmaps/`.
   - If not found, STOP and tell the user:
     > Roadmap ROADMAP-NNN not found in `.docs/roadmaps/`.
   - Read the file to confirm it's a real roadmap (has `## Phase` sections). If no `## Phase` section exists, STOP and tell the user:
     > File at `.docs/roadmaps/NNN-*.md` does not look like a roadmap (no `## Phase N:` sections).
   - Store `(roadmap_file_path, roadmap_number)` for use in step 8.7.
   - If no roadmap reference is present in `$ARGUMENTS`: skip this step entirely. All subsequent roadmap steps are no-ops.

3) **Assess existing tasks** (preview only): Check `.docs/tasks/active/` and `.docs/tasks/completed/` for a tentative next task number to use during planning. The authoritative re-check happens in step 7a, immediately before file creation — so do not over-invest here.

4) **Research**: Run the `/research` workflow (see `.claude/skills/research/SKILL.md`) scoped to this task:
   - **Phase 2 (Internal)**: Review `PROJECT_STATUS.md`, `CLAUDE.md`, and related code via Serena to understand constraints, dependencies, patterns, and data flow.
   - **Phase 3 (External)**: Use Context7 MCP for library docs and Brave Search MCP for best practices, pitfalls, package discovery, and community recommendations.
   - **Phase 4 (Synthesis)**: Produce a clear picture of trade-offs, risks, and viable solutions. If multiple approaches exist, present a comparison table.

5) **Clarify approach**: Present your research findings and **always ask clarifying questions if there are multiple valid approaches** — use `AskUserQuestion` to present options with descriptions (informed by the research) before committing to an approach.

6) **Present your plan**: Before creating the task file, present a summary of the planned task structure to the user. Include:
   - Core objective
   - Key architecture/design decisions (informed by clarifying questions)
   - High-level step breakdown
   Ask the user to confirm before proceeding.

7) **Create the task file(s)**: After user confirmation, create fully detailed, execution-ready task file(s) in `.docs/tasks/active/` following the format specified in `.docs/tasks/active/README.md`.

   **7a) Re-verify the next available task number — IMMEDIATELY before writing any file.** The number determined in step 3 may now be stale (other tasks created mid-session, or a sibling task is being created in the same run). Determine the next number now:
   - **Primary source**: `Read` the **Next task number** header line at the top of `.docs/tasks/README.md`. That value is authoritative — it is maintained by every skill that creates or trashes a task.
   - **Sanity check**: Use Serena `mcp__serena__list_dir` on `.docs/tasks/active/`, `.docs/tasks/completed/`, and `.docs/tasks/trashed/` (skip any that don't exist). Collect every `NNN-` prefix across all sources, take `max + 1`, zero-pad to 3 digits. If this disagrees with the header, trust the disk and note the drift inline (`Index header was stale: header said NNN, disk says NNN'. Using NNN'.`) — but proceed.
   - **If `.docs/tasks/README.md` does not exist or lacks the header**, fall back to the disk scan alone.
   - **For ADR splits or multi-task runs**: assign sequential numbers (`NNN`, `NNN+1`, `NNN+2`, …) and reserve them all *before* writing the first file.
   - If the number you planned to use in step 6 has been taken, silently bump to the new next-available number and use it. Do not re-prompt the user.
   - **Never use a `Write` tool call before completing this re-scan.**

   **ADR split (only when step 2.5 found an accepted ADR reference)**: If the decision is large enough to warrant multiple tasks (determined during step 6 clarification), create all task files in this single invocation — one file per logical chunk. Present the planned task list to the user for confirmation before creating any files. Each task file implements one portion of the decision and gets its own `**Implements**:` line (see below). The goal is that when all tasks complete, the decision is fully implemented.

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

   **ADR link (only when step 2.5 found an accepted ADR reference)**: Insert `**Implements**: [ADR-NNNN#DM](<relative-path-to-adr-file#anchor>)` in each task file's `## Objective` section, as the last line of that section — after the objective sentence and before `## Approach`. Use a repo-relative path from the task file's location (e.g. `../../adr/0007-session.md#d2-session-lifetime`).

8) **Update the task index**: Append a row to the **Active Tasks** table in `.docs/tasks/README.md` (create the file if it doesn't exist — match the column layout described there). The row format is:

   ```
   | NNN | [slug](active/NNN-slug.md) | 0/<total> | none | — | <objective first sentence> |
   ```

   Where `<total>` is the count of `- [ ]` checkboxes you just wrote into the task file's `## Steps` sections. Insert the row in numeric order. This index is `/tackle`'s no-args survey source; do not skip this step.

   **Also update the two header lines** at the top of `.docs/tasks/README.md`:
   - **Last task:** set to `[NNN-slug](active/NNN-slug.md)` for the task you just created (or, in a multi-task run, the highest-numbered one).
   - **Next task number:** set to `NNN + 1`, zero-padded to 3 digits.

   If the file is being created from scratch in this step, write both header lines along with the table.

8.5) **Update the ADR file** (only when step 2.5 found an accepted ADR reference):
   - In the target decision's `### Links` section, add a `Source task(s):` line:
     - **Single task**:
       ```
       - Source task(s): `.docs/tasks/active/NNN-slug.md` — **WIP** (added YYYY-MM-DD)
       ```
     - **Multiple tasks** (split implementation, all created in this run):
       ```
       - Source task(s):
         - `.docs/tasks/active/NNN-slug.md` — **WIP** (added YYYY-MM-DD)
         - `.docs/tasks/active/NNN2-slug2.md` — **WIP** (added YYYY-MM-DD)
       ```
   - If no `### Links` section exists in the decision block, create one before the closing `---` separator of that decision block.
   - If a `Source task(s):` entry already exists (a prior incomplete run), append the new task(s) to it rather than replacing.
   - Use `Read` then `Edit` — never `sed`, `echo >>`, or shell redirection. See `.docs/guides/mcp-tools.md`.

8.7) **Update the roadmap file** (only when step 2.6 found a roadmap reference):
   - Read the roadmap file at `roadmap_file_path`.
   - Identify the **last existing `## Phase N:` section**. Append a new `- [ ]` line to the bottom of that phase — just before the next `##` header, the `## Notes` section (if present), or end of file (whichever comes first).
   - Item format (one line per newly created task):
     ```
     - [ ] [TASK-NNN: <task title>](../tasks/active/NNN-slug.md)
     ```
     where `<task title>` is taken from the task file's H1, stripped of the `NNN:` prefix.
   - For multi-task ADR splits, append one line per new task in sequential order.
   - Update the roadmap's `**Last updated**: YYYY-MM-DD` line to today's date.
   - Update the matching row in `.docs/roadmaps/README.md` Index — bump the `Progress` denominator: `M/N` → `M/N+k` where `k` is the number of tasks appended.
   - Use `Read` then `Edit` — never `sed`, `echo >>`, or shell redirection. See `.docs/guides/mcp-tools.md`.

9) **Update `PROJECT_STATUS.md`**: If it exists, update any references to this task or add it under the appropriate phase.

10) **Confirm completion**: Report the created task file path and summary to the user. Suggest next steps:
   ```
   To implement this task:  /tackle .docs/tasks/active/<number>-<slug>.md
   ```
   Note: After `/tackle` completes, the task stays in `active/`. Use `/uat-generate` to create UAT tests, then `/uat-walk` to move the task to `completed/`.
   If this task implements an ADR decision, the ADR's `### Links` section will be updated to **implemented** automatically when all linked tasks pass UAT.
   If this task was linked to a roadmap (step 2.6), mention which roadmap was updated and suggest:
   ```
   To see what's next on the roadmap:  /roadmap-next .docs/roadmaps/NNN-slug.md
   ```
