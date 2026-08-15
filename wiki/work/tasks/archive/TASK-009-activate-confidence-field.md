---
id: TASK-009
aliases: [TASK-009]
title: "Activate confidence: extracted|inferred|ambiguous in wiki/conventions.md"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: []
parallel_safe_with: [TASK-006]
uat: "[[UAT-009]]"
tags: [wiki-tooling, provenance]
---

# TASK-009 — Activate `confidence: extracted|inferred|ambiguous` in `wiki/conventions.md`

## Objective

`wiki/conventions.md` §4 already reserves `confidence` as a frontmatter key ("populated later by overlays... safe to ignore until then"). Per `wiki/knowledge/concepts/wiki-provenance-tagging.md`, activating it is zero-migration: no schema change needed, just documenting the three allowed values and what each means, so future ingests can start using it. This task only activates the *convention* — teaching `/wiki-ingest` to populate it (a separate, larger roadmap item beyond this batch's 9-item cap) and teaching `/wiki-lint` to check it are explicitly out of scope here.

## Approach

Per the `ar9av/obsidian-wiki` reimplementation referenced in the concept page, the three values are:
- `extracted` (default) — claim is directly supported by source material
- `inferred` — LLM synthesis/reasoning beyond what the source states directly
- `ambiguous` — sources disagree or the claim is uncertain

This mirrors this repo's own `/research` skill's existing convention of marking unsupported claims as "inference — no primary source" — just formalized as frontmatter instead of an inline note. Document it in `wiki/conventions.md` §4 as an activated (no longer just reserved) key, with a one-line description of each value and where it's expected to appear (knowledge pages — `sources/`, `concepts/`, `entities/`).

## Steps

### 1. Update wiki/conventions.md §4  <!-- agent: general-purpose -->

- [x] `Edit` the "Reserved keys" row for `confidence` in `wiki/conventions.md`'s Frontmatter namespace table (§4) — move it out of the "declared, optional" reserved bucket into the "Base keys (used now)" table, or add a clear note that `confidence` is now active with its three allowed values (`extracted` default, `inferred`, `ambiguous`) and applies to knowledge pages only (not `work/` artifacts, which use `status` instead)
- [x] Add a short one-paragraph explanation (mirroring the concept page's framing) of what each value means and when to use it, near the frontmatter table or in a new small subsection
- [x] Do **not** touch `/wiki-ingest` or `/wiki-lint` in this task — those are separate roadmap items not yet created as tasks in this batch

### 2. Verify  <!-- agent: general-purpose -->

- [x] Confirm `wiki/conventions.md`'s existing "Reserved keys" line for `tier`, `last_verified`, `supersedes`, `superseded_by`, `scope` is updated to no longer list `confidence` alongside them (since it's now active, not just reserved) — or clearly split the list so it's obvious which keys are active vs. still reserved
- [x] Confirm no existing wiki page's frontmatter needs backfilling as part of this task (activation is forward-only per the convention's own "adopting later is a frontmatter backfill via lint, never a structural rewrite" rule)
