---
id: TASK-020
title: "Convert brave-search MCP setup to a single global Docker container (persistent named container + per-session exec)"
status: done
created: 2026-07-27
updated: 2026-07-28
depends_on: []
blocks: []
parallel_safe_with: []
uat: "[[UAT-020]]"
tags: [mcp, setup-scripts, docker]
---

# TASK-020 — Convert brave-search MCP setup to a single global Docker container

derived_from::[raw/research/brave-mcp-single-docker-container/index.md](../../../raw/research/brave-mcp-single-docker-container/index.md)

> **Superseded** (2026-07-28): superseded_by::[[TASK-022]] — the exec-wrapper design implemented here was real and statically verified (5/5 static checks), but before runtime UAT it was superseded by [[ROADMAP-003]] Phase 2 / [[TASK-022]] (brave-search → single HTTP-mode Docker container). Closed via /uat-skip; UAT-020 → `skipped`. Runtime verification of the replacement design happens in TASK-025.

## Objective

Replace the npx-based brave-search MCP registration (`npx -y @modelcontextprotocol/server-brave-search`) with a Docker-based setup that yields **exactly one global (user-scoped) brave-search server** backed by **one persistent named container** (`brave-search-mcp`, no `--rm`), auto-started by the command in `~/.claude.json` with zero manual container management by the user.

## Approach

Claude Code spawns the configured stdio command once per session, so a plain `docker run --name` collides when two sessions run concurrently. The research-selected design (see `derived_from` link) decouples "one container" from "one process per session": a wrapper lazily creates/starts a persistent named container idling on `sleep infinity`, then `docker exec`s a fresh server process into it for each session. Target command shape:

```
claude mcp add --scope user brave-search \
  --env "BRAVE_API_KEY=${BRAVE_API_KEY}" \
  -- sh -c 'docker start brave-search-mcp >/dev/null 2>&1 || docker run -d --init --name brave-search-mcp --entrypoint sleep docker.io/mcp/brave-search infinity >/dev/null 2>&1; exec docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js'
```

Design decisions (confirmed with user):

- **Force user scope** — `_add_brave` always registers at `--scope user`, ignoring the interactive scope answer, so no project-scoped entry can shadow the single global server (user scope is lowest precedence).
- **Persistent named container, no `--rm`** — `brave-search-mcp` is always identifiable in Docker Desktop; `docker start` revives it after reboots; concurrent sessions each get their own exec'd process, so no name conflicts and no shared-stdio corruption.
- **Key at exec time** — `-e BRAVE_API_KEY` (value-less) forwards the key from the config's `env` block on every session; it is never baked into the container, so rotation in `~/.claude.json` takes effect next session.
- **`--init`** — tini as PID 1 reaps orphaned children (`sleep` doesn't).
- **No docker-availability guard, no npx fallback** (unchanged prior decision).
- **Known coupling**: `node dist/index.js` is the image's documented `ENTRYPOINT` (verified from the upstream Dockerfile, 2026-07-28); an upstream image restructure would break the exec and surface as a failed server in `claude mcp list`.

Only two files reference the npx package (verified by repo-wide search for `server-brave-search`): `lib/scripts/install-mcps.sh` and `lib/scripts/setup-project.sh`.

## Steps

### 1. Update the installer registration  <!-- agent: general-purpose -->

- [x] In `lib/scripts/install-mcps.sh`, edit `_add_brave()` (lines ~68–78):
  - Replace the command tail `-- npx -y @modelcontextprotocol/server-brave-search` with `-- sh -c 'docker start brave-search-mcp >/dev/null 2>&1 || docker run -d --init --name brave-search-mcp --entrypoint sleep docker.io/mcp/brave-search infinity >/dev/null 2>&1; exec docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js'`.
  - Force user scope: call `mcp_add_scoped user brave-search …` regardless of the `$1` scope argument, with a one-line comment that a project-scoped brave entry would shadow the global one.
  - Keep the `--env "BRAVE_API_KEY=${BRAVE_API_KEY}"` flag and the interactive/non-interactive key-prompting behaviour unchanged.
  - Add a one-line comment noting `node dist/index.js` is the image's ENTRYPOINT (source: brave/brave-search-mcp-server Dockerfile).
- [x] Update the `register_optional_mcp brave-search` interactive prompt text (line ~124) to mention Docker and global scope, e.g. `"Install Brave Search MCP globally (web research, requires API key + Docker)? [y/N]: "`.

### 2. Update the post-setup instructions  <!-- agent: general-purpose -->

- [x] In `lib/scripts/setup-project.sh` (lines ~49–51), update the echoed "To add a key later" block:
  - Replace the npx re-add command with the new `sh -c` wrapper command (same shape as the Approach block, `--scope user`).
- [x] Add an echoed note on updating the server image: `docker rm -f brave-search-mcp && docker pull docker.io/mcp/brave-search` (next session recreates the container on the new image).

### 3. Verify  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-28 (All sections complete: _add_brave → sh -c wrapper + forced user scope; setup-project.sh re-add echo + image-update note; static verification 5/5 pass; runtime smoke/concurrency/key checks deferred to UAT) -->

- [x] Repo-wide search for `server-brave-search` returns zero hits outside `wiki/` and `raw/` history pages.
- [x] `bash -n lib/scripts/install-mcps.sh` and `bash -n lib/scripts/setup-project.sh` pass (syntax check).
- [DEFERRED-TO-UAT] Smoke test locally: `claude mcp remove brave-search -s user`, re-register via the new command, open a session and confirm `claude mcp list` shows brave-search connected, `docker ps` shows one `brave-search-mcp` container (running `sleep`), and a `node dist/index.js` exec process appears while the session is open.
- [DEFERRED-TO-UAT] Concurrency test: open a **second** concurrent session and confirm both sessions' brave-search connect (two exec'd processes, still exactly one container); close both and confirm the container remains (stopped or idle) with no orphan server processes.
- [DEFERRED-TO-UAT] Key-freshness check: confirm the container's own config has no baked `BRAVE_API_KEY` (`docker inspect brave-search-mcp` env shows none) — the key arrives only via exec.
