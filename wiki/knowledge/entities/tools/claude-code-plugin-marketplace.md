---
id: claude-code-plugin-marketplace
title: Claude Code Plugin Marketplace
aliases: [plugin marketplace, .claude-plugin, marketplace.json, /plugin install]
updated: 2026-09-13
sources:
  - ../../../../raw/research/claude-code-ecosystem-2026/index.md
confidence: extracted
tags: [claude-code, plugins, distribution, marketplace]
---

# Claude Code Plugin Marketplace

The platform-native distribution mechanism for skills, agents, hooks, and MCP server bundles, superseding ad hoc "clone this repo into `~/.claude/`" installers for a fast-growing share of the ecosystem. A marketplace is simply a git repository with `.claude-plugin/marketplace.json` at its root, naming one or more plugins by a `source` path; each plugin carries its own `.claude-plugin/plugin.json` plus any mix of `commands/`, `agents/`, `skills/`, `hooks/hooks.json`, and `.mcp.json`. Anthropic's official marketplace (`claude-plugins-official`) auto-registers on first interactive launch and bundles ~100 first-party/partner plugins; a third-party marketplace registers with `/plugin marketplace add <owner>/<repo>` and installs with `/plugin install <name>@<marketplace>`.

**Adoption signal.** `obra/superpowers` — a brainstorm→plan→TDD→review skill-pack workflow structurally comparable to this repo's own `req-create → req-finalize → decision-create → task-add → tackle → uat` pipeline — was accepted into the official marketplace and crossed roughly 94k–170k GitHub stars across its listings; community indexes track over 15,000 third-party plugin repositories as of mid-2026. Plugins can also carry a `SessionStart` hook that injects a forcing instruction ("you have Superpowers, go read this skill first") into every new session — a pattern this repo's own `/primer` skill achieves differently, via an explicit user-invoked Serena-memory refresh rather than an unconditional session-start injection.

**Status in this repo:** not adopted. This repo (`bootstrap-claude`) ships exclusively through `lib/scripts/install-global.sh`, which rsyncs `lib/skills/` and `lib/hooks/` into `~/.claude/` and merges deny-list/hook-wiring JSON templates — no `.claude-plugin/marketplace.json` or `plugin.json` exists anywhere in the repo. Adopting the plugin marketplace as an additional or replacement distribution path is a significant, decision-worthy architectural question (dual distribution paths, versioning semantics, how `bootstrap-prefs.js` and the deny-list merge coexist with plugin-scoped settings) — flagged in derived_from::[[claude-code-ecosystem-2026]] as a `/decision-create` candidate rather than a task.
