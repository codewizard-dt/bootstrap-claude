# Fresh-machine Docker harness

A Docker-based harness that emulates running `npx @codewizard-dt/bootstrap setup` or `update`
on a completely fresh machine with no prior Claude Code infrastructure — no `~/.claude/skills/`,
`~/.claude/hooks/`, or `~/.claude/settings.json`. Gives a reliable, repeatable way to catch
machine-state bugs instead of relying on ad hoc testing on whatever physical machine happens to
be handy.

## What's in the image

`Dockerfile` builds a **generic-only** base image (`ubuntu:24.04`) with foundational,
project-agnostic dependencies: OS packages (`git`, `curl`, `ca-certificates`, `build-essential`,
`gnupg`), Node.js (via NodeSource, version pinned by `ARG NODE_VERSION`), `uv`, the `claude` CLI,
and Homebrew — installed under a non-root `tester` user (Homebrew refuses to run as root).

The image **never** bakes in anything from this repo — no skills, hooks, settings.json merges,
wiki scaffold, or source copy. The bootstrap-claude checkout is bind-mounted into the container
at run time by `run.sh`, read-only, so the same image stays valid and reusable across different
bootstrap-claude branches/versions without rebuilding.

## Usage

```sh
./run.sh              # same as `./run.sh shell`
./run.sh shell         # interactive shell in a fresh container, for manual exploration
./run.sh setup         # non-interactively run setup-project.sh against a fresh scratch dir
./run.sh update        # run setup-project.sh then update-project.sh against the same dir,
                        # in the same container invocation, so update's code path is
                        # genuinely exercised against prior state
./run.sh stale         # seed an OLDER release's install state (git-archive an older commit
                        # from the ro-mounted repo history and run ITS setup-project.sh),
                        # tolerating its expected seed-step failure, then run the CURRENT
                        # checkout's update-project.sh against the same dir; exits with
                        # update-project.sh's exit code
./run.sh idempotency   # run setup-project.sh then update-project.sh once to seed real
                        # prior state, snapshot the scratch dir + $HOME/.claude/, run
                        # update-project.sh a SECOND time, snapshot again, and assert the
                        # two post-update snapshots are identical (a repeat update must be
                        # a true no-op); prints a diff and exits non-zero on mismatch
./run.sh setup --rebuild   # any mode can be combined with --rebuild to force a fresh `docker build`
```

The image auto-builds on first use. To build it directly instead:

```sh
docker build -t bootstrap-claude-fresh-machine test/docker/fresh-machine
```

Each container run gets a fresh, ephemeral filesystem (`docker run --rm`) — nothing persists
between separate `run.sh` invocations. `setup`/`update` target a throwaway scratch project
directory created inside the container (`/workspace/scratch-project`); the mounted repo checkout
is never targeted directly, since it's the tool under test, not the target.

## Platform scope boundary

Docker Desktop on macOS runs Linux containers. This harness faithfully exercises the Linux code
paths: the `flatpak`-based Obsidian install (`lib/scripts/install-obsidian.sh`), the general
non-interactive/interactive prompt flows (`prompt_yn`, `prompt_yn_sticky` in `lib/scripts/lib.sh`),
and a genuinely blank `$HOME` with no pre-existing `~/.claude/`. It **cannot** exercise
macOS-specific paths: `brew install --cask obsidian`, the `/Applications/Obsidian.app`
already-installed check, or the Playwright launchd-agent install in `lib/scripts/install-mcps.sh`.
This is a known, deliberate scope boundary — not a defect to chase.

## Out of scope for v1

MCP install (`install-mcps.sh`) spins up its own Docker container (`brave-search-mcp`) —
Docker-in-Docker inside this harness is a real complication, not solved here. Skipping it does
**not** by itself block completion: every prompt reachable in `run_project_sync`
(`lib/scripts/lib.sh`) is gated by `has_tty()`, which auto-declines without blocking when stdin
isn't a TTY, and a failed MCP install only logs a warning rather than aborting the run.

**Known limitation, unrelated to the MCP skip above**: as currently verified, both `run.sh setup`
and `run.sh update` exit non-zero at a later, separate step — `run_project_sync`'s Serena
`project.yml` bootstrap — because Serena is never registered on this fully non-interactive,
decline-only path. This means `update-project.sh`'s own distinct code path (legacy `.docs/`
detection, etc.) has not yet been exercised independently of `setup-project.sh` failing first in
the same chain when run via `run.sh update`. `run.sh stale` (TASK-071) now exercises this same
migration surface from a seeded older-release state, tolerating that same expected seed-step
failure rather than short-circuiting on it. `run.sh idempotency` similarly tolerates this same
expected failure on its seed step and on both of its `update-project.sh` calls, so it can still
reach and validate real `update-project.sh` behavior via its snapshot-2-vs-snapshot-3 comparison
instead of aborting at the first non-interactive Serena-bootstrap failure. Exercising an accept path (pre-seeded
`bootstrap-prefs.js` state to get past the decline-only Serena-bootstrap stall) remains scoped to
a follow-on task (`run.sh accept`), not yet built.

Persistent-volume variants (testing idempotent re-runs across container restarts, vs. this
harness's ephemeral `--rm` containers) are also out of scope — track as a separate follow-on task
if actually needed.
