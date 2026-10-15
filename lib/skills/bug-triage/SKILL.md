---
name: bug-triage
description: Triage an open bug — set priority/assignee/tags/impact, then keep it in wiki/work/bugs/, advance it to in-progress, or reject it (wontfix/duplicate/cannot-reproduce) and archive it
category: planning
model: claude-sonnet-5
argument-hint: <BUG-NNNN, path, or number-slug>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# Triage Bug

Walk an existing bug through triage: confirm reproducibility, assign priority/assignee/tags, document impact, then decide the outcome. For active outcomes (triaged, in-progress) the file stays in `wiki/work/bugs/`. For terminal reject outcomes (wontfix, duplicate, cannot-reproduce) the file is moved to `wiki/work/bugs/archive/`.

---

**Input**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the Bug File

Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: bugs · scope: active · ambiguous: interactive · empty: not found → STOP and report the error

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

Edit the bug file (Edit only — see `~/.claude/skills/_shared/SKILL-BOILERPLATE.md` § Edit hygiene):

1. Flip `status:` to the new value.
2. Set `priority:`, `assignee:`, `tags:`, `impact:`, `workaround:` as gathered.
3. For reject outcomes, fill the required field(s) in `## Resolution` or `## Related`.
4. Bump `updated:` to today's date (`YYYY-MM-DD`).

### Step 7: Update the Bug Index

Read `wiki/work/bugs/index.md`. Apply changes with `Edit`:

- **Start work / Defer**: find the row for this bug and update the `Status` column text. Do not move the file.
- **Reject**: the active-index row removal is performed by Step 7a.

#### Step 7a: Archive-Move for Reject Outcomes

For `wontfix`, `duplicate`, and `cannot-reproduce` outcomes only. Read `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` now, then run its Procedure: `family: bugs`, `terminal_status: <wontfix|duplicate|cannot-reproduce>`, `log: skip` — Step 9 writes the single log entry. Step 6 has already flipped the status (the bug file needed its `## Resolution`/`## Related` edits before the move), so the procedure's status flip is a no-op.

For active outcomes (Start work / Defer), skip this step entirely — the file stays at `wiki/work/bugs/NNNN-slug.md`.

### Step 8: Cross-Linking

- If outcome is **Duplicate**: open the canonical bug file and append a line to its `## Related → Related bugs:` section listing this bug ID. Use `Edit`.
- If outcome is **Start work now**: ask whether to spawn a fix task via `/task-create`. If yes, suggest the command — do not invoke it automatically.

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
- File location (unchanged for active outcomes; moved to `archive/` for reject outcomes)
- Suggested next step:
  - Start work / Defer → `/bug-close BUG-NNNN` when the fix is merged and verified
  - Reject outcomes → terminal; file archived at `wiki/work/bugs/archive/BUG-NNNN-slug.md` (recoverable via git history)
