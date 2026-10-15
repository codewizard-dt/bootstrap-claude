---
name: whats-next
description: Survey ALL open work — tasks (in or out of a roadmap), UATs, bugs, roadmaps, ADR blocks and PRDs — and rank one prioritized do-next list with parallel waves (read-only)
category: researching
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
argument-hint: "[--limit N] [--family tasks,bugs,uat,roadmaps,adr,prd]"
---
**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/tasks/lifecycle.md`; run /primer if not done this session.

# What's Next

Answer "what should I do next?" across every work family at once — this is the cross-family counterpart to the per-family `*-assess` skills (`/roadmap-assess`, `/uat-assess`, `/adr-assess`, `/prd-assess`, `/bug-assess`, `/task-assess`), each of which sees only its own family, and to `/roadmap-next` and `/power-mode`, which only see work that sits inside a roadmap. Use this skill first when you want one ordered list of the next actions regardless of where an item lives.

This skill is strictly read-only: it never runs a case, never flips a status, never creates or edits a file, never asks questions, and never calls the `*-assess` skills (their side effects and prompts are exactly what it avoids). Acting on an item is the job of the command named in its `Next` cell.

Arguments: `--limit N` caps each wave (default 5); `--family <list>` restricts the sweep and the report to the named families (`tasks`, `bugs`, `uat`, `roadmaps`, `adr`, `prd`) — the graph still reads every task so dependency depth stays correct.

---

## Step 1: Discover & sweep

Read the Family table in `lib/skills/_shared/ID-RESOLUTION.md` for each family's directory and ID prefix — do not hardcode them. Both 3- and 4-digit IDs and the legacy `REQ-` / `DEC-` prefixes coexist until migrated, so match every width and prefix the table names.

**Sweep by frontmatter, never by index text.** Family `index.md` files go stale (a roadmap index can read 0/9 while its file has nine checked links), so they are consulted only for the index-drift warning in Step 5e. Run **one** `search_for_pattern` per family, pulling just the frontmatter lines you need, and `Read` a file in full only when its fields are not enough. Decide active vs. closed from each item's `status:` per that family's `lifecycle.md`, never from the directory it sits in.

Concrete example — the tasks sweep:

- `substring_pattern`: `^(id|title|status|created|updated|depends_on|blocks|uat):[^\n]*`
- `paths_include_glob`: `wiki/work/tasks/TASK-*.md`
- `paths_exclude_glob`: `wiki/work/tasks/archive/**`

Serena pitfalls, all verified — get these wrong and the sweep silently returns nothing or floods the context:

- Use `[^\n]*`, never `.*`. Multiline is on by default and `.` then matches newlines, so `^status:.*` swallowed whole files (459,518 characters on this repo).
- Never pass `multiline=false` together with `^` anchors — it returns `{}`.
- `paths_include_glob` needs the full repo-relative path (`wiki/work/tasks/TASK-*.md`, not `TASK-*.md`), or it matches nothing.
- Exclude `archive/` (pass the `paths_exclude_glob` above). Archived items still carry stale open-looking state — archived ROADMAP-009 still shows an unchecked `[[TASK-073]]`. Roadmaps, decisions and requirements no longer archive; skip any legacy `archive/` directory under them too.

Per-family recipe (same pitfalls apply to each):

| Family | Pattern (frontmatter lines) | Active means |
|--------|-----------------------------|--------------|
| tasks | as above | `todo`, `in-progress`, `pending-uat` |
| uat | `^(id\|title\|status\|task\|created):[^\n]*` plus `^\s*### UAT-[^\n]*` and each case's marker line, over `wiki/work/uat/UAT-*.md` | `pending`, `in-progress`, `failed` |
| bugs | `^(id\|title\|status\|severity\|priority\|created\|updated):[^\n]*` over `wiki/work/bugs/BUG-*.md` | `open`, `triaged`, `in-progress` |
| roadmaps | `^(id\|status):[^\n]*` plus `^\s*- \[[ x]\][^\n]*` over `wiki/work/roadmaps/ROADMAP-*.md` | `status: active` |
| adr | `^(id\|status\|## D\d+[^\n]*)[^\n]*` and each block's `Status:` line over `wiki/work/decisions/ADR-*.md` and legacy `DEC-*.md` | blocks `proposed`; `accepted` blocks with no task |
| prd | `^(id\|title\|status\|updated):[^\n]*` over `wiki/work/requirements/PRD-*.md` and legacy `REQ-*.md` | `draft`, `approved` |

For roadmaps, follow the **Parse a roadmap** procedure in `lib/skills/roadmap-next/SKILL.md` as written — do not restate it. Run only that procedure: never its Upgrade-inline-items, Parallelism-analysis or Close-a-fully-complete-roadmap procedures, which write files. The procedure's 9-item cap applies to its candidate list only; keep the full `total` / `done` counts. A roadmap item that links a task adds no row of its own — the task's row (from the tasks sweep) carries a `Roadmap` display value; an unchecked `inline` item becomes an inline-item row.

For the per-family status vocabularies and terminal states, read each family's `lifecycle.md` rather than assuming them. For a UAT, count a case as unit-backed when it carries a `Unit Test Command` line or a `Repeatable Unit Test: Created` line, otherwise manual-only (reading the line is enough — never run it). For a bug, take `severity` and `priority` as written; `priority: "—"` means untriaged. For ADR blocks and PRDs, take in-family precedence and the accepted-without-task / approved-without-downstream checks from `lib/skills/adr-assess/SKILL.md` and `lib/skills/prd-assess/SKILL.md` — do not restate them.

Apply `--family` after the sweep, when choosing which rows to report.

**An empty sweep against a non-empty family index is a WARNING, not "no work".** Before trusting a zero-hit family, `Read` its `index.md` (or `list_dir` the directory): if the index or directory lists items the sweep did not see, re-check the glob and pattern against the pitfalls above, and record an empty-sweep warning for Step 5e. Only when every family is genuinely empty, STOP: `No open work found — nothing to rank. Use /task-create, /bug-create or /roadmap-create to add some.`

## Step 2: Build the graph

Nodes are the active tasks, plus bugs, ADR blocks, PRDs and roadmap items where they take part in an edge. For each task, build its dependency edges from the **union** of its own `depends_on` (frontmatter and `depends_on::[[TASK-NNNN]]` links) and the reverse of every other task's `blocks`. Resolve each referenced ID per the masks in `lib/skills/_shared/ID-RESOLUTION.md` (both widths).

**Start-satisfied vs. close-satisfied.** A `depends_on` edge is *start-satisfied* when the prerequisite is `pending-uat` or `done`, or has left the active set as terminal (`trashed`). It is *close-satisfied* only when the prerequisite is `done`. A task whose prerequisite is `pending-uat` may be started but is flagged **soft-blocked for closure** — it cannot reach `done` until that prerequisite's UAT is run. A task with any prerequisite that is not start-satisfied is **blocked**.

Detect and record for Step 5e:

- **Asymmetric edges** — task A lists B in `depends_on` but B lacks A in `blocks`, or the reverse. Report each pair as `A ← B (no matching blocks)`.
- **Cycles** — walk the graph via DFS; report each cycle as `TASK-A → TASK-B → TASK-A`. Never silently pick a winner; exclude cycle members from the actionable tiers and list them under Blocked.
- **Stale references** — an edge to an ID that resolves to no file, or to a `trashed` item that never left the edge list.

Compute for every node: `downstream_depth` (length of the longest chain of dependents that transitively waits on it) and `fan_out` (count of direct dependents). Also link the other families where a real edge exists: a `pending-uat` task to its UAT (`uat:` field, else the UAT whose `task:` points back), a proposed ADR block to the roadmaps, PRDs and tasks that reference it (its gated count), an approved PRD to any downstream ADR or task, a bug to the task that fixes it (`origin_bug:` on tasks). A UAT or ADR block that gates a task adds to that item's `fan_out` and `downstream_depth`.

## Step 3: Rank

Ranking is a **deterministic lexicographic sort over tiers, never a numeric score** — tasks carry no priority or effort field and bugs are mostly untriaged, so a score would be false precision. Assign every actionable item to the first tier it fits, highest priority first:

| Tier | Name | Items |
|------|------|-------|
| 1 | Fix what's broken | bugs `in-progress`; bugs triaged P0 or P1; bugs with `severity: critical` |
| 2 | Finish what's started | tasks `in-progress`; tasks `pending-uat` (run the UAT); untriaged bugs as **one batch row**, promoted here only when any of them is `high` or `critical` |
| 3 | Unblock | proposed ADR blocks that gate live work; approved PRDs with no downstream ADR or task |
| 4 | Start ready work | `todo` tasks whose `depends_on` edges are all start-satisfied; unchecked inline roadmap items; accepted ADR blocks with no task |
| 5 | Triage & hygiene | untriaged bugs (as one batch row when not promoted), stale drafts, fully-checked roadmaps awaiting close, index drift |

Then a separate **Blocked** list — items with an unsatisfied `depends_on` edge, cycle members, and roadmaps gated on a proposed decision — listed with what each waits on and **never ranked as actionable**.

**Within a tier**, order by: `downstream_depth` descending, `fan_out` descending, age ascending (oldest `created` first), then ID ascending. For in-family precedence that this table does not decide (which proposed block or draft PRD first, stale-draft and long-idle thresholds), follow the **Rank** step of the matching family skill — `lib/skills/adr-assess/SKILL.md`, `lib/skills/prd-assess/SKILL.md`, `lib/skills/uat-assess/SKILL.md`, `lib/skills/bug-assess/SKILL.md` — without restating it here.

**Roadmap membership is a display column, not a ranking input.** An orphan task (in no active roadmap) ranks exactly as if it were in one; otherwise orphans starve behind roadmap work. Count the orphans and suggest adopting them into a roadmap in Step 5e.

Record a one-sentence `Why` per item — a judgment call the user can override, not a fact.

## Step 4: Waves

Build parallel waves from Tier 1-4 items in the **task pipeline** (tasks, plus the UAT runs of `pending-uat` tasks), skipping bug batches, ADR, PRD and roadmap rows. **Wave 1** is the highest-ranked items with no dependency edge between any two of them and every prerequisite start-satisfied; **Wave 2** is the next set that becomes ready once Wave 1 is done (their only unmet edges point into Wave 1). Cap each wave at `--limit N` items, default 5, in rank order; note the overflow count. Omit Wave 3+.

Waves rest on graph edges only. Collision-safety beyond the graph (shared files, overlapping edits) is `/power-mode`'s own protocol at execution time — do not try to predict it here.

## Step 5: Report

Print, in this order, with no preamble:

### 5a. Snapshot

One line per family: `<family>: <active> active (<by-state counts>)`. Then a WIP-by-state histogram over all active tasks and UATs, one row per state (`todo`, `in-progress`, `pending-uat`, UAT `pending` / `in-progress` / `failed`) with a count and a bar, so a bottleneck concentrated in one state is visible at a glance.

### 5b. Waves

```
## Wave 1 (parallel)
- TASK-NNNN — <title> → `/tackle wiki/work/tasks/TASK-NNNN-slug.md`
## Wave 2 (after Wave 1)
- TASK-MMMM — <title> → `/uat-auto wiki/work/uat/UAT-MMMM-slug.md`
```

Each line carries the copy-pasteable `Next` command for that item.

### 5c. Ranked table

```
## Ranked

| Rank | Item | Family | Roadmap | Why | Unblocks | Next |
|------|------|--------|---------|-----|----------|------|
| 1 | TASK-NNNN — <title> | task | ROADMAP-NNNN or — | <one sentence> | TASK-MMMM, TASK-PPPP | `/tackle <path>` |
```

Rank runs 1..N across tiers in order (state the tier in `Why`). `Roadmap` is the display column — `—` for an orphan. `Unblocks` lists the direct dependents and gated items.

`Next` by item state — every command below is a real skill; name only these:

- task `in-progress` or `todo` → `/tackle <path>`
- task `pending-uat`, UAT exists → `/uat-auto <uat>` when every unresolved case is unit-backed, otherwise `/uat-walk <uat>`
- task `pending-uat`, no UAT yet → `/uat-create <task>`
- bug `open` → `/bug-assess` (the batch row) or `/bug-triage BUG-NNNN` (a single bug)
- bug `triaged` → `/bug-triage BUG-NNNN` or `/task-create <description>`
- bug `in-progress` → `/bug-close BUG-NNNN`
- proposed ADR block → `/adr-finalize <file>#DM`
- accepted ADR block with no task → `/task-create --decision ADR-NNNN#DM`
- approved PRD with no downstream → `/adr-extract <file>`
- draft PRD → `/prd-finalize <file>`
- roadmap with every item checked → `/roadmap-next <roadmap>`
- inline roadmap item → `/roadmap-next <roadmap>`

### 5d. Blocked

```
## Blocked

- TASK-NNNN — <title> — waits on TASK-MMMM (<state>), ADR-NNNN#DM (proposed)
```

List each blocked item with exactly what it waits on. Also list soft-blocked-for-closure tasks here (started, but waiting on a prerequisite's UAT).

### 5e. Warnings (omit if none found)

Flag, each as its own short block:

- dependency cycles and asymmetric edges from Step 2 (name the pairs);
- stale references and broken links;
- index drift — a family `index.md` whose listing disagrees with the frontmatter sweep;
- the **orphan count** — `N of M active tasks sit outside every active roadmap` — with a suggestion to adopt them via `/roadmap-create`;
- **empty-sweep suspicion** — any family whose sweep returned nothing while its index or directory shows items (see Step 1).

Footer, when any closed item was excluded: `Closed: N (not assessed)`.

---

## Constraints

- Read-only — no exception. No file edits, no shell, no prompts, no log or index changes, no status flips. The commands in each `Next` cell are the follow-up actions the user runs once they act on this report.
- Permitted tools: `list_dir`, `find_file`, `search_for_pattern`, `Read`.
- Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Never run a case's `Unit Test Command` — ranking is not executing; `/uat-auto` and `/uat-walk` do that.
- Handing a whole wave to `/power-mode` awaits a task-ID-list dispatch there; until then the report prints one copy-pasteable command per item.
- Keep the report terse — no preamble, no closing summary beyond the sections above.
