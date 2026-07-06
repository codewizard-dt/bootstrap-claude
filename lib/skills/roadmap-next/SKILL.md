---
name: roadmap-next
description: Point at the first unchecked item(s) in a roadmap; create task files for inline placeholders; group items into parallelizable waves; auto-archive fully-checked roadmaps
category: researching
model: claude-haiku-4-5-20251001
argument-hint: "[path to roadmap file, NNN-slug, or number] (optional)"
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`; run /primer if not done this session.

# Next Step

Surface unchecked roadmap items grouped into parallelizable waves and tell the user how to act. When a roadmap has all items checked, flip its status to `done` and move it to `archive/`.

**Roadmap Input**: $ARGUMENTS

## Step 0: Mode
- `$ARGUMENTS` non-empty → **Single-Roadmap Mode** (resolve one file, Step 1S).
- `$ARGUMENTS` empty → **Scan Mode** (collect across all roadmaps, Step 1M).

---

## Shared procedures (used by both modes)

### Parse a roadmap
`Read` the file (markdown). Extract: **phases** (`## Phase N: <name>` in order), **items** (`- [ ]` unchecked / `- [x]` checked), **status** (`- **Status**: active | done`), and the `roadmap_id` (`- **ID**: ROADMAP-NNN` front matter or filename prefix, e.g. `003-billing.md` → `ROADMAP-003`). Per item capture: `phase` (nearest preceding heading, or `(no phase)`), `checked`, `text`, `kind` (`task-link` if body starts `[[TASK-NNN`, else `inline`), `task_id` (from `[[TASK-NNN: title]]`), `task_path` (`find_file` `TASK-NNN-*` in `wiki/work/tasks/` — matches active or archived). Compute `total`, `done`. Collect unchecked items into `candidate_items`, **capped at 9 total**.

### Upgrade inline items to task files
**All roadmap items must eventually be task files** — inline items are placeholders. For each `candidate_items` item with `kind == 'inline'`:
1. Announce: `Inline item found: "<text>"[ (in <roadmap_title>)] — checking for an existing task before creating one.`
2. **Check for an existing task:** `Read` `wiki/work/tasks/README.md`, scan Active Tasks for a row whose `Objective`/`Slug` plausibly covers the intent; if likely, `Read` that task to confirm. Found → use its `TASK-NNN` + path, skip to step 5 (do **not** call `task-add`).
3. Else invoke `Skill` `task-add` with the item text as `args` (**no** `--roadmap` flag — the link is managed here to avoid a duplicate item).
4. Extract the new task path + ID from task-add's summary (`File path` row); if parsing fails, `list_dir` `wiki/work/tasks/` for the newest `.md` not present before, and `Read` it to confirm `TASK-NNN` + title (from `# NNN: <title>`).
5. `Edit` the roadmap: `- [ ] <item_text>` → `- [ ] [[TASK-NNN: <title>]]`.
6. Update the record: `kind='task-link'`, `task_id`, `task_path` (from `find_file`).

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

## Single-Roadmap Mode

### Step 1S: Resolve the file (`find_file`/`list_dir`, never bash)
| Input | Action |
|-------|--------|
| File path | confirm exists (`find_file`); missing → `Roadmap file not found: <path>` + STOP |
| `NNN-slug` | match in `wiki/work/roadmaps/`; none → `No roadmap matching '<input>' found…` + STOP |
| Number (`1`/`001`) | `list_dir`, match zero-padded prefix; ambiguous → list + `AskUserQuestion`; none → `No roadmap with number '<input>' found.` + STOP |

### Step 2S–2.7S: Parse → upgrade inline items → parallelism analysis
Run the three shared procedures on the resolved file.

### Step 3S: Report
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
  Only emit non-empty wave tables. Wave 1 > 3 items → show 3 + `(+N more ready — showing first 3)`. Action cell `` `/tackle <task_path>` ``, append ` (file not found)` if absent. No `Manual` case — every item is a task-link.
- **Zero items** → `Roadmap has no checklist items yet. Add some with /roadmap-add <ROADMAP-NNN> <item>.`

---

## Scan Mode (no argument)

### Step 1M: Discover roadmaps
`list_dir` `wiki/work/roadmaps/` for `.md` files **directly** in it (not `archive/`); sort ascending by filename; skip `lifecycle.md`, `index.md`, `README.md`. None → STOP: `No roadmaps found in wiki/work/roadmaps/. Use /roadmap-create <topic> to draft one.`

### Step 2M: Collect + auto-archive
For each roadmap in sorted order: parse it (shared). If fully complete (`total > 0`, `done == total`) → run the shared archive procedure, record the filename in `archived_files`, add **no** items, continue. Otherwise append its unchecked items to the shared `candidate_items` (each also carrying `roadmap_file`, `roadmap_title` = `# <Title>` or filename, `roadmap_id`). **Stop collecting at 9 items total** — skip reading further files.

### Step 2.5M–2.7M: Upgrade inline items → parallelism analysis
Run the shared upgrade + parallelism procedures over the full `candidate_items` (may span roadmaps; cross-roadmap items with no shared deps are naturally parallel).

### Step 3M: Report
- If `archived_files` non-empty, prepend:
  ```
  Archived to wiki/work/roadmaps/archive/:
    • <filename> — all items checked
  ```
- If `candidate_items` empty after scanning → `All roadmap items are checked off. Nothing left to do.`
- Otherwise one table per non-empty wave (with a `Roadmap` column), plus a footer:
  ```
  **Wave 1** — ready now (run these in parallel):
  | # | Roadmap | Phase | Item | Action |
  |---|---------|-------|------|--------|
  | 1 | ROADMAP-NNN · Title | Phase X: name | TASK-NNN: item title | `/tackle <task_path>` |

  **Wave 2** — start after Wave 1 completes: …

  Showing <shown_count> of <total_unchecked_scanned> unchecked item(s) across <files_scanned> roadmap(s).
  ```
  `total_unchecked_scanned` = all unchecked found before the 9-cap; `files_scanned` = files actually read. Same wave rules as Single mode (non-empty only, `(file not found)`, no `Manual` case).

---

## Constraints
- **Never flip checkboxes.** The only permitted content writes are: (1) `Status: active → done` before archiving; (2) inline-placeholder → task-link replacement (upgrade step); (3) archive/log appends when archiving.
- Permitted tools: `list_dir`, `find_file`, `Read`, `Edit`, `Bash`, `AskUserQuestion`, `Skill` (only for `task-add` on inline items).
- `Bash` only for `git mv` when archiving. Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Keep the final report terse — one block per wave, no preamble, no closing summary.
