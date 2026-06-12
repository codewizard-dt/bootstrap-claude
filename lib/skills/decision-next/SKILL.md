---
name: decision-next
description: Find the first accepted decision missing a task reference; surface suggested /task-add command
model: claude-haiku-4-5-20251001
argument-hint: "[optional: path to a specific decision file or NNNN prefix to scope the search]"
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

# Decision Next Task

Scan accepted decisions for ones missing a task reference and surface the first gap.

**Task-linked** = every accepted decision has a `Source task(s):` line with at least one task path (i.e. no task-less accepted decisions remain).

---

**Scope**: $ARGUMENTS

---

## Step 0: Resolve the Search Scope

Parse `$ARGUMENTS`:

| Input | Resolution |
|-------|------------|
| Empty | Search all decision files in `wiki/work/decisions/` (exclude `lifecycle.md`) |
| File path (e.g. `wiki/work/decisions/DEC-0007-session.md`) | Scope to that file only |
| `NNNN-slug` (e.g. `0007-session`) | Locate `NNNN-slug.md` in `wiki/work/decisions/` |
| `NNNN` or plain number (e.g. `7` or `007`) | Pad to 4 digits; `mcp__serena__find_file` with mask `NNNN-*.md` |

Use `mcp__serena__find_file` and `mcp__serena__list_dir` for all discovery — never `bash`.

If `wiki/work/decisions/` cannot be found, STOP and report: `No decisions directory found. Run /decision-create to start one.`

---

## Step 1: Enumerate Decision Files

Use `mcp__serena__list_dir` on `wiki/work/decisions/` to collect all `*.md` files **except `lifecycle.md`**.

Sort files by their 4-digit numeric prefix ascending (lowest number first) so you scan in chronological decision order.

If `$ARGUMENTS` scoped to a single file, the list contains only that file.

---

## Step 2: Scan Each File for Task-less Accepted Decisions

For each file (in order), use `Read` to load it, then:

1. **Parse every `## D*` decision block** — each H2 matching `## D\d+\.` is a decision block. Collect blocks in document order.

2. **For each decision block, check**:
   - `Status: accepted` — only accepted decisions need follow-up tasks; skip `proposed`, `deprecated`, `superseded by …`
   - `### Links` section contains a `Source task(s):` line with at least one `wiki/work/tasks/` path (or relative `../tasks/` path)

3. **A decision is task-less if**:
   - Its status is `accepted`, AND
   - Its `### Links` section is absent, OR has no `Source task(s):` line, OR the `Source task(s):` line is blank / contains only a placeholder

4. **Record per-file tracking**:
   - `accepted_count` — number of accepted decisions in this file
   - `task_less` — list of task-less decisions found

5. **Record the first task-less decision found** (file path + decision ID + decision title). After recording it, continue scanning the remaining files only to check completeness — do not surface more gaps.

---

## Step 3: Verify the Task File Actually Exists (only when a link is present)

If a decision has a `Source task(s):` line with one or more paths, verify at least one of the referenced task files still exists using `mcp__serena__find_file`. If every listed task file is missing (moved, deleted, renamed), treat the decision as task-less and surface it as if no link were present, but note the broken link.

---

## Step 4: Report

Choose the matching shape:

### A. No task-less accepted decision found

```
All accepted decisions have task references. Nothing to action.
```

### B. Task-less decision found — no broken link

```
DEC-NNNN#DM: <Decision Title>
File: wiki/work/decisions/DEC-NNNN-slug.md
Status: accepted — no task linked

Suggested next step:
  /task-add <short action derived from the decision title, e.g. "Implement <title>"> --decision NNNN#DM
```

Append a one-sentence reminder of what the decision chose (pulled from `### Decision Outcome`) so the user knows what the task should implement.

### C. Task-less decision found — broken link (file missing)

```
DEC-NNNN#DM: <Decision Title>
File: wiki/work/decisions/DEC-NNNN-slug.md
Status: accepted — task link broken (referenced file not found)
Broken link: <original path from Source task(s):>

Suggested next steps:
  • Search wiki/work/tasks/ for the task by ID — files never move; check its status: frontmatter
  • Or create a replacement: /task-add <short action> --decision DEC-NNNN#DM
```

### D. Scoped file has no accepted decisions

```
<file path> has no accepted decisions. Run /decision-finalize <file>#DM to accept a proposed decision.
```

---

## Constraints

- Use only `mcp__serena__list_dir`, `mcp__serena__find_file`, `Read`, and `AskUserQuestion`.
- Never use `bash` for reads (`cat`, `find`, `grep`, `sed`, `ls`).
- Stop at the **first** gap — do not enumerate all gaps. The user runs `/decision-next` again after actioning each one.
- Keep the report terse — one block, no preamble, no closing summary.
- There is no `completed/` subdirectory and no `git mv` — decision files stay at their stable `wiki/work/decisions/` path permanently.
