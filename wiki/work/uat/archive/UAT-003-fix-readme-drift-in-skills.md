---
id: UAT-003
title: "UAT: Fix roadmap-create and other skills drifting from the index.md/lifecycle.md convention"
status: skipped
task: TASK-003
created: 2026-07-06
updated: 2026-07-06
---

# UAT-003 — UAT: Fix roadmap-create and other skills drifting from the index.md/lifecycle.md convention

implements::[[TASK-003]]

> **Source task**: [[TASK-003]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Repo checked out at the `bootstrap-claude` root
- [ ] TASK-003's edits applied to `lib/skills/` (confirmed: all 9 formerly-drifting skill files show as modified in git; the working tree is the state under test)
- [ ] **Hook note:** this repo's SERENA-FIRST hook blocks `grep`/`find` on code paths. The deterministic `**Command**` blocks below therefore cannot execute under `/uat-auto` and will fail-closed; each underlying claim is independently verifiable (and was verified at generation time) via `mcp__serena__search_for_pattern`.

---

## Test Cases

### UAT-EDGE-001: No family-index README.md drift remains in lib/skills/
- **Scenario**: TASK-003's core acceptance (Step 3) — no skill still references `wiki/work/<family>/README.md` as the authoritative index/template/spec. This is the primary regression gate.
- **Steps**:
  1. Run the command below from the repo root.
- **Command**:
  ```bash
  grep -rnE 'work/(tasks|bugs|roadmaps)/README\.md' lib/skills/
  ```
- **Expected Result**: No output (zero matches). Every one of the 9 audited skills has had its `wiki/work/<family>/README.md` reference removed or retargeted. (Verified at generation via `mcp__serena__search_for_pattern` — zero hits.)
- **Repeatable Unit Test**: Not applicable: single-command drift-regression grep; this repo has no unit-test runner and the check is already a one-line repeatable search.
- [FAIL: auto-judge: command blocked by SERENA-FIRST hook — grep on code paths is disallowed in this environment. Claim independently confirmed TRUE via mcp__serena__search_for_pattern: zero `work/(tasks|bugs|roadmaps)/README.md` hits across lib/skills/. Test-as-written not machine-executable here] <!-- 2026-07-06 -->

### UAT-EDGE-002: roadmap-create retargets template/spec/index to lifecycle.md + roadmaps/index.md
- **Scenario**: The heaviest offender — `roadmap-create` must no longer treat `wiki/work/roadmaps/README.md` as template + spec + Index table; Index appends and reserved-ID scans go to `wiki/work/roadmaps/index.md`.
- **Steps**:
  1. Run the command below from the repo root.
- **Command**:
  ```bash
  grep -nE 'roadmaps/(index|lifecycle)\.md' lib/skills/roadmap-create/SKILL.md
  ```
- **Expected Result**: Matches present for `wiki/work/roadmaps/index.md` (Index append + `ROADMAP-\d{3}` reserved-ID scan, ~lines 59, 123, 160, 162); no `roadmaps/README.md` remains. (Verified via Serena: index.md referenced at lines 52, 59, 123, 160, 162.)
- **Repeatable Unit Test**: Not applicable: markdown-content assertion on skill prose; no harness in this repo.
- [FAIL: auto-judge: command blocked by SERENA-FIRST hook — grep on code paths disallowed. Claim independently confirmed TRUE via mcp__serena__search_for_pattern: roadmap-create references wiki/work/roadmaps/index.md at lines 52, 59, 123, 160, 162; no roadmaps/README.md remains] <!-- 2026-07-06 -->

### UAT-EDGE-003: task-audit persists the dependency graph to its own file, never index.md or README.md
- **Scenario**: task-audit previously wrote a `## Dependency Graph` section into `wiki/work/tasks/README.md`. The fix writes the graph to a dedicated `wiki/work/tasks/dependency-graph.md`, cross-linked one line from `index.md`, and explicitly forbids inlining it into `index.md`/`README.md`.
- **Steps**:
  1. Run the command below from the repo root.
- **Command**:
  ```bash
  grep -nE 'dependency-graph\.md|Never write the graph' lib/skills/task-audit/SKILL.md
  ```
- **Expected Result**: References `wiki/work/tasks/dependency-graph.md` as the graph's sole home (~lines 137, 251, 253, 272) plus the guard "Never write the graph into `index.md` or a `README.md`" (~line 274); reads retargeted to `wiki/work/tasks/index.md` (~lines 25, 68). (Verified via Serena.)
- **Repeatable Unit Test**: Not applicable: markdown-content assertion on skill prose; no harness in this repo.
- [FAIL: auto-judge: command blocked by SERENA-FIRST hook — grep on code paths disallowed. Claim independently confirmed TRUE via mcp__serena__search_for_pattern: task-audit references wiki/work/tasks/dependency-graph.md (lines 137, 251, 253, 272) and the guard "Never write the graph into index.md or a README.md" (line 274)] <!-- 2026-07-06 -->

### UAT-EDGE-004: bug-file, bug-close, and task-update point schema/spec to lifecycle.md
- **Scenario**: The three skills that cited `README.md` for the file template / severity rubric / close-gate / "authoritative spec" now point to the family `lifecycle.md` (schema authority) and the family `index.md` (active list).
- **Steps**:
  1. Run the command below from the repo root.
- **Command**:
  ```bash
  grep -rnE 'bugs/lifecycle\.md|tasks/lifecycle\.md|bugs/index\.md' lib/skills/bug-file/SKILL.md lib/skills/bug-close/SKILL.md lib/skills/task-update/SKILL.md
  ```
- **Expected Result**: task-update cites `wiki/work/tasks/lifecycle.md` as "the authoritative task file spec" (~line 43); bug-close reads `wiki/work/bugs/lifecycle.md` for close-gate requirements with the `README.md` read dropped (~line 42); bug-file appends to `wiki/work/bugs/index.md` (~lines 64, 93). None references a family `README.md`. (Verified via Serena.)
- **Repeatable Unit Test**: Not applicable: markdown-content assertion on skill prose; no harness in this repo.
- [FAIL: auto-judge: command blocked by SERENA-FIRST hook — grep on code paths disallowed. Claim independently confirmed TRUE via mcp__serena__search_for_pattern: task-update cites wiki/work/tasks/lifecycle.md as authoritative spec (line 43), bug-close reads wiki/work/bugs/lifecycle.md for close-gate (line 42), bug-file appends to wiki/work/bugs/index.md (lines 64, 93); no family README.md] <!-- 2026-07-06 -->

### UAT-EDGE-005: primer Step 4 targets tasks/index.md and drops the table-bootstrap procedure
- **Scenario**: primer's "Verify Task Index Bootstrap" assumed a structured `wiki/work/tasks/README.md` table with `#`/`Slug`/`Progress`/`UAT`/`Flags`/`Objective` columns. The fix retargets it to the real flat-bullet `wiki/work/tasks/index.md` and removes the table-bootstrap (there is nothing to "bootstrap").
- **Steps**:
  1. Run the command below from the repo root.
- **Command**:
  ```bash
  grep -nE 'tasks/index\.md|no table to' lib/skills/primer/SKILL.md
  ```
- **Expected Result**: References `wiki/work/tasks/index.md` as a flat bullet list (~lines 77, 80) with an explicit "There is no table to 'bootstrap'"; the old `Progress`/`UAT`/`Flags` column set is gone. (Verified via Serena.)
- **Repeatable Unit Test**: Not applicable: markdown-content assertion on skill prose; no harness in this repo.
- [FAIL: auto-judge: command blocked by SERENA-FIRST hook — grep on code paths disallowed. Claim independently confirmed TRUE via mcp__serena__search_for_pattern: primer references wiki/work/tasks/index.md as a flat bullet list (lines 77, 80) with "There is no table to bootstrap"; the old Progress/UAT/Flags table set is gone] <!-- 2026-07-06 -->

### UAT-MANUAL-001: Residual README.md mentions in lib/skills are all legitimately non-drift
- **Description**: A raw search for `README.md` in `lib/skills/` still returns hits. Confirm each remaining hit is NOT family-index drift but a legitimate reference: an exclusion-list mention when listing roadmap files (`roadmap-next`, `tackle`), the negative guard in `task-audit` ("Never write the graph into index.md or a README.md"), or an out-of-scope skill correctly identified by TASK-001 (root-level README: `elevator-pitch`, `project-readme`, `update-docs`; external README: `frontend-taste`, `port-feature`; non-wiki generated doc: `extract-feature`, `eval-create`).
- **Steps**:
  1. Review each residual `README.md` hit in `lib/skills/` and classify it against the list above.
- **Expected Result**: Every residual mention is a benign non-family-index reference; none reintroduces the `wiki/work/<family>/README.md` convention. Human/semantic judgment.
- **Repeatable Unit Test**: Not applicable: judgment call over reference intent; no unit-test harness in this markdown/bash repo.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->
