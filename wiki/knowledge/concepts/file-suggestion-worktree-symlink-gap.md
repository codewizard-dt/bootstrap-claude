---
id: file-suggestion-worktree-symlink-gap
title: "fileSuggestion's @ Autocomplete Gap in Git Worktrees (Symlinked wiki/raw)"
aliases: [worktree autocomplete gap, file-suggestion.sh worktree bug, symlinked wiki not suggested]
updated: 2026-08-20
confidence: inferred
tags: [claude-code, autocomplete, git-worktree, fileSuggestion, bug]
---

# fileSuggestion's `@` Autocomplete Gap in Git Worktrees (Symlinked `wiki/`/`raw/`)

In a git worktree with `wiki/` and `raw/` symlinked back to the main checkout, Claude Code's `@` autocomplete never suggests either directory — even though the installed `fileSuggestion` command (relates_to::[[claude-code-file-picker]]) exists specifically to re-include them (see relates_to::[[git-ignore-tool-visibility]], derived_from::[[git-exclude-at-autocomplete]]). Direct inspection of the installed script, `lib/scripts/templates/file-suggestion.sh`, finds two compounding, previously-undocumented gaps — this page is LLM synthesis from reading that script, not a distillation of an ingested `raw/` source.

**Gap 1 — naive `.git/info/exclude` path.** `sentinel_entries()` guards on `[ -f .git/info/exclude ]` relative to the project's cwd. In a git worktree, `.git` is a **file** containing a `gitdir: <main-repo>/.git/worktrees/<name>` pointer, not a directory — `info/exclude` actually lives in the main checkout's common git dir, which worktrees share (unlike `HEAD`, `index`, and the other per-worktree private files under `.git/worktrees/<name>/`). Because the script never resolves this indirection (e.g. via `git rev-parse --git-common-dir`), the `-f` check fails silently inside any worktree, `sentinel_entries()` returns nothing, and `list_reincluded()` never re-adds `wiki/`/`raw/` — even though `list_base()`'s `rg --files` still correctly *excludes* them (rg itself resolves the worktree `.git` pointer fine; only this script's own check doesn't).

**Gap 2 — no `--follow` on re-inclusion.** Even with Gap 1 fixed, `list_reincluded()` calls `rg --files --no-ignore "$dir"`. Ripgrep does not descend into symlinked directories by default — `--follow`/`-L` is required. Since the worktree's `wiki/` and `raw/` are symlinks into the main checkout, this call returns nothing regardless of whether the sentinel lookup succeeds.

**Net effect**: the fix must resolve the true common-git-dir path (working from both the main worktree, where `.git` is already a directory, and any sibling worktree, where it is a `gitdir:` file) *and* pass `--follow` on the re-inclusion `rg` calls (and on the `find` fallback, via `-L`) — one gap without the other still leaves the picker blind to a symlinked `wiki/`/`raw/` in a worktree.

Tracked for a fix: implements::[[TASK-066]] — resolves the common git dir via `git rev-parse --git-common-dir` and adds `--follow`/`-L` to the re-inclusion pass.
