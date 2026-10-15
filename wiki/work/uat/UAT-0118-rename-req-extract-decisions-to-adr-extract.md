---
id: UAT-0118
aliases: [UAT-0118]
title: "UAT: Rename req-extract-decisions to adr-extract and re-home it as an ADR-side skill that takes a PRD or any document as its source"
status: pending
task: TASK-0118
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0118 — UAT: Rename req-extract-decisions to adr-extract and re-home it as an ADR-side skill that takes a PRD or any document as its source

implements::[[TASK-0118]]

> **Source task**: [[TASK-0118]]
> **Generated**: 2026-09-19

TASK-0118 is a markdown-as-program rename plus a semantics change (PRD mode / document mode), so almost everything is verifiable by deterministic `node:test` files that read the repo itself. Each `Unit Test Command` below was run before this file was written and each `--test-name-pattern` was confirmed to select exactly the intended passing tests (a pattern matching zero tests would be an authoring bug). Test files are always passed explicitly (never `node --test test/`). The tests are `test/adr-extract-rename-residue.test.js` (shipped with TASK-0118), `test/adr-extract-invariants.test.js` (written by this UAT generation), and the updated pinned suites `test/shared-id-resolution.test.js` and `test/skill-boilerplate.test.js`.

**Out of scope on purpose**:
- `prd-deprecate` / `adr-deprecate` and `req-retire` (TASK-0119 is mid-change) and `lib/scripts/install-global.sh` — nothing here asserts about them. The whole-suite "hygiene consumers" tests in `test/skill-boilerplate.test.js` iterate every consumer including `req-retire`, so they currently fail for TASK-0119's reason; no case below uses them.
- The full `npm test` suite. It carries known pre-existing failures (`skill-frontmatter-aliases` x4, `task-typed-links` x1) that are not this task's; no case requires a green full suite.
- The LLM-executed behaviour of `/adr-extract` on a real PRD has no machine oracle — see the manual case UAT-MAN-001.

---

## Prerequisites

- [ ] Working directory is the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`) with TASK-0118's implementation present
- [ ] `node` >= 18 on PATH (`node --test` with `--test-name-pattern`)
- [ ] No network, secrets, or running services needed — every automated case is read-only
- [ ] For UAT-MAN-001 only: an interactive Claude Code session in which the repo's `lib/skills/adr-extract/` skill is the one that runs (the installed `~/.claude/skills/` copy is deliberately not refreshed by this task — TASK-0122 owns pruning), and an `approved` PRD in `wiki/work/requirements/`

---

## Test Cases

### UAT-EDGE-001: req-extract-decisions is gone and adr-extract exists with a matching name
- **Scenario**: Hard rename, no redirect stub. `lib/skills/req-extract-decisions/` must not exist; `lib/skills/adr-extract/SKILL.md` must exist and its frontmatter `name:` must equal `adr-extract`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm one test runs and passes (`(c) old skill directory is gone; adr-extract has SKILL.md with name equal to its directory`)
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. A leftover old directory (even an empty stub) or a missing/misnamed new skill makes the test fail with the offending path.
- **Repeatable Unit Test**: Created: `test/adr-extract-rename-residue.test.js` (shipped with TASK-0118, 11 tests)
- **Unit Test Command**: `node --test --test-name-pattern='\(c\) old skill directory is gone' test/adr-extract-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Frontmatter advertises PRD and document sources; other metadata is unchanged
- **Scenario**: `description` mentions both `PRD` and `document`, and `argument-hint` mentions `document`. `category: planning`, `model: claude-opus-5`, `effort: high`, `disable-model-invocation: false`, `user-invocable: true` are all left exactly as they were before the rename.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm two tests run and pass: `(d) frontmatter advertises PRD and document sources` and `(b) category, model, effort and invocation flags are unchanged`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-extract-rename-residue.test.js` (1 of its tests) and `test/adr-extract-invariants.test.js` (written by this UAT generation, 11 tests)
- **Unit Test Command**: `node --test --test-name-pattern='\(d\) frontmatter advertises|\(b\) category, model' test/adr-extract-rename-residue.test.js test/adr-extract-invariants.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: No live code, doc, test, or memory file still cites req-extract-decisions
- **Scenario**: Scope (a) — no line in `lib/**`, `test/**`, `bin/**`, `README.md`, `CLAUDE.md`, `ELEVATOR_PITCH.md`, `.serena/memories/**`, `wiki/knowledge/{concepts,entities}/**`, `wiki/conventions.md`, or `wiki/work/*/lifecycle.md` contains the old skill name (case-insensitive). Historical records (`wiki/log.md`, `raw/**`, `**/archive/**`, `wiki/knowledge/sources/**`, work-item bodies and family indexes, `.docs/**`) and `lib/scripts/install-global.sh` (the installer's stale-skill list legitimately keeps old names) are deliberately excluded and must not be edited to satisfy this case.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm one test runs and passes (`(a) no live code/doc file references the old skill name`)
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. On failure the assertion message lists the offending `path:line` pairs. (If a failure lists a file owned by an in-flight sibling task, report it as that task's residue rather than editing history.)
- **Repeatable Unit Test**: Created: `test/adr-extract-rename-residue.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(a\) no live code/doc file references' test/adr-extract-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: PRD mode keeps the approved gate and the Linked-Decisions / back-link write-back
- **Scenario**: In PRD mode (empty argument, a PRD ID/`NNNN-slug`/bare number, or a path under `wiki/work/requirements/`): Step 2's gate table continues only on `approved` and redirects `draft` → `/prd-finalize`, `retired` → `/prd-create`, `superseded` → the successor PRD; CRITICAL rule 1 refuses a non-`approved` PRD; Step 7 populates the PRD's `## Linked Decisions` table surgically with `Read` + `Edit` and bumps `updated`; Step 8 appends a `Source PRD:` back-link on reused decisions.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm five tests run and pass: `(d) body defines PRD mode and document mode`, `(d) PRD mode keeps the approved gate`, and the three `(c) PRD mode:` tests (Step 2 gate, Step 7 write-back, Step 8 back-link)
- **Expected Result**: `tests 5`, `pass 5`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-extract-rename-residue.test.js` (2 of its tests) and `test/adr-extract-invariants.test.js` (3 tests)
- **Unit Test Command**: `node --test --test-name-pattern='body defines PRD mode|PRD mode keeps the approved gate|\(c\) PRD mode:' test/adr-extract-rename-residue.test.js test/adr-extract-invariants.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: Document mode has no status gate and writes only a log entry
- **Scenario**: For a path that contains `/` or ends `.md` and is **not** under `wiki/work/requirements/`: Step 1 confirms existence with `find_file` and stops with `File not found: <path>` (never creating the file), skipping ID-RESOLUTION; Step 2 states there is no status gate; Steps 7 and 8 are skipped (no Linked-Decisions table, no decision back-links); the intro and CRITICAL rule 5 both state "read-only apart from the log entry"; the `adr-extract |` log line is appended in both modes.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm five tests run and pass: no status gate (Step 2), Steps 7/8 skipped with only the log entry appended, missing file stops with `File not found`, read-only statement in the intro and CRITICAL rule 5, and the log line appended in both modes
- **Expected Result**: `tests 5`, `pass 5`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-extract-invariants.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(d\) document mode|\(d\) the log line' test/adr-extract-invariants.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: The ASR extraction algorithm is preserved
- **Scenario**: The skill still contains the ASR machinery markers — `Architecturally Significant Requirements`, `ASR#`, `Boundary enforcement`, `Tag overlap on the decision block` — and the Tier 1 row `| 1 | Tag overlap on the decision block |` of the existing-decision cross-check table.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm one test runs and passes (`(d) ASR extraction machinery is preserved`)
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-extract-rename-residue.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(d\) ASR extraction machinery' test/adr-extract-rename-residue.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: Exactly one ID-RESOLUTION wiring line, declaring requirements / active
- **Scenario**: `adr-extract` has a single `ID-RESOLUTION.md — family: requirements · scope: active` wiring line (PRD mode only — document mode needs no wiring because the skill decides the mode before invoking ID-RESOLUTION). `test/shared-id-resolution.test.js` counts wiring lines per skill and the updated `WIRED_SKILLS` / `EXPECTED_WIRING` entries name `adr-extract` (value `[['requirements', 'active']]`); the skill references `ID-RESOLUTION.md`, has no legacy pad-width / `NNN-*.md` mask text, and keeps `argument-hint` in its frontmatter.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm five tests run and pass: `(d) exactly one ID-RESOLUTION wiring line, for requirements/active` from the residue suite, and the four `lib/skills/adr-extract/SKILL.md` tests `(b)`, `(c)`, `(d)`, `(e)` from the shared-id-resolution suite
- **Expected Result**: `tests 5`, `pass 5`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-extract-rename-residue.test.js` (1 of its tests) and `test/shared-id-resolution.test.js` (updated by TASK-0118; 4 per-skill tests)
- **Unit Test Command**: `node --test --test-name-pattern='exactly one ID-RESOLUTION|lib/skills/adr-extract/SKILL\.md' test/adr-extract-rename-residue.test.js test/shared-id-resolution.test.js`
- [ ] Pass

### UAT-EDGE-008: The Prereqs line is byte-identical to the pre-rename skill's
- **Scenario**: The single inline Prereqs line is exactly `**Prereqs:** obey \`wiki/guides/mcp-tools.md\`; run /primer if not done this session.` (the pre-rename literal, confirmed against `git show HEAD:lib/skills/req-extract-decisions/SKILL.md`) and appears exactly once; the grammar test in `test/skill-boilerplate.test.js` (which pins every skill's Prereqs line, and whose `HYGIENE_CONSUMERS` now names `adr-extract`) still passes.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm two tests run and pass: `(a) Prereqs line is byte-identical to the pre-rename skill and appears exactly once` and `every inline **Prereqs:** line in a SKILL.md matches the grammar`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`. Note the grammar test scans every `lib/skills/*/SKILL.md`, so a failure naming a different skill belongs to that skill's task, not this one.
- **Repeatable Unit Test**: Created: `test/adr-extract-invariants.test.js` and `test/skill-boilerplate.test.js` (updated by TASK-0118)
- **Unit Test Command**: `node --test --test-name-pattern='\(a\) Prereqs line is byte-identical|every inline \*\*Prereqs' test/adr-extract-invariants.test.js test/skill-boilerplate.test.js`
- [ ] Pass

### UAT-EDGE-009: Back-link is `Source PRD:` and the idempotency check also honours a legacy `Source REQ:` line
- **Scenario**: Step 8 appends `- Source PRD: [PRD-NNNN](../requirements/PRD-NNNN-slug.md)` to a reused decision's `### Links`, and its idempotency step skips the edit when a `Source PRD:` line **or a legacy `Source REQ:` line** for the same item already exists, so re-running against a decision that carries an old-style back-link never duplicates the link. Output Formatting Rule 6 restates the same rule.
- **Steps**:
  1. Run the unit test command below as-is (two test files, one pattern)
  2. Confirm two tests run and pass: `(d) back-link is Source PRD with a legacy Source REQ idempotency clause` and `(c) PRD mode: Step 8 appends a Source PRD back-link, skipping when a Source PRD or legacy Source REQ line exists`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-extract-rename-residue.test.js` (1 of its tests) and `test/adr-extract-invariants.test.js` (1 test)
- **Unit Test Command**: `node --test --test-name-pattern='\(d\) back-link is Source PRD|\(c\) PRD mode: Step 8' test/adr-extract-rename-residue.test.js test/adr-extract-invariants.test.js`
- [ ] Pass

### UAT-EDGE-010: ID-RESOLUTION.md Caller-deltas gives adr-extract its own row
- **Scenario**: In `lib/skills/_shared/ID-RESOLUTION.md`'s Caller-deltas table, `adr-extract` is split out of the shared requirements row into a row of its own: family `requirements`, scope `active`, ambiguity `interactive`, notes containing "PRD mode only", `status: approved`, and "document mode and skips resolution entirely". The Procedure, Family table and worked examples are not modified.
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm one test runs and passes (`(e) ID-RESOLUTION Caller-deltas gives adr-extract its own row (requirements, active, interactive)`)
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`. The test requires `` `adr-extract` `` to appear in exactly one table row and to be the sole skill in that row's first cell.
- **Repeatable Unit Test**: Created: `test/adr-extract-invariants.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(e\) ID-RESOLUTION Caller-deltas' test/adr-extract-invariants.test.js`
- [ ] Pass

### UAT-EDGE-011: Next-action commands use /adr-create and the body no longer names the old sibling skills
- **Scenario**: The completion report emits `/adr-create group: <slug> (from <source>)` next actions and the log line reads `## [YYYY-MM-DD] adr-extract | <PRD-NNNN or document path> <title> — N ASRs identified`; the body contains none of the pre-rename sibling skill names (`/decision-create`, `/req-finalize`, `/req-create`).
- **Steps**:
  1. Run the unit test command below as-is
  2. Confirm two tests run and pass: `(d) emits /adr-create next actions and the adr-extract log line` and `(d) body no longer names the old sibling skills`
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/adr-extract-rename-residue.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='\(d\) emits /adr-create|\(d\) body no longer names' test/adr-extract-rename-residue.test.js`
- [ ] Pass

### UAT-MAN-001: Running /adr-extract on a real PRD (PRD mode) and on a non-PRD document (document mode)
- **Scenario**: The unit tests pin the skill text, not what Claude does when it follows it. Nothing machine-checkable exists for the LLM-executed behaviour, so a human confirms it once end to end.
- **Steps**:
  1. In a Claude Code session in this repo, run the repo copy of the skill (`lib/skills/adr-extract/SKILL.md`) with no argument. Confirm it lists the `approved` PRDs in `wiki/work/requirements/` and asks via `AskUserQuestion` which to use
  2. Pick an `approved` PRD. Confirm it prints an ASR table whose every row traces to a real section of that PRD, then an existing-coverage table, a grouping table, and asks per group (`yes` / `defer` / `merge into <Gx>` / `split` / `skip — already covered` / `skip — non-architectural`)
  3. Confirm `yes` on a group writes a placeholder row into the PRD's `## Linked Decisions` table (surgical edit, `updated` bumped) and, for an ASR covered by an existing decision, a `- Source PRD: …` line under that decision's `### Links` (no duplicate if a `Source PRD:` or legacy `Source REQ:` line is already there); a log entry `adr-extract | <PRD-NNNN> <title> — N ASRs identified` is appended to `wiki/log.md`; and the report ends with `/adr-create group: <slug> (from PRD-NNNN)` commands without auto-invoking `/adr-create`
  4. Run it against a `draft` PRD and confirm it stops and points at `/prd-finalize`
  5. Run it with a path to a non-PRD markdown file outside `wiki/work/requirements/` (for example `wiki/knowledge/concepts/<any page>.md`). Confirm no status gate applies, no PRD or decision file is edited, the only write is the `adr-extract |` log entry, and the report's next actions read `/adr-create group: <slug> (from <that path>)`
  6. Run it with a nonexistent path and confirm it stops with `File not found: <path>` without creating the file
- **Expected Result**: Every behaviour in steps 1-6 as described. Reverting any files touched by steps 3 and 5 afterwards (`git checkout` the PRD/decision edits and the log line) is recommended, since these are exercise runs.
- **Repeatable Unit Test**: Not applicable: the behaviour is Claude following the skill's instructions against real wiki content (interactive `AskUserQuestion` prompts, semantic ASR extraction); the deterministic parts of the contract are pinned by UAT-EDGE-004 and UAT-EDGE-005
- [ ] Pass
