---
id: TASK-0086
aliases: [TASK-0086]
title: "uat-walk and uat-auto offer /bug-file inline on a [FAIL] verdict"
status: pending-uat
created: 2026-09-13
updated: 2026-09-13
depends_on: []
blocks: []
parallel_safe_with: [TASK-0087, TASK-0088, TASK-0089, TASK-0090, TASK-0091, TASK-0092, TASK-0093]
uat: ""
tags: [uat, bugs, skill-affordance]
---

# TASK-0086 — uat-walk and uat-auto offer /bug-file inline on a [FAIL] verdict

relates_to::[[wiki-work-family-cross-linking-gaps]]

## Objective

Close the UAT→bug automation gap found in the `wiki-work-family-synergy` research: a `[FAIL]` verdict in `/uat-walk` or `/uat-auto` already carries repro-quality data (the test's `Steps`/`Description`, `EXPECTED`, and `ACTUAL`/failure note) but today the failure is only recorded on the UAT file itself — neither skill ever offers to open a structured bug report from it. Add an **offered, never forced** `/bug-file` affordance so a failure that represents a genuine defect (not just "needs a fix-now pass on this task") can be captured with its evidence intact instead of being re-typed from memory later.

## Approach

Two skills, two different interaction models — the affordance must fit each:

- **`/uat-walk`** is interactive (`lib/skills/uat-walk/SKILL.md`): after a `Fail` verdict is recorded (the "Verdict actions" section, `- [FAIL: <note>]`), it currently just moves to the next test. Add an inline follow-up prompt (same "ask inline, never AskUserQuestion" convention this file already uses) offering to file a bug pre-filled from the test's own fields.
- **`/uat-auto`** is headless (`lib/skills/uat-auto/SKILL.md`) and its Rule #1 is "No user interaction, ever." It cannot prompt. Instead, have it **note** in its own summary output (the "Summary format" block) which failed tests look bug-worthy, with the exact `/bug-file` invocation the human can copy-paste — informational only, never auto-filed.

Do not touch `lib/skills/uat-auto-plus/SKILL.md` — it is out of scope for this task (the roadmap item names only `/uat-walk` and `/uat-auto`).

**Source-of-truth note**: edit `lib/skills/<name>/SKILL.md` in this repo, never `~/.claude/skills/<name>/SKILL.md` — the latter is a machine-local copy installed by `install-global.sh` and is overwritten on the next sync, so edits there never land in this repo.

## Steps

### 1. `/uat-walk` — offer /bug-file after a Fail verdict <!-- agent: general-purpose -->

- [x] In `lib/skills/uat-walk/SKILL.md`, under "## Verdicts" → "### Verdict actions (per test)", after the existing `- **Fail** → ask inline "What went wrong? (optional)"; mark ...` line, add: once the fail note is recorded, ask inline (same turn, no new tool): `File a bug for this? (y/n)` — default no if the user doesn't answer explicitly (never assume yes).
- [x] On yes: invoke `Skill` `bug-file` with a pre-filled description built from the test's `Description`/`Steps`/`EXPECTED` and the fail note as `Actual Behavior` — pass this as the skill's `$ARGUMENTS` so `/bug-file`'s own Step 3 Q&A has real content to confirm rather than starting blank.
- [x] Do not block the walkthrough on this — after `/bug-file` completes (or the user says no), continue to the next test exactly as today.

### 2. `/uat-auto` — surface bug-worthy failures in the summary, never auto-file <!-- agent: general-purpose -->

- [x] In `lib/skills/uat-auto/SKILL.md`, under "## Summary format", extend the `Failed:` block: for each `[FAIL: ...]` verdict that is not `auto-judge: ... requires human verification` (i.e. a real, verifiable failure — not just an unverifiable-by-design case), append a suggested command line: `  → /bug-file "<test id>: <one-line symptom from EXPECTED vs ACTUAL>"`.
- [x] Add one sentence to "## Rules" clarifying this is informational text only — `/uat-auto`'s "No user interaction, ever" rule is unchanged; it never calls `/bug-file` itself.

### 3. Update the guide cross-reference <!-- agent: general-purpose -->

- [x] If `wiki/guides/mcp-tools.md` or any UAT-related guide documents the fail-handling flow, add one line noting the new offer/suggestion behavior. Skip if no such guide references this flow (check via `mcp__serena__search_for_pattern` for "uat-walk" and "uat-auto" in `wiki/guides/`). — Checked: only `command-anti-patterns.md` references these skills (generically mentioning the UAT flow, not fail-handling specifically); no update needed.
