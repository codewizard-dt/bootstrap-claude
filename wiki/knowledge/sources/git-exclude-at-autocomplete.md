---
id: git-exclude-at-autocomplete
title: "Research: git exclude vs Claude Code @ autocomplete"
aliases: [fileSuggestion research, at-autocomplete research]
updated: 2026-07-29
sources:
  - ../../../raw/research/git-exclude-at-autocomplete/index.md
confidence: extracted
tags: [gitignore, claude-code, autocomplete, wiki-infrastructure]
---

# Research: git exclude vs Claude Code `@` autocomplete

Follow-up to derived_from::[[gitignored-wiki-tool-visibility]]: the adopted `.git/info/exclude` mechanism keeps [[Serena]] sighted and git quiet, but **breaks Claude Code's `@` file autocomplete** — the prior research's "Claude tools unaffected" assumption does not hold for the file picker. Verified on three fronts: ripgrep documents honoring `$GIT_DIR/info/exclude` (and a local `rg --files` experiment confirms it), Claude Code's picker filters `info/exclude`d files (anthropics/claude-code#5657), and **recent versions (v2.1.85+/v2.1.94) suggest only git-*tracked* files at all** — the picker "appears to rely exclusively on `git ls-files`" (#40082, #45012).

**No git-side layout fixes this.** Plain-untracked dirs are excluded by the tracked-only regression; nested embedded git repos are rg-visible and give a bonus safety property (outer `git add -A` can only stage a gitlink stub, never the contents — with a loud warning), but Claude Code's traversal "treats nested `.git` directories as repository boundaries and excludes them from indexing" (#15192). And silencing the nested repo's `?? wiki/` status noise via `info/exclude` re-blinds rg. No built-in toggle exists either — requested options (`includeGitignored`, `.claudeinclude`, `CLAUDE_CODE_IGNORE_GITIGNORE`) were never implemented. Manually typing a full `@wiki/...` path still works; only the suggestions are missing.

**The escape hatch is on the Claude Code side**: the officially documented relates_to::[[claude-code-file-picker]] `fileSuggestion` setting replaces the built-in picker with a custom command (stdin JSON `{"query": ...}`, `CLAUDE_PROJECT_DIR` env, newline-separated paths on stdout, restart required). A custom command bypasses **all** ignore/tracked-only filtering — the script decides what is suggestible.

**Recommendation**: keep `.git/info/exclude` exactly as shipped and add a bootstrap-installed `fileSuggestion` script — `rg --files` plus `rg --files --no-ignore <dir>` for paths listed under the bootstrap sentinel (`# bootstrap wiki & agent state (machine-local)`) in `.git/info/exclude`, so a user's *other* deliberately-hidden entries stay hidden and non-bootstrap projects get built-in-equivalent behavior. Register via a settings merge in `install-global.sh` (never clobbering an existing user `fileSuggestion`), and correct the over-broad "invisible to the tools" claims in `merge-gitignore.sh`, the gitignore template note, and contradicts::[[git-ignore-tool-visibility]] (the concept's decision rule needed narrowing to Serena).
