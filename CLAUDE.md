# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is a **project setup template** for Claude Code, structured as an **LLM Wiki** (see `raw/llm-wiki.md`). It contains reusable configurations (custom skills, hooks, prompt templates) and MCP server setup instructions meant to be copied into other project repositories. It is not a standalone application.

## Wiki Schema

This repo follows the three-layer LLM Wiki pattern described in `raw/llm-wiki.md`.

**`raw/`** — Immutable ground-truth documents. The LLM reads these but **never** modifies, moves, or deletes them. Contains: `llm-wiki.md` (pattern spec), `design-principles.md` (engineering principles), `house-style/` (design system snapshot), `guides/` (MCP tool reference and anti-patterns guide — source copies that get synced to `.docs/guides/` in target projects).

**`wiki/`** — LLM-maintained knowledge base. The LLM owns this layer entirely. It is split into **two domains with opposite organizing laws** — `knowledge/` (timeless, link-navigated) and `work/` (stateful, status-navigated):

- `wiki/index.md` — page catalog and home Map of Content (`- [Title](path) — one-line summary` per page, sectioned Knowledge / Work). Read this first on every query. Updated on every ingest and every filed answer.
- `wiki/log.md` — append-only operation log (`## [YYYY-MM-DD] <op> | <subject>` + 1-3 sentences). Never edit existing entries.
- `wiki/conventions.md` — the rules every page follows: atomic pages, stable IDs/aliases, typed links, and the reserved frontmatter namespace (see Conventions below).

**`wiki/knowledge/`** — timeless synthesis, organized by links not status. Pages are revised in place as understanding evolves; no `status` field.

- `wiki/knowledge/sources/` — one summary page per ingested raw source (frontmatter: `title`, `updated`, `sources` back-links to `../../../raw/`)
- `wiki/knowledge/concepts/` — patterns, ideas, conventions, recurring themes
- `wiki/knowledge/entities/{people,organisations,tools,components}/` — one page per entity, filed by sub-type (`components/` holds this repo's own skills, hooks, scripts)

**`wiki/work/`** — stateful lifecycle artifacts, organized by status. Files are **never moved** after creation; state lives in the `status:` frontmatter field; each family has a `lifecycle.md` defining its schema and valid transitions, and an `index.md` listing **only active items** (completed/terminal items are removed from the index, not the file system).

- `wiki/work/requirements/` — requirements / PRDs (REQ-NNN)
- `wiki/work/decisions/` — architecture decision records (DEC-NNNN, per-decision `#DM`)
- `wiki/work/roadmaps/` — execution-plan roadmaps (ROADMAP-NNN)
- `wiki/work/tasks/` — task files (TASK-NNN)
- `wiki/work/uat/` — UAT files (UAT-NNN), one per task — **own family, not nested inside tasks/**
- `wiki/work/bugs/` — bug reports (BUG-NNNN)

### Conventions

Every page obeys [`wiki/conventions.md`](wiki/conventions.md). The load-bearing rules: **atomic pages** (one concept/entity per file — the one expensive-to-retrofit rule), **stable IDs/aliases** (link by ID/alias, not raw path), **typed links** (`rel::[[target]]` inline — e.g. `implements::`, `supersedes::`, `derived_from::`; declared now, backfilled later), and a **reserved frontmatter namespace** (`confidence`, `tier`, `last_verified`, `supersedes`, `superseded_by`, `scope` are reserved for later overlays and ignored until used). These keep the wiki navigable and let heavier overlays be added later as zero-migration add-ons.

**Schema** — this file (CLAUDE.md). Tells the LLM how the wiki is structured and what rules govern it.

### Wiki operations

| Command | Purpose |
|---------|---------|
| `/wiki-ingest <raw-file>` | Process a source from `raw/` into the wiki — summary page, entity/concept page updates, index + log entry; one source per invocation |
| `/wiki-query <question>` | Answer from the wiki with citations; offer to file valuable synthesis back as a new page |
| `/wiki-lint` | Health-check — contradictions, orphan pages, stale claims, missing cross-references, never-ingested raw sources |

### CRITICAL wiki rules

1. `raw/` is immutable — never create, modify, move, or delete files under `raw/`
2. Cross-link aggressively — related pages link to each other with relative markdown links; the link network is as valuable as the pages
3. Index and log updates are mandatory — every ingest and every filed answer must update both `wiki/index.md` and `wiki/log.md`
4. Flag contradictions explicitly — when a new source conflicts with an existing page, add a `> **Contradiction:**` callout citing both; never silently overwrite
5. Answer from the wiki, not general knowledge — if the wiki lacks coverage, say so and suggest `/wiki-ingest` for relevant sources
6. Atomic pages — one concept, entity, or artifact per file; split a page rather than let it cover two things (the one expensive-to-retrofit rule)
7. Typed links — when a link has a meaning, annotate it inline as `rel::[[target]]` (e.g. `implements::[[REQ-012]]`, `supersedes::[[DEC-0003#D2]]`); plain `[[links]]` remain valid. Keep the two domains separate: never file a stateful artifact under `knowledge/` or a timeless synthesis under `work/`

## Setup Workflow

Follow the root `README.md` to configure a new project, or use the npm package:

- `npx @codewizard-dt/bootstrap setup` — runs `lib/scripts/setup-project.sh` (installs hooks and skills globally, syncs wiki scaffold + `.docs/guides/` scaffold, scaffolds CI/CD via `setup-deployment.sh`, bootstraps Serena)
- `npx @codewizard-dt/bootstrap update` — runs `lib/scripts/update-project.sh` (installs hooks and skills globally, syncs wiki scaffold + `.docs/guides/` scaffold; does NOT touch `.github/` workflows)
- `npx @codewizard-dt/bootstrap install` — runs `lib/scripts/install-global.sh` (installs/updates MCPs, hooks, and skills globally without a project path)
- `npx @codewizard-dt/bootstrap deploy` — runs `lib/scripts/setup-deployment.sh` (scaffolds `.github/` workflows + `.gitleaks.toml` into the project; copy-once so existing workflows are preserved)
- `npx @codewizard-dt/bootstrap typechecks [languages]` — runs `lib/scripts/setup-strict-typechecks.sh` (strict type-checking setup via Claude)

**Manual setup steps:**

1. **Serena MCP** — code exploration, editing, and memory (per-project — run from the project root): `claude mcp add --scope project serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"` (writes `.mcp.json`; gitignored — machine-local)
2. **Brave Search MCP** — web search (rate limit: 1 req/sec, sequential only)
3. **Context7 MCP** — library documentation lookups
4. **Install MCPs and skills globally** — run `./lib/scripts/install-global.sh` (or `npx @codewizard-dt/bootstrap install`) to configure Brave/Context7/Playwright MCPs and copy skills to `~/.claude/skills/`

## Custom Commands

| Command | Purpose |
|---------|---------|
| `/wiki-ingest <raw-file>` | Process a source from `raw/` into the wiki — summary page, entity/concept updates, index + log entries |
| `/wiki-query <question>` | Answer a question from the wiki with citations; optionally file the answer back as a new wiki page |
| `/wiki-lint` | Health-check the wiki — contradictions, orphans, stale claims, missing cross-references, never-ingested sources |
| `/primer` | Refresh codebase context via Serena memories |
| `/serena-config` | Interactively configure Serena language servers in `.serena/project.yml` |
| `/research <topic>` | Deep research using codebase analysis, library docs, and web search |
| `/research-company <name> [URL]` | Comprehensive company research — mission, operations, leadership, financials, and ~5 years of news |
| `/company-align [slug]` | Analyse project–company fit against researched context in `.docs/company-context/`; writes `alignment.md` with gaps, strengths, and talking points |
| `/now <task>` | Plan and delegate task to subagents (max 3 concurrent) |
| `/tackle <path>` | Execute outlined task file step-by-step with subagent delegation |
| `/task-add <desc>` | Create structured task in `wiki/work/tasks/`. Optional flags: `--decision DEC-NNNN#DM` (auto-link to an accepted decision); `--roadmap ROADMAP-NNN` (auto-append the new task to a roadmap) |
| `/roadmap-create <topic>` | Create an execution-plan roadmap in `wiki/work/roadmaps/` via short Socratic Q&A — captures goal, phases, and a hybrid (task-link OR inline) checklist |
| `/roadmap-add <ROADMAP-NNN> <item>` | Append a new item (task link or inline) to an existing roadmap, optionally under a named phase |
| `/roadmap-next [file]` | Read-only — point at the first unchecked item in a specific roadmap, or surface the next 3 unchecked items across all roadmaps when no file is given |
| `/req-create <idea>` | Create a lean requirement in `wiki/work/requirements/` via Socratic Q&A capturing problem, personas, user stories, success metrics, and non-goals |
| `/req-finalize <file>` | Run completeness audit on a draft requirement, resolve gaps via Q&A, and flip `status` from `draft` to `approved` |
| `/req-extract-decisions <file>` | Extract Architecturally Significant Requirements from an approved requirement, cross-check existing decisions, and propose Decision Group candidates for `/decision-create` |
| `/req-update <file> [change]` | Amend an approved requirement with an append-only Amendment block; apply direct edits to drafts; surface downstream decision/task impact |
| `/req-compile <file>` | Compile a requirement into a running, self-verifying system — routes every claim to its cheapest re-runnable check |
| `/decision-create <topic>` | Create a Decision Group file in `wiki/work/decisions/` containing 1+ proposed decisions; per-decision tags/status; table-only comparisons; mermaid flowcharts |
| `/decision-finalize <file>#<DM>` | Finalize a single proposed decision (e.g. `0001-wiki-model#D2`); per-decision E-C-A-D-R audit; per-decision supersession check; siblings remain untouched |
| `/decision-walkthrough <file>` | Walk a Decision Group file decision-by-decision, presenting each architecture choice and confirming it with the user via Q&A; light edits only (no status flips) |
| `/decision-next [file or NNNN]` | Read-only — find the first accepted decision with no task reference and suggest `/task-add` |
| `/task-audit [--mermaid] [--json]` | Generate a dependency graph of active tasks in `wiki/work/tasks/`, show execution waves (parallelisable groups), and flag stale references or missing dependency blocks |
| `/task-trash <path>` | Flip task (and matching UAT) `status: trashed`; remove from family indexes; record reason; clean roadmap/decision references — no file deletion |
| `/task-update <path> <changes>` | Modify an existing task's scope or steps |
| `/uat-generate <target>` | Generate UAT tests in `wiki/work/uat/` (own family) mirroring task naming conventions |
| `/uat-walk <path>` | Interactively walk through a pending UAT file test-by-test with the user |
| `/uat-auto <path>` | Non-interactively run every test in a pending UAT file and auto-judge verdicts (headless, fail-closed) |
| `/uat-auto-plus <path>` | Autonomous-fix variant of `/uat-auto`: diagnoses failures, applies fixes itself, re-runs until green or attempts are exhausted (intended for `--dangerously-skip-permissions` agents) |
| `/uat-skip <path>` | Skip UAT for a task — flip UAT `status: skipped` and task `status: done`; remove from family indexes |
| `/bug-file <description>` | File a new bug in `wiki/work/bugs/` with required-on-report fields and update `wiki/work/bugs/index.md` |
| `/bug-triage <BUG-NNNN>` | Triage an open bug (priority, assignee, tags, impact) and decide its next destination: stay triaged, start work (→ `status: in-progress`), or trash (wontfix / duplicate / cannot-reproduce) |
| `/bug-close <BUG-NNNN>` | Close an in-progress bug — requires root-cause analysis, fix commit, and a regression test before setting `status: closed` |
| `/eval-create [stage] [description]` | Assess eval coverage against the 5-stage framework and create new evals with mandatory user approval. Bootstrap mode (no golden sets yet) enforces strictly 1 eval at a time. Pass a description to jump directly to creating that eval. |
| `/eval-run [stage]` | Execute the eval suite (golden sets, scenarios, replays), report pass/fail per case, diff against baseline, and surface regressions |
| `/eval-gap [stage]` | Read-only audit of eval coverage — gap report, coverage matrix, anti-pattern check, and prioritised next actions. Never writes files. |
| `/security-audit [category\|full\|internal\|external]` | Audit LLM/AI integration across 11 categories (5 internal: observability, rate-limiting, access-controls, hitl-policy, benchmarking; 6 external: prompt-injection, data-leakage, output-sanitization, excessive-agency, supply-chain, token-dos). Run a single category, a group, or the full audit. |
| `/lint` | Get IDE diagnostics, fix issues one-by-one in verify cycles |
| `/typecheck` | Detect type-checking tools (typecheck/tsc/mypy/pyright/go vet/cargo check/etc.), run each one, and only invoke `/git-commit` if all pass |
| `/debug-logs [symptom]` | Diagnose failures by inspecting session context, background processes, and conventional log stores; produce ranked hypotheses with next actions (read-only) |
| `/port-feature <source-path> <functionality>` | Assess a feature in an external project and produce a concrete porting plan (technology mapping, complexity breakdown, ordered steps) targeting the current project's conventions |
| `/simplify <path>` | Analyze files/directories to remove redundancy and simplify complexity |
| `/demo [path] [custom instructions]` | Audit all project functionality and produce a 2-3 minute demo run book and Marp slideshow |
| `/gap-assess <expected functionality>` | Runs in plan mode — audit the app's actual functionality against expected functionality and deliver a Covered/Partial/Gap/Undocumented coverage report plus a remediation plan for approval |
| `/marp-slideshow <input> [output]` | Summarize a source file into a Marp/Marpit slide deck following best practices |
| `/mermaid-flowchart <input> [output]` | Summarize an architecture file (markdown, YAML, Docker Compose) into a Mermaid flowchart in a new markdown file |
| `/git-commit` | Stage all changes and commit with auto-generated message |
| `/update-docs` | Update all project documentation after implementation work |

## MCP Tool Requirements

When these MCPs are configured in a target project, they are **mandatory** for their respective operations:

- **Serena**: All code exploration (`find_symbol`, `get_symbols_overview`), code editing (`replace_symbol_body`, `replace_content`), file search (`find_file`, `list_dir`), and project memory
- **Context7**: All library/framework documentation lookups (replaces WebSearch for docs)
- **Brave Search**: General web research (must be sequential, 1 request/second)

Standard Read/Edit/Write tools are permitted for markdown and config files (JSON, YAML, `.env`, etc.). Code files must use Serena. **All file/directory exploration must use Serena tools** (`list_dir`, `find_file`, `search_for_pattern`) — never use `bash` commands like `ls`, `cat`, `find`, `grep`, or `sed`, regardless of file type. See `raw/guides/mcp-tools.md` (source) or `.docs/guides/mcp-tools.md` (synced copy in target projects).

## Key Files

- `raw/llm-wiki.md` — The LLM Wiki pattern spec; foundational reference for all wiki operations
- `raw/design-principles.md` — Engineering principles: the mandate, KISS, DRY, SOLID, YAGNI, boundary essentials
- `raw/house-style/` — Design system snapshot
- `raw/guides/` — Source guides (mcp-tools.md, command-anti-patterns.md, deployment-strategy.md, evals-framework.md, task-spec.md, type-checking-templates/) — always-refreshed to `.docs/guides/` in target projects by `sync-wiki-scaffold.sh`
- `wiki/index.md` — Page catalog and home Map of Content (sectioned Knowledge / Work); read first on every wiki query; updated on every ingest and filed answer
- `wiki/log.md` — Append-only operation log; last entry shows when the wiki was last touched
- `wiki/conventions.md` — Rules every page follows: atomic pages, stable IDs/aliases, typed links (`rel::[[target]]`), reserved frontmatter namespace, two-domain rule
- `wiki/work/decisions/lifecycle.md` — Lifecycle spec for decisions (DEC-NNNN IDs; `status: proposed | accepted | superseded`)
- `wiki/work/tasks/lifecycle.md` — Lifecycle spec for tasks (TASK-NNN IDs; `status: todo | in-progress | done | trashed`)
- `wiki/work/uat/lifecycle.md` — Lifecycle spec for UAT (UAT-NNN IDs — own family, not nested in tasks/; `status: pending | in-progress | passed | failed | skipped | trashed`)
- `wiki/work/bugs/lifecycle.md` — Lifecycle spec for bugs (BUG-NNNN IDs; `status: open | triaged | in-progress | closed | wontfix | duplicate | cannot-reproduce`)
- `wiki/work/requirements/lifecycle.md` — Lifecycle spec for requirements (REQ-NNN IDs; `status: draft | approved | retired`)
- `wiki/work/roadmaps/lifecycle.md` — Lifecycle spec for roadmaps (ROADMAP-NNN IDs; `status: active | done`)
- `README.md` — Root usage and architecture documentation: how to use the repo, 4-layer architecture diagrams, design decisions, publishing, troubleshooting
- `lib/skills/` — All custom skill definitions (in Skills directory format); installed globally to `~/.claude/skills/` by `lib/scripts/install-global.sh`
- `lib/hooks/` — Project-managed hook scripts; installed globally to `~/.claude/hooks/` by `lib/scripts/install-global.sh`. See `lib/hooks/README.md` for what each hook does and the required `~/.claude/settings.json` `PreToolUse` wiring (the install script copies scripts but does NOT register them in global settings — wiring is a one-time manual step)
- `lib/prompts/` — Claude prompt templates for setup scripts. `setup-deployment.md` drives `setup-deployment.sh`; `setup-strict-typechecks.md` drives `setup-strict-typechecks.sh`. Edit these to change what Claude scaffolds — the scripts are just thin wrappers that read, interpolate, and invoke
- `lib/scripts/install-global.sh` — Installs/updates MCPs, hooks, and skills globally so they are available across all projects; called by both setup and update scripts
- `lib/scripts/setup-project.sh` — Set up a new project: installs MCPs and skills globally, syncs wiki scaffold + `.docs/guides/` scaffold, scaffolds CI/CD, bootstraps Serena `project.yml`
- `lib/scripts/update-project.sh` — Install MCPs and skills globally and sync the wiki scaffold + `.docs/guides/` scaffold into a target project (re-runs `bootstrap-serena.sh` idempotently)
- `lib/scripts/sync-wiki-scaffold.sh` — Scaffolds an EMPTY wiki into target projects: creates `raw/` + `wiki/` with all family directories, lifecycle docs, per-family active-item `index.md`, and stub index/log from `lib/scripts/templates/wiki/`. Copy-once for project-owned files; always-refreshes `conventions.md` and `lifecycle.md` files. Called by both setup and update scripts.
- `lib/scripts/setup-deployment.sh` — Deployment/CI scaffolding. Copies `.github/` workflows + `.gitleaks.toml` into a project. Called once by `setup-project.sh`; **never** by `update-project.sh`. Copy-once: `security.yml` always overwritten (generic), `build.yml` + `.gitleaks.toml` skipped if present.
- `lib/scripts/bootstrap-serena.sh` — Headlessly triggers `.serena/project.yml` creation via `claude --print` and enables 11 optional Serena tools; called by both setup and update scripts
- `bin/cli.js` — CLI entry point for the npm package
- `package.json` — npm package configuration with bin and files fields
