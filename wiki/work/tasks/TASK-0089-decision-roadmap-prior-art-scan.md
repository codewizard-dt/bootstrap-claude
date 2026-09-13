---
id: TASK-0089
aliases: [TASK-0089]
title: "decision-create and roadmap-create gain an optional prior-art scan step"
status: pending-uat
created: 2026-09-13
updated: 2026-09-13
depends_on: []
blocks: []
parallel_safe_with: [TASK-0086, TASK-0087, TASK-0088, TASK-0090, TASK-0091, TASK-0092, TASK-0093]
uat: ""
tags: [decisions, roadmaps, knowledge, skill-affordance]
---

# TASK-0089 — decision-create and roadmap-create gain an optional prior-art scan step

relates_to::[[wiki-work-family-cross-linking-gaps]]

## Objective

The research found that `knowledge/` and `work/` only connect today when a work item was born from a `/research`→`/wiki-ingest` cycle (`ROADMAP-001`'s `derived_from`, `TASK-075`'s `implements::[[package-install-consent-gating]]`). An ad hoc `/decision-create` or `/roadmap-create` invocation — the common case, since `/research` is a separate, heavier command — never checks whether relevant synthesis already exists in `wiki/knowledge/concepts/` or `wiki/knowledge/sources/`. Add a lightweight, optional prior-art scan to both skills so existing research gets cited instead of silently missed.

## Approach

**Source-of-truth note**: edit `lib/skills/decision-create/SKILL.md` and `lib/skills/roadmap-create/SKILL.md` in this repo, never their `~/.claude/skills/` counterparts — those are machine-local copies installed by `install-global.sh`, overwritten on the next sync.

This is a **scan-and-surface** step, not a research-replacement — it must stay cheap (an index read + a targeted grep, not a full `/research` invocation) so it doesn't slow down the common "no relevant prior art exists" case.

## Steps

### 1. Add the scan to decision-create <!-- agent: general-purpose -->

- [x] In `lib/skills/decision-create/SKILL.md`, in "## Step 1: Parse topic, recall context" (where it already does `mcp__serena__list_memories` and reads `wiki/work/decisions/lifecycle.md`), add: also read `wiki/index.md`'s "### Concepts" and "### Sources" sections and use `mcp__serena__search_for_pattern` for the decision topic's key terms across `wiki/knowledge/concepts/` and `wiki/knowledge/sources/`.
- [x] If a clearly relevant page is found, surface it to the user during Step 4's `AskUserQuestion` clarification round (e.g. "Found `wiki/knowledge/concepts/<slug>.md` — relevant?") rather than silently citing it — the user confirms relevance, matching this skill's existing "never invent options" discipline.
- [x] If a relevant page is confirmed, add a `derived_from::[[<concept-or-source-slug>]]` line to the decision's Shared Context or the specific block's Context section.

### 2. Add the scan to roadmap-create <!-- agent: general-purpose -->

- [x] In `lib/skills/roadmap-create/SKILL.md`, in "### Step 1: Parse the topic and recall project context" (alongside its existing `mcp__serena__list_memories` call), add the identical scan pattern from Step 1 above.
- [x] If confirmed relevant, populate the roadmap's `derived_from:` frontmatter field (already an established pattern — see `ROADMAP-001`'s and `ROADMAP-0013`'s own frontmatter) instead of leaving it empty by default.
<!-- Updated: 2026-09-13 -->
<!-- Implementation notes: added item 4 to Step 1 (prior-art scan, optional/cheap, skip silently), folded confirmation into Step 3's Q&A batch, added derived_from row to Step 6's frontmatter field table. See lib/skills/roadmap-create/SKILL.md lines 53, 85, 142. -->

### 3. Keep it optional and cheap <!-- agent: general-purpose -->

- [x] In both files, state explicitly that this step is skipped without ceremony (no error, no "no prior art found" message clutter) when the search returns nothing plausibly relevant — the goal is catching genuine hits, not adding a mandatory checkpoint to every decision/roadmap. Confirmed: decision-create Step 1 item 5 says "skip silently if nothing plausible turns up" and Step 4 says "Skip this question entirely when the scan found nothing plausible"; roadmap-create Step 1 item 4 says "skip silently if nothing plausible turns up".
