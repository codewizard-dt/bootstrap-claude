---
id: claude-code-permission-system
title: Claude Code Permission System
aliases: [permission rules, allow ask deny, settings.json permissions, permission-rule syntax]
updated: 2026-07-29
sources:
  - ../../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../../raw/research/deny-rules-vs-hooks/index.md
  - ../../../../raw/research/bypass-mode-enforcement/index.md
confidence: extracted
tags: [claude-code, permissions, security, reference]
---

# Claude Code Permission System

The allow/ask/deny rule layer in `settings.json`, enforced by the **Claude Code CLI** — not by the model, and not by the OS. Docs live at `code.claude.com/docs/en/permissions` (the old `docs.anthropic.com/.../iam` URL 301-redirects there). Verbatim from the docs: *"Instructions in your prompt or `CLAUDE.md` shape what Claude tries to do, but they don't change what Claude Code allows."*

**Precedence.** Rules evaluate in order **deny → ask → allow**; the first match in that order decides, and rule specificity does not reorder anything. A deny at *any* settings scope beats an allow at any other scope. All three are first-class arrays in `settings.json` and share the same pattern syntax; the `ask` tier's un-silenceable properties are on relates_to::[[consent-requires-a-yes-path]].

**No rule can carry an exception.** A broad deny like `Bash(aws *)` blocks every matching call *including* ones that also match a narrower allow like `Bash(aws s3 ls)` — "a deny rule can't carry allowlist exceptions". The same holds for `ask`. Any guide teaching deny-broad-plus-allow-narrow is wrong.

## Path-rule syntax (gitignore patterns, four prefix types)

| Pattern | Meaning | Resolves to |
|---|---|---|
| `//path` | absolute from filesystem root | `/path` |
| `~/path` | from the home directory | `$HOME/path` |
| `/path` | relative to the **settings source**, *not* the filesystem root | project settings → `<project root>`; local → `<original cwd>`; **user settings → `~/.claude/`**; `--settings <file>` → that file's dir |
| `path` or `./path` | relative to the current directory | `<cwd>/path` |

> The single-leading-slash trap is the one that matters for this repo. A rule `Read(/secrets/**)` written into `~/.claude/settings.json` blocks `~/.claude/secrets/**` — **not** a project's `secrets/`. A globally-installed deny list must use `~/` or `//`, never a bare `/`. See relates_to::[[settings-deny-list]].

Depth semantics differ by rule type: an **allow** `Edit(src/**)` matches only `<cwd>/src` (use `Edit(**/src/**)` for any depth), while a **deny/ask** `Read(secrets/**)` matches a `secrets` dir at any depth under cwd. Bare filenames follow gitignore — `Read(.env)` ≡ `Read(**/.env)`; `Read(//**/.env)` matches anywhere on the filesystem.

## `Write(...)` rules are accepted but never consulted

As of v2.1.210+, verbatim: *"Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only. If you write a path rule for `Write`, `NotebookEdit`, `Glob`, or the legacy `MultiEdit` tool… Claude Code accepts the rule but never consults it, and warns at startup."*

This is a silent-failure mode with real consequences: a deny list full of `Write(~/.zshrc)` entries **looks** protective, loads without error, and enforces nothing. **Always author `Edit(...)`, never `Write(...)`.** `Edit` rules apply to all file-editing tools. A `Read` deny also blocks `Edit` and new-file creation on the same path (v2.1.208+), but does *not* cover Write/NotebookEdit — so add an explicit `Edit` deny for any path no tool may change.

## Bash rules

Wildcards match at any position. The space matters: `Bash(ls *)` matches `ls -la` but not `lsof`; `Bash(ls*)` matches both. `:*` is equivalent to a trailing ` *` and is only recognized at the end of the pattern. A rule targeting a parameter field — `Bash(command:rm *)` — is ignored with a startup warning, because a compound command would bypass it.

Claude Code splits a command line on `&& || ; | |& &` and newlines and matches **each subcommand independently** — the mechanism is documented on relates_to::[[per-subcommand-decomposition]], along with why that makes pipe-containing patterns unfireable and bare-interpreter denies viable. It also *strips* a fixed wrapper set (`timeout time nice nohup stdbuf command builtin noglob`, bare `xargs`, known-safe env assignments) before matching, so a deny on the inner command still fires through them; `watch`, `setsid`, `ionice`, `flock`, and `find -exec` are not stripped and always prompt.

## Symlinks: deny fires if *either* path matches

Verbatim: *"When Claude accesses a symlink, permission rules check two paths: the symlink itself and the file it resolves to. Allow rules apply only when both match [else prompt]. Deny rules apply when either the symlink path or its target matches."* This asymmetry is what lets `Read(~/.ssh/**)` deny survive a symlink planted inside the repo — but only for Claude's own file tools, not for a Bash `cat` through the link.

## Startup warnings cover less than you'd hope

The documented warning set is exactly four things: ignored `permissions.allow` entries in an untrusted workspace; a **file-path** pattern that matches no files; a parameter rule on a primary content field (`Bash(command:rm *)`); and a tool-name typo. **Nothing warns about a Bash *command* pattern that can never match.** A pipe-containing deny rule loads silently and enforces nothing, so *absence of a warning is not evidence a rule is live*. `claude permission-check <path>` exists as a diagnostic but is documented for path patterns only — there is no command-pattern checker. Correctness is entirely on the rule author.

## Built-in protected paths and permission modes

Separately from user rules, Claude Code ships a **built-in protected-path list** — `.claude`, `.git`, `.gitconfig`, `.zshrc`, `.zshenv`, `.zprofile`, `.bashrc`, `.bash_profile`, `.profile`, `.envrc`, `.npmrc`, `.mcp.json`, `.claude.json`, and more. It is *prompted* in `default`/`acceptEdits`, *denied* in `dontAsk`, and **allowed under `bypassPermissions`**. `permissions.allow` cannot re-open it in the modes that prompt, because the safety check runs *before* allow rules are evaluated. Which of everything on this page still enforces under each mode: relates_to::[[permission-mode-control-survival]].

## Managed settings

Highest-precedence scope, overridable by nothing including command-line arguments. Lives at macOS `/Library/Application Support/ClaudeCode/`, Linux/WSL `/etc/claude-code/`, Windows `C:\Program Files\ClaudeCode\`, with a `managed-settings.d/` drop-in directory. **Not MDM-only** — it is a plain settings file at a fixed path, so a solo developer can self-apply it with one `sudo tee`. Three lockdown keys: `disableBypassPermissionsMode` (also works from *any* scope, so `~/.claude/settings.json` suffices to self-lock), `allowManagedPermissionRulesOnly` (blocks user/project `allow`/`ask`/`deny` rules entirely), `allowManagedHooksOnly` (blocks user/project hooks). The latter two are footguns for a repo that ships its own rules and hooks — see relates_to::[[permission-mode-control-survival]].

## The load-bearing limitation

Verbatim: *"Read and Edit deny rules apply to Claude's built-in file tools and to file commands Claude Code recognizes in Bash, such as `cat`, `head`, `tail`, and `sed`. They don't apply to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself."* A path deny is therefore bypassable by `python -c 'open(...)'`. This is the concrete root of relates_to::[[deny-matches-a-spelling-not-a-capability]] and the reason for uses::[[claude-code-sandbox]] as tier 3 of relates_to::[[three-tier-agent-control-model]].

Which of these rules keep working when the permission mode changes: relates_to::[[permission-mode-control-survival]].
