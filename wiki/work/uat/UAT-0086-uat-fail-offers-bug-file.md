---
id: UAT-0086
aliases: [UAT-0086]
title: "UAT: uat-walk and uat-auto offer /bug-file inline on a [FAIL] verdict"
status: pending
task: TASK-0086
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0086 — UAT: uat-walk and uat-auto offer /bug-file inline on a [FAIL] verdict

implements::[[TASK-0086]]

> **Source task**: [[TASK-0086]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Working tree checked out at a commit including TASK-0086's changes to `lib/skills/uat-walk/SKILL.md` and `lib/skills/uat-auto/SKILL.md`.
- [ ] Node.js available on `PATH` (`node --test` runner, no external dependencies).

---

## Test Cases

### UAT-EDGE-001: uat-walk asks "File a bug for this? (y/n)" inline after a Fail, defaulting to no
- **Scenario**: In `lib/skills/uat-walk/SKILL.md` "Verdict actions (per test)", the `Fail` bullet must — once the `[FAIL: ...]` marker is recorded — ask inline `File a bug for this? (y/n)` and default to no when the user does not answer explicitly. The offer must come after the fail note is recorded, and must never use `AskUserQuestion` (the file's inline-only convention).
- **Steps**: Read the `- **Fail** →` bullet in `lib/skills/uat-walk/SKILL.md`; confirm the exact question text, the "default no" language, that it follows the `mark \`- [FAIL: ...\`` recording, and that `Prompt **inline** — never \`AskUserQuestion\`.` is still present.
- **Expected Result**: Question text and default-no rule are present verbatim; offer ordered after the failure is recorded; no `AskUserQuestion` in the Fail bullet.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js`
- **Unit Test Command**: `node --test test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: uat-walk "yes" invokes Skill bug-create with a pre-filled $ARGUMENTS description
- **Scenario**: On yes, the Fail bullet must invoke `Skill` `bug-create` with a description assembled from the test's `Description`/`Steps`/`EXPECTED` fields and the fail note as `Actual Behavior`, passed as the skill's `$ARGUMENTS`, so `/bug-create`'s Q&A confirms real content instead of starting blank.
- **Steps**: Read the `- **Fail** →` bullet; confirm `On yes: invoke \`Skill\` \`bug-create\``, all three source fields, the `Actual Behavior` mapping, and the `$ARGUMENTS` hand-off are named.
- **Expected Result**: All of the above are present in the Fail bullet.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js`
- **Unit Test Command**: `node --test test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: uat-walk offer never blocks the walkthrough, and other verdicts are unaffected
- **Scenario**: After `/bug-create` completes (or the user says no) the walk must continue to the next test without delay. The `Pass`, `Skip`, and `Fix now` verdict actions must not mention `bug-create` — only `Fail` gains the affordance.
- **Steps**: Read "Verdict actions (per test)" in `lib/skills/uat-walk/SKILL.md`; confirm the "continue to the next test without delay" sentence in the Fail bullet, and that the other three verdict bullets contain no `bug-create` reference.
- **Expected Result**: Continuation sentence present; Pass/Skip/Fix-now bullets untouched by the new affordance.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js`
- **Unit Test Command**: `node --test test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: uat-auto summary suggests /bug-create for a verifiable failure only
- **Scenario**: In `lib/skills/uat-auto/SKILL.md` "Summary format", the `Failed:` block must append an indented `→ /bug-create "<test id>: <one-line symptom>"` line beneath a real, verifiable failure (e.g. `HTTP 500 expected 204`), and must NOT append one beneath an `auto-judge: ... requires human verification` failure (unverifiable by design, not a defect signal).
- **Steps**: Read the "Summary format" block; confirm the `UAT-API-003` failure line is immediately followed by the 4-space-indented `→ /bug-create "UAT-API-003: HTTP 500 received, expected 204"` line, the `requires human verification` line has no suggestion under it, and only one `/bug-create` line appears in the example.
- **Expected Result**: Suggestion present under the verifiable failure only, citing test id and symptom.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js`
- **Unit Test Command**: `node --test test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: uat-auto stays headless — suggestion is informational text, /bug-create is never invoked
- **Scenario**: `/uat-auto`'s "No user interaction, ever" rule must be unchanged, and the Rules section must state that bug-create suggestions in the summary are informational text only and that `/bug-create` is never called itself. The skill must contain no `Skill` `bug-create` invocation and no interactive "File a bug for this?" offer.
- **Steps**: Read "## Rules" in `lib/skills/uat-auto/SKILL.md`; confirm the `**No user interaction, ever**` rule and the informational-only sentence; search the whole file for an `invoke \`Skill\` \`bug-create\`` instruction and for `File a bug for this?`.
- **Expected Result**: Rule and clarifying sentence present; no invocation or interactive prompt anywhere in the file.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js`
- **Unit Test Command**: `node --test test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: uat-auto-plus is untouched (out of scope)
- **Scenario**: The task explicitly excludes `lib/skills/uat-auto-plus/SKILL.md`. It must carry no `bug-create` reference after the change.
- **Steps**: Search `lib/skills/uat-auto-plus/SKILL.md` for `bug-create`.
- **Expected Result**: No matches.
- **Repeatable Unit Test**: Created: `test/uat-fail-offers-bug-file.test.js`
- **Unit Test Command**: `node --test test/uat-fail-offers-bug-file.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-MANUAL-001: /uat-walk live — Fail verdict offers a bug and hands off pre-filled content
- **Scenario**: Confirm the documented `/uat-walk` behavior at runtime: a Fail verdict produces the inline offer, "y" opens `/bug-create` with pre-filled content, "n"/no-answer skips it, and the walk continues either way.
- **Steps**:
  1. Prepare a throwaway pending UAT file with two simple Manual tests (copy any small pending UAT under `wiki/work/uat/` and trim it).
  2. Run `/uat-walk <that file>`; on the first test answer `fail` and give a short note.
  3. Confirm the fail marker is written to the file, then `File a bug for this? (y/n)` is asked in the same turn (inline, not a popup).
  4. Answer `y`; confirm `/bug-create` starts with a description containing the test's description/steps/expected and your fail note as actual behavior, and that its Q&A asks you to confirm rather than starting blank. Complete or abort it.
  5. Confirm the walk then proceeds to the second test. On the second test answer `fail`, then reply with nothing explicit or `n`; confirm no bug is filed and the walk continues.
- **Expected Result**: Offer appears only after a Fail; yes pre-fills `/bug-create`; no/silence files nothing; the walk continues in both cases.
- **Repeatable Unit Test**: Not applicable: requires a live interactive `/uat-walk` session, the `bug-create` skill's Q&A, and real wiki file state — cannot run in a deterministic unit-test harness without mocking the whole skill-invocation loop.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

### UAT-MANUAL-002: /uat-auto live — summary lists bug-create suggestions without prompting or filing
- **Scenario**: Confirm `/uat-auto` produces the suggestion line for a genuine failure, omits it for human-verification failures, and files nothing.
- **Steps**:
  1. Prepare a throwaway pending UAT file with one API/CLI test whose `**Command**:` deterministically fails against its Expected Result (e.g. a `curl` to an unreachable URL) and one bare Manual test with no unit test.
  2. Run `/uat-auto <that file>` headlessly (e.g. `claude -p "/uat-auto <path>"`).
  3. Inspect the `UAT AUTO COMPLETE` summary and the contents of `wiki/work/bugs/`.
- **Expected Result**: No prompt is issued. The `Failed:` block shows `→ /bug-create "<test id>: <symptom>"` under the API/CLI failure and no suggestion under the `requires human verification` failure. `wiki/work/bugs/` gains no new file.
- **Repeatable Unit Test**: Not applicable: requires a live headless `/uat-auto` run and real filesystem state (`wiki/work/bugs/` unchanged) — the static summary-format contract is already covered by UAT-EDGE-004/005.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-09-19 -->

---

## Notes

- TASK-0086 touched only two markdown skill-instruction files (`lib/skills/uat-walk/SKILL.md`, `lib/skills/uat-auto/SKILL.md`) interpreted by an LLM at runtime. UAT-EDGE-001 through 006 are static text/structure assertions against them; UAT-MANUAL-001/002 are the runtime confirmations and are not unit-test promotable.
- `uatGenerate.promoteTests` resolved to `true` → legacy mapping → `dedicated`. The repo's existing `test/` directory and `node --test` convention were followed (closest precedent: `test/bug-close-clustering-offer.test.js`).
- One repeatable unit test file backs all 6 EDGE cases: `test/uat-fail-offers-bug-file.test.js` (11 `node:test` cases). Verified passing: `node --test test/uat-fail-offers-bug-file.test.js` → 11/11 pass, 0 fail.
- Task Step 3 (guide cross-reference) was a checked no-op — no UAT case needed. No gaps.
