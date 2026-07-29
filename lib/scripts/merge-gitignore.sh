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

i=1
while [ "$i" -le "$SECTION_COUNT" ]; do
  SEC="$WORK_DIR/sec.$i"
  TITLE="section $i"
  [ -f "$WORK_DIR/title.$i" ] && TITLE="$(cat "$WORK_DIR/title.$i")"
  missing="$(section_missing_count "$SEC")"
  if [ "$missing" -eq 0 ]; then
    : # nothing new to offer for this section
  elif prompt_yn "  Add/update .gitignore section '$TITLE' ($missing new line(s))? [y/N]: "; then
    merge_section "$SEC"
  else
    echo "  .gitignore section '$TITLE': skipped."
  fi
  i=$((i + 1))
done

if [ "$added" -eq 0 ]; then
  echo ".gitignore: no changes made in $PROJECT_DIR"
else
  echo ".gitignore: $added line(s) merged into $PROJECT_DIR"
fi

# Machine-local git exclusion for bootstrap agent state. These dirs must NEVER
# go into .gitignore: Serena (ignore_all_files_in_gitignore: true) and Claude
# Code's Grep mirror .gitignore and would go blind on the wiki. .git/info/exclude
# has identical semantics for git but is invisible to those tools (Serena's
# GitignoreParser reads only files named ".gitignore") and is never committed —
# a per-machine choice, offered per-machine.
GIT_EXCLUDE="$PROJECT_DIR/.git/info/exclude"
if [ -d "$PROJECT_DIR/.git" ]; then
  exclude_missing=0
  for p in ".serena/" "raw/" "wiki/"; do
    [ -f "$GIT_EXCLUDE" ] && grep -qFx -- "$p" "$GIT_EXCLUDE" || exclude_missing=$((exclude_missing + 1))
  done
  if [ "$exclude_missing" -gt 0 ] \
    && prompt_yn "  Keep .serena/, raw/, wiki/ out of git on THIS machine (.git/info/exclude — not shared with the team; keeps them visible to Serena/Claude)? [y/N]: "; then
    mkdir -p "$PROJECT_DIR/.git/info"
    [ -f "$GIT_EXCLUDE" ] && [ -s "$GIT_EXCLUDE" ] && [ -n "$(tail -c1 "$GIT_EXCLUDE")" ] && printf '\n' >> "$GIT_EXCLUDE"
    grep -qFx -- "# bootstrap wiki & agent state (machine-local)" "$GIT_EXCLUDE" 2>/dev/null \
      || printf '# bootstrap wiki & agent state (machine-local)\n' >> "$GIT_EXCLUDE"
    for p in ".serena/" "raw/" "wiki/"; do
      grep -qFx -- "$p" "$GIT_EXCLUDE" || { printf '%s\n' "$p" >> "$GIT_EXCLUDE"; echo "  + $p (.git/info/exclude)"; }
    done
    echo "  Note: this protects only this clone — teammates opt in by running 'npx @codewizard-dt/bootstrap update' themselves."
  fi
fi
