---
name: uat-generate
description: Generate UAT tests in wiki/work/uat/ for a task
category: planning
model: claude-sonnet-4-6
argument-hint: <TASK-NNN | path/to/task-file.md | feature description>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# UAT Generator

Generate comprehensive User Acceptance Tests (UAT) for a feature, writing them to `wiki/work/uat/`.

UAT owns **runtime and end-to-end verification**. `/tackle` only runs static gates (typecheck, lint, unit tests). Any behavior that requires executing the feature — running a script against real paths, hitting an API, walking a user flow, asserting on produced files — is a UAT test, not a tackle step.

---

**Target**: $ARGUMENTS

---

## Test Integrity (Non-Negotiable)

**Tests verify required functionality, not implementation behavior.** Encode what the feature *must do* per acceptance criteria — never what the current code happens to produce.

- Never weaken an assertion to make a test pass.
- Never narrow scope or drop edge cases to match buggy behavior.
- When research reveals a gap between requirement and implementation, write the test against the requirement and report the gap. Do not silently align with broken behavior.
- If you cannot determine the correct expected result from the requirement, stop and ask — do not invent a permissive assertion.

---

## Instructions

### Step 1: Resolve the source task and derive the UAT path

Parse `$ARGUMENTS`:

1. **TASK-NNN or path**: use `mcp__serena__find_file` to locate the task file in `wiki/work/tasks/`. All task files live in this single directory — files never move, status is in frontmatter.
2. **Number-slug** (e.g. `014-api-refactor`): use `mcp__serena__find_file` in `wiki/work/tasks/`.
3. **Feature description**: scan `wiki/work/tasks/` for a matching task via `mcp__serena__list_dir`. If none found, ask the user whether to create a task first via `/task-add`.

**UAT ID mirrors the task number**: TASK-014 → UAT-014. Slug mirrors the task slug.

Output path: `wiki/work/uat/UAT-NNN-slug.md`

**Check for an existing UAT file**: search `wiki/work/uat/` for a file starting with `UAT-NNN-`. If found and `status` is not `trashed`, ask the user: replace, append, or abort?

Screenshots directory: `wiki/work/uat/screenshots/`

### Step 2: Analyze the feature

Use Serena to explore the codebase:
- `find_symbol` and `get_symbols_overview` to find API endpoints, services, models, and UI components
- `search_for_pattern` when symbol names are unclear

Read the task file for acceptance criteria and scope. Identify happy paths, edge cases, and integration points.

#### Step 2.3: Research the contract for every planned test (mandatory)

Before writing any test, determine the **exact** behavior under test by reading the actual code. Guessed payloads, selectors, and error messages produce broken tests.

For each test type, produce a research notes block (in working context, not in the UAT file):

**2.3a. API tests** — capture: HTTP method + full path, required headers, request body schema (read the route handler or validator), query params, success response (status + body shape), error responses, side effects, auth prerequisites.

**2.3b. UI tests** — capture: route/URL (from router config — do not guess), component file path, exact element labels (read JSX), user actions, expected post-action state, loading/error states, auth/role requirements.

**2.3c. Edge case tests** — capture: exact code path that handles the case, trigger condition, observable response, and whether the behavior is intentional (verified in source).

**2.3d. Integration tests** — capture: every component/service/endpoint in the flow (in order), data passed between steps, side effects at each step, terminal observable state.

#### Step 2.4: Research checkpoint (hard gate)

Do not proceed to Step 3 until you can answer yes to all:
- [ ] Every API test: full request/response contract from source code (not guessed)
- [ ] Every UI test: route, component file, exact element labels, expected post-action state
- [ ] Every edge case test: actual handling code located
- [ ] Every integration test: full step-by-step flow documented
- [ ] Any test you cannot answer yes for: dropped (not approximated) and added to Step 6 gaps report

### Step 3: Generate UAT test cases

**Only test what the task changed or introduced.** Do not include tests for pre-existing functionality that was not modified.

Create the UAT file with this structure:

```markdown
---
id: UAT-NNN
title: "UAT: [Task Title]"
status: pending
task: TASK-NNN
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# UAT-NNN — UAT: [Task Title]

implements::[[TASK-NNN]]

> **Source task**: [[TASK-NNN]]
> **Generated**: YYYY-MM-DD

---

## Prerequisites

- [ ] [Environment prerequisite 1]
- [ ] [Data/state prerequisite]

---

## Test Cases

### UAT-API-001: [Descriptive Test Name]
- **Endpoint**: `[METHOD] /api/v1/[path]`
- **Description**: [What this test verifies]
- **Steps**:
  1. [Step-by-step instructions]
  2. Run the curl command below as-is
- **Command**:
  ```bash
  curl -sS -X POST 'http://localhost:8000/api/v1/example' -H 'Content-Type: application/json' -d '{"field":"value"}'
  ```
- **Expected Result**: [Status code + concrete body shape]
- [ ] Pass

### UAT-UI-001: [Descriptive Test Name]
- **Page**: [URL or route path]
- **Description**: [What this test verifies]
- **Steps**:
  1. [Navigation instructions]
  2. [User actions to perform]
  3. [What to observe]
- **Expected Result**: [What success looks like]
- [ ] Pass

### UAT-EDGE-001: [Error Handling Test Name]
- **Scenario**: [The edge case being tested]
- **Steps**: [How to trigger this scenario]
- **Expected Result**: [How the system should handle it]
- [ ] Pass
```

**Key rules**:
- Every test case ends with `- [ ] Pass`
- The `implements::[[TASK-NNN]]` typed link must appear on the first line after the H1
- Section separators (`---`) match the outline format `/tackle` expects

**Curl command standards** (mandatory):
- One single `curl` invocation per test; no `echo` wrappers, no `&&`/`;` chaining, no `2>&1`
- Use `-sS` (silent + show errors)
- Single quotes around URL and `-d` payload
- Inline the payload on `-d` with valid JSON
- `| jq` is allowed for a single pipe stage
- No `-w "\nHTTP %{http_code}\n"` format strings
- Auth tokens: use `-H "Authorization: Bearer $UAT_AUTH_TOKEN"` (double quotes so shell expands it)
- No literal credentials in the file

**Auth metadata** (required for every auth-gated test):
```
Auth-Required: true
Auth-Role: user
```

**API test ordering**: Create before Read/Update/Delete; validation/error tests after happy-path for each resource.

### Step 4: Write the UAT file and cross-reference

1. Write `wiki/work/uat/UAT-NNN-slug.md` using the `Write` tool.

2. Update the source task file's frontmatter: set `uat: "[[UAT-NNN]]"`. Use `Read` then `Edit` — never shell redirection.

### Step 5: Update the family index

Append to `wiki/work/uat/index.md`:

```
- [UAT-NNN — UAT: Title](UAT-NNN-slug.md) — verifies TASK-NNN · pending
```

If the file does not exist, create it with a `# UAT` heading and the list entry.

### Step 6: Append to wiki/log.md

Append:

```
## [YYYY-MM-DD] uat | UAT-NNN UAT: <task title>
Generated UAT-NNN for TASK-NNN with N test cases covering <brief scope>.
```

### Step 7: Report completion

Print:
- UAT file: `wiki/work/uat/UAT-NNN-slug.md`
- Source task: `TASK-NNN`
- Test counts by category
- Any gaps (tests dropped due to insufficient research)

Next steps:
```
To walk through tests interactively:  /uat-walk wiki/work/uat/UAT-NNN-slug.md
To run tests headlessly:              /uat-auto wiki/work/uat/UAT-NNN-slug.md
```

Output this banner verbatim:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UAT GENERATED
  File: wiki/work/uat/UAT-NNN-slug.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

(Replace `UAT-NNN-slug` with the actual filename.)

---

## Directory Structure

```
wiki/work/uat/
├── index.md                     # Family index — active items only
├── UAT-014-api-refactor.md      # pending/in-progress/failed UATs
├── UAT-015-user-auth.md
└── screenshots/                 # Screenshots captured during walkthrough

wiki/work/tasks/
├── index.md                     # Family index — active items only
├── TASK-014-api-refactor.md     # All tasks — status in frontmatter, never moved
└── TASK-015-user-auth.md
```

**UAT lifecycle** (via frontmatter `status`): `pending` → `in-progress` → `passed` | `failed` | `skipped` | `trashed`. Files never move.

---

## Naming Convention

| Task | UAT file |
|------|---------|
| `wiki/work/tasks/TASK-014-api-refactor.md` | `wiki/work/uat/UAT-014-api-refactor.md` |
| `wiki/work/tasks/TASK-003-user-auth.md` | `wiki/work/uat/UAT-003-user-auth.md` |
