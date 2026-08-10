---
id: git-ignore-tool-visibility
title: Git-Ignore Tool Visibility
aliases: [info-exclude escape hatch, gitignore blinds agent tools]
updated: 2026-07-29
sources:
  - ../../raw/research/gitignored-wiki-tool-visibility/index.md
  - ../../raw/research/git-exclude-at-autocomplete/index.md
confidence: extracted
tags: [gitignore, agent-tooling, pattern]
---

# Git-Ignore Tool Visibility

**Pattern**: agent tooling increasingly treats git's ignore rules as a relevance oracle — [[Serena]] (with `ignore_all_files_in_gitignore: true`), Claude Code's `Grep`, ripgrep-based search generally, and the relates_to::[[claude-code-file-picker]] `@` file picker all skip ignored paths. Adding a directory to `.gitignore` therefore does two things at once: keeps it out of the repository **and silently removes it from the agent's searchable world**. When the second effect is unwanted (machine-local knowledge bases, generated docs the agent must read), `.gitignore` is the wrong mechanism.

**`.git/info/exclude` is a narrower escape hatch than first thought**: same ignore semantics for git, per-clone and never committed — and invisible to **Serena** specifically, whose `GitignoreParser` discovers only files named `.gitignore` (verified at `file_system.py:176`). But it does **not** keep paths visible to ripgrep-class tools: ripgrep's guide documents honoring `$GIT_DIR/info/exclude`, and Claude Code's `@` picker filters those files too (anthropics/claude-code#5657) — recent versions suggest only git-*tracked* files at all.

> **Contradiction (resolved):** this page previously claimed `info/exclude` "keeps the paths tool-visible … visible to (most) agents", per [gitignored-wiki-tool-visibility](../sources/gitignored-wiki-tool-visibility.md), which had left the ripgrep interaction unverified. [git-exclude-at-autocomplete](../sources/git-exclude-at-autocomplete.md) verified the opposite for ripgrep-class tools and the `@` picker (rg guide + local experiment + upstream issues); the claim is now narrowed to Serena. supersedes::[[gitignored-wiki-tool-visibility]]

Decision rule distilled: **`.gitignore` = ignored by git AND by agents; `.git/info/exclude` = ignored by git, visible to Serena but NOT to ripgrep-class tools or the `@` picker; git-side mechanisms cannot buy back picker visibility — the `fileSuggestion` custom-command setting can** (it replaces the built-in picker's indexing entirely). In this repo's tooling, the "Bootstrap wiki & agent state" exclusion (`.serena/`, `raw/`, `wiki/`) ships as an interactive `info/exclude` offer, never as `.gitignore` entries, paired with a `fileSuggestion` script that re-includes the sentinel-scoped excluded paths. derived_from::[[gitignored-wiki-tool-visibility]] derived_from::[[git-exclude-at-autocomplete]]
