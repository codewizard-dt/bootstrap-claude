---
name: close-bug
description: Close an in-progress bug — record root cause and resolution, require a regression test, then move it to closed/ (or to trashed/ for late wontfix decisions)
model: claude-sonnet-4-6
argument-hint: <BUG-NNNN, path, or number-slug>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/bug-lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Close Bug

Finalize a bug that has been fixed. Records the root cause, the resolution (commit, PR, regression test), and moves the file to `.docs/bugs/closed/`. Refuses to close without a regression test — silent closes are the worst-case anti-pattern.

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
2. Otherwise normalize and search `.docs/bugs/in-progress/` first via `mcp__serena__find_file`.
3. If found in `open/`: STOP and tell the user the bug must be triaged and worked first — `/triage-bug` → choose "Start work now" → land a fix → re-run `/close-bug`.
4. If found in `closed/` or `trashed/`: STOP — already terminal.
5. If not found anywhere: STOP and report the error.

Read the bug file in full.

### Step 2: Read the Spec

Read `.docs/bugs/README.md` and `.docs/guides/bug-lifecycle.md` for the close-gate requirements (Root Cause Analysis, Resolution block with commit + regression test).

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
| **Verify and close** (default) | Status → `verified`; **move file** `in-progress/` → `closed/` | A fix has been merged and validated |
| **Mark fixed (not yet verified)** | Status → `fixed`; file stays in `in-progress/` | Patch landed but waiting on UAT or staging soak |
| **Won't fix (late decision)** | Status → `wontfix`; **move file** → `trashed/` | Investigation revealed the fix isn't worth the cost or invalidates a constraint |
| **Cannot reproduce (re-evaluated)** | Status → `cannot-reproduce`; **move file** → `trashed/` | Work started, repro never re-surfaced, abandoning |

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
| Linked task | `.docs/tasks/...` path or `—` | No |
| **Regression test** | Path to an automated test that fails-before / passes-after, **or** path to a UAT entry that exercises the fix | **Yes** |

For **Verify and close**, both required fields must be supplied. If the user cannot name a regression test, STOP and tell them:

> Cannot close `BUG-NNNN` — every close requires a regression test path (automated test or UAT entry). If automation is infeasible, add a manual check to a UAT file and link it here.

For **Mark fixed**, the commit is required; the regression test can wait until verification.

Edit the bug file to populate the `## Resolution` table with the gathered values, removing the `> Filled in on close.` quote line.

### Step 7: Move the File

| Outcome | Move |
|---------|------|
| Verify and close | `git mv .docs/bugs/in-progress/NNNN-slug.md .docs/bugs/closed/` |
| Mark fixed | No move |
| Trash outcomes | `git mv .docs/bugs/in-progress/NNNN-slug.md .docs/bugs/trashed/` |

Fall back to `mv` if `git mv` fails. Update `Status:` and `Last updated:` in the file via `Edit`.

### Step 8: Update the Bug Index

In `.docs/bugs/README.md`, update the row for this bug:

- `Status` column → new fine status
- Folder path in the `[BUG-NNNN](...)` link → new location (if moved)
- `Closed` column → today's `YYYY-MM-DD` for any terminal state (`verified`, `wontfix`, `cannot-reproduce`); leave `—` for `fixed`

Use **`Edit`** — one targeted call. Never `sed`, `awk`, `perl -i`, or `echo >>`.

### Step 9: Cross-Linking

- If a `Linked task` was provided: open the task file and append `- Closes BUG-NNNN` to its footer (after the existing UAT link section, or under a new `**Closes**:` line). Use `Edit`.
- If a `Linked PR` was provided and PR is open: remind the user to add `Closes BUG-NNNN` to the PR description so GitHub auto-references the bug record.

### Step 10: Report Completion

Print:
- Bug ID, title
- Old status → new status; folder move (if any)
- Resolution summary: fix commit, regression test path
- For `verified`: a one-line clustering check — search `.docs/bugs/closed/` for the last 3 closes with overlapping `Tags` and surface them as "related recent closes" so the user can spot systemic issues.
- For `fixed`: remind the user to re-run `/close-bug` once verification lands.
