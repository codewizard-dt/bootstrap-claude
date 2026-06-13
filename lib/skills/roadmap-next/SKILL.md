---
name: roadmap-next
description: Point at the first unchecked item(s) in a roadmap; create task files for inline placeholders; group items into parallelizable waves; auto-move fully-checked roadmaps to completed/
category: researching
model: claude-haiku-4-5-20251001
argument-hint: "[path to roadmap file, NNN-slug, or number] (optional)"
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Next Step

Surface unchecked roadmap items grouped into parallelizable waves, and tell the user how to act on them. When a roadmap has all items checked, automatically move it to `completed/` and update the README reference.

---

**Roadmap Input**: $ARGUMENTS

---

## Step 0: Choose Mode

- If `$ARGUMENTS` is **non-empty** → **Single-Roadmap Mode**: resolve the argument to one file and proceed to Step 1S.
- If `$ARGUMENTS` is **empty** → **Scan Mode**: collect unchecked items across all roadmaps and proceed to Step 1M.

---

## Single-Roadmap Mode

### Step 1S: Resolve the Roadmap File

Parse `$ARGUMENTS` to locate the roadmap file. Use `mcp__serena__find_file` / `mcp__serena__list_dir` — never `bash`.

1. **If a file path is provided** (e.g. `wiki/work/roadmaps/001-auth-rollout.md`):
   - Confirm the file exists with `mcp__serena__find_file`
   - If it does not exist, report: `Roadmap file not found: <path>` and STOP.

2. **If a `NNN-slug` is provided** (e.g. `001-auth-rollout`):
   - Search `wiki/work/roadmaps/` for `<NNN-slug>.md`
   - If not found, report: `No roadmap matching '<input>' found in wiki/work/roadmaps/.` and STOP.

3. **If only a number is provided** (e.g. `1` or `001`):
   - List `wiki/work/roadmaps/` with `mcp__serena__list_dir` and match a file whose prefix equals the zero-padded number.
   - If ambiguous, list matches and ask the user to clarify via `AskUserQuestion`.
   - If no match, report: `No roadmap with number '<input>' found.` and STOP.

Use the resolved file path for Steps 2S onward.

---

### Step 2S: Parse the Roadmap

Use `Read` on the resolved roadmap file (markdown — `Read` is correct here, not Serena).

Parse:
- **Phases** — `## Phase N: <name>` headings, in document order.
- **Items** — bullet lines matching `- [ ] ...` (unchecked) or `- [x] ...` (checked).
- **Status field** — the `- **Status**: active | done` line in the front-matter block.

For each item capture:

| Field | How |
|-------|-----|
| `phase` | Nearest preceding `## Phase N: <name>` |
| `checked` | `true` if `- [x]`, `false` if `- [ ]` |
| `text` | Bullet body after the checkbox |
| `kind` | `task-link` if body matches `[TASK-NNN: ...](<path>)`, else `inline` |
| `task_path` | For task-links: the URL portion of the markdown link |

Walk items in document order. Collect up to **9** unchecked items (`checked == false`) in order — these are the `candidate_items` list.

Compute progress: `total = count(items)`, `done = count(items where checked == true)`.

Also extract the `ROADMAP-NNN` identifier from the roadmap file's front matter (the `- **ID**: ROADMAP-NNN` line) or from the filename prefix (e.g. `003-billing-overhaul.md` → `ROADMAP-003`). Store it as `roadmap_id` — needed when invoking task-add.

---

### Step 2.5S: Upgrade Inline Items to Task Files

**All roadmap items must eventually be task files.** Before reporting, upgrade every inline item in `candidate_items` to a task-link. Inline items are placeholders — they exist because the task file had not been created yet when the roadmap was authored.

For each item in `candidate_items` where `kind == 'inline'`:

1. Announce to the user (one line):
   ```
   Inline item found: "<item text>" — checking for an existing task before creating one.
   ```
2. **Check for an existing task**: `Read` `wiki/work/tasks/README.md` and scan the **Active Tasks** table for any row whose `Objective` or `Slug` plausibly covers the inline item's intent. If a candidate looks likely, `Read` that task file to confirm. If a matching task is found, use its `TASK-NNN` identifier and file path and skip to step 5 — do **not** invoke `task-add`.
3. If no existing task covers the inline item, use the `Skill` tool to invoke `task-add` with the item text as `args` (do **not** pass `--roadmap`, since the roadmap link will be managed here instead of appending a duplicate item).
4. After `task-add` completes, extract the new task's file path and identifier from the task-add completion output (the `File path` row of its summary table). If parsing fails, use `mcp__serena__list_dir` on `wiki/work/tasks/` to identify the newest `.md` file that was not present before the invocation. `Read` the new task file to confirm the `TASK-NNN` number and title (from the `# NNN: <title>` H1 heading).
5. Use `Edit` on the roadmap file to replace the inline item line:
   - `old_string`: `- [ ] <item_text>` (exact text, including leading `- [ ] `)
   - `new_string`: `- [ ] [TASK-NNN: <title>](../tasks/NNN-slug.md)`
6. Update the item record in `candidate_items`: set `kind = 'task-link'` and `task_path` to the relative path `../tasks/NNN-slug.md`.

If `task-add` fails or is cancelled by the user, **stop** and report:
```
Task creation cancelled for: "<item text>". Inline items cannot be worked on without a task file. Re-run /roadmap-next after creating a task with: /task-add <description>
```

---

### Step 2.7S: Parallelism Analysis

After all inline items are upgraded, analyze which `candidate_items` can run concurrently and group them into execution waves.

**For each item in `candidate_items`:**

1. `Read` the task file at `task_path` (resolve relative to project root — e.g. `../tasks/NNN-slug.md` from the roadmap's location becomes `wiki/work/tasks/NNN-slug.md`).
2. Look for a `## Dependencies` or `## Blocked by` section. Extract any `TASK-NNN` references listed (e.g. `TASK-042`, `[TASK-042: ...](...)`).
3. From those extracted references, identify which are **active blockers**: a dependency is an active blocker if its `TASK-NNN` appears in `candidate_items` (i.e., it is itself unchecked and in scope).
4. Store the set of active blocker TASK-NNN identifiers on the item as `blockers`.

**Build waves via topological sort:**

- **Wave 1**: items whose `blockers` set is empty (nothing is blocking them — ready to start now).
- **Wave 2**: items whose `blockers` are all members of Wave 1.
- **Wave 3**: items whose `blockers` are all members of Wave 1 or Wave 2.
- Items that would belong to Wave 4+ are omitted from the report (too deep in the chain for the current view).

Cap each wave at **3 items** (document order). If a wave has more than 3, note the overflow count.

Store result as `waves`: an ordered array of up to 3 wave objects, each containing its items.

---

### Step 3S: Report (Single Roadmap)

Emit one concise block. Choose the matching shape:

#### A. All items checked (`done == total`, `total > 0`)

Execute the following automatically (do not ask the user first):

1. If `Status: active`, use `Edit` to flip `Status: active` → `Status: done` in the roadmap file.
2. Use `Bash` to move the file:
   ```bash
   mkdir -p wiki/work/roadmaps/completed && git mv <roadmap_path> wiki/work/roadmaps/  <filename>
   ```
3. If `wiki/work/roadmaps/README.md` exists, use `Read` + `Edit` to update the entry:
   - `(<filename>)` → `(completed/<filename>)`
4. Report:
   ```
   Progress: <total>/<total> — all done!
   Moved → wiki/work/roadmaps/  <filename>
   README.md updated.
   ```

#### B/C. One or more unchecked items

Emit a progress line, then one table per wave (up to 3 waves). Every item in every wave is a task-link (Step 2.5S will have upgraded any inline placeholders).

```
Progress: <done>/<total>

**Wave 1** — ready now (run these in parallel):
| # | Phase | Item | Action |
|---|-------|------|--------|
| 1 | Phase N: name | TASK-NNN: item title | `/tackle <task_path>` |
| 2 | Phase N: name | TASK-NNN: item title | `/tackle <task_path>` |

**Wave 2** — start after Wave 1 completes:
| # | Phase | Item | Action |
|---|-------|------|--------|
| 1 | Phase N: name | TASK-NNN: item title | `/tackle <task_path>` |

**Wave 3** — start after Wave 2 completes:
| # | Phase | Item | Action |
|---|-------|------|--------|
| 1 | Phase N: name | TASK-NNN: item title | `/tackle <task_path>` |
```

Rules:
- Only emit wave tables for waves that contain at least one item.
- If Wave 1 has more than 3 items, show 3 and add: `(+N more ready — showing first 3)`
- Action cell: `` `/tackle <task_path>` `` — if the file doesn't exist on disk, append ` (file not found)`.
- There is no `Manual` case — every item must be a task-link before it can be reported here.

#### D. Zero items

```
Roadmap has no checklist items yet. Add some with /roadmap-add <ROADMAP-NNN> <item>.
```

---

## Scan Mode (no argument given)

### Step 1M: Discover Roadmaps

Use `mcp__serena__list_dir` on `wiki/work/roadmaps/` to get all `.md` files **directly in that directory** (not in `completed/` or other subdirectories). Sort them by filename (ascending — `001-` before `002-`, etc.). Skip `README.md`.

If no roadmap files are found, STOP and report:
```
No roadmaps found in wiki/work/roadmaps/. Use /roadmap-create <topic> to draft one.
```

---

### Step 2M: Collect Unchecked Items (and auto-move completed roadmaps)

For each roadmap file in sorted order:

1. Use `Read` to load the file.
2. Parse items exactly as in Step 2S (phase, checked, text, kind, task_path). Compute `total` and `done`.
3. **If `total > 0` and `done == total`** — the roadmap is fully complete. Execute the move automatically (same procedure as Shape A in Single-Roadmap Mode: flip Status if needed, `git mv` to `completed/`, update README). Record in `moved_files`. **Do not add any unchecked items** — continue to the next file.
4. Otherwise, for each unchecked item (`checked == false`), record:
   - `roadmap_file` — the file path
   - `roadmap_title` — the `# <Title>` heading or filename if heading not found
   - `roadmap_id` — the `ROADMAP-NNN` identifier from the front matter or filename prefix
   - `phase` — nearest preceding phase heading (or `"(no phase)"` if none)
   - `text`, `kind`, `task_path`
5. Append to a shared `candidate_items` list. **Stop collecting as soon as you have 9 items total** — skip reading further roadmap files once the limit is reached.

---

### Step 2.5M: Upgrade Inline Items to Task Files (Scan Mode)

Apply the same inline-upgrade logic as Step 2.5S to every inline item in the shared `candidate_items` list before reporting.

For each item in `candidate_items` where `kind == 'inline'`:

1. Announce: `Inline item found: "<item text>" (in <roadmap_title>) — checking for an existing task before creating one.`
2. **Check for an existing task**: `Read` `wiki/work/tasks/README.md` and scan the **Active Tasks** table for any row whose `Objective` or `Slug` plausibly covers the inline item's intent. If a candidate looks likely, `Read` that task file to confirm. If a matching task is found, use its `TASK-NNN` identifier and file path and skip to step 5 — do **not** invoke `task-add`.
3. If no existing task covers the inline item, invoke `Skill` `task-add` with the item text as `args` (no `--roadmap` flag).
4. Extract the new task path from task-add's output (or via `mcp__serena__list_dir` fallback as in Step 2.5S). `Read` the new task file to confirm `TASK-NNN` and title.
5. `Edit` the roadmap file (`roadmap_file` stored on the item record) to replace `- [ ] <item_text>` with `- [ ] [TASK-NNN: <title>](../tasks/NNN-slug.md)`.
6. Update the item record: `kind = 'task-link'`, `task_path = '../tasks/NNN-slug.md'`.

If `task-add` fails or is cancelled, apply the same stop-and-report behavior as Step 2.5S but name the roadmap: `(in <roadmap_title>)`.

---

### Step 2.7M: Parallelism Analysis (Scan Mode)

Apply the same parallelism analysis as Step 2.7S to the full `candidate_items` list (which may span multiple roadmaps).

- Read each task file and extract active blockers (TASK-NNN references that appear in `candidate_items`).
- Items from different roadmaps with no shared dependencies are naturally parallelizable.
- Build waves (Wave 1 / Wave 2 / Wave 3) using the same topological-sort logic.
- Cap each wave at 3 items (document order across roadmaps).

---

### Step 3M: Report (Multi-Roadmap)

If `moved_files` is non-empty, prepend a move summary before any other output:
```
Moved to completed/:
  • <filename> — all items checked
  [repeat for each moved file]
```

If `candidate_items` is empty after scanning all roadmaps (and no moves occurred or only moves occurred):
```
All roadmap items are checked off. Nothing left to do.
```

Otherwise emit one table per wave (up to 3 waves), with a footer line:

```
**Wave 1** — ready now (run these in parallel):
| # | Roadmap | Phase | Item | Action |
|---|---------|-------|------|--------|
| 1 | ROADMAP-NNN · Title | Phase X: name | TASK-NNN: item title | `/tackle <task_path>` |
| 2 | ROADMAP-NNN · Title | Phase X: name | TASK-NNN: item title | `/tackle <task_path>` |

**Wave 2** — start after Wave 1 completes:
| # | Roadmap | Phase | Item | Action |
|---|---------|-------|------|--------|
| 1 | ROADMAP-NNN · Title | Phase X: name | TASK-NNN: item title | `/tackle <task_path>` |

Showing <wave_1_count + wave_2_count + wave_3_count> of <total_unchecked_scanned> unchecked item(s) across <files_scanned> roadmap(s).
```

Rules:
- Only emit wave tables for waves that contain at least one item.
- Action cell: `` `/tackle <task_path>` `` — if the file doesn't exist, append ` (file not found)`.
- There is no `Manual` case — all inline items are upgraded in Step 2.5M before this report is emitted.

`total_unchecked_scanned` is the count of all unchecked items found before the 9-item cap; `files_scanned` is the number of roadmap files actually read.

Example of well-formatted output:

```
**Wave 1** — ready now (run these in parallel):
| # | Roadmap | Phase | Item | Action |
|---|---------|-------|------|--------|
| 1 | ROADMAP-001 · Adversario MVP | Phase 5: Report Pipeline | TASK-026: Wire Vuln-Store Deferred Foreign Keys | `/tackle wiki/work/tasks/026-wire-deferred-fks.md` |
| 2 | ROADMAP-002 · Comprehensive Eval Suite | Phase 2: Golden Sets | TASK-031: Golden cases for Red Team prompt rendering | `/tackle wiki/work/tasks/031-golden-cases-red-team.md` |

**Wave 2** — start after Wave 1 completes:
| # | Roadmap | Phase | Item | Action |
|---|---------|-------|------|--------|
| 1 | ROADMAP-002 · Comprehensive Eval Suite | Phase 3: Labeled Scenarios | TASK-032: Labeled-scenario schema with tags | `/tackle wiki/work/tasks/032-labeled-scenario-schema.md` |

Showing 3 of 5 unchecked item(s) across 2 roadmap(s).
```

---

## Constraints

- **Never flip checkboxes** — the skill does not check off items. Only permitted content writes are:
  1. `Status: active → done` flip before moving a fully-completed roadmap.
  2. README path update when moving to `completed/`.
  3. Replacing inline placeholder lines with task-link lines (Steps 2.5S / 2.5M).
- Permitted tools: `mcp__serena__list_dir`, `mcp__serena__find_file`, `Read`, `Edit`, `Bash`, `AskUserQuestion`, and `Skill` (for invoking `task-add` on inline items).
- `Bash` is permitted only for `mkdir -p` and `git mv` when moving a fully-completed roadmap. Never use `bash` for reads (`cat`, `find`, `grep`, `sed`, `ls`).
- `Edit` is permitted only for: the `Status` flip, the README path update, and the inline→task-link replacement in Steps 2.5S/2.5M.
- `Skill` is permitted only for invoking `task-add` when upgrading inline items.
- Keep the final report terse — one block per wave, no preamble, no closing summary.
