---
topic: "wiki work family lifecycles and instructions, consider ways to simplify skills/instructions/workflows without losing functionality. cut redundant and verbose text. merge. consider even merging or deleting workflow skills"
slug: wiki-skill-simplification
researched: 2026-09-13
---

# Primary Sources — Simplifying the `wiki/work/` Family Skills

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `CLAUDE.md` (repo root, top-of-file "Wiki Schema" section vs. appended "## LLM Wiki" section) | 2026-09-13 | The self-duplication example: two near-identical descriptions of the wiki schema and command tables in the same file |
| S2 | codebase | `wiki/index.md` | 2026-09-13 | Home Map-of-Content structure; confirms family index/lifecycle link pattern; existing knowledge-page inventory |
| S3 | codebase | `wiki/conventions.md` | 2026-09-13 | Archiving (§5) and log-rotation (§6) policy text that substantively overlaps `wiki-archive`/`wiki-rotate-log` SKILL.md procedures |
| S4 | codebase | `wiki/hot.md` | 2026-09-13 | Confirms the template-source constraint and the existing `DEC-0001` effort on cross-family linking (adjacent, not duplicated, by this research) |
| S5 | codebase | `wiki/knowledge/sources/wiki-work-family-synergy.md` | 2026-09-13 | Template-source constraint: local `wiki/work/<family>/lifecycle.md` files are always-refreshed copies of `lib/scripts/templates/...`; schema fixes must land upstream via `/decision-create` |
| S6 | codebase (via agent survey) | `wiki/work/requirements/lifecycle.md`; `lib/skills/req-create/SKILL.md`; `lib/skills/req-finalize/SKILL.md`; `lib/skills/req-extract-decisions/SKILL.md`; `lib/skills/req-update/SKILL.md` (esp. lines 67-74, "Retiring branch"); `lib/skills/req-retire/SKILL.md`; `lib/skills/req-compile/SKILL.md` | 2026-09-13 | Prereqs-line and file-resolution-table duplication counts; the `req-update` vs. `req-retire` divergent end-state bug (missing `git mv` step) |
| S7 | codebase (via agent survey) | `wiki/work/decisions/lifecycle.md`; `lib/skills/decision-create/SKILL.md` (Step 2.5, lines 54-59); `lib/skills/decision-finalize/SKILL.md` (Step 2.5, lines 60-77); `lib/skills/decision-walkthrough/SKILL.md`; `lib/skills/decision-next/SKILL.md` | 2026-09-13 | Duplicated Tier 1-3/4 supersession-scoring algorithm in both `decision-create` and `decision-finalize`; confirms `decision-next` is non-overlapping |
| S8 | codebase (via agent survey) | `wiki/work/roadmaps/lifecycle.md`; `lib/skills/roadmap-create/SKILL.md`; `lib/skills/roadmap-assess/SKILL.md`; `lib/skills/roadmap-next/SKILL.md`; `wiki/work/tasks/lifecycle.md`; `lib/skills/task-add/SKILL.md`; `lib/skills/task-update/SKILL.md`; `lib/skills/task-audit/SKILL.md`; `lib/skills/task-trash/SKILL.md`; `lib/skills/power-mode/SKILL.md`; `lib/skills/tackle/SKILL.md`; `lib/skills/now/SKILL.md` | 2026-09-13 | Number-allocation algorithm duplication (roadmap-create x2, task-add x2); "archive a work item" mechanic reimplemented independently in `task-audit`, `task-trash`, `roadmap-next`; task dependency-blockquote format specified 3x outside `lifecycle.md`; `power-mode` Single-Task Executor identified as a thin wrapper around `/tackle`→`/uat-generate`→`/uat-auto`; `roadmap-assess`→`roadmap-next` confirmed as a good reference-not-restate exemplar; `now` confirmed non-redundant (only path for untracked work) |
| S9 | codebase (via agent survey) | `wiki/work/uat/lifecycle.md`; `lib/skills/uat-generate/SKILL.md`; `lib/skills/uat-walk/SKILL.md`; `lib/skills/uat-auto/SKILL.md`; `lib/skills/uat-auto-plus/SKILL.md`; `lib/skills/uat-skip/SKILL.md`; `wiki/work/bugs/lifecycle.md`; `lib/skills/bug-file/SKILL.md`; `lib/skills/bug-assess/SKILL.md`; `lib/skills/bug-triage/SKILL.md` (lines 24-35, 104-113); `lib/skills/bug-close/SKILL.md` (lines 24-38, 109-114); `wiki/conventions.md` §6; `lib/skills/wiki-ingest/SKILL.md`; `lib/skills/wiki-query/SKILL.md`; `lib/skills/wiki-lint/SKILL.md`; `lib/skills/wiki-archive/SKILL.md` (lines 33-37); `lib/skills/wiki-rotate-log/SKILL.md`; `lib/skills/wiki-tidy/SKILL.md` (lines 20, 34, 36-64, 80-85) | 2026-09-13 | Confirms `UAT-CORE.md` and `bug-assess`→`bug-triage` as working reference-not-restate exemplars; identifies `wiki-tidy` as the counter-example that re-embeds instead of referencing, with an already-observed wording drift against `wiki-archive`'s Step 3 prompt; identifies the self-contradictory hardcoded terminal-status enumeration in `wiki-archive`/`wiki-tidy`; confirms `wiki-query`'s fallback-ingest gate and `wiki-lint`'s 10 checks as justified, not boilerplate |

## Excerpts

### S9 — wiki-tidy re-embedding wiki-lint/wiki-archive/wiki-rotate-log
`lib/skills/wiki-tidy/SKILL.md` (lines 20, 36-64, 80-85), via agent survey
> "wiki-tidy does not cleanly subsume the three standalone skills as a thin orchestrator — it re-embeds their full procedures instead of referencing them: All 10 wiki-lint checks re-listed at wiki-tidy:20 [...] The entire per-family archive loop re-described at wiki-tidy:36-64 [...] Full rotation steps re-described at wiki-tidy:80-85 [...] wiki-tidy's phase-2 messaging already differs slightly in wording from wiki-archive's Step 3 prompt for the same action."

### S6 — req-update / req-retire divergent retire paths
`lib/skills/req-update/SKILL.md` (lines 67-74) vs. `lib/skills/req-retire/SKILL.md`, via agent survey
> "req-update's inline retire flips status/Notes/index/log but skips the git mv archive step that req-retire performs, so the two paths leave a retired REQ in different end states. Recommend: strip the retiring branch from req-update and redirect to /req-retire."

### S8 — the "archive a work item" mechanic reimplemented independently
`lib/skills/task-audit/SKILL.md` Step 2d vs. `lib/skills/task-trash/SKILL.md` Steps 4-5 vs. `lib/skills/roadmap-next/SKILL.md`, via agent survey
> "task-audit Step 2d ('Move Fully-Completed Tasks': flip status→done, git mv to archive/, edit both indexes) duplicates task-trash Step 4/5 almost exactly (flip status→trashed, git mv, edit both indexes) — same archiving mechanic, two independent implementations differing only in the terminal status value and trigger condition. [...] Candidate: one shared 'archive a work item' procedure [...] referenced by all three instead of restated."

### S9 — good exemplar pattern already in production
`lib/skills/bug-assess/SKILL.md` line 41, via agent survey
> "bug-assess ↔ bug-triage: correctly non-duplicative. bug-assess:41 explicitly delegates ('apply the updates per the Step 6/7 procedure in lib/skills/bug-triage/SKILL.md — do not restate its edit mechanics'). This is the model other skills should copy."
