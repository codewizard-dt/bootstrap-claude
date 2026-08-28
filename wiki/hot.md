---
title: Hot Cache
updated: 2026-08-27
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-27_

## Key Recent Facts

- **TASK-076 (Docker harness `live-hook` mode) is fully implemented, `status: pending-uat`, UAT-078 4/5 passed.** `run.sh live-hook` added (token-gated on `CLAUDE_CODE_OAUTH_TOKEN`, installs hooks for real inside the container, seeds `packageInstall.consent=true`, runs a real non-bypassed `claude -p "npm install left-pad"`). 4 EDGE cases pass (unit-backed, `test/docker-fresh-machine.test.js`, 29/29 green). **UAT-MANUAL-001 was actually run live** (real `claude setup-token` token, real Docker) and produced the exact expected PASS line — genuine end-to-end evidence that Claude Code's real permission pipeline honors this hook's `allow` decision. Awaiting the human's explicit Pass verdict in `/uat-walk` to close it out (mid-walkthrough when this cache was written).
- **This closes the real, live half of TASK-075's own `UAT-MANUAL-001`** (`wiki/work/uat/UAT-077-package-install-consent-preference.md`) — once UAT-078's verdict is recorded, UAT-077's own Manual case should be revisited with this as evidence.
- **The `CLAUDE_CODE_OAUTH_TOKEN` is stored in macOS Keychain** under service name `claude-code-oauth-token-live-hook` (documented in `test/docker/fresh-machine/README.md` and `wiki/knowledge/entities/tools/claude-code-authentication.md`) — retrieved on demand via `security find-generic-password`, never left in a shell profile.
- **New research: `docker-harness-version-upgrade-testing`** (`wiki/knowledge/sources/docker-harness-version-upgrade-testing.md`) — `run.sh setup` fully tests fresh installs, but `run.sh stale` seeds no tasks/roadmaps and its fixed `OLD_REF` (`c33808d`) is the exact commit that introduces the only migration this repo ships (`aliases:` backfill), so it can't test upgrading a pre-migration wiki. Gave a manual `run.sh shell` recipe (usable today) plus a recommended `seed-fixtures/` extension. Not yet filed as a task.
- **`/git-commit` skill work (comment-condensing, `gitCommit.lint`, worktree-safe cd) committed in `4ad522c`/`a7dd0eb`** (`package.json` 3.0.1→3.2.0). TASK-075 + TASK-076 implementations, tests, research, and UAT files are all uncommitted since — a `/git-commit` is due.
- **TASK-074 (Serena `--project-from-cwd`)** still `status: todo`, untouched.
- **TASK-067 (`.obsidian/graph.json` per-key refresh)** still `pending-uat`.
- **ROADMAP-009 (Docker harness) still 3/7 checked** — TASK-060 (2 cases), TASK-071/072/073 (1 each) await a human `/uat-walk` for their one remaining Manual case; TASK-076 is a new, unlinked addition to this same harness (not yet added to the roadmap).
- **`wiki/log.md` is well past the ~500-line rotation threshold** — `/wiki-rotate-log` is overdue.

## Recent Changes

- Created (2026-08-27): `wiki/work/tasks/TASK-076-docker-harness-live-hook-mode.md`, `wiki/work/uat/UAT-078-docker-harness-live-hook-mode.md`, `raw/research/docker-harness-version-upgrade-testing/{index.md,sources.md}`, `wiki/knowledge/sources/docker-harness-version-upgrade-testing.md`.
- Modified (2026-08-27): `test/docker/fresh-machine/run.sh` (+`live-hook` mode), `test/docker-fresh-machine.test.js` (+3 tests, 1 fixed), `test/docker/fresh-machine/README.md` (+Live-hook section, +Keychain storage), `wiki/knowledge/entities/tools/claude-code-authentication.md` (+Keychain storage section), `wiki/knowledge/sources/docker-fresh-machine-test-harness.md` (+Follow-up note), `wiki/work/tasks/index.md`, `wiki/work/uat/index.md`, `wiki/index.md`.
- Local branch remains ahead of `origin/main` (not pushed — `gitCommit.autoPush=false`).

## Active Threads

- **UAT-078 (in-progress)**: awaiting the human's Pass/Fail verdict on UAT-MANUAL-001 mid-`/uat-walk` — the live run already succeeded, just needs recording.
- **New research not yet a task**: `/task-add` the `seed-fixtures/` extension from `raw/research/docker-harness-version-upgrade-testing/index.md`'s Next Steps.
- **TASK-075 (pending-uat)**: its own `UAT-MANUAL-001` should be revisited once UAT-078 closes, using TASK-076's evidence.
- **ROADMAP-009 (3/7, active)**: `/uat-walk` on UAT-060 (2 cases), UAT-071, UAT-072, UAT-073 (1 each).
- **TASK-074 (todo)**, **TASK-067 (pending-uat)**, **ROADMAP-001 (11/12, active)**, **TASK-031 (todo)**, **TASK-039 (pending-uat)**, **BUG-0001–0008 (open, older, unrelated)**.
- **`wiki/log.md` rotation overdue** — run `/wiki-rotate-log`.
- **Latent `bin/cli.js` bug flagged, not fixed**: `setup`/`update` ignore extra CLI args, always target `.`.
