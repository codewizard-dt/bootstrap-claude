---
id: UAT-0114
aliases: [UAT-0114]
title: "UAT: Rename bug-file to bug-create and sweep every live reference"
status: pending
task: TASK-0114
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0114 — UAT: Rename bug-file to bug-create and sweep every live reference

implements::[[TASK-0114]]

> **Source task**: [[TASK-0114]]
> **Generated**: 2026-09-19

Every unit-backed case below runs one file-scoped `node --test` command with a `--test-name-pattern` filter; each pattern was verified to select exactly one passing test. No case requires the full `npm test` suite.

---

## Prerequisites

- [ ] Working directory is the repo root (`bootstrap-claude`) with TASK-0114's edits applied
- [ ] Node 18+ available (`node --test` with `--test-name-pattern`)

---

## Test Cases

### UAT-INT-001: Old skill directory is gone and lib/skills/bug-create/SKILL.md carries the new name
- **Scenario**: Hard rename with no redirect stub — the old directory must not exist and the new skill must declare `name: bug-create` in its frontmatter.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='old skill directory is gone' test/bug-create-rename-residue.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. The test asserts the old skill directory does not exist, `lib/skills/bug-create/SKILL.md` exists, and its frontmatter `name:` is `bug-create`.
- **Repeatable Unit Test**: Created: `test/bug-create-rename-residue.test.js` (shipped with TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='old skill directory is gone' test/bug-create-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-002: No live code or doc file references the old skill name (scope a)
- **Scenario**: The case-insensitive old name must not appear anywhere in `lib/**`, `test/**`, `README.md`, `CLAUDE.md`, `.serena/memories/**`, `wiki/knowledge/{concepts,entities}/**`, `wiki/conventions.md`, or `wiki/work/*/lifecycle.md` (after blanking the two retained task slugs).
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed; on failure, the assertion message lists the offending `path:line` pairs
- **Command**:
  ```bash
  node --test --test-name-pattern='scope \(a\)' test/bug-create-rename-residue.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/bug-create-rename-residue.test.js` (shipped with TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='scope \(a\)' test/bug-create-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-003: No open work item points at the old skill live path (scope b)
- **Scenario**: Non-terminal, non-archived `wiki/work/**` items (excluding the rename's own narrating items TASK/UAT-0114 and -0115) must not contain `lib/skills/<old-name>` or `skills/<old-name>`, so tackle/uat-walk against them still resolves.
- **Steps**:
  1. Run the command below as-is
  2. Confirm exactly 1 test ran and it passed
- **Command**:
  ```bash
  node --test --test-name-pattern='scope \(b\)' test/bug-create-rename-residue.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/bug-create-rename-residue.test.js` (shipped with TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='scope \(b\)' test/bug-create-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: Residue sweep is not vacuous and does not scan family indexes or historical records
- **Scenario**: The sweep must skip `wiki/work/*/index.md` (which quote historical work-item titles verbatim, e.g. `wiki/work/uat/index.md` lines naming the old skill), `wiki/log*.md`, `wiki/hot.md`, `wiki/index.md`, `raw/`, `.docs/`, `archive/` directories and `wiki/knowledge/sources/`, while still walking a non-empty set of files. Verified by reading the walker in `test/bug-create-rename-residue.test.js`: `EXCLUDED_PATTERNS` contains `/^wiki\/work\/[^/]+\/index\.md$/`, which matches `wiki/work/uat/index.md`. Non-vacuity is asserted inline (`files.length > 0`) in scope (a) and scope (b).
- **Steps**:
  1. Use Serena `search_for_pattern` for `EXCLUDED_PATTERNS` in `test/bug-create-rename-residue.test.js` and confirm the array contains a regex excluding per-family `index.md` files
  2. Confirm `EXCLUDED_FILES` lists `wiki/log.md`, `wiki/hot.md`, `wiki/index.md`, and that `EXCLUDED_DIR_NAMES`/`EXCLUDED_DIR_PATHS` cover `archive`, `raw`, `.docs`, `wiki/knowledge/sources`
  3. Run the UAT-INT-002 and UAT-INT-003 commands; both pass even though `wiki/work/uat/index.md` currently still contains the old skill name in historical titles (e.g. UAT-0086, UAT-0091, UAT-0095 lines)
- **Expected Result**: The family-index pattern and the historical-record exclusions are present, and the two sweeps pass despite the index lines that still name the old skill (proving the exclusion works). The two `files.length > 0` guards guarantee neither sweep passes by scanning nothing.
- **Repeatable Unit Test**: Not applicable: the exclusion list is exercised implicitly by UAT-INT-002/003 passing against a repo whose indexes still hold historical titles; a dedicated unit test would only re-assert the test's own constants
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-INT-004: bug-create keeps status `open` in intro, Step 6, and Step 8 (behavior unchanged by rename)
- **Scenario**: Only the name changed; the TASK-0095 status alignment survives the rename.
- **Steps**:
  1. Run the command below as-is
- **Command**:
  ```bash
  node --test --test-name-pattern='intro, Step 6 bullet, and Step 8 report' test/bug-file-status-open.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. The test reads `lib/skills/bug-create/SKILL.md` and asserts status `open` in the intro, the Step 6 bullet, and the Step 8 report.
- **Repeatable Unit Test**: Created: `test/bug-file-status-open.test.js` (existing; contents updated by TASK-0114, filename retained by design)
- **Unit Test Command**: `node --test --test-name-pattern='intro, Step 6 bullet, and Step 8 report' test/bug-file-status-open.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-005: bug-create still advertises and implements the --knowledge flag
- **Scenario**: The `argument-hint` frontmatter still advertises `--knowledge <slug>` on the renamed skill, and Step 6 still inserts `relates_to::[[<slug>]]` directly under the H1 (omitted when unresolved).
- **Steps**:
  1. Run the command below as-is (two name patterns, one per assertion)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='bug-create/SKILL.md argument-hint frontmatter advertises' --test-name-pattern='bug-create/SKILL.md Step 6 inserts relates_to' test/knowledge-link-flag.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js` (existing; contents updated by TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='bug-create/SKILL.md argument-hint frontmatter advertises' --test-name-pattern='bug-create/SKILL.md Step 6 inserts relates_to' test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-006: CLAUDE.md Custom Commands row names /bug-create and keeps the --knowledge note
- **Scenario**: The `/bug-file <description>` row was renamed to `/bug-create <description>`; the `--knowledge <slug>` note that `test/knowledge-link-flag.test.js` reads is preserved.
- **Steps**:
  1. Run the command below as-is
- **Command**:
  ```bash
  node --test --test-name-pattern='CLAUDE.md Custom Commands table mentions' test/knowledge-link-flag.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. The test finds a `/bug-create` row (message on failure: `/bug-create row not found`) mentioning `--knowledge <slug>`.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js` (existing; contents updated by TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='CLAUDE.md Custom Commands table mentions' test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-007: uat-walk's Fail branch invokes the bug-create skill
- **Scenario**: `lib/skills/uat-walk/SKILL.md`'s Fail bullet says `` On yes: invoke `Skill` `bug-create` `` with a pre-filled description; the user-facing prompt wording stays unchanged.
- **Steps**:
  1. Run the command below as-is
- **Command**:
  ```bash
  node --test --test-name-pattern='yes branch invokes Skill bug-create' test/uat-fail-offers-bug-file.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js` (existing; contents updated by TASK-0114, filename retained by design)
- **Unit Test Command**: `node --test --test-name-pattern='yes branch invokes Skill bug-create' test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-008: uat-auto's summary suggests /bug-create for verifiable failures only
- **Scenario**: The uat-auto summary example reads `→ /bug-create "UAT-API-003: …"` nested under a verifiable failure and is omitted for "requires human verification" failures.
- **Steps**:
  1. Run the command below as-is (two name patterns: the suggestion and the omission)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='Summary format suggests /bug-create' --test-name-pattern='Summary format omits the /bug-create suggestion' test/uat-fail-offers-bug-file.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js` (existing; contents updated by TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='Summary format suggests /bug-create' --test-name-pattern='Summary format omits the /bug-create suggestion' test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: uat-auto never invokes bug-create; uat-auto-plus carries no bug-create affordance
- **Scenario**: The uat-auto Rules sentence reads "Bug-create suggestions … never call `/bug-create` itself" (no `Skill` call, no `AskUserQuestion`), and `uat-auto-plus` must remain reference-free.
- **Steps**:
  1. Run the command below as-is (two name patterns: uat-auto and uat-auto-plus)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='uat-auto never invokes the bug-create skill' --test-name-pattern='uat-auto-plus is out of scope' test/uat-fail-offers-bug-file.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js` (existing; contents updated by TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='uat-auto never invokes the bug-create skill' --test-name-pattern='uat-auto-plus is out of scope' test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-009: bug-create is a registered consumer of the shared boilerplate sections
- **Scenario**: `ALLOCATION_CONSUMERS` and `HYGIENE_CONSUMERS` in `test/skill-boilerplate.test.js` list `bug-create` (not the old name), so the skill still points at `SKILL-BOILERPLATE.md` § Number allocation and § Edit hygiene without restating them.
- **Steps**:
  1. Run the command below as-is (two name patterns: allocation and hygiene)
  2. Confirm exactly 2 tests ran and both passed
- **Command**:
  ```bash
  node --test --test-name-pattern='bug-create points at the shared Number allocation' --test-name-pattern='hygiene consumers point at the shared Edit hygiene section' test/skill-boilerplate.test.js
  ```
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` (existing; consumer arrays updated by TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='bug-create points at the shared Number allocation' --test-name-pattern='hygiene consumers point at the shared Edit hygiene section' test/skill-boilerplate.test.js`
- [FAIL: auto-judge: unit test failed after one retry — HYGIENE_CONSUMERS still lists deleted lib/skills/req-update/SKILL.md (TASK-0115 mid-edit; not a bug-create defect); allocation half passed, 1/2] <!-- 2026-09-19 -->

### UAT-INT-010: bug-create keeps the BUG-NNNN-<slug>.md filename rule and the Step 5a re-verify guard
- **Scenario**: The filename-convention test now reads `lib/skills/bug-create/SKILL.md` and still finds the 4-digit `BUG-NNNN-<slug>.md` rule plus Step 5a.
- **Steps**:
  1. Run the command below as-is
- **Command**:
  ```bash
  node --test --test-name-pattern='bug-create SKILL.md uses BUG-NNNN' test/wiki-work-naming-convention.test.js
  ```
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js` (existing; contents updated by TASK-0114)
- **Unit Test Command**: `node --test --test-name-pattern='bug-create SKILL.md uses BUG-NNNN' test/wiki-work-naming-convention.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-011: Bugs lifecycle doc and its template copy stay in lockstep and name /bug-create
- **Scenario**: `wiki/work/bugs/lifecycle.md` line 34 and `lib/scripts/templates/wiki/work/bugs/lifecycle.md` line 34 both read ``- **open** — filed (`/bug-create`); required-on-report fields present.`` (template-owned files are always-refreshed, so the two must not drift).
- **Steps**:
  1. Use Serena `search_for_pattern` for `filed \(` in `wiki/work/bugs/lifecycle.md`; note the matching line
  2. Repeat for `lib/scripts/templates/wiki/work/bugs/lifecycle.md`
  3. Compare the two lines
- **Expected Result**: Both files show line 34 as ``- **open** — filed (`/bug-create`); required-on-report fields present.`` — identical text, no old skill name. (UAT-INT-002 additionally proves neither file contains the old name.)
- **Repeatable Unit Test**: Not applicable: the no-old-name half is already asserted by scope (a) in UAT-INT-002; the lockstep half would need a new one-off doc-diff test for a single line
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-INT-012: bug-assess's no-bugs STOP message and the skills README row point at /bug-create
- **Scenario**: `lib/skills/bug-assess/SKILL.md` Step 1 STOP message reads `Use /bug-create <description> to file one.`; `lib/skills/README.md` has a `` `bug-create` `` table row whose description matches the new SKILL.md `description:` (verb "Create a new bug report…").
- **Steps**:
  1. Use Serena `search_for_pattern` for `bug-create` in `lib/skills/bug-assess/SKILL.md`; confirm the STOP message text
  2. Use Serena `search_for_pattern` for `bug-create` in `lib/skills/README.md`; confirm one table row with a "Create a new bug report" description
  3. Use Serena `search_for_pattern` for `^description:` in `lib/skills/bug-create/SKILL.md` and confirm it begins "Create a new bug report in wiki/work/bugs/"
- **Expected Result**: All three locations use `bug-create`, the STOP message is unchanged apart from the name, and the README row is not duplicated or left under the old name.
- **Repeatable Unit Test**: Not applicable: the STOP message and README row are prose surfaces with no existing pinned test; the no-old-name half is covered by scope (a) in UAT-INT-002
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

---

## Observations and Gaps (not test cases)

- **Out-of-list edits**: the task's own log records edits outside its declared Step 5 list to `TASK-0105` (L22, L94) and `UAT-0088` (L23). They are live-path/invocation edits of the same kind as the listed items and are covered by UAT-INT-003 (scope b), but they were not in the task's file list. Recorded as an observation for the reviewer; no case asserts on them.
- **Residue-sweep exclusions verified**: `wiki/work/uat/index.md` **is** excluded from the sweep (`EXCLUDED_PATTERNS` matches `/^wiki\/work\/[^/]+\/index\.md$/`), so the historical UAT-0086/0091/0095 index lines that still name the old skill do not trip scope (a). No gap.
- **Retained on purpose**: `test/uat-fail-offers-bug-file.test.js` and `test/bug-file-status-open.test.js` keep their filenames (task-slug-derived); several commands above therefore reference them by their old filenames intentionally.
- **Deliberately not asserted**: `req-update` / `task-update` (being deleted by TASK-0115), and the known-failing pre-existing tests (`skill-frontmatter-aliases` x4, the `task-typed-links` Step 5 dependency-link-placement test). No case requires the full `npm test` suite to exit 0.
- **No new unit test files written**: every promotable assertion is already covered by `test/bug-create-rename-residue.test.js` (shipped with TASK-0114) or the updated pinned suites; nothing new was needed.
