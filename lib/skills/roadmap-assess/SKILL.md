---
name: roadmap-assess
description: Survey all active roadmaps together — parse status and progress, detect cross-roadmap dependencies, and produce a single prioritized list with a status update for each roadmap
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

A single active roadmap is still worth assessing — don't short-circuit to `/roadmap-next`; the status update in Step 6c is useful on its own.

## Step 2: Parse every roadmap

For each file, run the **Parse a roadmap** procedure defined in `lib/skills/roadmap-next/SKILL.md` — do not restate it here, follow it as written. In addition to what that procedure captures, also extract from frontmatter: `owner`, `tags`, `linked_requirements`, `linked_decisions`, `created`, `updated`.

Do **not** run the Upgrade-inline-items or Parallelism-analysis procedures from that same file — those materialize task files, which is out of scope here. This step only reads.

## Step 3: Auto-archive fully-complete roadmaps

For any roadmap where `total > 0` and `done == total`: run the **Archive a fully-complete roadmap** procedure defined in `lib/skills/roadmap-next/SKILL.md` — do not restate it here, follow it as written. Record the filename in `archived`. Drop it from the set being ranked — a `done` roadmap has no priority left to weigh.

If every discovered roadmap was archived this step, STOP and report: `All roadmaps complete — archived: <list>. Nothing active to assess.`

## Step 4: Cross-roadmap dependency analysis

For every remaining roadmap's `task-link` items (skip `inline` items — no task file exists yet to inspect): `Read` the task file, find `## Dependencies` / `## Blocked by` / `depends_on::` / `blocks::` refs, extract `TASK-NNN` IDs.

For each referenced `TASK-NNN`, check whether it belongs to a *different* roadmap (scan the parsed item lists from Step 2 for that ID). If so, record a directed edge `blocking_roadmap → blocked_roadmap` (the roadmap holding the prerequisite task blocks the roadmap holding the dependent task).

Also note — but do not treat as a hard edge — soft relatedness: roadmaps sharing a `linked_requirements` or `linked_decisions` entry. If a shared linked decision's text explicitly states a sequence ("do X before Y", "requires X shipped first"), `Read` that decision file and promote it to a hard edge instead.

Deduplicate edges. Walk the graph via DFS to detect cycles — if found, flag them in Step 6d rather than silently picking a winner.

## Step 5: Rank roadmaps

Order the remaining roadmaps, highest priority first, using this precedence:

1. **Hard dependency order** (from Step 4) — a roadmap that blocks another always outranks the one it blocks. Never violate this to satisfy #2 or #3.
2. **Functional priority** — a judgment call from each roadmap's `## Goal`, `tags`, and any linked requirement's priority/severity field (`Read` it if present). Goals that unblock or protect other work (infra, security, load-bearing bug fixes) outrank polish or nice-to-have goals. Record a one-sentence rationale per roadmap in the report — this is a judgment call the user can override, not a fact.
3. **Momentum** (tie-break only — never overrides #1 or #2) — a higher `done/total` ratio ranks slightly higher; finishing in-flight work compounds value faster than starting a new thread.

If two or more roadmaps are genuinely indistinguishable on all three signals, keep their existing relative order (`ROADMAP-NNN` ascending) rather than guessing.

## Step 6: Report

Print, in this order:

### 6a. Archived this run (omit if `archived` is empty)

```
Archived to wiki/work/roadmaps/archive/ (fully complete):
  • <filename> — done
```

### 6b. Prioritized Roadmaps

```
## Prioritized Roadmaps

| Rank | Roadmap | Progress | Priority rationale | Depends on |
|------|---------|----------|---------------------|------------|
| 1 | ROADMAP-NNN — <title> | M/N | <one sentence> | — |
| 2 | ROADMAP-MMM — <title> | M/N | <one sentence> | ROADMAP-NNN (Phase X blocks it) |
```

`Depends on` lists the hard-edge blockers found in Step 4, or `—` if none.

### 6c. Status update per roadmap

One block per roadmap, in ranked order:

```
### ROADMAP-NNN — <title>
- Owner: <owner, or "unassigned">
- Progress: M/N items checked
- Status: <active — on track | active — stalled | active — mostly inline placeholders, not yet materialized>
- Next: `/roadmap-next wiki/work/roadmaps/NNN-slug.md`
```

Base `Status` on progress momentum and whether items remain `inline` (unmaterialized) vs `task-link` — call out roadmaps that are still mostly inline placeholders, since `/roadmap-next` needs to run on them before real progress can be tracked.

### 6d. Dependency cycles (omit if none found)

```
## Warning: Dependency Cycle

ROADMAP-NNN → ROADMAP-MMM → ROADMAP-NNN
These roadmaps block each other — resolve the cycle manually before treating either as higher priority.
```

---

## Constraints

- Read-only except the Step 3 auto-archive procedure (status flip + `git mv` + index/log updates) — never flip checkboxes, never upgrade inline items, never create task files. That is `/roadmap-next`'s job once the user picks a roadmap to work.
- Permitted tools: `list_dir`, `find_file`, `Read`, `Edit`, `Bash` (only for `git mv` during archiving), `AskUserQuestion` (only if genuinely needed to disambiguate — this skill should normally run to completion without prompting).
- Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Keep the report terse — no preamble, no closing summary beyond the tables above.
