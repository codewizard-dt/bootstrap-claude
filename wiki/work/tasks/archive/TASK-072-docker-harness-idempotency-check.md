---
id: TASK-072
aliases: [TASK-072]
title: "Docker harness idempotency check — run update twice, diff scratch state"
status: done
created: 2026-08-22
updated: 2026-08-27
depends_on: [TASK-060]
blocks: []
parallel_safe_with: [TASK-073, TASK-031, TASK-039]
uat: "[[UAT-072]]"
tags: [docker, testing, dev-tooling]
---

# TASK-072 — Docker harness idempotency check — run `update` twice, diff scratch state

implements::[[ROADMAP-009]]
depends_on::[[TASK-060]]

> **Depends on**: [[TASK-060]]

## Objective

Research for ROADMAP-009 identified "run the target script twice and diff" as the dominant idempotency-testing pattern across every source consulted. TASK-060's own `run.sh update` mode already runs `setup` once then `update` once (to exercise `update` against real prior state) — but it never verifies that running `update` a **second** time against the same scratch project is a true no-op. This task adds that second-run check on top of the harness TASK-060 built.

## Approach

Extend `run.sh` (from TASK-060) rather than building a separate script — add a mode (e.g. `run.sh idempotency`) that: runs `setup`, then `update`, snapshots the scratch project + relevant `$HOME/.claude/` state (file listing + content hashes, not a full diff of every byte — timestamps will legitimately differ), runs `update` again, and asserts the second snapshot matches the first (modulo expected volatile files like logs, if any). Exit non-zero with a clear diff summary on mismatch.

## Steps

### 1. Implement the second-run idempotency check <!-- agent: general-purpose -->

- [x] Read TASK-060's finished `run.sh` in full to match its existing mode-dispatch conventions before adding a new one.
- [x] Add an `run.sh idempotency` mode: `setup` → snapshot (e.g. `find <scratch> -type f -exec sha256sum {} +` sorted, covering both the scratch project dir and the relevant `$HOME/.claude/` paths) → `update` → snapshot again → `update` a second time → snapshot a third time → assert snapshot 2 equals snapshot 3 (post-first-update state is stable across a repeat `update`), printing a diff and exiting non-zero on mismatch.
- [x] Document the new mode in `test/docker/fresh-machine/README.md` (from TASK-060 step 3).

### 2. Manual verification <!-- agent: general-purpose -->

- [x] Run `run.sh idempotency` against a fresh container and confirm it passes (snapshots 2 and 3 match), or fails with a clear, actionable diff if `update` is not currently idempotent — record the actual observed result in this task's `## Notes` before flipping to done. A genuine non-idempotency finding here is valuable signal, not a task failure — report it plainly either way.

## Notes

<!-- Updated: 2026-08-22 -->
Step 1 implementation complete: `run.sh idempotency` mode added to `test/docker/fresh-machine/run.sh` following existing mode-dispatch conventions (setup → snapshot1 → update → snapshot2 → update → snapshot3 → diff snapshot2 vs snapshot3, sha256sum-based snapshot of scratch dir + `$HOME/.claude/`, exits non-zero with `diff -u` on mismatch). README.md documented. `bash -n` clean.

Adding `idempotency` to the mode list broke the usage-string regex test in `test/docker-fresh-machine.test.js` (same class of break TASK-071 fixed for `stale`) — fixed in the same cycle by extending the regex alternation to include `idempotency`. All 24 tests in that file pass standalone.

<!-- Updated: 2026-08-22 -->
**Step 2 manual verification — observed result: FAIL, but not a non-idempotency finding.**

Ran `./test/docker/fresh-machine/run.sh idempotency` against the already-built `bootstrap-claude-fresh-machine` image (no `--rebuild` needed). Docker was available and functioning throughout.

Observed exit code: **1** (non-zero). Full container output captured.

The run did **not** reach the idempotency assertion at all — it never got past the very first `setup-project.sh` call inside the `idempotency` mode's `bash -c` script. `setup-project.sh` printed its normal non-interactive setup sequence (hooks, skills, deny-list, wiki scaffold, alias backfill, Obsidian skip, MCP-tools guide) and then failed at the "Bootstrapping Serena project.yml..." step:

```
Error: .serena/project.yml was not created by 'claude --print'.
Ensure Serena MCP is registered for this project — run 'npx @codewizard-dt/bootstrap setup' and answer Yes to the Serena prompt,
or register it manually (from the project root): claude mcp add --scope local serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "/workspace/scratch-project"
Then re-run 'npx @codewizard-dt/bootstrap update'.
```

This is the same pre-existing, already-documented limitation noted in `test/docker/fresh-machine/README.md` ("Known limitation" section): `setup-project.sh` and `update-project.sh` both exit non-zero on this fully non-interactive, decline-only path because Serena is never registered. `run.sh stale` was built to tolerate exactly this expected seed-step failure (`|| echo '...expected...' >&2`, deliberately not `&&`-chained). The `idempotency` mode's inline script, however, chains its steps with `;` under `set -euo pipefail` and does **not** apply that same tolerance to its seeding `setup-project.sh` call — so `-e` aborts the whole chain at the first failure, before snapshot-1 is ever taken, before `update-project.sh` runs even once, and long before the snapshot2-vs-snapshot3 comparison the mode exists to perform.

**Conclusion:** this is a harness/script-error finding, not a real update-project.sh non-idempotency finding — no data diff between snapshot2 and snapshot3 was ever produced or compared, so idempotency itself remains unverified by this run. The `idempotency` mode as currently written cannot complete in this environment (or any environment without Serena pre-registered/non-interactively-declinable) because it doesn't mirror `stale` mode's tolerance for the known expected seed-step failure. Suggested follow-up (not applied here — this step was verification-only): give the `idempotency` mode's initial `setup-project.sh` call (and possibly each `update-project.sh` call) the same `|| echo '...expected...' >&2` tolerance pattern used by `stale` mode, so the chain can proceed to the actual snapshot/diff assertion despite the known Serena-bootstrap non-interactive failure.

<!-- Updated: 2026-08-22 -->
**Step 2 follow-up fixes applied, then re-verified — final observed result: PASS.**

Two fixes were applied on top of the initial implementation, in response to what the manual verification runs actually surfaced:

1. **Seed-step tolerance.** The `idempotency)` case's `setup-project.sh` call was chained with plain `;` under `set -euo pipefail` with no tolerance for the documented, expected non-interactive Serena-bootstrap failure — unlike `stale` mode's seed step, which already tolerates this via `|| echo '...expected...' >&2`. Fixed by applying the identical tolerance pattern to the seed call.
2. **Update-step tolerance.** Re-running after fix 1 showed the same underlying failure also aborts `update-project.sh` itself — confirmed via README.md's own "Known limitation" section, which already documented that **both** `run.sh setup` and `run.sh update` exit non-zero at this same Serena-bootstrap step non-interactively. Since this is a pre-existing, environment-wide limitation (not specific to this task), both `update-project.sh` calls (producing snapshot-2 and snapshot-3) were given the same tolerance treatment. The snapshot-2-vs-snapshot-3 diff comparison itself remains fully untolerated — that comparison is still the mode's real, genuine assertion.

With both fixes in place, a re-run reached the real comparison and found one genuine diff: a new Claude Code session-transcript file (`~/.claude/projects/-workspace-scratch-project/<uuid>.jsonl`) appeared on the second `update-project.sh` run that wasn't present after the first. This is expected per-invocation volatility from the `claude --print` calls inside `bootstrap-serena.sh` — exactly the "modulo expected volatile files like logs" carve-out this task's own Approach section anticipated — not real config/scaffold drift. Fixed by excluding `$HOME/.claude/projects/**/*.jsonl` from the snapshot's `find` command, with a comment explaining why.

**Final fresh run result** (log: `idempotency-run3.log`, confirmed via a blocking poll on the actual background process, not a stale/reused log file): **exit code 0**, `idempotency: PASS — a second update-project.sh run against the same scratch dir is a true no-op (identical scratch-project + $HOME/.claude state)`. Snapshot-2 and snapshot-3 are byte-identical (no diff output). Both `setup-project.sh` and both `update-project.sh` calls still log their expected non-interactive Serena-bootstrap failures (per the documented Known limitation), but these are now correctly tolerated and do not affect the real assertion.

**Conclusion:** `update-project.sh` **is** idempotent on a second run against the same scratch project, once session-transcript noise is excluded from the comparison. The harness itself required two follow-up fixes (seed/update tolerance, transcript exclusion) to actually reach and validate this assertion — both are now in `test/docker/fresh-machine/run.sh`.

