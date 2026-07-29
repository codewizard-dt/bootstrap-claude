---
id: three-tier-agent-control-model
title: Three-Tier Agent Control Model (Deny → Hook → Sandbox)
aliases: [three-tier control model, tier 1 tier 2 tier 3, deny hook sandbox]
updated: 2026-07-29
sources:
  - ../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../raw/research/deny-rules-vs-hooks/index.md
  - ../../../raw/research/bypass-mode-enforcement/index.md
confidence: extracted
tags: [security, claude-code, permissions, hooks, sandbox, architecture]
---

# Three-Tier Agent Control Model (Deny → Hook → Sandbox)

The control architecture this repo adopted for hardening agent sessions. Each tier catches what the tier below it structurally cannot, and the tiers are **not substitutes** — the ordering is by cost and coverage, not by preference.

| Tier | Mechanism | Blocks | Structural limit |
|---|---|---|---|
| **1** | Path + command **deny rules** (`settings-deny.json`) | the literal path or command spelling | a spelling, not a capability — chaining, interpreters, absolute paths, alternate tools all evade it |
| **2** | **PreToolUse hook**, exit code 2 | command *classes*: `-c`/`-e` interpreter payloads, `curl \| sh` pipelines, `crontab`/`launchctl`/`at`/`osascript`, `DYLD_*`/`LD_PRELOAD` assignments, redirects into profile/settings paths, `source .env`, `git -c core.fsmonitor=` | still a policy layer inside the CLI — cannot contain a subprocess once it starts |
| **3** | **OS sandbox** (`/sandbox`: Seatbelt / bubblewrap) | the subprocess itself — writes outside cwd+tmp, Apple Events, un-allowlisted network, child processes | escape hatches exist (`filesystem.disabled`, `allowUnsandboxedCommands`, `allowUnixSockets`) and must be locked at user/managed scope |

**Why the tiering exists at all** is derived_from::[[deny-matches-a-spelling-not-a-capability]]. A deny rule is a string match; a capability needs a parser; a subprocess needs the kernel. Trying to push a capability-level intent down into tier 1 produces the fragile argument-constrained patterns the official docs themselves warn against.

**Tier 1 authoring rules** that fall out of the research: use `Edit(...)`, never `Write(...)` (Write path rules are accepted and never consulted — see relates_to::[[claude-code-permission-system]]); use `~/` or `//` prefixes in a globally-installed `~/.claude/settings.json`, because a single leading slash anchors at `~/.claude/`, not at the filesystem root; mirror sensitive Bash denies with `PowerShell(...)`. Implemented in relates_to::[[settings-deny-list]] by implements::[[TASK-026]].

**Tier 1 has three sub-tiers, not one.** `deny` / `ask` / `allow` are all first-class arrays sharing the same syntax, and the choice between deny and ask is not stylistic: **deny has no yes-path**, so a requirement phrased as consent cannot be a deny, and neither deny nor ask can carry an allowlist exception. `ask` is also the *only* rule type that survives `bypassPermissions`, an over-riding `allow`, a hook returning `"allow"`, and sandbox auto-allow. See derived_from::[[consent-requires-a-yes-path]].

**Tier 2** is the only layer that catches the bypass classes, and it is the layer this repo does not yet have — implements::[[TASK-027]] (`todo`) specifies four hooks in relates_to::[[bootstrap-claude-hooks]]. Design guidance from the research: *warn-and-log* for medium-risk classes, *exit-2* only for high-risk, so over-broad hooks do not break legitimate workflows.

**The tier-1/tier-2 boundary was moved by follow-on research** (derived_from::[[deny-rules-vs-hooks]]): route to tier 2 **only what tier 1 structurally cannot express** — cross-tool-call correlation, interpreter interiors, absolute-path invocation, and rules needing an exception. Everything else stays in tier 1, because a hook carries a real deployment cost: `install-global.sh` copies hook scripts but does **not** wire them into `PreToolUse`, so a skipped manual step means silent zero enforcement, while the deny/ask merge runs automatically. Package-install consent, originally planned as a hook, moved *up* into tier 1 as an `ask` list on exactly this reasoning.

**Tier 3** is the real boundary and is currently a *recommendation*, not something this repo ships — see uses::[[claude-code-sandbox]] for its defaults and escape hatches. Enable it specifically for the `power-mode` / `uat-auto-plus` path, with `failIfUnavailable: true` and `allowUnsandboxedCommands: false`, since that is where the repo's entire `--dangerously-skip-permissions` surface lives.

**All three tiers survive `bypassPermissions` — this is the correction that reshaped the model.** Tiers 1 and 2 do *not* degrade under bypass as originally assumed: deny and ask rules apply in every mode, hooks run on every tool call, and the sandbox is not a permission mode at all. What bypass removes is `allow` (inert) and Claude Code's **built-in protected-path guard**, which is the one thing tier 1 then has to carry alone. Full matrix and the resulting lockdown guidance — including why `allowManagedPermissionRulesOnly` and `allowManagedHooksOnly` must *not* be set here — on relates_to::[[permission-mode-control-survival]].

**The failure mode to guard against is false confidence.** Any guide this repo ships must state that tier 1 is defense-in-depth, not containment. The vectors each tier is meant to address are catalogued in relates_to::[[agent-persistence-vectors]].
