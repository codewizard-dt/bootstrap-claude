---
id: UAT-036
title: "UAT: Reorder and guard run_project_sync in lib.sh so MCP failures can't abort hook install or wiki sync"
status: passed
task: TASK-036
created: 2026-07-31
updated: 2026-07-31
---

# UAT-036 — UAT: Reorder and guard run_project_sync in lib.sh

implements::[[TASK-036]]

> **Source task**: [[TASK-036]]
> **Generated**: 2026-07-31

---

## What this UAT is and is not

The control-flow contract of `run_project_sync()` — **install-global.sh --skip-mcps runs before install-mcps.sh**, **a failing install-mcps.sh only warns instead of aborting**, **the four downstream steps still run after that failure**, and **only install-mcps.sh is guarded (other step failures still abort)** — is fully deterministic and now lives in `test/run-project-sync.test.js` (5 cases, see **UAT-UNIT-001**). It sources the real `lib/scripts/lib.sh` and swaps in marker stubs for the six sub-scripts, so it needs no `$HOME`, no network, and no live `claude` CLI.

What a hermetic unit test cannot reach, and what this file carries instead:

- **The real `install-global.sh` writes into `$HOME/.claude/`** (hooks, skills, `settings.json`, `file-suggestion.sh`). No test may touch the real `~/.claude`, so **UAT-EDGE-001** runs it for real against a **scratch `$HOME`**.
- **`bootstrap-serena.sh` calls a live `claude --print`** to materialize `.serena/project.yml`. That is genuinely an end-to-end, network- and CLI-dependent step — this is the task's own deferred verification (`TASK-036` step: *"Verify the fix end-to-end by running setup-project.sh against a scratch project directory with a stubbed failing install-mcps.sh..."*).
- **The two real entrypoints** (`setup-project.sh`, `update-project.sh`) still call `run_project_sync` with the same two positional args after the reorder — **UAT-EDGE-002** is a quick static check that neither caller was touched in a way the reorder could break.

**This was executed once during generation** (scratch `$HOME`, scratch project, a stubbed failing `install-mcps.sh`, real everything else, Serena pre-registered locally for the scratch project path) and passed end-to-end: exit 0, the warning printed, and hooks/skills/deny-list/wiki-scaffold/CLAUDE.md/mcp-tools guide/`.serena/project.yml` all produced. UAT-EDGE-001 reproduces that run from scratch.

---

## Prerequisites

- [ ] `claude` (Claude Code CLI), `uv`/`uvx`, `python3`, `node` (v18+), `rsync`, and `bash` on `PATH`.
- [ ] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude` (referred to below as `$REPO`).
- [ ] **Never run any of this against the real `$HOME`.** Every live step below uses a scratch `$HOME` — `install-global.sh --skip-mcps` (called first, unconditionally, by the fix under test) writes `~/.claude/hooks`, `~/.claude/skills`, `~/.claude/settings.json`, and `~/.claude/file-suggestion.sh`.
- [ ] `claude mcp add --scope local` and `bootstrap-serena.sh`'s `uvx --from git+https://github.com/oraios/serena ...` step need network access; a cold cache can take **1–5 minutes** to prewarm. There is no way around this for UAT-EDGE-001's Serena assertion — that is exactly the live step TASK-036 deferred to this file.
- [ ] Session variable, exported once:
  ```bash
  export REPO=/Users/davidtaylor/Repositories/bootstrap-claude && export UAT036=$(mktemp -d /tmp/uat-036-XXXXXX) && echo "$UAT036"
  ```

---

## Test Cases

### UAT-UNIT-001: the repeatable suite covers ordering, the guard, downstream continuation, and guard scope

- **Scenario**: run_project_sync, sourced for real, driven with stubbed sub-scripts: (1) install-global.sh runs before install-mcps.sh, (2) a failing install-mcps.sh only warns and the wrapper still reaches its final `echo` under `set -euo pipefail`, (3) all four downstream steps still run after that failure, (4) a successful install-mcps.sh prints no warning, (5) a failure in a *different* step (sync-wiki-scaffold.sh) still aborts the function — proving the guard is scoped to install-mcps.sh only, not a blanket exception swallow.
- **Repeatable Unit Test**: Created: `test/run-project-sync.test.js` (5 cases, new).
- **Steps**:
  1. Run the full suite from the repo root:
     ```bash
     cd "$REPO" && npm test
     ```
- **Expected Result**: Exit 0, all cases pass. As of generation this file's 5 cases are new and the full suite is 113/113 green.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-EDGE-001: the live end-to-end proof — a stubbed failing install-mcps.sh does not abort hook install or wiki sync

**The task's own deferred verification step, executed for real.** Reproduces exactly what the task asked for: `setup-project.sh`'s shared sequence, run against a scratch project directory, with a stubbed `install-mcps.sh` that always fails.

- **Scenario**: A throwaway "fake repo" whose `lib/scripts/` is a copy of the real one with `install-mcps.sh` replaced by a two-line stub that prints to stderr and exits 1; `lib/skills`, `lib/hooks`, and `raw/` are symlinked back to the real repo (read-only, never written to) so `install-global.sh` and `sync-wiki-scaffold.sh` behave exactly as they do in production. `run_project_sync` is invoked directly (not through `setup-project.sh`) so the sequence runs under the identical `set -euo pipefail` its two real callers use.
- **Repeatable Unit Test**: Not applicable — requires a scratch `$HOME`, a real `install-global.sh` rsync into it, and a live `claude --print` for the Serena step; none of that belongs in `node:test`.
- **Steps**:
  1. Use the **Write** tool to create `$UAT036/setup.sh` with this content, then run it:
     ```bash
     #!/usr/bin/env bash
     set -euo pipefail
     ROOT="$UAT036"
     mkdir -p "$ROOT/fakerepo/lib" "$ROOT/home" "$ROOT/project"
     cp -R "$REPO/lib/scripts" "$ROOT/fakerepo/lib/scripts"
     ln -s "$REPO/lib/skills" "$ROOT/fakerepo/lib/skills"
     ln -s "$REPO/lib/hooks" "$ROOT/fakerepo/lib/hooks"
     ln -s "$REPO/raw" "$ROOT/fakerepo/raw"
     cat > "$ROOT/fakerepo/lib/scripts/install-mcps.sh" <<'STUBEOF'
     #!/usr/bin/env bash
     echo "STUB install-mcps.sh: simulating a failed/declined interactive MCP install" >&2
     exit 1
     STUBEOF
     chmod +x "$ROOT/fakerepo/lib/scripts/install-mcps.sh"
     echo "fixture ready"
     ```
     ```bash
     bash "$UAT036/setup.sh"
     ```
  2. Register Serena **locally, for the scratch project only** (writes to the scratch `$HOME/.claude.json`, never the real one) — needed so the last step (`bootstrap-serena.sh`) can produce `.serena/project.yml` instead of failing on an unregistered MCP, which is an orthogonal, pre-existing precondition of that step, not something this task changed:
     ```bash
     export HOME="$UAT036/home" && cd "$UAT036/project" && claude mcp add --scope local serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$UAT036/project"
     ```
  3. Use the **Write** tool to create `$UAT036/run.sh`:
     ```bash
     #!/usr/bin/env bash
     set -euo pipefail
     . "$UAT036/fakerepo/lib/scripts/lib.sh"
     run_project_sync "$UAT036/project" "$UAT036/fakerepo/lib/scripts"
     echo "RUN_PROJECT_SYNC_EXIT_CODE=0"
     ```
     Then run it with the scratch `$HOME` (still exported from step 2) and capture both streams:
     ```bash
     bash "$UAT036/run.sh" > "$UAT036/run.out" 2> "$UAT036/run.err"; echo "exit=$?"
     ```
  4. Check the warning and step order:
     ```bash
     grep -n "Warning: MCP install failed" "$UAT036/run.err" && grep -n "Installing skills and hooks globally\|Checking MCP servers" "$UAT036/run.out"
     ```
  5. Check the produced artifacts:
     ```bash
     test -d "$UAT036/home/.claude/hooks" && echo "hooks: ok"; test -d "$UAT036/home/.claude/skills" && echo "skills: ok"; test -f "$UAT036/home/.claude/settings.json" && echo "settings.json: ok"; test -f "$UAT036/project/wiki/index.md" && echo "wiki/index.md: ok"; test -f "$UAT036/project/CLAUDE.md" && echo "CLAUDE.md: ok"; test -f "$UAT036/project/wiki/guides/mcp-tools.md" && echo "mcp-tools.md: ok"; test -f "$UAT036/project/.serena/project.yml" && echo "serena project.yml: ok"
     ```
- **Expected Result**:
  - Step 3 prints `exit=0` — the guarded MCP failure does **not** abort the sequence under `set -euo pipefail`.
  - Step 4's first `grep` matches `Warning: MCP install failed — continuing with wiki sync; re-run update to retry MCPs.` on stderr; the second `grep` shows `Installing skills and hooks globally...` on a lower line number than `Checking MCP servers...` in stdout — proving `install-global.sh --skip-mcps` ran **before** the (failing) `install-mcps.sh` step.
  - Step 5 prints all seven `: ok` lines — hooks, skills, and `settings.json` were written to the scratch `$HOME` by `install-global.sh`, and the wiki scaffold, `CLAUDE.md`, the MCP-tools guide, and `.serena/project.yml` were all produced in the scratch project despite the MCP step having failed.
  - **As executed during generation**: exactly this outcome — `exit=0`, both greps matched, all seven artifact checks printed `: ok`.
- [x] Pass <!-- 2026-07-31 · executed live during generation with a scratch $HOME and scratch project; exit=0, warning present, install-global.sh preceded install-mcps.sh in the output, and all seven artifact checks (hooks, skills, settings.json, wiki/index.md, CLAUDE.md, mcp-tools.md, .serena/project.yml) passed. -->

---

### UAT-EDGE-002: both real callers still invoke run_project_sync with unaffected arguments

- **Scenario**: The reorder happened entirely inside `run_project_sync()`'s body; neither `setup-project.sh` nor `update-project.sh` should have needed a change, since neither passes flags that depend on the internal step order.
- **Repeatable Unit Test**: Not applicable — this is a static property of two thin wrapper scripts, cheaper to confirm by direct inspection than to encode as a unit test.
- **Steps**:
  1. ```bash
     bash -n "$REPO/lib/scripts/lib.sh" && bash -n "$REPO/lib/scripts/setup-project.sh" && bash -n "$REPO/lib/scripts/update-project.sh" && echo "all three parse"
     ```
  2. ```bash
     grep -n 'run_project_sync "\$PROJECT_DIR" "\$SCRIPT_DIR"' "$REPO/lib/scripts/setup-project.sh" "$REPO/lib/scripts/update-project.sh"
     ```
- **Expected Result**: Step 1 prints `all three parse`. Step 2 shows one matching line in each file, both calling `run_project_sync "$PROJECT_DIR" "$SCRIPT_DIR"` — the same two-argument call signature `run_project_sync()` still expects, confirming neither caller needed updating for the reorder.
- [x] Pass <!-- 2026-07-31 -->

---

## Post-run check

- [ ] Scratch root removed:
  ```bash
  rm -rf "$UAT036" && echo "cleaned"
  ```
