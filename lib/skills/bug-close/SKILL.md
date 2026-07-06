---
name: bug-close
description: Close an in-progress bug — record root cause and resolution, require a regression test, then move it to archive/ (or delete it for late wontfix decisions)
category: executing
model: claude-sonnet-4-6
argument-hint: <BUG-NNNN, path, or number-slug>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md` + `wiki/work/bugs/lifecycle.md`; run /primer if not done this session.

# Close Bug

Finalize a bug that has been fixed. Records the root cause, the resolution (commit, PR, regression test), and moves the file to `wiki/work/bugs/archive/`. Refuses to close without a regression test — silent closes are the worst-case anti-pattern.

---

**Input**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the Bug File

Parse `$ARGUMENTS`. Accepted forms:
- `BUG-NNNN` (e.g. `BUG-0042`)
- `NNNN` (e.g. `0042` or `42`)
- `NNNN-slug` (e.g. `0042-csv-export`)
- Full path

Resolution order:
1. If full path: confirm with `mcp__serena__list_dir`.
2. Otherwise normalize and search `wiki/work/bugs/` first via `mcp__serena__find_file`.
3. If found in `wiki/work/bugs/` root: STOP and tell the user the bug must be triaged and worked first — `/bug-triage` → choose "Start work now" → land a fix → re-run `/bug-close`.
4. If found in `archive/`: STOP — already terminal.
5. If not found anywhere: STOP and report the error.

Read the bug file in full.

### Step 2: Read the Spec

Read `wiki/work/bugs/lifecycle.md` for the close-gate requirements (Root Cause Analysis, fix commit, and regression test) and the valid terminal statuses.

### Step 3: Audit Pre-Close Fields

A bug in `in-progress/` should already carry triage values. Re-check that all of these are present and non-templated:

- `Status` is `in-progress` or `fixed`
- Severity, Priority, Assignee, Reporter, Reported, Tags — all set
- `Impact`, `Workaround` — non-empty (Workaround may legitimately be `None known`)
- Environment, Steps to Reproduce, Expected, Actual — unchanged from filing

If any are missing or templated, ask the user to fill them via `AskUserQuestion` before proceeding. Update the file with `Edit`.

### Step 4: Decide the Outcome

Use `AskUserQuestion` (single-select):

| Choice | Effect | When to pick |
|--------|--------|--------------|
| **Verify and close** (default) | Status → `verified`; **move file** to `archive/` | A fix has been merged and validated |
| **Mark fixed (not yet verified)** | Status → `fixed`; file stays in `wiki/work/bugs/` | Patch landed but waiting on UAT or staging soak |
| **Won't fix (late decision)** | Status → `wontfix`; **move file** to `archive/` | Investigation revealed the fix isn't worth the cost or invalidates a constraint |
| **Cannot reproduce (re-evaluated)** | Status → `cannot-reproduce`; **move file** to `archive/` | Work started, repro never re-surfaced, abandoning |

For **Mark fixed** and **Verify and close**, continue to Steps 5–6. For trash outcomes, jump to Step 7 (with rationale captured in `## Resolution`).

### Step 5: Gather Root Cause Analysis

If `## Root Cause Analysis` is empty or still contains the templated placeholder line, prompt for it.

Use `AskUserQuestion` free-text:

> One paragraph: what was the underlying defect? Why did the symptom occur? Avoid restating the symptom — explain the *cause*.

Edit the bug file to replace the placeholder line under `## Root Cause Analysis` with the user's text. Remove the `> Filled in during or after the fix — not on report.` quote line.

### Step 6: Gather Resolution Fields

Use `AskUserQuestion` (batched where the UI permits):

| Field | Form | Required for `verified`? |
|-------|------|--------------------------|
| Fix commit | Short SHA (or "see PR") | **Yes** |
| Fix version | Release tag or `—` | No |
| Linked PR | `#NNN` or full URL or `—` | No (recommended) |
| Linked task | `[[TASK-NNN]]` or `—` | No |
| **Regression test** | Path to an automated test that fails-before / passes-after, **or** path to a UAT entry that exercises the fix | **Yes** |

For **Verify and close**, both required fields must be supplied. If the user cannot name a regression test, STOP and tell them:

> Cannot close `BUG-NNNN` — every close requires a regression test path (automated test or UAT entry). If automation is infeasible, add a manual check to a UAT file and link it here.

For **Mark fixed**, the commit is required; the regression test can wait until verification.

Edit the bug file to populate the `## Resolution` table with the gathered values, removing the `> Filled in on close.` quote line.

### Step 7: Move the File

Update `Status:` and `Last updated:` in the bug file via `Edit` before moving.

| Outcome | Action |
|---------|--------|
| Verify and close | Archive-move sequence (see below) with status `verified` |
| Mark fixed | No move |
| Won't fix / Cannot reproduce | Archive-move sequence (see below) with the appropriate status |

**Archive-move sequence** (for all terminal outcomes — `Bash` only for `git mv`):

1. `Bash`: `git mv wiki/work/bugs/NNNN-slug.md wiki/work/bugs/archive/NNNN-slug.md`
2. `Edit`: remove the bug's row from `wiki/work/bugs/index.md`
3. `Edit`: append to `wiki/work/bugs/archive/index.md`: `| [[BUG-NNNN]] | <title> | <status> | YYYY-MM-DD |`
4. `Edit`: append to `wiki/log.md`

### Step 8: Update the Bug Index

For all terminal outcomes (`verified`, `wontfix`, `cannot-reproduce`), the archive-move sequence in Step 7 already removes the active index row and appends to `archive/index.md`. No further index edits are needed for those outcomes.

For `fixed` (no move): find the row for this bug in `wiki/work/bugs/index.md` and update the `Status` column to `fixed`.

Use **`Edit`** — one targeted call. Never `sed`, `awk`, `perl -i`, or `echo >>`.

### Step 9: Cross-Linking

- If a `Linked task` was provided in `[[TASK-NNN]]` format: resolve the task file using `mcp__serena__find_file` with pattern `TASK-NNN-*` searching `wiki/work/tasks/` (finds active or archived). Then open the task file and append `- Closes BUG-NNNN` to its footer (after the existing UAT link section, or under a new `**Closes**:` line). Use `Edit`.
- If a `Linked PR` was provided and PR is open: remind the user to add `Closes BUG-NNNN` to the PR description so GitHub auto-references the bug record.

### Step 10: Report Completion

Print:
- Bug ID, title
- Old status → new status; folder move (if any)
- Resolution summary: fix commit, regression test path
- For `verified`: a one-line clustering check — search `wiki/work/bugs/archive/` for the last 3 closes with overlapping `Tags` and surface them as "related recent closes" so the user can spot systemic issues.
- For `fixed`: remind the user to re-run `/bug-close` once verification lands.
