# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is a **project setup template** for Claude Code. It contains reusable `.claude/` configurations (custom skills, guides) and MCP server setup instructions meant to be copied into other project repositories. It is not a standalone application.

## Setup Workflow

Follow `basic-project-setup.md` to configure a new project, or use the npm package:

- `npx bootstrap-claude setup` — runs .scripts/setup-project.sh (installs hooks and skills globally, syncs `.docs/` scaffold, scaffolds CI/CD via setup-deployment.sh, bootstraps Serena)
- `npx bootstrap-claude update` — runs .scripts/update-project.sh (installs hooks and skills globally, syncs `.docs/` scaffold; does NOT touch `.github/` workflows)
- `npx bootstrap-claude install` — runs .scripts/install-global.sh (installs/updates MCPs, hooks, and skills globally without a project path)
- `npx bootstrap-claude deploy` — runs .scripts/setup-deployment.sh (scaffolds `.github/` workflows + `.gitleaks.toml` into the project; copy-once so existing workflows are preserved)

**Manual setup steps:**

1. **Serena MCP** — code exploration, editing, and memory (per-project — run from the project root): `claude mcp add --scope project serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"` (writes `.mcp.json`; gitignored — machine-local)
2. **Brave Search MCP** — web search (rate limit: 1 req/sec, sequential only)
3. **Context7 MCP** — library documentation lookups
4. **Install MCPs and skills globally** — run `./.scripts/install-global.sh` (or `npx bootstrap-claude install`) to configure Brave/Context7/Playwright MCPs and copy skills to `~/.claude/skills/`

## Custom Commands

| Command | Purpose |
|---------|---------|
| `/primer` | Refresh codebase context via Serena memories |
| `/serena-config` | Interactively configure Serena language servers in `.serena/project.yml` |
| `/research <topic>` | Deep research using codebase analysis, library docs, and web search |
| `/research-company <name> [URL]` | Comprehensive company research — mission, operations, leadership, financials, and ~5 years of news |
| `/company-align [slug]` | Analyse project–company fit against researched context in `.docs/company-context/`; writes `alignment.md` with gaps, strengths, and talking points |
| `/now <task>` | Plan and delegate task to subagents (max 3 concurrent) |
| `/tackle <path>` | Execute outlined task file step-by-step with subagent delegation |
| `/task-add <desc>` | Create structured task in `.docs/tasks/`. Optional flags: `--adr ADR-NNNN#DM` (auto-link to an accepted ADR decision); `--roadmap ROADMAP-NNN` (auto-append the new task to a roadmap) |
| `/roadmap-create <topic>` | Create an execution-plan roadmap in `.docs/roadmaps/` via short Socratic Q&A — captures goal, phases, and a hybrid (task-link OR inline) checklist |
| `/roadmap-add <ROADMAP-NNN> <item>` | Append a new item (task link or inline) to an existing roadmap, optionally under a named phase |
| `/roadmap-next [file]` | Read-only — point at the first unchecked item in a specific roadmap, or surface the next 3 unchecked items across all roadmaps when no file is given |
| `/prd-create <idea>` | Create a lean PRD in `.docs/prd/` via Socratic Q&A capturing problem, personas, user stories, success metrics, and non-goals |
| `/prd-finalize <file>` | Run completeness audit on a draft PRD, resolve gaps via Q&A, and flip status from `draft` to `approved` |
| `/prd-extract-decisions <file>` | Extract Architecturally Significant Requirements from an approved PRD, cross-check existing ADRs, and propose Decision Group candidates for `/adr-create` |
| `/prd-update <file> [change]` | Amend an approved PRD with an append-only Amendment block; apply direct edits to drafts; surface downstream ADR/task impact |
| `/prd-trash <file>` | Move a cancelled PRD to `.docs/prd/trashed/`, surface linked ADRs/tasks for separate review, and update all references |
| `/adr-create <topic>` | Create an ADR file (Decision Group) in `.docs/adr/` containing 1+ proposed decisions; per-decision tags/status; table-only comparisons; mermaid flowcharts |
| `/adr-finalize <file>#<DM>` | Finalize a single proposed decision (e.g. `0007-session#D2`); per-decision E-C-A-D-R audit; per-decision supersession check; siblings remain untouched |
| `/adr-walkthrough <file>` | Walk an ADR file decision-by-decision, presenting each architecture choice and confirming it with the user via Q&A; light edits only (no status flips) |
| `/adr-next [file or NNNN]` | Read-only — find the first accepted ADR decision with no task reference and suggest `/task-add` |
| `/task-audit [--mermaid] [--json]` | Generate a dependency graph of active tasks, show execution waves (parallelisable groups), and flag stale references or missing dependency blocks |
| `/task-trash <path>` | Move task + related UAT files to `trashed/` directories and update references |
| `/task-update <path> <changes>` | Modify an existing task's scope or steps |
| `/uat-generate <target>` | Generate UAT tests in `.docs/uat/` mirroring task naming conventions |
| `/uat-walk <path>` | Interactively walk through a pending UAT file test-by-test with the user |
| `/uat-auto <path>` | Non-interactively run every test in a pending UAT file and auto-judge verdicts (headless, fail-closed) |
| `/uat-auto-plus <path>` | Autonomous-fix variant of `/uat-auto`: diagnoses failures, applies fixes itself, re-runs until green or attempts are exhausted (intended for `--dangerously-skip-permissions` agents) |
| `/uat-skip <path>` | Skip UAT for a task, move task to completed and UAT to skipped |
| `/bug-file <description>` | File a new bug in `.docs/bugs/` with required-on-report fields and update the bug index |
| `/bug-triage <BUG-NNNN>` | Triage an open bug (priority, assignee, tags, impact) and decide its next destination: stay triaged, start work (→ `in-progress/`), or trash (wontfix / duplicate / cannot-reproduce) |
| `/bug-close <BUG-NNNN>` | Close an in-progress bug — requires root-cause analysis, fix commit, and a regression test before moving to `.docs/bugs/closed/` |
| `/eval-create [stage] [description]` | Assess eval coverage against the 5-stage framework and create new evals with mandatory user approval. Bootstrap mode (no golden sets yet) enforces strictly 1 eval at a time. Pass a description to jump directly to creating that eval. |
| `/eval-run [stage]` | Execute the eval suite (golden sets, scenarios, replays), report pass/fail per case, diff against baseline, and surface regressions |
| `/eval-gap [stage]` | Read-only audit of eval coverage — gap report, coverage matrix, anti-pattern check, and prioritised next actions. Never writes files. |
| `/security-audit [category\|full\|internal\|external]` | Audit LLM/AI integration across 11 categories (5 internal: observability, rate-limiting, access-controls, hitl-policy, benchmarking; 6 external: prompt-injection, data-leakage, output-sanitization, excessive-agency, supply-chain, token-dos). Run a single category, a group, or the full audit. |
| `/lint` | Get IDE diagnostics, fix issues one-by-one in verify cycles |
| `/typecheck` | Detect type-checking tools (typecheck/tsc/mypy/pyright/go vet/cargo check/etc.), run each one, and only invoke `/git-commit` if all pass |
| `/debug-logs [symptom]` | Diagnose failures by inspecting session context, background processes, and conventional log stores; produce ranked hypotheses with next actions (read-only) |
| `/port-feature <source-path> <functionality>` | Assess a feature in an external project and produce a concrete porting plan (technology mapping, complexity breakdown, ordered steps) targeting the current project's conventions |
| `/simplify <path>` | Analyze files/directories to remove redundancy and simplify complexity |
| `/demo [path] [custom instructions]` | Audit all project functionality and produce a 2-3 minute demo run book (`.docs/demo/runbook.md`) plus a Marp slideshow (`.docs/MARP/demo.slides.md`) |
| `/gap-assess <expected functionality>` | Runs in plan mode — audit the app's actual functionality (Serena, subagents) against expected functionality (inline text or a spec/requirements file) and deliver a Covered/Partial/Gap/Undocumented coverage report plus a remediation plan for approval |
| `/marp-slideshow <input> [output]` | Summarize a source file into a Marp/Marpit slide deck following best practices |
| `/mermaid-flowchart <input> [output]` | Summarize an architecture file (markdown, YAML, Docker Compose) into a Mermaid flowchart in a new markdown file |
| `/git-commit` | Stage all changes and commit with auto-generated message |
| `/update-docs` | Update all project documentation after implementation work |

## MCP Tool Requirements

When these MCPs are configured in a target project, they are **mandatory** for their respective operations:

- **Serena**: All code exploration (`find_symbol`, `get_symbols_overview`), code editing (`replace_symbol_body`, `replace_content`), file search (`find_file`, `list_dir`), and project memory
- **Context7**: All library/framework documentation lookups (replaces WebSearch for docs)
- **Brave Search**: General web research (must be sequential, 1 request/second)

Standard Read/Edit/Write tools are permitted for markdown and config files (JSON, YAML, `.env`, etc.). Code files must use Serena. **All file/directory exploration must use Serena tools** (`list_dir`, `find_file`, `search_for_pattern`) — never use `bash` commands like `ls`, `cat`, `find`, `grep`, or `sed`, regardless of file type. See `.docs/guides/mcp-tools.md`.

## Key Files

- `basic-project-setup.md` — MCP installation steps and API keys
- `.docs/guides/mcp-tools.md` — Complete MCP tool reference with workflows and examples
- `.docs/guides/command-anti-patterns.md` — Shell-command and file-operation hygiene rules; defines the `/tackle`-vs-UAT verification split (static gates only in tackle; runtime/E2E in UAT)
- `.docs/guides/bug-lifecycle.md` — Bug folder-movement rules, state-transition gates, and triage cadence; companion to `.docs/bugs/README.md`
- `.docs/roadmaps/README.md` — Roadmap format spec: flat folder, `active`/`done` status, hybrid (task-link OR inline) checklist items, auto-checkoff contract that `/tackle` and UAT skills follow
- `.claude/skills/` — All custom skill definitions (in Skills directory format); installed globally to `~/.claude/skills/` by `.scripts/install-global.sh`
- `.claude/hooks/` — Project-managed hook scripts; installed globally to `~/.claude/hooks/` by `.scripts/install-global.sh` (same sync pattern as skills). See `.claude/hooks/README.md` for what each hook does and the required `~/.claude/settings.json` `PreToolUse` wiring (the install script copies scripts but does NOT register them in global settings — wiring is a one-time manual step)
- `.scripts/install-global.sh` — Installs/updates MCPs, hooks, and skills globally (configures MCPs in `~/.claude.json`, copies hooks to `~/.claude/hooks/`, copies skills to `~/.claude/skills/`) so they are available across all projects; called by both setup and update scripts
- `.scripts/setup-project.sh` — Script to set up a new project (installs MCPs and skills globally, syncs `.docs/` scaffold, scaffolds CI/CD via `.scripts/setup-deployment.sh`, bootstraps Serena project.yml); delegates `.docs/` sync to `.scripts/sync-docs-scaffold.sh`
- `.scripts/setup-deployment.sh` — Deployment/CI scaffolding seam (separate from the docs/skills/MCP sync flow). Copies `.github/` workflows + `.gitleaks.toml` into a project. Called once by `setup-project.sh`; **never** by `update-project.sh` (workflows are hand-customized per project and must not be clobbered). Also standalone via `npx bootstrap-claude deploy`. Copy-once: `security.yml` always overwritten (generic), `build.yml` + `.gitleaks.toml` skipped if present. Reads its Claude prompt from `.claude/prompt-template/setup-deployment.md`
- `.claude/prompt-template/` — Claude prompt templates for setup scripts. `setup-deployment.md` drives `setup-deployment.sh`; `setup-strict-typechecks.md` drives `setup-strict-typechecks.sh`. Edit these to change what Claude scaffolds — the scripts are just thin wrappers that read, interpolate, and invoke
- `.scripts/update-project.sh` — Script to install MCPs and skills globally (via `.scripts/install-global.sh`) and sync the `.docs/` scaffold into a target project (re-runs bootstrap-serena.sh idempotently)
- `.scripts/sync-docs-scaffold.sh` — Syncs only the scaffold structure of `.docs/` (guides + directory shells + `.gitkeep` files), never template-specific task or UAT content; called by both setup and update scripts
- `.scripts/bootstrap-serena.sh` — Headlessly triggers `.serena/project.yml` creation via `claude --print` and enables 11 optional Serena tools; called by both setup and update scripts
- `bin/cli.js` — CLI entry point for the npm package
- `package.json` — npm package configuration with bin and files fields
