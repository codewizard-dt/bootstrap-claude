---
name: uat-auto
description: Non-interactively run every test in a pending UAT file and auto-judge verdicts (headless, fail-closed)
model: claude-sonnet-4-6
argument-hint: <path/to/uat-file.md, number-slug, or description>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `wiki/work/tasks/lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


# UAT Auto

Headless variant of `/uat-walk`. Runs every test in a pending UAT file, auto-judges pass/fail from deterministic evidence, writes results, and moves files on completion — with **zero user prompts**.

---

**UAT File**: $ARGUMENTS

---

## When to Use

Use `/uat-auto` when there is no human at the keyboard — for example, when a headless orchestrator (e.g. a tmux-based multi-agent conductor, a CI job, or a scheduled run) dispatches UAT work. Use `/uat-walk` for anything interactive.

`/uat-auto` slots into the same task lifecycle:

```
/task-add → /tackle → /uat-generate → /uat-auto (headless)   ─┐
                                     → /uat-walk (human)─┴→ completed/
```

Both walkthrough commands produce identical status-flip outcomes — only the decision procedure differs.

---

## Prime Directive: Fail Closed

**The agent never auto-passes a test it cannot verify with hard evidence.** Pass requires a machine-checkable match. On any doubt, uncertainty, or missing evidence, record `[FAIL: auto-judge: <reason>]`. **Never** `[SKIP]` — skip is a human judgment, not an agent judgment. **Never** `[x] Pass` unless the pass criteria below are met exactly.

This is the single most important rule in this command. A false pass is worse than a false fail: a false fail gets re-triaged by a human in the next `/uat-walk`, whereas a false pass ships a broken feature.

---

## Step 1: Resolve and Parse the UAT File

Parse `$ARGUMENTS` to locate the UAT file (same resolver as `/uat-walk`):

1. **File path** (e.g. `wiki/work/uat/UAT-003-user-auth.md`) — use directly.
2. **Number-slug** (e.g. `UAT-003` or `003-user-auth`) — Call Serena `list_dir` or `find_file` in `wiki/work/uat/` (files never move — no completed/ subdir).
3. **Number or description** (e.g. `3`, `user auth`) — Call Serena `list_dir` or `find_file` in `wiki/work/uat/`. If ambiguous, **STOP** and report in the completion summary (do not prompt).
4. **If `$ARGUMENTS` is empty OR the input above did not resolve to a UAT file** — auto-pick from pending:
   - Use `mcp__serena__list_dir` on `wiki/work/uat/` to enumerate all UAT files with `status: pending` frontmatter
   - If none exist, **STOP** and exit: "No pending UAT files found"
   - Pick the lowest-numbered file (by the `<NNN>` prefix) as the stable default
   - Announce the auto-pick in one line before proceeding: `No matching UAT file — running \`<filename>\`` (if `$ARGUMENTS` was non-empty but unresolved, prefix with `Input \`<arguments>\` did not match — `)
   - Do **not** prompt for confirmation; proceed immediately

If the resolved file does not exist, is empty, or is not in `wiki/work/uat/`, **STOP** and exit with an explanatory summary.

Parse the file:
- **Test sections**: `### UAT-*` headings (e.g. `UAT-API-001:`, `UAT-UI-002:`)
- **Prerequisites**: items under `## Prerequisites`
- **Existing statuses**: `- [ ] Pass`, `- [x] Pass`, `- [FAIL: ...]`, `- [FIXING: ...]`, `- [SKIP: ...]`
- Count totals per status

If every test is already resolved (no `- [ ] Pass`, no `[FAIL]`, no `[FIXING]`), skip to **Step 6** (file-movement).

---

## Step 2: Verify Prerequisites (Non-Interactively)

For each prerequisite in the UAT file:

- If the prerequisite is a **runnable check** (e.g. "server running at localhost:4321", "database migrated"), attempt to verify it with a single deterministic command (a `curl`, a `pg_isready`, a file existence check). One Bash call per prerequisite.
- If the prerequisite is **descriptive only** (e.g. "test data loaded"), treat it as **unverifiable** and record a note. Do not assume it is satisfied.
- If any prerequisite fails or is unverifiable, **abort the entire walkthrough** with `[FAIL: auto-judge: prerequisite not satisfied — <which>]` on every untested test. Proceed to Step 6 reporting.

Prerequisites are a hard gate. A single unverifiable prerequisite fails the run.

---

## Step 3: Classify Tests

Classify each untested and failed-but-scoped test (see Mode below):

- **API/CLI test** — contains `curl`, `http`, `wget`, or a shell-command code block in Steps/Expected, OR has an `Endpoint:` metadata field
- **UI test** — has `UAT-UI-*` prefix, or has `Page:` / `Components:` metadata
- **Manual test** — anything else

### Mode

Unlike `/uat-walk`, there is no mode prompt. The default is **"pending + previously-failed"**: every test with `- [ ] Pass` or `[FAIL: ...]` is eligible. Reset `[FAIL: ...]` to `- [ ] Pass` before running so a fresh verdict is recorded. Leave `[x] Pass` and `[SKIP: ...]` untouched.

---

## Step 3.5: Stub Detection (Pre-Execution Gate)

Before executing any eligible test, check whether the implementation is a stub or placeholder. A stub test **must remain pending** (`- [ ] Pass`) — do not execute it, do not record `[FAIL]` for it.

For each eligible test:

1. **Identify the implementation target** from the test's metadata:
   - API/CLI tests: the `Endpoint:` field or URL in `**Command**:`
   - UI tests: the `Page:` field or component name in `Components:`
   - Manual tests: the feature name from the test `Description`

2. **Locate the implementation file** using Serena:
   - `mcp__serena__search_for_pattern` for the route/handler/component name across `src/`, `app/`, `lib/`, or equivalent source directories
   - If nothing is found, treat as **unlocatable** and proceed with normal execution (cannot confirm stub; run the test)

3. **Check for stub indicators** in the located file(s) using `mcp__serena__find_symbol` or `mcp__serena__search_for_pattern`:
   - `TODO`, `FIXME`, or `HACK` markers inside function/method bodies
   - `throw new Error('not implemented')`, `raise NotImplementedError`, `notImplemented()`, `unimplemented!()`
   - `pass  # TODO`, `pass  # stub`, or a bare `pass` as the only statement in a function
   - Empty function/method bodies: body is only `{}`, `return`, `return null`, `return undefined`, `return None`
   - Placeholder comments: `// stub`, `# stub`, `// implement this`, `# TODO: implement`

4. **If stub indicators are found**:
   - Leave the test status as `- [ ] Pass` — do **not** modify the status line
   - Record the test in the run's internal tracking as `stub-detected` with the file and indicator found
   - **Do not execute the test**

5. **If no stub indicators are found** (or the file is unlocatable):
   - Proceed to Step 4 for normal execution

Run this gate for every eligible test **before** executing any of them (classify all tests in Step 3 first, then sweep with stub detection, then execute the non-stub tests).

---

## Step 4: Execute and Auto-Judge, Per Type

Work through eligible tests in document order. Update the file immediately after each verdict (see Step 5).

### 4A — API/CLI Tests

Extract the command from the test's `**Command**:` block (written by `/uat-generate`). If no extractable command exists, record `[FAIL: auto-judge: no machine-executable command in test body]` and move on.

**One Bash call per test.** Run the command as-is. No `&&`, no `;`, no `echo` banners, no `-o /tmp/...` indirection, no multi-statement shells. Same forbidden-patterns rules as `/uat-walk` Step 3A — a single clean `curl -sS`, optionally piped into one `jq` stage. If the generated command contains forbidden patterns, rewrite it to the clean form before executing.

**Pass criteria (ALL must be true):**

1. The command exited successfully (curl returned a response; no connection error).
2. The HTTP status code matches the Expected section's explicit status (e.g. "HTTP 201"). If no status is specified, treat any 2xx as pass-eligible on status alone.
3. The response body satisfies **every** machine-checkable assertion in the Expected section. Machine-checkable means: literal string presence, JSON key presence, JSON value equality, array length, or type-of checks. Use `jq` or direct substring matching.
4. If the test references `$UAT_AUTH_TOKEN`, the token must be present in the environment. If not present, record `[FAIL: auto-judge: auth token missing]`.

If any criterion fails → `[FAIL: auto-judge: <which criterion, with actual vs expected>]`.
If the Expected section contains no machine-checkable assertions at all → `[FAIL: auto-judge: expected section not machine-verifiable]`.

### 4B — UI Tests

UI tests (`UAT-UI-*` prefix, or tests with `Page:` / `Components:` metadata) are **always** recorded as:

```
[FAIL: auto-judge: UI test requires human verification — use /uat-walk]
```

Do not navigate, screenshot, or attempt any browser interaction. Use `/uat-walk` for interactive human verification.

### 4C — Manual Tests

Manual tests (edge cases, concurrency, integration scenarios) are **always** recorded as `[FAIL: auto-judge: manual test requires human verification]`. Do not attempt to execute or heuristically evaluate them. This is intentional fail-closed behavior — if `/uat-generate` produced a manual test, it expected a human.

---

## Step 5: Update the File Per Verdict

Use the **`Edit`** tool — one `Edit` call per status line. **Never** `sed`, `awk`, `perl -i`, or `echo`, even when many tests flip in a row. See `.docs/guides/mcp-tools.md` "Common anti-patterns".

Append the current date in the trailing HTML comment (ISO format, `YYYY-MM-DD`).

**Status line formats:**

```markdown
Pass:    - [x] Pass <!-- 2026-04-13 -->
Fail:    - [FAIL: auto-judge: HTTP 500 expected 201] <!-- 2026-04-13 -->
```

Only the status line changes. Never rewrite or reformat any other part of the test block. Preserve all metadata, headings, and whitespace exactly.

---

## Step 6: Completion and File Movement

After every eligible test has a non-blocking status (`[x] Pass`, `[SKIP: ...]` already-present, or `[FAIL: ...]`), decide outcome:

### All Pass (no `[FAIL]` or `[FIXING]` markers remain)

1. **Flip UAT status** — Edit `status:` → `passed`; bump `updated:` in the UAT file frontmatter.
2. **Flip task status** — Read `task:` frontmatter from the UAT file to get the task ID. Open `wiki/work/tasks/TASK-NNN-slug.md`, edit `status:` → `done`; bump `updated:`. Files never move.
3. **Remove rows from family indexes:**
   - Remove the UAT's row from `wiki/work/uat/index.md`
   - Remove the task's row from `wiki/work/tasks/index.md`
   Use a single `Edit` call per file.
4. **Roadmap Auto-Checkoff** — scan `wiki/work/roadmaps/` for files with `status: active` frontmatter. For each: find checklist lines linking to this TASK-NNN, `Edit` `- [ ]` → `- [x]` (path stays — file never moved), perform inline item sweep. If all items `[x]`: flip roadmap `status: done`, remove from roadmaps index. Use `Edit` only.
5. **Decision annotation** — check task body for `implements::[[DEC-NNNN#DM]]`. If found: open the decision file, append `— implemented YYYY-MM-DD` to the task's "Source task(s):" line. Run inline checkbox sweep on the decision block.
7. **Append log entry** to `wiki/log.md`:
   ```
   ## [YYYY-MM-DD] uat | UAT-NNN passed (auto)
   Task TASK-NNN marked done.
   ```
8. Emit the completion summary (see below).

### Any Fail (`[FAIL: ...]` markers remain)

1. **Leave the UAT file in `wiki/work/uat/`** — status stays `pending` or `in-progress`; it is not complete.
3. **Keep screenshots** — they are diagnostic evidence for the next human walkthrough.
4. Emit the completion summary.
5. Exit 0 — a headless orchestrator treats `/uat-auto` exiting as the task being done from its perspective; the UAT pipeline itself decides what to do with the fail markers.

### Summary Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAT AUTO COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File:    wiki/work/uat/UAT-005-positions.md
Source:  wiki/work/tasks/TASK-005-positions.md
Mode:    headless

Results:
  ✅ Passed:       6
  ⚠️ Skipped:      1  (pre-existing, untouched)
  ❌ Failed:       2
    of which auto-judge-uncertain:  1
  ❔ Pending:      0
  🔲 Stub-detected (pending): 0  (left untouched — implement first)
  Total:           9  (includes stub-detected)

Failed Tests:
  • UAT-API-003: Delete Position — "auto-judge: HTTP 500 expected 204"
  • UAT-EDGE-001: Empty Positions — "auto-judge: manual test requires human verification"

Next action:
  /uat-walk wiki/work/uat/UAT-005-positions.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

On all-pass, replace `Next action` with the task and UAT IDs and their new `done`/`passed` statuses.

---

## Important Rules

### No User Interaction
- **No `AskUserQuestion`** — ever. If an ambiguity arises, record fail and exit.
- **No inline prompts** — no `Pass / Fail / Skip?` text to the user. The summary at the end is the only output the user reads.
- **No clarifying questions** on the UAT file path. Ambiguous input → exit with a diagnostic summary.

### No Fix Workflow
- This command **does not** delegate fixes. It records evidence and exits. Re-run `/uat-walk` to triage and fix.
- `[FIXING: ...]` markers found in the input file are reset to `- [ ] Pass` and re-evaluated (a `/uat-walk` session may have been interrupted mid-fix).

### Verdict Discipline
- `[x] Pass` only on concrete machine-verified evidence (Step 4 criteria).
- `[FAIL: auto-judge: <reason>]` for anything else, including uncertainty, missing commands, non-verifiable expected sections, and manual tests.
- **Never** write `[SKIP: ...]` — skip is a human verdict.

### File Integrity
- Only modify status lines via `Edit`. Never rewrite other parts of the UAT file.
- Preserve all headings, metadata, whitespace.

### Bash Hygiene (API/CLI Tests)
- One `curl` per Bash call, optionally with one `jq` pipe stage. Nothing else.
- No `&&`, `;`, `echo` banners, output redirection, temp files, defensive flags, or multi-line line-continuations.
- Rewrite any generated command that violates these rules before executing.

### No Browser Automation

**`/uat-auto` does not use any browser automation.** UI tests are always recorded as requiring human verification (see Section 4B). Use `/uat-walk` for interactive human walkthroughs.

### MCP Tool Compliance
- Use Serena for every directory listing and file search (e.g. screenshots cleanup).
- Use the `Edit` tool for every status-line flip.
- No `sed`, `awk`, `ls`, `find`, `grep`, `cat` on any file. See `.docs/guides/mcp-tools.md`.
- Never emit literal password or token values in any Bash call, thinking block, or text output. Only `"$UAT_AUTH_TOKEN"` and `"$UAT_TEST_PASSWORD"` env-var references are permitted.

---

## Begin Auto-Walkthrough

Now start:

1. Resolve the UAT file from `$ARGUMENTS` (Step 1).
2. Verify prerequisites (Step 2). Abort on failure.
3. Classify all eligible tests (Step 3).
4. For **each** eligible test in document order:
   a. Execute the test (Step 4).
   b. **Immediately** write the verdict to the file via `Edit` (Step 5) — do not buffer verdicts or batch updates.
5. On completion, move files if all pass, keep in pending if any fail, emit summary (Step 6).

**Start now — resolve the UAT file and begin.**
