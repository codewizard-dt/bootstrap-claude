---
name: tackle
description: Execute an outlined task file step-by-step with subagent delegation
category: executing
model: claude-sonnet-4-6
argument-hint: <path/to/task.md, number-slug, or description>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md` + `wiki/work/tasks/lifecycle.md`; run /primer if not done this session.

# Tackle Outline

Execute a pre-planned task file step-by-step. **The task file IS the plan — no re-planning.** Each `### N.` step names its agent via a `<!-- agent: TYPE -->` annotation (default `general-purpose`). This command is a pure executor: read → execute next step → update, one step per cycle.

**Outline File**: $ARGUMENTS

---

## Step 0: Resolve the task file

Resolve `$ARGUMENTS` (use Serena `find_file`/`list_dir`):

| Input | Action |
|-------|--------|
| File path (`wiki/work/tasks/3-user-auth.md`) | confirm exists; else fall through |
| Number-slug (`3-user-auth`) | match in `wiki/work/tasks/`; else fall through |
| Number / description (`3`, `user auth`) | search `wiki/work/tasks/`; ambiguous → list + ask; no match → fall through |
| Empty | run **Roadmap Auto-Discovery** (0a) first; only then the task survey |
| Non-empty but unresolved | task survey — recommend, never auto-pick |

Use the resolved path as the outline for all later steps.

### Step 0a: Roadmap Auto-Discovery (empty `$ARGUMENTS` only)

Zero-click: find the first actionable roadmap item and tackle it, **no prompts**.

1. `mcp__serena__list_dir("wiki/work/roadmaps/", recursive=false)` — root `.md` files only (exclude `archive/`, `README.md`). None → task survey.
2. `Read` each roadmap (markdown). Select the one with the most `[x]` items (furthest along); tie/single → use it. No prompt.
3. Scan top-to-bottom for the first `## Phase N` (or flat list) containing a `- [ ]` item. None unchecked → roadmap done → task survey.
4. Take the first `- [ ]` line in that phase:
   - **Task link** (markdown link into `wiki/work/tasks/`) → extract path, use as outline. Announce: `Roadmap auto-selected: <roadmap> → Phase <N>: <name> → <link text>`.
   - **Inline item** (plain text) → treat text as a description, fall through to the task survey. Announce the inline item and that no task file exists.

### Task survey (empty OR unresolved)

Recommend from the index; **do not auto-pick**.
- **Read only `wiki/work/tasks/README.md`** (canonical index: columns `#`, `Slug`, `Progress`, `UAT`, `Flags`, `Objective`). Do NOT read individual task files, `grep`, `bash`, or aggregate across `wiki/work/tasks/` — the index exists to prevent exactly that. The only per-file read is the chosen task in Step 1.
- Missing README / no `## Active Tasks` table / missing columns → STOP: `Task index at wiki/work/tasks/README.md is not bootstrapped. Run /primer to bootstrap it, or invoke /tackle <path-or-slug> directly.` Do not scan every file.
- `mcp__serena__list_dir` on `wiki/work/uat/` only to sanity-check the `UAT` column vs disk; on disagreement trust disk, note the drift, don't block. If the index looks stale (`Progress: 0/0`, missing rows, stale UAT), warn in one sentence (`Index may be stale: <observation>. Treating rows as authoritative.`) and continue — don't pre-emptively fix it.
- Empty Active table → STOP: "No active tasks to tackle".
- Present Active rows as a compact table (`—` for empty cells). Below it, a **Recommendation** ranking top 1–3 by priority:
  1. In-progress without a pending UAT (some `[x]`, not all, no pending UAT — finish what's started)
  2. Unblock-able `[BLOCKED]`/`[FAILED]` whose blocker is plausibly resolvable now
  3. Lowest-numbered fully-pending task (all `[ ]`, no pending UAT)
  - Tasks **with a pending UAT** are excluded from recommendations and listed under `**Awaiting UAT**:` suggesting `/uat-walk wiki/work/uat/<NNN>-<slug>.uat.md`.
- Use `AskUserQuestion` (top rec first, labelled `(Recommended)`; up to 2 more; `header` = number-slug). If input was unresolved, prefix one line noting it. Do NOT proceed to Step 1 until the user chooses.

---

## MANDATORY: Serena for all code operations

Every delegated sub-agent **MUST** use Serena, non-negotiable:

| Operation | Use | Never |
|-----------|-----|-------|
| Explore structure | `get_symbols_overview` | `Read` on code |
| Find symbol | `find_symbol` | `Grep` on code |
| Edit code | Serena symbolic / file-line tools | native `Edit` on code |
| Search code | `search_for_pattern` | `Grep` |
| Find files / dirs | `find_file`, `list_dir` | `Glob`, `find`, `ls`, `cat` |
| Library docs | Context7 | `WebSearch`/`WebFetch` |

Standard Read/Edit/Write are allowed for markdown and config (JSON, YAML, `.env`) only. **Every** sub-agent prompt must include: *"Use Serena for all code exploration/editing and all file/directory exploration. Standard Read/Edit/Write for markdown and config only. Never bash `ls`/`cat`/`find`/`grep`/`sed`. See `.docs/guides/mcp-tools.md`."*

**Verification scope: static gates only** (`bash -n`, typecheck, lint, unit tests). Runtime/E2E is the UAT phase's job — see `.docs/guides/command-anti-patterns.md#verification-belongs-to-the-right-phase`.

---

## Step 1: Read & parse the outline

**Delegate to an `Explore` sub-agent** (main agent does NOT read the outline directly). It reads via Serena and returns: ordered `### N.` sections, each with status and agent type. Missing/empty file → STOP + report. Status parsing: complete = `[x]`/`[DONE]`/`~~strikethrough~~`; in-progress = `[ ]`/`[WIP]`; not-started = unmarked; blocked = `[BLOCKED]`. Agent type from `<!-- agent: TYPE -->` (default `general-purpose`).

**Completion check:** all items complete → report "All tasks in outline complete!" and STOP.

## Step 2: Execute the next incomplete step

**Delegate to the agent type named in that section's annotation.** All implementation runs in a sub-agent, never the main context. Next-step priority: (1) fix blockers, (2) continue WIP, (3) start first incomplete section.

**Delegate directly — no re-planning.** Pass the step's checkboxes and sub-details verbatim. Do not research, re-plan, or ask questions (that was `/task-add`'s job).

**CRITICAL:** max **3** sub-processes at a time; **always terminate** processes when done (dev servers, type checkers, long-running commands).

Every sub-agent prompt MUST include:
1. The Serena mandate (above).
2. The exact checkboxes + sub-details from the section, verbatim.
3. **Static gates only** after the work: `bash -n` for shell scripts; the project typecheck (`pnpm typecheck`, `make types-backend`, `mypy`, …); lint and unit tests allowed. **Do NOT** run runtime/E2E: no scratch dirs, helper scripts against real paths, curl, rsync dry-runs, spawned servers, fixture seeding, or asserting on files the code just produced. If a step calls for runtime verification, mark it `[DEFERRED-TO-UAT]` and move on. **All type errors are caused by your changes — no exceptions** (the codebase is committed clean before every cycle; zero pre-existing errors). **NEVER `git stash` to "verify" if errors are pre-existing — banned.**
4. Report completion status (success / partial / failure + reason).

## Step 3: Update the outline

**Do this directly in the main agent — do NOT delegate** (simple text replacement).

⛔ **HARD RULE — update immediately, never batch.** The moment a Step 2 sub-agent returns, the *next thing you do* is flip that step's checkboxes on disk. Do not dispatch the next sub-agent, continue the cycle, or defer updates. Step N's update lands before step N+1 begins.

1. Use **`Edit`** — one call per checkbox line. **Never** `sed`/`awk`/`perl -i`/`echo` on task files, however many flip (ten `Edit`s right; one `sed` wrong + triggers approval). Markers: `[x]` done · `[WIP]` partial · `[BLOCKED: reason]` · `[FAILED: reason]`.
2. Add `<!-- Updated: YYYY-MM-DD HH:MM -->`.
3. Add any subtasks discovered during execution.
4. **Update `wiki/work/tasks/README.md`** — flip this task's `Progress` to `<done>/<total>` and its `Flags` if a marker was added/cleared (one `Edit` per changed cell; skip if unchanged). Letting the index drift defeats the no-args survey.

## Step 4: Repeat

Step 1 → 2 → 3 → 2 → 3 … **One step per cycle; never run Step 2 twice in a row.** The outline must visibly progress between every dispatch (so the user and any interrupting `/tackle` resumption see real-time state). Continue until all complete or interrupted.

---

## Important rules

- **Process management** — max 3 concurrent sub-agents; **always terminate all processes/sub-agents when done**, verify termination after each; a hung sub-agent → terminate + mark `[BLOCKED]`. The main agent NEVER runs implementation commands directly.
- **Error handling** — a failed sub-agent → `[FAILED: reason]`; do not auto-retry, continue with the next available task; all remaining blocked/failed → STOP + report.
- **Progress reporting** — each cycle: what completed, what's next, X of Y done.
- **Stopping** — all `[x]`; user interrupt; all remaining blocked/failed; outline invalid/unreadable.
- **No re-planning** — executor not planner. Don't research, re-plan, break down further, or ask questions. A step too vague to execute → `[BLOCKED: step needs more detail]` and move on. Agent annotations + step details are authoritative.
- **Mandatory delegation** — all steps except Step 3 (outline update) go to sub-agents; the main agent only orchestrates (receive → decide → delegate), never reads source, edits, or runs commands directly. Preserves the main context window.

---

## Completion (after all steps done)

### Step 6: UAT generation gate — ⛔ HARD STOP (never skip or reorder)
Ask via `AskUserQuestion`: **"Generate UAT tests for this task?"** — **Yes** → run `/uat-generate wiki/work/tasks/<filename>` (creates the matching UAT file); **No** → skip. **Wait** for the answer (and for `/uat-generate` to finish, if invoked) before Step 6b.

### Step 6b: Type-check gate
Try in order, stop at the first that runs (exit 0 or type errors); skip to next only if not found / target missing: (1) `Skill(typecheck)`, (2) `make typecheck`. Suppress output from not-found/missing-target commands — surface only real type errors. None available → skip silently.
- **On type errors** → report them, mark the relevant step `[FAILED: type errors]`, and **do not** proceed to the banner. The user must resolve (or explicitly say skip) first.
- **On pass/skip** → banner.

### Banner (output verbatim)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TACKLE COMPLETED — all steps done
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 7: Suggest UAT
If UAT was generated, suggest `/uat-walk wiki/work/uat/<file>.uat.md`.

**Start now — read the outline and begin the first cycle.**
