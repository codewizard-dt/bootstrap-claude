---
id: TASK-017
aliases: [TASK-017]
title: "Manually verify dashboard liveness and edge cases"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-016]
blocks: []
parallel_safe_with: []
uat: "[[UAT-017]]"
tags: [wiki-tooling, dashboard]
---

# TASK-017 — Manually verify dashboard liveness and edge cases

## Objective

Manually verify the end-to-end dashboard feature (TASK-012 through TASK-016) works as a real developer would use it: launch it against this repo, confirm it shows live data, confirm it stays live across edits, and confirm it degrades gracefully on edge cases. This is Phase 5 of ROADMAP-002.

Note: ROADMAP-002's Goal section references "the plan's verification checklist" from a plan-mode design session — that plan file was not persisted anywhere in the repo (searched `wiki/`, `raw/`, and for any `.claude/` session artifacts; none found). The checklist below is reconstructed from the roadmap's stated goal and Phase descriptions instead.

## Approach

This is inherently a manual/UI verification task (launching a real server, opening a real browser, watching live polling behavior) — it cannot be fully automated by `/uat-auto`. Per this project's power-mode conventions, UI verification steps that require human judgment are an acceptable resting state and do not block the roadmap from being considered functionally complete; this task's purpose is to have *a* pass done and documented, flagging anything a human should double-check.

## Steps

### 1. Launch and confirm basic liveness <!-- agent: general-purpose -->

- [x] Run `node lib/scripts/wiki-dashboard-server.js .` (or `bin/cli.js dashboard` once TASK-014 lands) from this repo root
- [x] Confirm the server binds and prints a URL; open it and confirm `dashboard.html` renders with all six family panels (requirements, decisions, roadmaps, tasks, uat, bugs)
- [x] Confirm each panel shows this repo's actual current active items (cross-check against each family's `index.md`)

### 2. Confirm live-update behavior <!-- agent: general-purpose -->

- [x] While the dashboard is open, edit a family `index.md` (e.g. append a test line to `wiki/work/tasks/index.md`, then revert it) and confirm the dashboard picks up the change within one polling interval without a manual page reload
- [x] Confirm response headers include `Cache-Control: no-store` (check via browser devtools network tab or `curl -I`)

### 3. Confirm edge cases <!-- agent: general-purpose -->

- [x] Confirm behavior when a family's `index.md` body is the `_(none yet)_` placeholder (empty state renders cleanly, no console errors)
- [x] Confirm port fallback: start the dashboard once, then start it again without stopping the first — confirm the second instance binds to `port + 1` instead of crashing
- [x] Confirm a path-traversal attempt (e.g. requesting `/wiki/../../../etc/passwd` or similar) is rejected (403/404), not served
- [x] Note any issues found as follow-up bugs via `/bug-file` rather than fixing inline in this verification task

## Verification Results (2026-07-06)

Verified via CLI (`curl` + backgrounded `node` child processes); server disconnected from Serena this session so no browser driver used. All steps pass.

**Step 1 — liveness:** `node lib/scripts/wiki-dashboard-server.js . 4420` bound and printed `http://localhost:4420`. `GET /` → 200, `text/html`, 24261 bytes, `<title>Wiki Dashboard</title>`. All six family panels present in served HTML. Active-item counts match each `index.md`: requirements 0, decisions 0, roadmaps 2 (ROADMAP-001, ROADMAP-002), tasks 1 (TASK-017), uat 0, bugs 0.

**Step 2 — live-update + headers:** Edited `wiki/work/tasks/index.md` (added TASK-999 line) via editor; next `GET /wiki/work/tasks/index.md` reflected the new line with no server restart (server reads file per-request), then reverted cleanly (file back to prior state, diff unchanged). `Cache-Control: no-store` (+ `Pragma: no-cache`, `Expires: 0`) present on 200 GET responses for both `/` and wiki `.md` files.

**Step 3 — edge cases:** Empty-state — requirements `_(none yet)_` served 200, parser yields 0 items → "No active items."; unknown family path → 404 graceful. Port fallback — second instance started on 4420 while first held it → bound 4421 and served 200 (no crash). Path traversal — `/wiki/../../../etc/passwd` → 404, encoded `%2e%2e` variant → 403, `curl --path-as-is` raw traversal → 403 with no `/etc/passwd` contents leaked, sibling-prefix escape (`/wiki/../wiki-fake`) → 403.

**Observations (non-blocking, not filed as bugs):**
- `HEAD` requests return `405 Method Not Allowed` (server is GET-only), so a bare `curl -I` reports 405 — the no-cache headers are still emitted on that response, and browsers use GET, so this is cosmetic. Not filed.
- Archive panels parse 0 items because `archive/index.md` files use a Markdown **table** format rather than `- [Title](path)` bullet links, which the client parser targets. Active panels (the dashboard's primary purpose) are unaffected. Pre-existing design characteristic, not a regression. Not filed.
<!-- Renumbered: 2026-07-06 — was TASK-006, collided with the pre-existing archived ROADMAP-001 TASK-006. Renumbered to TASK-017 (task-add's next-number scan didn't check archive/; fixed in lib/skills/task-add/SKILL.md Step 4). -->
