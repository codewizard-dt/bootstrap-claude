---
id: TASK-0116
aliases: [TASK-0116]
title: "Rename the requirements family's skills to PRD and issue new items as PRD-NNNN"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0115]
blocks: [TASK-0117]
parallel_safe_with: []
tags: [skill-design, rename, wiki-conventions, requirements, prd]
uat: "[[UAT-0116]]"
---

# TASK-0116 — Rename the requirements family's skills to PRD and issue new items as PRD-NNNN

relates_to::[[skill-family-rename-pattern]]
depends_on::[[TASK-0115]]
blocks::[[TASK-0117]]

## Objective

Hard-rename the three requirements-family skills this task owns — `req-create` → `prd-create`, `req-finalize` → `prd-finalize`, `req-compile` → `prd-compile` — and switch **new** items in the family to the `PRD-NNNN` ID and `PRD-NNNN-slug.md` filename (4-digit). Existing `REQ-` items are **not** renamed here (no bulk rename of files or IDs); the `npx … update` migration (a separate ROADMAP-0014 Phase 4 task) does that later, keeping the old ID in `aliases:`. The `wiki/work/requirements/` directory name is kept. The ID-resolution family table, lifecycle wording (both `requirements/lifecycle.md` copies), README, CLAUDE.md, `lib/skills/README.md`, and tests are updated, and a residue-sweep test pins the result. Roadmap item: [[ROADMAP-0014]] Phase 4 ("Rename the `requirements` family's skills to **PRD**"); decisions are the 2026-09-19 Q&A in that roadmap's Notes (items 2, 3, 4 bind this task): new items use `PRD-`; directories keep their names; old skill names are hard-renamed with no redirect stubs.

## Approach

**Sequencing**: first of the two family renames in the Phase 4 chain — runs after TASK-0115 (which already removed `req-update` and reworded `req-finalize`/`req-retire`/`req-create` text, so re-read every file) and precedes TASK-0117 (the ADR rename), which edits the same shared files (`ID-RESOLUTION.md`, `SKILL-BOILERPLATE.md`, `CLAUDE.md`, `lib/skills/README.md`, both lifecycle/conventions copies, the boilerplate/id-resolution tests). Other in-flight tasks touch overlapping files, so every edit is a minimal exact-string edit after a fresh re-read — never a whole-file rewrite.

**Out of scope (owned by separate tasks — do not do here)**:

- Renaming `req-retire` (→ `prd-deprecate`) and `req-extract-decisions` (→ `adr-extract`). These two skill directories, their `name:` lines, their own `REQ-NNNN` / `Source REQ:` prose, and their log-op names stay as they are. This task edits them **only** where they mention the three skills being renamed (`/req-create`, `/req-finalize`).
- Bulk-renaming existing `REQ-` files/IDs, renaming the `linked_requirements` frontmatter field (roadmap lifecycle + `roadmap-create`), and un-archiving — the migration task.
- Any change under `~/.claude/` — do **not** touch the installed `~/.claude/skills/req-*` copies and do **not** run `install-global.sh`; the installer-prune task (TASK-0122) removes stale installed skills.
- Adding `prd-assess`, `prd-deprecate`, or removing `archive/` from the requirements family.

**Design decisions (made here; do not re-ask)**:

1. **Only the `PRD-` prefix is new.** New files: `id: PRD-NNNN`, `aliases: [PRD-NNNN]`, H1 `# PRD-NNNN: <Title>`, filename `wiki/work/requirements/PRD-NNNN-slug.md`, log op `prd-create | PRD-NNNN <title>` / `prd-approved | PRD-NNNN <title>`. The frontmatter `type: requirement` line and the section names (`## Linked Decisions`, etc.) are unchanged — the family name stays "requirements".
2. **ID resolution keeps `REQ-` working.** In `ID-RESOLUTION.md` the requirements family row's prefix becomes `PRD`; its Notes cell records that the legacy prefix `REQ` is also tried, **after** `PRD` (mask order: `PRD-<pad4>-*`, `PRD-<pad3>-*`, `REQ-<pad4>-*`, `REQ-<pad3>-*`). Numbers are parsed as integers, so a `REQ-0003` input also resolves to a post-migration `PRD-0003-*.md` file (the migration preserves the number and keeps `REQ-0003` in `aliases:`). Use the Notes column, not a new table column, so any test that parses the table columns keeps working — re-read `test/shared-id-resolution.test.js` before editing to confirm.
3. **Number allocation counts both prefixes.** `SKILL-BOILERPLATE.md` § Number allocation's requirements row becomes prefix `PRD-` with a Notes entry: "also count legacy `REQ-` filenames until migrated, so a number is never reused (the migration keeps numbers)". `prd-create`'s allocation pointer states the same parameters.
4. **Roadmap `linked_requirements` and `req-extract-decisions`/`req-retire` wording that says `REQ-NNNN` is deliberately left** — those move with the migration and their own renames. The residue test therefore checks only the three renamed skill names plus the new-item wording in named files, never a blanket `REQ-` ban.

**Source-of-truth note**: edit `lib/skills/`, never `~/.claude/skills/`.

**Reference inventory** (Serena sweep at task-creation time; re-run in Step 8 because TASK-0115 and concurrent tasks add and remove hits):

| Area | Files |
|------|-------|
| Skills being renamed | `lib/skills/req-create/SKILL.md` (name L1; redirection rule L65 names `/req-finalize`; allocation pointer L35 with `REQ-NNNN`, `REQ-0004-…` example, `REQ-` prefix; frontmatter template L79-80 `id: REQ-NNNN` / `aliases: [REQ-NNNN]`; section list L92 `# REQ-NNNN:`; index format + log line L97; cross-link line L100; memory hint L103; summary/next-step L106), `lib/skills/req-finalize/SKILL.md` (name L1, immutability paragraph L17 names `/req-create` + `/req-retire`, worked example L81 `REQ-003-search.md`, ID row L177 `[REQ-NNNN](requirements/NNN-slug.md)`, log line L188 `req-approved | REQ-NNNN`, stop message L163, next-steps row L218 `/task-create --req REQ-NNNN`), `lib/skills/req-compile/SKILL.md` (name L1, description L5 "REQ file", H1 L15, input L24, gate L46 names `/req-finalize`, resolution wiring L44 `REQ-NNNN-slug.md`) |
| Other skills (renamed-name mentions only) | `lib/skills/req-retire/SKILL.md` L16 (`/req-create`), `lib/skills/req-extract-decisions/SKILL.md` L42-43 (`/req-finalize`, `/req-create`), `lib/skills/wiki-query/SKILL.md` L92 (`/req-create`); `lib/skills/wiki-lint/SKILL.md` L57 and L115 (work-family ID pattern lists `REQ-NNNN` — add `PRD-NNNN`, keep `REQ-NNNN` for unmigrated files) |
| Shared docs | `lib/skills/_shared/ID-RESOLUTION.md` (family table L29, worked example L103, caller-deltas rows L122-123, plus the accepted-forms/mask wording that mentions a single `PREFIX`), `lib/skills/_shared/SKILL-BOILERPLATE.md` (allocation table L47) |
| Skill index | `lib/skills/README.md` rows L21, L22, L24 and the directory-name invariant example L144 (`lib/skills/req-create/` → `/req-create`) |
| Lifecycle / conventions | `wiki/work/requirements/lifecycle.md` and template copy `lib/scripts/templates/wiki/work/requirements/lifecycle.md` (L7 ID scheme + filename, L15 `id` row, L24 `/req-create` + `/req-retire` sentence, L31-32 status bullets); `wiki/conventions.md` and template copy `lib/scripts/templates/wiki/conventions.md` (L23 family ID list, L31 `implements::[[REQ-012]]` example, L48 `id` row); `lib/scripts/templates/wiki/work/requirements/index.md` L9 entry format and the local `wiki/work/requirements/index.md` entry-format line; `lib/scripts/templates/wiki/work/roadmaps/lifecycle.md` L20 (`linked_requirements` → wording only: "`PRD-NNNN` (or legacy `REQ-NNNN`) back-links"; **field name unchanged**) |
| Schema docs | `CLAUDE.md` Custom Commands rows L108, L109, L111; the `wiki/work/requirements/` bullet and the requirements-lifecycle Key Files line; the duplicated `## LLM Wiki` bullet; `lib/scripts/templates/CLAUDE-wiki.md` L21 and the L62 typed-link example; `lib/scripts/templates/wiki/index.md` L40 (`Requirements — REQ-NNNN`) and the matching line in local `wiki/index.md` if present (do not touch historical page summaries there); `lib/prompts/migrate-wiki.md` L39-40 (legacy `.docs/prd/` files are migrated into `wiki/work/requirements/`; they should now be named `PRD-NNN-slug.md` with `id: PRD-NNN`) |
| README | root `README.md` and `lib/scripts/README.md`, `lib/hooks/README.md`: no hits at inventory time — confirm in Step 8 |
| Tests | `test/skill-frontmatter-aliases.test.js` (L40 const, L68-73), `test/skill-boilerplate.test.js` (L67 `ALLOCATION_CONSUMERS`, L71-72 `HYGIENE_CONSUMERS`, L166 stale-width regex list), `test/wiki-work-naming-convention.test.js` (L67-75, L95, L119-120, L131 — the `REQ-NNN(?!N)` regexes), `test/shared-id-resolution.test.js` (L44-45 `WIRED_SKILLS`, L65-67 `HAS_ARGUMENT_HINT`, L138-139 expected-scope map), `test/wiki-lint-typed-link-resolution.test.js` L123 (work-family list), `test/backfill-wiki-aliases.test.js` L245 (fixture using a `REQ-900` file — must keep passing; it proves legacy `REQ-` files still get aliases) |
| Memory / knowledge (non-historical) | `.serena/memories/workflow/prd-layer.md` (L5, L14, L15, L19), `.serena/memories/project/overview.md` L53, `.serena/memories/skills/format-and-model-selection.md` (L25 planning list, L26 executing list, L35 model table); `wiki/knowledge/concepts/wiki-work-family-cross-linking-gaps.md` L16, `wiki/knowledge/concepts/wiki-work-filename-convention.md` L17, `wiki/knowledge/concepts/skill-family-rename-pattern.md` L19, `wiki/knowledge/entities/tools/claude-code-plugin-marketplace.md` L15 |
| Open work items pointing at old live paths | non-terminal tasks/UATs whose steps read or invoke the skills: `TASK-0085`/`UAT-0085` (`lib/skills/req-create/SKILL.md`), `TASK-0099`/`UAT-0099` (consumer lists), and any `TASK-0115`/`UAT-0115` step that reads `lib/skills/req-finalize/SKILL.md` or `req-create/SKILL.md` — update **live paths and invocations only** so tackle/uat-walk still resolves |

**Retained on purpose (not residue)**:

- **Task-slug-derived and work-item names**: item `title:` frontmatter, H1s, family-index lines, roadmap `[[TASK-NNNN: …]]` link text, and every terminal (`done`/`passed`/`skipped`/`trashed`) work-item body — names of past work.
- **`req-retire` and `req-extract-decisions`** by name, and every `REQ-NNNN` / `Source REQ:` string inside them (separate tasks). `wiki/work/roadmaps/*` `linked_requirements` (migration).
- **Historical records — never edited**: `wiki/log.md` and rotated logs, `raw/**`, every `**/archive/**` file, `wiki/knowledge/sources/**`, `wiki/hot.md`, `wiki/index.md` page summaries, `.docs/**` dated audit reports, and the family `index.md` files under `wiki/work/`.
- **`lib/skills/demo/SKILL.md`'s `REQ-01:` example** — unrelated checklist numbering.

**Residue-sweep test design**: a new zero-dependency `node:test` file `test/prd-rename-residue.test.js` that walks the repo itself (no `git grep`), skips `node_modules/`, `.git/`, `raw/`, `.docs/`, `**/archive/**`, `wiki/log*.md`, `wiki/hot.md`, `wiki/index.md`, `wiki/knowledge/sources/**`, every `wiki/work/*/index.md`, every `TASK-*`/`UAT-*`/`ROADMAP-*`/`BUG-*`/`DEC-*`/`REQ-*` item file under `wiki/work/`, and the test file itself, then asserts:

- (a) no case-insensitive `req-create`, `req-finalize`, or `req-compile` remains in `lib/**`, `test/**`, `README.md`, `CLAUDE.md`, `.serena/memories/**`, `wiki/knowledge/{concepts,entities}/**`, `wiki/conventions.md`, and `wiki/work/*/lifecycle.md`; `req-retire` and `req-extract-decisions` are **not** matched (assert the regex is anchored so they pass);
- (b) the literal live-path forms `lib/skills/req-create`, `lib/skills/req-finalize`, `lib/skills/req-compile` (and `skills/req-…`) appear in no non-archive `wiki/work/**` item file whose `status:` is not terminal;
- (c) `lib/skills/req-create/`, `req-finalize/`, `req-compile/` do not exist, and `lib/skills/prd-create/`, `prd-finalize/`, `prd-compile/` each have a `SKILL.md` whose frontmatter `name:` equals its directory name;
- (d) new-item wording: `prd-create/SKILL.md` contains `PRD-NNNN-slug.md`, `id: PRD-NNNN`, and `aliases: [PRD-NNNN]` and no `REQ-NNNN`; both `requirements/lifecycle.md` copies state ID scheme `PRD-NNNN` and are byte-identical apart from the front-matter `updated:`/link-relative differences the existing lockstep tests already tolerate (reuse that helper if one exists, else assert the ID-scheme line only); `ID-RESOLUTION.md`'s requirements row has prefix `PRD` and mentions the legacy `REQ` fallback; `SKILL-BOILERPLATE.md`'s requirements row has prefix `PRD-`;
- (e) every failing assertion message lists the offending `path:line` pairs.

## Steps

### 1. Rename the three skill directories and their own text  <!-- agent: general-purpose -->

- [x] Confirm all three directories are git-tracked (`git ls-files lib/skills/req-create lib/skills/req-finalize lib/skills/req-compile`); they should be (they show as modified in `git status`). Re-read each `SKILL.md` first — TASK-0115 and concurrent tasks edit them
- [x] `git mv lib/skills/req-create lib/skills/prd-create`, `git mv lib/skills/req-finalize lib/skills/prd-finalize`, `git mv lib/skills/req-compile lib/skills/prd-compile` (plain `mv` only for a directory that turns out to be untracked); confirm each new `SKILL.md` exists and each old directory is gone (Serena `list_dir lib/skills`)
- [x] In each new `SKILL.md`: frontmatter `name:` → new name; `description:` and the H1 (`# req-compile` → `# prd-compile`) wherever they name the skill or say "REQ file"/"requirement (REQ)" → "PRD"; `argument-hint:` where it shows `REQ-NNNN-slug` → `PRD-NNNN-slug` (legacy `REQ-` inputs still resolve through ID-RESOLUTION, so no legacy mention is needed in the hint). Replace every self-reference and sibling reference to `/req-create`, `/req-finalize`, `/req-compile` in the body with `/prd-…`. Leave `/req-retire` and `/req-extract-decisions` mentions untouched (other tasks)
- [x] Use Serena `search_for_pattern` for `req-create|req-finalize|req-compile` within `lib/skills/prd-create`, `prd-finalize`, `prd-compile` and confirm zero hits

<!-- Updated: 2026-09-19 Step 1 done -->


### 2. Switch new-item identifiers to PRD-NNNN inside the three skills  <!-- agent: general-purpose -->

- [x] `prd-create/SKILL.md`: filename/path `wiki/work/requirements/REQ-NNNN-slug.md` → `PRD-NNNN-slug.md` (L35, L75, L106); allocation pointer → `(family: wiki/work/requirements/, prefix: PRD-, no index scan; also count legacy REQ- filenames)` per design decision 3; slug example `REQ-0004-self-serve-billing-portal.md` → `PRD-0004-…`; frontmatter template `id: PRD-NNNN` / `aliases: [PRD-NNNN]`; H1 template `# PRD-NNNN: <Title>`; index-entry format `- [PRD-NNNN — Title](PRD-NNNN-slug.md) — one-line summary · status`, "ascending REQ order" → "ascending ID order"; log line `## [YYYY-MM-DD] prd-create | PRD-NNNN <title>`; cross-link and memory-hint `REQ-NNNN` → `PRD-NNNN`; "Create a **Requirement** (REQ)" → "Create a **PRD**" (keep "requirement" as an ordinary noun where it reads naturally). Keep the Step 5a re-verify guard, the `type: requirement` line, and every section name intact (tests pin them)
- [x] `prd-finalize/SKILL.md`: worked example `REQ-003-search.md` → `PRD-0003-search.md`; ID-row link `[PRD-NNNN](requirements/PRD-NNNN-slug.md)` (fixing the old `NNN-slug` placeholder); log line `## [YYYY-MM-DD] prd-approved | PRD-NNNN <title>`; next-steps row and stop message use `/prd-finalize`; `/task-create --req REQ-NNNN` → `--req PRD-NNNN` (confirm what `task-create` actually supports for `--req` first; if the flag is documented nowhere, keep the text as a suggestion with the new ID rather than inventing behavior)
- [x] `prd-compile/SKILL.md`: L5 description "requirements/ REQ file" → "PRD file"; L24 input `wiki/work/requirements/PRD-NNNN-slug.md` (PRD); L44 `empty:` clause `PRD-NNNN-slug.md`; the gate message names `/prd-finalize`. Nothing else in this skill changes
- [x] Re-run the Step 1 zero-hit search plus `REQ-NNNN` within `prd-create`, `prd-finalize`, `prd-compile`; the only allowed hit is the legacy-`REQ-` allocation clause in `prd-create` (decision 3) — reword it as "legacy `REQ` filenames" if the test in Step 7(d) needs a clean `REQ-NNNN` assertion

### 3. Update cross-skill references  <!-- agent: general-purpose -->

- [x] `lib/skills/req-retire/SKILL.md` L16: `/req-create` → `/prd-create` (only that mention; nothing else in the file)
- [x] `lib/skills/req-extract-decisions/SKILL.md` L42-43: `/req-finalize` → `/prd-finalize`, `/req-create` → `/prd-create` (only these; its own name and `REQ-NNNN` prose stay)
- [x] `lib/skills/wiki-query/SKILL.md` L92: `/req-create` → `/prd-create`
- [x] `lib/skills/wiki-lint/SKILL.md` L57 and L115: add `PRD-NNNN` to the work-family ID lists and keep `REQ-NNNN` (unmigrated files still exist); the L115 target-resolution wording already names the family directory, so no logic change
- [x] Confirm `decision-*`, `roadmap-*`, `task-*`, `power-mode`, `tackle`, `uat-*`, `bug-*` carry no `req-create|req-finalize|req-compile` mention (inventory found none); clear any that TASK-0115 or concurrent work introduced

### 4. Update the shared docs  <!-- agent: general-purpose -->

- [x] `lib/skills/_shared/ID-RESOLUTION.md`: requirements row of the **Family table** → prefix `PRD`, Notes: "new items; legacy prefix `REQ` (files not yet migrated) is also tried, after `PRD` — see Procedure step 4"; Procedure step 4 mask list gains the legacy-prefix fallback for families that declare one (same integer, both widths, `PRD` before `REQ`); the "Full ID or ID-slug" form and the CRITICAL "Both widths" rule mention that a declared legacy prefix is accepted as input; worked-examples row for requirements (L103) → `3` tries `PRD-0003-*.md`, `PRD-003-*.md`, `REQ-0003-*.md`, `REQ-003-*.md`, and add one row `REQ-0003` (legacy input) → resolves to `PRD-0003-*` after migration or `REQ-0003-*` before. Caller-deltas rows L122-123: `req-finalize` → `prd-finalize`, `req-compile` → `prd-compile`; leave `req-retire` and `req-extract-decisions` in their row. Keep every other family row untouched (TASK-0117 edits the decisions row after this task)
- [x] `lib/skills/_shared/SKILL-BOILERPLATE.md`: requirements row → prefix `PRD-`, Notes per design decision 3 (also count legacy `REQ-` filenames)
- [x] Check whether `SKILL-BOILERPLATE.md` or `ID-RESOLUTION.md` carry any other requirements-family statement (Edit hygiene consumer list, Prereqs line) that names the three renamed skills and fix it

### 5. Update lifecycle, conventions, templates, and repo docs  <!-- agent: general-purpose -->

- [x] `wiki/work/requirements/lifecycle.md` and the template copy `lib/scripts/templates/wiki/work/requirements/lifecycle.md` (keep the two in lockstep — template files are always-refreshed): L7 "ID scheme: **PRD-NNNN** (4-digit, zero-padded, globally unique). Filename: `PRD-NNNN-slug.md`." plus one sentence: existing `REQ-NNNN` files keep their names until the `npx … update` migration renames them (old ID kept in `aliases:`); L15 `id` row `PRD-NNNN` (legacy `REQ-NNNN`); L24 `/req-create` → `/prd-create` (the `/req-retire` half of that sentence stays, another task renames it); L31-32 `/req-create` → `/prd-create`, `/req-finalize` → `/prd-finalize`; bump the local file's `updated:` date
- [x] `wiki/conventions.md` and template `lib/scripts/templates/wiki/conventions.md`: the work-family ID list gets `PRD-NNNN` in place of `REQ-NNNN`; the L31 typed-link example becomes `implements::[[PRD-012]]`; the L48 `id` row lists `PRD-`. Both copies stay identical in these lines
- [x] `lib/scripts/templates/wiki/work/requirements/index.md` L9 and the local `wiki/work/requirements/index.md` entry-format line → `PRD-NNNN`; `lib/scripts/templates/wiki/work/roadmaps/lifecycle.md` L20 wording per the inventory row (field name `linked_requirements` unchanged) and the same edit in local `wiki/work/roadmaps/lifecycle.md`
- [x] `lib/scripts/templates/CLAUDE-wiki.md` L21 and L62, `lib/scripts/templates/wiki/index.md` L40, and the matching line in local `wiki/index.md`: `REQ-NNNN` → `PRD-NNNN`; `lib/prompts/migrate-wiki.md` L39-40: mapping targets `wiki/work/requirements/PRD-NNN-slug.md`, and confirm nothing else in that prompt assigns `REQ-` IDs
- [x] `CLAUDE.md`: Custom Commands rows `/req-create <idea>` → `/prd-create <idea>`, `/req-finalize <file>` → `/prd-finalize <file>`, `/req-compile <file>` → `/prd-compile <file>` (row text otherwise unchanged; leave the `/req-retire` and `/req-extract-decisions` rows); the `wiki/work/requirements/` bullet and the requirements-lifecycle Key Files line and the duplicated `## LLM Wiki` bullet → `PRD-NNNN`. Do not add rows for skills other tasks create
- [x] `lib/skills/README.md`: table rows for the three skills (new names; the `prd-create` description says `PRD-NNNN` instead of `REQ-NNNN`), and the directory-name invariant example → `lib/skills/prd-create/` → `/prd-create`. Keep the table's existing ordering rule
- [x] Confirm `README.md`, `lib/scripts/README.md`, `lib/hooks/README.md`, and `lib/scripts/**` scripts (including `backfill-wiki-aliases`, `sync-wiki-scaffold.sh`, the dashboard server/html) carry no live `req-create|req-finalize|req-compile` or new-item `REQ-` assumption; fix any that TASK-0115 or concurrent work introduced. Confirm `backfill-wiki-aliases` still derives aliases for both `PRD-` and legacy `REQ-` files (its test has a `REQ-900` fixture)

### 6. Update the existing tests (contents only; filenames retained)  <!-- agent: general-purpose -->

- [x] `test/skill-frontmatter-aliases.test.js`: const `REQ_CREATE_SKILL` → `PRD_CREATE_SKILL` with path `lib/skills/prd-create/SKILL.md`; L68-73 title, regex (`/id: PRD-NNN\naliases: \[PRD-NNN\]\ntype: requirement/`) and message
- [x] `test/skill-boilerplate.test.js`: replace only the `'req-create'` and `'req-finalize'` entries in `ALLOCATION_CONSUMERS` and `HYGIENE_CONSUMERS` with `'prd-create'`/`'prd-finalize'` (re-read both arrays immediately before editing — TASK-0115 and TASK-0117 edit sibling entries); L166 stale-width regex list: keep the `REQ-NNN(?!N)` entry only if legacy prose still contains it, otherwise switch to `PRD-NNN(?!N)`, and keep the assertion meaningful
- [x] `test/wiki-work-naming-convention.test.js`: L67-75 EDGE-005 comment, title, path (`lib/skills/prd-create/SKILL.md`), and the two regexes (`wiki\/work\/requirements\/PRD-NNNN-slug\.md`, the `PRD-NNNN` index-entry regex); L95 lifecycle regex → `PRD-NNNN\*\* \(4-digit, zero-padded, globally unique\)`; L119-120 and L131 stale-width regexes — add `PRD-NNN(?!N)` alongside `REQ-NNN(?!N)` rather than dropping the legacy guard
- [x] `test/shared-id-resolution.test.js`: `WIRED_SKILLS` names, the `HAS_ARGUMENT_HINT` filter and its comment, and the expected-scope map (`'prd-finalize'`, `'prd-compile'`); add assertions that the requirements family row declares prefix `PRD` with the legacy `REQ` fallback and that the worked-examples table contains a legacy `REQ-0003` row
- [x] `test/wiki-lint-typed-link-resolution.test.js` L123: add `'PRD-NNNN'` to the asserted work-family list (keep `'REQ-NNNN'`); `test/backfill-wiki-aliases.test.js`: no edit expected — run it to confirm
- [x] Run `node --test test/skill-frontmatter-aliases.test.js test/skill-boilerplate.test.js test/wiki-work-naming-convention.test.js test/shared-id-resolution.test.js test/wiki-lint-typed-link-resolution.test.js test/backfill-wiki-aliases.test.js` and confirm every file passes; a pre-existing failure caused by another in-flight task is reported, not fixed here

### 7. Update memory, knowledge pages, and open work items  <!-- agent: general-purpose -->

- [x] `.serena/memories/workflow/prd-layer.md` (pipeline line and the three command-table rows: `/prd-create`, `/prd-finalize`, `/prd-compile`; its new-item ID mention → `PRD-NNNN`), `.serena/memories/project/overview.md` L53 pipeline, `.serena/memories/skills/format-and-model-selection.md` (rename the three in the planning list, executing list, and the model table). Edit with Serena memory tools or Read/Edit; leave `req-retire` and `req-extract-decisions` mentions
- [x] `wiki/knowledge/concepts/wiki-work-family-cross-linking-gaps.md` L16, `wiki/knowledge/entities/tools/claude-code-plugin-marketplace.md` L15: `/req-create` and the `req-create → req-finalize` pipeline → `prd-…`. `wiki/knowledge/concepts/wiki-work-filename-convention.md` L17 and `wiki/knowledge/concepts/skill-family-rename-pattern.md` L19 narrate past events: reword so the literal old names do not appear (for example "the requirements-creation skill") — same rule TASK-0114 applied
- [x] Open work items from the inventory (`TASK-0085`, `UAT-0085`, `TASK-0099`, `UAT-0099`, and any `TASK-0115`/`UAT-0115` step that reads a renamed skill path): re-read, then update **only** live-path/invocation forms and consumer lists (`lib/skills/req-create/…` → `lib/skills/prd-create/…`, `` `Skill` `req-…` ``, `~/.claude/skills/req-…`). Leave `title:`, H1, family-index lines, roadmap link text, and every verdict/history line (for example UAT-0097's recorded FAIL text). Do not change any `status:`
- [x] Do **not** touch `wiki/log.md`, `raw/**`, `**/archive/**`, `wiki/knowledge/sources/**`, `wiki/hot.md`, `.docs/**`, family `index.md` files (except the requirements entry-format line in Step 5), or `~/.claude/skills/**`

### 8. Residue sweep and residue test  <!-- agent: general-purpose -->

- [x] Re-run the sweep with Serena `search_for_pattern` (`req-create|req-finalize|req-compile|Req-create|Req-finalize|Req-compile`) over `.` (exclude `raw/**`, `wiki/log*.md`, `node_modules`, `.git`, `**/archive/**`) and reconcile every remaining hit against the retained/historical lists above; fix any live hit missed at inventory time
- [x] Create `test/prd-rename-residue.test.js` per the "Residue-sweep test design": zero-dependency `node:test` + `node:assert/strict`, own recursive walker with the skip list and terminal-status filter for scope (b), assertions (a)-(e). Model the structure on `test/bug-create-rename-residue.test.js` (TASK-0114) for consistency
- [x] Run `node --test test/prd-rename-residue.test.js`, then the full suite `npm test`; confirm no new failures attributable to this task (report pre-existing failures from in-flight tasks, do not fix them)
- [x] Confirm `git status` shows the three skill directories as renames (`R lib/skills/req-create/SKILL.md -> lib/skills/prd-create/SKILL.md`, and likewise for `req-finalize`, `req-compile`), that no existing `REQ-` file or ID was renamed, that `wiki/work/requirements/` still exists under that name, and that `~/.claude/skills/` was not touched
