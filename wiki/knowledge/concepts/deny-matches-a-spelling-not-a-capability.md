---
id: deny-matches-a-spelling-not-a-capability
title: Deny Matches a Spelling, Not a Capability
aliases: [spelling not capability, deny rules block literals, permission rules are string matches]
updated: 2026-07-29
sources:
  - ../../../raw/research/agent-sandbox-escape-vectors/index.md
  - ../../../raw/research/deny-rules-vs-hooks/index.md
confidence: extracted
tags: [security, claude-code, permissions, deny-list, threat-model]
---

# Deny Matches a Spelling, Not a Capability

The organizing principle behind this repo's whole agent-hardening posture. A Claude Code permission rule is a **string pattern matched against a command line or a path** by the CLI. It blocks the *literal spelling* it names. It does not block the *capability* that spelling happens to reach.

`Bash(rm *)` does not stop `/bin/rm` — different prefix, no match. No `Bash(...)` pattern sees inside `bash -c '...'`, `python -c`, `node -e`, or `perl -e`, because the payload is an opaque argument string. `Read(**/.env)` does not stop `python -c "print(open('.env').read())"`, because deny rules reach Claude's own file tools and the handful of file commands Claude Code *recognizes* in Bash (`cat`, `head`, `tail`, `sed`) — not arbitrary subprocesses that open files themselves. A `source .env` is a shell builtin and is invisible to any `Read` rule. Blocking Bash can push the same command onto the PowerShell tool unless the deny is mirrored there.

The corollary is what makes this a design principle rather than a list of gotchas: **the layer that can express a capability is not the layer that matches strings.** Capability-level intent — "no network fetch piped into a shell", "no interpreter with an inline program", "no write into a shell profile regardless of how it is spelled" — has to be evaluated by something that sees the parsed command and can reason about it, i.e. a PreToolUse hook exiting 2, or contained by something enforcing at the OS level, i.e. the sandbox. That split is the reason for the three tiers in relates_to::[[three-tier-agent-control-model]].

Two consequences worth stating plainly, because they are the ones that produce false confidence:

- **A deny list is defense-in-depth, not a boundary.** It raises the cost of the obvious spelling and documents intent. Anyone reading `lib/scripts/templates/settings-deny.json` and concluding the agent is contained has misread it. relates_to::[[settings-deny-list]]
- **A rule that matches nothing looks identical to a rule that works.** There is no startup warning for a Bash command pattern that can never fire, so a pipe-containing entry ships silently and enforces zero. Absence of a warning is not evidence of enforcement. relates_to::[[per-subcommand-decomposition]]
- **Prose is weaker still.** Permissions are enforced by Claude Code, not by the model: instructions in a prompt or `CLAUDE.md` shape what Claude *tries* to do, never what Claude Code *allows*. This repo's own `CLAUDE.md` `.env` ban is guidance, and its read-vs-`source` gap is a live example of the principle.

Mechanically, the reason a rule can match one subcommand of a chain and miss the next is relates_to::[[per-subcommand-decomposition]]. Which controls survive when the permission layer is turned down is relates_to::[[permission-mode-control-survival]]. The catalogue of what an attacker actually reaches once a spelling slips through is relates_to::[[agent-persistence-vectors]]. Applied in implements::[[TASK-026]] (tier 1) and implements::[[TASK-027]] (tier 2).
