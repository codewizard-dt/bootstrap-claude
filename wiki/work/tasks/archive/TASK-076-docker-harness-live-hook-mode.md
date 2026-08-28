---
id: TASK-076
aliases: [TASK-076]
title: "Docker harness: add a run.sh live-hook mode to verify packageInstall.consent=true against a real Claude Code session"
status: done
created: 2026-08-27
updated: 2026-08-27
depends_on: [TASK-060, TASK-075]
blocks: []
parallel_safe_with: [TASK-031, TASK-039, TASK-067, TASK-074]
uat: "[[UAT-078]]"
tags: [docker, testing, package-install-consent, authentication]
---

# TASK-076 — Docker harness: add a run.sh live-hook mode to verify packageInstall.consent=true against a real Claude Code session

depends_on::[[TASK-060]]
depends_on::[[TASK-075]]

## Objective

TASK-075's `packageInstall.consent` preference (`lib/hooks/package-install-consent.js`) has never had its `allow`/`defer` `permissionDecision` values exercised against a *real, live* Claude Code hook-dispatch pipeline — no hook in this codebase has emitted either value before this task. UAT-077's `UAT-MANUAL-001` fails closed pending exactly that verification. This task adds an opt-in `run.sh live-hook` mode to the Docker fresh-machine harness (`test/docker/fresh-machine/`) that authenticates a throwaway container against the operator's existing Claude Code subscription (via `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`, per `wiki/knowledge/entities/tools/claude-code-authentication.md`) and runs a real `claude -p` session with `packageInstall.consent=true`, asserting that `npm install` proceeds with zero permission prompts. This closes the `allow`/`true` half of UAT-MANUAL-001 with real evidence.

**Explicitly out of scope**: the `ask`/`defer` case's "does a human see Claude Code's native interactive permission prompt" sub-claim stays human-only — a headless `claude -p` session cannot exercise or observe an interactive prompt, and this task must not attempt to fake that verification.

## Approach

- New mode is **opt-in and additive** — `shell|setup|update|stale|idempotency` behavior is unchanged; `live-hook` is a new case in `run.sh`'s existing dispatch.
- **Hard prerequisite, checked before touching Docker at all**: `CLAUDE_CODE_OAUTH_TOKEN` must be set in the host environment (from a one-time `claude setup-token` run — see `raw/research/docker-claude-auth-token/index.md`). Missing → clear error naming the exact command to run, exit 1, no `docker build`/`docker run`.
- The token is forwarded **value-less** (`-e CLAUDE_CODE_OAUTH_TOKEN`, not baked into any file), mirroring the existing `BRAVE_API_KEY` forwarding pattern in `lib/scripts/install-mcps.sh` — never written to disk inside the container, never logged.
- Inside the container, this mode (unlike every other mode) actually installs this repo's hooks for real via `install-global.sh --skip-mcps`, then seeds `packageInstall.consent=true` for the scratch project via `bootstrap-prefs.js`, then runs `claude -p "npm install left-pad"` **without** `--dangerously-skip-permissions` — the whole point is to exercise the real permission pipeline, not bypass it.
- `timeout 120` wraps the `claude -p` call: a timeout (exit 124) is itself informative evidence (Claude Code fell back to needing an interactive confirmation the headless session could never answer, meaning the hook's `allow` was NOT honored) — report it as a distinct failure mode, not a generic error.
- Success assertion: exit 0 **and** `test -d "$SCRATCH_DIR/node_modules/left-pad"` — both together, not exit code alone (a `claude -p` session can exit 0 without actually running the tool call).
- Static verification only happens against `run.sh`'s argument parsing and constructed `docker run` invocation (stubbed `docker`, per the existing pattern in `test/docker-fresh-machine.test.js`) — never invoke real Docker or spend real API usage from a `/tackle` step. The actual live probe is UAT's job (a human runs `run.sh live-hook` with their own token).

## Steps

### 1. Add the `live-hook` mode to `test/docker/fresh-machine/run.sh`  <!-- agent: general-purpose -->
<!-- Updated: 2026-08-27 -->


- [x] Update the mode-list comment on line 5 (`# Modes: shell (default, interactive) | setup | update (setup then update) | stale (seed an older release, then update) | idempotency (update twice, diff). --rebuild forces a fresh docker build.`) to append `| live-hook (verify packageInstall.consent=true against a real, authenticated claude -p session; requires CLAUDE_CODE_OAUTH_TOKEN)`.
- [x] Add `live-hook` to the `case "$arg" in shell|setup|update|stale|idempotency) MODE="$arg" ;;` line (line 22) so it's accepted as a positional mode argument, and to the `Usage:` error string on line 24.
- [x] Immediately after the `for arg in "$@"` loop (after line 28, before the image-build check on line 30), add a guard that only fires when `MODE` is `live-hook`: if `CLAUDE_CODE_OAUTH_TOKEN` is unset or empty, print to stderr an error naming the exact fix (`Run 'claude setup-token' on the host and export CLAUDE_CODE_OAUTH_TOKEN before using 'run.sh live-hook'.`) and `exit 1` — this must happen **before** the `docker image inspect`/`docker build` check, so a missing token never triggers a build.
- [x] Add a new `live-hook)` case to the `case "$MODE" in` block (alongside `shell`/`setup`/`update`/`stale`/`idempotency`), following the same `exec docker run --rm -v "$REPO_ROOT:$MOUNT_PATH:ro" "$IMAGE_NAME" bash -c "..."` shape as the other modes. The forwarded env var goes on the `docker run` line as `-e CLAUDE_CODE_OAUTH_TOKEN` (value-less — inherits from the host shell's exported variable, matching the `BRAVE_API_KEY` pattern in `lib/scripts/install-mcps.sh`).
  - Sub-detail: the in-container script must, in order: (1) `mkdir -p "$SCRATCH_DIR"`; (2) run `'$MOUNT_PATH/lib/scripts/install-global.sh' --skip-mcps` (installs `lib/hooks/package-install-consent.js` + `lib/hooks/lib/command-parse.js` + `bootstrap-prefs.js` into the container's own `$HOME/.claude/`, and wires the hook into the container's own `$HOME/.claude/settings.json` — this is what makes it a *real* hook-dispatch test, unlike every other mode); (3) `node "$HOME/.claude/bootstrap-prefs.js" --set packageInstall.consent --value true --project "$SCRATCH_DIR"`; (4) `cd "$SCRATCH_DIR" && timeout 120 claude -p "npm install left-pad" --output-format stream-json --verbose < /dev/null > /tmp/live-hook-output.json 2>&1; CLAUDE_EXIT=$?`; (5) branch on `$CLAUDE_EXIT`: `124` → print `"live-hook: FAIL — claude -p timed out after 120s (permission system may not have honored packageInstall.consent=true; likely fell back to an interactive prompt the headless session could never answer)"` and `exit 1`; non-zero-non-124 → print the captured output and `exit 1`; `0` → check `test -d "$SCRATCH_DIR/node_modules/left-pad"`, print `"live-hook: PASS — npm install proceeded via a real claude -p session with packageInstall.consent=true and zero permission prompts"` and exit 0 on success, or `"live-hook: FAIL — claude -p exited 0 but node_modules/left-pad was never created"` and exit 1 on failure.
  - Sub-detail: do **not** add `--dangerously-skip-permissions` anywhere in this mode's `claude -p` invocation — that would bypass the exact mechanism under test.

### 2. Add static unit tests to `test/docker-fresh-machine.test.js`  <!-- agent: general-purpose -->
<!-- Updated: 2026-08-27 -->


- [x] Use `mcp__serena__get_symbols_overview` on `test/docker-fresh-machine.test.js` first to confirm the existing `runHarness`/`writeDockerStub`/`scratchDir` helper signatures (used by the `setup`/`update`/`stale`/`idempotency` tests) before writing new tests, and reuse them rather than inventing new fixtures.
- [x] Add a test asserting `run.sh live-hook` with `CLAUDE_CODE_OAUTH_TOKEN` **unset** in the test's spawn environment exits 1, prints an error mentioning `claude setup-token`, and never invokes the stubbed `docker` binary at all (check the stub's call-marker log is empty/absent).
- [x] Add a test asserting `run.sh live-hook` with `CLAUDE_CODE_OAUTH_TOKEN` **set** in the spawn environment constructs a `docker run` invocation containing `-e CLAUDE_CODE_OAUTH_TOKEN` (value-less form, matching how the existing tests assert other flags), `-v "$REPO_ROOT:$MOUNT_PATH:ro"` (same bind-mount as every other mode, never mounting the token by file), and does **not** contain `--dangerously-skip-permissions` anywhere in the constructed command.
- [x] Add a test asserting the in-container script for `live-hook` includes the `install-global.sh --skip-mcps` call, the `bootstrap-prefs.js --set packageInstall.consent --value true` call, and the `timeout 120 claude -p` invocation, in that order (string-order assertion on the constructed `bash -c` argument, matching how existing tests assert ordering for `idempotency`'s three-call sequence).
- [x] Add a test asserting `run.sh`'s usage string (unrecognized-argument path) now lists `live-hook` alongside the other five modes. (Satisfied by fixing the pre-existing usage-string test's regex, which Step 1's `run.sh` edit had broken, rather than adding a duplicate test.)
- [x] Run `node --test test/docker-fresh-machine.test.js` and confirm all tests (existing + new) pass. (29/29 pass.)

### 3. Document the new mode in `test/docker/fresh-machine/README.md`  <!-- agent: general-purpose -->
<!-- Updated: 2026-08-27 -->


- [x] Use `mcp__serena__get_symbols_overview` on `test/docker/fresh-machine/README.md` first, then add a new section (alongside the existing per-mode documentation for `shell`/`setup`/`update`/`stale`/`idempotency`) for `live-hook` covering: (1) the `claude setup-token` prerequisite and the exact `export CLAUDE_CODE_OAUTH_TOKEN=...` step, with a link/reference to `wiki/knowledge/entities/tools/claude-code-authentication.md` for why this doesn't require copying `~/.claude/`; (2) an explicit warning that running this mode spends real usage against the operator's own Claude Code subscription (it is not free like the other modes, which never authenticate); (3) an explicit statement that this mode verifies only the `packageInstall.consent=true → allow` path, and that the `ask`/`defer` case's interactive-prompt behavior is **not** and cannot be tested this way — that sub-case remains human-only via `/uat-walk`.
- [x] Cross-check `lib/scripts/README.md`'s "Standalone infra scripts" table entry (left unchanged — it only links the directory generically, doesn't enumerate modes; confirmed by TASK-071/072's stale/idempotency modes never having been added there either) for `test/docker/fresh-machine/` (already asserted by an existing test per `get_symbols_overview` on `test/docker-fresh-machine.test.js`) — if it enumerates modes by name, add `live-hook` there too; if it only references the directory generically, leave it unchanged.
