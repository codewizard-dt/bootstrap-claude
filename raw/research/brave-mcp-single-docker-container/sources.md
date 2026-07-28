---
topic: a setup that only has 1 global (user scoped) brave mcp server via docker, does not require the user to set up the server manually (starts via the command in .claude.json), and uses a named container (remove the rm flag if necessary)
slug: brave-mcp-single-docker-container
researched: 2026-07-28
---

# Primary Sources — Single global Brave MCP server via named Docker container

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/install-mcps.sh::_add_brave`, `::mcp_add_scoped`, `::register_optional_mcp` | 2026-07-28 | Current npx-based registration, user/project scope resolution, already-installed skip |
| S2 | codebase | `wiki/work/tasks/TASK-020-brave-search-mcp-docker.md` | 2026-07-28 | Prior plan (`docker run -i --rm --name brave-search-mcp`) and its documented concurrent-session name-conflict trade-off |
| S3 | web | https://github.com/brave/brave-search-mcp-server | 2026-07-28 | Env contract (`BRAVE_API_KEY`, `BRAVE_API_KEY_FILE`, `BRAVE_MCP_TRANSPORT`), stdio default, HTTP option, CLI flags |
| S4 | web | https://raw.githubusercontent.com/brave/brave-search-mcp-server/main/Dockerfile | 2026-07-28 | Image internals: `ENTRYPOINT ["node", "dist/index.js"]`, `USER node`, `WORKDIR /app` — the command a `docker exec` variant must run |
| S5 | web | https://hub.docker.com/mcp/server/brave/overview | 2026-07-28 | Canonical Docker MCP Catalog config: `docker run -i --rm -e BRAVE_MCP_TRANSPORT -e BRAVE_API_KEY mcp/brave-search` (ephemeral, per-session) |
| S6 | web | https://github.com/anthropics/claude-code/issues/29688 | 2026-07-28 | Claude Code spawns one stdio MCP child process per session; processes accumulate across sessions |
| S7 | web | https://code.claude.com/docs/en/mcp | 2026-07-28 | User scope stored in `~/.claude.json`; scope precedence local > project > user; `${VAR}` expansion locations (command, args, env, url, headers) |
| S8 | web | https://github.com/docker/mcp-gateway/issues/336 | 2026-07-28 | Docker Desktop writes `MCP_DOCKER` = `docker mcp gateway run` into `~/.claude.json`; Claude Code connection timeouts with the gateway |
| S9 | web | https://github.com/anthropics/claude-code/issues/4202 | 2026-07-28 | Docker MCP Toolkit tool calls time out after 120s in Claude Code despite gateway showing connected |
| S10 | web | https://www.dash0.com/faq/how-to-start-a-docker-container | 2026-07-28 | `docker start -a` semantics: attaches the terminal to the container's stdout/stderr; `-i` keeps stdin open |
| S11 | web | https://hub.docker.com/r/mekayelanik/brave-search-mcp | 2026-07-28 | Third-party precedent for sharing one stdio backend across sessions via an HTTP bridge (mcp-proxy stateful mode) |

## Excerpts

### S3 — brave/brave-search-mcp-server (GitHub)
https://github.com/brave/brave-search-mcp-server
> BRAVE_API_KEY_FILE: Path to a file containing your Brave Search API key. When set, this takes precedence over BRAVE_API_KEY. Useful for Docker secrets and similar mounted-secret setups. BRAVE_MCP_TRANSPORT: Transport mode ("http" or "stdio", default: "stdio")

> To follow established MCP conventions, the server now defaults to STDIO. If you would like to continue using HTTP, you will need to set the BRAVE_MCP_TRANSPORT environment variable to http, or provide the runtime argument --transport http when launching the server.

### S4 — brave-search-mcp-server Dockerfile
https://raw.githubusercontent.com/brave/brave-search-mcp-server/main/Dockerfile
> ENTRYPOINT ["node", "dist/index.js"]
> USER node
> WORKDIR /app
(No CMD defined; the server starts via `node dist/index.js` at `/app/dist/index.js`.)

### S5 — Brave Search MCP Server | Docker MCP Catalog
https://hub.docker.com/mcp/server/brave/overview
> { "mcpServers": { "brave": { "command": "docker", "args": [ "run", "-i", "--rm", "-e", "BRAVE_MCP_TRANSPORT", "-e", "BRAVE_API_KEY", "mcp/brave-search" ], "env": { "BRAVE_MCP_TRANSPORT": "stdio", "BRAVE_API_KEY": "YOUR_API_KEY_HERE" } } } }

### S6 — anthropics/claude-code#29688
https://github.com/anthropics/claude-code/issues/29688
> This results in redundant MCP server processes accumulating — one stdio process per Claude Code session, in addition to the shared HTTP server. ... Open more Claude Code sessions — each one spawns another stdio child process

### S7 — Claude Code docs: Connect Claude Code to tools via MCP
https://code.claude.com/docs/en/mcp
> User-scoped servers are stored in `~/.claude.json` and provide cross-project accessibility, making them available across all projects on your machine while remaining private to your user account.

> When there are multiple servers with the same name, Claude Code applies this precedence: 1. Local scope 2. Project scope 3. User scope

> Environment variables can be expanded in: `command`: the server executable path; `args`: command-line arguments; `env`: environment variables passed to the server; `url`: for HTTP server types; `headers`: for HTTP server authentication

### S8 — docker/mcp-gateway#336
https://github.com/docker/mcp-gateway/issues/336
> I used the button in docker desktop to connect to claude code and I see that it adds the following to my ~/.claude.json · "mcpServers": { "MCP_DOCKER": { "command": "docker", "args": [ "mcp", "gateway", "run" ] } }

> When I look in ~/.claude/debug/latest I see 'MCP server "MCP_DOCKER" Connection failed: Connection to MCP server "MCP_DOCKER" timed out after 30000ms'. But if I run docker mcp gateway run on the command line no issues.

### S9 — anthropics/claude-code#4202
https://github.com/anthropics/claude-code/issues/4202
> Claude Code fails to execute MCP tools when using Docker Desktop's MCP Toolkit integration. All tool calls timeout after 120 seconds despite Gateway showing as connected.

### S10 — Dash0: How to Start a Docker Container
https://www.dash0.com/faq/how-to-start-a-docker-container
> -a (attach) attaches your terminal to the container's stdout and stderr, the same way running without -d does for docker run. ... -i (interactive) keeps stdin open.

### S11 — mekayelanik/brave-search-mcp (Docker Hub)
https://hub.docker.com/r/mekayelanik/brave-search-mcp
> mcp-proxy stateful default shares one stdio backend across sessions and reduced RSS by ~4.6× in our fleet testing. ... MCP_PROXY_STATELESS=false (default): one stdio backend child is shared across all MCP sessions, JSON-RPC-id-multiplexed.
