---
id: UAT-072
aliases: [UAT-072]
title: "UAT: Docker harness idempotency check — run update twice, diff scratch state"
status: pending
task: TASK-072
created: 2026-08-22
updated: 2026-08-22
---

# UAT-072 — UAT: Docker harness idempotency check — run `update` twice, diff scratch state

implements::[[TASK-072]]

> **Source task**: [[TASK-072]]
> **Generated**: 2026-08-22

**Scope note.** TASK-072 adds a fifth `idempotency` mode to the existing `test/docker/fresh-machine/run.sh` (built by TASK-060, joined by TASK-071's `stale` mode) plus a `README.md` documentation update. There is no HTTP endpoint or browser UI here — every test case below is an **EDGE** case, following the same convention as UAT-060/UAT-071 (this harness's own prior UATs). `run.sh`'s per-mode `docker` command construction is deterministic and requires no live Docker daemon, so it is fully promoted to repeatable unit tests using the same stubbed-`docker`-on-`PATH` technique `test/docker-fresh-machine.test.js` already established for the `shell`/`setup`/`update`/`stale` modes. The one case that genuinely requires a live multi-minute `docker build`/`docker run` (UAT-EDGE-003) is marked **Manual** and independently re-verifies the evidence already recorded in TASK-072's own "Step 2 follow-up fixes applied, then re-verified" Notes subsection.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ and `bash` available on `PATH` (the promoted suite runs `node --test` and stubs `docker`, so UAT-EDGE-001 and UAT-EDGE-002 need **no** live Docker daemon)
- [ ] For UAT-EDGE-003 only: Docker Desktop (or equivalent) running and `docker` on `PATH`, network access, several minutes free (three sequential non-interactive `setup-project.sh`/`update-project.sh` runs against the same scratch dir plus a `$HOME/.claude/` snapshot/diff)
- [ ] `npm test` baseline green before starting (independent of Docker)

**Safety.** UAT-EDGE-001 and UAT-EDGE-002 run the real `run.sh`/`test/docker-fresh-machine.test.js` text and a stubbed `docker` binary on a scratch `PATH` — no real image is built or container run, and the real Docker daemon (if any) is never touched. UAT-EDGE-003 builds and runs the real, ephemeral (`--rm`) harness image against a throwaway in-container scratch directory only; it never touches this repo's own working tree or the operator's real `~/.claude/`.

---

## Test Cases

### UAT-EDGE-001: `run.sh idempotency` runs `setup-project.sh` once then `update-project.sh` twice against the same scratch dir, in order, each call tolerated against the documented non-interactive Serena-bootstrap failure, excluding session-transcript `.jsonl` churn from the snapshot, and diffing snapshot-2 vs snapshot-3 with explicit PASS/FAIL messaging
- **Scenario**: TASK-072's Approach requires `idempotency` mode to seed real prior state (`setup` then `update` once, same as `run.sh update`), snapshot, run `update` a second time, snapshot again, and assert the two post-update snapshots match. TASK-072's own Notes record that the first implementation attempt aborted before ever reaching the comparison, because the seed `setup-project.sh` call wasn't tolerated the same way `stale` mode's seed step is — the fix applies that same `|| echo '...expected...' >&2` tolerance to the seed call and to both `update-project.sh` calls, and excludes `$HOME/.claude/projects/**/*.jsonl` from the snapshot (a fresh Claude Code session transcript is created on every `claude --print` invocation inside `bootstrap-serena.sh`, which is expected per-run volatility, not real config drift).
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs `run.sh idempotency` against a stub `docker` and asserts: exactly one `setup-project.sh` call against `/workspace/scratch-project` followed by exactly two `update-project.sh` calls against the same dir, in that order; the seed call and both update calls are each wrapped in `|| echo 'idempotency: ... exited non-zero — expected ...' >&2` tolerance (never bare `&&`-chained); the snapshot's `find "$HOME/.claude" ...` excludes `*/projects/*.jsonl`; and the script contains a `diff -u "$SNAP_DIR/snapshot-2.txt" "$SNAP_DIR/snapshot-3.txt"` comparison with both an `idempotency: FAIL — ...` and an `idempotency: PASS — ...` message.
- **Expected Result**: `setup-project.sh` once, `update-project.sh` twice, all three tolerated, session-transcript `.jsonl` excluded from the snapshot, snapshot-2-vs-snapshot-3 `diff -u` with clear PASS/FAIL messaging — matching the two fixes documented in TASK-072's Notes.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (tests: `run.sh idempotency: runs setup-project.sh once, then update-project.sh twice, against the same scratch dir, in that order`, `run.sh idempotency: tolerates the seed and both update-project.sh calls' expected Serena-bootstrap failure, excludes session-transcript jsonl files from the snapshot, and diffs snapshot-2 vs snapshot-3 with PASS/FAIL messaging`)
- **Unit Test Command**: `node --test --test-name-pattern="run.sh idempotency: runs setup-project.sh once|tolerates the seed and both update-project" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-002: `run.sh`'s usage/error message for an unrecognized mode lists `idempotency` alongside `shell`/`setup`/`update`/`stale`
- **Scenario**: Task step 1 requires the new mode to be recognized by the argument-parsing loop like its siblings; an unrecognized positional argument's usage message must list every valid mode, including the newly added one, so a typo'd mode name fails fast with an accurate hint rather than a stale one. TASK-072's own Notes record that adding `idempotency` to the mode list broke this same regex test (the same class of break TASK-071 caused for `stale`), fixed in the same cycle by extending the alternation.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs `run.sh bogus-mode` with no `docker` stub or real `docker` reachable on `PATH`, and asserts exit code 1, a `Usage: ... [shell|setup|update|stale|idempotency] [--rebuild]` message on stderr, and zero logged docker invocations.
- **Expected Result**: Exit 1; usage message includes `idempotency` in the mode list; no docker call attempted.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh: an unrecognized positional argument prints usage and exits 1 without ever invoking docker`)
- **Unit Test Command**: `node --test --test-name-pattern="unrecognized positional argument prints usage" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-003 (Manual): A real `run.sh idempotency` run seeds prior state, tolerates the expected non-interactive Serena-bootstrap failure on all three script calls, and finds `update-project.sh` is a true no-op on its second run (once session-transcript noise is excluded)
- **Scenario**: TASK-072's own "Step 2 follow-up fixes applied, then re-verified" Notes subsection records a real, live run of `./test/docker/fresh-machine/run.sh idempotency` against the cached `bootstrap-claude-fresh-machine` image, after the two follow-up fixes (seed/update tolerance, `.jsonl` exclusion) landed. This case independently re-verifies that evidence: `setup-project.sh` seeds the scratch dir, both `update-project.sh` calls run in turn, all three tolerate the documented Serena-bootstrap failure, and the snapshot-2-vs-snapshot-3 comparison finds no diff — a genuine idempotency PASS, not merely an untested assertion.
- **Steps**:
  1. From the repo root, confirm the image is cached (or build it): `docker image inspect bootstrap-claude-fresh-machine >/dev/null 2>&1 || ./test/docker/fresh-machine/run.sh --rebuild`.
  2. Run `./test/docker/fresh-machine/run.sh idempotency`; capture the full output and `echo $?` afterward.
  3. Confirm `setup-project.sh` runs its real non-interactive setup sequence and fails only at "Bootstrapping Serena project.yml", printing the `idempotency: setup-project.sh exited non-zero — expected ...` stderr marker rather than aborting the chain.
  4. Confirm the first `update-project.sh` call then runs, also failing only at the identical expected step, printing `idempotency: first update-project.sh exited non-zero — expected ...`, followed by snapshot-2 being taken.
  5. Confirm the second `update-project.sh` call then runs, also failing only at the identical expected step, printing `idempotency: second update-project.sh exited non-zero — expected ...`, followed by snapshot-3 being taken.
  6. Confirm the final `diff -u` between snapshot-2 and snapshot-3 produces no output, and the run prints `idempotency: PASS — a second update-project.sh run against the same scratch dir is a true no-op (identical scratch-project + $HOME/.claude state)` with exit code 0.
- **Expected Result**: Exit code 0; all three script calls tolerate the identical expected Serena-bootstrap failure; snapshot-2 and snapshot-3 are byte-identical (no diff output); final message is the PASS line above. Matches the evidence already recorded in TASK-072's Notes — this was already manually verified once during `/tackle` with exactly this PASS result (log `idempotency-run3.log`, confirmed via a blocking poll on the actual background process); this UAT case exists as the durable, repeatable manual-verification record per this repo's UAT conventions for Docker-dependent cases, not as a first-time check.
- **Note**: Before the two follow-up fixes landed, an earlier manual run of this same mode failed at exit code 1 without ever reaching snapshot-1 — a harness/script-error finding (missing seed-step tolerance), not a real `update-project.sh` non-idempotency finding. That earlier result is superseded by the fixed, re-verified PASS this case documents; it is not re-tested here since the underlying defect is already fixed in `run.sh` itself.
- **Repeatable Unit Test**: Not applicable: requires a live Docker daemon and three sequential non-interactive `setup-project.sh`/`update-project.sh` runs against the same scratch dir per invocation, plus a `$HOME/.claude/` snapshot/diff.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-08-22 -->

---

## Gaps

- **CI does not yet run `run.sh idempotency` as an actual step**: `.github/workflows/docker-harness.yml` (TASK-073) currently only *documents* that TASK-071/TASK-072 modes are pending (`docker-harness.yml: notes TASK-071/TASK-072 modes are pending rather than silently omitting them`, in `test/docker-fresh-machine.test.js`), rather than wiring `idempotency` in as a real CI step. This is legitimately out of scope for TASK-072/UAT-072 — wiring it into CI is a follow-on to TASK-073, not a defect here.
- **No coverage of a genuine non-idempotency regression**: this UAT (and TASK-072's own manual verification) confirms `update-project.sh` is currently idempotent on a second run; no case here deliberately introduces a non-idempotent change to confirm the mode would actually catch one (i.e. no test of the mode's own failure path against real drift, only its documented `diff -u`/FAIL-message construction). Out of scope — would require deliberately regressing `update-project.sh` just to exercise the harness, which is not this task's purpose.
