---
title: Hot Cache
updated: 2026-08-29
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-29_

## Key Recent Facts

- **TASK-075 and TASK-076 both closed and committed** (`10aae2f`, `[minor]`, `package.json` 3.2.0→3.3.0): `packageInstall.consent` preference with real `allow`/`defer` hook decisions, a `run.sh live-hook` Docker verification mode, and a `bootstrap-prefs.js --project` repo-root-resolution fix (was resolving relative to cwd, missing the real prefs file from a subdirectory). TASK-076/UAT-078 archived same day after a real, human-verified live run (token stored in macOS Keychain as `claude-code-oauth-token-live-hook`).
- **UAT automation reassessment (2026-08-27)**: re-examined all 5 remaining Manual cases across ROADMAP-009's UATs. Two were promoted to real live-command evidence and run for real: UAT-060's EDGE-010 (passed) and UAT-072's EDGE-003 (passed — **closed TASK-072/UAT-072 entirely**, archived, ROADMAP-009 checkbox flipped). Three stay Manual: UAT-073's EDGE-006 (needs actual GitHub Actions infra, permanent), and UAT-060's EDGE-011 + UAT-071's EDGE-004 (both blocked on the same root cause — `run.sh setup`/`update`/`stale` have no PASS/FAIL line the way `idempotency` mode does, so a bare exit code can't tell an expected failure from a regression).
- **TASK-077 created** (`status: todo`) to fix exactly that: adds `idempotency`-style PASS/FAIL lines to `setup`/`update`/`stale`, AND fixes `update` mode's `&&` short-circuit (per explicit user decision) so `update-project.sh` finally runs instead of never executing — then promotes UAT-060's EDGE-011 and UAT-071's EDGE-004 to live-command as part of the same task.
- **ROADMAP-009 now 4/7 checked** (was 3/7) — TASK-060, TASK-071, TASK-073 still `pending-uat`, each needing either a human `/uat-walk` or TASK-077's fix to close automatically.
- **`/roadmap-assess` run (2026-08-27)**: ranked ROADMAP-009 above ROADMAP-001 (11/12, only a deliberately-deferred locking item remains) — no cross-roadmap dependencies found.
- **TASK-074 (Serena `--project-from-cwd`)** still `status: todo`, untouched.
- **TASK-067 (`.obsidian/graph.json` per-key refresh)** still `pending-uat`.
- **New research, not yet a task**: `docker-harness-version-upgrade-testing` — `run.sh stale`'s fixed `OLD_REF` (`c33808d`) is the exact commit introducing the only migration this repo ships, so it can't test upgrading a pre-migration wiki; a manual `run.sh shell` recipe exists today, a `seed-fixtures/` extension is recommended.
- **`wiki/log.md` is well past the ~500-line rotation threshold** — `/wiki-rotate-log` is overdue.

## Recent Changes

- Created (2026-08-29): `wiki/work/tasks/TASK-077-docker-harness-pass-fail-lines.md`.
- Committed (2026-08-27, `10aae2f`): TASK-075 + TASK-076 implementations/tests/docs, `bootstrap-prefs.js` fix, 3 research reports. `package.json` 3.2.0→3.3.0.
- Archived (2026-08-27): TASK-076/UAT-078 (done/passed), TASK-072/UAT-072 (done/passed).
- Modified (2026-08-27, post-commit, uncommitted): `wiki/work/uat/UAT-060-...md` (EDGE-010 promoted+passed, Gaps note), `wiki/work/uat/UAT-071-...md` (Gaps note on EDGE-004), `wiki/work/uat/UAT-073-...md` (Gaps note on EDGE-006), `wiki/work/roadmaps/ROADMAP-009-...md` (TASK-072 checked).
- Local branch remains ahead of `origin/main` (not pushed — `gitCommit.autoPush=false`).

## Active Threads

- **TASK-077 (todo, new)**: `/tackle wiki/work/tasks/TASK-077-docker-harness-pass-fail-lines.md` — will make UAT-060/UAT-071's remaining Manual cases automatable.
- **ROADMAP-009 (4/7, active)**: TASK-060, TASK-071, TASK-073 still need either `/uat-walk` or TASK-077 to close.
- **ROADMAP-001 (11/12, active)**: sole remaining item deliberately deferred, no action needed.
- **TASK-074 (todo)**, **TASK-067 (pending-uat)**, **TASK-031 (todo)**, **TASK-039 (pending-uat)**, **BUG-0001–0008 (open, older, unrelated)**.
- **Uncommitted since `10aae2f`**: the 2026-08-27 UAT reassessment edits + archives above — a `/git-commit` is due.
- **`wiki/log.md` rotation overdue** — run `/wiki-rotate-log`.
- **Latent `bin/cli.js` bug flagged, not fixed**: `setup`/`update` ignore extra CLI args, always target `.`.
