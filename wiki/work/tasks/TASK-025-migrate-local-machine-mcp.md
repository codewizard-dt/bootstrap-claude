---
id: TASK-025
title: "Migrate this machine's MCP registrations to the single-process design (runtime UAT)"
status: in-progress
created: 2026-07-28
updated: 2026-07-28
depends_on: [TASK-022, TASK-023, TASK-024]
blocks: []
parallel_safe_with: []
uat: ""
tags: [mcp, migration, runtime-verification]
---

# TASK-025 — Migrate this machine's MCP registrations (runtime UAT)

derived_from::[raw/research/mcp-one-process-per-user/index.md](../../../raw/research/mcp-one-process-per-user/index.md)
implements::[[ROADMAP-003]] Phase 5

## Objective

Apply the new single-process design to this machine's `~/.claude.json` and verify it end-to-end — this doubles as the runtime UAT the TASK-020 wrapper never received.

## Approach

Mostly an execution/verification task: clear the old-shape state, run the new installer path once, then assert the process model. The upgrade-detection path (TASK-021) should make the removals redundant — exercise it rather than pre-cleaning where possible, and fall back to manual removal only if it misbehaves (which is itself a finding).

## Steps

### 1. Migrate  <!-- agent: general-purpose -->

- [x] Preferred path: with `BRAVE_API_KEY` available in the environment and Docker Desktop running, run `lib/scripts/install-mcps.sh` (non-interactive) and confirm it prints the "upgrading registration (stdio → shared http)" line for both brave-search and playwright, removes the old entries itself, migrates the old sleep-entrypoint container (`docker rm -f` via the inspect case), provisions the HTTP container + launchd agent, and registers both HTTP entries. *(Note: no pre-existing `brave-search-mcp` container on this machine — the live old shape was a per-session `docker run -i --rm` stdio entry, so the inspect/migrate case was a fresh provision, not a `docker rm -f`.)*
- [x] Fallback (only if upgrade detection fails): `claude mcp remove brave-search -s user`, `claude mcp remove playwright -s user`, `docker rm -f brave-search-mcp`, re-run the installer; file the detection failure as a bug. *(Not needed — upgrade detection fired correctly for both servers; no bug to file.)*

<!-- Updated: 2026-07-28 -->


### 2. Verify single-process model  <!-- agent: general-purpose -->

- [x] `claude mcp list` shows brave-search and playwright connected via their `http://127.0.0.1:<port>/mcp` URLs. *(Correction found during UAT: playwright must be registered at `http://localhost:8931/mcp` — @playwright/mcp's DNS-rebinding guard 403s the `127.0.0.1` Host header. Installer fixed; brave stays at `http://127.0.0.1:8941/mcp`.)*
- [ ] Open **two concurrent** Claude Code sessions; then: `docker ps` shows exactly one `brave-search-mcp` container; `ps aux` shows exactly one `node …/@playwright/mcp/cli.js` process and **zero** per-session MCP child processes for brave/playwright (guards the claude-code#29688-style stdio-child bug); `docker exec brave-search-mcp ps` shows the single `node dist/index.js`.
- [ ] Live tool calls from a session: one `brave_web_search` and one `browser_snapshot` succeed.
- [ ] Reboot-survival: `docker restart` the container and `launchctl kickstart -k` the agent (or a real reboot); both endpoints answer again without any manual re-registration (`wait_http_up` both URLs).
- [ ] Idempotency: re-run `install-mcps.sh` — everything reports "already installed, skipping" (URL match), nothing restarts.

### 3. Record  <!-- agent: general-purpose -->

- [ ] Capture the verification evidence (command outputs) into the task file under a `## Verification Evidence` section; check off the corresponding roadmap Phase 5 item.
