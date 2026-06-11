---
name: bug-triage
description: Triage an open bug — set priority/assignee/tags/impact, then keep it in wiki/work/bugs/, advance it to in-progress, or reject it (wontfix/duplicate/cannot-reproduce)
model: claude-sonnet-4-6
argument-hint: <BUG-NNNN, path, or number-slug>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Triage Bug

Walk an existing bug through triage: confirm reproducibility, assign priority/assignee/tags, document impact, then decide the outcome. Files are **never moved or deleted** — state lives entirely in the `status:` frontmatter field.

---

**Input**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the Bug File

Parse `$ARGUMENTS` to find the bug. Accepted forms:
- `BUG-NNNN` (e.g. `BUG-0042`)
- `NNNN` (e.g. `0042` or `42`)
- `NNNN-slug` (e.g. `0042-csv-export`)
- Full path (e.g. `wiki/work/bugs/BUG-0042-csv-export.md`)

Resolution order:
1. If full path: confirm with `mcp__serena__find_file`.
2. Otherwise normalize to a `BUG-NNNN*` pattern and search `wiki/work/bugs/` via `mcp__serena__find_file`.
3. If not found, STOP and report the error.

Read the bug file in full.

### Step 2: Re-triage Guard

Check the `status:` frontmatter field.

- If `status: open` or `status: triaged` → proceed.
- Any other status (`in-progress`, `closed`, `wontfix`, `duplicate`, `cannot-reproduce`) → STOP and tell the user: "BUG-NNNN has status `<status>` and cannot be re-triaged via this skill."

### Step 3: Audit Required-on-Report Fields

Before triaging, every required-on-report field must be present and non-templated:

- Severity, Reporter, Reported date
- Environment (all sub-fields filled with real values, not `<…>` placeholders)
- Steps to Reproduce (numbered, deterministic enough for another engineer)
- Expected Behavior, Actual Behavior
- Reproducibility (`always` / `sometimes` / `rarely` / `once` + dates)

If any field is missing or still has a templated placeholder, list them and ask the user to fill them in via `AskUserQuestion`. Update the file with `Edit` before proceeding.

### Step 4: Gather Triage Fields

For each triage field, use `AskUserQuestion`:

| Field | Question form |
|-------|---------------|
| Priority | Single-select: `P0` / `P1` / `P2` / `P3` |
| Severity (confirm) | Re-confirm or revise the reporter-set severity |
| Assignee | Free-text (name or role); `—` for backlog |
| Tags | Free-text comma-separated areas (e.g. `auth, frontend`) |
| Impact | Free-text — who is affected, how many, what does it block |
| Workaround | Free-text; `None known` is a valid answer |

### Step 5: Decide the Outcome

Use `AskUserQuestion` (single-select) to pick one of three outcomes:

| Choice | Status flip | Index row | When to pick |
|--------|-------------|-----------|--------------|
| **Start work now** | `open`/`triaged` → `in-progress` | STAYS — update status text | Assignee is starting immediately |
| **Defer / keep triaged** | `open` → `triaged` | STAYS — update status text | Backlog or scheduled for a later iteration |
| **Reject** (wontfix / duplicate / cannot-reproduce) | → `wontfix` \| `duplicate` \| `cannot-reproduce` | REMOVE row | Deliberate rejection decision |

For reject outcomes, require supporting information before proceeding:
- `wontfix` → rationale + decider captured in `## Resolution`
- `duplicate` → canonical `BUG-NNNN` recorded under `## Related → Duplicate of:`
- `cannot-reproduce` → what was attempted, logged in `## Resolution`

If the required field is absent, ask via `AskUserQuestion` and refuse to proceed until filled.

### Step 6: Apply Updates

Edit the bug file using `Edit` (never `sed`/`echo`/`awk`):

1. Flip `status:` to the new value.
2. Set `priority:`, `assignee:`, `tags:`, `impact:`, `workaround:` as gathered.
3. For reject outcomes, fill the required field(s) in `## Resolution` or `## Related`.
4. Bump `updated:` to today's date (`YYYY-MM-DD`).

**Do NOT move or delete the file.** The file lives at `wiki/work/bugs/BUG-NNNN-slug.md` permanently, regardless of outcome.

### Step 7: Update the Bug Index

Read `wiki/work/bugs/index.md`. Apply changes with `Edit`:

- **Start work / Defer**: find the row for this bug and update the `Status` column text.
- **Reject**: remove the entire row from the index. The file is preserved on disk — only the index row is removed.

### Step 8: Cross-Linking

- If outcome is **Duplicate**: open the canonical bug file and append a line to its `## Related → Related bugs:` section listing this bug ID. Use `Edit`.
- If outcome is **Start work now**: ask whether to spawn a fix task via `/task-add`. If yes, suggest the command — do not invoke it automatically.

### Step 9: Append Log Entry

Append to `wiki/log.md`:

```
## [YYYY-MM-DD] bug-triage | BUG-NNNN <title>
Triaged: status → <new-status>. <one sentence summary of decision>.
```

Use `Edit` (append to end of file).

### Step 10: Report Completion

Print:
- Bug ID and title
- Old status → new status
- Index row action (updated / removed)
- Suggested next step:
  - Start work / Defer → `/bug-close BUG-NNNN` when the fix is merged and verified
  - Reject outcomes → terminal; file preserved forever at `wiki/work/bugs/BUG-NNNN-slug.md` (recoverable via `Read` or git history)
