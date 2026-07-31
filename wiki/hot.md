---
title: Hot Cache
updated: 2026-07-31
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-07-31_

## Key Recent Facts

- **ROADMAP-004 filed (2026-07-31): resilient hook install.** Investigation of a new-machine "hooks missing" report found `update` *does* rsync `lib/hooks/` → `~/.claude/hooks/`, but two defects break the flow: (1) `install-mcps.sh` runs *before* the hook install in both `lib.sh:run_project_sync` and `install-global.sh`, unguarded under `set -euo pipefail` — one npm/`claude mcp add` failure aborts before hooks ever copy; (2) settings.json hook **registration** is a manual README paste — nothing ever writes the `hooks` key, so new machines and newly added hooks get scripts on disk that silently never run. Fix plan approved at `~/.claude/plans/ok-now-parallel-cerf.md`: local steps first + MCP warn-and-continue, plus a `settings-hooks.json` template merged by a new `merge-settings-hooks.js` with **"template owns its blocks"** semantics (repo blocks updated in place, user blocks never touched).
- **Releases 2.15.0 and 2.16.0 shipped** — interpreter guard now re-evaluates `bash -c` payloads against sibling guards + deny list (not blanket deny); fileSuggestion @-autocomplete restored with fuzzy matching; settings-guard carve-out removed (**unconditional** block on `~/.claude/settings*.json` via file tools — the carve-out was a self-permission hole). Suite 108/108.
- **Deny rules, ask rules, PreToolUse hooks, and the sandbox are all enforced under `bypassPermissions`** — only `permissions.allow` goes inert. Deny matches a spelling, not a capability; `Write(...)` path rules are never consulted.
- **This machine is fully wired** — 18 hook scripts installed, `~/.claude/settings.json` carries the full hooks key (10 PreToolUse blocks) and 117 deny entries.

## Recent Changes

- Created: `work/roadmaps/ROADMAP-004-resilient-hook-install.md` (active, 3 phases / 7 inline items); roadmap index row; log entry.
- Updated: `wiki/work/roadmaps/index.md`, `wiki/log.md`.
- Previously (2026-07-30): TASK-030 (user preferences) and TASK-031 (Tier 3 `/sandbox`) filed; UAT-028 + UAT-029 passed and archived with TASK-028/029.

## Active Threads

- **ROADMAP-004 (active, 0/7)** — next: `/roadmap-next` to create Phase 1 task files (settings-hooks.json template → merge-settings-hooks.js → test/settings-hooks.test.js). Phase 2 (install-flow reorder) depends on Phase 1's merge script existing.
- **TASK-030 (todo)** — two-level preference store (global + git-excluded per-project), prompted during skill sync; open design decision on extending the sentinel block's canonical form.
- **TASK-031 (todo)** — Tier 3: adopt `/sandbox` to close the script-file write path to settings.json no hook can parse; measure breakage first (note: `install-global.sh` writes `~/.claude/` by design — ROADMAP-004's merge script adds another such writer).
- **ROADMAP-001 (11/12)** — Phase 4 advisory locking deliberately deferred.
- **Research reports awaiting ingest**: `raw/research/mcp-one-process-per-user/`, `brave-mcp-single-docker-container/`, `mcp-scope-conflict-handling/`, `mcp-add-scope-writes/`.
