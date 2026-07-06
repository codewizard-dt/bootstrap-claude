---
title: Wiki Index
updated: 2026-07-06
---

# Wiki Index — Home Map

The page catalog and home Map of Content for this wiki. **Read this first on every query**, then drill into the linked pages. Updated on every ingest and every filed answer.

Conventions that govern every page (atomic pages, stable IDs, typed links, frontmatter namespace): see [conventions](conventions.md). Operation history: see [log](log.md).

Entry format: `- [Title](path) — one-line summary`.

The wiki is split into two domains with opposite organizing laws:
- **Knowledge** — timeless, link-navigated synthesis (sources, concepts, entities). Pages are listed individually below.
- **Work** — stateful, status-navigated lifecycle artifacts (requirements, decisions, roadmaps, tasks, uat, bugs). Items are **not** listed here — each family keeps its own `index.md` of active items; this page links to those.

---

## Knowledge

### Sources
- [Research: Improving the LLM Wiki tooling](knowledge/sources/wiki-tooling-improvements.md) — what's changed in the second-brain/LLM-wiki ecosystem since Karpathy's gist, and what's portable to this repo

### Concepts
- [LLM Wiki Hot Cache](knowledge/concepts/llm-wiki-hot-cache.md) — session-handoff summary file pattern, converged on by multiple gist reimplementations
- [Wiki Provenance Tagging](knowledge/concepts/wiki-provenance-tagging.md) — extracted/inferred/ambiguous claim tagging, activates this repo's reserved frontmatter
- [Wiki Multi-Writer Safety](knowledge/concepts/wiki-multi-writer-safety.md) — advisory locking for concurrent agent writes to shared wiki index files
- [Agent Memory Frameworks Landscape](knowledge/concepts/agent-memory-frameworks-landscape.md) — Mem0/Zep/Letta/Hindsight/A-Mem survey vs. this repo's markdown-only wiki

### Entities
- People — [knowledge/entities/people/](knowledge/entities/people/): [Andrej Karpathy](knowledge/entities/people/andrej-karpathy.md)
- Organisations — [knowledge/entities/organisations/](knowledge/entities/organisations/) — _(none yet)_
- Tools — [knowledge/entities/tools/](knowledge/entities/tools/): [Claude Code Auto Memory](knowledge/entities/tools/claude-code-auto-memory.md), [claude-obsidian](knowledge/entities/tools/claude-obsidian.md), [qmd](knowledge/entities/tools/qmd.md), [Hindsight](knowledge/entities/tools/hindsight.md)
- Components — [knowledge/entities/components/](knowledge/entities/components/) (this repo's own skills, hooks, scripts) — _(none yet)_

---

## Work

Each family's `index.md` lists its **active items only** (completed/terminal items drop off the list; files never move — status lives in frontmatter).

- **Requirements** — REQ-NNN. [Active index](work/requirements/index.md) · [lifecycle](work/requirements/lifecycle.md)
- **Decisions** — DEC-NNNN (per-decision `#DM`). [Active index](work/decisions/index.md) · [lifecycle](work/decisions/lifecycle.md)
- **Roadmaps** — ROADMAP-NNN. [Active index](work/roadmaps/index.md) · [lifecycle](work/roadmaps/lifecycle.md)
- **Tasks** — TASK-NNN. [Active index](work/tasks/index.md) · [lifecycle](work/tasks/lifecycle.md)
- **UAT** — UAT-NNN, one per task. [Active index](work/uat/index.md) · [lifecycle](work/uat/lifecycle.md)
- **Bugs** — BUG-NNNN. [Active index](work/bugs/index.md) · [lifecycle](work/bugs/lifecycle.md)
