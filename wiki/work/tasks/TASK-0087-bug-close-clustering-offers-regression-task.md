---
id: TASK-0087
aliases: [TASK-0087]
title: "bug-close's tag-clustering signal becomes an offered regression-task suggestion"
status: pending-uat
created: 2026-09-13
updated: 2026-09-13
depends_on: []
blocks: []
parallel_safe_with: [TASK-0086, TASK-0088, TASK-0089, TASK-0090, TASK-0091, TASK-0092, TASK-0093]
uat: "[[UAT-0087]]"
tags: [bugs, skill-affordance]
---

# TASK-0087 — bug-close's tag-clustering signal becomes an offered regression-task suggestion

relates_to::[[wiki-work-family-cross-linking-gaps]]

## Objective

`lib/skills/bug-close/SKILL.md` Step 10 already computes a real signal — "a one-line clustering check — search `wiki/work/bugs/archive/` for the last 3 closes with overlapping `Tags` and surface them as 'related recent closes' so the user can spot systemic issues" — but today it only prints the observation and stops. When ≥2 related closes share tags with the bug just closed, that is exactly the pattern a regression task or roadmap note exists to catch. Turn the discarded signal into an **offered** next action.

## Approach

**Source-of-truth note**: edit `lib/skills/bug-close/SKILL.md` in this repo, never `~/.claude/skills/bug-close/SKILL.md` — the latter is a machine-local copy installed by `install-global.sh`, overwritten on the next sync.

Extend Step 10's existing clustering search rather than adding a new mechanism — the search already runs on every `verified` close, so no new trigger point is needed, only a follow-up prompt when the cluster is non-trivial (≥2 related closes, not just 1 — a single coincidental tag match isn't worth prompting for).

## Steps

### 1. Extend the clustering check in bug-close <!-- agent: general-purpose -->

- [x] In `lib/skills/bug-close/SKILL.md`, Step 10 ("Report Completion"), after the existing clustering-check bullet, add: if the search finds **2 or more** related recent closes (not counting the bug just closed), ask inline: `N related bugs closed recently with tag(s) <tags> — <BUG-NNNN titles>. File a regression-prevention task? (y/n)`.
- [x] On yes: invoke `Skill` `task-add` with a description referencing the clustered bug IDs and shared tag(s) (e.g. "Investigate recurring <tag> failures — see BUG-0003, BUG-0006, BUG-0009") — do not pass `--roadmap`, since there is no roadmap context here; the user can link one later via `/task-add --roadmap` if warranted.
- [x] On no (or ≤1 related close): behavior is unchanged from today — print the clustering observation and stop, no prompt.
<!-- Updated: 2026-09-13 -->

### 2. Document the new step in the bug-close report format <!-- agent: general-purpose -->

- [x] Confirm Step 10's printed report (bug ID/title, status transition, resolution summary) still prints exactly as before when the clustering check finds nothing actionable — this task must not change the report's shape for the common case (0 or 1 related close).
<!-- Updated: 2026-09-13 -->
