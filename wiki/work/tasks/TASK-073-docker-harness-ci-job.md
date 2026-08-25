---
id: TASK-073
aliases: [TASK-073]
title: "Wire a GitHub Actions CI job for the Docker fresh-machine harness"
status: pending-uat
created: 2026-08-22
updated: 2026-08-22
depends_on: [TASK-060]
blocks: []
parallel_safe_with: [TASK-072, TASK-031, TASK-039]
uat: "[[UAT-073]]"
tags: [docker, testing, dev-tooling, ci]
---

# TASK-073 — Wire a GitHub Actions CI job for the Docker fresh-machine harness

implements::[[ROADMAP-009]]
depends_on::[[TASK-060]]

> **Depends on**: [[TASK-060]]

## Objective

Research for ROADMAP-009 confirmed GitHub-hosted `ubuntu-latest` runners ship Docker pre-installed, so no Docker-in-Docker workaround is needed to run TASK-060's harness in CI — a plain `docker build && docker run` workflow step is sufficient (matching TASK-060's own explicit "MCP install is out of scope for v1" boundary — this CI job stays non-MCP too). This task wires that into the repo's existing `.github/workflows/` so the harness runs automatically instead of only on-demand locally.

## Approach

Check whether this repo already has `.github/workflows/` (created by `lib/scripts/setup-deployment.sh` if `deploy` has been run against this repo, or committed directly) — if none exists, this task creates the minimal one needed rather than running the full `deploy` scaffolding flow (that flow scaffolds unrelated CI concerns like `security.yml`/`.gitleaks.toml`, out of scope here). Add a job that builds `test/docker/fresh-machine/`'s image and runs `run.sh setup` and `run.sh update` (and, if TASK-072/TASK-071 have landed by the time this is implemented, their modes too — check `wiki/work/tasks/index.md` for their status before scoping this job's step list, since chaining onto them only makes sense once they exist).

## Steps

### 1. Add the CI workflow <!-- agent: general-purpose -->

- [x] Check for an existing `.github/workflows/*.yml`; if none exists, create a new minimal one (e.g. `.github/workflows/docker-harness.yml`) rather than invoking the full `setup-deployment.sh` scaffold.
- [x] Add a job on `ubuntu-latest` that checks out the repo, builds `test/docker/fresh-machine/`'s image, and runs `run.sh setup` then `run.sh update` non-interactively, failing the job on non-zero exit from either.
- [x] Check `wiki/work/tasks/index.md` for TASK-071 (stale mode) and TASK-072 (idempotency) status — if either has landed (`status: done`), add their `run.sh` modes as additional steps in this same job; if not yet landed, leave a one-line comment noting they should be added once available, rather than blocking this task on them.
- [x] Confirm the workflow triggers on pull requests touching `test/docker/fresh-machine/**` or `lib/scripts/**` (the two paths whose changes this harness actually needs to catch), not on every push to every path — keep CI cost proportional to relevance.

<!-- Updated: 2026-08-22 -->

## Notes

- `.github/workflows/docker-harness.yml` created: `pull_request` trigger scoped to `test/docker/fresh-machine/**` and `lib/scripts/**`; single `ubuntu-latest` job checks out, builds the image (tag `bootstrap-claude-fresh-machine`, matching `run.sh`'s own `IMAGE_NAME`), then runs `./test/docker/fresh-machine/run.sh setup` and `./test/docker/fresh-machine/run.sh update` as separate steps (default `run:` non-zero-exit failure, no manual exit-code handling needed).
- TASK-071 and TASK-072 were both still `status: todo` at implementation time — left a one-line YAML comment in the workflow noting their `run.sh` modes should be added as steps once those tasks land, rather than blocking this task on them.
- Did not touch `test/docker/fresh-machine/run.sh` or `README.md` (confirmed via `git diff --stat`, both empty — that directory is untracked pending TASK-060's own commit).
- **Known risk flagged by the implementing agent (not addressed here, out of this task's scope):** `test/docker/fresh-machine/README.md`'s "Out of scope for v1" section documents that both `run.sh setup` and `run.sh update` currently exit non-zero at the Serena `project.yml` bootstrap step on a fully non-interactive, decline-only path — meaning this new CI job may fail in practice until that's resolved (likely TASK-071's territory or a follow-on). Recorded here for whoever picks that up next; not fixed as part of TASK-073 since the task's checkboxes didn't call for it.
- YAML syntax validated with Ruby's YAML parser (pyyaml unavailable in the sub-agent's environment; did not install packages to work around it — used the already-available interpreter instead).

