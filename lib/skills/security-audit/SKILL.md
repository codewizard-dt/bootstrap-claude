---
name: security-audit
description: Audit an LLM/AI application for security vulnerabilities across 11 categories — internal posture (observability, rate limiting, access controls, HITL policy, benchmarking) and external threats (prompt injection, data leakage, output XSS, excessive agency, supply chain, token DoS). Run a full audit or a single named category.
category: researching
model: claude-opus-5
argument-hint: "[category-name | full]"
disable-model-invocation: false
user-invocable: true
---

# AI Security Audit

Structured security audit of this project's LLM/AI integration. **Audits and reports only — does not fix.**

**Invocation** `$ARGUMENTS`: empty/`full` → all 11 categories · named category (e.g. `prompt-injection`) → that one · `internal` → the 5 posture categories · `external` → the 6 threat categories.

## Setup (before any category)

1. **Read project context** — `mcp__serena__list_dir` on root + key dirs (src, app, api, lib, server, agents, tools, utils).
2. **Find AI/LLM integration points** — API client init (`openai`, `anthropic`, `langchain`, `llama`, `ollama`, model constructors), agent/tool definitions, RAG pipelines, prompt templates, system-prompt strings.
3. **Note deployment context** — local / server / edge / third-party hosted (drives which threats matter most).

Use Serena `find_symbol` / `search_for_pattern` to locate code — never shell `grep`/`find`.

## Category reference

| ID | Category | Group |
|----|----------|-------|
| `observability` | Observability & Audit Logging | Internal |
| `rate-limiting` | Rate Limiting & Resource Controls | Internal |
| `access-controls` | Access Controls & Least Privilege | Internal |
| `hitl-policy` | Human-in-the-Loop Policy | Internal |
| `benchmarking` | Security Benchmarking | Internal |
| `prompt-injection` | Prompt Injection | External |
| `data-leakage` | Sensitive Data Leakage | External |
| `output-sanitization` | Output Sanitization / XSS | External |
| `excessive-agency` | Excessive Agency & Tool Abuse | External |
| `supply-chain` | Supply Chain & Data Poisoning | External |
| `token-dos` | Token Flood / DoS | External |

---

## Internal posture categories

### `observability` — Observability & Audit Logging
Enterprise compliance (HIPAA, GDPR, SOC2) needs full traceability; without it, incidents can't be investigated.

| # | Check | How to verify |
|---|-------|---------------|
| O1 | Prompts and responses are logged with a trace/session ID | Search for logging calls around LLM invocations |
| O2 | Logs are structured (JSON) and include: timestamp, user ID, model, token counts | Read log format definitions or middleware |
| O3 | PII is redacted or masked before logs are stored | Look for a redaction/sanitization step before log write |
| O4 | Audit trail is append-only or tamper-evident | Check log sink config (immutable S3, CloudWatch, SIEM) |
| O5 | Trace IDs propagate through multi-step/agentic workflows | Follow a request ID through multiple LLM calls in code |
| O6 | Logs are retained per compliance requirements (e.g. ≥90 days) | Check retention policy in infra config |
| O7 | Anomaly alerting exists for unexpected output patterns or errors | Look for monitoring/alerting config |
| O8 | Logging is model-agnostic (works if model is swapped) | Check whether logging is in a wrapper vs. per-model code |

**Severity if missing**: CRITICAL for O1–O4, HIGH for O5–O8.

### `rate-limiting` — Rate Limiting & Resource Controls
Token floods (OWASP LLM10) exhaust budget and degrade availability; even benign users cause runaway costs via poor prompts.

| # | Check | How to verify |
|---|-------|---------------|
| R1 | Per-user or per-session token limits are enforced | Search for token counting, budget checks, or middleware |
| R2 | Request-level rate limiting is in place (requests/min per user) | Check API gateway, middleware, or rate limit config |
| R3 | LLM API calls have a timeout / max-wait | Look for timeout params on API client |
| R4 | Input length is capped before sending to model | Check for input truncation or max-tokens validation |
| R5 | Recursive or looping agent calls have a circuit breaker / max-iterations cap | Search for loop guards in agent orchestration code |
| R6 | Cost anomaly alerting exists (e.g. spend spike > X% triggers alert) | Check billing/cost monitoring config |
| R7 | Context window growth is bounded in multi-turn conversations | Look for conversation history pruning logic |

**Severity if missing**: HIGH for R1–R5, MEDIUM for R6–R7.

### `access-controls` — Access Controls & Least Privilege
Agents should only do what a human would be comfortable with them doing autonomously; over-permissioning is the root of most OWASP LLM06 incidents.

| # | Check | How to verify |
|---|-------|---------------|
| A1 | Each agent/tool has an explicit scope definition (what it can access) | Read tool/agent definitions |
| A2 | RBAC or role scoping prevents users from accessing other users' data via the LLM | Trace a data-fetch tool call back to its auth check |
| A3 | Sessions are isolated — one user's context cannot bleed into another's | Check session storage and context construction |
| A4 | Agents cannot enumerate or invoke undocumented tools | Verify tool list is not exposed to the model dynamically |
| A5 | Delete, write, and payment operations require elevated scope or explicit confirmation | Find dangerous tool implementations and check caller auth |
| A6 | Agent tool permissions are reviewed on a cadence (not set-and-forget) | Check if there's a permission manifest or review process |
| A7 | Principle of least privilege: agents request only tools needed for the task | Count tools available to each agent and flag overprovisioning |

**Severity if missing**: CRITICAL for A3, HIGH for A1–A2, A4–A5, MEDIUM for A6–A7.

### `hitl-policy` — Human-in-the-Loop Policy
Read-only actions can be autonomous; reversible should usually be confirmed; destructive/financial must have human approval. Without a formal policy, teams default to no gates.

| # | Check | How to verify |
|---|-------|---------------|
| H1 | A written policy (even a comment block or doc) defines action categories: read-only / reversible / destructive | Search docs, ADRs, or code comments |
| H2 | Destructive actions (delete, pay, send, publish) are gated behind an explicit confirmation step | Find destructive tool implementations and trace call path |
| H3 | Reversible actions prompt for confirmation in at least medium-risk contexts | Check confirmation UX for update/modify operations |
| H4 | Approval events are logged (who approved, what action, when) | Look for audit log writes at approval points |
| H5 | HITL gates cannot be bypassed by prompt manipulation (e.g. "skip confirmation") | Test whether system prompt or user prompt can disable a gate |

**Severity if missing**: CRITICAL for H2, H5; HIGH for H1, H3–H4.

### `benchmarking` — Security Benchmarking
Posture decays as models are updated or swapped; without a baseline, regressions go undetected.

| # | Check | How to verify |
|---|-------|---------------|
| B1 | A baseline injection-resistance test suite exists for the current model | Look for security tests, red-team scripts, or eval files |
| B2 | New model versions are tested against the baseline before promotion to production | Check CI/CD pipeline or deployment runbook |
| B3 | System prompt leakage is tested (can a user extract the system prompt?) | Look for tests that attempt extraction attacks |
| B4 | Benchmark results are tracked over time (not just pass/fail per deploy) | Check test artifacts, dashboards, or logs |
| B5 | Red-team or adversarial testing is scheduled (not ad-hoc) | Look for a security review cadence in docs or tickets |
| B6 | Third-party benchmarks (e.g. OWASP LLM Top 10 test suite) are referenced | Check if any standard benchmark framework is used |

**Severity if missing**: HIGH for B1–B3, MEDIUM for B4–B6.

---

## External threat categories

### `prompt-injection` — Prompt Injection (OWASP LLM01)
The #1 LLM vulnerability — it exploits the model's core instruction-following. Address both direct (user input) and indirect (document/RAG) injection.

| # | Check | How to verify |
|---|-------|---------------|
| P1 | User input is validated before being interpolated into a system prompt | Find system prompt construction and check for raw user input interpolation |
| P2 | Known injection patterns are screened (role-play overrides, "ignore previous instructions", DAN-style, prefix directives) | Look for an input validation layer or detection model call |
| P3 | Documents and RAG content are treated as untrusted — sanitized before being added to context | Trace RAG/document pipeline from retrieval to prompt construction |
| P4 | A cheap detection model or regex classifier screens inputs before the main model call | Look for a pre-screening step |
| P5 | Injection attempts are logged and can trigger alerts | Check logging around input validation failures |
| P6 | Encoding normalization is applied (unicode homoglyphs, base64, HTML entities) | Look for a normalization step before validation |
| P7 | Outputs that will become system prompts in the next step are re-validated | Trace multi-step/agentic workflows for blind prompt passthrough |

**Severity if missing**: CRITICAL for P1, P3; HIGH for P2, P4, P7; MEDIUM for P5–P6.

### `data-leakage` — Sensitive Data Leakage (OWASP LLM02, LLM07)
Models memorize PII/credentials; RAG can surface out-of-scope data; system prompts can be extracted; cross-session bleeding exposes one user's data to another.

| # | Check | How to verify |
|---|-------|---------------|
| D1 | LLM outputs are scanned for PII (names, emails, SSNs, phone numbers) before returning to users | Find output post-processing layer; look for PII detection |
| D2 | Outputs are scanned for credentials (API keys, tokens, passwords, connection strings) | Same layer — check if credential pattern matching is included |
| D3 | System prompt contents are not echoed back or extractable via user prompts | Check whether system prompt is referenced in output templates |
| D4 | RAG retrieval is scoped to the requesting user's authorized data only | Trace a RAG query from user ID → retrieval filter → returned docs |
| D5 | A signed data processing agreement exists with the model provider | Check vendor agreement docs or infra setup notes |
| D6 | Cross-session data isolation is enforced at the application level (not just assumed from the model) | Check session context construction for any global/shared state |
| D7 | Training data opt-out or zero-retention agreement is in place for sensitive deployments | Check vendor API configuration for `store: false` or equivalent |

**Severity if missing**: CRITICAL for D1–D4, HIGH for D5–D7.

### `output-sanitization` — Output Sanitization / XSS (OWASP LLM05)
Models often agree with users and can be induced to produce malicious HTML, scripts, or structured content that exploits downstream systems — output sanitization is as critical as input validation.

| # | Check | How to verify |
|---|-------|---------------|
| X1 | LLM text outputs are HTML-escaped before rendering in a browser context | Find the render path from LLM response to UI |
| X2 | Markdown rendering is sandboxed (no raw HTML passthrough) | Check markdown renderer config (e.g. `sanitize: true`, DOMPurify usage) |
| X3 | Generated code is executed only in a sandbox, never eval'd directly | Search for `eval`, `exec`, `subprocess` near LLM output usage |
| X4 | LLM outputs that feed into the next prompt (agentic chains) are schema-validated and sanitized | Trace inter-step data flow in multi-step agents |
| X5 | Outputs are checked for banned terms, hate speech, or policy violations before delivery | Look for content filtering on the output path |
| X6 | Structural outputs (JSON, SQL, CLI commands) are validated against a strict schema, not just parsed | Find JSON/SQL generation and check parser + schema validation |

**Severity if missing**: CRITICAL for X3–X4, HIGH for X1–X2, MEDIUM for X5–X6.

### `excessive-agency` — Excessive Agency & Tool Abuse (OWASP LLM06)
Agents with too many tools or too-broad permissions become attack surfaces — attackers exploit unguarded APIs, trigger deletes, or use familiar endpoint patterns to extract/corrupt data.

| # | Check | How to verify |
|---|-------|---------------|
| E1 | Every registered tool has a documented justification for why the agent needs it | Read tool registration — are there unused or overly broad tools? |
| E2 | Dangerous tools (delete, payment, send message, external API write) require explicit, non-LLM-bypassable authorization | Trace dangerous tool call path — can prompt alone trigger it? |
| E3 | Tool schemas are not fully exposed to end users (attackers cannot enumerate all available endpoints) | Check whether tool definitions are sent to the model in a user-accessible way |
| E4 | Tool outputs are validated before being trusted downstream (tool results are also untrusted) | Find tool call result handling — is the result used raw? |
| E5 | Patient/user ID or session ID binding is enforced at the tool level (deterministic check, not LLM-gated) | For data-fetch tools, verify the ID in the request matches the authenticated session |
| E6 | Tools that call external APIs use scoped, revocable credentials (not long-lived admin keys) | Check credential management for tool integrations |

**Severity if missing**: CRITICAL for E2, E5; HIGH for E1, E4; MEDIUM for E3, E6.

### `supply-chain` — Supply Chain & Data Poisoning (OWASP LLM03, LLM04, LLM08)
Third-party components (models, plugins, datasets, RAG sources) can be compromised before they reach your system; data poisoning subtly alters behavior in hard-to-detect ways.

| # | Check | How to verify |
|---|-------|---------------|
| S1 | Model versions are pinned (not `latest`) in all deployment configs | Check model ID strings in code and infra config |
| S2 | Third-party model providers are vetted (trust level, data handling agreement) | Review vendor list and agreements |
| S3 | RAG knowledge base sources are validated (checksums, provenance tracking, ingestion auditing) | Trace the RAG ingestion pipeline |
| S4 | RAG sources are treated as untrusted input (sanitized before insertion into context) | Check whether RAG content goes through the same injection checks as user input |
| S5 | Plugin/tool library dependencies are pinned and regularly audited for vulnerabilities | Check `package.json`, `requirements.txt`, or equivalent for pinned versions |
| S6 | Model behavior drift is monitored — alerts trigger if output distribution changes significantly | Look for model evaluation or drift detection in production |
| S7 | A process exists to roll back to a prior model version if a new version behaves unexpectedly | Check deployment runbook or CI/CD rollback config |

**Severity if missing**: HIGH for S1–S4, MEDIUM for S5–S7.

### `token-dos` — Token Flood / DoS (OWASP LLM10)
Huge inputs (malicious or not) exhaust token budgets, spike rate limits, and inflate cost; recursive agent loops compound it. Prevention is hard — detection and circuit-breaking are essential.

| # | Check | How to verify |
|---|-------|---------------|
| T1 | Maximum input length is enforced before the API call (not just relied on by the model provider) | Find input preprocessing — is there a hard character/token cap? |
| T2 | Conversation history is pruned or summarized to prevent unbounded context growth | Look for history management in multi-turn chat code |
| T3 | Agent recursion depth or iteration count is capped | Search for max_iterations, recursion guards in agent orchestration |
| T4 | Rate limiting applies per user and per session (not just global) | Check rate limit implementation — is it keyed by user ID? |
| T5 | A cost/spend circuit breaker exists — if spend crosses a threshold, calls are halted or throttled | Check billing integration or spend monitoring config |
| T6 | Unexpected token spike alerts notify the team within a reasonable window (e.g. <1 hour) | Check alerting thresholds for token/cost metrics |
| T7 | Adversarial prompt length attacks are addressed (e.g. inputs padded with garbage tokens to inflate context) | Check whether input validation normalizes or strips padding |

**Severity if missing**: HIGH for T1–T5, MEDIUM for T6–T7.

---

## Reporting

**Per-check status:** ✅ PASS (control exists & effective) · ⚠️ WARN (partial / has gaps) · ❌ FAIL (no evidence; vulnerable) · ℹ️ N/A (not applicable) · 🔍 NEEDS-REVIEW (can't determine from code — flag for manual review).

**Report structure:**
```
## AI Security Audit — [project] — [date]
Categories audited: [list]

### [Category Name]
| Check | Status | Notes |
|-------|--------|-------|
| O1 | ✅ | Prompt/response logging in src/middleware/llm-logger.ts |
| O3 | ❌ | No PII redaction found before log write |
**Category verdict**: FAIL (1+ CRITICAL failures)
**Priority mitigations**: [specific action + file reference] …

### Summary
| Category | Verdict | Critical | High | Medium |
|----------|---------|----------|------|--------|
**Overall posture**: [CRITICAL / HIGH / MEDIUM / LOW]
**Top 3 actions to take now**: 1. … 2. … 3. …
```

**Verdict rules:** CRITICAL posture = any CRITICAL finding fails · HIGH = all CRITICAL pass but 2+ HIGH fail · MEDIUM = all CRITICAL & HIGH pass or WARN · LOW = only MEDIUM and below.

## CRITICAL rules

1. **Read code, don't run it** — verify controls by reading implementation, never by attempting real attacks.
2. **Cite specific files and line numbers** for every PASS or FAIL — say where you looked; "no evidence found" alone is insufficient.
3. **Serena for all code navigation** (`find_symbol`, `search_for_pattern`, `get_symbols_overview`) — no shell grep.
4. **Flag NEEDS-REVIEW honestly** — controls needing runtime observation (e.g. live rate limiting) get flagged with what to verify manually.
5. **Do not fix** — audit and report only; hand off fixes to the user or `/task-add`.
6. **Scope to the repo** — don't speculate about external infra unless config files are present.
7. **One category at a time** — complete each fully before the next; don't interleave findings.
