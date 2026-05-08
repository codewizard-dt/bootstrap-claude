---
name: update-docs
description: Update all project documentation after implementation work
model: claude-sonnet-4-6
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/task-lifecycle.md`. Read it now if not already in context.**

# Update Documentation

Update all relevant documentation to reflect the current state of the project after implementation work.

---

## Instructions

### Step 1: Assess Scope

Determine what changed since the last documentation update:

- What was implemented, fixed, or refactored?
- Which documentation files are affected?
- Are there new patterns, conventions, or workflows to document?

Use Serena (`list_dir`, `find_file`, `search_for_pattern`, `get_symbols_overview`, `find_symbol`) for all exploration. Standard `Read`/`Edit`/`Write` are permitted for markdown and config files (JSON, YAML, `.env`); code files still must use Serena's symbolic or file/line editing tools. **Never** use `bash` commands like `ls`, `cat`, `find`, `grep`, or `sed` on any file. See `.docs/guides/mcp-tools.md`.

---

### Step 2: Update in Priority Order

Update documentation in this sequence:

#### 1. **Task Files** (`.docs/tasks/`)

- Tasks in `active/` are being implemented via `/tackle` or awaiting UAT testing
- Tasks in `completed/` have passed UAT and are fully done
- Update checkbox status in active tasks (`- [ ]` → `- [x]`) using the **`Edit`** tool — one call per checkbox. **Never** `sed`/`awk`/`perl -i`. See `.docs/guides/mcp-tools.md` "Common anti-patterns".
- Add new tasks discovered during implementation

#### 2. **UAT Files** (`.docs/uat/`)

- If a task was completed and has a corresponding UAT in `pending/`, note it's ready for walkthrough
- If UAT tests were run and all passed, move from `pending/` to `completed/` using `git mv` (fall back to `mv` only if `git mv` fails)

#### 3. **PROJECT_STATUS.md** (if it exists)

- Update implementation progress and completed items
- Update phase/milestone status markers
- Add new important files to critical files summary
- Update next steps to reflect current priorities

#### 4. **CLAUDE.md**

Update when:
- New slash commands are added or changed
- MCP tool requirements change
- Project architecture changes significantly
- Key files are added or moved

#### 5. **README.md**

Update when:
- Tech stack or dependencies change
- Setup/quickstart instructions change
- Project structure changes significantly

---

### Step 3: Update Serena Memories

Serena memories persist only what future agents cannot recover from code or docs. The goal is a lean, accurate memory set — not comprehensive coverage. Audit and prune aggressively; write sparingly.

Every `/update-docs` run MUST execute this full workflow:

#### 3.1 Audit existing memories

1. `mcp__serena__list_memories` → scan all memories (use `topic` filter for targeted checks if the memory count is large)
2. For each memory related to areas that changed: `mcp__serena__read_memory` → check if content is still accurate

#### 3.2 Update stale memories

For every memory that references code, patterns, or architecture affected by recent changes:

- Use `mcp__serena__edit_memory` with `mode="literal"` for precise text swaps or `mode="regex"` for pattern-based updates
- Prefer editing over full rewrites — surgical updates preserve surrounding context
- If a memory references symbols, files, or patterns that were **renamed or moved**, update the references
- If a memory references symbols, files, or patterns that were **deleted**, either remove the stale content or delete the memory with `mcp__serena__delete_memory`
- Use `mcp__serena__rename_memory` to reorganize if the naming hierarchy no longer fits after changes

#### 3.3 Write new memories for discoveries

Only write a new memory if the knowledge **cannot be recovered** by reading CLAUDE.md, task files, ADRs, or the code itself, **and** it would materially change how a future agent operates on this codebase. Apply a strict threshold: if in doubt, do not write it.

Use `mcp__serena__write_memory` only for:
- **Codebase-wide standards**: naming conventions or terminology that apply across the whole project and aren't documented anywhere
- **Non-obvious invariants**: constraints or coupling between modules that a skilled developer would not infer from the code (e.g., "module A must always be initialised before B at runtime")
- **Repeated-mistake traps**: gotchas that caused real failures and are invisible in the code (e.g., "this ORM silently drops timezone info")
- **Mandatory workflow constraints**: agent-level rules that govern how work must be done on this project (e.g., "never run migrations without a backup step")

**Do NOT write memories for:**
- Architecture decisions already recorded in ADR files
- Information already in CLAUDE.md, PROJECT_STATUS.md, or task files
- Temporary state, debugging notes, or task-specific findings
- Easily re-derivable facts (file lists, import paths, dependency versions)
- Implementation details that are clear from reading the code
- Anything specific to a single task or feature unless it sets a project-wide standard

Use `/` in names for topic hierarchy (e.g., `api/auth/jwt-flow`, `modules/frontend`). Prefer updating an existing memory over creating a new one.

#### 3.4 Verification checklist

Before moving on, confirm:
- [ ] All memories referencing changed code have been updated or deleted
- [ ] New patterns established during implementation have been captured
- [ ] No memory describes the old state of something that was changed
- [ ] Memory names follow the `/`-separated topic hierarchy convention

---

### Step 4: Verify Consistency

- Do all docs agree on current status?
- Are completion markers consistent across task files, UAT files, and PROJECT_STATUS.md?
- Do cross-references and file paths still work?
- Do examples match current implementation?

---

### Step 5: Quality Checklist

Before completing the update, verify:

- [ ] Task files reflect actual completion state
- [ ] UAT files are in the correct subfolder (pending vs complete)
- [ ] Status indicators are accurate
- [ ] Internal links point to existing files
- [ ] No contradictions between docs
- [ ] New work is documented
- [ ] Next steps are current
- [ ] Serena memories audited, updated, and new knowledge persisted (Step 3)

---

## Documentation Standards

### Status Indicators

- `[x]` or ✅ — Completed
- `[ ]` or ⏳ — Planned / pending
- 🔄 — In progress
- `[FAIL: reason]` — Failed (UAT tests)
- `[SKIP: reason]` — Skipped by user (UAT tests)

### File Path References

- Use relative paths from project root
- Use markdown links: `[text](path/to/file.md)`
- Use inline code for file names: `src/components/Example.tsx`

---

## Pipeline Context

This command is typically run after `/tackle` completes. The full workflow:

```
/add-task → /tackle → /update-docs → /uat-generator → /uat
(active/)   (stays in active/)      (→ pending/)   (→ completed/ + completed/)
```

---

## Finish

After updating documentation, run `/git-commit` to commit the changes.
