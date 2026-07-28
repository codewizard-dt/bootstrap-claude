---
name: task-add
description: Create a structured, execution-ready task file in wiki/work/tasks/
category: planning
model: claude-sonnet-5
argument-hint: <task description> [--decision DEC-NNNN#DM] [--roadmap ROADMAP-NNN]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`; run /primer if not done this session.

$ARGUMENTS

---

**Instructions:**

### Step 1: Summarize the user input

Extract the core task objective, scope, and any specific requirements from `$ARGUMENTS`.

### Step 2: Parse and validate decision reference (only if `$ARGUMENTS` contains `--decision` or a `DEC-` token)

Detect a decision reference in any of these forms:
- `DEC-NNNN#DM` (e.g. `DEC-0007#D2`) — specific decision
- `NNNN#DM` (e.g. `0007#D2`) — specific decision
- `--decision DEC-NNNN#DM` or `--decision NNNN#DM` — flag form
- `DEC-NNNN` (no `#DM`) — **auto-detect** first accepted decision without a task

Strip the decision token and any `--decision` flag from `$ARGUMENTS` to get the clean task description.

Locate the decision file: use `mcp__serena__find_file` to find `NNNN-*.md` in `wiki/work/decisions/`.

**If no `#DM` was given (auto-detect)**: walk `## D1.`, `## D2.`, … blocks in order; find the first where `status: accepted` and the `### Links` section has no `Source task(s):` line. If every accepted decision already has a task reference, STOP and tell the user. If no accepted decisions exist, STOP and tell the user to run `/decision-finalize` first.

**Refuse if the resolved decision is not `accepted`**: STOP and tell the user to run `/decision-finalize <file>#DM` first.

Store `(decision_file_path, decision_id, decision_anchor)` for later steps.

If no decision reference: skip this step entirely.

### Step 3: Parse and validate roadmap reference (only if `$ARGUMENTS` contains `--roadmap` or a `ROADMAP-` token)

Detect:
- `ROADMAP-NNN` — bare token
- `--roadmap ROADMAP-NNN` or `--roadmap NNN` — flag form

Strip the roadmap token from `$ARGUMENTS`.

Locate: `mcp__serena__find_file` for `NNN-*.md` in `wiki/work/roadmaps/`. If not found, STOP and report.

Confirm the file has `status: active` in its frontmatter. If `status: done`, warn the user and ask whether to proceed.

Store `(roadmap_file_path, roadmap_number)` for Step 9.

If no roadmap reference: skip this step entirely.

### Step 4: Determine the next task number

Scan **all** task locations to find the next available number:
- `mcp__serena__list_dir` on `wiki/work/tasks/` and `wiki/work/tasks/archive/` (skip either that doesn't exist).
- Collect every `TASK-NNN` prefix from filenames across **both** directories. Take `max + 1`, zero-pad to 3 digits. The first task is `TASK-001`.
- Also scan `wiki/work/tasks/index.md` for any reserved IDs not yet on disk.
- Never re-use a number — IDs are immutable references, and archived tasks keep their original number forever (terminal tasks move to `archive/`; they don't stay in `wiki/work/tasks/`).

This number is a preview for planning; re-verify immediately before writing (Step 7a).

### Step 5: Identify dependencies

Review active tasks by listing `wiki/work/tasks/` and reading the index at `wiki/work/tasks/index.md`. For each active task, determine whether the new task:
- **depends_on** it (requires it to complete first)
- **blocks** it (must complete before that task can start)
- **parallel_safe_with** it (can run concurrently without conflict)

Present a compact table and confirm with the user via `AskUserQuestion` before proceeding.

### Step 6: Research and clarify approach

Investigate relevant code via Serena, consult Context7 for library docs if needed, use Brave Search for best practices. If multiple valid approaches exist, present a comparison and ask via `AskUserQuestion` before committing.

### Step 7: Present the plan and confirm

Before writing, present:
- Core objective
- Key design decisions
- High-level step breakdown

Confirm with the user via `AskUserQuestion`.

### Step 7a: Re-verify next task number — IMMEDIATELY before writing

Re-run the scan from Step 4. If the number planned in Step 7 is now taken, silently bump to the new next-available number. **Never call `Write` before completing this re-scan.**

### Step 8: Create the task file

Create `wiki/work/tasks/TASK-NNN-slug.md` using the `Write` tool.

**Frontmatter** (required):
```yaml
---
id: TASK-NNN
title: "<task title>"
status: todo
created: YYYY-MM-DD
updated: YYYY-MM-DD
depends_on: []
blocks: []
parallel_safe_with: []
uat: ""
tags: []
---
```

Populate `depends_on`, `blocks`, and `parallel_safe_with` from Step 5 as lists of `TASK-NNN` IDs (empty list if none).

**Body structure**:

```markdown
# TASK-NNN — Task Title

implements::[[DEC-NNNN#DM]]   ← only when a decision reference was provided

## Objective

<one paragraph describing what this task achieves>

## Approach

<design decisions, trade-offs, chosen solution>

## Steps

### 1. Section Name  <!-- agent: general-purpose -->

- [ ] Step detail
  - Sub-detail: specific file paths, function names, etc.

### 2. Next Section  <!-- agent: general-purpose -->

- [ ] Step detail
```

**The task file IS the plan.** `/tackle` executes steps verbatim. Every step must include specific file paths, function/component names, and enough implementation detail that an agent can execute without ambiguity.

Agent type annotations: valid types are `general-purpose`, `Explore`, `Plan`.

**Decision link** (only when Step 2 found an accepted decision reference): Insert `implements::[[DEC-NNNN#DM]]` as a typed link on the line immediately after the H1, before `## Objective`.

### Step 9: Update the family index

Append to `wiki/work/tasks/index.md`:

```
- [TASK-NNN — Title](TASK-NNN-slug.md) — one-line objective · todo
```

If the file does not exist, create it with a `# Tasks` heading and the list entry. Insert in numeric order.

### Step 10: Update the decision file (only when Step 2 found a decision reference)

In the decision's `### Links` section, add or append a `Source task(s):` line:

```
- Source task(s): [[TASK-NNN]] — **WIP** (added YYYY-MM-DD)
```

If no `### Links` section exists, create one before the closing `---` separator of that decision block. Use `Read` then `Edit` — never shell redirection.

### Step 11: Update the roadmap file (only when Step 3 found a roadmap reference)

Read the roadmap file. Identify the last `## Phase N:` section (or any checklist section). Append a new `- [ ]` line:

```
- [ ] [[TASK-NNN: <task title>]]
```

Update the roadmap's `updated:` frontmatter field to today's date. Use `Read` then `Edit`.

### Step 12: Append to wiki/log.md

Append:

```
## [YYYY-MM-DD] task | TASK-NNN <task title>
Created task TASK-NNN: <one sentence summarising the objective>.
```

### Step 13: Refresh the hot cache

The new task is durable, cross-session-relevant wiki state. Run the **Hot Cache Refresh** procedure — defined in `/wiki-ingest` Step 8 (`lib/skills/wiki-ingest/SKILL.md`) — to regenerate `wiki/hot.md` in full, surfacing this task under Recent Changes (and Active Threads if it belongs to an in-flight roadmap). Do not restate the procedure here; follow it as written.

### Step 14: Confirm completion

Report:
- Created file: `wiki/work/tasks/TASK-NNN-slug.md`
- Task ID: `TASK-NNN`
- Status: `todo`
- Next steps:

```
To implement:  /tackle wiki/work/tasks/TASK-NNN-slug.md
To generate tests:  /uat-generate TASK-NNN
```

If linked to a roadmap, mention which roadmap was updated and suggest:
```
To see what's next:  /roadmap-next wiki/work/roadmaps/NNN-slug.md
```
