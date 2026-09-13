---
id: wiki-work-family-naming
title: "Research: Naming Inconsistencies Across the wiki/work/ Family Skills"
updated: 2026-09-13
sources:
  - ../../../raw/research/wiki-work-family-naming/index.md
confidence: extracted
tags: [wiki-work, skills, naming]
---

**Every `wiki/work/<family>/lifecycle.md` agrees on a `PREFIX-NNN(N)-slug.md` filename**, and every file that actually exists on disk (tasks, UAT, bugs, roadmaps — decisions and requirements have none yet) already matches it. Four of the six creation skills (`task-add`, `uat-generate`, `decision-create`, `req-create`) write and reference exactly that prefixed form. **`bug-file` and `roadmap-create` are stale outliers**: their own SKILL.md text instructs writing a *bare* `NNN(N)-slug.md` filename (no `BUG-`/`ROADMAP-` prefix) — contradicting their own family's `lifecycle.md`, contradicting sibling skills in the same family (`bug-triage`, `bug-close`, `roadmap-next`, `roadmap-assess` all already assume the prefixed form), and contradicting every file that exists. `bug-file` even contradicts itself internally (Step 6 writes bare, Step 7's index link is already prefixed).

Git history dates this to the wiki2 migration (`a36905e`, 2026-06-11): `lifecycle.md` files and the current prefixed-filename convention were formalized then across all six families, and four of six creation skills were updated to match — but `bug-file` and `roadmap-create` (both older, from the pre-wiki2 `.docs/` era) were **missed**. `roadmap-next/SKILL.md:42` carries a second symptom of the same miss: a stale fallback comment ("`003-billing.md` → `ROADMAP-003`") describing the wrong, bare filename shape — likely dead code since frontmatter `id:` is read first, but it documents the wrong convention for a future reader regardless.

Separately, and **not** a bug: the ID *width* itself splits 3-digit (tasks, UAT, requirements, roadmaps) vs. 4-digit (bugs, decisions), consistently within each family but with **no documented rationale anywhere** in the repo for why bugs/decisions get the extra digit.

Full report + primary-source register: `raw/research/wiki-work-family-naming/{index,sources}.md`. See `concept::[[wiki-work-filename-convention]]` for the distilled, durable convention page this source produced.
