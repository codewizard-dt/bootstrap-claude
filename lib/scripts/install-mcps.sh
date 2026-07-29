#!/usr/bin/env bash
set -euo pipefail

# install-mcps.sh [--interactive] [--project-dir <dir>]
#
# Without --interactive: installs all missing MCPs at user scope without prompting
#   (current install-global.sh behaviour — used by `bootstrap install`)
# With --interactive --project-dir <dir>: prompts for each missing MCP and asks scope
#   (used by setup-project.sh and update-project.sh)
#
# Serena is only offered when --project-dir is provided (it requires an absolute project path).

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

# Single source of truth for the local MCP ports/URLs (env-overridable):
# registration, upgrade checks, and epilogue text all derive from these.
BRAVE_MCP_PORT="${BRAVE_MCP_PORT:-8941}"
PLAYWRIGHT_MCP_PORT="${PLAYWRIGHT_MCP_PORT:-8931}"
BRAVE_MCP_URL="http://127.0.0.1:${BRAVE_MCP_PORT}/mcp"
# playwright MUST be addressed as `localhost`, not 127.0.0.1: @playwright/mcp's
# DNS-rebinding guard only accepts the `localhost` Host header (even when the
# server is started with --host 127.0.0.1) — 127.0.0.1 URLs get 403 "Access is
# only allowed at localhost:<port>". Found by TASK-025 runtime UAT.
PLAYWRIGHT_MCP_URL="http://localhost:${PLAYWRIGHT_MCP_PORT}/mcp"
# Default server name. When a project already ships its own `playwright`
# registration, the interactive conflict flow (see _install_playwright_flow)
# may register ours under the alternate name below instead — a team's
# committed .mcp.json is never edited.
PLAYWRIGHT_MCP_NAME="${PLAYWRIGHT_MCP_NAME:-playwright}"
PLAYWRIGHT_MCP_ALT_NAME="${PLAYWRIGHT_MCP_ALT_NAME:-playwright-shared}"

# mcp_installed, serena_installed, prompt_yn, prompt_scope live in lib.sh.

# mcp_add_scoped <scope> <claude-mcp-add-args...>
# Runs `claude mcp add --scope <scope> <args...>`. For project scope, cd into
# PROJECT_DIR first (project MCPs are written relative to cwd); if project scope
# is requested without a PROJECT_DIR, fall back to user scope.
mcp_add_scoped() {
  local scope="$1"; shift
  if [ "$scope" = "project" ] && [ -n "$PROJECT_DIR" ]; then
    ( cd "$PROJECT_DIR" && claude mcp add --scope project "$@" )
  else
    claude mcp add --scope user "$@"
  fi
}

# register_optional_mcp <name> <interactive-prompt> <adder-fn> [expected] [fixed_scope]
# Common wrapper for the optional MCPs (brave-search / context7 / playwright):
# skip if already installed; in interactive mode gate on a y/n prompt and ask
# for scope; otherwise install non-interactively at user scope. <adder-fn>
# performs the actual `claude mcp add` (including any API-key prompting) and
# receives the resolved scope ("user" | "project") as its only argument.
# Optional [expected]: a string the existing registration must contain (checked
# via mcp_matches, lib.sh). If installed but not matching, a stale USER-scope
# registration is removed and the adder re-run at user scope (upgrade path).
# A project/local-scoped registration under the same name is never removed —
# it is repository/machine config we don't own; we skip and say so.
# Optional [fixed_scope]: skip the scope prompt and use this scope (for MCPs
# that only support one scope — asking and ignoring the answer is worse).
register_optional_mcp() {
  local name="$1" prompt="$2" adder="$3" expected="${4:-}" fixed_scope="${5:-}" scope cur_scope
  if mcp_installed "$name"; then
    if [ -z "$expected" ] || mcp_matches "$name" "$expected"; then
      echo "  $name: already installed, skipping."
      return 0
    fi
    cur_scope="$(mcp_scope_of "$name")"
    if [ "$cur_scope" != "user" ]; then
      echo "  $name: registered at ${cur_scope} scope with a different config — leaving it untouched."
      echo "  To adopt the bootstrap-managed server instead: claude mcp remove $name -s ${cur_scope} (inside the project), then re-run 'npx @codewizard-dt/bootstrap update'."
      return 0
    fi
    echo "  $name: upgrading registration (stdio → shared http)."
    claude mcp remove "$name" -s user 2>/dev/null || true
    "$adder" user
    return 0
  fi
  if [ "$INTERACTIVE" = true ]; then
    if prompt_yn "$prompt"; then
      if [ -n "$fixed_scope" ]; then
        scope="$fixed_scope"
      else
        scope="$(prompt_scope "$name")"
      fi
      "$adder" "$scope"
      echo "  $name MCP installed."
    fi
  else
    echo "  Installing $name MCP..."
    "$adder" user
    echo "  $name MCP installed."
  fi
}

# Per-MCP adders. Each takes the resolved scope as $1 and preserves the exact
# interactive vs non-interactive key-prompting behaviour of the original blocks.
_add_brave() {
  if [ "$INTERACTIVE" = true ]; then
    read -r -p "  BRAVE_API_KEY (get one at https://brave.com/search/api/): " BRAVE_API_KEY || true
  elif [ -z "${BRAVE_API_KEY:-}" ]; then
    echo -n "  Enter your Brave Search API key (get one at https://brave.com/search/api/): "
    read -r BRAVE_API_KEY || true
  fi
  if [ -z "${BRAVE_API_KEY:-}" ]; then
    echo "  No BRAVE_API_KEY provided — skipping brave-search registration."
    return 0
  fi
  docker info >/dev/null 2>&1 || { echo "  Docker not running — skipping brave-search (re-run 'bootstrap update' with Docker up)"; return 0; }
  # Migrate any pre-existing container based on its entrypoint:
  case "$(docker inspect -f '{{.Path}}' brave-search-mcp 2>/dev/null)" in
    sleep) docker rm -f brave-search-mcp >/dev/null ;;   # old exec-wrapper container
    node)  docker start brave-search-mcp >/dev/null 2>&1 || true ;;  # already converted
  esac
  if ! docker inspect brave-search-mcp >/dev/null 2>&1; then
    # Key is baked into the container env (visible via `docker inspect` to
    # docker-socket holders; accepted trade-off — it stays out of ~/.claude.json).
    # Rotation: `docker rm -f brave-search-mcp` + re-run `bootstrap update`.
    # Prefix assignment is required: value-less `-e BRAVE_API_KEY` only forwards
    # EXPORTED vars, and `read` doesn't export.
    BRAVE_API_KEY="$BRAVE_API_KEY" docker run -d --restart unless-stopped \
      --name brave-search-mcp -e BRAVE_API_KEY \
      -p "127.0.0.1:${BRAVE_MCP_PORT}:8941" docker.io/mcp/brave-search \
      --transport http --host 0.0.0.0 --port 8941
  fi
  # Always user scope: a project-scoped brave entry would shadow the global one.
  mcp_add_scoped user brave-search --transport http "$BRAVE_MCP_URL"
  wait_http_up "$BRAVE_MCP_URL" && echo "  brave-search: listening on $BRAVE_MCP_URL" \
    || echo "  WARNING: brave-search endpoint not answering — check 'docker logs brave-search-mcp'"
  echo "  Tip: enable Docker Desktop's \"Start when you sign in\" so brave-search comes back after reboots."
}

_add_context7() {
  if [ "$INTERACTIVE" = true ]; then
    read -r -p "  CONTEXT7_API_KEY (optional — press Enter to skip; get one at https://context7.com/dashboard): " CONTEXT7_API_KEY || true
  elif [ -z "${CONTEXT7_API_KEY:-}" ]; then
    echo -n "  Enter your Context7 API key (optional — press Enter to skip, get one at https://context7.com/dashboard): "
    read -r CONTEXT7_API_KEY || true
  fi
  if [ -n "${CONTEXT7_API_KEY:-}" ]; then
    # --header is variadic (<header...>) and swallows following positionals —
    # it must come AFTER the name and URL or `claude mcp add` sees no <name>.
    mcp_add_scoped "$1" --transport http \
      context7 https://mcp.context7.com/mcp \
      --header "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}"
  else
    mcp_add_scoped "$1" --transport http \
      context7 https://mcp.context7.com/mcp
  fi
}

# _playwright_bootstrap_agent <gui-domain> <plist>
# launchctl-bootstraps the playwright LaunchAgent into the user's GUI domain.
# Returns 0 on success; 2 when there is no GUI session to bootstrap into
# ("Bootstrap failed: 5" — typical over SSH; hint printed here); 1 on any
# other failure (warning printed, caller falls through to diagnostics).
_playwright_bootstrap_agent() {
  local out
  if out="$(launchctl bootstrap "$1" "$2" 2>&1)"; then
    return 0
  fi
  case "$out" in
    *"Bootstrap failed: 5"*)
      echo "  playwright: no GUI session (running over SSH?) — log into the Mac GUI once, then re-run 'bootstrap update'."
      return 2 ;;
  esac
  echo "  WARNING: launchctl bootstrap failed: $out"
  return 1
}

_add_playwright() {
  # $1 = scope, $2 = server name (defaults to the canonical name)
  local reg_name="${2:-$PLAYWRIGHT_MCP_NAME}"
  if [ "$(uname -s)" != "Darwin" ]; then
    # Non-macOS: per-session stdio server (shared-server wiring is macOS-only for now).
    mcp_add_scoped "$1" "$reg_name" -- npx @playwright/mcp@latest
    return 0
  fi
  # macOS: one shared HTTP server per machine, run as a launchd LaunchAgent in
  # the Aqua (GUI) session so headed browsers keep working. NEVER npx under
  # launchd: agents get PATH=/usr/bin:/bin:/usr/sbin:/sbin, so neither `npx`
  # nor its `#!/usr/bin/env node` shebang resolve — and @latest would force an
  # npm-registry round-trip on every start (offline crash-loop). Instead:
  # install the package globally now and have launchd invoke node directly on
  # the package's cli entry.
  local label plist tmp node_bin pw_cli uid log_file rc
  npm install -g @playwright/mcp@latest \
    || { echo "  ERROR: 'npm install -g @playwright/mcp' failed — fix npm, then re-run 'bootstrap update'."; return 1; }
  node_bin="$(command -v node || true)"
  [ -n "$node_bin" ] \
    || { echo "  ERROR: node not found on PATH — install Node.js, then re-run 'bootstrap update'."; return 1; }
  pw_cli="$(npm root -g)/@playwright/mcp/cli.js"
  [ -f "$pw_cli" ] \
    || { echo "  ERROR: $pw_cli missing — global @playwright/mcp install did not produce a cli entry."; return 1; }
  label="com.bootstrap-claude.playwright-mcp"
  plist="$HOME/Library/LaunchAgents/${label}.plist"
  log_file="$HOME/Library/Logs/playwright-mcp.log"
  uid="$(id -u)"
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
  tmp="$(mktemp)"
  cat > "$tmp" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node_bin}</string>
    <string>${pw_cli}</string>
    <string>--port</string>
    <string>${PLAYWRIGHT_MCP_PORT}</string>
    <string>--host</string>
    <string>127.0.0.1</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>StandardOutPath</key>
  <string>${log_file}</string>
  <key>StandardErrorPath</key>
  <string>${log_file}</string>
  <key>WorkingDirectory</key>
  <string>${HOME}</string>
</dict>
</plist>
PLIST
  rc=0
  if ! cmp -s "$tmp" "$plist"; then
    # New or changed plist: install it and (re)start the agent.
    mv "$tmp" "$plist"
    launchctl bootout "gui/${uid}/${label}" 2>/dev/null || true
    _playwright_bootstrap_agent "gui/${uid}" "$plist" || rc=$?
  else
    rm -f "$tmp"
    if ! launchctl print "gui/${uid}/${label}" >/dev/null 2>&1; then
      # Plist unchanged but agent not loaded (fresh login session / prior bootout).
      _playwright_bootstrap_agent "gui/${uid}" "$plist" || rc=$?
    fi
  fi
  if [ "$rc" -eq 2 ]; then
    return 0
  fi
  # Always user scope for the shared HTTP server.
  mcp_add_scoped user "$reg_name" --transport http "$PLAYWRIGHT_MCP_URL"
  wait_http_up "$PLAYWRIGHT_MCP_URL" && echo "  $reg_name: listening on $PLAYWRIGHT_MCP_URL" \
    || { echo "  WARNING: $reg_name endpoint not answering — diagnostics:"; \
         launchctl print "gui/${uid}/${label}" 2>/dev/null || true; \
         echo "  Log: ${log_file}"; }
}

# ---------------------------------------------------------------------------
# Serena (always LOCAL scope — only when --project-dir provided)
#
# Local scope stores the entry in ~/.claude.json under this project's key:
# per-project (no serena language-config bleed) but machine-local. Project
# scope would write a machine-specific absolute --project path into the repo's
# shareable .mcp.json and force the per-user .mcp.json approval gate — both
# wrong (earlier bootstrap versions did exactly this; migration below).
# ---------------------------------------------------------------------------
if [ -n "$PROJECT_DIR" ]; then
  # Migrate a bootstrap-written serena entry out of the repo's .mcp.json.
  # Consent-gated: .mcp.json may be committed team config, so the removal is
  # offered, never forced; declining keeps the existing entry working.
  if [ -f "$PROJECT_DIR/.mcp.json" ] && grep -q '"serena"' "$PROJECT_DIR/.mcp.json" 2>/dev/null; then
    if [ "$INTERACTIVE" = true ] && prompt_yn "  serena: found in this project's .mcp.json (added by an earlier bootstrap; carries a machine-specific path). Move it to local scope in ~/.claude.json? [y/N]: "; then
      ( cd "$PROJECT_DIR" && claude mcp remove serena -s project ) || true
    else
      echo "  serena: leaving the existing .mcp.json entry in place (migrate later by re-running 'npx @codewizard-dt/bootstrap update')."
    fi
  fi
  if serena_installed "$PROJECT_DIR"; then
    echo "  serena: already registered for this project, skipping."
  elif [ "$INTERACTIVE" = true ]; then
    if prompt_yn "Install Serena MCP (code exploration & editing, always local scope)? [Y/n]: "; then
      ( cd "$PROJECT_DIR" && \
        claude mcp add --scope local serena -- \
          uvx --from git+https://github.com/oraios/serena \
          serena start-mcp-server --context claude-code --project "$PROJECT_DIR" )
      echo "  serena MCP registered (local scope — ~/.claude.json, this machine only)."
    fi
  fi
  # Non-interactive with --project-dir: skip Serena — setup-project.sh previously
  # handled it explicitly; callers that want silent Serena setup do so themselves.
fi

# ---------------------------------------------------------------------------
# Optional MCPs (near-identical wrappers — see register_optional_mcp above)
# ---------------------------------------------------------------------------
register_optional_mcp brave-search \
  "Install Brave Search MCP globally (web research, requires API key + Docker)? [y/N]: " _add_brave "$BRAVE_MCP_URL" user

register_optional_mcp context7 \
  "Install Context7 MCP (library documentation lookups)? [y/N]: " _add_context7

# _disable_project_playwright_locally
# Rejects the project's .mcp.json `playwright` on THIS machine only, via
# disabledMcpjsonServers in $PROJECT_DIR/.claude/settings.local.json — the
# team's .mcp.json is never touched. Idempotent; warns + skips on unparseable
# or unexpected file shapes (same fail-safe posture as merge-settings-deny.js).
_disable_project_playwright_locally() {
  node -e '
    const fs = require("fs"), path = require("path");
    const file = path.join(process.argv[1], ".claude", "settings.local.json");
    let s = {};
    if (fs.existsSync(file)) {
      try { s = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {
        console.error("  WARNING: could not parse " + file + " — skipping local disable."); process.exit(0);
      }
      if (typeof s !== "object" || s === null || Array.isArray(s)) {
        console.error("  WARNING: " + file + " is not a JSON object — skipping local disable."); process.exit(0);
      }
    }
    if ("disabledMcpjsonServers" in s && !Array.isArray(s.disabledMcpjsonServers)) {
      console.error("  WARNING: disabledMcpjsonServers is not an array — skipping local disable."); process.exit(0);
    }
    const list = s.disabledMcpjsonServers || (s.disabledMcpjsonServers = []);
    if (!list.includes("playwright")) list.push("playwright");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp-" + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n");
    fs.renameSync(tmp, file);
    console.log("  playwright: project entry disabled on this machine (.claude/settings.local.json disabledMcpjsonServers).");
  ' "$PROJECT_DIR" || true
}

# _install_playwright_flow
# Dedicated install/conflict logic for playwright (the generic wrapper cannot
# express this). Two variables decide the path: WHERE an existing `playwright`
# registration lives (user / project / local), and — for project scope —
# whether .mcp.json is CHECKED IN (git-tracked ⇒ team-owned, never modified).
_install_playwright_flow() {
  local pw_scope choice expected=""
  [ "$(uname -s)" = "Darwin" ] && expected="$PLAYWRIGHT_MCP_URL"

  # Rename-back: a user-scope `playwright-shared` pointing at our URL is the
  # never-published 2.11.3 naming — fold it back into the canonical name when
  # no conflicting `playwright` blocks that (the conflict branches below keep
  # it as-is, since there it IS the desired registration).
  if ! mcp_installed playwright && mcp_installed "$PLAYWRIGHT_MCP_ALT_NAME" \
    && mcp_matches "$PLAYWRIGHT_MCP_ALT_NAME" "$PLAYWRIGHT_MCP_URL"; then
    echo "  playwright: reverting '$PLAYWRIGHT_MCP_ALT_NAME' back to the canonical name 'playwright'."
    claude mcp remove "$PLAYWRIGHT_MCP_ALT_NAME" -s user 2>/dev/null || true
    _add_playwright user "$PLAYWRIGHT_MCP_NAME"
    return 0
  fi

  if ! mcp_installed playwright; then
    # Fresh install (same gating as register_optional_mcp).
    if [ "$INTERACTIVE" = true ]; then
      if prompt_yn "Install Playwright MCP (browser automation & UI testing)? [y/N]: "; then
        _add_playwright user "$PLAYWRIGHT_MCP_NAME"
        echo "  playwright MCP installed."
      fi
    else
      echo "  Installing playwright MCP..."
      _add_playwright user "$PLAYWRIGHT_MCP_NAME"
      echo "  playwright MCP installed."
    fi
    return 0
  fi

  pw_scope="$(mcp_scope_of playwright)"

  if [ "$pw_scope" = "user" ]; then
    if [ -z "$expected" ] || mcp_matches playwright "$expected"; then
      echo "  playwright: already installed, skipping."
    else
      echo "  playwright: upgrading registration (stdio → shared http)."
      claude mcp remove playwright -s user 2>/dev/null || true
      _add_playwright user "$PLAYWRIGHT_MCP_NAME"
    fi
    # Cleanup a leftover alternate-name duplicate of ours at user scope.
    if mcp_installed "$PLAYWRIGHT_MCP_ALT_NAME" && mcp_matches "$PLAYWRIGHT_MCP_ALT_NAME" "$PLAYWRIGHT_MCP_URL"; then
      echo "  playwright: removing duplicate '$PLAYWRIGHT_MCP_ALT_NAME' user-scope entry."
      claude mcp remove "$PLAYWRIGHT_MCP_ALT_NAME" -s user 2>/dev/null || true
    fi
    return 0
  fi

  # Conflict: playwright registered at project/local scope (or undetectable).
  if [ "$INTERACTIVE" != true ] || [ ! -t 0 ] || [ -z "$PROJECT_DIR" ] || [ "$pw_scope" = "unknown" ]; then
    echo "  playwright: an existing ${pw_scope}-scope registration was found — leaving everything untouched."
    echo "  Resolve interactively: run 'npx @codewizard-dt/bootstrap update' in a terminal to choose how to proceed."
    return 0
  fi

  if [ "$pw_scope" = "project" ] \
    && git -C "$PROJECT_DIR" ls-files --error-unmatch .mcp.json >/dev/null 2>&1; then
    # Team-owned: .mcp.json is checked into the repo. NEVER modified.
    echo "  playwright: this project's committed .mcp.json registers its own playwright server."
    echo "    [1] Register the bootstrap shared server as '$PLAYWRIGHT_MCP_ALT_NAME' and disable the project one on this machine only"
    echo "    [2] Register '$PLAYWRIGHT_MCP_ALT_NAME' alongside it (both active — browser tools will appear twice)"
    echo "    [3] Don't touch anything (default)"
    read -r -p "  How should we proceed? [1/2/3]: " choice || choice=3
    case "$choice" in
      1)
        _add_playwright user "$PLAYWRIGHT_MCP_ALT_NAME"
        _disable_project_playwright_locally
        ;;
      2)
        _add_playwright user "$PLAYWRIGHT_MCP_ALT_NAME"
        ;;
      *)
        echo "  playwright: left untouched."
        ;;
    esac
    return 0
  fi

  # Machine-local registration: untracked .mcp.json (project scope) or the
  # ~/.claude.json project entry (local scope). Safe to modify with consent.
  echo "  playwright: an existing ${pw_scope}-scope registration was found (machine-local, not checked in)."
  if prompt_yn "  Replace it with the bootstrap shared server (removes the ${pw_scope}-scope entry)? [y/N] (no = keep it and register ours as '$PLAYWRIGHT_MCP_ALT_NAME'): "; then
    ( cd "$PROJECT_DIR" && claude mcp remove playwright -s "$pw_scope" ) || true
    _add_playwright user "$PLAYWRIGHT_MCP_NAME"
  else
    _add_playwright user "$PLAYWRIGHT_MCP_ALT_NAME"
    echo "  playwright: existing entry kept; bootstrap server registered as '$PLAYWRIGHT_MCP_ALT_NAME'."
  fi
}

_install_playwright_flow
