---
id: UAT-011
aliases: [UAT-011]
title: "UAT: Update /wiki-lint to flag knowledge pages with weak or unset confidence provenance"
status: skipped
task: TASK-011
created: 2026-07-06
updated: 2026-07-06
---

# UAT-011 — UAT: Update /wiki-lint to flag knowledge pages with weak or unset confidence provenance

implements::[[TASK-011]]

> **Source task**: [[TASK-011]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Repo checked out at the branch containing the TASK-011 change to `lib/skills/wiki-lint/SKILL.md`
- [ ] Run all commands from the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`)

---

## Test Cases

All cases assert on the content of `lib/skills/wiki-lint/SKILL.md`, a prose skill spec (no runtime surface). Each command is a single deterministic check runnable by `/uat-auto`; a non-empty match (exit 0) is a pass unless stated otherwise.

### UAT-EDGE-001: §2.10 check section exists
- **Scenario**: The new provenance check is present as its own numbered subsection in the wiki-lint skill.
- **Steps**: Confirm a `### 2.10` heading covering provenance/confidence exists.
- **Command**:
  ```bash
  grep -n '### 2.10 Provenance / confidence (LOW)' lib/skills/wiki-lint/SKILL.md
  ```
- **Expected Result**: One matching line — the §2.10 heading is present and tagged LOW severity.
- **Repeatable Unit Test**: Not applicable: assertion targets prose content of a skill spec; the repo has no markdown-content test harness.
- [FAIL: auto-judge: content/scope assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-002: Scoped to knowledge pages, excludes wiki/work/
- **Scenario**: The check only inspects `wiki/knowledge/` pages and explicitly excludes `wiki/work/` artifacts (which use `status`, not `confidence`).
- **Steps**: Confirm the §2.10 body names the three knowledge subtrees and states work pages are out of scope.
- **Command**:
  ```bash
  grep -nE 'Knowledge pages only|Skip `wiki/work/` entirely' lib/skills/wiki-lint/SKILL.md
  ```
- **Expected Result**: Both the "Knowledge pages only" scoping and the "Skip `wiki/work/` entirely" exclusion appear in the section.
- **Repeatable Unit Test**: Not applicable: prose-content assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: content/scope assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-003: Distinguishes weak provenance from untagged provenance
- **Scenario**: The check separates the two tiers — explicit `inferred`/`ambiguous` (weak, primary signal) vs. a missing `confidence` key (untagged, informational only).
- **Steps**: Confirm both tier labels are documented.
- **Command**:
  ```bash
  grep -nE 'Weak provenance|Untagged provenance' lib/skills/wiki-lint/SKILL.md
  ```
- **Expected Result**: Both `Weak provenance` (`inferred`/`ambiguous`) and `Untagged provenance` (no `confidence` key) tiers are present.
- **Repeatable Unit Test**: Not applicable: prose-content assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: content/scope assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-004: Untagged tier does not contradict the "omitting means extracted" convention
- **Scenario**: Per `wiki/conventions.md` §4, omitting `confidence` defaults to `extracted`; the untagged tier must therefore be an informational nudge, not a defect, and the check must be report-only (no auto-fix).
- **Steps**: Confirm the section frames untagged as "not a defect" / informational and marks the whole check report-only.
- **Command**:
  ```bash
  grep -nE 'not\*\* a defect|informational nudge|Report-only' lib/skills/wiki-lint/SKILL.md
  ```
- **Expected Result**: The section states the untagged tier is not a defect / an informational nudge, and that provenance findings are report-only.
- **Repeatable Unit Test**: Not applicable: prose-content assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: content/scope assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-005: Cross-references wiki/conventions.md §4 for the confidence semantics
- **Scenario**: The check cites the convention as the authority for the three `confidence` values instead of re-documenting them.
- **Steps**: Confirm §2.10 references `wiki/conventions.md` §4.
- **Command**:
  ```bash
  grep -nE 'wiki/conventions\.md.*§4|conventions\.md` §4' lib/skills/wiki-lint/SKILL.md
  ```
- **Expected Result**: The §2.10 body points to `wiki/conventions.md` §4 as the definition of `extracted`/`inferred`/`ambiguous`.
- **Repeatable Unit Test**: Not applicable: prose-content assertion, no markdown-content test harness in repo.
- [FAIL: auto-judge: content/scope assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->

### UAT-EDGE-006: Change is documentation-only (no wiki frontmatter backfill)
- **Scenario**: TASK-011 edits only the skill spec; it must not have altered any `wiki/knowledge/` page's `confidence` frontmatter.
- **Steps**: Confirm the only change introducing a §2.10 provenance check is in the wiki-lint skill, not in knowledge pages. (Human-verified against the diff — no automatable oracle.)
- **Command**:
  ```bash
  git diff --name-only HEAD~1 HEAD -- lib/skills/wiki-lint/SKILL.md wiki/knowledge/
  ```
- **Expected Result**: `lib/skills/wiki-lint/SKILL.md` is the SKILL file touched; no `wiki/knowledge/` page appears solely to add/alter a `confidence` value as part of this task. Human judgment confirms documentation-only scope (the commit boundary may vary in a batched branch, so treat a mismatch here as a prompt for manual diff review, not an automatic fail).
- **Repeatable Unit Test**: Not applicable: scope/diff judgment requiring human review; no deterministic oracle.
- [FAIL: auto-judge: content/scope assertion not machine-verifiable headless — grep-on-markdown oracle blocked by the Serena-first hook; content independently confirmed present via Serena, needs /uat-walk or /uat-skip] <!-- 2026-07-06 -->
