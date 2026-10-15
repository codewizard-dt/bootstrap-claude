---
id: UAT-0126
aliases: [UAT-0126]
title: "UAT: Build /whats-next: a read-only cross-family skill that ranks ALL open work (v1, no --go)"
status: pending
task: TASK-0126
created: 2026-09-20
updated: 2026-09-20
---

# UAT-0126 — UAT: Build /whats-next: a read-only cross-family skill that ranks ALL open work (v1, no --go)

implements::[[TASK-0126]]

> **Source task**: [[TASK-0126]]
> **Generated**: 2026-09-20

TASK-0126 adds `lib/skills/whats-next/SKILL.md`, a markdown-as-program skill, plus three registration rows (`lib/skills/README.md`, `CLAUDE.md`, the Serena skills memory) and a `wiki/log.md` entry. A skill cannot be executed by a unit test, so every automated case pins a stable, contract-level string or structure in the SKILL.md (or a cited sibling doc) with a read-only `node:test` file. Two files back the cases: `test/whats-next-skill.test.js` (shipped with TASK-0126, 20 tests: frontmatter, Prereqs grammar, read-only Constraints, sweep pitfalls, tier order, dependency rule, `/command` resolution, registration) and `test/whats-next-skill-crossrefs.test.js` (written by this UAT generation, 20 tests, for what the first file leaves open: the per-state `Next` command mapping, tier membership, within-tier sort order, wave rules, report section order and columns, the STOP text, that every cited shared doc and sibling `Rank` step really exists, and the log entry). The new file's tests carry a tag in their names (`[next-map]`, `[tiers]`, `[order]`, `[waves]`, `[report]`, `[stop]`, `[refs]`, `[readonly]`, `[log]`) that the commands select. Each `Unit Test Command` was run before this file was written and the test count in each Expected Result was confirmed.

**Out of scope on purpose**:
- **The `--go` handoff**: v1 deliberately has none; `/power-mode` takes only a roadmap or single-task path today. UAT-EDGE-001 asserts its absence, not its behaviour.
- **The installed copy** `~/.claude/skills/` and `install-global.sh`: the task says not to run it. The skill is not invocable until the next normal install syncs it, which is why the live run is a manual, post-install case (UAT-MAN-001).
- **Known failures from other work** in the full suite (`shared-id-resolution` (f), `skill-frontmatter-aliases` x4) are unrelated; no case here depends on the full suite.

---

## Prerequisites

- [ ] Working directory is the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`) with TASK-0126's implementation present
- [ ] `node` >= 18 on PATH (`node --test` with `--test-name-pattern`)
- [ ] No network, secrets or running services needed for the automated cases; every one is read-only
- [ ] For UAT-MAN-001 only: `install-global.sh` has been run by the user (normal install, not by this UAT), ROADMAP-0014 Phase 4 has landed so the suggested commands exist in the installed set, and Claude Code has been restarted so `/whats-next` is listed

---

## Test Cases

### UAT-INT-001: Frontmatter tier equals roadmap-assess and the description and argument hint are as specified
- **Scenario**: `lib/skills/whats-next/SKILL.md` has `name: whats-next`; `category`, `model`, `disable-model-invocation` and `user-invocable` equal `roadmap-assess`'s (read from that file at test time, never hardcoded); `argument-hint` carries `--limit` and `--family`; the description starts "Survey ALL open work".
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 4`, `pass 4`, `fail 0`. A failure names the frontmatter key that drifted.
- **Repeatable Unit Test**: Created: `test/whats-next-skill.test.js` (shipped with TASK-0126)
- **Unit Test Command**: `node --test --test-name-pattern='whats-next: (SKILL.md exists|tier keys|argument-hint present|description starts)' test/whats-next-skill.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-002: The first body line is a Prereqs line matching the boilerplate grammar with exactly one lifecycle reference
- **Scenario**: The line reads ``**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/tasks/lifecycle.md`; run /primer if not done this session.`` The grammar is the one `test/skill-boilerplate.test.js` enforces; only one `wiki/work/<family>/lifecycle.md` reference is legal.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/whats-next-skill.test.js` (shipped with TASK-0126)
- **Unit Test Command**: `node --test --test-name-pattern='first body line is a Prereqs' test/whats-next-skill.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-003: The verified Serena sweep pitfalls are encoded in the skill text
- **Scenario**: The skill states: sweep by frontmatter never by index text; use `[^\n]*` never `.*`; never `multiline=false` with `^` anchors; `paths_include_glob` needs the full repo-relative path (example `wiki/work/tasks/TASK-*.md`); exclude `archive/` via `paths_exclude_glob`; an empty sweep against a non-empty index is a WARNING. Losing any one silently returns nothing or floods the context.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/whats-next-skill.test.js` (shipped with TASK-0126)
- **Unit Test Command**: `node --test --test-name-pattern='sweep pitfalls are encoded' test/whats-next-skill.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-004: The five ranking tiers appear in order, hold the specified items, and Blocked items are never ranked as actionable
- **Scenario**: Step 3 lists Fix what's broken, Finish what's started, Unblock, Start ready work, Triage & hygiene, then Blocked, and says the sort is never a numeric score. Tier 1 = bugs `in-progress`, P0/P1 or `severity: critical`. Tier 2 = `in-progress` and `pending-uat` tasks plus the untriaged-bug batch row only when any is `high`/`critical`. Tier 3 = proposed ADR blocks gating live work and approved PRDs with no downstream. Tier 4 = `todo` tasks whose `depends_on` edges are all start-satisfied, inline roadmap items, accepted ADR blocks with no task. Tier 5 = untriaged bugs, stale drafts, fully-checked roadmaps, index drift. Blocked (unsatisfied edge, cycle members) is never ranked as actionable.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 5`, `pass 5`, `fail 0` (one tier-order test plus four `[tiers]` tests).
- **Repeatable Unit Test**: Created: `test/whats-next-skill.test.js` (shipped with TASK-0126) and `test/whats-next-skill-crossrefs.test.js` (written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='five tiers appear|\[tiers\]' test/whats-next-skill.test.js test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-005: Within a tier the sort is depth desc, fan-out desc, age asc, ID asc, and roadmap membership is not a ranking input
- **Scenario**: The "Within a tier" line orders `downstream_depth` descending, `fan_out` descending, age ascending, ID ascending, in that order. "Roadmap membership is a display column, not a ranking input" is stated so orphan tasks rank exactly as roadmap tasks.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/whats-next-skill-crossrefs.test.js` (and the shipped `test/whats-next-skill.test.js`)
- **Unit Test Command**: `node --test --test-name-pattern='\[order\]|roadmap membership is stated' test/whats-next-skill.test.js test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-006: The start-satisfied vs close-satisfied dependency rule names pending-uat, done and soft-blocked
- **Scenario**: Step 2 says a `depends_on` edge is start-satisfied when the prerequisite is `pending-uat` or `done` (or has left the active set as terminal), close-satisfied only when `done`, and a task with a `pending-uat` prerequisite is flagged soft-blocked for closure.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/whats-next-skill.test.js` (shipped with TASK-0126)
- **Unit Test Command**: `node --test --test-name-pattern='start-satisfied vs close-satisfied' test/whats-next-skill.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-007: Waves are two, capped at --limit (default 5), built from the task pipeline only
- **Scenario**: Step 4 groups Tier 1-4 task-pipeline items (tasks plus UAT runs of `pending-uat` tasks) with no edge between them into Wave 1 and Wave 2, caps each at `--limit N` (default 5), omits Wave 3+, skips bug batches, ADR, PRD and roadmap rows, and leaves collision-safety beyond graph edges to `/power-mode`'s own protocol.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 2`, `pass 2`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/whats-next-skill-crossrefs.test.js` (written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\[waves\]' test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-008: The report has sections 5a-5e in order, the seven-column ranked table, and the specified warnings
- **Scenario**: Step 5 prints Snapshot (per-family line plus WIP-by-state histogram), Waves, Ranked table (`Rank | Item | Family | Roadmap | Why | Unblocks | Next`), Blocked, Warnings in that order with no preamble. Warnings cover cycles, asymmetric edges (`A ← B (no matching blocks)`), stale references, index drift, the orphan count (`N of M active tasks sit outside every active roadmap`) and empty-sweep suspicion.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 4`, `pass 4`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/whats-next-skill-crossrefs.test.js` (written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\[report\]' test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-009: Every item state maps to its specified Next command and every suggested /command resolves to a real skill
- **Scenario**: task `in-progress`/`todo` -> `/tackle <path>`; `pending-uat` with UAT -> `/uat-auto <uat>` only when every unresolved case is unit-backed, else `/uat-walk <uat>`; `pending-uat` without UAT -> `/uat-create <task>`; bug `open` -> `/bug-assess` or `/bug-triage`; `triaged` -> `/bug-triage` or `/task-create`; `in-progress` -> `/bug-close`; proposed ADR block -> `/adr-finalize <file>#DM`; accepted-without-task -> `/task-create --decision ADR-NNNN#DM`; approved PRD -> `/adr-extract <file>`; draft PRD -> `/prd-finalize <file>`; roadmap fully checked or inline item -> `/roadmap-next <roadmap>`. Each named skill has a `lib/skills/<name>/SKILL.md`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 3`, `pass 3`, `fail 0` (the mapping test, the unit-backed rule test, the command-resolution test).
- **Repeatable Unit Test**: Created: `test/whats-next-skill-crossrefs.test.js` (and the shipped `test/whats-next-skill.test.js`)
- **Unit Test Command**: `node --test --test-name-pattern='\[next-map\]|every suggested /command' test/whats-next-skill.test.js test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-010: Shared docs are pointed at by path, not restated, and every pointer resolves to a real section
- **Scenario**: The skill cites `lib/skills/_shared/ID-RESOLUTION.md` (Family table) and `lib/skills/roadmap-next/SKILL.md` (Parse a roadmap) by path without copying the mask algorithm or the parse procedure, runs only the Parse procedure (never the writing ones), and defers in-family precedence to the Rank step of `adr-assess`, `prd-assess`, `uat-assess` and `bug-assess`. Each cited heading exists in the target file, so no pointer is dangling.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 4`, `pass 4`, `fail 0` (two "pointed at, not restated" tests and two `[refs]` tests).
- **Repeatable Unit Test**: Created: `test/whats-next-skill-crossrefs.test.js` (and the shipped `test/whats-next-skill.test.js`)
- **Unit Test Command**: `node --test --test-name-pattern='references the ID-RESOLUTION|references roadmap-next|\[refs\]' test/whats-next-skill.test.js test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-INT-011: The skill is registered in the skills README, CLAUDE.md and the Serena skills memory, and the log entry exists
- **Scenario**: `lib/skills/README.md` has a `| \`whats-next\` |` row; `CLAUDE.md` Custom Commands has a `| \`/whats-next ...\` |` row; `.serena/memories/skills/format-and-model-selection.md` lists `whats-next` on the **researching** line; `wiki/log.md` carries `## [2026-09-20] edit | TASK-0126 /whats-next skill added`.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 4`, `pass 4`, `fail 0` (three registration tests, one `[log]` test).
- **Repeatable Unit Test**: Created: `test/whats-next-skill.test.js` (shipped with TASK-0126) and `test/whats-next-skill-crossrefs.test.js` (written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='registered in|listed on the researching|\[log\]' test/whats-next-skill.test.js test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-001: The skill is strictly read-only — four read tools only, no prompts, no writes, no --go, never runs a Unit Test Command
- **Scenario**: This is the safety property that distinguishes `/whats-next` from `roadmap-assess` (auto-close), `bug-assess` (prompts) and `task-assess` (edits plus a file write). `## Constraints` contains "Read-only"; the `Permitted tools:` line lists exactly `list_dir`, `find_file`, `search_for_pattern`, `Read` and none of `AskUserQuestion`/`Skill`/`Edit`/`Write`/`Bash`; no instruction appends to `wiki/log.md` or an `index.md`; the "never run a case's `Unit Test Command`" sentence is present; frontmatter has no `allowed-tools`, no `--go` anywhere; the `/power-mode` handoff is deferred in a single Constraints sentence.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 8`, `pass 8`, `fail 0`. A failure names the write path or extra tool that was introduced.
- **Repeatable Unit Test**: Created: `test/whats-next-skill.test.js` (shipped with TASK-0126) and `test/whats-next-skill-crossrefs.test.js` (written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='Constraints block declares|Permitted tools line|never instructs an append|never run a case|does not define a --go|\[readonly\]' test/whats-next-skill.test.js test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-002: The STOP message fires only when every family is genuinely empty
- **Scenario**: The exact text `No open work found — nothing to rank. Use /task-create, /bug-create or /roadmap-create to add some.` is present and gated on "only when every family is genuinely empty". A single family returning nothing while its index shows items is a warning (UAT-INT-003), never a STOP.
- **Steps**:
  1. Run the unit test command below as-is
  2. Read the summary lines
- **Expected Result**: `tests 1`, `pass 1`, `fail 0`.
- **Repeatable Unit Test**: Created: `test/whats-next-skill-crossrefs.test.js` (written by this UAT generation)
- **Unit Test Command**: `node --test --test-name-pattern='\[stop\]' test/whats-next-skill-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-EDGE-003: The skill-iterating suites stay green with the new skill in the tree
- **Scenario**: `skill-boilerplate`, `assess-skills-contract` and `assess-skills-crossrefs` iterate every skill directory; the new `whats-next` skill (Prereqs grammar, frontmatter, assess-family conventions) must not break any of them. The task recorded these as passing; the five known pre-existing failures live in other files and are not selected.
- **Steps**:
  1. Run the unit test command below as-is (three explicit files; not the full suite)
  2. Read the summary lines
- **Expected Result**: `tests 107`, `pass 107`, `fail 0`, `skipped 0`.
- **Repeatable Unit Test**: Created: `test/skill-boilerplate.test.js`, `test/assess-skills-contract.test.js`, `test/assess-skills-crossrefs.test.js` (existing suites reused, not modified)
- **Unit Test Command**: `node --test test/skill-boilerplate.test.js test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js`
- [x] Pass <!-- 2026-09-20 -->

### UAT-MAN-001: Post-install, /whats-next on this repo ranks the TASK-0118 to 0124 chain first, surfaces the orphan tasks and untriaged bugs, and warns on asymmetric edges
- **Scenario**: The unit tests cannot execute the skill; this case confirms the behaviour end to end on the live wiki. The counts below are the 2026-09-20 measurements from the task; treat them as approximate if work has landed since (the qualitative expectations are what matter).
- **Steps**:
  1. After the user has run `install-global.sh` and restarted Claude Code, open a session in this repo and run `/whats-next`
  2. Confirm it printed with no preamble, in order: Snapshot (one line per family plus a WIP-by-state histogram), Wave 1 / Wave 2 with copy-pasteable commands, a Ranked table with the columns `Rank | Item | Family | Roadmap | Why | Unblocks | Next`, Blocked, Warnings
  3. In the Ranked table and waves, find the `TASK-0118 -> 0119 -> 0120 -> 0121 -> 0122 -> 0123 -> 0124` chain
  4. In Warnings, find the orphan count line and the asymmetric-edge lines
  5. In the Ranked table, find the untriaged bugs
  6. Run `git status --short` and compare against the status before step 1
- **Expected Result**:
  - The `TASK-0118 -> ... -> 0124` chain is listed first (through its UAT runs): the chain's `pending-uat` and `in-progress` items appear in Tier 2 with `/uat-auto` or `/uat-walk` commands, and later chain members that are start-satisfied but soft-blocked for closure are flagged (for example TASK-0121 is `in-progress` while its prerequisites are `pending-uat`).
  - The five orphan tasks (in no active roadmap) appear ranked exactly as roadmap tasks, with `Roadmap` shown as `—`, and the Warnings block reports about `5 of 31 active tasks sit outside every active roadmap` with a `/roadmap-create` adoption suggestion.
  - The nine open, untriaged bugs (BUG-0001 to BUG-0008 and BUG-0012) appear as one batch row with `/bug-assess`, in Tier 5 unless any is `high`/`critical` (then Tier 2).
  - Warnings name the asymmetric edges `TASK-0096 ← TASK-0093`, `TASK-0114 ← TASK-0095` and `TASK-0121 ← TASK-0097` (`no matching blocks`), unless those edges have since been reconciled.
  - Family indexes that disagree with the frontmatter sweep (for example a roadmap index reading 0/9 while its file has nine checked links) are reported as index drift rather than trusted.
  - Every `Next` cell is a real installed skill command (no dead `/decision-*`, `/req-*`, `/bug-file`, `/task-add` names).
  - The run is read-only: `git status --short` is identical before and after, no `wiki/work/tasks/dependency-graph.md` or other file is written, no prompt was raised, and no `*-assess` skill was invoked.
- **Repeatable Unit Test**: Not applicable: executes the skill against the live wiki through an LLM after a global install, which no unit test can do; the skill's text contract (tiers, Next mapping, warnings, read-only) is covered by UAT-INT-004 to UAT-INT-009 and UAT-EDGE-001
- [FAIL: auto-judge: manual test requires human verification (post-install; skill not yet installed)] <!-- 2026-09-20 -->
