---
description: Generate User Acceptance Tests for a feature or documentation file
argument-hint: <path/to/task-file.md, number-slug, or feature description>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/task-lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


# UAT Generator

Generate comprehensive User Acceptance Tests (UAT) for a feature, writing them to `.docs/uat/pending/`.

---

**Target**: $ARGUMENTS

---

## Instructions

### Step 1: Determine the Source and Derive the UAT File Path

Parse `$ARGUMENTS` to determine the source and output file:

1. **If a task file path is provided** (e.g., `.docs/tasks/active/3-user-auth.md`):
   - Read the task file
   - Extract the feature requirements and scope
   - Derive UAT filename from the task filename: `3-user-auth.md` → `.docs/uat/pending/3-user-auth.uat.md`

2. **If a number-slug is provided** (e.g., `3-user-auth`):
   - Search `.docs/tasks/active/` for `<number-slug>.md`
   - If found, read the task file and extract feature requirements
   - Derive UAT filename: `<number>-<slug>.md` → `.docs/uat/pending/<number>-<slug>.uat.md`
   - If not found in either directory, STOP and report the error

3. **If a feature description is provided** (e.g., "user authentication"):
   - Search `.docs/tasks/active/` for a matching task file
   - If a matching task is found, use its naming: `.docs/uat/pending/<number>-<slug>.uat.md`
   - If no matching task exists, ask the user:
     - Should a task be created first via `/add-task`?
     - Or assign a standalone UAT number and slug: `.docs/uat/pending/<next-number>-<slug>.uat.md`
   - To determine `<next-number>`, scan existing files in `.docs/uat/pending/`, `.docs/uat/completed/`, and `.docs/tasks/active/` for the highest number

3. Assume `.docs/uat/pending/`, `.docs/uat/completed/`, and `.docs/uat/screenshots/` directories already exist.

4. **Check for existing UAT file** in both `pending/` and `completed/`:
   - If it exists in `pending/`, ask the user: replace, append, or abort?
   - If it exists in `completed/`, warn the user that a completed UAT already exists and ask whether to generate a new version in `pending/`

### Step 2: Analyze the Feature

Use MCP Serena to explore the codebase and understand the feature:

1. **Identify relevant code**:
   - Use `find_symbol` and `get_symbols_overview` to find API endpoints, services, models, and UI components related to the feature
   - Use `search_for_pattern` if symbol names are unclear

2. **Extract requirements**:
   - Read the source task file for acceptance criteria and scope
   - Identify happy paths, edge cases, and integration points
   - Note any dependencies or prerequisites

3. **Research API contracts** (required for any API tests):

   Before writing a single API test case, you MUST determine the **exact** input and output contract for each endpoint under test. Guessed payloads produce broken tests. Run the `/research` workflow (see `.claude/commands/research.md`) — or perform equivalent direct investigation — to capture, for each endpoint:

   - **HTTP method and full path** (including any path params)
   - **Required headers** (auth scheme, content-type, cookies)
   - **Request body schema**: every field name, type, whether required/optional, and a realistic example value. Read the route handler, request validator (Zod/Pydantic/DTO/etc.), or OpenAPI spec — do not infer from variable names alone.
   - **Query parameters**: name, type, allowed values, defaults
   - **Success response**: status code, full body shape with example values
   - **Error responses**: status codes and body shape for validation failures, not-found, unauthorized
   - **Side effects**: what the endpoint creates, mutates, or deletes (so subsequent tests can depend on it)
   - **Auth/session prerequisites**: how to obtain a valid token or cookie before the test runs

   Sources to consult, in order of preference:
   1. The route handler source file (Serena `find_symbol` on the handler)
   2. The request/response schema definition (Zod, Pydantic, TypeBox, DTO class, etc.)
   3. Existing integration tests or fixtures that already exercise the endpoint
   4. OpenAPI/Swagger spec if the project publishes one
   5. As a last resort, Context7 for framework-level docs

   If you cannot determine any of the above for a given endpoint, **do not fabricate a test for it**. Note the gap in the report (Step 6) and skip the test.

### Step 3: Generate UAT Test Cases

Create a UAT file structured as a **`/tackle`-compatible outline** with `- [ ]` checkboxes.

The file MUST follow this structure:

```markdown
# UAT: [Feature Name]

> **Source task**: [`.docs/tasks/active/<number>-<slug>.md`](relative-link) (or "Standalone" if no task)
> **Generated**: YYYY-MM-DD

---

## Prerequisites

- [ ] [Environment prerequisite 1]
- [ ] [Environment prerequisite 2]
- [ ] [Data/state prerequisite]

---

## API Tests

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
- **Expected Result**: [Status code + concrete body shape, e.g. `201 Created` with `{"id": "<uuid>", "field": "value", "createdAt": "<iso>"}`]
- [ ] Pass

### UAT-API-002: [Next Test]
...

---

## UI Tests

### UAT-UI-001: [Descriptive Test Name]
- **Page**: [URL or route path]
- **Description**: [What this test verifies]
- **Steps**:
  1. [Navigation instructions]
  2. [User actions to perform]
  3. [What to observe]
- **Expected Result**: [What success looks like]
- [ ] Pass

---

## Edge Case Tests

### UAT-EDGE-001: [Error Handling Test Name]
- **Scenario**: [The edge case being tested]
- **Steps**: [How to trigger this scenario]
- **Expected Result**: [How the system should handle it]
- [ ] Pass

---

## Integration Tests

### UAT-INT-001: [Integration Test Name]
- **Components**: [What components interact]
- **Flow**: [The complete user flow being tested]
- **Steps**: [End-to-end instructions]
- **Expected Result**: [What success looks like]
- [ ] Pass
```

**Key structural rules**:
- Every test case ends with `- [ ] Pass` — this makes the file `/tackle`-compatible
- Prerequisites also use `- [ ]` checkboxes
- The `Source task` header links back to the originating task file (typically in `active/`)
- Section separators (`---`) match the outline format `/tackle` expects

### Step 3b: Relevance Filter — Only Test What Changed

Before writing any test case, assess whether the functionality it covers was **actually changed or introduced** by the task. The UAT file must only contain tests for new or modified behavior — not for pre-existing features that happen to be related.

For each potential test, apply this decision:

| Verdict | Criteria | Action |
|---------|----------|--------|
| **Include** | The task introduced this endpoint, page, behavior, or validation — or modified its logic, response shape, UI, or error handling | Write the test |
| **Exclude** | The endpoint/page/behavior existed before and was **not modified** by this task, even if the test subject is in the same file, module, or domain | Do **not** write a test |

**How to assess relevance:**
1. Read the task file's scope, acceptance criteria, and listed changes
2. Use Serena (`find_referencing_symbols`, `search_for_pattern`) or `git diff` against the base branch to identify exactly which files, symbols, and routes were added or modified
3. For each candidate test, ask: *"Would this test have a different expected result after the task compared to before?"*
   - **Yes** → include it
   - **No** → exclude it

**Examples:**
- Task adds a `PATCH /api/leads/:id` endpoint → include tests for update happy path, update validation, update 404. Do **not** include tests for `GET /api/leads` or `POST /api/leads` unless their behavior also changed.
- Task adds a new UI page → include tests for that page. Do **not** include tests for the navbar or sidebar unless the task modified them (e.g., added a new nav link).
- Task changes validation rules on an existing `POST` endpoint → include tests for the new validation. Include the happy-path `POST` only if the valid request shape changed. Do **not** include `GET`/`DELETE` tests for the same resource unless affected.

**If in doubt**, err on the side of exclusion. A focused UAT that verifies the actual changes is more valuable than a broad UAT that re-tests stable functionality.

### Step 4: Test Case Guidelines

When generating tests, ensure:

1. **Completeness** (within the scope of changed functionality only):
   - Cover all **new or modified** API endpoints (CRUD operations that changed)
   - Cover all **new or modified** UI pages and interactions
   - Include error scenarios for **changed** endpoints (400, 404, 500 errors)
   - Include validation edge cases for **new or changed** validation rules

2. **Specificity**:
   - Provide exact curl commands with sample data grounded in the API contract from Step 2.3
   - Include specific URLs and routes
   - Specify exact expected response structures
   - Include sample request/response bodies

   **Curl command standards** (mandatory — these prevent walkthrough friction):

   - **One single `curl` invocation per test**, optionally piped into a single output-shaping helper. No `echo` wrappers, no banner lines, no `&&`/`;` chaining, no `2>&1`, no output redirection. Chained shell commands trigger user approval prompts and slow the walkthrough to a crawl.
   - **Piping into `jq` is allowed and encouraged** when the raw response is large or noisy — e.g. `| jq '.'` to pretty-print, `| jq '.data | length'` to count, `| jq '{id, status, createdAt}'` to project the fields the test actually verifies. Keep it to a single pipe stage; do not chain `jq` into `head`, `tee`, etc.
   - **No `-w "\nHTTP %{http_code}\n"`** or other format strings appended to surface the status code. The walkthrough operator reads the HTTP response directly; the status is visible in the response or in `-i`/`-v` output if needed.
   - **Use `-sS`** (silent + show errors) so progress bars don't pollute output, but errors still surface.
   - **Use single quotes around the URL and `-d` payload** so the shell doesn't try to interpolate `$` or backticks. If the payload itself contains a literal single quote, switch the outer quoting to double quotes and escape as needed — but prefer payloads without embedded single quotes.
   - **Inline the payload on `-d`** with valid JSON. Do not use heredocs, temp files, or `@file.json` references — the test must run from a fresh shell with no setup.
   - **Hardcode realistic example values.** Do not use shell variables (`$TOKEN`, `$ID`) unless the test explicitly documents how to obtain them in a Prerequisites step. If a test depends on an ID created by an earlier test, write the example with a clear placeholder like `<id-from-UAT-API-001>` and instruct the operator to substitute it.
   - **Auth tokens / cookies**: if the endpoint requires auth, either (a) include a `-H 'Authorization: Bearer <token>'` placeholder with a Prerequisites step explaining how to obtain the token, or (b) use `-b cookies.txt` only if a prior test in the file populates that cookie jar. Never assume an undocumented auth state.
   - **No line continuations** (`\` at end of line) unless the command genuinely exceeds ~200 chars. Long single-line commands are easier to copy-paste than multi-line ones.
   - **The command must run successfully against a freshly-started dev server with documented prerequisites met.** If you cannot construct such a command, you do not understand the contract well enough yet — return to Step 2.3.

   **Bad example** (do not generate this — it triggers approval prompts and clutters output):
   ```bash
   echo "===== API-2: POST /api/chat ====="
   curl -sS -X POST "http://localhost:4321/api/chat" \
     -b cookies.txt -c cookies.txt \
     -H "Content-Type: application/json" \
     --max-time 90 \
     -d '{"messages":[...]}' \
     -w "\nHTTP %{http_code}\n" | head -c 800
   echo
   echo "===== API-2 DONE ====="
   ```

   **Good example** (clean, single invocation, ready to run):
   ```bash
   curl -sS -X POST 'http://localhost:4321/api/chat' -H 'Content-Type: application/json' -b cookies.txt -c cookies.txt -d '{"messages":[{"role":"user","content":"hello"}],"context":"resume-builder","resumeId":"<id-from-UAT-API-001>","applicationId":"<id-from-UAT-API-001>"}'
   ```

3. **Executability**:
   - Each test should be independently executable
   - Prerequisites should be clearly stated
   - Steps should be unambiguous

4. **Coverage Categories**:
   - **Happy path**: Normal successful operations
   - **Validation**: Input validation and constraints
   - **Authorization**: Permission checks (if applicable)
   - **Error handling**: How errors are displayed/returned
   - **Edge cases**: Empty states, limits, special characters

5. **API Test Ordering** (critical for sequential walkthrough):

   API tests MUST be ordered so they can be run sequentially from top to bottom without skipping. Tests that create data come before tests that read, filter, update, or delete that data.

   **Order by CRUD lifecycle per resource:**
   1. **Create** (POST) — happy path, creates records that subsequent tests depend on
   2. **Create validation** — POST with invalid/missing fields (400 errors)
   3. **List / Read** — GET collection, GET by ID (data now exists from step 1)
   4. **List with filters / pagination / search** — GET with query params
   5. **Update** (PUT/PATCH) — happy path modifications
   6. **Update validation** — PATCH/PUT with invalid data, non-existent IDs (400, 404)
   7. **Delete** (DELETE) — happy path removal
   8. **Delete validation** — DELETE non-existent IDs (404)
   9. **Post-delete verification** — confirm deleted resource returns 404 on GET

   **When multiple resources exist**, order the resources so that dependencies are satisfied. For example, if "leads" are created by a "job search POST", the job search tests come before the lead filter/read tests.

   **Cross-resource dependency example:**
   ```
   UAT-API-001: Create Job Search (POST /api/searches) — creates leads as side effect
   UAT-API-002: List Leads (GET /api/leads) — now has data from 001
   UAT-API-003: Filter Leads by Status (GET /api/leads?status=new)
   UAT-API-004: Get Lead by ID (GET /api/leads/:id)
   UAT-API-005: Update Lead (PATCH /api/leads/:id)
   UAT-API-006: Delete Lead (DELETE /api/leads/:id)
   ```

   **Error/validation tests that don't need existing data** (e.g., POST invalid JSON → 400, GET non-existent ID → 404) can be placed either alongside their CRUD group or in a separate "Validation & Error Handling" subsection after the happy-path CRUD block — but never before the create tests they implicitly depend on.

### Step 5: Write UAT File and Cross-Reference

1. **Write the UAT file** to `.docs/uat/pending/<number>-<slug>.uat.md`

2. **Update the source task file** (if one exists, typically in `.docs/tasks/active/`):
   - Use **`Read`** to load the task file, then **`Edit`** to append a reference at the bottom. **Never** use `echo >>`, `cat <<EOF`, `sed`, or any other shell command to append. See `.docs/guides/mcp-tools.md` "Common anti-patterns".
   - The reference to append:
     ```markdown
     ---
     **UAT**: [`.docs/uat/pending/<number>-<slug>.uat.md`](../../uat/pending/<number>-<slug>.uat.md)
     ```
   - If the task already has a UAT reference, use `Edit` to replace the existing one in place

### Step 6: Report Completion

After writing the tests:

1. **Summary**:
   - UAT file path
   - Source task (if any)
   - Test counts: API / UI / Edge Case / Integration

2. **Next steps for the user**:
   ```
   To walk through tests interactively:  /uat-walkthrough .docs/uat/pending/<number>-<slug>.uat.md
   To create a task first:               /add-task <description>
   ```
   When all tests pass, `/uat-walkthrough` moves the file from `pending/` to `completed/`.

3. Note any areas that may need additional manual test cases

---

## Directory Structure

```
.docs/uat/
├── pending/          # Newly generated UATs, not yet fully passed
│   ├── 3-user-auth.uat.md
│   └── 5-positions.uat.md
└── completed/        # All tests passed, UAT signed off
    └── 1-onboarding.uat.md

.docs/tasks/
├── active/           # Tasks being implemented via /tackle, then awaiting UAT
└── completed/        # UAT passed, task fully complete
```

**Task lifecycle**: `active/` → (`/tackle` completes, stays in `active/`) → (`/uat-walkthrough` all pass) → `completed/`
**UAT lifecycle**: `pending/` → (`/uat-walkthrough` all pass) → `completed/`

---

## Naming Convention Reference

| Source | UAT File Path | Example |
|--------|--------------|---------|
| Task `.docs/tasks/active/3-user-auth.md` | `.docs/uat/pending/3-user-auth.uat.md` | Mirrors task number and slug |
| Task `.docs/tasks/active/12-api-refactor.md` | `.docs/uat/pending/12-api-refactor.uat.md` | Mirrors task number and slug |
| Freeform (matching task found) | `.docs/uat/pending/<task-number>-<task-slug>.uat.md` | Uses discovered task's naming |
| Freeform (no task) | `.docs/uat/pending/<next-number>-<derived-slug>.uat.md` | Auto-numbered, ask user to confirm slug |

The `<number>` prefix ensures UAT files sort alongside their tasks and are easy to cross-reference.

---

## Example

Given task `.docs/tasks/active/5-positions.md`, the generated UAT at `.docs/uat/pending/5-positions.uat.md`:

```markdown
# UAT: Positions Management

> **Source task**: [`.docs/tasks/active/5-positions.md`](../../tasks/active/5-positions.md)
> **Generated**: 2026-03-03

---

## Prerequisites

- [ ] Backend server running
- [ ] Database has at least one user with positions

---

## API Tests

### UAT-API-001: Create New Position
- **Endpoint**: `POST /api/v1/positions`
- **Description**: Verify new position can be created (creates data for subsequent tests)
- **Steps**:
  1. Run the curl command below as-is
- **Command**:
  ```bash
  curl -sS -X POST 'http://localhost:8000/api/v1/positions' -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{"symbol":"BTC/USD","size":0.5,"entry_price":50000}'
  ```
- **Expected Result**: `201 Created` with `{"id":"<uuid>","symbol":"BTC/USD","size":0.5,"entry_price":50000,"current_price":<number>,"pnl":<number>,"created_at":"<iso>","updated_at":"<iso>"}`
- [ ] Pass

### UAT-API-002: List All Positions
- **Endpoint**: `GET /api/v1/positions`
- **Description**: Verify positions list endpoint returns user's positions (data exists from UAT-API-001)
- **Steps**:
  1. Run the curl command below as-is
- **Command**:
  ```bash
  curl -sS -X GET 'http://localhost:8000/api/v1/positions' -H 'Authorization: Bearer <token>'
  ```
- **Expected Result**: `200 OK` with array of position objects, each containing `id`, `symbol`, `size`, `entry_price`, `current_price`, `pnl`. Array includes the position created in UAT-API-001.
- [ ] Pass
```

---

## Begin Generation

Now analyze `$ARGUMENTS` and generate comprehensive UAT test cases.
