# basic-project-setup — Project Overview

## Purpose
Project setup template for Claude Code. Contains reusable `.claude/` configurations (custom commands, guides) and MCP server setup instructions meant to be copied into other project repositories. Published as an npm package (`@codewizard-dt/bootstrap-claude`) with CLI commands `setup` and `update` (`npx bootstrap-claude setup` / `npx bootstrap-claude update`).

## Structure
- `.claude/commands/` — Custom slash commands (18 total)
- `.docs/guides/mcp-tools.md` — MCP tool reference
- `.docs/guides/task-lifecycle.md` — Task lifecycle conventions
- `.docs/tasks/` — Task tracking (`active/` → `completed/` → `trashed/`)
- `.docs/uat/` — UAT test tracking (`pending/` → `completed/` / `skipped/` / `trashed/`)
- `basic-project-setup.md` — MCP installation guide
- `setup-project.sh` / `update-project.sh` — Template install + incremental sync (rsync-based)
- `CLAUDE.md` — Project instructions for Claude Code
- `bin/cli.js` — CLI entry point for the npm package
- `package.json` — npm package configuration

## Custom Commands (18)
- `/primer` — Refresh codebase context via Serena memories
- `/serena-config` — Interactively configure Serena language servers in `.serena/project.yml`; reads current config + auto-detects repo languages, then asks one add/remove question (free-text with `-` prefix for removals)
- `/research <topic>` — Deep research (codebase + Context7 + Brave)
- `/now <task>` — Plan and delegate to subagents (max 3 concurrent)
- `/tackle <path>` — Execute task file step-by-step
- `/add-task <desc>` — Create task in `.docs/tasks/active/`
- `/trash-task <path>` — Move task + UAT to `trashed/`
- `/update-task <path> <changes>` — Modify existing task
- `/uat-generator <target>` — Generate UAT tests
- `/uat-walkthrough <path>` — Interactive UAT (human at keyboard)
- `/uat-auto <path>` — Headless UAT auto-judging (fail-closed, for orchestrators like tmux-conductor)
- `/uat-auth [--role=user|guest]` — Authenticate test user and export `$UAT_AUTH_TOKEN`; invoked by `/uat-auto` Step 2.5 on auth-gated tests; env-var-only credentials, no disk persistence
- `/uat-skip <path>` — Skip UAT, move task to completed + UAT to skipped
- `/lint` — IDE diagnostics with fix cycles
- `/simplify <path>` — Remove redundancy, simplify complexity
- `/git-commit` — Stage and commit with auto message
- `/update-docs` — Update docs + audit/update Serena memories
- `/project-readme` — Generate/update portfolio-ready README

## Workflow Pipeline
`/add-task → /tackle → /update-docs → /uat-generator → /uat-walkthrough` (human) OR `/uat-auto` (headless)

- Task lifecycle: `active/` → (tackle + UAT all pass) → `completed/`
- UAT lifecycle: `pending/` → (all pass) → `completed/`
- `/uat-auto` never writes `[SKIP]` (human-only verdict) and never auto-passes without machine-verifiable evidence; manual tests always fail-closed for human re-triage.

## Required MCPs
- Serena — code exploration, editing, memory
- Brave Search — web research (1 req/sec, sequential)
- Context7 — library documentation
- Puppeteer — browser automation + screenshots for UI UAT tests
