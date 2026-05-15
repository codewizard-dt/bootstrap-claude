---
name: project-readme
description: Generate or update a portfolio-ready project README
model: claude-sonnet-4-6
argument-hint: "[path to project directory (defaults to cwd)] [custom instructions to alter the output]"
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

Generate (or update) a **project README** structured for optimal AI parsing and portfolio presentation. The output follows a strict section format designed to be machine-readable by AI tools that extract project metadata (name, description, architecture, technologies, use cases, and skills).

## Arguments: $ARGUMENTS

`$ARGUMENTS` may contain **two kinds of input**, in either order, and either may be absent:

1. **A target path** — an existing directory (absolute or relative). If present, treat it as the project root. If absent, use the current working directory.
2. **Custom instructions** — free-form natural-language guidance that modifies, overrides, or extends the default behavior described below. Examples:
   - "skip the Deployment section, this is a library"
   - "emphasize the React Native side over the backend"
   - "use a more casual tone in the Description"
   - "add a Benchmarks section after Architecture"
   - "this is a take-home assignment, keep Skills Demonstrated brief"

### How to parse `$ARGUMENTS`

- If the first whitespace-delimited token resolves to an existing directory (use Serena `list_dir` or a filesystem check), treat that token as the target path and the rest as custom instructions.
- Otherwise, treat the entire string as custom instructions and default the target to the current working directory.
- If `$ARGUMENTS` is empty: target = cwd, custom instructions = none.

### How to apply custom instructions

Custom instructions take **precedence over the defaults in this skill** wherever they conflict, with three exceptions that are non-negotiable:

1. The top-level section headings and their order (`# {Project Name}` → `## Description` → `## Architecture` → `## Technologies` → `## Use Cases` → `## Skills Demonstrated` → `## Deployment`) — these are parsed by downstream AI tools and must remain stable. A user may ask to *omit* a section, but not to rename or reorder them.
2. The "Skills Terminology" rules (ATS-friendly keywords, Dreyfus-implied depth) — these exist for portfolio extraction and should not be relaxed unless the user explicitly opts out.
3. Accuracy — never invent technologies, components, or procedures to satisfy a custom instruction.

If a custom instruction is ambiguous or conflicts with these non-negotiables, follow the skill defaults and note the conflict in your end-of-run summary to the user.

---

## Instructions

### 1. Discover project details

Explore the target project thoroughly using Serena MCP tools. Gather:

- **Project name** — from `package.json` name field, repo name, or top-level directory name.
- **Short description** — one-sentence elevator pitch. Pull from `package.json` description, existing README, or infer from the code.
- **Repository URL** — from `package.json` repository field, `.git/config`, or the argument if a URL was provided.
- **Architecture** — analyze the directory structure, key files, and design patterns (MVC, event-driven, serverless, monorepo, etc.). Identify the **major components** (services, packages, layers, workers, datastores, external integrations) and for each one capture: its responsibility, the technology it's built on, its inputs/outputs, and the other components it talks to. Then capture the **overall interaction model** — request/response paths, async/event flows, scheduled jobs, and where data is persisted vs. cached vs. streamed. This feeds both the prose summary and the mermaid diagrams in the Architecture section.
- **Technologies** — enumerate every language, framework, runtime, database, major library/package, and infrastructure tool used. Check `package.json` dependencies, `requirements.txt`, `go.mod`, `Cargo.toml`, Dockerfiles, CI configs, etc. Be exhaustive — each technology becomes a badge in the portfolio.
- **Use cases** — what problems does this project solve? Who is the target user? Summarize in 2-4 sentences.
- **Skills demonstrated** — infer professional skills from the codebase (see "Skills Terminology" below for formatting rules).
- **Deployment surface** — inspect for evidence of how/where this project runs in production. Check for: Dockerfiles, `docker-compose.yml`, Kubernetes manifests (`k8s/`, `*.yaml` with `kind:`), Terraform/Pulumi/CDK, CI/CD workflows (`.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`), platform configs (`vercel.json`, `netlify.toml`, `fly.toml`, `app.yaml`, `Procfile`, `render.yaml`, `railway.toml`, `.do/app.yaml`), serverless configs (`serverless.yml`, `sam.yaml`), env files (`.env.example`), and any `DEPLOY.md` / `OPERATIONS.md` / `RUNBOOK.md`. Note required env vars, secrets, build commands, start commands, health checks, ports, and external services (databases, queues, object storage).

### 2. Generate the README

Produce a complete markdown README with **exactly** these sections in this order. Use these exact headings — they are parsed by AI tools that map each section to structured project metadata:

```markdown
# {Project Name}

{One-sentence description.}

**Repository:** {repo URL or "N/A"}

## Description

{2-3 paragraph expanded description covering what the project does, why it exists, and who it's for.}

## Architecture

{Expanded multi-part architecture section. See "Architecture Structure" below for the required subsections.}

## Technologies

{Bulleted list of every technology, framework, library, runtime, database, and infrastructure tool. Group by category if there are many.}

## Use Cases

{Bulleted list or short paragraphs describing the problems solved and target users.}

## Skills Demonstrated

{Bulleted list of professional skills demonstrated by building this project. See "Skills Terminology" below.}

## Deployment

{Comprehensive runbook for deploying and operating this project. See "Deployment Runbook" below for the required subsection structure.}
```

The `## Architecture` section MUST contain these subsections in order. Diagrams are required when there are 2+ components; for trivial single-component projects, a one-paragraph Overview is sufficient and the diagrams can be omitted.

```markdown
## Architecture

### Overview

{2-4 sentences naming the architectural style (e.g., "modular monolith", "event-driven microservices", "serverless JAMstack", "CLI + library"), the primary runtime boundary, and the headline design decisions (sync vs async, monorepo vs polyrepo, stateful vs stateless, etc.). End with one sentence on how the pieces fit together at a glance.}

### Components

{For each major component, a `####` subsection with: one-sentence responsibility, technology/runtime, key inputs, key outputs, and which other components it depends on. Order components from user-facing → backend → data → external. Aim for 4-10 components; collapse trivial ones.}

#### {Component Name}

- **Responsibility:** {one sentence}
- **Tech:** {language, framework, runtime}
- **Inputs:** {HTTP routes, queue topics, file watches, CLI args, etc.}
- **Outputs:** {responses, events emitted, files written, DB tables touched}
- **Depends on:** {other components in this list, plus external services}

### Component Interaction

{Mermaid `flowchart` diagram showing every component as a node and every dependency as a directed edge. Label edges with the protocol or contract ("HTTP/JSON", "gRPC", "publishes to topic X", "reads from table Y"). Group related nodes with `subgraph` blocks (e.g., "Client", "Backend", "Data", "External").}

```mermaid
flowchart LR
  subgraph Client
    UI[Web UI<br/>Next.js]
  end
  subgraph Backend
    API[REST API<br/>FastAPI]
    Worker[Background Worker<br/>Celery]
  end
  subgraph Data
    DB[(PostgreSQL)]
    Cache[(Redis)]
  end
  UI -->|HTTP/JSON| API
  API -->|SQL| DB
  API -->|cache read/write| Cache
  API -->|enqueue| Worker
  Worker -->|SQL| DB
```

### Data Flow

{Mermaid `sequenceDiagram` for the 1-3 most important end-to-end flows (e.g., "user submits a form", "scheduled ingest job", "webhook arrives"). Show actors/components as participants and order messages chronologically. If async, annotate with `Note over X: async` or use dashed arrows.}

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Web UI
  participant API as REST API
  participant Q as Queue
  participant W as Worker
  participant DB as PostgreSQL
  U->>UI: submit form
  UI->>API: POST /things
  API->>DB: INSERT thing (status=pending)
  API->>Q: enqueue process(thing_id)
  API-->>UI: 202 Accepted
  W->>Q: dequeue
  W->>DB: UPDATE thing (status=done)
```

### Design Decisions

{3-6 bullets, each one sentence, naming a non-obvious choice and the reason for it. Examples: "Chose SQLite over Postgres for single-tenant simplicity"; "Workers are idempotent so the queue can retry safely"; "Auth uses signed cookies, not JWTs, to keep revocation cheap". If there are formal ADRs in `.docs/adr/`, link them here instead of restating.}
```

The `## Deployment` section MUST contain these subsections in order (omit a subsection only if it is genuinely not applicable — e.g., no database means no "Data & Migrations" subsection):

```markdown
## Deployment

### Overview

{1-2 sentences: target platform(s), deploy model (containerized / serverless / static / VM), and whether deploys are manual, CI-triggered, or GitOps.}

### Prerequisites

{Bulleted list: required CLIs and versions (e.g., `node >=20`, `docker`, `flyctl`, `gcloud`), account/access requirements, DNS or domain setup, and any one-time bootstrap (e.g., "create the Postgres instance", "provision the S3 bucket").}

### Environment Variables

{Table of every required and optional env var with: name, required/optional, example value or format, and what it controls. Pull names from `.env.example`, config loaders, and `process.env.*` / `os.environ[*]` references in the code. Call out which are secrets vs. plain config.}

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/db` | Primary database connection string |

### Build

{Exact commands to produce a deployable artifact, in order. Include the build command, output location, and any asset/static steps. Use fenced bash blocks.}

### Run Locally

{Exact commands to run the full stack locally for verification before deploy. Include any `docker compose up`, seed/migration steps, and the URL to hit.}

### Deploy

{Step-by-step deploy procedure. Number the steps. For each environment (staging/production), give the exact command or CI trigger. If CI/CD is configured, name the workflow file and the branch/tag/event that triggers it. If manual, give the platform CLI command.}

### Data & Migrations

{How schema changes ship: migration tool (Prisma migrate, Alembic, Flyway, etc.), command to apply, whether migrations run automatically on deploy or must be run manually, and rollback approach. Include seed-data commands if any.}

### Health Checks & Smoke Tests

{Endpoints or commands to verify a successful deploy: health-check URL, expected response, key smoke tests to run post-deploy.}

### Rollback

{Exact procedure to revert a bad deploy: platform rollback command, git revert + redeploy, or blue/green switch. Include how to roll back a migration if applicable.}

### Observability

{Where logs go, where metrics live, alerting destinations, and the dashboard/log-query URLs the on-call would open first. If none configured, say so explicitly.}

### Troubleshooting

{3-6 common failure modes with the symptom, likely cause, and the first command/check to run. Examples: "502 on first request after deploy → cold start, check `/health` after 30s"; "migration step fails → check `DATABASE_URL` has the right role".}
```

### 3. Skills Terminology

The "Skills Demonstrated" section is used by downstream AI tools to propose individual skills to a portfolio. To produce the best results:

- **Use Dreyfus proficiency language** — when describing depth of experience, frame skills at the appropriate level:
  - *Novice*: basic awareness, can follow instructions
  - *Advanced Beginner*: can apply in familiar contexts
  - *Competent*: independent problem-solving, solid working knowledge
  - *Proficient*: deep understanding, can mentor others
  - *Expert*: authoritative, pushes the field forward
  You do NOT need to label each skill with a level — but write descriptions that imply the appropriate depth (e.g., "Designed and optimized PostgreSQL schemas" implies Proficient+, while "Used Redis for basic caching" implies Advanced Beginner).

- **Use ATS-friendly keywords** — write skill names the way they appear on job postings and applicant tracking systems. Prefer industry-standard terms:
  - "CI/CD Pipeline Configuration" not "automated deploys"
  - "RESTful API Design" not "built endpoints"
  - "Infrastructure as Code (Terraform)" not "server setup scripts"
  - "Real-time Data Streaming (WebSockets/SSE)" not "live updates"

- **Be specific** — include the technology in the skill name when relevant: "Database Schema Design (Prisma ORM + PostgreSQL)" is better than "database skills".

### 4. Quality checks

Before writing the final README:

- **Completeness**: Every section must be filled. Do not leave any section empty or with placeholder text.
- **Accuracy**: Only include technologies and skills actually evidenced in the codebase. Do not hallucinate packages or frameworks not present.
- **Specificity**: Prefer "Next.js 15 App Router" over "React framework". Prefer "SQLite schema design with Prisma ORM" over "database skills".
- **Length**: Aim for 150-350 lines (the Deployment runbook adds substantial content). Enough detail for AI extraction and operational use, but not so long it overwhelms.
- **Runbook honesty**: For the Deployment section, only document what is actually wired up in the repo. If there is no CI/CD, no health check, no observability — say so plainly ("No CI/CD configured; deploys are manual via `flyctl deploy`") rather than inventing a procedure. A skipped subsection should be a single sentence explaining why, not silence.

### 5. Write the file

- **Write** the generated README to `README.md` in the target project's root directory.
- If a `README.md` already exists, read it first, then overwrite it with the new content. Show the user a brief summary of what changed.
- If no `README.md` exists, create it.
- After writing, confirm the file path and print the full content so the user can review it.

---

## Why this structure matters

This README format is designed to be **both human-readable and machine-parseable**. AI portfolio tools consume READMEs and extract structured metadata from them. Each section maps to a specific field:

| README Section | Extracted As | Purpose |
|---|---|---|
| `# {Project Name}` | Project name | Primary identifier |
| First paragraph | Short description | Elevator pitch / summary card |
| `**Repository:**` line | Repo URL | Link to source code |
| `## Description` | Full description | Detailed context for the portfolio entry |
| `## Architecture` | Architecture summary + component graph + sequence flows | Shows system design ability; the mermaid graphs are extracted as renderable diagrams |
| `## Technologies` | Technology list | Generates technology badges and tags |
| `## Use Cases` | Use case summary | Explains real-world impact and relevance |
| `## Skills Demonstrated` | Individual skill proposals | Each bullet becomes a separate skill entry with proficiency level |
| `## Deployment` | Operational runbook | Doubles as on-call documentation and as evidence of DevOps/SRE skill for portfolio extraction |

The "Skills Demonstrated" section is especially important — each bullet is proposed as an individual skill with ATS-compatible naming, making the portfolio directly useful for job applications and resume building.
