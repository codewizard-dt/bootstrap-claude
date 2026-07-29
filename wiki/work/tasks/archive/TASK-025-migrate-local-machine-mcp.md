---
id: TASK-025
title: "Migrate this machine's MCP registrations to the single-process design (runtime UAT)"
status: done
created: 2026-07-28
updated: 2026-07-29
depends_on: [TASK-022, TASK-023, TASK-024]
blocks: []
parallel_safe_with: [TASK-027]
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
- [x] Open **two concurrent** Claude Code sessions; then: `docker ps` shows exactly one `brave-search-mcp` container; `ps aux` shows exactly one `node …/@playwright/mcp/cli.js` process and **zero** per-session MCP child processes for brave/playwright (guards the claude-code#29688-style stdio-child bug); `docker exec brave-search-mcp ps` shows the single `node dist/index.js`. *(Per-session Serena stdio children observed — expected, Serena is per-session by design. A `brave-search-mcp-server` line from a Cursor IDE extension host was ruled out as unrelated.)*
- [x] Live tool calls from a session: one `brave_web_search` and one `browser_snapshot` succeed.
- [x] Reboot-survival: `docker restart` the container and `launchctl kickstart -k` the agent (or a real reboot); both endpoints answer again without any manual re-registration (`wait_http_up` both URLs). *(Ordering constraint: run before TASK-027 step 4 ships — its planned `absolute-path-guard.js` bare-basename block on `launchctl` would deny `kickstart`; that hook should match destructive subcommands (`load|bootstrap|submit|unload|bootout`) only, since `install-mcps.sh` itself uses `launchctl bootstrap/bootout/print`.)*
- [x] Idempotency: re-run `install-mcps.sh` — everything reports "already installed, skipping" (URL match), nothing restarts. *(Prerequisite: `BRAVE_API_KEY` must be in the session env — TASK-026 shipped `Read(**/.env)` deny, and TASK-027 step 5 plans to block `source .env`, which is this flow's only remaining agent-accessible key route; without the key the script silently skips brave and the check doesn't exercise it.)* *(Outcome note: no repo-root `.env` exists, so the key was absent — but the URL-match skip at `install-mcps.sh:74-75` fires before the key prompt, so the idempotency path was still fully exercised for all three MCPs.)*

<!-- Updated: 2026-07-29 -->

### 3. Record  <!-- agent: general-purpose -->

- [x] Capture the verification evidence (command outputs) into the task file under a `## Verification Evidence` section; check off the corresponding roadmap Phase 5 item. *(Evidence appended below; ROADMAP-003 Phase 5's single item flipped — all phases 0–5 now checked, roadmap still `active` pending `/roadmap-next`.)*

<!-- Updated: 2026-07-29 -->

## Verification Evidence

Captured 2026-07-29, from the Step 2 runtime UAT.

### Checkbox 1 — single-process model under two concurrent sessions (PASS)

```
$ docker ps --filter name=brave-search-mcp
6918701d7259   mcp/brave-search   "node dist/index.js …"   Up 29 hours   127.0.0.1:8941->8941/tcp   brave-search-mcp

$ ps aux | grep "@playwright/mcp/cli.js" | grep -v grep      # exactly one
davidtaylor  60023  ... node /opt/homebrew/lib/node_modules/@playwright/mcp/cli.js --port 8931 --host 127.0.0.1

$ docker exec brave-search-mcp ps aux
PID 1 node dist/index.js --transport http --host 0.0.0.0 --port 8941
```

Zero per-session brave/playwright stdio children across both sessions. Only per-session Serena stdio children were present (expected by design); a `brave-search-mcp-server` process line turned out to be a Cursor IDE extension host, unrelated.

### Checkbox 2 — live tool calls (PASS)

```
brave_web_search("Model Context Protocol streamable HTTP transport", count=3) → 3 results returned
browser_navigate("https://example.com") → "Example Domain"; browser_snapshot → heading + link refs OK
browser_close → "No open tabs."
```

### Checkbox 3 — reboot-survival (PASS)

```
$ docker restart brave-search-mcp && launchctl kickstart -k gui/$(id -u)/com.bootstrap-claude.playwright-mcp
# curl poll: http://127.0.0.1:8941/mcp → HTTP 406 after 1s; http://localhost:8931/mcp → HTTP 400 after 1s
# (4xx on bare GET = MCP endpoint answering)

$ claude mcp list
brave-search: http://127.0.0.1:8941/mcp (HTTP) - ✔ Connected
playwright: http://localhost:8931/mcp (HTTP) - ✔ Connected
```

Playwright was relaunched by launchd under a new PID (64575) with no manual re-registration.

### Checkbox 4 — installer idempotency (PASS)

```
$ ./lib/scripts/install-mcps.sh </dev/null
BRAVE_API_KEY: NOT set
  brave-search: already installed, skipping.
  context7: already installed, skipping.
  playwright: already installed, skipping.
```

Container uptime spans the checkbox-3 restart (the idempotent re-run did not bounce it); playwright PID unchanged (64575). Note: no repo-root `.env` exists, so the key was absent — but the URL-match skip (`install-mcps.sh:74-75`) fires before the key prompt, so the idempotency path was fully exercised for all three MCPs despite the missing key.
