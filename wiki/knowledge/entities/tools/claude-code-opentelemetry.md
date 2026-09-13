---
id: claude-code-opentelemetry
title: Claude Code OpenTelemetry Export
aliases: [Claude Code OTel, Claude Code Telemetry]
updated: 2026-09-13
sources:
  - ../../../../raw/research/ai-agent-architecture-observability/index.md
confidence: extracted
tags: [claude-code, observability, opentelemetry]
---

Claude Code ships built-in OpenTelemetry instrumentation, off by default and enabled with `CLAUDE_CODE_ENABLE_TELEMETRY=1` plus standard `OTEL_*` env vars pointed at an OTLP endpoint (a Collector, or directly at a backend). It exports three signals: **metrics** (time series — token usage/cost attributable by model, effort, session, and skill), **log events** via the logs/events protocol (correlated by `prompt.id`, covering tool-call and hook events), and **distributed traces** (beta, requires `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`). Trace spans cover interactions, LLM requests, tool executions, and hook runs; critically, when one agent spawns a subagent (via the Agent/Task tool), the child's spans nest under the parent's span so the entire delegation chain reads as a single trace — the `llm_request`, `tool.execution`, and hook spans set OTel `ERROR` status on failure, so a failed step is visible without reading individual attributes.

Structural telemetry (durations, model names, tool names, token counts) is recorded by default; content (prompt text, tool arguments, tool output bodies) is opt-in only via separate flags (`OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_DETAILS`, `OTEL_LOG_TOOL_CONTENT`), which matters for any decision to enable this organization-wide. Any OTel-compatible Collector can fan the export out to Prometheus/Grafana, Jaeger, or any commercial GenAI observability backend (Langfuse, LangSmith, Arize Phoenix, Datadog, Honeycomb) — Claude Code needs no framework-specific SDK to participate, since it emits standard OTLP.

This is `uses::[[GenAI Observability Standard]]`'s most directly-applicable instance for `bootstrap-claude` and any project built on Claude Code: it gives "agent routing, tool calling, timing, performance" visibility into `implements::[[Power Mode Skill]]` and `implements::[[Now Skill]]` subagent fan-out with zero new application code — nothing in this repository currently surfaces, documents, or wires this capability up, despite the repo being entirely Claude Code tooling.
