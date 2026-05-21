---
name: uat-auto-plus
description: Autonomous-fix variant of /uat-auto — runs every test, diagnoses failures, applies fixes itself, and re-runs until green or attempts are exhausted. Intended for headless agents launched with --dangerously-skip-permissions.
model: claude-sonnet-4-6
argument-hint: <path/to/uat-file.md, number-slug, or description>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/task-lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


# UAT Auto Plus

Autonomous variant of `/uat-auto`. Runs every test in a pending UAT file, auto-judges pass/fail from deterministic evidence, **diagnoses and fixes any failures itself**, re-runs the affected tests, and only records `[FAIL: ...]` after fix attempts are exhausted.

**Designed for unattended agents** — for example, a Claude Code instance launched with `--dangerously-skip-permissions` from a tmux orchestrator, a CI job, or a scheduled cron run. There is no human in the loop, so the agent is empowered to make and apply correctness fixes on its own judgment.

---

**UAT File**: $ARGUMENTS

---

## When to Use

| Command | Audience | On failure |
|---------|----------|------------|
| `/uat-walk` | Human at keyboard | Prompt user, optionally delegate fix |
| `/uat-auto` | Headless, conservative | Record `[FAIL]` and exit; human triages later |
| `/uat-auto-plus` | Headless, autonomous | Diagnose → fix → re-test → repeat (bounded) |

Pick `/uat-auto-plus` only when:
1. The session was launched with `--dangerously-skip-permissions` (or equivalent), so file edits and shell commands do not require approval.
2. The orchestrator wants the UAT to attempt to drive itself to green without escalation.
3. The codebase, tests, and fixes are sufficiently scoped that an autonomous fix is unlikely to cause collateral damage. (If the failure is in shared infrastructure or cross-cutting code, prefer `/uat-auto` and let a human review.)

`/uat-auto-plus` slots into the same task lifecycle as the other UAT variants:

```
/task-add → /tackle → /uat-generate → /uat-auto-plus (autonomous)   ─┐
                                     → /uat-auto    (headless)       ├→ completed/ (or stay pending)
                                     → /uat-walk   (human)           ─┘
```

Identical file-movement outcomes — only the failure-handling procedure differs.

---

## Prime Directive: Truthful Pass

**The agent never marks `[x] Pass` unless the test currently passes against unmodified test logic.** Fixes go into the application code, infrastructure, or test-environment setup — **never** into the UAT file's Expected section, Steps, or Command, and never by weakening assertions to make them pass.

If the agent cannot fix a failure without changing what is being tested, it must record the failure as `[FAIL: auto-fix-declined: <reason>]` and leave the application code unchanged. A false pass is the worst possible outcome — it ships a broken feature *and* erodes trust in every subsequent run.

Closely related: **never delete or `[SKIP: ...]` a test** to avoid having to fix it. Skip is a human verdict.

---

## Step 1: Resolve and Parse the UAT File

Identical to `/uat-auto` Step 1. Parse `$ARGUMENTS` to locate the UAT file:

1. **File path** (e.g. `.docs/uat/3-user-auth.uat.md`) — use directly.
2. **Number-slug** (e.g. `3-user-auth`) — Call Serena `list_dir` or `find_file` in `.docs/uat/`, fall back to `.docs/uat/completed/`.
3. **Number or description** (e.g. `3`, `user auth`) — Call Serena `list_dir` or `find_file` in `.docs/uat/`. If ambiguous, **STOP** and report in the completion summary (do not prompt).
4. **If `$ARGUMENTS` is empty OR did not resolve** — auto-pick from pending:
   - `mcp__serena__list_dir` on `.docs/uat/` to enumerate `*.uat.md`.
   - If none, **STOP** with: "No pending UAT files found".
   - Pick the lowest-numbered file by `<NNN>` prefix.
   - Announce the auto-pick in one line: `No matching UAT file — running \`<filename>\``.
   - Proceed without confirmation.

Parse the file:
- **Test sections**: `### UAT-*` headings.
- **Prerequisites**: items under `## Prerequisites`.
- **Existing statuses**: `- [ ] Pass`, `- [x] Pass`, `- [FAIL: ...]`, `- [FIXING: ...]`, `- [SKIP: ...]`.

If every test is already `[x] Pass` or `[SKIP: ...]`, skip to **Step 7** (file-movement).

---

## Step 2: Verify and Auto-Repair Prerequisites

For each prerequisite:

1. **Verify it** with one deterministic check (a `curl` to the health endpoint, `pg_isready`, file existence, port probe).
2. **If verification fails and the prerequisite is a runnable service or environment condition**, attempt to satisfy it autonomously:
   - "server running at localhost:4321" → start the dev server in a background `Bash` call (`run_in_background: true`), wait via `Monitor` for the ready signal, re-verify.
   - "database migrated" → run the project's migration command, re-verify.
   - "test data loaded" → run the project's seed command if one exists; if no scripted path exists, treat as unverifiable.
   - Missing env var (e.g. `$UAT_AUTH_TOKEN`) → if a `.env.test` or equivalent describes how to obtain it, follow that; otherwise treat as unverifiable.
3. **If verification still fails after one repair attempt**, abort the entire walkthrough with `[FAIL: auto-judge: prerequisite not satisfied — <which>]` on every untested test and proceed to Step 7.

Background processes started for prerequisites must be tracked. They are terminated in Step 7 regardless of outcome.

---

## Step 3: Classify Tests

Identical to `/uat-auto` Step 3:

- **API/CLI test** — has a runnable command in Steps/Expected, or an `Endpoint:` field.
- **UI test** — has `UAT-UI-*` prefix or `Page:` / `Components:` metadata.
- **Manual test** — anything else.

### Mode

The default is **"pending + previously-failed"**: every test with `- [ ] Pass` or `[FAIL: ...]` is eligible. Reset `[FAIL: ...]` and `[FIXING: ...]` markers to `- [ ] Pass` before running. Leave `[x] Pass` and `[SKIP: ...]` untouched.

---

## Step 4: Execute and Auto-Judge, Per Type

Work through eligible tests in document order. After each verdict, update the file (Step 5). On failure, enter the fix loop (Step 6) before moving to the next test.

### 4A — API/CLI Tests

Extract the command from the test's `**Command**:` block. **One Bash call per test.** No `&&`, `;`, `echo` banners, output redirection, temp files, or multi-statement shells. A clean `curl -sS`, optionally piped into one `jq` stage. Rewrite generated commands that violate this before running.

**Pass criteria (ALL must be true):**

1. The command exited cleanly (no connection error).
2. HTTP status matches the Expected section's explicit status. If unspecified, any 2xx is pass-eligible on status alone.
3. Response body satisfies **every** machine-checkable assertion (literal substring, JSON key presence, JSON value equality, array length, type-of). Use `jq` or substring match.
4. If the test references `$UAT_AUTH_TOKEN`, the token must be present.

If any criterion fails → `[FAIL: ...]` with actual vs expected, then enter the fix loop (Step 6).

### 4B — UI Tests

Launch Puppeteer once on the first UI test (headless, 1600×950). Reuse for all UI tests. Close at end of run.

**Pass criteria (ALL must be true):**

1. `puppeteer_navigate` to `Page:` URL succeeds (no 4xx/5xx).
2. Expected section contains at least one selector- or text-based assertion verifiable via `puppeteer_evaluate` or `puppeteer_get_text`.
3. Every such assertion returns the expected value.

On fail, screenshot to `.docs/uat/screenshots/<task-number>-<UAT-ID>-fail.png`, then enter the fix loop. After a successful fix-and-rerun, **delete the fail screenshot** since the failure no longer exists.

If the Expected section is purely visual ("looks right") with no scriptable check → record `[FAIL: auto-judge: expected section requires human visual inspection]` and **skip the fix loop** — the agent has nothing to verify against.

### 4C — Manual Tests

Always recorded as `[FAIL: auto-judge: manual test requires human verification]`. **Do not enter the fix loop** — there is no machine-checkable signal to know whether a fix worked.

---

## Step 5: Update the File Per Verdict

Use the **`Edit`** tool — one `Edit` call per status line. Append the current date in the trailing HTML comment (`YYYY-MM-DD`).

**Status line formats:**

```markdown
Pass:    - [x] Pass <!-- 2026-04-13 -->
Fixing:  - [FIXING: attempt 1/3 — <short reason>] <!-- 2026-04-13 -->
Fail:    - [FAIL: auto-fix-exhausted: <last reason>] <!-- 2026-04-13 -->
Fail:    - [FAIL: auto-fix-declined: <why agent refused to fix>] <!-- 2026-04-13 -->
```

Only the status line changes. Never rewrite or reformat anything else in the test block. Preserve all metadata, headings, and whitespace exactly.

---

## Step 6: Autonomous Fix Loop

This is the defining feature of `/uat-auto-plus`. When a test fails in Step 4, do not move on — diagnose, fix, and re-run.

### Bounds

- **Max 3 fix attempts per test.** After the third unsuccessful attempt, record `[FAIL: auto-fix-exhausted: <last reason>]` and proceed to the next test.
- **Max 3 concurrent fix sub-agents across the whole run.** Most fixes will be sequential because they target the failing test in front of you, but if you batch independent failures (e.g. three unrelated API tests fail and you want to dispatch parallel investigations), cap at three.
- **Hard wall-clock cap: 30 minutes total** across all fix attempts. If exceeded, finalize remaining failures as `[FAIL: auto-fix-timeout: budget exhausted]` and proceed to Step 7.

### Loop Structure (per failing test)

For attempts 1 through 3:

1. **Mark the test `[FIXING: attempt N/3 — <short reason>]`** via `Edit` so the file reflects in-progress state.
2. **Diagnose** the failure. Read the failing test, the relevant application code, and recent logs. Use Serena (`find_symbol`, `find_referencing_symbols`, `get_symbols_overview`) for code navigation — not Grep/Glob. For runtime failures, consider invoking the `debug-logs` skill via `Skill` to triage logs and produce a ranked hypothesis list.
3. **Decide on the fix.** Apply the smallest correct change that makes the test pass without weakening it. Acceptable fix targets:
   - Application code (the implementation under test).
   - Build/config (a missing env var default, a misconfigured route, a wrong port).
   - Test environment fixtures or seed data.
   - **Never** the UAT test file's Steps, Expected, or Command. **Never** the test assertions in code.
4. **Delegate the fix to a sub-agent** via the `Agent` tool with `subagent_type: general-purpose` (or a more specific agent if one fits, e.g. `Plan` for design-heavy fixes). The sub-agent's prompt must include:
   - The failing test ID and full test body.
   - The actual vs expected evidence captured in Step 4.
   - The constraint: "do not modify the UAT file or test assertions; fix only application code, build, config, or fixtures".
   - A request for a short report listing files changed and the rationale.
5. **Re-run the test** using the same Step 4 procedure. Use the same Bash/Puppeteer call as before — do not relax the assertions.
6. **Evaluate:**
   - **Pass** → mark `[x] Pass`, delete any fail screenshots for this test, exit the loop, proceed to next test.
   - **Fail, attempt < 3** → continue to next attempt with refined diagnosis informed by the previous attempt's report.
   - **Fail, attempt = 3** → mark `[FAIL: auto-fix-exhausted: <last reason>]`, exit the loop, proceed to next test.

### Fix-Decline Cases

Some failures should not be fixed autonomously. In these cases, mark `[FAIL: auto-fix-declined: <why>]` immediately and proceed:

- The fix would require changing the test's Expected section, Steps, or Command (i.e. the test is wrong or out of date — that is a human call).
- The fix is in shared infrastructure code outside the scope of the current task (fixing it could break other tests; surface it for human review).
- The failure is a security-sensitive surface (auth, crypto, permissions) where a wrong fix is materially worse than a recorded failure.
- The failure is in third-party code or external services beyond the agent's control.

Declining is not failure — it is correct judgment.

### Avoiding Regressions

After every successful fix, before moving on, **re-run all previously-passing tests in the same file** to confirm no regression. Use the same auto-judge criteria. If a previously-passing test now fails, treat it as a new failure entering the fix loop on the cause (which is most likely the just-applied fix — consider reverting and re-diagnosing rather than piling on more changes).

This regression sweep is bounded by the same 30-minute wall-clock cap.

---

## Step 7: Completion and File Movement

After every eligible test has a terminal status (`[x] Pass`, pre-existing `[SKIP: ...]`, or `[FAIL: ...]`), decide outcome:

### All Pass (no `[FAIL]` or `[FIXING]` markers remain)

1. `git mv .docs/uat/<slug>.uat.md .docs/uat/completed/<slug>.uat.md` (fall back to `mv`).
2. Move the associated task: `git mv .docs/tasks/<number>-<slug>.md .docs/tasks/completed/<number>-<slug>.md`.
3. Update internal path references in both moved files (update any stale paths in the task; `pending/` → `completed/` in the UAT's source-task link).
3a-pre. **Update `.docs/tasks/README.md`** — remove this task's row from the Active Tasks table entirely. The index lists active tasks only; completed tasks are tracked by their presence in `.docs/tasks/completed/` and do **not** belong in the index. Use a single `Edit` call — never `sed`. **Also check the header**: if the **Last task:** line at the top of the README references this task's `NNN-slug.md`, `Edit` it to point at `completed/NNN-slug.md` instead. Do **not** decrement **Next task number** — it only ever goes up. The index is `/tackle`'s no-args survey source.
3a. **Roadmap Auto-Checkoff** — scan `.docs/roadmaps/` and `.docs/roadmaps/completed/` for any roadmap referencing this task and flip its matching checkbox. Follow the canonical algorithm in [`.docs/roadmaps/README.md#auto-checkoff-contract`](../../../.docs/roadmaps/README.md). Short form: (i) `mcp__serena__list_dir` on `.docs/roadmaps/` (skip `README.md`) and on `.docs/roadmaps/completed/`; (ii) `Read` each roadmap and look for lines matching `- [ ] [TASK-<NNN>:` whose link path ends in `<NNN>-<slug>.md` (either at `.docs/tasks/` or `completed/`); (iii) `Edit` each matching line in **one** call that **both** flips `- [ ]` → `- [x]` **and** rewrites the link path to the task's new location (e.g. `../tasks/NNN-slug.md` → `../tasks/completed/NNN-slug.md`) — use the full line text as `old_string` for uniqueness. Stale paths are **not** tolerated: if a reference exists, the path is updated. Then `Edit` the roadmap's `**Last updated**:` to today; (iv) bump the matching row's `Progress` numerator in `.docs/roadmaps/README.md`; (v) **Phase sweep** — for each roadmap where a match was found, identify the `## Phase N:` block containing that matched item and scan all other `- [ ] [TASK-NNN:` lines in that same phase; for each, use `mcp__serena__find_file` to check if `NNN-slug.md` exists under `.docs/tasks/completed/`; if it does, `Edit` that line in one call to flip `- [ ]` → `- [x]` and rewrite the link path to `../tasks/completed/NNN-slug.md`, then bump `Progress` in the index for each additional item; (vi) **Inline item sweep** — across the entire roadmap (not limited to the phase block that contains the task reference), collect every remaining `- [ ]` line whose body is free-form text (not a `[TASK-NNN:` link); `Read` the completing task file; use judgment to decide whether each inline item was accomplished by the completing task's work; if yes, `Edit` `- [ ]` → `- [x]` and bump `Progress` in the index; if uncertain, leave the item unchecked — err on the side of leaving items unchecked rather than over-checking. Silent no-op if no roadmap references the task. **Do NOT** auto-flip `Status: active` → `Status: done` even on the last box — that flip is manual. Use `Edit` only — never `sed`, `bash`, or `Write`.
4. Delete screenshots for this task: `mcp__serena__list_dir` on `.docs/uat/screenshots/` to find `<task-number>-*` matches, then `git rm` each (or `rm` if untracked).
5. Close Puppeteer if launched.
6. **Terminate every background process** the agent started for prerequisites or fix attempts. Use the `Bash` tool's KillShell as needed. Verify nothing is left running.
7. **Check for ADR linkage**: read the moved task file for a line matching `**Implements**: ADR-NNNN#DM`:
   - If found:
     1. Parse the `ADR-NNNN#DM` reference.
     2. `mcp__serena__find_file` for `NNNN-*.md` in `.docs/adr/`.
     3. `mcp__serena__search_for_pattern` on `.docs/tasks/` for the same `**Implements**: ADR-NNNN#DM` to check for remaining WIP tasks.
     4. **If no other WIP tasks remain**:
        - Single-task: replace `Source task(s): .docs/tasks/...` with `Source task(s): .docs/tasks/completed/NNN-slug.md — **implemented** YYYY-MM-DD`.
        - Multi-task: update this task's sub-line from `**WIP**` to `**done** YYYY-MM-DD`; append `- **Decision fully implemented** YYYY-MM-DD`.
     5. **If other WIP tasks remain**: update only this task's sub-line to `**done** YYYY-MM-DD`.
     6. **ADR inline checkbox sweep** — `Read` the full `## DM.` decision block in the ADR file (the H2 block whose identifier matches the `DM` from the `**Implements**:` reference); collect every remaining `- [ ]` line in that block; `Read` the completing task file; for each `- [ ]` item, use judgment to decide whether the completing task accomplished it; if yes, `Edit` `- [ ]` → `- [x]`; if uncertain, leave the item unchecked — err on the side of leaving items unchecked rather than over-checking. This sweep runs regardless of whether steps 4 or 5 applied. Use `Edit` only — never `sed`, `bash`, or `Write`.
     - Use `Read` then `Edit`. Never `sed`, `echo >>`, or shell redirection.
   - If not found: skip silently.
8. Emit the completion summary.

### Any Fail (`[FAIL: ...]` markers remain)

1. **Leave the UAT file in `.docs/uat/`**.
2. **Keep screenshots** for failing tests — diagnostic evidence for the next walkthrough.
3. Close Puppeteer if launched.
4. Terminate all background processes.
5. Emit the completion summary.
6. Exit 0 — the orchestrator treats `/uat-auto-plus` exiting as the task being done from its perspective.

### Summary Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAT AUTO-PLUS COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File:    .docs/uat/5-positions.uat.md
Source:  .docs/tasks/5-positions.md
Mode:    autonomous-fix
Budget:  attempts used 7/N · wall 12m22s/30m

Results:
  ✅ Passed:                 7   (of which fixed during run: 4)
  ⚠️ Skipped:                1   (pre-existing, untouched)
  ❌ Failed:                 1
    auto-fix-exhausted:     1
    auto-fix-declined:      0
    auto-judge-uncertain:   0
  ❔ Pending:                0
  Total:                    9

Fixes Applied:
  • UAT-API-001: added missing 422 handler in src/api/positions.ts
  • UAT-API-002: corrected route prefix in src/router.ts
  • UAT-UI-001: fixed null-coalescing in src/components/PositionList.tsx
  • UAT-UI-002: seeded fixture row in test/fixtures/positions.json

Failed Tests:
  • UAT-API-003: Delete Position — "auto-fix-exhausted: HTTP 500 expected 204 (last attempt)"

Next action:
  /uat-walk .docs/uat/5-positions.uat.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

On all-pass, replace `Next action` with `Moved to completed/` and the new paths.

---

## Important Rules

### Autonomy Boundaries
- The agent **may** modify application code, build/config, fixtures, and seed data to fix a failing test.
- The agent **may not** modify any UAT file's Steps, Expected, or Command sections.
- The agent **may not** modify test assertions in test code (e.g. `expect(...)` statements) to make them match buggy behavior.
- The agent **may not** disable, comment out, mark `xfail`, or `[SKIP: ...]` a failing test.
- The agent **may not** weaken type signatures, lower error-throwing branches, or remove validation to make a test pass.
- When in doubt, decline the fix (`[FAIL: auto-fix-declined: ...]`) and surface it for human review.

### Verdict Discipline
- `[x] Pass` only on concrete machine-verified evidence against unmodified test logic.
- `[FAIL: auto-fix-exhausted: ...]` after 3 attempts.
- `[FAIL: auto-fix-declined: ...]` when the fix is out of scope or unsafe to make autonomously.
- `[FAIL: auto-judge: ...]` when the test cannot be machine-verified at all (manual, visual-only).
- **Never** write `[SKIP: ...]` — skip is a human verdict.

### File Integrity
- Only modify status lines in the UAT file via `Edit`.
- Preserve all headings, metadata, whitespace.
- Application/config/fixture edits go through `Edit` (or Serena `replace_symbol_body` / `replace_content` for code).

### Process Hygiene
- Every background process started must be terminated before exit, regardless of outcome. No orphaned dev servers, type checkers, or watchers.
- Cap concurrent sub-agents at 3.
- Cap concurrent background processes at 3.

### Bash Hygiene (API/CLI Tests)
- One `curl` per Bash call, optionally with one `jq` pipe stage. Nothing else.
- No `&&`, `;`, `echo` banners, output redirection, temp files, or defensive flags.
- Rewrite any generated command that violates these before executing.

### Puppeteer Lifecycle
- Launch once on the first UI test (headless, 1600×950).
- Reuse across all UI tests, including re-runs after fixes.
- Always close at end of run.

### MCP Tool Compliance
- Use Serena for every directory listing, file search, and code-symbol navigation. Grep/Glob only for non-symbol text.
- Use the `Edit` tool for every status-line flip and every prose-file edit.
- No `sed`, `awk`, `ls`, `find`, `grep`, `cat` on any file. See `.docs/guides/mcp-tools.md`.
- Never emit literal password or token values. Only `"$UAT_AUTH_TOKEN"` and `"$UAT_TEST_PASSWORD"` env-var references are permitted.

---

## Begin Autonomous Walkthrough

Now start:

1. Resolve the UAT file from `$ARGUMENTS` (Step 1).
2. Verify and auto-repair prerequisites (Step 2). Abort on failure after one repair attempt.
3. Classify all eligible tests (Step 3).
4. For **each** eligible test in document order:
   a. Execute the test (Step 4).
   b. **Immediately** write the verdict to the file via `Edit` (Step 5) — do not buffer verdicts or batch updates.
   c. If the test failed, enter the fix loop (Step 6) — diagnose, fix, re-run, up to 3 attempts. After each attempt, **immediately** update the file with the current status (`[FIXING: ...]` or final verdict). Sweep regressions after each successful fix.
5. On completion, move files if all pass; emit summary (Step 7).

**Start now — resolve the UAT file and begin.**
