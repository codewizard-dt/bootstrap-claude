**IMPORTANT**
- You are never allowed to read or write to any `.env` file. The only exception is `.env.example`.
- You are, however, allowed to source an `.env` file to use the variables in the command line.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is a **project setup template** for Claude Code, structured as an **LLM Wiki** (see `raw/llm-wiki.md`). It contains reusable configurations (custom skills, hooks, prompt templates) and MCP server setup instructions meant to be copied into other project repositories. It is not a standalone application.

## Wiki Schema

This repo follows the three-layer LLM Wiki pattern described in `raw/llm-wiki.md`.

**`raw/`** — Immutable ground-truth documents. The LLM reads these but **never** modifies, moves, or deletes them. Contains: `llm-wiki.md` (pattern spec), `design-principles.md` (engineering principles), `house-style/` (design system snapshot), `guides/` (source guides delivered tier-wise to `wiki/guides/` in target projects — see Key Files).

**`wiki/`** — LLM-maintained knowledge base. The LLM owns this layer entirely. It is split into **two domains with opposite organizing laws** — `knowledge/` (timeless, link-navigated) and `work/` (stateful, status-navigated):

- `wiki/index.md` — page catalog and home Map of Content (`- [Title](path) — one-line summary` per page, sectioned Knowledge / Work). Read this first on every query. Updated on every ingest and every filed answer.
- `wiki/log.md` — append-only operation log (`## [YYYY-MM-DD] <op> | <subject>` + 1-3 sentences). Never edit existing entries.
- `wiki/conventions.md` — the rules every page follows: atomic pages, stable IDs/aliases, typed links, and the reserved frontmatter namespace (see Conventions below).

**`wiki/knowledge/`** — timeless synthesis, organized by links not status. Pages are revised in place as understanding evolves; no `status` field.

- `wiki/knowledge/sources/` — one summary page per ingested raw source (frontmatter: `title`, `updated`, `sources` back-links to `../../../raw/`)
- `wiki/knowledge/concepts/` — patterns, ideas, conventions, recurring themes
- `wiki/knowledge/entities/{people,organisations,tools,components}/` — one page per entity, filed by sub-type (`components/` holds this repo's own skills, hooks, scripts)

**`wiki/work/`** — stateful lifecycle artifacts, organized by status. Active files are **never moved** after creation; state lives in the `status:` frontmatter field; each family has a `lifecycle.md` defining its schema and valid transitions, an `index.md` listing **only active items**, and an `archive/` subdirectory for terminal items. Terminal items may be moved to `archive/` by `/wiki-archive` — safe because links use stable IDs, not paths.

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
| `/wiki-archive [family]` | Batch-move terminal work items into `<family>/archive/`; update `archive/index.md` and log the operation. Omit family to see a summary count across all families |
| `/wiki-rotate-log` | Rotate `wiki/log.md` to a timestamped archive file (`log-YYYY_MM_DD_HHMMSS.md`) when it exceeds ~500 lines; create a fresh `log.md` with an archive-pointer header |
| `/wiki-tidy` | One-shot cleanup — lint, archive terminal items across all families, then rotate log if overgrown; phases run in sequence with user confirmation |

### CRITICAL wiki rules

1. `raw/` is immutable — never create, modify, move, or delete files under `raw/`. **Exceptions (write-only landing zones):** `raw/companies/` is owned by `/research-company` and `/company-align`, and `raw/research/` is owned by `/research`. These skills may *write* new files into their own landing zone, but **must never overwrite or edit an existing `raw/` file** — if a write would clobber a file that already exists, they create the next free numeric sibling instead (`<name>-2.md`, `-3.md`, …), and that `-N` file carries only non-redundant new/changed data with a cross-reference to the prior file. Everything else under `raw/` stays read-only
2. Cross-link aggressively — related pages link to each other with relative markdown links; the link network is as valuable as the pages
3. Index and log updates are mandatory — every ingest and every filed answer must update both `wiki/index.md` and `wiki/log.md`
4. Flag contradictions explicitly — when a new source conflicts with an existing page, add a `> **Contradiction:**` callout citing both; never silently overwrite
5. Answer from the wiki, not general knowledge — if the wiki lacks coverage, say so and suggest `/wiki-ingest` for relevant sources
6. Atomic pages — one concept, entity, or artifact per file; split a page rather than let it cover two things (the one expensive-to-retrofit rule)
7. Typed links — when a link has a meaning, annotate it inline as `rel::[[target]]` (e.g. `implements::[[REQ-012]]`, `supersedes::[[DEC-0003#D2]]`); plain `[[links]]` remain valid. Keep the two domains separate: never file a stateful artifact under `knowledge/` or a timeless synthesis under `work/`

## Setup Workflow

Follow the root `README.md` to configure a new project, or use the npm package:

- `npx @codewizard-dt/bootstrap setup` — runs `lib/scripts/setup-project.sh` (installs hooks and skills globally and merges the canonical deny list + hook wiring into `~/.claude/settings.json` first via `install-global.sh --skip-mcps`, then runs the interactive MCP install — guarded, a failure warns and continues — syncs wiki scaffold + tiered `wiki/guides/` (required guide always refreshed; optional guides prompted), bootstraps Serena; does NOT set up deployment)
- `npx @codewizard-dt/bootstrap update` — runs `lib/scripts/update-project.sh` (installs hooks and skills globally and merges the canonical deny list + hook wiring into `~/.claude/settings.json` first via `install-global.sh --skip-mcps`, then the guarded interactive MCP install, syncs wiki scaffold + tiered `wiki/guides/`; does NOT touch `.github/` workflows)
- `npx @codewizard-dt/bootstrap install` — runs `lib/scripts/install-global.sh` (installs hooks and skills globally without a project path, merges the canonical permission deny list from `lib/scripts/templates/settings-deny.json` and the canonical hook wiring from `lib/scripts/templates/settings-hooks.json` into `~/.claude/settings.json`, then installs/updates MCPs last — guarded so a failure warns instead of aborting the local installs; `--skip-mcps` skips them)
- `npx @codewizard-dt/bootstrap deploy` — runs `lib/scripts/setup-deployment.sh` (scaffolds `.github/` workflows + `.gitleaks.toml` into the project and copies `deployment-strategy.md` into its `wiki/guides/`; copy-once so existing workflows are preserved)
- `npx @codewizard-dt/bootstrap migrate [--dry-run]` — runs `lib/scripts/migrate-project.sh` (Claude-driven migration of a legacy `.docs/` project to the wiki structure; requires a clean git tree, runs on a fresh `wiki-migration` branch, `git mv` preserves history; assembles `wiki/guides/mcp-tools.md` for the detected MCPs)
- `npx @codewizard-dt/bootstrap typechecks [languages]` — runs `lib/scripts/setup-strict-typechecks.sh` (strict type-checking setup via Claude)
- `npx @codewizard-dt/bootstrap dashboard [port]` — runs `lib/scripts/wiki-dashboard-server.js` (zero-dependency Node server that serves the live `wiki/work/` dashboard read-only over HTTP; foreground until Ctrl-C; default `http://localhost:4317`, override with a port arg e.g. `dashboard 4400`, auto-falls back to the next free port if taken)

**Manual setup steps:**

1. **Serena MCP** — code exploration, editing, and memory (per-project — run from the project root): `claude mcp add --scope local serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"` (local scope — stored in `~/.claude.json` under this project's entry; machine-local, never the repo's shareable `.mcp.json`, which would leak a machine-specific absolute path to teammates)
2. **Brave Search MCP** — web search (up to 50 req/sec, parallel searches allowed). Installed by step 5 as a shared local Docker container (`brave-search-mcp`, image `mcp/brave-search`) serving HTTP at `http://127.0.0.1:8941/mcp`; the API key is baked into the container env (not `~/.claude.json`) and the server is registered at user scope
3. **Context7 MCP** — library documentation lookups
4. **Playwright MCP** — browser automation, registered as **`playwright`** (user scope). When a project already ships its own `playwright` registration, setup resolves the conflict interactively: a git-tracked `.mcp.json` is never modified (options: register ours as **`playwright-shared`** and disable the project entry machine-locally via `disabledMcpjsonServers` in `.claude/settings.local.json`, register alongside, or skip); a machine-local registration can be replaced or kept (ours then registers as `playwright-shared`). On macOS, installed by step 5 as a shared HTTP server at `http://localhost:8931/mcp`, run by a launchd LaunchAgent (`com.bootstrap-claude.playwright-mcp`) in the GUI session so headed browsers work; each Claude session gets an isolated browser context. On other platforms it registers a per-session stdio server (`npx @playwright/mcp`)
5. **Install hooks, skills, and MCPs globally** — run `./lib/scripts/install-global.sh` (or `npx @codewizard-dt/bootstrap install`) to install hooks and skills to `~/.claude/hooks/` and `~/.claude/skills/`, merge the deny list + hook wiring into `~/.claude/settings.json`, and then configure the Brave/Context7/Playwright MCPs (MCPs run last and are non-fatal on failure)

## Custom Commands

| Command | Purpose |
|---------|---------|
| `/wiki-ingest <raw-file>` | Process a source from `raw/` into the wiki — summary page, entity/concept updates, index + log entries |
| `/wiki-query <question>` | Answer a question from the wiki with citations; optionally file the answer back as a new wiki page |
| `/wiki-lint` | Health-check the wiki — contradictions, orphans, stale claims, missing cross-references, never-ingested sources |
| `/wiki-archive [family]` | Batch-move terminal work items into `<family>/archive/`; update `archive/index.md` and log the operation. Omit family to see a count summary across all families |
| `/wiki-rotate-log` | Rotate `wiki/log.md` to a timestamped archive file (`log-YYYY_MM_DD_HHMMSS.md`) when it exceeds ~500 lines; create a fresh `log.md` with an archive-pointer header |
| `/wiki-tidy` | One-shot cleanup — lint, archive terminal items across all families, then rotate log if overgrown; phases run in sequence with user confirmation |
| `/primer` | Refresh codebase context via Serena memories |
| `/serena-config` | Interactively configure Serena language servers in `.serena/project.yml` |
| `/research <topic>` | Deep research using codebase analysis, library docs, and web search |
| `/research-company <name> [URL]` | Comprehensive company research — mission, operations, leadership, financials, and ~5 years of news |
| `/company-align [slug]` | Analyse project–company fit against researched context in `raw/companies/<slug>/`; writes `alignment.md` with gaps, strengths, and talking points |
| `/now <task>` | Plan and delegate task to subagents (max 3 concurrent) |
| `/tackle <path>` | Execute outlined task file step-by-step with subagent delegation |
| `/task-add <desc>` | Create structured task in `wiki/work/tasks/`. Optional flags: `--decision DEC-NNNN#DM` (auto-link to an accepted decision); `--roadmap ROADMAP-NNN` (auto-append the new task to a roadmap) |
| `/roadmap-create <topic>` | Create an execution-plan roadmap in `wiki/work/roadmaps/` via short Socratic Q&A — captures goal, phases, and a hybrid (task-link OR inline) checklist |
| `/roadmap-add <ROADMAP-NNN> <item>` | Append a new item (task link or inline) to an existing roadmap, optionally under a named phase |
| `/roadmap-next [file]` | Point at the first unchecked item(s) in a roadmap grouped into parallelizable waves; flips completed roadmaps to `status: done` and prompts `/wiki-archive` |
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
| `/flashcard <file1> [file2 ...] [-- <what's important>]` | Extract key information from markdown/research files and generate a self-contained interactive flashcard HTML page styled with the house-style design system |
| `/git-commit` | Stage all changes and commit with auto-generated message |
| `/update-docs` | Update all project documentation after implementation work |
| `/frontend-taste` | Wire the house-style design system (`~/code/house-style`) into the current project — copies tokens, Tailwind preset, component patterns, and base CSS layer; loads Inter Tight |

## MCP Tool Requirements

When these MCPs are configured in a target project, they are **mandatory** for their respective operations:

- **Serena**: All code exploration (`find_symbol`, `get_symbols_overview`), code editing (`replace_symbol_body`, `replace_content`), file search (`find_file`, `list_dir`), and project memory
- **Context7**: All library/framework documentation lookups (replaces WebSearch for docs)
- **Brave Search**: General web research (up to 50 requests/second, parallel searches allowed)

Standard Read/Edit/Write tools are permitted for markdown and config files (JSON, YAML, `.env`, etc.). Code files must use Serena. **All file/directory exploration must use Serena tools** (`list_dir`, `find_file`, `search_for_pattern`) — never use `bash` commands like `ls`, `cat`, `find`, `grep`, or `sed`, regardless of file type. See `wiki/guides/mcp-tools.md` (assembled per-project from `lib/scripts/templates/guides/stubs/` by `build-mcp-guide.sh`).

## Key Files

- `raw/llm-wiki.md` — The LLM Wiki pattern spec; foundational reference for all wiki operations
- `raw/design-principles.md` — Engineering principles: the mandate, KISS, DRY, SOLID, YAGNI, boundary essentials
- `raw/house-style/` — Design system snapshot
- **npm packaging note:** `package.json` `files` ships `raw/` because consumers need `llm-wiki.md`, `design-principles.md`, `guides/`, and `house-style/`. It then negates `raw/research/`, `raw/companies/`, and `raw/*.pdf` — the `/research` and `/research-company` landing zones are project-internal and would otherwise grow the published tarball on every report (they were 24 files / ~276 kB before this was added). Keep the negations when adding new `raw/` landing zones.
- `raw/guides/` — Source guides delivered tier-wise to `wiki/guides/` in target projects by `sync-wiki-scaffold.sh`: `command-anti-patterns.md` (required, always refreshed); `evals-framework.md` and `type-checking-templates/` (optional, interactive opt-in — sticky once present); `deployment-strategy.md` (delivered only by `deploy`). `mcp-tools.md` is assembled per-project by `build-mcp-guide.sh` from `lib/scripts/templates/guides/stubs/`
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
- `lib/hooks/` — Project-managed hook scripts; installed globally to `~/.claude/hooks/` by `lib/scripts/install-global.sh`. Three groups: safety/policy hooks (`env-file-guard.js`, `git-protected-ops-block.js`, `mv-absolute-path-block.js`), **command-class guards** that gate invocation forms a deny rule cannot express — `interpreter-indirection-guard.js`, `package-install-consent.js`, `absolute-path-guard.js`, `protected-write-guard.js`, `claude-settings-guard.js`, `env-content-read-guard.js`, sharing `lib/hooks/lib/command-parse.js` — and the Serena-first enforcement hooks ported from `claude-code-lsp-enforcement-kit`. See `lib/hooks/README.md` for what each hook blocks, its known false positives and escape hatches, and the `~/.claude/settings.json` wiring — registered automatically by `install-global.sh` via `merge-settings-hooks.js` merging `lib/scripts/templates/settings-hooks.json`, so copying the scripts and wiring them are one step, repeated idempotently on every `install`/`setup`/`update`. Each guard's matcher is load-bearing (the wrong one makes a hook silently inert), which is why the template is the single source of truth
- `lib/prompts/` — Claude prompt templates for setup scripts. `setup-deployment.md` drives `setup-deployment.sh`; `setup-strict-typechecks.md` drives `setup-strict-typechecks.sh`. Edit these to change what Claude scaffolds — the scripts are just thin wrappers that read, interpolate, and invoke
- `lib/scripts/install-global.sh` — Installs/updates hooks, skills, and MCPs globally so they are available across all projects. Local steps run first: hooks + skills install, then the canonical permission deny-list merge (`lib/scripts/templates/settings-deny.json`, via `lib/scripts/merge-settings-deny.js`) into `~/.claude/settings.json` — `Bash(...)` command patterns plus `Edit(...)`/`Read(...)` file-tool patterns — then the canonical hook-wiring merge (`lib/scripts/templates/settings-hooks.json`, via `lib/scripts/merge-settings-hooks.js`; "template owns its blocks" — user entries never modified or removed; prints a restart-your-session reminder when the wiring was created or changed). Also copies `lib/scripts/templates/file-suggestion.sh` to `~/.claude/file-suggestion.sh` and merges the `fileSuggestion` settings key (`merge-settings-deny.js --set-key` mode) so `@`-autocomplete sees the `.git/info/exclude`'d wiki dirs again; a pre-existing different `fileSuggestion` is warned about and left alone. MCPs install last, guarded so a failure warns instead of aborting; `--skip-mcps` skips them. Called by both setup and update scripts (as `install-global.sh --skip-mcps`)
- `lib/scripts/setup-project.sh` — Set up a new project: installs hooks/skills/settings globally first (via `install-global.sh --skip-mcps`), then runs the guarded interactive MCP install, syncs wiki scaffold + tiered `wiki/guides/`, bootstraps Serena `project.yml`; deployment setup is explicit via `deploy`
- `lib/scripts/update-project.sh` — Install hooks/skills/settings globally first (via `install-global.sh --skip-mcps`), then run the guarded interactive MCP install and sync the wiki scaffold + tiered `wiki/guides/` into a target project (re-runs `bootstrap-serena.sh` idempotently)
- `lib/scripts/sync-wiki-scaffold.sh` — Scaffolds an EMPTY wiki into target projects: creates `raw/` + `wiki/` with all family directories, lifecycle docs, per-family active-item `index.md`, and stub index/log from `lib/scripts/templates/wiki/`. Copy-once for project-owned files; always-refreshes `conventions.md` and `lifecycle.md` files. Delivers guides tier-wise into `wiki/guides/` (required always refreshed; optional prompted via `--interactive`, sticky once present) and migrates legacy `.docs/guides/` contents (template-owned files removed or relocated; empty dirs pruned; deprecated `task-spec.md` deleted). Delivers the wiki-schema section (copy-once, sentinel `## LLM Wiki`, template at `lib/scripts/templates/CLAUDE-wiki.md`) and the `.env` safety policy (copy-once, sentinel line, template at `lib/scripts/templates/CLAUDE-env-safety.md`) into the target's `CLAUDE.md` — or, when a `CLAUDE.md` already exists without the schema, asks interactively whether to modify it or write `CLAUDE.local.md` instead (non-interactive default: `CLAUDE.local.md`, never touching a file it didn't create). Called by both setup and update scripts.
- `lib/scripts/migrate-project.sh` — Claude-driven migration of legacy `.docs/` projects to the wiki structure. Preflight: legacy content present, git repo, clean tree, fresh `wiki-migration` branch. `--dry-run` prints the inventory only. Scaffolds first, then runs Claude with `lib/prompts/migrate-wiki.md` (mapping table, `git mv`-before-edit, frontmatter synthesis, link rewrites, family indexes, log entry, cleanup). Guides live in `wiki/guides/`; skill scratch dirs under `.docs/` are kept.
- `lib/prompts/migrate-wiki.md` — The migration prompt: old-path → new-path mapping, per-file procedure, UAT↔task cross-links, ID-collision policy, final report format
- `lib/scripts/templates/CLAUDE-wiki.md` — The wiki-schema section delivered to target projects' CLAUDE.md (copy-once)
- `lib/scripts/templates/CLAUDE-env-safety.md` — The `.env` safety policy prepended to target projects' CLAUDE.md by `sync-wiki-scaffold.sh` (copy-once, never duplicated)
- `lib/scripts/setup-deployment.sh` — Deployment/CI scaffolding. Scaffolds Claude-generated `.github/` workflows + `.gitleaks.toml` into a project (driven by `lib/prompts/setup-deployment.md`) and delivers `deployment-strategy.md` into its `wiki/guides/` (deploy-only guide tier). Only called explicitly via `npx @codewizard-dt/bootstrap deploy`; never by `setup` or `update`. Copy-once: `security.yml` always overwritten (generic), `build.yml` + `.gitleaks.toml` skipped if present.
- `lib/scripts/bootstrap-serena.sh` — Headlessly triggers `.serena/project.yml` creation via `claude --print` and enables 11 optional Serena tools; called by both setup and update scripts
- `bin/cli.js` — CLI entry point for the npm package
- `package.json` — npm package configuration with bin and files fields

---

## LLM Wiki

This project maintains a three-layer LLM Wiki. This section is the **schema** — it tells you how the wiki is structured and what rules govern it.

```
raw/          Immutable ground-truth sources. Read them; NEVER modify, move, or delete them.
wiki/         LLM-maintained knowledge base. You own this layer entirely.
CLAUDE.md     This schema section.
```

### Two domains with opposite organizing laws

**`wiki/knowledge/`** — timeless synthesis, organized by links not status. Pages are revised in place as understanding evolves; no `status` field.

- `wiki/knowledge/sources/` — one summary page per ingested `raw/` source
- `wiki/knowledge/concepts/` — patterns, ideas, conventions, recurring themes
- `wiki/knowledge/entities/{people,organisations,tools,components}/` — one page per entity, filed by sub-type

**`wiki/work/`** — stateful lifecycle artifacts, organized by status. Active files are **never moved** after creation; state lives in the `status:` frontmatter field. Each family has a `lifecycle.md` (schema + valid transitions), an `index.md` listing **only active items**, and an `archive/` subdirectory for terminal items. When an item leaves the active set, delete its line from the family index; terminal items may be moved to `archive/` by `/wiki-archive`.

- `wiki/work/requirements/` — REQ-NNN
- `wiki/work/decisions/` — DEC-NNNN (per-decision `#DM`)
- `wiki/work/roadmaps/` — ROADMAP-NNN
- `wiki/work/tasks/` — TASK-NNN
- `wiki/work/uat/` — UAT-NNN (own family, one per task)
- `wiki/work/bugs/` — BUG-NNNN

**Navigation:** `wiki/index.md` is the home Map of Content — read it first on every wiki query. Knowledge pages are listed there individually; work items live only in their family index. `wiki/log.md` is the append-only operation log. `wiki/conventions.md` holds the page rules (atomic pages, stable IDs/aliases, typed links, frontmatter namespace).

### Auto Memory vs. this wiki

Claude Code has its own native **Auto Memory** feature — typed memory files (`user`, `feedback`, `project`, `reference`) kept under `~/.claude/projects/<hash>/memory/`, indexed by `MEMORY.md`, auto-loaded at session start. It is **cross-project and un-versioned**: it lives outside this git repo and follows the user across every project. This wiki, by contrast, is **per-project and git-versioned**: it lives in `wiki/`, is reviewable in diffs, and is shared with anyone who clones the repo.

Rule of thumb for where a new fact belongs:

- **Auto Memory** — facts about the *user* and their cross-project working style: how they like to collaborate, standing preferences, feedback that applies regardless of which repo is open. If a fact is true only because "the user told me once" and holds everywhere → Auto Memory.
- **This wiki** — facts about *this project*: its architecture, decisions, requirements, tasks, and synthesized knowledge that should be versioned, reviewable, and survive in git history. If a fact is true because "this project decided X" → wiki.

Keep the two from duplicating or contradicting each other: project-specific state does not go in Auto Memory, and cross-project user preferences do not go in the wiki.

### Wiki operations

| Command | Purpose |
|---------|---------|
| `/wiki-ingest <raw-file>` | Process a source from `raw/` into the wiki — summary page, entity/concept updates, index + log entries |
| `/wiki-query <question>` | Answer from the wiki with citations; offer to file valuable synthesis back as a new page |
| `/wiki-lint` | Health-check — contradictions, orphan pages, stale claims, index drift, never-ingested raw sources |
| `/wiki-archive [family]` | Batch-move terminal work items into `<family>/archive/`; update `archive/index.md` and log the operation |
| `/wiki-rotate-log` | Rotate `wiki/log.md` to a timestamped archive file when it exceeds ~500 lines; create a fresh `log.md` with an archive pointer |
| `/wiki-tidy` | One-shot cleanup — lint, archive terminal items across all families, then rotate log if overgrown; phases run in sequence with user confirmation |

### Optional tooling

Two external tools are worth knowing about but are **not adopted by default** in this repo. See their entity pages for detail:

- [qmd](wiki/knowledge/entities/tools/qmd.md) — local CLI search engine for markdown knowledge bases (BM25 + vector + local-LLM re-ranking). Named in Karpathy's original gist as the recommended search layer once a wiki grows past a few hundred pages. **Status for this repo:** correctly deferred — the wiki is still small; revisit if `/wiki-query` reading the full index becomes slow or imprecise at scale.
- [Hindsight](wiki/knowledge/entities/tools/hindsight.md) — shared cross-subagent memory framework, relevant because this repo runs heavy concurrent subagent orchestration (`power-mode`, `tackle`, `now`). **Status for this repo:** hold off adopting as default — only adopt if observed (not hypothetical) cross-subagent memory-sharing pain shows up.

### CRITICAL wiki rules

1. `raw/` is immutable — never create, modify, move, or delete files under `raw/`. **Exceptions (write-only landing zones):** `raw/companies/` is owned by `/research-company` and `/company-align`, and `raw/research/` is owned by `/research`. These skills may *write* new files into their own landing zone, but **must never overwrite or edit an existing `raw/` file** — if a write would clobber a file that already exists, they create the next free numeric sibling instead (`<name>-2.md`, `-3.md`, …), and that `-N` file carries only non-redundant new/changed data with a cross-reference to the prior file. Everything else under `raw/` stays read-only
2. Cross-link aggressively — related pages link to each other with relative markdown links; the link network is as valuable as the pages
3. Index and log updates are mandatory — every ingest and filed answer updates `wiki/index.md` + `wiki/log.md`; every work-item create or status flip updates the family `index.md` + `wiki/log.md`
4. Flag contradictions explicitly — when a new source conflicts with an existing page, add a `> **Contradiction:**` callout citing both; never silently overwrite
5. Answer from the wiki, not general knowledge — if the wiki lacks coverage, say so and suggest `/wiki-ingest` for relevant sources
6. Atomic pages — one concept, entity, or artifact per file; split a page rather than let it cover two things
7. Typed links — when a link has a meaning, annotate it inline as `rel::[[target]]` (e.g. `implements::[[REQ-012]]`, `supersedes::[[DEC-0003#D2]]`); keep the two domains separate — never file a stateful artifact under `knowledge/` or a timeless synthesis under `work/`
