---
topic: a user scoped mcp --- if multiple sessions are active, why does it start a new mcp process for each session? can we enforce one process per user mcp globally?
slug: mcp-one-process-per-user
researched: 2026-07-28
sources: [./sources.md]
---

# Research: Why user-scoped MCPs spawn one process per session, and whether one global process is enforceable

> **Answer, part 1 (why):** it's the MCP protocol's stdio design, not a Claude Code quirk — the spec defines stdio as "the client launches the MCP server as a subprocess" with the process lifecycle bound to that one client (close stdin → terminate) [S3]; there is no in-protocol multiplexing for stdio [S6], and each Claude Code session is an independent MCP client with no shared daemon between sessions — host-level sharing is an **open, unimplemented feature request** (anthropics/claude-code#28860, #40220) [S4][S5]. **Answer, part 2 (can we enforce one process):** yes, but only by leaving stdio registration: the Streamable HTTP transport is explicitly designed so "the server operates as an independent process that can handle multiple client connections" [S3]. Register the user-scoped server with `--transport http` against one long-lived local server (for brave: the same Docker image in `BRAVE_MCP_TRANSPORT=http` mode with `--restart unless-stopped`) and Claude Code spawns **zero** per-session processes. The trade-off is auto-start: an HTTP entry in `~/.claude.json` is just a URL, so the one-time server start moves to the install script + a Docker restart policy. > Builds on [brave-mcp-single-docker-container](../brave-mcp-single-docker-container/index.md), whose exec-wrapper (shipped as TASK-020) shares one *container* but still runs one *server process per session*.

## Research Questions

1. Is one-process-per-session a Claude Code implementation choice or an MCP protocol property?
2. Does Claude Code have any mechanism (config, flag, daemon) to share a stdio server across concurrent sessions?
3. What patterns achieve exactly one server process globally, and what does each cost?
4. What keeps a shared server alive without manual user management?
5. What would change relative to the just-shipped TASK-020 exec-wrapper design?

## Current State (Codebase)

- `lib/scripts/install-mcps.sh::_add_brave` (post-TASK-020, `pending-uat`) registers brave-search at forced user scope with the `sh -c` wrapper: persistent named container `brave-search-mcp` idling on `sleep infinity`, plus `docker exec -i … node dist/index.js` per session [S1]. This yields **one container but N server processes** for N concurrent sessions — it solved the name-collision and manual-management problems, not process count.
- The prior research report documents the full option space that led there, including the HTTP option it rejected *only* because of the "must start via the command in `.claude.json`" constraint [S2].

## Key Findings

1. **The per-session process is protocol design.** MCP's stdio transport: "The client launches the MCP server as a subprocess" and the message loop ends with "Close stdin, terminate subprocess" — the server's lifetime *is* the client connection [S3]. A community issue states it crisply: "The MCP spec defines stdio as 1 client : 1 subprocess; there's no in-protocol multiplexing for stdio" [S6].
2. **Each Claude Code session is an independent MCP client.** Nothing coordinates MCP processes between sessions; 4 sessions × 6 servers = 24 processes. Sharing is filed as feature request #28860 ("Shared MCP daemon: A single MCP server process per workspace that multiplexes requests") and #40220 (a "singleton/shared mode" for servers holding singleton resources) — both open enhancements, not shipped behavior [S4][S5]. So today, **no Claude Code config can make a stdio-registered server shared**.
3. **Streamable HTTP is the sanctioned single-process path.** Per the spec, an HTTP MCP server "operates as an independent process that can handle multiple client connections", with per-client `Mcp-Session-Id` session management [S3]. Issue #63749 reaches the same conclusion: "When a server supports it, multiple clients can share one process per spec. This is the cleanest path for servers that can run as HTTP" [S6].
4. **The brave image natively supports HTTP mode** — `BRAVE_MCP_TRANSPORT=http` (or `--transport http`), port 8080, with DNS-rebinding protections (`--allowed-origins`/`--allowed-hosts`) [S9]. One `docker run -d --restart unless-stopped` container = one server process for all sessions, surviving reboots via Docker's restart policy (given Docker Desktop starts at login).
5. **For stdio-only servers you can still get one *server* process** via a bridge: `mcp-remote` (npm) lets stdio-only registrations connect to a remote/local HTTP server [S7], and `sparfenyuk/mcp-proxy` bridges both directions — including exposing one stdio backend over HTTP so all sessions share it [S8]. Cost: one thin proxy process per session remains (strictly "one *server* process + N proxies", not "one process").
6. **Caveat:** a reported Claude Code bug spawned a stdio child even for HTTP-configured servers (#29688, platform:windows) — worth a `ps` check after switching; on macOS the HTTP path is the expected zero-spawn behavior [S10].

## Constraints

- Protocol: stdio can never be shared — enforcement requires HTTP registration or a bridge; no Claude Code setting exists (or is on a roadmap with a date) for host-level sharing [S4][S6].
- An HTTP entry in `~/.claude.json` starts nothing — the "starts via the command in `.claude.json`" constraint from the prior research must be relaxed to "started once by the installer, kept alive by Docker" [S2].
- Spec security for local HTTP servers: bind localhost only; validate `Origin` [S3]. The brave server ships these controls [S9].
- TASK-020 is `pending-uat` — switching to HTTP supersedes its wrapper design; decide before running UAT-020.

## Solution Comparison

| Option | Server processes (N sessions) | Per-session spawns | Auto-start | Enforces "one process"? | Notes |
|--------|------------------------------|--------------------|-----------|------------------------|-------|
| **A. TASK-020 exec-wrapper (shipped, pending-uat)** | N (in 1 container) | 1 exec each | ✅ via config | ❌ | Solves collisions + manual mgmt, not process count [S1] |
| **B. HTTP registration + long-lived container** (recommended) | **1** | **0** | Installer does one `docker run -d --restart unless-stopped`; Docker revives it thereafter | ✅ | Spec-sanctioned multi-client [S3]; brave supports HTTP natively [S9] |
| **C. Hybrid: stdio wrapper ensures HTTP backend, execs `mcp-remote` per session** | 1 (+N thin proxies) | 1 proxy each | ✅ via config | ◐ (one *server* process) | Keeps config auto-start; adds npx/`mcp-remote` dependency [S7][S8] |
| **D. Wait for host-level sharing in Claude Code** | 1 (hypothetical) | 0 | n/a | n/a | #28860/#40220 open, unscheduled [S4][S5] |

## Recommendation

**Option B** if "exactly one process per user-scoped MCP" is the goal — it is the only pattern that fully enforces it, and it's what the protocol intends for shared servers. For brave-search:

```bash
# one-time, done by the install script (not the user):
docker run -d --restart unless-stopped --name brave-search-mcp \
  -e BRAVE_API_KEY -e BRAVE_MCP_TRANSPORT=http \
  -p 127.0.0.1:8080:8080 docker.io/mcp/brave-search

claude mcp remove brave-search -s user 2>/dev/null
claude mcp add --scope user --transport http brave-search http://127.0.0.1:8080/mcp
```

- Zero per-session spawns; one named container that is also the one server process; key rotation = `docker rm -f` + re-run (script can encapsulate).
- `--restart unless-stopped` + Docker Desktop login-start replaces the wrapper's `docker start` branch — no manual management after install.
- Bind to `127.0.0.1` only (spec security guidance [S3]).

**Risks & mitigations:** Docker Desktop not running at session start → server unreachable (surface: `claude mcp list` shows failed; mitigation: Docker Desktop "start at login", which the exec-wrapper equally depends on). #29688-style stdio-child bug → verify with `ps` after switching [S10]. Port 8080 collisions → make the port configurable in the script and in the registered URL.

**Alternative if constraints change:** if config-driven auto-start must be preserved exactly, Option C (wrapper + `mcp-remote`) gives one server process at the cost of thin per-session proxies; if per-session server processes are actually acceptable and only container hygiene matters, keep shipped Option A.

## Next Steps

- This is now a genuine architecture fork (A vs. B) touching an in-flight task: `/decision-create single-process strategy for user-scoped brave MCP (HTTP registration vs stdio exec-wrapper)` — or, if B is simply chosen: `/task-update wiki/work/tasks/TASK-020-brave-search-mcp-docker.md switch to HTTP-mode container + --transport http registration per raw/research/mcp-one-process-per-user/index.md` before running UAT-020.
- `/wiki-ingest raw/research/mcp-one-process-per-user/index.md` to synthesize into the knowledge base.
