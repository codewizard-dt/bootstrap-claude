---
id: TASK-0112
aliases: [TASK-0112]
title: "Rename the task-add skill to task-create"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0111]
blocks: [TASK-0113]
parallel_safe_with: []
uat: "[[UAT-0112]]"
tags: [skill-design, rename, roadmap-0014]
---

# TASK-0112 — Rename the task-add skill to task-create

depends_on::[[TASK-0111]]
blocks::[[TASK-0113]]

## Objective

Hard-rename the `task-add` skill to `task-create` so the `wiki/work/tasks/` family shares the common `create` action name used by every other family (ROADMAP-0014 Phase 4, item "Rename `task-add` → `task-create`"). Only the name changes — no behavior, step, flag (`--decision`, `--roadmap`, `--knowledge`), or output-format change. Every live reference across skills, scripts, templates, tests, docs, and non-historical wiki pages moves to `task-create`, and a residue-sweep test guarantees no live `task-add` reference survives.

## Approach

Decisions were made in the 2026-09-19 Q&A recorded in ROADMAP-0014's Notes; this task does not re-open them:

- **Hard rename, no redirect stub.** `git mv lib/skills/task-add lib/skills/task-create` (plain `mv` only if `git ls-files lib/skills/task-add` is empty). No `task-add` alias or stub is left behind.
- **Do NOT touch the installed copy** at `~/.claude/skills/task-add/` and do NOT run `install-global.sh` — pruning stale installed skills is TASK-0122's job. Repo copies only.
- **Live vs. historical.** Live = rewritten. Historical = left verbatim because rewriting would falsify the record. Historical set (excluded from both the edits and the residue-sweep test): `wiki/log.md` (append-only), `raw/**` (immutable), `.docs/**` (dated audit reports), `wiki/hot.md` (regenerated cache; not refreshed here), `wiki/knowledge/sources/**` (summaries of immutable raw research), any file whose basename starts `TASK-`, `UAT-`, `BUG-`, `ROADMAP-`, or `DEC-` (work-item records, including everything under `wiki/work/*/archive/`), and `wiki/work/*/index.md` (family indexes carry historical task titles that quote `task-add`). Family `lifecycle.md` files are **live** and are updated.
- **Sequencing.** Follows TASK-0111 (the preceding single-skill rename in the chain) because both edit the same cross-reference sites (`bug-triage`, `bug-close`, `roadmap-next`, `uat-*`, `CLAUDE.md`, `lib/skills/README.md`, shared tests). Precedes TASK-0113. Many of these files are also being edited by other agents in the working tree — always re-read a file immediately before editing it and use minimal exact-string edits; never rewrite whole files.
- **Known-failing tests stay failing.** 5 pre-existing failures (the `TASK-NNN` vs `TASK-NNNN` placeholder pins: 4 in `test/skill-frontmatter-aliases.test.js`, 1 in `test/task-typed-links.test.js`) are out of scope. Update only the `task-add` → `task-create` text on the lines this rename touches (paths, test titles, assertion messages); do not "fix" the placeholder pins.
- **Matching rule.** Search case-insensitively for `task[-_ ]?add` (covers `task-add`, `TASK_ADD`, `Task Add`) but only rewrite hits that refer to the skill. Identifiers such as `TASK_ADD_SKILL` constants in tests are renamed to `TASK_CREATE_SKILL` / `TASK_CREATE` for consistency (they are not matched by the hyphenated residue sweep, so this is tidiness, not correctness).

## Steps

### 1. Rename the skill directory and its frontmatter  <!-- agent: general-purpose --> <!-- Updated: 2026-09-19 -->

- [x] Rename the directory
  - Run `git ls-files lib/skills/task-add`; if it prints files, `git mv lib/skills/task-add lib/skills/task-create` (uncommitted working-tree edits by other agents travel with the file); if empty, plain `mv`
  - Confirm `lib/skills/task-add/` no longer exists and `lib/skills/task-create/SKILL.md` does
- [x] Update `lib/skills/task-create/SKILL.md` frontmatter and body
  - Line 1: `name: task-add` → `name: task-create`
  - Re-read the whole file; fix any `task-add` in `description:`, `argument-hint:`, prose, or examples (a prior search found only the `name:` line, so expect just that one)
  - Do not change any step, flag, table, or template — only the name

### 2. Update `/task-add` and `Skill task-add` references in every other skill  <!-- agent: general-purpose --> <!-- Updated: 2026-09-19 -->

For each file, re-read immediately before editing, then replace `task-add` → `task-create` at each hit (line numbers are from the 2026-09-19 scan and may have shifted). Invocation forms (`/task-add`, `` `task-add` `` in `Skill` calls, `task-add's`) all become the `task-create` equivalent.

- [x] `lib/skills/roadmap-next/SKILL.md` — lines ~47, 48, 49, 53 (x2), 90, 97: `Skill` `task-add` invocations, "do not call `task-add`", "task-add's summary", the "Re-run /roadmap-next after /task-add" message, the zero-items message, and the Permitted-tools note
- [x] `lib/skills/roadmap-create/SKILL.md` — lines ~21 (x2), 35, 89, 96, 100, 185, 187, 215
- [x] `lib/skills/bug-close/SKILL.md` — line ~122 (x2): `Skill` `task-add` invocation and `/task-add --roadmap`
- [x] `lib/skills/bug-triage/SKILL.md` — line ~103
- [x] `lib/skills/bug-assess/SKILL.md` — lines ~122, 133
- [x] `lib/skills/decision-next/SKILL.md` — **frontmatter `description:` (line 2)** plus lines ~93, 108
- [x] `lib/skills/decision-finalize/SKILL.md` — lines ~147, 149, 161
- [x] `lib/skills/decision-walkthrough/SKILL.md` — line ~28
- [x] `lib/skills/req-create/SKILL.md` — line ~25
- [x] `lib/skills/req-finalize/SKILL.md` — lines ~183, 218, 240
- [x] `lib/skills/req-extract-decisions/SKILL.md` — lines ~129, 204, 207, 214
- [x] `lib/skills/uat-generate/SKILL.md` — line ~44
- [x] `lib/skills/uat-walk/SKILL.md` — line ~160
- [x] `lib/skills/uat-walk/UAT-CORE.md` — line ~4 (pipeline line)
- [x] `lib/skills/tackle/SKILL.md` — lines ~48, 89
- [x] `lib/skills/power-mode/SKILL.md` — line ~127 (the teammate `prompt:` string `Run /task-add for this roadmap item…`); also grep the file for any other spelling
- [x] `lib/skills/task-update/SKILL.md` — lines ~33 (`lib/skills/task-add/SKILL.md` path → `lib/skills/task-create/SKILL.md`) and ~47
- [x] `lib/skills/research/SKILL.md` — lines ~139, 270, 276
- [x] `lib/skills/port-feature/SKILL.md` — lines ~35, 220, 236
- [x] `lib/skills/extract-feature/SKILL.md` — lines ~37, 243, 259
- [x] `lib/skills/architecture-audit/SKILL.md` — line ~222
- [x] `lib/skills/security-audit/SKILL.md` — line ~245
- [x] `lib/skills/README.md` — line ~35 (`decision-next` row) and line ~49 (the `task-add` row: rename the first cell to `task-create`; keep the description; if the table is alphabetical, move the row to its sorted position)
- [x] Sweep to confirm nothing was missed: case-insensitive `task[-_ ]?add` across `lib/skills/**` must return zero hits

### 3. Update non-skill live docs, scripts, templates, and Serena memories  <!-- agent: general-purpose --> <!-- Updated: 2026-09-19 -->

- [x] `CLAUDE.md` — Custom Commands table row `` `/task-add <desc>` `` (line ~103) → `` `/task-create <desc>` `` (keep the flags text and row position), and the `decision-next` row (line ~115); grep for any further hits. This repo's `CLAUDE.md` is the checked-in project file — edit with Edit, never rewrite
- [x] `ELEVATOR_PITCH.md` — line ~14 (`/task-add` in the slash-command sentence)
- [x] `wiki/work/tasks/lifecycle.md` — the `todo` status line (`created by /task-add`, ~line 41)
- [x] `lib/scripts/templates/wiki/work/tasks/lifecycle.md` — same `todo` status line (~line 38); template copy is delivered to target projects, so keep it identical in wording to the local copy
- [x] `wiki/work/roadmaps/lifecycle.md` (~line 32) and `lib/scripts/templates/wiki/work/roadmaps/lifecycle.md` (~line 30) — `/task-add --roadmap ROADMAP-NNNN` → `/task-create --roadmap ROADMAP-NNNN`
- [x] Confirm zero matches (edit only if a hit appears): `README.md`, `lib/scripts/**` other than the two templates above (including `lib/scripts/templates/CLAUDE-wiki.md` and `CLAUDE-env-safety.md`), `lib/hooks/**`, `lib/prompts/**`, `bin/**`, `package.json`, `lib/skills/_shared/**`
- [x] Serena project memories (live orientation docs; edit with `Edit` or `mcp__serena__edit_memory`): `.serena/memories/project/overview.md` (~lines 53, 55), `.serena/memories/workflow/prd-layer.md` (~lines 5, 8), `.serena/memories/skills/format-and-model-selection.md` (~line 25, the planning-skills list)
- [x] Do NOT edit `~/.claude/skills/**`, `wiki/log.md`, anything under `raw/`, `.docs/**`, or `wiki/hot.md`

### 4. Update non-historical wiki knowledge pages  <!-- agent: general-purpose --> <!-- Updated: 2026-09-19 -->

Only `wiki/knowledge/concepts/**` and `wiki/knowledge/entities/**` — the timeless pages that are revised in place. Re-read each before editing (some are modified by other agents right now).

- [x] `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md` — lines ~25, 28
- [x] `wiki/knowledge/concepts/wiki-multi-writer-safety.md` — line ~20
- [x] `wiki/knowledge/concepts/wiki-work-family-cross-linking-gaps.md` — lines ~25, 32, 40
- [x] `wiki/knowledge/concepts/wiki-work-filename-convention.md` — lines ~17, 38
- [x] `wiki/knowledge/entities/tools/claude-code-plugin-marketplace.md` — line ~15
- [x] Leave `wiki/knowledge/sources/**` untouched (`wiki-work-family-synergy.md`, `obsidian-alias-link-resolution.md`, `wiki-work-family-naming.md`, `wiki-skill-simplification.md` quote `task-add` as it was named at research time)
- [x] Do not add a `wiki/log.md` entry from this step; the log gets one entry when the rename is finished (`/tackle` handles it)

### 5. Update every test that pins the old name  <!-- agent: general-purpose --> <!-- Updated: 2026-09-19 -->

Re-read each test before editing. In each: update path strings (`'task-add'` → `'task-create'` in `path.join(REPO, 'lib', 'skills', ...)`), constant names (`TASK_ADD_SKILL` → `TASK_CREATE_SKILL`, `TASK_ADD` → `TASK_CREATE`), test titles, comments, assertion messages, and regexes. Leave the 5 known-failing placeholder pins alone.

- [x] `git mv test/task-add-origin-bug-scan.test.js test/task-create-origin-bug-scan.test.js`, then update its header comments (`node --test test/task-create-origin-bug-scan.test.js`), path constant (line ~33), all `task-add …` test titles, and the machine-local-copy guard (lines ~133-136): the lowercased string `~/.claude/skills/task-create/skill.md` must still be asserted absent
- [x] `test/skill-frontmatter-aliases.test.js` — constant + path (lines ~38), title and message (~50, 55); do not touch the `TASK-NNN` placeholder assertions
- [x] `test/knowledge-link-flag.test.js` — header (~2, 11, 23), path constant (~38), section comment (~54), titles (~57–127), CLAUDE.md table-row check (~218–224: the `` `/task-add <desc>` `` row lookup and both assertion messages must become `/task-create`), machine-local guard message (~233)
- [x] `test/task-typed-links.test.js` — header (~1, 16), path constant (~34), titles (~82, 96, 105) and message (~101, 110); do not touch the known-failing placeholder pin
- [x] `test/bug-close-clustering-offer.test.js` — comment (~14), title (~82), and the regex at ~86 (`` /On yes: invoke `Skill` `task-add` with… / `` → `task-create`) plus message (~87)
- [x] `test/skill-boilerplate.test.js` — comment (~4: the sibling-suite filename becomes `test/task-create-origin-bug-scan.test.js`) and `ALLOCATION_CONSUMERS` (~67: `'task-add'` → `'task-create'`)
- [x] `test/task-dependency-single-source.test.js` — comment (~12) and path constant (~35)
- [x] `test/wiki-work-naming-convention.test.js` — comments (~53–57), title (~57), `read('lib/skills/task-add/SKILL.md')` (~58) → `task-create`
- [x] `test/task-dependency-fields-content.test.js` — path constant (~24), titles (~101, 110, 120), the `doesNotMatch(/step 3\.5/i, 'stale /task-add step 3.5 …')` message (~140), and the `` assert.match(structure, /`\/task-add` Step 5/) `` regex (~150) → `` /`\/task-create` Step 5/ `` (confirm the file it reads now says `/task-create` after Step 2/3 edits)
- [x] `test/shared-id-resolution.test.js` — comment (~39), the skill list entry (~59), and the family-map key (~155: `'task-add': [['decisions','active'],['roadmaps','active']]`)
- [x] `test/wiki-lint-taskless-decisions.test.js` — the `decision-next` description regex (~152: `surface suggested \/task-add command` → `\/task-create`) — must match the `description:` edited in Step 2
- [x] Final test-file sweep: case-insensitive `task[-_ ]?add` across `test/**` returns zero hits except inside the residue-sweep test (Step 6), where the literal is assembled from fragments

### 6. Add the residue-sweep test  <!-- agent: general-purpose --> <!-- Updated: 2026-09-19 -->

- [x] Create `test/task-create-rename-residue.test.js`, zero-dependency `node:test` + `node:assert/strict` + `node:fs`/`node:path`, following the header-comment style of sibling suites (e.g. `test/task-create-origin-bug-scan.test.js`, `test/skill-boilerplate.test.js`)
  - Build the search token from fragments (`'task' + '-add'`) so this file never matches itself; also skip this file by path
  - Test 1: `lib/skills/task-add/` does not exist; `lib/skills/task-create/SKILL.md` exists and its frontmatter has `name: task-create`
  - Test 2 (residue sweep): recursively walk the repo root and assert no file contains the token, skipping: `.git/`, `node_modules/`, `raw/`, `.docs/`, `.serena/cache/`, `wiki/log.md`, `wiki/hot.md`, `wiki/knowledge/sources/`, any `archive/` directory, `wiki/work/*/index.md`, and any file whose basename starts `TASK-`, `UAT-`, `BUG-`, `ROADMAP-`, or `DEC-`. Treat unreadable/binary files as skipped. On failure, list every offending `path:line` in the assertion message
  - Document the historical allowlist in a comment at the top of the test so a future maintainer knows why each exclusion exists
  - Test 3: `lib/skills/README.md` lists `task-create` and does not list `task-add`
- [x] Run `node --test test/task-create-rename-residue.test.js`; it must pass

### 7. Verify  <!-- agent: general-purpose --> <!-- Updated: 2026-09-19 -->

- [x] `node --test test/` — the only failures must be the 5 known pre-existing ones (4 in `skill-frontmatter-aliases`, 1 in `task-typed-links`, all `TASK-NNN` vs `TASK-NNNN` placeholder pins); report each failing test name in the summary. Any other failure is caused by this rename and must be fixed
- [x] `git grep -n -i -E 'task[-_ ]?add'` — every remaining hit must be inside the historical set defined in Approach (or the sweep test's fragment-built token)
- [x] `git status --short lib/skills/task-add lib/skills/task-create` shows a rename (`R`), not a delete + untracked add, when `git mv` was used
- [x] Confirm `~/.claude/skills/task-add/` and `~/.claude/skills/task-create/` were NOT created or modified by this task, and `install-global.sh` was not run
