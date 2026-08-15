---
id: TASK-065
aliases: [TASK-065]
title: "Add aliases: [<ID>] to work-item frontmatter templates"
status: done
created: 2026-08-15
updated: 2026-08-15
depends_on: []
blocks: []
parallel_safe_with: []
uat: "[[UAT-065]]"
tags: [obsidian, wikilinks, roadmap-008]
---

# TASK-065 — Add aliases: [<ID>] to work-item frontmatter templates

## Objective

ROADMAP-008 Phase 1. Obsidian's wikilink click-resolver matches only real filenames, never frontmatter — not even Obsidian's own native `aliases:` property (confirmed intentional design; see `wiki/knowledge/sources/obsidian-alias-link-resolution.md`). Every work-item file in this wiki is named `TASK-NNN-slug.md` (not bare `TASK-NNN.md`), so a bare `[[TASK-NNN]]`-style link never resolves on click even though the file exists — Obsidian offers to create a new note instead. Adding an `aliases: [<ID>]` field to each family's frontmatter (matching that file's own `id:` value, e.g. `id: TASK-NNN` → `aliases: [TASK-NNN]`) makes the short-ID form a real Obsidian alias, so `[[TASK-NNN]]` resolves correctly once the **Alias Linker** plugin is wired in (Phase 3, separate task).

This task edits the frontmatter **templates** in 6 skill files, so every *new* work item created going forward gets a working alias automatically. It does **not** touch any existing work-item files — that is Phase 2, tracked separately (see Notes).

## Approach

Each of the 6 skill files expresses its frontmatter template differently — this is not a uniform find-and-replace. Investigation of the current state of each file (read directly, 2026-08-15):

| File | Current shape | Fix |
|------|---------------|-----|
| `lib/skills/task-add/SKILL.md` | Literal ` ```yaml ` frontmatter block with `id: TASK-NNN` (~line 100) | Insert `aliases: [TASK-NNN]` immediately after `id: TASK-NNN` |
| `lib/skills/uat-generate/SKILL.md` | Literal ` ```markdown ` frontmatter block with `id: UAT-NNN` (~line 148) | Insert `aliases: [UAT-NNN]` immediately after `id: UAT-NNN` |
| `lib/skills/req-create/SKILL.md` | Literal ` ```yaml ` frontmatter block with `id: REQ-NNN` (~line 75) | Insert `aliases: [REQ-NNN]` immediately after `id: REQ-NNN` |
| `lib/skills/bug-file/SKILL.md` | **No literal YAML block.** Step 6 ("Write the Bug File") lists fields to set as prose bullets, deferring the actual schema to `wiki/work/bugs/lifecycle.md` | Add a new bullet to the Step 6 "Set:" list instructing the skill to also write `aliases: [BUG-NNNN]` |
| `lib/skills/decision-create/SKILL.md` | **No YAML frontmatter at all today** — Step 5's template opens directly with `# DEC-NNNN: <Decision-Group Title>` followed by a blockquote and bullet metadata (`- **File created**`, `- **Last updated**`, `- **Tags (group)**`), never a `---`-delimited block | Add a **new, minimal** YAML frontmatter block directly above the H1 (see Step 3 below) — a prose bullet would NOT work since Obsidian only reads the `aliases:` key from real frontmatter |
| `lib/skills/roadmap-create/SKILL.md` | **No literal YAML block.** Step 6 is a field table (`Status`, `Created`, `Last updated`, `Owner`, `Linked PRD`, `Linked ADRs`, `Tags`) describing what belongs in the roadmap's frontmatter, deferring to `wiki/work/roadmaps/lifecycle.md` | Add a new row to that field table for `aliases` |

**Explicitly out of scope** (do not do this work here): editing `wiki/work/*/lifecycle.md` schema docs, backfilling `aliases:` onto any existing work-item file (Phase 2), and installing/wiring the Alias Linker plugin (Phase 3).

## Steps

### 1. Direct id-adjacent inserts: task-add, uat-generate, req-create <!-- agent: general-purpose -->

- [x] `lib/skills/task-add/SKILL.md` — locate the ` ```yaml ` frontmatter template block containing `id: TASK-NNN` (Step "Create the task file" / "Frontmatter (required)"). Insert a new line `aliases: [TASK-NNN]` immediately after the `id: TASK-NNN` line, before `title:`.
- [x] `lib/skills/uat-generate/SKILL.md` — locate the ` ```markdown ` frontmatter template block containing `id: UAT-NNN` (~line 148). Insert `aliases: [UAT-NNN]` immediately after `id: UAT-NNN`, before `title:`.
- [x] `lib/skills/req-create/SKILL.md` — locate the ` ```yaml ` frontmatter template block containing `id: REQ-NNN` (~line 75). Insert `aliases: [REQ-NNN]` immediately after `id: REQ-NNN`, before `type:`.
- [x] Use `Read` then `Edit` for each file (never shell redirection) per `wiki/guides/mcp-tools.md`.
<!-- Updated: 2026-08-15 -->>

### 2. Prose/table-based templates: bug-file, roadmap-create <!-- agent: general-purpose -->

- [x] `lib/skills/bug-file/SKILL.md` — in "Step 6: Write the Bug File", the bullet list starting `- Status: new` / `- Priority: —` / `- Assignee: —` / `- Tags: —` / `- linked_task:` / `- Reported:` / `- Last updated:` — add a new bullet: `- aliases: [BUG-NNNN] — mirrors this file's own id: field so Obsidian's wikilink resolver can find it by short ID (ROADMAP-008)`.
- [x] `lib/skills/roadmap-create/SKILL.md` — in "Step 6: Write the roadmap file", the field table with rows `Status`, `Created`, `Last updated`, `Owner`, `Linked PRD`, `Linked ADRs`, `Tags`, `## Goal`, `## Phase N: <name>`, `## Notes` — add a new row: `| \`aliases\` | \`[ROADMAP-NNN]\` — mirrors the file's own \`id:\` value |`. Place it near the top of the table (after `Status`, before `Created`, or wherever reads most naturally next to the other frontmatter-level rows).
- [x] Use `Read` then `Edit` for each file.
<!-- Updated: 2026-08-15 -->>

### 3. decision-create: add new frontmatter block (special case) <!-- agent: general-purpose -->

- [x] `lib/skills/decision-create/SKILL.md` — in "Step 5: Generate the file", the template currently opens (inside the ` ````markdown ` fence) with:
  ```
  # DEC-NNNN: <Decision-Group Title>

  > Decision Group covering <area-1>, <area-2>, <area-3>.

  - **File created**: YYYY-MM-DD
  ```
  Insert a new YAML frontmatter block immediately above the `# DEC-NNNN: ...` line (i.e. as the very first lines inside the fence):
  ```
  ---
  id: DEC-NNNN
  aliases: [DEC-NNNN]
  ---

  # DEC-NNNN: <Decision-Group Title>
  ```
  - [x] Do **not** add `title:`, `created:`, `updated:`, or `tags:` to this new block, and do not remove or restructure the existing `- **File created**` / `- **Last updated**` / `- **Tags (group)**` bullets — those stay as-is. Reconciling this template with the fuller "Group frontmatter" schema documented in `wiki/work/decisions/lifecycle.md` (which lists `id`/`title`/`created`/`updated`/`tags` as YAML keys but is not fully implemented by this template today) is a pre-existing gap and explicitly out of scope for this task.
<!-- Updated: 2026-08-15 -->>

### 4. Verify <!-- agent: general-purpose -->

- [x] `mcp__serena__search_for_pattern` for `aliases:` across `lib/skills/task-add/SKILL.md`, `lib/skills/uat-generate/SKILL.md`, `lib/skills/req-create/SKILL.md`, `lib/skills/bug-file/SKILL.md`, `lib/skills/decision-create/SKILL.md`, `lib/skills/roadmap-create/SKILL.md` — confirm exactly one new `aliases:`-bearing line (or table row / bullet) landed in each of the 6 files.
- [x] Confirm no other content in these files was altered (diff review) — this task is additive-only.
- [x] No code/test changes are required — these are prompt/template files, not executable code; there is no existing test suite asserting SKILL.md frontmatter-template content.
<!-- Updated: 2026-08-15 -->
<!-- Verification: git diff confirmed all 6 files (task-add, uat-generate, req-create, bug-file, decision-create, roadmap-create) received exactly one clean additive change each; roadmap-create's row uses table syntax without a trailing colon so it was found via a colon-free search, not the literal `aliases:` pattern — no other content in any file was altered. -->>

## Notes

- This task was originally filed as `TASK-064` but was renumbered to `TASK-065` immediately before the report step because a concurrent session's `/task-add` run claimed `TASK-064` first (for the Phase 2 backfill task, `wiki/work/tasks/TASK-064-backfill-work-item-aliases.md`) between this task's initial number scan and its write. No other content changed as part of the renumber.
- Sibling tasks for the other two roadmap phases already exist (created concurrently by other sessions): the Phase 2 backfill task (`wiki/work/tasks/TASK-064-backfill-work-item-aliases.md`) and the Phase 3 Alias Linker plugin task (`wiki/work/tasks/TASK-063-alias-linker-plugin.md`). All three phase tasks operate on disjoint file sets and are safe to run in parallel.
