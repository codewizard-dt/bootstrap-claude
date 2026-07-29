---
topic: "Which Claude Code controls survive --dangerously-skip-permissions (bypassPermissions) mode: deny rules, ask rules, PreToolUse hooks, or only the sandbox"
slug: bypass-mode-enforcement
researched: 2026-07-29
---

# Primary Sources — Bypass-mode control survival

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | web | https://code.claude.com/docs/en/permission-modes | 2026-07-29 | **The decisive source.** Deny + explicit ask rules "apply in every mode, including `bypassPermissions`"; allow rules have no effect there; protected-path per-mode table showing bypass = Allowed; root/sudo refusal; web sessions ignore checked-in bypass defaultMode |
| S2 | web | https://code.claude.com/docs/en/permissions | 2026-07-29 | Deny→ask→allow precedence; deny-at-any-level is unoverridable; hook exit 2 stops the call before permission rules are evaluated; `disableBypassPermissionsMode` "works from any scope"; managed-only key descriptions; `Write(...)` rules never consulted; Read/Edit deny don't cover arbitrary subprocesses |
| S3 | web | https://code.claude.com/docs/en/hooks | 2026-07-29 | PreToolUse fires on every tool call except `EndConversation`; `permission_mode` input field enumerates `"bypassPermissions"`; exit 2 = "blocks the tool call"; `permissionDecision` values allow/deny/ask/defer |
| S4 | web | https://code.claude.com/docs/en/sandboxing | 2026-07-29 | Sandbox "is not a permission mode"; OS enforces boundary "regardless of what the model chose to run"; Seatbelt/bubblewrap; comparison table row for `--dangerously-skip-permissions`; settings.json write denial with symlink resolution; TLS/domain-fronting and Read/Edit-outside-sandbox limitations |
| S5 | web | https://code.claude.com/docs/en/settings | 2026-07-29 | Managed settings file paths per platform (macOS `/Library/Application Support/ClaudeCode/`, Linux `/etc/claude-code/`, Windows `C:\Program Files\ClaudeCode\`); `managed-settings.d/` drop-in; settings precedence order |
| S6 | web | https://github.com/anthropics/claude-code/issues/20946 | 2026-07-29 | Report that PreToolUse hooks fire asynchronously (non-blocking) under `--dangerously-skip-permissions` on v2.1.19. **Closed as not planned; no maintainer confirmation.** Cited as low-confidence caveat only |
| S7 | web | https://github.com/anthropics/claude-code/issues/47810 | 2026-07-29 | Report that both the bypass flag and PreToolUse hooks stop firing after a background task completes, on v2.1.107. **Closed as duplicate.** Cited as low-confidence caveat only |
| S8 | web | https://www.truefoundry.com/blog/claude-code-dangerously-skip-permissions | 2026-07-29 | Third-party corroboration that hooks fire and deny rules are evaluated in bypass mode. Secondary, not authoritative |
| S9 | web | https://www.morphllm.com/claude-code-dangerously-skip-permissions | 2026-07-29 | Third-party corroboration that a PreToolUse hook exiting 2 blocks regardless of permission mode. Secondary, not authoritative |
| S10 | codebase | `lib/hooks/README.md:14-19`, `:311-312`, `:7-10` | 2026-07-29 | The repo's own (incorrect) claim that deny rules are not enforced under bypass; and that hook registration in `~/.claude/settings.json` is manual |
| S11 | codebase | `lib/skills/uat-auto-plus/SKILL.md:2,19,27`; `lib/skills/power-mode/SKILL.md:45,71-176`; `lib/scripts/setup-strict-typechecks.sh:28`; `lib/scripts/setup-deployment.sh:104`; `lib/scripts/migrate-project.sh:228` | 2026-07-29 | The repo's actual bypass-mode surface: uat-auto-plus is a skill read by an already-bypassed session (it does not invoke `claude` itself); power-mode mandates `mode: "bypassPermissions"` on every spawned agent; three setup scripts invoke `claude -p --dangerously-skip-permissions` directly |

## Excerpts

### S1 — Choose a permission mode
https://code.claude.com/docs/en/permission-modes

> Modes set the baseline. Layer [permission rules](/docs/en/permissions#manage-permissions) on top to pre-approve or block specific tools. These controls apply in every mode, including `bypassPermissions`:
>
> * deny rules and explicit ask rules, which apply to every tool but can't block [`EndConversation`](/docs/en/tools-reference#endconversation-tool-behavior) while any other tool remains
> * the [org `ask` setting on connector tools](/docs/en/mcp#organization-controls-on-connector-tools)
> * the [`requiresUserInteraction`](/docs/en/mcp#require-approval-for-a-specific-tool) marker
>
> Allow rules have no effect in `bypassPermissions` because everything else is already approved.

> `bypassPermissions` mode disables permission prompts and safety checks so tool calls execute immediately, including writes to [protected paths](#protected-paths). Before v2.1.126, protected-path writes still prompted in this mode.
>
> Explicit [ask rules](/docs/en/permissions#manage-permissions) and connector tools [your organization set to `ask`](/docs/en/mcp#organization-controls-on-connector-tools) still force a prompt in this mode.

> Removals targeting the filesystem root or home directory, such as `rm -rf /` and `rm -rf ~`, still prompt as a circuit breaker against model error. The circuit breaker also fires when the command contains command substitution with `$(...)` or backticks, or process substitution with `<(...)` […]

Protected-path per-mode table:

> | Mode | Protected-path writes |
> | `default`, `acceptEdits` | Prompted |
> | `auto` | Routed to the classifier |
> | `dontAsk` | Denied |
> | `bypassPermissions` | Allowed |

> [`permissions.allow`](/docs/en/permissions#manage-permissions) rules in settings files do not pre-approve protected-path writes. The safety check runs before Claude Code evaluates allow rules from settings […]

Protected paths list (abridged to the entries relevant to this repo's proposal):

> Protected directories: `.git`, `.config/git`, `.vscode`, `.idea`, `.husky`, `.cargo`, `.devcontainer`, `.yarn`, `.mvn`, `.claude`, except for `.claude/worktrees` […]
> Protected files: `.gitconfig`, `.gitmodules`; `.bashrc`, `.bash_profile`, `.bash_login`, `.bash_aliases`, `.bash_logout`, `.zshrc`, `.zprofile`, `.zshenv`, `.zlogin`, `.zlogout`, `.profile`, `.envrc`; `.npmrc`, `.yarnrc` […]; `.mcp.json`, `.claude.json`

On deny in every mode (from the auto-mode default-allow list):

> The push's content is still checked against the other rules, [`permissions.deny` rules](/docs/en/permissions#manage-permissions) can still block pushes to specific branches outright in every mode […]

> On Linux and macOS, Claude Code refuses to start in this mode when running as root or under `sudo`

> [Claude Code on the web](/docs/en/claude-code-on-the-web) does not honor `defaultMode: "bypassPermissions"` or `"dontAsk"` from your settings files, so a repository's checked-in settings cannot start a cloud session in bypass-permissions mode.

### S2 — Configure permissions
https://code.claude.com/docs/en/permissions

> Rules are evaluated in order: deny, then ask, then allow. The first match in that order determines the outcome, and rule specificity doesn't change the order.

> A broad deny rule like `Bash(aws *)` blocks every matching call, including calls that also match a narrower allow rule like `Bash(aws s3 ls)`, so a deny rule can't carry allowlist exceptions.

> If a tool is denied at any level, no other level can allow it. For example, a managed settings deny can't be overridden by `--allowedTools` […] The same holds across settings scopes: if user settings allow a permission and project settings deny it, the deny rule blocks it.

> When Claude Code makes a tool call, PreToolUse hooks run before the permission prompt, for every tool except [`EndConversation`](/docs/en/tools-reference#endconversation-tool-behavior). The hook output can deny the tool call, force a prompt, or skip the prompt to let the call proceed.

> Hook decisions don't bypass permission rules. Claude Code evaluates deny and ask rules regardless of what a PreToolUse hook returns: a matching deny rule blocks the call, and a matching ask rule still prompts even when the hook returned `"allow"` or `"ask"`.

> A blocking hook also takes precedence over allow rules. A hook that exits with code 2 stops the tool call before permission rules are evaluated, so the block applies even when an allow rule would otherwise let the call proceed. To run all Bash commands without prompts except for a few you want blocked, add `"Bash"` to your allow list and register a PreToolUse hook that rejects those specific commands.

On self-application of the bypass lock:

> `disableBypassPermissionsMode` is typically placed in managed settings to enforce organizational policy, but it works from any scope. A user can set it in their own settings to lock themselves out of bypass mode.

> To prevent `bypassPermissions` or `auto` mode from being used, set `permissions.disableBypassPermissionsMode` or `permissions.disableAutoMode` to `"disable"` in any [settings file](/docs/en/settings#settings-files). These are most useful in [managed settings](#managed-settings) where they can't be overridden.

Managed-only keys:

> `allowManagedPermissionRulesOnly` — When `true`, prevents user and project settings from defining `allow`, `ask`, or `deny` permission rules. Only rules in managed settings apply. Doesn't affect the MCP server allowlist […]

> `allowManagedHooksOnly` — Only managed hooks, SDK hooks, and hooks from plugins force-enabled in managed settings `enabledPlugins` are loaded. User, project, and all other plugin hooks are blocked.

On `Write(...)` rules and subprocess reach:

> Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only. If you write a path rule for `Write`, `NotebookEdit`, `Glob`, or the legacy `MultiEdit` tool instead, Claude Code accepts the rule but never consults it, and warns at startup […]

> Read and Edit deny rules apply to Claude's built-in file tools and to file commands Claude Code recognizes in Bash, such as `cat`, `head`, `tail`, and `sed`. They don't apply to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself. For OS-level enforcement that blocks all processes from accessing a path, [enable the sandbox](/docs/en/sandboxing).

> Permission rules are enforced by Claude Code, not by the model. Instructions in your prompt or `CLAUDE.md` shape what Claude tries to do, but they don't change what Claude Code allows.

> Filesystem restrictions in the sandbox combine the [`sandbox.filesystem`](/docs/en/sandboxing) settings with Read and Edit deny rules; both are merged into the final sandbox boundary

### S3 — Hooks reference
https://code.claude.com/docs/en/hooks

> on every tool call inside the agentic loop: `PreToolUse` and `PostToolUse`, except [`EndConversation`](/docs/en/tools-reference#endconversation-tool-behavior) calls, which skip both

> `permission_mode`: Current [permission mode](/docs/en/permissions#permission-modes): `"default"`, `"plan"`, `"acceptEdits"`, `"auto"`, `"dontAsk"`, or `"bypassPermissions"`. The mode labeled **Manual** arrives as `"default"`, never as `"manual"`, so scripts that match `"default"` keep working. Not all events receive this field.

> **Exit 2** means a blocking error. Claude Code ignores stdout and any JSON in it. Instead, stderr text is fed back to Claude as an error message. The effect depends on the event: `PreToolUse` blocks the tool call, `UserPromptSubmit` rejects the prompt, and so on.

> PreToolUse | `hookSpecificOutput` | `permissionDecision` (allow/deny/ask/defer), `permissionDecisionReason`

### S4 — Configure the sandboxed Bash tool
https://code.claude.com/docs/en/sandboxing

> `/sandbox` is not a [permission mode](/docs/en/permission-modes). Permission modes decide whether a tool call runs and whether you are prompted first, while the sandbox restricts what a Bash command can access once it runs.

Comparison table row:

> | `--dangerously-skip-permissions` | Whether each tool call runs | Nothing. [Protected path](/docs/en/permission-modes#protected-paths) checks are also skipped; only explicit [ask rules](/docs/en/permissions#manage-permissions), connector tools [your organization set to `ask`](…), MCP tools marked [`requiresUserInteraction`](…), and removing `/` or your home directory still prompt |

> The two layers also differ in how they are enforced. Claude Code evaluates permission decisions before a command runs, based on the command string and, in auto mode, a separate classifier's judgment about whether the command is safe. The operating system enforces the sandbox boundary on the running process, so it holds regardless of what the model chose to run and even if an allowed command does more than its name suggests.

> **macOS**: uses Seatbelt for sandbox enforcement
> **Linux**: uses [bubblewrap](https://github.com/containers/bubblewrap) for isolation
> **WSL2**: uses bubblewrap, same as Linux

> **Settings files protected**: the sandbox automatically denies write access to Claude Code's `settings.json` files at every scope and to the managed settings directory, so a sandboxed command can't modify its own policy unless you [disable filesystem isolation](#disable-filesystem-isolation) […] The deny rules resolve symlinks: when a symlink appears at a protected settings file path after startup, the sandbox adds its target to the deny list for the next command […]

> Even in auto-allow mode, the following still apply:
> * Explicit [deny rules](/docs/en/permissions) are always respected

> **Built-in file tools**: Read, Edit, and Write use the permission system directly rather than running through the sandbox.

> **Default read behavior**: read access to the entire computer, except certain denied directories. Note that this default still allows reading credential files such as `~/.aws/credentials` and `~/.ssh/`.

> Because the proxy makes its allow decision from the client-supplied hostname without inspecting TLS, code running inside the sandbox can potentially use [domain fronting](https://en.wikipedia.org/wiki/Domain_fronting) or similar techniques to reach hosts outside the allowlist.

> **Subagents**: [subagents](/docs/en/sub-agents) run in the same process as the parent session and use the same sandbox configuration.

### S5 — Settings
https://code.claude.com/docs/en/settings

Managed settings file paths:

> | **macOS** | `/Library/Application Support/ClaudeCode/` |
> | **Linux & WSL** | `/etc/claude-code/` |
> | **Windows** | `C:\Program Files\ClaudeCode\` |

> File-based managed settings also support a drop-in directory at `managed-settings.d/` in the same system directory alongside `managed-settings.json`. This lets separate teams deploy independent policy fragments without coordinating edits to a single file.

> When the same setting appears in multiple scopes, Claude Code applies them in priority order:
> 1. **Managed** (highest): can't be overridden by anything
> 2. **Command line arguments**: temporary session overrides
> 3. **Local**: overrides project and user settings
> 4. **Project**: overrides user settings
> 5. **User** (lowest): applies when nothing else specifies the setting

### S6 — [BUG] PreToolUse hooks don't block command execution in bypass mode
https://github.com/anthropics/claude-code/issues/20946
State: **Closed as not planned.** Claude Code v2.1.19.

> When running Claude Code with --dangerously-skip-permissions, PreToolUse hooks fire but don't block command execution. The command executes immediately while the hook runs asynchronously in the background.

> PreToolUse hooks should block command execution synchronously, regardless of whether --dangerously-skip-permissions is enabled.

> My PreToolUse hook runs quality checks (shellcheck, ruff, mypy, pytest) before commits. This takes 30-40 seconds. In bypass mode, commits proceed immediately while checks run in the background. By the time checks fail and return exit code 2, the commit is already in git history.

### S7 — [BUG] --dangerously-skip-permissions and PreToolUse hooks both bypassed after background task completion
https://github.com/anthropics/claude-code/issues/47810
State: **Closed as duplicate.** Claude Code v2.1.107.

> When running Claude Code with --dangerously-skip-permissions --permission-mode bypassPermissions, both the CLI flag AND configured PreToolUse hooks stop taking effect after certain events during a session — specifically after background tasks complete.

### S8 — Claude Code --dangerously-skip-permissions: What It Does and When Not to Use It
https://www.truefoundry.com/blog/claude-code-dangerously-skip-permissions
*Third-party blog — secondary corroboration only.*

> PreToolUse hooks, which still fire and can block specific tool calls even in bypass mode · Deny rules in disallowed_tools and settings.json, which get evaluated before the mode check

> Here's a fact that surprises people: hooks fire even in bypass mode. A PreToolUse hook can block any tool call, regardless of which permission mode you're running.

### S9 — claude --dangerously-skip-permissions (2026): What It Does, 5 Safer Setups & the New Auto Mode
https://www.morphllm.com/claude-code-dangerously-skip-permissions
*Third-party blog — secondary corroboration only.*

> Hooks also still fire: a PreToolUse hook that exits with code 2 blocks the tool call regardless of permission mode.

> Hook decisions never override deny rules, and a hook exiting 2 blocks a call even when an allow rule matches.

### S10 — `lib/hooks/README.md` (this repo)
Lines 14-19:

> The permissions `deny` list is **not consulted** when an agent runs in
> `bypassPermissions` mode (`--dangerously-skip-permissions`, power-mode teammates,
> or any subagent spawned with `mode: bypassPermissions`). `PreToolUse` hooks, by
> contrast, fire in **every** permission mode and for **subagent** tool calls. So a
> hook is the only reliable enforcement point for "this must never run, even under
> bypass." Keep a matching `deny` entry too — belt-and-suspenders for normal modes.

Lines 311-312:

> - Deny rules are **not enforced** in `bypassPermissions` mode — that is exactly
>   why these hooks exist (see above). The deny list covers normal modes.

Lines 7-10:

> **Important:** the install script copies the *scripts* but does **not** wire them
> into `~/.claude/settings.json`. Hook *registration* is a global-settings concern
> and must be added once, by hand, using the snippets below. Without the wiring the
> scripts sit on disk and never run.

Both bolded claims contradict [S1] and [S2]. The first sentence about hooks firing in every permission mode is correct; the sentences about deny rules are not.

### S11 — Bypass-mode surface in this repo
`lib/skills/power-mode/SKILL.md:45`

> Every agent spawned in power-mode MUST include `mode: "bypassPermissions"` and the following footer appended to its prompt:

`lib/skills/uat-auto-plus/SKILL.md:19`

> **Designed for unattended agents** — e.g. a Claude Code instance launched with `--dangerously-skip-permissions` from a tmux orchestrator, CI, or cron.

`lib/scripts/setup-strict-typechecks.sh:28`

> claude -p --dangerously-skip-permissions "$PROMPT"

`lib/scripts/setup-deployment.sh:104`

> claude -p --dangerously-skip-permissions --strict-mcp-config < /dev/null "$PROMPT" &

`lib/scripts/migrate-project.sh:228`

> CLAUDE_MIGRATION=1 claude -p --verbose --dangerously-skip-permissions --strict-mcp-config \
