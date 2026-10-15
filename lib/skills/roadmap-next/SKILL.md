---
name: roadmap-next
description: Point at the first unchecked item(s) in a single roadmap; create task files for inline placeholders; group items into parallelizable waves; auto-close when fully checked. Requires a roadmap argument — run /roadmap-assess first to see status and priority across all active roadmaps.
category: researching
model: claude-haiku-4-5-20251001
argument-hint: <path to roadmap file, NNN-slug, or number>
disable-model-invocation: false
user-invocable: true
---

**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# Next Step

Surface unchecked items in a single roadmap, grouped into parallelizable waves, and tell the user how to act. When the roadmap has all items checked, flip its status to `done` and move its index row to Closed.

**Roadmap Input**: $ARGUMENTS

## Step 0: Require an argument

This skill operates on exactly one roadmap — it no longer scans across all roadmaps. If `$ARGUMENTS` is empty, **stop** and report:

> `/roadmap-next` requires a roadmap (path, `NNN-slug`, or number). Run `/roadmap-assess` to see a prioritized status update across all active roadmaps, then re-run `/roadmap-next <ROADMAP-NNNN>` on the one you want to work.

## Step 1: Resolve the file (`find_file`/`list_dir`, never bash)

Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: roadmaps · scope: active · ambiguous: interactive · empty: STOP (Step 0)

## Step 2: Parse → upgrade inline items → parallelism analysis

Run the three shared procedures below, in order, on the resolved file.

---

## Shared procedures (also used by `/roadmap-assess`)

### Parse a roadmap

`Read` the file (markdown). Extract: **phases** (`## Phase N: <name>` in order), **items** (`- [ ]` unchecked / `- [x]` checked), **status** (`- **Status**: active | done`), and the `roadmap_id` (`- **ID**: ROADMAP-NNNN` front matter — always read this first — or, as a fallback, the filename prefix, e.g. `ROADMAP-0013-billing.md` → `ROADMAP-0013`, or a legacy 3-digit file `ROADMAP-012-billing.md` → `ROADMAP-012`). Per item capture: `phase` (nearest preceding heading, or `(no phase)`), `checked`, `text`, `kind` (`task-link` if body starts `[[TASK-NNNN`, else `inline`), `task_id` (from `[[TASK-NNNN: title]]`), `task_path` (`find_file` `TASK-NNNN-*` in `wiki/work/tasks/` — matches active or archived). Compute `total`, `done`. Collect unchecked items into `candidate_items`, **capped at 9 total**.

For each `candidate_items` item that is already `kind == 'task-link'` (skip this for `inline` items until after they're upgraded below): `Read` `task_path`'s frontmatter and store `task_status` (`todo | in-progress | pending-uat | done | trashed`, per [tasks lifecycle](../tasks/lifecycle.md)). If `task_status == 'pending-uat'`, also resolve `uat_path` — read the task's `uat:` frontmatter field if present and `find_file` it; if empty or not found, leave `uat_path` unset (implementation finished but `/uat-create` hasn't run yet).

### Upgrade inline items to task files

**All roadmap items must eventually be task files** — inline items are placeholders. For each `candidate_items` item with `kind == 'inline'`:

1. Announce: `Inline item found: "<text>"[ (in <roadmap_title>)] — checking for an existing task before creating one.`
2. **Check for an existing task:** `Read` `wiki/work/tasks/index.md`, scan its active-item bullets for one whose title/summary plausibly covers the intent; if likely, `Read` that task to confirm. Found → use its `TASK-NNNN` + path, skip to step 5 (do **not** call `task-create`).
3. Else invoke `Skill` `task-create` with the item text as `args` (**no** `--roadmap` flag — the link is managed here to avoid a duplicate item).
4. Extract the new task path + ID from task-create's summary (`File path` row); if parsing fails, `list_dir` `wiki/work/tasks/` for the newest `.md` not present before, and `Read` it to confirm `TASK-NNNN` + title (from `# NNN: <title>`).
5. `Edit` the roadmap: `- [ ] <item_text>` → `- [ ] [[TASK-NNNN: <title>]]`.
6. Update the record: `kind='task-link'`, `task_id`, `task_path` (from `find_file`). A freshly created task is always `status: todo` — set `task_status = 'todo'` directly, no need to re-read the file.

If `task-create` fails/cancels, **stop and report**: `Task creation cancelled for: "<text>"[ (in <roadmap_title>)]. Inline items cannot be worked on without a task file. Re-run /roadmap-next after /task-create <description>.`

### Parallelism analysis → waves

After upgrades, for each item: `Read` its `task_path`, find `## Dependencies` / `## Blocked by`, extract `TASK-NNNN` refs; an **active blocker** is a dep whose `TASK-NNNN` also appears in `candidate_items`. Store as `blockers`. Topological sort: **Wave 1** = empty `blockers`; **Wave 2** = blockers all in Wave 1; **Wave 3** = blockers all in Wave 1∪2. Omit Wave 4+. **Cap each wave at 3 items** (document order); note overflow count. Store as `waves`.

### Close a fully-complete roadmap (`total > 0` and `done == total`) — run automatically, no prompt

Read `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` now and run its **In-place close (roadmaps, decisions, requirements)** section: `family: roadmaps`, `terminal_status: done`, default log entry; no prompt. The roadmap file stays in place — only its `status:` flips and its row moves from `## Active` to `## Closed` in `wiki/work/roadmaps/index.md`.

---

## Step 3: Report

- **All checked** (`done == total`, `total > 0`) → run the shared close procedure (ARCHIVE-WORK-ITEM.md, above), then report: `Progress: <total>/<total> — all done!` / `Status → done. Moved to Closed in wiki/work/roadmaps/index.md.`
- **Unchecked items remain** → progress line + one table per non-empty wave (every item is a task-link post-upgrade):

  ```
  Progress: <done>/<total>

  **Wave 1** — ready now (run these in parallel):
  | # | Phase | Item | Action |
  |---|-------|------|--------|
  | 1 | Phase N: name | TASK-NNNN: item title | `/tackle <task_path>` |

  **Wave 2** — start after Wave 1 completes: …
  **Wave 3** — start after Wave 2 completes: …
  ```

  Only emit non-empty wave tables. Wave 1 > 3 items → show 3 + `(+N more ready — showing first 3)`. No `Manual` case — every item is a task-link.

  **Action cell by `task_status`** (this is the fix for the tackle→UAT visibility gap — a `pending-uat` task needs testing, not more implementation):
  - `todo` / `in-progress` (default) → `` `/tackle <task_path>` ``
  - `pending-uat` with `uat_path` resolved → `` `/uat-walk <uat_path>` `` — annotate the Item cell with a trailing `⏳ awaiting UAT`
  - `pending-uat` with no `uat_path` → `` `/uat-create <task_path>` `` — annotate the Item cell with a trailing `⏳ awaiting UAT (no tests yet)`
  - `task_path` not found → `` `/tackle <task_path>` `` with ` (file not found)` appended, regardless of status (can't read a status that isn't there)

- **Zero items** → `Roadmap has no checklist items yet. Edit the roadmap file directly to add items, or link a new task to it with /task-create --roadmap <ROADMAP-NNNN> <description>.`

---

## Constraints

- **Never flip checkboxes.** The only permitted content writes are: (1) inline-placeholder → task-link replacement (upgrade step); (2) the status flip, index edits, and log append performed by ARCHIVE-WORK-ITEM.md's in-place close when closing.
- Permitted tools: `list_dir`, `find_file`, `Read`, `Edit`, `AskUserQuestion`, `Skill` (only for `task-create` on inline items).
- No `Bash` needed — closing a roadmap never moves a file. Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Keep the final report terse — one block per wave, no preamble, no closing summary.
