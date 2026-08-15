#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"

# Stale global skill folders from the wiki rename (adr -> decision, prd -> req)
ORPHAN_SKILLS=(
  adr-create adr-finalize adr-next adr-walkthrough
  prd-create prd-finalize prd-extract-decisions prd-update prd-trash prd-compile
)

SKIP_MCPS=false
for arg in "$@"; do
  [ "$arg" = "--skip-mcps" ] && SKIP_MCPS=true
done

# Local/offline-safe steps (1-7) run first so hooks, skills, and settings
# always land; the network-dependent MCP install runs last (step 8), guarded
# so a failure cannot abort the script under `set -euo pipefail`.

# 1. Install hooks globally
GLOBAL_HOOKS_DIR="$HOME/.claude/hooks"
if [ -d "$TEMPLATE_DIR/lib/hooks" ]; then
  echo "Installing hooks globally (~/.claude/hooks/)..."
  mkdir -p "$GLOBAL_HOOKS_DIR"
  # Content-based comparison + minimal per-file report — see sync-wiki-scaffold.sh's
  # RSYNC_FLAGS comment for why plain -av re-lists every file on every run.
  rsync -a --checksum --omit-dir-times --out-format='  + %n' --exclude='.DS_Store' "$TEMPLATE_DIR/lib/hooks/" "$GLOBAL_HOOKS_DIR/"
  echo ""
else
  echo "Warning: $TEMPLATE_DIR/lib/hooks not found — hook scripts NOT installed" >&2
fi

# 2. Install skills globally
echo "Installing skills globally (~/.claude/skills/)..."

# Ensure the global skills directory exists
mkdir -p "$GLOBAL_SKILLS_DIR"

# Rsync skills from the template to ~/.claude/skills/
rsync -a --checksum --omit-dir-times --out-format='  + %n' --exclude='.DS_Store' "$TEMPLATE_DIR/lib/skills/" "$GLOBAL_SKILLS_DIR/"

# Detect stale skill folders from the wiki rename
ORPHAN_FOUND=()
for skill in "${ORPHAN_SKILLS[@]}"; do
  if [ -d "$GLOBAL_SKILLS_DIR/$skill" ]; then
    ORPHAN_FOUND+=("$GLOBAL_SKILLS_DIR/$skill")
  fi
done

if [ ${#ORPHAN_FOUND[@]} -gt 0 ]; then
  echo ""
  echo "Stale skill folders detected from the wiki rename:"
  for p in "${ORPHAN_FOUND[@]}"; do
    echo "  $p"
  done
  echo ""
  # Sticky: asked once, then remembered (skills.pruneOrphans, global scope —
  # this script has no project dir). The key decides only WHETHER the removal
  # runs; which folders qualify is fixed by ORPHAN_SKILLS above.
  #
  # prompt_yn_sticky answers no in a non-interactive terminal, prints its own
  # "skipping prompt, answering no" note, and records NOTHING — so one CI run
  # cannot bake a permanent decline into the user's store. That path falls into
  # the else branch below, which is therefore the single "nothing was deleted"
  # message for both the declined and the non-interactive case, and carries the
  # manual-removal escape route with it.
  if prompt_yn_sticky skills.pruneOrphans --global "Delete these ${#ORPHAN_FOUND[@]} folder(s)? [y/N]: "; then
    for p in "${ORPHAN_FOUND[@]}"; do
      rm -rf "$p"
    done
    echo "Removed."
  else
    echo "Skipped. To remove manually: rm -rf ~/.claude/skills/{adr-create,adr-finalize,adr-next,adr-walkthrough,prd-create,prd-finalize,prd-extract-decisions,prd-update,prd-trash,prd-compile}"
  fi
fi

# 3. Merge the canonical permission deny list into ~/.claude/settings.json
echo ""
echo "Merging permissions deny list (~/.claude/settings.json)..."
node "$SCRIPT_DIR/merge-settings-deny.js"
echo ""

# 4. Merge the canonical hook wiring into ~/.claude/settings.json so the
#    scripts installed in step 1 are actually registered (no more manual
#    paste from lib/hooks/README.md).
echo "Merging hooks wiring (~/.claude/settings.json)..."
# The merge exits 0 on every outcome, so its message is the only way to tell
# a fresh/changed wiring from a no-op. Capture stdout+stderr together and
# echo it back; only nudge a restart when something actually changed.
HOOKS_WIRING_OUT="$(node "$SCRIPT_DIR/merge-settings-hooks.js" 2>&1)"
if [ -n "$HOOKS_WIRING_OUT" ]; then
  echo "$HOOKS_WIRING_OUT"
fi
case "$HOOKS_WIRING_OUT" in
  *'hooks wiring: created'*|*' applied'*)
    echo "Restart Claude Code sessions to activate hook changes."
    ;;
esac
echo ""

# 5. Install the @-autocomplete file suggestion picker and register it
echo "Installing file suggestion picker (~/.claude/file-suggestion.sh)..."
mkdir -p "$HOME/.claude"
cp "$SCRIPT_DIR/templates/file-suggestion.sh" "$HOME/.claude/file-suggestion.sh"
chmod +x "$HOME/.claude/file-suggestion.sh"

# The merge exits 0 on every outcome, so its message is the only way to tell a
# fresh registration from a no-op or a skip. Capture stdout+stderr together and
# echo it back; an outcome we don't recognise gets no follow-up line.
FILE_SUGGESTION_OUT="$(node "$SCRIPT_DIR/merge-settings-deny.js" --set-key fileSuggestion --set-value '{"type":"command","command":"~/.claude/file-suggestion.sh"}' 2>&1)"
if [ -n "$FILE_SUGGESTION_OUT" ]; then
  echo "$FILE_SUGGESTION_OUT"
fi
case "$FILE_SUGGESTION_OUT" in
  *'"fileSuggestion" set'*)
    echo "Restart Claude Code sessions to pick up the new file suggestion command."
    ;;
  *'already defines "fileSuggestion"'*)
    echo "Keeping your existing \"fileSuggestion\" — @-autocomplete for the bootstrap wiki dirs stays off."
    ;;
esac
echo ""

# 6. Install the preference helper into ~/.claude/ so the skills installed in
#    step 2 can actually read the store.
#
#    Skills are copied to ~/.claude/skills/ and then run inside ARBITRARY
#    projects, which may not be a bootstrap checkout and usually are not. A skill
#    that reads a preference therefore cannot reach lib/scripts/bootstrap-prefs.js
#    the way the installer scripts do (lib.sh resolves it from its own directory
#    at source time). Giving the helper a fixed, project-independent home is what
#    makes `consumer: skill` keys readable at all — same precedent, and the same
#    directory, as the file-suggestion picker installed in step 5.
#
#    The schema goes to ~/.claude/templates/ rather than beside the helper
#    because bootstrap-prefs.js resolves it as <its own dir>/templates/
#    (bootstrap-prefs.js:111). Preserving that layout means a skill invokes the
#    helper with NO --schema flag and still gets validation and defaults; a
#    flattened copy would silently drop both, and a dropped default turns an
#    unanswered key from "the documented default" into "unset" at every call
#    site that forgot the flag.
echo "Installing preference helper (~/.claude/bootstrap-prefs.js)..."
if [ -f "$SCRIPT_DIR/bootstrap-prefs.js" ] && [ -f "$SCRIPT_DIR/templates/bootstrap-prefs-schema.json" ]; then
  mkdir -p "$HOME/.claude/templates"
  cp "$SCRIPT_DIR/bootstrap-prefs.js" "$HOME/.claude/bootstrap-prefs.js"
  cp "$SCRIPT_DIR/templates/bootstrap-prefs-schema.json" "$HOME/.claude/templates/bootstrap-prefs-schema.json"
  echo "  Installed. Skills read preferences with: node ~/.claude/bootstrap-prefs.js --get <key> --project ."
else
  echo "Warning: bootstrap-prefs.js or its schema not found — skills will read every preference as unset (today's behavior)." >&2
fi
echo ""

# 7. Settle the skill-consent preferences that have never been answered.
#
#    These are the schema's `consumer: skill` keys: the ones that change what a
#    SLASH COMMAND does, not what the installer installs. They are asked here,
#    once, in a batch, rather than mid-task by each skill — a user answers a
#    short list during a sync they already chose to run instead of being
#    interrupted while committing.
#
#    ONLY GENUINELY UNANSWERED KEYS ARE ASKED, and "unanswered" is measured with
#    prefs_stored_global, not prefs_get. See that function's banner in lib.sh:
#    every one of these keys except gitCommit.versionBump's siblings carries a
#    non-null schema default, so a prefs_get-based check reports them all as
#    settled and this pass would ask nothing, forever, while looking like it
#    worked. A key already stored as `false` or `ask` is a SETTLED answer and is
#    never re-asked — re-prompting a decline is the exact annoyance this
#    mechanism exists to remove.
#
#    GLOBAL SCOPE. install-global.sh takes no project path, so it cannot know
#    which checkout the user means. All five keys are `scope: either`, so the
#    answer recorded here is the machine-wide default and a project file can
#    still override it per checkout later.
#
#    TTY-GUARDED AS A WHOLE, not per key. A non-interactive run prints one note
#    and writes NOTHING — no answers, and no preferences file either, because
#    prefs_stored_global's --list probe is read-only and is not even reached.
#    One CI run must never bake a permanent answer into a user's store.
PREFS_ASKED=0

# <key> <question> — the yes/no/ask shape shared by four of the five keys.
# `skip` is the resolved value for a bare Enter or EOF and records nothing, so
# an accidental keystroke leaves the question open instead of settling it.
settle_skill_pref() {
  local key question answer
  key="$1"
  question="$2"
  if prefs_stored_global "$key"; then
    return 0
  fi
  echo ""
  echo "  $question"
  answer="$(prompt_letter_choice skip "    [y]es / [n]o / [a]sk me every time / [s]kip for now: " yes no ask skip)"
  case "$answer" in
    yes)  prefs_set "$key" --global true ;  echo "    $key = true" ;;
    no)   prefs_set "$key" --global false ; echo "    $key = false" ;;
    ask)  prefs_set "$key" --global ask ;   echo "    $key = ask (the skill will prompt you each time it runs; that per-run answer is never stored)" ;;
    *)    echo "    $key left unanswered — today's behavior is unchanged, and you will be asked again next sync." ;;
  esac
  PREFS_ASKED=$(( PREFS_ASKED + 1 ))
}

echo "Checking skill preferences (~/.claude/bootstrap-prefs.json)..."
if ! has_tty; then
  echo "  Non-interactive terminal: skipping the preference questions. Every unanswered key keeps today's behavior."
else
  # gitCommit.versionBump is the odd one out: its grammar is auto/confirm/never
  # and `confirm` IS its ask state, so it deliberately has no `ask` value and
  # cannot go through settle_skill_pref.
  if ! prefs_stored_global gitCommit.versionBump; then
    echo ""
    echo "  Should /git-commit bump the version in package.json (and every other manifest) before committing?"
    echo "    Say 'never' for apps and private repos; 'auto' for published packages. The [patch]/[minor]/[major]"
    echo "    subject prefix follows the bump — written when one happens, omitted when it doesn't."
    VERSION_BUMP_ANSWER="$(prompt_letter_choice skip "    [a]uto / [c]onfirm each time / [n]ever / [s]kip for now: " auto confirm never skip)"
    case "$VERSION_BUMP_ANSWER" in
      auto|confirm|never)
        prefs_set gitCommit.versionBump --global "$VERSION_BUMP_ANSWER"
        echo "    gitCommit.versionBump = $VERSION_BUMP_ANSWER"
        ;;
      *)
        echo "    gitCommit.versionBump left unanswered — today's behavior (auto) is unchanged, and you will be asked again next sync."
        ;;
    esac
    PREFS_ASKED=$(( PREFS_ASKED + 1 ))
  fi

  settle_skill_pref gitCommit.autoPush \
    "Should /git-commit push the current branch after committing? (Default no — this turns a local action into a published one. It never creates a branch either way.)"
  settle_skill_pref research.persistToRaw \
    "Should /research save its report and sources to raw/research/ by default? (Findings always appear in the reply; this governs the file write only, and you can still decline any single report.)"
  settle_skill_pref research.autoIngest \
    "Should /research automatically fold a saved report into wiki/ (/wiki-ingest) instead of just suggesting the command? (Only runs when a report was actually saved.)"
  # uatGenerate.promoteTests is the second key that cannot go through
  # settle_skill_pref: its grammar is sibling|never|dedicated (plus the
  # parameterized dedicated:<path>), not true|false|ask.
  #
  # THE OPTION NAMED HERE IS `beside`, THE VALUE STORED IS `sibling`.
  # prompt_letter_choice matches on FIRST LETTER and takes the first listed name
  # that matches, so offering `sibling` alongside `skip` would silently make one
  # of the two unreachable — whichever came second could never be typed. `beside`
  # collides with nothing and reads better in the prompt; the case below maps it
  # back to the schema's value.
  if ! prefs_stored_global uatGenerate.promoteTests; then
    echo ""
    echo "  Where should /uat-generate write the unit tests it promotes out of UAT cases?"
    echo "    A dedicated folder keeps the suite in one place; beside puts src/parse.ts's test at"
    echo "    src/parse.test.ts. A project's existing layout always wins over this answer."
    TEST_LOCATION_ANSWER="$(prompt_letter_choice skip \
      "    [d]edicated folder / [b]eside each file / [n]ever write tests / [s]kip for now: " \
      dedicated beside never skip)"
    case "$TEST_LOCATION_ANSWER" in
      dedicated)
        # No follow-up asking WHICH folder. `values` is a closed enumeration of
        # literal tokens, and that closedness is what guarantees no preference key
        # can hold an arbitrary string (see the schema's own no-secrets rule) — a
        # stored path would be exactly that. The skill resolves the directory from
        # the repo instead: an existing test directory, else the language default.
        prefs_set uatGenerate.promoteTests --global dedicated
        echo "    uatGenerate.promoteTests = dedicated"
        ;;
      beside)
        prefs_set uatGenerate.promoteTests --global sibling
        echo "    uatGenerate.promoteTests = sibling"
        ;;
      never)
        prefs_set uatGenerate.promoteTests --global never
        echo "    uatGenerate.promoteTests = never"
        ;;
      *)
        echo "    uatGenerate.promoteTests left unanswered — today's behavior (a dedicated test folder) is unchanged, and you will be asked again next sync."
        ;;
    esac
    PREFS_ASKED=$(( PREFS_ASKED + 1 ))
  fi

  settle_skill_pref gitignore.offerSectionUpdates \
    "Should setup/update offer .gitignore template section updates? (No stops the opening question entirely. The .git/info/exclude block is separate and is unaffected.)"

  if [ "$PREFS_ASKED" -eq 0 ]; then
    echo "  All skill preferences already answered — nothing to ask."
  else
    echo ""
    echo "  Stored in $HOME/.claude/bootstrap-prefs.json (see bootstrap-prefs.README.md beside it for what each key does)."
    echo "  Change an answer:    node ~/.claude/bootstrap-prefs.js --set <key> --value <value> --global"
    echo "  Re-open a question:  node ~/.claude/bootstrap-prefs.js --unset <key> --global"
    echo "  Or run /bootstrap-config."
  fi
fi
echo ""

# 8. Ensure global MCP servers are installed (user scope, non-interactive) —
#    LAST because it is the only network-dependent step, and guarded so a
#    failure warns instead of aborting the local installs above.
#    Pass --skip-mcps when MCPs were already handled interactively by the caller.
if [ "$SKIP_MCPS" = false ]; then
  echo "Checking global MCP servers (user scope)..."
  if ! "$SCRIPT_DIR/install-mcps.sh"; then
    echo "Warning: MCP install failed — hooks, skills, and settings were installed; re-run 'bootstrap install' to retry MCPs." >&2
  fi
  echo ""
fi

# "preferences" stays unconditional regardless of SKIP_MCPS: step 6 always
# installs the helper on every pass, whether or not anything was actually
# asked (a non-tty run still installs it, it just settles no answers) — see
# BUG-0010. "MCPs" is the one token gated on what actually ran, since step 8
# is skipped entirely under --skip-mcps and claiming it otherwise overstates
# the summary's own job (evidence of what ran) on the most common invocation
# path — both setup-project.sh and update-project.sh call this with --skip-mcps.
if [ "$SKIP_MCPS" = false ]; then
  echo "Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + preferences + MCPs)."
else
  echo "Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + preferences)."
fi
