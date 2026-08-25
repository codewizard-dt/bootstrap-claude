---
id: TASK-068
aliases: [TASK-068]
title: "Resolve the correct setup/update invocation entrypoint for the Docker harness's run.sh"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
blocks: [TASK-060]
parallel_safe_with: [TASK-069, TASK-070, TASK-031, TASK-039]
uat: ""
tags: [docker, testing, dev-tooling, research]
---

# TASK-068 — Resolve the correct `setup`/`update` invocation entrypoint for the Docker harness's `run.sh`

implements::[[ROADMAP-009]]

## Objective

TASK-060 step 2 originally planned for `run.sh setup`/`run.sh update` to invoke `node /opt/bootstrap-claude/bin/cli.js setup /workspace/scratch-project` (or an equivalent `npx`-style call). Research for ROADMAP-009 (`raw/research/docker-fresh-machine-test-harness/index.md`) found this is **broken as written**: `bin/cli.js`'s `setup` and `update` commands hardcode their target directory to `.` and never spread any extra positional args (only `deploy`/`migrate`/`typechecks`/`dashboard` do). Passing a scratch-project path on the command line would silently no-op — the CLI would act on its own working directory instead. This task pins down the correct entrypoint before TASK-060's `run.sh` is written against it.

## Approach

Read `bin/cli.js` in full to confirm the `setup`/`update` command definitions and how each subcommand resolves its target directory (via `process.argv`, `process.cwd()`, or an explicit path arg). Two viable fixes, pick whichever keeps `run.sh` simplest and matches this repo's own convention of calling `lib/scripts/*.sh` directly for anything the CLI doesn't cleanly expose:

- **Option A (recommended default)**: `run.sh` invokes `lib/scripts/setup-project.sh <target>` / `lib/scripts/update-project.sh <target>` directly (bypassing `bin/cli.js` entirely), since those scripts already accept a project path argument — confirm this by reading their arg-parsing (`resolve_project_dir` in `lib/scripts/lib.sh`).
- **Option B**: fix `bin/cli.js` itself to `cd` into the passed path (or spread `process.argv.slice(3)`) before invoking `setup-project.sh`/`update-project.sh`, so the CLI's own `setup <path>`/`update <path>` forms work as a user would expect from the README's documented usage. This is a real latent bug independent of the Docker harness (flagged in `wiki/hot.md`'s Active Threads) — worth fixing regardless of which option the harness itself uses, but only in scope here if it doesn't expand this task's footprint significantly.

Record the decision (which option, and why) in this task's `## Notes` before starting TASK-060, since TASK-060 step 2's exact `run.sh` invocation lines depend on this answer.

## Steps

### 1. Confirm the entrypoint contract <!-- agent: general-purpose -->

- [x] Read `bin/cli.js` in full via Serena (`get_symbols_overview` then `find_symbol` on the `setup`/`update`/`deploy`/`migrate` command definitions) — confirm exactly how `setup`/`update` resolve their working directory today, and confirm `deploy`/`migrate`/`typechecks`/`dashboard` really do spread extra args (the asymmetry research flagged).
- [x] Read `lib/scripts/setup-project.sh` and `lib/scripts/update-project.sh`'s argument handling (via `resolve_project_dir` in `lib/scripts/lib.sh`) — confirm both scripts accept an explicit target-directory argument independent of `bin/cli.js`.
- [x] Decide Option A vs Option B (see Approach) and write a 2-4 sentence decision + rationale into this task's `## Notes` section.
- [x] If Option B is chosen: fix `bin/cli.js`'s `setup`/`update` command handlers to pass through the target path the same way `deploy`/`migrate` already do (spread `process.argv.slice(3)` or equivalent), and add/update a regression test in `test/` confirming `bootstrap setup <path>` no longer silently targets `.`. If Option A is chosen, no `bin/cli.js` change is needed here — just document the decision for TASK-060 to consume.

## Notes

**Decision: Option A.** `bin/cli.js`'s `SCRIPTS.setup`/`SCRIPTS.update` entries hardcode `args: ['.']` and never spread `extraArgs` (unlike `deploy`/`migrate`, which do `['.', ...extraArgs]`, and `typechecks`/`dashboard`, which spread too) — confirming the research's asymmetry claim exactly. However, `lib/scripts/setup-project.sh` and `lib/scripts/update-project.sh` already require exactly one positional argument and resolve it via `resolve_project_dir "$1"` in `lib.sh` (cd + pwd), fully independent of `bin/cli.js`. Since `run.sh` lives inside this repo's own container image, it can call these scripts directly and skip the CLI's `.`-hardcoding bug entirely — no `bin/cli.js` change is needed for TASK-060 to proceed, so Option B is left as a separately-tracked latent bug rather than fixed here. `run.sh`'s `setup`/`update` invocation lines for TASK-060 should be: `/opt/bootstrap-claude/lib/scripts/setup-project.sh /workspace/scratch-project` and `/opt/bootstrap-claude/lib/scripts/update-project.sh /workspace/scratch-project` (adjust the `/opt/bootstrap-claude` prefix to wherever the harness mounts/copies this repo).

<!-- Updated: 2026-08-22 00:00 -->

