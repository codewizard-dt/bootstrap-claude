---
name: project-readme
description: Generate or update a portfolio-ready project README
category: executing
model: claude-sonnet-5
argument-hint: "[path to project directory (defaults to cwd)] [custom instructions to alter the output]"
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`.

Generate (or update) a **project README** structured for optimal AI parsing and portfolio presentation. The strict section format is machine-readable by AI tools that extract project metadata (name, description, architecture, technologies, use cases, skills).

## Arguments: $ARGUMENTS

`$ARGUMENTS` may hold **two kinds of input** in either order, either absent:
1. **A target path** — an existing directory (absolute/relative) = project root; absent → cwd.
2. **Custom instructions** — free-form guidance that modifies/overrides/extends the defaults (e.g. "skip Deployment, this is a library"; "emphasize the React Native side"; "casual tone in Description"; "add a Benchmarks section after Architecture").

**Parsing:** if the first whitespace token resolves to an existing directory (Serena `list_dir` / fs check), it's the target and the rest is instructions; otherwise the whole string is instructions and target = cwd. Empty → target = cwd, no instructions.

**Applying instructions:** they take precedence over skill defaults where they conflict, **except** three non-negotiables — (1) the top-level headings and their order (`# {Project Name}` → `## Description` → `## Architecture` → `## Technologies` → `## Use Cases` → `## Skills Demonstrated` → `## Deployment`); a user may *omit* a section but not rename or reorder them; (2) the Skills Terminology rules (ATS keywords, Dreyfus-implied depth) unless the user explicitly opts out; (3) accuracy — never invent technologies, components, or procedures. Ambiguous/conflicting instruction → follow defaults and note it in the end-of-run summary.

---

## 1. Discover project details

Explore thoroughly with Serena. Gather:
- **Project name** — `package.json` name, repo name, or top-level dir.
- **Short description** — one-sentence pitch (`package.json` description, existing README, or inferred).
- **Repository URL** — `package.json` repository, `.git/config`, or a URL argument.
- **Architecture** — directory structure, key files, patterns (MVC, event-driven, serverless, monorepo…). For each **major component** (services, packages, layers, workers, datastores, integrations) capture responsibility, tech, inputs/outputs, and what it talks to. Then the **overall interaction model** — request/response paths, async/event flows, scheduled jobs, and where data is persisted vs cached vs streamed. Feeds the prose + mermaid diagrams.
- **Technologies** — every language, framework, runtime, database, major library, infra tool (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, Dockerfiles, CI configs). Be exhaustive — each becomes a badge.
- **Use cases** — problems solved, target user (2-4 sentences).
- **Skills demonstrated** — inferred from the codebase (see Skills Terminology).
- **Deployment surface** — evidence of how/where it runs: Dockerfiles, `docker-compose.yml`, k8s manifests, Terraform/Pulumi/CDK, CI/CD workflows, platform configs (`vercel.json`, `netlify.toml`, `fly.toml`, `app.yaml`, `Procfile`, `render.yaml`, `railway.toml`, `.do/app.yaml`), serverless configs (`serverless.yml`, `sam.yaml`), `.env.example`, and any `DEPLOY.md`/`OPERATIONS.md`/`RUNBOOK.md`. Note required env vars, secrets, build/start commands, health checks, ports, external services.

## 2. Generate the README

Produce markdown with **exactly** these sections, in order, using these exact headings (parsed by downstream AI tools):

```markdown
# {Project Name}

{One-sentence description.}

**Repository:** {repo URL or "N/A"}

## Description
{2-3 paragraphs: what it does, why it exists, who it's for.}

## Architecture
{See required subsections below.}

## Technologies
{Bulleted list of every technology/framework/library/runtime/database/infra tool; group by category if many.}

## Use Cases
{Bulleted list or short paragraphs: problems solved, target users.}

## Skills Demonstrated
{Bulleted list of professional skills; see Skills Terminology.}

## Deployment
{Runbook; see required subsections below.}
```

### `## Architecture` subsections (in order)
Diagrams required when 2+ components; a trivial single-component project may use a one-paragraph Overview and omit diagrams.

- **### Overview** — 2-4 sentences: architectural style ("modular monolith", "event-driven microservices", "serverless JAMstack", "CLI + library"), primary runtime boundary, headline decisions (sync/async, mono/polyrepo, stateful/stateless), and one sentence on how the pieces fit.
- **### Components** — one `####` per major component (order user-facing → backend → data → external; aim 4-10, collapse trivial ones), each with:
  - **Responsibility:** {one sentence} · **Tech:** {language, framework, runtime} · **Inputs:** {routes, topics, watches, CLI args} · **Outputs:** {responses, events, files, DB tables} · **Depends on:** {other components + external services}
- **### Component Interaction** — a Mermaid `flowchart` with every component as a node and every dependency as a labelled directed edge (protocol/contract); group with `subgraph` (Client/Backend/Data/External):
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
- **### Data Flow** — a Mermaid `sequenceDiagram` for the 1-3 most important end-to-end flows; participants in chronological message order; annotate async with `Note over X: async` or dashed arrows:
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
- **### Design Decisions** — 3-6 one-sentence bullets, each a non-obvious choice + reason ("SQLite over Postgres for single-tenant simplicity"; "Workers are idempotent so the queue can retry safely"). If formal ADRs exist in `wiki/work/decisions/`, link them instead of restating.

### `## Deployment` subsections (in order; omit one only if genuinely N/A)
- **### Overview** — 1-2 sentences: target platform(s), deploy model (containerized/serverless/static/VM), manual vs CI-triggered vs GitOps.
- **### Prerequisites** — required CLIs + versions (`node >=20`, `docker`, `flyctl`, `gcloud`), account/access, DNS/domain, one-time bootstrap ("create the Postgres instance", "provision the S3 bucket").
- **### Environment Variables** — table of every required/optional var: name, required?, example/format, what it controls; call out secrets vs config. Pull from `.env.example`, config loaders, `process.env.*` / `os.environ[*]`.
  ```
  | Variable | Required | Example | Description |
  |---|---|---|---|
  | `DATABASE_URL` | yes | `postgres://user:pass@host:5432/db` | Primary DB connection string |
  ```
- **### Build** — exact ordered commands to produce a deployable artifact (build command, output location, asset steps); fenced bash.
- **### Run Locally** — exact commands to run the full stack for pre-deploy verification (`docker compose up`, seed/migration steps, URL to hit).
- **### Deploy** — numbered step-by-step per environment (staging/production); if CI/CD, name the workflow file + triggering branch/tag/event; if manual, the platform CLI command.
- **### Data & Migrations** — migration tool (Prisma migrate, Alembic, Flyway), apply command, auto-on-deploy vs manual, rollback approach, seed commands.
- **### Health Checks & Smoke Tests** — health URL + expected response, key post-deploy smoke tests.
- **### Rollback** — exact revert procedure (platform rollback, git revert + redeploy, blue/green switch); how to roll back a migration if applicable.
- **### Observability** — where logs/metrics live, alerting destinations, first dashboard/log-query URLs the on-call opens; if none, say so explicitly.
- **### Troubleshooting** — 3-6 failure modes: symptom, likely cause, first command/check ("502 on first request after deploy → cold start, check `/health` after 30s").

## 3. Skills Terminology

"Skills Demonstrated" feeds downstream tools that propose individual portfolio skills:
- **Dreyfus depth (implied, not labelled)** — write descriptions implying the right level: "Designed and optimized PostgreSQL schemas" implies Proficient+; "Used Redis for basic caching" implies Advanced Beginner. (Levels: Novice → Advanced Beginner → Competent → Proficient → Expert.)
- **ATS-friendly keywords** — job-posting phrasing: "CI/CD Pipeline Configuration" not "automated deploys"; "RESTful API Design" not "built endpoints"; "Infrastructure as Code (Terraform)" not "server setup scripts".
- **Be specific** — include the tech: "Database Schema Design (Prisma ORM + PostgreSQL)" over "database skills".

## 4. Quality checks (before writing)
- **Completeness** — every section filled; no placeholders.
- **Accuracy** — only technologies/skills evidenced in the codebase; never hallucinate.
- **Specificity** — "Next.js 15 App Router" over "React framework".
- **Length** — aim 150-350 lines (Deployment adds substantial content); enough for extraction + operation, not overwhelming.
- **Runbook honesty** — document only what's actually wired up. No CI/CD or health check → say so plainly ("No CI/CD configured; deploys are manual via `flyctl deploy`"). A skipped subsection is a one-sentence why, not silence.

## 5. Write the file
`Write` to `README.md` in the target root. If one exists, read it first, overwrite, and show a brief change summary; else create it. After writing, confirm the path and print the full content for review.

---

## Why this structure matters

Both human-readable and machine-parseable — AI portfolio tools extract structured metadata per section:

| Section | Extracted as | Purpose |
|---------|--------------|---------|
| `# {Project Name}` | Project name | Primary identifier |
| First paragraph | Short description | Elevator pitch / summary card |
| `**Repository:**` | Repo URL | Link to source |
| `## Description` | Full description | Detailed portfolio context |
| `## Architecture` | Summary + component graph + sequence flows | System-design ability; mermaid graphs render as diagrams |
| `## Technologies` | Technology list | Badges and tags |
| `## Use Cases` | Use-case summary | Real-world impact |
| `## Skills Demonstrated` | Individual skill proposals | Each bullet → a skill entry with proficiency |
| `## Deployment` | Operational runbook | On-call docs + evidence of DevOps/SRE skill |

"Skills Demonstrated" matters most — each bullet is proposed as an individual ATS-named skill, making the portfolio directly useful for job applications.
