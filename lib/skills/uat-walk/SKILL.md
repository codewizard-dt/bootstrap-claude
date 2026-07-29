---
name: uat-walk
description: Walk through a pending UAT file test-by-test with the user
category: executing
model: claude-sonnet-5
argument-hint: <path/to/uat-file.md, number-slug, or description>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/uat/lifecycle.md`; run /primer if not done this session.

Read `~/.claude/skills/uat-walk/UAT-CORE.md` now — it defines Steps 1–5 (resolution, prerequisites, classification, judging, closure). This file defines only what differs for **interactive** mode.

# UAT (interactive walk)

**UAT File**: $ARGUMENTS

Walk each test in a pending UAT file test-by-test, present it to the user, and record the user's pass/fail verdict. **The user is the only authority on pass/fail** — the agent presents and facilitates, never auto-judges (this replaces UAT-CORE Step 4's auto-judge criteria; Steps 1, 2, 3, 5, and Closure apply as written). UAT-CORE Step 3.5 (stub detection) does not run here.

Loop: `read/parse → mode-select (first cycle) → find next batch → present (3A/3B/3C) → record verdicts → update file → repeat` until no test has a blocking status, then run UAT-CORE **Closure**.

---

## Mode selection (first cycle only)

Decide from what's present; **only ask when genuinely ambiguous**:

| Failed | Pending | Action |
|--------|---------|--------|
| 0 | any | **Pending only**, silently |
| ≥1 | 0 | **Failed only**, silently (note it: "N failed, no pending — re-running failed") |
| ≥1 | ≥1 | Ask inline: `N failed and M pending. Failed first / Pending only / Failed only?` |

- **Failed first** — all `[FAIL]` (document order) → then all `- [ ] Pass`
- **Pending only** — only `- [ ] Pass` (skip `[FAIL]`)
- **Failed only** — only `[FAIL]` (skip `- [ ] Pass`)

Store the choice for the walkthrough. When re-testing a failed test, reset its status `- [FAIL: ...]` → `- [ ] Pass` before presenting.

Prerequisites are always handled first (UAT-CORE Step 2, walk mode) regardless of test mode.

---

## Find the next batch

Classify each eligible test (UAT-CORE Step 3), then collect the next batch of consecutive same-type tests. Starting a different type begins a fresh batch.

| Type | Batch size | Present via |
|------|-----------|-------------|
| API/CLI | up to 5 | 3A (auto-execute) |
| UI | up to 3 (all must fit on screen) | 3B (compact) |
| Manual | exactly 1 (never batched) | 3C (single) |

If no more tests match the mode, go to UAT-CORE **Closure** and run it in full — do not stop early.

All presentation uses `**bold**` labels (rendered in-terminal) and always shows progress counts.

---

## 3A — API/CLI batch (auto-execute)

Auto-execute — **never** ask "Run / Manual / Skip?". Present the header, then run each test and show results inline:

```markdown
━━━━━━━━━━ API TEST BATCH [tests 3–7 of 18] ━━━━━━━━━━
**Progress:** 2/18 passed · 0 failed · 16 remaining

**[3 of 18] UAT-API-001: Create Position**  ·  POST /api/positions
▶ **COMMAND:**  curl -sS -X POST 'http://localhost:4321/api/positions' -H 'Content-Type: application/json' -d '{"title":"Engineer"}'
▶ **EXPECTED:** HTTP 201; body has `id` and `title: "Engineer"`
▶ **ACTUAL:**   HTTP 201; {"id":1,"title":"Engineer",...}
▶ **RESULT:**   ✅ Matches expected
```

**Rules:**
- **One Bash call per test**, run sequentially (batch = presentation grouping, never command chaining). Follow UAT-CORE "Bash hygiene". If a test classified API/CLI has no extractable command, present it as manual (3C) instead.
- **EXPECTED directly above ACTUAL**, nothing between them — the user compares at a glance. Truncate long bodies inside the ACTUAL block.
- **`▶ RESULT:` on every presentation** (including fix-now retests): `✅ Matches expected` or `❌ Does not match expected — <one-line reason>`. This is the agent's *observation*, not a verdict — the user still issues pass/fail.
- **Halt on failure (mandatory):** if a test errors or clearly diverges from Expected (status mismatch, error body, missing fields, exception), **STOP the batch immediately at that test**. Ask that single test `Pass / Fail / Fix now / Skip?` and **wait** for explicit direction. Never move on after a failure without it. Apply the verdict, then resume the remaining tests from where you halted.
- After all tests execute without failure, ask for batch verdicts (below).

## 3B — UI batch (compact)

Up to 3 UI tests, compact so the whole batch fits without scrolling — one line each for description/steps/expected, no prose. Share the `Page:` URL in the header if common.

```markdown
━━━━━━━━━━ UI TEST BATCH [tests 8–10 of 18] ━━━━━━━━━━
**Progress:** 7/18 passed · 0 failed · 11 remaining  ·  **Page:** http://localhost:4321/strengths
[8] UAT-UI-001 — Strength Panel Layout
  Steps: Navigate to /strengths · Verify panel on the right
  Expected: Right-aligned, no horizontal scroll
[9] UAT-UI-002 — Empty State  · Steps: Clear strengths · Navigate to /strengths · Expected: "No strengths yet" visible
Verdicts (8–10)?  [8] P/F/Fix/Skip?  [9] …  [10] …
```

## 3C — Manual test (single)

One at a time. Show description, scenario, numbered steps, then the expected result:

```markdown
━━━━━━━━━━ TEST [14 of 18]: UAT-EDGE-003 — Concurrent Updates ━━━━━━━━━━
**Progress:** 12/18 passed · 1 failed · 5 remaining
**Description:** concurrent updates to the same record don't cause data loss
**STEPS:** 1. Open position #1 in two tabs  2. Edit title in tab 1, save  3. Edit description in tab 2, save
▶ **EXPECTED:** second save merges or shows a conflict error; no silent data loss
```

---

## Verdicts

Prompt **inline** — never `AskUserQuestion`. Accept any unambiguous prefix (`p`/`pass`, `f`/`fail`, `fix`, `s`/`skip`).

### ⛔ Mandatory verdict gate
Receive an explicit pass/fail/fix/skip verdict for **every** test before advancing. No exceptions — violating this invalidates the walkthrough.
- **Batched (API/UI):** ask all verdicts in one prompt, then **STOP and wait**. Don't present the next batch, run commands, or call tools until every test in the batch is accounted for. If the reply leaves any test uncovered, ask a follow-up for just those — never assume, never default to pass.
- **Single (manual / fix-now retest):** ask immediately after presentation, **STOP and wait**.
- **Auto-executed failure (3A):** halt at that test, ask `Pass / Fail / Fix now / Skip?`, **STOP and wait** before running or calling anything else.
- **Never** auto-judge, infer a verdict from output, or move on "because it looked fine."

Batch verdict input formats: `all pass` / `all p` (same to all) · `p p f fix s` (per-test, in order) · `3: pass, 5: fail, rest pass` (selective + default) · single word → applies to all. Ambiguous → ask.

### Verdict actions (per test)
- **Pass** → `- [x] Pass <!-- YYYY-MM-DD -->`
- **Fail** → ask inline "What went wrong? (optional)"; mark `- [FAIL: <note or "No details provided">] <!-- YYYY-MM-DD -->`
- **Skip** → ask inline "Reason for skipping? (optional)"; mark `- [SKIP: <reason or "User skipped">] <!-- YYYY-MM-DD -->`
- **Fix now** → see Fix workflow. Process all non-fix verdicts in the batch first, then handle fix-now tests one at a time.

File updates follow UAT-CORE Step 5 (one `Edit` per status line, never `sed`).

---

## Fix workflow

When the user picks **Fix now**:

1. Ask inline "What went wrong?".
2. **Resolve approach ambiguity before delegating (mandatory).** Root cause and target are usually clear; the ambiguity that matters is *how* to fix — side effects, multiple valid approaches with different tradeoffs, or a fix that touches shared code. If any is unclear, **STOP and ask** first (e.g. "clamp at the API layer or adjust the validation schema?" / "scope this to the test or update the shared `<X>` utility globally?"). If unambiguous (one obvious change, no shared-code risk), proceed.
3. Mark `- [FIXING: <note>] <!-- YYYY-MM-DD -->`.
4. **Delegate to one `general-purpose` subagent** (`Task` tool; **max 1 fix subagent at a time** — wait for completion). Prompt: UAT file path, test ID + name, the failure description, the full test section (endpoint/page, description, steps, expected). Instruct it to use Serena to find the code, identify root cause, implement the fix, run available quality checks (lint/typecheck/tests), and report changes + rationale.
5. **⚠️ NEVER AUTO-PASS AFTER A FIX.** Reset status to `- [ ] Pass`, re-present the test (single-test flow), and ask the user for a verdict. Only the **user** marks it passing. If the subagent reports it couldn't resolve the issue, present Fail / Skip.

The `[FIXING: ...]` marker is temporary — it must resolve to `[x] Pass`, `[FAIL: ...]`, `[SKIP: ...]`, or `[ ] Pass` before moving on.

---

## Progress persistence

Every verdict is written to the file immediately (UAT-CORE Step 5), so an aborted or interrupted walkthrough keeps its progress and resumes from the first pending test.

**Completion summary** (before running UAT-CORE Closure):

```
━━━ UAT WALKTHROUGH COMPLETE ━━━
File: wiki/work/uat/UAT-005-positions.md  ·  Source: wiki/work/tasks/TASK-005-positions.md
✅ Passed 6  ·  ⚠️ Skipped 1  ·  ❌ Failed 2  ·  ❔ Pending 0  ·  Total 9
Failed: • UAT-API-003: Delete Position — "Returns 500 instead of 204"
```

- **All complete** (no `[FAIL]`/`[FIXING]`) → run UAT-CORE **Closure → All pass**.
- **Some failed** → leave the file in place (`status: in-progress`); suggest `/uat-walk <path>` to re-test or `/task-add "Fix UAT failures in <feature>"`.
- **Aborted** → leave in place; note progress was saved.

**Start now — read UAT-CORE.md, resolve the UAT file, and present the first prerequisite or test.**
