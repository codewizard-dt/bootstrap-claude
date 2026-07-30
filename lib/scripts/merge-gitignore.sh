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
# .gitignore entries without asking.
if [ "$INTERACTIVE" = false ] || [ ! -t 0 ]; then
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
review_sections=0
if [ "$total_missing" -eq 0 ]; then
  echo ".gitignore: already has everything the template offers in $PROJECT_DIR"
elif prompt_yn "  Review .gitignore updates? ($total_missing line(s) across $sections_offered section(s)) [y/N]: "; then
  review_sections=1
else
  echo ".gitignore: skipped entirely — no sections offered."
fi

if [ "$review_sections" -eq 1 ]; then
  i=1
  while [ "$i" -le "$SECTION_COUNT" ]; do
    SEC="$WORK_DIR/sec.$i"
    TITLE="section $i"
    [ -f "$WORK_DIR/title.$i" ] && TITLE="$(cat "$WORK_DIR/title.$i")"
    missing="$(section_missing_count "$SEC")"
    if [ "$missing" -gt 0 ]; then
      # Show the actual lines before asking. Comment/blank lines are omitted:
      # they are only written as headers when a real entry follows, so listing
      # them would misrepresent what the "y" adds.
      echo "  .gitignore section '$TITLE' would add $missing line(s):"
      section_missing_lines "$SEC"
      if prompt_yn "  Add these to .gitignore? [y/N]: "; then
        merge_section "$SEC"
      else
        echo "  .gitignore section '$TITLE': skipped."
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

# Machine-local git exclusion for bootstrap agent state. These dirs must NEVER
# go into .gitignore: Serena (ignore_all_files_in_gitignore: true) and Claude
# Code's Grep mirror .gitignore and would go blind on the wiki. .git/info/exclude
# has identical semantics for git, is never committed (a per-machine choice,
# offered per-machine), and is invisible to Serena — its GitignoreParser reads
# only files named ".gitignore", so the dirs stay navigable. It is NOT invisible
# to every tool: ripgrep-class walkers and Claude Code's @ file picker do honor
# info/exclude. That is why install-global.sh installs ~/.claude/file-suggestion.sh
# and registers it as the fileSuggestion picker — it re-includes exactly the paths
# listed under the sentinel written below.
GIT_EXCLUDE="$PROJECT_DIR/.git/info/exclude"
EXCLUDE_SENTINEL="# bootstrap wiki & agent state (machine-local)"

# Canonical form is what file-suggestion.sh can actually parse: the sentinel
# line, immediately followed by .serena/, raw/, wiki/ in that order, each of the
# four appearing exactly once, and the block terminated by a "#" comment or EOF.
# A path sitting ABOVE the sentinel is still excluded by git but invisible to the
# picker, so appending only the absent paths is not enough — we normalize.
exclude_is_canonical() {
  [ -f "$1" ] || return 1
  awk -v sentinel="$EXCLUDE_SENTINEL" '
    { line[NR] = $0 }
    $0 == sentinel { sent++; at = NR }
    $0 == ".serena/" { a++ }
    $0 == "raw/" { b++ }
    $0 == "wiki/" { c++ }
    END {
      if (sent != 1 || a != 1 || b != 1 || c != 1) exit 1
      if (line[at + 1] != ".serena/" || line[at + 2] != "raw/" || line[at + 3] != "wiki/") exit 1
      if (at + 3 < NR && line[at + 4] !~ /^[[:space:]]*#/) exit 1
      exit 0
    }
  ' "$1"
}

# A user's own entry sitting INSIDE the sentinel block. Normalizing re-appends
# our block at the bottom and leaves such an entry above it: git still excludes
# it, but the picker stops re-including it, so say so rather than change the
# user's view of their own file silently.
exclude_stranded() {
  [ -f "$1" ] || return 0
  awk -v sentinel="$EXCLUDE_SENTINEL" '
    $0 == sentinel { in_block = 1; next }
    in_block && /^[[:space:]]*#/ { in_block = 0 }
    in_block && $0 !~ /^[[:space:]]*$/ \
      && $0 != ".serena/" && $0 != "raw/" && $0 != "wiki/" { print "    " $0 }
  ' "$1"
}

# Scrub every occurrence of the sentinel and of the three exact whole-line paths
# from anywhere in the file, then re-append the canonical block at the bottom.
# Every other line survives verbatim and in its original order (this file may
# hold the user's own exclusions); only a blank run the scrub itself created is
# collapsed, and the result ends with exactly one newline.
exclude_normalize() {
  local file="$1" src="$1" tmp mode=""
  [ -f "$src" ] || src=/dev/null
  if [ -f "$file" ]; then
    mode=$(stat -f '%Lp' "$file" 2>/dev/null || stat -c '%a' "$file" 2>/dev/null || true)
  fi
  mkdir -p "$(dirname "$file")" || return 1
  tmp=$(mktemp "$(dirname "$file")/.bootstrap-exclude.XXXXXX") || return 1
  awk -v sentinel="$EXCLUDE_SENTINEL" '
    BEGIN { n = 0; prev_blank = 1; dropped = 0 }
    $0 == sentinel || $0 == ".serena/" || $0 == "raw/" || $0 == "wiki/" { dropped = 1; next }
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
      print ".serena/"
      print "raw/"
      print "wiki/"
    }
  ' "$src" > "$tmp" || { rm -f "$tmp"; return 1; }
  mv -f "$tmp" "$file" || { rm -f "$tmp"; return 1; }
  if [ -n "$mode" ]; then chmod "$mode" "$file" 2>/dev/null || true; fi
  return 0
}

# Normalize and report. Never fatal: this runs under `set -euo pipefail` from
# run_project_sync and must not abort the user's setup.
exclude_apply() {
  local stranded
  stranded=$(exclude_stranded "$GIT_EXCLUDE")
  if ! exclude_normalize "$GIT_EXCLUDE"; then
    echo "  Warning: could not update $GIT_EXCLUDE — left unchanged."
    return 1
  fi
  if [ -n "$stranded" ]; then
    echo "  Note: these entries were inside the bootstrap block and now sit above it."
    echo "  git still excludes them; @-autocomplete will no longer list them:"
    printf '%s\n' "$stranded"
  fi
  return 0
}

if [ -d "$PROJECT_DIR/.git" ]; then
  exclude_missing=0
  exclude_added=""
  for p in ".serena/" "raw/" "wiki/"; do
    if [ -f "$GIT_EXCLUDE" ] && grep -qFx -- "$p" "$GIT_EXCLUDE"; then
      continue
    fi
    exclude_missing=$((exclude_missing + 1))
    exclude_added="${exclude_added}  + ${p} (.git/info/exclude)"$'\n'
  done

  if exclude_is_canonical "$GIT_EXCLUDE"; then
    : # already canonical — leave the file byte-identical
  elif [ "$exclude_missing" -gt 0 ]; then
    # Accepting newly hides paths from git, so this stays a consent prompt.
    if prompt_yn "  Keep .serena/, raw/, wiki/ out of git on THIS machine (.git/info/exclude — not shared with the team; visible to Serena; @-autocomplete restored via the installed fileSuggestion script)? [y/N]: "; then
      if exclude_apply; then
        printf '%s' "$exclude_added"
        echo "  Note: this protects only this clone — teammates opt in by running 'npx @codewizard-dt/bootstrap update' themselves."
      fi
    fi
  else
    # All three are already excluded somewhere in the file: git's behaviour does
    # not change, only the picker's view of it. A pure repair, so no prompt.
    if exclude_apply; then
      echo "  .git/info/exclude: reordered .serena/, raw/, wiki/ under the bootstrap sentinel (git unchanged; restores @-autocomplete)"
    fi
  fi
fi
