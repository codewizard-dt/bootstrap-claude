---
topic: The overall structure of the wiki and the lifecycles of each work family — how to improve synergy between work families and interconnect them so the overall SDLC is more efficient; the same questions for the wiki knowledge entities
slug: wiki-work-family-synergy
researched: 2026-09-13
sources: [./sources.md]
---

# Research: Wiki Structure, Work-Family Lifecycles, and Cross-Family Synergy

> The wiki's `knowledge/` domain is a genuinely dense, well-interlinked graph (391 typed links across 75 files), but the `work/` domain's six lifecycle families are only loosely connected to each other — three concrete family-pairs (bug↔task, roadmap↔bug, requirement↔decision/task) have **no schema-level linking field in either direction**, one dependency format is defined two incompatible ways, and every cross-family pipeline transition except roadmap→task materialization is a manual step a human must remember to run. The fixes are cheap and additive (new optional frontmatter fields, a few "offer this" affordances in existing skills, two new `/wiki-lint` checks) and — critically — because this repo is the **template source** for the bootstrap pattern, any schema change belongs in `lib/scripts/templates/wiki/work/<family>/lifecycle.md`, not the local `wiki/work/<family>/lifecycle.md` copies, or it will be silently overwritten on the next `bootstrap update`.

## Research Questions

1. What is the current architecture of the wiki (`knowledge/` vs `work/`) and how are the six work families' lifecycles defined?
2. What cross-family linking mechanisms exist today (schema fields, typed links) versus what actually gets used in practice?
3. Which family-pairs have no linking mechanism at all, and where do documented schemas diverge from real skill behavior?
4. Which pipeline transitions are automated vs. manual, and where does automation stop short — leaving a human to remember a follow-up command?
5. How well does the `knowledge/` domain interlink internally, and does `work/` ever draw on or feed back into `knowledge/`?

## Current State (Codebase)

**Three-layer architecture** [S20, S21]: `raw/` (immutable ground truth), `wiki/` (LLM-owned, two domains), `CLAUDE.md` (schema). `wiki/knowledge/` is timeless and link-organized (`sources/`, `concepts/`, `entities/{people,organisations,tools,components}/`, no `status` field). `wiki/work/` is stateful and status-organized: six families — `requirements/` (REQ-NNNN), `decisions/` (DEC-NNNN#DM), `roadmaps/` (ROADMAP-NNNN), `tasks/` (TASK-NNNN), `uat/` (UAT-NNNN, its own family, not nested under tasks), `bugs/` (BUG-NNNN) — each with a `lifecycle.md` (schema + transitions), an active-only `index.md`, and an `archive/`.

**The documented pipeline** [S-project-overview]: `/req-create → /req-finalize → /req-extract-decisions → /decision-create → /decision-finalize → /task-add → /tackle → /uat-generate → /uat-walk`|`/uat-auto`, with the requirement/decision layer explicitly optional — small work jumps straight to `/task-add` or `/bug-file`. Over 60 skills implement this pipeline plus wiki maintenance (`wiki-lint`, `wiki-archive`, `wiki-tidy`, `wiki-query`, `wiki-ingest`).

**This repo is the template's own dogfood instance** — critically, the six `wiki/work/<family>/lifecycle.md` files here are not hand-authored; they are always-refreshed copies of `lib/scripts/templates/wiki/work/<family>/lifecycle.md` [confirmed: template files exist at that exact path]. Any schema fix must be made in the template copy — editing the local `wiki/` copy alone would be overwritten by the next `sync-wiki-scaffold.sh` run and would never reach downstream projects.

## Key Findings

1. **The typed-link convention (`rel::[[target]]`) is heavily used inside `knowledge/` but barely used inside `work/`.** 391 `rel::` matches across 75 files in `wiki/knowledge/` alone — every concept/entity/source page uses 3-6 typed links routinely — even though `typed-wiki-links.md` itself describes the convention as "purely declarative... not queried by any tool" [S1]. Inside `work/`, links are either frontmatter arrays (tasks' `depends_on`/`blocks`) or untyped prose wikilinks (bugs' `## Related` section) — the typed-link verb vocabulary essentially isn't used family-to-family.

2. **Three family-pairs have zero schema-level linking mechanism in either direction:**
   - **Bug ↔ Task**: `bugs/lifecycle.md`'s frontmatter table defines no `task:`/`fixed_by:`/`caused_by:` field at all [S2], yet a real bug file already uses an undocumented `linked_task:` key plus an ad hoc `## Related` prose section with plain `[[TASK-039]]`/`[[BUG-NNNN]]` wikilinks [S3] — practice has outrun the schema.
   - **Roadmap ↔ Bug**: roadmaps have `linked_requirements` and `linked_decisions` frontmatter arrays but no `linked_bugs` [S9] — a bug that graduates into planned execution work has no way to keep its BUG-NNNN provenance; it gets silently re-described as a fresh inline roadmap item or task.
   - **Requirement ↔ Decision/Task**: `requirements/lifecycle.md`'s frontmatter table has no link fields to decisions or tasks at all [S7], even though `/req-create`'s own Step 7 instructions describe "Linked Decisions"/"Linked Tasks" index columns that don't exist in the schema or in `requirements/index.md`'s actual bullet-line format [S8] — a direct skill/schema inconsistency, untested in practice because this repo has zero real requirement files yet.

3. **Dependency encoding is internally inconsistent even within one family.** `tasks/lifecycle.md` defines dependencies as frontmatter arrays (`depends_on`, `blocks`) [S4], but the shared "Parse a roadmap" procedure used by `/roadmap-next` and `/task-audit` scans body headings `## Dependencies`/`## Blocked by` instead [S5] — and sampled real tasks (TASK-0085, TASK-039) contain neither heading, only the frontmatter arrays [S6]. Automation may be reading a location most real files never populate.

4. **Exactly one pipeline transition is truly automatic: roadmap → task materialization** (inline roadmap items become task files via `/roadmap-next`). Every other cross-family transition is a manual command a human must remember: `/decision-finalize` and `/req-extract-decisions` explicitly print the next command rather than invoking it [S14]; `/decision-next` exists solely to catch decisions a human forgot to turn into a task [S15]; `/uat-walk`/`/uat-auto` never offer `/bug-file` on a failing test, they only leave a `[FAIL]` marker or suggest a generic `/task-add` [S11]; `/bug-close` computes a tag-clustering signal across recent related closes but never acts on it — no offered regression task, no roadmap touch [S12]; `/task-add`'s dependency scan (Step 5) only reads `wiki/work/tasks/index.md`, never `wiki/work/bugs/`, so a task and a related open bug never cross-reference automatically even when they share tags [S13].

5. **`/wiki-lint`'s cross-family referential-integrity checking is narrow** — its only cross-family check validates the UAT↔task bidirectional link (2.4) [S16]. Nothing validates that a task's `implements::[[DEC-NNNN]]` target exists or is still `accepted`, or that any `depends_on`/`fixes` target resolves — link-rot risk given 391+ typed links already in the wiki.

6. **`knowledge/` and `work/` do connect — but only when a work item was born from a `/research` → `/wiki-ingest` cycle.** Confirmed in `ROADMAP-001`'s frontmatter `derived_from` pointing at both `raw/research/...` and `wiki/knowledge/sources/wiki-tooling-improvements.md`, and in `TASK-075`'s body opening with `implements::[[package-install-consent-gating]]` plus explicit "do not re-derive the design, follow it" text [S9, S10]. Roughly 20 files show this pattern, concentrated in research-originated roadmaps/tasks/UATs. Plain `/task-add` or `/bug-file` calls — the documented common case for small work — have no step that checks `knowledge/concepts/` for prior art, so most tasks/bugs never cite relevant existing research even when it exists.

7. **`wiki/hot.md` and `wiki/index.md` are not duplicative** — `hot.md` is a capped (~500 word), fully-regenerated session cache that intentionally drops facts once they age out; `index.md` is the durable, append-only catalog [S18]. This part of the system is working as designed and needs no change.

8. **No component entity page links forward to the work that built or maintains it.** `power-mode-skill.md` and `bootstrap-prefs-store.md` describe the component but carry no `implemented_by::[[TASK-NNN]]` / `evolved_by::[[ROADMAP-NNN]]` pointer [S19], even though the reverse direction (a knowledge page's `implements::` pointing at a work item) already exists in `multi-agent-orchestration-patterns.md` and `per-subcommand-decomposition.md`. The knowledge page is a one-time snapshot, not a living index into its own maintenance history.

## Constraints

- **`lifecycle.md` files are template-owned infrastructure** [S20] — never edited in place in a downstream project, always-refreshed from `lib/scripts/templates/wiki/work/<family>/lifecycle.md` by `sync-wiki-scaffold.sh`. Because this repo *is* the template source, any schema fix must land in the `lib/scripts/templates/` copy (and the paired skill files under `lib/skills/`), not just the local `wiki/work/` copy — otherwise it's invisible to every project that runs `bootstrap update`.
- **New link fields must stay optional and declared-not-backfilled**, matching `wiki/conventions.md`'s existing philosophy for typed links — this avoids breaking the 85+ existing task files and dozens of bug/UAT files that predate any schema change, and keeps `/wiki-lint` findings as suggestions, not hard errors.
- **The req/decision layer must remain optional for small work** — any new automation (e.g., decision-create prior-art scans, decision→task auto-suggestions) must not make lightweight `/task-add`/`/bug-file` flows heavier or mandatory.
- **Schema changes to `lifecycle.md` are architecturally significant** and should go through `/decision-create` rather than being silently edited, since they affect every project that installs this template.

## Recommendation

Prioritize low-risk, high-leverage fixes first, then formalize schema changes via the decision process:

**Tier 1 — skill affordances, no schema change (implement via `/task-add`, ship fast):**
- `/uat-walk` and `/uat-auto` offer `/bug-file` inline on a `[FAIL]` verdict, pre-filled from the test's repro/expected/actual, instead of only suggesting a generic `/task-add`.
- `/bug-close`'s existing tag-clustering signal (already computed, currently discarded) surfaces as an *offered* regression-task or roadmap-note suggestion when ≥2 related closes are found.
- `/task-add`'s Step 5 dependency scan also checks `wiki/work/bugs/` for open/triaged bugs sharing tags, mirroring its existing task-scan pattern.
- `/decision-create` and `/roadmap-create` gain an optional "scan `wiki/knowledge/concepts/` and `sources/` for prior art" step, so ad hoc (non-research-originated) work also benefits from existing synthesis.

**Tier 2 — new `/wiki-lint` checks (no schema change, closes the referential-integrity gap):**
- Validate that typed-link targets (`implements::`, `depends_on::`, `fixes::`) actually resolve to an existing, still-relevant page/status.
- Fold `/decision-next`'s "accepted decision, no task" check into a scheduled `/wiki-lint`/`/wiki-tidy` pass so it surfaces without a human remembering to run a separate command.

**Tier 3 — schema formalization (route through `/decision-create`, land in `lib/scripts/templates/wiki/work/<family>/lifecycle.md`):**
- Add `fixed_by::[[TASK-NNNN]]` to the bugs schema and `origin_bug::[[BUG-NNNN]]` to the tasks schema, formalizing what `BUG-0008` already does ad hoc.
- Add `linked_bugs` to the roadmap frontmatter schema, alongside `linked_requirements`/`linked_decisions`.
- Add `linked_decisions`/`linked_tasks` fields to `requirements/lifecycle.md` (fixing the `req-create` inconsistency now, while zero real requirement files exist — the cheapest possible time to fix it).
- Reconcile the two dependency-encoding conventions: standardize on the frontmatter-array format tasks already define, and update the shared "Parse a roadmap" procedure in `roadmap-next`/`task-audit` to read frontmatter first (falling back to body headings only for legacy compatibility).
- Add `implemented_by::`/`evolved_by::` guidance to component entity pages so they become living indices into their own maintenance history.

**Risks and mitigations:**
- *Scope creep on template-owned files*: mitigate by routing every Tier 3 change through `/decision-create` as a proper Decision Group rather than a silent edit, since it ships to every downstream project.
- *Breaking existing data*: mitigate by keeping all new fields optional/declared, with `/wiki-lint` treating gaps as suggestions.
- *Heavier pipeline for small work*: mitigate by making every Tier 1 affordance an offer, never a forced step.

**Alternative if constraints change**: if this template starts being used by teams (not solo/small-work), Tier 3's linking fields become worth making required (not just optional) and `/wiki-lint`'s integrity checks worth promoting to hard failures — revisit then.

## Next Steps

- `/decision-create wiki cross-family linking schema` — propose the Tier 3 schema changes (bug↔task, roadmap↔bug, requirement↔decision/task fields, dependency-format reconciliation) as a Decision Group, since they touch template-owned files shipped to every project.
- `/task-add` for each Tier 1 skill affordance (uat-walk/uat-auto bug-file offer, bug-close regression-task offer, task-add bug-aware dependency scan, decision-create/roadmap-create prior-art scan) — these need no decision gate, they're additive skill behavior.
- `/task-add` for the two new `/wiki-lint` checks (typed-link target resolution; folding `decision-next` into scheduled lint).
- This report is queued for `/wiki-ingest` (auto-ingest is enabled) — it will land as a new `wiki/knowledge/concepts/` page and update relevant existing pages (`typed-wiki-links.md`, entity pages for the affected skills).
