---
id: TASK-056
aliases: [TASK-056]
title: "Add optional wiki/guides/ Dataview example-queries page"
status: done
created: 2026-08-13
updated: 2026-08-14
depends_on: []
blocks: []
parallel_safe_with: [TASK-053, TASK-054, TASK-057]
uat: "[[UAT-056]]"
tags: [obsidian, dataview, documentation]
---

# TASK-056 — Add optional wiki/guides/ Dataview example-queries page

## Objective

Add a new optional guide documenting Dataview as an opt-in local Obsidian plugin, with 2-3 concrete example query blocks a reader could paste into their own exploratory notes — realizing the payoff `raw/llm-wiki.md` and the prior research already identified but never delivered as concrete examples.

## Approach

This task writes CONTENT ONLY. Wiring this guide into `sync-wiki-scaffold.sh`'s `OPTIONAL_GUIDES` array and its interactive opt-in prompt plumbing is explicitly OUT OF SCOPE — that is a separate follow-on, not blocking this task's goal of having the guide content exist and be readable. Do not touch `lib/scripts/sync-wiki-scaffold.sh`.

Per this repo's `raw/guides/` convention (source guides later delivered tier-wise into target projects' `wiki/guides/`), create the master copy at `raw/guides/dataview-queries.md`, then copy it once into this repo's own `wiki/guides/dataview-queries.md` (this repo dogfoods its own scaffold — other `raw/guides/` files already have `wiki/guides/` counterparts here; confirm the existing pattern by listing `raw/guides/` and `wiki/guides/` first).

Content: a short intro explaining Dataview is optional (install via `lib/scripts/install-obsidian.sh` once TASK-053 lands, or manually), then 2-3 example `​```dataview` query blocks:
1. A `TABLE` query listing pages under `wiki/work/tasks/` by `status`.
2. A `LIST` query surfacing every page containing a `contradicts::` typed link (useful alongside `/wiki-lint`).
3. A `TABLE` query over `wiki/knowledge/entities/tools/` grouped/filtered by `tags`.

Each example must note explicitly that these are illustrative, exploratory views for a reader's own use — this repo's actual `index.md` files stay hand/LLM-maintained flat bullet lists per `wiki/conventions.md`'s Maps-of-Content convention; Dataview queries are never a replacement for the committed index files.

## Steps

### 1. Confirm the raw/guides/ ↔ wiki/guides/ pattern <!-- agent: general-purpose -->

- [x] `list_dir` (Serena) on `raw/guides/` and `wiki/guides/` to confirm which existing guides have a copy in both locations, so the new file follows the same copy-once pattern exactly.
  - Confirmed: `command-anti-patterns.md`, `evals-framework.md`, and `type-checking-templates/` have identical basenames in both `raw/guides/` and `wiki/guides/`. `deployment-strategy.md` (raw-only, deploy-only delivery) and `mcp-tools.md` (wiki-only, per-project assembled) are expected asymmetries, not deviations. `raw/guides/dataview-queries.md` + `wiki/guides/dataview-queries.md` (identical basename) follows the correct pattern.

### 2. Write the guide <!-- agent: general-purpose -->

- [x] `Write` `raw/guides/dataview-queries.md` with the intro + 3 example query blocks described above.
  - [x] `Write` a copy at `wiki/guides/dataview-queries.md` (this repo's own dogfooded instance).
  - Both files written, byte-identical (66 lines / 641 words each), containing the intro, the 3 required `​```dataview` blocks (tasks-by-status TABLE, contradicts:: LIST, tools-by-tag TABLE), each followed by an "Illustrative only" caveat pointing back to the canonical `index.md`/`wiki/index.md` per `wiki/conventions.md`.

<!-- Updated: 2026-08-13 (all steps complete) -->

## Notes

Derived from `raw/research/obsidian-wiki-linking/index.md`'s Recommendation (step 2: "Document... 2-3 example query blocks") and `wiki/work/roadmaps/ROADMAP-006-obsidian-plugin-automation.md` Phase 2. Wiring into `sync-wiki-scaffold.sh`'s `OPTIONAL_GUIDES` delivery mechanism is intentionally deferred to a future task.
