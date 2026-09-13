---
title: Tasks Index
updated: 2026-08-27
---

# Tasks — Active Items

Lists **only active** tasks (`todo`, `in-progress`). When a task leaves the active set (`done`, `trashed`), delete its line here — the file itself never moves; status lives in its frontmatter. See the [lifecycle](lifecycle.md).

Entry format: `- [TASK-NNNN — Title](TASK-NNNN-slug.md) — one-line summary · status`
- [TASK-031 — Tier 3: adopt /sandbox](TASK-031-sandbox-tier3.md) — close the script-file write path to settings.json that no hook can parse; measure breakage first, then scope · todo
- [TASK-039 — Add extensive inline comments to the hook scripts](TASK-039-hook-inline-comments.md) — targeted why-not-what commenting pass over `lib/hooks/`, heavy on the thin Serena-first files, gap-fill on the already-dense guards · pending-uat
- [TASK-074 — Switch all Serena install commands to --project-from-cwd for worktree support](TASK-074-serena-project-from-cwd.md) — install-mcps.sh, bootstrap-serena.sh, and CLAUDE.md all pass a fixed --project path; switch to --project-from-cwd so registration follows worktrees · todo
- [TASK-075 — Gate package-install-consent.js on a new packageInstall.consent preference](TASK-075-package-install-consent-preference.md) — project-scoped true|false|ask key (default false) so a project can opt out of the unconditional npm/pip/etc. install deny without weakening the guarantee elsewhere · pending-uat
- [TASK-0085 — Fix bug-file/roadmap-create filename bugs and standardize wiki/work/ IDs at 4 digits going forward](TASK-0085-normalize-wiki-work-naming.md) — corrects two stale skill-file naming bugs and moves tasks/UAT/req/roadmaps to 4-digit IDs going forward · pending-uat
- [TASK-0086 — uat-walk and uat-auto offer /bug-file inline on a [FAIL] verdict](TASK-0086-uat-fail-offers-bug-file.md) — pre-fill a bug report from a UAT failure's repro/expected/actual instead of losing it to free text · pending-uat
- [TASK-0087 — bug-close's tag-clustering signal becomes an offered regression-task suggestion](TASK-0087-bug-close-clustering-offers-regression-task.md) — turn the discarded related-closes signal into an offered /task-add · pending-uat
- [TASK-0088 — task-add's dependency scan also checks wiki/work/bugs/, writing origin_bug](TASK-0088-task-add-bug-aware-dependency-scan.md) — blocked on DEC-0001#D1 being accepted before implementation · todo
- [TASK-0089 — decision-create and roadmap-create gain an optional prior-art scan step](TASK-0089-decision-roadmap-prior-art-scan.md) — cheap knowledge/concepts + sources/ scan so ad hoc decisions/roadmaps cite existing research · pending-uat
- [TASK-0090 — Add implemented_by::/evolved_by:: reverse-pointer convention to component entity pages](TASK-0090-component-page-reverse-pointers.md) — backfills power-mode-skill.md and bootstrap-prefs-store.md; touches template-owned conventions.md · pending-uat
- [TASK-0091 — Add an optional knowledge-link flag to /task-add and /bug-file](TASK-0091-knowledge-link-flag-task-bug.md) — --knowledge <slug> flag parallel to existing --decision/--roadmap; shares a file with TASK-0088 · pending-uat
- [TASK-0092 — New wiki-lint check: validate typed-link targets actually resolve](TASK-0092-wiki-lint-typed-link-resolution.md) — adds check 2.11; shares a file with TASK-0093 · pending-uat
- [TASK-0093 — Fold decision-next's task-less-decision check into a scheduled wiki-lint/wiki-tidy pass](TASK-0093-fold-decision-next-into-wiki-lint.md) — adds check 2.12, keeps decision-next as a fast single-purpose tool · in-progress