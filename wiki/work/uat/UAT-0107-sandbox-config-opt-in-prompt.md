---
id: UAT-0107
aliases: [UAT-0107]
title: "UAT: Add an opt-in sandbox-config prompt to install-global.sh / setup-project.sh"
status: pending
task: TASK-0107
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0107 — UAT: Add an opt-in sandbox-config prompt to install-global.sh / setup-project.sh

implements::[[TASK-0107]]

> **Source task**: [[TASK-0107]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Repo checked out at the TASK-0107 implementation (`lib/scripts/templates/settings-sandbox.json` and `configure_sandbox()` in `lib/scripts/install-global.sh` present)
- [ ] Node.js available (`node --test` runner; no other dependencies)
- [ ] Every command is file-scoped on purpose: the whole `npm test` suite is not a valid oracle here (known pre-existing failures plus in-flight sibling-task edits)
- [ ] **Never run `install-global.sh` against the real `~/.claude`.** The automated cases use a scratch `HOME` internally; the manual cases below must set `HOME` to a scratch directory explicitly

---

## Test Cases

### UAT-EDGE-001: Non-interactive run asks nothing and writes nothing
- **Scenario**: With no tty (CI, piped stdin), step 7b prints "Non-interactive terminal: skipping the sandbox question.", never prints the question, writes no `sandbox` key to `settings.json`, and creates no prefs file (a CI run must never bake an answer into the store).
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes (exit code 0).
- **Repeatable Unit Test**: Created: `test/install-sandbox-prompt.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='non-interactive run asks nothing' test/install-sandbox-prompt.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Answering `no` is remembered and writes no sandbox key
- **Scenario**: On a tty, answering `n` prints `sandbox.scaffold = false`, stores `sandbox.scaffold=false` in the global prefs store, and leaves `settings.json` without a `sandbox` key.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/install-sandbox-prompt.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='answering no stores' test/install-sandbox-prompt.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Answering `skip` records nothing and the question recurs
- **Scenario**: Answering `s` records no `sandbox.scaffold` value, writes no `sandbox` key, prints "sandbox.scaffold left unanswered", and the question is asked again on the next run.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes; run 2 in the test asks the question again.
- **Repeatable Unit Test**: Created: `test/install-sandbox-prompt.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='answering skip stores' test/install-sandbox-prompt.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Answering `yes` merges the template and stores `true`
- **Scenario**: Answering `y` merges `templates/settings-sandbox.json` into `$HOME/.claude/settings.json` under `sandbox` (deep-equal to the template), stores `sandbox.scaffold=true`, prints the `"sandbox" set` outcome and the restart-your-session reminder, and the final summary line names `+ sandbox`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/install-sandbox-prompt.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='answering yes merges' test/install-sandbox-prompt.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: A pre-existing different `sandbox` value is never overwritten
- **Scenario**: When `settings.json` already defines a different `sandbox` block, answering `y` preserves the user's block byte-for-byte in value, prints the "already defines "sandbox"" warning, still records `true`, and does not print the restart reminder (nothing changed).
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/install-sandbox-prompt.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='pre-existing different sandbox' test/install-sandbox-prompt.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: An already-stored answer is never re-asked
- **Scenario**: With `sandbox.scaffold=false` already stored, a run whose stdin is poisoned with `y` lines never prints the question, prints "Already answered", leaves the stored value unchanged, and writes no `sandbox` key.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/install-sandbox-prompt.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='already-stored answer is never' test/install-sandbox-prompt.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: A re-run still re-asks only genuinely unanswered keys (step 7 not disturbed by 7b)
- **Scenario**: Adding step 7b must not regress the step-7 stickiness contract: stored `false`/`ask` answers are never re-asked, a skipped key recurs. The existing end-to-end stickiness test pre-settles `sandbox.scaffold` and asserts the seven skill keys behave as before.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (existing e2e test, updated by TASK-0107 to pre-settle `sandbox.scaffold`)
- **Unit Test Command**: `node --test --test-name-pattern='re-run re-asks ONLY' test/prompt-stickiness.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Native Windows shell is skipped with a note and records nothing
- **Scenario**: When `uname -s` reports MINGW/MSYS/CYGWIN, answering `y` prints "not supported on native Windows (use WSL2)", writes no `sandbox` key, records no `sandbox.scaffold`, and the summary does not claim `+ sandbox`. The platform is faked with a `uname` shim on a scratch `PATH`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/install-sandbox-platform-guard.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='native Windows shell' test/install-sandbox-platform-guard.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: Linux without bubblewrap/socat warns but does not fail
- **Scenario**: When `uname -s` reports Linux and `bwrap`/`socat` are not both installed, answering `y` prints "needs bubblewrap and socat" on stderr yet still merges the block and records `true`.
- **Steps**: Run the unit test command below. The test never skips (the suite forbids skipped tests): it branches on whether the machine really has `bwrap` and `socat`, and asserts the matching side of the guard either way.
- **Expected Result**: The named test passes (`pass 1`, `skipped 0`).
- **Repeatable Unit Test**: Created: `test/install-sandbox-platform-guard.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='Linux: warns' test/install-sandbox-platform-guard.test.js`
- [ ] Pass

### UAT-EDGE-010: Template is minimal — enabled plus docker exclusions, no policy blocks
- **Scenario**: `templates/settings-sandbox.json` parses as JSON, has `enabled: true`, an `excludedCommands` array containing `docker *` and `docker-compose *`, and no `filesystem`/`network`/`credentials` policy (that scope belongs to TASK-031).
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/install-sandbox-prompt.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='settings-sandbox.json is minimal' test/install-sandbox-prompt.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-011: Step 7b never writes boundary-reopening or managed-only keys
- **Scenario**: Neither `configure_sandbox()` nor the template references `allowUnsandboxedCommands`, `allowAppleEvents`, `allowUnixSockets`, `disableBypassPermissionsMode`, `allowManagedPermissionRulesOnly`, or `allowManagedHooksOnly`, and the template carries no `filesystem` policy (scope decision recorded in the task Approach).
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/sandbox-scaffold-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='never writes the boundary' test/sandbox-scaffold-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-012: Step 7b is placed between step 7 and step 8 and is guarded as a whole
- **Scenario**: In `install-global.sh` the `configure_sandbox` call sits after the step-7 skill-preference batch and before the MCP install branch, and is wrapped in `if ! configure_sandbox; then echo "Warning: sandbox setup failed ..."` so a failure warns and the local installs continue.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/sandbox-scaffold-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='step 7b sits' test/sandbox-scaffold-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-013: The prompt text states the docker incompatibility and the excludedCommands escape hatch
- **Scenario**: The caveats printed before the question mention docker commands and name `sandbox.excludedCommands` as the escape hatch (task Objective: "the prompt and the docs must state the two caveats plainly").
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/sandbox-scaffold-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='docker incompatibility' test/sandbox-scaffold-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-014: `sandbox.scaffold` schema entry — asked by install-global.sh, no non-null default
- **Scenario**: `bootstrap-prefs-schema.json` defines `sandbox.scaffold` with `askedBy: install-global.sh` and a null/absent default, so it is asked until answered.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/install-sandbox-prompt.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='schema: sandbox.scaffold' test/install-sandbox-prompt.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-015: README registry lists `sandbox.scaffold` and matches the schema field-for-field
- **Scenario**: `lib/scripts/README.md` preference registry covers every schema key exactly once (including `sandbox.scaffold`) and each row's scope/consumer/values/default/askedBy/summary match the schema entry.
- **Steps**: Run both unit test commands below.
- **Expected Result**: Both named tests pass.
- **Repeatable Unit Test**: Created: `test/scripts-readme-prefs-docs.test.js` (existing registry tests; TASK-0107 added the `sandbox.scaffold` row they now enforce)
- **Unit Test Command**: `node --test --test-name-pattern='registry: (the two tables together cover every schema key exactly once|every row matches its schema entry)' test/scripts-readme-prefs-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-016: `lib/scripts/README.md` documents step 7b, the platform guard, and the docker caveat
- **Scenario**: README has a "Sandbox scaffold notes" section naming step 7b, the key, the template file, the MINGW/MSYS/CYGWIN guard, the bubblewrap + socat requirement, "Sandboxing is incompatible with `docker` commands", and `excludedCommands` as the escape hatch; and the residual-risk paragraph now points at the opt-in scaffold instead of describing containment as absent.
- **Steps**: Run both unit test commands below.
- **Expected Result**: Both named tests pass.
- **Repeatable Unit Test**: Created: `test/sandbox-scaffold-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='(documents step 7b|no longer describes)' test/sandbox-scaffold-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-017: `lib/hooks/README.md` and `CLAUDE.md` point at the opt-in step without overclaiming
- **Scenario**: `lib/hooks/README.md` says `bootstrap install` can now scaffold a minimal starter `sandbox` block on opt-in and that it "by itself does not close the script-file gap"; `CLAUDE.md`'s `install` Setup Workflow bullet and `install-global.sh` Key Files entry both mention the sandbox step.
- **Steps**: Run the unit test command below.
- **Expected Result**: Both named tests pass.
- **Repeatable Unit Test**: Created: `test/sandbox-scaffold-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='(hooks/README|CLAUDE.md mentions)' test/sandbox-scaffold-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-018: The starter template ships in the npm tarball
- **Scenario**: `package.json` `files` includes `lib/` and no negation pattern excludes `lib/scripts/templates/settings-sandbox.json`, so `npx @codewizard-dt/bootstrap install` can read it.
- **Steps**: Run the unit test command below.
- **Expected Result**: The named test passes.
- **Repeatable Unit Test**: Created: `test/sandbox-scaffold-docs.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='ships in the npm' test/sandbox-scaffold-docs.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-019: `install-global.sh` passes a shell syntax check
- **Scenario**: The step-7b insertion leaves `install-global.sh` syntactically valid (`bash -n` parses without executing anything).
- **Steps**: Run the command below as-is; it does not execute the script and touches no `HOME`.
- **Command**:
  ```bash
  bash -n lib/scripts/install-global.sh
  ```
- **Expected Result**: Exit code 0 and no output.
- **Repeatable Unit Test**: Not applicable: the command itself is the deterministic static check
- [x] Pass <!-- 2026-09-19 -->

### UAT-MANUAL-001: Real interactive TTY run of the y/n/skip prompt (scratch HOME)
- **Scenario**: The prompt reads sensibly on a real terminal: caveats are legible and accurate, the `[y]es / [n]o / [s]kip for now:` line accepts a letter, and the confirmation/restart lines print. This is inherently manual — the automated cases feed piped stdin through the `BOOTSTRAP_ASSUME_TTY` seam, not a real TTY.
- **Steps**:
  1. In a real terminal, run `export HOME="$(mktemp -d)"` in a **fresh shell** (so the real `~/.claude` is untouched), then `mkdir -p "$HOME/.claude"`.
  2. From the repo root run `bash lib/scripts/install-global.sh --skip-mcps`.
  3. Answer the seven step-7 skill-preference questions with `s` (skip) each.
  4. At "Enable Claude Code's sandbox in ~/.claude/settings.json?" read the caveats: confirm they state that `docker` commands are incompatible with the sandbox and pre-listed under `sandbox.excludedCommands`, that further tools can be added to `excludedCommands`, and that a pre-existing `sandbox` key is never overwritten.
  5. Answer `y`. Confirm `sandbox.scaffold = true` and `Restart Claude Code sessions to pick up the sandbox.` print, and the last line reads "Global setup complete (... + sandbox)."
  6. Run `node -e "console.log(JSON.stringify(require(process.env.HOME + '/.claude/settings.json').sandbox))"` and confirm `{"enabled":true,"excludedCommands":["docker *","docker-compose *"]}`.
  7. Re-run step 2 and confirm the sandbox question is not asked again ("Already answered").
  8. Close the shell (or `unset HOME` by exiting it) so the scratch `HOME` does not leak into later commands.
- **Expected Result**: Every observation above holds; no file under the real `~/.claude` changed.
- **Repeatable Unit Test**: Not applicable: real TTY interaction and prose legibility cannot be reproduced by a piped-stdin test
- [FAIL: auto-judge: manual test requires human verification — real-TTY prompt run; use /uat-walk] <!-- 2026-09-19 -->

### UAT-MANUAL-002: A sandbox-enabled Claude Code session actually starts with the scaffolded block (optional, macOS/Linux)
- **Scenario**: Runtime behavior explicitly deferred to UAT by the task Notes: the scaffolded block is accepted by a real Claude Code and a docker command is not blocked by the sandbox. Deeper breakage measurement and scope choice belong to TASK-031, not here.
- **Steps**:
  1. Using the scratch `settings.json` produced in UAT-MANUAL-001 (or any file containing only the template's `sandbox` block), start Claude Code with it layered on via `claude --settings <that file>` — do **not** edit the real `~/.claude/settings.json`.
  2. Run `/sandbox` and confirm the sandbox is reported enabled and the settings load without a validation error.
  3. If Docker is installed, ask Claude to run `docker ps` and confirm it is not denied by the sandbox (it is excluded via `docker *`).
- **Expected Result**: The session starts, `/sandbox` shows the sandbox enabled, and `docker ps` runs outside the sandbox. Skip with a note if the platform lacks a sandbox backend (native Windows) or Docker is not installed.
- **Repeatable Unit Test**: Not applicable: requires a live Claude Code session and OS sandbox backend
- [FAIL: auto-judge: manual test requires human verification — live sandbox session; use /uat-walk] <!-- 2026-09-19 -->
