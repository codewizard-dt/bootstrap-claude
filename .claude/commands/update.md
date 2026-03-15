---
description: Update documentation
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

# Update Documentation

Update all relevant documentation to reflect the current state of the project after implementation work.

---

## Instructions

### Step 1: Assess Scope

Determine what changed since the last documentation update:

- What was implemented, fixed, or refactored?
- Which documentation files are affected?
- Are there new patterns, conventions, or workflows to document?

Use MCP Serena to explore the codebase as needed, including for markdown files. Standard Read/Edit/Write are permitted only for JSON, YAML, and config files.

---

### Step 2: Update in Priority Order

Update documentation in this sequence:

#### 1. **Task Files** (`.docs/tasks/`)

- Tasks in `active/` are being implemented via `/tackle`
- Tasks in `pending-uat/` have been implemented and await UAT testing
- Tasks in `completed/` have passed UAT and are fully done
- Update checkbox status in active tasks (`- [ ]` → `- [x]`)
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

#### 6. **Serena Memories**

Use MCP Serena memory tools to persist key findings:
- `mcp__serena__list_memories` → check what exists
- `mcp__serena__read_memory` → read relevant memories
- `mcp__serena__write_memory` → save new findings
- `mcp__serena__edit_memory` → update stale memories

---

### Step 3: Verify Consistency

- Do all docs agree on current status?
- Are completion markers consistent across task files, UAT files, and PROJECT_STATUS.md?
- Do cross-references and file paths still work?
- Do examples match current implementation?

---

### Step 4: Quality Checklist

Before completing the update, verify:

- [ ] Task files reflect actual completion state
- [ ] UAT files are in the correct subfolder (pending vs complete)
- [ ] Status indicators are accurate
- [ ] Internal links point to existing files
- [ ] No contradictions between docs
- [ ] New work is documented
- [ ] Next steps are current

---

## Documentation Standards

### Status Indicators

- `[x]` or ✅ — Completed
- `[ ]` or ⏳ — Planned / pending
- 🔄 — In progress
- `[FAIL: reason]` — Failed (UAT tests)

### File Path References

- Use relative paths from project root
- Use markdown links: `[text](path/to/file.md)`
- Use inline code for file names: `src/components/Example.tsx`

---

## Pipeline Context

This command is typically run after `/tackle` completes. The full workflow:

```
/add-task → /tackle → /update → /uat-generator → /uat-walkthrough
(active/)   (→ pending-uat/)        (→ pending/)   (→ completed/ + completed/)
```

---

## Finish

After updating documentation, run `/git-commit` to commit the changes.
