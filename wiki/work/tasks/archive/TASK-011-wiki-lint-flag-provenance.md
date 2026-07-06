---
id: TASK-011
title: "Update /wiki-lint to flag knowledge pages with weak or unset confidence provenance"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: []
parallel_safe_with: [TASK-010]
uat: "[[UAT-011]]"
tags: [wiki-tooling, provenance]
---

# TASK-011 — Update `/wiki-lint` to flag knowledge pages with weak or unset `confidence` provenance

## Objective

Add a wiki-health check to `lib/skills/wiki-lint/SKILL.md` that surfaces knowledge pages (`wiki/knowledge/sources/`, `concepts/`, `entities/`) whose provenance is weak or untracked, using the `confidence` frontmatter field that TASK-009 activated in `wiki/conventions.md` §4. This closes the loop on the provenance work: TASK-009 defined the convention, TASK-010 teaches `/wiki-ingest` to populate it going forward, and this task teaches `/wiki-lint` to report pages that are entirely `inferred`/`ambiguous` or that carry no explicit provenance at all — so the wiki keeps an eye on how much of its knowledge is synthesis vs. source-backed.

## Approach

Per `wiki/conventions.md` §4, `confidence` is a **page-level** frontmatter key (not a per-claim tag) that applies only to `knowledge/` pages. Its three values are `extracted` (default, source-backed), `inferred` (LLM synthesis beyond the source), and `ambiguous` (sources disagree / uncertain). The convention states that omitting the key means `extracted`.

That default creates a deliberate two-tier check so the lint stays useful without contradicting the convention:

- **Weak provenance (LOW).** A page that explicitly sets `confidence: inferred` or `confidence: ambiguous`. These are the pages the roadmap item cares about — knowledge that is not source-backed and should be weighed accordingly or re-grounded. This is the primary signal.
- **Untagged provenance (INFO / LOW).** A page under `knowledge/` with no `confidence` key at all. The convention says this defaults to `extracted`, so it is *not* an error — but now that `/wiki-ingest` populates the field going forward (TASK-010), an unset field marks a page that predates provenance activation and was never explicitly graded. Surface these separately as an informational nudge to add an explicit tag on next revision, never as a HIGH/MEDIUM defect.

Severity sits at LOW, alongside the existing §2.9 "Stale frontmatter" check, since neither blocks wiki integrity. The new check becomes §2.10 and is scoped strictly to `wiki/knowledge/` — `work/` artifacts use `status`, not `confidence`, and must be excluded. Detection reads the YAML frontmatter of each knowledge page with `mcp__serena__search_for_pattern` / `Read` (no shell), consistent with how the other checks in the skill inventory files.

This task edits documentation-of-behavior only (a SKILL.md prose spec that an agent executes); it does not change any wiki page's frontmatter and requires no backfill. It is parallel-safe with TASK-010 (that task edits `lib/skills/wiki-ingest/SKILL.md`; this one edits `lib/skills/wiki-lint/SKILL.md` — no shared file).

## Steps

### 1. Add the new provenance check to wiki-lint  <!-- agent: general-purpose -->

- [x] `Edit` `lib/skills/wiki-lint/SKILL.md` to add a new check subsection **`### 2.10 Provenance / confidence (LOW)`** immediately after the existing `### 2.9 Stale frontmatter (LOW)` block (currently ending at line ~90) and before `## Step 3: Report findings`
- [x] Scope the check to knowledge pages only: iterate files under `wiki/knowledge/sources/`, `wiki/knowledge/concepts/`, and `wiki/knowledge/entities/` (recursively), excluding `index.md` and `.gitkeep`. Explicitly note that `wiki/work/` pages are out of scope (they use `status`, not `confidence`)
- [x] Read each page's YAML frontmatter and classify by the `confidence` value:
  - `confidence: inferred` or `confidence: ambiguous` → report as **weak provenance**
  - no `confidence` key present → report as **untagged provenance** (informational — the convention default is `extracted`, so this is a nudge, not a defect)
  - `confidence: extracted` (or the equivalent default) → no finding
- [x] Provide the two report-line formats mirroring the skill's existing examples, e.g.:
  - `[LOW] weak provenance — wiki/knowledge/concepts/foo.md is confidence: inferred (not source-backed)`
  - `[LOW] untagged provenance — wiki/knowledge/entities/tools/bar.md has no confidence key (defaults to extracted; add an explicit tag on next revision)`
- [x] Cross-reference the authority: add a short parenthetical pointing to `wiki/conventions.md` §4 as the definition of the three `confidence` values, so the check does not re-document the semantics

### 2. Wire the new check into the report and fix guidance  <!-- agent: general-purpose -->

- [x] Confirm the new §2.10 findings flow through `## Step 3: Report findings` (grouped under LOW) and are included in the per-severity counts — no code path change needed if §2.10 emits standard `[LOW] ...` lines, but verify the Step 3 wording does not need a mention of the new category
- [x] In `## Step 4: Propose fixes`, confirm the existing "HIGH findings only get proposed fixes" wording still holds — provenance findings are LOW and should be *reported only*, not auto-fixed (a human decides whether a page is genuinely `inferred`). Do not add these to the fix-proposal flow
- [x] Verify the new check's language matches the skill's existing voice (imperative, references `mcp__serena__list_dir` / `Read` / `search_for_pattern` for inventory, never shell)

### 3. Verify  <!-- agent: general-purpose -->

- [x] Re-read the edited `lib/skills/wiki-lint/SKILL.md` and confirm: §2.10 exists, is scoped to `wiki/knowledge/` only, distinguishes weak (`inferred`/`ambiguous`) from untagged (missing key), keeps severity LOW, and does not contradict `wiki/conventions.md` §4's "omitting means `extracted`" rule
- [x] Confirm no other section of the skill duplicates or conflicts with the new check
- [x] Confirm the change is documentation-only — no wiki page frontmatter was modified and no backfill was performed
