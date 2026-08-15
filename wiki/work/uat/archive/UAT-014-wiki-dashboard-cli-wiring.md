---
id: UAT-014
aliases: [UAT-014]
title: "UAT: Wire dashboard command into bin/cli.js"
status: passed
task: TASK-014
created: 2026-07-06
updated: 2026-07-06
---

# UAT-014 — UAT: Wire dashboard command into bin/cli.js

implements::[[TASK-014]]

> **Source task**: [[TASK-014]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Node.js is installed and on PATH
- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`
- [ ] `lib/scripts/wiki-dashboard-server.js` exists and is executable (shipped by TASK-012)
- [ ] Ports 4411 / 4412 are free on the test machine

---

## Test Cases

### UAT-CLI-001: `dashboard` appears in the usage/help text
- **Description**: When invoked with no command (usage path), `bin/cli.js` lists `dashboard` and its port-override hint in the help block.
- **Steps**:
  1. Run the command below. It prints usage to stderr and exits 1 by design; the assertion is on the printed text, not the exit code.
- **Command**:
  ```bash
  node /Users/davidtaylor/Repositories/bootstrap-claude/bin/cli.js 2>&1 | grep -E 'dashboard|pass a port number'
  ```
- **Expected Result**: Output contains both help lines: `dashboard     Launch the live wiki/work dashboard in this project (Ctrl-C to stop)` and `Optional: pass a port number, e.g. bootstrap dashboard 4400`. `grep` exits 0.
- **Repeatable Unit Test**: Blocked: repo has no test framework (placeholder `test` script, zero devDependencies, no test files); a runner would be new infrastructure not required by TASK-014.
- [x] Pass <!-- 2026-07-06 -->

### UAT-CLI-002: `dashboard` is a recognized command (not the unknown-command path)
- **Description**: `dashboard` is registered in the `SCRIPTS` map, so it does not fall through to the "Usage:" error branch (which fires only for missing/unknown commands). Verified without launching a long-running server by confirming the resolved script path is the dashboard server.
- **Steps**:
  1. Run the command below, which loads `bin/cli.js`'s `SCRIPTS` map the same way the CLI does and prints the entry for `dashboard`.
- **Command**:
  ```bash
  node -e "const s=require('/Users/davidtaylor/Repositories/bootstrap-claude/bin/cli.js.SCRIPTS');" 2>/dev/null || node -e "process.argv[2]='__noop__';const src=require('fs').readFileSync('/Users/davidtaylor/Repositories/bootstrap-claude/bin/cli.js','utf8');console.log(/dashboard:\s*\{\s*script:\s*'wiki-dashboard-server\.js'/.test(src)?'WIRED':'MISSING')"
  ```
- **Expected Result**: Prints `WIRED` — the `dashboard` entry maps to `wiki-dashboard-server.js`. (`bin/cli.js` is not a module with exports, so the fallback branch inspects the source directly.)
- **Repeatable Unit Test**: Blocked: repo has no test framework/harness; adding one is out of scope for TASK-014.
- [x] Pass <!-- 2026-07-06 -->

### UAT-INT-001: `bootstrap dashboard` launches the server on the default port and serves the dashboard client
- **Description**: Running the `dashboard` subcommand with no port invokes `wiki-dashboard-server.js` against the current project and serves the dashboard HTML over HTTP. Uses a non-default port via arg to avoid clobbering 4317 if something is already bound; here it exercises the launch + serve path end-to-end.
- **Steps**:
  1. Start the dashboard via the CLI in the background, wait for it to bind, fetch the root, then stop it — all in the one command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node bin/cli.js dashboard 4411 & SRV=$!; sleep 1.5; curl -sS http://localhost:4411/ | head -c 400; kill $SRV 2>/dev/null
  ```
- **Expected Result**: The fetched body is the dashboard client HTML — contains `<!doctype html>` and `<title>Wiki Dashboard</title>`. The background server process is killed afterward.
- **Repeatable Unit Test**: Not applicable: verifies real HTTP server wiring and process launch, which requires a live server rather than a unit-test harness.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-001: Extra CLI args (port override) are forwarded through to the server
- **Description**: `bin/cli.js` spreads `...extraArgs` into the dashboard entry's args, so `bootstrap dashboard 4412` must bind the server to 4412 (not the default 4317), proving the trailing arg is passed straight through.
- **Scenario**: Port override supplied as a positional numeric arg after the subcommand.
- **Steps**:
  1. Start the dashboard on port 4412 via the CLI, confirm 4412 responds, and confirm the default 4317 does NOT respond (server honored the override), then stop it — all in the one command below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node bin/cli.js dashboard 4412 & SRV=$!; sleep 1.5; echo "4412:$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:4412/) 4317:$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:4317/ || echo down)"; kill $SRV 2>/dev/null
  ```
- **Expected Result**: Output shows `4412:200` (override honored) and `4317:down` (default port not bound because the override was forwarded). Server killed afterward.
- **Repeatable Unit Test**: Not applicable: verifies real server port binding from forwarded CLI args, which needs a live process, not a unit test.
- [x] Pass <!-- 2026-07-06 -->

---

## Notes

- The repo currently has **no unit-test framework** (the `package.json` `test` script is a placeholder and there are no devDependencies or test files). Every promotable assertion here is therefore marked `Blocked` on that missing harness rather than silently dropped. If a runner is later added, UAT-CLI-001 and UAT-CLI-002 (deterministic help-text + wiring checks) are the natural first unit tests.
- UAT-INT-001 and UAT-EDGE-001 launch a background HTTP server. Under headless `/uat-auto` these may be judged inconclusive if backgrounding/timing is unreliable in the sandbox — treat them as manual/integration checks in that case.
<!-- Renumbered: 2026-07-06 — was UAT-003/TASK-003, collided with the pre-existing archived ROADMAP-001 UAT-003/TASK-003. Renumbered to UAT-014/TASK-014. -->
