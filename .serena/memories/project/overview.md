# bootstrap-wiki — Project Overview

## Purpose

Project setup template for Claude Code, structured as an **LLM Wiki**. Contains reusable skills, hooks, prompt templates, MCP server setup instructions, and a wiki scaffold meant to be deployed into other project repositories. Published as npm package `@codewizard-dt/bootstrap` with CLI `npx @codewizard-dt/bootstrap <cmd>`.

## Three-layer architecture

```
raw/          Immutable ground-truth sources. LLM reads but never modifies.
wiki/         LLM-maintained knowledge base — two domains:
              knowledge/ (timeless, link-organized) + work/ (stateful, status-organized)
CLAUDE.md     Schema: tells the LLM how the wiki is structured
```

## Key directories

- `lib/skills/` — 52 custom skill definitions (Skills directory format). Installed to `~/.claude/skills/` by `lib/scripts/install-global.sh`.
- `lib/hooks/` — PreToolUse hook scripts. Installed to `~/.claude/hooks/` by `install-global.sh`.
- `lib/prompts/` — Claude prompt templates read by setup scripts.
- `lib/scripts/` — Shell scripts; templates at `lib/scripts/templates/wiki/`.
- `raw/guides/` — Source guides (always-refreshed to `.docs/guides/` in target projects).
- `wiki/` — This repo's own wiki instance (dogfoods `sync-wiki-scaffold.sh`).

## Script path convention (CRITICAL)

All scripts in `lib/scripts/` use the two-variable pattern:
```bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"       # lib/scripts/
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"   # repo root
```
- Script-to-script calls: `"$SCRIPT_DIR/other-script.sh"`
- Template content (lib/, raw/, .github/): `"$TEMPLATE_DIR/..."`

## Scripts

- `lib/scripts/install-global.sh` — Installs MCPs (brave-search, context7, playwright) at user scope, rsyncs skills to `~/.claude/skills/`, rsyncs hooks to `~/.claude/hooks/`, detects and removes stale old-named skills (adr-*, prd-*).
- `lib/scripts/setup-project.sh` — New projects: install-global → sync-wiki-scaffold → merge-gitignore → setup-deployment → bootstrap-serena.
- `lib/scripts/update-project.sh` — Existing projects: install-global → sync-wiki-scaffold → merge-gitignore → bootstrap-serena. Deliberately does NOT call setup-deployment.
- `lib/scripts/sync-wiki-scaffold.sh` — Scaffolds empty wiki + raw/ + .docs/guides/ into target projects. Copy-once for index/log/gitkeeps; always-refresh for conventions.md and lifecycle.md files and all guides.
- `lib/scripts/setup-deployment.sh` — CI/CD scaffolding. Copies `.github/` + `.gitleaks.toml`. Copy-once except security.yml (always overwritten).
- `bin/cli.js` — CLI entry point; resolves scripts via `path.resolve(__dirname, '..', 'lib', 'scripts', script)`.

## Work families (wiki/work/)

Files never move; status in frontmatter; each family has lifecycle.md + index.md (active items only).
- `requirements/` REQ-NNN · `decisions/` DEC-NNNN#DM · `roadmaps/` ROADMAP-NNN
- `tasks/` TASK-NNN · `uat/` UAT-NNN (own family, not nested in tasks/) · `bugs/` BUG-NNNN

task-trash: flips status: trashed (no file deletion, no trashed/ directory).

## Skill workflow pipeline

`/req-create → /req-finalize → /req-extract-decisions → /decision-create → /decision-finalize → /task-add → /tackle → /update-docs → /uat-generate → /uat-walk` (human) OR `/uat-auto` (headless)

Requirement/decision layer is optional for small work — jump directly to `/task-add`.

## Required MCPs

- Serena — code exploration, editing, memory (per-project scope with absolute path)
- Brave Search — web research (1 req/sec, sequential)
- Context7 — library documentation
- Playwright — browser automation + screenshots for UI UAT tests
