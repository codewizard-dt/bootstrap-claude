---
id: UAT-083
aliases: [UAT-083]
title: "UAT: Close ROADMAP-009 with an explicit reverted-not-completed note"
status: passed
task: TASK-083
created: 2026-09-13
updated: 2026-09-13
---

# UAT-083 — UAT: Close ROADMAP-009 with an explicit reverted-not-completed note

implements::[[TASK-083]]

> **Source task**: [[TASK-083]]
> **Generated**: 2026-09-13

---

## Prerequisites

- [ ] Repo checked out at the commit containing TASK-083's edits (working tree changes to `wiki/work/roadmaps/archive/ROADMAP-009-docker-fresh-machine-harness.md`, `wiki/work/roadmaps/index.md`, `wiki/work/roadmaps/archive/index.md`, and `wiki/log.md`)
- [ ] Node.js available on `PATH` (for the repeatable unit test command)

---

## Test Cases

### UAT-EDGE-001: ROADMAP-009 carries the explicit reverted-not-completed Notes entry
- **Scenario**: ROADMAP-009's lifecycle schema only supports `status: active | done` (no "abandoned"/"cancelled" state), so per the user's explicit decision the roadmap is closed as `done` but must carry an honest `## Notes` callout stating the Docker harness it built was later fully removed — so the archived record doesn't read as a silent, misleading success.
- **Steps**:
  1. Open `wiki/work/roadmaps/archive/ROADMAP-009-docker-fresh-machine-harness.md`.
  2. Inspect the `## Notes` section.
- **Expected Result**: The Notes section contains a `2026-09-04` entry reading: `The Docker fresh-machine harness this roadmap built was fully removed per [[ROADMAP-010]] — the user judged the harness "a fun idea but too much hassle" and decided GitHub Actions CI plus the harness itself should not exist in this repo. This roadmap is closed as` done `because every checklist item was in fact completed and verified at the time, not because the harness survives — see ROADMAP-010 for the reversal.`
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js` (test: `ROADMAP-009 frontmatter is status: done and carries the reverted-not-completed Notes entry`)
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-002: ROADMAP-009 frontmatter status flipped to done
- **Scenario**: The roadmap must be explicitly closed (`status: done`), not left `active`, since its checklist items were genuinely completed at the time even though the harness itself was later reverted.
- **Steps**:
  1. Open `wiki/work/roadmaps/archive/ROADMAP-009-docker-fresh-machine-harness.md`.
  2. Inspect the frontmatter `status:` field.
- **Expected Result**: `status: done`.
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js` (test: `ROADMAP-009 frontmatter is status: done and carries the reverted-not-completed Notes entry`)
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-003: ROADMAP-009 file archived out of the active roadmaps directory
- **Scenario**: Per the standard roadmap-archive procedure, a terminal roadmap file is `git mv`'d into `wiki/work/roadmaps/archive/` — it never stays in the active directory once closed.
- **Steps**:
  1. Check `wiki/work/roadmaps/ROADMAP-009-docker-fresh-machine-harness.md` (active directory) does not exist.
  2. Check `wiki/work/roadmaps/archive/ROADMAP-009-docker-fresh-machine-harness.md` exists.
- **Expected Result**: The file is absent from the active directory and present under `archive/`.
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js` (test: `ROADMAP-009 file lives under wiki/work/roadmaps/archive/, not the active directory`)
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-004: `wiki/work/roadmaps/index.md` no longer lists ROADMAP-009
- **Scenario**: The active-items index must drop the row for any roadmap once it reaches `status: done`.
- **Steps**:
  1. Open `wiki/work/roadmaps/index.md`.
  2. Search for a list entry linking `ROADMAP-009-docker-fresh-machine-harness.md`.
- **Expected Result**: No such row exists. (Note: ROADMAP-010's own row legitimately mentions the bare text "ROADMAP-009" in its one-line summary — that is expected and not a violation; only ROADMAP-009's own list entry/file link must be absent.)
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js` (test: `wiki/work/roadmaps/index.md no longer has an active-item row for ROADMAP-009`)
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-005: `wiki/work/roadmaps/archive/index.md` gained the ROADMAP-009 row
- **Scenario**: Archiving a roadmap appends a row to the archive family index recording its final status and archive date.
- **Steps**:
  1. Open `wiki/work/roadmaps/archive/index.md`.
  2. Locate the row for `[[ROADMAP-009]]`.
- **Expected Result**: The row reads `| [[ROADMAP-009]] | Docker Fresh-Machine Test Harness for setup/update | done | 2026-09-04 |`.
- **Repeatable Unit Test**: Created: `test/docker-harness-removed.test.js` (test: `wiki/work/roadmaps/archive/index.md lists ROADMAP-009 as done`)
- **Unit Test Command**: `node --test test/docker-harness-removed.test.js`
- [x] Pass <!-- 2026-09-13 -->

### UAT-EDGE-006: `wiki/log.md` records the archive operation
- **Scenario**: Every archive operation must be logged per the wiki's append-only operation log convention, so the reversal context isn't only visible on the roadmap file itself.
- **Steps**:
  1. Open `wiki/log.md`.
  2. Search for a `## [2026-09-04] archive | ROADMAP-009` entry.
- **Expected Result**: An entry titled `## [2026-09-04] archive | ROADMAP-009 — closed and archived (harness later reverted by ROADMAP-010)` is present, with a summary sentence noting the checklist items were genuinely completed at the time but the harness was later removed per ROADMAP-010.
- **Repeatable Unit Test**: Not applicable: `wiki/log.md` is a long, hand-authored append-only narrative log without a stable machine-checkable schema (unlike the frontmatter/index rows above); a human/reviewer read confirming the entry's presence and wording is more reliable than a brittle full-line regex, and this line item is not itself part of TASK-083's file-location/status acceptance criteria.
- [x] Pass — manually verified via `mcp__serena__search_for_pattern` on `wiki/log.md`: line 916 reads exactly `## [2026-09-04] archive | ROADMAP-009 — closed and archived (harness later reverted by ROADMAP-010)`, followed by the expected one-sentence summary noting the checklist items were genuinely completed at the time but the harness was later removed per ROADMAP-010. <!-- 2026-09-13 -->

---

## Gaps

None — every planned assertion (Notes text, frontmatter status, archive location, both roadmap index rows, and the log entry) was directly verifiable against the current file contents and is covered above; no test was dropped for insufficient research.

## Notes

- `uatGenerate.promoteTests` is set to the legacy value `true`, mapped to `dedicated` (write promoted tests to the project's existing dedicated test directory). `test/docker-harness-removed.test.js` already covers the same TASK-078/TASK-084/ROADMAP-010 Docker-harness-removal effort's promoted assertions, so the 5 promotable cases (EDGE-001 through EDGE-005, covered by 4 new test blocks — EDGE-001/EDGE-002 share one test since both assert on the same file's frontmatter and Notes section) were added there in place rather than as a new file, per the "extend an existing covering file" rule. Verified via `node --test test/docker-harness-removed.test.js` (9/9 passing, including the 4 new tests).
