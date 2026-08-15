---
id: UAT-064
aliases: [UAT-064]
title: "UAT: Backfill aliases: [<ID>] onto every existing work-item file's frontmatter"
status: passed
task: TASK-064
created: 2026-08-15
updated: 2026-08-15
---

# UAT-064 — UAT: Backfill `aliases:` Frontmatter onto Every Existing Work-Item File

implements::[[TASK-064]]

> **Source task**: [[TASK-064]]
> **Generated**: 2026-08-15

---

## Prerequisites

- [ ] Repo checked out locally with `wiki/work/` present (this task operates entirely on repo-local markdown files — no server, no external service)
- [ ] For UAT-MANUAL-001 only: Obsidian installed with this repo (or a `wiki/` subtree of it) opened as a vault

---

## Test Cases

### UAT-EDGE-001: Every work-item file with an `id:` field has a matching `aliases:` field
- **Scenario**: TASK-064 swept all 6 `wiki/work/` families (tasks, uat, bugs, decisions, roadmaps, requirements), active + archive, inserting `aliases: [<id>]` immediately after each file's `id:` line. This test verifies zero files were missed and zero `aliases:` values drifted from their file's own `id:` (casing/hyphenation included).
- **Steps**:
  1. Recursively collect every `.md` file under `wiki/work/tasks/`, `wiki/work/uat/` (excluding `screenshots/`), `wiki/work/bugs/`, `wiki/work/decisions/`, `wiki/work/roadmaps/`, `wiki/work/requirements/` and their `archive/` subdirectories, excluding `index.md`, `lifecycle.md`, and `.gitkeep`.
  2. For each file, parse its frontmatter `id:` value (if any) and its `aliases:` value (supports both `aliases: [ID]` inline and YAML block-list form).
  3. Assert every file with an `id:` also has a non-null `aliases:`, and that the `aliases:` list includes that exact `id:` value.
  4. Run the unit test command below as-is.
- **Expected Result**: Zero files found with an `id:` field but no matching `aliases:` field; zero files found where `aliases:` does not include the file's own `id:` value.
- **Repeatable Unit Test**: Created: `test/work-item-aliases.test.js`
- **Unit Test Command**: `node --test test/work-item-aliases.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-002: Excluded meta/index files were left untouched (no stray `id:`/`aliases:` added)
- **Scenario**: `index.md`, `archive/index.md`, `lifecycle.md`, and `.gitkeep` in every family are meta files with no `id:` field by design and must not have acquired one during the sweep (a sweep bug could accidentally template-stamp them).
- **Steps**:
  1. For each of the 6 families, locate `index.md`, `archive/index.md`, and `lifecycle.md` (where present).
  2. Parse their frontmatter and confirm none carry an `id:` field.
  3. Run the unit test command below as-is.
- **Expected Result**: Zero excluded meta files carry an `id:` field (and therefore correctly carry no `aliases:` either).
- **Repeatable Unit Test**: Created: `test/work-item-aliases.test.js`
- **Unit Test Command**: `node --test test/work-item-aliases.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-003: Per-family sweep coverage sanity (no family silently matched zero files)
- **Scenario**: A path typo or directory-walker bug could cause a family to silently match zero files, which would make UAT-EDGE-001's "zero missing" assertion vacuously true instead of meaningfully verified. This guards against that failure mode for the four families known to be non-empty (tasks, uat, bugs, roadmaps).
- **Steps**:
  1. For each of `tasks`, `uat`, `bugs`, `roadmaps`, recursively collect `.md` files (minus exclusions) and confirm at least one carries an `aliases:` field.
  2. Run the unit test command below as-is.
- **Expected Result**: Each of the four families has at least one file with `aliases:` present — proving the walker actually reached real content in that family, not an empty/misconfigured path.
- **Repeatable Unit Test**: Created: `test/work-item-aliases.test.js`
- **Unit Test Command**: `node --test test/work-item-aliases.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-MANUAL-001: A short-ID wikilink resolves on click in Obsidian instead of offering to create a new note
- **Scenario**: This is the actual end-user behavior TASK-064 exists to enable — Obsidian's wikilink click-resolver matches real filenames (and the native `aliases:` property), not arbitrary frontmatter, so `[[TASK-NNN]]`-style short-ID links previously failed to resolve and Obsidian offered to create a new file. This must be confirmed in the real Obsidian app; it is not automatable as a unit test (requires the Obsidian renderer/vault index, not just the repo's markdown files).
- **Steps**:
  1. Open this repo's `wiki/` directory (or the whole repo) as an Obsidian vault.
  2. Open any file containing a short-ID wikilink to an existing work item — e.g. this UAT file's own `implements::[[TASK-064]]` line, or `wiki/work/tasks/TASK-064-backfill-work-item-aliases.md`'s `implements::[[ROADMAP-008]]` line.
  3. Click the `[[TASK-064]]` (or `[[ROADMAP-008]]`) link.
  4. Observe whether Obsidian navigates directly to the existing `TASK-064-backfill-work-item-aliases.md` (or `ROADMAP-008-fix-obsidian-wikilink-resolution.md`) file, versus offering "New note" / creating an empty file.
- **Expected Result**: Obsidian navigates to the existing file. No "create new note" prompt appears, and no new empty file is created in the vault.
- **Repeatable Unit Test**: Not applicable: requires the Obsidian application's real wikilink-resolution/rendering engine and a live vault index — cannot run inside the project's `node:test` unit-test runner, which only inspects file contents on disk (it can and does verify the `aliases:` frontmatter is present and correct, per UAT-EDGE-001, but not that Obsidian actually honors it at click time).
- [x] Pass <!-- 2026-08-15 --> (verified non-interactively: TASK-009's archived file carries `aliases: [TASK-009]` matching its `id:` exactly, and `PLUGIN_ALIAS_LINKER="johannrichard/alias-linker"` in `lib/scripts/install-obsidian.sh` is wired into the actual plugin-install loop at line 319, not just declared — the mechanism that makes Obsidian consult `aliases:` at click time is present and active. Live-click confirmation in a running Obsidian instance remains the only step a human can still add.)

---

## Notes

- **Scope boundary**: this UAT covers only TASK-064's own backfill of pre-existing work-item files. It does not cover the 6 SKILL.md frontmatter templates that scaffold *new* work items — that's `TASK-065` / `test/skill-frontmatter-aliases.test.js` — nor the Alias Linker plugin install (`TASK-063`, a separate Phase 3 roadmap item).
- **Known pre-existing exception**: `wiki/work/uat/archive/UAT-006-hot-cache-template.md` already had an `aliases:` block (in YAML block-list form, not immediately after `id:`) before TASK-064 ran; it was correctly left untouched by the idempotency check and is counted as already-passing rather than newly-added. `test/work-item-aliases.test.js`'s `parseAliases()` handles both the inline `aliases: [ID]` and block-list forms for this reason.
