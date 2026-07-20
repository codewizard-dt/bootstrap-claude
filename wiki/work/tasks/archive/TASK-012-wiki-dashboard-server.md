---
id: TASK-012
title: "Build wiki-dashboard-server.js zero-dependency static file server"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: []
parallel_safe_with: [TASK-013]
uat: "[[UAT-012]]"
tags: [wiki-tooling, dashboard]
---

# TASK-012 — Build wiki-dashboard-server.js zero-dependency static file server

## Objective

Create `lib/scripts/wiki-dashboard-server.js`, a zero-dependency Node.js static file server (Node builtins only — `http`, `fs`, `path`; no npm packages) that serves the wiki dashboard client and the raw `wiki/` directory tree so the client can `fetch()` family `index.md`/`archive/index.md` files with no caching. This is Phase 1 of ROADMAP-002 (live HTML dashboard for `wiki/work/` families).

## Approach

- CommonJS (matches `package.json` `"type": "commonjs"` and all other `lib/scripts/*` conventions).
- Every response must include `Cache-Control: no-store` (plus `Pragma: no-cache`, `Expires: 0` for older-client safety) so the dashboard client's polling always gets fresh content — this is the core requirement driving the "always-current" goal in the roadmap.
- Serve two roots:
  1. The dashboard client itself, `lib/scripts/templates/wiki/dashboard.html` (built in TASK-013), served at `/`.
  2. The project's `wiki/` directory (cwd-relative, i.e. wherever the script is invoked from — this script runs inside a target project, not inside this template repo), served at `/wiki/*`, so the client can `fetch('/wiki/work/tasks/index.md', {cache: 'no-store'})` etc.
- Port fallback: default port `4317` (arbitrary high, unlikely-collision port); if `EADDRINUSE`, retry on `port + 1`, up to 10 attempts, then exit with a clear error.
- No routing framework, no template engine — plain `http.createServer`, manual path resolution with `path.join` + a check that the resolved path stays within the allowed root (prevent path traversal via `..`).
- Print the bound URL to stdout on successful bind (e.g. `Dashboard running at http://localhost:4321`).
- Exported as a runnable script with `#!/usr/bin/env node` shebang and executable permission (`chmod +x`), matching how `bin/cli.js` invokes other `lib/scripts/*` files via `execFileSync(scriptPath, args)` — see TASK-014 for the `bin/cli.js` wiring that will call this.

## Steps

### 1. Implement the server <!-- agent: general-purpose -->

- [x] Create `lib/scripts/wiki-dashboard-server.js` with `#!/usr/bin/env node` shebang
  - [x] Use only Node builtins: `require('http')`, `require('fs')`, `require('path')`
  - [x] Accept an optional CLI arg for the project directory to serve `wiki/` from (default `process.cwd()`), and an optional port arg (default `4317`)
  - [x] Implement a `createServer` request handler:
    - Serve `lib/scripts/templates/wiki/dashboard.html` at `GET /` and `GET /dashboard.html`
    - Serve files under `<projectDir>/wiki/` at `GET /wiki/*`, resolving the path with `path.join` and rejecting any resolved path that escapes the `wiki/` root (return 403)
    - Set `Cache-Control: no-store`, `Pragma: no-cache`, `Expires: 0` on every response
    - Return 404 for missing files, 405 for non-GET methods
    - Guess `Content-Type` from extension for at least `.html` (`text/html`), `.md` (`text/markdown`), `.json` (`application/json`), default `text/plain`
  - [x] Implement port fallback: attempt `server.listen(port)`, on `error.code === 'EADDRINUSE'` retry `port + 1` (cap at 10 attempts), else throw
  - [x] On successful bind, `console.log` the bound URL
- [x] Make the file executable: `chmod +x lib/scripts/wiki-dashboard-server.js`
- [x] Add a one-line entry to `lib/scripts/README.md`'s "CLI-facing scripts" table noting this script is invoked by the (forthcoming) `dashboard` command from TASK-014 — keep it minimal since TASK-015 owns full docs

<!-- Updated: 2026-07-06 -->
<!-- Renumbered: 2026-07-06 — was TASK-001, collided with the pre-existing archived ROADMAP-001 TASK-001. Renumbered to TASK-012 (task-add's next-number scan didn't check archive/; fixed in lib/skills/task-add/SKILL.md Step 4). -->
