---
id: UAT-071
aliases: [UAT-071]
title: "UAT: Add a run.sh stale mode simulating an upgrade from an older bootstrap-claude release"
status: pending
task: TASK-071
created: 2026-08-22
updated: 2026-08-22
---

# UAT-071 — UAT: Add a `run.sh stale` mode simulating an upgrade from an older bootstrap-claude release

implements::[[TASK-071]]

> **Source task**: [[TASK-071]]
> **Generated**: 2026-08-22

**Scope note.** TASK-071 adds a fourth `stale` mode to the existing `test/docker/fresh-machine/run.sh` (built by TASK-060) plus a `README.md` documentation update. There is no HTTP endpoint or browser UI here — every test case below is an **EDGE** case, following the same convention as UAT-060 (this harness's own prior UAT). `run.sh`'s per-mode `docker` command construction is deterministic and requires no live Docker daemon, so it is fully promoted to repeatable unit tests using the same stubbed-`docker`-on-`PATH` technique `test/docker-fresh-machine.test.js` already established for the `shell`/`setup`/`update` modes. The one case that genuinely requires a live multi-minute `docker build`/`docker run` (UAT-EDGE-004) is marked **Manual** and independently re-verifies the evidence already recorded in TASK-071's own "Step 2 manual verification (2026-08-22)" Notes subsection.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ and `bash` available on `PATH` (the promoted suite runs `node --test` and stubs `docker`, so UAT-EDGE-001 through 003 need **no** live Docker daemon)
- [ ] For UAT-EDGE-004 only: Docker Desktop (or equivalent) running and `docker` on `PATH`, network access, several minutes free (`git archive` of the older ref plus two full `setup-project.sh`/`update-project.sh` non-interactive runs)
- [ ] `npm test` baseline green before starting (independent of Docker)

**Safety.** UAT-EDGE-001 through 003 run the real `run.sh`/`README.md` text and a stubbed `docker` binary on a scratch `PATH` — no real image is built or container run, and the real Docker daemon (if any) is never touched. UAT-EDGE-004 builds and runs the real, ephemeral (`--rm`) harness image against a throwaway in-container scratch directory only, plus a read-only `git archive` of this repo's own history into an in-container scratch directory; it never touches this repo's own working tree or the operator's real `~/.claude/`.

---

## Test Cases

### UAT-EDGE-001: `run.sh stale` extracts the older release (`c33808d`) via a read-only `git archive`, before running any setup/update script
- **Scenario**: The task's Approach requires seeding "older release" state via a git ref checkout, and since the repo is bind-mounted read-only, extraction must use `git archive` (never `git checkout`/`git worktree add`, which need to write into `.git/worktrees`). The extraction must happen before any setup/update script runs.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it runs `run.sh stale` against a stub `docker` and asserts the constructed `docker run` call's trailing script contains `mkdir -p '/workspace/scratch-project' '/workspace/old-bootstrap-claude'` followed by `git --git-dir='/opt/bootstrap-claude/.git' archive 'c33808d' | tar -x -C '/workspace/old-bootstrap-claude'`, with the `git archive` step appearing before the old checkout's `setup-project.sh` invocation.
- **Expected Result**: Both scratch dirs created, the older ref extracted via read-only `git archive` (never a checkout/worktree), before any install script runs.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh stale: extracts $OLD_REF via read-only git archive into the old-checkout dir, before running any setup/update script`)
- **Unit Test Command**: `node --test --test-name-pattern="extracts \$OLD_REF via read-only git archive" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-002: The OLD checkout's `setup-project.sh` runs tolerantly (never chained with `&&`), then the CURRENT checkout's `update-project.sh` always runs against the same scratch dir
- **Scenario**: TASK-060's own documented precedent found that `setup-project.sh`/`update-project.sh` currently fail (exit 1) only at their very last step (Serena `project.yml` bootstrap) on a fully non-interactive, decline-only run — a clearly-expected failure, not a defect. `run.sh stale` must not chain the old seed step with `&&` (which would short-circuit before the real test ever runs); it must tolerate that expected failure and unconditionally reach the current `update-project.sh`, using update's exit code as the mode's own exit code. It must also never call the CURRENT checkout's `setup-project.sh` or the OLD checkout's `update-project.sh`.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts: the old checkout's `setup-project.sh` call against `/workspace/scratch-project` is wrapped in a subshell with `|| echo ...` (tolerated, not `&&`-chained); it runs before the current checkout's `update-project.sh` call; the subshell closes and is joined to `update-project.sh` by `;` (not `&&`); and neither the current checkout's `setup-project.sh` nor the old checkout's `update-project.sh` ever appear in the constructed script.
- **Expected Result**: `('/workspace/old-bootstrap-claude/.../setup-project.sh' '/workspace/scratch-project' || echo ...); '/opt/bootstrap-claude/.../update-project.sh' '/workspace/scratch-project'` — old setup tolerated, current update unconditional, no cross-wiring of setup/update between the two checkouts.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (test: `run.sh stale: runs the OLD checkout's setup-project.sh tolerantly (not chained with &&), then unconditionally runs the CURRENT checkout's update-project.sh against the same scratch dir`)
- **Unit Test Command**: `node --test --test-name-pattern="runs the OLD checkout" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-003: `run.sh stale` never allocates a tty, `OLD_REF` is pinned to `c33808d`, and `README.md` documents the new mode; the updated usage message lists all four modes
- **Scenario**: Task steps require `stale` to run fully non-interactively like `setup`/`update` (no `-it`), the chosen older-version boundary (`c33808d`, package.json 2.23.0 — the last commit before the 3.0.0 major bump) to be pinned in `run.sh`, `README.md`'s Usage section to document `./run.sh stale`, and the arg-parsing usage/error message to list `stale` alongside the existing three modes.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it asserts: the `stale` mode's `docker run` call has no `-it`; `run.sh` contains the literal `OLD_REF="c33808d"` assignment; `README.md` contains `./run.sh stale`; and an unrecognized mode's usage/error message reads `Usage: ... [shell|setup|update|stale] [--rebuild]`.
- **Expected Result**: Non-interactive `stale` mode; `OLD_REF` pinned to `c33808d`; `README.md` documents `stale`; usage message lists all four modes.
- **Repeatable Unit Test**: Created: `test/docker-fresh-machine.test.js` (tests: `run.sh stale: never allocates a tty and OLD_REF is the last commit before the 3.0.0 major bump`, `test/docker/fresh-machine/README.md: documents the stale mode alongside shell/setup/update`, `run.sh: an unrecognized positional argument prints usage and exits 1 without ever invoking docker`)
- **Unit Test Command**: `node --test --test-name-pattern="never allocates a tty and OLD_REF|documents the stale mode|unrecognized positional argument prints usage" test/docker-fresh-machine.test.js`
- [x] Pass <!-- 2026-08-22 -->

### UAT-EDGE-004 (Manual): A real `run.sh stale` run seeds `c33808d`'s state, tolerates its expected seed-step failure, and the current `update-project.sh` then runs its real migration work against that seeded state
- **Scenario**: TASK-071's own "Step 2 manual verification (2026-08-22)" Notes subsection records a real, live run of `./test/docker/fresh-machine/run.sh stale` against the cached `bootstrap-claude-fresh-machine` image. This case independently re-verifies that evidence: the old-release seed stage runs to completion through all its real work and fails only at the expected last step (Serena `project.yml` bootstrap), and the current `update-project.sh` stage then runs its own real migration work (skill-set migration, deny-list/hooks-wiring/CLAUDE.md/aliases checks, wiki scaffold sync, MCP-tools guide rebuild) against that seeded state before also failing at the identical expected last step — final exit code 1, judged a clearly-expected failure per TASK-060's established acceptance bar, not a defect.
- **Steps**:
  1. From the repo root, confirm the image is cached (or build it): `docker image inspect bootstrap-claude-fresh-machine >/dev/null 2>&1 || ./test/docker/fresh-machine/run.sh --rebuild`.
  2. Run `./test/docker/fresh-machine/run.sh stale`; capture the full output and `echo $?` afterward.
  3. Confirm the old-release seed stage (`c33808d`'s `setup-project.sh`) runs its real non-interactive work (hooks/skills install, deny-list + hooks-wiring merge, MCP prompts declined, wiki scaffold sync, `CLAUDE.md` write, alias backfill, Obsidian declined, MCP-tools guide build) and then fails only at "Bootstrapping Serena project.yml", printing the `stale: old-release (c33808d) setup-project.sh exited non-zero — expected ...` stderr marker rather than aborting.
  4. Confirm the current checkout's `update-project.sh` stage then runs afterward against the same seeded scratch dir, performing its own real migration work, before also failing at the identical "Bootstrapping Serena project.yml" step.
- **Expected Result**: Final exit code 1 (matching the mode's documented design of exiting with `update-project.sh`'s own exit code); both stages fail only at the Serena `project.yml` bootstrap step specifically — never earlier, and never for a missing foundational dependency or a `git archive`/extraction error. Matches the evidence already recorded in TASK-071's Notes (exact log lines and stage-by-stage behavior will be identical modulo timestamps and any upstream tool-version drift).
- **Repeatable Unit Test**: Not applicable: requires a live Docker daemon, a `git archive` of real repo history, and two full non-interactive `setup-project.sh`/`update-project.sh` runs per invocation.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-08-22 -->

---

## Gaps

- **No coverage of an `accept` mode**: TASK-070 specified a distinct `run.sh accept` mode (pre-seeding `bootstrap-prefs.js` keys) as a separate, not-yet-built follow-on — TASK-071's own Steps checklist did not request it, and it was correctly not built here (see TASK-071's Notes). No UAT case exists for it since it doesn't exist yet.
- **No coverage of whether a future, much-older `OLD_REF` boundary would behave differently** (e.g. a ref old enough to predate `bootstrap-prefs.js` or the current wiki scaffold shape) — this task deliberately picked the nearest clean version boundary (`c33808d`, one minor version back) per its Approach's guidance to confirm a suitable boundary exists; testing materially older boundaries is out of scope here.

---

Next steps:
```
To walk through tests interactively:  /uat-walk wiki/work/uat/UAT-071-docker-harness-stale-mode.md
To run tests headlessly:              /uat-auto wiki/work/uat/UAT-071-docker-harness-stale-mode.md
```
