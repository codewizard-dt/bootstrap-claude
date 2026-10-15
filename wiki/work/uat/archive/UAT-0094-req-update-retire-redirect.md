---
id: UAT-0094
aliases: [UAT-0094]
title: "UAT: Strip req-update's inline retire branch and redirect to /req-retire"
status: trashed
task: TASK-0094
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0094 — UAT: Strip req-update's inline retire branch and redirect to /req-retire

implements::[[TASK-0094]]

> **Trashed 2026-09-19:** superseded by [[TASK-0115]]: req-update removed entirely.

> **Source task**: [[TASK-0094]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Working directory is the `bootstrap-claude` repo root
- [ ] Edits were made to `lib/skills/req-update/SKILL.md` (repo source of truth), not `~/.claude/skills/req-update/`
- [ ] Node 18+ available (`node --test`)

---

## Test Cases

### UAT-CHK-001: The divergent retirement implementation is gone from req-update
- **Scenario**: `lib/skills/req-update/SKILL.md` no longer contains the `**Retiring branch**` block, any `req-retired` log-entry text, or the "Remove the requirement's row" index step that flipped status without archiving.
- **Steps**: Run the unit test command below.
- **Expected Result**: Test "req-update no longer contains the divergent retirement implementation" passes.
- **Repeatable Unit Test**: Created: `test/req-update-retire-redirect.test.js`
- **Unit Test Command**: `node --test test/req-update-retire-redirect.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CHK-002: Description, behavior table, Step 2 approved row and Step 10 report no longer advertise retirement
- **Scenario**: The frontmatter `description:` no longer contains `retired/superseded`; the top-of-file behavior table has no `approved (retiring)` row writing status; the Step 2 `approved` row lost the "also check if the user intends to retire" clause; the Step 10 report lists only `direct-edit (draft)` or `amendment (approved)` and has no `retired` mention.
- **Steps**: Run the unit test command.
- **Expected Result**: Tests "description frontmatter no longer advertises retired/superseded status-setting", "behavior table has no approved (retiring) row that writes status", and "Step 2 approved row no longer carries the retire-intent clause and Step 10 report has no retired option" pass.
- **Repeatable Unit Test**: Created: `test/req-update-retire-redirect.test.js`
- **Unit Test Command**: `node --test test/req-update-retire-redirect.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CHK-003: Redirect to /req-retire exists in the behavior table and Step 2, with no edits
- **Scenario**: The behavior table carries `| any (retiring) | Not handled here — stop and redirect to `/req-retire` |`, and Step 2 (between `## Step 2` and `## Step 3`) has a **Retirement intent** rule that stops, points at `/req-retire <ref> [reason]`, and says "Make no edits".
- **Steps**: Run the unit test command; then read Step 2 item 4 in `lib/skills/req-update/SKILL.md` and confirm it applies to both `draft` and `approved` and says not to ask for a retirement reason.
- **Expected Result**: Tests "behavior table has no approved (retiring) row that writes status" (redirect-row assertions) and "Step 2 redirects retirement intent to /req-retire without editing" pass; the rule text names both statuses and forbids asking for a reason.
- **Repeatable Unit Test**: Created: `test/req-update-retire-redirect.test.js`
- **Unit Test Command**: `node --test test/req-update-retire-redirect.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-CHK-004: CRITICAL Rule "Never retire from this skill" is present as rule 5
- **Scenario**: `## CRITICAL Rules` contains a rule reading "Never retire from this skill" that points at `/req-retire`, appended as rule 5 with the later rules renumbered.
- **Steps**: Run the unit test command; then confirm the CRITICAL Rules list is numbered 1–9 with no gaps or duplicates.
- **Expected Result**: Test "req-update has a CRITICAL Rule "Never retire from this skill"" passes; numbering is contiguous.
- **Repeatable Unit Test**: Created: `test/req-update-retire-redirect.test.js`
- **Unit Test Command**: `node --test test/req-update-retire-redirect.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: Terminal-status refusals are not weakened
- **Scenario**: The `retired` and `superseded` STOP rows in Step 2, the behavior-table refusal row, and CRITICAL Rule 4 ("Refuse on terminal statuses") remain verbatim and still numbered 4.
- **Steps**: Run the unit test command.
- **Expected Result**: Test "terminal-status refusals stay intact: retired and superseded STOP rows in Step 2, CRITICAL Rule 4" passes.
- **Repeatable Unit Test**: Created: `test/req-update-retire-redirect.test.js`
- **Unit Test Command**: `node --test test/req-update-retire-redirect.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: req-retire remains the single owner of archiving and accepts both draft and approved
- **Scenario**: `lib/skills/req-retire/SKILL.md` is not "fixed" in the wrong direction: it still archives via `git mv wiki/work/requirements/<file>.md wiki/work/requirements/archive/<file>.md`, and its Step 2 still continues on both `draft` and `approved`, so the redirect is valid for both statuses.
- **Steps**: Run the unit test command.
- **Expected Result**: Tests "req-retire still owns the archive git mv (divergence not "fixed" in the wrong direction)" and "req-retire still accepts both draft and approved requirements (redirect is valid for both)" pass.
- **Repeatable Unit Test**: Created: `test/req-update-retire-redirect.test.js`
- **Unit Test Command**: `node --test test/req-update-retire-redirect.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: No other retirement-writing text remains in req-update
- **Scenario**: After the edits, the only `retired` mentions left in `lib/skills/req-update/SKILL.md` are the terminal-status refusal rows/rules and the redirect text — nothing describes writing `status: retired`.
- **Steps**: Run the unit test command (the `req-retired`, "Remove the requirement's row", and "set status: retired" assertions cover the deterministic part); then run `mcp__serena__search_for_pattern` with pattern `retire` on `lib/skills/req-update/SKILL.md` and inspect each hit.
- **Expected Result**: Every hit is one of: behavior-table refusal row, behavior-table redirect row, Step 2 `retired` STOP row, Step 2 Retirement-intent rule, Output Formatting Rule 6, CRITICAL Rules 4 and 5. No hit describes flipping status, editing `## Notes`, or removing an index row.
- **Repeatable Unit Test**: Created: `test/req-update-retire-redirect.test.js`
- **Unit Test Command**: `node --test test/req-update-retire-redirect.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Source-of-truth boundary and scope — only the repo skill and test changed
- **Scenario**: The fix lives in `lib/skills/req-update/SKILL.md` plus the new test; `lib/skills/req-retire/SKILL.md` is untouched, and no instruction tells an agent to edit `~/.claude/skills/`.
- **Steps**: Run `git status --short lib/skills/req-update lib/skills/req-retire test/req-update-retire-redirect.test.js` and confirm `req-update/SKILL.md` shows modified, the test shows untracked/added, and nothing under `lib/skills/req-retire/` appears.
- **Expected Result**: Only `lib/skills/req-update/SKILL.md` and `test/req-update-retire-redirect.test.js` are listed; `req-retire` has no changes.
- **Repeatable Unit Test**: Not applicable: a git working-tree state check, not a deterministic content assertion (the req-retire content guard is covered by UAT-EDGE-002)
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-001: Whole-suite regression check
- **Scenario**: Adding the contract test and editing the skill does not break any sibling suite that reads `lib/skills/`.
- **Steps**: Run `npm test`; compare any failures against the six known pre-existing failures recorded in TASK-0094 step 3 (task-add, uat-generate, req-create, roadmap-create, task-audit contract tests owned by sibling in-flight tasks).
- **Expected Result**: No failing test references `req-update` or `req-retire`; the new `test/req-update-retire-redirect.test.js` reports 9/9 passing.
- **Repeatable Unit Test**: Not applicable: whole-suite run rather than a single-behavior assertion; the per-behavior tests are covered by UAT-CHK-001..004 and UAT-EDGE-001..003
- [x] Pass <!-- 2026-09-19 -->

### UAT-INT-002: /req-update on an approved requirement with retire intent redirects without editing
- **Scenario**: Invoking `/req-update` on an approved requirement with instructions like "retire this, it is obsolete" stops and points at `/req-retire`, with no file edits, no `AskUserQuestion` for a reason, and no log entry.
- **Steps**:
  1. Pick an approved requirement under `wiki/work/requirements/`.
  2. Run `/req-update <NNN> retire this requirement, it is obsolete`.
  3. Run `git status --short wiki/` afterwards.
- **Expected Result**: The skill prints "Retirement is handled by `/req-retire` (it also archives the file and updates the archive index). Run `/req-retire <ref> [reason]`." and stops; no wiki files are modified (git status unchanged) and no retirement-reason question is asked.
- **Repeatable Unit Test**: Not applicable: exercises the LLM-executed skill against live wiki content; the deterministic contract is covered by UAT-CHK-003
- [FAIL: auto-judge: manual test requires human verification — LLM-executed skill run against live wiki content; deterministic contract covered by UAT-CHK-003] <!-- 2026-09-19 -->
