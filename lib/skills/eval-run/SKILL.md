---
name: eval-run
description: Execute the project's eval suite (golden sets, scenarios, replays), report pass/fail per case, surface regressions, and emit a summary report
category: executing
model: claude-sonnet-5
effort: medium
argument-hint: [optional: stage — golden | scenarios | replay | all]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`.

$ARGUMENTS

---

# Eval Run

Execute the project's eval suite and produce a structured results report. Supports Stage 1 (golden sets), Stage 2 (labeled scenarios), and Stage 3 (replay fixtures). Stage 4 rubrics and Stage 5 experiments are out of scope for this skill — they require live LLM calls and are gated on human review.

**Argument**: optional stage filter (`golden`, `scenarios`, `replay`, or `all`). Defaults to `all` if omitted.

---

## Step 1: Locate the eval suite

Use Serena to inspect the eval directory:

```
mcp__serena__list_dir("evals", recursive=true)
```

Build an inventory:

| Directory | Stage | Files | Status |
|-----------|-------|-------|--------|
| `evals/golden/` | Stage 1 | N YAML files | found / missing |
| `evals/scenarios/` | Stage 2 | N YAML files | found / missing |
| `evals/replays/fixtures/` | Stage 3 | N JSON files | found / missing |

If the `evals/` directory does not exist or is empty, stop and tell the user:

> No eval suite found. Run `/eval-create` to build the first golden set.

---

## Step 2: Locate or scaffold the test runner

Check whether a test runner script already exists:

```
mcp__serena__find_file("eval_runner*", ".")
mcp__serena__find_file("run_evals*", ".")
mcp__serena__find_file("*evals*.sh", ".")
mcp__serena__find_file("*evals*.py", ".")
```

Also check `Makefile` or `package.json` for eval-related targets (`make evals`, `npm run evals`, etc.).

**If a runner exists**: execute it using `Bash` and capture stdout/stderr. Parse the output into per-case results (see Step 4).

**If no runner exists**: inform the user and offer to scaffold a minimal runner (see Step 3).

---

## Step 3: Scaffold a minimal runner (only if no runner exists)

Ask the user via `AskUserQuestion`:

> No eval runner found. Should I scaffold a minimal one?
> - **Yes — scaffold Python runner** (requires Python 3, PyYAML)
> - **Yes — scaffold shell runner** (bash, no dependencies)
> - **No — I will wire up the runner myself**

If the user approves scaffolding, create `evals/run_evals.py` (Python) or `evals/run_evals.sh` (shell).

The minimal runner must:
1. Load YAML files from `evals/golden/` (and `evals/scenarios/` if present)
2. For each case, report:
   - Case ID
   - Which checks passed / failed (tool selection, source citation, must_contain, must_not_contain)
   - Overall PASS / FAIL
3. Exit with code 0 if all cases pass, non-zero if any fail
4. Emit a JSON results file to `evals/results/latest.json`

**Important**: the scaffolded runner checks YAML structure only (schema validation) — it cannot actually invoke the AI system. Include a prominent comment explaining this:

```python
# NOTE: This runner validates eval case structure (schema + static assertions).
# To run evals against a live system, integrate your system's invoke() function
# at the TODO: INTEGRATE comment below.
```

Then re-run the scaffolded runner via `Bash` to confirm it executes without errors.

---

## Step 4: Parse and normalize results

Whether from an existing runner or the scaffolded one, normalize results into this structure per case:

```
case_id: "gs-001"
stage: golden
status: PASS | FAIL | ERROR | SKIP
checks:
  tool_selection: pass | fail | n/a
  source_citation: pass | fail | n/a
  must_contain: pass | fail | n/a
  must_not_contain: pass | fail | n/a
failure_detail: "<which check failed and why, if status=FAIL>"
```

If the runner produced raw output, parse it using `Bash` (grep, awk, jq) as needed.

---

## Step 5: Diff against baseline

Check whether a previous results file exists:

```
mcp__serena__find_file("results.json", "evals/results/")
mcp__serena__find_file("baseline.json", "evals/results/")
```

If a baseline exists, compute the diff:
- **Regressions**: cases that were PASS in baseline and are now FAIL
- **Fixes**: cases that were FAIL in baseline and are now PASS
- **New cases**: cases with no baseline entry
- **Removed cases**: cases in baseline no longer present

Flag regressions prominently.

---

## Step 6: Emit results report

Print a structured report:

### Summary

| Metric | Value |
|--------|-------|
| Total cases run | N |
| Passed | N (N%) |
| Failed | N (N%) |
| Errors | N |
| Skipped | N |
| Regressions vs baseline | N |
| Fixes vs baseline | N |

### Per-stage breakdown

| Stage | Cases | Pass | Fail | Pass rate |
|-------|-------|------|------|-----------|
| Stage 1 — Golden | N | N | N | N% |
| Stage 2 — Scenarios | N | N | N | N% |
| Stage 3 — Replay | N | N | N | N% |

### Regressions (if any)

List each regression case with:
- Case ID and query
- Which check failed
- Failure detail

### Failures (non-regression)

List each failing case with failure detail.

### Coverage matrix (Stage 2, if scenarios exist)

If labeled scenarios are present, emit a `category × difficulty` pass-rate matrix:

```
                  | straightforward | ambiguous | edge_case |
------------------|-----------------|-----------|-----------|
vector_search     |      3/3        |    1/2    |    1/1    |
sql_query         |      2/3        |    1/1    |    --     |
multi_tool        |      1/1        |    0/1    |    --     |
```

Empty cells indicate missing test coverage — flag them.

---

## Step 7: Save results

Write `evals/results/latest.json` with the full per-case results. If a baseline file exists, archive it to `evals/results/YYYY-MM-DD-baseline.json` before overwriting.

---

## Step 8: Gate and next steps

Print a final gate verdict:

- **GREEN** — all golden cases pass (regressions = 0): safe to ship
- **YELLOW** — golden cases pass but scenario pass-rate dropped: review before shipping
- **RED** — one or more golden cases fail or regressions detected: do not ship

Suggest next steps based on results:
- Failures → "Investigate failing cases. Use `/eval-gap` to see if new coverage is needed or if the system regressed."
- Empty coverage cells → "Use `/eval-create` to add cases for uncovered categories."
- No rubric yet → "Consider adding Stage 4 rubrics for quality scoring. Use `/eval-create rubric` to start."

---

## CRITICAL rules

1. **Never invoke the live AI system** unless the project has an existing eval runner that does so explicitly. The scaffolded runner is schema-only.
2. **Regressions always surface in the report** — never silently omit a case that was passing before.
3. **Exit code matters**: if running via CI, the runner must exit non-zero on any golden set failure. Note this in the report.
4. **Never overwrite baseline.json** without archiving the old one first.
