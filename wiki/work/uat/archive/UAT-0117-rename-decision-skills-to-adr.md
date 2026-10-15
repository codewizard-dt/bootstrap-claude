---
id: UAT-0117
aliases: [UAT-0117]
title: "UAT: Rename the decisions family's skills to ADR and make ADR- the new-item prefix"
status: passed
task: TASK-0117
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0117 — UAT: Rename the decisions family's skills to ADR and make ADR- the new-item prefix

implements::[[TASK-0117]]

> **Source task**: [[TASK-0117]]
> **Generated**: 2026-09-19

TASK-0117 is a markdown-as-program rename: nothing runs except tests, so every case below is backed by a deterministic `node:test` file that reads the repo itself. Each `Unit Test Command` was run before this file was written, and each `--test-name-pattern` was confirmed to select exactly the intended passing test(s) (a pattern matching zero tests would be an authoring bug). Test files are passed explicitly (never `node --test test/`).

**Out of scope on purpose**: `req-extract-decisions` / `adr-extract` (TASK-0118 is mid-change), `install-global.sh`, and the full `npm test` suite (it carries known pre-existing failures — `skill-frontmatter-aliases` x4 and `task-typed-links` x1 — that are not this task's; no case here requires a green full suite).

---

## Prerequisites

- [ ] Working directory is the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`) with TASK-0117's implementation present
- [ ] `node` >= 18 on PATH (`node --test` with `--test-name-pattern`)
- [ ] No network, secrets, or running services needed — all cases are read-only

---

## Test Cases

### UAT-EDGE-001: The four skill directories are renamed and the old ones are gone
- **Scenario**: `decision-create`, `decision-finalize`, `decision-walkthrough`, `decision-next` are hard-renamed (no redirect stub) to `adr-create`, `adr-finalize`, `adr-walkthrough`, `adr-next`; each new `lib/skills/adr-*/SKILL.md` exists and its frontmatter `name:` equals its directory name.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm one test runs and passes (`(c) old skill directories are gone; each new skill has SKILL.md with name equal to its directory`)
- **Expected Result**: `lib/skills/{decision-create,decision-finalize,decision-walkthrough,decision-next}/` do not exist; `lib/skills/adr-{create,finalize,walkthrough,next}/SKILL.md` exist with `name: adr-<x>`. `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-rename-residue.test.js` (shipped with TASK-0117, 7 tests)
- **Unit Test Command**: `node --test --test-name-pattern='\(c\) old skill directories are gone' test/adr-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: No live code, doc, or open work item still cites an old skill name or path
- **Scenario**: Scope (a) — no `lib/**`, `test/**`, `bin/**`, `README.md`, `CLAUDE.md`, `ELEVATOR_PITCH.md`, `.serena/memories/**`, knowledge concept/entity pages, `wiki/conventions.md`, or `wiki/work/*/lifecycle.md` line contains an old skill name. Scope (b) — no non-archive `wiki/work/**` file (other than TASK-0117's own narrating file) contains the live-path forms `lib/skills/decision-…` or `skills/decision-…`, so `/tackle` and `/uat-walk` against open items still resolve.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm two tests run and pass: `(a) no live code/doc file references an old skill name` and `(b) no work item points at an old skill live path`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`. On a failure the assertion message lists the offending `path:line` pairs. Historical records (`wiki/log.md`, `raw/**`, `**/archive/**`, `wiki/knowledge/sources/**`, terminal item bodies, family-index lines) are deliberately excluded and must not be edited to satisfy this case.
- **Repeatable Unit Test**: Created: `test/adr-rename-residue.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='no live code/doc file references|no work item points at' test/adr-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: adr-create allocates the next number as max(N)+1 across ADR- and DEC- as one sequence
- **Scenario**: Design decision 2 — `adr-create` Step 2 counts every `ADR-NNNN-*` **and** legacy `DEC-NNNN-*` filename (3- or 4-digit, active plus `archive/`) so a new `ADR-0002` can never collide with `DEC-0001` (which the later migration renames to `ADR-0001`). `SKILL-BOILERPLATE.md` § Number allocation records the decisions row as prefix `ADR-` with legacy `DEC-` counted, and Step 4.5's re-verify guard repeats the same both-prefix rule.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm three tests run and pass: `(d) adr-create states the both-prefix number allocation`, `(d) SKILL-BOILERPLATE decisions row has prefix ADR- and counts legacy DEC-`, and `adr-create Step 4.5 re-verify repeats the both-prefix max(N)+1 allocation rule`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`. The skill line states "one number sequence across both prefixes", names `ADR-NNNN-*`, `DEC-NNNN-*`, and `max(N)+1`; the `SKILL-BOILERPLATE.md` decisions row prefix cell is `` `ADR-` `` and says legacy `DEC-` filenames are counted; Step 4.5 says the same rule.
- **Repeatable Unit Test**: Created: `test/adr-rename-residue.test.js` (2 of its tests) and `test/adr-rename-invariants.test.js` (written by this UAT generation, 3 tests)
- **Unit Test Command**: `node --test --test-name-pattern='both-prefix|decisions row has prefix ADR- and counts legacy|Step 4\.5 re-verify repeats' test/adr-rename-residue.test.js test/adr-rename-invariants.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: DEC-0001 and its file are untouched, and wiki/work/decisions/ is intact
- **Scenario**: The pre-existing `DEC-0001` item is not renamed by this task: its file is still `wiki/work/decisions/archive/DEC-0001-wiki-cross-family-linking-schema.md` with frontmatter `id: DEC-0001` and `aliases: [DEC-0001]`; the `wiki/work/decisions/` directory name is kept and still holds `lifecycle.md`, `index.md`, and `archive/`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm the single test `DEC-0001 keeps its file name, id and aliases, and the decisions directory is intact` passes
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. (Content of the DEC-0001 body — e.g. block statuses set by earlier tasks — is out of scope; only name, `id`, `aliases`, and the directory are asserted. When the later `update` migration renames DEC- items, that change updates this test.)
- **Repeatable Unit Test**: Created: `test/adr-rename-invariants.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='DEC-0001 keeps its file name' test/adr-rename-invariants.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: DEC-0001#D2 and ADR-0001#D2 both still resolve to the DEC-0001 file
- **Scenario**: Legacy references must keep resolving until migration. The documented masks (tried per width) resolve `DEC-0001#D2` (`#D2` stripped) with `{ archive: true }` scope to `DEC-0001-wiki-cross-family-linking-schema.md`, and `ADR-0001#D2` resolves to the same file by number (the number, not the input's prefix, selects the file).
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm the single test `(i) documented masks resolve the documented worked examples on the real tree` passes
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. That test also re-checks the task/roadmap/bug/uat examples and that `tasks '9999'` matches nothing.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js` (extended by TASK-0117)
- **Unit Test Command**: `node --test --test-name-pattern='documented masks resolve the documented worked examples' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: ID-RESOLUTION mask order is ADR before DEC, and the decisions row declares both prefixes
- **Scenario**: For the decisions family the documented mask order is `ADR-<pad4>-*`, `ADR-<pad3>-*`, then legacy `DEC-<pad4>-*`, `DEC-<pad3>-*` (current prefix first, then legacy, each at both widths). The family-table row declares `ADR` as the prefix with `DEC` as legacy, and the worked-examples section carries both a legacy `DEC-0001#D2` row and an `ADR-NNNN#DM` row.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm three tests run and pass: `(e) decisions family row declares prefix ADR with the legacy DEC fallback`, `(g) worked examples contain DEC-0001#D2 (legacy) and ADR-NNNN#DM rows for the decisions family`, and `(i) the decisions mask order is ADR-<pad4>, ADR-<pad3>, DEC-<pad4>, DEC-<pad3> …`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`. The legacy-prefix support lives in the family table (a one-table edit), not scattered through the Procedure.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='decisions mask order is ADR|decisions family row declares prefix ADR|worked examples contain DEC-0001#D2' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: The ID-RESOLUTION.md decisions row lists ADR as current and DEC as legacy
- **Scenario**: The `decisions` row in the `ID-RESOLUTION.md` family table has prefix cell `` `ADR` `` and a Notes cell that names `DEC` as the legacy prefix (files not yet migrated).
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm the single test `(d) ID-RESOLUTION decisions row has prefix ADR and lists the legacy DEC prefix` passes
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-rename-residue.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='ID-RESOLUTION decisions row has prefix ADR' test/adr-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Both decisions lifecycle.md copies are in lockstep and state the ADR ID scheme
- **Scenario**: `wiki/work/decisions/lifecycle.md` and `lib/scripts/templates/wiki/work/decisions/lifecycle.md` are byte-identical, state the `ADR-NNNN` (4-digit, zero-padded) scheme, and mention that pre-existing `DEC-NNNN` items keep their IDs until migration. The bugs and decisions lifecycles both state 4-digit ID schemes.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm two tests run and pass: `both decisions lifecycle.md copies (wiki/ and template) are byte-identical` and `bugs/decisions lifecycle.md state 4-digit ID schemes`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-rename-invariants.test.js` (lockstep test, written by this UAT generation) and `test/wiki-work-naming-convention.test.js` (existing, updated by TASK-0117)
- **Unit Test Command**: `node --test --test-name-pattern='byte-identical|bugs/decisions lifecycle' test/adr-rename-invariants.test.js test/wiki-work-naming-convention.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: adr-create writes new items as ADR-NNNN (frontmatter, H1, filename)
- **Scenario**: `adr-create`'s Step 5 template opens a new file with `id: ADR-NNNN`, `aliases: [ADR-NNNN]`, H1 `# ADR-NNNN:`, and the skill still has its Step 4.5 re-verify guard and uses `ADR-NNNN`. The frontmatter block adds no `title`/`created`/`updated`/`tags` keys beyond the existing template.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm two tests run and pass: `adr-create SKILL.md has Step 4.5 re-verify guard and uses ADR-NNNN` and `adr-create/SKILL.md Step 5 template opens with a new frontmatter block carrying aliases: [ADR-NNNN]`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`. (The pattern deliberately selects only these two `skill-frontmatter-aliases` / naming-convention tests; the known pre-existing failures in `skill-frontmatter-aliases.test.js` are not selected.)
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js` and `test/skill-frontmatter-aliases.test.js` (both updated by TASK-0117)
- **Unit Test Command**: `node --test --test-name-pattern='adr-create SKILL.md has Step 4\.5 re-verify guard and uses ADR-NNNN|adr-create/SKILL\.md Step 5 template opens with a new frontmatter block carrying aliases' test/wiki-work-naming-convention.test.js test/skill-frontmatter-aliases.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: adr-create is still wired to the shared Number allocation doc and keeps its prior-art scan
- **Scenario**: Renaming did not break `adr-create`'s pointer to `SKILL-BOILERPLATE.md` § Number allocation (it points, it does not restate) nor its Step 1 knowledge prior-art scan (TASK-0089).
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm two tests run and pass: `adr-create points at the shared Number allocation section and does not restate it` and `adr-create Step 1 scan reads wiki/index.md Concepts and Sources sections …`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` and `test/prior-art-scan.test.js` (both updated by TASK-0117; filenames retained on purpose)
- **Unit Test Command**: `node --test --test-name-pattern='adr-create points at the shared Number allocation|adr-create Step 1 scan reads' test/skill-boilerplate.test.js test/prior-art-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-011: wiki-lint 2.12 prints the ADR-NNNN#DM format and adr-next behavior is unchanged
- **Scenario**: `wiki-lint` check 2.12's report line is `[MEDIUM] task-less accepted decision — ADR-NNNN#DM (<title>) has no Source task(s) link`; `adr-next` keeps its verbatim 2.12 cross-reference, is still Haiku, still narrow, and still stops at the first gap.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm three tests run and pass: `wiki-lint 2.12 uses the exact MEDIUM report format`, `adr-next carries the verbatim 2.12 cross-reference …`, `adr-next behavior is unchanged: still Haiku, still narrow, still stops at the first gap`
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/wiki-lint-taskless-decisions.test.js` (updated by TASK-0117; filename retained on purpose)
- **Unit Test Command**: `node --test --test-name-pattern='uses the exact MEDIUM report format|adr-next behavior is unchanged|adr-next carries the verbatim' test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-012: wiki-lint 2.11 resolves both ADR- and legacy DEC- decision targets
- **Scenario**: Design decision 3 (skills read both forms) — 2.11 typed-link target resolution accepts `ADR-NNNN` / `ADR-NNNN#DM` and legacy `DEC-NNNN` / `DEC-NNNN#DM` against `decisions/` and `decisions/archive/`, and still reports links to superseded decisions separately as informational `[LOW]`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm two tests run and pass: `2.11 resolves ADR-NNNN / ADR-NNNN#DM (and legacy DEC-NNNN / DEC-NNNN#DM) targets …` and `2.11 reports links to superseded decisions separately as informational [LOW], not broken`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/wiki-lint-typed-link-resolution.test.js` (updated by TASK-0117)
- **Unit Test Command**: `node --test --test-name-pattern='2\.11 resolves ADR-NNNN|superseded decisions separately' test/wiki-lint-typed-link-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-013: CLAUDE.md and wiki/conventions.md use 4-digit tokens with ADR-NNNN present
- **Scenario**: The repo doc and the conventions file carry `ADR-NNNN` (alongside `BUG-NNNN`) for the work families and no stale 3-digit placeholder tokens.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm the single test `CLAUDE.md and wiki/conventions.md use 4-digit tokens with ADR-NNNN/BUG-NNNN present` passes
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/wiki-work-naming-convention.test.js` (updated by TASK-0117)
- **Unit Test Command**: `node --test --test-name-pattern='CLAUDE.md and wiki/conventions.md use 4-digit tokens' test/wiki-work-naming-convention.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-015: The /task-create row in CLAUDE.md still advertises --knowledge after the --decision hint edit
- **Scenario**: TASK-0117 changed the `--decision` hint in the `/task-create` Custom Commands row to `ADR-NNNN#DM` (legacy `DEC-` accepted); `test/knowledge-link-flag.test.js` reads that row and must still find `--knowledge <slug>` for `/task-create` and `/bug-create`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm the single test `CLAUDE.md Custom Commands table mentions --knowledge <slug> for /task-create and /bug-create` passes
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js` (updated by TASK-0117)
- **Unit Test Command**: `node --test --test-name-pattern='CLAUDE.md Custom Commands table mentions' test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-014: The alias backfill handles an ADR- prefixed work item
- **Scenario**: `backfill-wiki-aliases` must add `aliases: [ADR-0900]` to a `wiki/work/decisions/ADR-0900-x.md` file with `id: ADR-0900` (no prefix enumeration in the backfill regex), alongside the legacy `0900-x.md` / `DEC-0900` fixture and every other family.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm the single test `covers all 6 work families` passes
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/backfill-wiki-aliases.test.js` (fixture `wiki/work/decisions/ADR-0900-x.md` added by TASK-0117)
- **Unit Test Command**: `node --test --test-name-pattern='covers all 6 work families' test/backfill-wiki-aliases.test.js`
- [x] Pass <!-- 2026-09-19 -->

---

## Observations (not test cases)

These are recorded for the walker/reviewer; none is a pass/fail criterion of this UAT.

1. **Mask-order deviation from the task text.** TASK-0117 design decision 1 says masks are tried `ADR-<pad4>`, `DEC-<pad4>`, `ADR-<pad3>`, `DEC-<pad3>`; the implementation (and `ID-RESOLUTION.md`, and the Step 2 note in the task) uses `ADR-<pad4>`, `ADR-<pad3>`, `DEC-<pad4>`, `DEC-<pad3>` — current prefix at both widths, then the legacy prefix at both widths, reusing TASK-0116's mechanism. Results are identical: one number sequence means a given number never exists under both prefixes. UAT-EDGE-006 pins the implemented order; the task text is stale on this point.
2. **UAT-0093 / TASK-0093 still quote the old 2.12 output format.** `UAT-0093` (its 2.12 Scenario line) and `TASK-0093` (its report-format checklist item) still say the report line is `[MEDIUM] task-less accepted decision — DEC-NNNN#DM (<title>) …`, whereas `wiki-lint` 2.12 now prints `ADR-NNNN#DM`. The skill is authoritative and UAT-EDGE-011 pins the new format; UAT-0093's prose was left alone per TASK-0117's "output format, not a live path" note. A walker of UAT-0093 should expect that case's literal format string to disagree with the skill until that UAT is regenerated or its wording is amended.
3. **TASK-0101 log-entry prose (Step 3 checklist, ~L64).** `TASK-0101` still asks to verify "`wiki/log.md` has a `decision-create` entry"; the skill now logs `adr-create | ADR-NNNN …`. Only invocation/path lines were in TASK-0117's edit scope, so this log-op prose (and TASK-0101's Approach/Objective prose) is retained as historical wording.
4. **Retained on purpose (not residue).** Task-slug-derived filenames (`TASK-0089-decision-roadmap-prior-art-scan.md`, `TASK-0093-fold-decision-next-into-wiki-lint.md`, `TASK-0101-decision-group-supersession-scoring.md`), the test filenames `test/wiki-lint-taskless-decisions.test.js` and `test/prior-art-scan.test.js` (open UATs cite them in `Unit Test Command` lines), work-item titles, and all `DEC-0001` references.
5. **Known pre-existing failures, unrelated.** `test/skill-frontmatter-aliases.test.js` (4) and `test/task-typed-links.test.js` (1) fail independently of this task; no case above selects them. The full `npm test` suite is intentionally not a UAT criterion.
