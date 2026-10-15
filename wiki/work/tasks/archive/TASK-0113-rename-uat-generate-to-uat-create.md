---
id: TASK-0113
aliases: [TASK-0113]
title: "Rename uat-generate to uat-create"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0112]
blocks: [TASK-0114]
parallel_safe_with: []
uat: "[[UAT-0113]]"
tags: [skill-design, rename, roadmap-0014]
---

# TASK-0113 — Rename uat-generate to uat-create

depends_on::[[TASK-0112]]
blocks::[[TASK-0114]]

## Objective

Hard-rename the `/uat-generate` skill to `/uat-create` so the `uat` family shares the common `create` action name with every other `wiki/work/` family ([[ROADMAP-0014]] Phase 4). Only the **name** changes: `lib/skills/uat-generate/` becomes `lib/skills/uat-create/`, and every live reference to the old name across skills, scripts, templates, tests, and docs is rewritten. Behavior is untouched, and no redirect stub is left behind (roadmap Q&A item 4, 2026-09-19).

## Approach

- **Hard rename, no alias.** `git mv lib/skills/uat-generate lib/skills/uat-create` (plain `mv` if the directory turns out to be untracked), then edit `name:`, `description:`, the H1, and self-references inside the moved `SKILL.md`. No stub is left at the old path.
- **Sweep by search, not by the site list below.** [[TASK-0112]] and earlier Phase 4 renames (e.g. `task-add` → `task-create`) may have moved files that currently mention `/uat-generate`, so the site list is a *starting inventory as of creation time*. The authoritative sweep is `mcp__serena__search_for_pattern` for `\buat-generate\b` (case-insensitive) over the whole repo, re-run until it returns only allowlisted historical records.
- **Leave the preference key alone.** `uatGenerate.promoteTests` is a stored-preferences key persisted in users' `~/.claude/bootstrap-prefs.json` and project prefs files; renaming it would orphan every stored answer. The camelCase spelling is not matched by `\buat-generate\b`, so it is naturally exempt, and a test pins that it still exists. Every occurrence in `lib/scripts/install-global.sh`, `lib/scripts/templates/bootstrap-prefs-schema.json`, `lib/scripts/README.md`, `lib/skills/bootstrap-config/SKILL.md`, the moved `SKILL.md`, and `test/bootstrap-prefs.test.js` stays exactly as is (only the *prose* `/uat-generate` on the same lines is renamed).
- **Do not touch the installed copy.** No edits under `~/.claude/skills/` and no `install-global.sh` run; [[ROADMAP-0014]]'s installer-prune item (`TASK-0122`) removes the stale installed `uat-generate` directory.
- **Historical records are exempt.** `wiki/log.md` (append-only) and `raw/` (immutable) are never edited; neither are completed-work records that quote the old name as it was at the time. The residue test encodes this as an explicit allowlist (Step 6), so "live" is defined by the test rather than by judgment.
- **Known unclearable residue.** `raw/guides/command-anti-patterns.md:69` mentions `/uat-generate`, and `wiki/guides/command-anti-patterns.md:69` is a `sync-wiki-scaffold.sh` copy that is always refreshed from that immutable `raw/` source, so editing the copy would be reverted on the next `update`. Both are allowlisted and reported in the final summary as a follow-up for the owner (a `raw/` exception is outside this task's authority).

## Steps

### 1. Pre-flight and inventory  <!-- agent: Explore -->

- [x] Confirm [[TASK-0112]] is `done` (or at least that its file edits have landed) by reading `wiki/work/tasks/TASK-0112-*.md` frontmatter; if it is still in flight, stop and report rather than sweeping files another task is mid-edit on.
- [x] Run `mcp__serena__search_for_pattern` with `substring_pattern: "(?i)\\buat-generate\\b"` across the repo (no `relative_path`) and record every hit grouped by file. Treat the inventory in Step 3-5 as a checklist to reconcile against this fresh result: any file in the fresh result that is not listed below is still in scope unless it matches the Step 6 allowlist.
- [x] Also search the word-boundary variants `UAT-generate` and `UAT generate` (prose forms, e.g. `lib/skills/power-mode/SKILL.md:101,136,149`) and rewrite those that name the skill.

### 2. Move and edit the skill itself  <!-- agent: general-purpose -->

- [x] Check tracking with `git ls-files lib/skills/uat-generate`; then `git mv lib/skills/uat-generate lib/skills/uat-create` (tracked) or `mv` (untracked). The directory holds a single file, `SKILL.md`; confirm none were added since.
- [x] `lib/skills/uat-create/SKILL.md` frontmatter: `name: uat-create`; `description: Create UAT tests in wiki/work/uat/ for a task` (drops "Generate"); leave `category`, `model`, `argument-hint`, `disable-model-invocation`, `user-invocable` unchanged.
- [x] Rename the H1 `# UAT Generator` → `# UAT Creator`; leave `### Step 3: Generate UAT test cases` and other verb-usage prose alone (it describes an action, not the skill name).
- [x] Rename the self-reference at line ~104 (`/uat-generate writes promoted tests to a dedicated folder…`) to `/uat-create`, **without** touching `uatGenerate.promoteTests` on lines ~94, 103, 104, 112, 224, 250 (the `--get`/`--set` commands and the recorded `Skipped by preference (uatGenerate.promoteTests=never)` string are load-bearing).
- [x] Add nothing else: no new behavior, no "formerly uat-generate" note.

### 3. Sweep other skills and shared docs  <!-- agent: general-purpose -->

Replace `/uat-generate` → `/uat-create` and `uat-generate` → `uat-create` at each site (inventory as of 2026-09-19; reconcile against Step 1's fresh search):

- [x] `lib/skills/tackle/SKILL.md` lines ~54 (two mentions) and ~136 (two mentions).
- [x] `lib/skills/power-mode/SKILL.md` line 2 (frontmatter `description`), ~22, ~90, ~101 (`UAT-generate` prose), ~136 (`UAT-generate` prose), ~149 (`Run /uat-generate <task-path>`; the agent `description: "UAT generate TASK-NNNN"` may become `"UAT create TASK-NNNN"`).
- [x] `lib/skills/uat-walk/UAT-CORE.md` lines ~4 (pipeline string), ~55, ~119, ~121, ~127 (`lib/skills/uat-generate/SKILL.md` path → `lib/skills/uat-create/SKILL.md`).
- [x] `lib/skills/roadmap-next/SKILL.md` lines ~40 and ~87.
- [x] `lib/skills/_shared/ID-RESOLUTION.md` line ~128 (caller-deltas table row: `` `tackle`, `task-update`, `uat-skip`, `uat-generate` ``).
- [x] `lib/skills/git-commit/SKILL.md` line ~274 (the example commit message `[minor] Require research for every test type in /uat-generate with checkpoint gate`).
- [x] The task-creation skill's completion hint (`To generate tests:  /uat-generate TASK-NNNN`): currently `lib/skills/task-add/SKILL.md:226`, but after [[TASK-0112]] and earlier renames it may live at `lib/skills/task-create/SKILL.md`; use the search result, not the path.
- [x] `lib/skills/uat-auto/`, `uat-auto-plus/`, `uat-skip/`, `uat-walk/SKILL.md` had no direct mentions at creation time; confirm with the fresh search and fix any that appear.
- [x] `lib/skills/README.md`: table row line ~58 (`` | `uat-generate` | Generate UAT tests… ``  → `` | `uat-create` | Create UAT tests… ``) and the `power-mode` row line ~87 (`tackle → uat-generate → uat-auto`). Keep table row ordering sensible for the rest of the table.

### 4. Sweep scripts, templates, and prompts  <!-- agent: general-purpose -->

- [x] `lib/scripts/install-global.sh` line ~262: the prompt text `Where should /uat-generate write the unit tests…` → `/uat-create`. Do **not** touch the `uatGenerate.promoteTests` identifiers on lines ~250-287; run `bash -n lib/scripts/install-global.sh` afterwards.
- [x] `lib/scripts/README.md` lines ~361 (`/research`, `/uat-generate`, and…) and ~424 (table row: rename only the prose in the last cell; keep the `uatGenerate.promoteTests` key cell).
- [x] `lib/scripts/templates/bootstrap-prefs-schema.json` line ~213: `"summary": "Where /uat-generate writes…"` → `/uat-create`. Keep the key `"uatGenerate.promoteTests"` (line ~210). Before editing, grep `test/bootstrap-prefs.test.js` and any other test for the literal summary string; if one pins it, update it in Step 5. Validate the JSON still parses (`node -e "JSON.parse(require('fs').readFileSync('lib/scripts/templates/bootstrap-prefs-schema.json','utf8'))"`).
- [x] `lib/scripts/templates/wiki/work/uat/lifecycle.md` line ~38 (`pending — created by /uat-generate`) and its local copy `wiki/work/uat/lifecycle.md` line ~40; the two must stay in sync.
- [x] `lib/scripts/templates/CLAUDE-wiki.md`, `lib/hooks/**`, `lib/prompts/**`: had no matches at creation time; confirm with the fresh search.

### 5. Sweep docs, live wiki pages, and memories  <!-- agent: general-purpose -->

- [x] `CLAUDE.md` line ~119 (Custom Commands table row `` | `/uat-generate <target>` | Generate UAT tests… `` → `` `/uat-create <target>` `` / `Create UAT tests…`). `README.md` (root) had no match; confirm.
- [x] `wiki/knowledge/entities/components/power-mode-skill.md` lines ~12 and ~16 (current-behavior component page): `tackle → uat-generate → uat-auto` → `tackle → uat-create → uat-auto` (three occurrences on line 16 and one on line 12), keeping every typed link intact. Keep its `updated:` field current.
- [x] `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md` line ~45 (same pipeline string).
- [x] `.serena/memories/project/overview.md` (line ~53), `.serena/memories/workflow/prd-layer.md` (line ~5), `.serena/memories/skills/format-and-model-selection.md` (line ~25): rename **only** the `uat-generate` token via the Serena memory tools (`read_memory` then `edit_memory`), leaving the other still-old skill names in those lines alone (later Phase 4 tasks own them).
- [x] Do **not** edit `wiki/log.md`, anything under `raw/`, or the exempt records listed in Step 6. Do not refresh `wiki/hot.md` here.
- [x] Do not append this task's own log entry here; `/task-add` already logged creation, and the implementing `/tackle` run logs completion via the normal flow.

### 6. Update pinned tests and add the residue-sweep test  <!-- agent: general-purpose -->

- [x] `test/skill-frontmatter-aliases.test.js`: rename `UAT_GENERATE_SKILL` to `UAT_CREATE_SKILL` (line ~39), point it at `lib/skills/uat-create/SKILL.md`, and update the test title and assertion message strings (lines ~59, ~64).
- [x] `test/power-mode-single-task-pointer.test.js`: update the header comment (line 3), the test title (line ~79), the `` `/uat-generate <task-path>` `` index probe (line ~82), the assertion messages (~85, ~87), the expected Dispatch text (line ~110: `tackle → uat-create → uat-auto`), and the README row regex (line ~175). These assertions read the skill's own text, so they must match exactly what Step 3 wrote.
- [x] `test/shared-id-resolution.test.js`: `'uat-generate'` in `WIRED_SKILLS` (line ~58) and the `EXPECTED_WIRING` key (line ~154) → `'uat-create'`. Keep the ID-RESOLUTION wiring line inside the moved `SKILL.md` untouched (family `tasks`, scope `active`).
- [x] `test/bootstrap-prefs.test.js`: line ~3511, the consumer-map value `'lib/skills/uat-generate/SKILL.md'` → `'lib/skills/uat-create/SKILL.md'` (this one is functional, not a comment: it locates the consumer file); the comments at ~2639 and ~3401 likewise. The key `'uatGenerate.promoteTests'` on those lines stays.
- [x] Create `test/uat-create-rename.test.js` (zero-dependency `node:test` + `node:assert/strict` + `node:fs` + `node:path`, `'use strict'`, same header-comment style as `test/github-actions-removed.test.js`). Cases:
  - `lib/skills/uat-create/SKILL.md` exists and its frontmatter `name:` is `uat-create` (parse the `---` block like `test/shared-id-resolution.test.js`).
  - `lib/skills/uat-generate` no longer exists (no redirect stub).
  - Every `lib/skills/*/SKILL.md` `name:` equals its directory name (guards the class of mistake a rename invites).
  - `uatGenerate.promoteTests` is still present in `lib/scripts/templates/bootstrap-prefs-schema.json`, `lib/scripts/install-global.sh`, and `lib/skills/uat-create/SKILL.md` (the stored-prefs key is deliberately not renamed).
  - **Residue sweep:** walk the repo from `REPO` (skip `.git`, `node_modules`, `.claude`, `.serena/cache`, and files over ~1 MB or containing NUL bytes), match `/\buat-generate\b/i` line by line, drop hits whose repo-relative path matches the allowlist below, and assert the remaining hit list is empty, printing `path:line` for each offender. `\b` keeps `uatGenerate.promoteTests` and the unrelated word `UAT-generated` out of the match.
  - Allowlist (explicit, each entry commented with why): `wiki/log.md` (append-only), `raw/**` (immutable, incl. `raw/guides/command-anti-patterns.md`), `wiki/guides/command-anti-patterns.md` (refreshed from that raw file by `sync-wiki-scaffold.sh`), `**/archive/**` (terminal records), `wiki/work/tasks/TASK-*` and `wiki/work/uat/UAT-*` (work records quoting the old name as it was; this includes `TASK-0113` itself), `wiki/work/roadmaps/**` ([[ROADMAP-0014]] names the old skill in its prune-list and item text), `wiki/knowledge/sources/**` (per-source snapshots), `wiki/knowledge/concepts/wiki-work-filename-convention.md` (dated commit-history narrative), and the test file itself. Everything else (`lib/**`, `test/**`, `README.md`, `CLAUDE.md`, `wiki/index.md`, `wiki/hot.md`, `wiki/conventions.md`, `wiki/guides/**` other than the one above, family `index.md`/`lifecycle.md` files, other `wiki/knowledge/**`, `.serena/memories/**`) is live and must be clean.
- [x] If the fresh Step 1 search surfaces a live file this task list missed, fix it and do not widen the allowlist to hide it.

### 7. Verify  <!-- agent: general-purpose -->

- [x] `node --test test/uat-create-rename.test.js` passes, and re-run each edited suite file-scoped: `test/skill-frontmatter-aliases.test.js`, `test/power-mode-single-task-pointer.test.js`, `test/shared-id-resolution.test.js`, `test/bootstrap-prefs.test.js`.
- [x] `bash -n lib/scripts/install-global.sh` and the schema JSON parse check from Step 4.
- [x] `mcp__serena__search_for_pattern` for `(?i)\buat-generate\b` one last time: every remaining hit must be on the allowlist; also search `uatGenerate.promoteTests` and confirm the key count is unchanged from the Step 1 inventory.
- [x] `npm test`: compare against the pre-change failure set. Sibling in-flight Phase 4 work may leave pre-existing failures in skill-contract suites (`task-typed-links`, `wiki-work-naming-convention`, etc.); attribute any failure to this task or to files it did not touch, and do not fix unrelated ones here.
- [x] Confirm `~/.claude/skills/uat-generate` was neither modified nor removed (no `install-global.sh` run) and that `wiki/log.md` and `raw/` have no diff from this task.

## Notes

- Files overlap with other Phase 4 renames (`tackle`, `power-mode`, `roadmap-next`, `README.md`, `CLAUDE.md`, `lib/skills/README.md`, `ID-RESOLUTION.md`, `UAT-CORE.md`), which is why the Phase 4 chain is sequential: this task only rewrites its own token and leaves the neighbours' still-old names for their owning tasks.
- The `uat` family gains `uat-assess` in a later Phase 4 item; that is not part of this rename.
