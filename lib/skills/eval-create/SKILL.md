---
name: eval-create
description: Assess the project's eval coverage against the 5-stage framework, identify gaps, and create new evals one at a time with user understanding and approval at each step
category: executing
model: claude-sonnet-4-6
effort: high
argument-hint: "[stage: golden|scenarios|replay|rubric] [description of the eval to create — e.g. 'golden case for the refund policy query using vector_search']"
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

$ARGUMENTS

---

# Eval Create

Create new eval cases for this project by assessing coverage against the 5-stage evals framework and filling the highest-priority gaps.

**Core rule**: Every eval you propose must be explained and explicitly approved by the user before it is written. In bootstrap mode (no golden sets yet) this is strictly enforced — one eval at a time, no batching. After golden sets exist the same spirit applies but you may present a small batch (2–3) after the user has warmed up to the process.

---

## Step 0: Parse arguments and pick execution path

Parse `$ARGUMENTS` immediately. The argument string can take several forms:

| Form | Example | Execution path |
|------|---------|---------------|
| Empty | *(nothing)* | Full discovery flow — Steps 1 → 2 → 3 → mode branch |
| Stage keyword only | `golden` / `scenarios` / `rubric` | Skip system discovery; go straight to gap-fill for that stage |
| Specific eval description | `"golden case for the refund policy query"` | **Direct mode** — skip discovery entirely, jump to Step 4-Direct |
| Stage + description | `"golden refund policy query using vector_search"` | **Direct mode** scoped to that stage |

**Direct mode** (any non-empty argument that is not a bare stage keyword):

1. Acknowledge the request: "Creating a golden set eval for: `<extracted description>`"
2. Read `.docs/guides/evals-framework.md` (always required)
3. Survey `evals/golden/` to find the next ID and check bootstrap vs gap-fill state
4. Go directly to **Step 4-Direct** — skip Steps 1–3

**Stage keyword only**: skip Step 2 (system discovery Q&A) and go straight to Step 3 survey, then the gap-fill branch for that stage.

**Empty arguments**: full flow starting at Step 1.

---

## Step 1: Read the framework

Read `.docs/guides/evals-framework.md` in full. This is authoritative for stage definitions, schemas, check types, and anti-patterns. Do not proceed until you have read it.

---

## Step 2: Understand the system under test

Before proposing any evals you need to understand what you are evaluating.

Use `AskUserQuestion` to gather:

1. **What does this system do?** — one-sentence description of the AI feature or agent being evaluated (e.g. "RAG chatbot that answers HR policy questions", "code review agent", "SQL query assistant")
2. **What tools or capabilities does it have?** — list of tool names (e.g. `vector_search`, `sql_query`, `jira_lookup`) or capabilities (e.g. multi-turn conversation, citation, tool-calling)
3. **What are the 2–3 most important things it must always do correctly?** — these become the seed of the golden set

If `$ARGUMENTS` names a specific stage to target (e.g. `golden`, `scenarios`), skip questions that are irrelevant to that stage.

---

## Step 3: Survey existing evals

Use Serena to inspect the eval directory structure:

```
mcp__serena__list_dir("evals", recursive=true)
```

If the `evals/` directory does not exist, note that as **bootstrap mode** and proceed to Step 4A.

For each sub-directory that exists, count the eval files:

| Directory | Stage | Files found |
|-----------|-------|-------------|
| `evals/golden/` | Stage 1 — Golden Sets | N |
| `evals/scenarios/` | Stage 2 — Labeled Scenarios | N |
| `evals/replays/` | Stage 3 — Replay Fixtures | N |
| `evals/rubrics/` | Stage 4 — Rubrics | N |

Read existing golden set files (if any) to understand what is already covered — note the IDs, query types, and check patterns already present.

**Determine mode**:

- **Bootstrap mode**: `evals/golden/` does not exist OR contains zero YAML files → go to Step 4A
- **Gap-fill mode**: golden sets exist → go to Step 4B

---

## Step 4A: Bootstrap mode — first golden sets (STRICTLY one at a time)

The user has no golden sets yet. The goal is to build a small, high-quality foundation of 10–15 cases that become the permanent regression suite.

### Explain before starting

Present this framing to the user before proposing anything:

> **Why we start with golden sets**
>
> Golden sets are the foundation. They are the 10–15 cases that define what "correct" looks like for your system. They cost nothing to run (no LLM calls — pure assertions), run on every commit, and catch regressions immediately.
>
> We will create them one at a time. For each one I will show you:
> - The query
> - What tools or sources the system should use
> - What the response must contain
> - What the response must never contain
>
> You confirm or edit each one before it is written. You can stop after any eval.

### Propose the first eval

Based on the system description from Step 2, propose the single highest-value golden case:

- Choose the **canonical happy path** — the most common, most important query type
- Show the full YAML for one eval:

```yaml
- id: "gs-001"
  description: "<one sentence — what scenario this tests>"
  query: "<realistic query the system would receive>"
  expected_tools:
    - <tool_name>
  expected_sources:
    - <source_document.ext>
  must_contain:
    - "<key phrase that must appear in the response>"
  must_not_contain:
    - "I don't know"
    - "I cannot find"
```

- Explain **why** each field was chosen:
  - Why this query? (It's the golden path / most common scenario)
  - Why these tools? (This query type always needs X)
  - Why these must_contain terms? (These are the facts the response must include)
  - Why these must_not_contain terms? (These indicate failure modes)
- Explain **what regression this catches**: "If someone changes the retrieval logic and this query stops hitting the right document, this eval will fail in CI."

Use `AskUserQuestion` with options:
- **Approve — write it** (write the file, then loop to the next eval)
- **Edit it** (show fields as editable — re-ask with their corrections applied)
- **Skip this one** (propose a different eval instead)
- **Stop here** (end the session)

**Do not write the file until the user selects Approve.**

### Loop: next eval

After writing an approved eval, immediately propose the next one. For the next eval, cover a **different scenario type**:

Suggested progression (adapt to the actual system):
1. Canonical happy path (single-tool, unambiguous)
2. Second most common query type
3. A negative validation case (query that should NOT hallucinate a specific wrong answer)
4. A multi-tool or multi-source query (if the system supports it)
5. An edge case (ambiguous query, empty result set, adversarial phrasing)

After each approval, ask:
> Written as `evals/golden/gs-NNN.yaml`. Continue with the next eval, or stop here?

Continue until the user stops or you reach 15 evals.

### Strict enforcement rules for bootstrap mode

- **Never propose two evals at once.** One proposal per round, full stop.
- **Never write a file without explicit "Approve" from the user.**
- **Never skip the explanation.** Every eval must have: why this query, why these checks, what regression it catches.
- **Never invent facts about the system.** If you are unsure what tool a query should use, ask.

---

## Step 4B: Gap-fill mode — assess coverage and propose additions

Golden sets exist. Now assess gaps and propose the highest-priority evals to fill them.

### Coverage audit

1. Read all existing golden set YAML files. Build a coverage summary:

```
Golden sets: N cases
  - Tool coverage: [list of tools referenced]
  - Query types covered: [inferred from queries]
  - Missing tools: [any tool from Step 2 not yet covered]
  - Missing scenarios: [obvious gaps]
```

2. If `evals/scenarios/` exists, read those files and build a coverage matrix by `category × difficulty`. Show empty cells as gaps.

3. Present the audit to the user as a table. Highlight the top 3 gaps.

### Propose evals for the highest-priority gap

For the top gap, propose 1–3 evals (scale up only once the user has approved the first one in this session):

- For the very first proposal in this session: **one eval only** (same as bootstrap mode — earn trust before batching)
- After first approval in this session: may present up to 3 at a time, clearly separated

Each proposal must include:
- Full YAML (following the schema for the target stage)
- One-sentence explanation of what gap it fills
- What regression it catches

Use `AskUserQuestion` with options:
- **Approve all** (write all proposed evals)
- **Approve some** (user selects which)
- **Edit** (re-propose with corrections)
- **Propose different gap** (skip this gap, show the next one)
- **Stop**

### Stage progression check

After covering gaps within the current stage, check whether the project is ready to advance:

| Current state | Suggest next |
|--------------|-------------|
| < 10 golden cases | Add more golden cases |
| ≥ 10 golden cases, no scenarios | Introduce Stage 2: first labeled scenario |
| Scenarios exist, no replays | Introduce Stage 3: first replay fixture |
| Replays exist, no rubrics | Introduce Stage 4: first rubric definition |

When suggesting a new stage, explain what it adds and why now is the right time.

---

## Step 4-Direct: Direct mode — create from description

This step runs only when `$ARGUMENTS` contains a specific eval description (non-empty, non-bare-keyword). It replaces the full discovery and gap-analysis flow with a focused single-eval creation loop.

### Parse the description

Extract from `$ARGUMENTS`:
- **Stage** (default: `golden` if not specified)
- **Query or scenario described** — what the user said the eval should cover
- **Any hints** about tools, sources, expected content (pick these out of the description if present)

Fill in any gaps you can infer from context; ask only for what is genuinely ambiguous.

### Check bootstrap state

Scan `evals/golden/` (or the relevant stage directory) to determine the next ID and whether bootstrap mode applies. If bootstrap mode is active (no golden sets yet), the strict one-at-a-time rule applies — even in direct mode.

### Propose the eval immediately

Present the proposed YAML derived from the description — no preamble, no multi-question discovery. Show the user what you built from their description:

```yaml
- id: "gs-NNN"
  description: "<one sentence — what this tests>"
  query: "<query derived from the description>"
  expected_tools:
    - <inferred or explicit>
  expected_sources:
    - <inferred or explicit>
  must_contain:
    - "<key terms>"
  must_not_contain:
    - "I don't know"
```

Then briefly note:
- Any fields you had to infer (so the user can correct them)
- What regression this catches

Use `AskUserQuestion`:
- **Approve — write it**
- **Edit** (show correctable fields)
- **Stop**

After writing, ask if the user wants to continue with the next eval (gap-fill mode) or stop.

---

## Step 5: Write eval files

After approval, write each eval to the correct location:

| Stage | Directory | File format |
|-------|-----------|-------------|
| Stage 1 — Golden | `evals/golden/` | `gs-NNN.yaml` (one case per file) or append to `golden.yaml` — match existing convention |
| Stage 2 — Scenarios | `evals/scenarios/` | `sc-NNN.yaml` |
| Stage 3 — Replays | `evals/replays/fixtures/` | `<session-id>.json` (record actual; create placeholder if live recording not possible) |
| Stage 4 — Rubrics | `evals/rubrics/` | `<dimension>.yaml` |

Create parent directories if they do not exist (use `Bash mkdir -p`).

For golden and scenario YAML files, prefer **one case per file** unless the project already uses a different convention. File names match the eval ID: `gs-001.yaml`, `sc-047.yaml`.

---

## Step 6: Update the eval index

If `evals/README.md` exists, update it to record the new eval(s). If it does not exist, create it with:

```markdown
# Evals

## Stage 1 — Golden Sets (`evals/golden/`)

| ID | Query summary | Tools | Added |
|----|--------------|-------|-------|
| gs-001 | <summary> | vector_search | YYYY-MM-DD |
```

Add a row per new eval written in this session.

---

## Step 7: Report

Print a summary:

| Field | Value |
|-------|-------|
| Mode | bootstrap / gap-fill |
| Evals written | N (list IDs) |
| Stage covered | Stage N — <name> |
| Total golden cases now | N |
| Next recommended action | e.g. "Add 5 more golden cases", "Run `/eval-gap` for coverage report", "Run `/eval-run` to verify runner finds new cases" |

---

## CRITICAL rules

1. **Never write an eval without explicit user approval.** Propose → explain → approve → write. In that order, every time.
2. **In bootstrap mode: strictly one eval at a time.** No exceptions. No batching. No "here are three options" followed by writing all three.
3. **Never invent system behavior.** If you don't know what tool a query uses, ask.
4. **No must_contain terms that are implementation artifacts** (log lines, internal IDs, debug output). Only observable response content.
5. **No vague must_not_contain terms** like "bad" or "wrong". Specific failure-mode strings only (e.g. `"I don't know"`, `"no information available"`, `"hallucinated_term"`).
6. **Every eval needs a regression story.** If you cannot articulate "this eval fails when X breaks", the eval is not ready.
7. **Never skip Step 1** (reading the framework). The quality of evals degrades without it.
