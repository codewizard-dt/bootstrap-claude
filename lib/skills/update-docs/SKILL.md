---
name: update-docs
description: Update task, UAT, and project documentation files to reflect implementation work just completed
model: claude-sonnet-4-6
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `wiki/work/tasks/lifecycle.md`. Read it now if not already in context.**

# Update Documentation

Reflect the **most recent implementation work** in the project's markdown files. Scoped to the current session's changes — do not audit the entire docs tree.

---

## Scope

In scope:
- Task files in `wiki/work/tasks/` — checkbox state
- UAT files in `wiki/work/uat/` — folder moves only when triggered by `/uat-walk`, not here
- `PROJECT_STATUS.md` — progress + next steps (only if it exists)
- `CLAUDE.md` — only when slash commands, MCP requirements, or key files genuinely changed
- `README.md` — only when setup steps, tech stack, or project structure genuinely changed

Out of scope (do NOT touch):
- **Serena memories — NEVER call `mcp__serena__write_memory` or `mcp__serena__edit_memory` here, for any reason.**
- ADR or PRD files
- `.docs/guides/` files
- Any doc unrelated to the changes in this session

---

## Instructions

### Step 1: Identify the Changes

In one pass, determine what shipped this session. Prefer `git status` / `git diff --stat` reasoning over re-exploring the codebase. If the session context already names the task and files touched, use that directly — do not re-discover.

### Step 2: Update Task Files

For each `wiki/work/tasks/NNN-slug.md` whose steps were implemented:
- Flip `- [ ]` → `- [x]` for each completed step using **`Edit`** (one call per checkbox).
- Never `sed` / `awk` / `perl -i` / `echo >>`.
- Do **not** move the file. Task files stay in `wiki/work/tasks/` until `/uat-walk` moves them to `completed/`.

### Step 3: Update `PROJECT_STATUS.md` (if it exists)

Skip this step entirely if the file is not present. Otherwise:
- Mark completed items.
- Update the "Next steps" section to reflect what's actually next.
- Keep edits surgical — no rewrites.

### Step 4: Update `CLAUDE.md` and `README.md` Only If Warranted

Apply the "genuinely changed" gate:
- **`CLAUDE.md`** — edit only if a slash command, MCP requirement, or Key Files entry was added/renamed/removed.
- **`README.md`** — edit only if setup, tech stack, or top-level structure changed.

If neither qualifies, skip both. Do not edit just to bump dates or reword.

### Step 5: Spot-Check Consistency

Quick scan only:
- Updated checkboxes match the work that landed.
- New file paths referenced in docs actually exist.
- No cross-references to deleted files.

No exhaustive audit — flag drift you happen to notice, do not search for it.

---

## Finish

Report what was edited (file paths, one line each).
