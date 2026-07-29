---
id: claude-code-sandbox
title: Claude Code OS Sandbox (/sandbox)
aliases: [sandbox, /sandbox, Seatbelt sandbox, bubblewrap sandbox]
updated: 2026-07-29
sources:
  - ../../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../../raw/research/bypass-mode-enforcement/index.md
confidence: extracted
tags: [claude-code, sandbox, security, seatbelt, bubblewrap]
---

# Claude Code OS Sandbox (`/sandbox`)

The only Claude Code mechanism that contains a compromised Bash **subprocess** at the OS level, and therefore the only real boundary in relates_to::[[three-tier-agent-control-model]] (tier 3). Everything above it — deny rules, hooks — is CLI-side policy that a subprocess can step around.

**It is not a permission mode, and is unaffected by one.** Permission modes decide whether a tool call runs and whether you are prompted; the sandbox restricts what a Bash command can access *once it runs*. Verbatim: *"The operating system enforces the sandbox boundary on the running process, so it holds regardless of what the model chose to run and even if an allowed command does more than its name suggests."* It therefore holds identically under `bypassPermissions` — see relates_to::[[permission-mode-control-survival]]. Read/Edit deny rules and `sandbox.filesystem` settings are **merged into one boundary**, so tier-1 deny entries strengthen the sandbox rather than duplicating it.

**Scope limit worth stating plainly:** the sandbox covers **Bash and its children only**. The Read/Edit/Write tools go through the permission system directly, not through the sandbox.

**Mechanism.** macOS uses **Seatbelt** (built in, nothing to install); Linux and WSL2 use **bubblewrap** + `socat`, with optional seccomp for Unix-socket blocking. Native Windows is unsupported — use WSL2. **Child processes inherit the boundary**, which is what distinguishes it from every other control.

**Default filesystem policy.** Writes are confined to **cwd + session temp**. Reads cover the whole machine *except* explicitly denied directories — note the default still allows reading `~/.aws/credentials` and `~/.ssh`, so `sandbox.credentials` denies must be added deliberately. The sandbox **cannot modify** `~/.bashrc`, `~/.zshrc`, `$PATH` binaries, `/bin`, or `settings.json` at any scope (verbatim: it *"automatically denies write access to Claude Code's `settings.json` files at every scope and to the managed settings directory… resolves symlinks"*, v2.1.210+). A worktree's `.git` is writable but `hooks/` and `config` inside it stay denied, which mitigates the git `core.fsmonitor` write path in relates_to::[[agent-persistence-vectors]].

**Network.** No domains are pre-allowed; access is per-domain prompt or an `allowedDomains` / `WebFetch(domain:…)` allowlist, with `strictAllowlist` / `allowManagedDomainsOnly` for a hard deny. Caveat: the proxy does not inspect TLS by default, so domain-fronting is not addressed.

**Apple Events are blocked by default** on macOS — `open`, `osascript`, and browser-auth flows fail with error `-600` unless `allowAppleEvents: true` (settable at user/managed/CLI scope only; project settings are ignored). The docs warn that enabling it *"removes code-execution isolation"*.

**Credential protection.** `sandbox.credentials.files` / `.envVars` support `deny` and `mask`; `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` strips Anthropic/cloud credentials from *all* subprocesses and also forces filesystem isolation on.

**Escape hatches to know about**, because they silently re-open everything and should be pinned at user or managed scope: `dangerouslyDisableSandbox` retry (disable via `allowUnsandboxedCommands: false`), `filesystem.disabled: true` (turns off write protection including settings and profile protection — user/managed only, a project cannot set it), `allowAppleEvents`, `excludedCommands`, and `allowUnixSockets` (exposing `docker.sock` is equivalent to full host access).

**Status in this repo:** recommended, not shipped. The later research narrows the recommendation usefully — enable it specifically for the `power-mode` / `uat-auto-plus` path, because that is where **100% of this repo's bypass usage lives**, and it is the only control that holds when Claude executes something whose literal text no rule anticipated. The earlier report's suggestion to pair it with `allowManagedPermissionRulesOnly` + `allowManagedHooksOnly` is **withdrawn for this repo**: both keys would nullify the repo's own deny list and hooks. See relates_to::[[permission-mode-control-survival]]. Policy-layer counterpart: relates_to::[[claude-code-permission-system]]. derived_from::[[agent-sandbox-escape-vectors]]
