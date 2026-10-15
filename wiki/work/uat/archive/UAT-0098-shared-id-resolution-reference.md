---
id: UAT-0098
aliases: [UAT-0098]
title: "UAT: Extract a shared ID/file-resolution reference doc and wire the consuming skills to it"
status: passed
task: TASK-0098
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0098 — UAT: Extract a shared ID/file-resolution reference doc and wire the consuming skills to it

implements::[[TASK-0098]]

> **Source task**: [[TASK-0098]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [x] Repo checked out at the TASK-0098 implementation (`lib/skills/_shared/ID-RESOLUTION.md` present)
- [x] Node.js available (`node --test` runner; no other dependencies)
- [x] Run from the repo root. Every command below is file-scoped to `test/shared-id-resolution.test.js`; none requires the full `npm test` suite (which has unrelated pre-existing failures)

> Scope note: these cases assert on the resolution **wiring** (the `ID-RESOLUTION.md` pointer lines and the shared doc), not on the surrounding header/prereqs/number-allocation boilerplate that TASK-0099 relocates.

---

## Test Cases

### UAT-INT-001: Shared doc defines prefixes, accepted forms, legacy fallback, ambiguity modes, and scopes
- **Scenario**: `lib/skills/_shared/ID-RESOLUTION.md` is the single copy of the resolution procedure. It names all six family prefixes (`REQ`, `DEC`, `ROADMAP`, `TASK`, `UAT`, `BUG`), the five accepted forms (Path, Full ID or ID-slug, `NNN-slug`, Bare number, Empty / free-text), the `pad3` legacy 3-digit mask fallback, both ambiguity modes (interactive via `AskUserQuestion`, headless never prompts), the `File not found: <path>` and `No <family> matching '<input>' found.` STOPs, the `#DM` split-before-resolve rule, and all three search scopes (`active`, `active+archive`, `active-then-archive-gate`).
- **Steps**: Run the unit test command below.
- **Expected Result**: The `(a)` and `(a2)` tests pass (2 tests, exit code 0).
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(a2?\)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-002: All 18 consumer files reference the shared doc
- **Scenario**: The 17 wired `SKILL.md` files (`req-update`, `req-retire`, `req-finalize`, `req-compile`, `req-extract-decisions`, `decision-finalize`, `decision-walkthrough`, `decision-next`, `roadmap-next`, `bug-triage`, `bug-close`, `tackle`, `task-trash`, `task-update`, `uat-skip`, `uat-generate`, `task-add`) and `uat-walk/UAT-CORE.md` (which covers `uat-walk`, `uat-auto`, `uat-auto-plus`) each contain the `ID-RESOLUTION.md` pointer.
- **Steps**: Run the unit test command below.
- **Expected Result**: All 18 `(b)` tests pass, exit code 0.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(b\)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-003: No wired file retains the broken inline pad-width or `NNN-*.md` mask text
- **Scenario**: The drifted per-skill resolution tables are gone. None of the 18 wired files contains `Pad to 3 digits` / `Pad to 4 digits` or a `NNN-*.md` / `NNNN-*.md` mask (the prefix-less masks that could never match a real `PREFIX-NNNN-slug.md` filename). The shared doc is deliberately excluded because it names the legacy masks on purpose.
- **Steps**: Run the unit test command below.
- **Expected Result**: All 18 `(c)` tests pass, exit code 0.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(c\)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-004: Wired SKILL.md files keep their `argument-hint:` frontmatter
- **Scenario**: Replacing the resolution table did not clobber frontmatter. Each wired `SKILL.md` that had an `argument-hint:` line (all except `req-compile`, which never had one) still opens with a frontmatter block containing it.
- **Steps**: Run the unit test command below.
- **Expected Result**: All 16 `(d)` tests pass, exit code 0.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(d\)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-005: Each consumer's wiring line declares the family and scope the Caller-deltas table prescribes
- **Scenario**: Beyond presence, the pointer line is correct. Every `SKILL.md` wiring line reads `ID-RESOLUTION.md — family: <f> · scope: <s> · ambiguous: <mode>` with the expected pair: requirements skills → `requirements`/`active`; decision skills → `decisions`/`active`; `roadmap-next` → `roadmaps`/`active`; `bug-triage` → `bugs`/`active`; `bug-close` → `bugs`/`active-then-archive-gate`; `tackle`, `task-update`, `uat-skip`, `uat-generate` → `tasks`/`active`; `task-trash` → `tasks`/`active+archive`; `task-add` → two lines (`decisions`/`active`, `roadmaps`/`active`); `UAT-CORE.md` → `uat`/`active` with interactive-for-uat-walk and headless-for-uat-auto modes. Every family used exists in the shared doc's family table with the right directory and prefix.
- **Steps**: Run the unit test command below.
- **Expected Result**: All 19 `(e)` tests pass, exit code 0.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(e\)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: Documented 4-digit-then-3-digit masks resolve the worked examples against the real tree
- **Scenario**: Applying the documented algorithm (parse digits to an integer, try `PREFIX-<pad4>-*.md` then `PREFIX-<pad3>-*.md`) to the real `wiki/work/` tree yields exactly the documented results: bare `86` → `TASK-0086-uat-fail-offers-bug-file.md`; `TASK-074` and `074-serena-project-from-cwd` → legacy `TASK-074-serena-project-from-cwd.md`; roadmap `11` → legacy `ROADMAP-011-build-bootstrap-prefs-tui.md`; bug `6` → `BUG-0006-…`; uat `87` → exactly one match; `DEC-0001#D2` (archive scope, `#DM` stripped) → `DEC-0001-wiki-cross-family-linking-schema.md`; task `9999` → zero matches. Also, the retired prefix-less masks match no real filename, and within each consumer search scope (every family `active`; tasks `active+archive`) no item number exists at both widths, so a bare number never resolves ambiguously.
- **Steps**: Run the unit test command below.
- **Expected Result**: All 3 `(i)` tests pass, exit code 0.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(i\)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Family directories exist, every item filename is reachable by a documented mask, and cited example files exist
- **Scenario**: All six family directories in the shared doc's table exist. Every work-item filename in each family (active and `archive/`, excluding `index.md`/`lifecycle.md`) matches `PREFIX-<3 or 4 digits>-<slug>.md`, so no file is unreachable by the two-width mask order. Every real filename cited in the doc's Worked examples section exists on disk, and the examples cover every accepted form (Path, Full ID, ID-slug, Legacy ID, `NNNN-slug`, `NNN-slug`, Bare number, Empty) plus the zero-match STOP.
- **Steps**: Run the unit test command below.
- **Expected Result**: The `(f)` test and both `(g)` tests pass (3 tests, exit code 0).
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\((f|g)\)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-006: `_shared/` is not registered as a skill and ships through install and pack
- **Scenario**: `lib/skills/_shared/` has no `SKILL.md` (so it does not become a slash command), `lib/scripts/install-global.sh` still rsyncs `lib/skills/` verbatim (so `_shared/ID-RESOLUTION.md` reaches `~/.claude/skills/_shared/`), and `package.json` `files` includes `lib/` with no negation of `_shared`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The `(h)` test passes (1 test, exit code 0).
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(h\)' test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-007: Whole contract suite is green
- **Scenario**: All contract checks for TASK-0098 (81 tests: original 54 plus the wiring, tree-fidelity, and delivery additions) pass together in one file-scoped run.
- **Steps**: Run the unit test command below. Do not substitute `npm test` (unrelated pre-existing failures make the full suite unsatisfiable).
- **Expected Result**: `ℹ fail 0`, exit code 0.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

---

## Notes

- **Not covered headlessly**: live agent behavior (an interactive `AskUserQuestion` on ambiguity, a headless STOP in `uat-auto`) cannot be exercised by a unit test; the contract tests pin the documented wording and wiring only.
- **Observation (not a failure)**: `wiki/work/uat/` holds both active `UAT-0085-…` and archived legacy `UAT-085-trash-task-073.md`. No consumer searches the `uat` family with an archive scope (`uat` is `active` only), so resolution of `85` is unambiguous today. If a future consumer searches `uat` with `active+archive`, the pad4-first-match order would silently hide the legacy file; UAT-EDGE-001 checks the scopes consumers actually use and will flag a real collision inside them.
