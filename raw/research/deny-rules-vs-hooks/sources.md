---
topic: "Whether Claude Code deny rules can block fetch-and-execute pipelines and gate package installation, or whether these require a PreToolUse hook"
slug: deny-rules-vs-hooks
researched: 2026-07-29
---

# Primary Sources — Deny rules vs. PreToolUse hooks

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | web | https://code.claude.com/docs/en/permissions | 2026-07-29 | Load-bearing source. Separator set + per-subcommand matching; per-subcommand rule *generation*; PowerShell pipeline splitting; deny matching past leading assignments; `ask` tier definition; ask-beats-allow precedence; ask surviving `bypassPermissions`, hooks, and sandboxing; deny cannot carry allowlist exceptions; `Ctrl+E` risk explainer; `Bash(command:...)` startup warning; read-only command set |
| S2 | web | https://code.claude.com/docs/en/hooks | 2026-07-29 | PreToolUse input schema (raw undecomposed `tool_input.command`); exit-2 blocking contract and stderr routing; `hookSpecificOutput.permissionDecision` accepting `allow`/`deny`/`ask`/`defer`; `permissionDecisionReason` → Claude vs `systemMessage` → user |
| S3 | web | https://code.claude.com/docs/en/errors#is-not-matched-by-file-permission-checks | 2026-07-29 | Complete configuration-warning set: only untrusted-workspace allow rules and unmatched **file-path** patterns. No warning for unenforceable Bash command patterns. `claude permission-check <path>` diagnostic |
| S4 | web | https://code.claude.com/docs/en/settings | 2026-07-29 | Official `permissions` example shows only `allow`/`deny` (why `ask` needed corroboration); settings hot-reload covering `permissions` and `hooks` |
| S4-community | web | https://claudecode-lab.com/en/blog/claude-code-permissions-guide/ | 2026-07-29 | Corroborates literal `"ask": [...]` array in `settings.json` with content-scoped Bash entries; confirms hook output does not override deny/ask rules |
| S5 | codebase | `lib/scripts/merge-settings-deny.js` | 2026-07-29 | Target key hardcoded at line 84; `--source` default line 26; string-only validation line 52; `Set` dedup line 86; additive-only, no removal path. Basis for the ~15-line `--key` generalization estimate |
| S6 | codebase | `lib/hooks/` (12 scripts + README), `lib/scripts/install-mcps.sh:197,296-298`, `lib/scripts/bootstrap-serena.sh:35,51` | 2026-07-29 | Existing hook inventory and manual `PreToolUse` wiring requirement; live `uvx --from git+` and `npm install -g` invocations confirmed script-internal (subprocesses, ungated) |
| S7 | web | https://github.com/dylancaponi/claude-code-permissions | 2026-07-29 | Independent practitioner confirmation that recent versions split compound commands and match subcommands independently, *and* that `curl \| sh` still slips past static rules |
| S8 | web | https://rajiv.com/blog/2026/03/31/stop-asking-me-configuring-claude-code-permissions-for-uninterrupted-flow/ | 2026-07-29 | The contradicting claim (full-string evaluation), documented and resolved in Key Finding F1 |
| S9 | web | https://www.morphllm.com/claude-code-dangerously-skip-permissions | 2026-07-29 | Independent restatement of separator set and per-subcommand matching; hook decisions never override deny rules |
| S10 | web | https://www.developersdigest.tech/blog/claude-code-permissions-settings-guide | 2026-07-29 | Independent restatement of compound-command splitting; caveat that Bash matching is best-effort, not a hardened sandbox |
| S11 | web | https://institute.sfeir.com/en/claude-code/claude-code-permissions-and-security/quickstart/ | 2026-07-29 | The circulating **incorrect** deny+allow advice for `npm install`, flagged in F5 as contradicting official precedence |
| S12 | codebase | `wiki/work/tasks/TASK-026-proposal.md`, `wiki/work/tasks/TASK-026-audit-settings-deny-list.md` | 2026-07-29 | The 10 held B2 rules, approved core count of 72, the dropped pipeline-literal and `uvx` candidates, and the user's verbatim package-consent requirement |

## Excerpts

### S1 — Configure permissions (Claude Code docs)
https://code.claude.com/docs/en/permissions

Compound-command decomposition:
> Claude Code is aware of shell operators, so a rule like `Bash(safe-cmd *)` won't give it permission to run the command `safe-cmd && other-cmd`. The recognized command separators are `&&`, `||`, `;`, `|`, `|&`, `&`, and newlines. A rule must match each subcommand independently.

Per-subcommand rule *generation* (the decisive corroboration):
> When you approve a compound command with "Yes, don't ask again", Claude Code saves a separate rule for each subcommand that requires approval, rather than a single rule for the full compound string. For example, approving `git status && npm test` saves a rule for `npm test`, so future `npm test` invocations are recognized regardless of what precedes the `&&`. Subcommands like `cd` into a subdirectory generate their own Read rule for that path. Up to 5 rules may be saved for a single compound command.

Pipes named explicitly as splitting (PowerShell section):
> Claude Code parses the PowerShell AST and checks each command in a compound command independently. Pipeline operators `|`, statement separators `;`, and on PowerShell 7+ the chain operators `&&` and `||` split a compound command into subcommands. A rule must match every subcommand for the compound command to be allowed.

Deny rules operate on the same normalized form:
> Claude Code also strips a leading assignment of certain known-safe environment variables, so `Bash(npm test *)` matches `NODE_ENV=test npm test`. An allow rule won't match past an assignment of any other variable. A deny or ask rule matches past any leading assignment, so `Bash(rm *)` in deny still matches `FOO=bar rm -rf tmp/`.

The `ask` tier and precedence:
> * **Allow** rules let Claude Code use the specified tool without manual approval.
> * **Ask** rules prompt for confirmation whenever Claude Code tries to use the specified tool.
> * **Deny** rules prevent Claude Code from using the specified tool.
>
> Rules are evaluated in order: deny, then ask, then allow. The first match in that order determines the outcome, and rule specificity doesn't change the order.

Ask cannot be silenced by an allow rule; deny cannot carry exceptions:
> A broad deny rule like `Bash(aws *)` blocks every matching call, including calls that also match a narrower allow rule like `Bash(aws s3 ls)`, so a deny rule can't carry allowlist exceptions. The same precedence applies between ask and allow: a matching ask rule prompts even when a more specific allow rule also matches the same call.

Ask survives `bypassPermissions`:
> `bypassPermissions` | Skips permission prompts, except those forced by explicit `ask` rules, connector tools your organization set to `ask`, and MCP tools marked `requiresUserInteraction`. Root and home directory removals such as `rm -rf /` also still prompt as a circuit breaker

Ask survives a PreToolUse hook:
> Hook decisions don't bypass permission rules. Claude Code evaluates deny and ask rules regardless of what a PreToolUse hook returns: a matching deny rule blocks the call, and a matching ask rule still prompts even when the hook returned `"allow"` or `"ask"`.

Ask survives sandboxing:
> Content-scoped ask rules like `Bash(git push *)` still force a prompt, explicit deny rules still apply, and `rm` or `rmdir` commands that target `/`, your home directory, or other critical system paths still trigger a prompt.

"Don't ask again" writes an allow rule (which the ask rule then out-ranks):
> When you choose "Yes, don't ask again" and the approval saves permanently, such as for a Bash command, Claude Code saves the rule to `.claude/settings.local.json` at the root of the git repository, resolved through worktrees to the main checkout.

The user sees the exact command, with a risk explainer:
> On a Bash or PowerShell permission prompt, press `Ctrl+E` to show an explanation of the command: what it does, why Claude is running it, and what could go wrong, labeled **Low risk**, **Med risk**, or **High risk**.

The one documented Bash-pattern startup warning (parameter rules only):
> You can't match a tool's primary content field this way: `command` for Bash and PowerShell, `file_path` for Read, Edit, and Write... A rule like `Bash(command:rm *)` would be bypassable by a compound command, so Claude Code ignores it and emits a startup warning. Use `Bash(rm *)`, `Read(./path)`, or `WebFetch(domain:host)` instead.

Installs are not in the read-only set (so they already prompt in `default` mode):
> Claude Code recognizes a built-in set of Bash commands as read-only and runs them without a permission prompt in every mode. These include `ls`, `cat`, `echo`, `pwd`, `head`, `tail`, `grep`, `find`, `wc`, `which`, `diff`, `stat`, `du`, `cd`, and read-only forms of `git`. The set is not configurable; to require a prompt for one of these commands, add an `ask` or `deny` rule for it.

Enforcement is by the CLI, not the model:
> Permission rules are enforced by Claude Code, not by the model. Instructions in your prompt or CLAUDE.md shape what Claude tries to do, but they don't change what Claude Code allows.

### S2 — Hooks reference (Claude Code docs)
https://code.claude.com/docs/en/hooks

PreToolUse receives the raw command string:
```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite"
  },
  "tool_use_id": "toolu_01ABC123..."
}
```
> The `tool_input` object contains the raw undecomposed `command` string exactly as Claude will execute it. For Bash, this is the full command line as a single string.

Exit-2 contract:
> Exit 2 means a blocking error. Claude Code ignores stdout and any JSON in it. Instead, stderr text is fed back to Claude as an error message.

Structured decision output, including `ask`:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Destructive command blocked by hook"
  }
}
```
> `permissionDecision`: one of `"allow"`, `"deny"`, `"ask"`, or `"defer"`

User-facing vs Claude-facing messages:
> - **`systemMessage`**: shown to the **user** as a warning notice
> - **`permissionDecisionReason`**: shown to **Claude** (fed back in the error context)

### S3 — Configuration warnings (Claude Code errors reference)
https://code.claude.com/docs/en/errors#is-not-matched-by-file-permission-checks

The complete documented warning set — note both are scoped narrowly, and neither covers an unenforceable Bash *command* pattern:
> ## Workspace has not been trusted
> ```
> Ignoring N permissions.allow entries from ... this workspace has not been trusted
> ```

> ## Is not matched by file permission checks
> ```
> ... is not matched by file permission checks
> ```
> A path pattern in your `permissions.allow` or `permissions.deny` rules doesn't match any files, which usually indicates a typo or an overly specific pattern.

### S4 — Settings reference (Claude Code docs)
https://code.claude.com/docs/en/settings

The official example omits `ask`, which is why third-party corroboration was needed:
```json
{
  "permissions": {
    "allow": ["Bash(npm run lint)", "Bash(npm run test *)", "Read(~/.zshrc)"],
    "deny": ["Bash(curl *)", "Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
  }
}
```

Hot-reload:
> Claude Code watches your settings files and reloads them when they change, so edits to most keys apply to the running session without a restart. This includes `permissions`, `hooks`, and credential helpers like `apiKeyHelper`.

### S4-community — Complete Guide to Claude Code Permissions (ClaudeCodeLab)
https://claudecode-lab.com/en/blog/claude-code-permissions-guide/

Shows the `ask` array in practice with content-scoped Bash entries:
> ```json
> { "permissions": { "allow": [ "Read(**)", "Glob(**)", "Grep(**)", "Bash(npm run *)" ], "deny": [ "Bash(rm -rf *)", "Bash(git push --force*)" ], "ask": [ "Write(**)", "Edit(**)", "Bash(git commit*)" ] }, "hooks": { "PreToolUse": [], "PostToolUse": [] } }
> ```

> PreToolUse hooks can add runtime checks, but hook output does not override matching deny or ask rules.

Independently recommends installs go in `ask`:
> Put intent-changing operations in ask: Edit, Write, git add, git commit, git push, npm install, and anything deploy-related.

### S7 — claude-code-permissions (dylancaponi, GitHub)
https://github.com/dylancaponi/claude-code-permissions

> Recent versions split compound commands and match each subcommand independently against permission rules, but argument-constrained patterns (variables, redirects, curl | sh, brace expansion) still slip through static rules — so a hook with proper subcommand-aware regex matching is still useful as a safety net.

### S8 — Stop asking me: configuring Claude Code permissions (Rajiv Pant, 2026-03-31)
https://rajiv.com/blog/2026/03/31/stop-asking-me-configuring-claude-code-permissions-for-uninterrupted-flow/

The contradicting claim (resolved in F1 — the author's example chains `cd`, which per S1 generates its own `Read` rule, a simpler explanation for the prompt):
> Even with all four patterns individually allowed, the compound command triggers a permission prompt because the permission system evaluates the full command string, not each subcommand independently. I spent a week testing different syntaxes — colons, spaces, wildcards — before accepting that granular bash patterns and compound commands don't mix.

### S9 — claude --dangerously-skip-permissions (morphllm)
https://www.morphllm.com/claude-code-dangerously-skip-permissions

> Bash rules are shell-operator aware. Bash(safe-cmd *) does not permit safe-cmd && other-cmd: recognized separators are &&, ||, ;, |, |&, &, and newlines, and each subcommand must match a rule on its own.

> Hook decisions never override deny rules, and a hook exiting 2 blocks a call even when an allow rule matches.

### S10 — Claude Code Permissions: A Practical settings.json Guide (Developers Digest)
https://www.developersdigest.tech/blog/claude-code-permissions-settings-guide

> Compound commands are understood: Claude Code splits on &&, ||, ;, |, and newlines, and each subcommand must match independently, so an allowlisted command chained with a disallowed one will still stop. Common process wrappers (timeout, time, nice, nohup) are stripped before matching. The important caveat: Bash matching is still best-effort, not a hardened shell sandbox.

### S11 — Permissions and Security Quickstart (SFEIR Institute)
https://institute.sfeir.com/en/claude-code/claude-code-permissions-and-security/quickstart/

The circulating **incorrect** advice — contradicted by S1's "a deny rule can't carry allowlist exceptions":
> Compromised dependencies - a package.json with malicious postinstall scripts. Add Bash(npm install *) to deny and use Bash(npm install --ignore-scripts) in allow.
