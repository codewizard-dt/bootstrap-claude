---
name: bug-file
description: File a new bug report in wiki/work/bugs/ with required-on-report fields and append it to the bug index
model: claude-sonnet-4-6
argument-hint: <short bug description>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `wiki/work/bugs/lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# File Bug

Create a new bug file in `wiki/work/bugs/` with status `new`. Gather every required-on-report field before writing — a bug without reliable reproduction is a complaint, not a bug.

---

**Input**: $ARGUMENTS

---

## Instructions

### Step 1: Read the Spec

Read both files — they are the authoritative format:
1. `wiki/work/bugs/README.md` — full file template, severity/priority rubrics, glossary, and required-fields rules

### Step 2: Summarize the Reported Symptom

From `$ARGUMENTS`, extract:
- A short, symptom-focused title (not a suspected cause)
- Any reproduction steps, environment, or impact already mentioned
- Any severity hint ("crashes", "data loss", "cosmetic", etc.)

Hold these in working memory; do **not** invent details the user did not provide.

### Step 3: Gather Required Fields via Q&A

For each missing required-on-report field, use `AskUserQuestion`. Batch related questions into a single call where the UI permits. Required fields:

| Field | What to ask |
|-------|-------------|
| Title | Confirm or refine the short symptom title (if `$ARGUMENTS` was vague) |
| Severity | Single-select: `critical` / `high` / `medium` / `low` — show the rubric from `wiki/work/bugs/README.md` |
| Reporter | Name or role (default: the current user from `git config user.name`) |
| Environment | OS / Platform, Browser or Runtime, App version or commit SHA, relevant config (feature flags, locale, account type) |
| Steps to Reproduce | Numbered list — block progress if reproduction is non-deterministic without recording `Reproducibility: rarely` or `once` with notes |
| Expected Behavior | One paragraph |
| Actual Behavior | Observed output only — error messages, stack traces, console output. No speculation. Offer to capture a screenshot path in `wiki/work/uat/screenshots/` if relevant |
| Reproducibility | Single-select: `always` / `sometimes` / `rarely` / `once`; plus `First seen` and `Last seen` dates |

**Do not** ask for `Priority`, `Assignee`, `Impact`, `Workaround`, `Tags`, `Root Cause`, or `Resolution` — those belong to `/bug-triage` or `/bug-close`. Leaving them blank (or with the templated placeholder line) on initial filing is correct.

If the user cannot supply reliable Steps to Reproduce, STOP and tell them:

> Cannot file this bug yet — Steps to Reproduce are required. Capture a deterministic trigger first (a failing test, a screencast, a server log timestamp), then re-run `/bug-file`.

### Step 4: Determine the Next Bug Number

Scan **all four** bug folders to find the next available 4-digit ID:
- `mcp__serena__list_dir` on `wiki/work/bugs/`, `wiki/work/bugs/  `, `wiki/work/bugs/  `, `wiki/work/bugs/trashed/` (skip any that don't exist)
- Collect every `NNNN-` prefix; take `max + 1`; zero-pad to 4 digits.
- Also scan `wiki/work/bugs/README.md`'s Index table for any reserved IDs not yet on disk.
- Never re-use a number — IDs are immutable references.

Derive the slug from the title: lowercase, hyphen-separated, 2–5 words, ≤ 60 chars. Describe the **symptom**, not the suspected cause (e.g., `login-fails-on-safari`, not `safari-cookie-handler-bug`).

### Step 5: Present and Confirm

Before writing, present:
- Resolved filename: `wiki/work/bugs/NNNN-<slug>.md`
- Title, Severity, Reporter
- The gathered Environment, Steps, Expected, Actual, Reproducibility values

Ask the user to confirm via `AskUserQuestion` ("File this bug? Yes / Edit / Cancel"). If `Cancel`, STOP. If `Edit`, ask which field and re-prompt.

### Step 6: Write the Bug File

Use `Write` to create `wiki/work/bugs/NNNN-<slug>.md` following the **File Template** in `wiki/work/bugs/README.md` exactly. Set:

- `Status: new`
- `Priority: —` (filled in triage)
- `Assignee: —` (filled in triage)
- `Tags: —` (filled in triage)
- `Reported`: today's date (`YYYY-MM-DD`)
- `Last updated`: today's date
- Leave `Root Cause Analysis`, `Resolution`, and `Related` sections present but empty (the templated placeholder line under each `>` quote is fine)

### Step 7: Update the Bug Index

Append a row to the Index table in `wiki/work/bugs/README.md`. Insert in numeric order. Row format:

```
| [BUG-NNNN](NNNN-slug.md) | <title> | <severity> | — | new | <reporter> | — | YYYY-MM-DD | — |
```

If the Index still shows the placeholder row (`_No bugs yet — …_`), replace it with the new row.

Use **`Edit`** — one targeted call. Never `sed`, `awk`, `perl -i`, or `echo >>`. See `.docs/guides/mcp-tools.md`.

### Step 8: Report Completion

Print:
- Created file: `wiki/work/bugs/NNNN-<slug>.md`
- Bug ID: `BUG-NNNN`
- Status: `new`
- Next step:

```
To triage:  /bug-triage BUG-NNNN
```
