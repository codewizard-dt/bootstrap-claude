#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-project>"
  exit 1
fi

PROJECT_DIR="$(resolve_project_dir "$1")" || exit 1

# Preflight checks
if ! command -v claude &>/dev/null; then
  echo "Error: 'claude' (Claude Code) is not installed."
  echo "Install it with: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "Error: 'python3' is not installed."
  exit 1
fi

echo "Bootstrapping Serena for: $PROJECT_DIR"

cd "$PROJECT_DIR"

if [ ! -f ".serena/project.yml" ]; then
  # Fresh machines: serena's first launch via uvx clones the repo and builds a
  # venv, which can exceed Claude Code's MCP startup timeout. Prewarm the uvx
  # cache outside claude so the real launch is fast.
  if command -v uvx &>/dev/null; then
    echo "Prewarming Serena (first run downloads the package — may take a few minutes)..."
    uvx --from git+https://github.com/oraios/serena serena --help >/dev/null 2>&1 || true
  fi
  echo "Triggering Claude Code to initialize Serena (.serena/ will be created)..."
  if [ -f ".mcp.json" ]; then
    # Project-scoped .mcp.json servers need one-time interactive approval that a
    # headless --print run can never grant; --mcp-config + --strict-mcp-config
    # loads serena explicitly, bypassing the approval gate.
    claude --print --mcp-config .mcp.json --strict-mcp-config "exit" >/dev/null 2>&1 || true
  else
    claude --print "exit" >/dev/null 2>&1 || true
  fi
  if [ ! -f ".serena/project.yml" ]; then
    echo "Error: .serena/project.yml was not created by 'claude --print'."
    echo "Ensure Serena MCP is registered for this project — run 'npx @codewizard-dt/bootstrap setup' and answer Yes to the Serena prompt,"
    echo "or register it manually: claude mcp add --scope project serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project \"$PROJECT_DIR\""
    echo "If it IS registered, open 'claude' interactively in $PROJECT_DIR once to approve the project MCP servers, then re-run 'npx @codewizard-dt/bootstrap update'."
    exit 1
  fi
else
  echo ".serena/project.yml already exists, skipping claude --print step."
fi

PROJECT_YML="$PROJECT_DIR/.serena/project.yml"
REPLACED=$(python3 - "$PROJECT_YML" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
text = p.read_text()
needle = "included_optional_tools: []"
repl = (
    "included_optional_tools:\n"
    "  - list_dir\n"
    "  - find_file\n"
    "  - find_symbol\n"
    "  - find_referencing_symbols\n"
    "  - search_for_pattern\n"
    "  - replace_content\n"
    "  - replace_lines\n"
    "  - insert_at_line\n"
    "  - insert_after_symbol\n"
    "  - insert_before_symbol\n"
    "  - delete_lines"
)
count = text.count(needle)
if count:
    p.write_text(text.replace(needle, repl, 1))
print(count)
PY
)

if [ "$REPLACED" = "0" ]; then
  echo "Serena optional tools already configured, skipping."
elif [ "$REPLACED" = "1" ]; then
  echo "Added 11 optional tools."
else
  echo "Warning: replaced $REPLACED occurrences of the marker (expected 1)"
fi

# Ensure required languages are listed (markdown, python, typescript, yaml)
LANG_RESULT=$(python3 - "$PROJECT_YML" <<'PY'
import sys, re, pathlib

REQUIRED = ['markdown', 'python', 'typescript', 'yaml']

p = pathlib.Path(sys.argv[1])
text = p.read_text()

# Match the languages block including list items at ANY indentation (0-indent is valid YAML).
# Newer Serena versions renamed the key `languages:` -> `language_servers:`; accept both
# and preserve whichever the file uses. The trailing alternative allows a final item
# with no trailing newline.
LANG_BLOCK = re.compile(
    r'^((?:languages|language_servers):[ \t]*\n)'
    r'((?:[ \t]*-[ \t]+[^\n]+\n)*(?:[ \t]*-[ \t]+[^\n]+)?)',
    re.MULTILINE
)

bm = LANG_BLOCK.search(text)
if bm:
    existing   = re.findall(r'^[ \t]*-[ \t]+(\S+)', bm.group(2), re.MULTILINE)
    missing    = [lang for lang in REQUIRED if lang not in existing]
    # Detect items without leading whitespace (Serena occasionally generates these)
    bad_indent = bool(re.search(r'^-', bm.group(2), re.MULTILINE))

    if not missing and not bad_indent:
        print('present')
        sys.exit(0)

    # Rewrite entire block: deduplicate, sort, enforce 2-space indent
    all_langs = sorted(set(existing + missing))
    new_block = bm.group(1) + ''.join(f'  - {lang}\n' for lang in all_langs)
    p.write_text(text[:bm.start()] + new_block + text[bm.end():])
    print('added:' + ','.join(missing) if missing else 'present')
    sys.exit(0)

# languages: [] / language_servers: [] inline form
m = re.search(r'^((?:languages|language_servers):)[ \t]*\[\][ \t]*\n?', text, re.MULTILINE)
if m:
    block = m.group(1) + '\n' + ''.join(f'  - {lang}\n' for lang in REQUIRED)
    p.write_text(text[:m.start()] + block + text[m.end():])
    print('added:' + ','.join(REQUIRED))
    sys.exit(0)

# singular language: <value> — convert to list form and add required
m = re.search(r'^language:[ \t]*(\S+)[ \t]*\n?', text, re.MULTILINE)
if m:
    all_langs = sorted(set([m.group(1)] + REQUIRED))
    block = 'languages:\n' + ''.join(f'  - {lang}\n' for lang in all_langs)
    p.write_text(text[:m.start()] + block + text[m.end():])
    added = [lang for lang in REQUIRED if lang != m.group(1)]
    print('added:' + ','.join(added) if added else 'present')
    sys.exit(0)

print('no_key')
PY
)

if [ "$LANG_RESULT" = "present" ]; then
  echo "Serena required languages already configured (markdown, python, typescript, yaml), skipping."
elif [[ "$LANG_RESULT" == added:* ]]; then
  echo "Added languages to Serena config: ${LANG_RESULT#added:}"
  # Restart any running Serena process so it picks up the change
  if pkill -f "serena start-mcp-server" 2>/dev/null; then
    echo "Restarted Serena (language config changed)."
  else
    echo "Serena not running — updated config will apply on next start."
  fi
else
  echo "Warning: could not find a 'languages:' or 'language_servers:' key in .serena/project.yml — add markdown, python, typescript, yaml manually."
fi
