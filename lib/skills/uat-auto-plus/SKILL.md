---
name: uat-auto-plus
description: Autonomous-fix variant of /uat-auto — runs tests, diagnoses failures, fixes them itself, re-runs until green or attempts exhausted. For headless agents with --dangerously-skip-permissions.
category: executing
model: claude-sonnet-5
argument-hint: <path/to/uat-file.md, number-slug, or description>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/uat/lifecycle.md`; run /primer if not done this session.

Read `~/.claude/skills/uat-walk/UAT-CORE.md` now — it defines Steps 1–5 (resolution, prerequisites, classification, judging, closure). This file defines only what differs for **autonomous-fix** mode.

# UAT Auto Plus

**UAT File**: $ARGUMENTS

Autonomous variant of `/uat-auto`: run every eligible test, auto-judge from deterministic evidence, **diagnose and fix any API/CLI failure itself**, re-run the affected test, and only record `[FAIL: ...]` after fix attempts are exhausted. Same file-movement outcomes as the other variants; only failure-handling differs.

**Designed for unattended agents** — e.g. a Claude Code instance launched with `--dangerously-skip-permissions` from a tmux orchestrator, CI, or cron. No human in the loop, so the agent may apply correctness fixes on its own judgment.

| Command | Audience | On failure |
|---------|----------|------------|
| `/uat-walk` | Human | Prompt user, optionally delegate fix |
| `/uat-auto` | Headless, conservative | Record `[FAIL]`, exit; human triages |
| `/uat-auto-plus` | Headless, autonomous | Diagnose → fix → re-test → repeat (bounded) |

**Pick this only when:** (1) the session skips approvals (`--dangerously-skip-permissions` or equivalent); (2) the orchestrator wants the UAT to drive itself to green without escalation; (3) the fix scope is contained — if the likely fix is in shared infrastructure or cross-cutting code, prefer `/uat-auto` and let a human review.

---

## Prime Directive: truthful pass

**Never mark `[x] Pass` unless the test currently passes against unmodified test logic.** Fixes go into application code, build/config, infrastructure, or test-environment setup — **never** into the UAT file's Expected/Steps/Command, and never by weakening assertions. If a failure can't be fixed without changing what is being tested, record `[FAIL: auto-fix-declined: <reason>]` and leave the code unchanged. Related: **never delete or `[SKIP: ...]` a test to avoid fixing it** — skip is a human verdict. A false pass is the worst outcome — it ships a broken feature *and* erodes trust in every later run.

---

## Procedure

Run UAT-CORE headless throughout, adding the fix loop:

1. **Step 1** — resolve/parse (auto/plus resolution: never prompt; auto-pick lowest-numbered pending on empty/unresolved).
2. **Step 2** — prerequisites with **one autonomous repair attempt** each (start dev server in background + `Monitor` for ready; run migrate; run seed; obtain a documented env var), then re-verify. Still failing after one repair → hard gate (`[FAIL: auto-judge: prerequisite not satisfied — <which>]` on every untested test → Closure). Track every background process started — Closure terminates them.
3. **Step 3 + 3.5** — classify, then stub-detect (leave stubs `- [ ] Pass`; **do not enter the fix loop** for them — implementing a feature from scratch is out of scope; surface in the summary).
4. **Step 4** — auto-judge in document order: API/CLI by machine-checkable criteria → on `[FAIL]`, **enter the fix loop (below)**. UI and Manual are always `[FAIL: auto-judge: ... requires human verification]` and **never** enter the fix loop (no machine-checkable signal that a fix worked). Eligibility = pending + previously-failed; also reset `[FIXING: ...]` → `- [ ] Pass` before running.
5. **Step 5** — write each verdict/`[FIXING: ...]` transition **immediately** via `Edit` (no buffering).
6. **Closure** — archive on all-pass; on any fail leave in place and **exit 0**. This mode additionally deletes this task's screenshots, **terminates every background process** it started, and supports multi-task WIP tracking in decision annotation (all per UAT-CORE Closure "Mode differences: uat-auto-plus"). Log tag ` (auto-plus)`.

Status markers this mode writes (UAT-CORE Step 5 mechanics):
```
Fixing: - [FIXING: attempt N/3 — <short reason>] <!-- YYYY-MM-DD -->
Fail:   - [FAIL: auto-fix-exhausted: <last reason>] <!-- YYYY-MM-DD -->
Fail:   - [FAIL: auto-fix-declined: <why refused>] <!-- YYYY-MM-DD -->
```

---

## Step 6: Autonomous fix loop

The defining feature. On an API/CLI `[FAIL]` in Step 4, do not move on — diagnose, fix, re-run.

**Bounds (hard):**
- **Max 3 fix attempts per test.** After the 3rd unsuccessful attempt → `[FAIL: auto-fix-exhausted: <last reason>]`, next test.
- **Max 3 concurrent fix sub-agents** across the run (most fixes are sequential; cap parallel batched investigations at 3).
- **30-minute total wall-clock cap** across all fix attempts. If exceeded → finalize remaining failures as `[FAIL: auto-fix-timeout: budget exhausted]` and go to Closure. The regression sweep shares this cap.

**Loop (per failing test, attempts 1–3):**
1. Mark `[FIXING: attempt N/3 — <short reason>]` via `Edit`.
2. **Diagnose** — read the test, the relevant app code, recent logs. Navigate with Serena (`find_symbol`, `find_referencing_symbols`, `get_symbols_overview`) — not Grep/Glob. For runtime failures, consider the `debug-logs` skill for a ranked hypothesis list.
3. **Decide the smallest correct fix** that makes the test pass without weakening it. Acceptable targets: application code, build/config (missing env default, misrouted path, wrong port), test fixtures/seed data. **Never** the UAT file's Steps/Expected/Command; **never** test assertions in code.
4. **Delegate to a sub-agent** (`Agent` tool, `subagent_type: general-purpose`, or `Plan` for design-heavy fixes). Prompt must include: the test ID + full body; the actual-vs-expected evidence from Step 4; the constraint "do not modify the UAT file or test assertions; fix only application code, build, config, or fixtures"; a request for a short report of files changed + rationale.
5. **Re-run** the test with the same Step 4 procedure and the same Bash call — do not relax assertions.
6. **Evaluate:** Pass → `[x] Pass`, delete this test's fail screenshots, exit loop, next test. Fail & attempt < 3 → next attempt with diagnosis refined by the prior report. Fail & attempt = 3 → `[FAIL: auto-fix-exhausted: <last reason>]`, exit loop.

**Fix-decline cases** — mark `[FAIL: auto-fix-declined: <why>]` immediately (declining is correct judgment, not failure) when:
- the fix would require changing the test's Expected/Steps/Command (test is wrong/out of date — a human call);
- the fix is in shared infrastructure outside this task's scope (could break other tests — surface for review);
- the failure is on a security-sensitive surface (auth, crypto, permissions) where a wrong fix is worse than a recorded failure;
- the failure is in third-party code or external services beyond the agent's control.

**Regression sweep** — after every successful fix, before moving on, re-run all previously-passing tests in the file with the same criteria. A newly-failing test is a new failure; the cause is most likely the just-applied fix — prefer reverting and re-diagnosing over piling on more changes. Bounded by the same 30-minute cap.

---

## Summary format

```
━━━ UAT AUTO-PLUS COMPLETE ━━━
File: wiki/work/uat/5-positions.uat.md  ·  Source: wiki/work/tasks/5-positions.md  ·  Mode: autonomous-fix
Budget: attempts 7/N · wall 12m22s/30m
✅ Passed 7 (fixed during run: 4) · ⚠️ Skipped 1 (pre-existing) · ❌ Failed 1 (auto-fix-exhausted 1 · declined 0 · auto-judge-uncertain 0)
❔ Pending 0 · 🔲 Stub-detected 0 (left untouched — implement first) · Total 9
Fixes Applied:
  • UAT-API-001: added missing 422 handler in src/api/positions.ts
  • UAT-API-002: corrected route prefix in src/router.ts
Failed:
  • UAT-API-003: Delete Position — "auto-fix-exhausted: HTTP 500 expected 204 (last attempt)"
Next action: /uat-walk wiki/work/uat/5-positions.uat.md
```

On all-pass, replace `Next action` with `Archived to archive/` and the new paths.

---

## Rules

**Autonomy boundaries** — the agent **may** modify application code, build/config, fixtures, and seed data. It **may not**: modify any UAT file's Steps/Expected/Command; modify test assertions in code (`expect(...)`); disable, comment out, `xfail`, or `[SKIP: ...]` a failing test; weaken type signatures, lower error-throwing branches, or remove validation to force a pass. When in doubt, decline and surface for review.

**Verdict discipline** — `[x] Pass` only on machine-verified evidence against unmodified logic; `[FAIL: auto-fix-exhausted: ...]` after 3 attempts; `[FAIL: auto-fix-declined: ...]` when out of scope/unsafe; `[FAIL: auto-judge: ...]` when unverifiable (UI/manual); **never** `[SKIP]`.

**Process hygiene** — every background process started must be terminated before exit, regardless of outcome (no orphaned dev servers, type checkers, watchers). Cap concurrent sub-agents and background processes at 3 each.

**File integrity + Bash hygiene + MCP compliance** — per UAT-CORE Step 5 and "Bash hygiene". App/config/fixture edits via `Edit` (or Serena `replace_symbol_body` / `replace_content` for code). Serena for all listing/search/symbol navigation, Grep/Glob only for non-symbol text; no `sed`/`awk`/`ls`/`find`/`grep`/`cat`; never emit literal secrets (only `"$UAT_AUTH_TOKEN"` / `"$UAT_TEST_PASSWORD"`).

**Start now — read UAT-CORE.md, resolve the UAT file, and begin.**
