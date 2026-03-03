# 🚨 MANDATORY REQUIREMENTS 🚨

## YOU MUST USE MCP TOOLS. THIS IS NON-NEGOTIABLE.

| Operation | REQUIRED Tool | FORBIDDEN Alternative |
|-----------|---------------|----------------------|
| List memories | `mcp__serena__list_memories` | N/A |
| Read memories | `mcp__serena__read_memory` | N/A |
| Write memories | `mcp__serena__write_memory` | N/A |
| Explore code | `mcp__serena__find_symbol`, `mcp__serena__get_symbols_overview` | ~~Read~~ |
| Find files | `mcp__serena__find_file`, `mcp__serena__list_dir` | ~~Glob~~ |
| Search code | `mcp__serena__search_for_pattern` | ~~Grep~~ |

**⛔ PROHIBITED**: Using Read, Glob, or Grep for code exploration.

---

# Codebase Context Update

Quick workflow to refresh understanding of the codebase.

## Steps

1. **Check memories**: `mcp__serena__list_memories` → Read relevant ones with `mcp__serena__read_memory`
2. **Explore as needed**: **REQUIRED** - Use MCP Serena per `.docs/guides/mcp-tools.md`
3. **Update memories**: Write findings with `mcp__serena__write_memory`

See `.docs/guides/mcp-tools.md` for MCP Serena tool reference.
