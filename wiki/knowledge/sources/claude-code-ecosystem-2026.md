---
id: claude-code-ecosystem-2026
title: "Research: Claude Code Ecosystem Survey — Harnesses, Skill Libraries, Hooks"
updated: 2026-09-13
sources:
  - ../../../raw/research/claude-code-ecosystem-2026/index.md
confidence: extracted
tags: [claude-code, ecosystem, plugins, worktrees, sandbox, hooks, cost-tracking]
---

# Research: Claude Code Ecosystem Survey — Harnesses, Skill Libraries, Hooks

A survey of the wider 2026 Claude Code ecosystem — harness frameworks (SuperClaude, Superpowers), community skill/subagent libraries (wshobson/agents, awesome-claude-code), hook implementations (disler's multi-agent observability, Lasso's prompt-injection defender), and official platform features (plugin marketplaces, worktree isolation, native sandboxing, cost/statusline APIs) — run to surface concrete new-feature candidates for this repo.

**Headline finding:** this repo's own hook documentation already names OS-level sandboxing as the missing containment layer four separate times (see uses::[[claude-code-sandbox]], relates_to::[[three-tier-agent-control-model]]) — this research corroborates that from the outside (the platform's native sandbox has since shipped in full) rather than surfacing anything new about it. What *is* new: `isolation: "worktree"` is now a first-class Agent-tool/subagent frontmatter primitive that this repo's parallel-subagent orchestration skills (`now`, `tackle`, `power-mode`) do not use anywhere, despite being the exact shape of workload (fan-out calls to the same agent role) the primitive targets. The official plugin-marketplace system (`.claude-plugin/marketplace.json`) has also become the ecosystem-standard distribution unit — obra/superpowers, a workflow-skill-pack comparable in ambition to this repo's own req→decision→task→tackle→uat pipeline, was accepted into it — while this repo still ships exclusively via a custom rsync installer.

Five other gaps surfaced, roughly in descending fit: (1) no cost/token usage visibility despite curating a haiku/sonnet/opus tier per skill specifically for cost; (2) no `PostToolUse` content scanning for prompt injection in untrusted tool *output* (distinct from `env-content-read-guard.js`, which scans for secrets *leaving*, not injected instructions *arriving*) — relevant given `/research` and `/wiki-ingest` regularly ingest untrusted web content; (3) no statusline surfacing this repo's own tracked state (Serena health, active task/roadmap); (4) no multi-agent observability dashboard for the concurrent-subagent orchestration skills, though this repo already has the taste and the Node-dashboard precedent (`lib/scripts/wiki-dashboard-server.js`) to build one; (5) no push-based auto-lint-on-save hook (this repo's `/lint`/`/typecheck` are pull-based skills, a deliberate-if-unexamined choice rather than an oversight).

Full comparison table, risks, and recommended sequencing (worktree isolation and sandbox scaffolding first, low-risk; plugin marketplace routed to `/decision-create` given its scope; the rest deferred) are in derived_from::[[claude-code-ecosystem-2026]] (the raw report).
