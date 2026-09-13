---
id: wiki-skill-boilerplate-duplication
title: "wiki/work/ Skill Duplication Catalogue: What to Extract, What to Leave"
updated: 2026-09-13
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

## Duplicated mechanics (drift risk — prioritize these)

- **"Archive a work item"** (status flip → `git mv` → dual index edit → `wiki/log.md` append) is independently implemented in `task-audit`, `task-trash`, `roadmap-next`, `bug-triage`, `bug-close`, and `wiki-archive` — same mechanic, parameterized only by family + terminal status. No shared doc exists yet.
- **`wiki-tidy` is the counter-exemplar**: instead of referencing `wiki-lint`/`wiki-archive`/`wiki-rotate-log` the way the table above models, it re-embeds all 10 lint checks, the full per-family archive loop, and the full rotation steps. This has already drifted — its phase-2 confirmation prompt no longer matches `wiki-archive`'s Step 3 prompt for the identical action.
- **Terminal-status enumeration** is hardcoded almost identically in `wiki-archive` and `wiki-tidy`, and both immediately add "Do NOT hardcode — read `lifecycle.md`" right after hardcoding it.
- **Number allocation** (scan `<family>/` + `<family>/archive/`, collect numeric prefixes ignoring padding, max+1, zero-pad to 4) is restated twice each in `roadmap-create` and `task-add`.
- **Decision-supersession scoring** (Tier 1–3/4 signal) is fully duplicated between `decision-create` Step 2.5 and `decision-finalize` Step 2.5.
- **Bug ID resolution + the 4-step archive-move sequence** are duplicated word-for-word between `bug-triage` and `bug-close`.
- **Task dependency blockquote format** (`> Depends on / Blocks / Parallel-safe with`) is specified three times outside `tasks/lifecycle.md` (`task-add`, `task-update`, `task-audit`) even though it's schema-level content — `relates_to::[[wiki-work-family-cross-linking-gaps]]` separately found this same territory has *three incompatible formats* in practice, including a legacy blockquote `task-audit` still parses that no real task file produces.

## A correctness bug, not just duplication

`req-update`'s inline "Retiring branch" flips status/Notes/index/log but skips the `git mv` archive step `/req-retire` performs — the two commands leave a retired requirement in different end states. Fix independent of any broader refactor.

## Universal boilerplate (token cost only, no drift risk)

A prereqs line ("obey `wiki/guides/mcp-tools.md`; run `/primer`..."), a "never `sed`/`awk`/`echo >>` — use `Edit`" hygiene rule, and a file/ID-resolution table (accepted forms: path / `NNN-slug` / bare `NNN`) each recur verbatim across roughly 10–20 skills.

## What is *not* a duplication problem

- `uat-auto` vs. `uat-auto-plus` (different authorization posture and failure handling) and `bug-assess` vs. `bug-triage` (survey vs. single-item write) are correctly non-duplicative.
- `now` is not redundant with `tackle`/`power-mode` — it is the only path for work with no wiki task file at all.
- `wiki-query`'s capped fallback-ingest gate and `wiki-lint`'s 10 sub-checks are explicit judgment/safety logic, long because the logic requires it, not because of restatement.
- `power-mode`'s Roadmap-to-Completion mode is genuinely distinct (loop/materialization/wave logic nothing else has); only its thinner Single-Task Executor mode (a near-bare wrapper around `/tackle` → `/uat-generate` → `/uat-auto`) is a shrink candidate — see `implements::[[Power Mode Skill]]`.

## Recommended fix order

1. Fix the `req-update`/`req-retire` correctness bug (independent of everything else).
2. Rewrite `wiki-tidy` to reference its three siblings instead of re-embedding them — largest single line-count cut, removes the drift already observed.
3. Extract a shared "archive a work item" reference doc; point the 6 reimplementations at it.
4. Extract a shared ID/file-resolution reference doc.
5. Move the task dependency-blockquote format and the decision-supersession algorithm into their `lifecycle.md` template files — schema-level, must route through `/decision-create` per the template-source constraint (`relates_to::[[wiki-work-family-synergy]]`).
6. Extract the universal boilerplate into one shared preamble doc, following the `UAT-CORE.md` model.
7. Shrink `power-mode`'s Single-Task Executor section to a pointer.
