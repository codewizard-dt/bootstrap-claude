---
id: TASK-023
title: "playwright → native launchd LaunchAgent HTTP server (darwin), stdio fallback elsewhere"
status: done
created: 2026-07-28
updated: 2026-07-28
depends_on: [TASK-021]
blocks: [TASK-024, TASK-025]
parallel_safe_with: [TASK-022]
uat: "[[UAT-023]]"
tags: [mcp, setup-scripts, launchd, playwright]
---

# TASK-023 — playwright → native launchd LaunchAgent HTTP server

derived_from::[raw/research/mcp-one-process-per-user/index.md](../../../raw/research/mcp-one-process-per-user/index.md)
implements::[[ROADMAP-003]] Phase 3

## Objective

Run Playwright MCP as one shared HTTP server per machine via a macOS launchd LaunchAgent (preserving headed-browser support — the reason it is not containerized), registered at forced user scope with `--transport http`; non-darwin platforms keep the current per-session stdio `npx` registration.

## Approach

**Never run `npx @playwright/mcp@latest` under launchd**: launchd agents get PATH `/usr/bin:/bin:/usr/sbin:/sbin` (no Homebrew, so neither `npx` nor its `#!/usr/bin/env node` shebang resolve), and `@latest` forces a registry round-trip on every start → offline crash-loop. Instead install the package globally at provision time and invoke node directly on the package's cli entry. In HTTP mode each MCP client connection gets its own isolated browser context by default, so concurrent sessions are safe. All of `_add_playwright` branches on `[ "$(uname -s)" = "Darwin" ]`.

## Steps

### 1. Darwin provisioning in _add_playwright  <!-- agent: general-purpose -->

- [x] In `lib/scripts/install-mcps.sh`, rewrite `_add_playwright()` (line ~100-102) with a darwin branch:
  1. `npm install -g @playwright/mcp@latest`
  2. Resolve `NODE_BIN="$(command -v node)"` and `PW_CLI="$(npm root -g)/@playwright/mcp/cli.js"`; fail with a clear message if either is missing.
  3. Write `~/Library/LaunchAgents/com.bootstrap-claude.playwright-mcp.plist` (label `com.bootstrap-claude.playwright-mcp`) via a heredoc to a temp file first:
     - `ProgramArguments`: `[NODE_BIN, PW_CLI, "--port", "$PLAYWRIGHT_MCP_PORT", "--host", "127.0.0.1"]`
     - `RunAtLoad` true; `KeepAlive` = `{SuccessfulExit: false}`; `ThrottleInterval` 30
     - `LimitLoadToSessionType` `Aqua` (headed browser requires a GUI session)
     - `StandardOutPath`/`StandardErrorPath`: `$HOME/Library/Logs/playwright-mcp.log`; `WorkingDirectory`: `$HOME`
  4. Idempotent load: `cmp -s` temp vs installed plist — on change, install + `launchctl bootout "gui/$(id -u)/com.bootstrap-claude.playwright-mcp" 2>/dev/null || true` + `launchctl bootstrap "gui/$(id -u)" <plist>`; unchanged but not loaded (`launchctl print` fails) → bootstrap only; unchanged and loaded → nothing. On `Bootstrap failed: 5` (SSH/no-GUI session), print a "log into the Mac GUI once, then re-run 'bootstrap update'" hint and return 0.
  5. Register at forced user scope (same comment pattern as brave): `mcp_add_scoped user playwright --transport http "$PLAYWRIGHT_MCP_URL"`.
  6. Verify: `wait_http_up "$PLAYWRIGHT_MCP_URL"`; on failure print `launchctl print gui/$(id -u)/com.bootstrap-claude.playwright-mcp` and the log path as diagnostics.

<!-- Updated: 2026-07-28 -->

### 2. Non-darwin fallback + upgrade wiring  <!-- agent: general-purpose -->

- [x] Non-darwin branch keeps the existing behavior exactly: `mcp_add_scoped "$1" playwright -- npx @playwright/mcp@latest`.
- [x] Update the `register_optional_mcp playwright …` call site (line ~130) to pass `"$PLAYWRIGHT_MCP_URL"` as the 4th `expected` arg **on darwin only** (e.g. compute the arg into a variable that is empty on other platforms) — Linux must not "upgrade" its stdio entry on every run.

### 3. Verify  <!-- agent: general-purpose -->

- [x] `bash -n lib/scripts/install-mcps.sh` passes.
- [x] Serena search: plist heredoc contains all required keys (`LimitLoadToSessionType`, `ThrottleInterval`, `SuccessfulExit`); no `npx` inside `ProgramArguments`; darwin gate present; non-darwin path unchanged.
- [x] Runtime verification (agent actually running, port answering, headed browser) deferred to TASK-025. [DEFERRED-TO-UAT]
