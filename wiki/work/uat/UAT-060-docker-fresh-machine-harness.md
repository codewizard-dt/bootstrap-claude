---
id: UAT-060
aliases: [UAT-060]
title: "UAT: Docker fresh-machine test harness for setup/update"
status: pending
task: TASK-060
created: 2026-08-22
updated: 2026-08-22
---

# UAT-060 — UAT: Docker fresh-machine test harness for `setup`/`update`

implements::[[TASK-060]]

> **Source task**: [[TASK-060]]
> **Generated**: 2026-08-22

**Scope note.** TASK-060 is a Docker-infrastructure change: a new `test/docker/fresh-machine/Dockerfile`, `run.sh` build/run helper, `README.md`, and a pointer row in `lib/scripts/README.md`. There is no HTTP endpoint or browser UI here — every test case below is an **EDGE** case (Dockerfile/CLI shape assertions and installer/CLI behavior), following the same convention as UAT-054/UAT-059/UAT-061 for this repo's other install-*.sh-style infrastructure tasks.

Most of this harness's own logic (Dockerfile content, `run.sh`'s argument parsing and per-mode `docker` command construction) is deterministic and requires no live Docker daemon, so it is fully promoted to repeatable unit tests using a stub `docker` executable on `PATH` (see `test/docker-fresh-machine.test.js`) — a technique mirrored from `test/install-global.test.js`'s stubbed `install-mcps.sh`. The two cases that genuinely require a live multi-minute `docker build`/`docker run` (UAT-EDGE-010, UAT-EDGE-011) are marked **Manual** and instead independently re-verify the evidence already recorded in TASK-060's own "Resumed run (2026-08-22)" Notes section, including the documented known limitation that `update-project.sh`'s own distinct code path has never actually been exercised independently of `setup-project.sh` — this UAT pins that current behavior rather than treating it as a silent gap.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ and `bash` available on `PATH` (the promoted suite runs `node --test` and stubs `docker`, so UAT-EDGE-001 through 009 need **no** live Docker daemon)
- [ ] For UAT-EDGE-010/011 only: Docker Desktop (or equivalent) running and `docker` on `PATH`, network access, several minutes free (`docker build` pulls `ubuntu:24.04`, installs Node/uv/claude-code/Homebrew)
- [ ] `npm test` baseline green before starting (independent of Docker)

**Safety.** UAT-EDGE-001 through 009 run the real `Dockerfile`/`run.sh` text and a stubbed `docker` binary on a scratch `PATH` — no real image is built or container run, and the real Docker daemon (if any) is never touched. UAT-EDGE-010/011 build and run the real, ephemeral (`--rm`) harness image against a throwaway in-container scratch directory only; they never touch this repo's own files or the operator's real `~/.claude/`.

---

## Test Cases

### UAT-EDGE-001: The image never bakes in the bootstrap-claude repo — no `COPY` instruction anywhere in the Dockerfile
- **Scenario**: The task's load-bearing constraint is "the same image must stay valid and reusable across different bootstrap-claude branches/versions without rebuilding" — the repo is bind-mounted by `run.sh` at run time, never `COPY`'d at build time. A single stray `COPY lib/ ...` or `COPY package.json ...` would silently violate this.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `test/docker/fresh-machine/Dockerfile` directly and asserts zero lines match `^\s*COPY\b`.
- **Expected Result**: No `COPY` instruction present anywhere in the Dockerfile.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `Dockerfile: never COPYs the bootstrap-claude repo (or any of its lib/, wiki/, package.json) into the image`)
- **Unit Test Command**: `node --test --test-name-pattern="never COPYs the bootstrap-claude repo" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-002: Base image is pinned to `ubuntu:24.04` and every foundational OS package the task requires is installed
- **Scenario**: Task step 1 specifies `ubuntu:24.04` (not a `node:`-tagged base, to keep the image's purpose "a fresh Linux machine" honest) with `git`, `curl`, `ca-certificates`, `build-essential`, `gnupg`, plus the two fixes recorded in the task's Notes (`sudo` for the Homebrew installer, `rsync` for `install-global.sh`'s hooks step).
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts `FROM ubuntu:24.04`, `ARG NODE_VERSION=24`, and that the `apt-get install` package list contains all seven packages.
- **Expected Result**: Base image and `NODE_VERSION` pinned exactly as documented; all seven packages present.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `Dockerfile: base image is ubuntu:24.04 and ARG NODE_VERSION defaults to 24`, `Dockerfile: installs every foundational OS package the task requires (git, curl, ca-certificates, build-essential, gnupg, sudo, rsync)`)
- **Unit Test Command**: `node --test --test-name-pattern="ubuntu:24.04|foundational OS package" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-003: Node, the `claude` CLI, `uv`, and Homebrew are all installed for a non-root user, with the documented `WORKDIR`/`CMD`
- **Scenario**: Task step 1 requires Node via NodeSource, `npm install -g @anthropic-ai/claude-code`, `uv`'s official installer, Homebrew (which refuses to run as root, hence the non-root `tester` user), a neutral `/workspace` `WORKDIR`, and `CMD bash` so `run.sh` decides what actually executes.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts the NodeSource setup-script URL, the `claude-code` npm install line, the `uv` installer URL, the Homebrew installer URL, a `useradd ... tester` line, `USER tester`, `WORKDIR /workspace`, and `CMD ["bash"]` are all present.
- **Expected Result**: All five install steps and both directives present exactly as documented.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `Dockerfile: installs Node via NodeSource, claude CLI via npm, uv via its official installer, and Homebrew for a non-root user`, `Dockerfile: sets WORKDIR /workspace and leaves CMD as an interactive shell`)
- **Unit Test Command**: `node --test --test-name-pattern="installs Node via NodeSource|sets WORKDIR" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-004: `run.sh` rejects an unrecognized mode argument with a usage message and exit 1, without ever invoking `docker`
- **Scenario**: Task step 2 requires three explicit modes (`shell`/`setup`/`update`) plus `--rebuild`; anything else must fail fast with a usage message, and the argument-parsing loop runs entirely before any `docker` command, so an invalid arg should never reach the daemon.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs `run.sh bogus-mode` with no `docker` stub or real `docker` reachable on `PATH`, and asserts exit code 1, a `Usage: ... [shell|setup|update] [--rebuild]` message on stderr, and zero logged docker invocations.
- **Expected Result**: Exit 1; usage message printed; no docker call attempted.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh: an unrecognized positional argument prints usage and exits 1 without ever invoking docker`)
- **Unit Test Command**: `node --test --test-name-pattern="unrecognized positional argument prints usage" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-005: `run.sh shell` (default, and explicit) runs an interactive container via `docker run --rm -it -v <repo>:/opt/bootstrap-claude:ro <image> bash`
- **Scenario**: Task step 2 requires `run.sh shell` (default with no arg) to drop into an interactive shell in a fresh container with the repo read-only bind-mounted, never copied.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs `run.sh` with no args and separately with `shell`, both against a stub `docker`, and asserts the constructed `docker run` call includes `--rm`, `-it`, a `-v <repo>:/opt/bootstrap-claude:ro` mount, the image name, and ends in bare `bash` — and that the no-arg and explicit-`shell` calls are identical.
- **Expected Result**: Both invocations produce the identical, correctly-flagged `docker run ... bash` command.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh: default mode (no args) runs an interactive shell in a fresh container via docker run --rm -it ... bash`, `run.sh shell: explicit "shell" argument produces the identical docker run call as no argument`)
- **Unit Test Command**: `node --test --test-name-pattern="runs an interactive shell in a fresh container|identical docker run call" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-006: `run.sh setup` runs `setup-project.sh` non-interactively against a fresh scratch dir, never allocates a tty, and never targets the mounted repo path
- **Scenario**: Task step 2 requires `setup` mode to run non-interactively against `/workspace/scratch-project` (created fresh inside the container), never against `/opt/bootstrap-claude` itself, since that mount is read-only and is the tool under test.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs `run.sh setup` against a stub `docker` and asserts the constructed `docker run` call has no `-it`, and its trailing script argument contains `mkdir -p '/workspace/scratch-project'` followed by `'/opt/bootstrap-claude/lib/scripts/setup-project.sh' '/workspace/scratch-project'`, with no `update-project.sh` reference.
- **Expected Result**: Non-interactive `setup-project.sh` invocation against the scratch dir only.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh setup: runs setup-project.sh non-interactively against a fresh scratch dir, never -it, never against the mounted repo path`)
- **Unit Test Command**: `node --test --test-name-pattern="runs setup-project.sh non-interactively" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-007: `run.sh update` chains `setup-project.sh && update-project.sh` against the same scratch dir in one container invocation
- **Scenario**: Task step 2 requires `update` mode to pre-seed the scratch dir by running `setup` first, then `update` against the same directory in the same container invocation, so `update`'s code path is exercised against genuine prior state rather than a blank directory.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs `run.sh update` against a stub `docker` and asserts the trailing script argument contains both `setup-project.sh` and `update-project.sh` invocations against `/workspace/scratch-project`, joined by `&&`, with `setup-project.sh` appearing first.
- **Expected Result**: `setup-project.sh '/workspace/scratch-project' && ... update-project.sh '/workspace/scratch-project'`, in that order, single container invocation.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh update: chains setup-project.sh && update-project.sh against the same scratch dir in one container invocation`)
- **Unit Test Command**: `node --test --test-name-pattern="chains setup-project.sh" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-008: The image build is skipped when it already exists, triggered automatically when missing, and forced by `--rebuild` regardless of position
- **Scenario**: Task step 2 requires `run.sh` to build the image if it doesn't exist or `--rebuild` is passed, and to skip an unnecessary rebuild otherwise — `--rebuild` must be recognized alongside a mode argument in either order.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it exercises all four combinations against a stub `docker image inspect` returning success/failure: (a) image exists, no `--rebuild` → no `docker build` call; (b) image missing → `docker build -t bootstrap-claude-fresh-machine ...` called even without `--rebuild`; (c) image exists + `--rebuild` → `docker build` still called; (d) `setup --rebuild` → both the build call and the correct `setup-project.sh` run call occur.
- **Expected Result**: Build only ever skipped when the image exists AND `--rebuild` is absent; every other combination builds.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (tests: `run.sh: skips docker build when the image already exists and no --rebuild is passed`, `run.sh: builds the image when it does not exist yet, even without --rebuild`, `run.sh --rebuild: forces a docker build even when the image already exists`, `run.sh: --rebuild is accepted in any position alongside a mode argument (e.g. "setup --rebuild")`)
- **Unit Test Command**: `node --test --test-name-pattern="build" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-009: `lib/scripts/README.md`'s "Standalone infra scripts" table points at `test/docker/fresh-machine/`
- **Scenario**: Task step 3 requires a one-line pointer in `lib/scripts/README.md`'s existing "Standalone infra scripts (not wired to the CLI)" section, discoverable alongside `setup-runner.sh`/`startup.sh`.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `lib/scripts/README.md` and asserts the exact markdown link `[`test/docker/fresh-machine/`](../../test/docker/fresh-machine/README.md)` is present.
- **Expected Result**: Pointer row present with a working relative link to the harness's own `README.md`.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `lib/scripts/README.md: the "Standalone infra scripts" table points at test/docker/fresh-machine/`)
- **Unit Test Command**: `node --test --test-name-pattern="Standalone infra scripts" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-010: A real `run.sh shell` container has a genuinely blank `$HOME` and every foundational tool works
- **Scenario**: Task step 4's first verification bullet — no `~/.claude/skills/`, `~/.claude/hooks/`, or `~/.claude/settings.json` must exist in a fresh container, and `node --version`, `uv --version`, `claude --version`, `git --version`, `brew --version` must all succeed.
- **Steps**:
  1. Build first with `./run.sh --rebuild` if the image isn't already cached (`docker image inspect bootstrap-claude-fresh-machine`).
  2. Run the command below as-is.
- **Command**:
  ```bash
  docker run --rm bootstrap-claude-fresh-machine bash -c 'test ! -e ~/.claude/skills && test ! -e ~/.claude/hooks && test ! -e ~/.claude/settings.json && node --version && uv --version && claude --version && git --version && brew --version && whoami && pwd'
  ```
- **Expected Result**: Exit 0; no pre-existing Claude Code state; `whoami` → `tester`; `pwd` → `/workspace`; all five tools report a version. Matches the evidence already recorded in TASK-060's Notes (`node --version` v24.19.0, `uv --version` 0.12.5, `claude --version` 2.1.240, `git --version` 2.43.0, `brew --version` 6.0.18 at generation time — exact versions will drift as upstream releases move, only presence/success is being re-verified here).
- **Repeatable Unit Test**: Not applicable: requires a live Docker daemon and a multi-minute image build/pull, but the command itself is a single, fully deterministic invocation — reclassified from Manual to a live-command case (2026-08-27 reassessment) since UAT-CORE's channel 1 (extractable `**Command**:` + machine-checkable Expected) needs no unit-test harness to auto-judge this.
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-011 (Manual — pins a documented known limitation, does not paper over it): `run.sh setup` and `run.sh update` both currently fail at the identical point (Serena `project.yml` bootstrap), so `update-project.sh`'s own distinct code has never been exercised independently by this harness
- **Scenario**: TASK-060's own "Resumed run (2026-08-22)" Notes record that both `setup-project.sh` and `update-project.sh` (chained after `setup-project.sh` in `update` mode) reach every non-interactive prompt (MCP install, Obsidian install, optional guide opt-ins) and correctly auto-decline via `has_tty()`'s fallback, but then **both** fail with exit code 1 at the final `claude --print` Serena `project.yml` bootstrap step, because Serena is never registered in the decline-only non-interactive path. Because `update` mode is `setup-project.sh && update-project.sh`, the `&&` short-circuits on `setup-project.sh`'s failure — meaning `update-project.sh`'s own logic (legacy `.docs/` detection, etc.) has **never actually run** in this harness. This is judged a clearly-expected failure per the task's acceptance bar ("fails only for a clearly-expected reason... not for a missing foundational dependency") and is explicitly TASK-071's job to unblock (the accept-path lane), not a defect in TASK-060 — but a UAT case exists here to pin the current behavior so a future change either fixing it or silently regressing it is caught, rather than the limitation being re-discovered from scratch.
- **Steps**:
  1. `./run.sh setup` (from `test/docker/fresh-machine/`) against a freshly built image; observe it runs to completion through hooks/skills install, deny-list + hooks-wiring merge, wiki scaffold sync, alias backfill, and the MCP-tools guide build, printing `Non-interactive terminal: skipping prompt, answering no.` at each reachable prompt, then fails at the Serena bootstrap step with a non-zero exit code.
  2. `./run.sh update` against a freshly built image; observe it reaches the identical failure point for the identical reason (the `setup-project.sh` half of the `&&` chain fails first), and `update-project.sh` itself never runs.
- **Expected Result**: Both commands exit non-zero (`echo $?` after each), both fail at the Serena `project.yml` bootstrap step specifically (not earlier, and not for a missing foundational dependency), and `update-project.sh`'s own output/log lines are absent from the `update` mode run.
- **Note**: `test/docker/fresh-machine/README.md`'s "Out of scope for v1" section currently states *"`setup`/`update` still complete... a failed MCP install only logs a warning rather than aborting the run"* — this reads as contradicting the exit-1 failure documented in the task's own Notes and re-verified by this case. Flagged in Gaps below rather than silently edited, since it's a documentation discrepancy outside this UAT's remit to resolve.
- **Repeatable Unit Test**: Not applicable: requires a live Docker daemon and multi-minute build/run per invocation (two full runs).
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-08-27 -->

---

## Gaps

- **Automation reassessment (2026-08-27)**: UAT-EDGE-010 was promoted from Manual to a live-command case — it's a single, fully deterministic invocation with no ambiguity in its exit code. UAT-EDGE-011 stays Manual: `run.sh setup`/`run.sh update` don't emit a distinguishing PASS/FAIL line the way `run.sh idempotency` does (see TASK-072), so a bare exit-code check can't tell "failed at the expected, documented step" apart from "failed for a new, different reason" — both currently produce exit 1. Automating it meaningfully would mean enhancing `run.sh setup`/`update` to print an explicit status line first; recommend `/task-add` that as a follow-up rather than bolting an ad hoc check onto this UAT.
- **Documentation discrepancy found — fixed during UAT walkthrough (2026-08-22)**: `test/docker/fresh-machine/README.md`'s "Out of scope for v1" section stated `setup`/`update` "still complete" when an MCP install is skipped, but TASK-060's own verified Notes (2026-08-22) and UAT-EDGE-011 above show both modes actually **fail** (exit 1) at the Serena `project.yml` bootstrap step — a step downstream of, and unrelated to, the MCP-install skip the sentence was about. Corrected the wording to distinguish "MCP-skip doesn't block completion" (still true) from the separate, currently-real Serena-bootstrap failure, and pointed at the follow-on `run.sh accept`/stale-machine work as the fix path.
- **No coverage of the persistent-volume variant or MCP-in-Docker**: both are explicitly out of scope per TASK-060's own Notes; no case here exercises them, matching that scope boundary rather than a gap.
- **No coverage of macOS-only install paths** (`brew install --cask obsidian`, `/Applications/Obsidian.app` check, Playwright launchd agent): explicitly and correctly out of scope — Docker Desktop on macOS runs Linux containers only, as documented in the harness's own README "Platform scope boundary" section.

---

Next steps:
```
To walk through tests interactively:  /uat-walk wiki/work/uat/UAT-060-docker-fresh-machine-harness.md
To run tests headlessly:              /uat-auto wiki/work/uat/UAT-060-docker-fresh-machine-harness.md
```
