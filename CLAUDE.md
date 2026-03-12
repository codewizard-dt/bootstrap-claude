# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This is a **project setup template** for Claude Code. It contains reusable `.claude/` configurations (custom commands, guides) and MCP server setup instructions meant to be copied into other project repositories. It is not a standalone application.

## Setup Workflow

Follow `basic-project-setup.md` to configure a new project:

1. **Serena MCP** — code exploration, editing, and memory: `claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"`
2. **Brave Search MCP** — web search (rate limit: 1 req/sec, sequential only)
3. **Context7 MCP** — library documentation lookups
4. **Copy `.claude/` directory** into target project root

## Custom Commands

| Command | Purpose |
|---------|---------|
| `/primer` | Refresh codebase context via Serena memories |
| `/now <task>` | Plan and delegate task to subagents (max 3 concurrent) |
| `/tackle <path>` | Execute outlined task file step-by-step with subagent delegation |
| `/add-task <desc>` | Create structured task in `.docs/tasks/active/` |
| `/trash-task <path>` | Move task + related UAT files to `trashed/` directories and update references |
| `/update-task <path> <changes>` | Modify an existing task's scope or steps |
| `/uat-generator <target>` | Generate UAT tests in `.docs/uat/pending/` mirroring task naming conventions |
| `/uat-walkthrough <path>` | Interactively walk through a pending UAT file test-by-test with the user |
| `/lint` | Get IDE diagnostics, fix issues one-by-one in verify cycles |
| `/simplify <path>` | Analyze files/directories to remove redundancy and simplify complexity |
| `/git-commit` | Stage all changes and commit with auto-generated message |
| `/update` | Update all project documentation after implementation work |

## MCP Tool Requirements

When these MCPs are configured in a target project, they are **mandatory** for their respective operations:

- **Serena**: All code exploration (`find_symbol`, `get_symbols_overview`), code editing (`replace_symbol_body`, `replace_content`), file search (`find_file`, `list_dir`), and project memory
- **Context7**: All library/framework documentation lookups (replaces WebSearch for docs)
- **Brave Search**: General web research (must be sequential, 1 request/second)

Standard Read/Edit/Write tools are permitted only for non-code files (markdown, JSON, YAML, config).

## Key Files

- `basic-project-setup.md` — MCP installation steps and API keys
- `.docs/guides/mcp-tools.md` — Complete MCP tool reference with workflows and examples
- `.claude/commands/` — All custom slash command definitions
- `setup-project.sh` — Script to set up a new project (Serena MCP + copy commands/docs)
- `update-project.sh` — Script to sync `.claude/commands/` and `.docs/` into a target project
