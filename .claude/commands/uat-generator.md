---
description: Generate User Acceptance Tests for a feature or documentation file
argument-hint: <path/to/task-file.md or feature description>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**


# UAT Generator

Generate comprehensive User Acceptance Tests (UAT) for a feature, writing them to `.docs/uat/pending/`.

---

**Target**: $ARGUMENTS

---

## Instructions

### Step 1: Determine the Source and Derive the UAT File Path

Parse `$ARGUMENTS` to determine the source and output file:

1. **If a task file path is provided** (e.g., `.docs/tasks/pending-uat/3-user-auth.md`):
   - Read the task file
   - Extract the feature requirements and scope
   - Derive UAT filename from the task filename: `3-user-auth.md` → `.docs/uat/pending/3-user-auth.uat.md`

2. **If a feature description is provided** (e.g., "user authentication"):
   - Search `.docs/tasks/pending-uat/` for a matching task file (also check `active/` as a fallback)
   - If a matching task is found, use its naming: `.docs/uat/pending/<number>-<slug>.uat.md`
   - If no matching task exists, ask the user:
     - Should a task be created first via `/add-task`?
     - Or assign a standalone UAT number and slug: `.docs/uat/pending/<next-number>-<slug>.uat.md`
   - To determine `<next-number>`, scan existing files in `.docs/uat/pending/`, `.docs/uat/completed/`, `.docs/tasks/active/`, and `.docs/tasks/pending-uat/` for the highest number

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

### Step 3: Generate UAT Test Cases

Create a UAT file structured as a **`/tackle`-compatible outline** with `- [ ]` checkboxes.

The file MUST follow this structure:

```markdown
# UAT: [Feature Name]

> **Source task**: [`.docs/tasks/pending-uat/<number>-<slug>.md`](relative-link) (or "Standalone" if no task)
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
  2. [Include exact curl command or request details]
- **Expected Result**: [What success looks like]
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
- The `Source task` header links back to the originating task file (typically in `pending-uat/`)
- Section separators (`---`) match the outline format `/tackle` expects

### Step 4: Test Case Guidelines

When generating tests, ensure:

1. **Completeness**:
   - Cover all API endpoints (CRUD operations)
   - Cover all UI pages and interactions
   - Include error scenarios (400, 404, 500 errors)
   - Include validation edge cases

2. **Specificity**:
   - Provide exact curl commands with sample data
   - Include specific URLs and routes
   - Specify exact expected response structures
   - Include sample request/response bodies

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

### Step 5: Write UAT File and Cross-Reference

1. **Write the UAT file** to `.docs/uat/pending/<number>-<slug>.uat.md`

2. **Update the source task file** (if one exists, typically in `.docs/tasks/pending-uat/`):
   - Append a reference at the bottom of the task file:
     ```markdown
     ---
     **UAT**: [`.docs/uat/pending/<number>-<slug>.uat.md`](../../uat/pending/<number>-<slug>.uat.md)
     ```
   - If the task already has a UAT reference, update it

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
├── active/           # Tasks being implemented via /tackle
├── pending-uat/      # Implementation complete, awaiting UAT testing
└── completed/        # UAT passed, task fully complete
```

**Task lifecycle**: `active/` → (`/tackle` completes) → `pending-uat/` → (`/uat-walkthrough` all pass) → `completed/`
**UAT lifecycle**: `pending/` → (`/uat-walkthrough` all pass) → `completed/`

---

## Naming Convention Reference

| Source | UAT File Path | Example |
|--------|--------------|---------|
| Task `.docs/tasks/pending-uat/3-user-auth.md` | `.docs/uat/pending/3-user-auth.uat.md` | Mirrors task number and slug |
| Task `.docs/tasks/pending-uat/12-api-refactor.md` | `.docs/uat/pending/12-api-refactor.uat.md` | Mirrors task number and slug |
| Freeform (matching task found) | `.docs/uat/pending/<task-number>-<task-slug>.uat.md` | Uses discovered task's naming |
| Freeform (no task) | `.docs/uat/pending/<next-number>-<derived-slug>.uat.md` | Auto-numbered, ask user to confirm slug |

The `<number>` prefix ensures UAT files sort alongside their tasks and are easy to cross-reference.

---

## Example

Given task `.docs/tasks/pending-uat/5-positions.md`, the generated UAT at `.docs/uat/pending/5-positions.uat.md`:

```markdown
# UAT: Positions Management

> **Source task**: [`.docs/tasks/pending-uat/5-positions.md`](../../tasks/pending-uat/5-positions.md)
> **Generated**: 2026-03-03

---

## Prerequisites

- [ ] Backend server running
- [ ] Database has at least one user with positions

---

## API Tests

### UAT-API-001: List All Positions
- **Endpoint**: `GET /api/v1/positions`
- **Description**: Verify positions list endpoint returns user's positions
- **Steps**:
  1. Execute: `curl -X GET 'http://localhost:8000/api/v1/positions' -H 'Authorization: Bearer <token>'`
- **Expected Result**: 200 OK with array of position objects containing id, symbol, size, entry_price, current_price, pnl
- [ ] Pass

### UAT-API-002: Create New Position
- **Endpoint**: `POST /api/v1/positions`
- **Description**: Verify new position can be created
- **Steps**:
  1. Execute: `curl -X POST 'http://localhost:8000/api/v1/positions' -H 'Content-Type: application/json' -d '{"symbol": "BTC/USD", "size": 0.5, "entry_price": 50000}'`
- **Expected Result**: 201 Created with position object including generated id and timestamps
- [ ] Pass
```

---

## Begin Generation

Now analyze `$ARGUMENTS` and generate comprehensive UAT test cases.
