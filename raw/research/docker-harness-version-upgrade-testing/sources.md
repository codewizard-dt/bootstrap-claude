---
topic: "Instructions on how to use the Docker fresh-machine harness to test a brand new installation and an installation upgrading from any previous version to a new version, including seeding a few tasks/roadmaps as would exist from previous versions"
slug: docker-harness-version-upgrade-testing
researched: 2026-08-27
---

# Primary Sources — Testing brand-new installs and previous-version-to-new-version upgrades

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `git show -s --format=%ci c33808d` / `git log --oneline c33808d -1` | 2026-08-27 | `OLD_REF`'s commit message ("...make the aliases: backfill run automatically on every setup/update") and date (2026-08-15) — proves `OLD_REF` already contains the backfill wiring, not a pre-backfill snapshot |
| S2 | codebase | `wiki/work/tasks/archive/TASK-001-audit-skill-readme-drift.md` frontmatter (`created: 2026-07-06`) | 2026-08-27 | Confirms this repo's own oldest task predates `c33808d` by over five weeks, establishing that a real "old version" gap exists and is representable |
| S3 | codebase | `test/docker/fresh-machine/run.sh` (`stale)` case block, lines ~52-56) and `test/docker-fresh-machine.test.js` (`stale` mode test names) | 2026-08-27 | Confirms `stale` mode's exact mechanics: `git archive $OLD_REF`, tolerant old `setup-project.sh`, unconditional current `update-project.sh` — and that no seeding step exists anywhere in it |
| S4 | codebase | `lib/scripts/backfill-wiki-aliases.js` (header comment + `hasAliases`/`insertAliases` functions) | 2026-08-27 | Confirms the backfill is idempotent/additive-only (skips files that already have `aliases:`), which is the exact behavior a seed-based regression test would assert |
| S5 | codebase | `lib/skills/task-add/SKILL.md` Step 8 frontmatter block; `wiki/work/roadmaps/archive/ROADMAP-003-single-process-mcp-servers.md` frontmatter | 2026-08-27 | Current task/roadmap frontmatter schema, used to construct realistic seed-fixture content |
| S6 | codebase | repo-wide `search_for_pattern` for `seed\|fixture\|sample.*task\|sample.*roadmap` restricted to `test/**/*.js` | 2026-08-27 | Zero matches — confirms no existing seed/fixture mechanism exists anywhere in the test suite today |
