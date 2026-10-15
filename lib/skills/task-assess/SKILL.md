---
name: task-assess
description: Assess active tasks — generate a dependency graph showing which block others and which can run in parallel; also checks for unannotated implementations and auto-completes tasks
category: researching
model: claude-sonnet-5
argument-hint: [--json]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/tasks/lifecycle.md`.

# Task Assess

Analyse all active tasks: verify implementation completeness, auto-check unannotated finished steps, move fully-completed tasks, read dependency fields, build a directed dependency graph, and surface which tasks block others and which can be safely parallelised.

---

**Flags**: $ARGUMENTS

- `--json` — also emit a raw JSON adjacency list (useful for scripting)

---

## Step 1: Load the Task Index

Read `wiki/work/tasks/index.md` using the `Read` tool.

- Parse every active-item bullet line — format `- [TASK-NNNN — Title](TASK-NNNN-slug.md) — one-line summary · status`. Extract the `TASK-NNNN` ID and the linked file path (e.g. `wiki/work/tasks/TASK-001-project-registry-push.md`) for each.
- `index.md` lists active items only and carries no progress or flags columns — those are computed from each task file in Step 2.
- If the list is empty, report "No active tasks — nothing to assess." and STOP.

Do **not** scan the directory directly. The index is authoritative for active tasks.

---

## Step 2: Read Each Task File — Check Completeness and Parse Dependencies

For each task file path collected in Step 1, **read the file once** using the `Read` tool (or Serena's `find_symbol`/`get_symbols_overview` for structured markdown traversal). Do all of 2a–2e in a single pass per file to avoid re-reading.

### 2a. Extract All Steps

Scan every checklist item in the file — lines matching `- [ ] …` (incomplete) or `- [x] …` / `- [X] …` (complete). Record:

- `unchecked`: list of step descriptions without a checkmark
- `checked`: list of step descriptions already checked
- `total`: count of all steps

### 2b. Verify Unannotated Implementations

For each unchecked step, determine whether the work it describes is **actually implemented** in the codebase:

1. Extract the key noun/verb from the step description (e.g. "Add `foo()` helper", "Write migration for `users` table").
2. Use Serena's `find_symbol` or `search_for_pattern` to look for the relevant symbol, file, or pattern.
3. If evidence of a complete implementation is found (the symbol exists, the file is present, the migration exists, etc.), mark the step as **auto-completable**.

Be conservative: only mark a step auto-completable when the evidence is unambiguous. When the step is vague or the search returns nothing definitive, leave it unchecked and note it as **unverified**.

### 2c. Apply Checkmarks

For every step confirmed as auto-completable in 2b, update the task file using `Edit` (or Serena's `replace_content`): change `- [ ]` → `- [x]` for that line.

After applying all updates, recount `checked` and `total`. Track which tasks had checkmarks added (include them in the Step 4 report as **auto-completed steps**).

### 2d. Move Fully-Completed Tasks

If `checked == total` (all steps are now checked) after 2c:

1. Read `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` now and run its Procedure for the task: `family: tasks`, `terminal_status: done`, default log entry. It sets the status, moves the file, updates both indexes, and appends the log entry.
2. Scan all other active task files for references to this task's ID (in their `depends_on` / `blocks` frontmatter). For each reference found, note it in the Step 4 report as a **now-resolved dependency** — do not auto-edit those files, but suggest that the user edit the task file directly to clean them up.
3. Mark the task as `completed: true` in its node record so Step 3 treats it as resolved.

### 2e. Read the Dependency Fields

From the task file's YAML frontmatter (already in hand from the Step 2 read), read `depends_on`, `blocks`, and `parallel_safe_with` — format per `wiki/work/tasks/lifecycle.md` ("Dependency fields"), not restated here.

- A missing key is treated as an empty list.
- If none of the three keys is present at all, record `missing_deps` for the report.

### 2f. Build the Node Record

For each task (skipping any moved to completed in 2d), produce a record:

```
{
  id: "TASK-NNNN",
  num: NNN,
  depends_on: ["TASK-NNNN", ...],   # tasks that must complete before this one
  blocks: ["TASK-NNNN", ...],        # tasks this one must complete before they can start
  parallel_safe: ["TASK-NNNN", ...], # tasks explicitly marked safe to run alongside
  progress: "X/Y",                  # updated count after auto-checkmarks
  flags: "[WIP]" | "—" | etc,
  missing_deps: true/false,         # true if none of the three frontmatter keys is present
  auto_checked: ["step description", ...],  # steps that were auto-completed in 2c
  unverified: ["step description", ...]     # unchecked steps whose implementation could not be confirmed
}
```

Note tasks missing dependency fields — list them in the Step 4 issues report so the user knows to edit the task file directly to add them.

---

## Step 3: Derive the Full Dependency Graph

### 3a. Validate edges

For every `depends_on` and `blocks` edge, confirm the referenced task ID appears in the active index. If a reference points to a task not in the active index (e.g. it completed or was trashed), mark it as a **stale reference** and note it in the report — do not abort.

Cross-check symmetry: if task A says it blocks task B, but task B does not list A in its `depends_on`, flag the asymmetry (don't auto-correct).

### 3b. Detect cycles

Walk the dependency graph using DFS. If a cycle is found (A → B → A), flag it as a **blocking cycle** — these tasks cannot proceed until the cycle is resolved. List every cycle found.

### 3c. Compute parallelism groups

A set of tasks is **parallelisable** if no task in the set has a directed dependency on any other task in the set (directly or transitively). Use topological sort to group tasks into execution waves:

- **Wave 1**: tasks with no unresolved `depends_on` (all prerequisites already completed or none listed)
- **Wave 2**: tasks whose only blockers are Wave 1 tasks
- **Wave N**: and so on

Within a wave, all tasks are parallelisable with each other unless an explicit `parallel_safe` field contradicts it (i.e. two tasks in the same wave where neither lists the other in `parallel_safe` — treat that as unknown/untested rather than unsafe unless a flag says otherwise).

---

## Step 4: Output the Assessment Report

Print the full report in this order:

### 4a. Dependency Graph (Mermaid — also persisted to `wiki/work/tasks/dependency-graph.md` in Step 5)

```
## Dependency Graph

\`\`\`mermaid
graph TD
  001["001-project-registry-push<br/>0/18"]
  007["007-publish-npm-package<br/>0/43 [DEFERRED-TO-UAT]"]
  001 --> 007
  005["005-command-anti-patterns<br/>26/29 [DEFERRED-TO-UAT]"]
  006["006-migrate-commands-to-skills<br/>55/55"]
  009["009-audit-skills-vs-sdlc<br/>0/10"]
\`\`\`
```

- Node label: `NNN-slug\nProgress [Flags]` — use `<br/>` for line breaks inside Mermaid labels.
- Solid arrow `-->` for `depends_on` / `blocks` edges (direction: prerequisite → dependent).
- Dashed arrow `-.->` for `parallel_safe` edges (bidirectional, draw once).
- Tasks with `[BLOCKED]` or `[FAILED]` flags use a distinct node shape: `001[["001-slug"]]` (double bracket = stadium shape).

### 4b. Execution Waves Table

```
## Execution Waves (Parallelism)

| Wave | Tasks | Can run in parallel |
|------|-------|---------------------|
| 1    | 001-project-registry-push, 005-command-anti-patterns | Yes — no shared dependencies |
| 2    | 007-publish-npm-package | Waits for Wave 1 |
```

For each wave, note any tasks within it that have an **unknown parallel-safety** (no `parallel_safe` entries exist between them) with a ⚠️ marker.

### 4c. Blocking Summary

```
## Blocking Chains

- 001 → 007 (001 must complete before 007 can start)
```

If no blocking chains exist: "No blocking dependencies found — all tasks are independent."

### 4d. Completion Findings

Report what Step 2 discovered and changed:

```
## Completion Findings

### Auto-Completed Steps
| Task | Step | Evidence |
|------|------|----------|
| 005-command-anti-patterns | "Add mcp-tools.md guide" | File found at wiki/guides/mcp-tools.md |

### Fully-Completed Tasks Moved
| Task | Action |
|------|--------|
| 005-command-anti-patterns | Moved to wiki/work/tasks/archive/ — update references: edit task 007 directly |

### Unverified Steps (implementation unclear)
| Task | Step |
|------|------|
| 009-audit-skills-vs-sdlc | "Configure CI gate for audit output" |
```

Omit any section whose table would be empty.

### 4e. Issues Found

```
## Issues

| Task | Issue |
|------|-------|
| 006-migrate-commands-to-skills | Missing dependency fields — edit the task file's frontmatter directly to add them |
| 009-audit-skills-vs-sdlc | Stale reference: depends_on "TASK-0003" not in active index |
```

Categories:
- **Missing dependency fields** — task frontmatter has none of `depends_on` / `blocks` / `parallel_safe_with`
- **Stale reference** — referenced task ID not found in active index
- **Asymmetric edge** — A blocks B but B doesn't list A in depends_on
- **Cycle** — dependency cycle detected (list all members)
- **Now-resolved dependency** — a task was moved to completed; other tasks still reference it in their dependency fields

If no issues: "No issues found."

### 4f. Suggested Next Actions

Based on the graph, suggest actionable next steps:

```
## Suggested Next Steps

Wave 1 tasks are unblocked and can start immediately:
  /tackle wiki/work/tasks/001-project-registry-push.md
  /tackle wiki/work/tasks/005-command-anti-patterns.md   ← run in parallel

Fix missing dependency fields (edit each task file's frontmatter directly):
  006-migrate-commands-to-skills
  009-audit-skills-vs-sdlc

Clean up now-resolved dependency references (edit the task file directly):
  007   (005 was moved to completed)
```

---

## Step 5: Persist the Dependency Graph

**Always run this step** (regardless of flags).

Write the generated graph to its own file, `wiki/work/tasks/dependency-graph.md` — do **not** inline it into `index.md`. `index.md`'s contract is "active items only, as a flat bullet list" (see `wiki/conventions.md`); a large auto-generated Mermaid section would violate that. A dedicated file also lets the graph be regenerated wholesale each run without disturbing the active list.

1. Overwrite `wiki/work/tasks/dependency-graph.md` using `Write` with this content:

```markdown
---
title: Task Dependency Graph
updated: YYYY-MM-DD
---

# Task Dependency Graph

> Auto-generated by `/task-assess` on YYYY-MM-DD. Re-run to refresh. Do not edit by hand.

<paste the Mermaid block from Step 4a>

<paste the Execution Waves table from Step 4b>

<paste the Blocking Chains section from Step 4c>
```

2. Ensure `wiki/work/tasks/index.md` carries a one-line cross-link to the graph, directly under its `Entry format:` line: `Dependency graph: [dependency-graph.md](dependency-graph.md) — regenerated by /task-assess.` If that line is already present, leave it; if absent, add it with a single `Edit`.

There must be **exactly one** `dependency-graph.md` file after this step, and it holds the only copy of the graph. Never write the graph into `index.md` or a `README.md`.

**Only if `--json` flag is present in `$ARGUMENTS`:**

Print the raw adjacency list as a fenced JSON block:

```json
{
  "tasks": [
    {
      "id": "TASK-0001",
      "depends_on": [],
      "blocks": ["TASK-0007"],
      "parallel_safe": ["TASK-0005"],
      "progress": "0/18",
      "flags": "—"
    }
  ]
}
```
