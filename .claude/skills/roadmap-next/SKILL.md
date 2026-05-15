---
name: roadmap-next
description: Point at the first unchecked item(s) in a roadmap; auto-move fully-checked roadmaps to completed/
model: claude-haiku-4-5-20251001
argument-hint: "[path to roadmap file, NNN-slug, or number] (optional)"
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Next Step

Surface unchecked roadmap items and tell the user how to act on them. When a roadmap has all items checked, automatically move it to `completed/` and update the README reference.

---

**Roadmap Input**: $ARGUMENTS

---

## Step 0: Choose Mode

- If `$ARGUMENTS` is **non-empty** → **Single-Roadmap Mode**: resolve the argument to one file and proceed to Step 1S.
- If `$ARGUMENTS` is **empty** → **Scan Mode**: collect the next 3 unchecked items across all roadmaps and proceed to Step 1M.

---

## Single-Roadmap Mode

### Step 1S: Resolve the Roadmap File

Parse `$ARGUMENTS` to locate the roadmap file. Use `mcp__serena__find_file` / `mcp__serena__list_dir` — never `bash`.

1. **If a file path is provided** (e.g. `.docs/roadmaps/001-auth-rollout.md`):
   - Confirm the file exists with `mcp__serena__find_file`
   - If it does not exist, report: `Roadmap file not found: <path>` and STOP.

2. **If a `NNN-slug` is provided** (e.g. `001-auth-rollout`):
   - Search `.docs/roadmaps/` for `<NNN-slug>.md`
   - If not found, report: `No roadmap matching '<input>' found in .docs/roadmaps/.` and STOP.

3. **If only a number is provided** (e.g. `1` or `001`):
   - List `.docs/roadmaps/` with `mcp__serena__list_dir` and match a file whose prefix equals the zero-padded number.
   - If ambiguous, list matches and ask the user to clarify via `AskUserQuestion`.
   - If no match, report: `No roadmap with number '<input>' found.` and STOP.

Use the resolved file path for Steps 2S and 3S.

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

Walk items in document order. Collect up to **3** unchecked items (`checked == false`) in order — these are the `next_up` list.

Compute progress: `total = count(items)`, `done = count(items where checked == true)`.

---

### Step 3S: Report (Single Roadmap)

Emit one concise block. Choose the matching shape:

#### A. All items checked (`done == total`, `total > 0`)

Execute the following automatically (do not ask the user first):

1. If `Status: active`, use `Edit` to flip `Status: active` → `Status: done` in the roadmap file.
2. Use `Bash` to move the file:
   ```bash
   mkdir -p .docs/roadmaps/completed && git mv <roadmap_path> .docs/roadmaps/completed/<filename>
   ```
3. If `.docs/roadmaps/README.md` exists, use `Read` + `Edit` to update the entry:
   - `(<filename>)` → `(completed/<filename>)`
4. Report:
   ```
   Progress: <total>/<total> — all done!
   Moved → .docs/roadmaps/completed/<filename>
   README.md updated.
   ```

#### B/C. One or more unchecked items

Emit a progress line, then a table with one row per item in `next_up` (up to 3):

```
Progress: <done>/<total>

| # | Phase | Item | Action |
|---|-------|------|--------|
| 1 | Phase N: name | item text | `/tackle <task_path>` |
| 2 | Phase N: name | item text | Manual |
```

Action cell rules:
- **task-link**: `` `/tackle <task_path>` `` — if the file doesn't exist on disk, append ` (file not found)` in the cell.
- **inline**: `Manual` — the user flips the checkbox themselves.

If `total - done > 3`, add a footer line:
```
Showing 3 of <total_unchecked> unchecked items.
```

#### D. Zero items

```
Roadmap has no checklist items yet. Add some with /roadmap-add <ROADMAP-NNN> <item>.
```

---

## Scan Mode (no argument given)

### Step 1M: Discover Roadmaps

Use `mcp__serena__list_dir` on `.docs/roadmaps/` to get all `.md` files **directly in that directory** (not in `completed/` or other subdirectories). Sort them by filename (ascending — `001-` before `002-`, etc.). Skip `README.md`.

If no roadmap files are found, STOP and report:
```
No roadmaps found in .docs/roadmaps/. Use /roadmap-create <topic> to draft one.
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
5. Append to a shared `unchecked` list. **Stop collecting as soon as you have 3 items total** — skip reading further roadmap files once the limit is reached.

---

### Step 3M: Report (Multi-Roadmap)

If `moved_files` is non-empty, prepend a move summary before any other output:
```
Moved to completed/:
  • <filename> — all items checked
  [repeat for each moved file]
```

If `unchecked` is empty after scanning all roadmaps (and no moves occurred or only moves occurred):
```
All roadmap items are checked off. Nothing left to do.
```

Otherwise emit a table of up to 3 items followed by a footer line:

```
| # | Roadmap | Phase | Item | Action |
|---|---------|-------|------|--------|
| 1 | ROADMAP-NNN · Title | Phase X: name | item text | `/tackle <task_path>` |
| 2 | ROADMAP-NNN · Title | Phase X: name | item text | Manual |

Showing <count> of <total_unchecked_scanned> unchecked item(s) across <files_scanned> roadmap(s).
```

Action cell rules:
- **task-link**: `` `/tackle <task_path>` `` — if the file doesn't exist, append ` (file not found)`.
- **inline**: `Manual`

`total_unchecked_scanned` is the count of all unchecked items found before the 3-item cap; `files_scanned` is the number of roadmap files actually read.

Example of well-formatted output:

```
| # | Roadmap | Phase | Item | Action |
|---|---------|-------|------|--------|
| 1 | ROADMAP-001 · Adversario MVP | Phase 5: Report Pipeline | TASK-026: Wire Vuln-Store Deferred Foreign Keys | `/tackle .docs/tasks/active/026-wire-deferred-fks.md` |
| 2 | ROADMAP-002 · Comprehensive Eval Suite | Phase 2: Golden Sets | 10–20 golden cases for Red Team prompt rendering | Manual |
| 3 | ROADMAP-002 · Comprehensive Eval Suite | Phase 3: Labeled Scenarios | Labeled-scenario schema with tags | Manual |

Showing 3 of 5 unchecked item(s) across 2 roadmap(s).
```

---

## Constraints

- Never flip checkboxes or edit roadmap content. Only permitted writes: `Status: active → done` flip before moving, README path update, and `git mv` via `Bash`.
- Use only `mcp__serena__list_dir`, `mcp__serena__find_file`, `Read`, `Edit`, `Bash`, and `AskUserQuestion`.
- `Bash` is permitted only for `mkdir -p` and `git mv` when moving a fully-completed roadmap. Never use `bash` for reads (`cat`, `find`, `grep`, `sed`, `ls`).
- Keep the final report terse — one block, no preamble, no closing summary.
