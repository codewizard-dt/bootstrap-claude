---
name: bug-create
description: Create a new bug report in wiki/work/bugs/ with required-on-report fields and append it to the bug index
category: planning
model: claude-sonnet-5
argument-hint: <short bug description> [--knowledge <slug>]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/bugs/lifecycle.md`; run /primer if not done this session.

# Create Bug

Create a new bug file in `wiki/work/bugs/` with status `open`. Gather every required-on-report field before writing — a bug without reliable reproduction is a complaint, not a bug.

---

**Input**: $ARGUMENTS

---

## Instructions

### Step 1: Read the Spec

Read `wiki/work/bugs/lifecycle.md` — the authoritative frontmatter schema (fields, allowed `severity` / `priority` values), status set, and close-gate/required-fields rules. The bug file's body structure and field definitions are specified inline in this skill (Steps 3–6).

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
| Severity | Single-select: `critical` / `high` / `medium` / `low` — the allowed values are defined in `wiki/work/bugs/lifecycle.md` |
| Reporter | Name or role (default: the current user from `git config user.name`) |
| Environment | OS / Platform, Browser or Runtime, App version or commit SHA, relevant config (feature flags, locale, account type) |
| Steps to Reproduce | Numbered list — block progress if reproduction is non-deterministic without recording `Reproducibility: rarely` or `once` with notes |
| Expected Behavior | One paragraph |
| Actual Behavior | Observed output only — error messages, stack traces, console output. No speculation. Offer to capture a screenshot path in `wiki/work/uat/screenshots/` if relevant |
| Reproducibility | Single-select: `always` / `sometimes` / `rarely` / `once`; plus `First seen` and `Last seen` dates |

**Do not** ask for `Priority`, `Assignee`, `Impact`, `Workaround`, `Tags`, `Linked task`, `Root Cause`, or `Resolution` — those belong to `/bug-triage` or `/bug-close`. Leaving them blank (or with the templated placeholder line) on initial filing is correct.

**Exception**: if the user mentions a task in `$ARGUMENTS`, accept it in either `TASK-NNNN` or `[[TASK-NNNN]]` form and normalize to `"[[TASK-NNNN]]"` for the `linked_task:` frontmatter field. If no task is mentioned, set `linked_task: "—"`.

**Knowledge exception** (optional, non-required): if `$ARGUMENTS` contains `--knowledge <slug>` or a bare slug matching an existing page filename (without extension) in `wiki/knowledge/concepts/` or `wiki/knowledge/sources/`, use `mcp__serena__find_file` to search for `<slug>.md` (try the slug as given, and with `.md` appended if not already present) in those two directories. **If found**: store `(knowledge_file_path, knowledge_slug)` for Step 6. **If not found**: warn the user (e.g. "Knowledge page '<slug>' not found in wiki/knowledge/concepts/ or wiki/knowledge/sources/ — continuing without a knowledge link.") and continue — never block bug filing on a missing knowledge page. If no knowledge reference was given, skip this exception entirely (no `relates_to::` line is written in Step 6).

If the user cannot supply reliable Steps to Reproduce, STOP and tell them:

> Cannot file this bug yet — Steps to Reproduce are required. Capture a deterministic trigger first (a failing test, a screencast, a server log timestamp), then re-run `/bug-create`.

### Step 4: Determine the Next Bug Number

Allocate the next ID per `~/.claude/skills/_shared/SKILL-BOILERPLATE.md` § Number allocation (family: `wiki/work/bugs/`, prefix: `BUG-`, also scan `index.md` for reserved IDs).

Derive the slug from the title: lowercase, hyphen-separated, 2–5 words, ≤ 60 chars. Describe the **symptom**, not the suspected cause (e.g., `login-fails-on-safari`, not `safari-cookie-handler-bug`).

### Step 5: Present and Confirm

Before writing, present:
- Resolved filename: `wiki/work/bugs/BUG-NNNN-<slug>.md`
- Title, Severity, Reporter
- The gathered Environment, Steps, Expected, Actual, Reproducibility values

Ask the user to confirm via `AskUserQuestion` ("File this bug? Yes / Edit / Cancel"). If `Cancel`, STOP. If `Edit`, ask which field and re-prompt.

### Step 5a: Re-verify next bug number — IMMEDIATELY before writing

Repeat § Number allocation step 6 (same family and prefix as Step 4); never call `Write` before completing it.

### Step 6: Write the Bug File

Use `Write` to create `wiki/work/bugs/BUG-NNNN-<slug>.md`, following the frontmatter schema in `wiki/work/bugs/lifecycle.md` and the field set gathered in Steps 3–5. Set:

- `Status: open`
- `Priority: —` (filled in triage)
- `Assignee: —` (filled in triage)
- `Tags: —` (filled in triage)
- `linked_task:` — `"[[TASK-NNNN]]"` if a task was mentioned (normalized from either `TASK-NNNN` or `[[TASK-NNNN]]` input); `"—"` otherwise
- `Reported`: today's date (`YYYY-MM-DD`)
- `Last updated`: today's date
- `aliases: [BUG-NNNN]` — mirrors this file's own id: field so Obsidian's wikilink resolver can find it by short ID (ROADMAP-008)
- Leave `Root Cause Analysis`, `Resolution`, and `Related` sections present but empty (the templated placeholder line under each `>` quote is fine)

**Knowledge link** (only when the Step 3 exception resolved a knowledge reference): insert `relates_to::[[<slug>]]` as a typed link directly under the `# BUG-NNNN — <title>` H1 heading, before the body prose begins. Bug files have no other typed-link line near the top, so this is a new line, not an insertion alongside an existing one:

```markdown
# BUG-NNNN — <title>

relates_to::[[<slug>]]

<body prose begins here>
```

If no knowledge reference was given or resolved, omit the line entirely — do not write an empty placeholder.

### Step 7: Update the Bug Index

Append a bullet line to `wiki/work/bugs/index.md` (active items only — a flat list, no table). Insert in numeric order. Entry format (documented at the top of `index.md`):

```
- [BUG-NNNN — <title>](BUG-NNNN-slug.md) — <one-line summary> · <status> · <priority>
```

`<status>` is the status you set in Step 6; `<priority>` is `—` until triage. If the index still shows the placeholder line (`_(none yet)_`), replace it with the new line.

Use one targeted `Edit` call. Edit only — see `~/.claude/skills/_shared/SKILL-BOILERPLATE.md` § Edit hygiene.

### Step 8: Report Completion

Print:
- Created file: `wiki/work/bugs/BUG-NNNN-<slug>.md`
- Bug ID: `BUG-NNNN`
- Status: `open`
- Next step:

```
To triage:  /bug-triage BUG-NNNN
```
