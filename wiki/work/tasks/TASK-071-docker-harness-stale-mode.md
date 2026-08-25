---
id: TASK-071
aliases: [TASK-071]
title: "Add a run.sh stale mode simulating an upgrade from an older bootstrap-claude release"
status: pending-uat
created: 2026-08-22
updated: 2026-08-22
depends_on: [TASK-060, TASK-070]
blocks: []
parallel_safe_with: [TASK-031, TASK-039]
uat: "[[UAT-071]]"
tags: [docker, testing, dev-tooling]
---

# TASK-071 — Add a `run.sh stale` mode simulating an upgrade from an older bootstrap-claude release

implements::[[ROADMAP-009]]
depends_on::[[TASK-060]]
depends_on::[[TASK-070]]

> **Depends on**: [[TASK-060]], [[TASK-070]]

## Objective

TASK-060 only exercises a genuinely fresh machine — no `~/.claude/skills/`, `~/.claude/hooks/`, or `~/.claude/settings.json` at all. That's the "brand new machine" path. The far more common real-world case is `update` running against a machine that already has an **older** bootstrap-claude release installed — skills/hooks/settings from a prior version, possibly an older `wiki/`/`raw/` scaffold shape. This task adds a `run.sh stale` mode, on the same image TASK-060 already built, that pre-seeds that older state and then runs `update`, confirming it migrates/refreshes everything to current rather than erroring, duplicating, or leaving stale files behind.

## Approach

Reuse TASK-060's image and `run.sh` structure exactly — this is a new invocation mode, not a new Dockerfile. "Older release" needs a concrete, reproducible source of stale state; the simplest option that doesn't require vendoring old release artifacts is to check out an older git tag/commit of *this same repo* (available inside the container via the read-only-mounted checkout at `/opt/bootstrap-claude`, since the mount includes full git history) and run *that* older version's `install-global.sh`/`setup-project.sh` first, then switch to running the *current* checkout's `update-project.sh` against the same scratch dir/`$HOME`. Confirm a suitable older tag/commit exists (e.g. the commit before the most recent `[minor]`/`[major]` release bump) before committing to this approach; if no clean older-version boundary is easy to script against, fall back to hand-authoring a minimal "stale fixture" (a handful of representative old-shaped files copied into the scratch `$HOME`/project dir) instead — pick whichever the implementing agent finds actually scriptable, and record which approach was used in Notes.

Respect TASK-070's decision on accept-path seeding — if TASK-070 chose "decline-only", this stale-harness `update` run should also stay decline-only (no accept-path pre-seeding beyond what simulating the older install naturally produces).

## Steps

### 1. Author the stale-seeding + run.sh stale mode <!-- agent: general-purpose -->

- [x] Read TASK-060's finished `test/docker/fresh-machine/run.sh` and `Dockerfile` in full to match their exact conventions (arg parsing, `set -euo pipefail`, `docker run --rm -it` invocation shape, scratch-dir handling) before adding anything.
- [x] Implement the "older release" seeding approach chosen in Approach above (older git ref bootstrap, or a hand-authored stale fixture) — read TASK-070's recorded decision on accept-path seeding first and keep this mode consistent with it.
- [x] Add `run.sh stale` as a fourth mode alongside the existing `shell`/`setup`/`update` modes: seeds the older state into a scratch dir, then runs the *current* checkout's `lib/scripts/update-project.sh` against it (using whichever invocation TASK-068 determined is correct), and exits with its exit code.
- [x] Update `test/docker/fresh-machine/README.md` (from TASK-060 step 3) to document the new `stale` mode alongside `shell`/`setup`/`update`.

### 2. Manual verification <!-- agent: general-purpose -->

- [x] Run `run.sh stale` against a fresh container and confirm it completes, or fails only for a clearly-expected reason (matching the acceptance-evidence bar TASK-060 step 4 already established) — record the actual observed behavior in this task's `## Notes` before flipping to done.

<!-- Updated: 2026-08-22 00:00 -->

## Notes

**Older-release seeding approach chosen: git-ref checkout (not a hand-authored fixture).** Confirmed a clean older-version boundary exists at commit `c33808d` (package.json version 2.23.0 — the last commit before the major 3.0.0 bump at `a5dafe3`). Since the repo mount is read-only (`:ro`) and includes full git history, `git checkout`/`git worktree add` in place isn't possible (worktree registration needs to write `.git/worktrees`), so the old tree is extracted via a read-only `git --git-dir=.../.git archive $OLD_REF | tar -x` into a writable scratch directory (`/workspace/old-bootstrap-claude`) instead.

**Accept-path seeding: intentionally NOT added to `stale` mode.** TASK-070 decided a minimal accept-path lane is worth having in general, but specified it as a distinct `run.sh accept` mode (pre-seeding two `bootstrap-prefs.js` keys) — that is separate scope, not requested by this task's own Steps checklist, and not built here. `run.sh stale` seeds state purely by running the older release's own install scripts, with no `bootstrap-prefs.js --set` pre-seeding, matching Approach's explicit "no accept-path pre-seeding beyond what simulating the older install naturally produces."

**Chaining design, informed by TASK-060's documented precedent.** TASK-060 found that both `setup-project.sh` and `update-project.sh` currently do all their real work and then fail (exit 1) only at their very last step (Serena `project.yml` bootstrap), because Serena is never registered on a fully non-interactive, decline-only run — judged a clearly-expected failure, not a defect. `run.sh stale` therefore does NOT chain the old checkout's `setup-project.sh` with `&&` (which would short-circuit before ever reaching the real test); it tolerates that expected failure and unconditionally runs the current checkout's `update-project.sh` afterward, using update's exit code as the mode's own exit code.

<!-- Updated: 2026-08-22 19:20 -->

### Step 2 manual verification (2026-08-22)

Ran `./test/docker/fresh-machine/run.sh stale` from the repo root against the image already cached from TASK-060's own verification (`docker image inspect bootstrap-claude-fresh-machine` confirmed it existed, built 2026-08-22T19:09:15Z — no `--rebuild` needed). Docker Desktop confirmed available (`docker version` → client/server 29.7.2). Full output captured (440 lines); final exit code **1**.

**Old-release seed stage (`c33808d`'s `setup-project.sh` against `/workspace/scratch-project`):** the `git archive c33808d | tar -x` extraction into `/workspace/old-bootstrap-claude` succeeded, and the old checkout's `setup-project.sh` ran to completion through all of its real work non-interactively — installed hooks/skills globally (17 hooks, ~60 skills at that older release's set, notably still including the later-removed `roadmap-add` skill), created `~/.claude/settings.json` from scratch (116 deny entries + hooks wiring + file-suggestion config + preference helper), declined all 4 MCP prompts (non-interactive), synced the full wiki scaffold into the scratch dir (index/log/hot.md, all `work/` family dirs + indexes, `knowledge/` dirs, `conventions.md`, `dashboard.html`, 6 `lifecycle.md` files, `command-anti-patterns.md`), declined the two optional guide opt-ins, wrote `CLAUDE.md` with the wiki schema + env-safety policy, backfilled aliases (none needed), declined Obsidian install (all 3 sub-prompts), and assembled `wiki/guides/mcp-tools.md`. It then failed at its final step, **"Bootstrapping Serena project.yml"**: `claude --print` could not create `.serena/project.yml` because the Serena MCP was never registered (expected — every MCP prompt auto-declined by design on this decline-only non-interactive path), exiting non-zero. Because `run.sh stale` deliberately does not chain this step with `&&`, the script printed its own stderr marker (`stale: old-release (c33808d) setup-project.sh exited non-zero — expected...`) and continued rather than aborting.

**Current update stage (`update-project.sh` against the same seeded scratch dir):** ran to completion through all of its real work — re-installed hooks (no new hooks to add) and skills (added skills new since `c33808d`: `roadmap-assess/`, plus refreshed `roadmap-create/SKILL.md` and `roadmap-next/SKILL.md` to their current versions — consistent with ROADMAP-009's `/roadmap-next` split and `roadmap-add` removal landing after the seed commit), found the deny list and hooks wiring already up to date (no-op merges), found file-suggestion config already set, reinstalled the preference helper, declined all 4 MCP prompts again, synced the wiki scaffold (added one new `lifecycle.md` not present at the seed release, declined the two optional guide opt-ins again), found `CLAUDE.md` already had both the wiki schema section and the env-safety policy (skipped, no duplication), found aliases already up to date, declined Obsidian again, and rebuilt `wiki/guides/mcp-tools.md`. It then failed at the identical final step, **"Bootstrapping Serena project.yml"**, for the identical reason (Serena never registered on this decline-only run) — exit code **1**, which became `run.sh stale`'s own exit code per its documented design (`exec ... update-project.sh` is the last command in the chain).

**Judgment: meets the acceptance bar.** No genuine problems occurred anywhere in the pipeline — `git archive` extraction succeeded, the old checkout's scripts existed and ran compatibly (no missing-dependency or old/new incompatibility errors), and `update-project.sh` completed all of its real migration/refresh work cleanly (notably: it visibly refreshed the skill set from the old release's shape to the current one, which is exactly the "migrates/refreshes everything to current" behavior this task's Objective describes) before failing only at the same Serena-bootstrap last step TASK-060 already established as a clearly-expected, non-defect failure under decline-only non-interactive runs. This is judged equivalent to TASK-060's own accepted outcome and sufficient to flip this task to done.

