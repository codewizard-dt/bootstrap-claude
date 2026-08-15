---
id: TASK-005
aliases: [TASK-005]
title: "Add Optional tooling pointer (qmd, Hindsight) to CLAUDE.md"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-004]
blocks: []
parallel_safe_with: []
uat: "[[UAT-005]]"
tags: [wiki-tooling, documentation]
---

# TASK-005 — Add "Optional tooling" pointer (qmd, Hindsight) to `CLAUDE.md`

## Objective

Cross-link the already-ingested `wiki/knowledge/entities/tools/qmd.md` and `wiki/knowledge/entities/tools/hindsight.md` pages from `CLAUDE.md`, as a pointer to optional tooling that isn't adopted by default but is worth knowing about, without editing the immutable `raw/llm-wiki.md`.

## Approach

Do this **after** TASK-004 — both edit `CLAUDE.md`'s LLM Wiki section, and TASK-004 lands first so this task's edit lands cleanly after it rather than racing on the same section.

Key facts (already ingested, do not re-research):
- **qmd** (`wiki/knowledge/entities/tools/qmd.md`): local CLI search engine for markdown knowledge bases (BM25 + vector + LLM re-ranking). Named in Karpathy's original gist as the recommended search layer "once your wiki grows past a few hundred pages." **Status for this repo: correctly deferred** — the wiki is currently small; revisit if `/wiki-query` reading the full index becomes slow/imprecise at scale.
- **Hindsight** (`wiki/knowledge/entities/tools/hindsight.md`): shared cross-subagent memory framework, relevant because this repo runs heavy concurrent subagent orchestration (`power-mode`, `tackle`, `now`). **Status for this repo: hold off adopting as default** — document as an option, only adopt if `power-mode`/`tackle` show *observed* (not hypothetical) cross-subagent memory-sharing pain.

## Steps

### 1. Add the pointer  <!-- agent: general-purpose -->

- [x] Read `CLAUDE.md`'s `## LLM Wiki` section (after TASK-004's edit has landed)
- [x] `Edit` to add a short "### Optional tooling" subsection near the end of the LLM Wiki section (after "Wiki operations", before "CRITICAL wiki rules" or after it — pick whichever reads better once TASK-004's subsection is in place), linking to `wiki/knowledge/entities/tools/qmd.md` and `wiki/knowledge/entities/tools/hindsight.md` with the one-line "status for this repo" summary for each from Approach above
- [x] Do **not** edit `raw/llm-wiki.md` — it is immutable; this pointer only belongs in `CLAUDE.md`
- [x] Make the identical edit to `lib/scripts/templates/CLAUDE-wiki.md` if the qmd/Hindsight pointer is meant to ship to new projects too — otherwise, if this pointer is specific to *this* repo's own wiki content (since `wiki/knowledge/entities/tools/qmd.md` won't exist in a fresh scaffold), skip the template file and note in this task why it's repo-local only — **Decision: skipped the template.** The subsection links to `wiki/knowledge/entities/tools/qmd.md` and `hindsight.md`, which exist only in *this* repo's ingested wiki. A freshly scaffolded target project gets an empty wiki with no such entity pages, so shipping these links via `CLAUDE-wiki.md` would plant two dead links in every new project. The pointer is repo-local by nature; `raw/llm-wiki.md` already carries the generic "Optional: CLI tools" guidance for downstream projects.

### 2. Verify  <!-- agent: general-purpose -->

- [x] Confirm both links resolve (`wiki/knowledge/entities/tools/qmd.md`, `wiki/knowledge/entities/tools/hindsight.md` exist)
- [x] Confirm `raw/llm-wiki.md` is unchanged
