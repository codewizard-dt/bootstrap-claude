---
id: TASK-021
aliases: [TASK-021]
title: "Shared plumbing for single-process HTTP MCP servers (constants, helpers, upgrade detection)"
status: done
created: 2026-07-28
updated: 2026-07-28
depends_on: []
blocks: [TASK-022, TASK-023]
parallel_safe_with: []
uat: "[[UAT-021]]"
tags: [mcp, setup-scripts]
---

# TASK-021 — Shared plumbing for single-process HTTP MCP servers

derived_from::[raw/research/mcp-one-process-per-user/index.md](../../../raw/research/mcp-one-process-per-user/index.md)
implements::[[ROADMAP-003]] Phase 1

## Objective

Add the shared infrastructure the brave (TASK-022) and playwright (TASK-023) HTTP conversions both need: port/URL constants as the single source of truth, `mcp_matches` + `wait_http_up` helpers in `lib.sh`, stdio→HTTP upgrade detection in `register_optional_mcp`, and a fix for the latent non-interactive `read` EOF failure.

## Approach

All helpers must stay bash-3.2 safe (macOS default bash; no jq/python/associative arrays). `mcp_matches` uses a fixed-string grep on `claude mcp get` output (immune to field-format drift — live output shapes vary). `wait_http_up` counts **any** HTTP status ≠ 000 as "up" because streamable-HTTP servers commonly answer plain GET with 400/405/406 (never use `curl -f`). Upgrade detection lets already-provisioned machines migrate on their next `bootstrap update` without breaking idempotency for already-upgraded ones.

## Steps

### 1. Constants in install-mcps.sh  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-28 -->

- [x] At the top of `lib/scripts/install-mcps.sh` (after the flag parsing, before `mcp_add_scoped`), add:
  - `BRAVE_MCP_PORT="${BRAVE_MCP_PORT:-8941}"`
  - `PLAYWRIGHT_MCP_PORT="${PLAYWRIGHT_MCP_PORT:-8931}"`
  - `BRAVE_MCP_URL="http://127.0.0.1:${BRAVE_MCP_PORT}/mcp"`
  - `PLAYWRIGHT_MCP_URL="http://127.0.0.1:${PLAYWRIGHT_MCP_PORT}/mcp"`
  - One comment: these are the single source of truth for ports/URLs (env-overridable); registration, upgrade checks, and epilogue text all derive from them.

### 2. lib.sh helpers  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-28 -->

- [x] In `lib/scripts/lib.sh`, near `mcp_installed` (line ~38), add:
  - `mcp_matches() { claude mcp get "$1" 2>/dev/null | grep -qF "$2"; }` with a comment: fixed-string match against `claude mcp get` output; used to distinguish "installed with expected shape" from "installed but stale (needs upgrade)".
  - `wait_http_up() { local i code; for i in $(seq 1 "${2:-10}"); do code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$1" 2>/dev/null || true)"; [ -n "$code" ] && [ "$code" != "000" ] && return 0; sleep 1; done; return 1; }` with a comment: any HTTP status proves the listener is up — streamable-HTTP servers 4xx plain GETs, so `curl -f` would false-negative.

### 3. Upgrade detection in register_optional_mcp  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-28 -->

- [x] Extend `register_optional_mcp <name> <prompt> <adder-fn>` (install-mcps.sh:47-65) with an optional 4th arg `expected`:
  - If `mcp_installed "$name"` and (`expected` empty OR `mcp_matches "$name" "$expected"`) → keep current skip message and return 0.
  - If installed and `expected` set but no match → `echo "  $name: upgrading registration (stdio → shared http)."`, `claude mcp remove "$name" -s user 2>/dev/null || true`, then fall through to run the adder (same interactive/non-interactive gating as a fresh install is NOT re-applied — the server was already wanted; call the adder directly with resolved scope `user`).
- [x] Callers updated in TASK-022/TASK-023 (they pass `"$BRAVE_MCP_URL"` / `"$PLAYWRIGHT_MCP_URL"`); this task only adds the mechanism — existing three call sites stay 3-arg and keep exact current behavior.

### 4. Fix the non-interactive read EOF bug  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-28 -->

- [x] `install-mcps.sh:71-74` (`_add_brave` non-interactive branch): `read -r BRAVE_API_KEY` returns non-zero at EOF on a non-tty stdin, which kills the whole script under `set -euo pipefail` (aborting `run_project_sync` mid-way in `install-global.sh` runs). Guard with `read -r BRAVE_API_KEY || true` and skip registration with a clear message when the key ends up empty.
  - [x] 2026-07-28 (post-UAT-021 research): guard extended to the remaining unguarded reads flagged one call site over — `_add_context7`'s non-interactive `read -r CONTEXT7_API_KEY` (the exact same EOF failure mode), plus the interactive `read -r -p` prompts in both `_add_context7` and `_add_brave`, all now `|| true`. Context7 registers fine with an empty key (keyless branch already exists), so no skip logic was needed.

### 5. Verify  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-28 -->

- [x] `bash -n lib/scripts/install-mcps.sh` and `bash -n lib/scripts/lib.sh` pass.
- [x] Serena search confirms: constants present once; `mcp_matches` and `wait_http_up` defined in lib.sh; `register_optional_mcp` accepts and uses the 4th arg; existing brave/context7/playwright call sites unchanged this task.
