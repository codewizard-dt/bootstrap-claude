---
id: ai-agent-architecture-observability
title: "Research: AI Application Architecture — Single vs. Multi-Agent, Orchestration, and Observability"
updated: 2026-09-13
sources:
  - ../../../raw/research/ai-agent-architecture-observability/index.md
  - ../../../raw/research/ai-agent-architecture-observability/sources.md
confidence: extracted
tags: [ai-agents, orchestration, observability, opentelemetry]
---

**Single-agent vs. multi-agent is a cost/complexity decision, not a maturity ladder.** Anthropic's own multi-agent research system beat a single agent by 90.2% on a breadth-first research eval — but at roughly 15x the token cost of a single chat interaction — while Anthropic's own follow-up guidance separately warns that teams routinely spend months building multi-agent systems only to find improved single-agent prompting matches the result. Industry data agrees: 40% of multi-agent pilots fail within six months, usually from picking the wrong orchestration pattern rather than the approach being unworkable. The pattern that has held up in 2026 production deployments is **hierarchical orchestrator + isolated subagents** — peer/"group chat" topologies failed in production, with cascade-failure research showing a single false premise can propagate through hub-and-spoke topologies. Compounding error is the core engineering risk of any multi-step system: at 85% per-step accuracy (considered good), a 10-step chain only succeeds 19.7% of the time.

**Framework choice in 2026 converges on five production-relevant options**, with AutoGen now maintenance-only: LangGraph (graph/checkpointing, steepest learning curve, enterprise default for auditability), CrewAI (role-based, fastest prototyping), OpenAI Agents SDK (handoff-based), Google ADK (hierarchical, GCP-native), and Microsoft Agent Framework (the GA'd AutoGen+Semantic Kernel merger). Vendor-native SDKs are consistently recommended over provider-neutral frameworks when committed to one model provider. For TypeScript specifically, Vercel AI SDK owns UI/streaming and Mastra owns backend agent orchestration — commonly composed together rather than chosen exclusively.

**Observability is converging on OpenTelemetry's GenAI semantic conventions** (`gen_ai.*` spans/attributes for chat calls, agent invocations, and tool executions) as the vendor-neutral instrumentation layer, though the agent-specific spans remain in "Development" status as of mid-2026 with no committed stabilization timeline. Tooling splits into proxy tools (cost/latency only, no orchestration-graph visibility) and SDK/OTel tracers (full agent-step tracing) — backend choice (Langfuse, LangSmith, Arize Phoenix, Braintrust) is a team-profile decision rather than a universal ranking.

**Directly relevant finding for this repository:** `implements::[[Power Mode Skill]]` and `implements::[[Now Skill]]` already realize the orchestrator-worker pattern this research identifies as the one that survives production — but this repo has zero observability instrumentation of skill/subagent execution today. `uses::[[Claude Code OpenTelemetry Export]]` is available and unused: Claude Code (the substrate this entire repo configures) ships built-in OTel export covering nested subagent-delegation traces, per-tool-call timing, and per-hook spans, gated behind simple env vars, requiring zero new code in this repo to adopt. See `relates_to::[[Multi-Agent Orchestration Patterns]]` and `relates_to::[[GenAI Observability Standard]]` for the full synthesis.
