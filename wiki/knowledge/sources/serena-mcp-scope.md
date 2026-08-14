---
id: serena-mcp-scope
title: "Research: Serena MCP — Project Scope vs. Local Scope"
updated: 2026-08-14
sources:
  - ../../../raw/research/serena-mcp-scope/index.md
confidence: extracted
tags: [mcp, serena, scope, decision-review]
---

# Research: Serena MCP — Project Scope vs. Local Scope

A decision-review pass confirming this repo's existing choice to register uses::[[serena]] at MCP **local** scope rather than **project** scope. It does not change any code — it re-verifies the reasoning already shipped (and already established by `mcp-add-scope-writes`, un-ingested prior research) against Claude Code's official scope documentation.

**Claude Code has three MCP registration scopes**, independent of Serena: `local` (stored in `~/.claude.json`, keyed by the absolute project path, private to whoever registered it), `project` (`.mcp.json` at the repo root, meant to be committed and shared with a team), and `user` (global, all projects). Precedence on a name collision is local > project > user, with no field-level merging. Project-scoped `.mcp.json` triggers a per-teammate approval prompt the first time it's used, specifically because a committed config "arrives with cloned code" and cannot be assumed safe.

**Why project scope is structurally wrong for Serena specifically**: Serena's registration carries `--project <absolute-path>`, a value that is unique to whoever ran `claude mcp add`. Committing it to `.mcp.json` means every other clone — a teammate on a different machine, or the same user with a second checkout — gets an entry pointing at a directory that doesn't exist for them, and Serena silently fails to start. This is the structural equivalent of committing a personal credential: correct for exactly one machine, wrong for everyone else. No variable-expansion mechanism for `.mcp.json` paths was found in the sources reviewed, so there's currently no way to make a project-scoped entry portable.

**Team pattern for project vs. local scope in general**: teams get real value from project scope for path-free, genuinely shared servers (a hosted docs server, a URL-based team connector) and layer personal, per-developer config — auth tokens in the general case, an absolute path in Serena's case — on top via local-scoped entries.

**Verdict**: no code change indicated. `install-mcps.sh` already registers Serena with `--scope local`, and the `mcp.serenaMigrate` preference already offers a consent-gated migration for any repo carrying a legacy project-scope entry from an earlier bootstrap version. See relates_to::[[mcp-server-scope-model]] for the general scope concept this research also produced.
