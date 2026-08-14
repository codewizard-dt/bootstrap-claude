---
topic: Pros and cons of registering the Serena MCP server at project scope (checked into this repo's .mcp.json) versus local scope (stored in ~/.claude.json under this project's entry)
slug: serena-mcp-scope
researched: 2026-08-14
---

# Primary Sources — Serena MCP scope: project vs. local

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/install-mcps.sh:309-345` | 2026-08-14 | Current Serena registration is `--scope local`; consented migration for legacy `.mcp.json` entries via `mcp.serenaMigrate` |
| S2 | codebase | `lib/scripts/templates/bootstrap-prefs-schema.json` — `mcp.serenaMigrate`, `mcp.serena` entries | 2026-08-14 | Schema-documented rationale for both the migration prompt and the fresh-install-at-local-scope prompt |
| S3 | codebase | `raw/research/mcp-add-scope-writes/index.md` | 2026-08-14 | Prior research (2026-07-29) diagnosing why Serena was once written to `.mcp.json` at project scope and recommending local scope + consented migration — the origin of the current implementation |
| S4 | web | https://code.claude.com/docs/en/mcp-quickstart | 2026-08-14 | Official docs: local scope tied to the project you added it from, stored in `~/.claude.json`; project scope is `.mcp.json`, meant to be committed; local-scoped servers take precedence over project-scoped servers |
| S5 | web | https://informgrowth.com/blog/claude-code-mcp-scopes-reference | 2026-08-14 | "Local scope is not 'your machine.' It is one folder."; project scope's env block "lands in git history"; project scope prompts for approval because it "arrives with cloned code" |
| S6 | web | https://www.builder.io/blog/claude-code-mcp-servers | 2026-08-14 | Team pattern: project scope for shared, path-free servers (hosted docs, DB connector); local scope for personal/per-developer config layered on top |
| S7 | web | https://maketocreate.com/claude-code-mcp-server-configuration-2026-setup-guide/ | 2026-08-14 | Direct quote of Anthropic's precedence rule: "Project servers in .mcp.json take precedence over user servers with the same name; local-scoped servers take precedence over project-scoped servers" |

## Excerpts

### S4 — Connect to MCP servers - Claude Code Docs
https://code.claude.com/docs/en/mcp-quickstart
> You ran claude mcp add from a different project. Local-scoped servers are tied to the project where you added them: the repository root, or the exact directory if you weren't in a git repository.

> This section edits .mcp.json, the project-scope file. It's the one most worth writing by hand because it's checked into the repository, where it doubles as configuration-as-code for your team.

### S5 — Claude Code MCP Scopes: Local vs Project vs User (Complete Reference)
https://informgrowth.com/blog/claude-code-mcp-scopes-reference
> If you only remember one thing: local scope is not "your machine." It is one folder.

> Project scope is designed to be committed, which means anything in its env block lands in git history.

> Because .mcp.json arrives with cloned code, Claude Code prompts for approval before using project-scoped servers.

### S6 — Claude Code MCP Servers: How to Connect, Configure, and Use Them
https://www.builder.io/blog/claude-code-mcp-servers
> In practice, your team commits a .mcp.json with a shared Sentry server and a project-specific database connection. Each developer then adds their own authentication tokens through local-scoped entries in ~/.claude.json.

### S7 — Claude Code MCP Server Configuration: 2026 Setup Guide
https://maketocreate.com/claude-code-mcp-server-configuration-2026-setup-guide/
> Per Anthropic's own docs: "Project servers in .mcp.json take precedence over user servers with the same name; local-scoped servers take precedence over project-scoped servers" (code.claude.com, 2026).
