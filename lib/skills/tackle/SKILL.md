---
name: tackle
description: Execute an outlined task file step-by-step with subagent delegation
category: executing
model: claude-sonnet-5
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

**Mark work started:** if the resolved task's frontmatter `status` is `todo`, `Edit` it to `in-progress` now (main agent, not delegated) — this is the signal that implementation has begun, distinct from not-yet-started. Sync `wiki/work/tasks/index.md`'s `· status` suffix for this task in the same cycle (one `Edit`, skip if already `in-progress`).

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
- **Read only `wiki/work/tasks/index.md`** (canonical active list: bullet lines `- [TASK-NNN — Title](TASK-NNN-slug.md) — one-line summary · status`). Do NOT read individual task files, `grep`, `bash`, or aggregate across `wiki/work/tasks/` — the index exists to prevent exactly that. The only per-file read is the chosen task in Step 1.
- Missing `index.md` / no active-item bullets → STOP: `Task index at wiki/work/tasks/index.md is empty or missing. Add tasks with /task-add, or invoke /tackle <path-or-slug> directly.` Do not scan every file.
- `index.md` carries no progress columns — it lists title + one-line summary + `status` only, and `status` now directly distinguishes `todo` / `in-progress` / `pending-uat` (see [lifecycle](../tasks/lifecycle.md)) — no need to infer UAT-awaiting state from file existence. If a bullet points at a task file that no longer exists (moved/archived), note the drift in one sentence and skip it — don't pre-emptively fix the index.
- Empty active list → STOP: "No active tasks to tackle".
- Present the active items as a compact table (`TASK-NNN` · title · status). Below it, a **Recommendation** ranking top 1–3 by priority, using `status` alone:
  1. `status: in-progress` — finish what's started.
  2. `status: todo`, lowest-numbered first.
  - Tasks at `status: pending-uat` are excluded from recommendations and listed under `**Awaiting UAT**:` — `mcp__serena__list_dir` on `wiki/work/uat/` for the matching `UAT-NNN-*` file; if found, suggest `/uat-walk wiki/work/uat/UAT-NNN-<slug>.md`; if none found (implementation finished but `/uat-generate` never ran), suggest `/uat-generate wiki/work/tasks/TASK-NNN-<slug>.md` instead.
  - Progress counts, `[BLOCKED]`/`[FAILED]` flags, and per-step state are **not** in `index.md` by design — they live in the task files. This no-args survey deliberately ranks on `status` + UAT presence alone rather than re-reading every task file; use `/task-audit` when the full progress/blocker picture is needed. (Design note: the survey was simplified to `index.md`'s real bullet schema rather than expanding `index.md` with Progress/UAT/Flags columns, which would violate the "active items only, flat list" convention in `wiki/conventions.md`.)
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
4. **Keep `wiki/work/tasks/index.md` in sync** — `index.md` has no progress or flags columns, so there is nothing to recount there. The one thing to maintain is the `· status` suffix on this task's bullet line: if this cycle flips the task's frontmatter `status` (e.g. `todo` → `in-progress`), update the matching `· status` on its `index.md` line with a single `Edit` (skip if unchanged). Progress and flags live only in the task file.

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

### Step 5: Mark implementation pending UAT

Before anything else: `Edit` the task's frontmatter `status` → `pending-uat` (main agent, not delegated) — every `## Steps` checkbox is now checked, so there's nothing left to implement, only to verify. Sync `wiki/work/tasks/index.md`'s `· status` suffix for this task in the same cycle (one `Edit`).

This is a real state, not a formality — `/roadmap-next` uses it to recommend `/uat-walk`/`/uat-auto` instead of `/tackle` for this task going forward. Do this even if you're about to immediately answer "No" to the UAT-generation gate below — a task with no UAT still needs `pending-uat` recorded (an explicit skip is `/uat-skip`'s job, not silence).

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
