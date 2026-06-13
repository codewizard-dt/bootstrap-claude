---
name: roadmap-add
description: Append a new item (task link or inline) to an existing roadmap in wiki/work/roadmaps/, optionally under a named phase
category: planning
model: claude-haiku-4-5-20251001
argument-hint: <ROADMAP-NNN> [--phase "<name>"] [--task NNN | <task path> | <inline text>]
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Read `wiki/work/roadmaps/README.md` first — it is authoritative for item format rules and index format this skill must respect.**
**Run `/primer` first if you have not already this session.**


$ARGUMENTS

---

# Add to Roadmap

Append a new `- [ ]` checklist item to an existing roadmap file in `wiki/work/roadmaps/`. The item is either a **task-link item** (when a task file is resolvable) or an **inline item** (free-form text). The new item is placed under a named phase, or — by default — at the end of the last existing phase. The roadmap's `Last updated` field and the index `Progress` denominator in `wiki/work/roadmaps/README.md` are kept in sync.

---

## Inline Placeholders

Roadmap items fall into two categories:
- **Task-link items** — `- [ ] [TASK-NNN: <title>](../tasks/NNN-slug.md)` — backed by a real task file; can be worked on immediately with `/tackle`.
- **Inline placeholder items** — `- [ ] <free-form description>` — no task file exists yet; valid to add, but **cannot be tackled** until `/roadmap-next` automatically creates a task file for them.

When adding an inline item, include a note in the Step 8 report reminding the user that this placeholder will be upgraded to a task-link automatically when `/roadmap-next` runs.

---

## Step 1: Parse `$ARGUMENTS`

The first whitespace-separated token is the roadmap reference. Everything after it is the item spec, possibly prefixed with flags.

Detect, in order:

| Token / pattern | Meaning |
|-----------------|---------|
| `ROADMAP-NNN`, `NNN`, or `wiki/work/roadmaps/NNN-slug.md` (first token) | Roadmap reference — resolve in Step 2 |
| `--phase "<name>"` (anywhere after the first token) | Target phase name — strip from remaining args |
| `--task NNN` (anywhere after the first token) | Task-number lookup — strip from remaining args |
| `wiki/work/tasks/NNN-slug.md` or `wiki/work/tasks/  NNN-slug.md` | Task-path lookup — entire remaining args **is** the path |
| anything else | Inline item text (free-form) |

Mirror the flag-detection style used by `lib/skills/task-add/SKILL.md` (which detects `--adr` and `--prd` in similar fashion). Treat each flag as a removable token; what remains after stripping flags is either the inline text or fallback text accompanying `--task NNN`.

If `$ARGUMENTS` is empty, or the roadmap reference is missing, **stop** and ask the user via `AskUserQuestion` to supply both the roadmap ID and the item to add.

---

## Step 2: Resolve the roadmap file

Use Serena to locate the target roadmap.

| Input form | Resolution |
|------------|------------|
| Full path (e.g. `wiki/work/roadmaps/003-billing-overhaul.md`) | Use as-is. Verify the file exists with `mcp__serena__find_file` |
| `ROADMAP-NNN` (e.g. `ROADMAP-003`) | Strip prefix, then resolve as `NNN` below |
| `NNN` (e.g. `003` or `3`) | Pad to 3 digits. Use `mcp__serena__list_dir` on `wiki/work/roadmaps/` and pick the file whose name starts with `NNN-` |

If no file matches, **stop** and report the available roadmaps from `mcp__serena__list_dir` so the user can correct the reference.

If multiple files match a bare `NNN` (should not happen — numbers are unique — but defensive), use `AskUserQuestion` to disambiguate.

---

## Step 3: If the arg is a task reference, resolve the task title

Only perform this step when the remaining args after flag-stripping are either:
- A task path (`wiki/work/tasks/NNN-slug.md` or `wiki/work/tasks/  NNN-slug.md`), or
- `--task NNN` (then look up the task file).

Otherwise skip to Step 4 with the remaining text as the inline-item body.

### 3a. Locate the task file

| Input | Action |
|-------|--------|
| Task path | Verify with `mcp__serena__find_file`. If missing, see 3c |
| `--task NNN` | Pad `NNN` to 3 digits. Search `wiki/work/tasks/` first, then `wiki/work/tasks/  `. If neither has a match, see 3c |

### 3b. Extract the H1 title

`Read` the task file. The first non-empty line should look like:

```markdown
# 014: User Table Schema
```

Strip the leading `# NNN: ` prefix; the remainder is the **task title** (e.g. `User Table Schema`).

Build the item line. The link path **must** be repo-relative from the roadmap file's location — typically:

```markdown
- [ ] [TASK-NNN: <task title>](../tasks/NNN-slug.md)
```

If the task file currently lives in `completed/`, still write `../tasks/  NNN-slug.md`. (Per `wiki/work/roadmaps/README.md`, the auto-checkoff machinery tolerates stale paths — but write the *current* path on insertion.)

### 3c. Task file not found

If the task path or `--task NNN` lookup fails, use `AskUserQuestion` to ask:

> Task file not found at `<path/or/NNN>`. Append as an inline item using the remaining text, or cancel?

If the user picks **inline**, use the original free-form remainder text (excluding flags) as the inline body. If the user picks **cancel**, stop with no edits.

---

## Step 4: Determine the target phase

`Read` the resolved roadmap file.

Scan for `## Phase N: <name>` headers in order. Build a list of `(phase_number, phase_name, line_range)` triples.

| Condition | Target phase |
|-----------|--------------|
| `--phase "<name>"` was given and a phase with that exact name exists | Use that phase |
| `--phase "<name>"` was given and no matching phase exists | Create a new phase at the end of the file (see Step 5b) |
| `--phase` was **not** given and at least one phase exists | Use the **last** phase in file order |
| `--phase` was **not** given and **no** phases exist | Create `## Phase 1: Backlog` (see Step 5b) |

Phase-name matching is case-sensitive and exact on the text after `## Phase N: `. Trim surrounding whitespace before comparing.

---

## Step 5: Compose and insert the new item

The new item line is exactly one of:

```markdown
- [ ] [TASK-NNN: <title>](../tasks/NNN-slug.md)
```

(use `../tasks/  NNN-slug.md` when the task is in `completed/`)

or

```markdown
- [ ] <free-form inline text>
```

### 5a. Idempotency check

Within the target phase's line range, look for any existing line whose full text after `- [ ] ` or `- [x] ` matches the new item body exactly. If a duplicate exists, **stop** and tell the user:

> Item already present in `<phase name>`. No changes made.

Do not proceed to edits or index updates.

### 5b. Insert into an existing phase

Use `Edit` to insert the new item at the **end** of the target phase — immediately before the next `## ` header, or before any `## Notes` section, or at end of file if the target phase is the last block.

- Choose an `old_string` that is the **last existing item line** of the phase, so the `new_string` is `<old_string>\n<new item line>`.
- If the phase currently has no items (only a header and optional intent line), choose the phase's last existing line (header or intent) as `old_string` and append the new item line after a blank line.

### 5c. Create a new phase

Only when the target phase does not exist (either `--phase "<name>"` named a new phase, or no phases exist at all):

1. Determine the new phase number: `max(existing phase numbers) + 1`, or `1` if none exist.
2. Build the block:

   ```markdown

   ## Phase <N>: <phase name>

   - [ ] <new item line body>
   ```

3. Use `Edit` to insert this block:
   - **Before** any `## Notes` section if one exists (use the `## Notes` line as `old_string`, prepend the new block).
   - Otherwise at end of file (use the file's last non-empty line as `old_string`, append the new block).

Never use `Write` for a full-file rewrite. Always `Edit`.

---

## Step 6: Update the roadmap's `Last updated` field

Use `Edit` to change the `**Last updated**: YYYY-MM-DD` line to today's date. Use the date from the environment context. If the line is already today's date, skip silently.

---

## Step 7: Update the Index in `wiki/work/roadmaps/README.md`

`Read` `wiki/work/roadmaps/README.md`. Locate the Index table row whose `File` cell matches `[ROADMAP-NNN](NNN-slug.md)` for the just-edited roadmap.

The `Progress` cell is formatted `M/N`. Use `Edit` to bump the **denominator only**: `M/N` → `M/N+1`.

| Case | Action |
|------|--------|
| Row exists with `M/N` | Replace with `M/(N+1)` |
| Row missing (roadmap was never indexed) | Print a warning that the index is out of sync; do not invent a row — that is `/roadmap-create`'s job |
| Index still shows the placeholder `_No roadmaps yet — ..._` row | Print a warning; do not modify the placeholder |

---

## Step 8: Report completion

Print a single tabular summary:

| Field | Value |
|-------|-------|
| Roadmap | `<path>` |
| Phase | `<phase name>` (new or existing) |
| Item type | `task-link` or `inline (placeholder — task pending)` |
| Item body | `<the line just inserted, minus the leading "- [ ] ">` |
| Index updated | `M/N → M/N+1` (or `skipped — <reason>`) |
| Last updated | today's date |

If the added item is an inline placeholder, append this note after the table:

> **Note:** This item has no task file yet and cannot be worked on directly. Run `/roadmap-next` to automatically create a task file for it and convert it to a task-link.

---

## Anti-Patterns

| Anti-Pattern | Remedy |
|--------------|--------|
| Editing the roadmap with `sed`, `awk`, `echo >>`, or `cat <<EOF` | **Never.** Always use `Read` + `Edit`. See `.docs/guides/mcp-tools.md` |
| Using `Write` to rewrite the whole roadmap file | Use surgical `Edit` calls only |
| Inventing a task title when the task file is missing | Ask via `AskUserQuestion` whether to fall back to inline, or cancel |
| Bumping the `Progress` numerator | This skill **never** touches the numerator — that is auto-checkoff's job (`/tackle`, `/uat-walk`, `/uat-auto`, `/uat-auto-plus`, `/uat-skip`) |
| Auto-flipping `Status: active` → `done` | This skill never changes status. Only humans flip status |
| Silently duplicating an existing item | Idempotency check in Step 5a — stop with a "already present" message |
| Re-numbering existing phases when adding a new one | Append the new phase at the end with `N+1`; never shuffle prior phase numbers |

---

## CRITICAL Rules

1. **Always `Read` then `Edit`** — never `sed`, `echo >>`, `cat <<EOF`, or shell redirection.
2. **`Write` is forbidden for this skill** — every change is a surgical `Edit`.
3. **The skill never checks boxes** — it only adds unchecked `- [ ]` items. Auto-checkoff is owned by `/tackle` and the UAT skills.
4. **The skill never changes `Status:`** — that flip is intentionally manual.
5. **Index numerator stays untouched** — only the denominator increments here.
6. **Idempotency before edits** — duplicate items abort the run with a friendly message; no edits, no index bump.
7. **Repo-relative paths** — task-link items use paths relative to the roadmap file's location (`../tasks/NNN-slug.md`), not absolute or repo-root paths.
