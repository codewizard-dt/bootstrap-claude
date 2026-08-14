---
title: Hot Cache
updated: 2026-08-14
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-14_

## Key Recent Facts

- **All three open bugs from this session are now fixed, verified, and archived: [[BUG-0009]], [[BUG-0010]], [[BUG-0011]].** Only [[BUG-0001]] through [[BUG-0008]] remain open (older hook-guard findings, unrelated to this session's work).
- **BUG-0009** (`--set` didn't enforce scope) and **BUG-0010** (two message-only defects in `install-global.sh`) fixed together, commit `9722eb8`. BUG-0009: `--set` now refuses writing a key into a layer its `scope` forbids (exit 1, `--target` stays exempt); two test fixtures rewritten to use `--target` instead of relying on the old permissive behavior; a self-aware tripwire test that asked to be deleted once fixed was removed. BUG-0010: the `ask` confirmation no longer reads as "nothing was stored" (it is, as the settled `ask` state); the completion summary no longer claims `+ MCPs` under `--skip-mcps` (the path both `setup`/`update` always use).
- **ROADMAP-006 "Automate Obsidian + Plugin Setup" is COMPLETE (7/7), archived.** BUG-0011 (`manifest.json` never copied into installed plugin dirs) fixed, commit `e71ded6` — was the roadmap's last blocker.
- **Suite: 341/341 pass, 0 fail.** Clean after all three bug fixes.
- **Commits this session**: `e71ded6` (BUG-0011), `9722eb8` (BUG-0009 + BUG-0010). Everything else — ROADMAP-006's other 6 tasks/UATs, both Obsidian research reports/ingests, `research.autoIngest`, the Serena-scope research/ingest — is still uncommitted working-tree state.
- **ROADMAP-001 (11/12, active)** — wiki tooling improvements; Phase 4 advisory locking deliberately deferred, no urgency.

## Recent Changes

- Fixed + committed (2026-08-14, `9722eb8`): BUG-0009 (`lib/scripts/bootstrap-prefs.js` scope enforcement) and BUG-0010 (`lib/scripts/install-global.sh` message accuracy), plus `bootstrap-config/SKILL.md`, `lib/scripts/README.md`, and 3 test files.
- Verified + archived (2026-08-14): BUG-0009, BUG-0010 → `bugs/archive/`.
- (Earlier this session) Fixed + committed (`e71ded6`): BUG-0011. ROADMAP-006 completed and archived.

## Active Threads

- **Nothing blocking.** All three bugs found during ROADMAP-006's work are closed; the roadmap itself is done.
- **Small doc cleanup still pending**: `raw/guides/dataview-queries.md` + `wiki/guides/dataview-queries.md`'s "Once TASK-053 lands..." conditional phrasing — TASK-053 has been closed for a while now, safe to clean up whenever convenient.
- **Large amount of uncommitted work has accumulated** across this session and a concurrent one (ROADMAP-006's other tasks, two research ingests, `research.autoIngest`). Consider `/git-commit` (with its version-bump flow) when ready to package it — separate from the three ad-hoc bug-fix commits already made.
- **ROADMAP-001 (11/12, active)** — Phase 4 advisory locking deliberately deferred, no urgency.
- **TASK-031 (todo)** — Tier 3 `/sandbox`; note `install-global.sh` + `merge-settings-hooks.js` are TWO settings-writing scripts the measurement must account for.
- **TASK-039 (pending-uat)** — hook inline comments; implementation done, needs `/uat-walk` or `/uat-auto`, not `/tackle`.
- **BUG-0001 through BUG-0008 (open, older, unrelated)** — hook-guard findings from an earlier audit, not touched this session.
