---
name: uat-auto
description: Non-interactively run every test in a pending UAT file and auto-judge verdicts (headless, fail-closed)
category: executing
model: claude-sonnet-5
argument-hint: <path/to/uat-file.md, number-slug, or description>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/uat/lifecycle.md`; run /primer if not done this session.

Read `~/.claude/skills/uat-walk/UAT-CORE.md` now — it defines Steps 1–5 (resolution, prerequisites, classification, judging, closure). This file defines only what differs for **headless, fail-closed** mode.

# UAT Auto

**UAT File**: $ARGUMENTS

Headless variant of `/uat-walk`: run every eligible test, auto-judge from deterministic evidence, write results, and archive on all-pass — with **zero user prompts**. Same status-flip outcomes as `/uat-walk`; only the decision procedure differs.

**When to use:** no human at the keyboard — a tmux orchestrator, CI job, or scheduled run dispatches UAT work. Use `/uat-walk` for anything interactive; `/uat-auto-plus` when you also want autonomous fixes.

---

## Prime Directive: fail closed

**Never auto-pass a test you cannot verify with hard evidence.** Pass requires a machine-checkable match (UAT-CORE Step 4 "Auto-judge criteria"). On any doubt, uncertainty, or missing evidence → `[FAIL: auto-judge: <reason>]`. **Never** `[SKIP: ...]` (a human verdict). **Never** `[x] Pass` unless the criteria are met exactly. A false pass ships a broken feature; a false fail merely gets re-triaged in the next `/uat-walk` — so this is the single most important rule.

---

## Procedure

Run UAT-CORE as written, headless throughout:

1. **Step 1** — resolve/parse (auto/plus resolution rules: never prompt; auto-pick lowest-numbered pending on empty/unresolved).
2. **Step 2** — prerequisites as a **hard gate**: any failed or unverifiable prerequisite aborts → `[FAIL: auto-judge: prerequisite not satisfied — <which>]` on every untested test, then Closure. No repair attempt (that's `/uat-auto-plus`).
3. **Step 3 + 3.5** — classify all eligible tests, then stub-detect (leave stubs `- [ ] Pass`, do not execute).
4. **Step 4** — auto-judge each non-stub test in document order: API/CLI by the machine-checkable criteria; UI and Manual always `[FAIL: auto-judge: ... requires human verification]` (no browser automation, no heuristics). Eligibility = pending + previously-failed.
5. **Step 5** — write each verdict **immediately** via `Edit` (no buffering/batching).
6. **Closure** — archive on all-pass; on any fail leave the file in place and **exit 0** (the orchestrator treats exit as its task done; the pipeline decides what to do with fail markers). This mode keeps screenshots and uses log tag ` (auto)`.

There is **no fix workflow** — record evidence and exit; re-run `/uat-walk` (or `/uat-auto-plus`) to fix. `[FIXING: ...]` markers found in the input are reset to `- [ ] Pass` and re-evaluated (a walk may have been interrupted mid-fix).

---

## Summary format

```
━━━ UAT AUTO COMPLETE ━━━
File: wiki/work/uat/UAT-005-positions.md  ·  Source: wiki/work/tasks/TASK-005-positions.md  ·  Mode: headless
✅ Passed 6 · ⚠️ Skipped 1 (pre-existing, untouched) · ❌ Failed 2 (auto-judge-uncertain: 1)
❔ Pending 0 · 🔲 Stub-detected 0 (left untouched — implement first) · Total 9
Failed:
  • UAT-API-003: Delete Position — "auto-judge: HTTP 500 expected 204"
  • UAT-EDGE-001: Empty Positions — "auto-judge: manual test requires human verification"
Next action: /uat-walk wiki/work/uat/UAT-005-positions.md
```

On all-pass, replace `Next action` with the task/UAT IDs and their new `done`/`passed` statuses.

---

## Rules

- **No user interaction, ever** — no `AskUserQuestion`, no inline prompts, no clarifying questions. Ambiguity → record fail / exit with a diagnostic summary.
- **Verdict discipline** — `[x] Pass` only on concrete machine-verified evidence; `[FAIL: auto-judge: <reason>]` for everything else (uncertainty, missing command, non-verifiable Expected, UI, manual); **never** `[SKIP]`.
- **No browser automation** — UI tests always fail-closed to human verification.
- **File integrity + Bash hygiene + MCP compliance** — per UAT-CORE Step 5 and "Bash hygiene". Serena for all listing/search; `Edit` for every status flip; no `sed`/`awk`/`ls`/`find`/`grep`/`cat`; never emit literal secrets (only `"$UAT_AUTH_TOKEN"` / `"$UAT_TEST_PASSWORD"`).

**Start now — read UAT-CORE.md, resolve the UAT file, and begin.**
