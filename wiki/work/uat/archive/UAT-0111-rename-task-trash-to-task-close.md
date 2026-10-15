---
id: UAT-0111
aliases: [UAT-0111]
title: "UAT: Rename task-trash to task-close"
status: passed
task: TASK-0111
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0111 — UAT: Rename task-trash to task-close

implements::[[TASK-0111]]

> **Source task**: [[TASK-0111]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Repo checked out at the TASK-0111 implementation (`lib/skills/task-close/SKILL.md` present)
- [ ] Node.js available (`node --test` runner; no other dependencies)
- [ ] Commands are file-scoped on purpose: the whole `npm test` suite is not a valid oracle here (known sibling failures plus in-flight edits from other tasks). Use explicit file paths, not `node --test test/` (fails on Node v26)

---

## Test Cases

### UAT-EDGE-001: New skill directory exists with `name: task-close`
- **Scenario**: `lib/skills/task-close/SKILL.md` exists and its frontmatter carries `name: task-close`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "exists with name: task-close" test passes (exit code 0).
- **Repeatable Unit Test**: Created: `test/task-close-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='exists with name: task-close' test/task-close-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Old skill directory is gone, no redirect stub
- **Scenario**: Per ROADMAP-0014 Note 4 the old trash-named skill directory is hard-renamed away; no redirect stub or alias directory remains under `lib/skills/`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "old skill directory is gone (no redirect stub)" test passes.
- **Repeatable Unit Test**: Created: `test/task-close-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='old skill directory is gone' test/task-close-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Behaviour is unchanged by the rename
- **Scenario**: `lib/skills/task-close/SKILL.md` still delegates archiving with `` `terminal_status: trashed` `` and `` `family: uat` ``, still uses the `task-trashed` log op, and still carries the "Do NOT remove references from roadmaps, decisions, or other files" rule. Its archive-work-item wiring (task passes `trashed` with log op `task-trashed`, UAT family archived) is pinned by the existing archive test.
- **Steps**: Run both unit test commands below.
- **Expected Result**: The behaviour-surface test and the archive-work-item wiring test both pass.
- **Repeatable Unit Test**: Created: `test/task-close-rename.test.js`, `test/archive-work-item.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='keeps its behaviour surface' test/task-close-rename.test.js` then `node --test --test-name-pattern='task-close passes trashed' test/archive-work-item.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Skill header uses the new wording, frontmatter otherwise retained
- **Scenario**: `description:` leads with "Close" while keeping the `trashed` semantics; `category: planning` and `argument-hint: <path/to/task-file.md>` are unchanged; the H1 is `# Close Task` and the old `# Trash Task` H1 is gone.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "task-close header" test passes.
- **Repeatable Unit Test**: Created: `test/task-close-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='task-close header' test/task-close-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: Shared docs, skills README, CLAUDE.md and sibling skills list the new name
- **Scenario**: `_shared/ID-RESOLUTION.md` has a `task-close` family-table row, `lib/skills/README.md` lists `task-close`, the `CLAUDE.md` Custom Commands table lists `/task-close <path>`, and `wiki-tidy` and `req-retire` name the new skill.
- **Steps**: Run the unit test commands below (the second checks the shared-resolution wiring that enumerates `task-close` as a wired skill mapped to `tasks` / `active+archive`).
- **Expected Result**: Both named tests in `task-close-rename.test.js` pass, and the full `shared-id-resolution.test.js` file passes.
- **Repeatable Unit Test**: Created: `test/task-close-rename.test.js`, `test/shared-id-resolution.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='ID-RESOLUTION.md has a task-close row|CLAUDE.md, wiki-tidy' test/task-close-rename.test.js` then `node --test test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: Lifecycle docs (local and template copies) name `/task-close`
- **Scenario**: `wiki/work/tasks/lifecycle.md`, `wiki/work/uat/lifecycle.md` and both `lib/scripts/templates/wiki/work/{tasks,uat}/lifecycle.md` copies reference `/task-close` for the `trashed` status, and the `trashed` status value itself is retained.
- **Steps**: Run the unit test command below.
- **Expected Result**: The "lifecycle docs (local and template) name /task-close" test passes.
- **Repeatable Unit Test**: Created: `test/task-close-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='lifecycle docs' test/task-close-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: Residue sweep — no live file references the old skill name
- **Scenario**: Walking `lib/`, `test/`, `.serena/memories/`, `wiki/`, `README.md` and `CLAUDE.md` finds no reference to the old skill name (the retained `task-trashed` log op is deliberately not matched). Historical records are excluded: `wiki/log.md`, `wiki/hot.md`, every `archive/` directory, `wiki/knowledge/sources/`, `wiki/work/roadmaps/`, `wiki/work/tasks/index.md`, individual `TASK-*.md` / `UAT-*.md` files, and the test file itself.
- **Steps**: Run the unit test command below. On failure the message lists each offending `path:line`.
- **Expected Result**: The sweep test passes with zero hits.
- **Repeatable Unit Test**: Created: `test/task-close-rename.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='no live file outside the historical exclusions' test/task-close-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Existing suites that pinned the old name still pass
- **Scenario**: `test/archive-work-item.test.js`, `test/shared-id-resolution.test.js` and `test/skill-boilerplate.test.js` (which previously pinned the old name in `WIRED_SKILLS`, the family-mapping table and a comment) pass in full against the renamed skill.
- **Steps**: Run the unit test command below.
- **Expected Result**: All three files pass with 0 failures.
- **Repeatable Unit Test**: Created: `test/archive-work-item.test.js`, `test/shared-id-resolution.test.js`, `test/skill-boilerplate.test.js`
- **Unit Test Command**: `node --test test/archive-work-item.test.js test/shared-id-resolution.test.js test/skill-boilerplate.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: Rename suite passes as a whole
- **Scenario**: Every test in the new rename suite passes together (8 tests: existence, no stub, behaviour surface, header wording, shared docs, lifecycle docs, CLAUDE.md/sibling skills, residue sweep).
- **Steps**: Run the unit test command below.
- **Expected Result**: `# pass 8`, `# fail 0`.
- **Repeatable Unit Test**: Created: `test/task-close-rename.test.js`
- **Unit Test Command**: `node --test test/task-close-rename.test.js`
- [x] Pass <!-- 2026-09-19 -->
