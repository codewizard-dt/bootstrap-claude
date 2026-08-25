---
title: Tasks Index
updated: 2026-08-15
---

# Tasks — Active Items

Lists **only active** tasks (`todo`, `in-progress`). When a task leaves the active set (`done`, `trashed`), delete its line here — the file itself never moves; status lives in its frontmatter. See the [lifecycle](lifecycle.md).

Entry format: `- [TASK-NNN — Title](TASK-NNN-slug.md) — one-line summary · status`
- [TASK-031 — Tier 3: adopt /sandbox](TASK-031-sandbox-tier3.md) — close the script-file write path to settings.json that no hook can parse; measure breakage first, then scope · todo
- [TASK-039 — Add extensive inline comments to the hook scripts](TASK-039-hook-inline-comments.md) — targeted why-not-what commenting pass over `lib/hooks/`, heavy on the thin Serena-first files, gap-fill on the already-dense guards · pending-uat
- [TASK-060 — Docker fresh-machine test harness for setup/update](TASK-060-docker-fresh-machine-harness.md) — generic Ubuntu image + mounted-repo run script to emulate `setup`/`update` on a machine with no prior Claude infrastructure · pending-uat
- [TASK-071 — Add a run.sh stale mode simulating an upgrade from an older bootstrap-claude release](TASK-071-docker-harness-stale-mode.md) — complements TASK-060's brand-new-machine path with an already-installed-older-release upgrade path · pending-uat
- [TASK-072 — Docker harness idempotency check — run update twice, diff scratch state](TASK-072-docker-harness-idempotency-check.md) — verify a second `update` run against the same scratch project is a true no-op · pending-uat
- [TASK-073 — Wire a GitHub Actions CI job for the Docker fresh-machine harness](TASK-073-docker-harness-ci-job.md) — build the image and run setup/update non-interactively on ubuntu-latest, no Docker-in-Docker needed · pending-uat
- [TASK-067 — Per-key sticky refresh for .obsidian/graph.json instead of whole-file skip-if-present](TASK-067-graph-json-per-key-refresh.md) — replace the whole-file "already present, skip" check with a per-key fingerprinted refresh that keeps template-owned keys in sync while asking (once, stickily) before overwriting a diverged key · pending-uat
- [TASK-074 — Switch all Serena install commands to --project-from-cwd for worktree support](TASK-074-serena-project-from-cwd.md) — install-mcps.sh, bootstrap-serena.sh, and CLAUDE.md all pass a fixed --project path; switch to --project-from-cwd so registration follows worktrees · todo
