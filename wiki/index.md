---
title: Wiki Index
updated: 2026-08-15
---

# Wiki Index — Home Map

The page catalog and home Map of Content for this wiki. **Read this first on every query**, then drill into the linked pages. Updated on every ingest and every filed answer.

Conventions that govern every page (atomic pages, stable IDs, typed links, frontmatter namespace): see [conventions](conventions.md). Operation history: see [log](log.md). Session-handoff summary of the most recent work: see [hot cache](hot.md).

Entry format: `- [Title](path) — one-line summary`.

The wiki is split into two domains with opposite organizing laws:
- **Knowledge** — timeless, link-navigated synthesis (sources, concepts, entities). Pages are listed individually below.
- **Work** — stateful, status-navigated lifecycle artifacts (requirements, decisions, roadmaps, tasks, uat, bugs). Items are **not** listed here — each family keeps its own `index.md` of active items; this page links to those.

---

## Knowledge

### Sources
- [Research: Improving the LLM Wiki tooling](knowledge/sources/wiki-tooling-improvements.md) — what's changed in the second-brain/LLM-wiki ecosystem since Karpathy's gist, and what's portable to this repo
- [Research: Serena MCP server disconnects mid-session](knowledge/sources/serena-mcp-disconnect.md) — live-reproduced root cause: the health-tracking hook kills a live Serena process on a misclassified error, plus a state-file race that can hard-block the fallback too
- [Research: gitignored wiki dirs vs tool visibility](knowledge/sources/gitignored-wiki-tool-visibility.md) — gitignoring .serena/raw/wiki blinds Serena and Claude Grep; .git/info/exclude is the source-verified escape hatch
- [Research: Agent Sandbox-Escape Vectors Relevant to Claude Code](knowledge/sources/agent-sandbox-escape-vectors.md) — verified permission-rule syntax, 8 Bash bypass classes, 9 persistence vectors, and the deny → hook → sandbox tiering (⚠ one claim contradicted by the bypass-mode report)
- [Research: Deny rules vs. PreToolUse hooks](knowledge/sources/deny-rules-vs-hooks.md) — per-subcommand decomposition is real (bare-interpreter denies ship, pipe patterns never fire), and `permissions.ask` replaces a planned package-consent hook
- [Research: Which Claude Code controls survive --dangerously-skip-permissions](knowledge/sources/bypass-mode-enforcement.md) — deny/ask/hooks/sandbox all enforce under bypass; what bypass destroys is the built-in protected-path guard (supersedes the sandbox-escape report on that point)
- [Research: git exclude vs Claude Code @ autocomplete](knowledge/sources/git-exclude-at-autocomplete.md) — info/exclude blinds the @ picker (and rg); no git-side layout fixes it; the documented `fileSuggestion` custom command is the escape hatch (supersedes the info/exclude report's "Claude tools unaffected" claim)
- [Obsidian and Typed Wiki Linking](knowledge/sources/obsidian-wiki-linking.md) — this repo's `rel::[[target]]` convention is Dataview's full-line inline-field syntax, not a bespoke invention, currently used with zero plugins installed
- [Automating Obsidian and Plugin Setup in the Bootstrap Scripts](knowledge/sources/obsidian-setup-automation.md) — app + plugin install are both fully scriptable and fit the existing guarded/opt-in install pattern; /wiki-lint's graph view improves for free, /task-audit does not
- [Research: Serena MCP — Project Scope vs. Local Scope](knowledge/sources/serena-mcp-scope.md) — confirms the existing local-scope choice against Claude Code's official scope docs; no code change indicated
- [Obsidian Graph View Styling, Productivity Patterns, and Shippable Wiki Defaults](knowledge/sources/obsidian-graph-defaults.md) — graph.json colorGroups is native/zero-plugin; this repo's known wiki taxonomy makes a hand-authored color template more precise than auto-detecting plugins like Graph Styler

### Concepts
- [LLM Wiki Hot Cache](knowledge/concepts/llm-wiki-hot-cache.md) — session-handoff summary file pattern, converged on by multiple gist reimplementations
- [Wiki Provenance Tagging](knowledge/concepts/wiki-provenance-tagging.md) — extracted/inferred/ambiguous claim tagging, activates this repo's reserved frontmatter
- [Wiki Multi-Writer Safety](knowledge/concepts/wiki-multi-writer-safety.md) — advisory locking for concurrent agent writes to shared wiki index files (⚠ contradiction flagged — its cited exemplar hook has a live-reproduced race bug)
- [Agent Memory Frameworks Landscape](knowledge/concepts/agent-memory-frameworks-landscape.md) — Mem0/Zep/Letta/Hindsight/A-Mem survey vs. this repo's markdown-only wiki
- [Responded Error Proves Liveness](knowledge/concepts/responded-error-proves-liveness.md) — health-check anti-pattern: an error response proves a process is alive, not hung; kill-on-misclassification defaults are backwards
- [Git-Ignore Tool Visibility](knowledge/concepts/git-ignore-tool-visibility.md) — .gitignore = ignored by git AND agents; .git/info/exclude = visible to Serena only (rg and the @ picker still skip it); picker visibility needs `fileSuggestion`
- [Deny Matches a Spelling, Not a Capability](knowledge/concepts/deny-matches-a-spelling-not-a-capability.md) — the organizing principle of agent hardening: `Bash(rm *)` misses `/bin/rm`, no pattern sees inside `bash -c`
- [Three-Tier Agent Control Model](knowledge/concepts/three-tier-agent-control-model.md) — deny rules (spelling) → PreToolUse hook (capability class) → OS sandbox (subprocess); not substitutes
- [Agent Persistence & Sandbox-Escape Vectors](knowledge/concepts/agent-persistence-vectors.md) — C1–C9 catalogue of persistence primitives reachable through the Bash tool, with the control that addresses each
- [Per-Subcommand Decomposition](knowledge/concepts/per-subcommand-decomposition.md) — rules match each subcommand independently, so pipe-containing patterns can never fire and bare `Bash(sh)` can; no startup warning either way
- [Consent Requires a Yes-Path (the `ask` Tier)](knowledge/concepts/consent-requires-a-yes-path.md) — deny has no yes-path; `permissions.ask` cannot be silenced by allow, bypass mode, a hook, or the sandbox (⚠ open contradiction: ask vs. hook for headless package consent)
- [Control Survival Across Permission Modes](knowledge/concepts/permission-mode-control-survival.md) — what still enforces under `bypassPermissions`: deny/ask/hooks/sandbox yes, `allow` inert, built-in protected paths gone (⚠ carries the flagged contradiction with the sandbox-escape report)
- [Typed Wiki Links](knowledge/concepts/typed-wiki-links.md) — `rel::[[target]]` is Dataview's full-line inline-field syntax; zero plugin dependency today; Dataview/Graph Link Types/Breadcrumbs are optional enhancement layers requiring no authoring changes
- [MCP Server Scope Model (local / project / user)](knowledge/concepts/mcp-server-scope-model.md) — local > project > user precedence; project scope fits only config identical across teammates, machine-specific values (a path, a credential) belong at local scope
- [Obsidian Graph View Styling (native colorGroups vs. plugins)](knowledge/concepts/obsidian-graph-view-styling.md) — .obsidian/graph.json colorGroups needs zero plugins; path:/tag:/file: query syntax; hand-authored template vs. auto-detecting plugin tradeoff

### Entities
- People — [knowledge/entities/people/](knowledge/entities/people/): [Andrej Karpathy](knowledge/entities/people/andrej-karpathy.md)
- Organisations — [knowledge/entities/organisations/](knowledge/entities/organisations/) — _(none yet)_
- Tools — [knowledge/entities/tools/](knowledge/entities/tools/): [Serena](knowledge/entities/tools/serena.md), [Claude Code Auto Memory](knowledge/entities/tools/claude-code-auto-memory.md), [claude-obsidian](knowledge/entities/tools/claude-obsidian.md), [qmd](knowledge/entities/tools/qmd.md), [Hindsight](knowledge/entities/tools/hindsight.md), [Claude Code Permission System](knowledge/entities/tools/claude-code-permission-system.md), [Claude Code OS Sandbox](knowledge/entities/tools/claude-code-sandbox.md), [Claude Code @ File Picker (fileSuggestion)](knowledge/entities/tools/claude-code-file-picker.md), [Obsidian](knowledge/entities/tools/obsidian.md), [Dataview](knowledge/entities/tools/dataview.md), [Graph Link Types](knowledge/entities/tools/graph-link-types.md), [Breadcrumbs (Obsidian plugin)](knowledge/entities/tools/breadcrumbs-plugin.md), [Wikilink Types (Obsidian plugin)](knowledge/entities/tools/wikilink-types-plugin.md), [Graph Styler](knowledge/entities/tools/graph-styler.md), [Auto Tag Graph Colors](knowledge/entities/tools/auto-tag-graph-colors.md)
- Components — [knowledge/entities/components/](knowledge/entities/components/): [Serena Health-Tracking Hook](knowledge/entities/components/serena-health-tracking-hook.md), [Canonical Settings Deny List](knowledge/entities/components/settings-deny-list.md), [lib/hooks — Project-Managed Hook Scripts](knowledge/entities/components/bootstrap-claude-hooks.md), [Guarded, Opt-In, Sticky-Preference Install Pattern](knowledge/entities/components/bootstrap-guarded-install-pattern.md)

---

## Work

Each family's `index.md` lists its **active items only** (completed/terminal items drop off the list; files never move — status lives in frontmatter).

- **Requirements** — REQ-NNN. [Active index](work/requirements/index.md) · [lifecycle](work/requirements/lifecycle.md)
- **Decisions** — DEC-NNNN (per-decision `#DM`). [Active index](work/decisions/index.md) · [lifecycle](work/decisions/lifecycle.md)
- **Roadmaps** — ROADMAP-NNN. [Active index](work/roadmaps/index.md) · [lifecycle](work/roadmaps/lifecycle.md)
- **Tasks** — TASK-NNN. [Active index](work/tasks/index.md) · [lifecycle](work/tasks/lifecycle.md)
- **UAT** — UAT-NNN, one per task. [Active index](work/uat/index.md) · [lifecycle](work/uat/lifecycle.md)
- **Bugs** — BUG-NNNN. [Active index](work/bugs/index.md) · [lifecycle](work/bugs/lifecycle.md)

---

## Guides

Template-owned reference guides delivered by the bootstrap tooling — read, never edit (refreshed by `bootstrap update`). See [guides/](guides/): tool rules in `mcp-tools.md`, shell hygiene in `command-anti-patterns.md`, plus any opted-in guides.
