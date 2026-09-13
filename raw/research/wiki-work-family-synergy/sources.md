---
topic: The overall structure of the wiki and the lifecycles of each work family — how to improve synergy between work families and interconnect them so the overall SDLC is more efficient; the same questions for the wiki knowledge entities
slug: wiki-work-family-synergy
researched: 2026-09-13
---

# Primary Sources — Wiki Structure, Work-Family Lifecycles, and Cross-Family Synergy

All sources are direct codebase inspection, gathered via three parallel sub-agent audits (lifecycle/cross-link audit, pipeline-automation audit, knowledge-domain audit) each using Serena tools for directory listing and the Read tool for markdown content, per this repo's own MCP-tool rules.

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `wiki/knowledge/concepts/typed-wiki-links.md` + `search_for_pattern` for `rel::` verbs across `wiki/knowledge/` | 2026-09-13 | 391 typed-link matches across 75 files in `knowledge/`; the page's own text says the convention is "not queried by any tool" despite heavy authorial use |
| S2 | codebase | `wiki/work/bugs/lifecycle.md` | 2026-09-13 | Bug schema's frontmatter table defines no task/roadmap/fix-link field |
| S3 | codebase | `wiki/work/bugs/BUG-0008-hook-audit-cleanup-checklist.md` | 2026-09-13 | Real bug file uses an undocumented `linked_task:` frontmatter key and an ad hoc `## Related` prose section with untyped `[[TASK-039]]`/`[[BUG-NNNN]]` links |
| S4 | codebase | `wiki/work/tasks/lifecycle.md` | 2026-09-13 | Task dependency fields (`depends_on`, `blocks`, `parallel_safe_with`) are defined as frontmatter arrays |
| S5 | codebase | `lib/skills/roadmap-next/SKILL.md` — "Parse a roadmap" shared procedure | 2026-09-13 | Documents scanning body headings `## Dependencies`/`## Blocked by` for task dependencies, used by both `/roadmap-next` and `/task-audit` |
| S6 | codebase | `wiki/work/tasks/TASK-0085-normalize-wiki-work-naming.md`, `wiki/work/tasks/TASK-039-hook-inline-comments.md` | 2026-09-13 | Neither sampled task contains a `## Dependencies`/`## Blocked by` body heading — only the frontmatter arrays are populated |
| S7 | codebase | `wiki/work/requirements/lifecycle.md` | 2026-09-13 | Requirements frontmatter table has no field linking to decisions or tasks |
| S8 | codebase | `lib/skills/req-create/SKILL.md` (Step 7) and `wiki/work/requirements/index.md` | 2026-09-13 | `req-create` describes "Linked Decisions"/"Linked Tasks" index columns that do not exist in the schema or the real index's bullet-line format |
| S9 | codebase | `wiki/work/roadmaps/ROADMAP-001-wiki-tooling-improvements.md` frontmatter | 2026-09-13 | `derived_from` field points at both `raw/research/...` and `wiki/knowledge/sources/wiki-tooling-improvements.md`; roadmap schema has `linked_requirements`/`linked_decisions` but no `linked_bugs` |
| S10 | codebase | `wiki/work/tasks/TASK-075-package-install-consent-preference.md` | 2026-09-13 | Task body opens with `implements::[[package-install-consent-gating]]` (a knowledge concept page) and explicit "do not re-derive the design, follow it" text |
| S11 | codebase | `lib/skills/uat-walk/SKILL.md`, `lib/skills/uat-auto/SKILL.md`, `lib/skills/uat-auto-plus/SKILL.md` | 2026-09-13 | A `[FAIL]` verdict only flips UAT status or leaves a marker; none of the three ever offers `/bug-file` |
| S12 | codebase | `lib/skills/bug-close/SKILL.md` (Step 10) | 2026-09-13 | Computes a tag-clustering signal across recent related closes but treats it as diagnostic only, no follow-through action offered |
| S13 | codebase | `lib/skills/task-add/SKILL.md` (Step 5) | 2026-09-13 | Dependency scan reads only `wiki/work/tasks/index.md`; never checks `wiki/work/bugs/` |
| S14 | codebase | `lib/skills/decision-finalize/SKILL.md`, `lib/skills/req-extract-decisions/SKILL.md` | 2026-09-13 | Both explicitly state they do not auto-invoke the next skill in the pipeline; they print the exact next command instead |
| S15 | codebase | `lib/skills/decision-next/SKILL.md` | 2026-09-13 | Read-only skill whose sole purpose is finding accepted decisions with no task reference — exists because the decision→task step is easy to forget |
| S16 | codebase | `lib/skills/wiki-lint/SKILL.md` (check 2.4) | 2026-09-13 | Only cross-family referential check in the whole lint skill is UAT↔task bidirectional link validation |
| S17 | codebase | `lib/skills/wiki-query/SKILL.md` (Step 1), `lib/skills/wiki-ingest/SKILL.md` (CRITICAL rule 7) | 2026-09-13 | `wiki-query` reads `wiki/work/` family indexes for in-flight-work questions, but `wiki-ingest` forbids ever writing into `wiki/work/` — the knowledge/work boundary is read-permeable but write-onedirectional |
| S18 | codebase | `wiki/hot.md` | 2026-09-13 | Confirmed as a capped (~500 word), fully-regenerated session cache tracking current session state only, distinct in purpose from the durable `wiki/index.md` catalog |
| S19 | codebase | `wiki/knowledge/entities/components/power-mode-skill.md`, `bootstrap-prefs-store.md`, `wiki/knowledge/concepts/multi-agent-orchestration-patterns.md`, `per-subcommand-decomposition.md` | 2026-09-13 | Component entity pages have no reverse `implemented_by::`/`evolved_by::` pointer to the work that built/maintains them, though the reverse direction (concept → work item) already exists elsewhere |
| S20 | codebase | `wiki/conventions.md` | 2026-09-13 | Typed links are "declared now but not backfilled"; `lifecycle.md` files are explicitly "template-owned infrastructure... never edited in place," refreshed by `bootstrap update` |
| S21 | codebase | `raw/llm-wiki.md` | 2026-09-13 | Foundational pattern spec: three-layer architecture, ingest/query/lint operations, index vs. log purposes |
| S-template | codebase | `lib/scripts/templates/wiki/work/{tasks,roadmaps,uat,bugs,requirements,decisions}/lifecycle.md` (via `find_file`) | 2026-09-13 | Confirms the six `wiki/work/<family>/lifecycle.md` files in this repo are always-refreshed copies of these template originals — schema changes must land here, not in the local copy |
| S-overview | codebase | Serena project memory `project/overview` | 2026-09-13 | Confirms the documented pipeline order and the "optional for small work" framing for the req/decision layer |

## Excerpts

### S1 — `wiki/knowledge/concepts/typed-wiki-links.md`
`wiki/knowledge/concepts/typed-wiki-links.md`
> "...purely declarative — not queried or rendered specially by any tool yet..."
(Contradicted in practice: `search_for_pattern` for the `rel::` verb vocabulary across `wiki/knowledge/` returned 391 matches across 75 files.)

### S3 — `wiki/work/bugs/BUG-0008-hook-audit-cleanup-checklist.md`
`wiki/work/bugs/BUG-0008-hook-audit-cleanup-checklist.md`
> Frontmatter includes `linked_task:` pointing at a TASK-NNNN id — a field with no counterpart in `bugs/lifecycle.md`'s documented schema table.

### S8 — `lib/skills/req-create/SKILL.md`
`lib/skills/req-create/SKILL.md` (Step 7)
> Describes populating "Linked Decisions" / "Linked Tasks" columns in the requirements index — columns that do not exist in `wiki/work/requirements/index.md`'s actual bullet-line entry format or in `requirements/lifecycle.md`'s frontmatter schema.

### S12 — `lib/skills/bug-close/SKILL.md`
`lib/skills/bug-close/SKILL.md` (Step 10)
> Searches `archive/` for recent closes sharing tags as a "clustering check" — described as diagnostic, with no step that offers to open a regression task or touch a roadmap from the result.
