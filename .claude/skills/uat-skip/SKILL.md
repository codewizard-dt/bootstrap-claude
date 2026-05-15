---
name: uat-skip
description: Skip UAT for a task, moving it to completed and archiving a skeleton UAT in skipped
model: claude-sonnet-4-6
argument-hint: <path/to/task-file.md or task number-slug>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/task-lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# UAT Skip

Skip UAT testing for a task, marking it as completed and moving (or creating) a UAT file in `.docs/uat/skipped/`.

---

**Target**: $ARGUMENTS

---

## Pipeline Context

This command is part of the task lifecycle: `/task-add` → `/tackle` → `/uat-generate` → `/uat-walk`

`/uat-skip` is an **escape hatch** — use it when UAT testing is not needed, not applicable, or intentionally deferred for a task that has completed implementation.

---

## Instructions

### Step 1: Resolve the Task File

Parse `$ARGUMENTS` to locate the task file:

1. **If a file path is provided** (e.g., `.docs/tasks/3-user-auth.md`):
   - Confirm the file exists (use Serena `find_file` or `list_dir`)
   - If the file does not exist, STOP and report the error

2. **If a number-slug is provided** (e.g., `3-user-auth`):
   - Use Serena find_file or list_dir `.docs/tasks/` for `<number-slug>.md`
   - If not found, also check `.docs/tasks/` as a fallback
   - If still not found, STOP and report the error

3. **If only a description or number is provided**:
   - Use Serena list_dir `.docs/tasks/` for a matching task file
   - Search `.docs/tasks/` for a matching task file
   - If ambiguous, list matches and ask the user to clarify

4. Extract the task's **number-slug identifier** (e.g., `3-user-auth` from `3-user-auth.md`)

5. **Validate location**: The task file should be in `.docs/tasks/`.

### Step 2: Find or Create the UAT File

Using the task's number-slug identifier:

1. **Check for an existing UAT file** in `.docs/uat/` → `<number>-<slug>.uat.md`
2. Also check `.docs/uat/completed/` in case it was already completed (warn if found there)

**If a UAT file exists in `.docs/uat/`:**
- It will be moved to `.docs/uat/skipped/` in Step 4

**If no UAT file exists:**
- A skeleton UAT file will be created in `.docs/uat/skipped/` to document the intentional skip. Use this template:

```markdown
# UAT: [Feature Name] (Skipped)

> **Source task**: [`.docs/tasks/completed/<number>-<slug>.md`](../../tasks/completed/<number>-<slug>.md)
> **Skipped**: YYYY-MM-DD
> **Reason**: UAT intentionally skipped — no tests generated

---

## Status

This task's UAT was intentionally skipped via `/uat-skip`. No test cases were generated or executed.
```

### Step 3: Confirm with the User

Before moving anything, present a summary and ask for confirmation inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAT SKIP — Confirm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task:  .docs/tasks/<number>-<slug>.md → .docs/tasks/completed/
UAT:   .docs/uat/<slug>.uat.md → .docs/uat/skipped/
       (or: No existing UAT — skeleton will be created in skipped/)

Proceed? (Yes/No)
```

If the user says **No**, STOP.

### Step 4: Move and Create Files

1. **Ensure target directories exist**:
   - `.docs/uat/skipped/` — create if it does not exist
   - `.docs/tasks/completed/` — should already exist

2. **Move the task file** to completed:
   - `git mv .docs/tasks/<number>-<slug>.md .docs/tasks/completed/<number>-<slug>.md`
   - Fall back to `mv` if `git mv` fails

3. **Handle the UAT file**:
   - **If UAT exists in `.docs/uat/`**: `git mv .docs/uat/<number>-<slug>.uat.md .docs/uat/skipped/<number>-<slug>.uat.md` (fall back to `mv`)
   - **If no UAT exists**: Create the skeleton file directly in `.docs/uat/skipped/<number>-<slug>.uat.md` using the template from Step 2

### Step 5: Update References

1. **Update the task file** (now in `completed/`) using the **`Edit`** tool. **Never** use `sed`, `echo >>`, or any other shell command for these edits. See `.docs/guides/mcp-tools.md` "Common anti-patterns".
   - If it contains a UAT reference pointing to `pending/`, `Edit` to update the path to `skipped/`
   - If it has no UAT reference, `Read` the file then `Edit` to append:
     ```markdown
     ---
     **UAT**: [`.docs/uat/skipped/<number>-<slug>.uat.md`](../../uat/skipped/<number>-<slug>.uat.md) *(skipped)*
     ```

2. **Update the UAT file** (now in `skipped/`):
   - If the `Source task` link points to `active/`, update it to `completed/`

3. **Search for other references** using Serena's `search_for_pattern`:
   - Look for references to the old task path (`active/<number>-<slug>.md`) across `.docs/`
   - Update any found references to the new `completed/` path

3a. **Update `.docs/tasks/README.md`** — remove this task's row from the Active Tasks table entirely. The index lists active tasks only; completed/skipped tasks are tracked by their presence in `.docs/tasks/completed/` and do **not** belong in the index. Use a single `Edit` call — never `sed`. **Also check the header**: if the **Last task:** line at the top of the README references this task's `NNN-slug.md`, `Edit` it to point at `completed/NNN-slug.md` instead. Do **not** decrement **Next task number** — it only ever goes up. The index is `/tackle`'s no-args survey source.

3b. **Roadmap Auto-Checkoff** — scan `.docs/roadmaps/` and `.docs/roadmaps/completed/` for any roadmap referencing this task and flip its matching checkbox. Follow the canonical algorithm in [`.docs/roadmaps/README.md#auto-checkoff-contract`](../../../.docs/roadmaps/README.md). Short form: (i) `mcp__serena__list_dir` on `.docs/roadmaps/` (skip `README.md`) and on `.docs/roadmaps/completed/`; (ii) `Read` each roadmap and look for lines matching `- [ ] [TASK-<NNN>:` whose link path ends in `<NNN>-<slug>.md` (either at `.docs/tasks/` or `completed/`); (iii) `Edit` each matching line in **one** call that **both** flips `- [ ]` → `- [x]` **and** rewrites the link path to the task's new location (e.g. `../tasks/NNN-slug.md` → `../tasks/completed/NNN-slug.md`) — use the full line text as `old_string` for uniqueness. Stale paths are **not** tolerated: if a reference exists, the path is updated. Then `Edit` the roadmap's `**Last updated**:` to today; (iv) bump the matching row's `Progress` numerator in `.docs/roadmaps/README.md`; (v) **Phase sweep** — for each roadmap where a match was found, identify the `## Phase N:` block containing that matched item and scan all other `- [ ] [TASK-NNN:` lines in that same phase; for each, use `mcp__serena__find_file` to check if `NNN-slug.md` exists under `.docs/tasks/completed/`; if it does, `Edit` that line in one call to flip `- [ ]` → `- [x]` and rewrite the link path to `../tasks/completed/NNN-slug.md`, then bump `Progress` in the index for each additional item; (vi) **Inline item sweep** — across the entire roadmap (not limited to the phase block that contains the task reference), collect every remaining `- [ ]` line whose body is free-form text (not a `[TASK-NNN:` link); `Read` the completing task file; use judgment to decide whether each inline item was accomplished by the completing task's work; if yes, `Edit` `- [ ]` → `- [x]` and bump `Progress` in the index; if uncertain, leave the item unchecked — err on the side of leaving items unchecked rather than over-checking. Silent no-op if no roadmap references the task. **Do NOT** auto-flip `Status: active` → `Status: done` even on the last box — that flip is manual. Use `Edit` only — never `sed`, `bash`, or `Write`.

4. **Check for ADR linkage**: Read the moved task file (now in `completed/`) for a line matching `**Implements**: ADR-NNNN#DM`:
   - If found:
     1. Parse the `ADR-NNNN#DM` reference.
     2. Locate the ADR file using Serena `mcp__serena__find_file` for `NNNN-*.md` in `.docs/adr/`.
     3. Use Serena `mcp__serena__search_for_pattern` on `.docs/tasks/` for the same `**Implements**: ADR-NNNN#DM` pattern to check for remaining WIP tasks.
     4. **If no other WIP tasks remain** (last or only task for this decision):
        - **Single-task**: replace `Source task(s): .docs/tasks/...` line with `Source task(s): .docs/tasks/completed/NNN-slug.md — **implemented (UAT skipped)** YYYY-MM-DD`
        - **Multi-task**: update this task's sub-line to `**done (UAT skipped)** YYYY-MM-DD`; append `- **Decision fully implemented (UAT skipped for some tasks)** YYYY-MM-DD` after the last sub-line
     5. **If other WIP tasks remain**: update only this task's sub-line to `**done (UAT skipped)** YYYY-MM-DD`
     6. **ADR inline checkbox sweep** — `Read` the full `## DM.` decision block in the ADR file (the H2 block whose identifier matches the `DM` from the `**Implements**:` reference); collect every remaining `- [ ]` line in that block; `Read` the completing task file; for each `- [ ]` item, use judgment to decide whether the completing task accomplished it; if yes, `Edit` `- [ ]` → `- [x]`; if uncertain, leave the item unchecked — err on the side of leaving items unchecked rather than over-checking. This sweep runs regardless of whether steps 4 or 5 applied. Use `Edit` only — never `sed`, `bash`, or `Write`.
     - Use `Read` then `Edit` — never `sed`, `echo >>`, or shell redirection
   - If not found: skip silently

### Step 6: Delete Related Screenshots

If any screenshots exist for this task in `.docs/uat/screenshots/`:
- Delete them: `git rm .docs/uat/screenshots/<task-number>-*` (fall back to `rm` if `git rm` fails)
- If no screenshots exist, skip silently

### Step 7: Report Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAT SKIP COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task:  .docs/tasks/<number>-<slug>.md → .docs/tasks/completed/<number>-<slug>.md
UAT:   .docs/uat/<slug>.uat.md → .docs/uat/skipped/<slug>.uat.md
       (or: Skeleton created at .docs/uat/skipped/<slug>.uat.md)

References updated: [list files modified]
Screenshots deleted: [count or "None"]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Directory Structure

```
.docs/tasks/
├── (active tasks live here, directly)
└── completed/        # UAT passed (or skipped), task fully complete

.docs/uat/
├── (pending UATs live here, directly)
├── completed/        # All tests passed via /uat-walk
├── skipped/          # UAT intentionally skipped via /uat-skip
└── screenshots/      # Temporary screenshots from /uat-walk
```

**Task lifecycle**: (`.docs/tasks/`) → (`/tackle`, stays in `.docs/tasks/`) → (`/uat-walk` | **`/uat-skip`**) → `completed/`

---

## Naming Convention

| Source | UAT File Path |
|--------|--------------|
| Task `.docs/tasks/3-user-auth.md` | `.docs/uat/skipped/3-user-auth.uat.md` |
| Task `.docs/tasks/12-api-refactor.md` | `.docs/uat/skipped/12-api-refactor.uat.md` |

The `<number>` prefix ensures UAT files sort alongside their tasks and are easy to cross-reference.
