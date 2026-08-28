---
topic: "Instructions on how to use the Docker fresh-machine harness to test a brand new installation and an installation upgrading from any previous version to a new version, including seeding a few tasks/roadmaps as would exist from previous versions"
slug: docker-harness-version-upgrade-testing
researched: 2026-08-27
sources: [./sources.md]
---

# Research: Testing brand-new installs and previous-version-to-new-version upgrades with the fresh-machine harness

> **Answer:** The existing `test/docker/fresh-machine/run.sh` already covers "brand new" (`setup` mode) end-to-end. For "old version → new version" it covers the *mechanics* of running old `setup-project.sh` then current `update-project.sh` (`stale` mode), but it seeds **nothing** into the scratch wiki first — `stale` today upgrades an empty project, not a used one. Testing the realistic case (a project with real tasks/roadmaps/decisions accumulated under an older schema) requires manually injecting fixture files between the old setup and the current update — there is no existing seeding hook, and the harness's single fixed `OLD_REF` also cannot exercise every historical migration (some, like the `aliases:` backfill, are baked into `OLD_REF` itself). This report gives a concrete manual recipe using `run.sh shell` today, plus a recommended `run.sh stale --seed` extension for repeatable coverage.

## Research Questions

- What do `run.sh setup` and `run.sh stale` actually exercise today, and what do they leave untested?
- What wiki-schema migrations exist in this repo's own history that a realistic upgrade test should exercise (missing `aliases:`, older `CLAUDE.md` without the wiki-schema section, older `wiki/guides/` tiers, etc.)?
- Does the harness's fixed `OLD_REF` (`c33808d`) actually predate those migrations, or does it already include them?
- What would realistic seed task/roadmap fixtures look like, and where in the harness's flow would they need to be injected?
- What's the concrete, usable set of instructions for a human to run this today, plus what a follow-up task would need to implement for repeatable automation?

## Current State (Codebase)

- `test/docker/fresh-machine/run.sh` has five modes: `shell` (interactive), `setup` (fresh scratch dir, `setup-project.sh` only), `update` (`setup-project.sh && update-project.sh`), `stale` (seed `$OLD_REF` via `git archive`, run its `setup-project.sh` tolerantly, then run the **current** checkout's `update-project.sh`), `idempotency` (update run twice, diff). A sixth, `live-hook`, was just added by `TASK-076` for an unrelated purpose (authenticated hook verification) — not relevant here.
- `OLD_REF="c33808d"` is a single fixed commit, chosen as "the last commit before the 3.0.0 major bump" (`run.sh` line 14, citing `TASK-071`). It is checked out via `git archive` (no working-tree checkout) into `$OLD_CHECKOUT_DIR`, and its `setup-project.sh` is run against the shared `$SCRATCH_DIR` — the **same** scratch dir the current release's `update-project.sh` runs against afterward.
- Nothing seeds `$SCRATCH_DIR`'s `wiki/work/` with any tasks, roadmaps, decisions, or bugs before `update-project.sh` runs, in either `stale` or `update` mode — both test an empty project being upgraded, never a used one.
- `lib/scripts/sync-wiki-scaffold.sh` is the actual migration surface `update-project.sh` exercises: "Copy-once for project-owned files; always-refreshes `conventions.md` and `lifecycle.md`... Delivers guides tier-wise... migrates legacy `.docs/guides/`... delivers the `## LLM Wiki` section and `.env` safety policy (copy-once, sentinel-guarded) into the target's `CLAUDE.md`" (`CLAUDE.md`'s own description). This is precisely the logic that behaves differently against an *empty* wiki (nothing to migrate) versus a *populated, aged* one (files predating a schema change).
- `lib/scripts/backfill-wiki-aliases.js` is the concrete, currently-shipped migration: "scans every `wiki/work/<family>/` file... for one that carries `id:` but no `aliases:` yet, and inserts `aliases: [<id>]`... Idempotent and additive-only." It runs on every `setup`/`update` via `lib.sh`'s `run_project_sync`.
- `c33808d`'s own commit message is **"Complete ROADMAP-008 Obsidian wikilink alias resolution and make the aliases: backfill run automatically on every setup/update"** [S1] — i.e., `OLD_REF` is not a snapshot from *before* the aliases backfill existed; it is the commit that *introduces* running it automatically. `stale` mode today therefore cannot test "an installation from before the aliases backfill existed" even though that is a real historical state real users are in (this repo's own oldest task file, `TASK-001`, was created 2026-07-06 — over five weeks before `c33808d`'s 2026-08-15 commit [S2]).
- This repo's own active/archived task and roadmap files are **not** usable as "old schema" fixtures as-is: every one of them (including `TASK-001`) already carries `aliases:`, because the backfill has already run against this repo's own wiki. A real "old version" fixture has to be deliberately authored (or an old file deliberately stripped of fields introduced later), not copied from the live wiki.
- No `test/*.js` file, and no directory under `test/docker/fresh-machine/`, contains any seed/fixture logic for tasks or roadmaps — confirmed by a repo-wide pattern search for `seed|fixture|sample.*task|sample.*roadmap` in `test/**/*.js` (zero matches).
- Current task frontmatter schema (from `lib/skills/task-add/SKILL.md`, Step 8): `id, aliases, title, status, created, updated, depends_on, blocks, parallel_safe_with, uat, tags`. Current roadmap schema (from `ROADMAP-003`'s own frontmatter, representative of the pattern used by `/roadmap-create`): `id, aliases, title, status, created, updated, owner, tags`.

## Key Findings

1. **"Brand new" is already fully covered.** `run.sh setup` runs `setup-project.sh` against a truly empty scratch dir inside a container that has never seen this repo's tooling before — that is a complete, accurate "fresh machine" test as-is. No changes needed there.

2. **"Old version → new version" is mechanically covered but not realistically covered.** `stale` proves the *scripts* chain correctly (old setup, tolerated Serena-bootstrap failure, current update) [S3], but it says nothing about what happens to a wiki that has actually accumulated work — which is the scenario that would actually break (a migration script assuming a shape that a real aged file doesn't have, an index.md the backfill has to walk, a `CLAUDE.md` that already has *some* customization).

3. **The single `OLD_REF` cannot represent "any previous version."** Because `c33808d` already contains the aliases-backfill wiring, `stale` mode structurally cannot exercise "upgrading a wiki that predates the backfill" — the scenario the backfill was written for is invisible to the one fixed test point currently chosen [S1]. Any other migration introduced between an even-older commit and `c33808d` has the same blind spot. Testing "any previous version" precisely, as asked, means either (a) parameterizing `OLD_REF` so multiple historically-significant commits can be tested, or (b) accepting one fixed `OLD_REF` but *manually authoring* fixture files that simulate the pre-migration shape regardless of which real commit's `setup-project.sh` produced the rest of the scaffold — (b) is far cheaper and is what this report recommends.

4. **The scratch dir is a normal, writable directory the whole way through — seeding is just file writes.** Nothing about `stale`'s mechanics prevents dropping extra files into `$SCRATCH_DIR/wiki/work/tasks/` (etc.) between the old `setup-project.sh` call and the current `update-project.sh` call; `run.sh`'s existing `bash -c "... && ..."` chaining is exactly the place a seed step would slot in, or it can be done by hand today via `run.sh shell`.

5. **A minimal, realistic seed set only needs to hit the one migration that's actually shipped today** (the aliases backfill) **plus a couple of structurally-normal items to prove the update doesn't disturb unrelated content.** Concretely: one task file with `id:`/no `aliases:` (pre-backfill shape), one roadmap file the same way, and one already-conformant task/roadmap pair to prove idempotence (the backfill must not touch files that already have `aliases:`, per its own "idempotent skip" comment in `backfill-wiki-aliases.js`).

## Constraints

- `raw/` immutability rules and this repo's own "never `sed`/sed-edit task files" conventions apply to any fixture *content* the same way they'd apply to real wiki files — fixtures should be written with `Write`, following the exact frontmatter shape `/task-add`/`/roadmap-create` produce, not an approximation.
- The container's scratch dir (`/workspace/scratch-project`) is destroyed with the container (`--rm`) — seed files live only in the harness's own repo (bind-mounted read-only) or are generated inline in the `bash -c` script; they cannot be written into the read-only-mounted repo path at container run time.
- Any new `run.sh` flag must not change the existing `setup|update|stale|idempotency|live-hook` modes' behavior — this harness has a strong precedent (established across `TASK-060/069/070/071/072/076`) of additive, opt-in extensions only.
- `stale`'s existing tolerance for the old release's expected non-interactive Serena-bootstrap failure (`|| echo ... expected ...`) must be preserved for any new step — seeding must not turn that expected, tolerated failure into something that aborts the `bash -c` chain under `set -euo pipefail` unexpectedly.

## Recommendation

**Immediate (usable today, no code changes) — manual instructions:**

1. `test/docker/fresh-machine/run.sh shell` — get an interactive container with the repo bind-mounted read-only.
2. Inside the container, seed the *old* release and run its setup, exactly like `stale` mode does:
   ```sh
   mkdir -p /workspace/scratch-project /workspace/old-bootstrap-claude
   git --git-dir=/opt/bootstrap-claude/.git archive c33808d | tar -x -C /workspace/old-bootstrap-claude
   /workspace/old-bootstrap-claude/lib/scripts/setup-project.sh /workspace/scratch-project
   # (tolerate the expected Serena-bootstrap failure, same as stale mode)
   ```
3. **Seed realistic old-version content** before upgrading — write, e.g., `/workspace/scratch-project/wiki/work/tasks/TASK-001-seed-example.md` with frontmatter `id: TASK-001` / `title: "..."` / `status: todo` / `created:`/`updated:` **and no `aliases:` line** (the pre-backfill shape), add its bullet to `wiki/work/tasks/index.md`, and do the same for one `wiki/work/roadmaps/ROADMAP-001-seed-example.md`. Optionally add one already-conformant task (with `aliases:` already present) to prove the update leaves it untouched.
4. Run the **current** checkout's update: `/opt/bootstrap-claude/lib/scripts/update-project.sh /workspace/scratch-project`.
5. Verify: the seeded task/roadmap files now have `aliases: [TASK-001]` / `aliases: [ROADMAP-001]` inserted (backfill worked), the already-conformant file's `aliases:` line is byte-identical to before (idempotent skip worked), and nothing else in the seeded files changed.

**Follow-up (for repeatable, non-interactive coverage) — extend the harness:**

Add a `test/docker/fresh-machine/seed-fixtures/` directory holding 2–3 small, hand-authored task/roadmap markdown files in the **pre-aliases-backfill shape** (no `aliases:` line, otherwise matching the current frontmatter schema), plus their `index.md` bullets. Extend `run.sh stale` (or add a `stale-seeded` mode, following this harness's existing pattern of additive modes) to `docker cp`/mount these fixtures into `$SCRATCH_DIR/wiki/work/...` immediately after the old release's `setup-project.sh` call and before the current `update-project.sh` call, then assert (mirroring the `idempotency` mode's snapshot-and-diff style) that every seeded file gained exactly one `aliases:` line and nothing else changed. This turns the manual recipe above into a real, CI-eligible regression test for the one migration this repo currently ships, and gives a template for adding a new fixture whenever a future migration script is added.

**Risks and mitigations:** hand-authored fixtures can drift from the real historical schema over time — mitigate by dating each fixture file in a comment noting which pre-migration commit range it represents, so a future schema change prompts an explicit fixture review rather than silent staleness. **Alternative if constraints change:** if a second migration script is ever added (schema drift beyond aliases), parameterize `OLD_REF` itself (e.g. `run.sh stale --old-ref <sha>`) so a specific historical commit can be tested directly instead of only via hand-authored fixtures — not worth building until there is a second real migration to justify it.

## Next Steps

- `/task-add Add test/docker/fresh-machine/seed-fixtures/ (pre-aliases-backfill task + roadmap fixtures) and extend run.sh stale to seed them before the current update-project.sh call, asserting the backfill fixes exactly what it should and nothing else` — implements the follow-up recommendation above.
- Run `/wiki-ingest raw/research/docker-harness-version-upgrade-testing/index.md` to fold this into the knowledge base (a natural home: extend `wiki/knowledge/sources/docker-fresh-machine-test-harness.md` or its linked component/concept pages with this upgrade-testing gap).
