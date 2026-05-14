---
name: adr-next
description: Read-only — find the first accepted ADR decision that has no task reference in its Links section and suggest /task-add
model: claude-haiku-4-5-20251001
argument-hint: [optional: path to a specific ADR file or NNNN prefix to scope the search]
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

# ADR Next Task

Scan accepted ADR decisions for ones missing a task reference and surface the first gap. This skill is **strictly read-only** — never edit ADR files, task files, or the index.

---

**Scope**: $ARGUMENTS

---

## Step 0: Resolve the Search Scope

Parse `$ARGUMENTS`:

| Input | Resolution |
|-------|------------|
| Empty | Search all ADR files in the ADR directory |
| File path (e.g. `.docs/adr/0007-session.md`) | Scope to that file only |
| `NNNN-slug` (e.g. `0007-session`) | Locate `NNNN-slug.md` in the ADR dir |
| `NNNN` or plain number (e.g. `7` or `007`) | Pad to 4 digits; `mcp__serena__find_file` with mask `NNNN-*.md` |

Use `mcp__serena__find_file` and `mcp__serena__list_dir` for all discovery — never `bash`.

If the ADR directory cannot be found (check `.docs/adr/`, `docs/adr/`, `docs/decisions/`, `adr/` in that order), STOP and report: `No ADR directory found. Run /adr-create to start one.`

---

## Step 1: Enumerate ADR Files

Use `mcp__serena__list_dir` on the ADR directory (and `completed/` subdirectory if present) to collect all `*.md` files except `README.md`.

Sort files by their 4-digit numeric prefix ascending (lowest number first) so you scan in chronological decision order. Files in `completed/` come after active files in the same numeric order.

If `$ARGUMENTS` scoped to a single file, the list contains only that file.

---

## Step 2: Scan Each File for Task-less Accepted Decisions

For each file (in order), use `Read` to load it, then:

1. **Parse every `## D*` decision block** — each H2 matching `## D\d+\.` is a decision block. Collect blocks in document order.

2. **For each decision block, check**:
   - `Status: accepted` — only accepted decisions need follow-up tasks; skip `proposed`, `deprecated`, `superseded by …`
   - `### Links` section contains a `Source task(s):` line with at least one `.docs/tasks/` path (or `tasks/` path)

3. **A decision is task-less if**:
   - Its status is `accepted`, AND
   - Its `### Links` section is absent, OR has no `Source task(s):` line, OR the `Source task(s):` line is blank / contains only a placeholder

4. **Record the first task-less decision found** (file path + decision ID + decision title). Stop scanning immediately — this is the target.

---

## Step 3: Verify the Task File Actually Exists (only when a link is present)

If a decision has a `Source task(s):` line with one or more paths, verify at least one of the referenced task files still exists using `mcp__serena__find_file`. If every listed task file is missing (moved, deleted, renamed), treat the decision as task-less and surface it as if no link were present, but note the broken link.

---

## Step 4: Report

Choose the matching shape:

### A. No task-less accepted decision found

```
All accepted ADR decisions have task references. Nothing to action.
```

### B. Task-less decision found — no broken link

```
ADR-NNNN#DM: <Decision Title>
File: <path>
Status: accepted — no task linked

Suggested next step:
  /task-add <short action derived from the decision title, e.g. "Implement <title>"> --adr NNNN#DM
```

Append a one-sentence reminder of what the decision chose (pulled from `### Decision Outcome`) so the user knows what the task should implement.

### C. Task-less decision found — broken link (file missing)

```
ADR-NNNN#DM: <Decision Title>
File: <path>
Status: accepted — task link broken (referenced file not found)
Broken link: <original path from Source task(s):>

Suggested next steps:
  • Check .docs/tasks/completed/ or .docs/tasks/trashed/ for a moved file
  • Or create a replacement: /task-add <short action> --adr NNNN#DM
```

### D. Scoped file has no accepted decisions

```
<file path> has no accepted decisions. Run /adr-finalize <file>#DM to accept a proposed decision.
```

---

## Constraints

- **Never edit any file.** This skill is pure read + report.
- Use only `mcp__serena__list_dir`, `mcp__serena__find_file`, `Read`, and `AskUserQuestion`.
- Never use `bash` for file ops (`ls`, `cat`, `find`, `grep`, `sed` are all forbidden).
- Stop at the **first** gap — do not enumerate all gaps. The user runs `/adr-next` again after actioning each one.
- Keep the report terse — one block, no preamble, no closing summary.
