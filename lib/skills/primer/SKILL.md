---
name: primer
description: Refresh codebase context via Serena memories
category: researching
model: claude-haiku-4-5-20251001
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

# MANDATORY REQUIREMENTS

## YOU MUST USE MCP TOOLS. THIS IS NON-NEGOTIABLE.

| Operation | REQUIRED Tool | FORBIDDEN Alternative |
|-----------|---------------|----------------------|
| List memories | `mcp__serena__list_memories` | N/A |
| Read memories | `mcp__serena__read_memory` | N/A |
| Write memories | `mcp__serena__write_memory` | N/A |
| Edit memories | `mcp__serena__edit_memory` | N/A |
| Rename memories | `mcp__serena__rename_memory` | N/A |
| Explore code | `mcp__serena__find_symbol`, `mcp__serena__get_symbols_overview` | ~~Read~~ |
| Find files | `mcp__serena__find_file`, `mcp__serena__list_dir` | ~~Glob~~ |
| Search code | `mcp__serena__search_for_pattern` | ~~Grep~~ |

**PROHIBITED**: Using Read, Glob, or Grep for code exploration.

---

# Codebase Context Update

Quick workflow to refresh understanding of the codebase via Serena memories.

## Step 1: Discover & Read Memories

1. `mcp__serena__list_memories` → list all available memories (use `topic` parameter to filter by area, e.g. `topic="api"`)
2. `mcp__serena__read_memory` → read each relevant memory to rebuild context
3. Note any memories that appear stale or reference code that may have changed

**Memory organization uses `/` separators** for topic hierarchies (e.g. `modules/frontend`, `auth/login/logic`). Use topic filtering to efficiently navigate large memory sets.

## Step 2: Explore Codebase as Needed

Use MCP Serena to verify and extend your understanding:
- `mcp__serena__get_symbols_overview` → file/module structure
- `mcp__serena__find_symbol` → locate specific functions, classes, components
- `mcp__serena__search_for_pattern` → find patterns, usages, integrations

Cross-reference what you find against existing memories — if reality has drifted from what's documented, note it for Step 3.

## Step 3: Update Memories

Keep memories current and useful for future conversations:

1. **Edit stale memories**: Use `mcp__serena__edit_memory` with `mode="literal"` for precise text swaps or `mode="regex"` for pattern-based updates. Prefer editing over full rewrites.
2. **Write new memories**: Use `mcp__serena__write_memory` for genuinely new knowledge:
   - Architecture decisions and their rationale
   - Integration patterns between modules
   - Known gotchas, workarounds, and edge cases
   - Naming conventions and project-specific terminology
   - Use `/` in names for topic hierarchy (e.g. `api/auth/jwt-flow`)
3. **Rename disorganized memories**: Use `mcp__serena__rename_memory` to move memories into proper topic hierarchies
4. **Do NOT write memories for**: information already in code comments or docs, temporary state, easily re-derivable facts

See `.docs/guides/mcp-tools.md` for the complete Serena memory reference.

---

## Step 4: Verify Task Index Bootstrap

`/tackle` no-args mode reads only `wiki/work/tasks/README.md` to survey active tasks — it relies on a structured index table rather than reading every task file. Older projects using this template predate that contract; check and bootstrap if needed.

1. Use `mcp__serena__list_dir` on `wiki/work/tasks/` to list task files (top-level only, not `completed/` or `trashed/`). If the directory is empty or has no task files, skip this step.
2. Read `wiki/work/tasks/README.md` (use `Read` — markdown). Decide whether it is **bootstrapped**: it must contain an `## Active Tasks` section followed by a markdown table whose header row includes the columns `#`, `Slug`, `Progress`, `UAT`, `Flags`, `Objective` (in any order, case-insensitive).
3. **If bootstrapped**: do a quick consistency check — every active task file should appear as a row, and every row should point to a real file. If you spot drift (missing rows, rows pointing at moved/trashed files, `Progress: 0/0`), report a one-line warning to the user listing what's off, but do NOT auto-fix; the skill that mutated state without updating the index is the bug.
4. **If NOT bootstrapped** (file missing, no Active Tasks table, or wrong columns):
   - Tell the user: `Task index at wiki/work/tasks/README.md is not in the structured-table format /tackle expects. Bootstrap it now? (Y/n)` via `AskUserQuestion`.
   - On **yes**: for each task file directly in `wiki/work/tasks/` **only** (do not iterate `completed/` or `trashed/` for the table itself — the index lists active tasks only), read the file and compute: `#` (filename prefix), `Slug` (filename slug, linked to the file), `Progress` (count of `- [x]` vs all `- [ ]`/`- [x]` checkboxes — read each task file once with `Read`; this is a one-time bootstrap so a parallel batch of `Read` calls is acceptable), `UAT` (`pending` if a matching file exists in `wiki/work/uat/`, else `none` — `completed`/`skipped` are not represented here because those tasks have moved to `completed/`), `Flags` (presence of `[WIP]`, `[BLOCKED: ...]`, `[FAILED: ...]`, `[DEFERRED-TO-UAT]`), `Objective` (first sentence under `## Objective`). **Also compute the two header values**: list filename prefixes across `wiki/work/tasks/`, `wiki/work/tasks/  `, and `wiki/work/tasks/  ` (skip dirs that don't exist); take the max `NNN-slug` — that's **Last task** (link path = whichever directory it lives in); set **Next task number** = `max + 1`, zero-padded to 3 digits. If no task files exist anywhere, omit **Last task** and set **Next task number** to `001`. Write the result as `wiki/work/tasks/README.md` with the two header lines followed by a single **Active Tasks** table, using the format documented in that file's column reference. Reference: this template's own `wiki/work/tasks/README.md` shows the canonical layout.
   - On **no**: leave the file alone and continue. Warn the user that `/tackle` with no args will not be able to survey active tasks until the index is bootstrapped — they'll need to invoke `/tackle <path-or-slug>` explicitly.
