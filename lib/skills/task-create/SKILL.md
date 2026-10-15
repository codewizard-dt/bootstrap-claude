---
name: task-create
description: Create a structured, execution-ready task file in wiki/work/tasks/
category: planning
model: claude-sonnet-5
argument-hint: <task description> [--decision ADR-NNNN#DM] [--roadmap ROADMAP-NNNN] [--knowledge <slug>]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

$ARGUMENTS

---

**Instructions:**

### Step 1: Summarize the user input

Extract the core task objective, scope, and any specific requirements from `$ARGUMENTS`.

### Step 2: Parse and validate decision reference (only if `$ARGUMENTS` contains `--decision`, an `ADR-` token, or a legacy `DEC-` token)

Detect a decision reference in any of these forms (`ADR-` is the current prefix; legacy `DEC-` is accepted too — the number, not the prefix, selects the file):
- `ADR-NNNN#DM` (e.g. `ADR-0007#D2`) or legacy `DEC-NNNN#DM` (e.g. `DEC-0007#D2`) — specific decision
- `NNNN#DM` (e.g. `0007#D2`) — specific decision
- `--decision ADR-NNNN#DM` (or legacy `--decision DEC-NNNN#DM`) or `--decision NNNN#DM` — flag form
- `ADR-NNNN` or legacy `DEC-NNNN` (no `#DM`) — **auto-detect** first accepted decision without a task

Strip the decision token and any `--decision` flag from `$ARGUMENTS` to get the clean task description.

Resolve the decision file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: decisions · scope: active · ambiguous: interactive · empty: n/a (the `#DM` suffix is split off and handed back per that doc).

**If no `#DM` was given (auto-detect)**: walk `## D1.`, `## D2.`, … blocks in order; find the first where `status: accepted` and the `### Links` section has no `Source task(s):` line. If every accepted decision already has a task reference, STOP and tell the user. If no accepted decisions exist, STOP and tell the user to run `/adr-finalize` first.

**Refuse if the resolved decision is not `accepted`**: STOP and tell the user to run `/adr-finalize <file>#DM` first.

Store `(decision_file_path, decision_id, decision_anchor)` for later steps.

If no decision reference: skip this step entirely.

### Step 3: Parse and validate roadmap reference (only if `$ARGUMENTS` contains `--roadmap` or a `ROADMAP-` token)

Detect:
- `ROADMAP-NNNN` — bare token
- `--roadmap ROADMAP-NNNN` or `--roadmap NNN` — flag form

Strip the roadmap token from `$ARGUMENTS`.

Resolve the roadmap file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: roadmaps · scope: active · ambiguous: interactive · empty: n/a. If not found, STOP and report.

Confirm the file has `status: active` in its frontmatter. If `status: done`, warn the user and ask whether to proceed.

Store `(roadmap_file_path, roadmap_number)` for Step 9.

If no roadmap reference: skip this step entirely.

### Step 2b: Parse and validate knowledge reference (only if `$ARGUMENTS` contains `--knowledge` or a recognizable concept/source slug)

Detect:
- `--knowledge <slug>` — flag form (e.g. `--knowledge wiki-skill-boilerplate-duplication`)
- a bare slug matching an existing page filename (without extension) in `wiki/knowledge/concepts/` or `wiki/knowledge/sources/`

Strip the knowledge token and any `--knowledge` flag from `$ARGUMENTS` to get the clean task description.

Locate the page: use `mcp__serena__find_file` to search for `<slug>.md` (try the slug as given, and with `.md` appended if not already present) in `wiki/knowledge/concepts/` and `wiki/knowledge/sources/`.

**If found**: store `(knowledge_file_path, knowledge_slug)` for Step 8.

**If not found**: warn the user (e.g. "Knowledge page '<slug>' not found in wiki/knowledge/concepts/ or wiki/knowledge/sources/ — continuing without a knowledge link.") and continue — never block task creation on a missing knowledge page.

If no knowledge reference: skip this step entirely.

### Step 4: Determine the next task number

Allocate the next ID per `~/.claude/skills/_shared/SKILL-BOILERPLATE.md` § Number allocation (family: `wiki/work/tasks/`, prefix: `TASK-`, also scan `index.md` for reserved IDs).

This number is a preview for planning; re-verify immediately before writing (Step 7a).

### Step 5: Identify dependencies

Review active tasks by listing `wiki/work/tasks/` and reading the index at `wiki/work/tasks/index.md`. For each active task, determine whether the new task:
- **depends_on** it (requires it to complete first)
- **blocks** it (must complete before that task can start)
- **parallel_safe_with** it (can run concurrently without conflict)

Also read `wiki/work/bugs/index.md` and scan its active rows (status `open`/`triaged`/`in-progress`) for a bug whose title/summary plausibly matches the new task's objective (a judgment call — the same "plausible match" test `roadmap-next`'s inline-upgrade step applies to tasks). This scan is additive: the task-to-task dependency detection above is unchanged. A match is a candidate **origin bug** — the bug this task is being created to fix. Skip silently if `wiki/work/bugs/index.md` is missing or has no active rows.

Present a compact table and confirm with the user via `AskUserQuestion` before proceeding. When a candidate origin bug was found, add an "Origin bug" row (`BUG-NNNN` and its title) alongside the depends_on/blocks/parallel_safe_with rows so the user confirms or rejects the bug link in the same round-trip. Store the confirmed `BUG-NNNN` (or none) for Step 8.

### Step 6: Research and clarify approach

Investigate relevant code via Serena, consult Context7 for library docs if needed, use Brave Search for best practices. If multiple valid approaches exist, present a comparison and ask via `AskUserQuestion` before committing.

### Step 7: Present the plan and confirm

Before writing, present:
- Core objective
- Key design decisions
- High-level step breakdown

Confirm with the user via `AskUserQuestion`.

### Step 7a: Re-verify next task number — IMMEDIATELY before writing

Repeat § Number allocation step 6 (same family and prefix as Step 4); never call `Write` before completing it.

### Step 8: Create the task file

Create `wiki/work/tasks/TASK-NNNN-slug.md` using the `Write` tool.

**Frontmatter** (required):
```yaml
---
id: TASK-NNNN
aliases: [TASK-NNNN]
title: "<task title>"
status: todo
created: YYYY-MM-DD
updated: YYYY-MM-DD
depends_on: []
blocks: []
parallel_safe_with: []
origin_bug: ""
uat: ""
tags: []
---
```

Populate `depends_on`, `blocks`, and `parallel_safe_with` from Step 5 per the schema in `wiki/work/tasks/lifecycle.md` ("Dependency fields").

`origin_bug` is an optional, singular field (per `DEC-0001#D1`): set it to the `BUG-NNNN` ID the user confirmed as this task's origin in Step 5, or leave it `""` when no origin bug was confirmed. Do not write it as a list. The bug side's `linked_task` is not written here — that back-link is owned by `/bug-triage` and `/bug-close`.

**Body structure**:

```markdown
# TASK-NNNN — Task Title

implements::[[ADR-NNNN#DM]]   ← only when a decision reference was provided (write the resolved file's own `id:` form — `ADR-` for new items, legacy `DEC-` until migrated)
relates_to::[[<slug>]]   ← only when Step 2b resolved a knowledge reference
depends_on::[[TASK-NNNN]]   ← one line per dependency from Step 5; omit entirely if none
blocks::[[TASK-NNNN]]   ← one line per blocked task from Step 5; omit entirely if none

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

**Decision link** (only when Step 2 found an accepted decision reference): Insert `implements::[[ADR-NNNN#DM]]` (legacy `DEC-NNNN#DM` when the resolved file's `id:` is still `DEC-`) as a typed link on the line immediately after the H1, before `## Objective`.

**Knowledge link** (only when Step 2b resolved a knowledge reference): Insert `relates_to::[[<slug>]]` as a typed link in the same position — immediately after `implements::` when it's present, or immediately after the H1 when it isn't.

**Dependency links** (from the Step 5 data, no re-derivation needed): insert one `depends_on::[[TASK-NNNN]]` line per dependency and one `blocks::[[TASK-NNNN]]` line per blocked task, in the same position — immediately after `implements::` when it's present, or immediately after the H1 when it isn't. These lines are an optional graph-view mirror of the frontmatter arrays (see `wiki/work/tasks/lifecycle.md`, "Dependency fields"); creating them here does not backfill any pre-existing task file.

### Step 9: Update the family index

Append to `wiki/work/tasks/index.md`:

```
- [TASK-NNNN — Title](TASK-NNNN-slug.md) — one-line objective · todo
```

If the file does not exist, create it with a `# Tasks` heading and the list entry. Insert in numeric order.

### Step 10: Update the decision file (only when Step 2 found a decision reference)

In the decision's `### Links` section, add or append a `Source task(s):` line:

```
- Source task(s): [[TASK-NNNN]] — **WIP** (added YYYY-MM-DD)
```

If no `### Links` section exists, create one before the closing `---` separator of that decision block. Edit only — see `~/.claude/skills/_shared/SKILL-BOILERPLATE.md` § Edit hygiene.

### Step 11: Update the roadmap file (only when Step 3 found a roadmap reference)

Read the roadmap file. Identify the last `## Phase N:` section (or any checklist section). Append a new `- [ ]` line:

```
- [ ] [[TASK-NNNN: <task title>]]
```

Update the roadmap's `updated:` frontmatter field to today's date. Use `Read` then `Edit`.

### Step 12: Append to wiki/log.md

Append:

```
## [YYYY-MM-DD] task | TASK-NNNN <task title>
Created task TASK-NNNN: <one sentence summarising the objective>.
```

### Step 13: Refresh the hot cache

The new task is durable, cross-session-relevant wiki state. Run the **Hot Cache Refresh** procedure — defined in `/wiki-ingest` Step 8 (`lib/skills/wiki-ingest/SKILL.md`) — to regenerate `wiki/hot.md` in full, surfacing this task under Recent Changes (and Active Threads if it belongs to an in-flight roadmap). Do not restate the procedure here; follow it as written.

### Step 14: Confirm completion

Report:
- Created file: `wiki/work/tasks/TASK-NNNN-slug.md`
- Task ID: `TASK-NNNN`
- Status: `todo`
- Next steps:

```
To implement:  /tackle wiki/work/tasks/TASK-NNNN-slug.md
To generate tests:  /uat-create TASK-NNNN
```

If linked to a roadmap, mention which roadmap was updated and suggest:
```
To see what's next:  /roadmap-next wiki/work/roadmaps/NNN-slug.md
```
