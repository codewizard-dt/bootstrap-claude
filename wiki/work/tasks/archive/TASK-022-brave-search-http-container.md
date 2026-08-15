---
id: TASK-022
aliases: [TASK-022]
title: "brave-search → single HTTP-mode Docker container (supersedes TASK-020 exec-wrapper)"
status: done
created: 2026-07-28
updated: 2026-07-28
depends_on: [TASK-021]
blocks: [TASK-024, TASK-025]
parallel_safe_with: [TASK-023]
uat: "[[UAT-022]]"
tags: [mcp, setup-scripts, docker]
---

# TASK-022 — brave-search → single HTTP-mode Docker container

<!-- Updated: 2026-07-28 14:15 -->

derived_from::[raw/research/mcp-one-process-per-user/index.md](../../../raw/research/mcp-one-process-per-user/index.md)
implements::[[ROADMAP-003]] Phase 2 · supersedes::[[TASK-020]]

## Objective

Replace the TASK-020 stdio exec-wrapper with a true single-process design: one long-lived HTTP-mode `brave-search-mcp` container (`--restart unless-stopped`) serving all sessions, registered at user scope with `--transport http` — zero per-session spawns, no secrets in `~/.claude.json`.

## Approach

The container runs the image's ENTRYPOINT (`node dist/index.js`) with appended args `--transport http --host 0.0.0.0 --port 8941` (in-container 0.0.0.0 is required for the port map; the host publish stays loopback-only per MCP spec security guidance). Port 8941 is used on **both** sides of the mapping — user requirement: no 8080 anywhere, it's too common among local dev processes. Key pitfall from plan review: value-less `docker -e BRAVE_API_KEY` only forwards **exported** variables and `read` doesn't export — use a prefix assignment on the `docker run` command. Old-shape containers from the exec-wrapper era are detected by `docker inspect -f '{{.Path}}'` (`sleep` = old, `node` = converted).

## Steps

### 1. Rewrite _add_brave  <!-- agent: general-purpose -->

- [x] In `lib/scripts/install-mcps.sh`, replace `_add_brave()`'s registration block (keep the interactive/non-interactive key prompting, with TASK-021's EOF guard):
  1. Docker guard first: `docker info >/dev/null 2>&1 || { echo "  Docker not running — skipping brave-search (re-run 'bootstrap update' with Docker up)"; return 0; }`
  2. Old-container migration:
     ```bash
     case "$(docker inspect -f '{{.Path}}' brave-search-mcp 2>/dev/null)" in
       sleep) docker rm -f brave-search-mcp >/dev/null ;;   # old exec-wrapper container
       node)  docker start brave-search-mcp >/dev/null 2>&1 || true ;;  # already converted
     esac
     ```
  3. If the container doesn't exist now, create it (prefix assignment — see Approach):
     ```bash
     BRAVE_API_KEY="$BRAVE_API_KEY" docker run -d --restart unless-stopped \
       --name brave-search-mcp -e BRAVE_API_KEY \
       -p "127.0.0.1:${BRAVE_MCP_PORT}:8941" docker.io/mcp/brave-search \
       --transport http --host 0.0.0.0 --port 8941
     ```
     Comment: key is baked into container env (visible via `docker inspect` to docker-socket holders; accepted trade-off — it is out of `~/.claude.json`); rotation = `docker rm -f brave-search-mcp` + re-run `bootstrap update`.
  4. Register: `mcp_add_scoped user brave-search --transport http "$BRAVE_MCP_URL"` (keep the forced-user-scope comment).
  5. Verification + hints: `wait_http_up "$BRAVE_MCP_URL" && echo "  brave-search: listening on $BRAVE_MCP_URL" || echo "  WARNING: brave-search endpoint not answering — check 'docker logs brave-search-mcp'"`; echo a one-liner reminding to enable Docker Desktop "Start when you sign in".

### 2. Wire upgrade detection  <!-- agent: general-purpose -->

- [x] Update the `register_optional_mcp brave-search …` call site (line ~126) to pass `"$BRAVE_MCP_URL"` as the 4th arg, so machines carrying the old stdio exec-wrapper entry auto-upgrade on the next `bootstrap update`.

### 3. Verify  <!-- agent: general-purpose -->

- [x] `bash -n lib/scripts/install-mcps.sh` passes.
- [x] Serena search: no `docker exec -i` / `--entrypoint sleep` remnants in `lib/`; registration uses `$BRAVE_MCP_URL`; `--env "BRAVE_API_KEY=` no longer appears in the brave registration (no secret in claude config).
  - [x] Discovered: `lib/scripts/setup-project.sh` line 51 still echoes the old exec-wrapper manual instruction (`--entrypoint sleep` / `docker exec -i` / `--env BRAVE_API_KEY=<key>`) — update it to the new `--transport http` + `$BRAVE_MCP_URL` form (only `8080` hit elsewhere is a benign generic Mermaid example in `lib/skills/mermaid-flowchart/SKILL.md`)
- [x] Runtime verification deferred to TASK-025 (local migration doubles as UAT). [DEFERRED-TO-UAT]
