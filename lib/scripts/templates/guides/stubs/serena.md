
### Standard tools (`Read`, `Edit`, `Write`) are permitted for:

- **Markdown files** (`.md`) — content edits use standard tools (Serena's symbolic editor doesn't apply to prose)
- **Config files** — JSON, YAML, TOML, `.env`, `.gitignore`, `package.json`, etc.
- **Creating brand-new files** of any type
- **Binary files and images** (read only)

### Standard tools are NEVER permitted for:

- **Code files** — TypeScript, JavaScript, Python, Go, Rust, etc. Always use Serena's symbolic or file/line tools.
- **File or directory exploration of any kind**, regardless of file type. This includes:
  - Listing directories → use `mcp__serena__list_dir`, **never** `ls` / `tree` / `find -type d`
  - Finding files by name → use `mcp__serena__find_file`, **never** `find -name` / `ls | grep`
  - Searching file contents → use `mcp__serena__search_for_pattern` or the `Grep` tool, **never** `grep` / `rg` / `ag` invoked through `bash`
  - Reading file contents for inspection → use `mcp__serena__get_symbols_overview` (code) or `Read` (markdown/config), **never** `cat` / `head` / `tail`
  - Editing via shell → **never** `sed` / `awk` / `echo >>`

The rule of thumb: **the shell is for running programs, not for inspecting or modifying files.** Even on a markdown file, do not `cat README.md` — use `Read`. Do not `grep -r foo wiki/` — use `mcp__serena__search_for_pattern` or the `Grep` tool.

### Common anti-patterns and their fixes

These are real mistakes AI agents make on this codebase. Do not repeat them.

#### ❌ Anti-pattern: `sed` to flip task-file checkboxes

```bash
# WRONG — never do this
sed -i '' 's/- \[ \] Launch Puppeteer/- [x] Launch Puppeteer/; s/- \[ \] Navigate and screenshot/- [x] Navigate and screenshot/' wiki/work/tasks/TASK-051-ux-conversion-audit.md
```

This pattern shows up most often when marking multiple steps complete in a task file. It triggers an approval prompt every time, is fragile against whitespace or escaping, and silently corrupts files when a regex backfires.

✅ **Correct**: call the `Edit` tool once per checkbox (or use `replace_all: true` if every `- [ ]` in the file should become `- [x]`):

```
Edit(file_path="wiki/work/tasks/TASK-051-ux-conversion-audit.md",
     old_string="- [ ] Launch Puppeteer",
     new_string="- [x] Launch Puppeteer")
Edit(file_path="wiki/work/tasks/TASK-051-ux-conversion-audit.md",
     old_string="- [ ] Navigate and screenshot each marketing",
     new_string="- [x] Navigate and screenshot each marketing")
# ...one Edit call per checkbox
```

Yes, even if there are ten checkboxes. Ten `Edit` calls is correct. One `sed` is wrong.

#### ❌ Anti-pattern: `cat` to check what's in a file before editing

```bash
# WRONG
cat wiki/work/tasks/TASK-051-ux-conversion-audit.md
```

✅ **Correct**: `Read` tool. Always.

#### ❌ Anti-pattern: `ls` to see what's in a directory

```bash
# WRONG
ls wiki/work/uat/screenshots/
```

✅ **Correct**: `mcp__serena__list_dir(relative_path="wiki/work/uat/screenshots/")`

#### ❌ Anti-pattern: `grep -r` to find a string across files

```bash
# WRONG
grep -r "pending-uat" .
```

✅ **Correct**: the `Grep` tool, or `mcp__serena__search_for_pattern`.

#### ❌ Anti-pattern: `echo "new content" >> file.md` to append to a file

```bash
# WRONG
echo "## New Section" >> README.md
```

✅ **Correct**: `Read` the file first to see the current end, then `Edit` to append (or `Write` if creating fresh).

**See also**: [`command-anti-patterns.md`](./command-anti-patterns.md) — shell hygiene, scratch-dir rules, and the /tackle-vs-UAT verification split.

---

## Serena (Code Exploration & Editing)

Serena provides two editing approaches:
1. **Symbolic** — LSP-powered, refactoring-safe (entire functions/classes)
2. **File/line-based** — Precise line-range and regex edits (within functions)

### Tools

**Exploration:**

| Tool | Purpose | Key Params |
|------|---------|------------|
| `get_symbols_overview` | File structure overview | `relative_path`, `depth` (0=top-level) |
| `find_symbol` | Find symbols by name | `name_path_pattern`, `include_body`, `depth`, `substring_matching` |
| `find_referencing_symbols` | Find all callers/references | `name_path`, `relative_path` (file, not dir) |
| `search_for_pattern` | Regex search across files | `substring_pattern`, `relative_path`, `paths_include_glob` |
| `list_dir` | List directory contents | `relative_path`, `recursive` |
| `find_file` | Find files by name/mask | `file_mask`, `relative_path` |

**Symbolic editing** (use when replacing entire symbols):

| Tool | Purpose | Key Params |
|------|---------|------------|
| `replace_symbol_body` | Replace function/class body | `name_path`, `relative_path`, `body` (includes signature, NOT docstring) |
| `insert_after_symbol` | Add code after a symbol | `name_path`, `relative_path`, `body` |
| `insert_before_symbol` | Add code before a symbol | `name_path`, `relative_path`, `body` |
| `rename_symbol` | Rename across codebase | `name_path`, `relative_path`, `new_name` |

**File/line editing** (use for precise edits within symbols):

| Tool | Purpose | Key Params |
|------|---------|------------|
| `replace_content` | Literal or regex replacement | `relative_path`, `mode` (literal/regex), `needle`, `repl` |
| `replace_lines` | Replace line range | `relative_path`, `start_line`, `end_line`, `content` (0-based) |
| `delete_lines` | Delete line range | `relative_path`, `start_line`, `end_line` (0-based) |
| `insert_at_line` | Insert at line number | `relative_path`, `line`, `content` (0-based) |

### Name Path Patterns

- `"method"` — matches any symbol named "method"
- `"MyClass/method"` — matches method in MyClass (relative)
- `"/MyClass/method"` — exact match (absolute)
- `"MyClass/method[0]"` — specific overload

### Workflow

```
1. get_symbols_overview → 2. find_symbol → 3. Edit → 4. find_referencing_symbols
```

### Choosing Edit Mode

| Scenario | Use |
|----------|-----|
| Replace entire function/method/class | Symbolic: `replace_symbol_body` |
| Add new method to class | Symbolic: `insert_after_symbol` |
| Rename across codebase | Symbolic: `rename_symbol` |
| Edit few lines within large function | File/line: `replace_content` or `replace_lines` |
| Regex-based replacement | File/line: `replace_content` with `mode="regex"` |
| Edit doesn't align with symbol boundaries | File/line: `replace_lines` |

---

## Onboarding & Memory

Always run onboarding check when starting work:

```python
mcp__serena__check_onboarding_performed()
# If not performed:
mcp__serena__onboarding()
```

### Memory Tools

| Tool | Purpose | Key Params |
|------|---------|------------|
| `list_memories` | List available memories | `topic` (optional filter, e.g. `"auth"`) |
| `read_memory` | Read a memory's contents | `memory_name` |
| `write_memory` | Create a new memory (markdown) | `memory_name`, `content`, `max_chars` (optional) |
| `edit_memory` | Update existing memory in-place | `memory_name`, `needle`, `repl`, `mode` (`literal` or `regex`), `allow_multiple_occurrences` |
| `rename_memory` | Rename or move a memory | `old_name`, `new_name` |
| `delete_memory` | Delete a memory (user permission required) | `memory_name` |

### Memory Naming & Organization

Use `/` separators to create topic hierarchies:

```
modules/frontend          → .serena/memories/modules/frontend.md
auth/login/logic          → .serena/memories/auth/login/logic.md
global/java/style_guide   → shared across all projects
```

- **Project memories**: Stored in `.serena/memories/` within the project
- **Global memories**: Use `global/` prefix — shared across all projects (only when explicitly instructed)
- **Topic filtering**: `list_memories(topic="auth")` returns only memories under that topic

### When to Write Memories

Write memories to persist **non-obvious project knowledge** useful for future tasks:

- Architecture decisions and their rationale
- Integration patterns between modules
- Naming conventions and project-specific terminology
- Known gotchas, workarounds, and edge cases
- Configuration requirements that aren't self-documenting

**Do NOT write memories for**:
- Information already in code comments or docs
- Temporary task state or debugging notes
- Easily re-derivable facts (file paths, import lists)

### Memory Workflow

```
1. list_memories          → discover what exists (filter by topic if needed)
2. read_memory            → check if relevant memory already covers this
3. write_memory           → create new, OR edit_memory → update existing
4. After implementation   → update memories that reference changed code
```

### Best Practices

- **Check before writing**: Always `list_memories` then `read_memory` to avoid duplicates
- **Edit over rewrite**: Use `edit_memory` (literal or regex mode) for targeted updates instead of rewriting entire memories
- **Keep memories focused**: One topic per memory — split broad memories into topic-specific ones
- **Update after changes**: When code changes affect documented patterns, update the relevant memories
- **Meaningful names**: Use descriptive hierarchical names (`api/auth/jwt-flow` not `memory1`)
- **Review post-onboarding**: After Serena onboarding, review generated memories and refine them

---
