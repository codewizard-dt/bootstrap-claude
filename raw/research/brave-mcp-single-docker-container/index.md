---
topic: a setup that only has 1 global (user scoped) brave mcp server via docker, does not require the user to set up the server manually (starts via the command in .claude.json), and uses a named container (remove the rm flag if necessary)
slug: brave-mcp-single-docker-container
researched: 2026-07-28
sources: [./sources.md]
---

# Research: Single global user-scoped Brave MCP server via a named Docker container, auto-started from `.claude.json`

> **Answer:** Register brave-search once at user scope (stored in `~/.claude.json` [S7]) with a small shell wrapper as the server command. The wrapper lazily creates/starts one **persistent named container** (`brave-search-mcp`, no `--rm`, entrypoint overridden to `sleep infinity`) and then `docker exec -i`s a fresh server process (`node dist/index.js` — the image's real entrypoint [S4]) into it for each session. This is necessary because Claude Code spawns the configured stdio command **once per session** [S6] — so "one container" and "one process" cannot both be true for stdio; the exec pattern gives exactly one named container with N short-lived server processes inside it, which is concurrency-safe, needs zero manual setup, and keeps the API key fresh per session.

## Research Questions

1. How does Claude Code launch user-scoped stdio MCP servers — one process per session or shared?
2. What does the `docker.io/mcp/brave-search` image actually run (entrypoint, transports, env contract)?
3. What command shape yields exactly one named container across sessions with no manual setup — `docker run --name`, `docker start -a` reuse, persistent container + `docker exec`, long-lived HTTP container, or Docker's MCP Gateway?
4. Where does the user-scoped config live and does it support env-var handling suitable for the API key?
5. What changes versus the current TASK-020 plan (`docker run -i --rm --name`)?

## Current State (Codebase)

- `lib/scripts/install-mcps.sh::_add_brave` registers brave-search via `mcp_add_scoped` → `claude mcp add --scope user brave-search --env "BRAVE_API_KEY=${BRAVE_API_KEY}" -- npx -y @modelcontextprotocol/server-brave-search` (project scope also possible interactively) [S1]. `register_optional_mcp` skips if already installed, so the script never double-registers [S1].
- `lib/scripts/setup-project.sh` echoes matching manual re-add instructions [S1].
- `wiki/work/tasks/TASK-020-brave-search-mcp-docker.md` (status `todo`, created 2026-07-27) already plans a Docker conversion but as `docker run -i --rm --name brave-search-mcp` — it documents the very defect this research resolves: with `--rm` + a fixed `--name`, two concurrent sessions collide on the container name [S2].

## Key Findings

1. **Claude Code spawns one stdio child process per session.** Every new session runs the configured `command` again; multiple sessions mean multiple concurrent invocations of it [S6]. Any design must tolerate N concurrent invocations.
2. **User scope lives in `~/.claude.json`** (top-level `mcpServers`), is cross-project, and is the *lowest*-precedence scope — a local- or project-scoped server with the same name shadows it, so achieving "only 1 global server" also means not registering brave-search at project scope anywhere [S7].
3. **The `mcp/brave-search` image is the official `brave/brave-search-mcp-server`.** `ENTRYPOINT ["node", "dist/index.js"]`, `USER node`, `WORKDIR /app` [S4]. Stdio is the default transport; HTTP is available via `BRAVE_MCP_TRANSPORT=http` / `--transport http` (port 8080); the key comes from `BRAVE_API_KEY` (or `BRAVE_API_KEY_FILE`) [S3]. The Docker MCP Catalog's canonical config is `docker run -i --rm -e BRAVE_API_KEY mcp/brave-search` — ephemeral, unnamed-by-default, one container per session [S5].
4. **`docker start -a` reuse is not concurrency-safe.** `docker start -ai <name> || docker run -i --name <name>` works for sequential sessions (start revives the stopped container and attaches stdio [S10]), but a second concurrent session attaches to the *same* stdio stream — two JSON-RPC clients multiplexed onto one stdin/stdout with no framing to separate them *(inference — no primary source; follows from stdio MCP having exactly one client per stream)*. Env is also frozen at container-creation time, so key rotation would require deleting the container.
5. **Persistent container + `docker exec -i` decouples "one container" from "one process per session".** The container is created once (named, no `--rm`, `--entrypoint sleep … infinity` so it idles), revived with `docker start` when stopped, and each session runs `docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js`. Exec'd processes inherit the image's `WORKDIR`/`USER`, exit on stdin EOF when the session closes, and `-e BRAVE_API_KEY` (value-less) forwards the key fresh from the wrapper's environment each session — which Claude Code populates from the config's `env` block [S4][S7]. `--init` on the `docker run` makes tini PID 1 so orphaned children get reaped *(inference for the reaping rationale; `--init` behavior is standard Docker)*.
6. **Docker's MCP Gateway is the official "one entry, many servers" alternative** — Docker Desktop writes `"MCP_DOCKER": {"command": "docker", "args": ["mcp", "gateway", "run"]}` into `~/.claude.json` [S8] — but the gateway names and manages containers itself (no user-chosen container name), requires Docker Desktop's MCP Toolkit, and has open Claude Code timeout issues [S8][S9]. It also still spawns one gateway process per session.
7. **A long-lived HTTP container is the only way to get literally one server process**, and third-party images exist that bridge stdio→HTTP precisely to share one backend across sessions [S11]. But an HTTP registration in `~/.claude.json` is just a URL — nothing in the config starts the container, failing the "starts via the command in `.claude.json`" requirement.

## Constraints

- Must survive N concurrent Claude Code sessions (each spawning the command) without name collisions or stream corruption.
- Must be a single user-scope registration; no project-scope duplicates (they would shadow it [S7]).
- Container must be named (`brave-search-mcp`) and visible/identifiable in Docker Desktop; `--rm` may be dropped.
- No manual `docker run`/`docker start` by the user — the `.claude.json` command does everything; per prior user decision on TASK-020, no docker-availability guard and no npx fallback [S2].
- The exec pattern pins the server start command (`node dist/index.js`) — a change to the image's layout would break it; the plain-entrypoint options do not have this coupling [S4].

## Solution Comparison

| Option | One named container? | Concurrent sessions | Auto-start from config | Complexity | Notes |
|--------|---------------------|--------------------|-----------------------|------------|-------|
| **A. `docker run -i --rm --name`** (TASK-020 plan) | Yes, but ephemeral | ❌ name conflict, 2nd session's MCP fails [S2] | ✅ | Low | Canonical catalog shape + name [S5] |
| **B. `docker start -ai` ∥ `docker run -i --name` (no `--rm`)** | Yes, persistent | ❌ two clients attach to one stdio stream *(inference)* | ✅ | Low | Env frozen at creation; key rotation needs container delete |
| **C. Persistent container + `docker exec -i` per session** (recommended) | ✅ exactly one | ✅ one exec'd process per session | ✅ | Medium | Pins `node dist/index.js` [S4]; container idles on `sleep infinity` |
| **D. Long-lived HTTP container + `--transport http` registration** | ✅ exactly one, one *process* | ✅ | ❌ URL config starts nothing | Medium | Needs one manual/scripted `docker run -d`; best "true single server" if the auto-start constraint relaxes [S3][S11] |
| **E. Docker MCP Gateway (`docker mcp gateway run`)** | ❌ gateway-managed names | ✅ | ✅ | High (Docker Desktop MCP Toolkit) | Known Claude Code timeout issues [S8][S9]; replaces per-server registration model |

## Recommendation

**Option C.** Register once at user scope with a wrapper command; resulting `~/.claude.json` entry:

```json
"brave-search": {
  "command": "sh",
  "args": [
    "-c",
    "docker start brave-search-mcp >/dev/null 2>&1 || docker run -d --init --name brave-search-mcp --entrypoint sleep docker.io/mcp/brave-search infinity >/dev/null 2>&1; exec docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js"
  ],
  "env": { "BRAVE_API_KEY": "<key>" }
}
```

Installer form (replacing `_add_brave`'s command tail in `lib/scripts/install-mcps.sh`):

```bash
mcp_add_scoped "$1" brave-search \
  --env "BRAVE_API_KEY=${BRAVE_API_KEY}" \
  -- sh -c 'docker start brave-search-mcp >/dev/null 2>&1 || docker run -d --init --name brave-search-mcp --entrypoint sleep docker.io/mcp/brave-search infinity >/dev/null 2>&1; exec docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js'
```

How it satisfies each requirement:
- **1 global server** — single `--scope user` registration in `~/.claude.json`; for this goal the installer should force user scope for brave-search (skip the interactive project-scope option) so no project entry shadows it [S7].
- **No manual setup** — first session creates the container; later sessions `docker start` it if stopped (e.g. after reboot) and exec into it. The API key is never baked into the container — it's forwarded at exec time from the config's `env` block, so rotating the key in `~/.claude.json` takes effect next session.
- **Named container, no `--rm`** — `brave-search-mcp` persists and is always identifiable in Docker Desktop (running `sleep` when idle).

**Risks & mitigations:**
- *Entrypoint pinning*: `node dist/index.js` comes from the image's Dockerfile [S4]; if upstream changes it, the exec fails visibly in `claude mcp list`. Mitigation: comment in the script citing the Dockerfile; re-verify on image updates.
- *Image updates*: the persistent container stays on its creation-time image. Update path: `docker rm -f brave-search-mcp && docker pull docker.io/mcp/brave-search` — next session recreates it. Worth an echo line in `setup-project.sh`.
- *First-run race*: two sessions starting simultaneously with no container — both `docker run -d`, one loses the name race, but the `;` before `exec` means the loser still execs into the winner's container. A sub-second window exists where exec can beat container readiness; in practice Claude Code retries the connection.
- *Zombie processes*: `sleep` as PID 1 doesn't reap; `--init` (tini) does.

**Alternative if constraints change:** if "must start from `.claude.json`" is ever relaxed, Option D (one HTTP-mode container with `--restart unless-stopped`, registered as `--transport http http://localhost:8080/mcp`) is strictly simpler at runtime — literally one server process, no wrapper, no entrypoint pinning [S3].

## Next Steps

- **Update TASK-020** rather than file a new task — its `docker run -i --rm --name` plan is superseded by this design: `/task-update wiki/work/tasks/TASK-020-brave-search-mcp-docker.md replace the run command with the persistent-container + docker exec wrapper from raw/research/brave-mcp-single-docker-container/index.md; force user scope for brave-search`
- `/wiki-ingest raw/research/brave-mcp-single-docker-container/index.md` to synthesize into the knowledge base.
- Optional follow-up: verify on this machine that `docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js` completes an MCP handshake from two concurrent sessions before landing the installer change.
