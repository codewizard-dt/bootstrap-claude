---
title: Hot Cache
updated: 2026-08-15
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-15_

## Key Recent Facts

- **Yes — each concurrent Claude Code session spawns its own Serena process.** Ingested previously-un-filed research: stdio is spec-defined as 1-client:1-subprocess, no in-protocol multiplexing, no Claude Code daemon shares processes across sessions (confirmed by two open/unimplemented GitHub feature requests, #28860 and #40220) — applies regardless of registration scope. Three windows open = three independent `uvx ... serena` processes. The only escape (used for brave-search/Playwright) is registering over HTTP against one shared long-lived process instead of stdio; Serena doesn't offer that today. See [[mcp-one-process-per-user]] and [[mcp-stdio-one-process-per-session]].
- **MCP scope has no performance difference** — confirmed against official Claude Code docs, then independently cross-checked twice: subprocess spawning, reconnection, idle timeout, discovery cache, and `alwaysLoad` startup blocking are all keyed to **transport type**/per-server flags (stdio vs HTTP), never to scope (local/project/user). Real differences are precedence (local > project > user, strict override not merge), and trust: project-scope `.mcp.json` servers skip their approval prompt entirely in headless/`-p`/Agent SDK/cloud sessions, and a freshly cloned repo can't self-approve its own `.mcp.json` servers via committed settings until each teammate accepts workspace trust (v2.1.196+). Surfaced a **contradiction**: docs describe `${CLAUDE_PROJECT_DIR:-.}` expansion in `.mcp.json`, conflicting with prior research's "no path-portability mechanism exists" claim — `serena-mcp-scope.md` now `confidence: ambiguous`, unverified against Serena's actual `--project` flag. Also surfaced and independently re-verified a **live, unfixed security bug**: `claude mcp add`, run against a `.mcp.json` already containing `${VAR}` placeholder secrets, hardcodes the literal secret value into the file (GitHub #18692, closed "not planned") — see new concept page [[mcp-add-secret-hardcoding-bug]]. See [[mcp-scope-performance-behavior]].
- **ROADMAP-007 (active, 1/2)** — Obsidian Graph View Defaults & Dataview Query Examples. Phase 2 already satisfied (see `raw/guides/dataview-queries.md`), checked off without a task. **Phase 1 → TASK-061** (`wiki/work/tasks/TASK-061-obsidian-graph-json-defaults.md`, `todo`): ship `lib/scripts/templates/obsidian/graph.json` into `install-obsidian.sh` — two complementary `colorGroups` families, write-if-absent, gated by `obsidian.graphDefaults`. `parallel_safe_with: [TASK-031, TASK-039, TASK-060]`. Ready for `/tackle`.
- **Currently mid-`/power-mode ROADMAP-007`** — orchestrating this roadmap to completion via tackle → uat-generate → uat-auto. Next step: tackle TASK-061 (only remaining implementation item).
- **TASK-060 created**: Docker fresh-machine test harness for `setup`/`update` (`wiki/work/tasks/TASK-060-docker-fresh-machine-harness.md`, status `todo`). No implementation yet.
- **All three open bugs from two sessions ago are fixed, verified, and archived: [[BUG-0009]], [[BUG-0010]], [[BUG-0011]].** Only [[BUG-0001]] through [[BUG-0008]] remain open (older hook-guard findings, unrelated).
- **Suite: 341/341 pass, 0 fail** as of the last verified run (before TASK-061 — no code changed yet, only new task/roadmap files and this research ingest).
- **ROADMAP-001 (11/12, active)** — wiki tooling improvements; Phase 4 advisory locking deliberately deferred, no urgency.

## Recent Changes

- Created (2026-08-15): `raw/research/mcp-scope-performance-behavior/` (`index.md`, `sources.md`, then addendum `index-2.md`/`sources-2.md` from a late-returning parallel research pass); `wiki/knowledge/sources/mcp-scope-performance-behavior.md`; new concept page `wiki/knowledge/concepts/mcp-add-secret-hardcoding-bug.md`. Updated `wiki/knowledge/concepts/mcp-server-scope-model.md` (twice), `wiki/knowledge/sources/serena-mcp-scope.md` (contradiction callout, `confidence: ambiguous`), `wiki/knowledge/entities/tools/serena.md`, `wiki/index.md` (twice), `wiki/log.md` (twice).
- Created (2026-08-15): `wiki/work/tasks/TASK-061-obsidian-graph-json-defaults.md`. Updated `wiki/work/tasks/index.md`, `wiki/work/roadmaps/ROADMAP-007-obsidian-graph-view-defaults.md` (Phase 1 upgraded to task-link, Phase 2 checked off with explanatory Note), `wiki/work/roadmaps/index.md`.
- Created (2026-08-15): TASK-060 — Docker fresh-machine test harness. No implementation yet.
- Created (2026-08-15): `wiki/knowledge/sources/mcp-one-process-per-user.md`, `wiki/knowledge/concepts/mcp-stdio-one-process-per-session.md` (from a `/wiki-query` fallback ingest of the previously un-filed `raw/research/mcp-one-process-per-user/`). Updated `wiki/knowledge/concepts/mcp-server-scope-model.md`, `wiki/knowledge/sources/mcp-scope-performance-behavior.md`, `wiki/knowledge/entities/tools/serena.md` (resolved "if filed" hedges into real links), `wiki/index.md`, `wiki/log.md`.

## Active Threads

- **TASK-061 (todo)** — next up in the active `/power-mode ROADMAP-007` run: `/tackle wiki/work/tasks/TASK-061-obsidian-graph-json-defaults.md`, then `/uat-generate` + `/uat-auto`. This is the only remaining item in ROADMAP-007.
- **TASK-060 (todo)** — Docker fresh-machine harness, ready for `/tackle`. No dependencies; `parallel_safe_with: [TASK-031, TASK-039, TASK-061]`.
- **Unresolved `update`-specific bug under active investigation**: the user stepped away to re-test a `prompt_yn`/interactive-read issue on `update-project.sh` on a different physical machine. Not yet filed as a formal BUG. TASK-060's harness is intended to make this class of bug reproducible going forward.
- **Optional doc fix flagged, not yet applied**: `README.md` line 247 still describes Serena as project-scoped in `.mcp.json`, stale relative to the local-scope fix already reflected at lines 139/208 of the same file.
- **Optional follow-up research flagged, not yet run**: test whether `${CLAUDE_PROJECT_DIR:-.}` expansion actually resolves inside Serena's `--project` argument — would reopen whether project-scope can ever be portable for machine-specific-path servers.
- **Large amount of uncommitted work has accumulated** across several sessions (ROADMAP-006's tasks, research ingests, TASK-060, ROADMAP-007 + TASK-061, and now this MCP-scope research). Consider `/git-commit` once TASK-061 lands.
- **ROADMAP-001 (11/12, active)** — Phase 4 advisory locking deliberately deferred, no urgency.
- **TASK-031 (todo)** — Tier 3 `/sandbox`; note `install-global.sh` + `merge-settings-hooks.js` are TWO settings-writing scripts the measurement must account for.
- **TASK-039 (pending-uat)** — hook inline comments; implementation done, needs `/uat-walk` or `/uat-auto`, not `/tackle`.
- **BUG-0001 through BUG-0008 (open, older, unrelated)** — hook-guard findings from an earlier audit, not touched recently.
