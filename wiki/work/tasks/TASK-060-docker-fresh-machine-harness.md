---
id: TASK-060
title: "Docker fresh-machine test harness for setup/update"
status: todo
created: 2026-08-15
updated: 2026-08-15
depends_on: []
blocks: []
parallel_safe_with: [TASK-031, TASK-039]
uat: ""
tags: [docker, testing, dev-tooling]
---

# TASK-060 — Docker fresh-machine test harness for `setup`/`update`

## Objective

Build a Docker-based harness that emulates running `npx @codewizard-dt/bootstrap setup` or `update` on a completely fresh machine with no prior Claude Code infrastructure — no `~/.claude/skills/`, `~/.claude/hooks/`, or `~/.claude/settings.json`. This gives a reliable, repeatable way to catch machine-state bugs (like the `update`-specific `prompt_yn`/interactive-read issue currently under separate investigation — see `wiki/hot.md` Active Threads) instead of relying on ad hoc testing on whatever physical machine happens to be handy.

## Approach

**One image, generic only.** The base Docker image installs only foundational, project-agnostic dependencies — OS packages, git, curl, build tools, Node.js, `uv`, and the `claude` CLI (the two binaries `lib/scripts/setup-project.sh:8-18` preflights before anything else runs; `update-project.sh` has no such preflight but needs the same tools present for `run_project_sync` to succeed). The image **never** bakes in anything from this repo — no skills, no hooks, no settings.json merges, no wiki scaffold, no copy of the bootstrap-claude source. This is the load-bearing constraint: the same image must stay valid and reusable across different bootstrap-claude branches/versions without rebuilding, because the repo checkout is mounted into the *container* at run time, not baked into the *image* at build time.

**Location**: `test/docker/fresh-machine/` — this repo's existing `test/` directory holds test tooling (currently Node `*.test.js` files under `npm test`), kept separate from `lib/scripts/` (the actual shipped product code). `fresh-machine/` distinguishes this from the future persistent-volume variant (see Notes).

**Base image choice**: `ubuntu:24.04`. A `node:`-tagged base would supply Node for free but ties the image to one Node version and reads as Node-specific infrastructure rather than a generic machine; installing Node explicitly via NodeSource on plain Ubuntu keeps the image's purpose ("a fresh Linux machine") honest and makes the Node version an explicit, visible `ARG`.

**Both `setup` and `update` scenarios, both non-interactive.** The user is actively debugging an `update`-specific bug on another machine, so the harness must exercise both entry points, not just `setup`. Both scripts eventually call the shared `run_project_sync` (`lib/scripts/lib.sh`) — matching this repo's existing convention of one shared sequence driven by two thin entry scripts (mirrored in the harness's own run script).

**Platform scope boundary — state this plainly, do not try to work around it.** Docker Desktop on macOS runs Linux containers. This harness faithfully exercises the Linux code paths: the `flatpak`-based Obsidian install (`lib/scripts/install-obsidian.sh`), the general non-interactive/interactive prompt flows (`prompt_yn`, `prompt_yn_sticky` in `lib.sh`), and a genuinely blank `$HOME` with no pre-existing `~/.claude/`. It **cannot** exercise macOS-specific paths: `brew install --cask obsidian`, the `/Applications/Obsidian.app` already-installed check, or the Playwright launchd-agent install in `lib/scripts/install-mcps.sh`. This is a known, deliberate scope boundary — not a defect to chase in this task.

**MCP install is out of scope for v1.** `install-mcps.sh` spins up a Docker container of its own (`brave-search-mcp`) — Docker-in-Docker inside this harness is a real complication. Drive the harness with `--skip-mcps`-equivalent behavior for the default verification pass (whatever `run_project_sync`/the install scripts expose — check `lib/scripts/install-global.sh --skip-mcps` and whether `setup-project.sh`/`update-project.sh` expose an equivalent flag or env var; if not, this is a `## Notes` follow-on, not something to add here). Do not attempt to solve Docker-in-Docker or host-docker-socket mounting in this task.

## Steps

### 1. Dockerfile — generic base image  <!-- agent: general-purpose -->

- [ ] Create `test/docker/fresh-machine/Dockerfile`, base image `ubuntu:24.04`
- [ ] Install OS-level foundational packages: `git`, `curl`, `ca-certificates`, `build-essential`, `gnupg`
- [ ] Install Node.js via NodeSource setup script (pick a current LTS as an `ARG NODE_VERSION`, e.g. 20 or 22 — confirm current LTS at implementation time; `package.json` has no `engines` field pinning a version, so any current LTS is acceptable)
- [ ] Install `uv` via its official installer: `curl -LsSf https://astral.sh/uv/install.sh | sh`, ensuring the install location lands on `PATH` for subsequent `RUN`/`CMD` layers (uv's installer defaults to `~/.local/bin` — either set `ENV PATH` explicitly or install to a system location)
- [ ] Install the Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- [ ] Create a non-root user (mirrors a real fresh developer machine more faithfully than root; also required for the Homebrew install below, which refuses to run as root) and set it as the image's default user
- [ ] Install Homebrew for that non-root user, per Homebrew's official Linux install instructions (`/home/linuxbrew/.linuxbrew`), since the user's request explicitly named it as a foundational dependency to have available — even though nothing in `setup-project.sh`'s own preflight currently requires it
- [ ] Do **NOT** `COPY` the bootstrap-claude repo, any of its `lib/`, `wiki/`, or `package.json` into the image. The image must build and be usable with this repo not existing anywhere on disk yet
- [ ] Set `WORKDIR` to a neutral path (e.g. `/workspace`) and leave `CMD` as an interactive shell (`bash`) — the run script (Step 2) decides what actually executes

### 2. Run/reset helper script  <!-- agent: general-purpose -->

- [ ] Create `test/docker/fresh-machine/run.sh` (`set -euo pipefail`, matching this repo's existing script style in `lib/scripts/setup-project.sh` / `startup.sh`)
- [ ] Resolve the bootstrap-claude repo root as `git rev-parse --show-toplevel` run from the script's own directory (do not hardcode an absolute path)
- [ ] Build the image if it doesn't exist or `--rebuild` is passed: `docker build -t bootstrap-claude-fresh-machine test/docker/fresh-machine`
- [ ] Start a fresh, ephemeral container (`docker run --rm -it`) with the bootstrap-claude repo checkout **read-only bind-mounted** into the container at a fixed path, e.g. `-v "$REPO_ROOT:/opt/bootstrap-claude:ro"` — never copied at build time
- [ ] Inside the container, create a throwaway empty scratch project directory (e.g. `/workspace/scratch-project`) — **never** run `setup`/`update` against the mounted repo path itself, since that mount is read-only and is the tool being tested, not the target
- [ ] Support three invocation modes via a positional arg or flag:
  - `run.sh shell` — drop into an interactive shell in the container for manual exploration (default if no arg given)
  - `run.sh setup` — non-interactively run `node /opt/bootstrap-claude/bin/cli.js setup /workspace/scratch-project` (or the equivalent `npx`-style invocation `lib/scripts/setup-project.sh` expects — confirm the actual entrypoint via `bin/cli.js` before wiring this) against the fresh scratch dir and exit with its exit code
  - `run.sh update` — same, but pre-seed the scratch dir as an already-`setup` project first (run `setup` non-interactively, then `update` against the same dir, inside the same container invocation) so `update`'s code path is genuinely exercised against prior state, not a blank directory
- [ ] For the non-interactive `setup`/`update` modes, ensure no step blocks on a TTY prompt: verify what `has_tty`/`prompt_yn` (`lib/scripts/lib.sh`) do when stdin is not a TTY (this repo's existing convention, per `update-project.sh`'s legacy-docs-ack handling read during this task's research, is that non-interactive mode already has defined fallback behavior — confirm it holds for every prompt reachable during `setup`/`update`, not just that one)

### 3. Documentation  <!-- agent: general-purpose -->

- [ ] Create `test/docker/fresh-machine/README.md` covering: what this harness is for, how to build (`./run.sh` auto-builds on first use, or `docker build` directly), how to run each of the three modes, and the explicit macOS-path exclusion caveat (Docker Desktop on macOS runs Linux containers only — cannot exercise `brew install --cask obsidian`, the `/Applications/Obsidian.app` check, or the Playwright launchd-agent path)
- [ ] Add a one-line pointer to this new harness in `lib/scripts/README.md`'s existing "Standalone infra scripts (not wired to the CLI)" section (or its own short section immediately after it) so it's discoverable alongside `setup-runner.sh`/`startup.sh`, which already document the equivalent for droplet bootstrapping

### 4. Manual verification  <!-- agent: general-purpose -->

- [ ] Run `run.sh shell` and confirm the fresh container genuinely has no `~/.claude/skills/`, `~/.claude/hooks/`, or `~/.claude/settings.json`, and that `node --version`, `uv --version`, `claude --version`, `git --version`, and `brew --version` all succeed
- [ ] Run `run.sh setup` against a fresh container and confirm it completes, or fails only for a clearly-expected reason (e.g. MCP install requiring network/Docker-socket access) — not for a missing foundational dependency
- [ ] Run `run.sh update` against a fresh container and confirm the same
- [ ] Record the actual observed behavior (pass, or expected-limitation failure with its reason) in the task file or a follow-up note before flipping this task to done — this is the acceptance evidence, not a formality

## Notes

- **Persistent-volume variants are explicitly out of scope for this task.** The user wants a future harness variant using named Docker volumes to test idempotent re-runs / update-after-setup across container restarts (i.e. state surviving a container being stopped and started again, vs. this task's ephemeral `--rm` container where state only survives within one `run.sh` invocation). Track that as a separate follow-on task if/when it's actually needed — don't build it speculatively here.
- **Docker-in-Docker for the Brave Search MCP container is deferred.** If a later pass wants to test the full MCP install path from inside this harness, the two options to evaluate then are mounting the host's Docker socket (`-v /var/run/docker.sock:/var/run/docker.sock`) or accepting nested Docker — neither is solved by this task.
