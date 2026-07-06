---
id: TASK-010
title: "Update /wiki-ingest to populate the confidence field on new/updated knowledge pages"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-009]
blocks: []
parallel_safe_with: []
tags: [wiki-tooling, provenance]
uat: "[[UAT-010]]"
---

# TASK-010 — Update `/wiki-ingest` to populate the `confidence` field on new/updated knowledge pages

## Objective

`wiki/conventions.md` §4 now documents `confidence: extracted | inferred | ambiguous` as an **active** frontmatter key for knowledge pages (activated by TASK-009). But nothing writes it yet — `/wiki-ingest` still emits page frontmatter without a `confidence` key, so every ingested page silently defaults to `extracted` regardless of whether its claims are source-supported or LLM synthesis. This task teaches `lib/skills/wiki-ingest/SKILL.md` to set an appropriate `confidence` value when it creates or updates a `sources/`, `concepts/`, or `entities/` page, so provenance is captured at write time instead of being backfilled later.

## Approach

The three page-writing steps in `lib/skills/wiki-ingest/SKILL.md` — **Step 3** (summary page), **Step 4** (entity pages), **Step 5** (concept pages) — carry frontmatter templates that omit `confidence` entirely. The fix is two-fold:

1. **Add `confidence` to the frontmatter templates** in Steps 3 and 4 (Step 5 references Step 3's key list — "frontmatter (`id`, `title`, `updated`, `sources`, `tags`)" — so extend that list too).
2. **Give the skill a decision rule** for which value to emit, mirroring the definitions TASK-009 wrote into `wiki/conventions.md` §4 so the two never drift:
   - `extracted` (default) — the page restates what a `raw/` source directly says.
   - `inferred` — the claim is LLM synthesis/reasoning beyond what any source states (mirrors the `/research` skill's "inference — no primary source" convention).
   - `ambiguous` — sources disagree or the claim is genuinely uncertain (pairs naturally with the existing `> **Contradiction:**` callout rule).

Because a page's confidence is a property of its dominant claims, the guidance should be page-level: pick the value that best characterizes the page as a whole, and note that a page built mostly from source restatement is `extracted` even if it contains a little synthesis. Keep the change minimal and declarative — do not add a separate step or a lengthy rubric; fold the value choice into the existing page-writing steps plus one short shared note, and add one CRITICAL RULE line so the requirement is visible at a glance. Do **not** touch `/wiki-lint` here — teaching lint to *check* `confidence` is the separate next roadmap item ("flag pages with no `extracted`-tagged claims").

**Cross-reference for the implementer:** read `wiki/conventions.md` §4 (the `confidence` subsection) and `wiki/work/tasks/TASK-009-activate-confidence-field.md` before editing, so the wording of the three values stays identical to the convention. The concept page `wiki/knowledge/concepts/wiki-provenance-tagging.md` is the underlying rationale.

## Steps

### 1. Add `confidence` to the page-creation frontmatter templates  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-06 -->

- [x] `Edit` `lib/skills/wiki-ingest/SKILL.md` **Step 3** (Write or Update the Summary Page): add `confidence: extracted` to the YAML frontmatter block (currently `id`, `title`, `updated`, `sources`, `tags`), placed after `sources:`. Note in the step's prose that the value should be chosen per the decision rule added in Step 2 below, not left hard-coded.
- [x] `Edit` **Step 4** (Update or Create Entity Pages): add `confidence: extracted` to the new-entity-page frontmatter block (currently `id`, `title`, `aliases`, `updated`, `sources`, `tags`), placed after `sources:`.
- [x] `Edit` **Step 5** (Update or Create Concept Pages): the step lists required frontmatter inline as "(`id`, `title`, `updated`, `sources`, `tags`)" — extend that list to include `confidence`.

### 2. Add the confidence decision rule and a CRITICAL RULE  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-06 -->

- [x] Add a short shared note to `lib/skills/wiki-ingest/SKILL.md` (a compact paragraph or 3-bullet list, e.g. immediately after the Step 3 frontmatter or as a small labelled note the page-writing steps can share) defining the three values — `extracted` (default; page restates a `raw/` source), `inferred` (LLM synthesis beyond any source), `ambiguous` (sources disagree / genuinely uncertain) — and stating it applies to `knowledge/` pages only and is chosen per page based on the page's dominant claims. Keep the wording aligned with `wiki/conventions.md` §4 so the two do not drift.
- [x] Add one line to the `## CRITICAL RULES` section: knowledge pages created or updated by this skill must carry a `confidence` value chosen per the decision rule (omission defaults to `extracted`, but set it explicitly for `inferred`/`ambiguous` pages). Tie `ambiguous` to the existing contradiction-callout rule (rule 3) so a flagged contradiction and an `ambiguous`/lower confidence travel together.
- [x] Confirm the skill does **not** claim to teach `/wiki-lint` anything — that check is a separate roadmap item and out of scope here.

### 3. Verify  <!-- agent: general-purpose -->
<!-- Updated: 2026-07-06 -->

- [x] Re-read the edited Steps 3–5 and CRITICAL RULES and confirm: (a) each page-creation template now includes `confidence`, (b) the three value definitions match `wiki/conventions.md` §4 verbatim in meaning, (c) no read-only or work-artifact path was told to set `confidence` (work artifacts use `status`, not `confidence`).
- [x] Mentally dry-run the skill against this repo's own `wiki-tooling-improvements` source ingest: the source-summary page would be `extracted`, a concept page that generalizes beyond the source would be `inferred` — confirm the guidance produces those outcomes.
