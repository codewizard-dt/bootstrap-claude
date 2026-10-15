---
id: TASK-031
aliases: [TASK-031]
title: "Tier 3: adopt /sandbox to close the script-file write path to settings.json"
status: pending-uat
created: 2026-07-30
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: [TASK-030]
uat: "[[UAT-031]]"
tags: [security, sandbox, tier-3, bypass]
---

# TASK-031 — Tier 3: adopt `/sandbox` to close the script-file write path

derived_from::[[bypass-mode-enforcement]]

## Objective

Close the one hole the hook tier structurally cannot: a Bash-capable agent writing `~/.claude/settings.json` (or any protected path) from a **script file**. `interpreter-indirection-guard.js` catches `node -e`, `protected-write-guard.js` catches `>` redirects, and `claude-settings-guard.js` catches the file tools — but `node write-settings.js` reaches the file and no hook parses inside a script. `/sandbox` is the only control that does, because the OS enforces it on the running process rather than on the command's text.

## Approach

**The gap and its closure are both documented, not speculative.** `raw/research/bypass-mode-enforcement/index.md` §5 establishes, sourced to the official sandboxing docs: *"the sandbox automatically denies write access to Claude Code's `settings.json` files at every scope and to the managed settings directory, so a sandboxed command can't modify its own policy"* — with deny rules resolving symlinks since v2.1.210. That is precisely the residual risk recorded in `claude-settings-guard.js`'s header and both READMEs.

**It composes with what already ships rather than replacing it.** Read/Edit deny rules and `sandbox.filesystem` settings **merge into one boundary**, so TASK-026's A1/A2 entries strengthen the sandbox instead of duplicating it. The three tiers stay complementary: deny matches spellings, hooks parse commands, the sandbox confines the process.

**Scope it to where bypass actually lives.** The research recommends enabling it for the `power-mode` / `uat-auto-plus` path specifically, since that is 100% of this repo's `--dangerously-skip-permissions` surface — and those are exactly the unattended runs where no human is watching. Whether to go further (always-on) is step 2's decision, made against measured breakage rather than in advance.

**Known limits, to be stated in the docs rather than discovered later:**
- The sandbox covers **Bash and its children only**. `Read`/`Edit`/`Write` go through the permission system directly, so the file-tool guards remain load-bearing.
- Default read policy still permits `~/.aws/credentials` and `~/.ssh` unless `sandbox.credentials` or `denyRead` is configured — the deny list's A4 group covers the file tools, not a sandboxed subprocess reading them.
- The network proxy does not terminate TLS by default, so domain fronting can reach non-allowlisted hosts.
- macOS uses Seatbelt, Linux/WSL2 use bubblewrap, **native Windows is unsupported** — so this cannot be a hard requirement of the template.

## Steps

### 1. Measure what sandboxing would break, before deciding anything  <!-- agent: general-purpose -->

- [x] Inventory this repo's real Bash workload and classify each by what it needs from the OS — filesystem writes outside the project, network egress, and process spawning. At minimum: `npm test`, `npm install`, `git` (including `push`), `node lib/scripts/*.js`, `bash lib/scripts/*.sh`, `install-global.sh` (writes `~/.claude/`), `uvx --from git+…` (Serena bootstrap), `docker` (Brave MCP), `launchctl` (Playwright agent)
- [x] **`install-global.sh` is the interesting case and must be called out explicitly**: it writes `~/.claude/hooks/` and `~/.claude/settings.json` by design. Under a sandbox that denies settings writes at every scope, *running the installer from inside a sandboxed session would fail.* Determine whether that is true, and if so, record it as a documented constraint — the installer is run by a human, not by an unattended agent, so this may be acceptable rather than a blocker
- [x] Determine how MCP servers are affected. They are spawned by Claude Code rather than by the Bash tool, so they are likely outside the sandbox — **verify rather than assume**, since Serena backs the mandated navigation path and losing it would be severe
- [x] Produce a table: command → needs → sandboxed verdict (works / needs config / breaks). This table is the input to step 2, not a formality

**Step 1 findings** (2026-09-19; sources: code.claude.com/docs/en/sandboxing, /settings-reference, /sandbox-environments). **[C]** confirmed in official docs, **[I]** inferred from docs + this repo's code, **[U]** unconfirmed — left for UAT. Static docs/code review only; nothing was executed.

The sandbox wraps only commands run through Claude's Bash (and PowerShell/Monitor) tool plus their children **[C]**. A human's terminal is never sandboxed. Default write = cwd + session temp dir; default read = whole machine; network needs an allowlist or prompt.

| Command | Needs (OS level) | Sandboxed verdict |
|---|---|---|
| `npm test` | writes/spawns in cwd and `os.tmpdir()` scratch `HOME`s; spawns `node`/`bash`/`git`; no network | works [I] |
| `npm install` (project) | writes `node_modules` in cwd, `~/.npm` cache, `registry.npmjs.org` | needs config: `allowWrite ~/.npm`, `allowedDomains registry.npmjs.org` [I] (repo has no deps; near no-op) |
| `npm i -g` (Playwright MCP, `install-mcps.sh`) | global npm prefix outside cwd | breaks [I] — human-run only |
| `git` status/diff/add/commit/switch | `.git/{index,objects,refs}` inside cwd | works [I]; `.git/hooks` + `.git/config` are denied [C] |
| `git push` (SSH origin) | reads `~/.ssh`, ssh-agent socket, TCP:22 | breaks or needs config [U] — third-party issues report SSH git failing even with `git` excluded; unattended runs should not push |
| `node lib/scripts/{backfill-wiki-aliases,…}.js`, `sync-wiki-scaffold.sh`, `merge-gitignore.sh`, `build-mcp-guide.sh` (project-local) | cwd writes; `build-mcp-guide.sh` calls `claude mcp get` | works [I]; nested `claude` is a risk [U] |
| `wiki-dashboard-server.js` | binds 127.0.0.1 | needs config: `network.allowLocalBinding` on macOS [C] |
| `merge-settings-*.js`, `bootstrap-prefs.js` against real `HOME` | writes `~/.claude/settings.json`, `~/.claude/bootstrap-prefs.json` | **breaks, by design** [C] (settings.json) — this task's target case |
| `install-global.sh`, `setup-project.sh`, `update-project.sh` | see below | **breaks** [C] |
| `setup-strict-typechecks.sh`, `migrate-project.sh` (`claude -p --dangerously-skip-permissions`) | nested claude writes `~/.claude`, `~/.claude.json` (protected) | breaks if launched from a sandboxed Bash [I]; unaffected from a terminal |
| `bootstrap-serena.sh` (`uvx --from git+…`, then `claude --print`) | `~/.cache/uv`, github.com, nested claude | breaks [I] — human-run |
| `docker` (Brave MCP container) | docker socket | needs config: `excludedCommands` [C] — **but see finding 2** |
| `launchctl` (Playwright LaunchAgent) | `~/Library/LaunchAgents`, launchd Mach services | breaks [I] — human-run; deny list already blocks load/bootstrap/submit |
| `install-obsidian.sh`, `setup-runner.sh`, `startup.sh` | brew/sudo/apt, system paths, network | breaks [I] — human-run infrastructure |
| **`power-mode` workload** | file tools (unsandboxed) + Bash: `git-commit` alias, `node --test`; Serena/Playwright via MCP | works [I]; subagents inherit the parent's sandbox config [C] |
| **`uat-auto-plus` workload** | background dev server, migrate/seed, curl, unit tests | needs config [I]: `allowLocalBinding`, localhost egress, project-specific package/DB allowlists |

**`install-global.sh` conclusion — confirmed [C]:** running it inside a sandboxed session fails. The sandbox denies writes to `~/.claude` (or `CLAUDE_CONFIG_DIR`) — "most of its contents, plus `~/.claude.json`" — and to `settings.json` at every scope; no `allowWrite` entry lifts a protected path, and the only opt-out is `filesystem.disabled`, which drops all filesystem isolation. It writes `settings.json`, `hooks/`, `skills/`, `file-suggestion.sh`, `bootstrap-prefs.js`, `templates/`, `bootstrap-prefs.json`, and calls `claude mcp add`. Only `settings.json` is certain to be covered per-path; the rest rests on the "most of its contents" phrasing [U]. **This is a documented constraint, not a blocker:** the installer is human-run in a plain terminal, unattended runs never need it, and a sandboxed agent being unable to rewrite its own policy or hooks *is* the feature. Rule to document: run `bootstrap install/setup/update` from a normal shell, never through a sandboxed session's Bash tool. Corollary: a user-scope `sandbox.enabled: true` sandboxes every session, including a human's, which is the practical argument against always-on.

**MCP conclusion — confirmed, not assumed [C]:** "MCP servers and command hooks are separate processes that run unconstrained on the host" (sandbox-environments); the sandbox "applies only to Bash, PowerShell, and Monitor commands and their child processes" (sandboxing). Serena (spawned by Claude Code) is unaffected, so the mandated navigation path survives. Brave, Playwright and Context7 are likewise outside. The flip side: Serena's editing tools, `Edit`/`Write`, and hooks can still write anything the permission system allows — the sandbox does not cover them.

**Findings the task did not anticipate (all [C] unless marked):**
1. **Bypass mode opens unlisted network hosts by default.** With `network.strictAllowlist: false`, hosts outside the allowlist are allowed under `bypassPermissions`. Enforcing the allowlist for unattended runs needs `network.strictAllowlist: true` (user/managed/`--settings` scope only, v2.1.219+).
2. **`excludedCommands` re-opens the script-file hole.** "When any part of a compound command matches an entry, Claude Code runs the whole command unsandboxed", so `docker ps && node write-settings.js` runs entirely outside the sandbox. TASK-0107's starter template (`docker *`, `docker-compose *`) therefore weakens exactly the boundary this task closes. The unattended-runs profile must not carry docker exclusions.
3. The settings.json write-deny cannot be lifted by `allowWrite` or an `Edit` allow rule. The v2.1.210 symlink-resolution version number comes from the research report only [U].
4. The docs say the sandbox "is not sufficient for fully unattended runs" in bypass or auto mode and recommend a container/VM — worth quoting in the Tier-3 limits.
5. **Step-4 HOME trap [I]:** protection follows the session's own `~/.claude` (or `CLAUDE_CONFIG_DIR`), not the child's `HOME`. `HOME=<scratch> node script.js` inside a sandboxed session writes `<scratch>/.claude/settings.json`, which is not protected — it would pass and prove nothing. The proof must target either the real protected path (non-destructively) or use `CLAUDE_CONFIG_DIR=<scratch>/.claude` for the sandboxed session.

**Confirmed schema (step-3 input):** `sandbox.enabled`, `failIfUnavailable` (default false → unsandboxed with a warning), `autoAllowBashIfSandboxed` (default true), `allowUnsandboxedCommands` (default true; false ignores `dangerouslyDisableSandbox`), `excludedCommands` (`Bash(...)` rule syntax), `filesystem.{allowWrite,denyWrite,denyRead,allowRead}` (`filesystem.disabled` user/managed only), `network.{allowedDomains,deniedDomains,strictAllowlist,allowLocalBinding,allowUnixSockets,allowAllUnixSockets,tlsTerminate}`, and `credentials.files: [{path, mode: deny|mask}]` / `credentials.envVars: [{name, mode, injectHosts?}]` (added v2.1.187; `mask` is user/managed/`--settings` only and needs `tlsTerminate` + `allowedDomains`). Path prefixes: `/` absolute, `~/` home, `//path` absolute; `./`/no prefix is project root in project settings but **`~/.claude` in user settings**. Linux/WSL2 skip wildcards in `allowWrite`/`denyWrite`. Arrays merge across scopes; booleans take the highest-precedence scope; `Edit` allow/deny and `Read` deny rules fold into `filesystem.*`, so TASK-026's A1/A2 entries strengthen the sandbox. Platforms: macOS Seatbelt (nothing to install); Linux/WSL2 bubblewrap + socat; native Windows and WSL1 unsupported.

**Per-run enablement mechanism [C]:** `claude --settings '<json-or-file>'` applies to one session only, writes no file, sits above user/project/local and below managed, and honors `strictAllowlist`/`credentials mask`/`tlsTerminate`. Subagents inherit the parent's sandbox config. A skill cannot toggle it (it is read by an already-running session), and whether `sandbox.enabled` hot-reloads mid-session is [U].

**Unconfirmed, left for UAT:** SSH `git push` under Seatbelt; nested `claude` from a sandboxed Bash; hot-reload of `sandbox.enabled`; whether the full `npm test` suite passes sandboxed; `launchctl`/`brew` failure modes; whether every `~/.claude` subpath the installer writes is protected.
<!-- Updated: 2026-09-19 -->

### 2. Decide the scope, and record the decision with its reasoning  <!-- agent: general-purpose -->

- [x] Choose from, and record why:
  - **(a) Unattended runs only** — `power-mode` and `uat-auto-plus`, which are the entire bypass surface. Highest value per unit of friction; the research's recommendation
  - **(b) Always-on for this repo** — strongest, but step 1 will show whether the installer and MCP bootstrap survive it
  - **(c) Ship it as opt-in template guidance** — document how, default off, let each project choose
- [x] **Do not set `disableBypassPermissionsMode`.** It would break `uat-auto-plus`, `power-mode`, `setup-strict-typechecks.sh:28`, and `migrate-project.sh:228`
- [x] **Do not set `allowManagedPermissionRulesOnly` or `allowManagedHooksOnly`.** The first would nullify all 116 deny entries in `~/.claude/settings.json`; the second would disable every hook this repo installs. Both are recorded footguns
- [x] Note that managed settings *are* self-applicable by a solo developer with `sudo` on macOS (`/Library/Application Support/ClaudeCode/`) — this is not MDM-only, so it is a real option for the strict end of the range

**Decision (2026-09-19, made autonomously by the tackling agent per the lead's instruction): (a) — unattended runs only, delivered as a per-run `--settings` profile, not merged into `~/.claude/settings.json`.** Step 1's measurements do not contradict the research recommendation; they reinforce it:

- **(b) always-on is rejected.** A user-scope `sandbox.enabled: true` sandboxes every session, including the human's; the installer (`install-global.sh`, `setup`, `update`) and every nested-`claude` script (`bootstrap-serena.sh`, `setup-strict-typechecks.sh`, `migrate-project.sh`) break inside a sandboxed Bash by design. Those are exactly the runs a human drives.
- **Bypass surface is unattended.** `power-mode` and `uat-auto-plus` do nothing the sandbox blocks (file tools and MCP are outside it; Bash is `git-commit`, `node --test`, curl to localhost) once localhost binding is allowed, so friction is minimal where the risk concentrates.
- **Delivery is the load-bearing consequence.** The task text says to deliver via `merge-settings-deny.js --set-key sandbox`. That mechanism writes a user-scope key, which makes the sandbox always-on by construction — it would implement (b), not (a). Instead the profile ships as a standalone settings file, `lib/scripts/templates/settings-sandbox-unattended.json` (wrapper form `{"sandbox": {...}}`), copied by `install-global.sh` to `~/.claude/templates/` (same directory and precedent as the prefs schema, step 6) and applied per session with `claude --settings <file>` at the tmux/CI/cron launcher that also passes `--dangerously-skip-permissions`. `--settings` sits above user/project/local and below managed, writes nothing, and its keys are honored for `strictAllowlist`/`credentials`. Subagents inherit the parent session's sandbox, so one launcher flag covers every `power-mode` child. A skill cannot enable it (it is read by an already-running session), so the docs point at the launcher.
- **The profile is deliberately stricter than TASK-0107's starter block.** Findings 1 and 2 above force it: `strictAllowlist: true` (otherwise bypass mode opens unlisted hosts, so `allowedDomains` gives no egress control), **no `excludedCommands`** (a compound command matching any exclusion runs entirely unsandboxed, so `docker *` re-opens the very hole this task closes), `allowUnsandboxedCommands: false`, and `failIfUnavailable: true` (fail closed rather than warn-and-run-unsandboxed). TASK-0107's `settings-sandbox.json` is left untouched: it remains the general user-scope opt-in starter, and its docker exclusion is a reasonable trade for interactive use. The two coexist; the README must say that arrays merge across scopes, so a user who opted into the starter carries `docker *` into an unattended run and should know that a compound command matching it runs unsandboxed.
- **Platform safety.** The file is inert unless a launcher passes it, so it cannot break native-Windows users the way a merged user-scope key could. Passing it on an unsupported platform fails closed (`failIfUnavailable`), which is the intent for an unattended run.
- **(c) is partly retained.** The template is opt-in guidance, default off; this repo's own launchers are documented to use it. Strict end of the range: managed settings at `/Library/Application Support/ClaudeCode/` are self-applicable via `sudo` on macOS (not MDM-only) and cannot be overridden by `--settings`; documented as an option, not shipped.
- **Recorded as not done, on purpose:** `disableBypassPermissionsMode` (would break `uat-auto-plus`, `power-mode`, `setup-strict-typechecks.sh:28`, `migrate-project.sh:228`), `allowManagedPermissionRulesOnly` (would nullify the deny list) and `allowManagedHooksOnly` (would disable every installed hook) are not set anywhere by this task, and a test asserts the profile carries none of them.
<!-- Updated: 2026-09-19 -->

### 3. Configure the sandbox  <!-- agent: general-purpose -->

- [x] Write the `sandbox` settings block the chosen scope requires — `sandbox.filesystem` (project writable; `~/.claude/` not), `sandbox.network` (registry and git hosts the workload actually needs, from step 1's table), `sandbox.credentials` (close the default `~/.aws`/`~/.ssh` read permission)
- [x] Deliver it the same way the deny list is delivered: a template under `lib/scripts/templates/`, merged by `merge-settings-deny.js --set-key sandbox` (that mode exists from TASK-029 and already handles absent / deep-equal / present-different)
  - **Adapted per the step-2 decision:** template delivered, but *not* merged — a `--set-key sandbox` merge is a user-scope key and would make the sandbox always-on (scope (b)). `lib/scripts/templates/settings-sandbox-unattended.json` is copied by `install-global.sh` (new block "6b", lines ~157-176) to `~/.claude/templates/settings-sandbox-unattended.json` and applied per session with `claude --settings`. TASK-0107's `settings-sandbox.json` is untouched and remains the `--set-key` opt-in starter.
- [x] **Never clobber an existing `sandbox` key** — the `--set-key` mode already warns and skips on a present-but-different value; keep that behavior
  - Satisfied structurally: the profile is never merged into any settings file, so no existing key can be clobbered. TASK-0107's step 7b keeps the `--set-key` never-clobber behavior for its own template.
- [x] Keep it **off by default on unsupported platforms.** Native Windows has no backend; the merge must not write a config that breaks those users
  - Satisfied: the file is inert unless a launcher passes `--settings`; nothing is written into `settings.json`. Passing it on an unsupported platform fails closed (`failIfUnavailable: true`) by intent.
- [x] Static gates: `bash -n lib/scripts/install-global.sh` passes; new `test/sandbox-unattended-profile.test.js` (10 tests) passes. `npm test`: 785 pass / 5 fail, all 5 in `test/skill-frontmatter-aliases.test.js` and `test/task-typed-links.test.js` (skills say `REQ-NNNN`/`TASK-NNNN`, tests expect `NNN`) — pre-existing uncommitted 3→4-digit ID rename from another in-flight task (TASK-0085 area), not touched by this task.
<!-- Updated: 2026-09-19 -->


### 4. Prove the gap is actually closed  <!-- agent: general-purpose -->

This is the acceptance criterion — everything else is scaffolding.

- [DEFERRED-TO-UAT] In a sandboxed session, write a script that does `fs.writeFileSync(os.homedir() + '/.claude/settings.json', …)` and run it with `node <file>`. **It must fail.** Today it succeeds, and that is the entire reason this task exists
- [DEFERRED-TO-UAT] Confirm the same script **still succeeds outside the sandbox**, so the test is demonstrating the sandbox rather than an unrelated failure
- [DEFERRED-TO-UAT] Verify the three hook-tier controls still behave as before, since the sandbox is additive and must not mask a regression: `node -e` denied, `>` redirect into `~/.zshrc` denied, `Edit` on settings.json denied
- [DEFERRED-TO-UAT] Verify the sandbox holds under `--dangerously-skip-permissions` specifically — that is the mode it exists to cover, and the research asserts it is mode-independent. Prove it here rather than citing it
- [x] **Use a scratch `HOME`** for anything that would otherwise write the real `~/.claude/` (precedent: TASK-029 step 5 confirmed `os.homedir()` follows a redirected `HOME`)
  - Recorded as a constraint on the UAT, with a correction from step 1 (finding 5): **a scratch `HOME` alone does not prove the sandbox.** Sandbox protection follows the *session's own* `~/.claude` / `CLAUDE_CONFIG_DIR`, not the child process's `HOME`, so `HOME=<scratch> node script.js` inside a sandboxed session writes an unprotected `<scratch>/.claude/settings.json` and passes for the wrong reason. The UAT must instead start the sandboxed session with `CLAUDE_CONFIG_DIR=<scratch>/.claude` (protection then follows that directory) and target `<scratch>/.claude/settings.json` from the script; only if that is impractical, target the real path with the script writing the file's own current bytes after a backup. Never run `install-global.sh` against the real `HOME`.

**Why step 4 is deferred, and exactly what was and was not verified.** Proving the gap needs a live, sandboxed Claude Code session (the sandbox wraps only that session's Bash tool; there is no standalone way to exercise the same policy from this shell without spawning a nested agent session or installing `@anthropic-ai/sandbox-runtime`, and the repo's own install-consent hook forbids the latter). `/tackle` scopes verification to static gates, and the lead's guardrails forbid writing the real `~/.claude/settings.json` — so none of the four runtime proofs were attempted, and **none is claimed.**

- **Verified (static):** the profile parses as JSON; has `enabled`, `failIfUnavailable`, `allowUnsandboxedCommands: false`, `strictAllowlist: true`; carries no `excludedCommands`, no forbidden manager/bypass keys; `install-global.sh` copies it to `~/.claude/templates/` and never merges it (`test/sandbox-unattended-profile.test.js`); `bash -n install-global.sh`. The three hook-tier controls' *unit* tests (`node -e`, `>` redirect, `Edit` on settings.json) are part of `npm test` and were not among the failures.
- **Not verified (UAT must prove):** (1) sandboxed `node <script>` write to the protected settings path fails; (2) the same script succeeds outside the sandbox; (3) the three hook-tier controls block in a live session with the sandbox enabled; (4) the block holds under `--dangerously-skip-permissions`; (5) the settings-schema keys used by the profile (`credentials.envVars` deny entries, `strictAllowlist`, `denyRead` on a directory) are accepted by the installed Claude Code version without a schema warning and behave as documented, and `credentials.files` accepts these paths; (6) `npm test` and a `power-mode` / `uat-auto-plus` dry run under the profile (Step 1 flagged SSH `git push`, nested `claude`, and `sandbox.enabled` hot-reload as unconfirmed).
<!-- Updated: 2026-09-19 -->

### 5. Document, correct, and close the loop  <!-- agent: general-purpose -->

- [x] Update the **residual-risk** sections that currently say this gap is open, now that it is not — `lib/hooks/claude-settings-guard.js` header, `lib/hooks/README.md`, `lib/scripts/README.md`. Each currently ends with "`/sandbox` remains the only real containment"; that sentence needs to become a pointer to the shipped configuration rather than a promissory note
- [x] Add a Tier-3 section to `lib/hooks/README.md` completing the three-tier story, and state the limits from the Approach above **plainly** — Bash-and-children only, credentials readable by default unless configured, TLS not terminated, Windows unsupported. A reader who thinks the sandbox is total is worse off than one who knows its edges
- [x] Update `CLAUDE.md` if the setup flow changes
  - Two one-clause edits: the `install` Setup Workflow bullet and the `install-global.sh` Key Files entry (which also states the installer must run from a normal shell).
- [x] `npm test` green; add assertions for whatever is mechanically checkable (the template's shape, the merge behavior) — the runtime sandbox checks belong in UAT
  - Assertions added in step 3 (`test/sandbox-unattended-profile.test.js`); there is no merge behavior to assert because the profile is deliberately not merged. The sandbox-related suites (`sandbox-unattended-profile`, `sandbox-scaffold-docs`, `hook-comments`: 27/27) pass, as do `bash -n install-global.sh` and `node --check claude-settings-guard.js`. **Full `npm test` is NOT green**: the tree has failures in other in-flight work (skill rename `task-add` → `task-create` yielding ENOENT/description mismatches, and the 3→4-digit ID rename vs `test/skill-frontmatter-aliases.test.js` / `test/task-typed-links.test.js`); none touch sandbox, hook-README, or install-global files. Not fixed here.
<!-- Updated: 2026-09-19 -->

