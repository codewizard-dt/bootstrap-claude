# Task File Specification

Task files in `active/` are structured outlines designed for execution by `/tackle`.

## Naming Convention

```
<number>-<short-description>.md
```

- **number**: Sequential integer (check existing tasks across `active/`, `pending-uat/`, and `completed/` to determine next)
- **short-description**: Lowercase, hyphen-separated slug (2-4 words)

Examples: `1-auth-flow.md`, `2-api-endpoints.md`, `12-dashboard-filters.md`

## Required Structure

```markdown
# <number>. <Task Title>

**Objective:** One-sentence description of what this task accomplishes.

**Approach:** Brief summary of the technical approach or key decisions.

## Prerequisites

- [ ] Any setup or dependencies that must exist before starting

## Steps

### <Section Name>

- [ ] Step description with enough detail for an agent to implement
- [ ] Another step — include file paths, component names, or API routes where known
  - Sub-detail or acceptance criteria for this step

### <Another Section>

- [ ] More steps grouped by logical area (e.g., "Backend", "Frontend", "Tests")
```

## Rules

- Every actionable item uses `- [ ]` checkbox syntax
- Group steps under `###` section headings by logical area
- Steps should be specific enough for `/tackle` to execute without ambiguity
- Include file paths, function names, or route patterns when known
- Prerequisites go in their own section before steps
- Keep the objective to one sentence
- Keep the approach to 1-3 sentences

## Example

```markdown
# 3. Add User Profile API

**Objective:** Create REST endpoints for viewing and updating user profiles.

**Approach:** Add Express routes under `/api/profiles` with Prisma for data access. Reuse existing auth middleware.

## Prerequisites

- [ ] Database migration for `profiles` table is applied
- [ ] Auth middleware is working (see task 1)

## Steps

### Schema & Database

- [ ] Add `Profile` model to `prisma/schema.prisma` with fields: bio, avatarUrl, displayName
- [ ] Generate and run migration

### API Routes

- [ ] Create `src/routes/profiles.ts` with GET `/api/profiles/:id` endpoint
- [ ] Add PUT `/api/profiles/:id` endpoint with auth middleware
- [ ] Add input validation for profile updates (max lengths, allowed fields)

### Integration

- [ ] Register profile routes in `src/app.ts`
- [ ] Add profile link to navigation in `src/components/Nav.tsx`
```

## Lifecycle

```
active/  →  pending-uat/  →  completed/
(/tackle)   (/uat-walkthrough)
```
