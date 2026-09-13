---
id: genai-observability-standard
title: GenAI Observability — OpenTelemetry Semantic Conventions and the Backend Landscape
updated: 2026-09-13
sources:
  - ../../../raw/research/ai-agent-architecture-observability/index.md
confidence: extracted
tags: [observability, opentelemetry, ai-agents]
---

The industry is converging on **OpenTelemetry's GenAI semantic conventions** (`gen_ai.*` attributes; span types for chat calls, `invoke_agent`, and `execute_tool`) as the vendor-neutral instrumentation layer for LLM calls, agent steps, and tool executions. Most major agent frameworks (OpenAI Agents SDK, LangChain, LlamaIndex, AutoGen) shipped emitters for it by Q1 2026. The load-bearing caveat: as of mid-2026 the agent-specific spans remain marked **"Development," not "Stable"** — the spec's own transition plan says it will update before conventions are marked stable, with no committed timeline. Building on it today is "a reasonable bet," not a finished standard, so expect attribute churn.

Observability tooling splits into two layers that solve different problems, and mature setups typically use both. **Proxy tools** (Helicone, Portkey) capture cost/latency with zero instrumentation but can't see the agent orchestration graph. **SDK/OTel-based tracers** (Langfuse, Arize Phoenix, LangSmith, Weights & Biases Weave, Braintrust, Traceloop/OpenLLMetry) trace actual agent steps and tool spans. Backend choice is a team-profile decision rather than a universal ranking: Langfuse for OSS/self-hosted/data-sovereignty needs; LangSmith for teams committed to LangChain/LangGraph (deepest integration, highest lock-in); Arize Phoenix for eval-heavy RAG/ML-adjacent teams; Braintrust for eval-first, CI/CD-gated regression workflows. A benchmarked comparison found LangSmith had the lowest measurable latency overhead among platforms tested, with Langfuse/AgentOps showing 12–15% overhead in a multi-step agent workload from more decoupled instrumentation paths.

`uses::[[Claude Code OpenTelemetry Export]]` is the directly relevant instance of this standard for any Claude Code tooling repository: Claude Code already ships built-in OTel export (metrics, log events, beta distributed traces over OTLP) that natively captures nested subagent-delegation chains as one trace, per-tool-call timing, and per-hook spans with `ERROR` status on failure — the exact "agent routing, tool calling, timing, performance" observability this concept describes, available with zero new application code. Structural telemetry (durations, model names, tool names, token counts) is captured by default; prompt/tool-argument content logging is opt-in only (`OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_DETAILS`), which matters for any governance decision about enabling it organization-wide.

See `relates_to::[[Multi-Agent Orchestration Patterns]]` for the architectures this observability layer is meant to instrument.
