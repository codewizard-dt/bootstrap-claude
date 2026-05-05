# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is a **project setup template** for Claude Code. It contains reusable `.claude/` configurations (custom skills, guides) and MCP server setup instructions meant to be copied into other project repositories. It is not a standalone application.

## Setup Workflow

Follow `basic-project-setup.md` to configure a new project, or use the npm package:

- `npx bootstrap-claude setup` — runs setup-project.sh
- `npx bootstrap-claude update` — runs update-project.sh

**Manual setup steps:**

1. **Serena MCP** — code exploration, editing, and memory: `claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"`
2. **Brave Search MCP** — web search (rate limit: 1 req/sec, sequential only)
3. **Context7 MCP** — library documentation lookups
4. **Copy `.claude/` directory** into target project root

## Custom Commands

| Command | Purpose |
|---------|---------|
| `/primer` | Refresh codebase context via Serena memories |
| `/serena-config` | Interactively configure Serena language servers in `.serena/project.yml` |
| `/research <topic>` | Deep research using codebase analysis, library docs, and web search |
| `/now <task>` | Plan and delegate task to subagents (max 3 concurrent) |
| `/tackle <path>` | Execute outlined task file step-by-step with subagent delegation |
| `/add-task <desc>` | Create structured task in `.docs/tasks/active/` |
| `/create-prd <idea>` | Create a lean PRD in `.docs/prd/active/` via Socratic Q&A capturing problem, personas, user stories, success metrics, and non-goals |
| `/finalize-prd <file>` | Run completeness audit on a draft PRD, resolve gaps via Q&A, and flip status from `draft` to `approved` |
| `/prd-to-decisions <file>` | Extract Architecturally Significant Requirements from an approved PRD, cross-check existing ADRs, and propose Decision Group candidates for `/create-adr` |
| `/update-prd <file> [change]` | Amend an approved PRD with an append-only Amendment block; apply direct edits to drafts; surface downstream ADR/task impact |
| `/trash-prd <file>` | Move a cancelled PRD to `.docs/prd/trashed/`, surface linked ADRs/tasks for separate review, and update all references |
| `/create-adr <topic>` | Create an ADR file (Decision Group) in `.docs/adr/` containing 1+ proposed decisions; per-decision tags/status; table-only comparisons; mermaid flowcharts |
| `/finalize-adr <file>#<DM>` | Finalize a single proposed decision (e.g. `0007-session#D2`); per-decision E-C-A-D-R audit; per-decision supersession check; siblings remain untouched |
| `/walkthrough-adr <file>` | Walk an ADR file decision-by-decision, presenting each architecture choice and confirming it with the user via Q&A; light edits only (no status flips) |
| `/trash-task <path>` | Move task + related UAT files to `trashed/` directories and update references |
| `/update-task <path> <changes>` | Modify an existing task's scope or steps |
| `/uat-generator <target>` | Generate UAT tests in `.docs/uat/pending/` mirroring task naming conventions |
| `/uat-walkthrough <path>` | Interactively walk through a pending UAT file test-by-test with the user |
| `/uat-auto <path>` | Non-interactively run every test in a pending UAT file and auto-judge verdicts (headless, fail-closed) |
| `/uat-auth` | Authenticate a test user (user|guest) and export `$UAT_AUTH_TOKEN` for UAT tools; invoked automatically by `/uat-auto` on auth-gated tests |
| `/uat-skip <path>` | Skip UAT for a task, move task to completed and UAT to skipped |
| `/lint` | Get IDE diagnostics, fix issues one-by-one in verify cycles |
| `/debug-logs [symptom]` | Diagnose failures by inspecting session context, background processes, and conventional log stores; produce ranked hypotheses with next actions (read-only) |
| `/simplify <path>` | Analyze files/directories to remove redundancy and simplify complexity |
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
- `.claude/skills/` — All custom skill definitions (in Skills directory format)
- `setup-project.sh` — Script to set up a new project (Serena MCP + copy commands/docs + bootstrap Serena project.yml); delegates `.docs/` sync to `sync-docs-scaffold.sh`
- `update-project.sh` — Script to sync `.claude/skills/` and `.docs/` into a target project (re-runs bootstrap-serena.sh idempotently); delegates `.docs/` sync to `sync-docs-scaffold.sh`
- `sync-docs-scaffold.sh` — Syncs only the scaffold structure of `.docs/` (guides + directory shells + `active/README.md`), never template-specific task or UAT content; called by both setup and update scripts
- `bootstrap-serena.sh` — Headlessly triggers `.serena/project.yml` creation via `claude --print` and enables 11 optional Serena tools; called by both setup and update scripts
- `bin/cli.js` — CLI entry point for the npm package
- `package.json` — npm package configuration with bin and files fields
