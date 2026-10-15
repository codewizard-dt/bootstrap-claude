---
name: adr-next
description: Find the first accepted decision missing a task reference; surface suggested /task-create command
category: researching
model: claude-haiku-4-5-20251001
argument-hint: "[optional: path to a specific decision file or NNNN prefix to scope the search]"
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`.

# Decision Next Task

Scan accepted decisions for ones missing a task reference and surface the first gap.

**Task-linked** = every accepted decision has a `Source task(s):` line with at least one task path (i.e. no task-less accepted decisions remain).

This same check now also runs as part of `/wiki-lint` (check 2.12) for scheduled sweeps across every decision file at once — use this skill directly when you want just the next single gap, fast.

---

**Scope**: $ARGUMENTS

---

## Step 0: Resolve the Search Scope

Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: decisions · scope: active · ambiguous: interactive · empty: search all decision files in `wiki/work/decisions/` (exclude `lifecycle.md`)

Both `ADR-NNNN` and legacy `DEC-NNNN` references are accepted (the number selects the file, per that doc).

A resolved reference scopes the search to that file only.

Use `mcp__serena__find_file` and `mcp__serena__list_dir` for all discovery — never `bash`.

If `wiki/work/decisions/` cannot be found, STOP and report: `No decisions directory found. Run /adr-create to start one.`

---

## Step 1: Enumerate Decision Files

Use `mcp__serena__list_dir` on `wiki/work/decisions/` to collect all `*.md` files **except `lifecycle.md`**.

Fully-decided groups stay in this directory (they sit under `## Closed` in the family index), so this scan covers them by `Status:` — never by index section. If a legacy holding folder exists under `wiki/work/decisions/` from an older layout, include its `*.md` files in the scan too.

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
ADR-NNNN#DM: <Decision Title>
File: wiki/work/decisions/ADR-NNNN-slug.md
Status: accepted — no task linked

Suggested next step:
  /task-create <short action derived from the decision title, e.g. "Implement <title>"> --decision ADR-NNNN#DM
```

Print the file's own `id:` (a not-yet-migrated item prints its legacy `DEC-NNNN` ID and filename). Append a one-sentence reminder of what the decision chose (pulled from `### Decision Outcome`) so the user knows what the task should implement.

### C. Task-less decision found — broken link (file missing)

```
ADR-NNNN#DM: <Decision Title>
File: wiki/work/decisions/ADR-NNNN-slug.md
Status: accepted — task link broken (referenced file not found)
Broken link: <original path from Source task(s):>

Suggested next steps:
  • Search wiki/work/tasks/ for the task by ID — files never move; check its status: frontmatter
  • Or create a replacement: /task-create <short action> --decision ADR-NNNN#DM
```

### D. Scoped file has no accepted decisions

```
<file path> has no accepted decisions. Run /adr-finalize <file>#DM to accept a proposed decision.
```

---

## Constraints

- Use only `mcp__serena__list_dir`, `mcp__serena__find_file`, `Read`, and `AskUserQuestion`.
- Never use `bash` for reads (`cat`, `find`, `grep`, `sed`, `ls`).
- Stop at the **first** gap — do not enumerate all gaps. The user runs `/adr-next` again after actioning each one.
- Keep the report terse — one block, no preamble, no closing summary.
- There is no `completed/` subdirectory and no `git mv` — decision files stay at their stable `wiki/work/decisions/` path permanently.
