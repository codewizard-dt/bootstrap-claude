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