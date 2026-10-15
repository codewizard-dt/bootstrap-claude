---
id: TASK-0096
aliases: [TASK-0096]
title: "Rewrite wiki-tidy to reference wiki-lint/wiki-archive/wiki-rotate-log instead of re-embedding them"
status: todo
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0093]
blocks: []
parallel_safe_with: [TASK-0094, TASK-0095]
uat: ""
tags: [wiki-tidy, wiki-lint, wiki-archive, wiki-rotate-log, redundancy, skill-design]
---

# TASK-0096 — Rewrite wiki-tidy to reference wiki-lint/wiki-archive/wiki-rotate-log instead of re-embedding them

relates_to::[[wiki-skill-boilerplate-duplication]]
relates_to::[[wiki-skill-simplification]]
depends_on::[[TASK-0093]]

> **Depends on**: TASK-0093 — it rewrote wiki-tidy's Phase 1 check list and pinned that wording in `test/wiki-lint-taskless-decisions.test.js` and `UAT-0093`. This task intentionally removes that hardcoded list, so it must not start until TASK-0093's UAT has passed (otherwise it invalidates a test that UAT is still running).

Roadmap: ROADMAP-0014, Phase 2 (first item).

## Objective

`lib/skills/wiki-tidy/SKILL.md` (108 lines) is a three-phase orchestrator that re-embeds the procedures of its three sibling skills instead of pointing at them. The duplication has already drifted (see below). Rewrite it so each phase says "run `/wiki-lint` | `/wiki-archive` | `/wiki-rotate-log` exactly as written" plus only the small set of wiki-tidy-specific overrides (the `stop` affordance, sequencing, the final report). Target: roughly 55-65 lines, no restated procedure, no hardcoded check/family/status lists. This is the pattern the repo already uses successfully in `UAT-CORE.md`, `bug-assess`→`bug-triage`, and `roadmap-assess`→`roadmap-next`, and it is the largest single line-count cut in ROADMAP-0014.

## Approach

**Source-of-truth note**: edit `lib/skills/wiki-tidy/SKILL.md` (and, for one small gap-fix, `lib/skills/wiki-archive/SKILL.md`) in this repo, never their `~/.claude/skills/` counterparts — those are machine-local copies overwritten by `install-global.sh`.

Prior research: `raw/research/wiki-skill-simplification/index.md` (Option A, implementation outline item 2) and the concept page `wiki-skill-boilerplate-duplication` already cover this rewrite in full, so no fresh `/research` was needed. The drift catalogue below comes from diffing the current `wiki-tidy` against its three siblings.

**Drift observed today** (each is a reason the restatement must go — the rewrite resolves every one in favor of the sibling's wording):

| # | wiki-tidy (current) | Sibling (source of truth) | Resolution |
|---|---------------------|---------------------------|------------|
| 1 | Phase 2 prompt: "Archive all, specific families, or 'none'" after one combined summary | `wiki-archive` Step 1 (family choice) + Step 3 per-file `Proceed? (yes / skip)` | Follow `wiki-archive` as written; only add `stop` |
| 2 | Hardcodes "all 6 families" and re-describes the lifecycle read | `wiki-archive` Step 1-2 reads each `lifecycle.md` for terminal statuses | Drop; reference |
| 3 | Step 4 also removes the item's row from the family's active `index.md` | `wiki-archive` Step 4 only appends to `archive/index.md` — **no active-index removal** | Fix at the source (Step 2 below) so tidy can drop its copy |
| 4 | One combined `archive` log entry ("wiki-tidy — N items archived across K families") | `wiki-archive` Step 5: one entry per family | Follow `wiki-archive` Step 5 (one entry per family processed) |
| 5 | Phase 3 under-500 prompt `(yes / no / stop)`, no archive-pointer carry-forward, no fresh-log template | `wiki-rotate-log` Step 1 prompt `(yes / no)`; Step 4 carries prior `> Archives:` pointers and defines the fresh-log template | Follow `wiki-rotate-log` as written; only add `stop` |
| 6 | Phase 1 hardcodes "Run all 13 checks, 2.0–2.12" plus a 13-name list (was "10" until TASK-0093 corrected it) | `wiki-lint` Step 2 is the only authority on what the checks are | Drop the count and the list; the next new check would otherwise drift it a third time |

**What wiki-tidy keeps (its genuine value-add, and only this)**: phase sequencing lint → archive → rotate-log; the per-phase `stop` affordance; the rule that each phase confirms before changing anything; the final one-paragraph report; the note that Phase 2 is a safety net (a healthy wiki finds nothing).

**Known ambiguity to resolve, not preserve**: `wiki-archive`'s Usage line says omitting `family` "shows a count summary … without moving anything", while its Step 1 says it "ask[s] the user which families to archive". wiki-tidy follows Step 1 (scan all families → ask → proceed). Do not edit `wiki-archive`'s Usage line in this task unless Step 2 below already touches the same paragraph; note it in the final report instead.

**Test churn (deliberate)**: `test/wiki-lint-taskless-decisions.test.js` currently pins wiki-tidy Phase 1 wording — `"Run all 13 checks, 2.0–2.12"`, three named checks, a 13-entry parenthesised list. Those pins encode exactly the drift trap in row 6. Keep the phrase `each check's logic lives in \`/wiki-lint\`` and the `## Phase 1: Lint` / `## Phase 2` headings (other tests slice on them); replace the count/list assertions with a "does not hardcode a check count or name list" assertion.

**Shared-file caution**: Step 2 edits `lib/skills/wiki-archive/SKILL.md`, which the ROADMAP-0014 Phase 2 "shared *archive a work item* reference doc" item will also rewire. That sibling task's shared doc includes the dual-index edit, so if it lands first, Step 2 becomes a verify-only no-op (confirm the active-index removal is covered, add nothing). Tackle sequentially with that task, not in parallel.

## Steps

### 1. Rewrite wiki-tidy/SKILL.md <!-- agent: general-purpose -->

- [ ] Read `lib/skills/wiki-tidy/SKILL.md`, `lib/skills/wiki-lint/SKILL.md`, `lib/skills/wiki-archive/SKILL.md`, `lib/skills/wiki-rotate-log/SKILL.md` in full first; the rewrite must not contradict any sibling's CRITICAL rules.
- [ ] Leave frontmatter (`name`, `description`, `category`, `model`, `user-invocable`) and the intro paragraph (three phases, confirm before changing, may stop after any phase) unchanged.
- [ ] Rewrite `## Phase 1: Lint` (keep the exact heading) as a short reference: "Run `/wiki-lint` Steps 1–5 exactly as written — every check in its Step 2 runs; each check's logic lives in `/wiki-lint`, so this phase does not list or count them." Add one override bullet: at Step 4's "Which findings should I fix?" prompt, also say `Reply with 'all', specific IDs, or 'none' to skip. Type 'stop' to end wiki-tidy here.` Note that the `lint` log entry is `/wiki-lint` Step 5's. Delete the numbered 1–6 restatement and the 13-name list.
- [ ] Rewrite `## Phase 2: Archive` (heading text starting `## Phase 2`) as a reference: run `/wiki-archive` with no family argument, Steps 1–6 exactly as written (its Step 1 scans all families, reads terminal statuses from each `lifecycle.md`, and asks which to archive; Step 3 confirms per file). Override: the Step 1 family prompt also offers `stop`. Keep one sentence that this phase is a safety net and finds nothing in a healthy wiki. Delete the hardcoded family list, the summary block, the `mv`/index-row recipe, and the combined log-entry template (drift rows 1-4).
- [ ] Rewrite `## Phase 3: Rotate log` as a reference: run `/wiki-rotate-log` Steps 1–5 exactly as written (threshold check, timestamped filename, plan confirmation, rotation with archive-pointer carry-forward, report). Override: Step 1's under-500 prompt reads `(yes / no / stop)`; `no` skips the phase, `stop` ends the skill. Delete the restated steps 1–6 (drift row 5).
- [ ] Keep `## Final report` as is (it only summarises the three phases).
- [ ] Trim `## CRITICAL rules` to the tidy-specific ones: sub-skill CRITICAL rules take precedence over brevity; confirm before applying changes in each phase; `stop` at any prompt ends the skill immediately. Drop the "never move an active item / never edit archived content / never delete" bullet — it restates `wiki-archive`'s CRITICAL rules.
- [ ] Verify the result is roughly 55-65 lines (from 108), contains no `mv `, no `lifecycle.md`, no numeric check count, and no per-family list.

### 2. Close the active-index gap in wiki-archive <!-- agent: general-purpose -->

- [ ] In `lib/skills/wiki-archive/SKILL.md` Step 4 ("Move files and update archive/index.md"), after the `archive/index.md` row is appended, add one item: "Remove the item's row from the family's active `index.md` if it is still listed there." (This is the behavior wiki-tidy's old Step 4 had that `wiki-archive` lacked — drift row 3.) Match the surrounding numbering and wording; do not touch the CRITICAL rules ("`archive/index.md` is append-only" refers to the archive index, not the active one).
- [ ] Skip this step if the shared archive-a-work-item reference doc task has already landed and `wiki-archive` already covers the active-index removal — verify by reading Step 4 first.

### 3. Update the pinned tests <!-- agent: general-purpose -->

- [ ] In `test/wiki-lint-taskless-decisions.test.js`, remove the three tests that pin the count/list: `wiki-tidy Phase 1 says "all 13 checks, 2.0–2.12" …`, `wiki-tidy Phase 1 names the previously-missing checks …`, and `wiki-tidy check-name list has one entry per wiki-lint check (13)`.
- [ ] Keep `wiki-tidy references (does not restate) the 2.12 logic` (still valid: it asserts the phrase `each check's logic lives in \`/wiki-lint\`` and the absence of inlined 2.12 logic).
- [ ] Add one replacement test in the same file: wiki-tidy Phase 1 must not match `/\b\d+ checks\b/` and must not contain a parenthesised check-name list; wiki-tidy overall must reference each of `/wiki-lint`, `/wiki-archive`, `/wiki-rotate-log`.
- [ ] Do not change the wiki-lint `2.0`–`2.12` contiguity test — that one guards wiki-lint itself, not wiki-tidy.

### 4. Verify <!-- agent: general-purpose -->

- [ ] Run `node --test test/wiki-lint-taskless-decisions.test.js`; all tests pass.
- [ ] Run the repo's full test command (`node --test test/`) and confirm no other test referenced wiki-tidy wording (an initial search found only the file above).
- [ ] Use `mcp__serena__search_for_pattern` for `13 checks|all 10 checks|mv wiki/work` in `lib/skills/wiki-tidy/SKILL.md` — expect no matches.
- [ ] Note in `UAT-0093` (if still active) that CHK-004 / INT-002's "all 13 checks" wording was intentionally superseded by TASK-0096; skip if UAT-0093 is already archived (archived UAT files are never edited).
