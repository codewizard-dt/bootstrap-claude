---
id: UAT-0112
aliases: [UAT-0112]
title: "UAT: Rename the task-add skill to task-create"
status: passed
task: TASK-0112
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0112 — UAT: Rename the task-add skill to task-create

implements::[[TASK-0112]]

> **Source task**: [[TASK-0112]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Repo checked out at the TASK-0112 implementation (`lib/skills/task-create/SKILL.md` present)
- [ ] Node.js available (`node --test` runner; no other dependencies)
- [ ] Commands are file-scoped on purpose: the whole `npm test` suite is not a valid oracle here. Five pre-existing failures are out of scope for this task (4 in `test/skill-frontmatter-aliases.test.js` and 1 in `test/task-typed-links.test.js`, all `TASK-NNN` vs `TASK-NNNN` placeholder pins), and other tasks are editing shared files concurrently. Use explicit file paths, not `node --test test/` (fails on Node v26)
- [ ] Every `--test-name-pattern` below was verified to select exactly one passing test; a run reporting `tests 0` means the test title drifted and the case needs re-authoring, not a pass

---

## Test Cases

### UAT-EDGE-001: New skill directory exists with `name: task-create`; old directory is gone
- **Scenario**: Per the hard-rename decision (ROADMAP-0014 Notes, no redirect stub), `lib/skills/task-add/` no longer exists and `lib/skills/task-create/SKILL.md` exists with frontmatter `name: task-create`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "old skill directory is gone; lib/skills/task-create/SKILL.md exists with name: task-create" test passes (exit code 0, `tests 1 pass 1 fail 0`).
- **Repeatable Unit Test**: Created: `test/task-create-rename-residue.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='old skill directory is gone' test/task-create-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Git tracks no file under the old skill directory
- **Scenario**: After the `git mv`, the index holds nothing under `lib/skills/task-add/`, so no stale copy of the skill can be shipped or installed from the repo.
- **Steps**: Run the command below from the repo root.
- **Command**:
  ```bash
  git ls-files lib/skills/task-add
  ```
- **Expected Result**: Empty output, exit code 0.
- **Repeatable Unit Test**: Not applicable: asserts git index state, which a hermetic unit test does not read (the directory-absence half is covered by UAT-EDGE-001)
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Residue sweep finds no live reference to the old name
- **Scenario**: A repo-wide walk finds no live file containing the old hyphenated skill name. The sweep skips the documented historical set: `.git/`, `node_modules/`, `raw/`, `.docs/`, `.serena/cache/`, `wiki/log.md`, `wiki/hot.md`, `wiki/knowledge/sources/`, any `archive/` directory, `wiki/work/*/index.md` (this UAT's own index row quotes the old name in its title), and any basename starting `TASK-`, `UAT-`, `BUG-`, `ROADMAP-`, or `DEC-`.
- **Steps**: Run the unit test command below. On failure the assertion message lists every offending `path:line`.
- **Expected Result**: The "residue sweep: no live file in the repo references the old skill name" test passes.
- **Repeatable Unit Test**: Created: `test/task-create-rename-residue.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='residue sweep' test/task-create-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Skills README lists `task-create` and not the old name
- **Scenario**: `lib/skills/README.md` has the `task-create` row and no mention of the old skill name.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "lib/skills/README.md lists task-create and does not list the old name" test passes.
- **Repeatable Unit Test**: Created: `test/task-create-rename-residue.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='lists task-create and does not list the old name' test/task-create-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: CLAUDE.md Custom Commands row names `/task-create` and keeps its flags text
- **Scenario**: The checked-in `CLAUDE.md` Custom Commands table row for the renamed skill is `/task-create <desc>` and still advertises the `--knowledge <slug>` flag (the row-lookup and both assertion messages in the suite were moved to the new name).
- **Steps**: Run the unit test command below.
- **Expected Result**: The "CLAUDE.md Custom Commands table mentions --knowledge <slug> for /task-create and /bug-file" test passes.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='Custom Commands table mentions' test/knowledge-link-flag.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: Sibling skills invoke or advertise `task-create`
- **Scenario**: `bug-close` Step 10's "yes" branch invokes `Skill` `task-create` (without `--roadmap`), and the `decision-next` frontmatter `description:` reads "...surface suggested /task-create command".
- **Steps**: Run both unit test commands below.
- **Expected Result**: Both tests pass, each reporting `tests 1 pass 1 fail 0`.
- **Repeatable Unit Test**: Created: `test/bug-close-clustering-offer.test.js`, `test/wiki-lint-taskless-decisions.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='"yes" branch files a regression task via Skill task-create' test/bug-close-clustering-offer.test.js` then `node --test --test-name-pattern='decision-next behavior is unchanged' test/wiki-lint-taskless-decisions.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: Skill behaviour is unchanged by the rename (flags, steps, dependency skeleton)
- **Scenario**: Only the name changed. `task-create/SKILL.md` still advertises and parses `--knowledge <slug>` (Step 2b), still scans `wiki/work/bugs/index.md` for an origin bug in Step 5, and still carries its Step 5 relation definitions and frontmatter skeleton.
- **Steps**: Run the three unit test commands below.
- **Expected Result**: All three tests pass, each reporting `tests 1 pass 1 fail 0`.
- **Repeatable Unit Test**: Created: `test/knowledge-link-flag.test.js`, `test/task-create-origin-bug-scan.test.js`, `test/task-dependency-fields-content.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='task-create/SKILL.md Step 2b detects --knowledge' test/knowledge-link-flag.test.js` then `node --test --test-name-pattern='Step 5 scans wiki/work/bugs/index.md' test/task-create-origin-bug-scan.test.js` then `node --test --test-name-pattern='task-create keeps its Step 5 relation definitions' test/task-dependency-fields-content.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Renamed origin-bug-scan suite guards against editing the machine-local copy
- **Scenario**: `test/task-add-origin-bug-scan.test.js` was `git mv`'d to `test/task-create-origin-bug-scan.test.js`, and its machine-local-copy guard still asserts the lowercased `~/.claude/skills/task-create/skill.md` path is absent from the skill text.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "task-create SKILL.md never names the machine-local skill copy as an edit target" test passes.
- **Repeatable Unit Test**: Created: `test/task-create-origin-bug-scan.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='never names the machine-local skill copy' test/task-create-origin-bug-scan.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: Shared-resolution and boilerplate wiring track the new skill name
- **Scenario**: `shared-id-resolution` pins `lib/skills/task-create/SKILL.md` as wired to `decisions`/`roadmaps` (family-map key renamed), and `skill-boilerplate` lists `task-create` among the Number-allocation consumers that point at the shared section.
- **Steps**: Run both unit test commands below.
- **Expected Result**: Both tests pass, each reporting `tests 1 pass 1 fail 0`.
- **Repeatable Unit Test**: Created: `test/shared-id-resolution.test.js`, `test/skill-boilerplate.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(e\) lib/skills/task-create/SKILL.md wiring declares family/scope' test/shared-id-resolution.test.js` then `node --test --test-name-pattern='task-create points at the shared Number allocation section' test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: Dependency-source and naming-convention suites read the renamed skill path
- **Scenario**: `task-dependency-single-source` and `wiki-work-naming-convention` read `lib/skills/task-create/SKILL.md` (their path constants and titles were updated) and their assertions on it still hold.
- **Steps**: Run both unit test commands below.
- **Expected Result**: Both tests pass, each reporting `tests 1 pass 1 fail 0`.
- **Repeatable Unit Test**: Created: `test/task-dependency-single-source.test.js`, `test/wiki-work-naming-convention.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='lib/skills/task-create/SKILL.md points at tasks/lifecycle.md' test/task-dependency-single-source.test.js` then `node --test --test-name-pattern='task-create SKILL.md points at shared Number allocation' test/wiki-work-naming-convention.test.js`
- [x] Pass <!-- 2026-09-19 -->
