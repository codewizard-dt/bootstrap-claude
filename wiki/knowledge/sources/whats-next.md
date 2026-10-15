---
id: whats-next
title: "Research: A Cross-Family `/whats-next` Skill (Assess + Prioritize ALL Open Work)"
aliases: [whats-next research, /whats-next]
updated: 2026-09-20
sources:
  - ../../../raw/research/whats-next/index.md
  - ../../../raw/research/whats-next/sources.md
confidence: extracted
tags: [skill-design, prioritization, work-families, orchestration]
---

Research into merging `power-mode` (executor), `roadmap-assess` (roadmap-only advisor) and `task-assess` (index-driven task advisor) into one skill that assesses **all** open work — including tasks and bugs that belong to no roadmap — and prioritizes it. **Recommendation: a new strictly read-only cross-family advisor, `/whats-next`**, following the `uat-assess` / `prd-assess` / `adr-assess` pattern, ranking by deterministic tiers (fix broken → finish in-flight → unblock → start ready → triage) tie-broken by downstream critical-path depth; execution stays in `relates_to::[[power-mode-skill]]`, reached only through an explicit `--go` flag that needs one small addition to `power-mode` (a task-ID-list dispatch). The ranking model is written up separately in `derived_from::[[cross-family-work-prioritization]]`.

**The roadmap blind spot is measurable.** On 2026-09-20 this repo had 31 active tasks (24 `pending-uat`, 6 `todo`, 1 `in-progress`), 24 pending UATs (none walked) and 9 open bugs (all `priority: "—"`, three `high` severity). 5 tasks and all 9 bugs — 14 of 40 open tasks + bugs — sit outside every active roadmap, so `power-mode`, `roadmap-assess`, `roadmap-next` and `tackle`'s roadmap auto-discovery cannot see them. Family index text is also stale as a state source (ROADMAP-0014 shows 0/9 in the index against 9 of 23 task-links checked in the file), so a sweep must read frontmatter and checkboxes, not indexes.

**Why not the obvious alternatives.** Calling the six existing `*-assess` skills in turn inherits their side effects (`bug-assess`'s `AskUserQuestion` batch triage, `roadmap-assess`'s auto-close, `task-assess`'s step auto-checking and `dependency-graph.md` overwrite), re-reads every family, and still produces no cross-family order. Folding it into `power-mode` mixes a read-only advisor with an autonomous `bypassPermissions` executor and reverses the shrink done in TASK-0100. Extending `task-assess` leaves bugs, UATs, ADRs and PRDs invisible.

**Findings flagged for the repo, not yet acted on** (this report is research only):
- `pending-uat` is a live task status — set by `tackle`, consumed by `roadmap-next`, `power-mode`, `UAT-CORE` — but is absent from `wiki/work/tasks/lifecycle.md`'s status enum (`todo | in-progress | done | trashed`) in both the live copy and the template.
- The installed `~/.claude/skills/` set still carries pre-rename skill names (`task-audit`, `decision-*`, `req-*`, `task-add`, `uat-generate`, `bug-file`); a new skill's suggested commands would be dead until ROADMAP-0014 Phase 4 lands and `install-global.sh` runs.
- `task-assess`'s rule that a dependency is resolved only once its task leaves the active index conflicts with live practice: TASK-0121 is `in-progress` while two prerequisites are only `pending-uat`. *(Inference — no document states the rule.)*
- Task `depends_on`/`blocks` arrays are asymmetric in places (TASK-0096←TASK-0093, TASK-0114←TASK-0095, TASK-0121←TASK-0097 have no matching `blocks` entry).

**Tooling gotchas learned** (recorded on `relates_to::[[serena]]`): Serena's `search_for_pattern` needs `[^\n]*` rather than `.*`, must not use `multiline=false` with `^` anchors, and wants full repo-relative include globs.

**Delivery sequencing:** after ROADMAP-0014 Phase 4 (shared README/`CLAUDE.md` table edits and renamed skills), with `depends_on: [TASK-0114, TASK-0120]`. Unmeasured: how many of the 24 pending UATs are auto-runnable.

Related: `relates_to::[[multi-agent-orchestration-patterns]]` (orchestrator + isolated workers), `relates_to::[[wiki-multi-writer-safety]]` (the shared `index.md`/`log.md` risk a `--go` wave inherits), `relates_to::[[wiki-skill-boilerplate-duplication]]` (the "reference, don't restate" pattern the design follows).
