---
id: claude-code-file-picker
title: Claude Code @ File Picker (fileSuggestion)
aliases: [fileSuggestion, at-mention autocomplete, @ autocomplete]
updated: 2026-07-29
sources:
  - ../../../../raw/research/git-exclude-at-autocomplete/index.md
confidence: extracted
tags: [claude-code, autocomplete, tooling]
---

# Claude Code `@` File Picker (`fileSuggestion`)

The interactive fuzzy file suggester behind `@`-mentions in Claude Code. **Its built-in indexing is git-centric and strict**: it honors `.gitignore` *and* `.git/info/exclude` (anthropics/claude-code#5657), and since v2.1.85/v2.1.94 it suggests only git-**tracked** files — "appears to rely exclusively on `git ls-files`" (#40082, #45012) — so untracked files and nested embedded git repos (#15192: nested `.git` dirs are treated as repository boundaries) never appear. No setting or env var flips this behavior; the requested toggles were closed as duplicates without implementation. Typing a full path manually still attaches the file — only suggestions are filtered.

**The supported override is the `fileSuggestion` setting** (documented in the settings reference): `{ "fileSuggestion": { "type": "command", "command": "~/.claude/file-suggestion.sh" } }`. The command runs with hook environment variables (including `CLAUDE_PROJECT_DIR`), receives JSON on stdin with a `query` field, and prints newline-separated relative paths to stdout (~15 useful; community-verified contract); a restart is required to pick it up. A custom command **replaces the built-in indexing entirely**, bypassing gitignore/info-exclude/tracked-only filtering — which makes it the escape hatch for keeping `info/exclude`-hidden dirs suggestible. derived_from::[[git-exclude-at-autocomplete]] relates_to::[[git-ignore-tool-visibility]]
