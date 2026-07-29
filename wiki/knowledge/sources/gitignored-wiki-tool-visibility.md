---
id: gitignored-wiki-tool-visibility
title: "Research: Keeping .serena/, raw/, wiki/ out of git without blinding Serena or Claude"
aliases: [gitignore tool visibility research, info-exclude research]
updated: 2026-07-29
sources:
  - ../../../raw/research/gitignored-wiki-tool-visibility/index.md
confidence: extracted
tags: [gitignore, serena, claude-code, wiki-infrastructure]
---

# Research: gitignored wiki dirs vs tool visibility

Investigated whether the (briefly proposed) `.gitignore` entries for `.serena/`, `raw/`, and `wiki/` — meant to keep machine-local agent state out of team repositories — would break the tools that depend on those directories. **They would**: derived_from::[[gitignored-wiki-tool-visibility]] verified in upstream source that [[Serena]]'s `GitignoreParser` mirrors git's ignore rules exactly when `ignore_all_files_in_gitignore: true` (the bootstrap default), and Claude Code's `Grep` also skips gitignored paths. **No allowlist escape exists** — gitignore-style negation in Serena's `ignored_paths` is broken/unsupported upstream (oraios/serena#600), and negating inside `.gitignore` itself would un-ignore the paths for git too.

**The escape hatch is `.git/info/exclude`**: identical ignore semantics for git, but it lives inside `.git/` (never committed, never shared) and — the load-bearing, source-verified fact — Serena's `_iter_gitignore_files` discovers only files literally named `.gitignore` (`src/serena/util/file_system.py:176`), so `info/exclude` entries are **invisible to Serena**. Claude Code's `Read` (explicit paths) and `Glob` (ignores nothing by default) are unaffected; `Grep` may skip the dirs either way (ripgrep's defaults honor `info/exclude` — undocumented for Claude's wrapper), mitigated because Serena is the mandated search surface in bootstrap projects. relates_to::[[git-ignore-tool-visibility]]

> **Contradiction (resolved by follow-up):** the "Claude tools unaffected" framing was too broad. superseded_by::[[git-exclude-at-autocomplete]] verified that ripgrep-class tools *do* honor `info/exclude` and that Claude Code's `@` file picker skips these files entirely (recent versions suggest only git-tracked files). The `info/exclude` mechanism stands, but must be paired with a custom `fileSuggestion` command to keep `@` autocomplete working — see [git-exclude-at-autocomplete](git-exclude-at-autocomplete.md).

**Recommendation adopted**: never ship `.serena/`/`raw/`/`wiki/` in the `.gitignore` template; instead the interactive sync offers to append them to `$PROJECT_DIR/.git/info/exclude` (idempotent, git-repos only). Known trade-off: `info/exclude` is per-clone — each teammate opts in on their own machine; a team wanting a hard, shared guarantee can still commit the entries themselves at the cost of tool blindness.
