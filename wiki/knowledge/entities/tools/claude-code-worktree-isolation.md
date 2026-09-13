---
id: claude-code-worktree-isolation
title: "Claude Code Worktree Isolation (isolation: \"worktree\")"
aliases: [isolation worktree, worktree isolation, subagent worktree]
updated: 2026-09-13
sources:
  - ../../../../raw/research/claude-code-ecosystem-2026/index.md
confidence: extracted
tags: [claude-code, worktrees, subagents, parallelism]
---

# Claude Code Worktree Isolation (`isolation: "worktree"`)

An official Agent-tool/subagent frontmatter primitive: a subagent definition can declare `isolation: "worktree"` so every invocation of that agent role runs in its own git worktree, backed by the repository's shared `.git`, rather than the caller's working directory. The isolation applies **per invocation, not per definition** — a fan-out call that invokes the same agent role N times in parallel (the exact shape of orchestration this repo's `now` and `power-mode` skills produce) gets N separate worktrees automatically, eliminating file-edit collisions between concurrent agents without any manual `git worktree add` bookkeeping.

**Known friction, matching this repo's own `git-commit` skill's worktree-safety reasoning** (see relates_to::[[bootstrap-claude-hooks]] for the parallel concern around `--show-toplevel` vs. `--git-common-dir`): stale worktrees accumulate on disk if cleanup isn't wired in, and MCP servers with persistent state (not this repo's mostly-stateless MCP set, but worth noting) need to be scoped per-worktree rather than shared.

**Status in this repo:** not adopted anywhere. A pattern search across `lib/skills/*/SKILL.md` found zero uses of `isolation: worktree` or subagent-level worktree frontmatter — the only "worktree" hits are `git-commit`'s unrelated discussion of `--show-toplevel` resolving correctly inside a linked worktree. This is a real gap given this repo's own CLAUDE.md describes `now`, `tackle`, and `power-mode` as running "heavy concurrent subagent orchestration," which is precisely the workload shape this primitive targets. derived_from::[[claude-code-ecosystem-2026]] recommends adding `isolation: "worktree"` to code-writing subagent spawns in those three skills as a low-risk, low-effort first step, ahead of the larger plugin-marketplace question (relates_to::[[claude-code-plugin-marketplace]]).
