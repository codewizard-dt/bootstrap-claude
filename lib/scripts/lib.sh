# shellcheck shell=bash
# lib.sh — shared shell helpers for the bootstrap-claude setup scripts.
#
# Sourced, never executed. Source it with:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; . "$SCRIPT_DIR/lib.sh"
#
# HARD CONSTRAINT: must run on macOS default bash 3.2. No `local -n` namerefs,
# no associative arrays, no `${var,,}`. Functions return values by printing to
# stdout; diagnostics go to stderr.

# ---------------------------------------------------------------------------
# BOOTSTRAP_PREFS_JS
#
# Absolute path to the preference-store helper (bootstrap-prefs.js), resolved
# from lib.sh's OWN location at source time.
#
# It deliberately does NOT use $SCRIPT_DIR: that variable belongs to the
# sourcing script, and the callers compute it two different ways —
# install-global.sh uses `dirname "$0"`, the others use
# `dirname "${BASH_SOURCE[0]}"`. Deriving the helper path from a caller's
# convention would break the moment a new caller picks the other one.
# ---------------------------------------------------------------------------
BOOTSTRAP_PREFS_JS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bootstrap-prefs.js"

# ---------------------------------------------------------------------------
# resolve_project_dir <path>
#
# Resolves <path> (e.g. "." or a relative path) to an absolute directory by
# cd-ing into it and printing pwd. On success prints the absolute path to
# stdout. On failure (unresolvable path or not a directory) prints an error to
# stderr and returns 1 — so callers can `PROJECT_DIR="$(resolve_project_dir "$1")" || exit 1`.
# ---------------------------------------------------------------------------
resolve_project_dir() {
  local resolved
  resolved="$(cd "$1" 2>/dev/null && pwd)" || {
    echo "Error: Cannot resolve path: $1" >&2
    return 1
  }
  if [ ! -d "$resolved" ]; then
    echo "Error: Directory does not exist: $resolved" >&2
    return 1
  fi
  printf '%s\n' "$resolved"
}

# ---------------------------------------------------------------------------
# mcp_installed <name>
#
# True when an MCP named <name> is registered at any scope visible to the
# current project.
# ---------------------------------------------------------------------------
mcp_installed() {
  claude mcp get "$1" &>/dev/null
}

# ---------------------------------------------------------------------------
# mcp_matches <name> <expected>
#
# Fixed-string match against `claude mcp get` output; used to distinguish
# "installed with expected shape" from "installed but stale (needs upgrade)".
# ---------------------------------------------------------------------------
mcp_matches() { claude mcp get "$1" 2>/dev/null | grep -qF "$2"; }

# ---------------------------------------------------------------------------
# mcp_scope_of <name>
#
# Prints the scope of the resolved registration: user | project | local |
# unknown. Parses the "Scope:" line of `claude mcp get` (no --json mode
# exists). "unknown" means the output format drifted or the server is absent —
# callers must treat it as do-not-touch (scope conflicts break OAuth/token
# storage and produce duplicate servers).
# ---------------------------------------------------------------------------
mcp_scope_of() {
  local line
  line="$(claude mcp get "$1" 2>/dev/null | grep -m1 'Scope:')" || { echo unknown; return 0; }
  # Match the scope word immediately after "Scope: " — descriptive parentheticals
  # like "Local config (private to you in this project)" contain other scope
  # words, so loose substring matching misclassifies.
  case "$line" in
    *"Scope: User"*|*"Scope: user"*)         echo user ;;
    *"Scope: Project"*|*"Scope: project"*)   echo project ;;
    *"Scope: Local"*|*"Scope: local"*)       echo local ;;
    *)                                       echo unknown ;;
  esac
}

# ---------------------------------------------------------------------------
# wait_http_up <url> [attempts]
#
# Any HTTP status proves the listener is up — streamable-HTTP servers 4xx
# plain GETs, so `curl -f` would false-negative.
# ---------------------------------------------------------------------------
wait_http_up() { local i code; for i in $(seq 1 "${2:-10}"); do code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$1" 2>/dev/null || true)"; [ -n "$code" ] && [ "$code" != "000" ] && return 0; sleep 1; done; return 1; }

# ---------------------------------------------------------------------------
# serena_installed <project_dir>
#
# True when Serena is registered for <project_dir> at any scope — local
# (~/.claude.json project entry, the bootstrap default), project (.mcp.json,
# legacy bootstrap installs), or user.
# ---------------------------------------------------------------------------
serena_installed() {
  [ -n "$1" ] && ( cd "$1" 2>/dev/null && claude mcp get serena &>/dev/null )
}

# ---------------------------------------------------------------------------
# detect_installed_mcps <project_dir>
#
# Prints the space-separated names of the MCPs currently available to
# <project_dir>: "serena" (via its project .mcp.json) plus any of
# context7 / brave-search / playwright registered with `claude mcp`.
# Intended to be passed unquoted to build-mcp-guide.sh so it word-splits into
# separate arguments.
# ---------------------------------------------------------------------------
detect_installed_mcps() {
  local project_dir result mcp
  project_dir="$1"
  result=""
  if serena_installed "$project_dir"; then
    result="serena"
  fi
  for mcp in context7 brave-search; do
    if mcp_installed "$mcp"; then
      result="${result:+$result }$mcp"
    fi
  done
  # The bootstrap-managed playwright server is normally named "playwright";
  # "playwright-shared" is the conflict-resolution alternate (used when a
  # project ships its own playwright entry). Either name enables the
  # playwright guide section (guide key stays "playwright").
  if mcp_installed "playwright-shared" || mcp_installed "playwright"; then
    result="${result:+$result }playwright"
  fi
  printf '%s\n' "$result"
}

# ---------------------------------------------------------------------------
# run_project_sync <project_dir> <script_dir>
#
# The shared setup/update sequence run identically by setup-project.sh and
# update-project.sh: install skills+hooks globally first (offline-safe, via
# install-global.sh --skip-mcps), then attempt the interactive MCP install
# (guarded — a failure only warns and continues, it does not abort the rest
# of the sync), sync the wiki scaffold (tiered guide delivery — --interactive
# enables the optional-guide prompts), merge the .gitignore, backfill
# aliases: onto any wiki/work/ file that has drifted without one (unguarded —
# backfill-wiki-aliases.js always exits 0 on its own, same contract as
# merge-settings-deny.js/merge-settings-hooks.js), build the MCP-tools guide
# for the detected MCPs, then bootstrap Serena's project.yml. Prints the same
# section headers and blank-line separators the two scripts printed inline.
# ---------------------------------------------------------------------------
run_project_sync() {
  local project_dir script_dir installed_mcps
  project_dir="$1"
  script_dir="$2"

  echo "Installing skills and hooks globally..."
  "$script_dir/install-global.sh" --skip-mcps
  echo ""

  echo "Checking MCP servers..."
  if ! "$script_dir/install-mcps.sh" --interactive --project-dir "$project_dir"; then
    echo "Warning: MCP install failed — continuing with wiki sync; re-run update to retry MCPs." >&2
  fi
  echo ""

  echo "Syncing wiki scaffold..."
  "$script_dir/sync-wiki-scaffold.sh" --interactive "$project_dir"
  "$script_dir/merge-gitignore.sh" --interactive "$project_dir"
  echo ""

  echo "Backfilling wiki work-item aliases..."
  node "$script_dir/backfill-wiki-aliases.js" "$project_dir"
  echo ""

  echo "Checking Obsidian setup..."
  if ! "$script_dir/install-obsidian.sh" --interactive --project-dir "$project_dir"; then
    echo "Warning: Obsidian install failed — continuing; re-run update to retry." >&2
  fi
  echo ""

  echo "Building MCP tools guide..."
  installed_mcps="$(detect_installed_mcps "$project_dir")"
  # Unquoted on purpose: word-split the space-separated names into arguments.
  "$script_dir/build-mcp-guide.sh" "$project_dir" $installed_mcps
  echo ""

  echo "Bootstrapping Serena project.yml..."
  "$script_dir/bootstrap-serena.sh" "$project_dir"
  echo ""
}

# ---------------------------------------------------------------------------
# has_tty
#
# True when stdin is an interactive terminal, OR when BOOTSTRAP_ASSUME_TTY=1.
#
# The override is a TEST SEAM, not a prompt bypass: Node's spawnSync hands the
# child a pipe, so `[ -t 0 ]` is always false under the test harness and no
# test could otherwise reach the body of any prompt. It gates only the tty
# DETECTION — `read` still runs, so a test that supplies no stdin still takes
# the real EOF path.
# ---------------------------------------------------------------------------
has_tty() {
  [ -t 0 ] || [ "${BOOTSTRAP_ASSUME_TTY:-}" = "1" ]
}

# ---------------------------------------------------------------------------
# prompt_yn <prompt>
#
# Reads a yes/no answer. In a non-interactive terminal answers "no" (prints a
# note and returns 1). Returns 0 for y/Y*, 1 otherwise.
# ---------------------------------------------------------------------------
prompt_yn() {
  local prompt reply
  prompt="$1"
  if has_tty; then
    read -r -p "$prompt" reply
  else
    echo "  Non-interactive terminal: skipping prompt, answering no."
    reply="n"
  fi
  case "$reply" in
    [yY]*) return 0 ;;
    "")
      # A bare Enter press honors whichever default the prompt text itself
      # displays. Every prompt in this codebase already signals its default
      # via bracket capitalization ("[Y/n]" vs "[y/N]") — this just makes an
      # empty reply match what the user was shown, instead of every empty
      # reply silently meaning "no" regardless of what the brackets promised.
      case "$prompt" in
        *"[Y/n]"*) return 0 ;;
        *) return 1 ;;
      esac
      ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# prompt_yn_sticky <key> <selector> <prompt>
#
# A yes/no question that is asked once and then remembered. Returns 0 for yes
# and 1 for no, exactly like prompt_yn, so call sites stay
# `if prompt_yn_sticky ...; then`. The answer is never printed to stdout.
#
# <selector> is either the literal string `--global` or an absolute project
# directory, and it is used for BOTH the read and the write. That is
# deliberate: bootstrap-prefs.js resolution is scope-constrained, so a
# `global`-scope key read with --project skips the project file anyway, and a
# `project`-scope key read with --project never consults the global one. The
# one case where the write layer would be the WRONG read layer is a
# `scope: either` key — it must be read with --project so both layers and the
# schema default are consulted — and no call site of this helper reads one. Do
# not "simplify" the selector away.
#
# THE LOAD-BEARING RULE: only an answer that was actually asked interactively
# is ever recorded. A non-interactive run auto-answers `no` and records
# NOTHING — the prefs_set below is unreachable from that branch by return, not
# by flag. One CI run must never bake a permanent `no` into a user's store: an
# unattended decline that persists is strictly worse than the re-prompting
# this mechanism exists to remove, because there is no prompt left to change
# your mind with.
#
# `ask` and `unset` are NOT the same state. `unset` is an unanswered question
# that the next answer settles; `ask` is a settled answer whose content is
# "keep asking, never persist". Collapsing the two would let the next reply
# silently overwrite a user's explicit `ask`.
#
# The explicit has_tty check here fires BEFORE the delegation to prompt_yn,
# which has a non-interactive branch of its own printing the same note. Because
# this one returns first, prompt_yn is never reached without a tty and the note
# is printed exactly once (verified empirically).
# ---------------------------------------------------------------------------
prompt_yn_sticky() {
  local key selector prompt stored record status
  key="$1"
  selector="$2"
  prompt="$3"
  record=true

  stored="$(prefs_get "$key" "$selector")"
  case "$stored" in
    true)
      echo "  $key: using remembered answer (yes) — change with /bootstrap-config"
      return 0
      ;;
    false)
      echo "  $key: using remembered answer (no) — change with /bootstrap-config"
      return 1
      ;;
    ask)
      # A settled answer meaning "keep asking". Prompt every run, record nothing.
      record=false
      ;;
    unset)
      # Unanswered — prompt, and let this run's answer settle it.
      : ;;
    *)
      echo "  Warning: $key holds unrecognized value \"$stored\" — treating it as unset." >&2
      ;;
  esac

  if ! has_tty; then
    # Non-interactive: answer no and record NOTHING. This return is what makes
    # the rule structural rather than a flag check — no path from here can
    # reach the prefs_set below.
    echo "  Non-interactive terminal: skipping prompt, answering no."
    return 1
  fi

  # Captured with if/else, not a bare call: prompt_yn returning 1 is a valid
  # answer, and a bare call would abort a consumer under `set -euo pipefail`.
  if prompt_yn "$prompt"; then
    status=0
  else
    status=1
  fi

  if [ "$record" = true ]; then
    if [ "$status" -eq 0 ]; then
      prefs_set "$key" "$selector" true
    else
      prefs_set "$key" "$selector" false
    fi
  fi

  return "$status"
}

# ---------------------------------------------------------------------------
# prompt_scope <name> [<pref-key> <selector>]
#
# Asks whether to register <name> at user (default) or project scope. Prints
# "user" or "project", and defaults to "user" in a non-interactive terminal.
#
# With NO extra arguments this is exactly the function it has always been: no
# preference lookup, no store write, not one call to bootstrap-prefs.js. That
# is load-bearing — bootstrap-serena.sh and every other caller that has not
# opted in must be unaffected, including on machines with no prefs helper at
# all.
#
# With <pref-key> AND <selector> it becomes sticky, running the same
# stored/ask/unset ladder as prompt_choice_sticky — shared via _sticky_lookup,
# so that ladder is written once and not a third time — with legal names
# `user project` and default `user`. Both arguments are required to opt in; a
# key with no selector has no layer to read or write, so it warns and stays
# non-sticky rather than guessing one.
#
# WHY THIS DOES NOT SIMPLY CALL prompt_choice_sticky. The two RESOLVE A REPLY
# DIFFERENTLY, and the difference is a published contract, not an accident.
# prompt_choice_sticky matches a digit index or an EXACT name; this function
# matches on FIRST LETTER — `[pP]*` is project and everything else (empty, EOF,
# `pineapple`, garbage) is user. That two-answer first-letter rule is what
# bootstrap-prefs-schema.json's mcp.context7Scope detail documents to users:
# "any reply that does not begin with p or P falls through to user".
# Delegating the read would silently turn a bare `p` — neither a digit nor the
# exact name `project` — into `user`, a regression this function's own callers
# and the schema both depend on not happening. So only the ladder is shared;
# the resolver stays here.
#
# STDOUT IS THE RETURN VALUE, as it always was: the resolved scope is the only
# thing that reaches stdout, and every notice goes to stderr.
#
# THE LOAD-BEARING RULE, identical to the other two sticky helpers: only an
# answer that was actually asked interactively is ever recorded. The
# non-interactive branch prints `user` and RETURNS before the prefs_set below,
# so the write is unreachable from it by return, not by flag.
# ---------------------------------------------------------------------------
prompt_scope() {
  local name key selector record state reply resolved
  name="$1"
  key="${2:-}"
  selector="${3:-}"
  record=false

  if [ -n "$key" ] && [ -n "$selector" ]; then
    record=true
    state="$(_sticky_lookup "$key" "$selector" user project)"
    case "$state" in
      hit:*)
        # A legal remembered answer; its notice already went to stderr.
        printf '%s\n' "${state#hit:}"
        return 0
        ;;
      ask)
        # A settled answer meaning "keep asking". Prompt every run, record nothing.
        record=false
        ;;
      unset)
        # Unanswered — prompt, and let this run's answer settle it.
        : ;;
    esac
  elif [ -n "$key" ]; then
    echo "  Warning: prompt_scope given \"$key\" with no selector — answering normally and remembering nothing." >&2
  fi

  if ! has_tty; then
    # Silently default to user. This question has never printed a
    # non-interactive note and adding one now would change installer output.
    # Records NOTHING — this return is what makes that structural.
    printf '%s\n' "user"
    return 0
  fi

  # `|| reply=""` keeps read's non-zero EOF status from aborting a consumer
  # running under `set -euo pipefail`. EOF leaves the reply empty, which the
  # case below resolves to `user` — the same answer an empty line gives.
  reply=""
  read -r -p "  Scope for $name — [u]ser (default) or [p]roject? " reply || reply=""
  case "$reply" in
    [pP]*) resolved="project" ;;
    *) resolved="user" ;;
  esac

  if [ "$record" = true ]; then
    prefs_set "$key" "$selector" "$resolved"
  fi

  printf '%s\n' "$resolved"
}

# ---------------------------------------------------------------------------
# prompt_choice_sticky <key> <selector> <default-name> <prompt> <name>...
#
# A multiple-choice question that is asked once and then remembered. Prints the
# resolved NAME and returns 0, so call sites read
# `choice="$(prompt_choice_sticky ...)"`. The trailing <name> arguments are the
# legal answers, listed in menu order.
#
# STDOUT IS THE RETURN VALUE. The resolved name is the only thing that ever
# reaches stdout; every notice, warning, and the non-interactive note go to
# stderr with `>&2`. A remembered-answer notice printed on stdout would be
# captured by the caller AS the answer. (`read -r -p` writes its own prompt to
# stderr, so the prompt text is already safe.)
#
# NAMES, NOT DIGITS, ARE WHAT GET STORED. mcp.playwrightConflict stores
# `shared | alongside | skip`; its menu prints [1]/[2]/[3] and users type
# digits, but a digit is an INPUT FORM only, never a stored value. A stored `2`
# would silently change meaning the day the menu is reordered — it would still
# resolve, and it would resolve to the wrong thing.
#
# <prompt> is handed to `read -r -p` verbatim, so a caller keeps its exact
# prompt text (including a one-line inline menu).
#
# <selector> is the literal string `--global` or an absolute project directory,
# and is used for BOTH the read and the write — see prompt_yn_sticky's banner
# for the full reasoning. Short version: bootstrap-prefs.js resolution is
# scope-constrained, so the layer a value is read from must not drift from the
# layer it was written to. Do not "simplify" the selector away.
#
# THE LOAD-BEARING RULE, identical to prompt_yn_sticky: only an answer that was
# actually asked interactively is ever recorded. A non-interactive run echoes
# <default-name> and records NOTHING — that branch RETURNS before the prefs_set
# below, so the write is unreachable from it by return, not by flag. One CI run
# must never bake a permanent choice into a user's store.
#
# `ask` and `unset` are NOT the same state. `unset` is an unanswered question
# that the next answer settles; `ask` is a settled answer whose content is
# "keep asking, never persist". Collapsing the two would let the next reply
# silently overwrite a user's explicit `ask`.
# ---------------------------------------------------------------------------
prompt_choice_sticky() {
  local key selector default_name prompt state record reply resolved name i
  key="$1"
  selector="$2"
  default_name="$3"
  prompt="$4"
  shift 4
  # What remains in "$@" is the legal name list, in menu order — it is both the
  # set of accepted typed answers and what the digits index into.
  record=true

  # The stored/ask/unset ladder lives in _sticky_lookup, shared with
  # prompt_scope so it is written once — see its banner for the token grammar.
  state="$(_sticky_lookup "$key" "$selector" "$@")"
  case "$state" in
    hit:*)
      # A legal remembered answer; its notice already went to stderr.
      printf '%s\n' "${state#hit:}"
      return 0
      ;;
    ask)
      # A settled answer meaning "keep asking". Prompt every run, record nothing.
      record=false
      ;;
    unset)
      # Unanswered — prompt, and let this run's answer settle it.
      : ;;
  esac

  if ! has_tty; then
    # Non-interactive: answer with the default and record NOTHING. This return
    # is what makes the rule structural rather than a flag check — no path from
    # here can reach the prefs_set below.
    echo "  Non-interactive terminal: skipping prompt, choosing $default_name." >&2
    printf '%s\n' "$default_name"
    return 0
  fi

  # `|| reply=""` keeps read's non-zero EOF status from aborting a consumer
  # running under `set -euo pipefail`. EOF leaves the reply empty and therefore
  # resolves to <default-name>, exactly like an empty line.
  reply=""
  read -r -p "$prompt" reply || reply=""

  resolved="$default_name"
  case "$reply" in
    ''|*[!0-9]*)
      # Empty or not all digits: an exact <name> match wins; anything else
      # (including EOF's empty reply) is <default-name>.
      for name in "$@"; do
        if [ "$reply" = "$name" ]; then
          resolved="$name"
          break
        fi
      done
      ;;
    *)
      # All digits: the Nth name, 1-based, in the order given. A digit outside
      # 1..N falls through to <default-name> — a mistyped digit is a mis-hit,
      # not a decision, and the default is the safe reading of one.
      i=1
      for name in "$@"; do
        if [ "$reply" = "$i" ]; then
          resolved="$name"
          break
        fi
        i=$(( i + 1 ))
      done
      ;;
  esac

  if [ "$record" = true ]; then
    prefs_set "$key" "$selector" "$resolved"
  fi

  printf '%s\n' "$resolved"
}

# ---------------------------------------------------------------------------
# _sticky_lookup <key> <selector> <name>...
#
# The stored/ask/unset ladder shared by prompt_choice_sticky and prompt_scope,
# written once. Reads <key> at <selector>'s layer and prints exactly ONE token
# telling the caller what to do next:
#
#   hit:<name>   a legal remembered answer — print it and return, do not prompt
#   ask          a settled "keep asking" — prompt, and record NOTHING
#   unset        unanswered — prompt, and let this run's answer settle it
#
# `ask` and `unset` are NOT the same state. `unset` is an unanswered question
# that the next answer settles; `ask` is a settled answer whose content is
# "keep asking, never persist". Collapsing the two would let the next reply
# silently overwrite a user's explicit `ask`.
#
# A stored value matching no legal name — the menu was reordered, or the schema
# changed under a stored answer — warns and degrades to `unset`. Re-asking is
# strictly better than handing the caller a name it has no branch for.
#
# EVERY notice and warning goes to STDERR, including the remembered-answer one.
# Both callers print their resolved answer to stdout, so a notice on stdout
# would be captured by THEIR callers as the answer.
#
# prompt_yn_sticky deliberately does not use this: its stored grammar is
# `true`/`false` rather than a name list, and its notice goes to stdout (it
# returns its answer as an exit status, so stdout is free there). Bending this
# helper to cover that shape would cost more than the ladder it saves.
# ---------------------------------------------------------------------------
_sticky_lookup() {
  local key selector stored name
  key="$1"
  selector="$2"
  shift 2

  stored="$(prefs_get "$key" "$selector")"
  case "$stored" in
    ask)
      printf '%s\n' "ask"
      return 0
      ;;
    unset)
      printf '%s\n' "unset"
      return 0
      ;;
  esac

  for name in "$@"; do
    if [ "$stored" = "$name" ]; then
      echo "  $key: using remembered answer ($stored) — change with /bootstrap-config" >&2
      printf '%s\n' "hit:$stored"
      return 0
    fi
  done

  echo "  Warning: $key holds unrecognized value \"$stored\" — treating it as unset." >&2
  printf '%s\n' "unset"
}

# ---------------------------------------------------------------------------
# _prefs_selector_args <selector>
#
# Maps the single selector argument the preference helpers take onto
# bootstrap-prefs.js's layer-selector flags: the literal string `--global`
# stays `--global`; anything else is treated as an absolute project directory
# and becomes `--project <dir>`.
#
# Both the read and the write go through this one function, so the layer a
# value is read from can never drift from the layer it was written to.
#
# Intended to be substituted UNQUOTED so it word-splits into two arguments —
# which also means it assumes a project path without whitespace, the same
# assumption detect_installed_mcps already makes of its output.
# ---------------------------------------------------------------------------
_prefs_selector_args() {
  if [ "$1" = "--global" ]; then
    printf '%s\n' "--global"
  else
    printf '%s %s\n' "--project" "$1"
  fi
}

# ---------------------------------------------------------------------------
# prefs_get <key> <selector>
#
# Prints the stored value for <key> as resolved at <selector>'s layer, or the
# literal word `unset`. Never prints an empty line, and never creates the
# store file.
#
# Degrades to `unset` when the helper is missing or node is not on PATH: a
# partial install must not abort an installer run. Only stdout is captured —
# the helper's own stderr warnings pass straight through to the user.
# ---------------------------------------------------------------------------
prefs_get() {
  local key selector out
  key="$1"
  selector="$2"
  if [ ! -f "$BOOTSTRAP_PREFS_JS" ] || ! command -v node >/dev/null 2>&1; then
    printf '%s\n' "unset"
    return 0
  fi
  # Unquoted on purpose: word-split the selector into its flag(s).
  out="$(node "$BOOTSTRAP_PREFS_JS" --get "$key" $(_prefs_selector_args "$selector"))" || out=""
  if [ -z "$out" ]; then
    printf '%s\n' "unset"
    return 0
  fi
  printf '%s\n' "$out"
}

# ---------------------------------------------------------------------------
# prefs_set <key> <selector> <value>
#
# Records <value> for <key> at <selector>'s layer.
#
# bootstrap-prefs.js exits 1 only when the CALLER is wrong (a value outside
# the key's grammar, a missing layer selector) — a bug in the calling script,
# not a user error. Its stderr is left visible so the mistake shows up in the
# log, but the non-zero status is swallowed here so it cannot abort a consumer
# running under `set -euo pipefail`. A broken preference write must never cost
# the user their install.
#
# Its stdout (a `<layer>: <key> = <value>` confirmation) IS suppressed: the
# calling sticky-prompt helpers print their own, user-facing notice, so the
# helper's line would only duplicate it in a different vocabulary.
# ---------------------------------------------------------------------------
prefs_set() {
  local key selector value
  key="$1"
  selector="$2"
  value="$3"
  if [ ! -f "$BOOTSTRAP_PREFS_JS" ] || ! command -v node >/dev/null 2>&1; then
    return 0
  fi
  # Unquoted on purpose: word-split the selector into its flag(s).
  node "$BOOTSTRAP_PREFS_JS" --set "$key" --value "$value" $(_prefs_selector_args "$selector") >/dev/null || {
    echo "  Warning: could not record preference $key=$value (see error above)." >&2
  }
  return 0
}

# ---------------------------------------------------------------------------
# prefs_stored_global <key>
#
# True when <key> has an answer actually STORED in ~/.claude/bootstrap-prefs.json,
# as opposed to merely RESOLVING to something. Prints nothing; the answer is the
# exit status.
#
# WHY THIS CANNOT BE prefs_get. `--get` is a resolution, and resolution falls
# through to the schema `default` after the files (bootstrap-prefs.js:376). Four
# of the five `consumer: skill` keys carry a non-null default — `auto`, `false`,
# `true`, `true` — so `prefs_get gitCommit.versionBump --global` prints `auto`
# whether the user chose `auto` or has never been asked in their life. A
# prefs_get-based "is this unanswered?" test therefore reports EVERY one of those
# keys as settled, and a sync pass built on it would silently never ask anything
# at all. That failure is invisible: the install looks clean, the store stays
# empty, and every skill quietly keeps its default forever.
#
# `--list`'s `[layer]` column is the only surface that separates the three
# outcomes — `[global]` (a stored answer), `[default]` (the schema's fallback),
# `[unset]` (nothing anywhere) — which is why the read goes through --list and
# matches the layer token rather than the value.
#
# READ-ONLY, and that is load-bearing: `--list` never creates a values file
# (pinned by test/bootstrap-prefs.test.js), so probing a key on a machine that
# has never answered one leaves the store non-existent rather than empty.
#
# Degrades to "not stored" when the helper is missing or node is not on PATH,
# matching prefs_get. The cost of that direction is a re-asked question; the
# other direction would be a question that can never be asked.
# ---------------------------------------------------------------------------
prefs_stored_global() {
  local key
  key="$1"
  if [ ! -f "$BOOTSTRAP_PREFS_JS" ] || ! command -v node >/dev/null 2>&1; then
    return 1
  fi
  # `--list` with no --project consults the global layer only, which is exactly
  # the layer this pass writes to. awk compares the key and the layer token as
  # whole fields — a substring match would let `[default]` satisfy a test for
  # `[global]`'s absence in the wrong direction.
  node "$BOOTSTRAP_PREFS_JS" --list --global 2>/dev/null |
    awk -v key="$key" '$1 == key && $2 == "=" && $NF == "[global]" { found = 1 } END { exit !found }'
}

# ---------------------------------------------------------------------------
# prompt_letter_choice <default-name> <prompt> <name>...
#
# A multiple-choice question resolved on the FIRST LETTER of the reply, printing
# the resolved NAME to stdout. Non-sticky by construction: it never reads the
# preference store and never writes to it, so the caller owns both the "should I
# even ask?" decision and the recording of the answer.
#
# STDOUT IS THE RETURN VALUE. The resolved name is the only thing that reaches
# stdout; the non-interactive note goes to stderr, and `read -r -p` writes its
# own prompt to stderr already.
#
# WHY THIS IS NOT prompt_choice_sticky, AND WHY IT DOES NOT CALL IT.
#
#   1. THE STORE. prompt_choice_sticky consults the store before prompting and
#      returns a remembered answer without asking. For a key with a non-null
#      schema default that read can never come back `unset` (see
#      prefs_stored_global above), so it would resolve to the default and return
#      WITHOUT PROMPTING — every single time, for four of the five keys the sync
#      pass exists to settle. It is the right helper for a `global`/`project`
#      key with a null default and the wrong one here.
#   2. THE RESOLVER. prompt_choice_sticky matches a digit index or an EXACT
#      name; this matches the first letter, the same rule prompt_scope uses
#      ([pP]* is project, everything else is user). First letters are what the
#      sync prompts print — `[y]es / [n]o / [a]sk` — and typing `y` must not
#      fall through to the default the way an inexact name does there.
#
# So prompt_choice_sticky is left untouched: its behaviour is pinned by a large
# body of tests, and bending it to cover a defaulted key would put the store read
# behind a flag in a helper whose whole contract is that the store read happens.
#
# THE DEFAULT IS DELIBERATELY A NON-ANSWER AT EVERY CALL SITE IN THE SYNC PASS.
# An empty reply (bare Enter, or EOF) resolves to <default-name>, and the pass
# passes `skip` there rather than a real value: a keystroke nobody meant must not
# settle a question permanently. Recording only what was actually typed is the
# same rule the sticky helpers enforce for the non-interactive case.
#
# Case-insensitive on the reply, case-sensitive on the names, which are lower
# case throughout. bash 3.2 has no ${var,,}, hence the tr.
# ---------------------------------------------------------------------------
prompt_letter_choice() {
  local default_name prompt reply first name resolved
  default_name="$1"
  prompt="$2"
  shift 2

  if ! has_tty; then
    # Records nothing and asks nothing — the caller gets the default and, in the
    # sync pass, that default is `skip`, so an unattended run leaves the key
    # unanswered instead of baking in a value nobody chose.
    echo "  Non-interactive terminal: skipping prompt, choosing $default_name." >&2
    printf '%s\n' "$default_name"
    return 0
  fi

  # `|| reply=""` keeps read's non-zero EOF status from aborting a consumer
  # running under `set -euo pipefail`. EOF leaves the reply empty, which resolves
  # to <default-name> exactly like an empty line.
  reply=""
  read -r -p "$prompt" reply || reply=""

  first="$(printf '%s' "$reply" | cut -c1 | tr '[:upper:]' '[:lower:]')"
  resolved="$default_name"
  if [ -n "$first" ]; then
    for name in "$@"; do
      if [ "$first" = "$(printf '%s' "$name" | cut -c1)" ]; then
        resolved="$name"
        break
      fi
    done
  fi

  printf '%s\n' "$resolved"
}
