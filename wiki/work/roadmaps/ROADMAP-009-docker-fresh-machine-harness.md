---
id: ROADMAP-009
aliases: [ROADMAP-009]
title: Docker Fresh-Machine Test Harness for setup/update
status: active
created: 2026-08-22
updated: 2026-08-22
owner: David Taylor
derived_from: [raw/research/docker-fresh-machine-test-harness/index.md, ../../knowledge/sources/docker-fresh-machine-test-harness.md]
linked_requirements: []
linked_decisions: []
tags: [docker, testing, dev-tooling]
---

# Roadmap 009: Docker Fresh-Machine Test Harness for setup/update

## Goal

The Docker harness (`test/docker/fresh-machine/`) is built, its open design questions are resolved first (correct invocation entrypoint, Node LTS pin, accept-path test strategy), and it's verified end-to-end covering both a genuinely fresh machine (no prior Claude infra at all) and a stale machine (an older bootstrap-claude release already installed, `update` must correctly migrate it) — plus a same-version second-run idempotency check — giving a repeatable way to catch `setup`/`update` machine-state bugs instead of ad hoc testing on whatever physical machine is handy.

Derived from [raw/research/docker-fresh-machine-test-harness/index.md](../../../raw/research/docker-fresh-machine-test-harness/index.md) and its wiki summary at [wiki/knowledge/sources/docker-fresh-machine-test-harness.md](../../knowledge/sources/docker-fresh-machine-test-harness.md).

## Phase 1: Research

- [x] [[TASK-068: Resolve the correct setup/update invocation entrypoint for the Docker harness's run.sh]]
- [x] [[TASK-069: Confirm current Node LTS to pin as the Docker harness's ARG NODE_VERSION]]
- [x] [[TASK-070: Decide whether the Docker harness needs an accept-path test lane]]

## Phase 2: Implementation

- [ ] [[TASK-060: Docker fresh-machine test harness for setup/update]]
- [ ] [[TASK-071: Add a run.sh stale mode simulating an upgrade from an older bootstrap-claude release]]

## Phase 3: Testing

- [ ] [[TASK-072: Docker harness idempotency check — run update twice, diff scratch state]]
- [ ] [[TASK-073: Wire a GitHub Actions CI job for the Docker fresh-machine harness]]

## Notes

- **2026-08-22**: Added a Phase 2 item for a "stale-harness" mode after initial creation, per user request — the original scope (TASK-060) only covers a completely empty `~/.claude/`; stale-harness exercises the more common real-world case of `update` running against an already-installed older release. Kept as a new item on the same image/`run.sh`, not a separate Dockerfile/task, matching TASK-060's existing "one generic image, run.sh decides behavior" design.
