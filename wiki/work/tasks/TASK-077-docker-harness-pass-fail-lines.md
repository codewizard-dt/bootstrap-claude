---
id: TASK-077
aliases: [TASK-077]
title: "Docker harness: add PASS/FAIL status lines to setup/update/stale modes, and fix update mode's && short-circuit so update-project.sh actually runs"
status: todo
created: 2026-08-29
updated: 2026-08-29
depends_on: []
blocks: []
parallel_safe_with: []
uat: ""
tags: [docker, testing, dev-tooling]
---

# TASK-077 — Docker harness: add PASS/FAIL status lines to setup/update/stale modes, and fix update mode's && short-circuit so update-project.sh actually runs

## Objective

`test/docker/fresh-machine/run.sh`'s `idempotency` mode already emits an unambiguous `idempotency: PASS`/`idempotency: FAIL` line with a matching exit code, which let UAT-072's own Manual case be promoted to automated live-command evidence (2026-08-27 reassessment, closed TASK-072). `setup`, `update`, and `stale` modes have no equivalent — their exit code alone is ambiguous, because `setup-project.sh`/`update-project.sh` currently *always* fail (exit 1) at the documented, expected Serena `project.yml` bootstrap step on a fully non-interactive run, so a bare non-zero exit can't distinguish "failed only at the known point" from "failed for a new, different reason." This task adds the same PASS/FAIL pattern to `setup`/`update`/`stale`, so UAT-060's `UAT-EDGE-011` and UAT-071's `UAT-EDGE-004` — currently Manual, permanently human-only for exactly this reason — can be promoted to live-command cases the same way UAT-060's `UAT-EDGE-010` and UAT-072's `UAT-EDGE-003` already were.

Additionally (per explicit user decision during `/task-add`): `update` mode currently chains `setup-project.sh && update-project.sh` with a hard `&&`, so `update-project.sh`'s own code has **never actually run** in this harness — `setup-project.sh` always fails first, short-circuiting the chain. This is presently documented and "pinned" as expected behavior in UAT-060's `UAT-EDGE-011`, not treated as a defect. This task fixes that: `update` mode moves to tolerant chaining (matching `stale`'s and `idempotency`'s existing pattern), so `update-project.sh` finally gets exercised, and its own PASS/FAIL check is checking something real instead of re-validating `setup-project.sh`'s already-known failure point a second time.

## Approach

**PASS/FAIL determination logic** (shared shape across `setup`/`update`/`stale`): capture a script's stdout+stderr to a temp file, still `cat` it through so the operator sees full output, then classify:
- Exit 0 → `PASS` (the known limitation got fixed upstream — also a legitimate pass, not just the expected-failure path).
- Exit non-zero **and** the captured output contains the exact marker `Error: .serena/project.yml was not created by 'claude --print'.` (from `lib/scripts/bootstrap-serena.sh:49`) → `PASS` (failed only at the documented, expected point, nothing earlier).
- Exit non-zero **and** the marker is absent → `FAIL` (failed before or beyond the expected point — a real regression).

This is a plain `grep -q` check against the captured output file, no new infrastructure. Mirrors `idempotency` mode's own "capture, tolerate the known failure, then make the REAL assertion" structure — the "real assertion" here is "did it fail at the *right* place," not "did it fail at all."

**`update` mode's `&&` fix**: change from `setup-project.sh && update-project.sh` to the same tolerant-subshell pattern `stale`/`idempotency` already use (`(setup-project.sh ... || true); update-project.sh ...`), so `update-project.sh` always runs regardless of `setup-project.sh`'s outcome. `update` mode's own PASS/FAIL line is then judged against `update-project.sh`'s output/exit code specifically (the same logic above), not `setup-project.sh`'s.

**Downstream UAT updates are part of this task, not a follow-up** — the entire point of the PASS/FAIL lines is to make `UAT-EDGE-011` (UAT-060) and `UAT-EDGE-004` (UAT-071) automatable, so this task promotes them directly, following the exact pattern already used for `UAT-060`'s `UAT-EDGE-010` and `UAT-072`'s `UAT-EDGE-003` (2026-08-27): add a `**Command**:` field, update Expected Result to check for the new PASS line + exit code, reset the status line to `- [ ] Pass`, and update the `Repeatable Unit Test` note to explain the reclassification. `UAT-EDGE-011`'s own text currently describes the `&&`-short-circuit as an intentional, pinned limitation — that description must be corrected to reflect the fix, not left stale and contradicted by the new passing behavior.

## Steps

### 1. Add PASS/FAIL detection to `setup` mode, and fix + add it to `update` mode's tolerant chaining  <!-- agent: general-purpose -->

- [ ] In `test/docker/fresh-machine/run.sh`'s `setup)` case body, change the `docker run` script from `mkdir -p '$SCRATCH_DIR' && '$MOUNT_PATH/lib/scripts/setup-project.sh' '$SCRATCH_DIR'` to capture `setup-project.sh`'s combined stdout+stderr to a temp file (`mktemp`), `cat` it back out, then classify per the Approach section's PASS/FAIL logic against the exact marker string `Error: .serena/project.yml was not created by 'claude --print'.`: print `setup: PASS — setup-project.sh completed successfully` (exit 0 case) or `setup: PASS — setup-project.sh reached the expected, documented Serena-bootstrap failure point and nothing earlier` (expected-failure case) and `exit 0`; otherwise print `setup: FAIL — setup-project.sh failed before or beyond the expected Serena-bootstrap step (exit <code>)` to stderr and `exit 1`.
- [ ] In the `update)` case body, replace the `&&`-chained `setup-project.sh && update-project.sh` with tolerant chaining: run `setup-project.sh` in a subshell tolerating any exit code (`|| true`, mirroring `stale`'s/`idempotency`'s existing tolerance comment style), always `cat` its captured output, then unconditionally run `update-project.sh`, capture ITS combined output, `cat` it, and apply the same PASS/FAIL classification from the Approach section against `update-project.sh`'s own output/exit code — using the `update:` prefix (`update: PASS — ...` / `update: FAIL — ...`), not `setup:`.
- [ ] Update the mode-list comment on line 5 if its wording ("setup then update") no longer accurately describes the new tolerant-chaining behavior — keep it accurate but terse, matching the existing style of the other mode descriptions in that same comment.

### 2. Add PASS/FAIL detection to `stale` mode's current-checkout `update-project.sh` call  <!-- agent: general-purpose -->

- [ ] In the `stale)` case body, the OLD checkout's `setup-project.sh` call already tolerates its expected failure (`|| echo '...' >&2`) — leave that part unchanged. Apply the same PASS/FAIL classification from the Approach section to the CURRENT checkout's `update-project.sh` call at the end of that case body (capture its output, `cat` it, classify against the same marker string), using the `stale:` prefix (`stale: PASS — ...` / `stale: FAIL — ...`), replacing the current bare `'$MOUNT_PATH/lib/scripts/update-project.sh' '$SCRATCH_DIR'` invocation whose exit code is simply passed through today.

### 3. Add static unit tests for the new PASS/FAIL and tolerant-chaining behavior  <!-- agent: general-purpose -->

- [ ] Use `mcp__serena__get_symbols_overview` on `test/docker-fresh-machine.test.js` first to confirm the existing `runHarness`/`writeDockerStub`/`scratchDir` helper signatures, and reuse them (do not invent new fixtures) — follow the same stubbed-`docker`-on-`PATH` pattern already established for every other mode in this file.
- [ ] Add/update tests asserting `run.sh setup`'s constructed in-container script captures `setup-project.sh`'s output, checks for the exact marker string `Error: .serena/project.yml was not created by 'claude --print'.`, and contains both a `setup: PASS` and a `setup: FAIL` message.
- [ ] Add/update tests asserting `run.sh update`'s constructed script no longer contains a bare `&&` directly joining `setup-project.sh` and `update-project.sh` (tolerant chaining instead — assert the same `|| true`/subshell-tolerance shape `stale`/`idempotency` already use), that `update-project.sh` always appears in the script regardless of that tolerance, and that the script contains both an `update: PASS` and an `update: FAIL` message keyed off `update-project.sh`'s own output.
- [ ] Add/update a test asserting `run.sh stale`'s constructed script contains both a `stale: PASS` and a `stale: FAIL` message for the current checkout's `update-project.sh` call, while leaving its existing OLD-checkout tolerance assertions (from UAT-071's own prior tests) unchanged.
- [ ] Run `node --test test/docker-fresh-machine.test.js` and confirm all tests (existing + new) pass.

### 4. Promote UAT-060's EDGE-011 and UAT-071's EDGE-004 from Manual to live-command  <!-- agent: general-purpose -->

- [ ] In `wiki/work/uat/UAT-060-docker-fresh-machine-harness.md`, rewrite `UAT-EDGE-011` following the exact pattern already used for `UAT-EDGE-010` in this same file (2026-08-27): remove `(Manual — ...)` from its heading, add a `**Command**:` field, update its Expected Result to check for the new `setup: PASS`/`update: PASS` lines and exit 0 (both `./run.sh setup` and `./run.sh update` should now genuinely pass, since both scripts fail only at the expected, documented point), update its `Repeatable Unit Test` line to explain the reclassification (mirroring UAT-EDGE-010's wording), and reset its status to `- [ ] Pass`. Its own Scenario/Note text currently describes the `&&`-short-circuit as a pinned, intentional limitation — correct that description to reflect this task's fix (`update-project.sh` now actually runs) rather than leaving it contradicted by the new behavior. Update this UAT file's own Gaps section entry (added 2026-08-27) that recommended this exact follow-up — mark it resolved, don't leave a stale "not yet done" note next to the now-completed work.
- [ ] In `wiki/work/uat/UAT-071-docker-harness-stale-mode.md`, apply the same treatment to `UAT-EDGE-004`: `**Command**:` field (`test/docker/fresh-machine/run.sh stale`), Expected Result checking for the new `stale: PASS` line and exit 0, updated `Repeatable Unit Test` note, status reset to `- [ ] Pass`. Update this file's Gaps section similarly if it references the missing PASS/FAIL line as an open gap (check — if no such note exists here, skip this part).

### 5. Update `README.md` documentation  <!-- agent: general-purpose -->

- [ ] Use `mcp__serena__get_symbols_overview` on `test/docker/fresh-machine/README.md` first, then update its `setup`/`update`/`stale` mode documentation to mention the new PASS/FAIL output lines, following the same documentation style already used for the `Live-hook mode` section (added 2026-08-27) and the existing `idempotency` mode's own documented PASS/FAIL behavior — keep it consistent with how that mode is already described there.
