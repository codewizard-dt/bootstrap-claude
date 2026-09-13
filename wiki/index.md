---
title: Wiki Index
updated: 2026-09-13
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
- [Research: AI Application Architecture — Single vs. Multi-Agent, Orchestration, and Observability](knowledge/sources/ai-agent-architecture-observability.md) — hierarchical orchestrator+isolated-subagents is the pattern that survives production, not peer/group-chat; Claude Code already ships built-in OTel export this repo doesn't use
- [Research: Naming Inconsistencies Across the wiki/work/ Family Skills](knowledge/sources/wiki-work-family-naming.md) — `bug-file` and `roadmap-create` write stale bare filenames contradicting their own lifecycle.md, sibling skills, and every file on disk; 3-vs-4-digit ID width split is real but undocumented
- [Research: Claude Code Ecosystem Survey — Harnesses, Skill Libraries, Hooks](knowledge/sources/claude-code-ecosystem-2026.md) — worktree isolation and native sandboxing are the highest-fit gaps against other harnesses; plugin marketplace flagged as a decision, not a task
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
- [Research: .mcp.json vs ~/.claude.json — implications, performance, and behavior](knowledge/sources/mcp-scope-performance-behavior.md) — no performance difference exists (transport, not scope, drives it); real differences are precedence, headless-vs-interactive approval prompts, and workspace trust; found a contradiction on prior "no path-portability mechanism" claim
- [Research: Why User-Scoped MCPs Spawn One Process Per Session](knowledge/sources/mcp-one-process-per-user.md) — stdio's 1-client:1-subprocess is an MCP protocol property, not a scope or Claude Code setting; N sessions × M stdio servers = N×M processes; only an HTTP-registered shared server avoids it
- [Research: Serena Transport Options and Preventing Multiple Concurrent Processes](knowledge/sources/serena-single-instance-transport.md) — Serena ships streamable-http alongside stdio; maintainer-endorsed fix for duplicate same-project instances (GitHub #1235, closed same-day); limited to one active project per HTTP instance; not adopted here
- [Why TASK-NNN-Style Links Don't Resolve, and How to Fix It](knowledge/sources/obsidian-alias-link-resolution.md) — Obsidian's click-resolver matches filenames only, never frontmatter (confirmed intentional, not even native aliases:); Alias Linker plugin + an aliases: backfill fixes every existing link with zero text changes
- [Docker-Based Fresh-Machine Test Harness for CLI Installer Scripts](knowledge/sources/docker-fresh-machine-test-harness.md) — Docker over a VM confirmed; `bin/cli.js` silently ignores the scratch path for `setup`/`update`; non-interactive mode is a hard "no" for every prompt; idempotency = run twice and diff; CI needs no Docker-in-Docker (retired)
- [Gating package-install-consent.js via a Preference Instead of Always Blocking](knowledge/sources/package-install-consent-gating.md) — a project-scoped bootstrap-prefs key (`true|false|ask`, default `false`) would fix the "hard to scaffold/update deps" pain without weakening consent-by-default; the real blocker is `askedBy`/`consumer` having no path for a hook-consumed key yet
- [Research: Authenticating a throwaway Docker claude session without copying host ~/.claude/](knowledge/sources/docker-claude-auth-token.md) — `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` reuses the host's subscription in a container with a single env var, no `~/.claude/` copying and no switch to standalone API-key billing
- [Research: Testing brand-new installs and previous-version-to-new-version upgrades with the fresh-machine harness](knowledge/sources/docker-harness-version-upgrade-testing.md) — `run.sh stale` seeds nothing and its fixed OLD_REF already contains the one migration this repo ships, so it can't test upgrading a pre-migration wiki; manual recipe + a recommended seed-fixtures extension
- [Research: A non-Claude-Code editor for bootstrap-prefs.json](knowledge/sources/bootstrap-prefs-editor-tui.md) — recommends a zero-dependency readline TUI over making the read-only dashboard writable; found the dashboard server already binds all interfaces, not just loopback
- [Research: Prior art for editing local tool config outside an LLM — Serena's dashboard and comparable tools](knowledge/sources/settings-editor-prior-art.md) — Serena's dashboard is a writable, unauthenticated Flask app; MCP Inspector's identical shape produced a Critical RCE (CVE-2025-49596); reinforces the standalone-TUI recommendation over a writable dashboard

### Concepts
- [Multi-Agent Orchestration Patterns](knowledge/concepts/multi-agent-orchestration-patterns.md) — orchestrator+isolated-subagents survives production, peer/group-chat doesn't; 15x token cost of multi-agent vs. chat; compounding-error math (0.85^10)
- [GenAI Observability Standard](knowledge/concepts/genai-observability-standard.md) — OTel GenAI semantic conventions (still Development status) as the vendor-neutral layer; proxy vs. SDK/OTel tracer backend split
- [wiki/work/ Filename Convention: PREFIX-NNN(N)-slug.md, and Where Two Skills Drifted From It](knowledge/concepts/wiki-work-filename-convention.md) — `bug-file`/`roadmap-create` write bare filenames pre-dating the wiki2 migration; fix is text-only, no data migration needed
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
- [claude mcp add Can Hardcode Secrets Into a Placeholder-Based .mcp.json](knowledge/concepts/mcp-add-secret-hardcoding-bug.md) — confirmed, unfixed (closed "not planned") CLI bug: re-running `claude mcp add` resolves and writes literal secrets over `${VAR}` placeholders
- [Stdio MCP Servers Spawn One Process Per Client Session](knowledge/concepts/mcp-stdio-one-process-per-session.md) — protocol-level 1-client:1-subprocess; no scope or setting collapses concurrent-session process count; only HTTP registration against a shared long-lived server does
- [fileSuggestion's @ Autocomplete Gap in Git Worktrees (Symlinked wiki/raw)](knowledge/concepts/file-suggestion-worktree-symlink-gap.md) — `file-suggestion.sh`'s naive `.git/info/exclude` check breaks under worktree `gitdir:` indirection, and its re-inclusion `rg` calls lack `--follow`, so symlinked `wiki/`/`raw/` never get suggested in a worktree
- [Localhost HTTP Server Security (bind address & CSRF)](knowledge/concepts/localhost-server-security.md) — binding to 127.0.0.1 is not optional and does not by itself stop CSRF from an open browser tab; corroborated by a Critical RCE in MCP Inspector and an identical bind-address bug in Prisma Studio
- [Terminal-Native Config/State TUIs as the Zero-Network-Exposure Pattern](knowledge/concepts/terminal-native-config-tui-pattern.md) — lazygit/lazydocker/nmtui/npm config edit solve "edit local config easily, no AI needed" with no server to attack

### Entities
- People — [knowledge/entities/people/](knowledge/entities/people/): [Andrej Karpathy](knowledge/entities/people/andrej-karpathy.md)
- Organisations — [knowledge/entities/organisations/](knowledge/entities/organisations/) — _(none yet)_
- Tools — [knowledge/entities/tools/](knowledge/entities/tools/): [Serena](knowledge/entities/tools/serena.md), [Claude Code Auto Memory](knowledge/entities/tools/claude-code-auto-memory.md), [claude-obsidian](knowledge/entities/tools/claude-obsidian.md), [qmd](knowledge/entities/tools/qmd.md), [Hindsight](knowledge/entities/tools/hindsight.md), [Claude Code Permission System](knowledge/entities/tools/claude-code-permission-system.md), [Claude Code OS Sandbox](knowledge/entities/tools/claude-code-sandbox.md), [Claude Code Authentication & Credential Storage](knowledge/entities/tools/claude-code-authentication.md), [Claude Code @ File Picker (fileSuggestion)](knowledge/entities/tools/claude-code-file-picker.md), [Claude Code Plugin Marketplace](knowledge/entities/tools/claude-code-plugin-marketplace.md), [Claude Code Worktree Isolation](knowledge/entities/tools/claude-code-worktree-isolation.md), [Claude Code OpenTelemetry Export](knowledge/entities/tools/claude-code-opentelemetry.md), [Obsidian](knowledge/entities/tools/obsidian.md), [Dataview](knowledge/entities/tools/dataview.md), [Graph Link Types](knowledge/entities/tools/graph-link-types.md), [Breadcrumbs (Obsidian plugin)](knowledge/entities/tools/breadcrumbs-plugin.md), [Wikilink Types (Obsidian plugin)](knowledge/entities/tools/wikilink-types-plugin.md), [Graph Styler](knowledge/entities/tools/graph-styler.md), [Auto Tag Graph Colors](knowledge/entities/tools/auto-tag-graph-colors.md), [Front Matter Title](knowledge/entities/tools/front-matter-title.md), [Alias Linker](knowledge/entities/tools/alias-linker.md), [MCP Inspector](knowledge/entities/tools/mcp-inspector.md)
- Components — [knowledge/entities/components/](knowledge/entities/components/): [Serena Health-Tracking Hook](knowledge/entities/components/serena-health-tracking-hook.md), [Canonical Settings Deny List](knowledge/entities/components/settings-deny-list.md), [lib/hooks — Project-Managed Hook Scripts](knowledge/entities/components/bootstrap-claude-hooks.md), [Guarded, Opt-In, Sticky-Preference Install Pattern](knowledge/entities/components/bootstrap-guarded-install-pattern.md), [Bootstrap Preferences Store (bootstrap-prefs.js)](knowledge/entities/components/bootstrap-prefs-store.md), [Power Mode Skill](knowledge/entities/components/power-mode-skill.md), [Now Skill](knowledge/entities/components/now-skill.md)

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
