# MCP Tools Guide

**Purpose**: Mandatory MCP tool usage rules for AI agents

---

## MANDATORY: MCP Tool Requirements

These MCP servers are **REQUIRED** for all applicable operations. Using standard tools when an MCP tool exists is a violation of project rules.

| MCP Server | Mandatory For | Replaces |
|------------|--------------|----------|
| **Serena** | All code exploration, editing, file search | Read, Edit, Write, Grep, Glob (for code and markdown files) |
| **Context7** | All library/framework documentation lookups | WebSearch, WebFetch (for library docs) |
| **Brave Search** | All general web research | WebSearch (for non-library topics) |
| **Puppeteer** | Browser automation, screenshots, UI interaction | WebFetch (for rendered pages) |

**Exceptions** — standard Read/Edit/Write tools are permitted ONLY for:
- Non-code files (JSON, YAML, .env)
- Creating brand-new files
- Reading binary files or images

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

## Context7 (Library Documentation)

Two-step workflow — resolve the library ID, then query docs.

### Step 1: Resolve Library ID

```python
mcp__context7__resolve-library-id(libraryName="sqlalchemy")
# Returns: "/sqlalchemy/sqlalchemy"
```

Skip only if user provides an explicit `/org/project` ID.

### Step 2: Query Documentation

```python
mcp__context7__query-docs(
    libraryId="/sqlalchemy/sqlalchemy",
    query="async session management"
)
```

If results are insufficient, refine the query with more specific terms.

---

## Brave Search (Web Research)

### Rate Limit: 1 request per second

- Searches MUST be sequential, never parallel
- Wait 1 second between consecutive searches
- On 429 errors, wait 1 second and retry (max 3 times)

### Usage

```python
mcp__brave-search__brave_web_search(
    query="FastAPI dependency injection best practices 2025",
    count=10
)
```

Use for general research, best practices, troubleshooting, news. Do NOT use for library documentation (use Context7).

---

## Puppeteer (Browser Automation)

### Tools

| Tool | Purpose |
|------|---------|
| `puppeteer_navigate` | Navigate to a URL |
| `puppeteer_screenshot` | Screenshot current page |
| `puppeteer_click` | Click element by CSS selector |
| `puppeteer_fill` | Fill an input field |
| `puppeteer_evaluate` | Execute JavaScript in browser |
| `puppeteer_select` | Select dropdown option |
| `puppeteer_hover` | Hover over element |

Use for visual verification, form interaction, and browser-rendered content. Do NOT use for static content fetching or library docs.

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

## Quick Reference: Which Tool for What

| Task | MUST Use | NEVER Use |
|------|----------|-----------|
| Explore code structure | Serena `get_symbols_overview` | `Read` on code files |
| Find function/class | Serena `find_symbol` | `Grep` on code files |
| Edit code | Serena symbolic or file/line tools | Standard `Edit` on code files |
| Rename symbol | Serena `rename_symbol` | Manual find-and-replace |
| Search code | Serena `search_for_pattern` | `Grep` (unless Serena unavailable) |
| Library docs | Context7 | `WebSearch` / `WebFetch` |
| General research | Brave Search (sequential, 1/sec) | Parallel searches |
| Browser interaction | Puppeteer | `WebFetch` for rendered content |
| Non-code files (JSON, YAML, .env) | Standard Read/Edit/Write | Serena |
| Markdown files | Serena | Standard Read/Edit/Write |
