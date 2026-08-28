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
./run.sh live-hook    # opt-in, NOT free: verify packageInstall.consent=true against a real,
                       # authenticated `claude -p` session (see "Live-hook mode" below first)
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

## Live-hook mode

Unlike every other mode above, `run.sh live-hook` **authenticates** — it runs a real `claude -p`
session inside the container against the operator's own Claude Code subscription, rather than
staying fully offline. It exists to verify one specific thing that has never been tested before
this mode was added: that `packageInstall.consent=true` actually reaches an `allow` decision in
Claude Code's real, live permission pipeline (`package-install-consent.js`), not just in a unit
test of the hook script in isolation.

**Prerequisite.** On the host — never inside the container — run:

```sh
claude setup-token
export CLAUDE_CODE_OAUTH_TOKEN=<the token it prints>
./run.sh live-hook
```

**Store the token, don't leave it in shell history or a dotfile.** On macOS, save it to Keychain
under a fixed service name (`claude-code-oauth-token-live-hook`) and only export it into the
current shell right before invoking this mode:

```sh
# once, after `claude setup-token` prints a token:
security add-generic-password -a "$USER" -s "claude-code-oauth-token-live-hook" -w "<the token>"

# every time you actually run this mode:
export CLAUDE_CODE_OAUTH_TOKEN="$(security find-generic-password -a "$USER" -s "claude-code-oauth-token-live-hook" -w)"
./run.sh live-hook
unset CLAUDE_CODE_OAUTH_TOKEN
```

Never put the token in `~/.zshrc`, `~/.bash_profile`, or any `.env` file — those are sourced on
every shell start, which is a much larger blast radius than a Keychain item pulled on demand.

`claude setup-token` runs the same OAuth flow as `/login` and prints a one-year token tied to the
subscription's included usage; `run.sh` forwards it into the container value-less
(`docker run -e CLAUDE_CODE_OAUTH_TOKEN`), the same pattern already used for `BRAVE_API_KEY`. This
is what lets the throwaway container run a genuinely authenticated `claude -p` session without
copying `~/.claude/settings.json`, hooks, or MCP registrations from the host — see
[`claude-code-authentication`](../../../wiki/knowledge/entities/tools/claude-code-authentication.md)
for the full research on why that isolation holds. Without `CLAUDE_CODE_OAUTH_TOKEN` set, `run.sh`
exits 1 with a hint to run `claude setup-token` first and never touches Docker at all.

**This is not free.** Every other mode in this harness (`shell`, `setup`, `update`, `stale`,
`idempotency`) never authenticates, so they cost nothing beyond local compute. `live-hook` spends
real usage against the operator's own Claude Code subscription every time it runs — it is not a
free, repeatable CI check, and should not be wired into `docker-harness.yml` or run casually.

**Scope: only the `allow` path.** Inside the container, this mode installs the repo's hooks for
real (`install-global.sh --skip-mcps`), seeds `packageInstall.consent=true` for a scratch project
via `bootstrap-prefs.js`, then runs `claude -p "npm install left-pad"` and asserts it completes
with zero permission prompts. It verifies **only** `packageInstall.consent=true → allow`. The
`ask`/`defer` sub-case — where `package-install-consent.js` must actually surface an interactive
permission prompt and wait on a human response — cannot be exercised by a non-interactive
`claude -p` session at all, headless or not. That sub-case remains human-only, verified via
`/uat-walk`.

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
