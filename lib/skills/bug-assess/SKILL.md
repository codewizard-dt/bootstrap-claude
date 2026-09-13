---
name: bug-assess
description: Survey all active bugs together — batch-triage any still-open reports first, then rank the full active set by priority, severity, impact, and blocking relationships into a single prioritized fix order with a status update for each bug
category: researching
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# Bug Assessment

Assess every active bug in `wiki/work/bugs/` together — this is the multi-bug counterpart to `/bug-triage`, which operates on exactly one bug you've already picked. Use this skill when several bugs are active and you need to decide which to fix next, based on priority, severity, impact, and the blocking relationships between them.

This skill is read-mostly with one deliberate exception: if any bug is still `status: open`, it runs a batch-triage pass first (with user confirmation per bug) so the ranking rests on real priorities rather than blanks. Deeper triage outcomes — starting work, rejecting — remain `/bug-triage`'s job.

---

## Step 1: Discover active bugs

`list_dir` `wiki/work/bugs/` for `BUG-*.md` files **directly** in it (not `archive/`); skip `lifecycle.md`, `index.md`. None found → STOP: `No bugs found in wiki/work/bugs/. Use /bug-file <description> to file one.`

A single active bug is still worth assessing — the status update in Step 6d is useful on its own.

## Step 2: Parse every bug

For each file, `Read` it in full and extract:

- **Frontmatter**: `id`, `title`, `status`, `severity`, `priority`, `assignee`, `tags`, `created`, `updated`.
- **Body signals**: `## Impact` (who is affected, what it blocks), `## Related` (duplicate-of, related bugs, blocking references), reproducibility, workaround.
- **Typed links**: inline `rel::[[BUG-NNNN]]`, `blocks::[[BUG-NNNN]]`, `depends_on::[[BUG-NNNN]]` anywhere in the body — a bug can gate another without a `## Related` entry. Merge these into the same per-bug reference set.

Cross-check each bug against `wiki/work/bugs/index.md`: note any bug whose index row is missing or whose status/priority text is stale. Report the drift in Step 6e — fix a row only if the Step 3 triage pass touches that bug anyway.

## Step 3: Batch-triage pass

**Run only if at least one bug is `status: open`.** Otherwise skip to Step 4.

For each open bug, derive a proposal from its body: a priority (`P0`–`P3`), a confirmed-or-revised severity, and suggested tags. Then confirm with the user via `AskUserQuestion` — batch up to 4 bugs per call, one question per bug, with your proposal as the recommended first option. Always include a **"needs full triage"** option: picking it leaves the bug `open`, untouched, and listed in Step 6b with `Next: /bug-triage BUG-NNNN`.

For each confirmed bug, apply the updates per the Step 6/7 procedure in `lib/skills/bug-triage/SKILL.md` — do not restate its edit mechanics, follow them as written: `Edit` the bug file (flip `status: open` → `triaged`, set `priority:` / `tags:`, confirm `severity:`, bump `updated:` to today) and update its `wiki/work/bugs/index.md` row's status/priority text.

Outcomes this pass does **not** handle: starting work (`in-progress`) and rejection (`wontfix` / `duplicate` / `cannot-reproduce`). Those require the impact/workaround/resolution rigor of `/bug-triage` — never shortcut them here.

Append **one** combined entry to `wiki/log.md` for the whole pass, not one per bug:

```
## [YYYY-MM-DD] bug-assess | batch triage
Triaged BUG-NNNN, BUG-MMM, … open → triaged with confirmed priorities. <one sentence>
```

## Step 4: Blocking analysis

From each bug's merged reference set (Step 2), build directed edges `blocking_bug → blocked_bug` — the bug named in a `depends_on::` / "blocked by" reference blocks the bug holding the reference; a `blocks::` reference points the other way.

A **duplicate-of** reference on an active bug is a red flag, not an edge: duplicates should have been rejected and archived at triage. Surface it in Step 6e — don't fix it here.

Deduplicate edges. Walk the graph via DFS to detect cycles — if found, flag them in Step 6e rather than silently picking a winner.

## Step 5: Rank bugs

Order all active bugs, highest priority first, using this precedence:

1. **Hard blocking order** (from Step 4) — a bug that blocks others always outranks the bugs it blocks. Never violate this to satisfy the signals below.
2. **Priority** — `P0` first, descending to `P3`. A bug with no priority (`—`) ranks after `P3` with a note — it shouldn't exist after Step 3 unless the user declined triage.
3. **Severity** — `critical` → `high` → `medium` → `low`.
4. **Impact** — a judgment call from `## Impact`, reproducibility, and workaround (no workaround outranks an easy one). Record a one-sentence rationale per bug in the report — this is a judgment call the user can override, not a fact.
5. **Tie-break only** — `in-progress` ranks above `triaged` (finishing in-flight fixes compounds value faster than starting new ones); then `BUG-NNNN` ascending.

Bugs left `open` (declined batch triage) are still ranked on the signals available, but marked **not actionable until triaged** — `/bug-triage` is their next step, not a fix.

## Step 6: Report

Print, in this order:

### 6a. Triaged this run (omit if none)

```
Batch-triaged (open → triaged):
  • BUG-NNNN — <title> — P<N>, <severity>
```

### 6b. Untriaged (omit if none)

```
## Warning: Untriaged Bugs

These bugs are still `open` — not actionable until triaged:

| Bug | Severity | Next |
|-----|----------|------|
| BUG-NNNN — <title> | <severity> | `/bug-triage BUG-NNNN` |
```

### 6c. Prioritized Bugs

```
## Prioritized Bugs

| Rank | Bug | Priority | Severity | Status | Rationale | Blocks / Blocked by |
|------|-----|----------|----------|--------|-----------|---------------------|
| 1 | BUG-NNNN — <title> | P1 | high | triaged | <one sentence> | blocks BUG-MMM |
| 2 | BUG-MMM — <title> | P1 | medium | in-progress | <one sentence> | blocked by BUG-NNNN |
```

`Blocks / Blocked by` lists the hard edges from Step 4, or `—` if none.

### 6d. Status update per bug

One block per bug, in ranked order:

```
### BUG-NNNN — <title>
- Assignee: <assignee, or "unassigned">
- Status: <open | triaged | in-progress>
- Impact: <one line>
- Next: <see below>
```

`Next` by status:

- `open` → `/bug-triage BUG-NNNN`
- `triaged` → `/bug-triage BUG-NNNN` to start work, or suggest `/task-add` for a fix task
- `in-progress` → continue the fix; `/bug-close BUG-NNNN` when the fix commit and regression test land

### 6e. Warnings (omit if none found)

Flag, each as its own short block: dependency cycles (`BUG-NNNN → BUG-MMM → BUG-NNNN — these block each other; resolve manually`), active bugs carrying a duplicate-of reference (should have been rejected at triage — `/bug-triage BUG-NNNN`), and index drift from Step 2 (missing or stale rows in `wiki/work/bugs/index.md`).

---

## Constraints

- Read-only except the Step 3 batch-triage edits (status flip to `triaged`, triage fields, index row text, one combined log entry) — never flip to `in-progress` or a terminal status, never archive, never create task files. That is `/bug-triage`, `/bug-close`, and `/task-add`'s job once the user acts on this report.
- Permitted tools: `list_dir`, `find_file`, `Read`, `Edit`, `AskUserQuestion` (Step 3 confirmations only — otherwise this skill should run to completion without prompting).
- Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Keep the report terse — no preamble, no closing summary beyond the tables above.
