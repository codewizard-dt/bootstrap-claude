---
id: UAT-024
aliases: [UAT-024]
title: "UAT: Docs & guide alignment for single-process HTTP MCP servers"
status: passed
task: TASK-024
created: 2026-07-28
updated: 2026-07-28
---

# UAT-024 — UAT: Docs & guide alignment for single-process HTTP MCP servers

implements::[[TASK-024]]

> **Source task**: [[TASK-024]]
> **Generated**: 2026-07-28

---

## Prerequisites

- [ ] Serena MCP connected — **all repo-content assertions below MUST use `mcp__serena__search_for_pattern`**; the repo's PreToolUse hook blocks `grep`/`cat` on repo paths (established precedent: UAT-020…UAT-023). Direct `grep`/file reads are permitted only on *generated artifacts in temp directories outside the repo* (UAT-CLI-001/002, UAT-EDGE-001).
- [ ] Repo root: `/Users/davidtaylor/Repositories/bootstrap-claude`
- [ ] `bash` available; UAT-CLI-002 and UAT-EDGE-001 require macOS (the shadowing hint is guarded by `uname -s = Darwin`)
- [ ] No Docker, npm, launchd, or network access is needed — the two script runs are hermetic (PATH shims / already-installed skip paths only)

---

## Test Cases

### UAT-DOC-001: setup-project.sh epilogue — rotation story, kickstart line, port-override note
- **Surface**: `lib/scripts/setup-project.sh` (epilogue echoes, ~lines 46-67)
- **Description**: The stale exec-wrapper re-add command is gone; the epilogue now tells the brave rotation/image-update story, the playwright launchd kickstart line, and the port-override note, with context7 lines kept.
- **Steps**:
  1. `mcp__serena__search_for_pattern` with pattern `docker rm -f brave-search-mcp|launchctl kickstart|BRAVE_MCP_PORT / PLAYWRIGHT_MCP_PORT|context7` restricted to `lib/scripts/setup-project.sh`.
  2. Confirm each expected line below appears; confirm no `exec`-wrapper re-add command remains anywhere in the file (pattern `exec-wrapper|exec wrapper` → only permissible hit is none).
- **Expected Result**: All four present — (a) brave key rotation: `docker rm -f brave-search-mcp` then re-run `npx @codewizard-dt/bootstrap update`; (b) image update: `docker rm -f brave-search-mcp && docker pull docker.io/mcp/brave-search`; (c) playwright: `npm i -g @playwright/mcp@latest && launchctl kickstart -k gui/$(id -u)/com.bootstrap-claude.playwright-mcp`; (d) `Ports: brave-search 8941, playwright 8931 — override via BRAVE_MCP_PORT / PLAYWRIGHT_MCP_PORT`. Context7 lines (CONTEXT7_API_KEY dashboard + `claude mcp add … context7 https://mcp.context7.com/mcp`) still present. Zero exec-wrapper remnants.
- **Repeatable Unit Test**: Not applicable: static documentation/echo content assertion
- [x] Pass <!-- 2026-07-28 -->

### UAT-DOC-002: README tech row + architecture & sequence diagrams
- **Surface**: `README.md` (~lines 43, 145-147, 169-171, 202-204)
- **Description**: Tech row names Docker + launchd; architecture diagram routes brave through a Docker container node and playwright through a launchd node (npx node scoped to non-macOS); sequence diagram shows container/agent provisioning during registration.
- **Steps**:
  1. `mcp__serena__search_for_pattern` on `README.md` for `Docker \(shared \`brave-search-mcp\` container\), launchd` (tech row).
  2. Search for the diagram nodes `DOCKER\[|LAUNCHD\[|NPX\[` and edges `docker run| DOCKER|bootstraps plist| LAUNCHD|non-macOS| NPX`.
  3. Search for the sequence-diagram provisioning lines `docker run brave-search-mcp \(http :8941|bootstrap playwright launchd agent \(http :8931`.
- **Expected Result**: Tech row (line ~43) includes `Docker (shared brave-search-mcp container), launchd (macOS Playwright LaunchAgent)`. Architecture diagram has `DOCKER["Docker<br/>brave-search-mcp container<br/>http :8941"]`, `LAUNCHD["launchd<br/>playwright-mcp LaunchAgent<br/>http :8931 (macOS)"]`, `NPX["npx<br/>Playwright MCP (non-macOS stdio)"]` with edges `MCPS -->|docker run| DOCKER`, `MCPS -->|bootstraps plist| LAUNCHD`, `MCPS -->|non-macOS| NPX`. Sequence diagram includes `docker run brave-search-mcp (http :8941, API key baked in)` and `bootstrap playwright launchd agent (http :8931, macOS)`.
- **Repeatable Unit Test**: Not applicable: static documentation content assertion
- [x] Pass <!-- 2026-07-28 -->

### UAT-DOC-003: README env table + troubleshooting entries
- **Surface**: `README.md` (~lines 331-333, 475-477)
- **Description**: Env table documents the baked-in `BRAVE_API_KEY` rotation story and adds `BRAVE_MCP_PORT` / `PLAYWRIGHT_MCP_PORT` rows; troubleshooting adds endpoint-not-answering entries pointing at `docker logs` and `launchctl print`.
- **Steps**:
  1. `mcp__serena__search_for_pattern` on `README.md` for `BRAVE_MCP_PORT|PLAYWRIGHT_MCP_PORT` — expect table rows with defaults `8941` / `8931` and endpoint `http://127.0.0.1:<port>/mcp`.
  2. Search `baked into the .brave-search-mcp. Docker container|docker rm -f brave-search-mcp` — the `BRAVE_API_KEY` row must state the key is baked into the container (not `~/.claude.json`) and give the rotation command.
  3. Search `endpoint not answering` — expect one brave entry (`docker logs brave-search-mcp`) and one playwright entry (`launchctl print gui/$(id -u)/com.bootstrap-claude.playwright-mcp` + `~/Library/Logs/playwright-mcp.log`).
- **Expected Result**: All three assertions hold: two new port rows with correct defaults, `BRAVE_API_KEY` row carries the baked-in/rotation story, and both troubleshooting entries exist with the `docker logs` / `launchctl print` diagnostics.
- **Repeatable Unit Test**: Not applicable: static documentation content assertion
- [x] Pass <!-- 2026-07-28 -->

### UAT-DOC-004: CLAUDE.md manual-setup — brave docker :8941, 50/sec parallel, playwright launchd :8931
- **Surface**: `CLAUDE.md` (~lines 81-84, 151)
- **Description**: The manual-setup section describes the new registration story and the corrected brave rate limit (50 req/sec parallel — the old "1 req/sec, sequential only" claim is gone).
- **Steps**:
  1. `mcp__serena__search_for_pattern` on `CLAUDE.md` for `up to 50 req/sec, parallel` and `http://127\.0\.0\.1:8941/mcp` — both must land in the Brave manual-setup bullet, which must also say the API key is baked into the container env and the server is registered at user scope.
  2. Search for `launchd LaunchAgent|com\.bootstrap-claude\.playwright-mcp|http://127\.0\.0\.1:8931/mcp` — the Playwright bullet must describe the macOS shared HTTP server on :8931 with isolated browser contexts, and stdio `npx @playwright/mcp` on other platforms.
  3. Search for `50 requests/second, parallel` — the MCP Tool Requirements bullet (line ~151) must carry the corrected figure.
- **Expected Result**: All three present; zero occurrences of `1 req/sec` or `sequential only` anywhere in `CLAUDE.md`.
- **Repeatable Unit Test**: Not applicable: static documentation content assertion
- [x] Pass <!-- 2026-07-28 -->

### UAT-DOC-005: Straggler rate-limit fixes in decision-create and research-company skills
- **Surface**: `lib/skills/decision-create/SKILL.md` (~line 67), `lib/skills/research-company/SKILL.md` (~lines 38, 66, 93, 338)
- **Description**: The two stragglers found in the TASK-024 verification sweep now carry parallel/50-per-sec wording.
- **Steps**:
  1. `mcp__serena__search_for_pattern` for `Brave \(parallel, up to 50/sec\)` in `lib/skills/decision-create/SKILL.md`.
  2. `mcp__serena__search_for_pattern` for `50 requests per second|50 req/sec, parallel|parallel searches are allowed` in `lib/skills/research-company/SKILL.md`.
  3. `mcp__serena__search_for_pattern` for `1/sec|sequential` in both files.
- **Expected Result**: Step 1 and 2 patterns match; step 3 finds zero brave-rate-limit hits (no `1/sec`, no "Search sequentially"/"sequential only" wording) in either skill.
- **Repeatable Unit Test**: Not applicable: static documentation content assertion
- [x] Pass <!-- 2026-07-28 -->

### UAT-CLI-001: build-mcp-guide.sh emits corrected Quick-Reference row and playwright launchd stub note
- **Surface**: `lib/scripts/build-mcp-guide.sh` + `lib/scripts/templates/guides/stubs/playwright.md`
- **Description**: Behavioral: running the guide builder against a temp project dir produces a `.docs/guides/mcp-tools.md` whose brave Quick-Reference row reads parallel/50-per-sec and whose playwright section carries the launchd shared-HTTP-service note. The generated file lives outside the repo, so direct `grep` on it is permitted.
- **Steps**:
  1. Run the command below as-is.
  2. Inspect the three `grep -c` counts it prints (guide row, launchd note, stale-claim sweep).
- **Command**:
  ```bash
  T="$(mktemp -d)" && bash /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/build-mcp-guide.sh "$T" serena context7 brave-search playwright && G="$T/.docs/guides/mcp-tools.md" && grep -c 'Brave Search (parallel, up to 50/sec)' "$G" && grep -c 'launchd-managed HTTP service' "$G" && { grep -cE '1/sec|sequential only' "$G" || true; }
  ```
- **Expected Result**: Script exits 0 and writes `$T/.docs/guides/mcp-tools.md`. First grep prints `1` (row `| General research | Brave Search (parallel, up to 50/sec) | \`WebSearch\` |`). Second grep prints `1` (stub note: "On macOS the browser server is a shared, launchd-managed HTTP service (one per machine); each session still gets an isolated browser context.", while "No explicit launch step" is retained). Third grep prints `0` (no stale `1/sec` / `sequential only` claims in the generated guide).
- **Repeatable Unit Test**: Blocked: repo has no shell unit-test harness (no bats/shunit2; `package.json` test script is a stub) — precedent UAT-020…023
- [x] Pass <!-- 2026-07-28 -->

### UAT-CLI-002: install-mcps.sh shadowing hint fires for a project-scoped playwright entry (hermetic)
- **Surface**: `lib/scripts/install-mcps.sh` (~lines 281-289)
- **Description**: Behavioral: with a `claude` PATH shim that makes every MCP look already-installed-and-matching (so all install work is skipped and no docker/npm/launchctl runs), a `PROJECT_DIR/.mcp.json` containing a `"playwright"` key triggers the echo-only shadowing warning with the removal command. macOS only.
- **Steps**:
  1. Run the command below as-is (single hermetic script).
  2. Confirm the captured output contains the warning and removal hint, and that the temp `.mcp.json` was not modified.
- **Command**:
  ```bash
  T="$(mktemp -d)" && mkdir -p "$T/bin" "$T/proj" && printf '{"mcpServers":{"serena":{},"playwright":{}}}\n' > "$T/proj/.mcp.json" && printf '#!/bin/bash\nif [ "$1" = "mcp" ] && [ "$2" = "get" ]; then echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; fi\nexit 0\n' > "$T/bin/claude" && chmod +x "$T/bin/claude" && OUT="$(PATH="$T/bin:$PATH" bash /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/install-mcps.sh --project-dir "$T/proj" 2>&1)" && echo "$OUT" | grep -c 'shadows the user-scope shared HTTP server' && echo "$OUT" | grep -c 'claude mcp remove playwright -s project' && grep -c '"playwright"' "$T/proj/.mcp.json"
  ```
- **Expected Result**: Exit 0. Output shows the skip lines (`brave-search: already installed, skipping.`, `playwright: already installed, skipping.`, `serena: already registered for this project, skipping.`) and then both hint greps print `1`: the `WARNING: playwright is also registered in <dir>/.mcp.json (project scope) — it shadows the user-scope shared HTTP server.` line and the `cd "<dir>" && claude mcp remove playwright -s project` removal line. Final grep prints `1` — the project's `.mcp.json` is untouched (echo-only, never edited).
- **Repeatable Unit Test**: Blocked: repo has no shell unit-test harness (no bats/shunit2) — precedent UAT-020…023
- [x] Pass <!-- 2026-07-28 -->

### UAT-EDGE-001: Shadowing hint does NOT fire without a playwright entry (negative control)
- **Scenario**: Same hermetic run as UAT-CLI-002, but the project `.mcp.json` contains only `"serena"` — the hint's `grep -q '"playwright"'` guard must keep it silent.
- **Steps**:
  1. Run the command below as-is.
  2. Confirm the shadow-warning count is `0`.
- **Command**:
  ```bash
  T="$(mktemp -d)" && mkdir -p "$T/bin" "$T/proj" && printf '{"mcpServers":{"serena":{}}}\n' > "$T/proj/.mcp.json" && printf '#!/bin/bash\nif [ "$1" = "mcp" ] && [ "$2" = "get" ]; then echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; fi\nexit 0\n' > "$T/bin/claude" && chmod +x "$T/bin/claude" && OUT="$(PATH="$T/bin:$PATH" bash /Users/davidtaylor/Repositories/bootstrap-claude/lib/scripts/install-mcps.sh --project-dir "$T/proj" 2>&1)" && { echo "$OUT" | grep -c 'shadows the user-scope' || true; }
  ```
- **Expected Result**: Exit 0; the grep count prints `0` — no shadowing warning when `.mcp.json` lacks a `"playwright"` key.
- **Repeatable Unit Test**: Blocked: repo has no shell unit-test harness (no bats/shunit2) — precedent UAT-020…023
- [x] Pass <!-- 2026-07-28 -->

### UAT-EDGE-002: Repo-wide negative sweep — no stale rate-limit, port, or exec-wrapper claims
- **Scenario**: The contradictory claims TASK-024 set out to kill must be absent from all live surfaces.
- **Steps**:
  1. `mcp__serena__search_for_pattern` for `1/sec|1 req/sec|sequential only` across `lib/`, `CLAUDE.md`, `README.md`.
  2. `mcp__serena__search_for_pattern` for `8080` across `lib/`, `CLAUDE.md`, `README.md`. **Known permissible hit**: `lib/skills/mermaid-flowchart/SKILL.md:52` uses `:8080` as a generic docker-compose port-mapping example — unrelated to MCP ports, out of TASK-024 scope.
  3. `mcp__serena__search_for_pattern` for `exec-wrapper|exec wrapper` across `README.md`, `CLAUDE.md`, `lib/scripts/setup-project.sh`. **Known permissible hit**: `lib/scripts/install-mcps.sh:97-99` comments referencing "old exec-wrapper container" are migration *code*, intentional, not docs.
- **Expected Result**: Sweep 1: zero matches. Sweep 2: zero matches other than the mermaid-flowchart generic example. Sweep 3: zero matches in the three docs surfaces (install-mcps.sh migration comments excluded by scope). Brave port is `8941` and playwright `8931` everywhere they appear.
- **Repeatable Unit Test**: Not applicable: repo-wide documentation sweep
- [x] Pass <!-- 2026-07-28 -->
