# New Project Setup

## Prerequisites (One-Time Global Setup)

The following MCP servers are configured globally in `~/.claude.json` under the top-level `mcpServers` key. They are available to **all projects** automatically — no per-project setup needed:

- **Brave Search** — web research
- **Context7** — library documentation
- **Puppeteer** — browser automation

## Step 1: Serena MCP (Per-Project)

Serena must be added to each project individually because it requires the project path:

```bash
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"
```

## Step 2: Add Commands and Instructions

- Copy `.claude/` from this repo into `<your_project_root>/.claude/` (contains custom commands)
- Copy `.docs/` from this repo into `<your_project_root>/.docs/` (contains guides and task templates)

## Step 3: Initialize

- Run `/init`
- Run `/primer'
