---
id: consent-requires-a-yes-path
title: Consent Requires a Yes-Path (the `ask` Tier)
aliases: [permissions.ask, ask tier, ask cannot be silenced, deny has no yes-path]
updated: 2026-07-29
sources:
  - ../../../raw/research/deny-rules-vs-hooks/index.md
  - ../../../raw/research/bypass-mode-enforcement/index.md
confidence: ambiguous
tags: [security, claude-code, permissions, consent, ask]
---

# Consent Requires a Yes-Path (the `ask` Tier)

A requirement phrased as "no X without explicit user consent" **cannot be implemented with a deny rule**, because deny has no yes-path. Deny answers a different question — "never, under any circumstance" — and leaves the user staring at a block with no route to proceed. `permissions.ask` is the tier that actually expresses consent, and it turns out to be strictly better than a hook for this job.

**`ask` is a first-class array** alongside `allow` and `deny`, using **identical `Bash(...)` and path-pattern syntax** — no new authoring conventions. The prompt shows the exact command plus Claude's description, and `Ctrl+E` renders an on-demand explanation labelled **Low / Med / High risk**. That is a better consent surface than anything a hook's `systemMessage` could print.

**The load-bearing property is that `ask` cannot be silenced.** Four independent guarantees:

| Silencer | Result |
|---|---|
| A more specific `allow` rule | still prompts — "a matching ask rule prompts even when a more specific allow rule also matches the same call" |
| `bypassPermissions` mode | still prompts — bypass "skips permission prompts, **except those forced by explicit `ask` rules**". `ask` and `deny` are the two rule types that survive bypass; `allow` goes inert. relates_to::[[permission-mode-control-survival]] |
| A PreToolUse hook returning `"allow"` | still prompts |
| Sandbox `autoAllowBashIfSandboxed` | still prompts for content-scoped rules like `Bash(git push *)` |

Clicking **"Yes, don't ask again"** writes an *allow* rule into `.claude/settings.local.json` — which the ask rule then out-ranks. The sticky-approval escape hatch is structurally closed: the prompt returns next time. An agent that edits its own settings still cannot loosen it. This makes `ask` one of only two controls that survive relates_to::[[permission-mode-control-survival]] intact.

**The exception problem inverts.** `ask` shares deny's inability to carry allowlist exceptions, but the consequence is completely different. Under **deny**, `Bash(uvx --from git+*)` with no carve-out for `oraios/serena` permanently breaks Serena bootstrap — fatal, so the rule gets dropped. Under **ask**, the same non-exception property costs exactly *one prompt*. This is the single strongest argument for `ask`: it converts every "we had to drop this rule because we couldn't carve out an exception" case into a shippable rule.

> **Anti-pattern, actively taught in the wild:** deny `Bash(npm install *)` and allow `Bash(npm install --ignore-scripts)`. This **does not work**. Per the docs, "a broad deny rule like `Bash(aws *)` blocks every matching call, including calls that also match a narrower allow rule… so a deny rule can't carry allowlist exceptions." The deny wins and `--ignore-scripts` is blocked too. If this shape appears in any guide this repo ships, it is wrong — and it is exactly the case `ask` handles correctly.

> **Contradiction (open):** the two research reports disagree on the mechanism for **package-install consent specifically**. contradicts::[[bypass-mode-enforcement]] recommends a **PreToolUse hook**, because an `ask` rule in a headless `-p` bypass run "has nobody to answer" and becomes a hang or an effective hard block — and because exit-2 stderr can name the exact command for the user to run, which neither deny nor `ask` can do. *(That report marks the headless-resolution claim as inference — no primary source; the docs state it only for `dontAsk` mode, where ask rules become denials.)* contradicts::[[deny-rules-vs-hooks]], the later and more directly-scoped report, recommends `permissions.ask` and explicitly says not to build a hook — but does not address the headless case. **Unresolved.** The reconciliation that fits both: `ask` for interactive sessions, where its un-silenceable property is exactly right; and for the headless `power-mode` / `uat-auto-plus` path, neither rule is the answer — tier 3 (`/sandbox`) is. Tracked on relates_to::[[permission-mode-control-survival]].

**Why not a hook.** A hook *can* do this — `permissionDecision` accepts `"ask"`, and `systemMessage` reaches the user — but for consent it buys nothing and costs a lot: the suggestion is redundant (the ask prompt *is* the approval), a hook cannot relax an ask rule anyway, and hooks need manual `PreToolUse` wiring that **silently no-ops when skipped**, versus a merge that already runs from `install-global.sh`. Scope hooks to what only hooks can do — see relates_to::[[bootstrap-claude-hooks]] and relates_to::[[three-tier-agent-control-model]].

**Friction is lower than it looks.** Permission rules only see commands Claude types into a Bash tool call; anything inside a shell script is a subprocess and invisible. `npm install` / `pip install` are also not in the built-in read-only command set, so they already prompt in `default` mode. The marginal cost lands only on users who had previously allowlisted installs — which is the intended behaviour change, not a regression. Plan the initial `ask` set small: relates_to::[[settings-deny-list]]'s merge script is additive-only with **no removal path**.
