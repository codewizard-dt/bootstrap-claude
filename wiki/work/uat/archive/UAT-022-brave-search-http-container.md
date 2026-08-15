---
id: UAT-022
aliases: [UAT-022]
title: "UAT: brave-search → single HTTP-mode Docker container (supersedes TASK-020 exec-wrapper)"
status: passed
task: TASK-022
created: 2026-07-28
updated: 2026-07-28
---

# UAT-022 — UAT: brave-search → single HTTP-mode Docker container

implements::[[TASK-022]]

> **Source task**: [[TASK-022]]
> **Generated**: 2026-07-28

---

## Prerequisites

- [ ] Run every command from the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`)
- [ ] No live Docker daemon, `claude` CLI state, or network is needed for any SH/EDGE test — each one shims `claude`, `docker`, and `curl` (and `sleep` in UAT-SH-005) via a `mktemp -d` PATH prefix scoped to that single command, so real user-scope MCP registrations and real containers are never read or modified. Shim invocations are recorded to log files inside the temp dir and printed with bash-native `$(<file)` (no `cat`)
- [ ] Note: the repo's Serena-first hook blocks `grep`/`cat` on code paths; every deterministic content claim in this file (`_add_brave` at `install-mcps.sh:85-118` — docker guard :96, migration case :98-101, prefix-assigned `docker run` :108-111, registration :114, `wait_http_up` echo :115-116, Docker Desktop tip :117; constants at `install-mcps.sh:28-30`; 4-arg brave call site at `install-mcps.sh:163-164`; upgrade branch at `install-mcps.sh:58-68`; `wait_http_up` at `lib.sh:55`; `mcp_matches` at `lib.sh:47`; setup-project.sh echo block at :50-52; zero `docker exec -i` / `entrypoint sleep` / `8080` hits under `lib/scripts/`) was pre-verified via `mcp__serena__search_for_pattern` at generation time (2026-07-28). If a CFG grep command below is blocked during `/uat-auto`, re-verify the same claim via Serena instead of failing open. Cited line numbers are as reported by Serena — treat them as approximate anchors; the quoted content is the binding assertion

---

## Test Cases

### UAT-CFG-001: Both changed scripts pass bash syntax check
- **Scenario**: static gate regression for the TASK-022 edits to `install-mcps.sh` and `setup-project.sh`
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  bash -n lib/scripts/install-mcps.sh && bash -n lib/scripts/setup-project.sh && echo SYNTAX-OK
  ```
- **Expected Result**: `SYNTAX-OK` with no other output; exit 0
- **Repeatable Unit Test**: Not applicable: `bash -n` is itself the repeatable check; no harness to house it
- [x] Pass <!-- 2026-07-28 -->

### UAT-CFG-002: _add_brave contains the full HTTP-container flow and the call site passes the upgrade-detection URL
- **Scenario**: static content of the rewritten `_add_brave` (install-mcps.sh:85-118) — docker guard, `{{.Path}}` migration case, prefix-assigned `docker run` publishing `127.0.0.1:${BRAVE_MCP_PORT}:8941` (8941 on **both** sides — no 8080 anywhere, user requirement), forced-user-scope HTTP registration via `$BRAVE_MCP_URL`, and the `register_optional_mcp brave-search … "$BRAVE_MCP_URL"` 4th arg that arms stdio→http upgrade detection
- **Steps**:
  1. Run the command below (or re-verify via `mcp__serena__search_for_pattern` if the hook blocks grep)
- **Command**:
  ```bash
  grep -nE 'docker info >/dev/null|docker inspect -f|docker rm -f brave-search-mcp|docker start brave-search-mcp|docker run -d --restart unless-stopped|:8941|--transport http|mcp_add_scoped user brave-search|_add_brave "\$BRAVE_MCP_URL"' lib/scripts/install-mcps.sh
  ```
- **Expected Result**: hits covering all of the following (line numbers ≈ Serena's, content binding):
  - ≈96: `docker info >/dev/null 2>&1 || { echo "  Docker not running — skipping brave-search (re-run 'bootstrap update' with Docker up)"; return 0; }`
  - ≈98-100: `case "$(docker inspect -f '{{.Path}}' brave-search-mcp 2>/dev/null)"` with `sleep) docker rm -f brave-search-mcp` and `node)  docker start brave-search-mcp`
  - ≈108-111: `BRAVE_API_KEY="$BRAVE_API_KEY" docker run -d --restart unless-stopped` … `-e BRAVE_API_KEY` … `-p "127.0.0.1:${BRAVE_MCP_PORT}:8941" docker.io/mcp/brave-search` … `--transport http --host 0.0.0.0 --port 8941`
  - ≈114: `mcp_add_scoped user brave-search --transport http "$BRAVE_MCP_URL"` (no `--env`, no key — secret stays out of `~/.claude.json`)
  - ≈164: call-site continuation line ending `_add_brave "$BRAVE_MCP_URL"` (the 4th `expected` arg)
- **Repeatable Unit Test**: Not applicable: static content assertion, no unit surface
- [x] Pass <!-- 2026-07-28 -->

### UAT-CFG-003: setup-project.sh manual instructions echo the new HTTP-container form
- **Scenario**: the discovered follow-up in TASK-022 step 3 — setup-project.sh's "add a key later" block (≈:50-52) must show the new `docker run … --transport http` + `claude mcp add --scope user --transport http brave-search http://127.0.0.1:8941/mcp` form, not the old exec-wrapper instruction
- **Steps**:
  1. Run the command below (or re-verify via Serena if the hook blocks grep)
- **Command**:
  ```bash
  grep -n 'transport http' lib/scripts/setup-project.sh
  ```
- **Expected Result**: exactly the brave lines (plus the pre-existing context7 line ≈:58):
  - ≈51: `BRAVE_API_KEY=<key> docker run -d --restart unless-stopped --name brave-search-mcp -e BRAVE_API_KEY -p \"127.0.0.1:8941:8941\" docker.io/mcp/brave-search --transport http --host 0.0.0.0 --port 8941`
  - ≈52: `claude mcp add --scope user --transport http brave-search http://127.0.0.1:8941/mcp`
  No hit may contain `--entrypoint sleep`, `docker exec -i`, or `--env BRAVE_API_KEY=`
- **Repeatable Unit Test**: Not applicable: static content assertion, no unit surface
- [x] Pass <!-- 2026-07-28 -->

### UAT-CFG-004: No exec-wrapper remnants and no 8080 anywhere in lib/scripts
- **Scenario**: TASK-022 step 3 negative gate — the old stdio exec-wrapper (`docker exec -i`, `--entrypoint sleep`, `--env BRAVE_API_KEY=`) and the forbidden port 8080 must be fully gone from `lib/scripts/` (the only repo-wide 8080 hit is a benign generic Mermaid example in `lib/skills/mermaid-flowchart/SKILL.md`, outside this scope)
- **Steps**:
  1. Run the command below (or re-verify via Serena if the hook blocks grep)
- **Command**:
  ```bash
  grep -rnE -e 'docker exec -i' -e 'entrypoint sleep' -e '\-\-env "?BRAVE_API_KEY' -e '8080' lib/scripts && echo REMNANTS-FOUND || echo CLEAN
  ```
- **Expected Result**: single line `CLEAN` — zero matches for any of the four patterns under `lib/scripts/`
- **Repeatable Unit Test**: Not applicable: static content assertion, no unit surface
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-001: Docker-down guard — graceful skip, return 0, no registration attempted
- **Scenario**: `docker info` failing (install-mcps.sh:96) must print the skip message, return 0 (so `set -euo pipefail` callers survive), invoke **no** other docker subcommand, and never reach `claude mcp add`
- **Steps**:
  1. Run the block below (docker shim exits 1 on `info` via `INFO_RC=1`; claude shim answers `mcp get` with the matching HTTP URL so sourcing's three call sites all skip)
- **Command**:
  ```bash
  d="$(mktemp -d)"
  printf '%s\n' '#!/bin/sh' \
    'if [ "$1" = "run" ]; then echo "docker $* :: key=${BRAVE_API_KEY:-UNSET}" >> "$DLOG"; else echo "docker $*" >> "$DLOG"; fi' \
    'case "$1" in' 'info) exit "${INFO_RC:-0}" ;;' \
    'inspect) [ -e "$STATE" ] && exit 1; [ -z "${INSPECT_PATH:-}" ] && exit 1; [ "$2" = "-f" ] && echo "$INSPECT_PATH"; exit 0 ;;' \
    'rm) : > "$STATE" ;;' 'run) echo cid123 ;;' 'esac' 'exit 0' > "$d/docker"
  printf '%s\n' '#!/bin/sh' 'if [ "$1 $2" = "mcp get" ]; then echo "${GET_OUT:-http://127.0.0.1:8941/mcp}"; exit 0; fi' 'echo "claude $*" >> "$CLOG"' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf %s "${CURL_CODE:-200}"' > "$d/curl"
  chmod +x "$d/docker" "$d/claude" "$d/curl"
  : > "$d/docker.log"; : > "$d/claude.log"
  env DLOG="$d/docker.log" CLOG="$d/claude.log" STATE="$d/gone" INFO_RC=1 BRAVE_API_KEY=dummy PATH="$d:$PATH" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh; _add_brave user && echo BRAVE-RC-0; echo DLOG:; printf "%s\n" "$(<"$DLOG")"; [ -s "$CLOG" ] && echo REGISTERED || echo NO-REGISTRATION'
  rm -rf "$d"
  ```
- **Expected Result**: after the three sourcing-time `already installed, skipping.` lines, exactly:
  ```
    Docker not running — skipping brave-search (re-run 'bootstrap update' with Docker up)
  BRAVE-RC-0
  DLOG:
  docker info
  NO-REGISTRATION
  ```
  — the only docker invocation is `docker info`; `_add_brave` returns 0 under `set -euo pipefail`; the claude log is empty (no `mcp add`)
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (`package.json` `test` is a stub)
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-002: Fresh create — prefix assignment forwards the read (unexported) key; exact docker run and registration args
- **Scenario**: the key pitfall from plan review — value-less `-e BRAVE_API_KEY` only forwards **exported** vars and `read` doesn't export, so the prefix assignment on `docker run` (install-mcps.sh:108) is load-bearing. The key is fed via stdin (consumed by `read`, never exported); the docker shim logs `key=${BRAVE_API_KEY:-UNSET}` from its own environment at `run` time — `UNSET` here means the regression has returned. Also asserts the exact create args (8941 both sides, `--restart unless-stopped`, appended `--transport http --host 0.0.0.0 --port 8941`) and the exact registration (`--scope user`, `--transport http`, `$BRAVE_MCP_URL`, no secret)
- **Steps**:
  1. Run the block below (shims as in UAT-SH-001; no container exists — both `inspect` forms fail; curl shim answers 200 so `wait_http_up` succeeds immediately)
- **Command**:
  ```bash
  d="$(mktemp -d)"
  printf '%s\n' '#!/bin/sh' \
    'if [ "$1" = "run" ]; then echo "docker $* :: key=${BRAVE_API_KEY:-UNSET}" >> "$DLOG"; else echo "docker $*" >> "$DLOG"; fi' \
    'case "$1" in' 'info) exit "${INFO_RC:-0}" ;;' \
    'inspect) [ -e "$STATE" ] && exit 1; [ -z "${INSPECT_PATH:-}" ] && exit 1; [ "$2" = "-f" ] && echo "$INSPECT_PATH"; exit 0 ;;' \
    'rm) : > "$STATE" ;;' 'run) echo cid123 ;;' 'esac' 'exit 0' > "$d/docker"
  printf '%s\n' '#!/bin/sh' 'if [ "$1 $2" = "mcp get" ]; then echo "${GET_OUT:-http://127.0.0.1:8941/mcp}"; exit 0; fi' 'echo "claude $*" >> "$CLOG"' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf %s "${CURL_CODE:-200}"' > "$d/curl"
  chmod +x "$d/docker" "$d/claude" "$d/curl"
  : > "$d/docker.log"; : > "$d/claude.log"
  printf 'test-key-123\n' | env -u BRAVE_API_KEY DLOG="$d/docker.log" CLOG="$d/claude.log" STATE="$d/gone" PATH="$d:$PATH" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh; _add_brave user && echo BRAVE-RC-0; echo DLOG:; printf "%s\n" "$(<"$DLOG")"; echo CLOG:; printf "%s\n" "$(<"$CLOG")"'
  rm -rf "$d"
  ```
- **Expected Result**: stdout contains (in order) the key prompt, `  brave-search: listening on http://127.0.0.1:8941/mcp`, the `Tip: enable Docker Desktop's "Start when you sign in"` line, and `BRAVE-RC-0`; then exactly:
  ```
  DLOG:
  docker info
  docker inspect -f {{.Path}} brave-search-mcp
  docker inspect brave-search-mcp
  docker run -d --restart unless-stopped --name brave-search-mcp -e BRAVE_API_KEY -p 127.0.0.1:8941:8941 docker.io/mcp/brave-search --transport http --host 0.0.0.0 --port 8941 :: key=test-key-123
  CLOG:
  claude mcp add --scope user brave-search --transport http http://127.0.0.1:8941/mcp
  ```
  Binding details: `key=test-key-123` (NOT `key=UNSET`) proves prefix-assignment forwarding; `127.0.0.1:8941:8941` (8941 both sides, loopback publish); no `rm`/`start` lines; the claude log contains no `BRAVE_API_KEY` and no `--env`
- **Repeatable Unit Test**: Blocked: repo has no shell test harness
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-003: Migration — old exec-wrapper container (Path=sleep) is removed and recreated
- **Scenario**: the `sleep)` branch (install-mcps.sh:99) — `docker inspect -f '{{.Path}}'` answering `sleep` must trigger `docker rm -f brave-search-mcp`, after which the existence check fails and the container is recreated with the new HTTP args; `docker start` must never run
- **Steps**:
  1. Run the block below (`INSPECT_PATH=sleep`; the shim's `rm` marks state so the follow-up existence `inspect` fails, mimicking real removal)
- **Command**:
  ```bash
  d="$(mktemp -d)"
  printf '%s\n' '#!/bin/sh' \
    'if [ "$1" = "run" ]; then echo "docker $* :: key=${BRAVE_API_KEY:-UNSET}" >> "$DLOG"; else echo "docker $*" >> "$DLOG"; fi' \
    'case "$1" in' 'info) exit "${INFO_RC:-0}" ;;' \
    'inspect) [ -e "$STATE" ] && exit 1; [ -z "${INSPECT_PATH:-}" ] && exit 1; [ "$2" = "-f" ] && echo "$INSPECT_PATH"; exit 0 ;;' \
    'rm) : > "$STATE" ;;' 'run) echo cid123 ;;' 'esac' 'exit 0' > "$d/docker"
  printf '%s\n' '#!/bin/sh' 'if [ "$1 $2" = "mcp get" ]; then echo "${GET_OUT:-http://127.0.0.1:8941/mcp}"; exit 0; fi' 'echo "claude $*" >> "$CLOG"' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf %s "${CURL_CODE:-200}"' > "$d/curl"
  chmod +x "$d/docker" "$d/claude" "$d/curl"
  : > "$d/docker.log"; : > "$d/claude.log"
  env DLOG="$d/docker.log" CLOG="$d/claude.log" STATE="$d/gone" INSPECT_PATH=sleep BRAVE_API_KEY=migrate-key-1 PATH="$d:$PATH" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh; _add_brave user && echo BRAVE-RC-0; echo DLOG:; printf "%s\n" "$(<"$DLOG")"; echo CLOG:; printf "%s\n" "$(<"$CLOG")"' < /dev/null
  rm -rf "$d"
  ```
- **Expected Result**: after the three skip lines, stdout contains the `listening` line and `BRAVE-RC-0`; then exactly:
  ```
  DLOG:
  docker info
  docker inspect -f {{.Path}} brave-search-mcp
  docker rm -f brave-search-mcp
  docker inspect brave-search-mcp
  docker run -d --restart unless-stopped --name brave-search-mcp -e BRAVE_API_KEY -p 127.0.0.1:8941:8941 docker.io/mcp/brave-search --transport http --host 0.0.0.0 --port 8941 :: key=migrate-key-1
  CLOG:
  claude mcp add --scope user brave-search --transport http http://127.0.0.1:8941/mcp
  ```
  Binding details: `rm -f` precedes the recreate; NO `docker start` line anywhere
- **Repeatable Unit Test**: Blocked: repo has no shell test harness
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-004: Already-converted container (Path=node) is started, not recreated
- **Scenario**: the `node)` branch (install-mcps.sh:100) — an existing HTTP-mode container must be `docker start`ed (idempotent re-run), the existence check then succeeds so **no** `docker run` happens, and registration still proceeds
- **Steps**:
  1. Run the block below (`INSPECT_PATH=node`)
- **Command**:
  ```bash
  d="$(mktemp -d)"
  printf '%s\n' '#!/bin/sh' \
    'if [ "$1" = "run" ]; then echo "docker $* :: key=${BRAVE_API_KEY:-UNSET}" >> "$DLOG"; else echo "docker $*" >> "$DLOG"; fi' \
    'case "$1" in' 'info) exit "${INFO_RC:-0}" ;;' \
    'inspect) [ -e "$STATE" ] && exit 1; [ -z "${INSPECT_PATH:-}" ] && exit 1; [ "$2" = "-f" ] && echo "$INSPECT_PATH"; exit 0 ;;' \
    'rm) : > "$STATE" ;;' 'run) echo cid123 ;;' 'esac' 'exit 0' > "$d/docker"
  printf '%s\n' '#!/bin/sh' 'if [ "$1 $2" = "mcp get" ]; then echo "${GET_OUT:-http://127.0.0.1:8941/mcp}"; exit 0; fi' 'echo "claude $*" >> "$CLOG"' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf %s "${CURL_CODE:-200}"' > "$d/curl"
  chmod +x "$d/docker" "$d/claude" "$d/curl"
  : > "$d/docker.log"; : > "$d/claude.log"
  env DLOG="$d/docker.log" CLOG="$d/claude.log" STATE="$d/gone" INSPECT_PATH=node BRAVE_API_KEY=idem-key-1 PATH="$d:$PATH" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh; _add_brave user && echo BRAVE-RC-0; echo DLOG:; printf "%s\n" "$(<"$DLOG")"; echo CLOG:; printf "%s\n" "$(<"$CLOG")"' < /dev/null
  rm -rf "$d"
  ```
- **Expected Result**: after the three skip lines, stdout contains the `listening` line and `BRAVE-RC-0`; then exactly:
  ```
  DLOG:
  docker info
  docker inspect -f {{.Path}} brave-search-mcp
  docker start brave-search-mcp
  docker inspect brave-search-mcp
  CLOG:
  claude mcp add --scope user brave-search --transport http http://127.0.0.1:8941/mcp
  ```
  Binding details: `docker start` present; NO `docker run` and NO `docker rm` lines; registration still recorded
- **Repeatable Unit Test**: Blocked: repo has no shell test harness
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-005: Endpoint not answering — WARNING branch, still exits cleanly
- **Scenario**: when `wait_http_up "$BRAVE_MCP_URL"` fails (install-mcps.sh:115-116), `_add_brave` must print the `WARNING: brave-search endpoint not answering — check 'docker logs brave-search-mcp'` hint and still complete (the `||` keeps `set -euo pipefail` alive). Curl shim answers `000` (down) for all attempts; a no-op `sleep` shim keeps the 10-attempt loop instant
- **Steps**:
  1. Run the block below (`INSPECT_PATH=node` to take the shortest container path; `CURL_CODE=000`)
- **Command**:
  ```bash
  d="$(mktemp -d)"
  printf '%s\n' '#!/bin/sh' \
    'if [ "$1" = "run" ]; then echo "docker $* :: key=${BRAVE_API_KEY:-UNSET}" >> "$DLOG"; else echo "docker $*" >> "$DLOG"; fi' \
    'case "$1" in' 'info) exit "${INFO_RC:-0}" ;;' \
    'inspect) [ -e "$STATE" ] && exit 1; [ -z "${INSPECT_PATH:-}" ] && exit 1; [ "$2" = "-f" ] && echo "$INSPECT_PATH"; exit 0 ;;' \
    'rm) : > "$STATE" ;;' 'run) echo cid123 ;;' 'esac' 'exit 0' > "$d/docker"
  printf '%s\n' '#!/bin/sh' 'if [ "$1 $2" = "mcp get" ]; then echo "${GET_OUT:-http://127.0.0.1:8941/mcp}"; exit 0; fi' 'echo "claude $*" >> "$CLOG"' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf %s "${CURL_CODE:-200}"' > "$d/curl"
  printf '%s\n' '#!/bin/sh' 'exit 0' > "$d/sleep"
  chmod +x "$d/docker" "$d/claude" "$d/curl" "$d/sleep"
  : > "$d/docker.log"; : > "$d/claude.log"
  env DLOG="$d/docker.log" CLOG="$d/claude.log" STATE="$d/gone" INSPECT_PATH=node CURL_CODE=000 BRAVE_API_KEY=warn-key-1 PATH="$d:$PATH" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh; _add_brave user && echo BRAVE-RC-0; echo CLOG:; printf "%s\n" "$(<"$CLOG")"' < /dev/null
  rm -rf "$d"
  ```
- **Expected Result**: after the three skip lines, stdout contains (in order):
  ```
    WARNING: brave-search endpoint not answering — check 'docker logs brave-search-mcp'
    Tip: enable Docker Desktop's "Start when you sign in" so brave-search comes back after reboots.
  BRAVE-RC-0
  CLOG:
  claude mcp add --scope user brave-search --transport http http://127.0.0.1:8941/mcp
  ```
  — no `listening on` line; registration happened before the health check; function still returned 0
- **Repeatable Unit Test**: Blocked: repo has no shell test harness
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-006: End-to-end upgrade detection — stale stdio registration auto-upgrades to the shared HTTP form
- **Scenario**: TASK-022 step 2 — the 4th arg `"$BRAVE_MCP_URL"` at the call site (install-mcps.sh:163-164) arms `register_optional_mcp`'s upgrade branch (:60-68): with brave "installed" but its `claude mcp get` output showing the old stdio shape (no HTTP URL), a full non-interactive script run must print the upgrade message, run `claude mcp remove brave-search -s user`, call `_add_brave user` directly (key fed via stdin), create the container, and re-register at the HTTP URL — while 3-arg context7/playwright still take the plain skip path
- **Steps**:
  1. Run the block below (`GET_OUT` makes every `mcp get` answer with the stdio shape; only brave has an `expected` to mismatch)
- **Command**:
  ```bash
  d="$(mktemp -d)"
  printf '%s\n' '#!/bin/sh' \
    'if [ "$1" = "run" ]; then echo "docker $* :: key=${BRAVE_API_KEY:-UNSET}" >> "$DLOG"; else echo "docker $*" >> "$DLOG"; fi' \
    'case "$1" in' 'info) exit "${INFO_RC:-0}" ;;' \
    'inspect) [ -e "$STATE" ] && exit 1; [ -z "${INSPECT_PATH:-}" ] && exit 1; [ "$2" = "-f" ] && echo "$INSPECT_PATH"; exit 0 ;;' \
    'rm) : > "$STATE" ;;' 'run) echo cid123 ;;' 'esac' 'exit 0' > "$d/docker"
  printf '%s\n' '#!/bin/sh' 'if [ "$1 $2" = "mcp get" ]; then echo "${GET_OUT:-http://127.0.0.1:8941/mcp}"; exit 0; fi' 'echo "claude $*" >> "$CLOG"' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf %s "${CURL_CODE:-200}"' > "$d/curl"
  chmod +x "$d/docker" "$d/claude" "$d/curl"
  : > "$d/docker.log"; : > "$d/claude.log"
  printf 'upgrade-key-9\n' | env -u BRAVE_API_KEY GET_OUT='brave-search: npx @brave/brave-search-mcp-server (stdio)' DLOG="$d/docker.log" CLOG="$d/claude.log" STATE="$d/gone" PATH="$d:$PATH" bash lib/scripts/install-mcps.sh
  echo "exit=$?"
  printf '%s\n' DLOG: "$(<"$d/docker.log")" CLOG: "$(<"$d/claude.log")"
  rm -rf "$d"
  ```
- **Expected Result**: stdout contains, in order: `  brave-search: upgrading registration (stdio → shared http).`, the key prompt followed by `  brave-search: listening on http://127.0.0.1:8941/mcp` and the Docker Desktop tip, `  context7: already installed, skipping.`, `  playwright: already installed, skipping.`, `exit=0`; then exactly:
  ```
  DLOG:
  docker info
  docker inspect -f {{.Path}} brave-search-mcp
  docker inspect brave-search-mcp
  docker run -d --restart unless-stopped --name brave-search-mcp -e BRAVE_API_KEY -p 127.0.0.1:8941:8941 docker.io/mcp/brave-search --transport http --host 0.0.0.0 --port 8941 :: key=upgrade-key-9
  CLOG:
  claude mcp remove brave-search -s user
  claude mcp add --scope user brave-search --transport http http://127.0.0.1:8941/mcp
  ```
  Binding details: remove precedes add; the stdin-fed key reaches the container env (`key=upgrade-key-9`); context7/playwright are skipped, not upgraded
- **Repeatable Unit Test**: Blocked: repo has no shell test harness
- [x] Pass <!-- 2026-07-28 -->

### UAT-EDGE-001: Unknown container entrypoint — left untouched, registration still proceeds
- **Scenario**: the migration `case` (install-mcps.sh:98-101) only handles `sleep` and `node`; a `brave-search-mcp` container with any other `{{.Path}}` (e.g. a future image entrypoint `docker-entrypoint.sh`) must fall through — no `rm`, no `start`, no `run` (the container exists, so creation is skipped) — and registration must still happen. This is the intentional conservative behavior: never destroy an unrecognized container
- **Steps**:
  1. Run the block below (`INSPECT_PATH=docker-entrypoint.sh`)
- **Command**:
  ```bash
  d="$(mktemp -d)"
  printf '%s\n' '#!/bin/sh' \
    'if [ "$1" = "run" ]; then echo "docker $* :: key=${BRAVE_API_KEY:-UNSET}" >> "$DLOG"; else echo "docker $*" >> "$DLOG"; fi' \
    'case "$1" in' 'info) exit "${INFO_RC:-0}" ;;' \
    'inspect) [ -e "$STATE" ] && exit 1; [ -z "${INSPECT_PATH:-}" ] && exit 1; [ "$2" = "-f" ] && echo "$INSPECT_PATH"; exit 0 ;;' \
    'rm) : > "$STATE" ;;' 'run) echo cid123 ;;' 'esac' 'exit 0' > "$d/docker"
  printf '%s\n' '#!/bin/sh' 'if [ "$1 $2" = "mcp get" ]; then echo "${GET_OUT:-http://127.0.0.1:8941/mcp}"; exit 0; fi' 'echo "claude $*" >> "$CLOG"' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf %s "${CURL_CODE:-200}"' > "$d/curl"
  chmod +x "$d/docker" "$d/claude" "$d/curl"
  : > "$d/docker.log"; : > "$d/claude.log"
  env DLOG="$d/docker.log" CLOG="$d/claude.log" STATE="$d/gone" INSPECT_PATH=docker-entrypoint.sh BRAVE_API_KEY=edge-key-1 PATH="$d:$PATH" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh; _add_brave user && echo BRAVE-RC-0; echo DLOG:; printf "%s\n" "$(<"$DLOG")"; echo CLOG:; printf "%s\n" "$(<"$CLOG")"' < /dev/null
  rm -rf "$d"
  ```
- **Expected Result**: after the three skip lines, stdout contains the `listening` line and `BRAVE-RC-0`; then exactly:
  ```
  DLOG:
  docker info
  docker inspect -f {{.Path}} brave-search-mcp
  docker inspect brave-search-mcp
  CLOG:
  claude mcp add --scope user brave-search --transport http http://127.0.0.1:8941/mcp
  ```
  Binding details: NO `rm`, NO `start`, NO `run` lines — the unrecognized container is preserved; registration still recorded
- **Repeatable Unit Test**: Blocked: repo has no shell test harness
- [x] Pass <!-- 2026-07-28 -->

---

## Deferred to TASK-025 (live-docker runtime — intentionally NOT tested here)

Per the task (`Runtime verification deferred to TASK-025 (local migration doubles as UAT)`), the following require a real Docker daemon and are out of scope for UAT-022:

- Real `docker.io/mcp/brave-search` container boots in HTTP mode and answers on `http://127.0.0.1:8941/mcp`
- `--restart unless-stopped` brings the container back after daemon/host restart
- Real `claude mcp add --transport http` registration serves live tool calls with the baked-in key
- Key rotation flow (`docker rm -f brave-search-mcp` + re-run `bootstrap update`)
