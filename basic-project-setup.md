# New Project Setup

## Prerequisites (One-Time Global Setup)

The following MCP servers are configured globally in `~/.claude.json` under the top-level `mcpServers` key. They are available to **all projects** automatically — no per-project setup needed:

- **Brave Search** — web research
- **Context7** — library documentation
- **Playwright** — browser automation

## Step 1: Serena MCP (Per-Project)

Serena must be added to each project individually because it requires the project path:

```bash
claude mcp add --scope project serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"
```

This writes `.mcp.json` in the project root (gitignored — machine-local absolute path). Each project gets its own Serena process so language configs never bleed across projects.

## Step 2: Install Skills and Sync Docs

Run the sync script from this repo:

```bash
./.scripts/update-project.sh <path-to-project>
```

This installs skills globally to `~/.claude/skills/` (available to all projects), syncs the `.docs/` scaffold into the target project, and runs `.scripts/bootstrap-serena.sh` (idempotent) to ensure `.serena/project.yml` exists and has the 11 optional Serena tools enabled. Re-run after pulling template updates.

To install or refresh MCPs and skills globally without a project path:

```bash
./.scripts/install-global.sh
# or
npx bootstrap-claude install
```

## Step 3: Wire Global Hooks (One-Time)

`install-global.sh` copies hook *scripts* to `~/.claude/hooks/` but does **not**
register them in `~/.claude/settings.json` — hook wiring is a global-settings
concern done once by hand. See `.claude/hooks/README.md` for the required
`PreToolUse` snippets (e.g. the `git stash`/`restore`/`checkout` block, which is
enforced even under bypassed permissions where `deny` rules don't apply).

## Step 4: Initialize

- Run `/init`
- Run `/primer`
