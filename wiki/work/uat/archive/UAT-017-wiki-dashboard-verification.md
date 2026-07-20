---
id: UAT-017
title: "UAT: Manually verify dashboard liveness and edge cases"
status: passed
task: TASK-017
created: 2026-07-06
updated: 2026-07-06
---

# UAT-017 — UAT: Manually verify dashboard liveness and edge cases

implements::[[TASK-017]]

> **Source task**: [[TASK-017]]
> **Generated**: 2026-07-06

This UAT verifies the `wiki-dashboard-server.js` static server (TASK-012) and `dashboard.html` client (TASK-013) end-to-end against this repo's real `wiki/` tree. All tests are CLI-drivable via `curl` and backgrounded `node` processes — no browser required, consistent with the source task's manual/CLI verification approach. Serena is disconnected this session; server launched via plain `node`.

---

## Prerequisites

- [ ] Run from repo root `/Users/davidtaylor/Repositories/bootstrap-claude`
- [ ] `node` available on PATH
- [ ] No process already bound to ports 4420/4421 (tests start and stop their own servers; clean up with `pkill -f wiki-dashboard-server.js` afterward)
- [ ] `wiki/work/*/index.md` files present (roadmaps has 2 active items, tasks has 1, others `_(none yet)_`)

---

## Test Cases

### UAT-API-001: Server binds and serves the dashboard client
- **Endpoint**: `GET /`
- **Description**: The server starts, binds the requested port, prints its URL, and serves `dashboard.html` (the `templates/wiki/dashboard.html` bundled next to the script) at `/` with a 200 and `text/html`.
- **Steps**:
  1. Start the server in the background: `node lib/scripts/wiki-dashboard-server.js . 4420 &` — confirm it logs `Wiki dashboard server running at http://localhost:4420`.
  2. Run the curl command below.
- **Command**:
  ```bash
  curl -sS -X GET 'http://localhost:4420/'
  ```
- **Expected Result**: HTTP 200, body is the dashboard HTML — contains `<title>Wiki Dashboard</title>` and six `data-family="…"` panels (requirements, decisions, roadmaps, tasks, uat, bugs).
- **Repeatable Unit Test**: Not applicable: verifies live HTTP server wiring and socket bind, not unit-promotable.
- [x] Pass <!-- 2026-07-06 -->

### UAT-API-002: Active family data is served and matches index.md ground truth
- **Endpoint**: `GET /wiki/work/roadmaps/index.md`
- **Description**: The server serves the real wiki `index.md` files read-only; the roadmaps family currently has 2 active bullet items, confirming the dashboard shows this repo's live data.
- **Steps**:
  1. With the server from UAT-API-001 running, run the curl command below.
  2. Compare against `wiki/work/roadmaps/index.md` (2 `- [ROADMAP-…]` bullets: ROADMAP-001, ROADMAP-002).
- **Command**:
  ```bash
  curl -sS -X GET 'http://localhost:4420/wiki/work/roadmaps/index.md'
  ```
- **Expected Result**: HTTP 200, `text/markdown` body containing exactly two `- [ROADMAP-…]` bullet lines (ROADMAP-001 and ROADMAP-002), matching the on-disk index. (tasks/index.md similarly returns 1 TASK-017 bullet; requirements/decisions/uat/bugs return the `_(none yet)_` placeholder.)
- **Repeatable Unit Test**: Not applicable: verifies file-serving over HTTP against live repo state, not unit-promotable.
- [x] Pass <!-- 2026-07-06 -->

### UAT-API-003: Responses carry no-cache headers
- **Endpoint**: `GET /wiki/work/tasks/index.md`
- **Description**: Every response sets `Cache-Control: no-store` (plus `Pragma: no-cache`, `Expires: 0`) so the client's 5s poll always sees fresh data.
- **Steps**:
  1. With the server running, run the curl command below (`-D -` dumps response headers; `-X GET` so headers come from a real 200, not a HEAD 405).
- **Command**:
  ```bash
  curl -sS -X GET -D - -o /dev/null 'http://localhost:4420/wiki/work/tasks/index.md'
  ```
- **Expected Result**: HTTP 200 with headers `Cache-Control: no-store`, `Pragma: no-cache`, `Expires: 0`, and `Content-Type: text/markdown`.
- **Repeatable Unit Test**: Not applicable: asserts on live HTTP response headers from the running server.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-001: Live edit is reflected on the next request without restart
- **Scenario**: Editing a family `index.md` is picked up by the dashboard within one poll interval because the server reads the file per-request (no caching, no restart).
- **Steps**:
  1. With the server running, note current tasks count: `curl -sS 'http://localhost:4420/wiki/work/tasks/index.md' | grep -c '^- \[TASK'` → 1.
  2. Append a temporary bullet line to `wiki/work/tasks/index.md` (e.g. a `TASK-999 — LIVE UPDATE TEST` line) using an editor.
  3. Re-request the same URL and confirm the new line appears (count → 2) with no server restart.
  4. Revert the edit (remove the temporary line, restoring exact prior content) and confirm the re-request returns to the original (count → 1). **Do not use `git checkout` to revert — remove the line by editing.**
- **Expected Result**: The added line appears in the served content immediately on the next request and disappears again after the revert; the file returns to its exact prior state (git diff unchanged from before the test).
- **Repeatable Unit Test**: Not applicable: verifies per-request filesystem read behavior of the live server end-to-end.
- [x] Pass <!-- 2026-07-06 · human verdict: manually verified this session — edited wiki/work/tasks/index.md adding a TASK-999 line, confirmed the next GET reflected it with no server restart (count 1→2), then removed the line and confirmed the next GET returned to the original (count 2→1); file restored to exact prior state. Recorded in TASK-017 Verification Results. -->

### UAT-EDGE-002: Empty-state families and missing files degrade cleanly
- **Scenario**: A family whose index body is the `_(none yet)_` placeholder yields zero parsed items (panel shows "No active items."), and a request for a non-existent wiki path returns 404 rather than erroring.
- **Steps**:
  1. With the server running, request `requirements/index.md` (placeholder body) and confirm it serves 200 with zero `- [` bullet lines.
  2. Request a non-existent family path and confirm 404.
- **Command**:
  ```bash
  curl -sS -X GET -o /dev/null -w '%{http_code}' 'http://localhost:4420/wiki/work/nonexistent/index.md'
  ```
- **Expected Result**: The command prints `404`. Separately, `GET /wiki/work/requirements/index.md` returns 200 with the `_(none yet)_` placeholder and no bullet items (client renders the calm "No active items." empty state, no console errors).
- **Repeatable Unit Test**: Blocked: the parser's empty-input handling (`parseIndexMarkdown` returning `[]`) is deterministic and unit-promotable, but the repo has no JS unit-test harness (`npm test` is a stub, no framework/test dir); adding one is out of scope for this verification task.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-003: Port fallback on EADDRINUSE
- **Scenario**: Starting a second instance while the first holds the port binds `port + 1` instead of crashing (up to `MAX_PORT_ATTEMPTS`).
- **Steps**:
  1. With the first server on 4420 still running, start a second: `node lib/scripts/wiki-dashboard-server.js . 4420 &`.
  2. Confirm the second logs `running at http://localhost:4421`.
  3. Confirm 4421 serves: run the curl command below.
- **Command**:
  ```bash
  curl -sS -X GET -o /dev/null -w '%{http_code}' 'http://localhost:4421/'
  ```
- **Expected Result**: Second instance logs port 4421 (not a crash / unhandled `EADDRINUSE`), and the command prints `200`.
- **Repeatable Unit Test**: Not applicable: verifies real socket `EADDRINUSE` handling across two live processes.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-004: Path-traversal attempts are rejected
- **Scenario**: Requests that try to escape `WIKI_ROOT` via `../` (raw or percent-encoded) are rejected with 403/404 and never serve out-of-tree files like `/etc/passwd`.
- **Steps**:
  1. With a server running on 4420, run the curl command below (`--path-as-is` prevents curl from normalizing the `../` client-side, so the raw traversal reaches the server).
  2. Also spot-check the percent-encoded variant `/wiki/%2e%2e/%2e%2e/%2e%2e/etc/passwd` (expect 403) and a sibling-prefix escape `/wiki/../wiki-fake` (expect 403).
- **Command**:
  ```bash
  curl -sS --path-as-is -X GET -o /dev/null -w '%{http_code}' 'http://localhost:4420/wiki/../../../../etc/passwd'
  ```
- **Expected Result**: The command prints `403` (or `404`); the response body never contains `/etc/passwd` contents (no `root:` line). Encoded and sibling-prefix variants also return 403. Clean up servers afterward: `pkill -f wiki-dashboard-server.js`.
- **Repeatable Unit Test**: Blocked: the `resolved.startsWith(WIKI_ROOT + path.sep)` containment check is deterministic and unit-promotable, but the repo has no JS unit-test harness; adding one is out of scope for this verification task.
- [x] Pass <!-- 2026-07-06 -->

---

## Notes / Observations (non-blocking)

- **HEAD returns 405.** The server is GET-only, so a bare `curl -I` (HEAD) reports `405 Method Not Allowed`. The no-cache headers are still emitted on that response and browsers use GET, so this is cosmetic — tests above use `-X GET -D -` to read headers from a real 200. Not filed as a bug.
- **Archive panels parse 0 items.** `archive/index.md` files use a Markdown table (with `[[ID]]` wiki-links), not the `- [Title](path)` bullet form the client parser targets, so archive counts render 0. Active panels — the dashboard's primary purpose — are unaffected. Pre-existing design characteristic, not a regression. Not filed.
<!-- Renumbered: 2026-07-06 — was UAT-006/TASK-006, collided with the pre-existing archived ROADMAP-001 UAT-006/TASK-006. Renumbered to UAT-017/TASK-017. -->
