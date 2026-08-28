---
id: docker-fresh-machine-test-harness
title: Docker-Based Fresh-Machine Test Harness for CLI Installer Scripts
updated: 2026-08-27
sources:
  - ../../../raw/research/docker-fresh-machine-test-harness/index.md
  - ../../../raw/research/docker-harness-version-upgrade-testing/index.md
confidence: extracted
tags: [docker, testing, tooling, task-060]
---

Research backing TASK-060 (Docker fresh-machine test harness for `setup`/`update`), gathered ahead of a roadmap expanding it into research/implementation/testing phases. **Docker over a VM is confirmed as the right isolation choice** — a fresh Ubuntu base image guarantees byte-identical state across runs, matching community consensus and TASK-060's own design.

**Two concrete, verified findings correct TASK-060's own spec rather than merely restating it.** First, `bin/cli.js`'s `setup`/`update` commands hardcode the target directory to `.` and never spread extra CLI args (only `deploy`/`migrate`/`typechecks`/`dashboard` do) — so TASK-060 step 2's literal example invocation, `node bin/cli.js setup /workspace/scratch-project`, silently targets the cwd instead of the scratch path. The harness must invoke `lib/scripts/setup-project.sh`/`update-project.sh` directly with the scratch path as `$1`, bypassing `bin/cli.js` entirely. Second, this codebase's non-interactive prompt contract (`lib/scripts/lib.sh::has_tty`/`prompt_yn`/`prompt_yn_sticky`) is a **hard, structural "no"** — every optional install (Obsidian app/plugins/graph-defaults, MCPs) is declined automatically with nothing recorded when stdin isn't a TTY, by design, not by omission. A default non-interactive harness run can therefore never exercise the "accept" branch of any optional installer; doing so requires pre-seeding `bootstrap-prefs.js` answers against the scratch project dir before the run, the same pattern `test/install-obsidian.test.js`'s scratch-env tests already use.

**Idempotency testing has one dominant pattern across every source consulted**: run the target script twice (or three times) against the same state and assert either byte-identical final state or a clean second exit code — no source recommends anything more elaborate for a script-level check. TASK-060's `run.sh update` mode already runs `setup` then `update` once; a genuine idempotency check needs a *second* `update` run asserting no error and no unexpected diff.

**CI integration needs no Docker-in-Docker.** GitHub Actions' `ubuntu-latest` runners ship Docker CE pre-installed — `docker build`/`docker run` work directly in a workflow step with no extra setup action, resolving the CI question TASK-060 leaves open (for the case without the MCP container, which TASK-060 already scopes out of v1).

See the full report — `raw/research/docker-fresh-machine-test-harness/index.md` — for the Solution/Recommendation breakdown by phase (research / implementation / testing), and `sources.md` for citations.

**Follow-up (2026-08-27): "brand new" is fully covered, "old version → new version" is only mechanically covered.** `run.sh setup` genuinely tests a fresh install end-to-end. `run.sh stale` proves the *script chain* (old `setup-project.sh` → current `update-project.sh`) runs without erroring, but seeds nothing into the scratch wiki first — it upgrades an empty project, never a used one with real tasks/roadmaps accumulated under an older schema. Worse, the harness's single fixed `OLD_REF` (`c33808d`) turns out to be the exact commit that *introduces* the one migration this repo currently ships (the `aliases:` backfill, derived_from::[[TASK-064]]) — so `stale` mode structurally cannot exercise "upgrading a wiki from before that migration existed," even though this repo's own oldest task (`TASK-001`, created 2026-07-06) predates it by five weeks. A realistic test needs hand-authored fixture task/roadmap files in the **pre-migration shape** (no `aliases:` line) injected into the scratch dir between the old setup and the current update — no such fixture mechanism exists yet anywhere in the test suite. See derived_from::[[docker-harness-version-upgrade-testing]] for the manual recipe (usable today via `run.sh shell`) and the recommended `seed-fixtures/` extension for repeatable coverage.

relates_to::[[TASK-060]]
relates_to::[[TASK-076]]
