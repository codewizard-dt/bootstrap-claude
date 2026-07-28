---
id: UAT-023
title: "UAT: playwright → native launchd LaunchAgent HTTP server (darwin), stdio fallback elsewhere"
status: passed
task: TASK-023
created: 2026-07-28
updated: 2026-07-28
---

# UAT-023 — UAT: playwright → native launchd LaunchAgent HTTP server

implements::[[TASK-023]]

> **Source task**: [[TASK-023]]
> **Generated**: 2026-07-28

---

## Prerequisites

- [ ] Run every command from the repo root (`/Users/davidtaylor/Repositories/bootstrap-claude`)
- [ ] macOS host (`uname -s` = `Darwin`) — the darwin-branch tests rely on the real `uname`; UAT-SH-006 shims `uname` to drive the non-darwin branch
- [ ] No live launchd, npm, network, or `claude` CLI state is needed for any SH/EDGE test — every command builds a `mktemp -d` PATH-shim harness (`npm`/`launchctl`/`claude`/`curl`, plus `uname`/`sleep` where noted) and overrides `HOME` to a temp dir, so the real `~/Library/LaunchAgents`, `~/Library/Logs`, global npm tree, and user-scope MCP registrations are never read or modified
- [ ] Note: the repo's Serena-first hook blocks `grep`/`cat` on repo code paths; every deterministic repo-content claim in this file (`_add_playwright` at `install-mcps.sh` lines ~157-243, `_playwright_bootstrap_agent` at ~143-155, plist heredoc at ~186-220, call site at ~275-280, `wait_http_up` at `lib.sh:55`) was pre-verified via `mcp__serena__find_symbol` / `mcp__serena__search_for_pattern` at generation time (2026-07-28). If the UAT-CFG-002 grep is blocked during `/uat-auto`, re-verify the same claims via Serena instead of failing open. Greps against files the tests themselves generate under `mktemp -d` (shim logs, the rendered plist) are not repo content and are fine

---

## Test Cases

### UAT-CFG-001: Changed script passes bash syntax check
- **Scenario**: static gate regression for the TASK-023 rewrite of `_add_playwright`
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  bash -n lib/scripts/install-mcps.sh && echo SYNTAX-OK
  ```
- **Expected Result**: `SYNTAX-OK` with no other output; exit 0
- **Repeatable Unit Test**: Not applicable: `bash -n` is itself the repeatable check; no harness to house it
- [x] Pass <!-- 2026-07-28 -->

### UAT-CFG-002: Darwin gate, plist keys, no-npx-in-heredoc, darwin-only expected arg
- **Scenario**: the structural claims of TASK-023 step 3 — `_add_playwright` branches on `uname -s`; the literal `npx @playwright/mcp@latest` occurs exactly once (the non-darwin stdio branch, never inside the plist `ProgramArguments` heredoc); the heredoc carries `LimitLoadToSessionType`/`ThrottleInterval`/`SuccessfulExit`; the call site computes `playwright_expected` darwin-only
- **Steps**:
  1. Run the command below (or re-verify via `mcp__serena__search_for_pattern` if the hook blocks grep — all claims pre-verified via Serena 2026-07-28)
- **Command**:
  ```bash
  grep -nE 'uname -s|npx @playwright/mcp@latest|LimitLoadToSessionType|ThrottleInterval|SuccessfulExit|playwright_expected=' lib/scripts/install-mcps.sh
  ```
- **Expected Result**: exactly these hits —
  - `"$(uname -s)" != "Darwin"` once inside `_add_playwright` (line ~158, the early-return stdio gate) and `"$(uname -s)" = "Darwin"` once at the call site (line ~276)
  - `npx @playwright/mcp@latest` exactly **once** (line ~160, the non-darwin `mcp_add_scoped` line) — it must NOT appear anywhere in the plist heredoc (lines ~186-220)
  - `LimitLoadToSessionType` once (heredoc, paired with `Aqua`), `ThrottleInterval` once (paired with `30`), `SuccessfulExit` once (inside the `KeepAlive` dict, paired with `<false/>`)
  - `playwright_expected=""` (line ~275) and `playwright_expected="$PLAYWRIGHT_MCP_URL"` (line ~277, inside the darwin `if`) — nothing else assigns it
- **Repeatable Unit Test**: Not applicable: static content assertion, no unit surface
- [x] Pass <!-- 2026-07-28 (re-verified via mcp__serena__search_for_pattern; grep blocked by Serena-first hook) -->

### UAT-SH-001: Darwin fresh install — full provision + register + verify happy path
- **Scenario**: with no existing plist, `_add_playwright` runs `npm install -g @playwright/mcp@latest`, writes the plist under `$HOME/Library/LaunchAgents/`, does `launchctl bootout` + `bootstrap gui/<uid>`, registers at forced user scope with `--transport http`, and reports the endpoint listening (install-mcps.sh ~157-243)
- **Steps**:
  1. Run the block below — it builds the shim harness (npm records + fakes `npm root -g` to a temp tree containing a stub `cli.js`; launchctl records; claude skips all source-time registrations and records `mcp add`; curl answers `200` so `wait_http_up` passes instantly), sources the script, and calls `_add_playwright user`
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"; nr="$d/npmroot"
  mkdir -p "$h" "$ctl" "$nr/@playwright/mcp"
  echo '// stub cli' > "$nr/@playwright/mcp/cli.js"
  printf '%s\n' '#!/bin/sh' "echo \"npm \$*\" >> \"$ctl/npm.log\"" "[ \"\$1\" = root ] && { echo \"$nr\"; exit 0; }" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' "echo \"launchctl \$*\" >> \"$ctl/launchctl.log\"" 'case "$1" in' "  print) exit \"\$(cat \"$ctl/print_rc\" 2>/dev/null || echo 1)\" ;;" "  bootstrap) cat \"$ctl/bootstrap_out\" 2>/dev/null; exit \"\$(cat \"$ctl/bootstrap_rc\" 2>/dev/null || echo 0)\" ;;" 'esac' 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' "[ \"\$1 \$2\" = \"mcp add\" ] && echo \"claude \$*\" >> \"$ctl/claude.log\"" 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf 200' > "$d/curl"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude" "$d/curl"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user'
  grep -qF 'npm install -g @playwright/mcp@latest' "$ctl/npm.log" && echo NPM-OK
  [ -f "$h/Library/LaunchAgents/com.bootstrap-claude.playwright-mcp.plist" ] && echo PLIST-OK
  grep -qF "launchctl bootout gui/$(id -u)/com.bootstrap-claude.playwright-mcp" "$ctl/launchctl.log" && echo BOOTOUT-OK
  grep -qF "launchctl bootstrap gui/$(id -u) $h/Library/LaunchAgents/com.bootstrap-claude.playwright-mcp.plist" "$ctl/launchctl.log" && echo BOOTSTRAP-OK
  grep -qF 'claude mcp add --scope user playwright --transport http http://127.0.0.1:8931/mcp' "$ctl/claude.log" && echo REGISTER-OK
  rm -rf "$d"
  ```
- **Expected Result**: in order — `  playwright: listening on http://127.0.0.1:8931/mcp` (from `_add_playwright`), then `NPM-OK`, `PLIST-OK`, `BOOTOUT-OK`, `BOOTSTRAP-OK`, `REGISTER-OK`. `REGISTER-OK` proves forced **user** scope + `--transport http` regardless of the `user` arg passed in (the darwin branch hardcodes `mcp_add_scoped user`)
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (`package.json` `test` is a stub — precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-002: Generated plist content — node-direct invocation, all required launchd keys, no npx
- **Scenario**: the rendered plist (a generated artifact, safe to grep) carries label `com.bootstrap-claude.playwright-mcp`; `ProgramArguments` = absolute node + `<npm root -g>/@playwright/mcp/cli.js` + `--port 8931 --host 127.0.0.1` (never `npx`); `RunAtLoad`; `KeepAlive.SuccessfulExit=false`; `ThrottleInterval 30`; `LimitLoadToSessionType Aqua`; both log paths → `$HOME/Library/Logs/playwright-mcp.log`; `WorkingDirectory=$HOME`
- **Steps**:
  1. Run the block below (same harness as UAT-SH-001, then greps the generated plist)
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"; nr="$d/npmroot"
  mkdir -p "$h" "$ctl" "$nr/@playwright/mcp"
  echo '// stub cli' > "$nr/@playwright/mcp/cli.js"
  printf '%s\n' '#!/bin/sh' "[ \"\$1\" = root ] && { echo \"$nr\"; exit 0; }" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf 200' > "$d/curl"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude" "$d/curl"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user' >/dev/null
  p="$h/Library/LaunchAgents/com.bootstrap-claude.playwright-mcp.plist"
  grep -qF '<string>com.bootstrap-claude.playwright-mcp</string>' "$p" && echo LABEL-OK
  grep -qF "<string>$nr/@playwright/mcp/cli.js</string>" "$p" && echo CLI-OK
  grep -qF "<string>$(command -v node)</string>" "$p" && echo NODE-OK
  grep -qF '<string>--port</string>' "$p" && grep -qF '<string>8931</string>' "$p" && grep -qF '<string>--host</string>' "$p" && grep -qF '<string>127.0.0.1</string>' "$p" && echo ARGS-OK
  grep -qF '<key>RunAtLoad</key>' "$p" && grep -qF '<key>SuccessfulExit</key>' "$p" && grep -qF '<false/>' "$p" && echo KEEPALIVE-OK
  grep -qF '<key>ThrottleInterval</key>' "$p" && grep -qF '<integer>30</integer>' "$p" && echo THROTTLE-OK
  grep -qF '<string>Aqua</string>' "$p" && echo AQUA-OK
  grep -cF "<string>$h/Library/Logs/playwright-mcp.log</string>" "$p" | grep -qx 2 && echo LOGS-OK
  grep -qF "<key>WorkingDirectory</key>" "$p" && grep -qF "<string>$h</string>" "$p" && echo WORKDIR-OK
  grep -cF 'npx' "$p" | grep -qx 0 && echo NO-NPX-OK
  rm -rf "$d"
  ```
- **Expected Result**: `LABEL-OK`, `CLI-OK`, `NODE-OK`, `ARGS-OK`, `KEEPALIVE-OK`, `THROTTLE-OK`, `AQUA-OK`, `LOGS-OK` (log path appears exactly twice — StandardOutPath and StandardErrorPath), `WORKDIR-OK`, `NO-NPX-OK` — all ten lines
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 (hook blocked embedded greps on the generated plist; verified all 10 assertions by direct Read of the rendered plist) -->

### UAT-SH-003: Idempotent re-run — unchanged plist + agent loaded = launchd untouched
- **Scenario**: second run with identical plist and `launchctl print` succeeding (agent loaded) must only query `print` — no `bootout`, no `bootstrap` (the `cmp -s` else-branch, install-mcps.sh ~226-233); registration and verify still run
- **Steps**:
  1. Run the block below — first call provisions; the log is truncated, `print_rc` set to 0, then `_add_playwright user` runs again
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"; nr="$d/npmroot"
  mkdir -p "$h" "$ctl" "$nr/@playwright/mcp"
  echo '// stub cli' > "$nr/@playwright/mcp/cli.js"
  printf '%s\n' '#!/bin/sh' "[ \"\$1\" = root ] && { echo \"$nr\"; exit 0; }" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' "echo \"launchctl \$*\" >> \"$ctl/launchctl.log\"" 'case "$1" in' "  print) exit \"\$(cat \"$ctl/print_rc\" 2>/dev/null || echo 1)\" ;;" 'esac' 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf 200' > "$d/curl"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude" "$d/curl"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user' >/dev/null
  : > "$ctl/launchctl.log"; echo 0 > "$ctl/print_rc"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user'
  grep -qF "launchctl print gui/$(id -u)/com.bootstrap-claude.playwright-mcp" "$ctl/launchctl.log" && echo PRINT-OK
  grep -c . "$ctl/launchctl.log" | grep -qx 1 && echo NOOP-OK
  rm -rf "$d"
  ```
- **Expected Result**: `  playwright: listening on http://127.0.0.1:8931/mcp` (second run still registers + verifies), then `PRINT-OK` and `NOOP-OK` — the second run's launchctl log contains exactly one line (the `print` liveness query); no `bootout`/`bootstrap` entries
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-004: Unchanged plist but agent not loaded — bootstrap-only (no bootout)
- **Scenario**: plist identical but `launchctl print` fails (fresh login session / prior bootout) → `_playwright_bootstrap_agent` is called without a preceding `bootout` (install-mcps.sh ~228-232)
- **Steps**:
  1. Run the block below — provision once, truncate the log, force `print_rc=1`, run again
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"; nr="$d/npmroot"
  mkdir -p "$h" "$ctl" "$nr/@playwright/mcp"
  echo '// stub cli' > "$nr/@playwright/mcp/cli.js"
  printf '%s\n' '#!/bin/sh' "[ \"\$1\" = root ] && { echo \"$nr\"; exit 0; }" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' "echo \"launchctl \$*\" >> \"$ctl/launchctl.log\"" 'case "$1" in' "  print) exit \"\$(cat \"$ctl/print_rc\" 2>/dev/null || echo 1)\" ;;" 'esac' 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf 200' > "$d/curl"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude" "$d/curl"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user' >/dev/null
  : > "$ctl/launchctl.log"; echo 1 > "$ctl/print_rc"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user' >/dev/null
  grep -qF "launchctl print gui/$(id -u)/com.bootstrap-claude.playwright-mcp" "$ctl/launchctl.log" && echo PRINT-OK
  grep -qF "launchctl bootstrap gui/$(id -u) $h/Library/LaunchAgents/com.bootstrap-claude.playwright-mcp.plist" "$ctl/launchctl.log" && echo BOOTSTRAP-OK
  grep -cF 'launchctl bootout' "$ctl/launchctl.log" | grep -qx 0 && echo NO-BOOTOUT-OK
  rm -rf "$d"
  ```
- **Expected Result**: `PRINT-OK`, `BOOTSTRAP-OK`, `NO-BOOTOUT-OK` — the reload path re-bootstraps without ever booting out
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-005: Changed plist — bootout + bootstrap and the installed plist is rewritten
- **Scenario**: when the rendered plist differs from the installed one (`cmp -s` fails), the new file is moved into place and the agent is booted out then re-bootstrapped; no `print` liveness query happens on this branch (install-mcps.sh ~221-225)
- **Steps**:
  1. Run the block below — provision once, append a drift marker to the installed plist, truncate the log, run again
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"; nr="$d/npmroot"
  mkdir -p "$h" "$ctl" "$nr/@playwright/mcp"
  echo '// stub cli' > "$nr/@playwright/mcp/cli.js"
  printf '%s\n' '#!/bin/sh' "[ \"\$1\" = root ] && { echo \"$nr\"; exit 0; }" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' "echo \"launchctl \$*\" >> \"$ctl/launchctl.log\"" 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf 200' > "$d/curl"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude" "$d/curl"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user' >/dev/null
  p="$h/Library/LaunchAgents/com.bootstrap-claude.playwright-mcp.plist"
  echo '<!-- drift -->' >> "$p"
  : > "$ctl/launchctl.log"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user' >/dev/null
  grep -qF "launchctl bootout gui/$(id -u)/com.bootstrap-claude.playwright-mcp" "$ctl/launchctl.log" && echo BOOTOUT-OK
  grep -qF "launchctl bootstrap gui/$(id -u) $p" "$ctl/launchctl.log" && echo BOOTSTRAP-OK
  grep -cF 'launchctl print' "$ctl/launchctl.log" | grep -qx 0 && echo NO-PRINT-OK
  grep -cF 'drift' "$p" | grep -qx 0 && echo REWRITTEN-OK
  rm -rf "$d"
  ```
- **Expected Result**: `BOOTOUT-OK`, `BOOTSTRAP-OK`, `NO-PRINT-OK`, `REWRITTEN-OK` — drift is repaired by reinstalling the plist and cycling the agent
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-SH-006: Non-darwin branch — per-session stdio registration, no launchd machinery
- **Scenario**: with `uname -s` ≠ `Darwin`, `_add_playwright` keeps the pre-TASK-023 behavior exactly (`mcp_add_scoped "$1" playwright -- npx @playwright/mcp@latest`, install-mcps.sh ~158-161) and the call site computes `playwright_expected=""` (never upgrade on Linux); npm/launchctl are never touched and no plist is written
- **Steps**:
  1. Run the block below — a `uname` shim printing `Linux` drives the non-darwin branch on this darwin machine; a fresh (non-installed) claude shim exercises the source-time call site too
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"
  mkdir -p "$h" "$ctl"
  printf '%s\n' '#!/bin/sh' 'echo Linux' > "$d/uname"
  printf '%s\n' '#!/bin/sh' "echo \"npm \$*\" >> \"$ctl/npm.log\"" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' "echo \"launchctl \$*\" >> \"$ctl/launchctl.log\"" 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' "[ \"\$1 \$2\" = \"mcp add\" ] && echo \"claude \$*\" >> \"$ctl/claude.log\"" 'exit 0' > "$d/claude"
  chmod +x "$d/uname" "$d/npm" "$d/launchctl" "$d/claude"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; [ -z "$playwright_expected" ] && echo EXPECTED-EMPTY-OK; _add_playwright user && echo RC0-OK'
  grep -qF 'claude mcp add --scope user playwright -- npx @playwright/mcp@latest' "$ctl/claude.log" && echo STDIO-OK
  [ ! -f "$ctl/npm.log" ] && [ ! -f "$ctl/launchctl.log" ] && echo NO-DARWIN-MACHINERY-OK
  [ ! -e "$h/Library/LaunchAgents/com.bootstrap-claude.playwright-mcp.plist" ] && echo NO-PLIST-OK
  rm -rf "$d"
  ```
- **Expected Result**: `EXPECTED-EMPTY-OK` (call site left `playwright_expected` empty on non-darwin), `RC0-OK`, `STDIO-OK` (exact legacy stdio registration), `NO-DARWIN-MACHINERY-OK`, `NO-PLIST-OK`
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-EDGE-001: "Bootstrap failed: 5" (no GUI session) — hint printed, return 0, registration skipped
- **Scenario**: `_playwright_bootstrap_agent` maps launchctl output containing `Bootstrap failed: 5` to return code 2 with the SSH/no-GUI hint (install-mcps.sh ~148-150); `_add_playwright` then returns 0 **without** registering or probing the endpoint (~233-235)
- **Steps**:
  1. Run the block below — the launchctl shim emits `Bootstrap failed: 5` and exits 1 on `bootstrap`
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"; nr="$d/npmroot"
  mkdir -p "$h" "$ctl" "$nr/@playwright/mcp"
  echo '// stub cli' > "$nr/@playwright/mcp/cli.js"
  printf '%s\n' '#!/bin/sh' "[ \"\$1\" = root ] && { echo \"$nr\"; exit 0; }" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' '[ "$1" = bootstrap ] && { echo "Bootstrap failed: 5: Input/output error"; exit 1; }' 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' "[ \"\$1 \$2\" = \"mcp add\" ] && echo \"claude \$*\" >> \"$ctl/claude.log\"" 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf 200' > "$d/curl"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude" "$d/curl"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user && echo RC0-OK'
  [ ! -f "$ctl/claude.log" ] && echo NOREG-OK
  rm -rf "$d"
  ```
- **Expected Result**: `  playwright: no GUI session (running over SSH?) — log into the Mac GUI once, then re-run 'bootstrap update'.`, then `RC0-OK` (return 0 despite the failure — non-fatal by design), then `NOREG-OK` (no `claude mcp add` was attempted and no endpoint probe ran — the HTTP registration would be dead weight without a running agent)
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-EDGE-002: Generic bootstrap failure — warning, then registration + endpoint diagnostics still run
- **Scenario**: any other `launchctl bootstrap` failure returns 1 from the helper (~152-153); `_add_playwright` falls through (rc≠2), still registers, and when `wait_http_up` fails prints the diagnostics block — `launchctl print` output plus the log path (~238-241)
- **Steps**:
  1. Run the block below — bootstrap emits a non-5 error; `curl` answers `000` (down) and a `sleep` shim makes `wait_http_up`'s 10 attempts instant
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"; nr="$d/npmroot"
  mkdir -p "$h" "$ctl" "$nr/@playwright/mcp"
  echo '// stub cli' > "$nr/@playwright/mcp/cli.js"
  printf '%s\n' '#!/bin/sh' "[ \"\$1\" = root ] && { echo \"$nr\"; exit 0; }" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' "echo \"launchctl \$*\" >> \"$ctl/launchctl.log\"" '[ "$1" = bootstrap ] && { echo "Bootstrap failed: 37: something else"; exit 1; }' 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' "[ \"\$1 \$2\" = \"mcp add\" ] && echo \"claude \$*\" >> \"$ctl/claude.log\"" 'exit 0' > "$d/claude"
  printf '%s\n' '#!/bin/sh' 'printf 000' > "$d/curl"
  printf '%s\n' '#!/bin/sh' 'exit 0' > "$d/sleep"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude" "$d/curl" "$d/sleep"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user && echo RC0-OK'
  grep -qF 'claude mcp add --scope user playwright --transport http http://127.0.0.1:8931/mcp' "$ctl/claude.log" && echo REGISTERED-ANYWAY-OK
  grep -qF "launchctl print gui/$(id -u)/com.bootstrap-claude.playwright-mcp" "$ctl/launchctl.log" && echo DIAG-PRINT-OK
  rm -rf "$d"
  ```
- **Expected Result**: output contains, in order — `  WARNING: launchctl bootstrap failed: Bootstrap failed: 37: something else`, `  WARNING: playwright endpoint not answering — diagnostics:`, `  Log: <tmp-home>/Library/Logs/playwright-mcp.log`, `RC0-OK`; then `REGISTERED-ANYWAY-OK` (registration is not gated on generic bootstrap failure) and `DIAG-PRINT-OK` (the diagnostics block invoked `launchctl print`)
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-EDGE-003: npm install failure — clear error, return 1, nothing provisioned
- **Scenario**: the first guard (~171-172): `npm install -g` failing aborts with an actionable message before any plist/launchd/registration work
- **Steps**:
  1. Run the block below — the npm shim fails `install`
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"
  mkdir -p "$h" "$ctl"
  printf '%s\n' '#!/bin/sh' '[ "$1" = install ] && exit 1' 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' "echo \"launchctl \$*\" >> \"$ctl/launchctl.log\"" 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' "[ \"\$1 \$2\" = \"mcp add\" ] && echo \"claude \$*\" >> \"$ctl/claude.log\"" 'exit 0' > "$d/claude"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user && echo UNEXPECTED-OK || echo "ERR-RC=$?"'
  [ ! -d "$h/Library/LaunchAgents" ] && echo NO-PLIST-DIR-OK
  [ ! -f "$ctl/launchctl.log" ] && [ ! -f "$ctl/claude.log" ] && echo NO-SIDE-EFFECTS-OK
  rm -rf "$d"
  ```
- **Expected Result**: `  ERROR: 'npm install -g @playwright/mcp' failed — fix npm, then re-run 'bootstrap update'.`, then `ERR-RC=1`, `NO-PLIST-DIR-OK`, `NO-SIDE-EFFECTS-OK`; `UNEXPECTED-OK` must not appear
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-EDGE-004: Global install produced no cli.js — clear error, return 1
- **Scenario**: the third guard (~176-178): `$(npm root -g)/@playwright/mcp/cli.js` missing after a "successful" install aborts before any plist work
- **Steps**:
  1. Run the block below — `npm root -g` points at an empty tree with no `@playwright/mcp/cli.js`
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"; ctl="$d/ctl"; nr="$d/npmroot"
  mkdir -p "$h" "$ctl" "$nr"
  printf '%s\n' '#!/bin/sh' "[ \"\$1\" = root ] && { echo \"$nr\"; exit 0; }" 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' "echo \"launchctl \$*\" >> \"$ctl/launchctl.log\"" 'exit 0' > "$d/launchctl"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' 'exit 0' > "$d/claude"
  chmod +x "$d/npm" "$d/launchctl" "$d/claude"
  PATH="$d:$PATH" HOME="$h" bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user && echo UNEXPECTED-OK || echo "ERR-RC=$?"'
  [ ! -d "$h/Library/LaunchAgents" ] && echo NO-PLIST-DIR-OK
  rm -rf "$d"
  ```
- **Expected Result**: `  ERROR: <tmp>/npmroot/@playwright/mcp/cli.js missing — global @playwright/mcp install did not produce a cli entry.`, then `ERR-RC=1` and `NO-PLIST-DIR-OK`; `UNEXPECTED-OK` must not appear
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

### UAT-EDGE-005: node missing from PATH — clear error, return 1
- **Scenario**: the second guard (~173-175): a restricted PATH containing npm but no node aborts with "node not found on PATH" before resolving `pw_cli`
- **Steps**:
  1. Run the block below — PATH is set to ONLY the shim dir, which carries `npm`/`claude` shims and symlinks to the real `dirname`/`uname`/`grep` (the only external commands reached before the node guard fires); no `node` exists there
- **Command**:
  ```bash
  d="$(mktemp -d)"; h="$d/home"
  mkdir -p "$h"
  printf '%s\n' '#!/bin/sh' 'exit 0' > "$d/npm"
  printf '%s\n' '#!/bin/sh' '[ "$1 $2" = "mcp get" ] && { echo "http://127.0.0.1:8941/mcp http://127.0.0.1:8931/mcp"; exit 0; }' 'exit 0' > "$d/claude"
  chmod +x "$d/npm" "$d/claude"
  ln -s /usr/bin/dirname /usr/bin/uname /usr/bin/grep "$d/"
  env PATH="$d" HOME="$h" /bin/bash -c 'set -euo pipefail; source lib/scripts/install-mcps.sh >/dev/null; _add_playwright user && echo UNEXPECTED-OK || echo "ERR-RC=$?"'
  rm -rf "$d"
  ```
- **Expected Result**: `  ERROR: node not found on PATH — install Node.js, then re-run 'bootstrap update'.`, then `ERR-RC=1`; `UNEXPECTED-OK` must not appear
- **Repeatable Unit Test**: Blocked: repo has no shell test harness (precedent UAT-020/021/022)
- [x] Pass <!-- 2026-07-28 -->

---

## Deferred to TASK-025 (explicitly out of scope here)

Live launchd/browser runtime verification is TASK-023 step 3's declared `[DEFERRED-TO-UAT]` → TASK-025 territory and is **not** covered by this file:

- The LaunchAgent actually running under real launchd in an Aqua session (real `launchctl bootstrap` against `gui/<uid>`)
- Port 8931 answering a real MCP `initialize` over streamable HTTP
- Headed browser launch working from the launchd-owned server
- KeepAlive/ThrottleInterval restart behavior after a crash
- Survival across logout/login and reboot
