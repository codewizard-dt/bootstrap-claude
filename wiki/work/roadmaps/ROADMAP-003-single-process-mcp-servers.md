---
id: ROADMAP-003
title: "Single-process (shared HTTP) MCP servers for the bootstrap"
status: active
created: 2026-07-28
updated: 2026-07-28
owner: David Taylor
tags: [mcp, setup-scripts, docker, launchd]
---

# ROADMAP-003 — Single-process (shared HTTP) MCP servers

derived_from::[raw/research/mcp-one-process-per-user/index.md](../../../raw/research/mcp-one-process-per-user/index.md)

## Goal

Convert every bootstrap-installed user-scoped MCP server from per-session stdio spawns to **one shared HTTP server process globally**. Claude Code spawns one stdio subprocess per session (MCP spec: stdio = 1 client : 1 subprocess; host-level sharing is an open, unshipped Claude Code feature request) — Streamable HTTP registration against a long-lived local server is the only enforcement mechanism.

**Per-server dispositions (user-confirmed):**
- **brave-search** → HTTP-mode Docker container (`--restart unless-stopped`, host port `${BRAVE_MCP_PORT:-8941}` → container 8941, loopback-only publish; **no 8080 anywhere** — user requirement, too common among local dev processes); supersedes TASK-020's stdio exec-wrapper.
- **playwright** → native macOS **launchd LaunchAgent** (preserves headed browser; HTTP mode gives each client an isolated browser context), port `${PLAYWRIGHT_MCP_PORT:-8931}`; non-darwin keeps stdio.
- **context7** — already remote HTTP; no change.
- **serena** — **deferred** (project-scoped, per-project ports + health-hook interactions; future research).
- **Separate declarative MCP config file** — considered, rejected: registration is provisioning *behavior* (key prompts, container/plist lifecycle, platform branches), `add-json` would need jq/python against lib.sh's bash-3.2/no-deps constraint, N=3 doesn't earn it. Mitigation: hoist name/port/URL constants to the top of `install-mcps.sh`.

Full implementation detail (exact commands, plist keys, known pitfalls like the `-e` export bug and launchd/npx fragility) is in the research report above and recap notes per phase below.

## Phase 0: Close out TASK-020

- [x] [[TASK-020: Convert brave-search MCP setup to a single global Docker container]] — close via `/uat-skip`: exec-wrapper implementation was real and statically verified but is superseded before runtime UAT; UAT-020 → `skipped`, TASK-020 → `done` with a supersession note pointing here

## Phase 1: Shared plumbing (lib.sh + install-mcps.sh)

- [x] [[TASK-021: Shared plumbing for single-process HTTP MCP servers]] — port/URL constants (`BRAVE_MCP_PORT:-8941`, `PLAYWRIGHT_MCP_PORT:-8931`, derived `http://127.0.0.1:<port>/mcp`); lib.sh helpers `mcp_matches <name> <expected-substring>` (fixed-string `grep -qF` on `claude mcp get`) and `wait_http_up <url> [tries]` (curl `%{http_code}`, any status ≠ 000 = up, never `curl -f`); `register_optional_mcp` optional 4th arg `expected` (match → skip; mismatch → print "upgrading", `claude mcp remove -s user`, re-run adder; expected passed for brave always, playwright darwin-only); fix latent `read -r BRAVE_API_KEY` EOF failure under `set -e` (install-mcps.sh:73-74)

## Phase 2: brave-search → HTTP-mode container

- [x] [[TASK-022: brave-search → single HTTP-mode Docker container]] — rewrite `_add_brave`: `docker info` guard (skip + hint, never abort `run_project_sync`); old-shape migration via `docker inspect -f '{{.Path}}'` (`sleep` → rm old exec-wrapper container; `node` → `docker start`, already converted); run `BRAVE_API_KEY="$BRAVE_API_KEY" docker run -d --restart unless-stopped --name brave-search-mcp -e BRAVE_API_KEY -p "127.0.0.1:${BRAVE_MCP_PORT}:8941" docker.io/mcp/brave-search --transport http --host 0.0.0.0 --port 8941` (prefix-assignment because value-less `-e` only forwards *exported* vars; in-container port also 8941 — no 8080 anywhere per user requirement); register `--transport http` at forced user scope, no secrets in `~/.claude.json`; `wait_http_up` + Docker Desktop start-at-login reminder

## Phase 3: playwright → launchd LaunchAgent (darwin)

- [x] [[TASK-023: playwright → native launchd LaunchAgent HTTP server]] — rewrite `_add_playwright` with darwin branch: `npm install -g @playwright/mcp@latest`, resolve `NODE_BIN`/`PW_CLI="$(npm root -g)/@playwright/mcp/cli.js"` (never `npx @latest` under launchd — PATH/shebang/registry-fetch crash-loop); write `~/Library/LaunchAgents/com.bootstrap-claude.playwright-mcp.plist` (`ProgramArguments` node+cli `--port … --host 127.0.0.1`, `RunAtLoad`, `KeepAlive={SuccessfulExit:false}`, `ThrottleInterval` 30, `LimitLoadToSessionType Aqua`, logs `~/Library/Logs/playwright-mcp.log`); idempotent content-compare + `bootout`/`bootstrap gui/$UID`/`kickstart -k`, SSH/no-GUI "Bootstrap failed: 5" hint; register `--transport http http://127.0.0.1:${PLAYWRIGHT_MCP_PORT}/mcp` forced user scope; non-darwin keeps stdio npx; `wait_http_up` + `launchctl print` diagnostics on failure

## Phase 4: Docs & guide alignment

- [x] [[TASK-024: Docs & guide alignment for single-process HTTP MCP servers]] — `setup-project.sh:46-58` epilogue (rotation = `docker rm -f` + `bootstrap update`; `launchctl kickstart -k`; port env overrides); README.md lines 43-47/132/146/165-168/198-200/326-327/468; CLAUDE.md:81-84 incl. stale "1 req/sec" brave claim; `build-mcp-guide.sh:100` contradictory "sequential, 1/sec" Quick-Reference row; `templates/guides/stubs/playwright.md:20` shared-server note; add project-`.mcp.json` playwright-shadowing hint echo (reuse `serena_installed` grep pattern)

## Phase 5: Migrate this machine (doubles as runtime UAT)

- [ ] [[TASK-025: Migrate this machine's MCP registrations to the single-process design]] — `claude mcp remove brave-search|playwright -s user`, `docker rm -f brave-search-mcp` (old sleep container), re-run `install-mcps.sh` non-interactively; verify both connected in `claude mcp list`, two concurrent sessions → exactly one brave container process + one playwright cli.js process total with zero per-session children (guards claude-code#29688-style stdio-child bug), reboot survival (`--restart unless-stopped` + `RunAtLoad`), live `brave_web_search` + `browser_snapshot` calls
