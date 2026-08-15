---
id: UAT-001
aliases: [UAT-001]
title: "UAT: Audit lib/skills for stale README.md-style family-index references"
status: skipped
task: TASK-001
created: 2026-07-06
updated: 2026-07-06
---

# UAT-001 — UAT: Audit lib/skills for stale README.md-style family-index references

implements::[[TASK-001]]

> **Source task**: [[TASK-001]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Repo checked out at the `bootstrap-claude` root
- [ ] `wiki/work/tasks/TASK-001-audit-skill-readme-drift.md` present with a `## Audit Findings` section
- [ ] **Context note:** TASK-001 is an audit-only task. Its findings document the *pre-remediation* state of `lib/skills/`. The downstream fix task (TASK-003) has since edited those skill files, so the exact line numbers and the presence of `wiki/work/<family>/README.md` drift cited in the findings may no longer match the current working tree. Verifying the *accuracy* of the historical audit therefore requires human judgment (and/or `git` history) — this is why the accuracy/completeness tests below are Manual.

---

## Test Cases

### UAT-MANUAL-001: Audit Findings section is present and complete
- **Description**: The deliverable of TASK-001 is a structured findings document consumable by TASK-003. Verify the `## Audit Findings` section exists and contains all four required parts.
- **Steps**:
  1. Open `wiki/work/tasks/TASK-001-audit-skill-readme-drift.md`.
  2. Locate the `## Audit Findings` section.
  3. Confirm it contains: (a) a "Convention confirmed" subsection, (b) a "Confirmed drifting skills" list with per-skill line numbers and a description of the wrong assumption, (c) a "Confirmed NOT drift (out of scope)" list with a one-line reason per skill, and (d) a "Template scan" subsection.
- **Expected Result**: All four subsections present; the confirmed-drifting list enumerates 9 skills with line references; the not-drift list enumerates the excluded skills each with a reason.
- **Repeatable Unit Test**: Not applicable: the deliverable is a prose findings document; this repo has no unit-test harness for asserting on markdown audit content.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->

### UAT-MANUAL-002: Confirmed-drifting list is accurate
- **Description**: Each skill named in the "Confirmed drifting skills" list genuinely treated `wiki/work/<family>/README.md` as the authoritative index / template / spec at audit time (a real pre-wiki-schema drift), not a benign root-level or external README reference.
- **Steps**:
  1. For each of the 9 named skills (primer, task-audit, bug-file, power-mode, roadmap-next, task-update, roadmap-create, tackle, bug-close), review the cited assumption in the findings.
  2. Confirm via `git` history / diff that the cited lines referenced `wiki/work/<family>/README.md` as an authoritative family index/template/spec before TASK-003's fix. (In the current working tree these references are expected to be already remediated.)
  3. Confirm the audit's distinction between genuine drift and benign exclusion-list mentions (e.g. roadmap-next's roadmap-listing exclusion, tackle's roadmap-listing exclusion) is correct.
- **Expected Result**: All 9 skills were genuine drift at audit time; benign mentions correctly excluded. Human/`git`-history confirmation required.
- **Repeatable Unit Test**: Not applicable: verifying a historical audit against a since-remediated tree requires human judgment / VCS history, not a deterministic runner assertion.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->

### UAT-MANUAL-003: Not-drift exclusions are correctly categorized
- **Description**: The skills the audit marked out of scope (frontend-taste, elevator-pitch, project-readme, update-docs, extract-feature, port-feature, eval-create) reference a `README.md` that is NOT a `wiki/work/<family>/` family index — i.e. a root-level project README, an external repo's README, or a non-wiki generated artifact.
- **Steps**:
  1. For each excluded skill, open the cited line in `lib/skills/<skill>/SKILL.md`.
  2. Confirm the README reference is root-level (elevator-pitch, project-readme, update-docs), external (frontend-taste `~/code/house-style/README.md`, port-feature `<source-path>/README.md`), or a non-wiki generated doc (extract-feature inventory, eval-create `evals/README.md`).
- **Expected Result**: Every excluded skill's README reference falls outside the `wiki/work/<family>/` family-index role. None is misclassified.
- **Repeatable Unit Test**: Not applicable: judgment call over reference intent; no unit-test harness in this markdown/bash repo.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->

### UAT-EDGE-001: Template layer scaffolds no family README.md
- **Scenario**: The findings' "Template scan" claim — that `lib/scripts/templates/wiki/` contains zero `README.md` references and ships only `index.md` + `lifecycle.md` per family. This claim is independent of TASK-003 and remains verifiable in the current tree.
- **Steps**:
  1. Run the command below from the repo root.
- **Command**:
  ```bash
  grep -rn 'README\.md' lib/scripts/templates/wiki/
  ```
- **Expected Result**: No output (zero matches). `grep` exiting non-zero with no printed lines is the PASS condition — it confirms no family template scaffolds a `README.md`.
- **Repeatable Unit Test**: Not applicable: single-command scaffold assertion; this repo has no unit-test runner to host it, and the check is already a one-line repeatable grep.
- [FAIL: auto-judge: command blocked by SERENA-FIRST hook — grep on code paths is disallowed in this environment, so the test command cannot execute cleanly. Underlying claim (zero README.md in lib/scripts/templates/wiki/) independently confirmed via mcp__serena__search_for_pattern, but the test-as-written is not machine-executable here] <!-- 2026-07-06 -->

### UAT-EDGE-002: Convention documents index.md + lifecycle.md with no README.md family role
- **Scenario**: The findings' "Convention confirmed" claim — `wiki/conventions.md` establishes `index.md` (active items only) + `lifecycle.md` (schema/transitions) as the family layout, with no `README.md` role.
- **Steps**:
  1. Open `wiki/conventions.md` and locate the Navigation / two-domain sections describing family layout.
  2. Confirm each `wiki/work/<family>/` is documented as carrying `index.md` (active-item bullet list) + `lifecycle.md` (schema/transitions).
  3. Confirm no `README.md` is assigned an index/template/spec role for any family.
  4. Spot-check `wiki/work/tasks/index.md` and `wiki/work/roadmaps/index.md` use the bullet-list format (`- [ID — Title](file.md) — summary · status`), not a multi-column table.
- **Expected Result**: Convention matches the audit's description; index files use bullet lists, not the `#`/`Slug`/`Progress`/`UAT`/`Flags`/`Objective` table the drifting skills assumed.
- **Repeatable Unit Test**: Not applicable: verifies documented prose convention and file format; no unit-test harness for markdown convention assertions.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->
