---
id: TASK-0101
aliases: [TASK-0101]
title: "Create a Decision Group consolidating the decision-supersession-scoring algorithm into decisions/lifecycle.md"
status: todo
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: [TASK-0094, TASK-0095, TASK-0100]
uat: ""
tags: [decisions, supersession, skill-dedup, roadmap-0014]
---

# TASK-0101 — Create a Decision Group consolidating the decision-supersession-scoring algorithm into decisions/lifecycle.md

relates_to::[[wiki-skill-boilerplate-duplication]]

## Objective

Produce a **proposed** Decision Group in `wiki/work/decisions/` (via `/decision-create`) that decides where and in what shape the decision-supersession-scoring algorithm lives once it is deduplicated out of `decision-create` Step 2.5 and `decision-finalize` Step 2.5. This is ROADMAP-0014 Phase 3, item 1. The deliverable is the Decision Group file only — the follow-on edits to `lifecycle.md` and the two skills are a separate task, created after the decisions are finalized.

## Approach

**Why a Decision Group and not a direct edit.** The `wiki-skill-boilerplate-duplication` concept page (recommendation 5) records that moving the supersession algorithm into `decisions/lifecycle.md` is schema-level and must route through `/decision-create`, because `lifecycle.md` is a template-owned file that `sync-wiki-scaffold.sh` always refreshes into every target project. Whatever is decided here changes what every downstream project receives.

**Research findings to seed `/decision-create` Step 3** (codebase-only; verified 2026-09-19 — do not re-derive, but confirm nothing has drifted before relying on them):

| # | Finding | Evidence |
|---|---------|----------|
| F1 | The two copies have already drifted. `decision-create` scores 3 tiers (shared tag; title noun overlap; slug-stem overlap); `decision-finalize` scores 4 tiers (adds Tier 4, an explicit `Supersedes:` already in the target, authoritative) and words Tier 2 as "sub-title noun-phrase overlap" versus create's "decision-title noun overlap". | `lib/skills/adr-create/SKILL.md` Step 2.5; `lib/skills/adr-finalize/SKILL.md` Step 2.5 |
| F2 | Only `decision-finalize` has a resolution table (zero / one strong / multiple / candidate is `proposed` / candidate already `superseded` → walk the chain to the area head / user says "different area"). `decision-create` has only "any Yes/Maybe → surface in Step 4 and offer to set Supersedes". The create path is advisory; the finalize path is authoritative and atomic. | same two files |
| F3 | Both skills already say "Read `wiki/work/decisions/lifecycle.md` first — it defines … the supersession rule, the two-block cross-reference rule, the relationship graph, and the index format". The actual `lifecycle.md` defines none of these: it has only frontmatter/per-decision schema tables and the status-transition list. The skills point at content that does not exist. | `lib/scripts/templates/wiki/work/decisions/lifecycle.md` (template, source of truth); `wiki/work/decisions/lifecycle.md` (identical local copy) |
| F4 | `decision-create` Step 6 tells the agent to add rows to an "Index" and a relationship graph in `lifecycle.md`, and `decision-finalize` Step 6 says to create `lifecycle.md` from a template "under /decision-create Step 6". Neither the Index table nor the Graph section exists in the current `lifecycle.md`; the per-family `index.md` is what actually tracks the active set. Adjacent staleness, **not** in this task's scope — surface it in the Decision Group's Shared Context so a follow-on task can decide whether to fix it. | `lib/skills/adr-create/SKILL.md` Step 6; `lib/skills/adr-finalize/SKILL.md` Step 6 |
| F5 | Precedent for the extraction pattern: `UAT-CORE.md` (shared module, consumers say "Read ... now — it defines Steps 1-5; this file defines only what differs"). That doc lives in a skill directory and installs to `~/.claude/skills/`. `lifecycle.md` instead lives in the project's `wiki/` and is scaffolded per project. | `lib/skills/uat-walk/UAT-CORE.md`; `lib/skills/uat-auto/SKILL.md` line 11 |
| F6 | Adjacent duplication not covered by the roadmap item: the two-block cross-reference rule (superseder `Supersedes` + `### Links`; superseded block status flip + callout under its H2) is restated in `decision-create` Step 6.3 and `decision-finalize` Step 4.6. Flag in Shared Context as a candidate to fold into the same lifecycle section; do not expand this Decision Group's decisions to cover it unless the user asks in Step 4. | same two files |

**Seed decisions** (starting proposal for `/decision-create` Step 1 planning; Step 4 Q&A confirms or reshapes them — at most two blocks, keep the group atomic to this one algorithm):

| Block | Question | Options to compare (table-only, ≥2) | Research-backed lean |
|-------|----------|-------------------------------------|----------------------|
| D1 | Where does the canonical scoring + resolution spec live? | (A) new "Supersession detection" section in `decisions/lifecycle.md`, both skills reference it; (B) a `UAT-CORE.md`-style shared doc inside a skill directory; (C) keep both inline copies and add a drift-check test | A — matches the roadmap's stated intent, and it also repairs F3 (skills already tell the reader to look there). Tradeoff to record: the section reaches every target project via the always-refreshed template, so it must be edited in `lib/scripts/templates/wiki/work/decisions/lifecycle.md` and mirrored to `wiki/work/decisions/lifecycle.md`, never the local copy alone. B is rejected-by-default because it would leave the algorithm in a different place from the schema it depends on. |
| D2 | What is the canonical tier ladder and how do the two callers differ? | (A) one ladder (Tiers 1-4 with Tier 3 limited to single-decision files) plus a per-caller mode: create = advisory (surface Yes/Maybe, offer Supersedes), finalize = authoritative (full resolution table); (B) keep a 3-tier ladder at create and a 4-tier ladder at finalize, both documented in the section; (C) drop the tier ladder for a single "shared tag" rule | A — removes the wording drift in F1 with one canonical Tier 2 phrasing, keeps the resolution table (F2) as the finalize-only behaviour, and gives Tier 4 a defined meaning at create time (a planned `Supersedes` already entered). C is a behaviour change and needs explicit justification against the "no parallel `accepted` in one area" invariant. |

## Steps

### 1. Confirm seed findings and plan the group  <!-- agent: general-purpose -->

- [ ] Re-read `lib/skills/adr-create/SKILL.md` Step 2.5 and `lib/skills/adr-finalize/SKILL.md` Step 2.5 (use Serena `search_for_pattern` for `Step 2.5` to locate; `Read` with offset/limit) and confirm findings F1 and F2 still hold. If either skill has been edited since 2026-09-19 (ROADMAP-0014 Phase 2 and 4 items touch neighbouring skills), update the seed table in the decision text accordingly rather than trusting this file.
- [ ] Read `lib/scripts/templates/wiki/work/decisions/lifecycle.md` and confirm F3 (no supersession rule, index format, or graph section present).
- [ ] Note the Phase 4 renames in ROADMAP-0014 (`decision-create` → `adr-create`, `decisions` → ADR) in the Shared Context so the eventual follow-on task uses whichever names are current when it is tackled.

### 2. Run /adr-create  <!-- agent: general-purpose -->

- [ ] **Interactive step — must run in a session with a user present.** `/adr-create` Step 4 requires `AskUserQuestion` (status, recommended option, deciders, mandatory non-empty tags, supersedes, prior art). It cannot be auto-judged; if this task is picked up by a headless agent, stop here and hand back to a human rather than fabricating answers.
- [ ] Invoke `/adr-create` with the topic "Consolidate the decision-supersession-scoring algorithm into decisions/lifecycle.md" and hand it the seed table above as the Step 1 plan. Point its Step 1 prior-art scan at `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md` so the resulting blocks carry `derived_from::[[wiki-skill-boilerplate-duplication]]`.
- [ ] Tags for both blocks (mandatory, non-empty): `decisions`, `supersession`, `skill-dedup`.
- [ ] Step 2.5 (existing-decision area check) is expected to find no overlap: `wiki/work/decisions/` has no active groups and the only archived group, DEC-0001, covers cross-family linking. Confirm rather than assume; if an overlap does surface, record it as `Supersedes` per the skill.
- [ ] Draft status stays `proposed` for both blocks (the skill's strong default). Finalization is a separate `/adr-finalize` action per block.
- [ ] In Shared Context, mention F4 (the stale Index/Graph references) and F6 (the duplicated two-block cross-reference rule) as adjacent findings, each marked out-of-scope for these two blocks.

### 3. Verify the outputs  <!-- agent: general-purpose -->

- [ ] Confirm `wiki/work/decisions/DEC-NNNN-<slug>.md` exists with `id`/`aliases`/`title`/`created`/`updated`/`tags` frontmatter, both blocks `Status: proposed` with non-empty `Tags`, each block has comparison tables (no bullet comparisons) and a mermaid flowchart.
- [ ] Confirm the group is listed in `wiki/work/decisions/index.md` (the skill's Step 6 handles this; verify, do not duplicate the edit) and that `wiki/log.md` has a `decision-create` entry.
- [ ] Do **not** edit `lifecycle.md`, `adr-create/SKILL.md`, or `adr-finalize/SKILL.md` in this task.

## Out of Scope / Follow-ups

- Finalizing the two blocks: `/adr-finalize wiki/work/decisions/DEC-NNNN-<slug>.md#D1` then `#D2`.
- The implementation task (add the "Supersession detection" section to the template `lifecycle.md` and mirror it to `wiki/work/decisions/lifecycle.md`; replace the Step 2.5 bodies in both skills with a reference; add a static skill-content test in `test/` following the pattern of the `wiki-lint-*.test.js` files). Create it after finalization with `/task-add --decision DEC-NNNN#D1 <description>` so it carries `implements::`.
- Folding the two-block cross-reference rule (F6) and repairing the Index/Graph references (F4) — separate items if the user wants them.
