---
topic: a user scoped mcp --- if multiple sessions are active, why does it start a new mcp process for each session? can we enforce one process per user mcp globally?
slug: mcp-one-process-per-user
researched: 2026-07-28
---

# Primary Sources — One process per user-scoped MCP

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/install-mcps.sh::_add_brave` | 2026-07-28 | Shipped TASK-020 state: exec-wrapper = one container, one exec'd server process per session |
| S2 | codebase | `raw/research/brave-mcp-single-docker-container/index.md` (+ its `sources.md`) | 2026-07-28 | Prior option space; HTTP rejected there solely on the "starts via `.claude.json`" constraint; per-session spawn finding |
| S3 | web | https://modelcontextprotocol.io/specification/2025-06-18/basic/transports | 2026-07-28 | stdio: client launches server as subprocess, lifecycle bound to client; Streamable HTTP: one independent process, multiple client connections, `Mcp-Session-Id`; localhost-bind + Origin-validation guidance |
| S4 | web | https://github.com/anthropics/claude-code/issues/28860 | 2026-07-28 | Open feature request: share MCP server processes across concurrent sessions ("shared MCP daemon") — confirms no such mechanism ships today |
| S5 | web | https://github.com/anthropics/claude-code/issues/40220 | 2026-07-28 | Open request for "singleton/shared mode"; concrete failure of per-session spawning with singleton resources (Telegram 409) |
| S6 | web | https://github.com/anthropics/claude-code/issues/63749 | 2026-07-28 | "stdio = 1 client : 1 subprocess, no in-protocol multiplexing"; HTTP named the cleanest shared-process path |
| S7 | web | https://www.npmjs.com/package/mcp-remote | 2026-07-28 | Standard stdio→remote-HTTP proxy shim for stdio-only clients (Option C building block) |
| S8 | web | https://github.com/sparfenyuk/mcp-proxy | 2026-07-28 | Bidirectional stdio↔Streamable-HTTP bridge; can expose one stdio backend over HTTP for shared use |
| S9 | web | https://github.com/brave/brave-search-mcp-server | 2026-07-28 | Native HTTP transport (`BRAVE_MCP_TRANSPORT=http`, port 8080) with `--allowed-origins`/`--allowed-hosts` DNS-rebinding protections |
| S10 | web | https://github.com/anthropics/claude-code/issues/29688 | 2026-07-28 | Caveat bug: stdio child spawned even for HTTP-configured servers (Windows) — verify zero-spawn after switching |

## Excerpts

### S3 — MCP Specification 2025-06-18: Transports
https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
> In the **stdio** transport: The client launches the MCP server as a subprocess. The server reads JSON-RPC messages from its standard input (`stdin`) and sends messages to its standard output (`stdout`).

> Client->>Server Process: Close stdin, terminate subprocess

> In the **Streamable HTTP** transport, the server operates as an independent process that can handle multiple client connections.

> When running locally, servers **SHOULD** bind only to localhost (127.0.0.1) rather than all network interfaces (0.0.0.0)

### S4 — anthropics/claude-code#28860
https://github.com/anthropics/claude-code/issues/28860
> MCP servers that are configured at the project or user level should be shared as a single process (or process group) across all concurrent Claude Code sessions in the same workspace, rather than spawning duplicate instances. For example, 4 sessions with 6 MCP servers should spawn 6 MCP processes total, not 42. Shared MCP daemon: A single MCP server process per workspace that multiplexes requests from multiple Claude Code sessions

### S5 — anthropics/claude-code#40220
https://github.com/anthropics/claude-code/issues/40220
> When running two Claude Code sessions on the same machine, both sessions independently spawn their own MCP server processes. ... Globally configured MCP servers should either support a "singleton" / "shared" mode, where only one session owns the process and others share or skip it

### S6 — anthropics/claude-code#63749
https://github.com/anthropics/claude-code/issues/63749
> The MCP spec defines stdio as 1 client : 1 subprocess; there's no in-protocol multiplexing for stdio.

> When a server supports it, multiple clients can share one process per spec. This is the cleanest path for servers that can run as HTTP.

### S7 — mcp-remote (npm)
https://www.npmjs.com/package/mcp-remote
> Remote proxy for Model Context Protocol, allowing local-only clients to connect to remote servers using oAuth.

> So far, the majority of MCP servers in the wild are installed locally, using the stdio transport.

### S8 — sparfenyuk/mcp-proxy (GitHub)
https://github.com/sparfenyuk/mcp-proxy
> The mcp-proxy is a tool that lets you switch between server transports. There are two supported modes: ... Run a proxy server from stdio that connects to a remote SSE server. ... mcp-proxy --port=8080 uvx mcp-server-fetch

### S9 — brave/brave-search-mcp-server (GitHub)
https://github.com/brave/brave-search-mcp-server
> BRAVE_MCP_TRANSPORT: Transport mode ("http" or "stdio", default: "stdio")

> --transport <stdio|http> Transport type (default: stdio) --port <number> HTTP server port (default: 8080) ... --allowed-origins <origins...> Allowed Origin header values for HTTP transport (DNS rebinding protection)

### S10 — anthropics/claude-code#29688
https://github.com/anthropics/claude-code/issues/29688
> When an MCP server is configured with "type": "http" in ~/.claude/claude.json, Claude Code still spawns a separate stdio child process for the same server on every new session. This results in redundant MCP server processes accumulating — one stdio process per Claude Code session, in addition to the shared HTTP server.
