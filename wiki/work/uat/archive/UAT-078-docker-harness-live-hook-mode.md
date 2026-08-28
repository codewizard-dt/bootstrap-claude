---
id: UAT-078
aliases: [UAT-078]
title: "UAT: Docker harness live-hook mode (packageInstall.consent=true verification)"
status: passed
task: TASK-076
created: 2026-08-27
updated: 2026-08-27
---

# UAT-078 — UAT: Docker harness live-hook mode (packageInstall.consent=true verification)

implements::[[TASK-076]]

> **Source task**: [[TASK-076]]
> **Generated**: 2026-08-27
> **Deviation**: mirrors TASK-076's number where possible, but `UAT-076` and `UAT-077` are both already taken (`UAT-076` archived for TASK-070; `UAT-077` active for TASK-075) — using the next free ID, `UAT-078`, per the same non-collision precedent set for UAT-077.

---

## Prerequisites

- [ ] Repo root, clean working tree, on the branch containing TASK-076's changes.
- [ ] `docker` available for the Manual case only (not required for the EDGE cases, which stub `docker`).

---

## Test Cases

### UAT-EDGE-001: Missing `CLAUDE_CODE_OAUTH_TOKEN` blocks before touching Docker
- **Scenario**: `run.sh live-hook` invoked with `CLAUDE_CODE_OAUTH_TOKEN` absent from the environment.
- **Steps**: Run `run.sh live-hook` with `CLAUDE_CODE_OAUTH_TOKEN` explicitly unset (not just unexported).
- **Expected Result**: Exit code 1; stderr mentions `claude setup-token`; the stubbed `docker` binary is never invoked (empty call log) — the guard runs before the `docker image inspect`/build check.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="live-hook: exits 1" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-27 -->


### UAT-EDGE-002: Token forwarded value-less; real permission system never bypassed
- **Scenario**: `run.sh live-hook` invoked with `CLAUDE_CODE_OAUTH_TOKEN` set.
- **Steps**: Run `run.sh live-hook` with `CLAUDE_CODE_OAUTH_TOKEN` set in the environment; inspect the constructed `docker run` invocation.
- **Expected Result**: The command contains `-e CLAUDE_CODE_OAUTH_TOKEN` (value-less form — never a literal token value on the command line) and `-v "$REPO_ROOT:$MOUNT_PATH:ro"` (same read-only bind mount as every other mode); it does **not** contain `--dangerously-skip-permissions` anywhere.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="live-hook: with CLAUDE_CODE_OAUTH_TOKEN set" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-003: In-container script runs hook install, consent seed, and the probe in order
- **Scenario**: The `bash -c` script embedded in `live-hook`'s `docker run` call.
- **Steps**: Inspect the constructed in-container command string.
- **Expected Result**: Contains, in this order: `install-global.sh --skip-mcps`, then `bootstrap-prefs.js --set packageInstall.consent --value true`, then `timeout 120 claude -p`.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js`
- **Unit Test Command**: `node --test --test-name-pattern="live-hook: in-container script runs" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-004: Usage string lists `live-hook` alongside the other five modes
- **Scenario**: An unrecognized positional argument to `run.sh`.
- **Steps**: Run `run.sh` with an invalid mode argument.
- **Expected Result**: Prints a `Usage:` line listing all six modes including `live-hook`; exits 1; never invokes `docker`.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (pre-existing test's regex extended, not a new test — see TASK-076 Step 2)
- **Unit Test Command**: `node --test --test-name-pattern="unrecognized positional argument" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-MANUAL-001: A real `claude -p` session honors `packageInstall.consent=true` end-to-end
- **Scenario**: This is the actual purpose of TASK-076 — proving Claude Code's *live* hook-dispatch/permission pipeline honors this hook's `allow` decision, not just that `run.sh` constructs the right command (that's UAT-EDGE-001–003). No hook in this codebase has had its `allow`/`defer` values exercised against a real session before this task — this closes that gap for `allow`/`true`, alongside `TASK-075`'s own `UAT-MANUAL-001` (`wiki/work/uat/UAT-077-package-install-consent-preference.md`), which this case is designed to supply evidence for.
- **Steps**:
  1. On the host, run `claude setup-token` and follow its OAuth prompt (requires a Pro/Max/Team/Enterprise subscription — see `wiki/knowledge/entities/tools/claude-code-authentication.md`).
  2. `export CLAUDE_CODE_OAUTH_TOKEN=<token printed by step 1>`.
  3. From the repo root, run `test/docker/fresh-machine/run.sh live-hook`.
  4. Observe the final line of output.
- **Expected Result**: Output ends with `live-hook: PASS — npm install proceeded via a real claude -p session with packageInstall.consent=true and zero permission prompts`, and exit code 0. A `live-hook: FAIL — ... timed out after 120s ...` result specifically indicates the hook's `allow` decision was **not** honored by Claude Code's real permission pipeline (a genuine regression finding, not a test-infra problem) and should be reported as such rather than retried blindly.
- **Repeatable Unit Test**: Not applicable: requires a real Docker daemon, a real Claude Code subscription and OAuth token, live network access to the Anthropic API, and spends real subscription usage — none of which can run inside the unit-test suite.
- [x] Pass <!-- 2026-08-27 -->

---

## Gaps

- **The `ask`/`defer` interactive-prompt sub-case is intentionally not covered here or anywhere else.** Per TASK-076's explicit scope, whether a human sees Claude Code's native interactive permission prompt cannot be tested by a headless `claude -p` session under any circumstance — this stays permanently human-only via a live, interactive `/uat-walk` session, not something a future UAT case should attempt to automate.
