---
id: TASK-024
aliases: [TASK-024]
title: "Docs & guide alignment for single-process HTTP MCP servers"
status: done
created: 2026-07-28
updated: 2026-07-28
depends_on: [TASK-022, TASK-023]
blocks: [TASK-025]
parallel_safe_with: []
uat: "[[UAT-024]]"
tags: [mcp, docs]
---

# TASK-024 — Docs & guide alignment for single-process HTTP MCP servers

derived_from::[raw/research/mcp-one-process-per-user/index.md](../../../raw/research/mcp-one-process-per-user/index.md)
implements::[[ROADMAP-003]] Phase 4

## Objective

Align every doc surface with the new brave (HTTP container) and playwright (launchd) designs, and fix the pre-existing contradictory brave rate-limit claims while touching the same surfaces.

## Approach

Docs-only task; final command shapes come from the landed TASK-022/023 code (read `install-mcps.sh` first — never restate from memory). The rate-limit contradiction is: `build-mcp-guide.sh:100` Quick-Reference row says "sequential, 1/sec" and `CLAUDE.md:82` repeats it, while the brave stub (`templates/guides/stubs/brave-search.md:4,6`) and multiple skills say 50 req/sec parallel — the 50/sec figure is correct.

## Steps

### 1. setup-project.sh epilogue  <!-- agent: general-purpose -->

- [x] Rewrite `lib/scripts/setup-project.sh:46-58`: drop the stale exec-wrapper re-add command; new story —
  - brave key rotation: `docker rm -f brave-search-mcp` then re-run `npx @codewizard-dt/bootstrap update`
  - brave image update: `docker rm -f brave-search-mcp && docker pull docker.io/mcp/brave-search` then re-run update
  - playwright restart/update: `npm i -g @playwright/mcp@latest && launchctl kickstart -k gui/$(id -u)/com.bootstrap-claude.playwright-mcp`
  - ports overridable via `BRAVE_MCP_PORT` / `PLAYWRIGHT_MCP_PORT` env vars before running setup/update
  - keep the context7 lines unchanged

<!-- Updated: 2026-07-28 — Section 1 complete: epilogue rewritten (rotation story, playwright kickstart line, port-override note, context7 kept); bash -n clean -->


### 2. README.md  <!-- agent: general-purpose -->

- [x] Line ~44 Tech row: add Docker + launchd alongside `claude mcp add`/`uvx`/`npx`.
- [x] Lines ~132/146/165-168 (architecture diagram): brave edge → Docker container node; playwright edge → launchd node; npx node scoped to non-darwin playwright + serena uvx unchanged.
- [x] Lines ~198-200 (sequence diagram): registration now includes container/agent provisioning.
- [x] Lines ~326-327 (env table): `BRAVE_API_KEY` now baked into the container (rotation story), add `BRAVE_MCP_PORT`/`PLAYWRIGHT_MCP_PORT` rows.
- [x] Line ~468 (troubleshooting): update brave prompt note; add "endpoint not answering → docker logs / launchctl print" entries.

<!-- Updated: 2026-07-28 — Section 2 complete: README tech row, architecture + sequence diagrams, env table (BRAVE_MCP_PORT/PLAYWRIGHT_MCP_PORT), troubleshooting entries; no 8080 anywhere -->


### 3. CLAUDE.md + guide sources  <!-- agent: general-purpose -->

- [x] `CLAUDE.md:81-84` manual-setup section: new brave/playwright registration story; fix the "1 req/sec, sequential only" brave claim (→ 50 req/sec, parallel allowed).
- [x] `lib/scripts/build-mcp-guide.sh:100`: Quick-Reference row `Brave Search (sequential, 1/sec)` → parallel/50 per sec, consistent with the stub.
- [x] `lib/scripts/templates/guides/stubs/playwright.md:20`: keep "no explicit launch step", add that on macOS the browser server is a shared launchd-managed HTTP service (isolated context per session).

<!-- Updated: 2026-07-28 — Section 3 complete: CLAUDE.md manual-setup rewritten (brave docker :8941, playwright launchd :8931, 50/sec parallel), build-mcp-guide.sh Quick-Reference row fixed (bash -n OK), playwright stub launchd note added -->


### 4. Shadowing hint  <!-- agent: general-purpose -->

- [x] In `install-mcps.sh` (darwin playwright path) or `run_project_sync`: when `$PROJECT_DIR/.mcp.json` exists and `grep -q '"playwright"'` matches (same pattern as `serena_installed`, lib.sh:48-51), echo a hint that a project-scoped playwright entry shadows the user-scope HTTP server: `claude mcp remove playwright -s project`. Echo only — never edit a project's `.mcp.json`.

<!-- Updated: 2026-07-28 — Section 4 complete: shadowing hint added after the playwright register_optional_mcp call site in install-mcps.sh (darwin + PROJECT_DIR guards, echo only); bash -n OK on install-mcps.sh and lib.sh -->


### 5. Verify  <!-- agent: general-purpose -->

- [x] Repo-wide Serena search: zero remaining "1/sec" or "sequential only" brave claims in live surfaces (`lib/`, `CLAUDE.md`, `README.md`); zero exec-wrapper command remnants in docs.
  - Sweep found 2 stragglers beyond the touched files — `lib/skills/decision-create/SKILL.md` ("Brave 1/sec sequential") and `lib/skills/research-company/SKILL.md` ("Search sequentially") — both fixed to parallel/50-per-sec wording; re-sweep clean. Port check also clean: no 8080 anywhere; brave 8941 both sides, playwright 8931.
- [x] `bash -n` on both touched scripts.
  - Clean 4/4: setup-project.sh, build-mcp-guide.sh, install-mcps.sh, lib.sh.

<!-- Updated: 2026-07-28 — Section 5 complete: verification sweep + straggler fixes; all static gates pass -->

