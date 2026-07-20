---
title: Hot Cache
updated: 2026-07-07
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-07-07_

## Key Recent Facts
- **Found and live-reproduced a real bug in the Serena health-tracking hook** (`lib/hooks/lib/serena.js` + `serena-usage-tracker.js`, added 2026-07-06 in `5752eed`): it `pkill`s a live, healthy Serena process whenever a tool call returns an error its classifier doesn't recognize (defaults unknown errors to `'transport'`, then treats "alive but erroring" as "hung"). A responded error actually proves the process is alive — see [Responded Error Proves Liveness](knowledge/concepts/responded-error-proves-liveness.md). Not yet patched.
- **A second, compounding bug**: the hook's per-project state file is read-modified-written with no locking; concurrent Serena calls can race and leave `should_enforce: true` even after the process is confirmed dead, hard-blocking the Read/Bash fallback too. Both bugs reproduced live via `ps aux` and the corrupted state file — see [Serena Health-Tracking Hook](knowledge/entities/components/serena-health-tracking-hook.md) and the full report at [knowledge/sources/serena-mcp-disconnect.md](knowledge/sources/serena-mcp-disconnect.md).
- **Root trigger for this repo specifically**: `.serena/project.yml` doesn't enable `typescript`, so navigating this repo's own `lib/hooks/*.js` / `lib/scripts/*.js` / `bin/cli.js` guarantees the "cannot extract symbols" error that sets off the bug — explaining why the disconnect happens "almost every session."
- **Contradiction flagged**: [Wiki Multi-Writer Safety](knowledge/concepts/wiki-multi-writer-safety.md) had cited this exact hook's fail-open design as the pattern to imitate for wiki-file locking. That citation is now stale — the hook has the very race condition (plus a worse kill bug) the concept page warns about. Page is now `confidence: ambiguous` pending a fix.
- No fix has been applied to the codebase yet — recommended fixes are documented in the research report and the component entity page; two `/task-add` candidates were suggested (general hook-logic fix; add `typescript` to `.serena/project.yml`) but not yet filed as of this writing.
- **ROADMAP-001 (wiki tooling improvements) and ROADMAP-002 (wiki-work dashboard)** are both complete/archived (carried forward from last session — see their archive entries if needed). TASK-018 (dark-mode toggle) and TASK-019 (parse archive table rows) remain active follow-ups, unrelated to the Serena finding.

## Recent Changes
- Created: `raw/research/serena-mcp-disconnect/index.md` + `sources.md` (the research report and primary-source register, including live process-list and state-file evidence).
- Created: `wiki/knowledge/sources/serena-mcp-disconnect.md`, `wiki/knowledge/concepts/responded-error-proves-liveness.md`, `wiki/knowledge/entities/components/serena-health-tracking-hook.md` (first entry in `entities/components/`).
- Updated: `wiki/knowledge/concepts/wiki-multi-writer-safety.md` (contradiction callout + `confidence: ambiguous`), `wiki/index.md` (Sources/Concepts/Components sections), `wiki/log.md`.
- Flagged: the hook bug itself is unpatched — treat any Serena disconnect in a fresh session on this or any project as this known issue, not a new one, until fixed.

## Active Threads
- **Serena health-tracking hook fix is not yet filed as a task.** Next natural step: `/task-add` for (1) the general hook-logic fix in `lib/hooks/lib/serena.js` / `serena-usage-tracker.js` (stop killing on a responded error, flip the unknown-failure default, atomicize state-file writes) and (2) adding `typescript` to this repo's `.serena/project.yml`.
- ROADMAP-001: Phase 4 (advisory locking for wiki index files) remains an intentional deferred placeholder — the Serena hook's own race is now a second concrete data point in favor of eventually doing it, on top of the earlier TASK-018/TASK-019 collision incident.
- TASK-018 (dashboard dark-mode toggle) and TASK-019 (parse archive `index.md` table rows) both edit `dashboard.html` — avoid running them in the same concurrent `/tackle` wave.
