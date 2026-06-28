---
name: extract-feature
description: Analyze a feature in the current project and produce a SOLID-compliant standalone module extraction plan with interfaces for all dependencies; output is compatible with /port-feature
category: planning
model: claude-opus-4-8
effort: high
argument-hint: <feature name or description>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Extract Feature

Analyze a specific feature or area of functionality in the **current project**, design a SOLID-compliant standalone module for it, and produce a concrete extraction plan. Every dependency (database, HTTP client, config, internal services, event bus) is replaced with an interface contract, so the extracted module can be plugged into any host project and its adapters swapped independently.

The output document is formatted to be a valid "source project" for `/port-feature` — once the module is extracted, another team can port it into their project using `/port-feature <extracted-module-path> <feature-name>` without any reformatting.

---

**Arguments**: $ARGUMENTS

---

## Phase 0: Parse Arguments & Validate

1. **Parse `$ARGUMENTS`**:
   - Everything in `$ARGUMENTS` is the `<feature>` description — free-form name or description of the feature to extract
   - Examples: `user authentication`, `email notification service`, `report generation`, `payment processing`

2. **Validate**:
   - If `<feature>` is empty or too vague to locate in code: stop and ask the user for a more specific description
   - The description must be specific enough to search for in the codebase (service names, module names, domain concepts)

3. **Clarifying questions** — ask before proceeding if any are ambiguous:
   - **Output location**: Should the extracted module live as a subdirectory within this project (e.g., `packages/<module-name>/`) or as a stub for a new standalone repo? (Default: subdirectory)
   - **Constraints**: Any hard constraints — must stay in the same language, no new dependencies, must preserve the current public API for backward compatibility?
   - **Supplementary output**: Should this skill also create a task file in `wiki/work/tasks/` to track the actual extraction work? (Default: yes, suggest it)

---

## Phase 1: Research

Run the `/research` workflow before touching the codebase. The goal is to arrive at Phase 2 armed with the right vocabulary, patterns, and interface design options for this feature type.

**Research topics to cover** (combine into one `/research` invocation):

1. **Modularization patterns** for this feature type (e.g., "authentication module SOLID design patterns", "notification service hexagonal architecture")
2. **Interface design** for the dependency categories the feature likely uses:
   - Data access / repository pattern for the detected language/framework
   - External HTTP client abstraction patterns
   - Configuration injection patterns (env-based vs config-object)
   - Event/message bus decoupling if the feature emits or consumes events
3. **Packaging conventions** for the detected language (e.g., TypeScript `package.json` `exports` field, Python `pyproject.toml` `packages`, Go module layout)
4. **Library documentation** (via Context7): query docs for any key third-party libraries the feature uses, specifically their interface/adapter extension points

Use the research findings as the lens for all architectural decisions in Phase 4. Do not proceed without completing this research phase.

---

## Phase 2: Discover the Feature in the Codebase

**CRITICAL**: Use Serena for ALL current-project code exploration. No `bash ls`, `cat`, `find`, `grep`, or `Read` on code files.

### 2a. Recall Context

- `mcp__serena__list_memories` → scan for memories related to the feature area (use `topic` filter)
- `mcp__serena__read_memory` on any relevant memories for architectural constraints, known coupling issues, or prior extraction attempts
- Check `wiki/work/decisions/` for accepted decisions that constrain how this feature may be restructured

### 2b. Locate the Feature

Search for all code related to `<feature>`:

1. **Symbol search**: `mcp__serena__find_symbol` with name patterns derived from the feature description (e.g., for "auth": `AuthService`, `authenticate`, `AuthMiddleware`, `JwtStrategy`)
2. **Directory overview**: `mcp__serena__get_symbols_overview` on the most likely directories (e.g., `src/auth/`, `src/services/`, `lib/`)
3. **Pattern search**: `mcp__serena__search_for_pattern` for import paths, config key names, and env var references
4. **Reference tracing**: `mcp__serena__find_referencing_symbols` on all discovered entry-point symbols to map every caller

### 2c. Trace Data Flow

For each discovered entry point, trace:

- **Inbound**: Who calls this (controllers, CLI, event consumers, tests)?
- **Outbound**: What does it call (DB queries, external HTTP, other services, config reads)?
- **Data models**: What types/schemas/interfaces flow through the feature?
- **Side effects**: Events emitted, files written, queues published to, metrics recorded?

### 2d. Map Coupling Points

Classify every dependency the feature touches:

| Dependency | File / Symbol | Category | Notes |
|------------|--------------|----------|-------|
| `UserRepository` | `src/db/user.repo.ts` | `infra` (DB) | Direct Prisma/Sequelize calls |
| `MailerService` | `src/mailer/mailer.service.ts` | `internal-coupling` | Feature imports this directly |
| `process.env.JWT_SECRET` | scattered | `config` | Read inline, not injected |
| `fetch` / `axios` | `src/auth/oauth.ts` | `direct-external` | Third-party HTTP |

Categories:
- **`infra`** — database, cache, queue, storage (must become a repository/store interface)
- **`direct-external`** — third-party library calls inlined in feature logic (must become an adapter interface)
- **`internal-coupling`** — other modules in this project the feature imports (must become interfaces or be absorbed into the module)
- **`config`** — env vars and config reads (must become an injected config interface)
- **`framework`** — router decorators, DI container bindings, middleware (must be documented as wiring requirements, not core logic)

---

## Phase 3: Build Source Feature Inventory

Produce the Source Feature Inventory in the exact format `/port-feature` Phase 1c expects, so the extracted module is immediately usable as a port source:

```
SOURCE FEATURE: <feature name>
Language / Runtime: <language + version>
Frameworks / Libraries used by this feature:
  - <lib>: <role>
Entry points:
  - <file:line> — <description>
Core files:
  - <file> — <responsibility>
Data models / types:
  - <name> — <shape and purpose>
External dependencies (infra/services):
  - <infra item> — <how it's used>
Internal coupling (must become interfaces):
  - <module/file> — <what the feature takes from it>
Configuration:
  - <env var / config key> — <purpose>
Test coverage:
  - <test file> — <what it covers>
```

The **Internal coupling** section is the critical addition over the standard `/port-feature` inventory — these are the coupling points that **must** become interface contracts.

---

## Phase 4: Design Extraction Architecture

With the coupling map from Phase 2d and the research from Phase 1, design the standalone module.

### 4a. Interface Specification

For **every** `infra`, `direct-external`, `internal-coupling`, and `config` dependency, produce an interface contract:

| Dependency | Current Form | Interface Name | Required Methods / Fields | Adapter Strategy | Notes |
|------------|-------------|----------------|--------------------------|-----------------|-------|
| `UserRepository` | Prisma client | `IUserRepository` | `findById(id)`, `save(user)` | Thin Prisma adapter in `adapters/` | Keep in module |
| `MailerService` | Injected service | `IMailer` | `send(to, subject, body)` | Adapter in host project | Don't bundle host dep |
| `process.env.JWT_SECRET` | Inline read | `AuthConfig` | `{ jwtSecret: string, ttl: number }` | Config object injected at construction | — |

**SOLID enforcement rules**:
- **SRP**: One interface per concern — no combining "user repo + mailer" into one interface
- **OCP**: Core logic must reference only interface types; if adding a new adapter doesn't require touching `core/`, it's open/closed
- **LSP**: Every interface method must be implementable by any reasonable adapter (no leaky concrete details in the interface signature)
- **ISP**: If a consumer only needs 2 of 5 repository methods, split into a focused read-interface and write-interface
- **DIP**: `core/` imports from `interfaces/` only — never from `adapters/` or host project modules

### 4b. Proposed Module Structure

```
<kebab-feature-name>/
  src/
    core/           # pure domain logic — imports only from interfaces/ and language stdlib
    interfaces/     # TypeScript interfaces / Python ABCs / Go interfaces — zero implementation
    adapters/       # optional concrete implementations bundled with the module
    index.ts        # public API: exports factory function(s) that accept interface implementations
  tests/
    unit/           # tests against core/ with mock adapters
    integration/    # optional — tests against real adapters
  README.md         # Source Feature Inventory (this exact document) — port-feature reads this
  package.json      # (or pyproject.toml / go.mod / Cargo.toml)
```

`index.ts` example signature:
```ts
export function createFeature(deps: {
  userRepo: IUserRepository;
  mailer: IMailer;
  config: FeatureConfig;
}): FeaturePublicAPI { ... }
```

### 4c. Technology Mapping

For each current implementation pattern, state the equivalent in the extracted module:

| Current Pattern | Current File | Module Equivalent | Adaptation Required |
|----------------|-------------|------------------|---------------------|
| `@Injectable()` class | `auth.service.ts` | Plain class constructor | Remove DI decorator |
| Prisma `this.prisma.user.findUnique` | `user.repo.ts` | `IUserRepository.findById` | Wrap in thin adapter |
| `process.env.JWT_SECRET` | inline | `AuthConfig.jwtSecret` | Pass config at construction |

---

## Phase 5: Gap Analysis

Before extraction is safe, identify what must change:

### 5a. Current-Project Changes After Extraction

- Which files in the current project will need to update their imports to point to the new module path?
- Which DI container registrations / wiring files need updating?
- Which config files or env var docs need updating?

### 5b. Missing Test Coverage

List any behavior that lacks tests and must be covered before the feature can be safely extracted (extraction without tests = no safety net during the refactor):

| Behavior | Currently tested? | Risk if untested |
|----------|-------------------|-----------------|
| <behavior> | No | High — could break silently during adapter swap |

### 5c. Complexity Classification

Classify each source file by porting effort:

| File | Effort | Reason |
|------|:------:|--------|
| `<file>` | **Direct** | Pure logic, no framework coupling — copy as-is |
| `<file>` | **Adapt** | Framework decorator must be removed; logic preserved |
| `<file>` | **Rewrite** | Tightly coupled; must be expressed as interface + adapter |
| `<file>` | **Skip** | Already framework-only wiring — lives in host project |

---

## Phase 6: Write the Extraction Plan

### 6a. Write the Plan File

Write to `.docs/extract/<kebab-feature-name>.md`:

```markdown
---
feature: <feature name>
extracted-from: <absolute path of current project>
assessed: <YYYY-MM-DD>
effort: <Low / Medium / High / Very High>
status: draft
solid-compliant: true
proposed-module-path: <packages/<module-name> OR external repo name>
---

# Extraction Plan: <Feature Name>

> **Feature**: <feature description>
> **Extracted from**: `<absolute project path>`
> **Proposed module**: `<module path>`
> **Overall effort**: <Low / Medium / High / Very High>
> **Summary**: <One sentence on what this extraction involves.>

## Source Feature Inventory

<Phase 3 inventory — this section is read by /port-feature when this module is the source>

## Coupling Analysis

<Phase 2d coupling map table>

## Interface Specifications

<Phase 4a interface table>

## Proposed Module Structure

<Phase 4b directory tree with annotations>

## Technology Mapping

<Phase 4c table>

## Complexity Breakdown

<Phase 5c table>

## Gap Analysis

<Phase 5a current-project changes + 5b missing test coverage>

## Extraction Steps

Ordered, dependency-respecting steps. Each step is concrete and actionable.

### Step 1: <title>

**Effort**: <Direct / Adapt / Rewrite>
**Files affected**:
- `<source file>` — extract to `<target file>` (create / move / refactor)

**What to do**:
<Specific instructions: what to move, what to strip, what interface to introduce, what adapter to write>

**Definition of done**: <How to know this step is complete — tests pass, imports resolve, no references to old path>

---

### Step 2: <title>

… (repeat for each step)

---

## Suggested Next Actions

- To create a task from this plan: `/task-add "Extract <feature name> into standalone module"`
- To port this module into another project after extraction: `/port-feature <proposed-module-path> <feature name>`
- If an interface decision is still open: <frame the specific decision clearly>
```

### 6b. Optionally Create a Task File

If the user requested a task file (or the plan is concrete enough to execute immediately):

```
/task-add "Extract <feature name> into standalone module"
```

Include the extraction plan path as context in the task.

---

## Phase 7: Report to User

After writing the plan file:

1. State the path written: `.docs/extract/<kebab-feature-name>.md`
2. Give a one-line effort verdict (e.g., "High effort — 3 interfaces to design, 2 rewrites, 1 missing test suite")
3. List the top 3 extraction steps in brief
4. Call out the single biggest coupling risk or blocker
5. Suggest the most useful next action (task creation, interface decision to make, or `/port-feature` handoff)

---

## CRITICAL Rules

1. **Serena for the current project only** — all current-project code exploration must use Serena tools; no Bash `ls`/`cat`/`find`/`grep` on current project code files
2. **Research first** — Phase 1 (`/research`) must complete before Phase 4 interface design; never design interfaces from intuition alone
3. **No speculation** — every coupling point listed must be grounded in what you actually read from the codebase (Serena tool results), not assumed
4. **Interfaces for everything** — every `infra`, `direct-external`, `internal-coupling`, and `config` dependency must have a corresponding interface in the plan; none may be left as a concrete import in the extracted module's `core/`
5. **SOLID enforced** — each SOLID principle (SRP, OCP, LSP, ISP, DIP) must be explicitly addressed in Phase 4a; call out any violations with a mitigation
6. **port-feature compatibility** — Phase 3 inventory must match exactly the format `/port-feature` Phase 1c expects; the `.docs/extract/` document must be usable as a "source project" spec
7. **Brave Search rate limit** — 50 requests/second, parallel searches allowed (applies during Phase 1 research)
8. **Maximum 3 concurrent sub-processes** at a time
9. **Always terminate all processes when done** (dev servers, type checkers, long-running commands)
