---
id: TASK-0093
aliases: [TASK-0093]
title: "Fold decision-next's task-less-decision check into a scheduled wiki-lint/wiki-tidy pass"
status: pending-uat
created: 2026-09-13
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: [TASK-0086, TASK-0087, TASK-0088, TASK-0089, TASK-0090, TASK-0091]
uat: "[[UAT-0093]]"
tags: [wiki-lint, wiki-tidy, decisions]
---

# TASK-0093 — Fold decision-next's task-less-decision check into a scheduled wiki-lint/wiki-tidy pass

relates_to::[[wiki-work-family-cross-linking-gaps]]

## ⚠️ Shares a file with TASK-0092 — do not tackle simultaneously

Both this task and `TASK-0092` edit `lib/skills/wiki-lint/SKILL.md` (`TASK-0092` adds "## 2.11"; this task adds "## 2.12"). Tackle `TASK-0092` first, then this one — sequential, not parallel. This is an orchestration note, not a logical dependency, so `depends_on`/`blocks` stay empty. If this task is somehow tackled first, use section number `2.11` instead and let `TASK-0092` become `2.12`.

## Objective

`/adr-next` exists solely to catch `accepted` decisions with no `Source task(s):` reference — a real gap, but one that only surfaces when a human remembers to run a separate, easy-to-forget command. Add the equivalent check to `/wiki-lint` so it surfaces automatically on every `/wiki-tidy` sweep, **without deleting or degrading `/adr-next`** — it stays available as a fast (Haiku-model), single-purpose tool for someone who just wants this one answer.

## Approach

**Source-of-truth note**: edit `lib/skills/wiki-lint/SKILL.md`, `lib/skills/wiki-tidy/SKILL.md`, and `lib/skills/adr-next/SKILL.md` in this repo, never their `~/.claude/skills/` counterparts — those are machine-local copies installed by `install-global.sh`, overwritten on the next sync.

This is additive, not a replacement: `/wiki-lint` gains a new check that reimplements `/adr-next`'s Step 2 scan logic (task-less accepted decisions) at the "report all instances" granularity `/wiki-lint` already uses everywhere else, versus `/adr-next`'s "stop at the first gap" design. `/adr-next` itself gets a one-line cross-reference so a future reader isn't confused about which tool to reach for.

## Steps

### 1. Add check 2.12 to wiki-lint <!-- agent: general-purpose -->

- [x] In `lib/skills/wiki-lint/SKILL.md`, after the check added by `TASK-0092` (or after 2.10 if that task hasn't landed yet), add "### 2.12 Task-less accepted decisions (MEDIUM)".
- [x] Port `lib/skills/adr-next/SKILL.md`'s "## Step 2: Scan Each File for Task-less Accepted Decisions" logic verbatim (parse `## D*` blocks, check `Status: accepted` + `### Links` → `Source task(s):`), but **report every instance found** across all decision files, not just the first — matching `/wiki-lint`'s existing "report all, fix none without approval" contract, unlike `/adr-next`'s "stop at first gap" design.
- [x] Report format: `[MEDIUM] task-less accepted decision — DEC-NNNN#DM (<title>) has no Source task(s) link`.

### 2. Reference (don't restate) from wiki-tidy <!-- agent: general-purpose -->

- [x] <!-- Updated: 2026-09-19 — wiki-lint actually has 13 checks (2.0–2.12; 2.10 provenance was never in wiki-tidy's list), so the wording landed as "all 13 checks" and includes provenance --> In `lib/skills/wiki-tidy/SKILL.md` "## Phase 1: Lint", update the "Run all 10 checks" list to say "all 12 checks" and add the two new check names, matching the existing "reference, don't restate" pattern this repo already uses successfully elsewhere (`UAT-CORE.md`; `roadmap-assess`→`roadmap-next`) rather than inlining the check logic into `wiki-tidy` itself.

### 3. Cross-reference from decision-next <!-- agent: general-purpose -->

- [x] In `lib/skills/adr-next/SKILL.md`, add one line near the top (after the description, before "## Step 0"): "This same check now also runs as part of `/wiki-lint` (check 2.12) for scheduled sweeps across every decision file at once — use this skill directly when you want just the next single gap, fast."
- [x] Do not change `/adr-next`'s own behavior (still stops at the first gap, still Haiku-model, still narrow) — this task only adds the cross-reference note.
