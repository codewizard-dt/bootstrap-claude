---
id: TASK-053
title: "Add lib/scripts/install-obsidian.sh (app + plugin auto-install)"
status: done
created: 2026-08-13
updated: 2026-08-14
depends_on: []
blocks: [TASK-055, TASK-058, TASK-059]
parallel_safe_with: [TASK-054, TASK-056, TASK-057]
uat: "[[UAT-053]]"
tags: [obsidian, installer, automation]
---

# TASK-053 — Add lib/scripts/install-obsidian.sh (app + plugin auto-install)

## Objective

Create a new guarded, cross-platform installer script for the Obsidian app and its three recommended plugins (Dataview, Graph Link Types, Breadcrumbs), reusing this repo's existing guarded/opt-in install pattern (see `lib/scripts/install-mcps.sh`'s `register_optional_mcp`/`_add_playwright`/`_add_brave`, and the write-up at `wiki/knowledge/entities/components/bootstrap-guarded-install-pattern.md`).

## Approach

Two independent pieces, each guarded so failure never aborts the caller:

1. **App install** — detect OS via `uname -s`. macOS: `brew install --cask obsidian`. Linux: `flatpak install -y flathub md.obsidian.Obsidian` (guard on `command -v flatpak` first; warn+skip if absent). Other platforms (including Windows, since this repo's scripts run under bash): print a manual-install pointer to https://obsidian.md/download rather than attempting anything. Short-circuit if already installed: check `/Applications/Obsidian.app` on macOS, `flatpak list 2>/dev/null | grep -q md.obsidian.Obsidian` on Linux, before prompting.
2. **Plugin install** — for each of three plugins (repo slugs pinned as constants at the top of the script: `blacksmithgu/obsidian-dataview`, `natefrisch01/Graph-Link-Types`, and Breadcrumbs' repo — use `SkepticMystic/breadcrumbs` as the constant with a `# NOTE:` comment that this needs verifying against the maintained fork at install time, since prior research flagged an in-progress maintainer transition): `curl -fsSL https://api.github.com/repos/<owner>/<repo>/releases/latest`, parse the JSON response for asset download URLs (use a small `node -e` snippet with `JSON.parse`, matching the inline-node-JSON style already used in `install-mcps.sh`'s `_disable_project_projector_locally` — actually named `_disable_project_playwright_locally`, follow that function's exact style/error-handling pattern). Download `manifest.json` FIRST and read its `.id` field — this is the authoritative plugin directory name, NOT the GitHub repo name. Create `$PROJECT_DIR/.obsidian/plugins/<id>/`, download `main.js` (required) into it, and `styles.css` only if that asset exists in the release. Then merge `<id>` into `$PROJECT_DIR/.obsidian/community-plugins.json` via an idempotent `node -e` JSON merge (create as `["<id>"]` if the file is absent; append `<id>` only if not already present) — same idempotent-merge shape as `_disable_project_playwright_locally`. Warn and skip (never abort the whole script) on any curl failure, missing asset, or malformed JSON.

Vault root = `$PROJECT_DIR` (the project root passed via `--project-dir`), matching how this repo's own `.gitignore` already expects `.obsidian/` to live at the repo root.

Gating: app install behind ONE sticky prompt keyed `obsidian.installApp` (global scope — the key's schema-doc entry is being added in a sibling task, TASK-054, in parallel; reference the key by name, it doesn't need to exist in the schema file yet for `prompt_yn_sticky`/`prefs_get`/`prefs_set` to function generically). Plugin install behind ONE bundled sticky prompt keyed `obsidian.plugins` (project scope) covering all three plugins together — do not ask separately per plugin.

## Steps

### 1. Script skeleton & flags <!-- agent: general-purpose -->

- [x] Create `lib/scripts/install-obsidian.sh`. Source `lib.sh` (`SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; . "$SCRIPT_DIR/lib.sh"`), matching `install-mcps.sh`'s header exactly.
  - Parse `--interactive` and `--project-dir <dir>` flags identically to `install-mcps.sh`'s flag-parsing loop (lines 16-25).

<!-- Updated: 2026-08-13 00:00 -->

### 2. App install adder <!-- agent: general-purpose -->

- [x] Implement `_install_obsidian_app()`: OS detection via `uname -s`, already-installed short-circuit, guarded `brew install --cask obsidian` (Darwin) / `flatpak install -y flathub md.obsidian.Obsidian` (Linux, guarded on `command -v flatpak`) / manual-pointer fallback (other), never aborting on failure — `|| echo "  WARNING: ..."` in the same style as `_add_playwright`'s guarded steps.

<!-- Updated: 2026-08-13 00:00 -->

### 3. Plugin fetch helper <!-- agent: general-purpose -->

- [x] Implement `_install_obsidian_plugin(vault_dir, owner_repo)`: fetch `releases/latest` from GitHub's API, download `manifest.json` first and parse its `id` field via `node -e`, create `$vault_dir/.obsidian/plugins/<id>/`, download `main.js` (required) + `styles.css` (if present). Pin the three plugin repo slugs as named constants near the top of the script.

<!-- Updated: 2026-08-13 00:00 -->

### 4. Enable-in-vault helper <!-- agent: general-purpose -->

- [x] Implement `_enable_obsidian_plugin(vault_dir, id)`: idempotent `node -e` JSON merge of `<id>` into `$vault_dir/.obsidian/community-plugins.json` (create as `["<id>"]` if absent, else append if missing), mirroring `_disable_project_playwright_locally`'s error-handling shape (warn + skip on unparseable/unexpected file shape rather than crashing).

<!-- Updated: 2026-08-13 00:00 -->

### 5. Top-level orchestration <!-- agent: general-purpose -->

- [x] Gate app install behind `prompt_yn_sticky obsidian.installApp --global "Install the Obsidian app (recommended local viewer for wiki/ — https://obsidian.md)? [Y/n]: "` in interactive mode; in non-interactive mode, only a stored `false` diverts (mirror `register_optional_mcp`'s non-interactive branch exactly — read the preference directly via `prefs_get`, never through a prompt helper).
  - Gate plugin install behind `prompt_yn_sticky obsidian.plugins "$PROJECT_DIR" "Install recommended Obsidian plugins (Dataview, Graph Link Types, Breadcrumbs) into this project's vault config? [Y/n]: "`; on accept, loop the three plugin constants through `_install_obsidian_plugin` then `_enable_obsidian_plugin`.
  - Never let any single step's failure abort the script (`set -euo pipefail` still applies at the top, so every risky command needs explicit `|| { ...; return/continue; }` handling, matching the rest of this codebase's guarded-install style).

<!-- Updated: 2026-08-13 00:00 -->

### 6. Finalize <!-- agent: general-purpose -->

- [x] `chmod +x lib/scripts/install-obsidian.sh` after creation.
  - Do NOT wire this script into `lib/scripts/lib.sh`'s `run_project_sync()` — that is TASK-055, a separate task, intentionally sequenced after this one.
  - Do NOT add the `obsidian.installApp`/`obsidian.plugins` schema-doc entries to `bootstrap-prefs-schema.json` — that is TASK-054, running in parallel with this one.

<!-- Updated: 2026-08-13 00:00 -->

## Notes

Derived from `raw/research/obsidian-setup-automation/index.md`'s Recommendation section and `wiki/work/roadmaps/ROADMAP-006-obsidian-plugin-automation.md` Phase 1.

- Closes [[BUG-0011]] (2026-08-14) — `_install_obsidian_plugin` now copies `manifest.json` into the plugin directory instead of discarding it. Fix commit `e71ded6`.
