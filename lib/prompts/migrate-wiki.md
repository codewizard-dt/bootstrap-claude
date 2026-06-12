# Migrate legacy .docs/ artifacts to the LLM Wiki structure

You are migrating the project at `__PROJECT_DIR__` from the legacy `.docs/`-based documentation layout to the LLM Wiki structure. The empty wiki scaffold (directories, `index.md`, `log.md`, `conventions.md`, per-family `lifecycle.md` and `index.md`) has already been created by `sync-wiki-scaffold.sh` — your job is the semantic conversion of the legacy content.

Work from the project root (`__PROJECT_DIR__`). You are on a dedicated `wiki-migration` branch with a previously-clean tree.

## Hard rules

1. **`git mv` every file BEFORE editing its content** — this preserves git history. Move first, edit second. Never copy-and-delete.
2. `raw/` is immutable — never create, modify, or delete anything under `raw/`.
3. Never edit `wiki/conventions.md` or any `wiki/work/*/lifecycle.md` — they are template-owned.
4. Once a file lands at its new path it never moves again — state lives in `status:` frontmatter.
5. **Do not commit.** Leave all changes staged/unstaged for the user to review. Stage moves with `git add -A` at the very end is fine; no `git commit`.
6. Read each family's `wiki/work/<family>/lifecycle.md` before migrating that family — it defines the frontmatter schema and valid statuses.

## Migration mapping

| Old location | New path | Status |
|---|---|---|
| `.docs/tasks/NNN-slug.md` | `wiki/work/tasks/TASK-NNN-slug.md` | `todo` — or `in-progress` if the old `.docs/tasks/README.md` index marks it as in progress |
| `.docs/tasks/completed/NNN-slug.md` | `wiki/work/tasks/TASK-NNN-slug.md` | `done` |
| `.docs/tasks/trashed/NNN-slug.md` | `wiki/work/tasks/TASK-NNN-slug.md` | `trashed` |
| `.docs/uat/NNN-slug.uat.md` | `wiki/work/uat/UAT-NNN-slug.md` (drop the `.uat` double extension) | `pending` |
| `.docs/uat/completed/NNN-slug.uat.md` | `wiki/work/uat/UAT-NNN-slug.md` | `passed` |
| `.docs/uat/skipped/NNN-slug.uat.md` | `wiki/work/uat/UAT-NNN-slug.md` | `skipped` |
| `.docs/uat/trashed/NNN-slug.uat.md` | `wiki/work/uat/UAT-NNN-slug.md` | `trashed` |
| `.docs/uat/screenshots/*` | `wiki/work/uat/screenshots/` | — (binary assets, just `git mv`) |
| `.docs/adr/NNNN-slug.md` and `.docs/adr/completed/NNNN-slug.md` | `wiki/work/decisions/DEC-NNNN-slug.md` | no file-level status — each `## DM.` block keeps its own `Status` field verbatim |
| `.docs/prd/NNN-slug.md` | `wiki/work/requirements/REQ-NNN-slug.md` | from old frontmatter/body (`draft` or `approved`) |
| `.docs/prd/archived/NNN-slug.md` | `wiki/work/requirements/REQ-NNN-slug.md` | `retired` |
| `.docs/bugs/NNNN-slug.md` | `wiki/work/bugs/BUG-NNNN-slug.md` | `open` |
| `.docs/bugs/in-progress/NNNN-slug.md` | `wiki/work/bugs/BUG-NNNN-slug.md` | `in-progress` |
| `.docs/bugs/closed/NNNN-slug.md` | `wiki/work/bugs/BUG-NNNN-slug.md` | `closed` |
| `.docs/roadmaps/NNN-slug.md` | `wiki/work/roadmaps/ROADMAP-NNN-slug.md` | `active` |
| `.docs/roadmaps/completed/NNN-slug.md` | `wiki/work/roadmaps/ROADMAP-NNN-slug.md` | `done` |
| Old per-family `README.md` index files | **not migrated** — read them FIRST for status hints (e.g. which tasks are in-progress), then `git rm` them | — |

Files that don't match the family's `NNN-slug.md` pattern: migrate them anyway with the next free ID and note the rename in the final report.

## Per-file procedure

For every artifact file, in this order:

1. **`git mv`** to its new path (per the mapping table).
2. **Normalize frontmatter.** Add a YAML frontmatter block if missing; if one exists, update it in place, preserving any extra keys:
   - `id:` — from the new filename prefix (e.g. `TASK-014`, `DEC-0007`)
   - `title:` — from the first H1 heading; fall back to a humanized filename slug
   - `status:` — per the mapping table (decisions: no file-level status)
   - `created:` / `updated:` — from `git log --follow --format=%ad --date=short -- <file>`; oldest commit date = created, newest = updated; fall back to today's date if no history
3. **Rewrite in-body links and references:**
   - Relative artifact links in any form (`../tasks/NNN-slug.md`, `completed/NNN-slug.md`, `.docs/tasks/NNN-slug.md`, etc.) → the flat new path with the new ID-prefixed filename (e.g. `../tasks/TASK-014-slug.md` from a UAT file, `TASK-014-slug.md` from a sibling task)
   - `**Implements**: ADR-NNNN#DM` → `implements::[[DEC-NNNN#DM]]`
   - All other `ADR-NNNN` mentions → `DEC-NNNN`
   - `.uat.md` link suffixes → the new `UAT-NNN-slug.md` form

## Cross-links (UAT ↔ task)

Every migrated UAT file gets:
- `task: TASK-NNN` in frontmatter (the task with the matching number)
- `implements::[[TASK-NNN]]` as the first body line under the H1

Every task that has a matching UAT gets `uat: ../uat/UAT-NNN-slug.md` in its frontmatter.

If a UAT has no matching task (or vice versa), leave the link out and list it in the final report.

## ID collisions

If the same number exists in two source dirs of one family (e.g. `.docs/tasks/007-a.md` AND `.docs/tasks/completed/007-b.md`), keep the number on the file with the older git history and renumber the newer file to the family's next free ID. Update every link that referenced the renumbered file. Record each remap in the final report.

## Family indexes

After all files have landed, build each `wiki/work/<family>/index.md` (replace the `_(none yet)_` placeholder) listing **only active items**, per each family's `lifecycle.md`:

- requirements: `draft`, `approved` · decisions: groups with ≥1 `proposed` block · roadmaps: `active` · tasks: `todo`, `in-progress` · uat: `pending`, `in-progress`, `failed` · bugs: `open`, `triaged`, `in-progress`

Entry format is documented in each index stub. Non-active items are simply not listed — their files stay put.

## Log entry

Append to `wiki/log.md`:

```
## [YYYY-MM-DD] migrate | .docs → wiki migration
Migrated N tasks, N UAT files, N decisions, N requirements, N bugs, N roadmaps from the legacy .docs/ layout. <1 sentence on anything notable: ID remaps, missing cross-links, skipped files.>
```

## Cleanup

1. `git rm` the old per-family `README.md` indexes (after extracting status hints).
2. After all moves, the old family dirs (`.docs/tasks`, `.docs/uat`, `.docs/adr`, `.docs/prd`, `.docs/bugs`, `.docs/roadmaps`) must contain nothing but empty subdirectories and `.gitkeep` files — `git rm` the `.gitkeep`s and remove the empty directories.
3. **KEEP `.docs/guides/` and `.docs/company-context/`** — they are still used.

## Final report

End with a concise report:
- Per-family counts: migrated files and their status distribution
- Rows added to each family index
- ID remaps performed (old → new)
- Anything ambiguous or skipped — listed explicitly, never silently dropped
- Confirmation that `.docs/` now contains only `guides/` and `company-context/`
