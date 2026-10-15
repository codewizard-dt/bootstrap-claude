---
id: UAT-0120
aliases: [UAT-0120]
title: "UAT: Add prd-assess, adr-assess, and uat-assess skills mirroring roadmap-assess/bug-assess"
status: pending
task: TASK-0120
created: 2026-09-20
updated: 2026-09-20
---

# UAT-0120 — UAT: Add prd-assess, adr-assess, and uat-assess skills mirroring roadmap-assess/bug-assess

implements::[[TASK-0120]]

> **Source task**: [[TASK-0120]]
> **Generated**: 2026-09-20

TASK-0120 adds three new, strictly read-only skills (`lib/skills/prd-assess/`, `lib/skills/adr-assess/`, `lib/skills/uat-assess/`), their registration rows (`lib/skills/README.md`, `CLAUDE.md`, the Serena skill-category memory), one Caller-deltas row in `lib/skills/_shared/ID-RESOLUTION.md`, and a contract test. Skills are markdown-as-program, so nearly every acceptance criterion that is a stable string, ordering or cross-file contract is verifiable by a deterministic `node:test` file that reads the repo itself. Each `Unit Test Command` below was run before this file was written, and each `--test-name-pattern` was confirmed to select exactly the number of tests named in the case's steps (a pattern matching zero tests would be an authoring bug). Test files are always passed explicitly, never `node --test test/`.

The tests live in two files: `test/assess-skills-contract.test.js` (shipped with TASK-0120, 52 tests) and `test/assess-skills-crossrefs.test.js` (written by this UAT generation, 45 tests, for the acceptance criteria the tackle tests did not pin: exact STOP text, Closed footer, sub-block numbering, precedence order, lifecycle and producer vocabulary, the `/adr-next` fold-in, the `Parse a roadmap` anchor, registration-row placement, the task-specified descriptions, and read-only token hygiene). The new file's tests carry a tag in their names (`[stop]`, `[footer]`, `[blocks]`, `[rank]`, `[lifecycle]`, `[vocab]`, `[readonly]`, `[files]`, `[registry]`, `[desc]`, `[scan]`, `[fold-in]`, `[anchor]`, `[caller]`) that the commands below select. The new tests were also mutation-checked on a scratch copy (swapped precedence, altered STOP text, dropped footer, mislabelled sub-block, misplaced README row, a `Bash`/`Edit` mention, a mangled Caller-deltas row): each mutation was caught, so they are not vacuous.

**Out of scope on purpose**:
- **Known failures from other in-flight work**: `shared-id-resolution` `(f) family-table directories exist and every item filename fits a 3- or 4-digit mask` (fails on `wiki/work/tasks/dependency-graph.md` not being reachable by `PREFIX-<pad>-*.md`) and `skill-frontmatter-aliases` x4 (`task-create`, `uat-create`, `prd-create`, `roadmap-create` alias templates). None is this task's, no automated case below depends on them, and UAT-MAN-003 checks the full suite shows nothing beyond them and nothing naming an `assess` skill. Do not fix them here.
- **The installed copy** `~/.claude/skills/` and `lib/scripts/install-global.sh`: the task deliberately leaves both alone (TASK-0122 owns the installer prune; the new skills reach the installed copy via the next normal install). UAT-MAN-004 checks this.
- **Archive removal** for requirements, decisions and roadmaps (TASK-0121) and the `REQ-`/`DEC-` to `PRD-`/`ADR-` file migration (a later task). The skills read status, not directory, precisely so those tasks need no edit here.
- **The three model skills** `roadmap-assess`, `bug-assess`, `adr-next` show uncommitted edits from other in-flight tasks (renames), so no case asserts they are unmodified; the cases only assert they still exist.
- The LLM-executed behaviour of the three skills has no machine oracle; see UAT-MAN-001 and UAT-MAN-002.

**Observations recorded, not defects**:
- `test/shared-id-resolution.test.js` pins a fixed `WIRED_FILES` list of 17 files (16 `SKILL.md` + `UAT-CORE.md`) and does not enumerate the Caller-deltas consumers, so `uat-assess`'s wiring line is not swept by it; the task said to adjust that suite only if it enumerated consumers, and it does not. The wiring line and the Caller-deltas row are pinned instead by UAT-INT-005.
- The task names no numeric threshold for `adr-assess`'s "long-idle" proposed block; the skill picked 60 days. No case pins that number (it is an implementation choice, tunable at the top of the Rank step). `prd-assess`'s 30-day stale-draft threshold is specified by the task and is pinned by UAT-INT-004.

---

## Prerequisites

- [ ] Working directory is the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`) with TASK-0120's implementation present
- [ ] `node` >= 18 on PATH (`node --test` with `--test-name-pattern`)
- [ ] No network, secrets, or running services needed for the automated cases; every one is read-only
- [ ] For UAT-MAN-001 and UAT-MAN-002 only: an interactive Claude Code session in which the repo's `lib/skills/prd-assess/`, `lib/skills/adr-assess/` and `lib/skills/uat-assess/` are the skills that run (the installed `~/.claude/skills/` copies do not exist yet — by design), for example by asking the session to follow `lib/skills/<name>/SKILL.md` exactly; the working tree must be clean of the skills' outputs so a read-only run can be confirmed by an unchanged `git status`
- [ ] For UAT-MAN-003 only: `npm test` runnable from the repo root

---

## Test Cases

### UAT-INT-001: The shipped contract suite passes in full with no skipped or todo tests
- **Scenario**: TASK-0120's own `test/assess-skills-contract.test.js` pins, per skill, the frontmatter tier, the read-only contract, the shared-doc pointers, the family signals, the suggested-command resolution and the three registration rows. It must run green with nothing skipped (the task forbids any `skip`/`todo` key).
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 52`, `pass 52`, `fail 0`, `skipped 0`, `todo 0`. Any failing test names the skill and the contract that drifted.
- **Repeatable Unit Test**: Created: `test/assess-skills-contract.test.js` (shipped with TASK-0120, 52 tests)
- **Unit Test Command**: `node --test test/assess-skills-contract.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-002: Each skill's frontmatter matches roadmap-assess's tier and the task-specified description
- **Scenario**: All three skills copy `roadmap-assess`'s `category`, `model`, `disable-model-invocation` and `user-invocable` (read from that file at test time, never hardcoded), carry no `argument-hint`, a `name:` equal to the directory, a first body line that is the inline `**Prereqs:** obey \`wiki/guides/mcp-tools.md\`` line, and the exact `description:` text the task specifies (each starting "Survey all active").
- **Steps**:
  1. Run the unit test command below as-is (two test files, one alternation pattern)
  2. Confirm 21 tests run and pass: per skill, `SKILL.md exists`, `frontmatter name equals the directory name`, `description starts "Survey all active"`, `tier keys equal roadmap-assess's frontmatter`, `no argument-hint key`, `first body line is the inline Prereqs line` (6 x 3 = 18), plus the three `[desc] <name>: frontmatter description is the task-specified text` tests
- **Expected Result**: `tests 21`, `pass 21`, `fail 0`. Changing a skill's model, adding an `argument-hint`, or rewording a description fails the corresponding test with the offending value.
- **Repeatable Unit Test**: Created: `test/assess-skills-contract.test.js` (18 tests, shipped with TASK-0120) and `test/assess-skills-crossrefs.test.js` (3 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='SKILL\.md exists|frontmatter name equals|description starts|tier keys equal|no argument-hint|first body line is|\[desc\]' test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-001: All three skills are strictly read-only, with no write exception, and only uat-assess forbids running a Unit Test Command
- **Scenario**: Stricter than `roadmap-assess` (which auto-archives) and `bug-assess` (which batch-triages): each `## Constraints` block declares `Read-only`, its `Permitted tools:` line names only `list_dir`, `find_file`, `search_for_pattern` and `Read`, no line instructs an append to `wiki/log.md` or an index file, no skill declares `allowed-tools`, no `Edit`/`Write`/`Bash`/`AskUserQuestion` token appears outside a negation, each body says it is strictly read-only and never flips a status, creates a file or asks questions, and the `never run … Unit Test Command` sentence is present in `uat-assess` only.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one alternation pattern)
  2. Confirm 18 tests run and pass: per skill `Constraints block declares Read-only`, `Permitted tools line is the four read tools only`, `never instructs an append to wiki/log.md or an index file`, `"never run ... Unit Test Command" sentence present|absent` (4 x 3 = 12), plus the six `[readonly]` tests (two per skill: token hygiene and the "never flips a status / creates a file / asks questions" sentences)
- **Expected Result**: `tests 18`, `pass 18`, `fail 0`. Adding an `Edit` permission, a log or index write instruction, or a `Unit Test Command` execution instruction to any skill fails a named test.
- **Repeatable Unit Test**: Created: `test/assess-skills-contract.test.js` (12 tests, shipped with TASK-0120) and `test/assess-skills-crossrefs.test.js` (6 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='Constraints block declares|Permitted tools line|never instructs an append|never run|\[readonly\]' test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-002: prd-assess and adr-assess never mention archive/ (status decides active vs closed); uat-assess keeps archive/ and skips screenshots/
- **Scenario**: After TASK-0121, terminal roadmaps, decisions and requirements stay in their family directory and are told apart only by `status:`, so `prd-assess` and `adr-assess` must not mention `archive/` at all (which keeps them off TASK-0121's edit list). The UAT family keeps `archive/`, so `uat-assess` scans only files directly in `wiki/work/uat/`, skips `archive/`, `screenshots/`, `lifecycle.md`, `index.md`, and still reads each file's `status:` because a terminal UAT may not have been swept yet.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one alternation pattern)
  2. Confirm 4 tests run and pass: the three `<name>: family signals` tests (whose assertions include the literal-`archive/`-absent check for `prd-assess` and `adr-assess` and the `archive/`-present plus `screenshots/` check for `uat-assess`) and `[scan] uat-assess skips archive/, screenshots/, lifecycle.md and index.md in Step 1 and reads status too`
- **Expected Result**: `tests 4`, `pass 4`, `fail 0`. Adding an `archive/` mention to either PRD or ADR skill, or dropping the `screenshots/` skip from `uat-assess`, fails a named test.
- **Repeatable Unit Test**: Created: `test/assess-skills-contract.test.js` (3 tests, shipped with TASK-0120) and `test/assess-skills-crossrefs.test.js` (1 test, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='family signals|\[scan\] uat-assess skips' test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-003: Each skill directory holds exactly one file, SKILL.md
- **Scenario**: The task adds the three skills and nothing else per directory: no stray scripts, fixtures, or reference docs inside `lib/skills/prd-assess/`, `lib/skills/adr-assess/` or `lib/skills/uat-assess/` (shared mechanics live in `lib/skills/_shared/` and are pointed at, not copied).
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm 3 tests run and pass (`[files] <name>: skill directory holds SKILL.md only`)
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`. An extra file in any of the three directories fails with the directory listing.
- **Repeatable Unit Test**: Created: `test/assess-skills-crossrefs.test.js` (3 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\[files\]' test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-003: Each skill prints the exact empty-family STOP text, a Closed footer, and consistently numbered report sub-blocks
- **Scenario**: Empty family → STOP with the task's exact string (`No active PRDs found in wiki/work/requirements/. Use /prd-create <idea> to draft one.`, `No active ADRs found in wiki/work/decisions/. Use /adr-create <topic> to create one.`, `No active UATs found in wiki/work/uat/. Use /uat-create <task> to generate one.`). Terminal items are excluded from ranking and summarised in one footer line `Closed: N (not assessed)`. The report sub-blocks are numbered after their own step (`## Step 5: Report` → `### 5a`/`5b`/`5c` for PRD and UAT; `## Step 6: Report` → `### 6a`/`6b`/`6c` for ADR), avoiding `roadmap-assess`'s 6a-under-Step-7 label mismatch.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm 9 tests run and pass: `[stop]`, `[footer]`, `[blocks]` for each of the three skills
- **Expected Result**: `tests 9`, `pass 9`, `fail 0`. A reworded STOP text, a missing footer, or a sub-block whose letter-prefix disagrees with its step number fails a named test.
- **Repeatable Unit Test**: Created: `test/assess-skills-crossrefs.test.js` (9 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\[stop\]|\[footer\]|\[blocks\]' test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-004: Each skill's Rank step states the family precedence list highest-first, with the specified thresholds and signals
- **Scenario**: Each Rank step carries an explicit precedence list. `prd-assess` (5 tiers): approved with no linked ADRs and no linked tasks → approved and blocked by open decisions → stale drafts (`updated` older than 30 days, threshold named once at the top of the step) → fresh drafts → approved and fully flowing. `adr-assess` (3 tiers, ranked per block `ADR-NNNN#DM`): proposed blocks that gate live work → accepted blocks with no task → other proposed blocks, with supersession-chain handling (`Supersedes`, `superseded by`, cycle and asymmetry warnings) and age from `Date`. `uat-assess` (3 tiers): unblocking power → what it waits on (`failed` → `in-progress` → auto-runnable → needs a human → `stub`) → age (oldest `created` first, then `UAT-NNNN` ascending), with `Waits on` and `Unblocks` report columns.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one alternation pattern)
  2. Confirm 6 tests run and pass: the three `[rank]` tests (labels appear in the specified order inside the Rank step) and the three `<name>: family signals` tests (wording, thresholds, both ID prefixes, per-block ranking, wait states, report columns)
- **Expected Result**: `tests 6`, `pass 6`, `fail 0`. Reordering two tiers, dropping the 30-day threshold, or losing the `Waits on`/`Unblocks` columns fails a named test.
- **Repeatable Unit Test**: Created: `test/assess-skills-crossrefs.test.js` (3 tests, written by this UAT generation) and `test/assess-skills-contract.test.js` (3 tests, shipped with TASK-0120)
- **Unit Test Command**: `node --test --test-name-pattern='\[rank\]|family signals' test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-005: Shared mechanics are pointed at, not restated: ID-RESOLUTION wiring line, Caller-deltas row, and the roadmap-next Parse procedure
- **Scenario**: Each skill references `_shared/ID-RESOLUTION.md`, a family `lifecycle.md`, or the Family table instead of restating a mask algorithm. `uat-assess` carries the exact wiring line `Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: tasks · scope: active+archive · ambiguous: headless · empty: n/a` and treats a missing or empty `task:` as an orphan, never a STOP. `lib/skills/_shared/ID-RESOLUTION.md`'s Caller-deltas table has exactly one `uat-assess` row (tasks, `active+archive`, headless, orphan / never STOP). `adr-assess` and `uat-assess` cite the **Parse a roadmap** procedure in `lib/skills/roadmap-next/SKILL.md` by path without copying its step text, and `roadmap-next` really defines a `### Parse a roadmap` heading.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one alternation pattern)
  2. Confirm 10 tests run and pass: 3 `points at ID-RESOLUTION / lifecycle / Family table`, 2 `references roadmap-next's Parse procedure by path`, `uat-assess: carries the exact ID-RESOLUTION wiring line`, `uat-assess: ID-RESOLUTION.md Caller deltas table has a uat-assess row`, plus the two `[caller]` tests and one `[anchor]` test
- **Expected Result**: `tests 10`, `pass 10`, `fail 0`. Renaming or removing roadmap-next's `Parse a roadmap` heading, restating the procedure (`candidate_items`, the candidate cap, `## Phase N`), or editing the Caller-deltas row's cells fails a named test.
- **Repeatable Unit Test**: Created: `test/assess-skills-contract.test.js` (7 tests, shipped with TASK-0120) and `test/assess-skills-crossrefs.test.js` (3 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='points at ID-RESOLUTION|references roadmap-next|carries the exact ID-RESOLUTION wiring line|Caller deltas table has a uat-assess row|\[caller\]|\[anchor\]' test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-006: The status names, block layout and case markers each skill reads match the family lifecycle docs and the skills that produce them
- **Scenario**: The skills must read the vocabulary the wiki actually writes. Each skill cites its family `lifecycle.md` (`requirements`: `draft | approved | retired`; `decisions`: `proposed | accepted | deprecated | superseded`; `uat`: `pending | in-progress | passed | failed | skipped | trashed`), and the lifecycle doc names every status the skill names. `adr-assess` parses the block layout that the real `wiki/work/decisions/archive/DEC-0001-wiki-cross-family-linking-schema.md` uses (`## D1.` H2, `- **Status**:`, `- **Date**:`, `### Links`, `- Source task(s):`). `uat-assess` consumes the markers (`[ ]`, `[x]`, `[FAIL:`, `[SKIP:`) that `lib/skills/uat-walk/UAT-CORE.md` emits and the `uat` lifecycle lists, and the `Repeatable Unit Test` / `Unit Test Command` fields `lib/skills/uat-create/SKILL.md` writes, including the `Created` / `Not applicable` / `Blocked` values. A `[FAIL: auto-judge: … requires human verification]` marker is treated as `/uat-auto` deferring to a person (unresolved, manual-only), not a failure; the `## Prerequisites` checkboxes are not cases; a stub is a UAT with zero case headings.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm 7 tests run and pass: three `[lifecycle]` tests (one per skill) and four `[vocab]` tests (producer markers, auto-judge deferral, Prerequisites/stub, ADR block layout)
- **Expected Result**: `tests 7`, `pass 7`, `fail 0`. Renaming a lifecycle status or a marker without updating the skill, or a skill drifting from the layout of a real decision file, fails a named test.
- **Repeatable Unit Test**: Created: `test/assess-skills-crossrefs.test.js` (7 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\[lifecycle\]|\[vocab\]' test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-007: adr-assess folds in the /adr-next check without removing it, and its accepted-with-no-task suggestion uses a real /task-create flag
- **Scenario**: The task says `adr-assess` folds in the `/adr-next` check (any accepted block with no task reference is surfaced) and leaves `/adr-next` and `wiki-lint` check 2.12 in place as the fast single-purpose forms. Its `Next` line for an accepted block with no task is ``/task-create <description> --decision ADR-NNNN#DM``, so `/task-create`'s `argument-hint` must advertise `--decision ADR-NNNN#DM`. `lib/skills/adr-next/`, `roadmap-assess/` and `bug-assess/` must still exist.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm 2 tests run and pass (`[fold-in] adr-assess folds in the /adr-next check and leaves /adr-next in place`, `[fold-in] adr-assess suggests /task-create --decision and task-create advertises that flag`)
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`. Deleting `adr-next`, or a `--decision` rename in `task-create`, fails a named test.
- **Repeatable Unit Test**: Created: `test/assess-skills-crossrefs.test.js` (2 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\[fold-in\]' test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-008: prd-assess and adr-assess search the right families under both ID prefixes and by alias
- **Scenario**: During this task's lifetime the family directories hold both `PRD-`/`REQ-` and `ADR-`/`DEC-` files, so `prd-assess` searches `wiki/work/decisions/`, `wiki/work/tasks/` and `wiki/work/roadmaps/` for a PRD's ID and every alias under both prefixes (frontmatter `linked_requirements`/`linked_prds`, typed links and plain links), and follows a `superseded by` pointer when resolving an open ADR block. `adr-assess` searches `wiki/work/tasks/` for `implements::[[ADR-NNNN#DM]]` (so a task that was never written into `### Links` still counts), reads roadmaps by `status:` not location, and also searches `wiki/work/requirements/`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm 2 tests run and pass (`[scan] prd-assess searches decisions, tasks and roadmaps…`, `[scan] adr-assess searches tasks for implements::…`)
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/assess-skills-crossrefs.test.js` (2 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\[scan\] prd-assess|\[scan\] adr-assess' test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-009: Every /command a skill suggests resolves to an existing skill, including each family's follow-up commands
- **Scenario**: The task's post-rename names must all be real (no stale `/req-*`, `/decision-*`, `/bug-file` command, no invented name). Each skill extracts to a non-empty set of suggested commands that each resolve to a `lib/skills/<name>/SKILL.md`; `prd-assess` includes `prd-finalize`, `adr-extract`, `adr-finalize`; `adr-assess` includes `adr-finalize`, `task-create`; `uat-assess` includes `uat-auto`, `uat-walk`, `uat-create`, `uat-skip`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm 3 tests run and pass (`<name>: every suggested /command resolves to an existing skill`)
- **Expected Result**: `tests 3`, `pass 3`, `fail 0`. A stale pre-rename command or a deleted follow-up skill fails with the `/cmd` that has no `SKILL.md`.
- **Repeatable Unit Test**: Created: `test/assess-skills-contract.test.js` (3 tests, shipped with TASK-0120)
- **Unit Test Command**: `node --test --test-name-pattern='every suggested /command' test/assess-skills-contract.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-010: Each skill is registered in lib/skills/README.md, the CLAUDE.md Custom Commands table, and the Serena researching line, next to its family's rows
- **Scenario**: `prd-assess` sits in the Requirements table under the other `prd-*` rows, `adr-assess` in the Decisions table under the `adr-*` rows, and `uat-assess` in the UAT table under the `uat-*` rows, in both `lib/skills/README.md` and the `CLAUDE.md` Custom Commands table. Each row's purpose leads with `Survey all active` and ends `(read-only)`. Each name appears on the **researching** line of `.serena/memories/skills/format-and-model-selection.md`.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one alternation pattern)
  2. Confirm 15 tests run and pass: per skill `registered in lib/skills/README.md`, `registered in CLAUDE.md Custom Commands`, `listed on the researching line of the Serena skills memory` (9), plus the six `[registry]` tests (row placement under a sibling row, and the `Survey all active` / `(read-only)` shape in both files)
- **Expected Result**: `tests 15`, `pass 15`, `fail 0`. A row dropped into the wrong family table, or a missing registration, fails a named test.
- **Repeatable Unit Test**: Created: `test/assess-skills-contract.test.js` (9 tests, shipped with TASK-0120) and `test/assess-skills-crossrefs.test.js` (6 tests, written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='registered in|listed on the researching line|\[registry\]' test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-011: The Prereqs-grammar sweep and the shared ID-resolution doc checks still pass with the new skills present
- **Scenario**: The task requires that adding the skills did not break `test/skill-boilerplate.test.js`'s sweep of every inline `**Prereqs:**` line (all three new skills open with the verbatim grammar; `uat-assess` adds ` + \`wiki/work/uat/lifecycle.md\``) or `test/shared-id-resolution.test.js`'s checks that the shared doc still defines prefixes, forms, both ambiguity modes, and that every wiring line uses a family in the Family table. The full-file runs are not used because of the known unrelated `(f)` failure; the four tests below are the ones this change can affect.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one alternation pattern)
  2. Confirm 4 tests run and pass: `every inline **Prereqs:** line in a SKILL.md matches the grammar`, `(e) every wiring line uses a family that exists in the shared family table`, `(a2) shared doc defines both ambiguity modes, the zero-match STOP, and the #DM split`, `(a) ID-RESOLUTION.md exists and defines prefixes, forms, and legacy fallback`
- **Expected Result**: `tests 4`, `pass 4`, `fail 0`. A `Prereqs` line outside the grammar in any of the three new skills, or a damaged shared doc, fails with the offending line.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js` and `test/shared-id-resolution.test.js` (both pre-existing suites, unmodified by this task; reused as evidence)
- **Unit Test Command**: `node --test --test-name-pattern='every inline \*\*Prereqs:\*\* line|\(e\) every wiring line uses a family|\(a2\) shared doc defines|\(a\) ID-RESOLUTION\.md exists' test/skill-boilerplate.test.js test/shared-id-resolution.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-MAN-001: prd-assess and adr-assess print their specified empty-family STOP text against this repo's real, currently empty active families
- **Scenario**: As of generation, `wiki/work/requirements/` holds only `lifecycle.md`, `index.md`, `.gitkeep` and an `archive/` subdirectory (no PRD files), and `wiki/work/decisions/` holds only `lifecycle.md`, `index.md`, `.gitkeep` and an `archive/` subdirectory containing `DEC-0001-wiki-cross-family-linking-schema.md`. Neither skill mentions `archive/`, so each must see an empty active set and STOP with its specified message, having written and asked nothing. (If `/prd-create` or `/adr-create` has since added a real file, the skill must instead rank it: expect a table plus per-item block, and adjust the check accordingly.)
- **Steps**:
  1. In an interactive Claude Code session that runs the repo copy of the skill, run `git status --short` and note the output
  2. Run `prd-assess` (follow `lib/skills/prd-assess/SKILL.md`)
  3. Run `adr-assess` (follow `lib/skills/adr-assess/SKILL.md`)
  4. Run `git status --short` again and compare with step 1
- **Expected Result**: Step 2 prints `No active PRDs found in wiki/work/requirements/. Use /prd-create <idea> to draft one.`; step 3 prints `No active ADRs found in wiki/work/decisions/. Use /adr-create <topic> to create one.` Neither run prompts the user, edits a file, appends to `wiki/log.md`, or lists `DEC-0001` (it sits in an `archive/` subdirectory and the skill ignores subdirectories). `git status --short` is identical before and after.
- **Repeatable Unit Test**: Not applicable: the behaviour is an LLM executing the skill against live wiki state; the STOP strings, the `archive/` absence and the read-only constraints are already pinned by UAT-INT-003, UAT-EDGE-001 and UAT-EDGE-002
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-20 -->

### UAT-MAN-002: uat-assess ranks this repo's real active UATs read-only, with the specified table shape, and classifies auto-judge deferrals correctly
- **Scenario**: `wiki/work/uat/` holds two dozen active UATs (plus `archive/` and `screenshots/`). `uat-assess` must list each active UAT once in `Prioritized UATs`, with `Rank | UAT | Status | Waits on | Unblocks | Rationale` columns, per-UAT `### UAT-NNNN — <title>` blocks in ranked order, each with `Task:`, `Status:`, `Summary:` and a `Next:` command. `UAT-0114-rename-bug-file-to-bug-create.md` (if still in the state recorded at generation) carries a real `[FAIL: auto-judge: unit test failed after one retry …]` marker on `UAT-INT-009` and several `[FAIL: auto-judge: … requires human verification]` markers: the former makes it `failed` (Waits on names `UAT-INT-009`), while the latter are deferrals (unresolved, manual-only) and must not by themselves count as failures or as status/marker drift. No case is executed: no `Unit Test Command` in any UAT file is run.
- **Steps**:
  1. In an interactive Claude Code session that runs the repo copy of the skill, run `git status --short` and note the output
  2. Run `uat-assess` (follow `lib/skills/uat-assess/SKILL.md`)
  3. Check the `Prioritized UATs` table: every active UAT (files directly in `wiki/work/uat/` whose `status:` is not `passed`, `skipped` or `trashed`) appears exactly once, none from `archive/`, and the rows are ordered per Step 4 (a UAT whose task `blocks:` other tasks or is the last unchecked roadmap item first; then failed, in-progress, auto-runnable, manual cases, stub; then oldest `created`)
  4. Check `UAT-0114`'s row and block as described in the Scenario
  5. Check the Warnings block: any UAT whose task is missing or already `done`/`trashed` is flagged as a `/task-close` candidate; any UAT file absent from `wiki/work/uat/index.md` or listed with a stale status is flagged; and any `Closed: N (not assessed)` footer line matches the number of terminal-status UAT files sitting directly in `wiki/work/uat/`
  6. Run `git status --short` again and compare with step 1
- **Expected Result**: The report has the specified shape and order with a terse output (no preamble, no closing summary beyond the tables). No `Unit Test Command` was executed, no prompt was shown, and `git status --short` is identical before and after (no file edited, no index or log change). Any judgment-call ordering is labelled as a rationale rather than stated as fact.
- **Repeatable Unit Test**: Not applicable: an LLM run over live, changing wiki state has no deterministic oracle; the ranking order, wait states, columns, marker vocabulary and read-only constraint are pinned as text contracts by UAT-INT-004, UAT-INT-006 and UAT-EDGE-001
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-20 -->

### UAT-MAN-003: The full suite shows no failure naming an assess skill and no failure beyond the known in-flight ones
- **Scenario**: The full `npm test` run (`node --test 'test/*.test.js'`) must not regress because of this task. The only failures are the known pre-existing ones from other in-flight work: `shared-id-resolution` `(f)` (the `wiki/work/tasks/dependency-graph.md` filename) and `skill-frontmatter-aliases` x4 (`task-create`, `uat-create`, `prd-create`, `roadmap-create` alias templates). Other tasks in flight may add or remove failures of their own; only failures attributable to this task are in scope.
- **Steps**:
  1. Run `npm test` from the repo root and keep the output
  2. List the failing test names (lines starting with `✖`)
  3. Confirm none of them names `prd-assess`, `adr-assess`, `uat-assess`, `assess-skills-contract` or `assess-skills-crossrefs`
  4. Confirm every failing test is either one of the five known ones above or attributable to another in-flight task (record any such extras here rather than fixing them)
- **Expected Result**: No failing test names an assess skill or either new test file, and both new test files report `fail 0` (52 and 45 tests). The failing set is the five known tests, possibly plus documented failures from other in-flight work.
- **Repeatable Unit Test**: Not applicable: this is the aggregate suite whose failing set depends on other tasks' uncommitted work; the assess-specific tests are already covered file-by-file by UAT-INT-001 through UAT-INT-011
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-20 -->

### UAT-MAN-004: The installed copy was not touched and install-global.sh was not run
- **Scenario**: The task edits `lib/skills/` only. Nothing under `~/.claude/` is changed and `install-global.sh` is not run, so the three new skills are not yet present in the installed skills directory. The only working-tree changes attributable to TASK-0120 are the three new `lib/skills/*-assess/` directories, the two new test files, and small edits to `lib/skills/README.md`, `CLAUDE.md`, `.serena/memories/skills/format-and-model-selection.md` and `lib/skills/_shared/ID-RESOLUTION.md` (other in-flight tasks share those files, so only the assess-related lines are attributable).
- **Steps**:
  1. List `~/.claude/skills/` (Serena `list_dir` on that path) and confirm there is no `prd-assess`, `adr-assess` or `uat-assess` directory
  2. Run `git status --short -- lib/skills/prd-assess lib/skills/adr-assess lib/skills/uat-assess test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js` and confirm all five paths show as untracked (`??`)
  3. Confirm the assess-related additions in `lib/skills/README.md`, `CLAUDE.md`, `.serena/memories/skills/format-and-model-selection.md` and `lib/skills/_shared/ID-RESOLUTION.md` are limited to the three registration rows, the researching-line names, and the single `uat-assess` Caller-deltas row (`git diff` on each file, ignoring unrelated hunks from other tasks)
- **Expected Result**: Step 1 shows none of the three skills installed (this is true only until the next normal `install-global.sh` run; if that has happened since generation, the check is moot). Step 2 shows five untracked paths. Step 3 finds no assess-related edit beyond those listed.
- **Repeatable Unit Test**: Not applicable: it inspects the machine-local installed skills directory and the working-tree diff, which are not repo-hermetic and change as other tasks land; the repo-local half (registrations and the Caller-deltas row) is pinned by UAT-INT-005 and UAT-INT-010
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-20 -->
