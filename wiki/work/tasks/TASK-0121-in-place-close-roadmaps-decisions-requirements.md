---
id: TASK-0121
aliases: [TASK-0121]
title: "Remove archive/ from the roadmaps, decisions and requirements families (in-place close with Active/Closed index sections)"
status: in-progress
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0120, TASK-0097]
blocks: [TASK-0122, TASK-0123]
parallel_safe_with: []
uat: ""
tags: [wiki-conventions, archive, skill-design, roadmap-0014]
---

# TASK-0121 — Remove archive/ from the roadmaps, decisions and requirements families (in-place close with Active/Closed index sections)

depends_on::[[TASK-0120]]
depends_on::[[TASK-0097]]
blocks::[[TASK-0122]]
blocks::[[TASK-0123]]

> **Depends on**: TASK-0120 (Phase 4 chain — file overlap on the same skills/docs), TASK-0097 (landed `lib/skills/_shared/ARCHIVE-WORK-ITEM.md`, whose family scope this task partly reverses)
> **Blocks**: TASK-0122 (installer prune, sequenced after the archive removal), TASK-0123 (migration that un-archives existing `roadmaps/`, `decisions/`, `requirements/` archives — it depends on the final layout defined here)

## Objective

Roadmaps, decisions (ADRs) and requirements (PRDs) are no longer archived. A finished item **stays in its family directory**; each of the three family `index.md` files gains an **Active** section and a **Closed** section (Closed lists finished items with their terminal status). Tasks, UAT and bugs are unchanged and keep `archive/`. This partly reverses TASK-0097's `ARCHIVE-WORK-ITEM.md` scope for the three families: that doc's `family` parameter narrows to `tasks | uat | bugs`, and the three others use a new **in-place close** mechanic documented once in the same file. Existing `archive/` folders in the three families are **not moved** by this task (TASK-0123 un-archives them), so every skill must keep tolerating their presence in the interim.

## Approach

Binding inputs: ROADMAP-0014 Notes, Q&A decisions 5-6 of 2026-09-19 and the Phase 4 sequencing note. Design choices made for this task:

- **One in-place-close mechanic, defined once.** Add a section `## In-place close (roadmaps, decisions, requirements)` to `lib/skills/_shared/ARCHIVE-WORK-ITEM.md` (same doc, so the two "close a work item" mechanics live side by side and consumers already know the path). Steps: (1) verify `terminal_status` against the family `lifecycle.md` and set `status:` + bump `updated:` (skip if already terminal); (2) `Read` `wiki/work/<family>/index.md`, `Edit` to remove the item's row from `## Active` and add it to `## Closed`, in numeric-ID order; (3) append a log entry `## [YYYY-MM-DD] close | <ID> — <terminal_status>, closed in place`. **No `git mv`, no `archive/index.md`.** Consumers supply only `family`, `file`, `terminal_status`, `log`, exactly like the archive procedure. This avoids re-introducing the per-skill duplication ROADMAP-0014 exists to remove.
- **Closed row format = the Active bullet format**, with the terminal status as the trailing `·` segment: `- [ROADMAP-NNNN — Title](ROADMAP-NNNN-slug.md) — one-line summary · done`. Because the file stays put, the link is a real relative link (unlike archive-table `[[ID]]` rows). Requirements: `Active` = `draft`, `approved`; `Closed` = `retired`. Roadmaps: `Active` = `active`; `Closed` = `done`. Decisions: a Decision Group is **Active** while any block is `proposed`; **Closed** once every block is `accepted` or `superseded` (unchanged semantics — only the destination changed); the Closed row's trailing segment is the per-block summary (`D1 accepted, D2 superseded`).
- **Legacy `archive/` tolerance is permanent, not a temporary shim.** Projects that have not yet run the TASK-0123 migration keep archived files in these three families, so `ID-RESOLUTION.md` documents a single rule: for `requirements`/`decisions`/`roadmaps`, `scope: active` searches the family directory and, on zero matches, falls back to `<family>/archive/` if that directory exists (report it as a legacy location). New code never writes there.
- **`sync-wiki-scaffold.sh` needs no code change.** It creates only the six family directories with `mkdir -p` (no `archive/`), and copies `lib/scripts/templates/wiki/` with `rsync --ignore-existing`, so the `archive/` dirs come solely from the template tree. Deleting `lib/scripts/templates/wiki/work/{roadmaps,decisions,requirements}/archive/` stops the scaffolding; existing target `archive/` dirs are untouched (TASK-0123 handles them). Update the script's comments only if they name those dirs, and prove the behavior with a scaffold test.
- **Dashboard must become section-aware.** `lib/scripts/templates/wiki/dashboard.html` `parseIndexMarkdown` treats every bullet in a family `index.md` as active and reads archived items only from `<family>/archive/index.md` (`fetchFamily`, ~line 1012). Once these three indexes carry a `## Closed` section, Closed bullets would render as active. Fix: split the fetched index text at the `## Closed` heading — the part before is `active`, the part after joins `archived`; still fetch `archive/index.md` (404 -> `[]` already tolerated) and concatenate for un-migrated projects. Show the section label as "Closed" (not "Archived") for the three in-place families.

## Steps

### 1. Read the landed state first  <!-- agent: Explore -->

- [x] `Read` `lib/skills/_shared/ARCHIVE-WORK-ITEM.md`, `lib/skills/_shared/ID-RESOLUTION.md`, `wiki/work/tasks/TASK-0097-shared-archive-work-item-reference-doc.md` (+ its UAT under `wiki/work/uat/` if present), and `test/archive-work-item.test.js`, `test/shared-id-resolution.test.js`, `test/wiki-lint-typed-link-resolution.test.js`, `test/wiki-lint-taskless-decisions.test.js`, `test/run-project-sync.test.js` before editing anything — the tests pin exact strings in these docs.
- [x] Confirm the TASK-0119/TASK-0120 outputs exist and note the final skill directory names (`prd-*`, `adr-*`, `prd-deprecate`, `adr-deprecate`). If a Phase 4 rename has not landed yet, edit the old-named directory (`req-retire`, `decision-finalize`, ...); use `find_file` to locate each.

### 2. Shared docs: ARCHIVE-WORK-ITEM.md and ID-RESOLUTION.md  <!-- agent: general-purpose -->

- [x] `lib/skills/_shared/ARCHIVE-WORK-ITEM.md`
  - Intro paragraph + `## Inputs` `family` row: restrict to `tasks`, `uat`, `bugs`; add one sentence pointing roadmaps/decisions/requirements at the new in-place-close section.
  - `## Caller deltas` table: delete the `roadmap-next` row; change the `wiki-archive` row `family` from `any` to `tasks`, `uat` or `bugs`.
  - Delete the `req-retire` / `decision-finalize Step 6.5` mention from `## Other consumers (not yet wired)`; keep `uat-skip` and `UAT-CORE.md` there (their task/UAT archiving is unchanged) but note their roadmap-completion step now uses in-place close.
  - Add `## In-place close (roadmaps, decisions, requirements)` per the Approach (procedure, row format, log entry, a `Caller deltas` table: `roadmap-next` / `roadmap-assess` -> `roadmaps`, `done`; `prd-deprecate` -> `requirements`, `retired`; `adr-deprecate` and `adr-finalize` (group fully terminal) -> `decisions`; `uat-skip` and `UAT-CORE.md` roadmap-completion step -> `roadmaps`, `done`), and CRITICAL rules: never `git mv` these families; never create `archive/`; the only content edit is the `status:`/`updated:` flip.
  - Update `## CRITICAL rules`: "`archive/` already exists in every family" -> "in `tasks`, `uat`, `bugs`".
- [x] `lib/skills/_shared/ID-RESOLUTION.md`
  - `## Family table` closing sentence (line ~37): terminal items live in `archive/` for `tasks`/`uat`/`bugs` only; the other three keep finished items in place.
  - `## Search scope`: state that `active+archive` and `active-then-archive-gate` are valid only for `tasks`/`uat`/`bugs`; add the permanent legacy-fallback rule for the three in-place families (see Approach).
  - `## Caller deltas`: `bug-close` and `task-close` rows unchanged; add the legacy-fallback note to the requirements/decisions/roadmaps rows. TASK-0116/0117 change the masks to try `PRD-`/`ADR-` then legacy `REQ-`/`DEC-`; the legacy-archive fallback composes with that (same masks, extra directory) — re-`Read` the doc first and word the rule against whatever is on disk. TASK-0119 adds `deprecated` to the decisions terminal set (Closed rows may carry it). Leave the `DEC-0001#D2` worked example intact (the file is still under `decisions/archive/` until TASK-0123 moves it; TASK-0123 updates the example and its test).

### 3. Roadmap skills  <!-- agent: general-purpose -->

- [x] `lib/skills/roadmap-next/SKILL.md`
  - Frontmatter `description` (`... auto-archive when fully checked` -> `... auto-close when fully checked`) and the goal sentence at ~line 14 (`move it to archive/` -> `set done and move its index row to Closed`).
  - The "Archive a fully-complete roadmap" procedure (referenced by roadmap-assess): rename to **Close a fully-complete roadmap**; body = follow the in-place-close section of ARCHIVE-WORK-ITEM.md with `family: roadmaps`, `terminal_status: done`. Report line at ~line 67 becomes `Status -> done. Moved to Closed in wiki/work/roadmaps/index.md.` Remove every `git mv` / `archive/index.md` mention. Keep the `task_path` note (`find_file TASK-NNNN-*` matching active or archived tasks) — tasks still archive.
- [x] `lib/skills/roadmap-assess/SKILL.md`
  - Step 3 (`Auto-archive fully-complete roadmaps`, ~lines 32-36): rename to auto-close; point at the renamed roadmap-next procedure; `archived` variable -> `closed`; the STOP message (`All roadmaps complete — closed: <list>. Nothing active to assess.`); section `6a` (`Archived this run`, ~lines 80-83) -> `Closed this run` with the text `Moved to Closed in wiki/work/roadmaps/index.md (fully complete):`; the read-only caveat at ~line 145 (`status flip + git mv + index/log updates` -> `status flip + index/log updates`).
  - Line ~20: `list_dir wiki/work/roadmaps/ for .md files directly in it (not archive/)` -> still direct-only, but note that `done` roadmaps stay in the directory: filter by `status: active` in frontmatter so closed roadmaps are skipped (this is a behavior change — previously they were physically absent). Also tolerate a legacy `archive/` directory (ignore it).
  - Line ~44 (decision lookup: "check archive/ too if not found active"): keep as legacy tolerance, reworded to reference the ID-RESOLUTION legacy-fallback rule.
- [x] `lib/skills/uat-skip/SKILL.md` step 5 (~lines 120-122) and `lib/skills/uat-walk/UAT-CORE.md` roadmap auto-checkoff (~line 153; confirm whether it also archives a completed roadmap) — replace the `git mv` + `archive/index.md` roadmap steps with the in-place close pointer (`family: roadmaps`, `terminal_status: done`). Their task/UAT archive steps stay as they are.
- [x] `lib/skills/roadmap-create/SKILL.md`: the family-index append (new roadmap row) goes under `## Active`; update any "Active Items" wording.
- [x] `lib/skills/tackle/SKILL.md` (~lines 37, 49): it lists `wiki/work/roadmaps/` for the roadmap checkoff — confirm it does not assume finished roadmaps are absent (filter on `status:`), and that the index note (`index.md carries no progress columns`) still reads correctly with two sections.

### 4. Decisions and requirements skills  <!-- agent: general-purpose -->

- [x] ADR skills (`adr-finalize`, `adr-create`, `adr-walkthrough`, `adr-next`; currently `decision-*` if the rename has not landed): `adr-finalize` Step 6.5 (`Family index + archive if fully terminal`, ~lines 127-134) becomes `Family index: Closed if fully terminal` — when no block is `proposed`, follow the in-place-close section with `family: decisions` (index-row move only, no `git mv`, no `archive/index.md` row), then fix the closing summary at ~line 161 (`note the file moved to archive/` -> `note the group moved to Closed`). Supersession handling (cross-group `superseded` flips) edits the superseded block **in place** wherever the file lives — never moves it. `adr-create`: new group row goes under `## Active` of `wiki/work/decisions/index.md`. `adr-next` / `adr-walkthrough`: scan the family directory by `status`, not by directory, so Closed groups are still visible where needed; keep tolerating a legacy `decisions/archive/`.
- [x] PRD skills (`prd-deprecate`, `prd-finalize`, `prd-create`, `prd-compile`, `prd-update`-successors; currently `req-*`): `prd-deprecate` (from TASK-0119 — verify what it already does) flips `status: retired`, documents the reason, and moves the index row Active -> Closed via the in-place-close section; remove its `git mv`/`archive/` steps and the `archive/` paths in its summary table (currently `req-retire` lines ~14, 101-113, 148, 172). `prd-create`/`prd-finalize`: row goes under `## Active`; `prd-compile` / `demo` (`demo/SKILL.md` line ~41 reads "every non-retired PRD") — confirm they filter by `status` rather than by directory.
- [x] `adr-deprecate` (from TASK-0119): same in-place close with `family: decisions`, per-block status flip (`superseded`/deprecated as defined by TASK-0119's lifecycle wording) — align with the shared doc, no file move.

### 5. wiki-archive, wiki-tidy, wiki-lint, wiki-rotate-log  <!-- agent: general-purpose -->

- [x] `lib/skills/wiki-archive/SKILL.md`: description, blockquote, `Step 1` ("scan all 6 families"), `Step 2` scan, `Step 3/4` text -> three families (`tasks`, `uat`, `bugs`) only; `[family]` argument validation: given `roadmaps|decisions|requirements`, report `Roadmaps, decisions and requirements are closed in place (Closed section of the family index) — nothing to archive.` and STOP. Extend the sweep with a **stray-archive note**: if `wiki/work/<in-place-family>/archive/` still exists and is non-empty, report `run npx @codewizard-dt/bootstrap update to migrate` rather than moving anything.
- [x] `lib/skills/wiki-tidy/SKILL.md`: description, Phase 2 wording (~lines 2, 10, 31, 38-67), the `wiki-tidy — N items archived across K families` log line and the "Never edit archived file content" rule (~line 104) -> tasks/uat/bugs only. Wiki-tidy must keep referencing `/wiki-archive` (do not re-embed; TASK-0096 rewrites that phase — coordinate by keeping edits minimal wording changes, and if TASK-0096 has landed edit the pointer text only).
- [x] `lib/skills/wiki-lint/SKILL.md`: stranded-terminal-file check (~lines 30-39) — restrict to `tasks`, `uat`, `bugs` (terminal files in the other three families are correct where they are); the family-index consistency check (~line 46) — for the three in-place families verify each file appears in the right section (`## Active` for active statuses, `## Closed` for terminal ones) and is absent from the wrong one, and flag a leftover non-empty `archive/` as `[MEDIUM] un-migrated archive/` (informational, points at `npx @codewizard-dt/bootstrap update`); typed-link and decision-target resolution checks (~lines 114-115, 124) keep searching `archive/` (legacy tolerance) — reword only where they now claim `archive/` is a normal location for the three families.
- [x] `lib/skills/wiki-rotate-log/SKILL.md` (~line 61 operations list): add the `close` operation next to `archive`.

### 6. Lifecycle docs, index templates, scaffold  <!-- agent: general-purpose -->

Each lifecycle doc exists twice — the template copy under `lib/scripts/templates/wiki/work/<family>/lifecycle.md` (source of truth, always-refreshed into target projects) and this repo's local `wiki/work/<family>/lifecycle.md` (kept identical). Edit both for `roadmaps`, `decisions`, `requirements`.

- [x] Lifecycle wording: replace the sentence `Terminal items ... may be moved to archive/ by /wiki-archive` with `Finished items are never moved — a terminal item stays in place and is listed under **Closed** in index.md`; `requirements`: `retired` "moved to archive/" wording; `decisions`: the "fully terminal group is archived" wording; update the frontmatter `updated:` date. Do not change status enums or transitions.
- [x] Index templates `lib/scripts/templates/wiki/work/{roadmaps,decisions,requirements}/index.md`: restructure to `# <Family>` -> `## Active` (entry-format line + `_(none yet)_`) -> `## Closed` (entry-format line incl. the trailing terminal status + `_(none yet)_`); rewrite the intro ("When X completes, move its line from Active to Closed — the file itself never moves").
- [x] Delete `lib/scripts/templates/wiki/work/{roadmaps,decisions,requirements}/archive/` (each holds only `index.md`). Leave `tasks/`, `uat/`, `bugs/` `archive/` templates intact.
- [x] This repo's own `wiki/work/{roadmaps,decisions,requirements}/index.md`: restructure headings only (Active/Closed; keep existing rows under Active, empty Closed `_(none yet)_`). **Do not** move any archived file or fold any `archive/index.md` — that is TASK-0123. Do not delete this repo's own `wiki/work/{...}/archive/` directories.
- [x] `lib/scripts/sync-wiki-scaffold.sh`: no functional change expected (see Approach); read lines 29-68 and update only comments naming those `archive/` dirs, if any.
- [x] `lib/scripts/templates/wiki/dashboard.html`: section-aware `parseIndexMarkdown`/`fetchFamily` (see Approach); "Closed" label for the three families; keep the archive-table branch working. `lib/scripts/wiki-dashboard-server.js` has no archive handling — confirm and leave it.
- [x] `lib/scripts/backfill-wiki-aliases.js`: it already walks each family directory recursively (active + `archive/`); leave as is (legacy tolerance), only touch its comment if it claims `archive/` exists in every family.

### 7. Prose: README / CLAUDE.md / skills README / templates  <!-- agent: general-purpose -->

- [x] `CLAUDE.md` (root, the `wiki/work/` bullet: "an `archive/` subdirectory for terminal items ... Terminal items may be moved to `archive/` by `/wiki-archive`", and the `/wiki-archive`, `/wiki-tidy`, `/roadmap-next`, `/req-retire` rows in both command tables), `README.md`, `lib/skills/README.md` (rows for `wiki-archive`, `wiki-tidy`, `roadmap-next`, `req-retire`/`prd-deprecate`, `roadmap-assess`), `lib/scripts/README.md`, and the delivered schema template `lib/scripts/templates/CLAUDE-wiki.md` (same `wiki/work/` bullet + tables) — reword: tasks, UAT and bugs archive; roadmaps, decisions and requirements close in place (Closed section). Use targeted `Edit`s; do not rewrite tables that other Phase 4 tasks have already renamed — re-`Read` each file immediately before editing.
- [x] `lib/scripts/templates/wiki/conventions.md` and `wiki/conventions.md` (they are kept identical): update any sentence that says every family has `archive/`.

### 8. Tests  <!-- agent: general-purpose -->

- [ ] `test/archive-work-item.test.js`: `WIRED_SKILLS` (line ~38) drops `roadmap-next`; assert `family` lists exactly `tasks`, `uat`, `bugs`; keep the row-format and `wiki-archive` assertions; fix assertions that match removed strings (`roadmap-next` deltas row, the `family: any` wording).
- [ ] `test/shared-id-resolution.test.js`: the roadmap-next row (scope `active`) stays; add assertions for the legacy-fallback sentence and that `active+archive` / `active-then-archive-gate` are consumed only by `tasks`/`bugs` skills (extend the family/scope map at ~lines 146-155); leave the `DEC-0001#D2` `{ archive: true }` case untouched (TASK-0123 owns it).
- [ ] `test/wiki-lint-typed-link-resolution.test.js` and `test/wiki-lint-taskless-decisions.test.js`: keep passing if the legacy-tolerance strings remain; adjust only if wording changed in Step 5.
- [ ] Scaffold test: extend `test/run-project-sync.test.js` (or add a sibling) — scaffold into a temp dir and assert `wiki/work/{roadmaps,decisions,requirements}/archive` do **not** exist while `wiki/work/{tasks,uat,bugs}/archive/index.md` do; assert a pre-existing `wiki/work/decisions/archive/x.md` in the target survives a second scaffold run untouched; assert the three index templates contain both `## Active` and `## Closed`.
- [ ] New contract test `test/in-place-close.test.js` (hermetic `node --test`, same style as `test/archive-work-item.test.js`): (a) `ARCHIVE-WORK-ITEM.md` has the in-place-close section, no `git mv` inside it, `Inputs` restricted to tasks/uat/bugs; (b) `roadmap-next`, `roadmap-assess`, `uat-skip`, `UAT-CORE.md`, `prd-deprecate`, `adr-deprecate`, `adr-finalize` (whichever names exist) contain no `git mv wiki/work/(roadmaps|decisions|requirements)` and no `<family>/archive/index.md` append for those families; (c) `wiki-archive` and `wiki-tidy` mention no `roadmaps`/`decisions`/`requirements` in their family sweep lists; (d) both copies of each of the three `lifecycle.md` are byte-identical and mention `Closed`; (e) the dashboard template contains the `## Closed` split. Also fix `test/wiki-work-naming-convention.test.js` and `test/skill-boilerplate.test.js` only if they break.
- [ ] Run `npm test` and confirm green (no `install-global.sh`, no changes under `~/.claude`).

### 9. Wiki bookkeeping  <!-- agent: general-purpose -->

- [ ] Re-`Read` then `Edit` `wiki/log.md` (append `## [YYYY-MM-DD] task | TASK-0121 done` per repo convention when tackling completes) and update the roadmap checkbox for this task in `wiki/work/roadmaps/ROADMAP-0014-wiki-skill-deduplication-fixes.md` after UAT — no hot-cache refresh from this file's steps.

## Out of scope

- Moving/un-archiving existing archived roadmaps, decisions or requirements, folding their `archive/index.md` files, and the alias/ID migration — TASK-0123 (and TASK-0122's installer prune).
- Renames and new assess/deprecate skills beyond aligning their close mechanics (TASK-0110..0120 own them).
- Any change under `~/.claude/` or running `install-global.sh`.
