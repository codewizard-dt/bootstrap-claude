---
name: bug-triage
description: Triage an open bug — set priority/assignee/tags/impact, then keep it in .docs/bugs/, advance it to in-progress/, or delete it (wontfix/duplicate/cannot-reproduce)
model: claude-sonnet-4-6
argument-hint: <BUG-NNNN, path, or number-slug>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/bug-lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Triage Bug

Walk an existing bug through triage: confirm reproducibility, assign priority/assignee/tags, document impact, then decide the next destination. This is the **only** skill that moves a bug out of the `.docs/bugs/` root.

---

**Input**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the Bug File

Parse `$ARGUMENTS` to find the bug. Accepted forms:
- `BUG-NNNN` (e.g. `BUG-0042`)
- `NNNN` (e.g. `0042` or `42`)
- `NNNN-slug` (e.g. `0042-csv-export`)
- Full path (e.g. `.docs/bugs/0042-csv-export.md`)

Resolution order:
1. If full path: confirm with `mcp__serena__list_dir`.
2. Otherwise normalize to a 4-digit `NNNN-*.md` pattern and search `.docs/bugs/` first via `mcp__serena__find_file`.
3. If not in `.docs/bugs/`, search `in-progress/` and `closed/`.
4. If found outside `.docs/bugs/` root, STOP and tell the user the triage state. A bug in `in-progress/` or `closed/` cannot be re-triaged via this skill — they re-open it manually (move file back to `.docs/bugs/` and flip `Status: new`) or use `/bug-close` if appropriate.
5. If not found anywhere, STOP and report the error.

Read the bug file in full.

### Step 2: Read the Spec

Read `.docs/bugs/README.md` and `.docs/guides/bug-lifecycle.md` for the rubrics and the state-transition gates.

### Step 3: Audit Required-on-Report Fields

Before triaging, every required-on-report field from `/bug-file` must be present and non-templated. Re-check:

- Severity, Reporter, Reported date
- Environment (all four sub-fields filled with real values, not `<…>` placeholders)
- Steps to Reproduce (numbered, deterministic enough for another engineer)
- Expected Behavior, Actual Behavior
- Reproducibility (`always` / `sometimes` / `rarely` / `once` + dates)

If any field is missing or still has the templated placeholder, list them and ask the user to fill them in now via `AskUserQuestion`. Update the file before proceeding.

### Step 4: Gather Triage Fields

For each triage field, use `AskUserQuestion`:

| Field | Question form |
|-------|---------------|
| Priority | Single-select: `P0` / `P1` / `P2` / `P3` — show the rubric from `.docs/bugs/README.md` |
| Severity (confirm) | Re-confirm or revise the reporter-set severity now that you have more info |
| Assignee | Free-text (name or role); offer `—` for backlog |
| Tags | Free-text comma-separated areas (e.g. `auth, frontend`) |
| Impact | Free-text — who is affected, how many, what does it block; cite metrics/tickets if available |
| Workaround | Free-text; `None known` is a valid answer |

### Step 5: Decide the Next Destination

Use `AskUserQuestion` (single-select) to pick the outcome:

| Choice | Effect | When to pick |
|--------|--------|--------------|
| **Stay triaged** (default) | Status `new` → `triaged`; file stays in `.docs/bugs/` | Backlog or scheduled for a later iteration |
| **Start work now** | Status → `in-progress`; **move file** `.docs/bugs/` → `in-progress/` | Assignee is starting immediately |
| **Won't fix** | Status → `wontfix`; **delete file** | Deliberate decision not to fix; capture the rationale + decider in `## Resolution` |
| **Duplicate** | Status → `duplicate`; **delete file** | Require user to name the canonical `BUG-NNNN`; record it under `## Related → Duplicate of:` |
| **Cannot reproduce** | Status → `cannot-reproduce`; **delete file** | Only after a documented reproduction attempt; log what was tried in `## Resolution` |

For the trash outcomes (`wontfix`, `duplicate`, `cannot-reproduce`), require the supporting field before moving the file. If absent, ask now and refuse to proceed until filled.

### Step 6: Apply Updates

1. **Edit the bug file** (use `Edit`, never `sed`/`echo`):
   - Update `Status:` to the new fine status.
   - Set `Priority`, `Assignee`, `Tags`, `Impact`, `Workaround` as gathered.
   - For trash outcomes, fill the required field(s) in `## Resolution` or `## Related` per the table above.
   - Update `Last updated: YYYY-MM-DD` to today.

2. **Move or delete the file** if the outcome requires it:
   - `Start work now`: `git mv .docs/bugs/NNNN-slug.md .docs/bugs/in-progress/` (fall back to `mv` if `git mv` fails)
   - Trash outcomes: `git rm .docs/bugs/NNNN-slug.md` (fall back to `rm` if `git rm` fails)
   - `Stay triaged`: no move.

### Step 7: Update the Bug Index

In `.docs/bugs/README.md`, update the row for this bug:

- `Status` column → new fine status
- `Priority`, `Assignee` columns → gathered values
- Folder path in the `[BUG-NNNN](...)` link → reflect the new location (e.g. `in-progress/NNNN-slug.md`) if moved; strip folder prefix when file stays at root
- `Closed` column → today's date only for `wontfix` / `duplicate` / `cannot-reproduce`; otherwise leave `—`
- For trash outcomes: **remove the entire row** from the index — the file is deleted, not relocated

Use **`Edit`** — one targeted call.

### Step 8: Cross-Linking

- If the user chose **Duplicate**: open the canonical bug file (search all four folders) and append a line to its `## Related → Related bugs:` listing this bug ID. Use `Edit`.
- If the user chose **Start work now**: ask whether to spawn a fix task via `/task-add`. If yes, suggest the command — do not invoke it automatically.

### Step 9: Report Completion

Print:
- Bug ID, title
- Old status → new status; folder move (if any)
- Index row updated
- Suggested next step:
  - `Stay triaged` / `Start work now` → `/bug-close BUG-NNNN` when the fix is merged and verified
  - Trash outcomes → terminal; file is deleted (unrecoverable except via git history)
