---
name: roadmap-next
description: Point at the first unchecked item(s) in a single roadmap; create task files for inline placeholders; group items into parallelizable waves; auto-archive when fully checked. Requires a roadmap argument — run /roadmap-assess first to see status and priority across all active roadmaps.
category: researching
model: claude-haiku-4-5-20251001
argument-hint: <path to roadmap file, NNN-slug, or number>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# Next Step

Surface unchecked items in a single roadmap, grouped into parallelizable waves, and tell the user how to act. When the roadmap has all items checked, flip its status to `done` and move it to `archive/`.

**Roadmap Input**: $ARGUMENTS

## Step 0: Require an argument

This skill operates on exactly one roadmap — it no longer scans across all roadmaps. If `$ARGUMENTS` is empty, **stop** and report:

> `/roadmap-next` requires a roadmap (path, `NNN-slug`, or number). Run `/roadmap-assess` to see a prioritized status update across all active roadmaps, then re-run `/roadmap-next <ROADMAP-NNN>` on the one you want to work.

## Step 1: Resolve the file (`find_file`/`list_dir`, never bash)

| Input | Action |
|-------|--------|
| File path | confirm exists (`find_file`); missing → `Roadmap file not found: <path>` + STOP |
| `NNN-slug` | match in `wiki/work/roadmaps/`; none → `No roadmap matching '<input>' found…` + STOP |
| Number (`1`/`001`) | `list_dir`, match zero-padded prefix; ambiguous → list + `AskUserQuestion`; none → `No roadmap with number '<input>' found.` + STOP |

## Step 2: Parse → upgrade inline items → parallelism analysis

Run the three shared procedures below, in order, on the resolved file.

---

## Shared procedures (also used by `/roadmap-assess`)

### Parse a roadmap
`Read` the file (markdown). Extract: **phases** (`## Phase N: <name>` in order), **items** (`- [ ]` unchecked / `- [x]` checked), **status** (`- **Status**: active | done`), and the `roadmap_id` (`- **ID**: ROADMAP-NNN` front matter or filename prefix, e.g. `003-billing.md` → `ROADMAP-003`). Per item capture: `phase` (nearest preceding heading, or `(no phase)`), `checked`, `text`, `kind` (`task-link` if body starts `[[TASK-NNN`, else `inline`), `task_id` (from `[[TASK-NNN: title]]`), `task_path` (`find_file` `TASK-NNN-*` in `wiki/work/tasks/` — matches active or archived). Compute `total`, `done`. Collect unchecked items into `candidate_items`, **capped at 9 total**.

For each `candidate_items` item that is already `kind == 'task-link'` (skip this for `inline` items until after they're upgraded below): `Read` `task_path`'s frontmatter and store `task_status` (`todo | in-progress | pending-uat | done | trashed`, per [tasks lifecycle](../tasks/lifecycle.md)). If `task_status == 'pending-uat'`, also resolve `uat_path` — read the task's `uat:` frontmatter field if present and `find_file` it; if empty or not found, leave `uat_path` unset (implementation finished but `/uat-generate` hasn't run yet).

### Upgrade inline items to task files
**All roadmap items must eventually be task files** — inline items are placeholders. For each `candidate_items` item with `kind == 'inline'`:
1. Announce: `Inline item found: "<text>"[ (in <roadmap_title>)] — checking for an existing task before creating one.`
2. **Check for an existing task:** `Read` `wiki/work/tasks/index.md`, scan its active-item bullets for one whose title/summary plausibly covers the intent; if likely, `Read` that task to confirm. Found → use its `TASK-NNN` + path, skip to step 5 (do **not** call `task-add`).
3. Else invoke `Skill` `task-add` with the item text as `args` (**no** `--roadmap` flag — the link is managed here to avoid a duplicate item).
4. Extract the new task path + ID from task-add's summary (`File path` row); if parsing fails, `list_dir` `wiki/work/tasks/` for the newest `.md` not present before, and `Read` it to confirm `TASK-NNN` + title (from `# NNN: <title>`).
5. `Edit` the roadmap: `- [ ] <item_text>` → `- [ ] [[TASK-NNN: <title>]]`.
6. Update the record: `kind='task-link'`, `task_id`, `task_path` (from `find_file`). A freshly created task is always `status: todo` — set `task_status = 'todo'` directly, no need to re-read the file.

If `task-add` fails/cancels, **stop and report**: `Task creation cancelled for: "<text>"[ (in <roadmap_title>)]. Inline items cannot be worked on without a task file. Re-run /roadmap-next after /task-add <description>.`

### Parallelism analysis → waves
After upgrades, for each item: `Read` its `task_path`, find `## Dependencies` / `## Blocked by`, extract `TASK-NNN` refs; an **active blocker** is a dep whose `TASK-NNN` also appears in `candidate_items`. Store as `blockers`. Topological sort: **Wave 1** = empty `blockers`; **Wave 2** = blockers all in Wave 1; **Wave 3** = blockers all in Wave 1∪2. Omit Wave 4+. **Cap each wave at 3 items** (document order); note overflow count. Store as `waves`.

### Archive a fully-complete roadmap (`total > 0` and `done == total`) — run automatically, no prompt
1. If `status: active`, `Edit` → `status: done`.
2. Remove its row from `wiki/work/roadmaps/index.md` (active-only index).
3. `git mv <roadmap_path> wiki/work/roadmaps/archive/<filename>` (Bash — `git mv` only).
4. Append to `wiki/work/roadmaps/archive/index.md`: `| [[ROADMAP-NNN]] | <title> | done | YYYY-MM-DD |`.
5. Append to `wiki/log.md`:
   ```
   ## [YYYY-MM-DD] archive | <ROADMAP-NNN> — completed, moved to archive
   All items checked. Moved to wiki/work/roadmaps/archive/<filename>.
   ```

---

## Step 3: Report
- **All checked** (`done == total`, `total > 0`) → run the shared archive procedure, then report: `Progress: <total>/<total> — all done!` / `Status → done. Archived → wiki/work/roadmaps/archive/<filename>.`
- **Unchecked items remain** → progress line + one table per non-empty wave (every item is a task-link post-upgrade):
  ```
  Progress: <done>/<total>

  **Wave 1** — ready now (run these in parallel):
  | # | Phase | Item | Action |
  |---|-------|------|--------|
  | 1 | Phase N: name | TASK-NNN: item title | `/tackle <task_path>` |

  **Wave 2** — start after Wave 1 completes: …
  **Wave 3** — start after Wave 2 completes: …
  ```
  Only emit non-empty wave tables. Wave 1 > 3 items → show 3 + `(+N more ready — showing first 3)`. No `Manual` case — every item is a task-link.

  **Action cell by `task_status`** (this is the fix for the tackle→UAT visibility gap — a `pending-uat` task needs testing, not more implementation):
  - `todo` / `in-progress` (default) → `` `/tackle <task_path>` ``
  - `pending-uat` with `uat_path` resolved → `` `/uat-walk <uat_path>` `` — annotate the Item cell with a trailing `⏳ awaiting UAT`
  - `pending-uat` with no `uat_path` → `` `/uat-generate <task_path>` `` — annotate the Item cell with a trailing `⏳ awaiting UAT (no tests yet)`
  - `task_path` not found → `` `/tackle <task_path>` `` with ` (file not found)` appended, regardless of status (can't read a status that isn't there)
- **Zero items** → `Roadmap has no checklist items yet. Edit the roadmap file directly to add items, or link a new task to it with /task-add --roadmap <ROADMAP-NNN> <description>.`

---

## Constraints
- **Never flip checkboxes.** The only permitted content writes are: (1) `Status: active → done` before archiving; (2) inline-placeholder → task-link replacement (upgrade step); (3) archive/log appends when archiving.
- Permitted tools: `list_dir`, `find_file`, `Read`, `Edit`, `Bash`, `AskUserQuestion`, `Skill` (only for `task-add` on inline items).
- `Bash` only for `git mv` when archiving. Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Keep the final report terse — one block per wave, no preamble, no closing summary.
