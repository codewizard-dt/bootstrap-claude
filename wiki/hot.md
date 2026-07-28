---
title: Hot Cache
updated: 2026-07-28
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-07-28_

## Key Recent Facts
- **ROADMAP-003 created (2026-07-28, active, 0/6)**: convert bootstrap MCP servers to **single shared HTTP processes** — brave-search → HTTP-mode Docker container (port 8941, `--restart unless-stopped`), playwright → native launchd LaunchAgent (port 8931, globally-installed package — never npx-under-launchd), shared plumbing (`mcp_matches`/`wait_http_up`/upgrade detection), docs alignment, local-machine migration as runtime UAT. Context7 already remote HTTP; **serena deferred**; separate declarative MCP config file **rejected** (provisioning is behavior, not data). Derived from `raw/research/mcp-one-process-per-user/` (not yet ingested): stdio = 1 client : 1 subprocess per MCP spec; host-level sharing is an open Claude Code feature request (#28860).
- **ROADMAP-003 Phase 0 supersedes TASK-020** (`pending-uat`, exec-wrapper shipped in `install-mcps.sh` + `setup-project.sh`): close via `/uat-skip` with a supersession note — implementation was real and statically verified (5/5), but the wrapper design (one container, N exec'd processes) is replaced by true single-process HTTP. UAT-020 (9 cases, pending) gets skipped, not run.
- Known implementation pitfalls captured in the roadmap: value-less `docker -e` only forwards *exported* vars (use prefix assignment); latent `read -r BRAVE_API_KEY` EOF failure under `set -e` (install-mcps.sh:73-74); old sleep-entrypoint container must be `docker rm -f`'d on migration (detect via `docker inspect -f '{{.Path}}'`).
- **The Serena health-tracking hook bug is still unpatched** (`lib/hooks/lib/serena.js` + `serena-usage-tracker.js`) — see [Serena Health-Tracking Hook](knowledge/entities/components/serena-health-tracking-hook.md); no fix task filed; `.serena/project.yml` still lacks `typescript`.
- [Wiki Multi-Writer Safety](knowledge/concepts/wiki-multi-writer-safety.md) remains `confidence: ambiguous`.

## Recent Changes
- Created: `wiki/work/roadmaps/ROADMAP-003-single-process-mcp-servers.md`, `raw/research/mcp-one-process-per-user/index.md` + `sources.md` (10-source register).
- Created earlier same day: `wiki/work/uat/UAT-020-brave-search-mcp-docker.md` (9 cases, pending → will be skipped per Phase 0), `raw/research/brave-mcp-single-docker-container/` (prior research, also not yet ingested).
- Updated: `wiki/work/tasks/TASK-020-brave-search-mcp-docker.md` (implemented + `pending-uat`), `lib/scripts/install-mcps.sh` + `lib/scripts/setup-project.sh` (exec-wrapper shipped — now due for Phase 2 rework), roadmaps/tasks/uat indexes, `wiki/log.md`.

## Active Threads
- **ROADMAP-003 is the live thread — tasks minted (2026-07-28)**: TASK-021 (shared plumbing) → TASK-022 (brave HTTP container) ∥ TASK-023 (playwright launchd) → TASK-024 (docs) → TASK-025 (local migration = runtime UAT). Wave 1 ready now: `/uat-skip wiki/work/uat/UAT-020-brave-search-mcp-docker.md` (Phase 0 closure) and `/tackle wiki/work/tasks/TASK-021-mcp-http-shared-plumbing.md`.
- **Two research reports await ingest**: `/wiki-ingest raw/research/mcp-one-process-per-user/index.md` and `/wiki-ingest raw/research/brave-mcp-single-docker-container/index.md`.
- ROADMAP-001 Phase 4 (advisory locking) remains intentionally deferred; Serena hook fix still not filed as a task.
