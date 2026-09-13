---
id: UAT-079
aliases: [UAT-079]
title: "UAT: Docker harness PASS/FAIL status lines for setup/update/stale modes"
status: passed
task: TASK-077
created: 2026-09-02
updated: 2026-09-03
---

# UAT-079 — UAT: Docker harness PASS/FAIL status lines for setup/update/stale modes

implements::[[TASK-077]]

> **Source task**: [[TASK-077]]
> **Generated**: 2026-09-02
> **Deviation**: mirrors TASK-077's number where possible, but `UAT-076`/`UAT-077`/`UAT-078` are all already taken (`UAT-076` archived for TASK-070, `UAT-077` active for TASK-075, `UAT-078` archived for TASK-076) — using the next free ID, `UAT-079`, per the same non-collision precedent set for UAT-077/UAT-078.

**Scope note.** TASK-077's own code changes (the PASS/FAIL classification logic in `test/docker/fresh-machine/run.sh`'s `setup`/`update`/`stale` cases) are fully deterministic and already promoted to repeatable unit tests using the same stubbed-`docker`-on-`PATH` technique as every prior task on this harness. This UAT's EDGE cases point at those unit tests rather than duplicating them. The actual **live** verification that `./run.sh setup`/`update`/`stale` genuinely print the new PASS lines against a real Docker daemon is intentionally **not** duplicated here — that exact verification now lives in `UAT-060`'s promoted `UAT-EDGE-011` and `UAT-071`'s promoted `UAT-EDGE-004` (both updated by this same task), and re-running the identical live commands a third time here would add Docker time without new evidence.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ and `bash` available on `PATH` (every case below runs `node --test` against a stubbed `docker` — no live Docker daemon needed)
- [ ] `npm test` baseline green before starting

---

## Test Cases

### UAT-EDGE-001: `run.sh setup` captures `setup-project.sh`'s output and classifies it `setup: PASS`/`FAIL` against the exact Serena-bootstrap marker
- **Scenario**: `setup` mode's exit code alone used to be ambiguous (always non-zero today, even on the expected, documented failure). It must now distinguish "reached the expected point" (PASS, exit 0) from a genuinely different failure (FAIL, exit 1), by checking the captured output for the literal marker `Error: .serena/project.yml was not created by 'claude --print'.` from `lib/scripts/bootstrap-serena.sh:49`.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts the constructed script captures `setup-project.sh`'s output, greps for the exact marker string, and contains both a `setup: PASS` and a `setup: FAIL` message.
- **Expected Result**: Both classification branches present; marker string matches `bootstrap-serena.sh`'s literal text exactly.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh setup: captures setup-project.sh's output, checks the exact Serena-bootstrap marker, and reports setup: PASS/FAIL`)
- **Unit Test Command**: `node --test --test-name-pattern="run.sh setup: captures setup-project.sh" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-09-03 -->

### UAT-EDGE-002: `run.sh update` no longer bare-`&&`-chains `setup-project.sh`/`update-project.sh`, so `update-project.sh` always runs and gets its own independent classification
- **Scenario**: Before this task, `update` mode's `setup-project.sh && update-project.sh` meant `update-project.sh` never actually ran (the `&&` short-circuited on `setup-project.sh`'s always-expected failure). This is the task's central fix, explicitly chosen over the narrower "status line only" option during `/task-add`.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts the constructed script no longer contains a bare `&&` directly joining the two scripts, that `setup-project.sh` runs with `|| true`-style tolerance, that `update-project.sh` always appears regardless, and that the script contains both an `update: PASS` and an `update: FAIL` message keyed off `update-project.sh`'s own captured output.
- **Expected Result**: Tolerant chaining confirmed; `update-project.sh` unconditionally reachable; independent PASS/FAIL classification present.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh update: runs setup-project.sh tolerantly (no bare && chain), then always runs update-project.sh, capturing and classifying its own output as update: PASS/FAIL`)
- **Unit Test Command**: `node --test --test-name-pattern="run.sh update: runs setup-project.sh tolerantly" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-09-03 -->

### UAT-EDGE-003: `run.sh stale` classifies the CURRENT checkout's `update-project.sh` call `stale: PASS`/`FAIL`, leaving the OLD checkout's existing tolerance untouched
- **Scenario**: `stale` mode's OLD-checkout `setup-project.sh` call already had working tolerance before this task (TASK-071) — only the CURRENT checkout's trailing `update-project.sh` call needed the same classification treatment added.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts the constructed script contains both a `stale: PASS` and a `stale: FAIL` message for the current checkout's `update-project.sh` call, while the OLD-checkout tolerance assertions (from UAT-071's own prior tests) remain green.
- **Expected Result**: New classification present for the current-checkout call; no regression to the OLD-checkout seed step's existing behavior.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh stale: captures the CURRENT checkout's update-project.sh output, checks the exact Serena-bootstrap marker, and reports stale: PASS/FAIL`)
- **Unit Test Command**: `node --test --test-name-pattern="run.sh stale: captures the CURRENT checkout" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-09-03 -->

### UAT-EDGE-004: `README.md` documents the new PASS/FAIL lines and explicitly flags the `update` mode behavior change
- **Scenario**: The task's Step 5 requires documenting the new classification lines and calling out that `update-project.sh` now actually executes, which it never did before — a real behavior change, not just new logging, worth flagging distinctly rather than folding silently into routine doc wording.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts `README.md` mentions `setup: PASS`, `update: PASS`, `stale: PASS`, and a `Behavior change` callout.
- **Expected Result**: All four markers present in the harness's own `README.md`.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `test/docker/fresh-machine/README.md: documents the setup/update/stale PASS/FAIL lines and the update && short-circuit fix`)
- **Unit Test Command**: `node --test --test-name-pattern="documents the setup/update/stale PASS" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-09-03 -->

---

## Gaps

- **No dedicated live-Docker case in this UAT file** — deliberate, not an oversight. The real end-to-end proof that `./run.sh setup`/`update`/`stale` print the new lines against an actual container is already carried by `UAT-060`'s `UAT-EDGE-011` and `UAT-071`'s `UAT-EDGE-004`, both updated by this same task. Walking or auto-running those two closes this task's live-verification need without a third redundant Docker run.
