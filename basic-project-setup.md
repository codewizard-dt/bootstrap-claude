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

## Step 2: Install Skills and Sync Docs

Run the sync script from this repo:

```bash
./update-project.sh <path-to-project>
```

This installs skills globally to `~/.claude/skills/` (available to all projects), syncs the `.docs/` scaffold into the target project, and runs `bootstrap-serena.sh` (idempotent) to ensure `.serena/project.yml` exists and has the 11 optional Serena tools enabled. Re-run after pulling template updates.

To install or refresh MCPs and skills globally without a project path:

```bash
./install-global.sh
# or
npx bootstrap-claude install
```

## Step 3: Initialize

- Run `/init`
- Run `/primer`
