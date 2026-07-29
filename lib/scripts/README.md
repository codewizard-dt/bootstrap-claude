# scripts/

Bash orchestration layer. These are the only scripts `bin/cli.js` ever executes directly; everything else in `lib/` (hooks, prompts, skills, templates) gets copied, synced, or read by one of these.

All scripts use `set -euo pipefail`. Every script that touches a target project sources `lib.sh` for shared helpers and takes the project path as `$1`.

## CLI-facing scripts (one per `bootstrap` command)

| Script | `bootstrap` command | What it does |
|--------|---------------------|---------------|
| `setup-project.sh` | `setup` | Preflight-checks `claude` and `uv` are installed, then runs the full new-project sequence: MCP install (interactive), global skills/hooks install, wiki scaffold + tiered guides sync (optional guides prompted), `.gitignore` merge, and Serena `project.yml` bootstrap. Does **not** scaffold deployment — that's explicit via `deploy`. |
| `update-project.sh` | `update` | Re-installs global skills/hooks and re-syncs the wiki scaffold + tiered `.docs/guides/` into an existing project. Detects legacy `.docs/`-layout families (`tasks`, `uat`, `adr`, `prd`, `bugs`, `roadmaps`) and warns without touching them — migration is a separate, explicit step (`migrate`). Never touches `.github/`. |
| `install-global.sh` | `install` | Installs/updates MCPs, hooks, and skills globally with **no project path** — the shared step both `setup` and `update` delegate to. Also prunes stale skill folders left over from the wiki rename (`adr-*` → `decision-*`, `prd-*` → `req-*`), and merges the canonical Bash deny list into `~/.claude/settings.json` via `merge-settings-deny.js`. Accepts `--skip-mcps` when the caller already handled MCP install interactively. |
| `setup-deployment.sh` | `deploy` / `deployment` | Reads `raw/guides/deployment-strategy.md` as a prompt template, copies it into the target's `.docs/guides/` (deploy-only guide tier — the wiki sync never ships it), and runs `claude` to scaffold `.github/workflows/`, `Makefile` Docker targets, and `.gitleaks.toml` into the target project. Deliberately **not** called by `setup`/`update` — CI files get hand-customized per project (Dockerfile paths, runner labels, deploy steps) and must never be created or clobbered implicitly. `security.yml` is always overwritten (generic); `build.yml`/`.gitleaks.toml` are copy-once; `Makefile` targets are merged. |
| `migrate-project.sh` | `migrate` | Claude-driven migration of a legacy `.docs/`-layout project to the LLM Wiki structure (`wiki/knowledge/` + `wiki/work/`). Preflight requires a clean git tree; runs on a fresh `wiki-migration` branch so the whole migration is one reviewable diff. Scaffolds first via `sync-wiki-scaffold.sh --interactive`, assembles `.docs/guides/mcp-tools.md` via `build-mcp-guide.sh`, then drives the semantic conversion (frontmatter synthesis, ID renames, link rewrites, family indexes) with the prompt at `lib/prompts/migrate-wiki.md`. `git mv` before edit, so history is preserved. `--dry-run` prints the file inventory only and does not touch anything. |
| `setup-strict-typechecks.sh` | `typechecks` | Loads `lib/prompts/setup-strict-typechecks.md`, appends an optional language list (space- or comma-separated), and runs `claude` to detect languages, research current strict-mode conventions, install toolchains, and wire `make typecheck`. |
| `wiki-dashboard-server.js` | `dashboard` | Zero-dependency Node static file server (Node builtins only) that serves the live wiki dashboard client (`templates/wiki/dashboard.html`) at `/` and the project's `wiki/` tree read-only under `/wiki/*`, all with `no-store` cache headers so the polling client always sees current content. Runs in the foreground until Ctrl-C. Binds `http://localhost:4317` by default; pass a port to override (`bootstrap dashboard 4400`), and falls back to the next port (up to 10 tries) if the chosen one is in use. Unlike the other CLI scripts, this is Node, not Bash, and is long-running rather than one-shot. |

## Shared helpers and internal scripts

| Script | Used by | Purpose |
|--------|---------|---------|
| `lib.sh` | Every script above | Shared bash library: `resolve_project_dir` (path resolution + validation), `mcp_installed`/`serena_installed`/`detect_installed_mcps` (MCP state checks), `run_project_sync` (the common setup/update sequence: MCPs → skills/hooks → wiki scaffold → gitignore → Serena), and `prompt_yn`/`prompt_scope` (interactive prompt helpers). |
| `install-mcps.sh` | `install-global.sh`, `setup-project.sh`, `update-project.sh` | Installs Brave Search, Context7, Playwright, and (when a project dir is given) Serena. Two modes: non-interactive (`install-global.sh`'s default — installs everything missing at user scope) and `--interactive --project-dir <dir>` (prompts per-MCP and asks for scope, used by `setup`/`update`). |
| `sync-wiki-scaffold.sh` | `setup-project.sh`, `update-project.sh`, `migrate-project.sh` | Scaffolds an **empty** wiki into the target project from `templates/wiki/`: creates `raw/` + all `wiki/` family directories, lifecycle docs, per-family `index.md`, and stub `index.md`/`log.md`. Copy-once for project-owned files; always-refreshes `conventions.md` and `lifecycle.md`. Delivers guides from `raw/guides/` tier-wise into `.docs/guides/`: `command-anti-patterns.md` required (always refreshed); `evals-framework.md` + `type-checking-templates/` optional (`--interactive` prompts on first delivery, sticky refresh once present, opt out by deleting); removes deprecated `task-spec.md` and non-deploy `deployment-strategy.md` copies. Also delivers the `## LLM Wiki` section and `.env` safety policy into the target's `CLAUDE.md` (copy-once, sentinel-guarded, from `templates/CLAUDE-wiki.md` / `templates/CLAUDE-env-safety.md`). |
| `build-mcp-guide.sh` | `setup-project.sh`, `update-project.sh`, `migrate-project.sh` | Assembles `.docs/guides/mcp-tools.md` in the target project from the per-server stub files in `templates/guides/stubs/`, including only the sections for MCPs actually installed. |
| `bootstrap-serena.sh` | `setup-project.sh`, `update-project.sh` | Headlessly triggers `.serena/project.yml` creation via `claude --print` and enables the optional Serena tools needed by this template's workflow. Preflights `claude` and `python3`. |
| `merge-gitignore.sh` | `setup-project.sh`, `update-project.sh` | Copies the packaged `.gitignore` template into the target project if none exists; otherwise merges in only the missing lines, leaving the project's existing `.gitignore` content untouched. |
| `merge-settings-deny.js` | `install-global.sh` | Zero-dependency Node script that merges the canonical Bash deny list (`templates/settings-deny.json`) into `~/.claude/settings.json` `permissions.deny`. Additive union only: missing entries are appended, user entries are never removed or reordered, all other settings keys pass through untouched. Atomic write, preserves existing indentation, and always exits 0 (warns + skips on unparseable or unexpected file shapes so an install never aborts over a settings merge). `--target`/`--source` flags exist as test seams. |

## Standalone infra scripts (not wired to the CLI)

These are **not** referenced by `bin/cli.js` or by any other script — they're invoked manually when standing up self-hosted CI infrastructure for a project that used `deploy`.

| Script | Purpose |
|--------|---------|
| `setup-runner.sh` | Generalized GitHub Actions self-hosted runner installer. Run as root on a target droplet: `RUNNER_TOKEN=<token> REPO_URL=<url> bash setup-runner.sh`. Registers the runner, installs it as a service, and configures GHCR login. |
| `startup.sh` | One-shot droplet bootstrap: updates apt, installs zsh/curl/make, and installs Docker + the Compose plugin from Docker's official apt repo. Typically run once before `setup-runner.sh` on a fresh VM. |

## `templates/`

Static and semi-static assets copied or read by the scripts above — never executed themselves.

| Path | Read/copied by | Contents |
|------|-----------------|----------|
| `templates/wiki/` | `sync-wiki-scaffold.sh` | The empty wiki scaffold: `index.md`, `log.md`, `conventions.md`, and per-family `knowledge/`/`work/{tasks,uat,bugs,requirements,decisions,roadmaps}/` directories with `lifecycle.md`, `index.md`, `archive/index.md`, and `.gitkeep` placeholders. |
| `templates/guides/stubs/` | `build-mcp-guide.sh` | Per-MCP-server markdown fragments (`serena.md`, `context7.md`, `brave-search.md`, `playwright.md`) plus `00-header.md` (the shared top-of-file rules), assembled into `.docs/guides/mcp-tools.md`. |
| `templates/CLAUDE-wiki.md` | `sync-wiki-scaffold.sh` | The `## LLM Wiki` schema section delivered into a target project's `CLAUDE.md` (copy-once, sentinel-guarded). |
| `templates/CLAUDE-env-safety.md` | `sync-wiki-scaffold.sh` | The `.env` read/write safety policy prepended to a target project's `CLAUDE.md` (copy-once, never duplicated). |
| `templates/gitignore` | `merge-gitignore.sh` | Packed copy of this repo's own `.gitignore` (dotfiles aren't included in npm packages, so it's shipped under a non-dot name and renamed on copy). |
| `templates/settings-deny.json` | `merge-settings-deny.js` | The canonical `permissions.deny` list (bare JSON array of rule strings): destructive disk/system commands, `sudo`, permission footguns, and git working-tree/history protections. Audited against the Claude Code permission-rule docs; merged additively into `~/.claude/settings.json` on every `install`/`setup`/`update`. |
