---
id: UAT-0113
aliases: [UAT-0113]
title: "UAT: Rename uat-generate to uat-create"
status: passed
task: TASK-0113
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0113 — UAT: Rename uat-generate to uat-create

implements::[[TASK-0113]]

> **Source task**: [[TASK-0113]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [x] Repo checked out at the TASK-0113 implementation (`lib/skills/uat-create/SKILL.md` present)
- [x] Node.js available (`node --test` runner; no other dependencies)
- [x] Commands are file-scoped and name-filtered on purpose: the whole `npm test` suite is not a valid oracle here (known pre-existing failures in `skill-frontmatter-aliases` and `task-typed-links`, plus in-flight sibling-task edits)

---

## Test Cases

### UAT-EDGE-001: New skill directory exists with `name: uat-create`
- **Scenario**: `lib/skills/uat-create/SKILL.md` exists and its frontmatter carries `name: uat-create`, matching the directory name.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "exists with frontmatter name: uat-create" test passes (exit code 0, one test selected).
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='exists with frontmatter name: uat-create' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Old skill directory is gone, no redirect stub
- **Scenario**: Per ROADMAP-0014 Q&A item 4 the old skill directory is hard-renamed away; no stub or alias directory remains at `lib/skills/uat-generate`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "no longer exists (no redirect stub)" test passes.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='no longer exists' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Every skill's frontmatter `name:` equals its directory name
- **Scenario**: Across all `lib/skills/*/SKILL.md` files (excluding `_shared`), the declared `name:` matches the directory, guarding the class of mistake a rename invites.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "name: equals its directory name" test passes with an empty mismatch list.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='name: equals its directory name' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Preference key `uatGenerate.promoteTests` intentionally unchanged in the prefs schema
- **Scenario**: The stored-preferences key is persisted in users' `~/.claude/bootstrap-prefs.json` and project prefs files; renaming it would orphan every stored answer, so the schema template must still carry it verbatim.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test for `lib/scripts/templates/bootstrap-prefs-schema.json` passes, i.e. the file still contains `uatGenerate.promoteTests`.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='still present in lib/scripts/templates/bootstrap-prefs-schema.json' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: Preference key `uatGenerate.promoteTests` intentionally unchanged in the installer
- **Scenario**: `lib/scripts/install-global.sh` still reads and writes the key `uatGenerate.promoteTests` (only the surrounding prompt prose was renamed).
- **Steps**: Run the unit test command below.
- **Expected Result**: The test for `lib/scripts/install-global.sh` passes.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='still present in lib/scripts/install-global.sh' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: Preference key `uatGenerate.promoteTests` intentionally unchanged in the moved skill
- **Scenario**: `lib/skills/uat-create/SKILL.md` still spells the `--get`/`--set` commands and the recorded `Skipped by preference (uatGenerate.promoteTests=never)` string with the old camelCase key.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test for `lib/skills/uat-create/SKILL.md` passes.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='still present in lib/skills/uat-create/SKILL.md' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: Schema still exposes `uatGenerate.promoteTests` as a real key, with renamed summary prose
- **Scenario**: The schema JSON parses, has a top-level key `uatGenerate.promoteTests` whose `summary` reads `Where /uat-create writes the unit tests it promotes out of UAT cases`, and the installer prompt reads `Where should /uat-create write the unit tests`. Only prose changed, the key did not.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "preference key is a real schema key" test passes.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='preference key is a real schema key' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Prefs suite still resolves the key's consumer to the moved skill
- **Scenario**: `test/bootstrap-prefs.test.js` maps `uatGenerate.promoteTests` to `lib/skills/uat-create/SKILL.md` and asserts that skill reads the key with `--project .` and an `|| echo unset` fallback. This proves the key is functionally intact after the move, not just present as text.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "every consuming skill reads its key" test passes (exit code 0, one test selected).
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='consumer: skill — every consuming skill reads its key' test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: Prefs suite still pins the same consumer:"skill" key population
- **Scenario**: The schema's `consumer: "skill"` population is unchanged in count and membership, so `uatGenerate.promoteTests` was neither renamed nor dropped.
- **Steps**: Run the unit test command below.
- **Expected Result**: The `consumer:"skill" population is exactly ...` test passes.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='consumer:"skill" population is exactly' test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: Skill header, description and H1 use the new name; other frontmatter retained
- **Scenario**: `lib/skills/uat-create/SKILL.md` has `description: Create UAT tests in wiki/work/uat/ for a task`, H1 `# UAT Creator` (no `# UAT Generator`), and still carries `category`, `model`, `argument-hint`, `disable-model-invocation`, `user-invocable`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "skill header: description leads with Create" test passes.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='skill header: description leads with Create' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-011: UAT lifecycle template and local copy stay in sync
- **Scenario**: `lib/scripts/templates/wiki/work/uat/lifecycle.md` and `wiki/work/uat/lifecycle.md` both read ``created by `/uat-create` `` on the `pending` status line.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "lifecycle template and local copy" test passes.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='lifecycle template and local copy' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-012: Pipeline pointers and docs name `/uat-create`
- **Scenario**: The completion hint in `task-create`, the tackle UAT-offer text, the roadmap-next pending-uat row, the `UAT-CORE.md` pipeline string, the `ID-RESOLUTION.md` caller-deltas row, the `lib/skills/README.md` table row, and the `CLAUDE.md` Custom Commands row all name `uat-create`.
- **Steps**: Run the unit test command below. On failure the message lists each `file lacks <text>` offender.
- **Expected Result**: The "pipeline pointers" test passes with an empty missing list.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='pipeline pointers' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-013: Residue sweep — no live file still mentions `uat-generate`
- **Scenario**: Walking the repo (skipping `.git`, `node_modules`, `.claude`, `.serena/cache`, files over 1 MB or containing NUL bytes) finds no `/\buat-generate\b/i` match outside the explicit historical allowlist (`wiki/log*.md`, `raw/**`, the refreshed `wiki/guides/command-anti-patterns.md`, `archive/` directories, `wiki/work/tasks/TASK-*` and `wiki/work/uat/UAT-*` records, the tasks and uat family `index.md` files, `wiki/work/roadmaps/**`, `wiki/knowledge/sources/**`, `wiki/knowledge/concepts/wiki-work-filename-convention.md`, and the test file itself). `\b` keeps the camelCase key `uatGenerate.promoteTests` out of the match.
- **Steps**: Run the unit test command below. On failure the message lists each offending `path:line`.
- **Expected Result**: The residue sweep test passes with zero offenders.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='residue sweep' test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-014: Power-mode single-task pointer names `/tackle`, `/uat-create`, `/uat-auto` in order
- **Scenario**: The Single-Task Executor section of `lib/skills/power-mode/SKILL.md` lists `` `/tackle <task-path>` ``, `` `/uat-create <task-path>` ``, `` `/uat-auto <uat-path>` `` in that order.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "names /tackle, /uat-create, /uat-auto in order" test passes.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='names /tackle, /uat-create, /uat-auto in order' test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-015: Power-mode Dispatch bullet reads `tackle → uat-create → uat-auto`
- **Scenario**: The Dispatch section's task bullet points at the `tackle → uat-create → uat-auto` pipeline with the exact expected wording.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "Dispatch task bullet is retargeted at the pointer" test passes.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='Dispatch task bullet is retargeted' test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-016: `lib/skills/README.md` power-mode row lists the renamed pipeline
- **Scenario**: The `power-mode` row of `lib/skills/README.md` still mentions "roadmap or task files" and reads `tackle → uat-create → uat-auto`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "README.md power-mode row still truthful" test passes.
- **Repeatable Unit Test**: Created: `test/power-mode-single-task-pointer.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='README.md power-mode row still truthful' test/power-mode-single-task-pointer.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-017: `uat-create` still references the shared ID-resolution doc
- **Scenario**: `lib/skills/uat-create/SKILL.md` references `ID-RESOLUTION.md`; the `WIRED_SKILLS` list in `test/shared-id-resolution.test.js` names `uat-create`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "lib/skills/uat-create/SKILL.md references ID-RESOLUTION.md" test passes.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='lib/skills/uat-create/SKILL.md references ID-RESOLUTION' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-018: `uat-create` ID-resolution wiring is untouched (family `tasks`, scope `active`)
- **Scenario**: The rename kept the wiring line inside the moved skill unchanged, so the `EXPECTED_WIRING` entry `'uat-create': [['tasks', 'active']]` still matches what the skill declares.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "lib/skills/uat-create/SKILL.md wiring declares family/scope" test passes.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='lib/skills/uat-create/SKILL.md wiring declares' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-019: Whole rename test file is green
- **Scenario**: All eleven tests in `test/uat-create-rename.test.js` (UAT-EDGE-001 to 007, 010 to 013 combined) pass together, none skipped.
- **Steps**: Run the unit test command below.
- **Expected Result**: Exit code 0; 11 tests pass, 0 fail, 0 skipped.
- **Repeatable Unit Test**: Created: `test/uat-create-rename.test.js`
- **Unit Test Command**: `node --test test/uat-create-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

---

## Gaps

- **Installed copy untouched (`~/.claude/skills/uat-generate`) and `wiki/log.md`/`raw/` unmodified** (TASK-0113 Step 7 last item) are not cases: the installed copy is machine-local state outside the repo and installer-run history has no deterministic oracle (an earlier UAT with the same claim fail-closed for exactly this reason). `wiki/log.md` and `raw/` immutability is partly covered indirectly by the residue-sweep allowlist, but a `git diff --stat -- raw/ wiki/log.md` check depends on uncommitted-tree state and is not encoded.
- **`git mv` rename-history** (`R lib/skills/uat-generate/SKILL.md -> lib/skills/uat-create/SKILL.md`) is visible only while the rename is uncommitted; no stable oracle, so not encoded.
- **Full `npm test`** is intentionally not a case: known pre-existing failures (`skill-frontmatter-aliases` x4, including a `uat-create` placeholder pin `UAT-NNN` vs `UAT-NNNN` that predates this rename, and `task-typed-links` x1) are not this task's, so a green whole suite cannot be required.
- **No `bug-file`/`bug-create` assertions** were written: TASK-0114 is mid-change on that name.
- **Residue sweep vs `wiki/work/uat/index.md`**: verified, no gap. The sweep allowlist excludes `wiki/work/uat/index.md` (and `wiki/work/tasks/index.md`), so this UAT's own index row, which quotes the old name in its title, does not trip UAT-EDGE-013.
