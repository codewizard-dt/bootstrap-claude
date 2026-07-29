---
id: serena
title: Serena
aliases: [Serena MCP, oraios/serena]
updated: 2026-07-30
sources:
  - ../../../../raw/research/gitignored-wiki-tool-visibility/index.md
  - ../../../../raw/research/serena-mcp-disconnect/index.md
  - ../../../../raw/research/agent-sandbox-escape-vectors/index.md
confidence: extracted
tags: [mcp, lsp, code-navigation, security]
---

# Serena

LSP-backed MCP server (oraios/serena) providing semantic code navigation, symbolic editing, and project memory — the mandated exploration/editing surface for bootstrap-configured projects (see `wiki/guides/mcp-tools.md`). Registered per-project at **local scope** (`~/.claude.json` project entry, absolute `--project` path); user scope causes cross-project language-config bleed (oraios/serena#895), project scope leaks machine paths into a committed `.mcp.json`.

**Ignore semantics** (source-verified 2026-07-30): with `ignore_all_files_in_gitignore: true` (bootstrap default in `.serena/project.yml`), `serena.project.Project` builds its ignore specs from `GitignoreParser(project_root)`, whose `_iter_gitignore_files` discovers **only files literally named `.gitignore`** (`src/serena/util/file_system.py:176`). Consequences:
- Anything gitignored is invisible to `search_for_pattern`, `find_file`, and symbol indexing — **never gitignore `wiki/`, `raw/`, or `.serena/`**; use `.git/info/exclude` for machine-local git exclusion instead (Serena never reads it). relates_to::[[git-ignore-tool-visibility]]
- Gitignore-style negation (`!`) in `ignored_paths` is broken/unsupported upstream (oraios/serena#600) — no allowlist escape.
- `ignored_paths` adds ignores (gitignore syntax, additive with the global config); it cannot un-ignore.

**Security note** (2026-07-29 sandbox-escape research): Serena's `execute_shell_command` tool, when enabled, is a **Bash-equivalent execution surface that `Bash(...)` deny rules do not cover** — permission patterns are matched per-tool, so every command class blocked in relates_to::[[settings-deny-list]] is reachable through it unqualified. This is a direct instance of relates_to::[[deny-matches-a-spelling-not-a-capability]] (the same alternate-tool problem as Bash → PowerShell), and it means an MCP execution tool has to be covered at the hook layer or contained by uses::[[claude-code-sandbox]], not by the deny list. Bootstrap projects do not enable it by default; relates_to::[[agent-persistence-vectors]] applies in full if they do.

Config schema note: newer versions renamed `languages:` → `language_servers:` in `project.yml`; bootstrap's `bootstrap-serena.sh` handles both. Health-tracking around Serena's failure modes lives in derived_from::[[serena-health-tracking-hook]] and the disconnect root-cause analysis in [[serena-mcp-disconnect]].
