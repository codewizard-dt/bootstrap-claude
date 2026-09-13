---
id: UAT-084
aliases: [UAT-084]
title: "UAT: Mark the Docker harness wiki knowledge page as retired"
status: passed
task: TASK-084
created: 2026-09-13
updated: 2026-09-13
---

# UAT-084 — UAT: Mark the Docker harness wiki knowledge page as retired

implements::[[TASK-084]]

> **Source task**: [[TASK-084]]
> **Generated**: 2026-09-13

---

## Prerequisites

- [ ] Repo checked out at the commit containing TASK-084's edits (working tree changes to `wiki/knowledge/sources/docker-fresh-machine-test-harness.md` and `wiki/index.md`)
- [ ] Node.js available on `PATH` (for the repeatable unit test command)

---

## Test Cases

### UAT-DOC-001: Retirement callout present on the knowledge page
- **Page**: `wiki/knowledge/sources/docker-fresh-machine-test-harness.md`
- **Description**: Verifies the page now carries a prominent retirement callout immediately after the frontmatter, per the task's contradiction-flagging convention, so a reader or `/wiki-query` cannot mistake it for describing current functionality.
- **Steps**:
  1. Open `wiki/knowledge/sources/docker-fresh-machine-test-harness.md`.
  2. Inspect the first line of body content, immediately after the YAML frontmatter closes (`---`).
- **Expected Result**: The first body line is exactly: `> **Retired (2026-09-04):** The Docker fresh-machine harness this page describes was removed entirely per [[ROADMAP-010]] — the harness was judged too much operational hassle for its value. This page is kept as historical/technical record only; do not treat it as describing current functionality.`
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js` (test: `docker-fresh-machine-test-harness.md carries a retirement callout`)
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-DOC-002: `wiki/index.md` entry marked `(retired)`
- **Page**: `wiki/index.md`
- **Description**: Verifies the home Map of Content's one-line summary for this source page now conveys retirement, so a reader scanning the index doesn't have to open the page to learn it's stale.
- **Steps**:
  1. Open `wiki/index.md`.
  2. Locate the line linking to `knowledge/sources/docker-fresh-machine-test-harness.md`.
- **Expected Result**: The line's summary ends with a `(retired)` marker (currently: `...CI needs no Docker-in-Docker (retired)`).
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js` (test: `wiki/index.md marks the Docker harness source page as retired`)
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-001: Page remains valid historical record, not deleted
- **Scenario**: Per the task's Approach, knowledge pages are timeless synthesis revised in place, not deleted, even when the feature they describe is removed. Confirm the retirement was additive (a callout), not a deletion or gutting of the page's technical content.
- **Steps**:
  1. Open `wiki/knowledge/sources/docker-fresh-machine-test-harness.md`.
  2. Confirm the pre-existing research findings (Docker-vs-VM rationale, `bin/cli.js` scratch-path finding, non-interactive "hard no" finding, idempotency pattern, CI finding, and the 2026-08-27 follow-up) are all still present below the new callout.
  3. Confirm the `relates_to::[[TASK-060]]` and `relates_to::[[TASK-076]]` typed links at the bottom are unchanged.
- **Expected Result**: All prior body content and typed links are intact; only the callout was added at the top. The page is not empty, truncated, or replaced with a stub.
- **Repeatable Unit Test**: Not applicable: asserting "all prior prose is unchanged" is a content-preservation judgment call better made by a human/reviewer diff read than a brittle full-text regex; the two mechanical assertions (callout present, index marked) are already covered by UAT-DOC-001/002.
- [x] Pass <!-- 2026-09-13 --> — direct file read confirms all prior findings (Docker-vs-VM rationale, `bin/cli.js` scratch-path finding, non-interactive hard-no finding, idempotency pattern, CI finding, 2026-08-27 follow-up) and both `relates_to::[[TASK-060]]`/`relates_to::[[TASK-076]]` links are intact below the new callout; only the callout was added at the top.

---

## Gaps

None — this task is a documentation-only edit (no API, UI, or runtime code paths introduced), so no tests were dropped for insufficient research. Both mechanical assertions were verified directly against the current file contents before this UAT was written.

## Notes

- `uatGenerate.promoteTests` is set to the legacy value `true`, mapped to `dedicated` (write promoted tests to the project's existing dedicated test directory). The project already has a directly relevant sibling suite — `test/docker-harness-removed.test.js`, covering the same TASK-078/ROADMAP-010 Docker-harness-removal effort — so both promoted assertions were added there in place rather than as a new file, per the "extend an existing covering file" rule. Verified via `node --test test/docker-harness-removed.test.js` (5/5 passing, including the 2 new cases).
