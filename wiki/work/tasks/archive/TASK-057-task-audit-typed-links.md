---
id: TASK-057
title: "Reconcile /task-audit's Depends-on/Blocks blockquote with rel::[[target]]"
status: done
created: 2026-08-13
updated: 2026-08-14
depends_on: []
blocks: []
parallel_safe_with: [TASK-053, TASK-054, TASK-056]
uat: "[[UAT-057]]"
tags: [obsidian, breadcrumbs, task-audit, typed-links]
---

# TASK-057 — Reconcile /task-audit's Depends-on/Blocks blockquote with rel::[[target]]

## Objective

Make task files ALSO emit `rel::[[target]]` typed-link lines (`depends_on::[[TASK-NNN]]`, `blocks::[[TASK-NNN]]`) alongside their existing `> **Depends on**:`/`> **Blocks**:` blockquote, so Breadcrumbs (or Dataview) can visualize task dependency graphs directly in Obsidian — without breaking `/task-audit`'s own DFS/wave-computation logic, which continues to parse the blockquote unchanged.

## Approach

ADD typed-link lines; do NOT replace or restructure the blockquote — the blockquote stays the authoritative parse source for `/task-audit`'s own cycle-detection and wave-computation logic (`lib/skills/task-audit/SKILL.md` Steps 2e, 3a, 3b, 3c). Rewriting that logic to parse typed links instead would be a much larger, riskier change and is explicitly out of scope here. `depends_on` and `blocks` are already valid words in `wiki/conventions.md`'s typed-link vocabulary — this task just makes task files actually emit them.

Two files need edits:
1. `lib/skills/task-audit/SKILL.md` — document that task files should carry the typed-link lines as an additive, Obsidian-visualization-only mirror of the blockquote (not consumed by task-audit's own parser).
2. `lib/skills/task-add/SKILL.md` — update the task-file body template (Step 8) so NEWLY created tasks emit both formats from day one, using the same dependency data task-add's own Step 5 already collects.

Do NOT retroactively backfill existing task files (e.g. TASK-031, TASK-039, or any archived task) with typed links — per `wiki/conventions.md` §3's own "declared now, backfilled later" policy, a future `/wiki-lint` pass is the natural backfill mechanism, not this task.

## Steps

### 1. Update /task-audit's dependency-block documentation <!-- agent: general-purpose -->

- [x] Read `lib/skills/task-audit/SKILL.md` Step 2e (the dependency blockquote spec, approx. lines 73-85) via Serena.
  - `Edit` to add a note immediately after the blockquote example: going forward, task files should ALSO carry one `depends_on::[[TASK-NNN]]` line per dependency and one `blocks::[[TASK-NNN]]` line per blocked task, directly below the blockquote — these are additive typed links for Obsidian/Breadcrumbs visualization; `/task-audit`'s own parser continues to read only the blockquote, unchanged.

### 2. Update /task-add's task-file body template <!-- agent: general-purpose -->

- [x] Read `lib/skills/task-add/SKILL.md` Step 8 (the task-file body template, approx. lines 116-141) via Serena.
  - `Edit` the example body template to render `depends_on::[[TASK-NNN]]` (one per dependency) and `blocks::[[TASK-NNN]]` (one per blocked task) lines, placed immediately after the `implements::[[DEC-NNNN#DM]]` line (or in that same position when there's no decision link), sourced from the same Step 5 dependency data task-add already collects during its own Socratic flow.
  - Note explicitly in the SKILL.md text (a short comment/aside, not a step) that this is additive to the existing blockquote format, not a replacement, and that no backfill of pre-existing tasks happens here.

<!-- Updated: 2026-08-13 00:15 -->

## Notes

Derived from `raw/research/obsidian-setup-automation/index.md`'s Key Findings #5 (`/task-audit` does NOT automatically benefit from Breadcrumbs/Graph Link Types without this reconciliation) and Next Steps, and `wiki/work/roadmaps/ROADMAP-006-obsidian-plugin-automation.md` Phase 3.
