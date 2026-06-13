---
name: uat-skip
description: Skip UAT for a task — sets UAT and task status to skipped/done, removes index rows, auto-checkoffs roadmap
category: planning
model: claude-haiku-4-5-20251001
argument-hint: <TASK-NNN or path/to/task-file.md>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# UAT Skip

Skip UAT testing for a task. Sets UAT status to `skipped` (creating a skeleton if none exists), sets task status to `done`, removes both rows from their family indexes, auto-checkoffs active roadmaps, and annotates linked decisions.

No files are moved. Status lives in frontmatter.

---

**Target**: $ARGUMENTS

---

## Pipeline Context

`/uat-skip` is an escape hatch — use it when UAT testing is not needed, not applicable, or intentionally deferred for a task that has completed implementation.

---

## Step 1: Resolve the Task File

Parse `$ARGUMENTS` to locate the task file in `wiki/work/tasks/`:

1. **TASK-NNN** or **TASK-NNN-slug** — use Serena `find_file` to locate `TASK-NNN*.md` inside `wiki/work/tasks/`. Task files never move; there are no subdirectories to check.
2. **Full path** — confirm the file exists with `find_file`. If it does not exist, STOP and report the error.
3. **Ambiguous / description only** — list matches and ask the user to clarify.

Read the task file. Extract:
- `id:` frontmatter field (e.g. `TASK-007`)
- `uat:` frontmatter field (path to linked UAT file, if any)
- `title:` frontmatter field
- Any `implements::` decision reference in the body

---

## Step 2: Find or Create the UAT File

**If a UAT file is linked** (`uat:` frontmatter exists):
- Read `wiki/work/uat/<UAT-NNN-slug>.md`.
- The file will have its status set to `skipped` in Step 3.

**If no UAT file exists:**
- Determine the next UAT-NNN by reading `wiki/work/uat/index.md` (highest existing NNN + 1).
- Derive the slug from the task title (lowercase, hyphens, strip special chars).
- Create `wiki/work/uat/UAT-NNN-slug.md` using this skeleton:

```markdown
---
id: UAT-NNN
title: "UAT: <Task Title> (Skipped)"
task: <task-file-path>
status: skipped
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# UAT: <Task Title> (Skipped)

> **Source task**: [[<TASK-NNN>]]
> **Skipped**: YYYY-MM-DD
> **Reason**: UAT intentionally skipped via /uat-skip — no tests generated

---

This task's UAT was intentionally skipped. No test cases were generated or executed.
```

- Add a row to `wiki/work/uat/index.md`:
  `| UAT-NNN | <title> | skipped | <TASK-NNN> |`

---

## Step 3: Status-Flip Procedure

Apply the STATUS-FLIP PROCEDURE to both artifacts:

**UAT file** (`wiki/work/uat/UAT-NNN-slug.md`):
1. Edit `status: pending` (or whatever current status) → `status: skipped`
2. Edit `updated:` → today's date
3. Remove the UAT's row from `wiki/work/uat/index.md` (skipped UATs are not active)

**Task file** (`wiki/work/tasks/TASK-NNN-slug.md`):
1. Edit `status: todo` or `status: in-progress` → `status: done`
2. Edit `updated:` → today's date
3. Remove the task's row from `wiki/work/tasks/index.md` (done tasks are not active)

Use the `Edit` tool for all frontmatter changes. Never use `sed`, `awk`, or shell redirection.

---

## Step 4: Roadmap Auto-Checkoff

Scan every active roadmap (files in `wiki/work/roadmaps/` whose `status: active` frontmatter):

1. Use Serena `list_dir` on `wiki/work/roadmaps/` (exclude `lifecycle.md` and `index.md`).
2. Read each file. Look for lines matching `- [ ] ...TASK-NNN...` (task link or inline reference).
3. For each match, `Edit` `- [ ]` → `- [x]` **and** update `updated:` in that roadmap's frontmatter to today.
4. **Phase sweep**: after flipping this task's line, scan other `- [ ] [TASK-NNN` lines in the same `## Phase` block. For each, check if that task's `status:` is `done`. If yes, flip `- [ ]` → `- [x]`.
5. **Roadmap completion check**: if ALL checkboxes in the roadmap are now `[x]`, flip the roadmap's `status: active` → `status: done` and `updated:` → today, then remove the roadmap's row from `wiki/work/roadmaps/index.md`.
6. Silent no-op if no roadmap references this task.

---

## Step 5: Decision Annotation

Check the task body for a typed link `implements::[[DEC-NNNN#DM]]` or similar decision reference:

- If found, locate the decision file in `wiki/work/decisions/`.
- Search the decision file for any `Source task(s):` line referencing this task.
- If found, append ` — done (UAT skipped) YYYY-MM-DD` to that line.
- Use Serena `search_for_pattern` on `wiki/work/decisions/` for the task ID to catch any reference pattern.
- If not found: skip silently.

---

## Step 6: Log Entry

Append to `wiki/log.md`:

```markdown
## [YYYY-MM-DD] uat | UAT-NNN skipped → TASK-NNN done

UAT skipped for <task title>. Task marked done. <Optional: reason if user provided one.>
```

Use the `Edit` tool (append at end of file).

---

## Step 7: Report Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAT SKIP COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task:   TASK-NNN → status: done (removed from tasks/index.md)
UAT:    UAT-NNN → status: skipped (removed from uat/index.md)
        (or: Skeleton UAT-NNN created in wiki/work/uat/)

Roadmaps updated: [list or "None"]
Decisions updated: [list or "None"]
Log entry appended.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
