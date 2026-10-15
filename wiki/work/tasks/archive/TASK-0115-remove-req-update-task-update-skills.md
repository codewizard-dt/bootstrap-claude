---
id: TASK-0115
aliases: [TASK-0115]
title: "Remove req-update and task-update entirely, with no replacement"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0114]
blocks: []
parallel_safe_with: []
uat: "[[UAT-0115]]"
tags: [req-update, task-update, skill-removal, vocabulary, roadmap-0014-phase-4]
---

# TASK-0115 — Remove req-update and task-update entirely, with no replacement

relates_to::[[wiki-skill-boilerplate-duplication]]
depends_on::[[TASK-0114]]

## Objective

Delete the `req-update` and `task-update` skills and remove every live reference to them, so no `/req-update` or `/task-update` command, table row, cross-reference, wiring line, or pinning test remains. No other `wiki/work/` family has an `update` action; removing these two simplifies the family/action vocabulary instead of extending `update` to every family. ROADMAP-0014 Phase 4, sixth item (decided in the 2026-09-19 Q&A recorded in that roadmap's Notes). This is the last of the six single-skill changes and follows [[TASK-0114]].

## Approach

**Source of truth.** Edit only the repo copies (`lib/skills/**`, `lib/scripts/**`, `test/**`, top-level docs, `wiki/`). Do **not** touch the installed `~/.claude/skills/req-update` / `~/.claude/skills/task-update` copies and do **not** run `install-global.sh`; stale installed skills are pruned by TASK-0122, which must list `req-update` and `task-update` (this task only notes that in the final report).

**Do not touch.** `wiki/log.md` (append-only; its historical `req-updated` / `/task-update` mentions stay), `raw/` (immutable), historical `wiki/knowledge/sources/*` summaries, archived work items (`wiki/work/**/archive/**`), and completed/in-flight task and UAT files that merely mention the skills as history (`TASK-0097`, `TASK-0098`, `TASK-0099`, `TASK-0102`, `UAT-0099`, etc.). The roadmap's own prose (`ROADMAP-0014` Goal/Notes) is the plan and stays as written.

**Names may have changed.** TASK-0110 to TASK-0114 rename `task-audit` to `task-assess`, `task-trash` to `task-close`, `task-add` to `task-create`, `uat-generate` to `uat-create`, and `bug-file` to `bug-create`. Before each edit, re-locate the file and text by searching for `req-update|task-update` rather than trusting the old names or line numbers below (line numbers are from 2026-09-19 and will have drifted). Where this task says `task-audit`, read `task-assess` if the rename has landed, and likewise for the others.

**Replacement wording for removed pointers.** Removal means no replacement command, so the text that used to say "run `/task-update <N>`" must say what to do by hand: "edit the task file's frontmatter directly". Text that said "scope changes go through `/req-update`" must say approved requirements are changed by editing the file directly (the append-only `## Amendment N` convention is retained only in existing requirement files as history; no skill produces it). Supersession stays as: create a new requirement with `/req-create`, then `/req-retire` the old one.

**Pending-UAT trap: TASK-0094.** [[TASK-0094]] ("Strip req-update's inline retire branch and redirect to /req-retire", `status: pending-uat`) and its [[UAT-0094]] exist only to fix and pin a skill this task deletes, so both become moot. Handle them with the normal trash flow (`/task-trash TASK-0094`, which flips both to `trashed`, archives them, removes their index lines, and cleans the ROADMAP-0014 Phase 1 checkbox), recording the reason "superseded by TASK-0115: req-update removed entirely". Re-read `TASK-0094`'s frontmatter first: if a `tackle-0094` or `uat-auto-0094` run is still in flight, wait for it to finish; if UAT-0094 has already passed and both files are already archived/done, skip the trash flow and just note it in the final report. Never leave a `pending` UAT-0094 pointing at a deleted skill.

**Tests: which are deleted and which are trimmed.**

| Test file | Action |
|-----------|--------|
| `test/req-update-retire-redirect.test.js` | **Delete** (`git rm`). It only exists to pin req-update's retire redirect (TASK-0094). |
| `test/skill-boilerplate.test.js` | **Trim**: drop `'req-update'` and `'task-update'` from `HYGIENE_CONSUMERS` (17 to 15); fix any "17 consumers" comment. |
| `test/task-dependency-single-source.test.js` | **Trim**: drop the `TASK_UPDATE` constant and the optional-file filter; `SKILL_FILES` becomes `[TASK_ADD, TASK_AUDIT]` (use the post-rename names present at tackle time); fix header comments naming task-update. |
| `test/task-dependency-fields-content.test.js` | **Trim**: drop the `TASK_UPDATE` constant and the three `task-update ...` tests (Step 3 frontmatter check, Step 5 adds missing keys, leaves other checklist items alone); change the two `/task-update` assertions on task-audit's node record and issues report to match the new "edit the task's frontmatter directly" wording; fix header comment. |
| `test/shared-id-resolution.test.js` | **Trim**: drop `'req-update'` and `'task-update'` from `WIRED_SKILLS` and `EXPECTED_WIRING`; the count test becomes 16 files (15 SKILL.md + UAT-CORE.md) and its title and the "17"/"18" comments are updated. `HAS_ARGUMENT_HINT` derives from `WIRED_SKILLS`, so it needs no separate edit. |
| `test/req-task-update-removed.test.js` | **Create** (small, hermetic): both skill directories are absent; no file under `lib/` (excluding `lib/scripts/install-global.sh`, where TASK-0122 legitimately lists them as orphans), `README.md`, `CLAUDE.md`, or `lib/skills/README.md` contains `req-update` or `task-update`. |

## Steps

<!-- Updated: 2026-09-19 Step 1 done. TASK-0114 is pending-uat (implemented, rename in tree). Extra hits beyond Steps 3-7: lib/skills/req-create/SKILL.md:~93 (empty `## Amendments` template section), lib/scripts/templates/wiki/work/requirements/lifecycle.md:~24 + wiki/work/requirements/lifecycle.md:~24 ("amended via append-only ## Amendment N"), wiki/index.md (2 source-blurb lines, historical, leave), wiki/hot.md (historical, leave). -->

### 1. Confirm the predecessor and inventory live references  <!-- agent: Explore -->

- [x] Confirm [[TASK-0114]] is `done` (or at least implemented) by reading `wiki/work/tasks/TASK-0114-*.md`; this task must run after it because the renames touch the same files.
- [x] Run `mcp__serena__search_for_pattern` with `req-update|task-update` (case-sensitive) over `lib/**`, `test/**`, `README.md`, `CLAUDE.md`, `bin/**`, `package.json`, and non-historical `wiki/**` (exclude `wiki/log.md`, `wiki/**/archive/**`, `wiki/knowledge/sources/**`). Record the hit list; it must match Steps 3 to 7 below, and any hit not covered there is added to the nearest step.
- [x] Re-run the same search with `req-updated` and `Amendment` to catch log-op names and amendment prose that reference the removed flow.

### 2. Delete the two skills  <!-- agent: general-purpose -->

- [x] `git rm -r lib/skills/req-update lib/skills/task-update` (plain `rm -r` if the tree is untracked). Verify neither directory remains with `mcp__serena__list_dir` on `lib/skills`.
- [x] Do not delete anything under `~/.claude/skills/`.<!-- Updated: 2026-09-19 Step 2 done -->


### 3. Fix references inside sibling skills and shared docs  <!-- agent: general-purpose -->

Re-read each file immediately before editing; use `Edit` only.

- [x] `lib/skills/_shared/ID-RESOLUTION.md`: remove `req-update` from the requirements caller row (`req-update`, `req-retire`, `req-finalize`, `req-extract-decisions`, ...) and `task-update` from the tasks caller row (`tackle`, `task-update`, `uat-skip`, `uat-generate`, ...). Keep the rest of each row intact.
- [x] `lib/skills/req-finalize/SKILL.md`: reword the immutability paragraph (drops "Future scope changes go through `/req-update` ... `## Amendment N`"), the `approved` row in the status table (drops "suggest `/req-update <file> <change>`"), the next-steps table row `| /req-update <file> <change> | ... |` (delete the row), and CRITICAL rule 3 (drop "suggest `/req-update` for amendments"). Replacement: an approved requirement is locked in substance; changes are made by editing the file directly, or by creating a new requirement and retiring the old one.
- [x] `lib/skills/req-retire/SKILL.md` line ~16: delete the two `/req-update` sentences (amendments and supersession). Keep the sentence that `/req-retire` is the focused retirement flow; for supersession point at `/req-create` for the new requirement, then retire the old one here.
- [x] `lib/skills/task-audit/SKILL.md` (or `task-assess`): replace each `/task-update <N>` suggestion with "edit the task file directly" wording in Step 2d item 2 (now-resolved dependency note), the Step 2f trailing "missing dependency fields" sentence, and the Step 4 example-table rows and remediation block (`/task-update 006`, `/task-update 009`, `/task-update 007`). Rename the remediation heading if it says "Run /task-update".
- [x] `lib/skills/README.md`: delete the `req-update` row (~line 24) and the `task-update` row (~line 50); fix any skill-count sentence.
- [x] Search `lib/skills/**` again for `req-update|task-update|Amendment` and clear any remaining hit not listed above. (Also removed empty `## Amendments` section from req-create's requirement template.)<!-- Updated: 2026-09-19 Step 3 done; task-assess wording: "Missing dependency fields — edit the task file's frontmatter directly to add them" -->


### 4. Fix template and local lifecycle docs  <!-- agent: general-purpose -->

- [x] `lib/scripts/templates/wiki/work/requirements/lifecycle.md` line ~32: change "changes are append-only amendments (`/req-update`)" to "changes are made by editing the file directly (no amendment skill)". Apply the identical edit to `wiki/work/requirements/lifecycle.md` (the always-refreshed local dogfood copy; the two must stay identical).
- [x] Check `lib/scripts/templates/CLAUDE-wiki.md`, `lib/scripts/templates/wiki/work/tasks/lifecycle.md`, `lib/scripts/templates/wiki/work/bugs/lifecycle.md`, and their `wiki/work/**/lifecycle.md` copies for `update` skill mentions; the Step 1 inventory found none in the last two families, so this is a confirm-only check.
- [x] Confirm `lib/hooks/**`, `lib/prompts/**`, and the rest of `lib/scripts/**` have no hits (confirmed none on 2026-09-19); do not edit `install-global.sh` here (TASK-0122).<!-- Updated: 2026-09-19 Step 4 done -->


### 5. Fix top-level docs  <!-- agent: general-purpose -->

- [x] `CLAUDE.md`: delete the `/req-update <file> [change]` row (~line 110) and the `/task-update <path> <changes>` row (~line 118) from the Custom Commands table. `README.md` had no hits on 2026-09-19; re-confirm and remove any that appear. Use `Read` then `Edit`; do not touch the `.env` policy text.

### 6. Fix non-historical wiki pages  <!-- agent: general-purpose -->

- [x] `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md` (lines mentioning `task-update` in the dependency-format bullet, the `req-update`/`req-retire` correctness paragraph, and fix-list item 1) and `wiki/knowledge/concepts/wiki-work-family-cross-linking-gaps.md` (the `task-update` mention): append a short in-place note to each affected sentence, e.g. "(resolved by removing the skill: [[TASK-0115]])", without rewriting the research narrative. Knowledge pages are revised in place; no `status` field.
- [x] Leave `wiki/knowledge/sources/*` (historical research summaries), `wiki/index.md` one-line descriptions of those sources, `wiki/hot.md` (not refreshed by this task), `wiki/log.md`, `raw/**`, and the roadmap's own prose untouched.
<!-- Updated: 2026-09-19 Steps 5-6 done -->
- [x] `wiki/work/requirements/lifecycle.md` is covered in Step 4. Check `wiki/knowledge/entities/components/` for `req-update`/`task-update` component pages (none found on 2026-09-19); if one appears, delete it and remove its `wiki/index.md` line rather than leaving a dangling component page.

### 7. Handle TASK-0094 and UAT-0094  <!-- agent: general-purpose -->

- [x] Read `wiki/work/tasks/TASK-0094-req-update-retire-redirect.md` and `wiki/work/uat/UAT-0094-req-update-retire-redirect.md` frontmatter. If `status` is `pending-uat` / `pending` or otherwise non-terminal, and no `tackle-0094` / `uat-auto-0094` run is still active, run `/task-trash TASK-0094` with the reason "superseded by TASK-0115: req-update removed entirely". This flips both to `trashed`, archives them, removes their lines from `wiki/work/tasks/index.md` and `wiki/work/uat/index.md`, cleans the `- [ ] [[TASK-0094: ...]]` checkbox from ROADMAP-0014 Phase 1, and logs it.
- [x] If both are already terminal (passed/done and archived), do nothing and note it in the final report. (N/A: both were non-terminal, so trashed via the task-trash flow; both untracked so plain `mv` replaced `git mv`.)
- [x] Also `git rm` `test/req-update-retire-redirect.test.js` (Step 8 lists it; do it once).

### 8. Delete and trim the pinning tests  <!-- agent: general-purpose -->

- [x] Apply the "Tests: which are deleted and which are trimmed" table above, file by file, re-reading each immediately before editing.
<!-- Updated: 2026-09-19 Steps 7-8 done (retire-redirect test was untracked, plain rm) -->
- [x] Create `test/req-task-update-removed.test.js` (zero-dependency `node:test` + `node:assert/strict`, `'use strict'`, hermetic, header comment stating why a doc-only removal is pinned): assert `lib/skills/req-update` and `lib/skills/task-update` do not exist; recursively scan `lib/` (skip `lib/scripts/install-global.sh`), `README.md`, `CLAUDE.md` for `req-update` and `task-update` and assert an empty offender list.

### 9. Verify  <!-- agent: general-purpose -->

- [x] Run `node --test test/req-task-update-removed.test.js test/skill-boilerplate.test.js test/task-dependency-single-source.test.js test/task-dependency-fields-content.test.js test/shared-id-resolution.test.js`; then `npm test`. Report any failure verbatim; failures unrelated to these files are reported, not fixed.
- [x] Re-run the Step 1 search: the only remaining hits must be in the deliberately untouched set (`wiki/log.md`, `wiki/knowledge/sources/**`, archived/historical task and UAT files, ROADMAP-0014 prose, `install-global.sh` after TASK-0122). Also confirm `lib/skills/README.md` still satisfies its "directory name matches slash-command name" invariant with the two rows gone.
<!-- Updated: 2026-09-19 Step 9 done: targeted 118/118; full suite 884 tests, 879 pass, 5 fail (pre-existing: skill-frontmatter-aliases x4, task-typed-links x1) -->
- [x] Final report must state: files deleted, tests deleted vs trimmed, what happened to TASK-0094/UAT-0094, and that TASK-0122 must list `req-update` and `task-update` in its stale-skill prune list.
