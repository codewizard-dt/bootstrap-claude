---
title: Hot Cache
updated: 2026-08-24
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-24_

## Key Recent Facts

- **Serena MCP reconnected 2026-08-24** after being down the entire 2026-08-22 session — back to normal symbolic tool use.
- **TASK-074 created**: switch all Serena registration sites (`install-mcps.sh`'s live `claude mcp add` call, `bootstrap-serena.sh`'s manual-fallback message, `CLAUDE.md`'s docs) from a fixed `--project "$PROJECT_DIR"` to `--project-from-cwd`, so registration follows git worktrees instead of baking in a stale path. First step is a verification gate confirming the flag actually exists before any code changes. `status: todo`, no dependencies, filed directly per user request (not yet implemented).
- **`/git-commit`'s Step 2 (new this session) is mid-run**: added a "Condense Verbose Inline Comments" step to `lib/skills/git-commit/SKILL.md` (scans this commit's diff-only added/modified lines, excludes JSDoc/docstrings and repo-documented exceptions like `lib/hooks/`) and applied it across this session's own diff — `lib/scripts/install-obsidian.sh`, `test/install-obsidian.test.js`, `test/docker/fresh-machine/{Dockerfile,run.sh}`, `test/docker-fresh-machine.test.js` all had multi-line rationale comments condensed to single lines. `/git-commit`'s own Step 3+ (assess/summarize/bump/commit) has not run yet — re-run `npm test` and continue the commit flow next.
- **`/power-mode` ran ROADMAP-009 (Docker fresh-machine harness) to its autonomous ceiling: 3/7 done, 4/7 implemented+tested but pending one human Manual UAT case each.** Phase 1 (Research — TASK-068/069/070) fully done via `/uat-skip` (pure decisions, no code). Phase 2/3 (TASK-060 fresh-machine harness, TASK-071 `run.sh stale` mode, TASK-072 idempotency check, TASK-073 GitHub Actions CI) are all **implementation-complete, real `docker build`/`run`-verified, and UAT-generated** — each has exactly one Manual UAT case requiring a live Docker daemon or GitHub Actions runner that headless `/uat-auto` correctly fail-closes (not a defect). Full suite: **415/415 passing**. Next action for each: `/uat-walk` on UAT-060 (2 manual cases), UAT-071, UAT-072, UAT-073 (1 each) — walking those will trigger normal closure (task done, archive, roadmap checkoff) and the roadmap auto-archives once all 7 are checked.
- **Two real bugs found only by actually building/running Docker, not caught by static review**: (1) Homebrew's installer needs root to create `/home/linuxbrew`, but the non-root `tester` user had no `sudo` — fixed with `sudo` + NOPASSWD sudoers entry. (2) `install-global.sh`'s hooks-rsync step needs `rsync`, missing from the apt package list — added. Both in `test/docker/fresh-machine/Dockerfile`.
- **Known, documented limitation (not a defect) discovered by this work**: on this repo's fully non-interactive, decline-only path, both `setup-project.sh` and `update-project.sh` currently exit 1 at the Serena `project.yml` bootstrap step (Serena is never registered without an interactive accept). `run.sh stale`/`idempotency` modes now tolerate this expected failure and proceed past it to their real assertions. Exercising an actual accept path (`run.sh accept`, pre-seeded `bootstrap-prefs.js`) remains a real, not-yet-built follow-on — TASK-070 already specified its design (2 project-scope keys, `bootstrap-prefs.js --set`).
- **Orchestration note**: two `/tackle` agents died mid-run this session (once for TASK-060) leaving orphaned background children untracked by `ListAgents` — found only by direct `TaskStop` attempts surfacing the orphan's name, then stopped and the task retried fresh as a named agent. Worth a glance if a future `/power-mode`/`/tackle` run seems to silently stall.
- **Two doc/data-quality fixes applied mid-run**: (1) 3 hand-authored `/uat-skip` skeleton files (UAT-074/075/076) were missing `aliases:` frontmatter, breaking `test/work-item-aliases.test.js` — fixed. (2) `test/docker/fresh-machine/README.md`'s "Out of scope for v1" section wrongly implied `setup`/`update` "still complete" when MCP is skipped — corrected to separately call out the real Serena-bootstrap failure.
- **TASK-067 (`.obsidian/graph.json` per-key refresh) still `pending-uat`, untouched this session.** Next action: `/uat-walk wiki/work/uat/UAT-067-graph-json-per-key-refresh.md`.
- **Serena MCP disconnected all session** (since 2026-08-22 mid-session) — every agent this session fell back to Read/Write/Edit/Bash (with a `python3 -c "print(open(...).read())"` workaround for the `serena-first-read-guard.js` hook). Re-check connection status at the start of the next session.
- **`wiki/log.md` is now 780+ lines**, well past the ~500-line rotation threshold — `/wiki-rotate-log` is overdue.

## Recent Changes

- Created (2026-08-22): `test/docker/fresh-machine/{Dockerfile,run.sh,README.md}`, `.github/workflows/docker-harness.yml`, `test/docker-fresh-machine.test.js`; TASK-068–073 (3 archived done, 4 pending-uat); UAT-060, UAT-071, UAT-072, UAT-073 (all pending, 1 manual case each), UAT-074/075/076 (archived, skipped).
- Modified (2026-08-22): `wiki/work/roadmaps/ROADMAP-009-...md` (3/7 checked), `lib/scripts/README.md` (docker-harness pointer row), `wiki/work/tasks/TASK-060-...md` (resolved-decisions note inlined).
- Created (2026-08-21, still pending-uat): `wiki/work/tasks/TASK-067-...md`, `wiki/work/uat/UAT-067-...md`.
- Uncommitted since 2026-08-20: everything above — see `git status` for the exact set.

## Active Threads

- **ROADMAP-009 (3/7, active)**: 4 tasks awaiting human `/uat-walk` for one Manual case each — `/uat-walk wiki/work/uat/UAT-060-docker-fresh-machine-harness.md` (2 cases), `UAT-071-...`, `UAT-072-...`, `UAT-073-...` (1 case each). Roadmap auto-archives once all walked and passed.
- **TASK-067 (pending-uat)**: `/uat-walk wiki/work/uat/UAT-067-graph-json-per-key-refresh.md`.
- **TASK-074 (todo, new)**: `/tackle wiki/work/tasks/TASK-074-serena-project-from-cwd.md` — verify `--project-from-cwd` is real before touching install-mcps.sh/bootstrap-serena.sh/CLAUDE.md.
- **`/git-commit` run in progress, paused mid-flow**: Step 2 (comment condensing) done; resume at Step 3 (assess changes) for the large uncommitted changeset from this session (ROADMAP-009 work + TASK-067 + the git-commit skill edit itself).
- **ROADMAP-001 (11/12, active)**, **TASK-031 (todo)**, **TASK-039 (pending-uat)**, **BUG-0001–0008 (open, older, unrelated)**.
- **`wiki/log.md` rotation overdue** (~780 lines) — run `/wiki-rotate-log`.
- **Real follow-on surfaced by this work**: build a `run.sh accept` mode (TASK-070's design already specifies it) to actually exercise the accept-branch/Serena-registered path — not yet a filed task.
- Carried forward, unconfirmed: **Unresolved `update`-specific bug on a different machine** — re-check before treating as active.
- **Optional doc fix flagged**: `README.md` line 247 stale re: Serena scope.
- **Latent `bin/cli.js` bug flagged, not fixed**: `setup`/`update` commands silently ignore extra CLI args and always target `.` (TASK-068 chose to route around it rather than fix it).
