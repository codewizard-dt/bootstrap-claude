---
id: wiki-work-family-cross-linking-gaps
title: "wiki/work/ Cross-Family Linking Gaps and SDLC Synergy Opportunities"
updated: 2026-09-13
sources:
  - ../../../raw/research/wiki-work-family-synergy/index.md
confidence: extracted
tags: [wiki-conventions, work-families, sdlc, cross-linking, task-assess, wiki-lint]
---

The six `wiki/work/` families (requirements, decisions, roadmaps, tasks, uat, bugs) are each internally well-specified by their own `lifecycle.md`, but the links *between* families are inconsistent and, in three cases, entirely absent from the schema:

| Family pair | Schema-level link field? | Evidence |
|---|---|---|
| Bug ↔ Task | **None documented.** `bugs/lifecycle.md` defines no `task:`/`fixed_by:`/`caused_by:` field. | `BUG-0008` already uses an undocumented `linked_task:` frontmatter key plus an ad hoc `## Related` prose section with untyped `[[TASK-039]]` links — practice outran schema. |
| Roadmap ↔ Bug | **None.** Roadmaps have `linked_requirements`/`linked_decisions` arrays but no `linked_bugs`. | A bug that graduates into planned work is re-described from scratch as an inline roadmap item, losing its `BUG-NNNN` provenance. |
| Requirement ↔ Decision/Task | **None in the schema**, though `/prd-create`'s own Step 7 describes "Linked Decisions"/"Linked Tasks" index columns. | Untested in practice — this repo has zero real requirement files yet, making now the cheapest time to fix the mismatch. |
| Task ↔ Task (dependencies) | **Defined two incompatible ways.** `tasks/lifecycle.md` uses frontmatter arrays (`depends_on`, `blocks`); the shared "Parse a roadmap" procedure (`/roadmap-next`, `/task-assess`) scans body headings `## Dependencies`/`## Blocked by` instead. | Sampled real tasks (`TASK-0085`, `TASK-039`) populate only the frontmatter arrays — the documented parse procedure may be reading a location most files never fill in. |

**Automation stops at exactly one real auto-creation step**: `/roadmap-next` materializing inline roadmap items into task files. Every other cross-family transition depends on a human remembering a follow-up command:

- `/adr-finalize` and `/adr-extract` explicitly print the next command instead of invoking it.
- `/adr-next` exists solely to catch decisions a human forgot to turn into a task.
- `/uat-walk`/`/uat-auto`/`/uat-auto-plus` never offer `/bug-create` on a `[FAIL]` verdict, even though the test case already has repro/expected/actual data that would pre-fill one.
- `/bug-close` computes a tag-clustering signal across recent related closes (Step 10) but never acts on it.
- `/task-create`'s dependency scan (Step 5) checks only `wiki/work/tasks/index.md`, never `wiki/work/bugs/`.
- `/wiki-lint`'s only cross-family referential check is the UAT↔task bidirectional link (2.4) — no check validates that `implements::`/`depends_on::`/`fixes::` targets exist or are still current.

`relates_to::[[typed-wiki-links]]` established that the `rel::[[target]]` vocabulary is densely used inside `knowledge/` (391 matches / 75 files) — this research found the opposite is true inside `work/`, where the vocabulary is barely used at all; family-to-family links are almost always untyped frontmatter arrays or plain wikilinks instead.

## Recommended fixes (tiered by risk)

1. **Skill affordances, no schema change** — `/uat-walk`/`/uat-auto` offer `/bug-create` inline on failure; `/bug-close` surfaces its clustering signal as an offered regression-task suggestion; `/task-create` also scans `wiki/work/bugs/` for related open bugs; `/adr-create`/`/roadmap-create` gain an optional "scan `knowledge/concepts/` for prior art" step.
2. **New `/wiki-lint` checks, no schema change** — validate typed-link target resolution; fold `/adr-next`'s check into scheduled lint.
3. **Schema formalization, routed through `/adr-create`** — add `fixed_by::`/`origin_bug::` fields (bugs↔tasks), `linked_bugs` (roadmaps), `linked_decisions`/`linked_tasks` (requirements), and reconcile the dependency-encoding format. **Must land in `lib/scripts/templates/wiki/work/<family>/lifecycle.md`**, not just the local `wiki/work/` copy, since this repo is the template source and the local copy is always-refreshed by `sync-wiki-scaffold.sh`.

See `relates_to::[[wiki-work-family-synergy]]` for the full research report and primary-source register.

**Formalized as `implements::[[DEC-0001]]`** — all four fixes above are now `proposed` decisions D1–D4 in `wiki/work/decisions/DEC-0001-wiki-cross-family-linking-schema.md`, this repo's first Decision Group. Drafting DEC-0001 also surfaced a *third* incompatible task-dependency format beyond the two noted here: `lib/skills/task-assess/SKILL.md` Step 2e parses a legacy pre-wiki2 blockquote (`> **Depends on**: [002-foo](002-foo.md)`) that no real task file uses.

`relates_to::[[wiki-skill-boilerplate-duplication]]` extends this from a different angle: beyond the three formats being *incompatible*, the schema-consistent parts of the dependency-blockquote format are also specified three separate times in skill bodies (`task-create`, `task-update`, `task-assess`) instead of once in `tasks/lifecycle.md` — both problems share the same fix (formalize the format in the lifecycle template via `/adr-create`), so they should be resolved together rather than as two separate decisions. (`task-update` no longer exists — resolved by removing the skill: [[TASK-0115]].)
