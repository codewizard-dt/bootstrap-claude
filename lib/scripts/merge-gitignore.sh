#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"
# Packed copy of the repo .gitignore (dotfiles are never included in npm packages)
TEMPLATE_GITIGNORE="$SCRIPT_DIR/templates/gitignore"

# merge-gitignore.sh [--interactive] <path-to-project>
#
# NOTHING is ever added to a project's .gitignore without asking. The template
# is split into titled sections (delimited by `# ---` banner comments); every
# section with missing lines is offered by title ("Add/update .gitignore
# section '<title>' (N new line(s))? [y/N]") — even sections already partially
# present. Sections with nothing new are skipped silently. Non-interactive
# runs (or no tty) change nothing at all, including when no .gitignore exists.

INTERACTIVE=false
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --interactive) INTERACTIVE=true ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
# bash 3.2 + set -u: expanding an empty array is an unbound-variable error
set -- ${POSITIONAL[@]+"${POSITIONAL[@]}"}

if [ $# -ne 1 ]; then
  echo "Usage: $0 [--interactive] <path-to-project>" >&2
  exit 1
fi

PROJECT_DIR="$(resolve_project_dir "$1")" || exit 1

TARGET="$PROJECT_DIR/.gitignore"

# Interactive-only: without a tty there is nobody to ask, and we never add
# .gitignore entries without asking. has_tty (lib.sh) is the tty seam — it also honours BOOTSTRAP_ASSUME_TTY=1.
if [ "$INTERACTIVE" = false ] || ! has_tty; then
  echo ".gitignore: skipped (interactive only — run 'npx @codewizard-dt/bootstrap update' in a terminal to be offered the sections)."
  exit 0
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

# Split the template into per-section files. Banner delimiters come in pairs
# (open dash line, title comment, close dash line); every odd dash line starts
# a new section. Titles land in $WORK_DIR/title.N, bodies in $WORK_DIR/sec.N.
SECTION_COUNT=$(awk -v dir="$WORK_DIR" '
  /^# -----/ {
    dash++
    if (dash % 2 == 1) n++
    print >> (dir "/sec." n)
    next
  }
  n > 0 {
    print >> (dir "/sec." n)
    if (dash % 2 == 1 && $0 ~ /^# / && !(n in ttl)) {
      t = $0; sub(/^# +/, "", t); ttl[n] = t
      print t > (dir "/title." n)
    }
  }
  END { print n }
' "$TEMPLATE_GITIGNORE")

# Snapshot existing lines for exact-match lookups during the merge loops.
# The target itself is NOT pre-created — it comes into existence only when a
# section is accepted (merge_section appends).
EXISTING="$WORK_DIR/existing"
if [ -f "$TARGET" ]; then cp "$TARGET" "$EXISTING"; else : > "$EXISTING"; fi

# section_missing_count <section-file>: how many non-comment entries are not
# yet in the target (exact line match)?
section_missing_count() {
  local line trimmed n=0
  while IFS= read -r line || [ -n "$line" ]; do
    trimmed="${line#"${line%%[![:space:]]*}"}"
    [ -z "$trimmed" ] && continue
    case "$trimmed" in \#*) continue ;; esac
    grep -qFx -- "$line" "$EXISTING" || n=$((n + 1))
  done < "$1"
  echo "$n"
}

added=0

# section_missing_lines <section-file>: print the entries that would be added,
# one per line, indented. Same selection logic as section_missing_count — a
# count alone ("3 new line(s)?") asks the user to consent to something they
# cannot see, so the prompt shows exactly what it will write.
section_missing_lines() {
  local line trimmed
  while IFS= read -r line || [ -n "$line" ]; do
    trimmed="${line#"${line%%[![:space:]]*}"}"
    [ -z "$trimmed" ] && continue
    case "$trimmed" in \#*) continue ;; esac
    grep -qFx -- "$line" "$EXISTING" || printf '      %s\n' "$line"
  done < "$1"
}

# merge_section <section-file>: append the section's missing lines, keeping
# comment/blank lines buffered so headers only land when new entries follow.
merge_section() {
  local line trimmed pending=""
  while IFS= read -r line || [ -n "$line" ]; do
    trimmed="${line#"${line%%[![:space:]]*}"}"
    if [ -z "$trimmed" ] || [[ "$trimmed" == \#* ]]; then
      pending+="${line}"$'\n'
    else
      if grep -qFx -- "$line" "$EXISTING"; then
        pending=""
      else
        if [ "$added" -eq 0 ] && [ -s "$TARGET" ]; then
          # Ensure target ends with a newline before we start appending
          [[ $(tail -c1 "$TARGET") ]] && printf '\n' >> "$TARGET"
        fi
        if [ -n "$pending" ]; then
          printf '%s' "$pending" >> "$TARGET"
          pending=""
        fi
        printf '%s\n' "$line" >> "$TARGET"
        echo "  + $line"
        added=$((added + 1))
      fi
    fi
  done < "$1"
}

# Tally before asking anything: the opening question should state the real
# scope, and a project with nothing to offer must not be asked at all.
total_missing=0
sections_offered=0
i=1
while [ "$i" -le "$SECTION_COUNT" ]; do
  n="$(section_missing_count "$WORK_DIR/sec.$i")"
  if [ "$n" -gt 0 ]; then
    total_missing=$((total_missing + n))
    sections_offered=$((sections_offered + 1))
  fi
  i=$((i + 1))
done

# One gate for the whole .gitignore pass, so a user who does not want their
# .gitignore touched answers once instead of once per section. This covers the
# section loop ONLY — the .git/info/exclude block below is a different mechanism
# (machine-local, never committed) and keeps its own prompt, so declining here
# still lets the sentinel repair run.
#
# The remembered answer is read with `prefs_get` rather than `prompt_yn_sticky`
# because this key is `scope: either`: it must resolve project → global →
# default. `prompt_yn_sticky` is single-selector by design (see the banner at
# lib.sh:226-232), which is correct only for `global`/`project` keys.
review_sections=0
if [ "$total_missing" -eq 0 ]; then
  echo ".gitignore: already has everything the template offers in $PROJECT_DIR"
else
  case "$(prefs_get gitignore.offerSectionUpdates "$PROJECT_DIR")" in
    false)
      echo ".gitignore: skipped entirely — no sections offered. (remembered answer gitignore.offerSectionUpdates=false — change with /bootstrap-config)"
      ;;
    true)
      # Schema default. The opening gate is dropped, but every section is still
      # offered by title below, so nothing is ever appended silently.
      review_sections=1
      echo ".gitignore: opening gate off (remembered answer gitignore.offerSectionUpdates=true — change with /bootstrap-config); each section is still offered by title."
      ;;
    *)
      # `ask`, `unset`, or an unrecognized value — today's behavior.
      if prompt_yn "  Review .gitignore updates? ($total_missing line(s) across $sections_offered section(s)) [y/N]: "; then
        review_sections=1
      else
        prefs_set gitignore.offerSectionUpdates "$PROJECT_DIR" false
        echo ".gitignore: skipped entirely — no sections offered."
      fi
      ;;
  esac
fi

if [ "$review_sections" -eq 1 ]; then
  i=1
  while [ "$i" -le "$SECTION_COUNT" ]; do
    SEC="$WORK_DIR/sec.$i"
    TITLE="section $i"
    [ -f "$WORK_DIR/title.$i" ] && TITLE="$(cat "$WORK_DIR/title.$i")"
    missing="$(section_missing_count "$SEC")"
    if [ "$missing" -gt 0 ]; then
      # The title -> key slug is computed by bootstrap-prefs.js, NOT here. One
      # banner title contains an em dash (U+2014): "Claude Code — machine-local
      # MCP registration (...)". A byte-wise awk/sed `[^a-z0-9]` slugifier sees
      # that character as three UTF-8 bytes and emits three dashes; the helper's
      # JS regex carries the `u` flag and emits one. Keeping a single Unicode-
      # aware implementation of the rule is the whole reason for the subshell.
      #
      # Guarded so a key we cannot compute never silently suppresses a section:
      # --section-key exits 1 when a title slugifies to empty, node may be absent
      # entirely, and this script runs under `set -euo pipefail`. On any failure
      # SECTION_KEY stays empty and we fall back to the unconditional prompt.
      SECTION_KEY=""
      if [ -f "$BOOTSTRAP_PREFS_JS" ] && command -v node >/dev/null 2>&1; then
        SECTION_KEY="$(node "$BOOTSTRAP_PREFS_JS" --section-key "$TITLE" 2>/dev/null)" || SECTION_KEY=""
      fi
      if [ -z "$SECTION_KEY" ]; then
        echo "  Warning: could not compute a preference key for .gitignore section '$TITLE' — asking every time." >&2
      fi

      if [ -n "$SECTION_KEY" ] && [ "$(prefs_get "$SECTION_KEY" "$PROJECT_DIR")" = "false" ]; then
        # Remembered decline: skip BEFORE the preview. Re-listing lines the user
        # already refused is the noise the remembered answer exists to remove.
        echo "  .gitignore section '$TITLE': skipped (remembered answer $SECTION_KEY=false — change with /bootstrap-config)."
      else
        # Show the actual lines before asking. Comment/blank lines are omitted:
        # they are only written as headers when a real entry follows, so listing
        # them would misrepresent what the "y" adds.
        echo "  .gitignore section '$TITLE' would add $missing line(s):"
        section_missing_lines "$SEC"
        if prompt_yn "  Add these to .gitignore? [y/N]: "; then
          # Deliberately records NOTHING on accept. A remembered `true` would
          # append on the next run without asking and break the promise at the
          # top of this file; the schema's one-value grammar (values: "false")
          # already rejects it, so there is no second copy of the rule here.
          merge_section "$SEC"
        else
          if [ -n "$SECTION_KEY" ]; then
            prefs_set "$SECTION_KEY" "$PROJECT_DIR" false
          fi
          echo "  .gitignore section '$TITLE': skipped."
        fi
      fi
    fi
    i=$((i + 1))
  done
fi

# Only summarise when the section pass actually ran; the gate's own message
# already said what happened otherwise, and a second "no changes made" line
# reads as if something was attempted.
if [ "$added" -gt 0 ]; then
  echo ".gitignore: $added line(s) merged into $PROJECT_DIR"
elif [ "$review_sections" -eq 1 ]; then
  echo ".gitignore: no changes made in $PROJECT_DIR"
fi

# Machine-local git exclusion for bootstrap agent state and preference files.
# These dirs must NEVER go into .gitignore: Serena (ignore_all_files_in_gitignore:
# true) and Claude Code's Grep mirror .gitignore and would go blind on the wiki.
# .git/info/exclude has identical semantics for git, is never committed (a
# per-machine choice, offered per-machine), and is invisible to Serena — its
# GitignoreParser reads only files named ".gitignore", so the dirs stay
# navigable. It is NOT invisible to every tool: ripgrep-class walkers and Claude
# Code's @ file picker do honor info/exclude. That is why install-global.sh
# installs ~/.claude/file-suggestion.sh and registers it as the fileSuggestion
# picker — it re-includes exactly the paths listed under the sentinel below.
#
# ONE sentinel, shared by both mechanisms below (wiki/agent-state dirs and the
# bootstrap-prefs files), so file-suggestion.sh's single hardcoded SENTINEL
# always matches regardless of which mechanism ran, in which order, or which
# options got picked. Generic text — not "wiki", not "preferences" — because
# it's read back only by name, never by content.
GIT_EXCLUDE="$PROJECT_DIR/.git/info/exclude"
EXCLUDE_SENTINEL="# bootstrap machine-local (autocomplete-visible)"

# The sentinel text this mechanism used before the two blocks were unified.
# Scrubbed on sight by exclude_ensure_paths so upgrading an existing project
# (like one that only ever answered the prefs.gitTracking question) cleans up
# the stale header automatically instead of leaving two competing sentinels.
LEGACY_PREFS_SENTINEL="# bootstrap preferences (machine-local)"

# Every path bootstrap ever excludes here, in the fixed order they're packed
# into the block when present. Each is independently optional — the block can
# hold anywhere from zero of these (the proactive empty case) to all five.
KNOWN_EXCLUDE_PATHS=(".serena/" "raw/" "wiki/" ".claude/bootstrap-prefs.json" ".claude/bootstrap-prefs.README.md")

# Set by exclude_ensure_paths after every call: 1 if the file's content changed,
# 0 if it was already exactly the desired shape (byte-identical, left untouched
# — mtime and permissions included). Callers use this to decide whether a
# repair/no-op message is worth printing.
EXCLUDE_CHANGED=0

# A user's own entry sitting INSIDE the sentinel block that isn't one of
# KNOWN_EXCLUDE_PATHS. exclude_ensure_paths re-appends our block at the bottom
# and leaves such an entry above it: git still excludes it, but the picker stops
# re-including it, so say so rather than change the user's view of their own
# file silently.
exclude_stranded() {
  [ -f "$1" ] || return 0
  # Space-joined, not newline-joined: BSD awk (macOS's default /usr/bin/awk)
  # rejects a `-v` value containing an embedded newline ("newline in string").
  # None of KNOWN_EXCLUDE_PATHS' fixed entries contain a space, so this is safe.
  awk -v sentinel="$EXCLUDE_SENTINEL" -v known="$(printf '%s ' "${KNOWN_EXCLUDE_PATHS[@]}")" '
    BEGIN { kc = split(known, klines, " ") }
    $0 == sentinel { in_block = 1; next }
    in_block && /^[[:space:]]*#/ { in_block = 0 }
    in_block && $0 !~ /^[[:space:]]*$/ {
      is_known = 0
      for (i = 1; i <= kc; i++) if ($0 == klines[i]) { is_known = 1; break }
      if (!is_known) print "    " $0
    }
  ' "$1"
}

# exclude_ensure_paths <file> [path...]: idempotently ensure the sentinel is
# present in <file> exactly once, immediately followed by every
# KNOWN_EXCLUDE_PATHS entry that is either already anywhere in the file (so a
# prior run's, or the other mechanism's, entries survive) or passed as an
# argument here — packed in KNOWN_EXCLUDE_PATHS order, terminated by a "#"
# comment or EOF. Everything else in the file survives verbatim and in its
# original relative order (this file may hold the user's own exclusions); the
# legacy pre-unification header is scrubbed on sight. A file already in exactly
# this shape is left byte-identical (EXCLUDE_CHANGED=0) so repeated/no-op calls
# never show up as a diff.
exclude_ensure_paths() {
  local file="$1"; shift
  local src="$file" tmp mode="" p a
  local want=()
  [ -f "$src" ] || src=/dev/null

  for p in "${KNOWN_EXCLUDE_PATHS[@]}"; do
    if [ -f "$src" ] && grep -qFx -- "$p" "$src"; then
      want+=("$p")
      continue
    fi
    for a in "$@"; do
      if [ "$a" = "$p" ]; then want+=("$p"); break; fi
    done
  done

  if [ -f "$file" ]; then
    mode=$(stat -f '%Lp' "$file" 2>/dev/null || stat -c '%a' "$file" 2>/dev/null || true)
  fi
  mkdir -p "$(dirname "$file")" || return 1
  tmp=$(mktemp "$(dirname "$file")/.bootstrap-exclude.XXXXXX") || return 1
  # Space-joined, not newline-joined: BSD awk (macOS's default /usr/bin/awk)
  # rejects a `-v` value containing an embedded newline ("newline in string").
  # `want` only ever holds entries from the fixed, space-free KNOWN_EXCLUDE_PATHS.
  awk -v sentinel="$EXCLUDE_SENTINEL" -v legacy="$LEGACY_PREFS_SENTINEL" \
      -v wanted="$(printf '%s ' ${want[@]+"${want[@]}"})" '
    BEGIN { n = 0; prev_blank = 1; dropped = 0; wc = split(wanted, wlines, " ") }
    $0 == sentinel || $0 == legacy { dropped = 1; next }
    {
      is_known = 0
      for (i = 1; i <= wc; i++) if (wlines[i] != "" && $0 == wlines[i]) { is_known = 1; break }
    }
    is_known { dropped = 1; next }
    {
      if ($0 ~ /^[[:space:]]*$/) {
        if (prev_blank && dropped) next
        prev_blank = 1
      } else {
        prev_blank = 0
      }
      keep[++n] = $0
      dropped = 0
    }
    END {
      while (n > 1 && keep[n] ~ /^[[:space:]]*$/ && keep[n - 1] ~ /^[[:space:]]*$/) n--
      if (n == 1 && keep[1] ~ /^[[:space:]]*$/) n = 0
      for (i = 1; i <= n; i++) print keep[i]
      print sentinel
      for (i = 1; i <= wc; i++) if (wlines[i] != "") print wlines[i]
    }
  ' "$src" > "$tmp" || { rm -f "$tmp"; return 1; }

  if [ -f "$file" ] && cmp -s "$file" "$tmp"; then
    rm -f "$tmp"
    EXCLUDE_CHANGED=0
    return 0
  fi
  mv -f "$tmp" "$file" || { rm -f "$tmp"; return 1; }
  if [ -n "$mode" ]; then chmod "$mode" "$file" 2>/dev/null || true; fi
  EXCLUDE_CHANGED=1
  return 0
}

# Normalize and report. Never fatal: this runs under `set -euo pipefail` from
# run_project_sync and must not abort the user's setup.
exclude_apply() {
  local file="$1"; shift
  local stranded
  stranded=$(exclude_stranded "$file")
  if ! exclude_ensure_paths "$file" "$@"; then
    echo "  Warning: could not update $file — left unchanged."
    return 1
  fi
  if [ -n "$stranded" ]; then
    echo "  Note: these entries were inside the bootstrap block and now sit above it."
    echo "  git still excludes them; @-autocomplete will no longer list them:"
    printf '%s\n' "$stranded"
  fi
  return 0
}

# Guarantees the shared sentinel exists even if nothing is excluded yet, so any
# bootstrap feature — this run or a future one — always finds the same anchor
# regardless of which of the prompts below get accepted or declined. A bare
# comment line excludes nothing, so writing it needs no consent prompt. Stays
# quiet unless this call is what introduces the sentinel for the very first
# time on a file with no bootstrap-managed paths yet — otherwise the branches
# below describe whatever they changed themselves.
exclude_ensure_sentinel() {
  local file="$1" had_sentinel=false had_known=false p
  if [ -f "$file" ]; then
    grep -qFx -- "$EXCLUDE_SENTINEL" "$file" 2>/dev/null && had_sentinel=true
    for p in "${KNOWN_EXCLUDE_PATHS[@]}"; do
      grep -qFx -- "$p" "$file" 2>/dev/null && { had_known=true; break; }
    done
  fi
  exclude_apply "$file" || return 0
  if [ "$EXCLUDE_CHANGED" -eq 1 ] && [ "$had_sentinel" = false ] && [ "$had_known" = false ]; then
    echo "  .git/info/exclude: added shared bootstrap sentinel (machine-local; nothing excluded yet)"
  fi
}

if [ -d "$PROJECT_DIR/.git" ]; then
  exclude_ensure_sentinel "$GIT_EXCLUDE"

  exclude_missing=0
  exclude_added=""
  for p in ".serena/" "raw/" "wiki/"; do
    if [ -f "$GIT_EXCLUDE" ] && grep -qFx -- "$p" "$GIT_EXCLUDE"; then
      continue
    fi
    exclude_missing=$((exclude_missing + 1))
    exclude_added="${exclude_added}  + ${p} (.git/info/exclude)"$'\n'
  done

  if [ "$exclude_missing" -gt 0 ]; then
    # Accepting newly hides paths from git, so this stays a consent prompt.
    #
    # `gitignore.infoExclude` is declines-only: a decline records `false` and
    # suppresses the re-offer, an accept records NOTHING, because accepting
    # changes the world and exclude_ensure_paths's byte-identical no-op above
    # already makes it sticky. Keep this key distinct from
    # `gitignore.offerSectionUpdates` (the .gitignore section pass) and
    # `prefs.gitTracking` (the preference files themselves) — declining one must
    # never disable another.
    if [ "$(prefs_get gitignore.infoExclude "$PROJECT_DIR")" = "false" ]; then
      echo "  .git/info/exclude: skipped (remembered answer gitignore.infoExclude=false — change with /bootstrap-config)."
    elif prompt_yn "  Add .serena/, raw/, and wiki/ to git's local ignore list (.git/info/exclude, this machine only)? [y/N]: "; then
      if exclude_apply "$GIT_EXCLUDE" ".serena/" "raw/" "wiki/"; then
        printf '%s' "$exclude_added"
        echo "  Note: this protects only this clone — teammates opt in by running 'npx @codewizard-dt/bootstrap update' themselves."
      fi
    else
      prefs_set gitignore.infoExclude "$PROJECT_DIR" false
    fi
  else
    # All three are already excluded somewhere in the file: git's behaviour does
    # not change, only the picker's view of it. A pure repair, so no prompt —
    # deliberately regardless of the stored `gitignore.infoExclude` value, since
    # a decline refuses newly hiding paths, not repairing a sentinel.
    # exclude_apply is a byte-identical no-op when the block is already
    # canonical, so EXCLUDE_CHANGED gates the message.
    if exclude_apply "$GIT_EXCLUDE" ".serena/" "raw/" "wiki/" && [ "$EXCLUDE_CHANGED" -eq 1 ]; then
      echo "  .git/info/exclude: reordered .serena/, raw/, wiki/ under the bootstrap sentinel (git unchanged; restores @-autocomplete)"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# How should git treat the preference files themselves?
#
# Asked LAST, after both passes above, so that any answer recorded earlier in
# this run has already created <project>/.claude/bootstrap-prefs.json and its
# generated companion .claude/bootstrap-prefs.README.md. The paths being offered
# therefore actually exist, and the user can open them before deciding.
#
# Chicken-and-egg, and it needs no special handling: the answer to this question
# lives in the very file the question governs. The values file is created by the
# first recorded answer and the question is asked afterwards, so the file is
# always there by the time we get here. `[3] neither` is a pure no-op that
# leaves prior state untouched, and `[1]` writes to .gitignore while the user is
# being asked, explicitly, right then — so the promise in this file's header
# comment (nothing reaches a project's .gitignore unasked) holds for that
# branch too.
#
# `prefs.gitTracking` is the ONE key in this script recorded in ALL THREE
# directions. The declines-only rule that governs gitignore.offerSectionUpdates
# and gitignore.infoExclude deliberately does NOT apply: this is a choice among
# three outcomes, not a yes/no on adding lines, so every answer is a real
# decision worth remembering. prompt_choice_sticky does that recording itself —
# do NOT also call prefs_set. One answer governs BOTH files; they live in the
# same directory precisely so a single question can cover them.
#
# The `has_tty` guard is belt-and-braces — the tty check at :40 already exits
# before this point on a non-interactive run. It stays because it is the seam a
# rework of that guard hangs off, and because reaching prompt_choice_sticky
# without a tty would resolve to the default without anyone being asked.
# ---------------------------------------------------------------------------
if has_tty; then
  # The two governed paths, defined once.
  PREFS_VALUES_PATH=".claude/bootstrap-prefs.json"
  PREFS_README_PATH=".claude/bootstrap-prefs.README.md"

  echo "  How should .claude/bootstrap-prefs.json be treated by git?"
  echo "    [1] .gitignore          — ignored for everyone who clones this repo (shared decision)"
  echo "    [2] .git/info/exclude   — ignored on this machine only, teammates unaffected (default)"
  echo "    [3] neither             — commit it, so the whole team shares these answers"
  # Resolution is POSITIONAL: the trailing name list must stay in the printed
  # menu order above, or a typed digit silently resolves to the wrong outcome.
  answer="$(prompt_choice_sticky prefs.gitTracking "$PROJECT_DIR" exclude "  How should we proceed? [1/2/3]: " gitignore exclude neither)"

  case "$answer" in
    gitignore)
      prefs_written=0
      for p in "$PREFS_VALUES_PATH" "$PREFS_README_PATH"; do
        if [ -f "$TARGET" ] && grep -qFx -- "$p" "$TARGET"; then
          continue
        fi
        if [ "$prefs_written" -eq 0 ]; then
          if [ -s "$TARGET" ]; then
            # Same idiom as merge_section: $() strips a trailing newline, so a
            # non-empty result means the file does not end in one.
            if [ -n "$(tail -c1 "$TARGET")" ]; then printf '\n' >> "$TARGET"; fi
            printf '\n' >> "$TARGET"
          fi
          printf '# bootstrap preferences (remembered installer answers)\n' >> "$TARGET"
        fi
        printf '%s\n' "$p" >> "$TARGET"
        echo "  + $p"
        prefs_written=$((prefs_written + 1))
      done
      if [ "$prefs_written" -eq 0 ]; then
        echo "  .gitignore: already ignores the bootstrap preference files."
      else
        echo "  .gitignore: bootstrap preference files ignored for everyone who clones this repo."
      fi
      ;;
    exclude)
      if [ ! -d "$PROJECT_DIR/.git" ]; then
        echo "  .git/info/exclude: $PROJECT_DIR is not a git repository — nothing to exclude; the preference files stay visible to git."
      else
        prefs_written=0
        prefs_added=""
        for p in "$PREFS_VALUES_PATH" "$PREFS_README_PATH"; do
          if [ -f "$GIT_EXCLUDE" ] && grep -qFx -- "$p" "$GIT_EXCLUDE"; then
            continue
          fi
          prefs_written=$((prefs_written + 1))
          prefs_added="${prefs_added}  + ${p} (.git/info/exclude)"$'\n'
        done
        # Same shared sentinel and merge function the wiki-dirs block above
        # uses — both mechanisms converge on one block so file-suggestion.sh's
        # single hardcoded SENTINEL always matches, regardless of which of the
        # two ran first or which options were chosen. exclude_ensure_paths only
        # adds paths it's asked for (or that were already present), so this
        # never force-adds .serena/, raw/, or wiki/ for a user who declined
        # that separately — and it scrubs the legacy pre-unification header on
        # sight if this project still has it.
        if exclude_apply "$GIT_EXCLUDE" "$PREFS_VALUES_PATH" "$PREFS_README_PATH"; then
          if [ "$prefs_written" -eq 0 ]; then
            if [ "$EXCLUDE_CHANGED" -eq 1 ]; then
              echo "  .git/info/exclude: already excludes the bootstrap preference files (repositioned under the shared bootstrap sentinel)."
            else
              echo "  .git/info/exclude: already excludes the bootstrap preference files."
            fi
          else
            printf '%s' "$prefs_added"
            echo "  Note: this hides them on THIS machine only — teammates are unaffected."
          fi
        fi
      fi
      ;;
    neither|*)
      echo "  .claude/bootstrap-prefs.json and .claude/bootstrap-prefs.README.md stay visible to git — commit them so the whole team shares these answers."
      ;;
  esac
fi
