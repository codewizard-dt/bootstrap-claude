---
title: Hot Cache
updated: 2026-09-13
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-09-13_

## Key Recent Facts

- **Agent-architecture/observability research ingested (2026-09-13)**: `raw/research/ai-agent-architecture-observability/{index,sources}.md` → `knowledge/sources/ai-agent-architecture-observability.md`, concepts `multi-agent-orchestration-patterns.md` + `genai-observability-standard.md`, entities `tools/claude-code-opentelemetry.md`, `components/power-mode-skill.md` + `components/now-skill.md`. Headline finding: hierarchical orchestrator+isolated-subagents (what `power-mode`/`now` already implement) is the multi-agent topology that survives production; peer/group-chat failed. **Actionable gap for this repo**: Claude Code ships built-in OpenTelemetry export (nested subagent traces, per-tool-call timing, hook spans) via `CLAUDE_CODE_ENABLE_TELEMETRY` + `OTEL_*` env vars, and nothing in this repo surfaces or documents it — directly answers the "multi-agent observability dashboard" idea already sitting unactioned below. Candidate next step: `/task-add` an optional `wiki/guides/observability.md` guide, tier-delivered like `evals-framework.md`.
- **TASK-0085 created (2026-09-13, `status: todo`)**: `wiki/work/tasks/TASK-0085-normalize-wiki-work-naming.md` — fixes bug-file's and roadmap-create's stale bare-filename instructions, adds a re-verify-before-write race guard to bug-file/decision-create/req-create, standardizes tasks/UAT/requirements/roadmaps on **4-digit zero-padded IDs going forward** (forward-only, no renames — `TASK-0001`..`TASK-0084` keep 3-digit names). This task is itself `TASK-0085`. Next: `/tackle wiki/work/tasks/TASK-0085-normalize-wiki-work-naming.md` (12 steps, ~20 files).
- **Shared-file caution**: `TASK-0085` edits `CLAUDE.md` (family-ID bullets only); `TASK-081` (in-progress, uncommitted) also edits `CLAUDE.md` for an unrelated section (deploy/CI doc removal). Re-read `CLAUDE.md` fresh before editing either.
- **`wiki/log.md` is well past the ~500-line rotation threshold (now 900+)** — `/wiki-rotate-log` is increasingly overdue.
- **Local branch remains ahead of `origin/main`** (uncommitted `TASK-081` edit, today's naming research + TASK-0085 + this ingest) — a `/git-commit` is due.

## Recent Changes

- Created (2026-09-13): `raw/research/ai-agent-architecture-observability/{index,sources}.md`; 6 wiki pages (1 source, 2 concepts, 3 entities) listed above; updated `wiki/index.md` (Sources/Concepts/Tools/Components); appended `wiki/log.md`.
- Earlier same day: `wiki/work/tasks/TASK-0085-normalize-wiki-work-naming.md` + index row; `raw/research/wiki-work-family-naming/{index,sources}.md` + `knowledge/sources/wiki-work-family-naming.md` + `knowledge/concepts/wiki-work-filename-convention.md`.
- Also earlier same day: `wiki/work/roadmaps/ROADMAP-012-sandbox-scaffolding-and-usage-visibility.md` + index row; `raw/research/claude-code-ecosystem-2026/{index,sources}.md` + related wiki pages; `wiki/work/roadmaps/ROADMAP-011-build-bootstrap-prefs-tui.md`; `raw/research/bootstrap-prefs-editor-tui/{index,sources}.md`, `raw/research/settings-editor-prior-art/{index,sources}.md`; `lib/scripts/wiki-dashboard-server.js` bind-address fix.
- Prior session (2026-09-04): ROADMAP-010 driven through TASK-078–084; several UATs passing.

## Active Threads

- **TASK-0085 (todo, just created)**: not yet tackled. Next: `/tackle wiki/work/tasks/TASK-0085-normalize-wiki-work-naming.md`.
- **ROADMAP-012 (0/3, active)**: not yet started. Next: `/roadmap-next wiki/work/roadmaps/ROADMAP-012-sandbox-scaffolding-and-usage-visibility.md`.
- **Not yet on any roadmap**: worktree isolation, a PostToolUse prompt-injection scanner, a statusline, plugin-marketplace candidate (awaits `/decision-create`). The "multi-agent observability dashboard" idea now has concrete backing research (`knowledge/concepts/genai-observability-standard.md`) — the cheap first step is documenting Claude Code's own OTel export, not building a bespoke dashboard.
- **ROADMAP-011 (0/4, active)**: not yet started. Next: `/roadmap-next wiki/work/roadmaps/ROADMAP-011-build-bootstrap-prefs-tui.md`.
- **ROADMAP-010 (in progress)**: TASK-078/079/080/082 done; TASK-081 modified-but-uncommitted. TASK-083/084 depend on it and TASK-078.
- **ROADMAP-009 (7/7, still `active`)**: closure is a ROADMAP-010 Phase 3 item (TASK-083), not automatic.
- **ROADMAP-001 (11/12, active)**: sole remaining item deliberately deferred, no action needed.
- **TASK-031 (todo)** — narrower `/sandbox` settings.json-hardening task, distinct from ROADMAP-012 Phase 1.
- **TASK-074 (todo)**, **TASK-067 (pending-uat)**, **TASK-039 (pending-uat)**, **BUG-0001–0008 (open, older, unrelated)**.
- **`wiki/log.md` rotation overdue** — run `/wiki-rotate-log`.
