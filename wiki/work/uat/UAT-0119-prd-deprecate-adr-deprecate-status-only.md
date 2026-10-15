---
id: UAT-0119
aliases: [UAT-0119]
title: "UAT: Rename req-retire to prd-deprecate and add a new status-only adr-deprecate"
status: pending
task: TASK-0119
created: 2026-09-20
updated: 2026-09-20
---

# UAT-0119 — UAT: Rename req-retire to prd-deprecate and add a new status-only adr-deprecate

implements::[[TASK-0119]]

> **Source task**: [[TASK-0119]]
> **Generated**: 2026-09-20

TASK-0119 is a markdown-as-program change (a hard skill rename, one new skill, and the docs, lifecycle files, tables, memories and tests around them), so nearly every acceptance criterion is verifiable by a deterministic `node:test` file that reads the repo itself. Each `Unit Test Command` below was run before this file was written, and each `--test-name-pattern` was confirmed to select exactly the tests named in the case's steps (a pattern matching zero tests would be an authoring bug). Test files are always passed explicitly, never `node --test test/`.

The tests live in three places: `test/deprecate-skills.test.js` and `test/prd-deprecate-rename-residue.test.js` (both shipped with TASK-0119), `test/deprecate-skills-crossrefs.test.js` (written by this UAT generation, 16 tests, for the behavior the tackle tests did not pin), and the updated pinned suites `test/shared-id-resolution.test.js`, `test/skill-boilerplate.test.js`, `test/task-close-rename.test.js` and `test/req-task-update-removal-state.test.js`.

**Out of scope on purpose**:
- **Six known failures from other in-flight work**: `shared-id-resolution` (f) `wiki/work/tasks/dependency-graph.md is not reachable by PREFIX-<pad>-*.md`, `skill-frontmatter-aliases` x4 (task-create, uat-create, prd-create, roadmap-create) and `task-typed-links` (task-create dependency-link placement). None is this task's; no automated case below uses them, and UAT-MAN-003 checks the full suite shows only those six.
- **The installed copy** `~/.claude/skills/req-retire/` and `lib/scripts/install-global.sh`: the task deliberately leaves both alone (TASK-0122 prunes stale installed skills).
- **Archive removal** for requirements, decisions and roadmaps (TASK-0121) and `prd-assess` / `adr-assess` (TASK-0120).
- **Historical records** (`wiki/log*.md`, `raw/**`, `**/archive/**`, terminal work-item bodies) keep the old `req-retire` / `req-retired` text on purpose and must not be edited to satisfy any case.
- The LLM-executed behaviour of the two skills has no machine oracle; see UAT-MAN-001 and UAT-MAN-002.

---

## Prerequisites

- [ ] Working directory is the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`) with TASK-0119's implementation present
- [ ] `node` >= 18 on PATH (`node --test` with `--test-name-pattern`)
- [ ] No network, secrets, or running services needed for the automated cases; every one is read-only
- [ ] For UAT-MAN-001 and UAT-MAN-002 only: an interactive Claude Code session in which the repo's `lib/skills/prd-deprecate/` and `lib/skills/adr-deprecate/` are the skills that run (the installed `~/.claude/skills/` copies are deliberately not refreshed by this task), on a scratch copy or a clean git tree so the exercise edits can be reverted
- [ ] For UAT-MAN-003 only: `npm test` runnable from the repo root

---

## Test Cases

### UAT-EDGE-001: req-retire is gone; prd-deprecate and adr-deprecate exist with matching names
- **Scenario**: Hard rename, no redirect stub. `lib/skills/req-retire/` must not exist; `lib/skills/prd-deprecate/SKILL.md` and `lib/skills/adr-deprecate/SKILL.md` must exist and each frontmatter `name:` must equal its directory name.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm one test runs and passes (`old skill directory is gone; prd-deprecate and adr-deprecate exist with matching names`)
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. A leftover old directory (even an empty stub) or a missing or misnamed new skill fails the test with the offending path.
- **Repeatable Unit Test**: Created: `test/prd-deprecate-rename-residue.test.js` (shipped with TASK-0119, 3 tests)
- **Unit Test Command**: `node --test --test-name-pattern='old skill directory is gone' test/prd-deprecate-rename-residue.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-002: Both skills are status-only: no git mv, no archive/, no Bash, and they move the index row to Closed
- **Scenario**: Roadmap decisions #5 and #6 say the deprecate skills are kept but status-only. Neither `SKILL.md` may mention `git mv`, `archive/` or `Bash`, or declare `allowed-tools`, and each must describe moving the family-index row into a `Closed` section.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm four tests run and pass: for each of `prd-deprecate` and `adr-deprecate`, `status-only - no git mv, no archive/, no Bash permission` and `moves the index row to the Closed section`
- **Expected Result**: `tests 4`, `pass 4`, `fail 0`. Re-adding the old Step 5.5 `git mv` archive step to either skill fails the first test for that skill.
- **Repeatable Unit Test**: Created: `test/deprecate-skills.test.js` (shipped with TASK-0119, 15 tests)
- **Unit Test Command**: `node --test --test-name-pattern='status-only - no git mv|moves the index row to the Closed' test/deprecate-skills.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-003: No live file still cites req-retire, and neither new skill names it
- **Scenario**: No line in `lib/**`, `test/**`, `README.md`, `CLAUDE.md`, `.serena/memories/**`, `wiki/knowledge/{concepts,entities}/**`, `wiki/conventions.md` or `wiki/work/*/lifecycle.md` contains the old skill name (case-insensitive, so `req-retired` and `Req-retire` count), and no non-excluded file cites the live path `lib/skills/req-retire` or `skills/req-retire`. Four exact-path-plus-fragment allowlist entries (a knowledge page narrating the rename and one sibling test that uses the old name as a negative example) are tolerated. Historical records (`wiki/log*.md`, `raw/**`, `**/archive/**`, `wiki/knowledge/sources/**`, work-item bodies, family indexes, `.docs/**`) are excluded and must not be edited to satisfy this case.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern each)
  2. Confirm four tests run and pass: `scope (a)`, `scope (b)`, and the two `never names the old skill` tests
- **Expected Result**: `tests 4`, `pass 4`, `fail 0`. On failure the assertion message lists the offending `path:line` pairs. A failure naming a file owned by an in-flight sibling task is that task's residue, not a reason to edit history.
- **Repeatable Unit Test**: Created: `test/prd-deprecate-rename-residue.test.js` (2 tests) and `test/deprecate-skills.test.js` (2 tests)
- **Unit Test Command**: `node --test --test-name-pattern='scope \((a|b)\)|never names the old skill' test/prd-deprecate-rename-residue.test.js test/deprecate-skills.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-004: prd-deprecate keeps the terminal status name `retired` and writes a `prd-deprecated` log entry
- **Scenario**: Design decision 1: the verb changes to "deprecate" but the PRD lifecycle enum `draft | approved | retired` is unchanged, so `prd-deprecate` sets `status: retired`. It logs `## [YYYY-MM-DD] prd-deprecated | PRD-NNNN <title> — reason: …` (not the old `req-retired`), appends `**Deprecated [YYYY-MM-DD]**: <reason>` to `## Notes`, moves the row in `wiki/work/requirements/index.md` from Active into `## Closed`, and states the file never moves.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm two tests run and pass: `prd-deprecate: sets status: retired and writes a prd-deprecated log entry` and `(b) prd-deprecate keeps the terminal status name retired and adds the Notes audit trail`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/deprecate-skills.test.js` (1 test) and `test/deprecate-skills-crossrefs.test.js` (written by this UAT generation, 1 test)
- **Unit Test Command**: `node --test --test-name-pattern='prd-deprecate: sets status: retired|\(b\) prd-deprecate keeps' test/deprecate-skills.test.js test/deprecate-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-005: adr-deprecate is per-block, sets `deprecated`, leaves `superseded` to /adr-finalize, and handles `#DM`
- **Scenario**: Design decisions 2 and 3. `adr-deprecate` operates on one `## DM.` block (`<file>#DM`), accepts only `proposed` or `accepted` (`deprecated` and `superseded by …` STOP), sets `Status: deprecated`, inserts a `> **Deprecated** on YYYY-MM-DD: <reason>` callout under that block's H2, touches only the target block (siblings inviolate), states `` `superseded` is set only by `/adr-finalize` ``, routes replacement decisions to `/adr-create` then `/adr-finalize`, keeps a group in Active while any block is still `proposed`, and writes an `adr-deprecated | ADR-NNNN#DM …` log entry.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm three tests run and pass: `adr-deprecate: sets deprecated, leaves superseded to /adr-finalize, logs adr-deprecated, handles #DM`, `(c) adr-deprecate is per-block: touches only the target block and reads proposed|accepted only`, and `(c) adr-deprecate routes replacement decisions to /adr-create + /adr-finalize, not to itself`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/deprecate-skills.test.js` (1 test) and `test/deprecate-skills-crossrefs.test.js` (2 tests)
- **Unit Test Command**: `node --test --test-name-pattern='adr-deprecate: sets deprecated|\(c\) adr-deprecate' test/deprecate-skills.test.js test/deprecate-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-006: Both skills keep the shared frontmatter shape and every safety rule
- **Scenario**: Design decision 8. Both skills keep `category: planning`, `model: claude-haiku-4-5-20251001`, `user-invocable: true`, `disable-model-invocation: false` and an `argument-hint`, open with the standard Prereqs line, and name their family lifecycle doc (`wiki/work/requirements/lifecycle.md`, `wiki/work/decisions/lifecycle.md`). Each keeps the CRITICAL rules: confirm before any edits via `AskUserQuestion`, reason required, never auto-cascade (surface `/task-close` suggestions instead), refuse an already-terminal item, maximum 3 sub-processes.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm three tests run and pass: `(a) both skills keep the haiku / planning / user-invocable frontmatter shape`, `(a) each skill opens with the standard Prereqs line and names its family lifecycle doc`, and `(b) safety rules: confirm before edits, reason required, never auto-cascade, refuse already-terminal`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/deprecate-skills-crossrefs.test.js` (written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\(a\) both skills|\(a\) each skill|\(b\) safety rules' test/deprecate-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-007: ID resolution and Edit hygiene are shared, not restated; both skills are wired with the right family and scope
- **Scenario**: Design decision 6. Each skill references `ID-RESOLUTION.md` and `SKILL-BOILERPLATE.md § Edit hygiene` instead of restating them, has no legacy pad-width or `NNN-*.md` mask text, keeps `argument-hint`, and declares its own wiring line: `prd-deprecate` → `requirements` / `active`, `adr-deprecate` → `decisions` / `active`. The Caller-deltas table in `ID-RESOLUTION.md` lists `prd-deprecate` in the requirements row and `adr-deprecate` in the decisions row (`#DM` handled per that doc), both `active` / `interactive`.
- **Steps**:
  1. Run the unit test command below as-is (three test files, one pattern)
  2. Confirm eleven tests run and pass: the two `defers to ID-RESOLUTION.md and SKILL-BOILERPLATE.md § Edit hygiene` tests, the eight per-skill `lib/skills/<skill>/SKILL.md` tests `(b)`, `(c)`, `(d)`, `(e)` from `shared-id-resolution`, and `(g) ID-RESOLUTION caller-deltas lists both deprecate skills in the right family rows`
- **Expected Result**: `tests 11`, `pass 11`, `fail 0`. The `shared-id-resolution` suite's `(f)` directory-mask test is a known pre-existing failure and is deliberately not selected.
- **Repeatable Unit Test**: Created: `test/deprecate-skills.test.js` (2 tests), `test/shared-id-resolution.test.js` (updated by TASK-0119; 8 per-skill tests) and `test/deprecate-skills-crossrefs.test.js` (1 test)
- **Unit Test Command**: `node --test --test-name-pattern='defers to ID-RESOLUTION|deprecate/SKILL\.md (references|has no legacy|keeps argument|wiring)|\(g\) ID-RESOLUTION' test/deprecate-skills.test.js test/shared-id-resolution.test.js test/deprecate-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-008: The decisions lifecycle documents `deprecated` as a terminal state, identically in both copies
- **Scenario**: Design decision 2. `wiki/work/decisions/lifecycle.md` and its template copy `lib/scripts/templates/wiki/work/decisions/lifecycle.md` list `proposed | accepted | deprecated | superseded` in the Status row, show `proposed / accepted ──▶ deprecated` beside `proposed ──▶ accepted ──▶ superseded`, carry a `**deprecated**` bullet ("withdrawn without a successor via `/adr-deprecate`") and mark `superseded` as "Set only by `/adr-finalize`", and the two files are byte-identical.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm two tests run and pass: `both decisions lifecycle.md copies list deprecated in the status enum and are byte-identical` and `(d) decisions lifecycle documents deprecated as a terminal state set via /adr-deprecate`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/deprecate-skills.test.js` (1 test) and `test/deprecate-skills-crossrefs.test.js` (1 test)
- **Unit Test Command**: `node --test --test-name-pattern='both decisions lifecycle|\(d\) decisions lifecycle' test/deprecate-skills.test.js test/deprecate-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-009: The requirements lifecycle points at /prd-deprecate, keeps `retired`, and both copies stay identical
- **Scenario**: `wiki/work/requirements/lifecycle.md` and its template copy read "create a new requirement with `/prd-create`, then `/prd-deprecate` the old one", the **retired** bullet says "set via `/prd-deprecate` (status-only; the status keeps the name `retired`)", the status enum is still `draft | approved | retired`, and the two copies are byte-identical. The pre-existing supersede-path and direct-edit assertions in `req-task-update-removal-state` still hold with the new names.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm three tests run and pass: `(d) requirements lifecycle copies name /prd-deprecate and are byte-identical`, `requirements lifecycle.md: local copy and template copy are byte-identical`, and `requirements lifecycle.md says approved changes are made by editing the file directly`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/deprecate-skills-crossrefs.test.js` (1 test) and `test/req-task-update-removal-state.test.js` (updated by TASK-0119; 2 tests)
- **Unit Test Command**: `node --test --test-name-pattern='\(d\) requirements lifecycle|requirements lifecycle\.md' test/deprecate-skills-crossrefs.test.js test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-010: `deprecated` is a recognised terminal status in conventions and the dashboard
- **Scenario**: The terminal-status sentence in `wiki/conventions.md` and `lib/scripts/templates/wiki/conventions.md` lists `retired`, `deprecated` and "all decisions `accepted`/`deprecated`/`superseded`"; `lib/scripts/templates/wiki/dashboard.html`'s status-colour map has `'retired'`, `'deprecated'` and `'superseded'` all mapped to `'muted'`, so a deprecated decision renders like the other terminal states.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm three tests run and pass: `(e) conventions terminal-status list includes deprecated in both copies`, `(e) dashboard colours deprecated 'muted' like retired and superseded`, and `dashboard.html colour map contains 'deprecated'`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/deprecate-skills.test.js` (1 test) and `test/deprecate-skills-crossrefs.test.js` (2 tests)
- **Unit Test Command**: `node --test --test-name-pattern="\(e\) conventions|\(e\) dashboard|dashboard\.html colour" test/deprecate-skills.test.js test/deprecate-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-011: Sibling skills and shared docs point at the new skills and no longer mention the archiving skill
- **Scenario**: `prd-finalize` says "deprecating the old one with `/prd-deprecate`"; `adr-finalize` Step 2 adds "To withdraw an accepted decision with no successor, use `/adr-deprecate`" and still owns `superseded`; `adr-create` rule 6 allows "accepted → deprecated via `/adr-deprecate`" plus the deprecation callout; `adr-walkthrough` says the deprecation transition belongs to `/adr-deprecate`; `adr-next` still skips `deprecated`; `wiki-archive` treats `accepted`, `deprecated` or `superseded` decisions as terminal and states that `prd-deprecate` / `adr-deprecate` are status-only and stay in place; `_shared/ARCHIVE-WORK-ITEM.md` names neither `req-retire` nor `prd-deprecate` (it only covers families that still archive); the direct-edit / supersede wording in `prd-finalize` and `task-assess` still holds.
- **Steps**:
  1. Run the unit test command below as-is (three test files, one pattern)
  2. Confirm five tests run and pass: `(f) sibling skills point at the new skills`, `(f) adr-finalize still owns superseded and adr-next skips deprecated`, `(h) wiki-archive treats deprecated decisions as terminal and says deprecate skills never move files`, `ARCHIVE-WORK-ITEM.md no longer names the retired archiving skill or the status-only skills`, and `task-assess and prd-finalize replace the removed pointers with edit-directly wording`
- **Expected Result**: `tests 5`, `pass 5`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/deprecate-skills-crossrefs.test.js` (3 tests), `test/deprecate-skills.test.js` (1 test) and `test/req-task-update-removal-state.test.js` (1 test, updated by TASK-0119)
- **Unit Test Command**: `node --test --test-name-pattern='\(f\) |\(h\) |ARCHIVE-WORK-ITEM|task-assess and prd-finalize' test/deprecate-skills.test.js test/deprecate-skills-crossrefs.test.js test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-012: Skill tables, CLAUDE.md and Serena memories list both commands; /task-close is surfaced
- **Scenario**: `lib/skills/README.md` has a `prd-deprecate` row and an `adr-deprecate` row (each says "the file never moves"); the `CLAUDE.md` Custom Commands table has `/prd-deprecate <file> [reason]` and `/adr-deprecate <file>#<DM> [reason]` rows; `.serena/memories/workflow/prd-layer.md` has both command rows (the `adr-deprecate` row states `superseded` stays `/adr-finalize`-only); `.serena/memories/skills/format-and-model-selection.md`'s Mechanical / bookkeeping row lists both skills and its `(N total)` count equals the number of skills in that row; and `test/task-close-rename.test.js` pins that `CLAUDE.md`, `wiki-tidy`, `prd-deprecate` and `adr-deprecate` all reference `/task-close`.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm three tests run and pass: `(i) skills README and CLAUDE.md list both commands`, `(j) Serena memories list the new skills and the deprecated ADR status`, and `CLAUDE.md, wiki-tidy, prd-deprecate and adr-deprecate reference /task-close`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/deprecate-skills-crossrefs.test.js` (2 tests) and `test/task-close-rename.test.js` (1 test, updated by TASK-0119)
- **Unit Test Command**: `node --test --test-name-pattern='\(i\) |\(j\) |reference /task-close' test/deprecate-skills-crossrefs.test.js test/task-close-rename.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-013: Both new skills satisfy the shared Prereqs grammar and Edit-hygiene consumer checks
- **Scenario**: `test/skill-boilerplate.test.js`'s `HYGIENE_CONSUMERS` names `prd-deprecate` and `adr-deprecate` in place of `req-retire`, every inline `**Prereqs:**` line in every `SKILL.md` still matches the grammar, the hygiene consumers point at the shared Edit hygiene section, and none restates the "never sed/awk" sentence.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm three tests run and pass: `every inline **Prereqs:** line in a SKILL.md matches the grammar`, `hygiene consumers point at the shared Edit hygiene section`, and `hygiene consumers do not restate the "never sed/awk" sentence (outside the allow-list)`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`. The grammar test scans every `lib/skills/*/SKILL.md`, so a failure naming a different skill belongs to that skill's task, not this one.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` (updated by TASK-0119)
- **Unit Test Command**: `node --test --test-name-pattern='every inline|hygiene consumers' test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-MAN-001: Running /prd-deprecate on a real PRD leaves the file in place and moves only its index row
- **Scenario**: The unit tests pin the skill text, not what Claude does when it follows it. Nothing machine-checkable exists for the LLM-executed behaviour, so a human confirms it once end to end. Use a scratch PRD (a copy of an `approved` PRD under a throwaway ID, or a clean git tree so the edits can be reverted).
- **Steps**:
  1. In a Claude Code session in this repo, run the repo copy of the skill with no argument. Confirm it lists every PRD in `wiki/work/requirements/` and asks via `AskUserQuestion` which one to deprecate
  2. Pick an `approved` PRD with linked tasks or decisions. Confirm it shows the file path, ID, title, current status and a downstream-artifacts table with suggested commands (`/task-close <path>`, `/adr-create deprecate <topic> (supersedes ADR-NNNN#DM)`), then asks "Deprecate this PRD?" and, if you gave no reason, asks for one
  3. Answer `no` once and confirm nothing was edited. Re-run and answer `yes` with a reason
  4. Confirm the PRD's frontmatter now reads `status: retired` with `updated:` set to today, `## Notes` gained `**Deprecated [YYYY-MM-DD]**: <reason>`, the file is still at `wiki/work/requirements/PRD-NNNN-slug.md` (no `archive/` copy, `git status` shows a modification and no rename), and the PRD's row moved from the Active section of `wiki/work/requirements/index.md` to a `## Closed` section ending ` · retired`
  5. Confirm `wiki/log.md` gained exactly one `## [YYYY-MM-DD] prd-deprecated | PRD-NNNN <title> — reason: …` entry, no linked task or decision was edited, and the completion table says "Family index updated: yes (row moved to Closed)"
  6. Run it again on the same PRD and confirm it stops with "PRD-NNNN is already retired. No action needed." and edits nothing
- **Expected Result**: Every behaviour in steps 1-6 as described. Reverting the exercise edits afterwards (`git checkout` the PRD, index and log) is recommended.
- **Repeatable Unit Test**: Not applicable: the behaviour is Claude following the skill's instructions against real wiki content (interactive `AskUserQuestion` prompts, surgical `Edit` calls); the deterministic parts of the contract are pinned by UAT-EDGE-002, UAT-EDGE-004 and UAT-EDGE-006
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-20 -->

### UAT-MAN-002: Running /adr-deprecate on one block of a multi-block group touches only that block and places the index row correctly
- **Scenario**: The per-block edit discipline (target block only, siblings byte-for-byte unchanged, row stays in Active while any block is `proposed`, moves to Closed otherwise) is LLM-executed and has no machine oracle. Use a scratch Decision Group with at least three blocks: one `proposed`, one `accepted`, and (for step 7) one already `superseded by …`.
- **Steps**:
  1. Run the repo copy of the skill as `<group>#D2` where D2 is `accepted` and D1 is `proposed`. Confirm it resolves the group, shows the downstream table (dependent decisions via `Supersedes:` and tasks via `implements::[[ADR-NNNN#D2]]`), asks for confirmation and a reason
  2. Accept. Confirm D2's `- **Status**:` bullet reads `deprecated` and a `> **Deprecated** on YYYY-MM-DD: <reason>` callout sits directly under D2's H2, above its metadata bullets
  3. Diff the group file (`git diff`): confirm only D2's status line, D2's callout and the frontmatter `updated:` changed, and D1 and every other block are byte-for-byte unchanged (plus any index-table / mermaid `class` line for D2 if the file carries them, all agreeing on `deprecated`)
  4. Confirm `wiki/work/decisions/index.md` shows the group row's trailing summary updated (`D1 proposed, D2 deprecated, …`) and the row **stays in Active** because D1 is still `proposed`
  5. Repeat with D1 (the last `proposed` block) and confirm the row now moves to a `## Closed` section, with its summary showing the terminal statuses
  6. Confirm `wiki/log.md` gained one `adr-deprecated | ADR-NNNN#DM <title> — reason: …` entry per run, no task was closed and no dependent decision was edited, and the file never moved
  7. Run it on a `superseded by …` block and on an already `deprecated` block, and confirm each stops with the "already superseded" / "already deprecated" message and edits nothing; confirm `Status: superseded` is never written by this skill
- **Expected Result**: Every behaviour in steps 1-7 as described. Reverting the scratch edits afterwards is recommended.
- **Repeatable Unit Test**: Not applicable: the behaviour is Claude following the skill's instructions against a real Decision Group (block location, surgical multi-file edits, index placement); the deterministic parts of the contract are pinned by UAT-EDGE-005 and UAT-EDGE-008
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-20 -->

### UAT-MAN-003: The full suite shows only the six known pre-existing failures
- **Scenario**: TASK-0119 must introduce no new failure. The whole-suite result depends on other in-flight tasks that will change over time, so it cannot be a fixed-pattern unit test; a human compares the failure list against the known six.
- **Steps**:
  1. Run `npm test` from the repo root
  2. Collect the failing test names
  3. Compare against the known set: `shared-id-resolution` (f) `wiki/work/tasks/dependency-graph.md is not reachable by PREFIX-<pad>-*.md`; `skill-frontmatter-aliases` for task-create, uat-create, prd-create and roadmap-create; and `task-typed-links` task-create dependency-link placement
  4. Confirm none of the failures is in `test/deprecate-skills.test.js`, `test/deprecate-skills-crossrefs.test.js`, `test/prd-deprecate-rename-residue.test.js`, `test/task-close-rename.test.js`, `test/skill-boilerplate.test.js` or `test/req-task-update-removal-state.test.js`
- **Expected Result**: The failure list is a subset of the known six. Any additional failure is either a new regression from this task (report it) or another in-flight task's residue (name the owning task). If the other in-flight tasks have since landed, an empty failure list is also a pass.
- **Repeatable Unit Test**: Not applicable: the outcome is the whole suite compared against a moving baseline of other tasks' failures, not a deterministic assertion about this task; the individual behaviours are pinned by UAT-EDGE-001 through UAT-EDGE-013
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-20 -->
