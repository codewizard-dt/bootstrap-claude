# bootstrap-claude

Bootstrap new Claude Code projects with reusable slash commands, MCP server setup, structured task management, and a UAT testing system — all deployable via a single shell script or `npx` command.

**Repository:** https://github.com/codewizard-dt/basic-project-setup

## Description

`bootstrap-claude` is a project setup template and npm-distributed CLI tool that scaffolds a Claude Code workspace with everything needed for structured, AI-assisted development workflows. It installs and configures four MCP servers (Serena for semantic code intelligence, Brave Search for web research, Context7 for library documentation, and Playwright for browser automation), copies a library of 20 custom skills into the target project, and establishes a task management, UAT, and Architecture Decision Log (ADL) system under `.docs/`.

The template was built to solve a recurring pain point: every new Claude Code project requires the same tedious setup — adding MCP servers, creating task directories, defining documentation conventions, and writing skill workflows. With `bootstrap-claude`, that entire setup happens in a single `npx bootstrap-claude setup` run, including interactive API key prompts and idempotent installation checks that skip already-configured servers. It implements a full spec-driven development pipeline: Product Requirements Documents (PRDs) upstream of Architecture Decision Records (ADRs) upstream of execution tasks, with bidirectional cross-linking and immutability rules at each layer.

It is designed for developers who treat AI agents as first-class collaborators. The slash commands, task file format, and UAT system are all engineered to give Claude (and other agents) clear, unambiguous instructions — enabling reliable delegation of planning, implementation, testing, and documentation tasks. The full workflow spans requirements capture (`/prd-create`), architectural decisions (`/adr-create`), task creation (`/task-add`), implementation delegation (`/tackle`, `/now`), test generation (`/uat-generate`), interactive walkthrough (`/uat-walk`), and documentation updates (`/update-docs`).

## Architecture

The project is a **template repository** with a thin CLI wrapper for npm distribution. The `.claude/skills/` directory holds 27 Skills directory entries that Claude Code loads as custom instructions — each skill is a self-contained workflow spec with mandatory MCP tool requirements, step-by-step logic, and integration with Serena's memory system. The `.docs/` directory provides four parallel artifact lifecycles: PRDs (`.docs/prd/` — lean Product Requirements Documents; `draft → approved → archived/superseded/trashed`), tasks (`active → completed → trashed`), UAT (`pending → completed/skipped/trashed`), and ADRs (`.docs/adr/` — append-only Architecture Decision Log with per-decision supersession). Three Bash scripts (`setup-project.sh`, `update-project.sh`, `bootstrap-serena.sh`) handle initial installation, incremental syncing via `rsync`, and headless Serena project.yml bootstrapping via `claude --print`, while `bin/cli.js` wraps the top-level scripts for `npx` invocation.

## Technologies

**Runtime & Language**
- Node.js (CommonJS, `child_process`)
- Bash / Zsh (strict mode: `set -euo pipefail`)
- Markdown (commands, task specs, guides, UAT files)

**Package Management & Distribution**
- npm / npx (package distribution: `@codewizard-dt/bootstrap-claude`)
- uv (Astral Python package manager, required for Serena MCP)

**MCP Servers (Model Context Protocol)**
- Serena MCP — LSP-powered semantic code exploration, symbolic editing, and persistent project memory
- Brave Search MCP (`@modelcontextprotocol/server-brave-search`) — web research with rate limiting
- Context7 MCP (HTTP transport) — library and framework documentation lookups
- Playwright MCP (`@playwright/mcp`) — browser automation and screenshot capture for UI testing

**Tooling & Infrastructure**
- Claude Code CLI (`claude`) — AI coding assistant with custom command support
- Git + GitHub — version control and remote hosting
- rsync — non-destructive directory syncing for template updates

## Use Cases

- **Bootstrapping new Claude Code projects** — run once to install MCP servers, copy skills, and scaffold the task and UAT directory structure into any project root.
- **Structured AI-agent delegation** — use the task file format and custom commands (`/tackle`, `/now`) to delegate multi-step implementation work to Claude with clear, machine-readable instructions and agent-type annotations per step.
- **Feature validation via UAT** — generate acceptance tests with `/uat-generate` and validate them either interactively with `/uat-walk` or headlessly with `/uat-auto` (fail-closed auto-judging for orchestrator-dispatched runs), including automatic API test execution and Playwright-assisted UI diagnosis.
- **Product Requirements Documents (PRDs)** — capture *what to build and why* with `/prd-create` (Socratic Q&A elicitation), approve them with `/prd-finalize` (completeness audit), and translate requirements into architectural decisions with `/prd-extract-decisions`. The PRD layer enforces named personas, measurable success metrics, and explicit non-goals before any code decisions are made.
- **Architecture Decision Records (ADRs)** — capture significant decisions with `/adr-create`, ratify them per-decision with `/adr-finalize`. Each ADR file is a Decision Group of 1+ independently versioned decisions (`ADR-NNNN#DM`); supersession is atomic across the two affected decision blocks plus the index and relationship graph, while sibling decisions in the same file evolve independently. ADRs link back to the PRD that sourced them via `/prd-extract-decisions`.
- **Knowledge-preserving development** — Serena's memory system persists architectural decisions, gotchas, and integration patterns across sessions, so agents don't repeat mistakes or lose context between conversations.
- **Template synchronization** — run `npx bootstrap-claude update` on existing projects to pull in the latest command improvements without overwriting project-specific files.

## Skills Demonstrated

- **CLI Tool Development (Node.js)** — Authored an npm-distributed CLI that wraps shell scripts with argument dispatch, path resolution, and cross-platform child process execution.
- **Bash Scripting & Shell Automation** — Wrote idempotent setup scripts with strict error handling (`set -euo pipefail`), interactive API key prompts, environment variable fallbacks, and graceful dependency checks for `claude` and `uv`.
- **AI Agent Workflow Design** — Designed a complete AI-assisted development loop: task creation → implementation delegation → UAT generation → interactive walkthrough → completion tracking, with agent-type annotations for subagent dispatch.
- **Model Context Protocol (MCP) Integration** — Orchestrated four MCP servers across global and per-project scopes, enforcing mandatory tool usage patterns and preventing suboptimal fallbacks via a comprehensive MCP tools guide.
- **Technical Documentation & Specification Writing** — Produced thousands of lines of precise, machine-readable command specifications covering tool requirements, step logic, error handling, and output formats across 20 custom slash commands.
- **Spec-Driven Development Pipeline** — Implemented a full requirements → decisions → implementation pipeline: PRDs (product requirements, `what & why`) flow into ADRs (architectural decisions, `how & why`) which flow into tasks (implementation, `what changes`), with bidirectional cross-linking and immutability enforced at each layer.
- **Architecture Decision Record (ADR) System Design** — Built a multi-decision-per-file ADR framework on top of MADR 4.0 + Nygard, with per-decision identifiers (`ADR-NNNN#DM`), E-C-A-D-R Definition of Done, atomic two-block supersession, and a relationship graph kept in sync across the index and a mermaid-rendered chain.
- **Task Lifecycle Management** — Designed and implemented a three-stage task management system (`active` → `completed` → `trashed`) with structured file formats, cross-linked UAT references, and agent-executable step definitions.
- **User Acceptance Testing (UAT) Framework Design** — Built a custom UAT system supporting API auto-execution, batched UI testing, Playwright-assisted visual diagnosis, per-test pass/fail/fix workflows, and parallel pending/completed/skipped tracking.
- **npm Package Authoring & Distribution** — Configured `package.json` with `bin`, `files`, and repository fields; packaged and published to the npm registry under a scoped namespace (`@codewizard-dt/bootstrap-claude`).
- **Knowledge Management System Design** — Structured Serena memory hierarchies (topic `/` subtopic convention) for persistent, session-spanning project knowledge retrieval with topic-filtered recall.
- **Template & Scaffolding System Architecture** — Designed a reusable, rsync-based template distribution system that supports both initial setup and incremental updates without destructive overwrites.
