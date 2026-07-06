---
name: eval-gap
description: Analyse the project's eval suite against the 5-stage framework and produce a prioritised gap report — what's missing, what's thin, and what to build next
category: researching
model: claude-sonnet-4-6
effort: low
argument-hint: [optional: stage — golden | scenarios | replay | rubric | all]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`.

$ARGUMENTS

---

# Eval Gap

Read-only audit of the project's eval suite. Produces a prioritised gap report and recommends the next `/eval-create` invocations. Does not write any eval files.

**Argument**: optional stage filter (`golden`, `scenarios`, `replay`, `rubric`, or `all`). Defaults to `all`.

---

## Step 1: Read the framework

Read `.docs/guides/evals-framework.md`. This defines the expected shape of each stage and is required context for meaningful gap analysis.

---

## Step 2: Inventory existing evals

Use Serena to scan the eval directory:

```
mcp__serena__list_dir("evals", recursive=true)
```

For each directory, read the files and extract metadata:

**Golden sets** (`evals/golden/`):
- Count of cases
- Tools referenced across all cases
- Query categories (inferred from queries)
- Check types used (tool_selection / source_citation / must_contain / must_not_contain)

**Labeled scenarios** (`evals/scenarios/`):
- Count of cases
- Categories and subcategories present
- Difficulty bands present
- Coverage matrix: `category × difficulty` — count per cell

**Replay fixtures** (`evals/replays/fixtures/`):
- Count of fixtures
- Whether they have ground-truth annotations

**Rubrics** (`evals/rubrics/`):
- Whether any rubric YAML files exist
- Dimensions defined
- Whether calibration sets are present

If `evals/` does not exist, skip to Step 4.

---

## Step 3: Assess against the framework

For each stage, score the current state:

| Stage | Minimum viable | Current | Gap severity |
|-------|---------------|---------|-------------|
| 1 — Golden Sets | 10–15 quality cases, all 4 check types used | N cases | 🔴 / 🟡 / 🟢 |
| 2 — Labeled Scenarios | 30+ cases, all tool categories covered, 3 difficulty bands | N cases | 🔴 / 🟡 / 🟢 |
| 3 — Replay Fixtures | At least 1 fixture per major query type | N fixtures | 🔴 / 🟡 / 🟢 |
| 4 — Rubrics | At least 1 rubric with explicit score anchors | defined / missing | 🔴 / 🟡 / 🟢 |

Gap severity:
- 🔴 Critical: stage not started or severely under-resourced
- 🟡 Partial: stage exists but has clear gaps
- 🟢 Healthy: meets minimum viable bar

---

## Step 4: Produce the gap report

Print a structured report covering all stages (or the filtered stage if `$ARGUMENTS` specifies one).

### Section: Stage 1 — Golden Sets

- Current count vs target (10–15)
- Check types in use vs missing
- Tool coverage: which tools have no golden case
- Query types covered vs obvious missing types
- Anti-patterns detected (e.g., vague `must_not_contain` terms, missing `expected_tools`)
- **Recommended**: next 1–3 golden cases to add (describe what they should cover — do not write YAML)

### Section: Stage 2 — Labeled Scenarios

- Coverage matrix showing `category × difficulty` pass-rate or case count
- Empty cells in the matrix (highest priority gaps)
- Difficulty band distribution (is it all `straightforward`? needs more `edge_case`)
- **Recommended**: which cells to fill next

### Section: Stage 3 — Replay Fixtures

- Coverage vs golden set (does every golden query type have a fixture?)
- Whether ground-truth annotations exist
- Fixture age (if date metadata available — stale fixtures should be re-recorded)
- **Recommended**: which query types need fixtures

### Section: Stage 4 — Rubrics

- Whether any rubric exists
- If yes: which dimensions are defined, whether anchors are explicit, whether calibration exists
- If no: readiness check — do golden sets and scenarios exist? If yes, rubrics are the next investment
- **Recommended**: which dimensions to define first

### Section: Stage readiness

Which stage is the team actually on, and what is the single highest-leverage next action?

```
Current stage: Stage N — <name>
Next action:   /eval-create <recommended arg>
Reason:        <one sentence>
```

---

## Step 5: Anti-pattern check

Scan existing evals for common anti-patterns from the framework:

| Anti-pattern | What to check | How to detect |
|-------------|--------------|--------------|
| Likert trap | Rubric scores without explicit anchors | Read rubric YAML — any score without a description |
| Vague criteria | must_contain/must_not_contain terms that are too generic | Terms like "good", "correct", "yes", "no" |
| Form over quality | must_contain checks on response length or formatting | Numeric length checks |
| Missing negative validation | Golden cases without must_not_contain | Cases where must_not_contain is empty or absent |
| No tool selection checks | Cases without expected_tools | Cases missing the field |

Report which anti-patterns are present and which cases exhibit them.

---

## CRITICAL rules

1. **Read-only.** This skill never writes files.
2. **Only recommend — never create.** Describe what evals should cover; never produce YAML. Direct the user to `/eval-create` for that.
3. **No rubric judgements without reading the rubric.** Do not claim a rubric is broken without reading its YAML.
