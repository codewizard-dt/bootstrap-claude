---
id: UAT-020
aliases: [UAT-020]
title: "UAT: Convert brave-search MCP setup to a single global Docker container"
status: skipped
task: TASK-020
created: 2026-07-28
updated: 2026-07-28
---

# UAT-020 — UAT: Convert brave-search MCP setup to a single global Docker container

implements::[[TASK-020]]

> **Source task**: [[TASK-020]]
> **Generated**: 2026-07-28
> **Skipped**: 2026-07-28 via /uat-skip
> **Reason**: TASK-020's exec-wrapper implementation was real and statically verified (5/5 static checks passed), but the design is superseded before runtime UAT by ROADMAP-003 / TASK-022 (brave-search → single HTTP-mode Docker container). Runtime verification of the replacement design lands in TASK-025. superseded_by::[[TASK-022]]

---

## Prerequisites

- [ ] Docker installed and the daemon running (Docker Desktop open)
- [ ] A valid `BRAVE_API_KEY` available in the shell environment
- [ ] `claude` CLI installed and logged in
- [ ] Note: the repo's Serena-first hook blocks `grep`/`cat` on code paths; if a CFG command below is blocked during `/uat-auto`, re-verify the same claim via `mcp__serena__search_for_pattern` (fail-closed otherwise)

---

## Test Cases

### UAT-CFG-001: Installer registers brave-search via the sh -c wrapper
- **Scenario**: `lib/scripts/install-mcps.sh` `_add_brave()` uses the persistent-container wrapper, not npx
- **Steps**:
  1. Run the command below (or Serena-search `install-mcps.sh` for the wrapper string)
- **Command**:
  ```bash
  grep -c "docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js" lib/scripts/install-mcps.sh
  ```
- **Expected Result**: exactly `1` — the wrapper `sh -c 'docker start brave-search-mcp >/dev/null 2>&1 || docker run -d --init --name brave-search-mcp --entrypoint sleep docker.io/mcp/brave-search infinity >/dev/null 2>&1; exec docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js'` appears once as the `mcp_add_scoped` command tail (line ~79)
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (`package.json` `test` is a stub)
- [ ] Pass

### UAT-CFG-002: Brave scope is forced to user
- **Scenario**: `_add_brave` ignores the interactive scope answer; a project-scoped entry can never shadow the global server
- **Steps**:
  1. Run the command below (or Serena-search for both patterns)
- **Command**:
  ```bash
  grep -n "mcp_add_scoped user brave-search\|mcp_add_scoped \"\$1\" brave-search" lib/scripts/install-mcps.sh
  ```
- **Expected Result**: `mcp_add_scoped user brave-search` present (line ~77); `mcp_add_scoped "$1" brave-search` absent; an adjacent comment explains the shadowing rationale
- **Repeatable Unit Test**: Blocked: repo has no shell test harness
- [ ] Pass

### UAT-CFG-003: No live npx package reference remains
- **Scenario**: `@modelcontextprotocol/server-brave-search` is fully retired from live scripts/docs
- **Steps**:
  1. Repo-wide search for `server-brave-search` (Serena `search_for_pattern`, `restrict_search_to_code_files=false`)
- **Expected Result**: zero hits under `lib/`, `bin/`, or `README.md`; hits only in `wiki/` history pages and `raw/research/` snapshots
- **Repeatable Unit Test**: Not applicable: repo-wide content sweep, no unit surface
- [ ] Pass

### UAT-CFG-004: setup-project.sh echoes the identical wrapper + image-update note
- **Scenario**: the "add a key later" instructions match the installer's command byte-for-byte, and the image-update path is documented
- **Steps**:
  1. Run the command below; compare the wrapper substring against `install-mcps.sh` line ~79
- **Command**:
  ```bash
  grep -n "docker exec -i -e BRAVE_API_KEY brave-search-mcp\|docker rm -f brave-search-mcp && docker pull docker.io/mcp/brave-search" lib/scripts/setup-project.sh
  ```
- **Expected Result**: two hits — the re-add echo (line ~51) containing the identical `sh -c` wrapper with `--scope user`, and the image-update note (line ~54) `docker rm -f brave-search-mcp && docker pull docker.io/mcp/brave-search`
- **Repeatable Unit Test**: Blocked: repo has no shell test harness
- [ ] Pass

### UAT-CFG-005: Both scripts pass bash syntax check
- **Scenario**: static gate regression
- **Steps**:
  1. `bash -n lib/scripts/install-mcps.sh`
  2. `bash -n lib/scripts/setup-project.sh`
- **Expected Result**: both exit 0 with no output
- **Repeatable Unit Test**: Not applicable: `bash -n` is itself the repeatable check; no harness to house it
- [ ] Pass

### UAT-INT-001: Smoke test — registration connects and creates exactly one named container
- **Scenario**: fresh registration via the new wrapper works end-to-end
- **Steps**:
  1. `claude mcp remove brave-search -s user` (if registered)
  2. Re-register: `claude mcp add --scope user brave-search --env "BRAVE_API_KEY=$BRAVE_API_KEY" -- sh -c 'docker start brave-search-mcp >/dev/null 2>&1 || docker run -d --init --name brave-search-mcp --entrypoint sleep docker.io/mcp/brave-search infinity >/dev/null 2>&1; exec docker exec -i -e BRAVE_API_KEY brave-search-mcp node dist/index.js'`
  3. Open a Claude Code session; run `claude mcp list` (or `/mcp`)
  4. `docker ps --filter name=brave-search-mcp`
  5. Inside a session, exercise a brave tool (e.g. one `brave_web_search` call)
- **Expected Result**: brave-search shows connected; exactly one `brave-search-mcp` container running (`sleep infinity` as PID 1 via tini); a `node dist/index.js` exec process exists while the session is open; the search call returns results
- **Repeatable Unit Test**: Not applicable: live Docker + Claude CLI integration
- [ ] Pass

### UAT-INT-002: Concurrency — two sessions share one container without collision
- **Scenario**: the design goal that replaced `docker run --rm --name` (which collided)
- **Steps**:
  1. With UAT-INT-001's session still open, open a second concurrent Claude Code session
  2. Confirm brave-search connects in both (`/mcp` in each)
  3. `docker ps --filter name=brave-search-mcp` — still exactly one container
  4. Count exec'd server processes: `docker exec brave-search-mcp ps aux` should show two `node dist/index.js` processes
  5. Close both sessions; re-check `docker exec brave-search-mcp ps aux`
- **Expected Result**: both sessions' brave-search connect; exactly one container throughout; two exec'd `node dist/index.js` processes while both sessions are open; zero server processes (only `sleep`/tini) after both close; container still present
- **Repeatable Unit Test**: Not applicable: multi-session runtime behavior
- [ ] Pass

### UAT-EDGE-001: Stopped container is revived automatically
- **Scenario**: the wrapper's `docker start` branch (e.g. after reboot)
- **Steps**:
  1. With no session open, `docker stop brave-search-mcp`
  2. Open a new Claude Code session
  3. Check `/mcp` and `docker ps --filter name=brave-search-mcp`
- **Expected Result**: brave-search connects without any manual container action; the same container (same ID as before the stop) is running again
- **Repeatable Unit Test**: Not applicable: live Docker lifecycle behavior
- [ ] Pass

### UAT-EDGE-002: API key is never baked into the container
- **Scenario**: key rotation in `~/.claude.json` must take effect next session
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  docker inspect brave-search-mcp --format '{{.Config.Env}}'
  ```
- **Expected Result**: output contains no `BRAVE_API_KEY` entry — the key reaches the server only via `docker exec -e BRAVE_API_KEY` at session start
- **Repeatable Unit Test**: Not applicable: docker runtime inspection
- [ ] Pass
