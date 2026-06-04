# basic-project-setup — Project Overview

## Purpose
Project setup template for Claude Code. Contains reusable `.claude/` configurations (custom skills, guides) and MCP server setup instructions meant to be copied into other project repositories. Published as an npm package (`@codewizard-dt/bootstrap-claude`) with CLI commands `setup`, `update`, `install`, and `deploy` (`npx bootstrap-claude <cmd>`).

## Structure
- `.claude/skills/` — Custom skills in Skills directory format
- `.docs/guides/mcp-tools.md` — MCP tool reference
- `.docs/guides/command-anti-patterns.md` — Shell-command and file-operation hygiene rules; defines the /tackle-vs-UAT verification split
- `.docs/tasks/` — Task tracking (active files at top level → `completed/`)
- `.docs/adr/` — Architecture Decision Log. Each file is a **Decision Group** with 1+ `## DM. <title>` blocks; Identifier `ADR-NNNN#DM`. Scaffold-only sync.
- `.docs/prd/` — Product Requirements Log. Status: `draft → approved → archived`. Scaffold-only sync.
- `.docs/uat/` — UAT test tracking (pending files at top level → `completed/` / `skipped/`)
- `.docs/roadmaps/` — Roadmap Log. Flat folder; status field in frontmatter (`active` | `done`). Scaffold-only sync.
- `basic-project-setup.md` — MCP installation guide
- `.github/workflows/security.yml` — Generic Gitleaks secret-scanning workflow; **always synced** to target projects (idempotent). Triggers on push/PR to main.
- `.github/workflows/build.yml` — Generic Docker build+push+deploy template. The `build` job is guarded by `if: hashFiles('Dockerfile') != ''` so it **self-skips** (neutral, not failed) on repos with no root Dockerfile; the dependent `deploy` job (`needs: build`) then skips too. Has `workflow_dispatch` + `docker/setup-buildx-action@v3`. Uses `github.repository_owner` / `github.event.repository.name`. TODO comments for Dockerfile paths and deploy mechanism (self-hosted runner OR SSH).
- `.gitleaks.toml` — Generic Gitleaks config (`useDefault = true`); scaffolded by `setup-deployment.sh`.
- `.scripts/install-global.sh` — Installs MCPs (brave-search, context7, playwright, serena) at user scope AND rsyncs skills to `~/.claude/skills/`. Called by setup and update scripts. Also `npx bootstrap-claude install`.
- `.scripts/setup-project.sh` — New projects: install-global → copy `.claude/` content → sync-docs-scaffold → merge-gitignore → setup-deployment → bootstrap-serena.
- `.scripts/update-project.sh` — Existing projects: install-global → sync-docs-scaffold → merge-gitignore → legacy cleanup → bootstrap-serena (idempotent). **Deliberately does NOT call setup-deployment** (never touches `.github/`).
- `.scripts/sync-docs-scaffold.sh` — Syncs `.docs/` scaffold structure into target projects (guides, directory shells, `.gitkeep`). Never copies task/UAT/ADR/PRD content files.
- `.scripts/setup-deployment.sh` — Deployment/CI scaffolding seam, **separate** from the docs/skills/MCP sync flow. Copies `.github/` workflows + `.gitleaks.toml` into a project. Called once by `setup-project.sh`; never by `update-project.sh` (workflows are hand-customized per project). Standalone via `npx bootstrap-claude deploy`. Copy-once: `security.yml` always overwritten (generic), `build.yml` + `.gitleaks.toml` skipped if present.
- `.scripts/bootstrap-serena.sh` — Initializes `.serena/project.yml` via `claude --print "exit"` and enables 11 optional Serena tools. Idempotent.
- `.scripts/merge-gitignore.sh` — Merges template `.gitignore` entries into project's `.gitignore` (appends only new lines).
- `.scripts/setup-runner.sh` — Sets up a GitHub Actions self-hosted runner on a DigitalOcean droplet. Requires `RUNNER_TOKEN`.
- `.scripts/startup.sh` — Bootstraps a fresh Ubuntu 24.04 VPS: Docker, Zsh, Oh My Zsh.
- `CLAUDE.md` — Project instructions for Claude Code
- `bin/cli.js` — CLI entry point; resolves scripts via `path.resolve(__dirname, '..', '.scripts', script)`
- `package.json` — npm package config; `files` includes `bin/`, `.scripts/`, `.github/`, `.gitleaks.toml`, `.claude/skills/`, `.docs/` scaffold pieces

## Script Path Convention (CRITICAL)
All scripts in `.scripts/` must use this two-variable pattern — NOT the old single-variable form:
```bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # the .scripts/ directory itself
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"  # the repo root (bootstrap-claude/)
```
- Script-to-script calls: `"$SCRIPT_DIR/other-script.sh"`
- Template content (`.claude/`, `.docs/`, `.github/`, `.gitignore`): `"$TEMPLATE_DIR/..."`

The old single-line `TEMPLATE_DIR="$(cd "$(dirname "$0")" && pwd)"` was broken after the scripts moved from the repo root into `.scripts/` — it resolved to `.scripts/` instead of the repo root.

## Workflow Pipeline
`/prd-create → /prd-finalize → /prd-extract-decisions → /adr-create → /adr-finalize → /task-add → /tackle → /update-docs → /uat-generate → /uat-walk` (human) OR `/uat-auto` (headless)

PRD layer is optional for small/internal work — jump directly to `/task-add` or `/adr-create` for bug fixes, refactors, single-engineer choices.

## Required MCPs
- Serena — code exploration, editing, memory
- Brave Search — web research (1 req/sec, sequential)
- Context7 — library documentation
- Playwright — browser automation + screenshots for UI UAT tests
