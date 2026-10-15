---
id: UAT-0108
aliases: [UAT-0108]
title: "UAT: Create a /usage-report skill that locally parses Claude Code session logs for per-project token/cost rollups"
status: passed
task: TASK-0108
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0108 — UAT: Create a /usage-report skill that locally parses Claude Code session logs for per-project token/cost rollups

implements::[[TASK-0108]]

> **Source task**: [[TASK-0108]]
> **Generated**: 2026-09-19

Almost every case is backed by `test/usage-report.test.js` and the synthetic fixture under `test/fixtures/usage-report/` (no real transcript content). Each case's `Unit Test Command` is scoped to the named tests with `--test-name-pattern`, never the whole suite. The single manual case runs the script against this repo's own transcripts and reports **counts only**.

---

## Prerequisites

- [ ] Repo checked out with `lib/skills/usage-report/` present and Node available (`node --version`)
- [ ] Working directory is the repo root
- [ ] For UAT-MAN-001 only: at least one Claude Code transcript exists under `~/.claude/projects/-Users-davidtaylor-Repositories-bootstrap-claude/`

---

## Test Cases

### UAT-INT-001: Streaming duplicates and cross-file copies are counted once
- **Scenario**: The same API response is written several times while streaming and is copied into a subagent file (fork context). Totals must not be inflated.
- **Steps**:
  1. Run the unit command below.
  2. Confirm both `dedupe` tests pass: the streamed `msg_1` collapses to one record whose last copy (`output` 100) wins, and the cross-file copy of `msg_4` collapses globally across main and subagent files (8 parsed records become 6).
- **Expected Result**: 2 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='dedupe' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: Malformed lines and `<synthetic>` entries never count or abort
- **Scenario**: A transcript contains one unparseable line and a `<synthetic>` model entry with 999999 tokens.
- **Steps**:
  1. Run the unit command below.
  2. Confirm exactly one line is reported skipped, the `<synthetic>` row and `msg_syn` are absent from parsed records, and parsing completes without throwing.
- **Expected Result**: 1 test passes, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='parseTranscript skips' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-002: Totals and meta equal the hand-computed fixture sums
- **Scenario**: Running the CLI against the fixture project yields exact, hand-computed totals.
- **Steps**:
  1. Run the unit command below.
  2. Confirm totals of input 8500, output 950, cacheCreation 1000, cacheRead 10000, turns 6, cost 0.02825, and `meta` (files 2, skippedLines 1, `unpricedModels` `["claude-unknown-9"]`, `pricingAsOf` matching `pricing.json`, `attribution` `last-invoked-skill`, scope/range fields).
- **Expected Result**: 2 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='fixture totals|meta reflects' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-003: Per-model rollup carries tier, cost, and a null cost for unpriced models
- **Scenario**: `byModel` reports haiku/sonnet/opus/other tiers with correct sums; an unknown model keeps its tokens but reports `cost: null` and sorts last. Pricing arithmetic covers the 5m/1h cache-write split and dated-id prefix matching.
- **Steps**:
  1. Run the unit command below.
  2. Confirm sonnet-5 (2 turns, cost 0.01425), opus-5 (0.0075), haiku-4-5 (2 turns, 0.0065), and `claude-unknown-9` (`tier: other`, `cost: null`, sorted last), plus the `price` rate checks.
- **Expected Result**: 2 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='byModel sums|price:' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-004: Per-skill attribution follows the last-invoked skill and reads the declared model
- **Scenario**: Skill invocations are detected from a `Skill` tool_use block and from a `<command-name>` slash command (string-content user messages only). Turns are credited to the last-invoked skill, including subagent turns via the parent session, and turns before any invocation go to `(none)`. `declaredModel` comes from each skill's frontmatter `model:`.
- **Steps**:
  1. Run the unit command below.
  2. Confirm skills sort `beta`, `alpha`, `(none)`; a quoted `/gamma` inside an array-content tool result creates no `gamma` bucket; `alpha.declaredModel` is `claude-sonnet-5`, `beta.declaredModel` is `claude-haiku-4-5-20251001`, `(none).declaredModel` is null; a missing or path-traversing skill name yields null.
- **Expected Result**: 3 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='parseTranscript detects|bySkill follows|readDeclaredModel' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-005: Project scoping, subagent inclusion, and `--all-projects`
- **Scenario**: The default scope is the encoded project directory (every non-alphanumeric character becomes `-`), subagent transcripts are included, and `--all-projects` walks every project directory.
- **Steps**:
  1. Run the unit command below.
  2. Confirm `encodeProjectDir` matches the Claude Code convention (`/Users/x/.claude` becomes `-Users-x--claude`), `listTranscripts` returns both the main and `subagents/` files and `[]` for a missing dir, and `--all-projects` sets `scope.allProjects` true with null `project`/`encodedDir`.
- **Expected Result**: 3 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='encodeProjectDir|listTranscripts|--all-projects' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-006: Date range filtering and per-day buckets
- **Scenario**: `--since` and `--until` filter turns while skill attribution still uses the full timeline; `byDay` buckets ascend by date, and `--until` is end-of-day inclusive.
- **Steps**:
  1. Run the unit command below.
  2. Confirm `--since 2026-01-02` leaves 1 turn attributed to `beta`, `--until 2026-01-01` leaves 5 turns with `range.until` `2026-01-01T23:59:59.999Z`, and `byDay` is 2026-01-01 (5 turns) then 2026-01-02 (1 turn).
- **Expected Result**: 2 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='byDay|--since/--until' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-007: JSON output matches the schemaVersion 1 contract; `--pretty` only changes layout
- **Scenario**: TASK-0109 depends on the exact key set and value types. `--pretty` is indented, the default is single-line.
- **Steps**:
  1. Run the unit command below.
  2. Confirm the top-level keys (`byDay`, `byModel`, `bySkill`, `generatedAt`, `meta`, `range`, `schemaVersion`, `scope`, `totals`), every nested key set, `schemaVersion` 1, an ISO-8601 `generatedAt`, tiers in `haiku|sonnet|opus|other`, and `YYYY-MM-DD` dates.
- **Expected Result**: 2 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='validates against|--pretty' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: An empty project yields valid zero-total JSON and exit 0
- **Scenario**: The projects root exists but holds nothing for this project, or the encoded project dir exists but is empty. This is not an error.
- **Steps**:
  1. Run the unit command below.
  2. Confirm exit 0 and valid JSON with `schemaVersion` 1, all totals 0 (`cost` 0), empty `byModel`/`bySkill`/`byDay`, `meta.files` 0, `skippedLines` 0, and empty `unpricedModels`.
- **Expected Result**: 1 test passes, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='empty project' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Unknown flags, missing values, and malformed dates exit 2 with usage on stderr
- **Scenario**: Invalid CLI input must fail loudly, not emit partial JSON.
- **Steps**:
  1. Run the unit command below.
  2. Confirm `--bogus` exits 2 with `unknown argument: --bogus` and `usage: node usage-report.js` on stderr and an empty stdout, and that `--project`/`--since` with no value, `--since yesterday`, and `--until 2026-13-45` each exit 2.
- **Expected Result**: 2 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='unknown flag|missing flag value' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-008: Pricing table is complete, dated, and tier-tagged
- **Scenario**: Costs are estimates derived from the shipped `pricing.json`, so it must carry an `asOf` stamp and complete numeric rates for the current haiku, sonnet, and opus prefixes.
- **Steps**:
  1. Run the unit command below.
  2. Confirm `asOf` is `YYYY-MM-DD`, `claude-haiku-4-5`, `claude-sonnet-5`, and `claude-opus-5` are present with the matching tier, and every entry has non-negative numeric `input`, `output`, `cacheWrite`, and `cacheRead`.
- **Expected Result**: 2 tests pass, 0 fail (the pattern also runs the `price` arithmetic test).
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='pricing.json|price:' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-009: The skill is offline and read-only
- **Scenario**: The acceptance criteria require no network access and no writes outside stdout.
- **Steps**:
  1. Run the unit command below.
  2. Confirm the script requires only `node:fs`, `node:os`, `node:path`, and `node:readline`, contains no fs write/delete call and no `fetch`/`XMLHttpRequest`/`WebSocket`, and that running the CLI (default and `--all-projects --pretty`) leaves every fixture file byte-for-byte unchanged.
- **Expected Result**: 2 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='offline and read-only|leaves the transcript' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-010: SKILL.md carries the required metadata and states the rendering contract
- **Scenario**: The skill file must have the frontmatter from the task (category `researching`, haiku model, `disable-model-invocation: false`, `user-invocable: true`, argument hint) and instruct the model to render totals, per-model, per-skill with `declared vs observed` / `MISMATCH`, top 5 cost days, the empty-project one-liner, and the estimate/heuristic/unpriced caveats.
- **Steps**:
  1. Run the unit command below.
  2. Confirm the frontmatter fields, the `**Prereqs:**` line, the `scripts/usage-report.js` reference, the read-only/offline statement (writes no files, no network request), and the required rendering and caveat text.
- **Expected Result**: 2 tests pass, 0 fail. The tests assert the file's text contract; how a model renders it at run time is not asserted.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='SKILL.md' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-011: Script is executable and exactly one row is added to each command table
- **Scenario**: The script has a node shebang, strict mode, and the executable bit. `lib/skills/README.md` and `CLAUDE.md` each carry exactly one `usage-report` row (no duplicate, no missing row).
- **Steps**:
  1. Run the unit command below.
  2. Confirm the shebang, `'use strict'`, the executable bit, one README row mentioning `offline, read-only`, and one `CLAUDE.md` row with the `[--all-projects] [--since YYYY-MM-DD]` argument hint.
- **Expected Result**: 2 tests pass, 0 fail.
- **Repeatable Unit Test**: Created: `test/usage-report.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='registration|executable' test/usage-report.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-MAN-001: Smoke run against this repo's real transcripts reports counts only
- **Scenario**: The script must work on real, large transcripts (streamed, tolerant of odd lines) without erroring. Record **only counts and flags**; never copy transcript content, prompts, paths inside transcripts, or ids into this file.
- **Steps**:
  1. Run the command below as-is from the repo root (it summarises the JSON down to counts).
  2. Confirm it exits 0 and prints valid JSON.
- **Command**:
  ```bash
  node lib/skills/usage-report/scripts/usage-report.js | jq '{schemaVersion, hasTurns: (.totals.turns > 0), models: (.byModel | length), skills: (.bySkill | length), skippedLines: .meta.skippedLines, unpriced: .meta.unpricedModels}'
  ```
- **Expected Result**: `schemaVersion` is 1, `hasTurns` is true, `models` and `skills` are positive integers, `skippedLines` is a non-negative integer, and `unpriced` is an array (empty when every model in use is in `pricing.json`).
- **Repeatable Unit Test**: Not applicable: depends on the machine's real, changing transcript history; the same behaviours are covered on fixtures by UAT-INT-001 through UAT-INT-007.
- [x] Pass <!-- 2026-09-19 -->