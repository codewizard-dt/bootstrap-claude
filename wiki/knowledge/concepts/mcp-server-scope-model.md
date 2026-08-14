---
id: mcp-server-scope-model
title: MCP Server Scope Model (local / project / user)
updated: 2026-08-14
sources:
  - ../../../raw/research/serena-mcp-scope/index.md
confidence: extracted
tags: [mcp, scope, architecture]
---

# MCP Server Scope Model (local / project / user)

Claude Code registers an MCP server at one of three scopes, and the choice determines both where the config lives and who it's visible to:

- **`local`** — stored in `~/.claude.json`, keyed by the absolute path of the project it was registered from. Private to the machine and user that ran `claude mcp add`; nothing is written into the repo.
- **`project`** — stored in `.mcp.json` at the repo root, meant to be committed to version control so a team shares the same server set. Because it "arrives with cloned code," Claude Code shows a per-teammate approval prompt the first time a project-scoped config is used — it cannot assume a committed file is safe to run unconfirmed.
- **`user`** — stored globally in `~/.claude.json`, applied across every project on the machine regardless of which repo is open.

**Precedence on a name collision**: `local` > `project` > `user`, with no field-level merging — a local entry fully overrides a same-named project entry rather than layering on top of it.

**The scope-fit rule**: project scope is the right choice only for servers whose config is genuinely identical for every teammate — a URL-based connector, a hosted docs server. Anything that must vary per developer or per machine (an auth token, a filesystem path) belongs at local scope, layered on top of a shared project-scope server if one exists. Putting a machine-specific value into `.mcp.json` is structurally the same mistake as committing a personal credential: it works for exactly the machine that wrote it and breaks for everyone else on the very next clone.

**Concrete instance**: uses::[[serena]] registers with an absolute `--project <path>` argument, which is unique per machine — this is why it must always use local scope, never project scope, and why the reasoning generalizes to any future MCP server this repo wires up that carries a similarly machine-specific argument. See derived_from::[[serena-mcp-scope]] for the full research and the pros/cons comparison this concept was extracted from.
