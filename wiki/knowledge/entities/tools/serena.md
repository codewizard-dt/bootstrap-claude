---
id: serena
title: Serena
aliases: [Serena MCP, oraios/serena]
updated: 2026-08-14
sources:
  - ../../../../raw/research/gitignored-wiki-tool-visibility/index.md
  - ../../../../raw/research/serena-mcp-disconnect/index.md
  - ../../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../../raw/research/serena-mcp-scope/index.md
confidence: extracted
tags: [mcp, lsp, code-navigation, security]
---

# Serena

LSP-backed MCP server (oraios/serena) providing semantic code navigation, symbolic editing, and project memory — the mandated exploration/editing surface for bootstrap-configured projects (see `wiki/guides/mcp-tools.md`). Registered per-project at **local scope** (`~/.claude.json` project entry, absolute `--project` path); user scope causes cross-project language-config bleed (oraios/serena#895), project scope leaks machine paths into a committed `.mcp.json`.

**Scope choice confirmed against Claude Code's official docs** (2026-08-14 review, derived_from::[[serena-mcp-scope]]): local scope wins the precedence order (local > project > user) and loads without `.mcp.json`'s per-teammate approval gate. Project scope is structurally wrong here specifically because `--project <path>` is machine-specific — committing it is the structural equivalent of committing a personal credential, breaking on every other clone. No code change resulted; `install-mcps.sh` already does this, and `mcp.serenaMigrate` already offers a consent-gated migration off a legacy project-scope entry. See relates_to::[[mcp-server-scope-model]] for the general three-scope model.

**Open lead, not yet verified** (derived_from::[[mcp-scope-performance-behavior]], 2026-08-15): Claude Code documents `${CLAUDE_PROJECT_DIR:-.}`-style variable expansion in `.mcp.json` entries, which — if it works with the `--project` flag position specifically — could make a project-scope Serena entry portable after all, contradicting the "no portability mechanism exists" framing in derived_from::[[serena-mcp-scope]]. No test has been run; local scope remains the recommendation until one is.

**Each concurrent session spawns its own Serena process** (derived_from::[[mcp-one-process-per-user]], 2026-08-15): Serena is registered as a **stdio** server, and stdio is spec-defined as one subprocess per client — see relates_to::[[mcp-stdio-one-process-per-session]]. Three Claude Code windows/sessions open against the same project therefore run three independent `uvx ... serena start-mcp-server` processes, not a shared one; local scope only controls which project's config is used, not process sharing. No daemon-sharing mechanism exists for Serena today, and none is on a documented roadmap. The only way another MCP server in this repo avoids this (brave-search, Playwright on macOS) is by being registered over **HTTP** against a persistent shared process instead of stdio — an option Serena does not currently offer.

**Ignore semantics** (source-verified 2026-07-30): with `ignore_all_files_in_gitignore: true` (bootstrap default in `.serena/project.yml`), `serena.project.Project` builds its ignore specs from `GitignoreParser(project_root)`, whose `_iter_gitignore_files` discovers **only files literally named `.gitignore`** (`src/serena/util/file_system.py:176`). Consequences:
- Anything gitignored is invisible to `search_for_pattern`, `find_file`, and symbol indexing — **never gitignore `wiki/`, `raw/`, or `.serena/`**; use `.git/info/exclude` for machine-local git exclusion instead (Serena never reads it). relates_to::[[git-ignore-tool-visibility]]
- Gitignore-style negation (`!`) in `ignored_paths` is broken/unsupported upstream (oraios/serena#600) — no allowlist escape.
- `ignored_paths` adds ignores (gitignore syntax, additive with the global config); it cannot un-ignore.

**Security note** (2026-07-29 sandbox-escape research): Serena's `execute_shell_command` tool, when enabled, is a **Bash-equivalent execution surface that `Bash(...)` deny rules do not cover** — permission patterns are matched per-tool, so every command class blocked in relates_to::[[settings-deny-list]] is reachable through it unqualified. This is a direct instance of relates_to::[[deny-matches-a-spelling-not-a-capability]] (the same alternate-tool problem as Bash → PowerShell), and it means an MCP execution tool has to be covered at the hook layer or contained by uses::[[claude-code-sandbox]], not by the deny list. Bootstrap projects do not enable it by default; relates_to::[[agent-persistence-vectors]] applies in full if they do.

Config schema note: newer versions renamed `languages:` → `language_servers:` in `project.yml`; bootstrap's `bootstrap-serena.sh` handles both. Health-tracking around Serena's failure modes lives in derived_from::[[serena-health-tracking-hook]] and the disconnect root-cause analysis in [[serena-mcp-disconnect]].
