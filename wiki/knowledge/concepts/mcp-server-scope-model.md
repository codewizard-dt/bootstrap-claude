---
id: mcp-server-scope-model
title: MCP Server Scope Model (local / project / user)
updated: 2026-08-15
sources:
  - ../../../raw/research/serena-mcp-scope/index.md
  - ../../../raw/research/mcp-scope-performance-behavior/index.md
confidence: extracted
tags: [mcp, scope, architecture, performance]
---

# MCP Server Scope Model (local / project / user)

Claude Code registers an MCP server at one of three scopes, and the choice determines both where the config lives and who it's visible to:

- **`local`** — stored in `~/.claude.json`, keyed by the absolute path of the project it was registered from. Private to the machine and user that ran `claude mcp add`; nothing is written into the repo.
- **`project`** — stored in `.mcp.json` at the repo root, meant to be committed to version control so a team shares the same server set. Because it "arrives with cloned code," Claude Code shows a per-teammate approval prompt the first time a project-scoped config is used — it cannot assume a committed file is safe to run unconfirmed.
- **`user`** — stored globally in `~/.claude.json`, applied across every project on the machine regardless of which repo is open.

**Precedence on a name collision**: `local` > `project` > `user`, with no field-level merging — a local entry fully overrides a same-named project entry rather than layering on top of it.

**The scope-fit rule**: project scope is the right choice only for servers whose config is genuinely identical for every teammate — a URL-based connector, a hosted docs server. Anything that must vary per developer or per machine (an auth token, a filesystem path) belongs at local scope, layered on top of a shared project-scope server if one exists. Putting a machine-specific value into `.mcp.json` is structurally the same mistake as committing a personal credential: it works for exactly the machine that wrote it and breaks for everyone else on the very next clone.

**Concrete instance**: uses::[[serena]] registers with an absolute `--project <path>` argument, which is unique per machine — this is why it must always use local scope, never project scope, and why the reasoning generalizes to any future MCP server this repo wires up that carries a similarly machine-specific argument. See derived_from::[[serena-mcp-scope]] for the full research and the pros/cons comparison this concept was extracted from.

**No performance difference between scopes** (derived_from::[[mcp-scope-performance-behavior]], 2026-08-15): scope only changes where config is stored and who/what trusts it — never how a server process is spawned, how fast it connects, or how many processes exist. Every performance-relevant behavior (subprocess spawning, reconnection/backoff, idle timeout) is keyed to **transport type** (stdio vs HTTP/SSE/WebSocket), not scope. A stdio server spawns one fresh process per Claude Code session regardless of which scope it's registered at; the only way to get one shared process across concurrent sessions is HTTP registration against a long-lived server — see relates_to::[[mcp-stdio-one-process-per-session]] for the full concept and derived_from::[[mcp-one-process-per-user]] for the underlying research.

**Trust and headless behavior differ sharply from the interactive default**: a project-scoped `.mcp.json` server triggers a one-time approval prompt only in *interactive* sessions (`claude mcp reset-project-choices` clears prior choices); `claude -p`, Agent SDK, and cloud/web sessions load the same server **without ever prompting**. `disabledMcpjsonServers` is the only setting that blocks a project-scoped server in every mode uniformly. As of Claude Code v2.1.196, a freshly cloned repo also can't self-approve its own `.mcp.json` servers via committed settings — each teammate must individually accept a workspace-trust dialog first.

**Gotcha — `claude mcp add` can hardcode secrets into a placeholder-based `.mcp.json`**: see uses::[[mcp-add-secret-hardcoding-bug]] for the standalone writeup (confirmed, unfixed as of 2026-08-15). The env-var-expansion mechanism above is safe to *read* but re-running `claude mcp add` against a file that already uses it is not safe to *write* — always diff before committing.
