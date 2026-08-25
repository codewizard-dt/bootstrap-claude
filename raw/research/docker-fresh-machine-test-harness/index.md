---
topic: Docker-based fresh-machine test harness for CLI installer scripts (setup/update) — best practices for research, implementation, and testing phases of TASK-060
slug: docker-fresh-machine-test-harness
researched: 2026-08-22
sources: [./sources.md]
---

# Research: Docker-Based Fresh-Machine Test Harness for CLI Installer Scripts

> Docker is the right tool for this job (community consensus over a VM: identical base image beats "works on my Ubuntu"). TASK-060's design is sound, but its Step 2 invocation of `node bin/cli.js setup <path>` is actually broken — `bin/cli.js` hardcodes the target directory to `.` for `setup`/`update` and ignores extra args, so the harness must either call `lib/scripts/setup-project.sh <path>` directly or `cd` into the scratch dir first. Non-interactive mode in this codebase is a **hard, structural "no"** for every prompt (`prompt_yn`/`prompt_yn_sticky` in `lib.sh`) — a default non-interactive harness run will decline every optional install (Obsidian, graph defaults, MCPs), so exercising the "accept" path requires pre-seeding `bootstrap-prefs.js` answers, exactly as `test/install-obsidian.test.js`'s existing scratch-env tests already do. CI needs no Docker-in-Docker: GitHub's own `ubuntu-latest` runners ship Docker pre-installed, so `docker build && docker run` works directly in a workflow step.

## Research Questions
- Is Docker the right isolation mechanism for testing a fresh-machine CLI install, vs. a VM or devcontainer?
- What does this codebase's non-interactive/TTY-detection contract guarantee, and does the harness's planned invocation pattern actually work against it?
- What's the standard pattern for testing idempotency (setup → update, or update → update) in a container?
- What does CI integration cost — does it need Docker-in-Docker, or does the runner already have Docker?
- What in TASK-060's own spec is genuinely unresolved vs. already fully decided?

## Current State (Codebase)
- `lib/scripts/lib.sh::has_tty` — `[ -t 0 ] || [ "${BOOTSTRAP_ASSUME_TTY:-}" = "1" ]` [S1]. `BOOTSTRAP_ASSUME_TTY=1` is the existing escape hatch the test suite already uses to force "interactive" behavior inside a piped/CI shell.
- `lib/scripts/lib.sh::prompt_yn` — when `has_tty` is false, it never reads stdin; it prints `"Non-interactive terminal: skipping prompt, answering no."` and returns 1 (no) unconditionally, regardless of the prompt's displayed default (`[Y/n]` vs `[y/N]`) [S1].
- `lib/scripts/lib.sh::prompt_yn_sticky` — non-interactive path is structurally identical: returns 1 and **records nothing** (the "no path from here can reach `prefs_set`" comment is explicit about this being deliberate) [S1]. A stored `true`/`false` short-circuits before the TTY check either way.
- `lib/scripts/setup-project.sh` — preflights `command -v claude` and `command -v uv`, requires exactly one positional arg (`$1`), resolves it via `resolve_project_dir` [S2]. Confirms TASK-060's own preflight list (claude, uv) is complete and accurate.
- `bin/cli.js` — `SCRIPTS.setup = { script: 'setup-project.sh', args: ['.'] }` and `SCRIPTS.update = { script: 'update-project.sh', args: ['.'] }`; **`extraArgs` (`process.argv.slice(3)`) is only spread into `deploy`/`deployment`/`migrate`/`typechecks`/`dashboard`, never into `setup`/`update`** [S3]. Calling `node bin/cli.js setup /workspace/scratch-project` therefore silently targets `.` (the cwd), not the given path — TASK-060 step 2's literal invocation example is wrong as written.
- `package.json` — no `engines` field; confirms TASK-060's claim that any current Node LTS is acceptable [S4].
- No existing Serena memory or wiki page covers Docker-based installer testing for this repo — this is genuinely new ground, not a rediscovery.

## Key Findings

1. **Docker over a VM is the right call, and the community consensus matches TASK-060's own choice** [S5]: a fresh Ubuntu image guarantees byte-identical base state across runs, which a hand-managed VM snapshot does not reliably give you; the tradeoff (no macOS-path coverage) is one TASK-060 already documents as a deliberate scope boundary.

2. **TASK-060 step 2's harness invocation as literally specified will not work.** `bin/cli.js`'s `setup`/`update` commands hardcode the project directory to `.` and drop any extra CLI args — the harness must either (a) invoke `lib/scripts/setup-project.sh`/`update-project.sh` directly with the scratch path as `$1` (bypassing `bin/cli.js` entirely), or (b) `cd /workspace/scratch-project` before calling `node /opt/bootstrap-claude/bin/cli.js setup` and rely on the hardcoded `.`. This is a concrete pre-implementation fact to verify/decide, not a vague "confirm the entrypoint" placeholder — the codebase inspection already answers it: option (a) is simpler and matches how `test/install-obsidian.test.js`'s own scratch-dir tests invoke the scripts directly rather than through `bin/cli.js` [S3].

3. **Non-interactive mode is a hard "no" for every optional install, everywhere in this codebase — by design, not by omission.** [S1] Running the harness's `setup`/`update` modes non-interactively (as TASK-060 step 2 specifies) will decline Obsidian app/plugin/graph-defaults install and everything else gated by `prompt_yn`/`prompt_yn_sticky`, every single time, with nothing recorded. This is *good* for the harness's stated goal (catching machine-state bugs without needing real credentials/network), but it means the harness by itself **cannot exercise the "accept" branch** of any optional installer. If a future testing phase wants to verify the accept path too, it needs `bootstrap-prefs.js --set <key> --project <scratch-dir> --value true` seeded before the run — precisely the pattern already used in `test/install-obsidian.test.js`'s scratch-env tests.

4. **Idempotency testing has one dominant, simple pattern across every source consulted: run the target script twice (or three times) against the same state and assert either identical final state or a clean second exit code** [S6][S7][S8]. No source recommends anything more elaborate for a script-level (non-database) idempotency check. This maps directly onto TASK-060's own `run.sh update` mode, which already runs `setup` then `update` in sequence — the missing piece is running `update` a *second* time and asserting no error / no changed output, which TASK-060's current step 2 spec does not call for.

5. **CI integration needs no Docker-in-Docker.** GitHub Actions' standard `ubuntu-latest` runners ship Docker CE pre-installed and ready to use directly in a workflow step — `docker build` and `docker run` just work, no `docker/setup-docker-action` or nested-Docker complexity required [S9][S10]. This directly resolves the CI question TASK-060 leaves open, and specifically for the case *without* the MCP container (which TASK-060 already scopes out of v1) — so a straightforward `docker build -t ... test/docker/fresh-machine && docker run --rm ... run.sh setup` step is sufficient for a first CI pass.

## Constraints
- No macOS-specific coverage (Homebrew Obsidian, Playwright launchd) — accepted, not solvable in Docker on any host per TASK-060's own Notes.
- MCP install (`install-mcps.sh`'s `brave-search-mcp` Docker container) is out of scope for v1 — Docker-in-Docker or host-socket mounting, both deferred by TASK-060 itself.
- The harness must never bake this repo into the image (mount read-only at run time) — already correctly specified in TASK-060.
- Testing the "accept" path of any optional installer requires pre-seeded `bootstrap-prefs.js` state, which is additional harness surface area not yet in TASK-060's spec.

## Recommendation

TASK-060's design is fundamentally sound and does not need re-architecting — but it has one concrete, verifiable bug in its own spec (the `bin/cli.js` argument-passing assumption) and one meaningful test-coverage gap (idempotency needs a *second* `update` run, and the accept-path needs pre-seeded prefs) that a "research" phase should resolve *before* implementation starts, rather than discovering them mid-build:

- **Research phase** — resolve, on paper, before writing any Dockerfile/scripts: (a) confirm the `setup-project.sh`/`update-project.sh` direct-invocation approach over `bin/cli.js` (already answered above — direct invocation is correct); (b) decide whether v1 needs an accept-path test lane (pre-seeded prefs) or defers it, matching the harness's stated goal of catching *machine-state* bugs specifically; (c) confirm current Node LTS version to pin as the Dockerfile `ARG`; (d) re-confirm the still-open `update`-specific `prompt_yn`/interactive-read bug mentioned in `wiki/hot.md` Active Threads — that investigation is a *prerequisite input* to this harness, not output from it, so the research phase should check whether it's still open before implementation assumes a stable target.
- **Implementation phase** — everything already specified in TASK-060 steps 1–2 (Dockerfile, run.sh with shell/setup/update modes), corrected to invoke the scripts directly rather than through `bin/cli.js`, plus a second-`update`-run idempotency check folded into `run.sh update` mode.
- **Testing phase** — TASK-060 step 4 (manual verification) plus: an idempotency assertion (second `update` run exits 0 with no unexpected diff), and optionally a CI workflow step (`docker build && docker run --rm ... run.sh setup`, `... run.sh update`) since GitHub-hosted runners need no extra Docker setup for this.

## Next Steps
- `/roadmap-create` a 3-phase roadmap (research → implementation → testing) wrapping TASK-060, using the phase boundaries above.
- Consider filing the `bin/cli.js` argument-passing finding as its own small task/fix, independent of the harness — it's a latent bug regardless of whether this roadmap proceeds (any future scripted `setup <path>` caller going through `bin/cli.js` hits the same silent-`.`-target issue).
