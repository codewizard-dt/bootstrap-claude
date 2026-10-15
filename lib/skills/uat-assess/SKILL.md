---
name: uat-assess
description: Survey all active UATs together — group them by what each is waiting on (failing cases, partial walks, auto-runnable, manual-only cases, stubs), rank by what each unblocks, and give a status update with a suggested next command for each
category: researching
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/uat/lifecycle.md`; run /primer if not done this session.

# UAT Assessment

Assess every active UAT in `wiki/work/uat/` together — this is the multi-UAT counterpart to `/uat-walk` (interactive, one UAT) and `/uat-auto` (headless, one UAT), which each operate on exactly one UAT you've already picked. Use this skill first when several UATs are open and you need to decide which to run next, based on what each is waiting on and what finishing it unblocks.

This skill is strictly read-only: it never runs a case, never flips a status, never creates a file, and never asks questions. Acting on a UAT is the job of the commands named in each `Next` line.

---

## Step 1: Discover active UATs

`list_dir` `wiki/work/uat/` for `.md` files **directly** in it; skip `archive/`, `screenshots/`, `lifecycle.md`, `index.md`, `README.md`. None found → STOP: `No active UATs found in wiki/work/uat/. Use /uat-create <task> to generate one.`

A terminal UAT (`passed`, `skipped`, `trashed` per `wiki/work/uat/lifecycle.md`) may not have been swept into `archive/` yet, so also decide active vs. closed by each file's `status:`. Closed UATs are excluded from ranking and counted once in the report footer. If nothing is active after this filter, STOP with the same empty-family text.

## Step 2: Parse every active UAT

`Read` each file in full and extract:

- **Frontmatter**: `id`, `title`, `status`, `task`, `created`, `updated`.
- **Cases**: every `### UAT-<KIND>-NNN: <title>` heading (ignore the `## Prerequisites` checkboxes — they are not cases) and each case's marker: `[ ]` (not run), `[x]` (pass), `[FAIL: …]`, `[SKIP: …]`.
- **Backing** for each unresolved case (`[ ]` or `[FAIL: …]`): **unit-backed** when it carries a `Unit Test Command` line or a `Repeatable Unit Test: Created` line; **manual-only** when the field reads `Not applicable` or `Blocked`, or no command exists.
- **Stub**: a UAT with zero `### UAT-…` case headings, or only the skeleton left by `/uat-skip`.

Derive each UAT's state:

- `failed` — `status: failed`, or any `[FAIL: …]` case that records a real failure. A `[FAIL: auto-judge: … requires human verification]` marker is `/uat-auto` deferring a case to a person, not a failure: treat that case as unresolved and manual-only, and do not count it toward `failed` or the status/marker drift warning.
- `in-progress` — `status: in-progress`, or a mix of resolved (`[x]`/`[SKIP: …]`) and unresolved cases.
- `pending` — every case unresolved and `status: pending`.
- `stub` — as defined above.

A `status:` outside the lifecycle's enum is reported in Step 5c, and the UAT is ranked by its markers alone.

## Step 3: Task and roadmap linkage

For each active UAT, resolve its `task:` back-link to one task file:

Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: tasks · scope: active+archive · ambiguous: headless · empty: n/a

Not found, or an empty `task:`, is an orphan: record it for Step 5c and continue — never STOP. Otherwise `Read` the task and record its `status` and its `blocks:` array (the TASK IDs the task gates).

Then `search_for_pattern` for `[[TASK-NNNN` (the UAT's task, both ID widths) in `wiki/work/roadmaps/`. For each roadmap that lists it, run the **Parse a roadmap** procedure defined in `lib/skills/roadmap-next/SKILL.md` — do not restate it here, follow it as written — and select roadmaps by their `status:`, never by directory. Record the roadmap item the task would tick, and whether it is the last unchecked item of that roadmap.

## Step 4: Rank UATs

Order the active UATs, highest priority first, using this precedence:

1. **Unblocking power** — the UAT's task `blocks:` other tasks (hard order: a UAT gating another task always outranks the UATs it gates), or its task is the last unchecked item of its roadmap.
2. **What it waits on**, in this order:
   1. `failed` — a `[FAIL: …]` case that needs a fix;
   2. `in-progress` — partially walked;
   3. `pending` with every unresolved case unit-backed — **auto-runnable** headless via `/uat-auto`;
   4. `pending` with any manual-only case — needs a human;
   5. `stub` — nothing to run.
3. **Age** — oldest `created` first, then `UAT-NNNN` ascending.

Record a one-sentence rationale per UAT — a judgment call the user can override, not a fact.

## Step 5: Report

Print, in this order:

### 5a. Prioritized UATs

```
## Prioritized UATs

| Rank | UAT | Status | Waits on | Unblocks | Rationale |
|------|-----|--------|----------|----------|-----------|
| 1 | UAT-NNNN — <title> | failed | failing case: UAT-KIND-NNN | TASK-MMMM, ROADMAP-NNNN item 3 | <one sentence> |
| 2 | UAT-MMMM — <title> | pending | auto-runnable | — | <one sentence> |
```

`Waits on` is one of: `failing case` (name the case), `partial walk`, `auto-runnable`, `manual cases: N` (N manual-only cases), `stub`. `Unblocks` lists the gated `TASK-NNNN` IDs and/or the `ROADMAP-NNNN` item from Step 3; `—` if none.

### 5b. Status update per UAT

One block per UAT, in ranked order:

```
### UAT-NNNN — <title>
- Task: TASK-NNNN (<task status>)
- Status: <failed | in-progress | pending | stub> — <M/N cases resolved>
- Summary: <one line>
- Next: <see below>
```

`Next` by state:

- failed → fix the failing case, then `/uat-auto <file>`; for a real defect: `/bug-create <description>`
- in-progress → `/uat-walk <file>`
- auto-runnable → `/uat-auto <file>`
- manual-only → `/uat-walk <file>`
- stub → `/uat-create TASK-NNNN` to regenerate, or `/uat-skip <file>`

### 5c. Warnings (omit if none found)

Flag, each as its own short block:

- a UAT whose task is missing or terminal — a `/task-close` candidate;
- status/marker drift — `passed` with unchecked cases, `pending` with checked cases;
- a UAT with an unrecognized `status:`;
- a UAT row missing or stale in the `wiki/work/uat/index.md` listing.

Footer, when Step 1 excluded any closed UAT: `Closed: N (not assessed)`.

---

## Constraints

- Read-only — no exception. No file edits, no shell, no prompts, no log or index changes, no status flips.
- Permitted tools: `list_dir`, `find_file`, `search_for_pattern`, `Read`.
- Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Never run a case's `Unit Test Command` — assessing is not executing; `/uat-auto` and `/uat-walk` do that.
- Keep the report terse — no preamble, no closing summary beyond the tables above.
