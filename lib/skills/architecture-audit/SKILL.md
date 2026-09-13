---
name: architecture-audit
description: Audit an AI agent/application's architecture across 9 categories — design fit (single- vs. multi-agent justification, orchestration topology, delegation hygiene, framework/SDK fit, compounding-error containment) and operational readiness (observability, cost/resource controls, context/state management, cross-agent safety composition). Run a full audit or a single named category.
category: researching
model: claude-opus-5
argument-hint: "[category-name | full]"
disable-model-invocation: false
user-invocable: true
---

# AI Architecture Audit

Structured architecture audit of this project's agentic/LLM system design. **Audits and reports only — does not fix.**

**Invocation** `$ARGUMENTS`: empty/`full` → all 9 categories · named category (e.g. `orchestration-topology`) → that one · `design` → the 5 design-fit categories · `operations` → the 4 operational-readiness categories.

## Setup (before any category)

1. **Read project context** — `mcp__serena__list_dir` on root + key dirs (src, app, api, lib, server, agents, orchestrator, workflows, tools, skills).
2. **Find the agentic surface** — orchestrator/lead-agent entry points, subagent or worker definitions, tool/function registries, agent framework imports (`langgraph`, `crewai`, `autogen`, `@anthropic-ai/claude-agent-sdk`, `openai-agents`, `google-adk`, `@mastra/*`, `ai` (Vercel AI SDK)), any workflow/pipeline DSL.
3. **Establish the shape** — single agent, code-defined workflow, or multi-agent (and if multi-agent: how many roles, what topology connects them). This shape gates which checks below even apply.
4. **Note deployment context** — is this repo the LLM application itself, or (as with `bootstrap-claude`) tooling that configures agent behavior for other projects/sessions. Adjust "codebase" checks accordingly — e.g. for a Claude Code skill/subagent system, the orchestrator is a skill file, not application code.

Use Serena `find_symbol` / `search_for_pattern` to locate code — never shell `grep`/`find`.

## Category reference

| ID | Category | Group |
|----|----------|-------|
| `architecture-fit` | Single- vs. Multi-Agent Fit | Design |
| `orchestration-topology` | Orchestration Topology | Design |
| `delegation-hygiene` | Delegation & Prompt Hygiene | Design |
| `framework-fit` | Framework / SDK Fit | Design |
| `error-containment` | Compounding-Error Containment | Design |
| `observability` | Agent Observability & Tracing | Operations |
| `cost-resource-controls` | Cost & Resource Controls | Operations |
| `context-state-management` | Context & State Management | Operations |
| `safety-composition` | Cross-Agent Safety Composition | Operations |

---

## Design-fit categories

### `architecture-fit` — Single- vs. Multi-Agent Fit
Multi-agent systems cost roughly 4-15x a single-chat interaction in tokens; the gain only shows up on genuinely breadth-first, parallelizable work. Teams that skip this check routinely build elaborate multi-agent systems that a better-prompted single agent would have matched.

| # | Check | How to verify |
|---|-------|---------------|
| AF1 | The task class this system targets is actually breadth-first/parallelizable (independent facets, independent files/records) rather than a single linear reasoning chain | Read the orchestrator's task-decomposition logic or prompt; does it fan out over genuinely independent units? |
| AF2 | A single-agent or code-defined-workflow baseline was tried/considered before multi-agent was adopted, or there's a documented reason it wasn't | Check ADRs/decision docs, comments, or commit history for the design rationale |
| AF3 | Subagent/team count scales with query complexity rather than being a fixed high number for every request | Find team-size logic — is there a simple/complex branch, or is it always N agents? |
| AF4 | The system doesn't spawn a new agent for tasks a single tool call or direct response could handle | Sample a few entry points — trace what triggers agent spawning vs. direct execution |
| AF5 | Token/cost multiplier of the multi-agent path vs. a single-agent equivalent has been measured or estimated, not assumed | Look for benchmarking, eval comparisons, or cost analysis docs |

**Severity if missing**: HIGH for AF1–AF2 (wrong default costs compound on every request), MEDIUM for AF3–AF5.

### `orchestration-topology` — Orchestration Topology
The pattern that survives production is hierarchical orchestrator + isolated subagents; peer-to-peer "group chat" topologies have a documented failure mode where a single false premise cascades to 100% of agents.

| # | Check | How to verify |
|---|-------|---------------|
| OT1 | A single orchestrator/lead agent assigns work and owns final synthesis — subagents don't coordinate directly with each other | Trace message/control flow between agents |
| OT2 | Subagents are stateless or locally-scoped, not sharing a mutable global state that any agent can write | Check subagent context construction — do they receive isolated inputs? |
| OT3 | No peer-to-peer "group chat" / mesh topology where agents debate or negotiate directly without orchestrator mediation | Look for direct agent-to-agent message passing outside the orchestrator |
| OT4 | If a router/supervisor pattern is used instead of full orchestration, routing decisions are logged and deterministic where possible (not silently LLM-guessed) | Find the routing/classification step and its output handling |
| OT5 | Subagent results return to the orchestrator for verification/synthesis rather than being trusted and passed straight downstream | Trace what happens to a subagent's raw output after it returns |

**Severity if missing**: CRITICAL for OT3 (documented production failure mode), HIGH for OT1–OT2, MEDIUM for OT4–OT5.

### `delegation-hygiene` — Delegation & Prompt Hygiene
Every subagent needs an explicit objective, output format, tool/source guidance, and task boundary; subagents should return distilled summaries, not full transcripts, back to the lead — raw transcripts pollute the lead's context and burn tokens at the multi-agent cost multiplier.

| # | Check | How to verify |
|---|-------|---------------|
| DH1 | Each subagent invocation carries an explicit objective and expected output format, not just a raw forwarded user request | Read subagent prompt-construction code/skill text |
| DH2 | Subagents are given explicit tool/source guidance and a task boundary (what's in scope, what's out) | Same — check for scope-limiting language |
| DH3 | Subagents return a distilled summary/result to the lead agent, not their full tool-call transcript | Check what's captured from a subagent call and passed back up |
| DH4 | Effort-scaling rules exist so a simple query can't accidentally spawn a large team | Find team-size/effort selection logic and its default |
| DH5 | Fresh (non-forked) subagents receive full necessary context in the prompt itself — the delegator doesn't assume shared memory the subagent doesn't have | Read a sample delegation prompt for self-containment |

**Severity if missing**: HIGH for DH1–DH3 (directly drives cost and quality), MEDIUM for DH4–DH5.

### `framework-fit` — Framework / SDK Fit
Vendor-native SDKs win when committed to one provider; LangGraph earns its complexity only when graph/checkpointing durability is actually needed; CrewAI trades production maturity for prototyping speed; AutoGen is maintenance-only and shouldn't anchor new work.

| # | Check | How to verify |
|---|-------|---------------|
| FF1 | The chosen framework/SDK matches actual needs (durable checkpointing → LangGraph; single-provider → vendor-native SDK; fast prototyping → CrewAI; TS product backend → Mastra; TS UI+streaming → Vercel AI SDK) rather than being inherited by default | Check framework imports against what the system actually does with them |
| FF2 | The system is not built on AutoGen for new/active development | Check dependency manifests for `autogen`/`pyautogen` |
| FF3 | If a provider-neutral framework was chosen while only ever calling one model provider, there's a specific reason (multi-provider roadmap, need for the framework's graph/state machinery) | Check model client config vs. framework choice |
| FF4 | Framework version is pinned, and any framework-specific abstraction (state graph, crew config) is not duplicating functionality the vendor SDK already provides for free | Check lockfile/manifest pinning; look for redundant home-grown orchestration next to an already-capable framework |
| FF5 | If using the Claude Agent SDK, it's clearly distinguished in code/docs from the Messages API Tool Runner (`client.beta.messages.tool_runner`) — the former ships the full Claude Code harness (filesystem/bash tools included), the latter only loops over developer-defined tools | Check which package is imported and whether docs/comments describe its actual scope correctly |

**Severity if missing**: HIGH for FF2 (built on a retired framework), MEDIUM for FF1, FF3–FF5.

### `error-containment` — Compounding-Error Containment
At 85% per-step accuracy, a 10-step chain succeeds only ~20% of the time; a wrong output at step N poisons every downstream agent's context, and summarization adds its own lossy error on top. The fix is architectural: decompose into small, independently verifiable units rather than one monolithic chain.

| # | Check | How to verify |
|---|-------|---------------|
| EC1 | Multi-step/multi-agent workflows are decomposed into atomic subtasks whose outputs can be independently verified before entering downstream context | Trace a workflow's step boundaries — is there a check between steps, or a blind pass-through? |
| EC2 | Long agent chains have an explicit accuracy/success expectation, not an assumption that each step is reliable | Look for retry logic, validation steps, or documented error budgets |
| EC3 | A verification or review step exists before a subagent's output is treated as ground truth by later steps (mirrors the code-review "verify" pattern already used elsewhere in this repo's own skills) | Check for a distinct verify/critique phase vs. single-pass execution |
| EC4 | Summarization steps (context compression, subagent-result distillation) are checked for information loss on critical facts, not applied uniformly with no spot-check | Find summarization logic and any safeguards around it |
| EC5 | Failure in one subtask degrades gracefully (partial result, flagged gap) rather than silently propagating a wrong answer through the rest of the pipeline | Trace error-handling paths from a subagent/tool failure |

**Severity if missing**: HIGH for EC1, EC3 (structural risk compounds silently), MEDIUM for EC2, EC4–EC5.

---

## Operational-readiness categories

### `observability` — Agent Observability & Tracing
Without tracing of routing decisions, tool-call timing, and token/cost by agent, incidents in a multi-step system are nearly impossible to diagnose after the fact — and for a Claude Code–based system specifically, this may already be available for free via the harness's built-in OpenTelemetry export.

| # | Check | How to verify |
|---|-------|---------------|
| OB1 | Agent/tool-call spans are instrumented (ideally OTel GenAI semantic conventions: `gen_ai.*`, `invoke_agent`/`execute_tool` spans) so a request's full delegation chain is reconstructable | Search for tracing SDK usage, span creation around LLM/tool calls |
| OB2 | Token usage and cost are attributable per agent/subagent/skill, not just aggregated globally | Check metrics emission — is there a per-agent or per-role dimension? |
| OB3 | Tool-call timing and latency are captured, not just success/failure | Look for duration measurement around tool execution |
| OB4 | Routing/orchestration decisions (which subagent was chosen, why) are logged, not just their outcomes | Check orchestrator logging around the dispatch/routing step |
| OB5 | If this is a Claude Code–based system, `CLAUDE_CODE_ENABLE_TELEMETRY`/`OTEL_*` (built-in metrics, log events, beta distributed traces with nested subagent spans) has been evaluated and a decision made, not left unexamined | Check for any documentation, env config, or explicit decision record about Claude Code's native OTel export |
| OB6 | Telemetry defaults to structural data only (durations, model names, token counts) — prompt/tool-argument content logging is an explicit, reviewed opt-in, not a default | Check `OTEL_LOG_USER_PROMPTS`/`OTEL_LOG_TOOL_DETAILS`-equivalent flags and their default state |

**Severity if missing**: HIGH for OB1–OB4 (no incident-investigation capability), MEDIUM for OB5–OB6.

### `cost-resource-controls` — Cost & Resource Controls
Recursive or looping agent calls and unscaled team sizes turn a benign request into a runaway cost; controls need to exist at the orchestration layer, not just the API layer.

| # | Check | How to verify |
|---|-------|---------------|
| CR1 | Agent recursion depth or iteration count is capped (circuit breaker on runaway delegation loops) | Search for max_iterations/max_depth guards in orchestration code |
| CR2 | Per-request or per-session token/cost budgets are enforced, with multi-agent fan-out counted against the same budget | Check budget/limit logic — does it account for subagent token spend, not just the top-level call? |
| CR3 | Concurrent subagent count is bounded (matches this repo's own convention of hard-coded team-size caps, e.g. min/max concurrency per orchestrator) | Check concurrency limits in the orchestrator |
| CR4 | A cost-anomaly alert exists for spend spikes attributable to agent/tool misbehavior | Check billing/cost monitoring config |
| CR5 | Timeouts exist on individual agent/tool calls so one hung step doesn't block or inflate the whole pipeline | Check timeout params on model/tool clients |

**Severity if missing**: HIGH for CR1–CR3 (direct runaway-cost risk), MEDIUM for CR4–CR5.

### `context-state-management` — Context & State Management
Context window growth in multi-turn or multi-agent workflows must be bounded; unmanaged growth degrades quality and inflates cost, and naive summarization can silently drop critical facts.

| # | Check | How to verify |
|---|-------|---------------|
| CS1 | Conversation/session history is pruned, summarized, or windowed rather than growing unbounded across turns | Look for history management/truncation logic |
| CS2 | Subagent context is constructed explicitly per-call (fresh subagents get what they need in the prompt) rather than relying on implicit shared state | Check subagent invocation — is context assembled deliberately or inherited by default assumption? |
| CS3 | State that must persist across steps (task state, roadmap/task status, workflow progress) lives in a durable, inspectable store, not only in an LLM's working context | Check where cross-step state is actually written (files, DB, wiki) vs. held only in-context |
| CS4 | Any automatic context-compression feature (memory summarization, observational memory) has visibility into when it fires and what it costs, rather than running as an invisible background process | Check for logging/telemetry around compression events |
| CS5 | Long-running or resumable workflows checkpoint state so a crash or interruption doesn't require replaying the entire chain | Check for checkpoint/resume support in the workflow engine |

**Severity if missing**: HIGH for CS1, CS3 (direct cost/quality and correctness risk), MEDIUM for CS2, CS4–CS5.

### `safety-composition` — Cross-Agent Safety Composition
Individually-benign behavior in each agent can compound into an unwanted *global* outcome across a multi-agent system — per-agent safety does not automatically compose into system-level safety.

| # | Check | How to verify |
|---|-------|---------------|
| SC1 | System-level behavior (not just each agent's individual output) is reviewed or tested — e.g. does the combination of subagent outputs ever produce an outcome no single agent would have produced alone? | Check for integration-level tests/evals beyond per-agent unit checks |
| SC2 | Destructive or irreversible actions require the same HITL gating regardless of which agent in the chain initiates them (a subagent can't bypass a gate the orchestrator enforces) | Trace a destructive action's authorization path when triggered by a subagent vs. the lead agent |
| SC3 | Shared resources/tools used by multiple agents have consistent permission scoping — one agent's tool grant isn't inherited by another via shared context | Check tool/permission assignment per agent role |
| SC4 | A quirk or drift in one agent's behavior (e.g. a subagent that over-triggers a tool) is monitored at the aggregate/system level, not just per-agent | Check for system-level monitoring/alerting distinct from per-agent logs |
| SC5 | Agent role boundaries are enforced structurally (scoped tools/prompts), not only by instruction — an agent shouldn't be able to talk itself into another agent's authority | Check whether role/tool restriction is code-level or prompt-level only |

**Severity if missing**: CRITICAL for SC2 (bypassable HITL gate), HIGH for SC1, SC3, MEDIUM for SC4–SC5.

---

## Reporting

**Output**: after compiling findings, write the full report to `.docs/architecture-audit/report-<YYYY-MM-DD>.md` using the **Write** tool (create the directory if it doesn't exist). If a report for today already exists, write `report-<YYYY-MM-DD>-2.md` (then `-3`, …) rather than overwriting, so architecture posture is trackable over time rather than a one-off snapshot. Print the same report in the conversation as well; the file is a durable copy, not a replacement for the reply.

**Per-check status:** ✅ PASS (control exists & effective) · ⚠️ WARN (partial / has gaps) · ❌ FAIL (no evidence; at risk) · ℹ️ N/A (not applicable to this architecture) · 🔍 NEEDS-REVIEW (can't determine from code — flag for manual review).

**Report structure:**
```
## AI Architecture Audit — [project] — [date]
Architecture shape: [single agent / code-defined workflow / multi-agent — N roles, topology]
Categories audited: [list]

### [Category Name]
| Check | Status | Notes |
|-------|--------|-------|
| AF1 | ✅ | Task decomposition is genuinely breadth-first — see lib/skills/power-mode/SKILL.md:L… |
| OT3 | ❌ | Subagents pass results directly to each other outside orchestrator control |
**Category verdict**: FAIL (1+ CRITICAL failures)
**Priority mitigations**: [specific action + file reference] …

### Summary
| Category | Verdict | Critical | High | Medium |
|----------|---------|----------|------|--------|
**Overall architecture posture**: [CRITICAL / HIGH / MEDIUM / LOW]
**Top 3 actions to take now**: 1. … 2. … 3. …
```

**Verdict rules:** CRITICAL posture = any CRITICAL finding fails · HIGH = all CRITICAL pass but 2+ HIGH fail · MEDIUM = all CRITICAL & HIGH pass or WARN · LOW = only MEDIUM and below.

## CRITICAL rules

1. **Read code, don't run it** — verify architecture claims by reading implementation/skill definitions, never by attempting live load tests or real multi-agent runs.
2. **Cite specific files and line numbers** for every PASS or FAIL — say where you looked; "no evidence found" alone is insufficient.
3. **Serena for all code navigation** (`find_symbol`, `search_for_pattern`, `get_symbols_overview`) — no shell grep.
4. **Flag NEEDS-REVIEW honestly** — controls needing runtime observation (e.g. actual token-cost multiplier, live cascade behavior) get flagged with what to verify manually.
5. **Do not fix** — audit and report only; hand off fixes to the user or `/task-add`.
6. **Scope to the repo** — don't speculate about external infra unless config files are present.
7. **One category at a time** — complete each fully before the next; don't interleave findings.
8. **Judge fit, not fashion** — a single agent that passes evaluation is not a finding against it; only flag multi-agent complexity, topology, or framework choice as a gap when it's mismatched to the actual task shape, not merely "not the newest pattern."
9. **Persist the report** — write it to `.docs/architecture-audit/` (see Reporting) in addition to printing it; a report that only lives in the chat leaves no trail for the next audit to compare against.
