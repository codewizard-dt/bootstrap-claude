# scripts/

Bash orchestration layer. These are the only scripts `bin/cli.js` ever executes directly; everything else in `lib/` (hooks, prompts, skills, templates) gets copied, synced, or read by one of these.

All scripts use `set -euo pipefail`. Every script that touches a target project sources `lib.sh` for shared helpers and takes the project path as `$1`.

## CLI-facing scripts (one per `bootstrap` command)

| Script | `bootstrap` command | What it does |
|--------|---------------------|---------------|
| `setup-project.sh` | `setup` | Preflight-checks `claude` and `uv` are installed, then runs the full new-project sequence: global hooks/skills/settings install first (offline-safe, via `install-global.sh --skip-mcps` — includes the deny-list and hooks-wiring merges), then the interactive MCP install (guarded — a failure warns and continues), wiki scaffold + tiered guides sync (optional guides prompted), `.gitignore` merge, and Serena `project.yml` bootstrap. Does **not** scaffold deployment — that's explicit via `deploy`. |
| `update-project.sh` | `update` | Re-runs the same shared sequence as `setup` (global hooks/skills/settings via `install-global.sh --skip-mcps`, then the guarded interactive MCP install) and re-syncs the wiki scaffold + tiered `wiki/guides/` into an existing project. Detects legacy `.docs/`-layout families (`tasks`, `uat`, `adr`, `prd`, `bugs`, `roadmaps`) and warns without touching them — migration is a separate, explicit step (`migrate`). Never touches `.github/`. |
| `install-global.sh` | `install` | Installs/updates hooks, skills, settings, and MCPs globally with **no project path** — the shared step both `setup` and `update` delegate to. Local/offline-safe steps run first: hooks rsync to `~/.claude/hooks/` (stderr warning if `lib/hooks` is missing), skills install (pruning stale skill folders from the wiki rename — `adr-*` → `decision-*`, `prd-*` → `req-*`), the canonical permission deny-list merge into `~/.claude/settings.json` via `merge-settings-deny.js`, then the hooks-wiring merge via `merge-settings-hooks.js` — registering the copied hook scripts in the settings `hooks` key, with a restart-your-session reminder when the wiring was created or changed. Then copies `templates/file-suggestion.sh` → `~/.claude/file-suggestion.sh` and registers it as the `fileSuggestion` `@`-autocomplete picker (`merge-settings-deny.js --set-key` mode) — printing a restart note on fresh registration, or leaving a pre-existing different `fileSuggestion` untouched. MCPs install **last** — the only network-dependent step, guarded so a failure warns instead of aborting the local installs — and `--skip-mcps` skips them when the caller already handled MCP install interactively. |
| `setup-deployment.sh` | `deploy` / `deployment` | Reads `raw/guides/deployment-strategy.md` as a prompt template, copies it into the target's `wiki/guides/` (deploy-only guide tier — the wiki sync never ships it), and runs `claude` to scaffold `.github/workflows/`, `Makefile` Docker targets, and `.gitleaks.toml` into the target project. Deliberately **not** called by `setup`/`update` — CI files get hand-customized per project (Dockerfile paths, runner labels, deploy steps) and must never be created or clobbered implicitly. `security.yml` is always overwritten (generic); `build.yml`/`.gitleaks.toml` are copy-once; `Makefile` targets are merged. |
| `migrate-project.sh` | `migrate` | Claude-driven migration of a legacy `.docs/`-layout project to the LLM Wiki structure (`wiki/knowledge/` + `wiki/work/`). Preflight requires a clean git tree; runs on a fresh `wiki-migration` branch so the whole migration is one reviewable diff. Scaffolds first via `sync-wiki-scaffold.sh --interactive`, assembles `wiki/guides/mcp-tools.md` via `build-mcp-guide.sh`, then drives the semantic conversion (frontmatter synthesis, ID renames, link rewrites, family indexes) with the prompt at `lib/prompts/migrate-wiki.md`. `git mv` before edit, so history is preserved. `--dry-run` prints the file inventory only and does not touch anything. |
| `setup-strict-typechecks.sh` | `typechecks` | Loads `lib/prompts/setup-strict-typechecks.md`, appends an optional language list (space- or comma-separated), and runs `claude` to detect languages, research current strict-mode conventions, install toolchains, and wire `make typecheck`. |
| `wiki-dashboard-server.js` | `dashboard` | Zero-dependency Node static file server (Node builtins only) that serves the live wiki dashboard client (`templates/wiki/dashboard.html`) at `/` and the project's `wiki/` tree read-only under `/wiki/*`, all with `no-store` cache headers so the polling client always sees current content. Runs in the foreground until Ctrl-C. Binds `http://localhost:4317` by default; pass a port to override (`bootstrap dashboard 4400`), and falls back to the next port (up to 10 tries) if the chosen one is in use. Unlike the other CLI scripts, this is Node, not Bash, and is long-running rather than one-shot. |

## Shared helpers and internal scripts

| Script | Used by | Purpose |
|--------|---------|---------|
| `lib.sh` | Every script above | Shared bash library: `resolve_project_dir` (path resolution + validation), `mcp_installed`/`serena_installed`/`detect_installed_mcps` (MCP state checks), `run_project_sync` (the common setup/update sequence: `install-global.sh --skip-mcps` first — hooks/skills/deny-list/hooks-wiring/fileSuggestion, offline-safe — then the guarded interactive MCP install, wiki scaffold, gitignore, MCP-tools guide, Serena bootstrap), and `prompt_yn`/`prompt_scope` (interactive prompt helpers). |
| `install-mcps.sh` | `install-global.sh`, `setup-project.sh`, `update-project.sh` | Installs Brave Search, Context7, Playwright, and (when a project dir is given) Serena. Two modes: non-interactive (`install-global.sh`'s default — installs everything missing at user scope) and `--interactive --project-dir <dir>` (prompts per-MCP and asks for scope, used by `setup`/`update`). Playwright has a dedicated conflict flow: registered as `playwright` (user scope) by default; when a project ships its own `playwright`, a git-tracked `.mcp.json` is never modified (interactive options: register ours as `playwright-shared` + disable the project entry machine-locally via `disabledMcpjsonServers` in `.claude/settings.local.json` / register alongside / skip), while a machine-local registration can be replaced or kept (ours then uses the alternate name). Non-interactive conflicts are left untouched with a hint. |
| `sync-wiki-scaffold.sh` | `setup-project.sh`, `update-project.sh`, `migrate-project.sh` | Scaffolds an **empty** wiki into the target project from `templates/wiki/`: creates `raw/` + all `wiki/` family directories, lifecycle docs, per-family `index.md`, and stub `index.md`/`log.md`. Copy-once for project-owned files; always-refreshes `conventions.md` and `lifecycle.md`. Delivers guides from `raw/guides/` tier-wise into `wiki/guides/`: `command-anti-patterns.md` required (always refreshed); `evals-framework.md` + `type-checking-templates/` optional (`--interactive` prompts on first delivery, sticky refresh once present — legacy `.docs/guides/` presence counts, opt out by deleting); migrates legacy `.docs/guides/` (template-owned files removed or relocated, deprecated `task-spec.md` deleted, empty dirs pruned). Also delivers the `## LLM Wiki` section and `.env` safety policy (copy-once, sentinel-guarded, from `templates/CLAUDE-wiki.md` / `templates/CLAUDE-env-safety.md`) into the target's `CLAUDE.md` — when a `CLAUDE.md` already exists without the schema, prompts whether to modify it or write `CLAUDE.local.md` instead (non-interactive default: `CLAUDE.local.md`). |
| `build-mcp-guide.sh` | `setup-project.sh`, `update-project.sh`, `migrate-project.sh` | Assembles `wiki/guides/mcp-tools.md` in the target project from the per-server stub files in `templates/guides/stubs/`, including only the sections for MCPs actually installed. |
| `bootstrap-serena.sh` | `setup-project.sh`, `update-project.sh` | Headlessly triggers `.serena/project.yml` creation via `claude --print` and enables the optional Serena tools needed by this template's workflow. Preflights `claude` and `python3`. |
| `merge-gitignore.sh` | `setup-project.sh`, `update-project.sh` | Fully interactive `.gitignore` merge — **nothing is ever added without asking**. The packaged template's titled sections are offered one by one (`Add/update .gitignore section '<title>' (N new line(s))? [y/N]`); sections with nothing new are skipped silently. Non-interactive runs (or no tty) change nothing at all. Never touches existing project content. Also offers (git repos only) to keep `.serena/`/`raw/`/`wiki/` out of git via **`.git/info/exclude`** — never `.gitignore`, which would blind Serena on the wiki (see `wiki/knowledge/concepts/git-ignore-tool-visibility.md`); per-machine and idempotent. `info/exclude` *is* honored by ripgrep-class walkers and the `@` file picker, so the excluded paths are written under a `# bootstrap wiki & agent state (machine-local)` sentinel that the `fileSuggestion` picker installed by `install-global.sh` reads back to restore `@`-autocomplete. |
| `merge-settings-deny.js` | `install-global.sh` | Zero-dependency Node script that merges the canonical permission deny list (`templates/settings-deny.json` — `Bash(...)` command patterns plus `Edit(...)`/`Read(...)` file-tool patterns) into `~/.claude/settings.json` `permissions.deny`. Entries are opaque strings, so any rule form the permission system accepts merges unchanged. Additive union only: missing entries are appended, user entries are never removed or reordered, all other settings keys pass through untouched. Atomic write, preserves existing indentation, and always exits 0 (warns + skips on unparseable or unexpected file shapes so an install never aborts over a settings merge). `--target`/`--source` flags exist as test seams. A second mode, `--set-key <name> --set-value <json>`, merges a single top-level settings key instead of the deny list (used to register `fileSuggestion`): absent → set; already deep-equal → no-op; present but different → one-line warning and skip, never a clobber. Supplying `--set-key` skips the deny merge entirely; a malformed `--set-value` exits 1, since that is a call-site bug rather than a user's file. |
| `merge-settings-hooks.js` | `install-global.sh` | Zero-dependency Node sibling of `merge-settings-deny.js` (deliberately not a new mode of it — different, block-and-entry-aware semantics) that merges the canonical hook wiring (`templates/settings-hooks.json`) into the `hooks` key of `~/.claude/settings.json` with a "template owns its blocks" model: repo-owned entries (a `command` under `~/.claude/hooks/` whose basename appears in the template) are created or updated in place; matcher drift on a pure-owned block is adopted (a matcher rename ships without duplicating the block); user/foreign blocks and entries are never modified, reordered, or removed; a repo hook found relocated into a mixed block is warned about but not duplicated; no empty placeholder blocks are ever written. Always exits 0 (warns + skips on unparseable or unexpected file shapes so an install never aborts over a settings merge). `--target`/`--source` flags exist as test seams. |

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
| `templates/guides/stubs/` | `build-mcp-guide.sh` | Per-MCP-server markdown fragments (`serena.md`, `context7.md`, `brave-search.md`, `playwright.md`) plus `00-header.md` (the shared top-of-file rules), assembled into `wiki/guides/mcp-tools.md`. |
| `templates/CLAUDE-wiki.md` | `sync-wiki-scaffold.sh` | The `## LLM Wiki` schema section delivered into a target project's `CLAUDE.md` (copy-once, sentinel-guarded). |
| `templates/CLAUDE-env-safety.md` | `sync-wiki-scaffold.sh` | The `.env` read/write safety policy prepended to a target project's `CLAUDE.md` (copy-once, never duplicated). |
| `templates/gitignore` | `merge-gitignore.sh` | Packed copy of this repo's own `.gitignore` (dotfiles aren't included in npm packages, so it's shipped under a non-dot name and renamed on copy). |
| `templates/file-suggestion.sh` | `install-global.sh` | The `fileSuggestion` `@`-autocomplete picker, copied to `~/.claude/file-suggestion.sh`. Reads the picker's stdin JSON `query` with `sed` (no `jq`), lists the project from `rg --files` (falling back to `git ls-files`, then `find`), and re-includes the paths under the `# bootstrap wiki & agent state (machine-local)` sentinel in `.git/info/exclude` — so bootstrap's hidden dirs are suggestible again while a user's other `info/exclude` entries stay hidden. Always exits 0. |
| `templates/settings-deny.json` | `merge-settings-deny.js` | The canonical `permissions.deny` list (bare JSON array of rule strings). Covers **both** `Bash(...)` command patterns (destructive disk/system commands, `sudo`, permission footguns, git working-tree/history protections, macOS persistence, credential exfiltration, fetch-and-execute) **and** file-tool path patterns — `Edit(...)` / `Read(...)` — protecting Claude Code's own settings and hooks, shell profiles, git config, and credential stores. Audited against the Claude Code permission-rule docs; merged additively into `~/.claude/settings.json` on every `install`/`setup`/`update`. See [Deny-list notes](#deny-list-notes) for the enforcement model and known costs. |
| `templates/settings-hooks.json` | `merge-settings-hooks.js` | The canonical hook wiring — a bare hooks-value object (the value of the settings `hooks` key, not a full settings file) covering 4 events (`SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`) whose entries map 1:1 onto the 18 hook scripts in `lib/hooks/*.js`. The single source of truth for the wiring merged into `~/.claude/settings.json` on every `install`/`setup`/`update`; each block's matcher is load-bearing (see `lib/hooks/README.md`), which is why the wiring ships as a template instead of being hand-pasted. |

## Deny-list notes

### What deny rules do and don't cover

`permissions.deny` rules are enforced in **every** permission mode — including
`bypassPermissions` (`--dangerously-skip-permissions`, power-mode teammates,
subagents) — and for both main-session and subagent tool calls. No `allow` rule
at any scope can override a `deny` rule.

Two structural limits, neither mode-dependent:

- **Deny matches a literal command spelling, not a capability.** `Bash(rm -rf ~*)`
  does not stop `/bin/rm -rf ~`, and no deny rule can see inside `bash -c`,
  `python -c`, or `node -e`. Blocking a *capability* needs a `PreToolUse` hook
  (which parses the command) or the OS sandbox.
- **Deny rules cannot carry allowlist exceptions.** A broad deny blocks every
  matching call even when a narrower `allow` rule also matches. So
  `Bash(git stash:*)` also blocks read-only `git stash list`, and
  `Bash(crontab *)` also blocks `crontab -l`. Where an exception is genuinely
  needed, use `permissions.ask` or a hook, not deny.

File-tool rules are `Edit(...)` and `Read(...)` only. **`Write(...)` path rules
are accepted but never consulted** by current Claude Code builds — never author
one. A `Read` deny also blocks `Edit` on the same path.

### Why `~/.claude/settings.json` is guarded by a hook, not a deny rule

Protecting Claude Code's own settings is the highest-value control here: it stops
an agent granting itself permissions or installing a hook that fires on every
tool call, and Claude Code hot-reloads both files so such a write takes effect
immediately. It matters *most* under `bypassPermissions`, where Claude Code's
built-in protection for `.claude` paths is **not** applied.

That protection lives in a `PreToolUse` hook (`claude-settings-guard.js`) rather
than in this deny list. `claude-settings-guard.js` blocks `Edit`/`Write`/
`NotebookEdit`/`MultiEdit` on `~/.claude/settings.json` and `settings.local.json`
**unconditionally** — the verdict does not depend on cwd.

*History worth knowing, because the code changed under it:* the deny entries were
originally removed to make room for a bootstrap-claude carve-out, on the belief
that this repo needs to edit those files. **It does not.** The repo writes them
through `node merge-settings-deny.js` *inside* `install-global.sh` — a Bash
subprocess that no hook and no permission rule ever observes. The exception was
never load-bearing and was removed on 2026-07-30, after it was demonstrated that
any agent running in this repo could rewrite its own permission boundary with a
plain `Edit` call.

The deny entries stay out, but now by choice rather than necessity: the merge is
additive-only with **no removal path**, so restoring them is permanent for every
installed user, and the hook already covers the same paths *plus* the `Write` and
`NotebookEdit` surfaces that `Edit(...)` rules never reach. Restore them only if
the hook proves unreliable.

**`~/.claude/hooks/**` stays in the deny list with no exception**, including
inside this repo. The canonical flow there is to edit `lib/hooks/` and re-run
`install-global.sh`; editing the installed copy directly is always wrong.

**Residual risk, accepted:** an agent working inside bootstrap-claude can still
self-grant permissions by editing global settings. That is the deliberate cost of
making this repo able to do its job — containment for that case is the OS sandbox
(`/sandbox`), not this layer.
