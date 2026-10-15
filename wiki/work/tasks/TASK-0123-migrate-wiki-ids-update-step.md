---
id: TASK-0123
aliases: [TASK-0123]
title: "Add an idempotent migrate-wiki-ids step to `bootstrap update` (REQ→PRD, DEC→ADR, un-archive)"
status: todo
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0122, TASK-0121, TASK-0117, TASK-0116]
blocks: [TASK-0124]
parallel_safe_with: []
uat: ""
tags: [migration, wiki-conventions, installer, roadmap-0014]
---

# TASK-0123 — Add an idempotent migrate-wiki-ids step to `bootstrap update` (REQ→PRD, DEC→ADR, un-archive)

depends_on::[[TASK-0122]]
depends_on::[[TASK-0121]]
depends_on::[[TASK-0117]]
depends_on::[[TASK-0116]]
blocks::[[TASK-0124]]

## Objective

Ship a standalone, zero-dependency, unit-tested migration script, `lib/scripts/migrate-wiki-ids.js`, and wire it into the shared setup/update sequence so that `npx @codewizard-dt/bootstrap update` brings an existing project's wiki up to ROADMAP-0014 Phase 4's final layout: `REQ-`/`DEC-` files and IDs become `PRD-`/`ADR-` (old ID kept in `aliases:`), `[[REQ-…]]`/`[[DEC-…]]` links are rewritten, `linked_requirements`/`linked_decisions` become `linked_prds`/`linked_adrs`, and the `archive/` folders of the roadmaps, decisions and requirements families are folded back into each family directory and index (Closed section). It is idempotent, refuses to run on a dirty tree, and never touches `wiki/log.md`, `wiki/log-*.md` or `raw/`.

This task only builds and tests the migration. Running it on this repo's own wiki is TASK-0124.

## Approach

Binding inputs are ROADMAP-0014's Phase 4 Q&A decisions of 2026-09-19 (items 1-8) and its sequencing note (the migration comes last because it depends on the final names and file layout). Design decisions made here:

- **Standalone script, not inline shell.** `lib/scripts/migrate-wiki-ids.js`, `#!/usr/bin/env node`, `'use strict'`, Node built-ins only (`fs`, `path`, `child_process`). Usage: `migrate-wiki-ids.js <project-dir> [--dry-run] [--force]`. Same shape and exit contract family as `backfill-wiki-aliases.js`, but unlike it, it exits non-zero on a refusal or an unexpected error so tests and manual runs can see it; the caller (shell) treats a non-zero exit as a warning only.
- **Wiring point is `run_project_sync` in `lib/scripts/lib.sh`**, not `update-project.sh` itself: that function is the shared setup/update sequence (both scripts call it), so one insertion covers `update` and `setup`. Insert after the `Syncing wiki scaffold...` block and **before** `Backfilling wiki work-item aliases...` (so backfill sees the migrated files, which already carry aliases). Guarded: `if ! node "$script_dir/migrate-wiki-ids.js" "$project_dir"; then echo "Warning: ..." >&2; fi` — never aborts the sync.
- **Dirty-tree preflight is scoped, not global.** `run_project_sync` runs `sync-wiki-scaffold.sh` just before, which legitimately rewrites `conventions.md` / `lifecycle.md` and would make a whole-tree check refuse every run. So the check is: if the project is a git work tree, compute the exact set of files the migration will modify/move/create, and refuse (exit 1, list the offending paths, suggest committing or `--force`) only if `git status --porcelain -- <those paths>` is non-empty. `--force` skips it. A non-git project skips the check entirely. Alternative rejected: `migrate-project.sh`'s whole-tree check verbatim — correct for a standalone command on its own branch, wrong for a step that follows the scaffold sync.
- **Renames use `git mv` when the file is tracked** (`git ls-files --error-unmatch`), plain `fs.renameSync` otherwise. Un-archive moves use the same helper. A destination collision aborts the whole run before any write (validate the full plan first, then apply).
- **Scope of the link rewrite.** Rewrite in every `.md` under `wiki/` **except** `wiki/log.md`, `wiki/log-*.md`, and the `archive/` folders of the tasks, uat and bugs families (terminal historical records; their old IDs resolve through `aliases:`). `raw/` is never read for rewriting or written. The rewritten forms are: `[[REQ-0003]]`, `[[REQ-0003|label]]`, `[[REQ-0003#…]]`, `[[DEC-0001#D4]]`, typed links (`rel::[[DEC-0001#D4]]`), bare `DEC-0001#D2` / `REQ-0003` tokens on `Supersedes:`/`Links:`/`Source`-style list lines, `REQ-`/`DEC-` tokens inside frontmatter array values (`derived_from`, `supersedes`, `superseded_by`, the renamed `linked_*` fields), and **relative markdown links to the files themselves** (`[…](../requirements/REQ-0003-slug.md)`, including `…/archive/REQ-…` paths, which are rewritten to the un-archived `…/PRD-0003-slug.md` location). Prose mentions elsewhere are left alone (aliases make them resolve). The numeric part is preserved exactly (`REQ-0003` → `PRD-0003`, `DEC-0001#D4` → `ADR-0001#D4`); 3-digit legacy IDs keep their width.
- **Alias placement follows `wiki/conventions.md` §2 and the existing `aliases: [ID]` inline flow-list style** used by `backfill-wiki-aliases.js`: the new frontmatter becomes `id: PRD-0003` and `aliases: [PRD-0003, REQ-0003]` (new ID first, old ID appended, any pre-existing aliases preserved, no duplicates). If `aliases:` is absent it is created directly after `id:`; block-style (`- item`) alias lists are edited in place.
- **Un-archive + Closed section depends on TASK-0121's Active/Closed index format.** For roadmaps, decisions and requirements: move every file from `<family>/archive/` back to `<family>/`, fold each row of `<family>/archive/index.md` into the family `index.md`'s `## Closed` section (create the section, and an `## Active` heading if the index still has the pre-TASK-0121 flat shape, exactly as TASK-0121's templates define it — read TASK-0121's output before coding), then delete the now-empty `archive/` (including `archive/index.md` and any `.gitkeep`). If `archive/` still contains an unmapped file after moving, leave the folder and warn. Tasks, UAT and bugs keep `archive/` untouched.
- **ID prefixes of tasks/UAT/bugs/roadmaps are never modified.** Only files named `REQ-NNNN-*.md` / `DEC-NNNN-*.md` in the requirements/decisions families (active + archive) are renamed; a path already named `PRD-`/`ADR-` is skipped.
- **Idempotent by state detection, not by a marker file.** A run finds nothing to do when there are no `REQ-`/`DEC-` files, no `linked_requirements`/`linked_decisions` fields, no old-ID links in the rewrite scope, and no `archive/` folder in the three families. In that state it prints `wiki IDs already migrated — nothing to do`, writes nothing, appends **no** log entry, exits 0. A project with zero REQ/DEC files (fresh project) is the same no-op path. A partially migrated tree (e.g. an interrupted earlier run) is completed, not rejected.
- **One log entry per real run:** append a single `## [YYYY-MM-DD] migrate | REQ/DEC → PRD/ADR IDs and archive folds` entry to `wiki/log.md` (1-3 sentences with counts: files renamed, files with links rewritten, fields renamed, files un-archived). If `wiki/log.md` does not exist, skip it with a note; never create it here. Dry-run appends nothing.
- **Family lifecycle docs/templates: this task owns the `linked_*` field rename in the schema docs.** TASK-0116/0117 deliberately left the `linked_requirements` / `linked_decisions` field names untouched (they leave existing files and the field alone until the migration), so the schema tables in `wiki/work/{requirements,decisions,roadmaps}/lifecycle.md`, their `lib/scripts/templates/wiki/work/…` copies, and every skill that writes the field must change to `linked_prds` / `linked_adrs` here, in the same task as the script that renames the data. Target projects receive the new lifecycle docs from `sync-wiki-scaffold.sh` (it always refreshes `lifecycle.md` and `conventions.md` and runs before this step), so the script itself never edits them.
- **Testing:** `node --test` file `test/migrate-wiki-ids.test.js`, fully hermetic — every test builds a fixture project in a fresh `os.tmpdir()` directory (own `git init` where tracked-vs-untracked behaviour matters, with `user.email`/`user.name` set locally) and never touches the real repo or `~/.claude`. No `skip`, `todo`, or `only` options or keys anywhere in the file.

## Steps

### 1. Confirm final names and layout from the dependency tasks  <!-- agent: Explore -->

- [ ] Read TASK-0116 and TASK-0117 (ADR/PRD family renames) and TASK-0121 (Active/Closed index format) and TASK-0122, plus their landed diffs, so the migration targets the real final layout
  - Record: the exact `## Active` / `## Closed` heading and row format from the TASK-0121 templates (`lib/scripts/templates/wiki/work/{roadmaps,decisions,requirements}/index.md`), the final lifecycle field names (`linked_prds`, `linked_adrs`), and the ID-resolution family table in `lib/skills/_shared/`
  - Read `lib/scripts/backfill-wiki-aliases.js` (frontmatter extract/splice helpers, alias line handling) and `lib/scripts/migrate-project.sh` (preflight wording) for conventions to mirror; do not import from them (zero shared code, copy the small helpers)
  - Read one real archived decision/requirement/roadmap `archive/index.md` in this repo's `wiki/work/` to see the row shapes the fold step must handle (table rows vs list lines)
  - Note the frontmatter fields present in this repo's REQ/DEC files (`derived_from`, `supersedes`, `superseded_by`, `linked_*`) to size the link-rewrite rules

### 2. Build `lib/scripts/migrate-wiki-ids.js`  <!-- agent: general-purpose -->

- [ ] Create `lib/scripts/migrate-wiki-ids.js` (executable, shebang, `'use strict'`, header comment in the style of `backfill-wiki-aliases.js`: purpose, scope, idempotency contract, exit codes, usage)
  - CLI: `migrate-wiki-ids.js <project-dir> [--dry-run] [--force]`; unknown flag or missing dir → usage on stderr, exit 2; missing `wiki/work/` → print a note, exit 0
  - Export the pure pieces for testing when `require.main !== module`: `planMigration(projectDir)` (builds the full rename/rewrite/fold plan without writing), `applyPlan(plan)`, and pure helpers `rewriteLinks(text)`, `migrateFrontmatter(text, oldId, newId)`, `foldArchiveIndex(familyIndexText, archiveIndexText)`
  - `planMigration`: list `REQ-*.md` / `DEC-*.md` in `requirements/` + `requirements/archive/` and `decisions/` + `decisions/archive/`; compute target names `PRD-NNNN-slug.md` / `ADR-NNNN-slug.md` (target is always in the family dir, never `archive/`); list files to move out of the three `archive/` folders; list every `.md` under `wiki/` in the rewrite scope (excluding `log.md`, `log-*.md`, and the tasks/uat/bugs `archive/` folders); detect collisions and fail the whole plan before any write
  - `rewriteLinks`: a single regex pass over ID tokens `\b(REQ|DEC)-(\d{3,4})\b` applied only inside the recognized contexts (wikilinks incl. `|label` and `#anchor`, typed links, `Supersedes:`/`Links:`/`Source`-style list lines, frontmatter array values, relative markdown link targets `…/(requirements|decisions)/(archive/)?(REQ|DEC)-NNNN-…md`); never inside fenced code blocks; never alters text outside those contexts
  - `migrateFrontmatter`: set `id:` to the new ID and put `aliases: [<new>, <old>, …existing]` (dedupe, preserve order, inline flow-list; edit block-style lists in place); rename keys `linked_requirements` → `linked_prds` and `linked_decisions` → `linked_adrs` in any file's frontmatter and rewrite their REQ-/DEC- values; splice the frontmatter back without disturbing the body
  - `foldArchiveIndex`: append the archive index's item rows under `## Closed` of the family index (create `## Active`/`## Closed` per the TASK-0121 format if missing), skipping rows already present, retargeting row link paths from `archive/…` to the family-relative file (and REQ/DEC → PRD/ADR filenames)
  - Un-archive: after renames, move remaining `archive/` files up one level (git mv if tracked), delete `archive/index.md`, `.gitkeep`, and the empty `archive/`; warn and keep the folder if anything unexpected remains
  - Preflight (`--dry-run` reports a dirty tree as a warning but still proceeds read-only): when the project is a git work tree and `--force` is absent, run `git status --porcelain -- <planned paths>`; non-empty → print the offending paths, "commit or stash them, or re-run with --force", exit 1, write nothing
  - `--dry-run`: print the plan grouped as Renames / Link rewrites (file + count) / Field renames / Un-archive moves / Index folds, write nothing (no files, no log), exit 0
  - Real run: apply the plan, then print a summary with the same four counts, then append the single log entry (see Approach) — the log append is the last write so a failed run never logs
  - No-op detection: empty plan → print `wiki IDs already migrated — nothing to do`, exit 0, no log entry

### 3. Wire it into the shared sync and the installer package  <!-- agent: general-purpose -->

- [ ] Edit `lib/scripts/lib.sh` `run_project_sync`: after the `Syncing wiki scaffold...` block and before `Backfilling wiki work-item aliases...`, add
  - `echo "Migrating wiki REQ/DEC IDs to PRD/ADR..."` then `if ! node "$script_dir/migrate-wiki-ids.js" "$project_dir"; then echo "Warning: wiki ID migration did not complete — commit or stash pending wiki changes and re-run update (or run: node <bootstrap>/lib/scripts/migrate-wiki-ids.js <project> --force)." >&2; fi` then `echo ""`
  - Update the function's header comment to list the new step in sequence order and state that it is guarded (non-fatal) unlike the backfill
- [ ] Confirm `update-project.sh` and `setup-project.sh` both reach it through `run_project_sync` (no direct duplicate call); make no change to either if so, and note it in the docs
- [ ] Confirm `package.json` `files` already ships `lib/scripts/` so the new script is in the tarball; mark the file executable (`chmod +x`)
- [ ] Do not run `install-global.sh` and make no `~/.claude` changes

### 4. Write the hermetic test suite  <!-- agent: general-purpose -->

- [ ] Create `test/migrate-wiki-ids.test.js` (`node:test` + `node:assert/strict`), with a `makeFixture()` helper that builds a temp project (`fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'))`) containing: `wiki/work/requirements/{REQ-0001-a.md, archive/REQ-0002-b.md, archive/index.md, index.md}`, `wiki/work/decisions/{DEC-0001-x.md (with ## D1..D4), archive/DEC-0002-y.md, archive/index.md, index.md}`, `wiki/work/roadmaps/{ROADMAP-0001-r.md (linked_requirements/linked_decisions), archive/ROADMAP-0002-s.md, archive/index.md, index.md}`, `wiki/work/tasks/{TASK-0001-t.md, archive/TASK-0002-u.md}` referencing old IDs, `wiki/knowledge/…` page with `[[REQ-0001]]`, `wiki/log.md` and `wiki/log-2026_01_01_000000.md` containing old IDs, `raw/note.md` containing old IDs; clean up in `after()`
  - Rename + alias: `REQ-0001-a.md` → `PRD-0001-a.md`, `id: PRD-0001`, `aliases: [PRD-0001, REQ-0001]`; pre-existing aliases preserved and deduped; archived `DEC-0002-y.md` → `decisions/ADR-0002-y.md` (un-archived); the old filenames no longer exist
  - Link rewriting: `[[REQ-0001]]`, `[[REQ-0001|label]]`, `[[DEC-0001#D4]]`, `implements::[[DEC-0001#D2]]`, a `Supersedes: DEC-0001#D2` line, frontmatter `derived_from: [REQ-0001]`, and `[t](../requirements/archive/REQ-0002-b.md)` all rewritten with anchors and numbers preserved; an ID inside a fenced code block and a plain-prose mention are left unchanged; `TASK-`/`UAT-`/`BUG-`/`ROADMAP-` IDs untouched; tasks `archive/` file untouched
  - Field rename: `linked_requirements` → `linked_prds` and `linked_decisions` → `linked_adrs` with values rewritten, body untouched
  - Un-archive + Closed section: roadmaps/decisions/requirements `archive/` gone, files in the family dir, archive index rows present under `## Closed` (per the TASK-0121 format) with retargeted paths; tasks `archive/` still exists
  - Log/raw untouched: `wiki/log.md` gains exactly one new `migrate` entry (existing text byte-identical), `wiki/log-2026_01_01_000000.md` and `raw/note.md` byte-identical before/after
  - Idempotency: a second run exits 0, prints `nothing to do`, changes no file (compare a full tree hash) and appends no log entry; a project with zero REQ/DEC files and no archive folders is the same no-op
  - Partial state: a fixture where the files are already renamed but a stale `[[DEC-0001#D4]]` link and an `archive/` remain is completed by a run
  - Dry-run: prints the plan sections, exits 0, tree hash unchanged, no log entry
  - Dirty-tree refusal: in a `git init` fixture with an uncommitted edit to `wiki/work/requirements/REQ-0001-a.md`, exit code 1, the message names the file, and nothing changed; the same run with `--force` succeeds; a fixture whose only dirty file is an unrelated `wiki/conventions.md` (not in the plan) is **not** refused
  - Git-tracked vs untracked: a committed fixture ends with the rename visible as `R` in `git status --porcelain`; an untracked fixture is renamed with plain `fs.renameSync`
  - Collision: `PRD-0001-a.md` already present alongside `REQ-0001-a.md` aborts before any write with a clear error
  - CLI edges: unknown flag → exit 2; project without `wiki/work/` → exit 0 with a note
  - Contract checks with no `skip`/`todo` options or keys: assert the test file source contains neither `skip:` nor `todo:` nor `.skip(`/`.todo(`
- [ ] Add a `lib.sh` wiring test (in the same file): `run_project_sync`'s source calls `migrate-wiki-ids.js` after the scaffold sync and before `backfill-wiki-aliases.js`, inside a guarded `if !` (assert by ordering of string indexes)
- [ ] Run `node --test test/migrate-wiki-ids.test.js`, then the full `npm test`; `bash -n lib/scripts/lib.sh`

### 5. Rename the `linked_*` fields in schema docs, templates and writers  <!-- agent: general-purpose -->

- [ ] Search (Serena `search_for_pattern`, non-symbol text) for `linked_requirements` and `linked_decisions` across `lib/skills/`, `lib/scripts/templates/`, `wiki/work/*/lifecycle.md`, `wiki/conventions.md`, `CLAUDE.md`, `README.md`, `lib/scripts/README.md`, `lib/hooks/`, `lib/scripts/wiki-dashboard-server.js`, `lib/scripts/templates/wiki/dashboard.html` and `test/`; the migration script's own source and test fixtures are the only allowed remaining occurrences afterwards
  - Rename to `linked_prds` / `linked_adrs` in: the schema tables of `wiki/work/{requirements,decisions,roadmaps}/lifecycle.md` and their `lib/scripts/templates/wiki/work/…/lifecycle.md` copies (keep local and template copies in lockstep), the roadmap/task/decision skills that write or read the field (`roadmap-create`, `prd-create`, `adr-create` and friends, as named by TASK-0116/0117/0118), the dashboard server/client if they read the field, and any pinned test that asserts the old name (update the assertion, do not delete it)
  - Existing `wiki/work/` data files in this repo are NOT edited here — the migration script renames their fields, and TASK-0124 runs it
  - Note in the lifecycle docs that legacy `linked_requirements` / `linked_decisions` are renamed by the migration (one sentence, no restated procedure)
  - Pair with the Active/Closed index wording from TASK-0121: confirm it is present in the same three lifecycle copies and only fix a gap if one is found

### 6. Document the migration  <!-- agent: general-purpose -->

- [ ] `lib/scripts/README.md`: add a `migrate-wiki-ids.js` section (purpose, usage with `--dry-run`/`--force`, scoped dirty-tree preflight and why, idempotency/no-op message, what it rewrites and what it deliberately leaves alone — `wiki/log.md`, `wiki/log-*.md`, `raw/`, tasks/uat/bugs archives — and that it runs from `run_project_sync` after the scaffold sync and before the alias backfill, non-fatal)
- [ ] `README.md`: in the update/upgrade section describe the one-time REQ→PRD / DEC→ADR migration that `npx @codewizard-dt/bootstrap update` now performs, how to preview it (`node lib/scripts/migrate-wiki-ids.js <project> --dry-run`), and that old IDs keep resolving through `aliases:`
- [ ] `CLAUDE.md` Setup Workflow: add a short clause to the `setup`/`update` bullets naming the guarded migration step (keep it one sentence; do not restate the details)
- [ ] Append a `## Migration` note to the affected knowledge/component page only if one for `backfill-wiki-aliases` already exists in `wiki/knowledge/entities/components/`; otherwise no wiki page is created by this task

### 7. Static gates  <!-- agent: general-purpose -->

- [ ] `node --check lib/scripts/migrate-wiki-ids.js`, `bash -n lib/scripts/lib.sh`, the new test file, then the full `npm test`; fix failures caused by this task only and report any pre-existing failure separately
- [ ] Confirm `git status` shows no changes under `~/.claude` (none are expected) and that nothing under `raw/` or `wiki/log.md` in this repo was modified by the tests
