---
name: wiki-archive
description: Cleanup tool — sweep tasks, UAT and bugs with terminal status that were not auto-archived by their originating skill, and move them to archive/ (roadmaps, decisions and requirements close in place)
category: wiki
model: claude-sonnet-5
---

# Wiki Archive

> **Recovery sweep.** Skills that set terminal statuses on tasks, UAT and bugs (`uat-auto`, `uat-skip`, `bug-close`, etc.) automatically move files to `archive/` at the time of completion. This skill finds any items that were missed — for example, items from before the auto-archive update, or edge cases where the originating skill didn't complete the move. In a healthy wiki, this skill finds nothing to do. Roadmaps, decisions and requirements are **not** swept: they close in place (see Step 1).

Move terminal work items from a family directory into `archive/` to reduce directory clutter. **Terminal items only** — items with active statuses are never moved. Safe because links use stable IDs, not paths.

---

## Usage

```
/wiki-archive [family]
```

`family` — one of `tasks`, `uat`, `bugs`. Omit to show a count summary across those three families without moving anything. If `family` is `roadmaps`, `decisions` or `requirements`, report `Roadmaps, decisions and requirements are closed in place (Closed section of the family index) — nothing to archive.` and STOP.

---

## Step 1: Determine scope

If a family was specified, process only that family (validate it per Usage). Otherwise, scan the 3 archiving families (`tasks`, `uat`, `bugs`) and report terminal item counts, then ask the user which families to archive.

For each family to process, read its `lifecycle.md` to confirm the **terminal statuses** for that family:
- **tasks**: `done`, `trashed`
- **uat**: `passed`, `skipped`, `trashed`
- **bugs**: `closed`, `wontfix`, `duplicate`, `cannot-reproduce`

Roadmaps, decisions and requirements are never swept: they close in place, with the family `index.md` moving the row from `## Active` to `## Closed` (see `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` § In-place close). Items closed by `prd-deprecate` / `adr-deprecate` are status-only and stay in place (no archive move), exactly like every other closed roadmap, decision and requirement.

**Stray-archive note.** In a sweep with no family argument, also check whether `wiki/work/roadmaps/archive/`, `wiki/work/decisions/archive/` or `wiki/work/requirements/archive/` still exists and is non-empty (`mcp__serena__list_dir`). If so, do not move anything — report `wiki/work/<family>/archive/ is a leftover from the old archive model — run npx @codewizard-dt/bootstrap update to migrate`.

Do NOT hardcode the terminal statuses — read `lifecycle.md` to confirm them before moving anything.

## Step 2: Identify terminal items

Use `mcp__serena__list_dir` on the family directory. For each file (excluding `lifecycle.md`, `index.md`, `.gitkeep`, and everything under `archive/`):
1. Read the file's `status:` frontmatter field.
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

Read `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` now and run its Procedure once per confirmed file: `terminal_status` is the file's existing `status:`, `log: skip` (Step 5 writes the single batch entry).

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
- Move mechanics and their invariants: ARCHIVE-WORK-ITEM.md.
