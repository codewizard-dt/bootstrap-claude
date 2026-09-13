---
title: Hot Cache
updated: 2026-09-04
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-09-04_

## Key Recent Facts

- **ROADMAP-009 driven to 7/7 via three live `/uat-walk` runs (2026-09-03)**: TASK-077/UAT-079 (4 unit-backed EDGE cases, all passed), TASK-060/UAT-060 (EDGE-011 re-verified live against the cached `bootstrap-claude-fresh-machine` image — `run.sh setup`/`update` both print their new PASS lines, `update-project.sh` now genuinely runs independently), TASK-071/UAT-071 (EDGE-004 re-verified live — `run.sh stale` seeds the old release via `git archive`, tolerates its expected failure, then the current checkout's `update-project.sh` runs its own migration and prints `stale: PASS`). All three tasks + UATs archived same day.
- **User decision reverses the whole initiative (2026-09-04)**: after closing ROADMAP-009, the user questioned why the Docker harness had GitHub Actions CI at all ("the docker container is meant to run locally"), then decided the harness itself ("a fun idea but too much hassle") should be removed entirely — not just its CI wiring.
- **ROADMAP-010 created (`status: active`, 0/7 checked)**: `wiki/work/roadmaps/ROADMAP-010-remove-docker-harness-github-actions.md`. Scope, confirmed via extended Socratic Q&A: (1) delete the Docker harness (`test/docker/fresh-machine/`, `test/docker-fresh-machine.test.js`) and all GitHub Actions (`docker-harness.yml`, `security.yml`, root `.gitleaks.toml`); (2) remove/deprecate the `/bootstrap deploy` product feature (`setup-deployment.sh`, its prompt template, `bin/cli.js` wiring, `raw/guides/deployment-strategy.md`, every doc reference); (3) trash TASK-073/UAT-073 (the only still-open CI-referencing work items), close ROADMAP-009 with an explicit "reverted, not completed as designed" Notes callout, and mark `wiki/knowledge/sources/docker-fresh-machine-test-harness.md` retired. **Not yet executed** — file created and indexed only.
- **Archived task/UAT records for the harness are staying untouched** (TASK-060/069/071/072/077 + UATs) — explicit decision: they're historical fact, not current state; ROADMAP-010 does not retroactively edit them.
- **`wiki/log.md` is well past the ~500-line rotation threshold** — `/wiki-rotate-log` is still overdue.

## Recent Changes

- Created (2026-09-04): `wiki/work/roadmaps/ROADMAP-010-remove-docker-harness-github-actions.md`; added its row to `wiki/work/roadmaps/index.md`.
- Archived (2026-09-03): TASK-077/UAT-079, TASK-060/UAT-060, TASK-071/UAT-071 (all `done`/`passed`) — `wiki/work/{tasks,uat}/archive/`, both archive indexes updated, ROADMAP-009 checkboxes flipped to 7/7.
- Fixed mid-session (2026-09-03): an Edit line-removal bug had merged adjacent rows in `wiki/work/uat/index.md` and `wiki/work/tasks/index.md` onto single lines (no data loss, missing newlines only) — restored proper line breaks in both.
- Local branch remains ahead of `origin/main` (uncommitted) — a `/git-commit` is due once ROADMAP-010's work lands.

## Active Threads

- **ROADMAP-010 (0/7, active, just created)**: not yet started. Phase 1 removes the harness + all GitHub Actions, Phase 2 removes the `/bootstrap deploy` feature, Phase 3 closes TASK-073/UAT-073/ROADMAP-009 and retires the harness's wiki knowledge page. Next: `/roadmap-next wiki/work/roadmaps/ROADMAP-010-remove-docker-harness-github-actions.md`.
- **ROADMAP-009 (7/7, still `active` — not yet flipped to `done`)**: closure is itself a ROADMAP-010 Phase 3 item (with the reverted-not-completed Notes callout), not done automatically by UAT closure this time.
- **TASK-073 / UAT-073 (open)**: to be trashed via `/task-trash`, not completed — per ROADMAP-010 Phase 3.
- **ROADMAP-001 (11/12, active)**: sole remaining item deliberately deferred, no action needed.
- **TASK-074 (todo)**, **TASK-067 (pending-uat)**, **TASK-031 (todo)**, **TASK-039 (pending-uat)**, **BUG-0001–0008 (open, older, unrelated)**.
- **`wiki/log.md` rotation overdue** — run `/wiki-rotate-log`.
- **Latent `bin/cli.js` bug flagged, not fixed**: `setup`/`update` ignore extra CLI args, always target `.` (moot for `deploy` once ROADMAP-010 Phase 2 removes it).
