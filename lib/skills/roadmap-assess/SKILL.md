---
name: roadmap-assess
description: Survey all active roadmaps together — parse status and progress, flag outstanding decisions blocking readiness, detect cross-roadmap dependencies, and produce a single prioritized list with a status update for each roadmap
category: researching
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# Roadmap Assessment

Assess every active roadmap in `wiki/work/roadmaps/` together — this is the multi-roadmap counterpart to `/roadmap-next`, which now operates on exactly one roadmap you've already picked. Use this skill first when several roadmaps are active and you need to decide which to work next, based on the priority of the functionality each one delivers and the dependencies between them.

This skill is read-mostly: it never upgrades inline placeholders to task files and never touches checkboxes. Materializing and working items is `/roadmap-next`'s job once a roadmap has been selected.

---

## Step 1: Discover active roadmaps

`list_dir` `wiki/work/roadmaps/` for `.md` files **directly** in it (not `archive/`); skip `lifecycle.md`, `index.md`, `README.md`. None found → STOP: `No roadmaps found in wiki/work/roadmaps/. Use /roadmap-create <topic> to draft one.`

A single active roadmap is still worth assessing — don't short-circuit to `/roadmap-next`; the status update in Step 6d is useful on its own.

## Step 2: Parse every roadmap

For each file, run the **Parse a roadmap** procedure defined in `lib/skills/roadmap-next/SKILL.md` — do not restate it here, follow it as written. In addition to what that procedure captures, also extract from frontmatter: `owner`, `tags`, `linked_requirements`, `linked_decisions`, `created`, `updated`.

Also scan the roadmap body for inline typed links referencing decisions (e.g. `rel::[[DEC-0003#D2]]`, `implements::[[DEC-0003]]`) — a decision can gate a roadmap without being listed in `linked_decisions`. Merge these into the same per-roadmap decision-reference set.

Do **not** run the Upgrade-inline-items or Parallelism-analysis procedures from that same file — those materialize task files, which is out of scope here. This step only reads.

## Step 3: Auto-archive fully-complete roadmaps

For any roadmap where `total > 0` and `done == total`: run the **Archive a fully-complete roadmap** procedure defined in `lib/skills/roadmap-next/SKILL.md` — do not restate it here, follow it as written. Record the filename in `archived`. Drop it from the set being ranked — a `done` roadmap has no priority left to weigh.

If every discovered roadmap was archived this step, STOP and report: `All roadmaps complete — archived: <list>. Nothing active to assess.`

## Step 4: Outstanding decision check

Before weighing priority or dependencies, check whether any remaining roadmap is gated on a decision that hasn't been finalized yet — an unresolved decision means the roadmap isn't truly ready to work, regardless of how it otherwise ranks.

For every remaining roadmap, take its merged decision-reference set from Step 2 (`linked_decisions` frontmatter + inline `rel::[[DEC-...]]` links). Each reference is a Decision Group file (`DEC-NNNN`) and, ideally, a specific decision block within it (`DEC-NNNN#DM`, e.g. `#D2`). For each unique reference:

1. `find_file` / `Read` the Decision Group file in `wiki/work/decisions/` (check `archive/` too if not found active). Missing file → note as a broken reference, don't block on it.
2. Find the `## DM. <title>` block matching the referenced `#DM`. If the roadmap referenced only `DEC-NNNN` with no `#DM`, treat every `proposed` block in that group as a separate outstanding decision.
3. Read that block's `Status:` field (`proposed | accepted | superseded`).
4. If `Status: superseded`, the block is annotated `superseded by DEC-NNNN#DM` — follow that pointer to the current decision's block and re-check its status instead of stopping at the superseded one.
5. If the resolved status is `proposed` (not yet `accepted`), record it as an **outstanding decision** blocking that roadmap: `{roadmap, DEC-NNNN#DM, title, file path}`.

Deduplicate by decision so a shared unresolved decision blocking multiple roadmaps is only reported once per roadmap it actually gates.

This step is read-only — never run `/decision-finalize` yourself; surface the blockers so the user can resolve them (or explicitly choose to proceed anyway).

## Step 5: Cross-roadmap dependency analysis

For every remaining roadmap's `task-link` items (skip `inline` items — no task file exists yet to inspect): `Read` the task file, find `## Dependencies` / `## Blocked by` / `depends_on::` / `blocks::` refs, extract `TASK-NNN` IDs.

For each referenced `TASK-NNN`, check whether it belongs to a *different* roadmap (scan the parsed item lists from Step 2 for that ID). If so, record a directed edge `blocking_roadmap → blocked_roadmap` (the roadmap holding the prerequisite task blocks the roadmap holding the dependent task).

Also note — but do not treat as a hard edge — soft relatedness: roadmaps sharing a `linked_requirements` or `linked_decisions` entry. If a shared linked decision's text explicitly states a sequence ("do X before Y", "requires X shipped first"), `Read` that decision file and promote it to a hard edge instead.

Deduplicate edges. Walk the graph via DFS to detect cycles — if found, flag them in Step 6e rather than silently picking a winner.

## Step 6: Rank roadmaps

Order the remaining roadmaps, highest priority first, using this precedence:

1. **Hard dependency order** (from Step 5) — a roadmap that blocks another always outranks the one it blocks. Never violate this to satisfy #2, #3, or the outstanding-decision flag below.
2. **Functional priority** — a judgment call from each roadmap's `## Goal`, `tags`, and any linked requirement's priority/severity field (`Read` it if present). Goals that unblock or protect other work (infra, security, load-bearing bug fixes) outrank polish or nice-to-have goals. Record a one-sentence rationale per roadmap in the report — this is a judgment call the user can override, not a fact.
3. **Momentum** (tie-break only — never overrides #1 or #2) — a higher `done/total` ratio ranks slightly higher; finishing in-flight work compounds value faster than starting a new thread.

If two or more roadmaps are genuinely indistinguishable on all three signals, keep their existing relative order (`ROADMAP-NNN` ascending) rather than guessing.

An outstanding decision (Step 4) does **not** change a roadmap's rank — it changes what "next" means for it. A blocked roadmap can still be #1 in priority; it's just not actionable via `/roadmap-next` until the decision resolves. Reflect that in the rank table's `Depends on` column and in the Step 6d status block.

## Step 7: Report

Print, in this order:

### 6a. Archived this run (omit if `archived` is empty)

```
Archived to wiki/work/roadmaps/archive/ (fully complete):
  • <filename> — done
```

### 6b. Outstanding Decisions (omit if none found)

```
## Warning: Outstanding Decisions

These roadmaps are gated on decisions still `proposed` — resolve via `/decision-finalize <file>#<DM>` before treating the roadmap as ready to work:

| Decision | Status | Blocks Roadmap | Title |
|----------|--------|-----------------|-------|
| DEC-0003#D2 | proposed | ROADMAP-009 — <title> | <decision title> |
```

### 6c. Prioritized Roadmaps

```
## Prioritized Roadmaps

| Rank | Roadmap | Progress | Priority rationale | Depends on |
|------|---------|----------|---------------------|------------|
| 1 | ROADMAP-NNN — <title> | M/N | <one sentence> | — |
| 2 | ROADMAP-MMM — <title> | M/N | <one sentence> | ROADMAP-NNN (Phase X blocks it) |
```

`Depends on` lists the hard-edge blockers found in Step 5, or `—` if none. A roadmap with an outstanding decision also gets `Blocked by DEC-NNNN#DM` appended here even if it has no roadmap-to-roadmap dependency.

### 6d. Status update per roadmap

One block per roadmap, in ranked order:

```
### ROADMAP-NNN — <title>
- Owner: <owner, or "unassigned">
- Progress: M/N items checked
- Status: <active — on track | active — stalled | active — mostly inline placeholders, not yet materialized | blocked — awaiting decision(s)>
- Next: `/roadmap-next wiki/work/roadmaps/NNN-slug.md`
```

Base `Status` on progress momentum and whether items remain `inline` (unmaterialized) vs `task-link` — call out roadmaps that are still mostly inline placeholders, since `/roadmap-next` needs to run on them before real progress can be tracked.

If the roadmap has an outstanding decision from Step 4, set `Status: blocked — awaiting decision(s): DEC-NNNN#DM` and replace `Next` with the decision-resolution action instead of `/roadmap-next`:

```
- Next: `/decision-finalize wiki/work/decisions/NNNN-slug.md#DM`
```

### 6e. Dependency cycles (omit if none found)

```
## Warning: Dependency Cycle

ROADMAP-NNN → ROADMAP-MMM → ROADMAP-NNN
These roadmaps block each other — resolve the cycle manually before treating either as higher priority.
```

---

## Constraints

- Read-only except the Step 3 auto-archive procedure (status flip + `git mv` + index/log updates) — never flip checkboxes, never upgrade inline items, never create task files, never finalize decisions. That is `/roadmap-next`'s and `/decision-finalize`'s job once the user acts on this report.
- Permitted tools: `list_dir`, `find_file`, `Read`, `Edit`, `Bash` (only for `git mv` during archiving), `AskUserQuestion` (only if genuinely needed to disambiguate — this skill should normally run to completion without prompting).
- Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Keep the report terse — no preamble, no closing summary beyond the tables above.
