#!/usr/bin/env bash
set -euo pipefail

# install-obsidian.sh [--interactive] [--project-dir <dir>]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

INTERACTIVE=false
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interactive) INTERACTIVE=true; shift ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Plugin repo slugs, pinned as named constants (never fetched or derived at
# runtime) so every releases/latest lookup below is driven by one audited
# value per plugin.
PLUGIN_DATAVIEW="blacksmithgu/obsidian-dataview"
PLUGIN_GRAPH_LINK_TYPES="natefrisch01/Graph-Link-Types"
# NOTE: prior research flagged an in-progress maintainer transition for
# Breadcrumbs — verify SkepticMystic/breadcrumbs is still the maintained fork
# at install time (vs. a community fork) before relying on this constant.
PLUGIN_BREADCRUMBS="SkepticMystic/breadcrumbs"

_install_obsidian_app() {
  local os
  os="$(uname -s)"

  case "$os" in
    Darwin)
      if [ -d /Applications/Obsidian.app ]; then
        echo "  Obsidian.app already installed — skipping."
        return 0
      fi
      brew install --cask obsidian \
        || echo "  WARNING: 'brew install --cask obsidian' failed — install Obsidian manually from https://obsidian.md/download"
      ;;
    Linux)
      if flatpak list 2>/dev/null | grep -q md.obsidian.Obsidian; then
        echo "  Obsidian (flatpak) already installed — skipping."
        return 0
      fi
      if ! command -v flatpak >/dev/null 2>&1; then
        echo "  WARNING: flatpak not found — install Obsidian manually from https://obsidian.md/download"
        return 0
      fi
      flatpak install -y flathub md.obsidian.Obsidian \
        || echo "  WARNING: 'flatpak install -y flathub md.obsidian.Obsidian' failed — install Obsidian manually from https://obsidian.md/download"
      ;;
    *)
      echo "  Obsidian: no automated installer for '$os' — install manually from https://obsidian.md/download"
      ;;
  esac
}

# _gh_release_asset_url <release_json_file> <asset_name>
# Prints the browser_download_url of a named asset from a GitHub
# releases/latest JSON payload already saved to disk; prints nothing if the
# asset is absent OR the file isn't parseable JSON in the expected shape —
# callers treat "empty" as the single signal to warn and skip, so a bare
# `node -e` failure can never trip `set -e` here. Mirrors the
# JSON.parse + readFileSync + try/catch style used by install-mcps.sh's
# _disable_project_playwright_locally.
_gh_release_asset_url() {
  node -e '
    const fs = require("fs");
    try {
      const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const asset = (data.assets || []).find((a) => a.name === process.argv[2]);
      if (asset && asset.browser_download_url) console.log(asset.browser_download_url);
    } catch (e) {
      // Malformed JSON or unexpected shape — print nothing; the caller warns
      // on the resulting empty string rather than on a node exit code.
    }
  ' "$1" "$2"
}

# _install_obsidian_plugin <vault_dir> <owner_repo>
# Installs one community plugin from its GitHub releases/latest into
# <vault_dir>/.obsidian/plugins/<id>/, where <id> comes from the release's
# manifest.json — the authoritative plugin directory name, NOT the GitHub
# repo name. manifest.json is downloaded and parsed FIRST, before anything
# else. Every risky step (curl, JSON parsing, mkdir) warns to stderr and
# returns rather than aborting the script, so one bad/renamed plugin repo
# never blocks the other two or the rest of the install.
#
# Prints the resolved plugin id to stdout as its ONLY stdout output — bash
# functions can't return strings, so the caller captures it via:
#   plugin_id="$(_install_obsidian_plugin "$vault_dir" "$owner_repo")"
# All diagnostics go to stderr (`>&2`) specifically so they never end up
# inside that captured value.
_install_obsidian_plugin() {
  local vault_dir="$1" owner_repo="$2"
  local release_tmp manifest_tmp manifest_url main_js_url styles_css_url
  local plugin_id plugin_dir

  release_tmp="$(mktemp)"
  if ! curl -fsSL "https://api.github.com/repos/${owner_repo}/releases/latest" -o "$release_tmp"; then
    echo "  WARNING: ${owner_repo}: failed to fetch latest release — skipping plugin." >&2
    rm -f "$release_tmp"
    return
  fi
  if [ ! -s "$release_tmp" ]; then
    echo "  WARNING: ${owner_repo}: empty release response — skipping plugin." >&2
    rm -f "$release_tmp"
    return
  fi

  manifest_url="$(_gh_release_asset_url "$release_tmp" manifest.json)"
  if [ -z "$manifest_url" ]; then
    echo "  WARNING: ${owner_repo}: latest release has no manifest.json asset (or the release JSON was malformed) — skipping plugin." >&2
    rm -f "$release_tmp"
    return
  fi

  manifest_tmp="$(mktemp)"
  if ! curl -fsSL "$manifest_url" -o "$manifest_tmp"; then
    echo "  WARNING: ${owner_repo}: failed to download manifest.json — skipping plugin." >&2
    rm -f "$release_tmp" "$manifest_tmp"
    return
  fi

  plugin_id="$(node -e '
    const fs = require("fs");
    try {
      const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      if (data && typeof data.id === "string" && data.id) console.log(data.id);
    } catch (e) {
      // Malformed manifest.json — print nothing; caller warns on the empty
      // result below.
    }
  ' "$manifest_tmp")"
  if [ -z "$plugin_id" ]; then
    echo "  WARNING: ${owner_repo}: manifest.json is missing/malformed its 'id' field — skipping plugin." >&2
    rm -f "$release_tmp" "$manifest_tmp"
    return
  fi

  plugin_dir="$vault_dir/.obsidian/plugins/$plugin_id"
  if ! mkdir -p "$plugin_dir"; then
    echo "  WARNING: ${owner_repo}: failed to create $plugin_dir — skipping plugin." >&2
    rm -f "$release_tmp" "$manifest_tmp"
    return
  fi

  # Obsidian requires manifest.json inside the plugin's own directory to
  # recognize and load it — copy the file we already fetched (and already
  # parsed plugin_id from) rather than re-downloading it. See BUG-0011: an
  # earlier version parsed plugin_id from manifest_tmp and then discarded it
  # without ever writing it into plugin_dir, so every plugin ended up enabled
  # in community-plugins.json but missing the manifest Obsidian needs to load it.
  if ! cp "$manifest_tmp" "$plugin_dir/manifest.json"; then
    echo "  WARNING: ${owner_repo}: failed to write manifest.json into $plugin_dir — skipping plugin." >&2
    rm -f "$release_tmp" "$manifest_tmp"
    return
  fi

  main_js_url="$(_gh_release_asset_url "$release_tmp" main.js)"
  if [ -z "$main_js_url" ]; then
    echo "  WARNING: ${owner_repo}: latest release has no main.js asset — skipping plugin." >&2
    rm -f "$release_tmp" "$manifest_tmp"
    return
  fi
  if ! curl -fsSL "$main_js_url" -o "$plugin_dir/main.js"; then
    echo "  WARNING: ${owner_repo}: failed to download main.js — skipping plugin." >&2
    rm -f "$release_tmp" "$manifest_tmp"
    return
  fi

  # styles.css is optional — silently skip when the release doesn't ship one.
  styles_css_url="$(_gh_release_asset_url "$release_tmp" styles.css)"
  if [ -n "$styles_css_url" ]; then
    curl -fsSL "$styles_css_url" -o "$plugin_dir/styles.css" \
      || echo "  WARNING: ${owner_repo}: failed to download styles.css — continuing without it." >&2
  fi

  rm -f "$release_tmp" "$manifest_tmp"
  echo "$plugin_id"
}

# _enable_obsidian_plugin <vault_dir> <id>
# Idempotently adds <id> to <vault_dir>/.obsidian/community-plugins.json —
# creates the file as ["<id>"] if absent (mkdir -p'ing .obsidian first), else
# appends <id> only if not already present. Mirrors install-mcps.sh's
# _disable_project_playwright_locally: warns and skips (never crashes or
# overwrites) on unparseable JSON or an unexpected (non-array) shape, and
# never aborts the calling script on any failure.
_enable_obsidian_plugin() {
  local vault_dir="$1" id="$2"
  node -e '
    const fs = require("fs"), path = require("path");
    const vaultDir = process.argv[1], id = process.argv[2];
    const dir = path.join(vaultDir, ".obsidian");
    const file = path.join(dir, "community-plugins.json");
    let list;
    if (fs.existsSync(file)) {
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (e) {
        console.error("  WARNING: could not parse " + file + " — skipping enable for " + id + ".");
        process.exit(0);
      }
      if (!Array.isArray(raw)) {
        console.error("  WARNING: " + file + " is not a JSON array — skipping enable for " + id + ".");
        process.exit(0);
      }
      list = raw;
    } else {
      list = [];
    }
    if (list.includes(id)) {
      console.log("  " + id + ": already enabled in " + file + ".");
      process.exit(0);
    }
    list.push(id);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + ".tmp-" + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2) + "\n");
    fs.renameSync(tmp, file);
    console.log("  " + id + ": enabled in " + file + ".");
  ' "$vault_dir" "$id" || true
}

_install_obsidian_graph_defaults() {
  local vault_dir="$1"

  if ! mkdir -p "$vault_dir/.obsidian"; then
    echo "  WARNING: failed to create $vault_dir/.obsidian — skipping graph defaults." >&2
    return
  fi

  if [ -f "$vault_dir/.obsidian/graph.json" ]; then
    echo "  .obsidian/graph.json already present — leaving your customization in place, skipping."
    return 0
  fi

  if ! cp "$SCRIPT_DIR/templates/obsidian/graph.json" "$vault_dir/.obsidian/graph.json"; then
    echo "  WARNING: failed to install graph defaults — skipping." >&2
    return
  fi
}

# ---------------------------------------------------------------------------
# App install gate
#
# Interactive: prompt_yn_sticky handles the ask-once/remember dance itself.
# Non-interactive: mirror register_optional_mcp's non-interactive branch
# (install-mcps.sh) exactly — read the stored preference directly via
# prefs_get, never through a prompt helper (prompt_yn_sticky auto-answers
# "no" with no tty, which is the wrong default here), and only an explicit
# stored `false` diverts. `true`, `ask`, and `unset` all proceed with the
# install, same as register_optional_mcp.
# ---------------------------------------------------------------------------
if [ "$INTERACTIVE" = true ]; then
  if prompt_yn_sticky obsidian.installApp --global "Install the Obsidian app (recommended local viewer for wiki/ — https://obsidian.md)? [Y/n]: "; then
    _install_obsidian_app || echo "  WARNING: Obsidian app install failed — continuing."
  else
    echo "  Skipping Obsidian app install."
  fi
else
  if [ "$(prefs_get obsidian.installApp --global)" = "false" ]; then
    echo "  obsidian.installApp: skipped (remembered decline — change with /bootstrap-config)"
  else
    _install_obsidian_app || echo "  WARNING: Obsidian app install failed — continuing."
  fi
fi

# ---------------------------------------------------------------------------
# Plugin install gate
#
# obsidian.plugins is a project-scoped key — the vault root is $PROJECT_DIR,
# so its prompt_yn_sticky/prefs_get selector is "$PROJECT_DIR" itself (never
# --global), per the selector-consistency rule documented on prompt_yn_sticky
# in lib.sh. No $PROJECT_DIR means no vault to install into, so skip outright
# rather than guessing a location.
# ---------------------------------------------------------------------------
if [ -z "$PROJECT_DIR" ]; then
  echo "  WARNING: no --project-dir given — skipping Obsidian plugin install."
else
  install_plugins=false
  if [ "$INTERACTIVE" = true ]; then
    if prompt_yn_sticky obsidian.plugins "$PROJECT_DIR" "Install recommended Obsidian plugins (Dataview, Graph Link Types, Breadcrumbs) into this project's vault config? [Y/n]: "; then
      install_plugins=true
    fi
  else
    # Same non-interactive mirroring as the app-install gate above, applied
    # to the project-scoped key: only a stored `false` skips.
    if [ "$(prefs_get obsidian.plugins "$PROJECT_DIR")" = "false" ]; then
      echo "  obsidian.plugins: skipped (remembered decline — change with /bootstrap-config)"
    else
      install_plugins=true
    fi
  fi

  if [ "$install_plugins" = true ]; then
    for plugin_repo in "$PLUGIN_DATAVIEW" "$PLUGIN_GRAPH_LINK_TYPES" "$PLUGIN_BREADCRUMBS"; do
      plugin_id="$(_install_obsidian_plugin "$PROJECT_DIR" "$plugin_repo")" || plugin_id=""
      if [ -n "$plugin_id" ]; then
        _enable_obsidian_plugin "$PROJECT_DIR" "$plugin_id" || true
      fi
      # Empty $plugin_id means _install_obsidian_plugin already warned
      # internally — just move on to the next plugin.
    done
  else
    echo "  Skipping Obsidian plugin install."
  fi
fi

# ---------------------------------------------------------------------------
# Graph defaults install gate
#
# obsidian.graphDefaults is a project-scoped key — the vault root is $PROJECT_DIR,
# so its prompt_yn_sticky/prefs_get selector is "$PROJECT_DIR" itself (never
# --global), per the selector-consistency rule documented on prompt_yn_sticky
# in lib.sh. No $PROJECT_DIR means no vault to install into, so skip outright
# rather than guessing a location.
# ---------------------------------------------------------------------------
if [ -z "$PROJECT_DIR" ]; then
  echo "  WARNING: no --project-dir given — skipping Obsidian graph defaults install."
else
  if [ "$INTERACTIVE" = true ]; then
    if prompt_yn_sticky obsidian.graphDefaults "$PROJECT_DIR" "Install default graph-view styling (.obsidian/graph.json — colors wiki/knowledge and wiki/work/* by family, scopes the graph to path:wiki)? [Y/n]: "; then
      _install_obsidian_graph_defaults "$PROJECT_DIR"
    else
      echo "  Skipping Obsidian graph defaults install."
    fi
  else
    # Same non-interactive mirroring as the app-install gate above, applied
    # to the project-scoped key: only a stored `false` skips.
    if [ "$(prefs_get obsidian.graphDefaults "$PROJECT_DIR")" = "false" ]; then
      echo "  obsidian.graphDefaults: skipped (remembered decline — change with /bootstrap-config)"
    else
      _install_obsidian_graph_defaults "$PROJECT_DIR"
    fi
  fi
fi
