---
id: TASK-031
title: "Tier 3: adopt /sandbox to close the script-file write path to settings.json"
status: todo
created: 2026-07-30
updated: 2026-07-30
depends_on: []
blocks: []
parallel_safe_with: [TASK-030]
uat: ""
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

- [ ] Inventory this repo's real Bash workload and classify each by what it needs from the OS — filesystem writes outside the project, network egress, and process spawning. At minimum: `npm test`, `npm install`, `git` (including `push`), `node lib/scripts/*.js`, `bash lib/scripts/*.sh`, `install-global.sh` (writes `~/.claude/`), `uvx --from git+…` (Serena bootstrap), `docker` (Brave MCP), `launchctl` (Playwright agent)
- [ ] **`install-global.sh` is the interesting case and must be called out explicitly**: it writes `~/.claude/hooks/` and `~/.claude/settings.json` by design. Under a sandbox that denies settings writes at every scope, *running the installer from inside a sandboxed session would fail.* Determine whether that is true, and if so, record it as a documented constraint — the installer is run by a human, not by an unattended agent, so this may be acceptable rather than a blocker
- [ ] Determine how MCP servers are affected. They are spawned by Claude Code rather than by the Bash tool, so they are likely outside the sandbox — **verify rather than assume**, since Serena backs the mandated navigation path and losing it would be severe
- [ ] Produce a table: command → needs → sandboxed verdict (works / needs config / breaks). This table is the input to step 2, not a formality

### 2. Decide the scope, and record the decision with its reasoning  <!-- agent: general-purpose -->

- [ ] Choose from, and record why:
  - **(a) Unattended runs only** — `power-mode` and `uat-auto-plus`, which are the entire bypass surface. Highest value per unit of friction; the research's recommendation
  - **(b) Always-on for this repo** — strongest, but step 1 will show whether the installer and MCP bootstrap survive it
  - **(c) Ship it as opt-in template guidance** — document how, default off, let each project choose
- [ ] **Do not set `disableBypassPermissionsMode`.** It would break `uat-auto-plus`, `power-mode`, `setup-strict-typechecks.sh:28`, `setup-deployment.sh:104`, and `migrate-project.sh:228`
- [ ] **Do not set `allowManagedPermissionRulesOnly` or `allowManagedHooksOnly`.** The first would nullify all 116 deny entries in `~/.claude/settings.json`; the second would disable every hook this repo installs. Both are recorded footguns
- [ ] Note that managed settings *are* self-applicable by a solo developer with `sudo` on macOS (`/Library/Application Support/ClaudeCode/`) — this is not MDM-only, so it is a real option for the strict end of the range

### 3. Configure the sandbox  <!-- agent: general-purpose -->

- [ ] Write the `sandbox` settings block the chosen scope requires — `sandbox.filesystem` (project writable; `~/.claude/` not), `sandbox.network` (registry and git hosts the workload actually needs, from step 1's table), `sandbox.credentials` (close the default `~/.aws`/`~/.ssh` read permission)
- [ ] Deliver it the same way the deny list is delivered: a template under `lib/scripts/templates/`, merged by `merge-settings-deny.js --set-key sandbox` (that mode exists from TASK-029 and already handles absent / deep-equal / present-different)
- [ ] **Never clobber an existing `sandbox` key** — the `--set-key` mode already warns and skips on a present-but-different value; keep that behavior
- [ ] Keep it **off by default on unsupported platforms.** Native Windows has no backend; the merge must not write a config that breaks those users

### 4. Prove the gap is actually closed  <!-- agent: general-purpose -->

This is the acceptance criterion — everything else is scaffolding.

- [ ] In a sandboxed session, write a script that does `fs.writeFileSync(os.homedir() + '/.claude/settings.json', …)` and run it with `node <file>`. **It must fail.** Today it succeeds, and that is the entire reason this task exists
- [ ] Confirm the same script **still succeeds outside the sandbox**, so the test is demonstrating the sandbox rather than an unrelated failure
- [ ] Verify the three hook-tier controls still behave as before, since the sandbox is additive and must not mask a regression: `node -e` denied, `>` redirect into `~/.zshrc` denied, `Edit` on settings.json denied
- [ ] Verify the sandbox holds under `--dangerously-skip-permissions` specifically — that is the mode it exists to cover, and the research asserts it is mode-independent. Prove it here rather than citing it
- [ ] **Use a scratch `HOME`** for anything that would otherwise write the real `~/.claude/` (precedent: TASK-029 step 5 confirmed `os.homedir()` follows a redirected `HOME`)

### 5. Document, correct, and close the loop  <!-- agent: general-purpose -->

- [ ] Update the **residual-risk** sections that currently say this gap is open, now that it is not — `lib/hooks/claude-settings-guard.js` header, `lib/hooks/README.md`, `lib/scripts/README.md`. Each currently ends with "`/sandbox` remains the only real containment"; that sentence needs to become a pointer to the shipped configuration rather than a promissory note
- [ ] Add a Tier-3 section to `lib/hooks/README.md` completing the three-tier story, and state the limits from the Approach above **plainly** — Bash-and-children only, credentials readable by default unless configured, TLS not terminated, Windows unsupported. A reader who thinks the sandbox is total is worse off than one who knows its edges
- [ ] Update `CLAUDE.md` if the setup flow changes
- [ ] `npm test` green; add assertions for whatever is mechanically checkable (the template's shape, the merge behavior) — the runtime sandbox checks belong in UAT
