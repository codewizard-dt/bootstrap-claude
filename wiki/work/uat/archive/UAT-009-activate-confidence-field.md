---
id: UAT-009
title: "UAT: Activate confidence: extracted|inferred|ambiguous in wiki/conventions.md"
status: skipped
task: TASK-009
created: 2026-07-06
updated: 2026-07-06
---

# UAT-009 — UAT: Activate `confidence: extracted|inferred|ambiguous` in `wiki/conventions.md`

implements::[[TASK-009]]

> **Source task**: [[TASK-009]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] `wiki/conventions.md` exists and contains a "## 4. Frontmatter namespace" section with a base-keys table

---

## Test Cases

### UAT-DOC-001: `confidence` is an active base key in the frontmatter table
- **File**: `wiki/conventions.md` §4 (Frontmatter namespace)
- **Description**: Verifies `confidence` appears as a row in the "Base keys (used now)" table — not in the reserved-keys bucket — so it is documented as an active, populatable key.
- **Steps**:
  1. Open `wiki/conventions.md` and locate the §4 base-keys table (the table containing `id`, `title`, `status`, `created`/`updated`, `tags`, `aliases`, `sources`).
  2. Confirm a `confidence` row exists in that table with `Applies to` = `knowledge`.
- **Expected Result**: The base-keys table contains a `| `confidence` | knowledge | ... |` row describing it as page-claim provenance with `extracted` as the default value.
- **Repeatable Unit Test**: Not applicable: documentation-content assertion against a prose/markdown convention file; no business logic or parseable contract to unit-test, and the repo has no markdown-content test harness.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->

### UAT-DOC-002: All three confidence values are documented with meanings
- **File**: `wiki/conventions.md` §4
- **Description**: Verifies the three allowed values (`extracted`, `inferred`, `ambiguous`) are each defined so future ingests know when to use each.
- **Steps**:
  1. Read the `confidence` explanation paragraph/subsection immediately following the base-keys table.
  2. Confirm each of the three values is present with a one-line meaning.
- **Expected Result**: `extracted` is defined as the default (claim directly supported by source material), `inferred` as LLM synthesis beyond the source, and `ambiguous` as sources-disagree/uncertain. Omitting the key is stated to mean `extracted`.
- **Repeatable Unit Test**: Not applicable: documentation-content assertion; no automatable business-logic contract.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->

### UAT-DOC-003: `confidence` is removed from the reserved-keys list
- **File**: `wiki/conventions.md` §4
- **Description**: Verifies the reserved-keys line no longer lists `confidence` alongside the still-reserved keys, so active vs. reserved is unambiguous.
- **Steps**:
  1. Locate the "Reserved keys (declared, optional — populated later by overlays...)" line in §4.
  2. Read the list of key names that follows it.
- **Expected Result**: The reserved-keys list contains exactly `tier`, `last_verified`, `supersedes`, `superseded_by`, `scope` and does **not** include `confidence`.
- **Repeatable Unit Test**: Not applicable: documentation-content assertion; no automatable business-logic contract.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->

### UAT-DOC-004: Scope is documented as knowledge pages only
- **File**: `wiki/conventions.md` §4
- **Description**: Verifies the convention states `confidence` applies to `knowledge/` pages (`sources/`, `concepts/`, `entities/`) and not to `work/` artifacts (which use `status`).
- **Steps**:
  1. Read the `confidence` explanation.
  2. Confirm it scopes the key to knowledge pages and contrasts with `work/` artifacts using `status`.
- **Expected Result**: Text explicitly restricts `confidence` to knowledge pages and notes `work/` artifacts track state via `status` instead.
- **Repeatable Unit Test**: Not applicable: documentation-content assertion; no automatable business-logic contract.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->

### UAT-DOC-005: Activation is documented as forward-only (no backfill required)
- **Scenario**: The convention must state that activating `confidence` requires no rewrite of existing pages — adoption is a forward-only lint backfill — matching the task's "activation is forward-only" out-of-scope guard for existing-page backfilling.
- **Steps**:
  1. Read the `confidence` explanation in §4.
  2. Confirm it states existing pages need no backfill and adding the key later is a lint pass, never a structural rewrite.
- **Expected Result**: Text states adoption is forward-only: existing pages need no backfill; adding the key later is a lint pass, not a structural rewrite.
- **Repeatable Unit Test**: Not applicable: documentation-content assertion; no automatable business-logic contract.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-07-06 -->
