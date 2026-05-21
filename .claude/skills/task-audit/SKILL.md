---
name: task-audit
description: Generate a dependency graph of active tasks showing which block others and which can run in parallel
model: claude-sonnet-4-6
argument-hint: [--mermaid] [--json]
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/task-lifecycle.md`. Read it now if not already in context.**

# Task Audit — Dependency Graph

Analyse all active tasks, parse their dependency blocks, build a directed dependency graph, and surface which tasks block others and which can be safely parallelised.

---

**Flags**: $ARGUMENTS

- `--mermaid` — write the graph to `.docs/tasks/dependency-graph.md` in addition to printing it
- `--json` — also emit a raw JSON adjacency list (useful for scripting)

---

## Step 1: Load the Task Index

Read `.docs/tasks/README.md` using the `Read` tool.

- Extract every row from the **Active Tasks** table: `#`, `Slug` (file link), `Progress`, `Flags`.
- Collect the file path for each active task (e.g. `.docs/tasks/001-project-registry-push.md`).
- If the table is empty, report "No active tasks — nothing to audit." and STOP.

Do **not** scan the directory directly. The index is authoritative for active tasks.

---

## Step 2: Read Each Task File and Parse Its Dependency Block

For each task file path collected in Step 1, read the file using the `Read` tool.

### 2a. Locate the Dependency Block

The dependency block is a blockquote appearing **immediately after the `# NNN —` title line** and **before `## Objective`**. It has this exact shape (one line per field):

```markdown
> **Depends on**: [002-foo](002-foo.md), [003-bar](003-bar.md)
> **Blocks**: [008-baz](008-baz.md)
> **Parallel-safe with**: [005-qux](005-qux.md), [006-quux](006-quux.md)
```

- Values may be `none` if the field is empty.
- Links follow the pattern `[NNN-slug](NNN-slug.md)` — extract the NNN-slug identifier from each link.
- A task with no dependency block at all is treated as having `Depends on: none`, `Blocks: none`, `Parallel-safe with: none`.

### 2b. Build the Node Record

For each task, produce a record:

```
{
  id: "NNN-slug",
  num: NNN,
  depends_on: ["NNN-slug", ...],   # tasks that must complete before this one
  blocks: ["NNN-slug", ...],        # tasks this one must complete before they can start
  parallel_safe: ["NNN-slug", ...], # tasks explicitly marked safe to run alongside
  progress: "X/Y",
  flags: "[WIP]" | "—" | etc,
  missing_block: true/false         # true if the dependency block was absent entirely
}
```

Note tasks missing the dependency block — list them in the Step 5 report so the user knows to run `/task-update` on them.

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

### 4a. Dependency Graph (Mermaid)

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

### 4d. Issues Found

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

If no issues: "No issues found."

### 4e. Suggested Next Actions

Based on the graph, suggest actionable next steps:

```
## Suggested Next Steps

Wave 1 tasks are unblocked and can start immediately:
  /tackle .docs/tasks/001-project-registry-push.md
  /tackle .docs/tasks/005-command-anti-patterns.md   ← run in parallel

Fix missing dependency blocks:
  /task-update 006
  /task-update 009
```

---

## Step 5: Optionally Write the Graph File

**Only if `--mermaid` flag is present in `$ARGUMENTS`:**

Write `.docs/tasks/dependency-graph.md` using the `Write` tool with this content:

```markdown
# Task Dependency Graph

> Auto-generated by `/task-audit` on YYYY-MM-DD. Re-run to refresh.

<paste the Mermaid block from Step 4a>

<paste the Execution Waves table from Step 4b>

<paste the Blocking Chains section from Step 4c>
```

Report the file path to the user.

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
