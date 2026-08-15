---
topic: what are the implications of defining a mcp server in ./.mcp.json versus ~/.claude.json ?? like are there performance or behavior differences?? (addendum — teammate cross-check)
slug: mcp-scope-performance-behavior
researched: 2026-08-15
---

# Primary Sources — addendum (teammate cross-check)

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S7 | web | https://github.com/anthropics/claude-code/issues/18692 | 2026-08-15 | Confirmed (independently re-fetched and verified in this session, not just relayed): `claude mcp add` resolves and hardcodes `${VAR}` placeholder secrets into `.mcp.json` when run against a file that already contains them; reported against v2.1.9; closed as "not planned" (unfixed) |
| S8 | peer-agent report | `claude-code-guide` subagent (`mcp-scope-research`), delivered via teammate message, 2026-08-15T11:44Z | 2026-08-15 | Independent cross-check against the same doc (https://code.claude.com/docs/en/mcp.md); surfaced the discovery-cache/`alwaysLoad`/`MCP_DISCOVERY_CACHE`/`MCP_CONNECTION_NONBLOCKING` mechanics and the #18692 lead; explicitly flagged which of its own sub-agent's claims (a list of ~10 other GitHub issue numbers, whether `claude mcp list` prints scope) were unconfirmed rather than presenting them as fact — those unconfirmed items are intentionally not carried into index-2.md |

## Excerpts

### S7 — GitHub issue anthropics/claude-code#18692
https://github.com/anthropics/claude-code/issues/18692

> `[BUG] claude mcp add` expands environment variable placeholders and writes resolved values to .mcp.json
>
> When running `claude mcp add` to add a new MCP server to `.mcp.json`, the command expands existing environment variable placeholders (like `${GITHUB_PERSONAL_ACCESS_TOKEN}`) and writes the resolved values back to the file, rather than preserving the original placeholder syntax.
>
> Before (desired): `"Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"`
> After (actual bug behavior): `"Authorization": "Bearer gho_actualTokenValueHere..."`

Reported against Claude Code v2.1.9, macOS, Fish shell. Status: closed as not planned.

### S8 — Peer teammate cross-check message (verbatim excerpt)
Delivered as a `<teammate-message>` from session `mcp-scope-research`, 2026-08-15.

> No documented performance difference tied to *scope* itself. However, the docs describe performance-relevant behavior that is orthogonal to scope (transport-type and per-server-flag driven, not scope driven): Remote (HTTP/SSE) servers you've used before can load from a "discovery cache" instead of reconnecting at startup — shown as `cached 2h ago · connects on first use · N tools` — connecting lazily on first tool call. Set `MCP_DISCOVERY_CACHE=0` to force startup connection for all servers. (Requires v2.1.221+.) `alwaysLoad: true` on a server entry makes startup wait for that server's tools (capped at a 5-second connect timeout); other servers connect in the background by default unless `MCP_CONNECTION_NONBLOCKING=0` is set.
