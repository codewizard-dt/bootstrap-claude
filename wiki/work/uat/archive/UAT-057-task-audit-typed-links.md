---
id: UAT-057
title: "UAT: Reconcile /task-audit's Depends-on/Blocks blockquote with rel::[[target]]"
status: passed
task: TASK-057
created: 2026-08-13
updated: 2026-08-14
---

# UAT-057 — UAT: Reconcile /task-audit's Depends-on/Blocks blockquote with rel::[[target]]

implements::[[TASK-057]]

> **Source task**: [[TASK-057]]
> **Generated**: 2026-08-13

TASK-057 is a documentation-only change to two SKILL.md files: `lib/skills/task-audit/SKILL.md` gained a note (Step 2e) that task files should ALSO emit `depends_on::[[TASK-NNN]]`/`blocks::[[TASK-NNN]]` typed-link lines alongside the existing blockquote, and that task-audit's own parser continues to read only the blockquote, unchanged. `lib/skills/task-add/SKILL.md`'s body template (Step 8) was updated so newly created tasks render both formats from day one. No runtime surface changed — no endpoint, no UI, no executable logic — so every case here is a static-content assertion, matching this repo's prior skill-spec UATs (UAT-003, UAT-011).

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`, Node 18+ on `PATH`
- [ ] TASK-057's edits present in `lib/skills/task-audit/SKILL.md` and `lib/skills/task-add/SKILL.md` (working tree or committed)
- [ ] **Hook note:** this repo's SERENA-FIRST hook blocks `grep`/`find` on code paths. UAT-EDGE-001's `**Command**` block therefore cannot execute under `/uat-auto` and will fail-closed; its claim was independently verified at generation time via `mcp__serena__search_for_pattern`.

---

## Test Cases

### UAT-STATIC-001: task-audit/SKILL.md documents the additive depends_on::/blocks:: note
- **Scenario**: `lib/skills/task-audit/SKILL.md` Step 2e must state, immediately after the blockquote example, that task files should also carry one `depends_on::[[TASK-NNN]]` line per dependency and one `blocks::[[TASK-NNN]]` line per blocked task.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/task-typed-links.test.js
  ```
- **Expected Result**: `task-audit/SKILL.md documents the additive depends_on::/blocks:: typed-link lines` passes.
- **Repeatable Unit Test**: Created: `test/task-typed-links.test.js`
- **Unit Test Command**: `node --test test/task-typed-links.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-002: task-audit/SKILL.md states its own DFS/wave parser is unchanged
- **Scenario**: The load-bearing safety claim — the note must explicitly say `/task-audit`'s own parser continues to read only the blockquote above, unchanged, so the new typed-link lines cannot silently become a second, divergent parse source for cycle-detection/wave computation (Steps 2e, 3a, 3b, 3c).
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/task-typed-links.test.js
  ```
- **Expected Result**: `task-audit/SKILL.md states its own parser is unchanged and still reads only the blockquote` passes.
- **Repeatable Unit Test**: Created: `test/task-typed-links.test.js`
- **Unit Test Command**: `node --test test/task-typed-links.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-003: The typed-link note sits inside Step 2e, after the blockquote and before Step 2f
- **Scenario**: Placement matters — the note must read as part of the dependency-block spec (Step 2e), not float ambiguously between sections or land inside Step 2f's node-record logic.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/task-typed-links.test.js
  ```
- **Expected Result**: `task-audit/SKILL.md places the typed-link note after the blockquote example, inside Step 2e` passes.
- **Repeatable Unit Test**: Created: `test/task-typed-links.test.js`
- **Unit Test Command**: `node --test test/task-typed-links.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-004: task-add/SKILL.md's body template renders implements:: → depends_on:: → blocks:: on consecutive lines
- **Scenario**: TASK-057 Step 2 requires the example body template to render `depends_on::[[TASK-NNN]]` (one per dependency) and `blocks::[[TASK-NNN]]` (one per blocked task) immediately after `implements::[[DEC-NNNN#DM]]` (or in that same position when there's no decision link).
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/task-typed-links.test.js
  ```
- **Expected Result**: `task-add/SKILL.md body template renders depends_on::/blocks:: lines directly after implements::` passes.
- **Repeatable Unit Test**: Created: `test/task-typed-links.test.js`
- **Unit Test Command**: `node --test test/task-typed-links.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-005: task-add/SKILL.md documents sourcing the dependency links from the existing Step 5 data
- **Scenario**: The prose must state the `depends_on::`/`blocks::` lines are sourced from the same Step 5 dependency data task-add already collects during its Socratic flow — no new data collection introduced.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/task-typed-links.test.js
  ```
- **Expected Result**: `task-add/SKILL.md prose documents the dependency-link placement rule sourced from Step 5` passes.
- **Repeatable Unit Test**: Created: `test/task-typed-links.test.js`
- **Unit Test Command**: `node --test test/task-typed-links.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-STATIC-006: task-add/SKILL.md marks the typed links as additive, not a replacement, with no backfill
- **Scenario**: TASK-057 Step 2's explicit requirement — a short aside in the SKILL.md text must state this is additive to the existing blockquote format (not a replacement) and that no backfill of pre-existing tasks happens here.
- **Steps**:
  1. Run the promoted unit test.
- **Command**:
  ```bash
  node --test test/task-typed-links.test.js
  ```
- **Expected Result**: `task-add/SKILL.md marks the typed-link lines as additive, not a replacement, with no backfill` passes.
- **Repeatable Unit Test**: Created: `test/task-typed-links.test.js`
- **Unit Test Command**: `node --test test/task-typed-links.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-001: No pre-existing task file was backfilled with typed links
- **Scenario**: TASK-057's Approach explicitly forbids retroactively backfilling existing task files (e.g. TASK-031, TASK-039) — the typed-link lines are declared now and backfilled later only by a future `/wiki-lint` pass, per `wiki/conventions.md` §3.
- **Steps**:
  1. Run the command below from the repo root.
- **Command**:
  ```bash
  grep -lE 'depends_on::\[\[TASK-NNN\]\]|blocks::\[\[TASK-NNN\]\]' wiki/work/tasks/TASK-031*.md wiki/work/tasks/TASK-039*.md
  ```
- **Expected Result**: No output (zero matches) — neither TASK-031 nor TASK-039 carries a `depends_on::`/`blocks::` typed-link line. (Verified at generation time via `mcp__serena__search_for_pattern` against both files — zero hits.)
- **Repeatable Unit Test**: Not applicable: a point-in-time acceptance check against two arbitrary pre-existing task files, not a durable regression — a permanent test asserting "TASK-031 has no typed links" would still pass vacuously after a legitimate future `/wiki-lint` backfill, and would then be testing the wrong thing.
- [x] Pass <!-- 2026-08-14 -->

### UAT-MANUAL-001: Known gap — task-add's own template still never renders the Depends-on/Blocks blockquote itself
- **Description**: Informational, out of scope for TASK-057 to fix (flagged in the source task's own tackle-run notes). `lib/skills/task-add/SKILL.md`'s body template renders `implements::`/`depends_on::`/`blocks::` typed links, but never renders the `> **Depends on**:`/`> **Blocks**:` blockquote itself that `task-audit/SKILL.md` and `task-update/SKILL.md` expect and parse. A task created purely by following `task-add`'s template literally would have typed links but an absent (or manually-added) blockquote, which `task-audit`'s Step 2e treats as `Depends on: none, Blocks: none` regardless of what the typed links say — a silent mismatch between the two formats for brand-new tasks specifically.
- **Steps**:
  1. Read `lib/skills/task-add/SKILL.md` Step 8's body template (~lines 116-143) and confirm the `> **Depends on**:`/`> **Blocks**:` blockquote never appears in the rendered example or its surrounding prose.
  2. Confirm (via Serena `find_referencing_symbols`-equivalent text search) that only `task-audit/SKILL.md` and `task-update/SKILL.md` reference/expect the blockquote; `task-add/SKILL.md` does not.
- **Expected Result**: Confirmed gap — this is pre-existing behavior TASK-057 did not introduce and was not asked to fix. Recorded here so it isn't silently lost; a follow-up task should add the blockquote to task-add's template (not just the typed links) so `/task-audit` can compute dependency waves for tasks created from today onward without relying on an agent adding the blockquote by hand.
- **Repeatable Unit Test**: Not applicable: documents an intentional-scope boundary (a known gap to fix later), not a regression to guard against; a test asserting "the blockquote is absent" would be backwards — it would need to be deleted, not extended, the moment the gap is actually fixed.
- [x] Pass <!-- 2026-08-14 -->

---

## Gaps found while generating this UAT

1. **`wiki/conventions.md` §3's typed-link vocabulary lists `depends_on` but not `blocks`.** TASK-057's own Approach section states "`depends_on` and `blocks` are already valid words in `wiki/conventions.md`'s typed-link vocabulary" — verified only half true: the vocabulary line (`wiki/conventions.md:37`) reads `derived_from, supersedes, superseded_by, implements, uses, depends_on, contradicts, relates_to, caused, fixed` — `blocks` is absent. This does not block TASK-057's acceptance (its two Steps only touch the SKILL.md files, not `wiki/conventions.md`), and `blocks` is a semantically obvious inverse of `depends_on` in the same spirit as the existing list, but a future `/wiki-lint` pass or a small follow-up edit should add `blocks` to the vocabulary line so the two SKILL.md files' claim becomes fully accurate rather than half-accurate.
2. **Known gap, not a defect**: see UAT-MANUAL-001 above — task-add's template still omits rendering the blockquote itself.
