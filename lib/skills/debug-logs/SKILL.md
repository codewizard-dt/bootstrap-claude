---
name: debug-logs
description: Diagnose points of failure by inspecting session context, running processes, and conventional log stores; produce a ranked list of likely causes and next actions without applying fixes
category: researching
model: claude-sonnet-5
argument-hint: "[optional symptom or error message]"
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# Debug

Diagnose a failure by gathering session context, locating the right log stores, and producing a ranked list of likely causes with concrete next actions. **Read-only by default** — propose fixes, do not apply them.

---

**Symptom (optional)**: $ARGUMENTS

If `$ARGUMENTS` is empty, infer the failure from the most recent failed command, error message, or the user's stated frustration in the conversation. If nothing is obvious, ask one focused clarifying question before continuing.

---

## Phase 1: Capture Session Context

Build a picture of *what was being attempted* before triaging logs.

1. **Recent intent** — restate, in one sentence, what the user was trying to accomplish (from `$ARGUMENTS` and recent turns).
2. **Recent edits** — run `git status` and `git diff` (and `git log -5 --oneline`) to see what changed in the working tree. The failure is almost always related to the most recent diff.
3. **Background processes** — call `TaskList` to find any dev servers, watchers, test runners, or build processes spawned in this session. Note their IDs.
4. **Foreground errors** — scan the conversation for recent failed Bash exits, stack traces, hook rejections, or non-zero return codes. Quote the exact error if available.
5. **Project memories** — `mcp__serena__list_memories(topic="<failure area>")` then read any memory describing known gotchas or prior incidents in this area.

---

## Phase 2: Identify Relevant Log Stores

Pick the smallest set of sources that could contain the failure signal. Do not dump every log; pick by symptom.

| Symptom shape | Likely log source | Tool |
|---|---|---|
| Background server crashed / 500s | `TaskOutput` on the dev server task | `TaskOutput` |
| Test failure / assertion error | `TaskOutput` on the test task, or rerun with `--reporter=verbose` | `TaskOutput`, `Bash` |
| Build / compile error | Build task output, `tsc` / `next build` cache, `.next/trace` | `TaskOutput`, `Read` |
| Browser-side failure (UI bug, console error) | Playwright snapshot + screenshot | `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_take_screenshot` (or `mcp__playwright-shared__*` when bootstrap registered under the alternate name to avoid a project conflict — see `wiki/guides/mcp-tools.md`) |
| Type / lint regression | IDE diagnostics | `mcp__ide__getDiagnostics` |
| CI failure on a PR/branch | GitHub Actions logs | `gh run list`, `gh run view --log-failed` |
| Deployed app failure (DigitalOcean) | App platform logs | `mcp__digitalocean__apps-get-logs` |
| Application file logs | `./logs/`, `./tmp/`, `./.next/`, `./dist/`, `~/Library/Logs/<app>/` | `mcp__serena__list_dir`, `Read` |
| Database / migration | DB cluster logs (managed) or local pg/mysql log path | `mcp__digitalocean__db-cluster-*`, `Read` |

**Discovery rules:**
- Use `mcp__serena__list_dir` to find log directories — never `ls`, `find`, or `tail` via shell for exploration.
- Use `Read` (with `offset`/`limit`) to read the **tail** of large log files, not `cat` / `tail -f`.
- For background process output, prefer `TaskOutput` (it streams the running process) over re-spawning the command.
- If a relevant log source is unreachable (no permission, no MCP available, file missing), say so explicitly and move on.

---

## Phase 3: Inspect & Extract

For each selected source:

1. **Read the most recent slice** — last ~200 lines is usually enough; expand only if the stack trace is truncated.
2. **Extract the failure signal** — quote the actual error message, exception type, file/line, HTTP status, exit code. Skip ambient log noise.
3. **Note the timestamp** — confirm the error occurred *after* the most recent edit (Phase 1, step 2). If it predates the edit, the failure may be unrelated to current work.
4. **Cross-reference** — when an error names a file/symbol, use `mcp__serena__find_symbol` to read the current implementation and look for a mismatch with the error.

---

## Phase 4: Correlate & Hypothesize

Produce a ranked list of likely causes. Be concrete — name files, lines, and symbols.

For each hypothesis, capture:

- **Cause** (one sentence)
- **Evidence** (which log line + which code location point to it)
- **Confidence** (high / medium / low — be honest about guessing)
- **Next action** (a specific command, edit, or further check the user can run)

Stop at 3 hypotheses unless the user asked for an exhaustive list. Order by confidence, then by cheapness-to-verify.

---

## Phase 5: Report

Present the diagnosis as a short structured report:

```
### Symptom
<one line>

### What changed recently
<git diff summary, 1-3 lines>

### Logs inspected
- <source 1>: <key finding>
- <source 2>: <key finding>

### Ranked hypotheses
1. **<cause>** — <evidence> [confidence: H/M/L]
   → next: <action>
2. ...

### Recommended next step
<one concrete action — usually "run X" or "let me try the fix in <file>:<line>">
```

After reporting, **stop and wait for direction**. Do not auto-apply a fix unless the user explicitly says to. If the user confirms a fix path, hand off to standard editing tools (Serena symbolic / Edit) — debugging itself remains read-only.

---

## When Findings Are Novel

If diagnosis surfaced a non-obvious failure mode that future sessions would benefit from (e.g. "this error always means env var X is unset", "this stack trace is always a stale build cache"), suggest writing a Serena memory under `gotchas/<area>/<short-name>` — but only with user approval. Do not write the memory unprompted.

---

## CRITICAL Rules

1. **Read-only by default** — debug investigates; the user decides whether to fix.
2. **Pick log sources by symptom** — do not enumerate every log store on every invocation.
3. **Tail, do not dump** — use `Read` with `offset`/`limit`; never spawn `tail -f` blocking processes.
4. **Never spawn new long-running processes** to gather logs. Read what is already there or use existing background tasks via `TaskOutput`.
5. **Quote actual error text** — paraphrased errors hide the real signal.
6. **Acknowledge gaps** — if a log source is missing or unreachable, say so; do not invent a hypothesis to fill the gap.
7. **Maximum 3 sub-processes at a time** if delegating parallel log reads.
8. **Always terminate** any process you started for diagnosis before reporting.
