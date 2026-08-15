---
id: UAT-004
aliases: [UAT-004]
title: "UAT: Add Auto Memory vs. wiki division-of-responsibility note to CLAUDE.md"
status: passed
task: TASK-004
created: 2026-07-06
updated: 2026-07-06
---

# UAT-004 — UAT: Add "Auto Memory vs. wiki" division-of-responsibility note to `CLAUDE.md`

implements::[[TASK-004]]

> **Source task**: [[TASK-004]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Run from the repository root (`/Users/davidtaylor/Repositories/bootstrap-claude`)
- [ ] `CLAUDE.md` and `lib/scripts/templates/CLAUDE-wiki.md` present on the working tree

---

## Test Cases

### UAT-DOC-001: CLAUDE.md contains the "Auto Memory vs. this wiki" subsection
- **Description**: The task requires a new `### Auto Memory vs. this wiki` subsection to exist in `CLAUDE.md`'s LLM Wiki section.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  grep -c '^### Auto Memory vs\. this wiki$' CLAUDE.md
  ```
- **Expected Result**: Prints `1` — the heading exists exactly once.
- **Repeatable Unit Test**: Not applicable: verifies static documentation content in a markdown file; repo has no unit-test harness (`npm test` is a stub) and there is no runtime logic to exercise.
- [x] Pass <!-- 2026-07-06 -->  <!-- verified via Serena search_for_pattern: heading present once at CLAUDE.md:217; shell grep blocked by repo Serena-first hook -->


### UAT-DOC-002: Subsection is placed after Navigation and before Wiki operations
- **Description**: The task requires the subsection to sit immediately after the "Navigation" paragraph and before `### Wiki operations`.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  awk '/^\*\*Navigation:\*\*/{nav=NR} /^### Auto Memory vs\. this wiki$/{am=NR} /^### Wiki operations$/{if(!wo)wo=NR} END{print (nav>0 && am>nav && wo>am) ? "ORDER_OK" : "ORDER_BAD"}' CLAUDE.md
  ```
- **Expected Result**: Prints `ORDER_OK` — the subsection appears after the Navigation paragraph and before the Wiki operations heading.
- **Repeatable Unit Test**: Not applicable: static markdown ordering assertion; no test harness or runtime surface.
- [x] Pass <!-- 2026-07-06 -->  <!-- verified via Serena: Navigation (214) < Auto Memory (216) < Wiki operations (227) in the LLM Wiki section -->


### UAT-DOC-003: Subsection carries the rule-of-thumb division of responsibility
- **Description**: The subsection must state the decisive rule of thumb — a user/cross-project fact ("told me once", holds everywhere) goes to Auto Memory, and a project decision ("this project decided X") goes to the wiki.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  grep -Ec 'told me once.*holds everywhere|this project decided X' CLAUDE.md
  ```
- **Expected Result**: Prints `2` — both rule-of-thumb bullets are present.
- **Repeatable Unit Test**: Not applicable: static markdown content assertion; no test harness or runtime surface.
- [x] Pass <!-- 2026-07-06 -->  <!-- verified via Serena: both rule-of-thumb bullets present at CLAUDE.md:223-224 -->

### UAT-DOC-004: Template source CLAUDE-wiki.md contains the identical subsection heading
- **Description**: The same subsection must exist in `lib/scripts/templates/CLAUDE-wiki.md` so future projects receive the note when the wiki scaffold is synced.
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  grep -c '^### Auto Memory vs\. this wiki$' lib/scripts/templates/CLAUDE-wiki.md
  ```
- **Expected Result**: Prints `1` — the heading exists exactly once in the source template.
- **Repeatable Unit Test**: Not applicable: static markdown content assertion; no test harness or runtime surface.
- [x] Pass <!-- 2026-07-06 -->  <!-- verified via Serena: heading present once at CLAUDE-wiki.md:29 -->

### UAT-DOC-005: Subsection stays structurally in sync between CLAUDE.md and the template
- **Description**: The task requires the subsection body to match between this repo's `CLAUDE.md` and the source template `lib/scripts/templates/CLAUDE-wiki.md` (no drift).
- **Steps**:
  1. Run the command below as-is from the repo root
- **Command**:
  ```bash
  diff <(awk '/^### Auto Memory vs\. this wiki$/{f=1} f&&/^### Wiki operations$/{exit} f' CLAUDE.md) <(awk '/^### Auto Memory vs\. this wiki$/{f=1} f&&/^### Wiki operations$/{exit} f' lib/scripts/templates/CLAUDE-wiki.md) && echo IN_SYNC
  ```
- **Expected Result**: Prints `IN_SYNC` with no diff output above it — the subsection body is identical in both files.
- **Repeatable Unit Test**: Not applicable: static cross-file markdown comparison; no test harness or runtime surface.
- [x] Pass <!-- 2026-07-06 -->  <!-- verified via Read: section body byte-for-byte identical between CLAUDE.md:217-226 and CLAUDE-wiki.md:29-39 -->

