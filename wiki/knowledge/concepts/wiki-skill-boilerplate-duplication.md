---
id: wiki-skill-boilerplate-duplication
title: "wiki/work/ Skill Duplication Catalogue: What to Extract, What to Leave"
updated: 2026-09-19
sources:
  - ../../../raw/research/wiki-skill-simplification/index.md
confidence: extracted
tags: [wiki-conventions, work-families, skill-design, redundancy, refactor-candidates]
---

`derived_from::[[wiki-skill-simplification]]`. The `wiki/work/` family skills already contain a proven "reference, don't restate" pattern in three places — worth naming so future skill authors copy it deliberately instead of reinventing:

| Exemplar | What it defers to | Where |
|---|---|---|
| `uat-walk` / `uat-auto` / `uat-auto-plus` | `UAT-CORE.md` for Steps 1–5 | "Read `UAT-CORE.md` now — it defines Steps 1–5" |
| `roadmap-assess` | `roadmap-next`'s Parse/Archive procedure | "run the procedure defined in `roadmap-next/SKILL.md`, do not restate" |
| `bug-assess` | `bug-triage`'s Step 6/7 edit mechanics | "apply the updates per the Step 6/7 procedure [...] do not restate its edit mechanics" |
| `wiki-archive` / `task-assess` / `task-close` / `roadmap-next` / `bug-triage` / `bug-close` | `lib/skills/_shared/ARCHIVE-WORK-ITEM.md` for the archive-a-work-item mechanic (status flip, `git mv`, dual index edit, log append) | each skill passes only family, terminal status, and log deltas |
| 16 skills with an ID/file-resolution step (plus `uat-walk/UAT-CORE.md` Step 1) | `lib/skills/_shared/ID-RESOLUTION.md` for the path / `NNN-slug` / bare `NNN` resolver (width-agnostic; `implemented_by::[[TASK-0098]]`) | each skill passes only its family and any per-skill delta |

## Duplicated mechanics (drift risk — prioritize these)

- **"Archive a work item"** (status flip → `git mv` → dual index edit → `wiki/log.md` append) was independently implemented in `task-assess`, `task-close`, `roadmap-next`, `bug-triage`, `bug-close`, and `wiki-archive` — same mechanic, parameterized only by family + terminal status. **Resolved:** the shared procedure now lives in `lib/skills/_shared/ARCHIVE-WORK-ITEM.md` and those six skills point at it; `implemented_by::[[TASK-0097]]`. Remaining inline copies (`uat-skip`, `UAT-CORE.md` Closure, `adr-finalize` Step 6.5) are listed in that doc as not yet wired (`req-retire` became status-only in [[TASK-0119]] and no longer archives).
- **`wiki-tidy` is the counter-exemplar**: instead of referencing `wiki-lint`/`wiki-archive`/`wiki-rotate-log` the way the table above models, it re-embeds all 10 lint checks, the full per-family archive loop, and the full rotation steps. This has already drifted — its phase-2 confirmation prompt no longer matches `wiki-archive`'s Step 3 prompt for the identical action.
- **Terminal-status enumeration** is hardcoded almost identically in `wiki-archive` and `wiki-tidy`, and both immediately add "Do NOT hardcode — read `lifecycle.md`" right after hardcoding it.
- **Number allocation** (scan `<family>/` + `<family>/archive/`, collect numeric prefixes ignoring padding, max+1, zero-pad to 4) is restated twice each in `roadmap-create` and `task-create`.
- **Decision-supersession scoring** (Tier 1–3/4 signal) is fully duplicated between `adr-create` Step 2.5 and `adr-finalize` Step 2.5.
- **Bug ID resolution + the 4-step archive-move sequence** are duplicated word-for-word between `bug-triage` and `bug-close`.
- **Task dependency blockquote format** (`> Depends on / Blocks / Parallel-safe with`) is specified three times outside `tasks/lifecycle.md` (`task-create`, `task-update`, `task-assess`) even though it's schema-level content — `relates_to::[[wiki-work-family-cross-linking-gaps]]` separately found this same territory has *three incompatible formats* in practice, including a legacy blockquote `task-assess` still parses that no real task file produces. (`task-update` no longer exists — resolved by removing the skill: [[TASK-0115]].)

## A correctness bug, not just duplication

`req-update`'s inline "Retiring branch" flips status/Notes/index/log but skips the `git mv` archive step `/req-retire` performs — the two commands leave a retired requirement in different end states. Fix independent of any broader refactor. (Resolved by removing the `req-update` skill: [[TASK-0115]].)

## Universal boilerplate (token cost only, no drift risk)

**Partly resolved:** the prereqs / edit-hygiene / number-allocation extraction is done in `lib/skills/_shared/SKILL-BOILERPLATE.md`; `implemented_by::[[TASK-0099]]`. Edit hygiene and number allocation became pointers in the consumer skills. The Prereqs line intentionally stays inline in each skill (it must load before any pointer is followed) and is grammar-enforced by `test/skill-boilerplate.test.js` (added in a later step of that task) rather than centralised. The file/ID-resolution piece is covered in the table above.

Originally: a prereqs line ("obey `wiki/guides/mcp-tools.md`; run `/primer`..."), a "never `sed`/`awk`/`echo >>` — use `Edit`" hygiene rule, and a file/ID-resolution table (accepted forms: path / `NNN-slug` / bare `NNN`) each recur verbatim across roughly 10–20 skills.

## What is *not* a duplication problem

- `uat-auto` vs. `uat-auto-plus` (different authorization posture and failure handling) and `bug-assess` vs. `bug-triage` (survey vs. single-item write) are correctly non-duplicative.
- `now` is not redundant with `tackle`/`power-mode` — it is the only path for work with no wiki task file at all.
- `wiki-query`'s capped fallback-ingest gate and `wiki-lint`'s 10 sub-checks are explicit judgment/safety logic, long because the logic requires it, not because of restatement.
- `power-mode`'s Roadmap-to-Completion mode is genuinely distinct (loop/materialization/wave logic nothing else has); only its thinner Single-Task Executor mode (a near-bare wrapper around `/tackle` → `/uat-create` → `/uat-auto`) is a shrink candidate — see `implements::[[Power Mode Skill]]`.

## Recommended fix order

1. Fix the `req-update`/`req-retire` correctness bug (independent of everything else). (Resolved by removing the `req-update` skill: [[TASK-0115]].)
2. Rewrite `wiki-tidy` to reference its three siblings instead of re-embedding them — largest single line-count cut, removes the drift already observed.
3. Extract a shared "archive a work item" reference doc; point the 6 reimplementations at it.
4. Extract a shared ID/file-resolution reference doc.
5. Move the task dependency-blockquote format and the decision-supersession algorithm into their `lifecycle.md` template files — schema-level, must route through `/adr-create` per the template-source constraint (`relates_to::[[wiki-work-family-synergy]]`).
6. Extract the universal boilerplate into one shared preamble doc, following the `UAT-CORE.md` model.
7. Shrink `power-mode`'s Single-Task Executor section to a pointer.
