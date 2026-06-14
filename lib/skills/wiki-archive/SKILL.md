---
name: wiki-archive
description: Batch-move terminal work items into their family's archive/ subdirectory and update archive/index.md
category: wiki
model: claude-sonnet-4-6
---

# Wiki Archive

Move terminal work items from a family directory into `archive/` to reduce directory clutter. **Terminal items only** — items with active statuses are never moved. Safe because links use stable IDs, not paths.

---

## Usage

```
/wiki-archive [family]
```

`family` — one of `tasks`, `uat`, `bugs`, `requirements`, `decisions`, `roadmaps`. Omit to show a count summary across all families without moving anything.

---

## Step 1: Determine scope

If a family was specified, process only that family. Otherwise, scan all 6 families and report terminal item counts, then ask the user which families to archive.

For each family to process, read its `lifecycle.md` to confirm the **terminal statuses** for that family:
- **tasks**: `done`, `trashed`
- **uat**: `passed`, `skipped`, `trashed`
- **bugs**: `closed`, `wontfix`, `duplicate`, `cannot-reproduce`
- **requirements**: `retired`
- **decisions**: all decisions in the group are `accepted` or `superseded`
- **roadmaps**: `done`

Do NOT hardcode these — read `lifecycle.md` to confirm them before moving anything.

## Step 2: Identify terminal items

Use `mcp__serena__list_dir` on the family directory. For each file (excluding `lifecycle.md`, `index.md`, `.gitkeep`, and everything under `archive/`):
1. Read the file's `status:` frontmatter field (or per-decision block statuses for decisions).
2. If the status is terminal → add to the move list.
3. If the status is active → skip; never touch it.

If the move list is empty, report "No terminal items found in `<family>/`" and stop.

## Step 3: Confirm with the user

Show the move list:
```
Ready to archive N items from wiki/work/<family>/:
  - TASK-023-some-slug.md   (status: done)
  - TASK-031-other.md       (status: trashed)

This moves them to wiki/work/<family>/archive/. Links using [[TASK-023]] remain valid.
Proceed? (yes / skip)
```

Wait for confirmation before moving.

## Step 4: Move files and update archive/index.md

For each confirmed file:
1. Use `Bash` with `mv` to move the file: `mv wiki/work/<family>/<file> wiki/work/<family>/archive/<file>`
2. Read the file's `id`, `title`, `status`, and `updated` frontmatter fields.
3. Append a row to `wiki/work/<family>/archive/index.md`:
   ```
   | [[ID]] | Title | final-status | YYYY-MM-DD |
   ```
   where the date is today's date.

Do NOT edit the moved file itself — its frontmatter and content are preserved exactly.

## Step 5: Update wiki/log.md

Append one entry:
```
## [YYYY-MM-DD] archive | <family> — N items archived
Moved N terminal items from wiki/work/<family>/ to wiki/work/<family>/archive/. IDs: TASK-023, TASK-031, …
```

## Step 6: Report

Print a summary of what was moved. If any files were skipped (e.g., active status found unexpectedly), list them explicitly.

---

## CRITICAL rules

- **Never move an active item.** If a file's status is not in the terminal set for its family, skip it and warn.
- **Never edit content** of moved files — only the location changes.
- **Never delete** — archiving is moving, not deleting.
- **`archive/index.md` is append-only** — only add rows, never remove or edit existing rows.
- The `archive/` directory already exists in every family — do not create it.
