---
name: roadmap-next
description: Read-only — point at the first unchecked item in a roadmap and suggest /tackle if it's a task link
model: claude-haiku-4-5-20251001
argument-hint: <path to roadmap file, NNN-slug, or number>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Next Step

Surface the first unchecked item in a roadmap and tell the user how to act on it. This skill is **strictly read-only** — never edit the roadmap, never flip checkboxes, never touch the index. The roadmap's auto-checkoff is the job of `/tackle` and the `/uat*` family; manual checks are the user's job.

---

**Roadmap Input**: $ARGUMENTS

---

## Step 0: Resolve the Roadmap File

Parse `$ARGUMENTS` to locate the roadmap file. Use `mcp__serena__find_file` / `mcp__serena__list_dir` for discovery — never `bash`.

1. **If a file path is provided** (e.g. `.docs/roadmaps/001-auth-rollout.md`):
   - Confirm the file exists with `mcp__serena__find_file`
   - If it does not exist, fall through to case 4

2. **If a `NNN-slug` is provided** (e.g. `001-auth-rollout`):
   - Search `.docs/roadmaps/` for `<NNN-slug>.md`
   - If not found, fall through to case 4

3. **If only a number is provided** (e.g. `1` or `001`):
   - List `.docs/roadmaps/` with `mcp__serena__list_dir` and match a file whose prefix equals the zero-padded number
   - If ambiguous, list matches and ask the user to clarify via `AskUserQuestion`
   - If no match, fall through to case 4

4. **If `$ARGUMENTS` is empty OR the input did not resolve** — survey roadmaps from the index:
   - Read `.docs/roadmaps/README.md` with `Read` and locate the `## Index` table
   - If the directory is missing or the index lists `_No roadmaps yet_`, STOP and report: `No roadmaps found in .docs/roadmaps/. Use /roadmap-create <topic> to draft one.`
   - Otherwise present the index rows as a compact table (File / Title / Status / Progress) and use `AskUserQuestion` to pick one. Rely on the auto-provided `Other` for free-form input.
   - If `$ARGUMENTS` was non-empty but unresolved, prefix the survey with: `Input \`<arguments>\` did not match a roadmap — listing all roadmaps instead.`

Use the resolved file path for all subsequent steps.

---

## Step 1: Read the Roadmap

Use `Read` on the resolved roadmap file (markdown — `Read` is correct here, not Serena).

Parse the structure:

- **Phases** — `## Phase N: <name>` headings, in document order.
- **Items** — bullet lines under each phase matching either:
  - `- [ ] ...` (unchecked)
  - `- [x] ...` (checked)
- **Status field** — the `- **Status**: active | done` line in the front-matter block.

Ignore non-checkbox bullets (sub-notes, prose, the `## Goal` / `## Notes` sections).

For each item, capture:

| Field | How |
|-------|-----|
| `phase` | Nearest preceding `## Phase N: <name>` |
| `checked` | `true` if `- [x]`, `false` if `- [ ]` |
| `text` | Bullet body after the checkbox |
| `kind` | `task-link` if body matches `[TASK-NNN: ...](<path>)`, else `inline` |
| `task_path` | For task-links: the URL portion of the markdown link, resolved relative to the roadmap file's directory (typically `.docs/tasks/NNN-slug.md`) |

---

## Step 2: Find the Next Unchecked Item

Walk items in document order (phase order, then bullet order within each phase). The **next-up** item is the first one where `checked == false`.

Compute progress: `total = count(items)`, `done = count(items where checked == true)`.

---

## Step 3: Report

Emit a single concise output to the user. Choose the matching shape:

### A. All items checked (`done == total`, `total > 0`)

Check whether `Status: done` is already set in the file's front matter.

If `Status: active` (not yet flipped):

```
Progress: <total>/<total>
All items complete. Flip Status: active to Status: done in <roadmap path> when ready.
Then move the file to .docs/roadmaps/completed/ and update its index entry path.
```

If `Status: done` (already flipped):

```
Progress: <total>/<total> — Status: done
Move to completed/: git mv <roadmap path> .docs/roadmaps/completed/<filename>
Then update the File column in .docs/roadmaps/README.md: [ROADMAP-NNN](NNN-slug.md) → [ROADMAP-NNN](completed/NNN-slug.md)
```

### B. Task-link item is next

```
Progress: <done>/<total>
Next up (Phase <N>: <name>): <item text>
→ /tackle <task_path>
```

The `<task_path>` is the link target as written in the roadmap (e.g. `.docs/tasks/014-user-table-schema.md`). If the path is repo-relative (starts with `../`), normalize it to a repo-root path for display. If the file doesn't exist on disk (e.g. it was moved to `completed/`), note it inline on a follow-up line: `(task file not found at that path — check .docs/tasks/completed/ or trashed/)`. Do **not** rewrite the roadmap.

### C. Inline item is next

```
Progress: <done>/<total>
Next up (Phase <N>: <name>): <item text>
→ Manual item — open <roadmap path> and flip - [ ] to - [x] when done.
```

### D. Roadmap has zero items (`total == 0`)

```
Roadmap has no checklist items yet. Add some with /roadmap-add <ROADMAP-NNN> <item>.
```

---

## Constraints

- **Never edit the roadmap, the index, or any task file.** This skill is pure read + report.
- Use only `mcp__serena__list_dir`, `mcp__serena__find_file`, `Read`, and `AskUserQuestion`.
- Never use `bash` for file ops (`ls`, `cat`, `find`, `grep`, `sed` are all forbidden).
- Keep the final report terse — one block, no preamble, no closing summary. The user wants the next action, not a status essay.
