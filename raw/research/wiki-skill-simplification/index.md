---
topic: "wiki work family lifecycles and instructions, consider ways to simplify skills/instructions/workflows without losing functionality. cut redundant and verbose text. merge. consider even merging or deleting workflow skills"
slug: wiki-skill-simplification
researched: 2026-09-13
sources: [./sources.md]
---

# Research: Simplifying the `wiki/work/` Family Skills

> The `wiki/work/` family subsystem (6 lifecycles, ~30 SKILL.md files, ~6,000 lines) already contains a proven "reference, don't restate" pattern in three places (UAT-CORE.md, `bug-assess`→`bug-triage`, `roadmap-assess`→`roadmap-next`) — the fix is applying that pattern consistently, not inventing a new mechanism. No SKILL.md is a clean deletion candidate; every family skill is a genuinely distinct entry point. The two highest-value actions are (1) a real correctness bug in `req-update`'s inline retire branch, and (2) rewriting `wiki-tidy` to reference its three sibling skills instead of re-embedding ~90% of their content, which has already caused observable wording drift.

## Research Questions
1. Where does text repeat near-verbatim across the `wiki/work/` family skills, and how much of it is boilerplate vs. genuine per-skill content?
2. Where does a SKILL.md restate what its family's `lifecycle.md` (or `wiki/conventions.md`) already fully specifies?
3. Where do two or more skills implement the *same behavior* independently, and does that duplication risk drift or bugs?
4. Are any of the 6 orchestration/workflow skills (`power-mode`, `tackle`, `now`, `wiki-tidy`, `wiki-archive`+`wiki-rotate-log`+`wiki-lint`) safe to merge or delete outright?
5. What is the lowest-risk, highest-value order of changes that cuts verbosity without losing functionality?

## Current State (Codebase)

The `wiki/work/` subsystem spans 6 families, each with a `lifecycle.md` (schema authority) plus 3–6 `SKILL.md` files in `lib/skills/`, plus a 6-file wiki-maintenance group and a 3-file orchestration trio:

| Group | Files | Approx. lines |
|---|---|---|
| Requirements | lifecycle + req-create/finalize/extract-decisions/update/retire/compile | ~1,240 |
| Decisions | lifecycle + decision-create/finalize/walkthrough/next | ~755 |
| Roadmaps | lifecycle + roadmap-create/assess/next | ~525 |
| Tasks | lifecycle + task-add/update/audit/trash | ~805 |
| UAT | lifecycle + uat-generate/walk/auto/auto-plus/skip | ~910 |
| Bugs | lifecycle + bug-file/assess/triage/close | ~575 |
| Wiki-maintenance | conventions.md + wiki-ingest/query/lint/archive/rotate-log/tidy | ~785 |
| Orchestration | power-mode/tackle/now | ~380 |

This repo's own `CLAUDE.md` already shows the pattern in miniature: it carries a bespoke top-of-file "Wiki Schema" section and a second, appended "## LLM Wiki" section (the template block `sync-wiki-scaffold.sh` delivers to *other* projects) that describe the same schema and command tables twice — a self-duplication visible without reading any skill file.

**A pattern that already works is in production in 3 places** — this is the strongest evidence for the recommended fix, not a hypothetical:
- `uat-walk`, `uat-auto`, `uat-auto-plus` all say "read `UAT-CORE.md` now — it defines Steps 1–5" instead of each restating the steps.
- `roadmap-assess` explicitly says "run the Parse/Archive procedure defined in `roadmap-next/SKILL.md`, do not restate."
- `bug-assess` explicitly says "apply the updates per the Step 6/7 procedure in `bug-triage/SKILL.md` — do not restate its edit mechanics."

**The counter-example is `wiki-tidy`**, which does the opposite: instead of referencing `wiki-lint`/`wiki-archive`/`wiki-rotate-log`, it re-lists all 10 `wiki-lint` checks, re-describes the full per-family archive loop, and re-describes the full rotation steps. This has already drifted — `wiki-tidy`'s phase-2 confirmation prompt wording no longer matches `wiki-archive`'s Step 3 prompt for the identical action [S9].

## Key Findings

**Universal boilerplate (repeated verbatim, 10+ occurrences each):**
- The prereqs line ("obey `wiki/guides/mcp-tools.md`; run `/primer` if not done this session") is identical across ~20 skill files [S6, S7, S8, S9].
- "Use Edit — one targeted call. Never `sed`/`awk`/`perl -i`/`echo >>`/`cat <<EOF`" appears in nearly every write-capable skill [S6, S7, S8, S9].
- A file-resolution table (accepted forms: full path / `NNN-slug` / bare `NNN` / empty) is repeated near-identically in ~10 skills: `req-finalize`, `req-extract-decisions`, `req-update`, `req-retire`, `req-compile`, `decision-finalize`, `decision-walkthrough`, `decision-next`, `bug-triage`, `bug-close` [S6, S7, S9].

**Duplicated *mechanics*, not just prose (higher risk — these can silently diverge):**
- **"Archive a work item"** (status flip → `git mv` → dual index edit → `wiki/log.md` append) is independently implemented at least 5 times: `task-audit`, `task-trash`, `roadmap-next`, `bug-triage`, `bug-close`, `wiki-archive` — same mechanic, parameterized only by family and terminal status [S8, S9].
- **Number allocation** (scan `<family>/` + `<family>/archive/`, collect numeric prefixes ignoring padding, take max+1, zero-pad to 4) is independently restated in `roadmap-create` (twice) and `task-add` (twice) [S8].
- **The task-body dependency blockquote format** (`> Depends on / Blocks / Parallel-safe with`) is specified three separate times outside `lifecycle.md` — in `task-add`, `task-update`, and `task-audit` — and is not in `tasks/lifecycle.md` at all, even though it's schema-level, not skill-level [S8]. This is a real documentation gap, not just verbosity.
- **The decision-supersession scoring algorithm** (Tier 1–3/4 signal: shared tag / title overlap / slug overlap) is fully duplicated in `decision-create` Step 2.5 and `decision-finalize` Step 2.5 [S7].
- **Bug ID resolution** (accepted forms + resolution order) and the **4-step archive-move sequence** are duplicated word-for-word between `bug-triage` and `bug-close` [S9].
- **Terminal-status enumeration** is hardcoded almost identically in `wiki-archive` and `wiki-tidy`, and both files immediately follow it with "Do NOT hardcode — read `lifecycle.md`" — a self-contradiction, not just redundancy [S9].

**A real correctness bug, not just duplication:**
- `req-update`'s inline "Retiring branch" (its own retire sub-flow) flips status/Notes/index/log but **skips the `git mv` archive step** that `/req-retire` performs — the two paths leave a retired requirement in different end states depending which command was used [S6]. This should be fixed regardless of any broader simplification pass.

**Verbose-but-justified — explicitly *not* cut candidates:**
- `wiki-query`'s fallback-ingest gate (find → rank → announce → ingest → re-answer-once, capped at 3 sources / one re-entry) needs its explicit length to prevent runaway ingestion cascades [S9].
- `wiki-lint`'s 10 sub-checks and `wiki-ingest`'s confidence-selection guidance are judgment calls, not restated boilerplate [S9].
- `now` is not redundant with `tackle`/`power-mode` — it is the only path for untracked, non-wiki work; its scope is genuinely distinct even though its description doesn't warn users away from wiki-tracked work [S8].
- `uat-auto` vs. `uat-auto-plus` and `bug-assess` vs. `bug-triage` are correctly non-duplicative (different authorization posture / different write scope) [S9].

**Orchestration layer:**
- `power-mode`'s "Single-Task Executor" mode adds close to zero logic beyond sequencing `/tackle` → `/uat-generate` → `/uat-auto` with a "don't stop between phases" footer — a thin autonomy wrapper, and a merge/shrink candidate. Its "Roadmap-to-Completion Orchestrator" mode is genuinely distinct (adds loop/materialization/wave logic nothing else has) and should stay [S8].

## Constraints

- **Template-source constraint** (already documented by prior research, `relates_to::[[wiki-work-family-synergy]]`): the `wiki/work/<family>/lifecycle.md` files in *this* repo are always-refreshed copies of `lib/scripts/templates/wiki/work/<family>/lifecycle.md`. Any schema-level fix (the dependency-blockquote format, the supersession algorithm) must land in the template source and go through the existing `/decision-create` → `/decision-finalize` path (as `DEC-0001` already models for the cross-linking-gap fixes), never in the local `wiki/` copy alone — it would be silently overwritten by the next `sync-wiki-scaffold.sh` run [S4, S5].
- Skills are installed globally from `lib/skills/<name>/SKILL.md` to `~/.claude/skills/` — edits belong there, not in any per-project copy.
- The user's explicit constraint is **no functionality loss** — every recommendation below is extract-and-reference, not delete-and-hope, except where a sub-agent confirmed a mode/branch was genuinely redundant.

## Solution Comparison

| Criteria | A. Extract shared procedures into reference docs | B. Merge sibling skills into one file each | C. Leave as-is |
|---|---|---|---|
| **Approach** | Pull repeated mechanics (archive-item, ID-resolution, number-allocation) into small shared docs; skills reference them (mirrors `UAT-CORE.md`) | Fold `bug-triage`+`bug-close`, or `wiki-lint`+`wiki-archive`+`wiki-rotate-log`, into single multi-mode skills | No changes |
| **Pros** | Matches a pattern already proven in this codebase; preserves every existing command/entry point; removes drift risk | Fewer files to open | Zero effort |
| **Cons** | Slight indirection (one more file to open per shared concern) | Loses single-purpose invocability (`/wiki-archive` alone, `/bug-close` alone) that the CLAUDE.md command table explicitly documents; larger, riskier diffs | `wiki-tidy`/`wiki-archive` wording drift already observed; `req-update`/`req-retire` divergent end-states bug persists; token cost repeats on every invocation |
| **Complexity** | Low–Medium | Medium–High | None |
| **Codebase fit** | High — replicates `UAT-CORE.md`, `roadmap-assess`→`roadmap-next`, `bug-assess`→`bug-triage` verbatim | Low — no existing precedent for collapsing distinct commands into one file | N/A |
| **Maintenance** | Lower — one place to fix each mechanic | Unclear — larger files, more branching per file | Current (already showing drift) |

## Recommendation

**Adopt Option A.** No SKILL.md in the `wiki/work/` family is a safe outright deletion — all three surveying agents independently confirmed every family skill provides a distinct entry point or behavior. The leverage is in de-duplicating shared *mechanics*, the way this repo already does successfully in three places, and applying it to the one place that does the opposite (`wiki-tidy`).

**Implementation outline, in priority order:**
1. **Fix the correctness bug first, independent of any refactor**: strip `req-update`'s inline retire branch; redirect to `/req-retire`.
2. **Rewrite `wiki-tidy`** to say "run `/wiki-lint` Steps 1–5 as written," "run `/wiki-archive` as written," "run `/wiki-rotate-log` as written" instead of re-embedding their procedures — the single largest line-count cut (~60–70 lines) and removes the drift already observed.
3. **Extract a shared "archive a work item" reference doc** (status flip + `git mv` + dual-index edit + log append, parameterized by family + terminal status), and point `task-audit`, `task-trash`, `roadmap-next`, `bug-triage`, `bug-close`, `wiki-archive` at it.
4. **Extract a shared ID/file-resolution reference doc** (the ~10-occurrence table) the same way.
5. **Move the task dependency-blockquote format and the decision-supersession scoring algorithm out of skill bodies and into their `lifecycle.md` template files** — schema-level content belongs in the schema file once. This one must route through `/decision-create` per the template-source constraint above.
6. **Extract the universal boilerplate** (prereqs line, hygiene rule, number-allocation algorithm) into one short shared preamble doc, following the `UAT-CORE.md` model exactly.
7. **Shrink `power-mode`'s Single-Task Executor section** to a short pointer at `/tackle` → `/uat-generate` → `/uat-auto`; keep the Roadmap-to-Completion mode intact.
8. **Trim `wiki/conventions.md` §6** (log rotation) to policy-only, pointing at `wiki-rotate-log` for mechanics, mirroring the same reference-not-restate fix.
9. Lower priority / cosmetic: decide intentionally whether `CLAUDE.md`'s two wiki-schema sections should both stay (deliberate dogfood-plus-template-preview pair) or the top section should shrink to a pointer.

**Risks and mitigations:**
- Extracted reference docs add one hop of indirection per shared concern — mitigate by keeping each doc short (<50 lines) and always pairing it with an explicit "read `X` now" line in the calling skill, exactly as `UAT-CORE.md` already does.
- Schema-level moves (item 5) must not be hand-edited only in this repo's local `wiki/` copy — route through `/decision-create` so the fix lands in `lib/scripts/templates/...` and ships to downstream projects.
- `req-update`/`req-retire` behavior change (item 1) is low-risk to verify — this repo currently has zero real requirement files to regression-test against, per prior naming-inconsistency research.

**Alternative if constraints change:** if standalone invocability of `/wiki-lint`, `/wiki-archive`, `/wiki-rotate-log` is ever judged unnecessary (only ever run via `/wiki-tidy`), Option B's harder merge becomes viable for that group specifically — nothing found in this research suggests that today.

## Next Steps
- `/decision-create` for the two schema-level moves (task dependency-blockquote format into `tasks/lifecycle.md`; decision-supersession algorithm into `decisions/lifecycle.md`) — architecturally significant, ships to every downstream project.
- `/task-add` for each mechanical, non-schema extraction: shared archive-procedure doc, shared ID-resolution doc, shared number-allocation/boilerplate doc, the `wiki-tidy` rewrite, the `req-update` bug fix, and the `power-mode` Single-Task Executor shrink — all text-only edits, safe as direct tasks without a decision gate.
