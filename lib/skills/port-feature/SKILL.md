---
name: port-feature
description: Assess a feature or set of functionality in an external project and produce a concrete porting plan for adapting it into the current project
model: claude-opus-4-8
effort: high
argument-hint: <absolute-path-to-source-project> <functionality description>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Port Feature

Assess a specific feature or area of functionality in an external (source) project and produce a concrete, step-by-step plan for porting it into the current project. The plan accounts for differences in architecture, tech stack, conventions, and dependencies between the two codebases.

---

**Arguments**: $ARGUMENTS

---

## Phase 0: Parse Arguments & Validate

1. **Parse `$ARGUMENTS`**:
   - The **first token that is an absolute path** (starts with `/`) is the `<source-path>`
   - Everything after the path is the `<functionality>` description
   - Example: `/home/user/other-app authentication with JWT` → source path = `/home/user/other-app`, functionality = `authentication with JWT`

2. **Validate**:
   - If `<source-path>` is missing or not absolute: stop and ask the user for the absolute path to the source project
   - If `<functionality>` is empty: stop and ask the user what functionality to port
   - Confirm the source directory exists: use `mcp__serena__find_file` or Bash `ls <source-path>` to verify it is accessible

3. **Clarifying questions** (ask before proceeding if ambiguous):
   - Should the port plan produce a task file in `wiki/work/tasks/`, a report in `.docs/port/`, or both?
   - Is there a preferred output level of detail (high-level steps vs. file-by-file implementation plan)?
   - Are there any known constraints (e.g., "must stay in TypeScript", "no new dependencies")?

---

## Phase 1: Explore the Source Project

**Note**: Serena is scoped to the current project. Use `Read` and `Bash` to explore the source project at `<source-path>`. Do NOT use Serena tools on the source project's files.

### 1a. Project Overview

- Read `<source-path>/README.md` (if present) for declared purpose, setup, and architecture
- Read `<source-path>/package.json` / `<source-path>/pyproject.toml` / `<source-path>/go.mod` / `<source-path>/Cargo.toml` (whichever is present) for declared dependencies, scripts, and tech stack
- Run `ls <source-path>` and `ls <source-path>/src` (or equivalent source root) to understand the top-level structure
- Check for `CLAUDE.md`, `ARCHITECTURE.md`, `docs/`, or similar for documented design decisions

### 1b. Locate the Target Functionality

Search for the specific functionality described in `<functionality>`:

1. **Identify candidate directories and files** — look for modules, routes, services, components, or packages whose names relate to the functionality
   - Use Bash: `find <source-path> -type f -name "*.ts" | xargs grep -l "<keyword>" 2>/dev/null | head -20` (adapt extension to the detected language)
   - Navigate into the most relevant directories with `ls`
2. **Read key implementation files** — read the entry points, main logic files, interfaces/types, and any configuration for the target feature
3. **Trace data flow** — identify:
   - Entry points (API routes, CLI commands, event handlers, exported functions)
   - Core logic (services, business rules, transformations)
   - Data models / schemas / types
   - External dependencies (third-party libraries, APIs, databases, queues)
   - Configuration (env vars, config files, feature flags)
4. **Read test files** — test files often give the clearest picture of intended behaviour; find and read relevant tests

### 1c. Build a Source Feature Inventory

Produce an internal summary documenting:

```
SOURCE FEATURE: <feature name>
Language / Runtime: <language + version if visible>
Frameworks / Libraries used by this feature:
  - <lib>: <what role it plays>
Entry points:
  - <file:line> — <description>
Core files:
  - <file> — <responsibility>
Data models / types:
  - <name> — <shape and purpose>
External dependencies (infra/services):
  - <database / queue / 3rd-party API>
Configuration:
  - <env var / config key> — <purpose>
Test coverage:
  - <test file> — <what it covers>
```

---

## Phase 2: Explore the Current (Target) Project

Use Serena for all current-project exploration. Do NOT use Bash `ls`/`cat`/`find`/`grep` on the current project's code files.

### 2a. Recall Context

- `mcp__serena__list_memories` → scan for memories related to the feature area and any architectural decisions
- `mcp__serena__read_memory` on relevant memories
- Read `wiki/work/decisions/` index (if present) for accepted architectural decisions that constrain the port

### 2b. Architecture & Tech Stack

- `mcp__serena__list_dir(".", recursive=false)` — top-level shape
- `mcp__serena__list_dir("<src-root>", recursive=false)` — source structure
- Read `package.json` / equivalent for declared dependencies and scripts
- `mcp__serena__get_symbols_overview` on main source directories — identify modules, services, key interfaces

### 2c. Find Analogous Functionality

Search for anything in the current project that overlaps with or is adjacent to the feature being ported:

- `mcp__serena__find_symbol` with name patterns from the source feature inventory
- `mcp__serena__search_for_pattern` for key terms, library names, or data model names from the source
- Check `wiki/work/tasks/`, `wiki/work/requirements/`, and `wiki/work/roadmaps/` for any planned or in-progress work in this area

### 2d. Build a Target Project Profile

Produce an internal summary:

```
TARGET PROJECT PROFILE
Language / Runtime: <language + version>
Primary frameworks:
  - <framework>: <role>
Relevant existing modules:
  - <module/file> — <what it does>
Existing analogous functionality:
  - <description of overlap or adjacent features>
Conventions observed:
  - File organisation: <pattern>
  - Naming: <pattern>
  - Error handling: <pattern>
  - Testing: <pattern>
  - State management / data access: <pattern>
Existing dependencies relevant to the port:
  - <dep>: <why relevant>
Missing dependencies (source uses, target does not have):
  - <dep>: <what source uses it for>
```

---

## Phase 3: Gap Analysis & Adaptation Strategy

With both inventories in hand, perform a structured comparison.

### 3a. Technology Mapping

For each component of the source feature, determine the target equivalent:

| Source Component | Source Technology | Target Equivalent | Notes |
|------------------|-------------------|-------------------|-------|
| HTTP routing | express Router | fastify routes | pattern change needed |
| ORM | Sequelize | Prisma | schema migration required |
| Auth tokens | jsonwebtoken | jose | API differs |
| … | | | |

### 3b. Complexity Classification

Classify each source file or module by porting effort:

| File / Module | Effort | Reason |
|---------------|:------:|--------|
| `<file>` | **Direct** | Same language, same library, minimal changes |
| `<file>` | **Adapt** | Same language, different library — logic preserved, API calls change |
| `<file>` | **Rewrite** | Different patterns, framework mismatch, or significant architectural delta |
| `<file>` | **Skip** | Already exists in target / out of scope |

**Effort levels**: **Direct** (copy + light edits) · **Adapt** (rework API calls, preserve logic) · **Rewrite** (logic must be re-expressed from scratch in target conventions)

### 3c. Dependency Assessment

For each dependency the source feature uses that the target project lacks:

| Missing Dependency | Source Role | Target Option | Decision |
|--------------------|-------------|---------------|----------|
| `<lib>` | <what it does> | `<target equivalent or "add <lib>">` | Add / Replace / Avoid |

Prefer using existing target project dependencies before recommending new ones.

### 3d. Integration Points

Identify where the ported feature will need to connect with existing target code:

- **Entry points**: Where does the feature get wired in (router, DI container, main module, CLI command, etc.)?
- **Data layer**: Does the feature need new tables/collections/indexes, or can it reuse existing ones?
- **Auth / security**: Does the feature touch auth — and how does the target project handle auth today?
- **Config / env**: What new env vars or config keys are needed?
- **Tests**: What test infrastructure does the target project use (jest, pytest, go test, etc.) and how should tests be structured?

### 3e. Risks & Constraints

List risks that could complicate the port:

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| <risk> | Low/Med/High | Low/Med/High | <mitigation> |

---

## Phase 4: Produce the Port Plan

### 4a. Write the Port Plan File

Write a structured port plan to `.docs/port/<kebab-feature-name>.md`:

```markdown
---
source-project: <source-path>
feature: <feature name>
assessed: <YYYY-MM-DD>
effort: <Low / Medium / High / Very High>
status: draft
---

# Port Plan: <Feature Name>

> **Source**: `<source-path>`
> **Feature**: <functionality description>
> **Overall effort**: <Low / Medium / High / Very High>
> **Summary**: <One sentence on what this port involves.>

## Source Feature Summary

<Condensed version of the Source Feature Inventory from Phase 1c>

## Target Project Context

<Condensed version of the Target Project Profile from Phase 2d>

## Technology Mapping

<Table from 3a>

## Complexity Breakdown

<Table from 3b>

## Dependency Changes

<Table from 3c>

## Integration Points

<Bullet list from 3d>

## Risks

<Table from 3e>

## Porting Steps

Ordered, dependency-respecting steps. Each step is concrete and actionable.

### Step 1: <title>

**Effort**: <Direct / Adapt / Rewrite>
**Files affected**:
- `<target file path>` — <create / modify / delete>

**What to do**:
<Specific instructions: what to copy, what to change, how to adapt the API, what conventions to follow>

**Definition of done**: <How to know this step is complete>

---

### Step 2: <title>

… (repeat for each step)

---

## Suggested Next Actions

- To create a task from this plan: `/task-add "Port <feature name> from <source-path>" --roadmap <if applicable>`
- To explore the source further: use Read on `<most important source file>`
- If a dependency decision is needed: <frame the specific decision>
```

### 4b. Optionally Create a Task File

If the user requested a task file (or if the plan is actionable enough to execute), suggest:

```
/task-add "Port <feature name> from <source-project-name>"
```

And note what context from the port plan should be included in the task.

---

## Phase 5: Report to User

After writing the plan file:

1. State the path written: `.docs/port/<kebab-feature-name>.md`
2. Give a one-line overall effort verdict (e.g., "Medium effort — 4 files to adapt, 1 rewrite, no new dependencies required")
3. List the top 3 porting steps in brief
4. Call out the single biggest risk or blocker
5. Suggest the most useful next action (task creation, further exploration, or a specific decision to make)

---

## CRITICAL Rules

1. **Serena for the current project only** — all current-project code exploration must use Serena tools; no Bash `ls`/`cat`/`find`/`grep` on current project code files
2. **Read + Bash for the source project** — Serena cannot reach outside the current project; use `Read` and `Bash` to explore `<source-path>`
3. **No speculation** — every claim in the port plan must be grounded in what you actually read from either codebase
4. **Prefer existing dependencies** — do not recommend adding a new dependency if the target project already has something that covers the need
5. **Respect target conventions** — the port plan must describe porting the feature in the style and patterns of the target project, not a direct copy of the source
6. **Brave Search only if needed** — use Brave Search (sequential, 1 req/sec) only to compare alternative dependency options; do not use it to look up library docs (use Context7 instead)
