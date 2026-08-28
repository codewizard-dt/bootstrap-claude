---
id: docker-harness-version-upgrade-testing
title: "Research: Testing brand-new installs and previous-version-to-new-version upgrades with the fresh-machine harness"
updated: 2026-08-27
sources:
  - ../../../raw/research/docker-harness-version-upgrade-testing/index.md
confidence: extracted
tags: [docker, testing, tooling, migrations]
---

# Research: Testing brand-new installs and previous-version-to-new-version upgrades with the fresh-machine harness

derived_from::[[docker-fresh-machine-test-harness]]

`run.sh setup` already fully tests a brand-new install. `run.sh stale` only tests the *mechanics* of old-setup-then-current-update, never a realistically aged project — it seeds no tasks, roadmaps, or decisions into the scratch wiki before upgrading. **The harness's single fixed `OLD_REF` (`c33808d`) cannot represent "any previous version" either**: that exact commit is the one that introduces this repo's one shipped wiki migration (the `aliases:` backfill), so `stale` mode can never exercise "upgrading from before the backfill existed" — a real historical state, since this repo's own oldest task (`TASK-001`) predates that commit by five weeks.

**Recommendation, in two tiers.** Immediately usable today with zero code changes: `run.sh shell` → manually run the old release's `setup-project.sh` → hand-write 1–2 task/roadmap fixture files in the pre-backfill shape (`id:` present, `aliases:` absent) directly into the scratch dir's `wiki/work/` → run the current `update-project.sh` → verify the backfill inserted exactly `aliases: [...]` and nothing else changed (and that an already-conformant fixture is left byte-identical, proving the backfill's idempotent-skip). For repeatable, CI-eligible coverage: add `test/docker/fresh-machine/seed-fixtures/` with those same fixtures and extend `run.sh stale` to inject them automatically, asserting the diff mirrors the `idempotency` mode's snapshot-and-diff style.

See the full report — `raw/research/docker-harness-version-upgrade-testing/index.md` — for the manual step-by-step recipe and `sources.md` for citations. Extends relates_to::[[docker-fresh-machine-test-harness]]; the concrete migration this recommendation targets is relates_to::[[TASK-064]].
