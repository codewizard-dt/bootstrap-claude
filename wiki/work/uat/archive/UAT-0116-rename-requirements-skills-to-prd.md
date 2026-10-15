---
id: UAT-0116
aliases: [UAT-0116]
title: "UAT: Rename the requirements family's skills to PRD and issue new items as PRD-NNNN"
status: passed
task: TASK-0116
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0116 — UAT: Rename the requirements family's skills to PRD and issue new items as PRD-NNNN

implements::[[TASK-0116]]

> **Source task**: [[TASK-0116]]
> **Generated**: 2026-09-19

Every unit-backed case below runs one `node --test` command with explicit file paths and `--test-name-pattern` filters; each pattern was verified to select exactly the stated number of passing tests. No case requires the full `npm test` suite, and nothing here asserts on `install-global.sh` or its e2e/sandbox tests.

---

## Prerequisites

- [x] Working directory is the repo root (`bootstrap-claude`) with TASK-0116's edits applied
- [x] Node 18+ available (`node --test` with `--test-name-pattern`)

---

## Test Cases

### UAT-INT-001: Old skill directories are gone; prd-create/finalize/compile exist with matching names
- **Scenario**: Hard rename with no redirect stubs — `lib/skills/req-create/`, `req-finalize/`, `req-compile/` must not exist, and `lib/skills/prd-create/`, `prd-finalize/`, `prd-compile/` must each hold a `SKILL.md` whose frontmatter `name:` equals its directory name.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='old skill directories are gone' test/prd-rename-residue.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/prd-rename-residue.test.js` (shipped with TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='old skill directories are gone' test/prd-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-002: No live code or doc file references an old skill name (scope a)
- **Scenario**: The case-insensitive old names must not appear in `lib/**`, `test/**`, `README.md`, `CLAUDE.md`, `.serena/memories/**`, `wiki/knowledge/{concepts,entities}/**`, `wiki/conventions.md`, or `wiki/work/*/lifecycle.md`. The sweep is non-vacuous (asserts files were scanned) and its failure message lists `path:line` pairs.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='no live code/doc file references' test/prd-rename-residue.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/prd-rename-residue.test.js` (shipped with TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='no live code/doc file references' test/prd-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-003: No open work item points at an old skill live path (scope b)
- **Scenario**: Non-terminal, non-archived `wiki/work/**` items (excluding this rename's own narrating items TASK/UAT-0116) must not contain `lib/skills/<old-name>` or `skills/<old-name>`, so tackle/uat-walk against them still resolves.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='no open work item points' test/prd-rename-residue.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/prd-rename-residue.test.js` (shipped with TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='no open work item points' test/prd-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: The old-name regex is anchored and never matches the un-renamed siblings
- **Scenario**: `req-retire` and `req-extract-decisions` keep their names (separate tasks) and must not trip the residue sweep; look-alikes such as `prereq-created` and `req-created` must not match either, and the new `prd-*` names must not match.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='old-name regex is anchored' test/prd-rename-residue.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/prd-rename-residue.test.js` (shipped with TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='old-name regex is anchored' test/prd-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-004: prd-create documents PRD-NNNN new-item wording and no REQ-NNNN
- **Scenario**: `lib/skills/prd-create/SKILL.md` contains `PRD-NNNN-slug.md`, `id: PRD-NNNN`, and `aliases: [PRD-NNNN]`, and no line contains the legacy `REQ-NNNN` token (the legacy allocation clause is worded as "legacy `REQ` filenames").
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='prd-create documents PRD-NNNN' test/prd-rename-residue.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/prd-rename-residue.test.js` (shipped with TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='prd-create documents PRD-NNNN' test/prd-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-005: prd-create keeps PRD-NNNN filename rule, Step 5a guard, and flat-bullet index format; lifecycle and conventions use 4-digit tokens
- **Scenario**: The filename-convention suite now reads `lib/skills/prd-create/SKILL.md` (path `wiki/work/requirements/PRD-NNNN-slug.md`, Step 5a re-verify guard, `PRD-NNNN` index-entry format); the requirements lifecycle states `PRD-NNNN` (4-digit, zero-padded, globally unique); `CLAUDE.md` and `wiki/conventions.md` carry no stale 3-digit placeholder including `REQ-NNN(?!N)` / `PRD-NNN(?!N)`.
- **Steps**:
  1. Run the command below as-is (three name patterns)
  2. Confirm exactly 3 tests ran and all passed
- **Command**:
  ```bash
  node --test --test-name-pattern='prd-create SKILL.md uses PRD-NNNN' --test-name-pattern='lifecycle.md files state 4-digit ID schemes' --test-name-pattern='CLAUDE.md and wiki/conventions.md use 4-digit' test/wiki-work-naming-convention.test.js
  ```
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js` (existing; contents updated by TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='prd-create SKILL.md uses PRD-NNNN' --test-name-pattern='lifecycle.md files state 4-digit ID schemes' --test-name-pattern='CLAUDE.md and wiki/conventions.md use 4-digit' test/wiki-work-naming-convention.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-006: Both requirements lifecycle.md copies state ID scheme PRD-NNNN and are byte-identical
- **Scenario**: `wiki/work/requirements/lifecycle.md` and the template copy `lib/scripts/templates/wiki/work/requirements/lifecycle.md` (always-refreshed on install) must not drift. The residue test asserts `ID scheme: **PRD-NNNN**` in both and equality modulo the frontmatter `updated:` line; the removal-state suite asserts strict byte-identity of the two files.
- **Steps**:
  1. Run the command below as-is (two name patterns across two files)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='both requirements lifecycle copies' --test-name-pattern='local copy and template copy are byte-identical' test/prd-rename-residue.test.js test/req-task-update-removal-state.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/prd-rename-residue.test.js` (shipped with TASK-0116) and `test/req-task-update-removal-state.test.js` (existing; updated by TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='both requirements lifecycle copies' --test-name-pattern='local copy and template copy are byte-identical' test/prd-rename-residue.test.js test/req-task-update-removal-state.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-007: ID-RESOLUTION requirements row declares prefix PRD with the legacy REQ fallback after it
- **Scenario**: The requirements row of the Family table in `lib/skills/_shared/ID-RESOLUTION.md` has prefix cell `` `PRD` `` and a Notes cell naming the legacy prefix `REQ`, with `PRD` listed before `REQ`. Both the new residue assertion and the new assertion in the pinned shared-id-resolution suite check this.
- **Steps**:
  1. Run the command below as-is (two name patterns across two files)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='ID-RESOLUTION requirements row has prefix PRD' --test-name-pattern='requirements family row declares prefix PRD' test/prd-rename-residue.test.js test/shared-id-resolution.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/prd-rename-residue.test.js` (shipped with TASK-0116) and `test/shared-id-resolution.test.js` (existing; assertions added by TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='ID-RESOLUTION requirements row has prefix PRD' --test-name-pattern='requirements family row declares prefix PRD' test/prd-rename-residue.test.js test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-008: Legacy REQ- IDs still resolve (ID-RESOLUTION worked example)
- **Scenario**: The Worked examples table contains a legacy `REQ-0003` row for the requirements family (same integer, resolves to `PRD-0003-*` after migration or `REQ-0003-*` before), and every documented mask/example still resolves against the real tree — so a legacy `REQ-` input is not broken by the prefix switch.
- **Steps**:
  1. Run the command below as-is (two name patterns)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='worked examples contain a legacy REQ-0003 row' --test-name-pattern='documented masks resolve the documented worked examples' test/shared-id-resolution.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js` (existing; assertions added by TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='worked examples contain a legacy REQ-0003 row' --test-name-pattern='documented masks resolve the documented worked examples' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-009: prd-finalize and prd-compile are wired to ID-RESOLUTION with the requirements family scope
- **Scenario**: `lib/skills/prd-finalize/SKILL.md` and `lib/skills/prd-compile/SKILL.md` each reference `ID-RESOLUTION.md` and declare wiring `[["requirements","active"]]` (the suite's `WIRED_SKILLS` and expected-scope map now use the new names).
- **Steps**:
  1. Run the command below as-is (one regex pattern selecting two skills x two assertions)
  2. Confirm exactly 4 tests ran and all passed
- **Command**:
  ```bash
  node --test --test-name-pattern='lib/skills/prd-(finalize|compile)/SKILL.md (references ID-RESOLUTION|wiring declares)' test/shared-id-resolution.test.js
  ```
- **Expected Result**: `tests 4`, `pass 4`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js` (existing; `WIRED_SKILLS` updated by TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='lib/skills/prd-(finalize|compile)/SKILL.md (references ID-RESOLUTION|wiring declares)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-010: SKILL-BOILERPLATE requirements row uses prefix PRD- and prd-create/prd-finalize are registered consumers
- **Scenario**: The requirements row of `lib/skills/_shared/SKILL-BOILERPLATE.md` § Number allocation has prefix `` `PRD-` ``; `prd-create` points at the shared Number allocation section without restating it; the hygiene consumers (now listing `prd-create`/`prd-finalize`) point at the shared Edit hygiene section.
- **Steps**:
  1. Run the command below as-is (three name patterns across two files)
  2. Confirm exactly 3 tests ran and all passed
- **Command**:
  ```bash
  node --test --test-name-pattern='SKILL-BOILERPLATE requirements row has prefix' --test-name-pattern='prd-create points at the shared Number allocation' --test-name-pattern='hygiene consumers point at the shared Edit hygiene' test/prd-rename-residue.test.js test/skill-boilerplate.test.js
  ```
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/prd-rename-residue.test.js` (shipped with TASK-0116) and `test/skill-boilerplate.test.js` (existing; consumer arrays updated by TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='SKILL-BOILERPLATE requirements row has prefix' --test-name-pattern='prd-create points at the shared Number allocation' --test-name-pattern='hygiene consumers point at the shared Edit hygiene' test/prd-rename-residue.test.js test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-011: wiki-lint's typed-link resolution lists PRD-NNNN alongside legacy REQ-NNNN
- **Scenario**: wiki-lint 2.11 resolves every work-family ID type against its active dir or `archive/`; the asserted family list now includes `PRD-NNNN` and keeps `REQ-NNNN` (unmigrated files still exist).
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='resolves every work-family ID type' test/wiki-lint-typed-link-resolution.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js` (existing; family list updated by TASK-0116)
- **Unit Test Command**: `node --test --test-name-pattern='resolves every work-family ID type' test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-012: The wiki/work/requirements/ directory name is kept and every family directory still resolves
- **Scenario**: Only the ID prefix changed — the requirements family directory keeps its name. The shared-id-resolution suite asserts every family-table directory (including `wiki/work/requirements/`) exists and every item filename fits a 3- or 4-digit mask.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='family-table directories exist' test/shared-id-resolution.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js` (existing)
- **Unit Test Command**: `node --test --test-name-pattern='family-table directories exist' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-013: Legacy REQ- files still get aliases from backfill-wiki-aliases
- **Scenario**: `test/backfill-wiki-aliases.test.js` (which has a `REQ-900` fixture) is unchanged by the task and must keep passing, proving unmigrated `REQ-` files are still aliased. File-scoped run only.
- **Steps**:
  1. Run the command below as-is
  2. Confirm every test in the file passed
- **Command**:
  ```bash
  node --test test/backfill-wiki-aliases.test.js
  ```
- **Expected Result**: `fail 0`, and `pass` equals `tests` (12 at generation time).
- **Repeatable Unit Test**: Created: `test/backfill-wiki-aliases.test.js` (existing; not edited by TASK-0116)
- **Unit Test Command**: `node --test test/backfill-wiki-aliases.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: No existing REQ- file or ID was renamed; wiki/work/requirements/ is intact in the working tree
- **Scenario**: TASK-0116 must not bulk-rename any existing `REQ-` file (the migration task does that later). In the working tree the only entries under the requirements paths are modifications to `lifecycle.md` and `index.md` (local and template copies) — no rename (`R`), delete (`D`), or untracked (`??`) entries.
- **Steps**:
  1. Run the command below as-is
  2. Confirm every output line starts with ` M` (modified), and none starts with `R`, `D`, or `??`
  3. Confirm the three skill directories show as renames: run `git status --short -- lib/skills/prd-create lib/skills/prd-finalize lib/skills/prd-compile` and confirm each `SKILL.md` appears as `R` or `RM` from `req-*` (only after the task's changes are staged; if committed, use `git log --diff-filter=R --name-status -1 -- lib/skills` instead)
- **Command**:
  ```bash
  git status --short -- wiki/work/requirements lib/scripts/templates/wiki/work/requirements
  ```
- **Expected Result**: Output lists only `M` entries for `wiki/work/requirements/{index,lifecycle}.md` and the two template counterparts; no `R`/`D`/`??` line. No `REQ-*` file is renamed or deleted.
- **Repeatable Unit Test**: Not applicable: asserts git working-tree state, which is transient (after commit the check changes shape) and would break once the migration task legitimately renames `REQ-` files
- [x] Pass <!-- 2026-09-19 -->

---

## Observations and Gaps (not test cases)

- **Out-of-list edits the task made** (beyond its declared step lists), recorded for the reviewer; no case asserts on them beyond what UAT-INT-002/003/006 already cover: `test/req-task-update-removal-state.test.js` (updated for the lifecycle/PRD wording), the requirements `lifecycle.md` template `updated:` date bump, the `PRD-NNN` placeholders in `roadmap-create`, `CLAUDE.md` typed-link examples, and the UAT-0085 expectation.
- **`/task-create --req` is suggested but undocumented**: `lib/skills/prd-finalize/SKILL.md` L218 suggests `/task-create --req PRD-NNNN <description>` (and L183 mentions `/task-create --req`), yet `task-create` documents no `--req` flag. The task deliberately kept the suggestion with the new ID rather than inventing behavior. Pre-existing gap inherited from the old `req-finalize`; `req-extract-decisions` carries the same suggestion. Recommend a follow-up to either document the flag or reword the suggestion.
- **Lifecycle byte-identity**: the residue test (UAT-INT-006) tolerates a differing frontmatter `updated:` line by design; strict byte-identity is separately pinned by `req-task-update-removal-state.test.js`.
- **Retained on purpose**: `req-retire` and `req-extract-decisions` keep their names and `REQ-NNNN` prose (owned by later tasks); roadmap `linked_requirements` field is unchanged. The repo currently holds no active `REQ-` requirement files, so legacy `REQ-` resolution is proven by documented masks and the worked-example row, not by a live file.
- **Deliberately not asserted**: `install-global.sh` and its e2e/sandbox tests (another agent is editing them), the pre-existing failures (`skill-frontmatter-aliases` x4, including a `prd-create` pin, and `task-typed-links` x1), and the full `npm test` suite. No case requires the whole suite to exit 0.
- **No new unit test files written by this UAT**: every promotable assertion is already covered by `test/prd-rename-residue.test.js` (8 tests, shipped with TASK-0116) or the updated pinned suites. No test added uses a `skip` or `todo` option.
