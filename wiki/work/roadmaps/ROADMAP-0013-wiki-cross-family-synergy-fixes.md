---
id: ROADMAP-0013
aliases: [ROADMAP-0013]
title: Wiki Cross-Family Synergy Fixes (Skill Affordances & Lint)
status: active
created: 2026-09-13
updated: 2026-09-14
owner: David Taylor
derived_from: [wiki-work-family-synergy]
linked_requirements: []
linked_decisions: [DEC-0001]
tags: [wiki-conventions, work-families, sdlc, wiki-lint]
---

# Roadmap 0013: Wiki Cross-Family Synergy Fixes (Skill Affordances & Lint)

## Goal

Close the non-schema synergy gaps found in `wiki-work-family-synergy` research — skill-level automation for the bug↔task↔UAT feedback loop, decision/roadmap knowledge-linkage affordances, and new `/wiki-lint` referential-integrity checks — none of which require the template-schema changes already routed to [[DEC-0001]].

## Phase 1: Bug↔Task↔UAT Feedback Loops

- [ ] [[TASK-0086: uat-walk and uat-auto offer /bug-file inline on a [FAIL] verdict]]
- [ ] [[TASK-0087: bug-close's tag-clustering signal becomes an offered regression-task suggestion]]
- [ ] [[TASK-0088: task-add's dependency scan also checks wiki/work/bugs/, writing origin_bug]]

## Phase 2: Decision/Roadmap Knowledge Linkage

- [ ] [[TASK-0089: decision-create and roadmap-create gain an optional prior-art scan step]]
- [ ] [[TASK-0090: Add implemented_by::/evolved_by:: reverse-pointer convention to component entity pages]]
- [ ] [[TASK-0091: Add an optional knowledge-link flag to /task-add and /bug-file]]

## Phase 3: Wiki-Lint Referential Integrity

- [ ] [[TASK-0092: New wiki-lint check: validate typed-link targets actually resolve]]
- [ ] [[TASK-0093: Fold decision-next's task-less-decision check into a scheduled wiki-lint/wiki-tidy pass]]

## Notes

- Originated from `/research the overall structure of the wiki and the lifecycles of each work family... consider ways to improve synergy` this session (not a REQ): [Research: Wiki Structure, Work-Family Lifecycles, and Cross-Family Synergy](../../knowledge/sources/wiki-work-family-synergy.md) and [wiki/work/ Cross-Family Linking Gaps and SDLC Synergy Opportunities](../../knowledge/concepts/wiki-work-family-cross-linking-gaps.md).
- The research's Tier 3 (schema formalization: `linked_task`/`origin_bug`, `linked_bugs`, requirements `linked_decisions`/`linked_tasks`, and task-dependency-encoding reconciliation) was deliberately excluded from this roadmap and routed to [[DEC-0001]] instead, since those changes are architecturally significant and must land in `lib/scripts/templates/wiki/work/<family>/lifecycle.md` (this repo is the template source).
- Phase 1's third item (`/task-add` bug-aware dependency scan) is sequenced last within its phase because it writes to the `origin_bug` field, which does not exist until [[DEC-0001]]#D1 is accepted — `/roadmap-next` can still create its task file, but implementation should wait on that decision.
- All items are inline placeholders (no task files exist yet) — `/roadmap-next` will create them automatically.
