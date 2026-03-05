# basic-project-setup — Project Overview

## Purpose
A project setup template for Claude Code. Contains reusable `.claude/` configurations (custom commands, guides) and MCP server setup instructions meant to be copied into other project repositories.

## Structure
- `.claude/commands/` — Custom slash commands (11 total)
- `.docs/guides/mcp-tools.md` — MCP tool reference
- `.docs/tasks/` — Task tracking (active → pending-uat → completed)
- `.docs/uat/` — UAT test tracking (pending → completed)
- `basic-project-setup.md` — MCP installation guide
- `update-project.sh` — Syncs template files into target projects (accepts relative or absolute paths)
- `update-agent.md` — Instructions for creating a shell alias for `update-project.sh`
- `CLAUDE.md` — Project instructions for Claude Code

## Custom Commands (11)
- `/primer` — Refresh codebase context via Serena memories
- `/now <task>` — Plan and delegate to subagents
- `/tackle <path>` — Execute task file step-by-step
- `/add-task <desc>` — Create task in `.docs/tasks/active/`
- `/uat-generator <target>` — Generate UAT tests
- `/uat-walkthrough <path>` — Walk through pending UAT
- `/lint` — IDE diagnostics with fix cycles (also pre-commit in git-commit)
- `/simplify <path>` — Remove redundancy, simplify complexity
- `/git-commit` — Stage and commit with auto message
- `/update` — Update all docs after implementation
- `/git-commit` includes `/lint` as a pre-commit step

## Workflow Pipeline
`/add-task → /tackle → /update → /uat-generator → /uat-walkthrough`

Task lifecycle: `active/` → (tackle) → `pending-uat/` → (uat-walkthrough all pass) → `completed/`
UAT lifecycle: `pending/` → (uat-walkthrough all pass) → `completed/`

## Required MCPs
- Serena (code exploration, editing, memory)
- Brave Search (web research, 1 req/sec)
- Context7 (library documentation)
