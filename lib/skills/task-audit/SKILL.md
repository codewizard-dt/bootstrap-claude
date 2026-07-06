---
name: task-audit
description: Generate a dependency graph of active tasks showing which block others and which can run in parallel; also checks for unannotated implementations and auto-completes tasks
category: researching
model: claude-sonnet-4-6
argument-hint: [--json]
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `wiki/work/tasks/lifecycle.md`. Read it now if not already in context.**

# Task Audit

Analyse all active tasks: verify implementation completeness, auto-check unannotated finished steps, move fully-completed tasks, parse dependency blocks, build a directed dependency graph, and surface which tasks block others and which can be safely parallelised.

---

**Flags**: $ARGUMENTS

- `--json` — also emit a raw JSON adjacency list (useful for scripting)

---

## Step 1: Load the Task Index

Read `wiki/work/tasks/README.md` using the `Read` tool.

- Extract every row from the **Active Tasks** table: `#`, `Slug` (file link), `Progress`, `Flags`.
- Collect the file path for each active task (e.g. `wiki/work/tasks/001-project-registry-push.md`).
- If the table is empty, report "No active tasks — nothing to audit." and STOP.

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

1. Set `status: done` in the task file's frontmatter using `Edit`, then move it from `wiki/work/tasks/` to `wiki/work/tasks/archive/` using `Bash` (`git mv` only).
2. Remove the row from `wiki/work/tasks/README.md`'s **Active Tasks** table and append it to `wiki/work/tasks/archive/index.md`.
3. Scan all other active task files for references to this task's ID (e.g. in their dependency blocks). For each reference found, note it in the Step 4 report as a **now-resolved dependency** — do not auto-edit those files, but suggest `/task-update <NNN>` to clean them up.
4. Mark the task as `completed: true` in its node record so Step 3 treats it as resolved.

### 2e. Parse the Dependency Block

In the same file read, locate the dependency blockquote appearing **immediately after the `# NNN —` title line** and **before `## Objective`**:

```markdown
> **Depends on**: [002-foo](002-foo.md), [003-bar](003-bar.md)
> **Blocks**: [008-baz](008-baz.md)
> **Parallel-safe with**: [005-qux](005-qux.md), [006-quux](006-quux.md)
```

- Values may be `none` if the field is empty.
- Links follow the pattern `[NNN-slug](NNN-slug.md)` — extract the NNN-slug identifier from each link.
- A task with no dependency block at all is treated as having `Depends on: none`, `Blocks: none`, `Parallel-safe with: none`.

### 2f. Build the Node Record

For each task (skipping any moved to completed in 2d), produce a record:

```
{
  id: "NNN-slug",
  num: NNN,
  depends_on: ["NNN-slug", ...],   # tasks that must complete before this one
  blocks: ["NNN-slug", ...],        # tasks this one must complete before they can start
  parallel_safe: ["NNN-slug", ...], # tasks explicitly marked safe to run alongside
  progress: "X/Y",                  # updated count after auto-checkmarks
  flags: "[WIP]" | "—" | etc,
  missing_block: true/false,        # true if the dependency block was absent entirely
  auto_checked: ["step description", ...],  # steps that were auto-completed in 2c
  unverified: ["step description", ...]     # unchecked steps whose implementation could not be confirmed
}
```

Note tasks missing the dependency block — list them in the Step 4 issues report so the user knows to run `/task-update` on them.

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

## Step 4: Output the Audit Report

Print the full report in this order:

### 4a. Dependency Graph (Mermaid — also persisted to README.md in Step 5)

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
| 005-command-anti-patterns | "Add mcp-tools.md guide" | File found at .docs/guides/mcp-tools.md |

### Fully-Completed Tasks Moved
| Task | Action |
|------|--------|
| 005-command-anti-patterns | Moved to wiki/work/tasks/archive/ — update references: /task-update 007 |

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
| 006-migrate-commands-to-skills | Missing dependency block — run `/task-update 006` to add one |
| 009-audit-skills-vs-sdlc | Stale reference: depends_on "003-deleted-task" not in active index |
```

Categories:
- **Missing dependency block** — task file has no `> **Depends on**:` block
- **Stale reference** — referenced task ID not found in active index
- **Asymmetric edge** — A blocks B but B doesn't list A in depends_on
- **Cycle** — dependency cycle detected (list all members)
- **Now-resolved dependency** — a task was moved to completed; other tasks still reference it in their dependency blocks

If no issues: "No issues found."

### 4f. Suggested Next Actions

Based on the graph, suggest actionable next steps:

```
## Suggested Next Steps

Wave 1 tasks are unblocked and can start immediately:
  /tackle wiki/work/tasks/001-project-registry-push.md
  /tackle wiki/work/tasks/005-command-anti-patterns.md   ← run in parallel

Fix missing dependency blocks:
  /task-update 006
  /task-update 009

Clean up now-resolved dependency references:
  /task-update 007   (005 was moved to completed)
```

---

## Step 5: Update the Dependency Graph in README.md

**Always run this step** (regardless of flags).

Upsert a `## Dependency Graph` section into `wiki/work/tasks/README.md`:

1. Read the current content of `wiki/work/tasks/README.md`.
2. Determine whether a `## Dependency Graph` section already exists (look for the heading `## Dependency Graph`).
3. Build the replacement block:

```markdown
## Dependency Graph

> Auto-generated by `/task-audit` on YYYY-MM-DD. Re-run to refresh.

<paste the Mermaid block from Step 4a>

<paste the Execution Waves table from Step 4b>

<paste the Blocking Chains section from Step 4c>
```

4. **If the section exists**: use `Edit` to replace everything from the `## Dependency Graph` heading to the end of the file (or to the next `---` / `##` heading if one follows it) with the new block.
5. **If the section does not exist**: append the block to the end of the file using `Edit` (add a blank line separator before the heading).

There must be **exactly one** `## Dependency Graph` section in README.md after this step. Never write a separate `dependency-graph.md` file.

**Only if `--json` flag is present in `$ARGUMENTS`:**

Print the raw adjacency list as a fenced JSON block:

```json
{
  "tasks": [
    {
      "id": "001-project-registry-push",
      "depends_on": [],
      "blocks": ["007-publish-npm-package"],
      "parallel_safe": ["005-command-anti-patterns"],
      "progress": "0/18",
      "flags": "—"
    }
  ]
}
```
