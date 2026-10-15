---
id: TASK-0107
aliases: [TASK-0107]
title: "Add an opt-in sandbox-config prompt to install-global.sh / setup-project.sh"
status: pending-uat
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: [TASK-0122]
parallel_safe_with: []
uat: "[[UAT-0107]]"
tags: [sandbox, security, installer, opt-in, roadmap-012]
---

# TASK-0107 — Add an opt-in sandbox-config prompt to install-global.sh / setup-project.sh

relates_to::[[claude-code-ecosystem-2026]]
relates_to::[[claude-code-sandbox]]

## Objective

Let a user opt in, during `install` / `setup` / `update`, to having the native Claude Code `sandbox` block merged into `~/.claude/settings.json` — an interactive, remembered, never-forced prompt in the same spirit as the interactive MCP install step. The prompt and the docs must state the two caveats plainly: sandboxing is incompatible with `docker` commands (this repo's Brave MCP container flow is one such workload), and `sandbox.excludedCommands` is the escape hatch for commands that must run outside the sandbox. This closes the "guardrail, not a boundary" gap that `lib/hooks/README.md` names four times, at the scaffolding level only.

## Approach

**Where the prompt lives.** `setup-project.sh` and `update-project.sh` both reach `install-global.sh --skip-mcps` through `run_project_sync` (`lib/scripts/lib.sh:152`), so a step inside `install-global.sh` covers `install`, `setup`, and `update` with one implementation. `setup-project.sh` itself needs no code change beyond its next-steps text. The step is added as **step 7b**, between the skill-preference batch (step 7) and the network-dependent MCP install (step 8), so the local/offline-first ordering that step 8's comment documents is preserved and no existing step is renumbered.

**Opt-in, remembered, TTY-guarded.** Follow step 7's contract exactly: the whole step is skipped with one note when `has_tty` is false (a CI run must never bake an answer into the store), and the answer is stored globally through `bootstrap-prefs.js` so a decline is never re-asked. Add one new preference key `sandbox.scaffold` (grammar `true | false`; `true` = merge the block on each sync, idempotent; `false` = never ask again; unanswered = ask, so the schema default must be null and "unanswered" is measured with `prefs_stored_global`, per the step-7 banner). Answer choices `[y]es / [n]o / [s]kip for now`, `skip` recording nothing.

**Delivery.** A new template `lib/scripts/templates/settings-sandbox.json` merged with the existing `merge-settings-deny.js --set-key sandbox --set-value <json>` mode (same call shape as the `fileSuggestion` merge at `install-global.sh:115`). That mode already handles absent / deep-equal / present-different and never clobbers a pre-existing `sandbox` key; keep that behaviour and echo its outcome message. The template is deliberately **minimal** — enable the sandbox and pre-populate `excludedCommands` for the docker CLIs — because choosing the real scope (unattended runs only vs. always-on, filesystem/network/credentials policy) is TASK-031's job, not this task's.

**Guards.** Skip silently-with-a-note on native Windows shells (`uname` reporting MINGW/MSYS/CYGWIN — no sandbox backend). On Linux, warn (do not fail) when `bwrap` or `socat` is missing, since the sandbox needs them; macOS uses built-in Seatbelt. The step is wrapped so a failure warns and continues, like step 8.

**Relationship to existing work — reference, not merged.** [[TASK-031]] (`todo`) is narrower and different in kind: it measures breakage, chooses a scope, writes the full policy (`sandbox.filesystem`/`network`/`credentials`), and proves the script-file settings-write gap is closed. This task supplies only the opt-in delivery mechanism and the minimal starter block. TASK-031 step 3 ("deliver it the same way the deny list is delivered … `--set-key sandbox`") should extend the template file this task creates rather than create a second one. No `depends_on`/`blocks` edge is declared between them (the ROADMAP-012 notes already keep them separate).

**Scope decisions made here (so `/tackle` need not re-decide):** user-scope `~/.claude/settings.json` only (no project-level write); the step never flips `allowUnsandboxedCommands`, `filesystem.disabled`, `allowAppleEvents`, or `allowUnixSockets` (per [[claude-code-sandbox]] these silently re-open the boundary); it never sets `disableBypassPermissionsMode`, `allowManagedPermissionRulesOnly`, or `allowManagedHooksOnly` (recorded footguns for this repo, see TASK-031 step 2).

## Steps

### 1. Verify the current sandbox settings syntax before writing the template  <!-- agent: general-purpose -->

- [x] Look up the current Claude Code `sandbox` settings schema via Context7 (fall back to Brave Search on the official sandboxing docs): confirm the exact key names and value shapes for `sandbox.enabled`, `sandbox.excludedCommands` (glob/prefix pattern format), and how a docker exclusion is expressed. Record the confirmed shape as a comment-free note in the template's PR/commit message; do not guess key names
- [x] Confirm the Linux prerequisites (`bubblewrap`, `socat`) and the native-Windows-unsupported statement against the same docs, so the guard messages in step 3 are accurate
- [x] If any of the above cannot be confirmed, invoke `/research` before proceeding (per the repo rule for unsure implementation strategy)
  - Not triggered. Confirmed against code.claude.com/docs/en/sandboxing, /settings-reference, /permissions: `sandbox.enabled` boolean; `sandbox.excludedCommands` string[] in `Bash(...)` rule syntax (prefix form `docker *`, trailing space required so `docker *` does not match the `docker-compose` binary, hence a separate `docker-compose *` entry — inferred from the documented `ls *` vs `lsof` rule); valid at user scope. Linux/WSL2 need `bubblewrap` + `socat`; macOS uses built-in Seatbelt; native Windows and WSL1 unsupported (Claude Code warns and runs unsandboxed unless `sandbox.failIfUnavailable`).
<!-- Updated: 2026-09-19 -->


### 2. Create the sandbox settings template  <!-- agent: general-purpose -->

- [x] Create `lib/scripts/templates/settings-sandbox.json` holding the single JSON value for the `sandbox` key (not a whole settings file): `enabled: true` plus `excludedCommands` covering `docker` and `docker-compose` (exact shape from step 1). Keep it minimal — no `filesystem`/`network`/`credentials` policy (TASK-031 owns that)
- [x] Confirm the file ships in the npm tarball: check `package.json` `files` covers `lib/scripts/templates/`; add nothing if it already does
- [x] Check `lib/scripts/merge-settings-deny.js` `--set-key` handling accepts an object value with a nested array (deep-equal comparison on present values) — read the implementation near lines 15–40 and 117–121; make no change unless it mishandles nested values
  - No change needed: recursive `deepEqual` handles nested objects/arrays; `package.json` `files` already includes `lib/`. Outcome messages: absent → stdout `settings.json: "sandbox" set`; deep-equal → stdout `settings.json: "sandbox" already set`; present-different → stderr `Warning: settings.json already defines "sandbox" — keeping it and skipping <json>`. `--set-value` takes a JSON string (not a path); target defaults to `os.homedir()/.claude/settings.json` (follows `$HOME`).
<!-- Updated: 2026-09-19 -->


### 3. Add the `sandbox.scaffold` preference and the step 7b prompt  <!-- agent: general-purpose -->

- [x] In `lib/scripts/templates/bootstrap-prefs-schema.json`, add `sandbox.scaffold` beside `gitignore.offerSectionUpdates` (line ~219), mirroring its field set: `scope: global`-compatible (`either` is acceptable if the loader requires it), `consumer` matching what the schema uses for installer-read keys (inspect existing keys for the value; step 7's keys are `skill`, so look for an installer-consumed precedent such as the MCP-related keys before choosing), `summary`, a `detail` that states the docker incompatibility and the `excludedCommands` escape hatch, `values: "true | false"`, no non-null default (so it is asked until answered), `askedBy: "install-global.sh"`
- [x] Add step **7b** to `lib/scripts/install-global.sh` between the end of step 7 (`echo ""` at ~line 307) and the step 8 header (~line 308): a header comment in the file's existing rationale-comment style, then — only when `has_tty` and `! prefs_stored_global sandbox.scaffold` — print the caveats (OS-level containment for Bash and its children; docker commands are incompatible and are pre-listed under `sandbox.excludedCommands`; add further tools to `excludedCommands` when a command fails under the sandbox; a pre-existing `sandbox` key is never overwritten) and ask via `prompt_letter_choice skip "    [y]es / [n]o / [s]kip for now: " yes no skip`
- [x] On `yes`: run the platform guard (skip with a note on MINGW/MSYS/CYGWIN; on Linux warn when `bwrap`/`socat` are absent), then `SANDBOX_OUT="$(node "$SCRIPT_DIR/merge-settings-deny.js" --set-key sandbox --set-value "$(cat "$SCRIPT_DIR/templates/settings-sandbox.json")" 2>&1)"`, echo `$SANDBOX_OUT`, `prefs_set sandbox.scaffold --global true`, and print a restart-your-session reminder when the outcome says the key was set. On `no`: `prefs_set sandbox.scaffold --global false`. On `skip`: record nothing and say the question will be asked again next sync
- [x] Guard the whole step so any failure prints a warning and continues (`if ! ...; then echo "Warning: ..." >&2; fi`); `set -euo pipefail` must not abort the local installs
- [x] On non-tty runs print one line ("Non-interactive terminal: skipping the sandbox question.") and write nothing, matching step 7's wording
- [x] Do not renumber steps 8+; extend the final "Global setup complete" summary only if the step actually ran, following the BUG-0010 note about summary tokens being gated on what ran
  - Implemented as `configure_sandbox()` at `install-global.sh` ~lines 309-403; summary now built from `SUMMARY_TOKENS` with `+ sandbox` gated on `SANDBOX_CONFIGURED=1`. Strings: non-tty `  Non-interactive terminal: skipping the sandbox question.`; already answered `  Already answered — nothing to ask.`; skip `sandbox.scaffold left unanswered — ... asked again next sync.`; yes prints `sandbox.scaffold = true` and `Restart Claude Code sessions to pick up the sandbox.` only on a `"sandbox" set` outcome.
<!-- Updated: 2026-09-19 -->


### 4. Documentation  <!-- agent: general-purpose -->

- [x] `lib/scripts/README.md`: document step 7b, the `sandbox.scaffold` key, the template file, the platform guard, and — plainly — the docker incompatibility and `excludedCommands` escape hatch; update the "containment … is the OS sandbox" sentences (~lines 71, 116–117) to point at the opt-in scaffold rather than describe it as absent
- [x] `lib/hooks/README.md` (~line 541, and the other "guardrail, not a boundary" residual-risk mentions): add a one-sentence pointer that `bootstrap install` can now scaffold a starter sandbox block on opt-in, without claiming it closes the script-file gap (TASK-031 does that). Keep within the file's § Commenting standard
- [x] `CLAUDE.md`: update the `install-global.sh` Key Files entry and the `install` Setup Workflow bullet to mention the opt-in sandbox step; run `/wiki-lint` afterwards only if wiki pages were touched
- [x] `wiki/knowledge/entities/tools/claude-code-sandbox.md` [DEFERRED to the completion pass by design — not edited during tackle; the closing "remains outstanding" paragraph still needs revising in place plus a log entry]: the closing paragraph says scaffolding "remains outstanding" — once implemented, revise it in place (the wiki is revised, not appended) and log the update; this belongs to the completion pass, not to `/tackle`'s static gates, so note it in the completion report rather than editing it during implementation

### 5. Tests  <!-- agent: general-purpose -->

- [x] Add `test/install-sandbox-prompt.test.js` following the existing installer tests' harness (scratch `HOME`, `BOOTSTRAP_ASSUME_TTY=1` seam from `lib.sh` `has_tty`, stdin-fed answers): assert (a) non-tty run asks nothing and writes no `sandbox` key and no prefs file entry; (b) answering `no` stores `sandbox.scaffold=false` and writes no `sandbox` key; (c) answering `skip` stores nothing and the question recurs on a second run; (d) answering `yes` merges the template into `$HOME/.claude/settings.json` and stores `true`; (e) a pre-existing different `sandbox` value is preserved with the "already defines" message; (f) an already-stored answer is never re-asked
- [x] Add a template-shape assertion: `settings-sandbox.json` parses as JSON, contains `enabled` and an `excludedCommands` array including the docker entries, and contains no `filesystem`/`network`/`credentials` policy
- [x] Add a schema assertion that `sandbox.scaffold` exists with `askedBy: install-global.sh` and no non-null default (extend whichever existing prefs-schema test enumerates keys, if one does)
- [x] `bash -n lib/scripts/install-global.sh` and `npm test` green. Never run `install-global.sh` against the real `HOME` — tests use a scratch `HOME`
  - `bash -n` clean; new `test/install-sandbox-prompt.test.js` 8/8 pass (also fixed `test/prompt-stickiness.test.js` re-ask test to settle `sandbox.scaffold=false`, and the `lib/scripts/README.md` registry row to match the schema summary); `test-scripts-readme-prefs-docs` + `prompt-stickiness` + new file: 70/70. Full `npm test` still shows only the 5 known pre-existing failures plus sibling-owned in-flight task-trash/ARCHIVE-WORK-ITEM failures (TASK-0097/TASK-0110 territory), none from this task.
<!-- Updated: 2026-09-19 -->


## Notes

- **Ordering constraint with ROADMAP-0014 Phase 4:** ROADMAP-0014 Phase 4 will also edit `lib/scripts/install-global.sh` (pruning stale skill directories). This task must be tackled **before** that one so the two edits to the same file do not collide; the new step 7b is deliberately a self-contained insertion between step 7 and step 8 to keep the later diff small. No frontmatter `blocks` edge is declared because the Phase 4 task does not exist yet — add `blocks:`/`depends_on:` symmetrically when it is created.
- **TASK-031 overlap:** both tasks may write `lib/scripts/templates/settings-sandbox.json` (TASK-031 step 3 delivers a `sandbox` template via `--set-key sandbox`). Whichever runs second must extend the existing file, not replace it.
- Originating research: [Claude Code Ecosystem Survey](../../knowledge/sources/claude-code-ecosystem-2026.md); roadmap: [ROADMAP-012](../roadmaps/ROADMAP-012-sandbox-scaffolding-and-usage-visibility.md) Phase 1.
- Runtime behaviour (does a sandboxed session actually start; does a docker command fail without the exclusion) belongs in UAT, not in `/tackle`'s static gates.
