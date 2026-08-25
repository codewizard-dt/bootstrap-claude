---
title: Tasks Archive
---

# Tasks Archive

Terminal task files (`done` or `trashed`) moved here by `/wiki-archive` to reduce directory clutter. **Append-only** — archived items never move again.

| ID | Title | Final Status | Archived |
|----|-------|--------------|----------|
| [[TASK-066]] | Fix fileSuggestion @-autocomplete for git worktrees with symlinked wiki/raw | done | 2026-08-21 |
| [[TASK-064]] | Backfill aliases: [<ID>] onto every existing work-item file's frontmatter | done | 2026-08-15 |
| [[TASK-006]] | Add wiki/hot.md template to lib/scripts/templates/wiki/ | done | 2026-07-06 |
| [[TASK-009]] | Activate confidence: extracted\|inferred\|ambiguous in wiki/conventions.md | done | 2026-07-06 |
| [[TASK-004]] | Add Auto Memory vs. wiki division-of-responsibility note to CLAUDE.md | done | 2026-07-06 |
| [[TASK-002]] | Audit lifecycle.md files and skill templates for stale completed/ references | done | 2026-07-06 |
| [[TASK-001]] | Audit lib/skills for stale README.md-style family-index references | done | 2026-07-06 |
| [[TASK-007]] | Update /wiki-ingest (and other wiki-writing skills) to refresh wiki/hot.md | done | 2026-07-06 |
| [[TASK-011]] | Update /wiki-lint to flag knowledge pages with weak or unset confidence provenance | done | 2026-07-06 |
| [[TASK-003]] | Fix roadmap-create and other skills drifting from the index.md/lifecycle.md convention | done | 2026-07-06 |
| [[TASK-005]] | Add Optional tooling pointer (qmd, Hindsight) to CLAUDE.md | done | 2026-07-06 |
| [[TASK-010]] | Update /wiki-ingest to populate the confidence field on new/updated knowledge pages | done | 2026-07-06 |
| [[TASK-008]] | Update /primer to read wiki/hot.md first, before Serena memories | done | 2026-07-06 |
| [[TASK-012]] | Build wiki-dashboard-server.js zero-dependency static file server | done | 2026-07-06 |
| [[TASK-013]] | Build dashboard.html self-contained live dashboard client | done | 2026-07-06 |
| [[TASK-014]] | Wire dashboard command into bin/cli.js | done | 2026-07-06 |
| [[TASK-015]] | Sync dashboard.html into projects as an always-refresh scaffold file | done | 2026-07-06 |
| [[TASK-016]] | Document the dashboard command in README.md, lib/scripts/README.md, and CLAUDE.md | done | 2026-07-06 |
| [[TASK-017]] | Manually verify dashboard liveness and edge cases | done | 2026-07-06 |
| [[TASK-020]] | Convert brave-search MCP setup to a single global Docker container | done | 2026-07-28 |
| [[TASK-021]] | Shared plumbing for single-process HTTP MCP servers (constants, helpers, upgrade detection) | done | 2026-07-28 |
| [[TASK-022]] | brave-search → single HTTP-mode Docker container (supersedes TASK-020 exec-wrapper) | done | 2026-07-28 |
| [[TASK-023]] | playwright → native launchd LaunchAgent HTTP server (darwin), stdio fallback elsewhere | done | 2026-07-28 |
| [[TASK-024]] | Docs & guide alignment for single-process HTTP MCP servers | done | 2026-07-28 |
| [[TASK-026]] | Audit and harden the canonical settings deny list | done | 2026-07-29 |
| [[TASK-025]] | Migrate this machine's MCP registrations to the single-process design (runtime UAT) | done | 2026-07-29 |
| [[TASK-027]] | Tier-2 PreToolUse hooks — gate command classes deny rules cannot express | done | 2026-07-29 |
| [[TASK-028]] | Rework interpreter-indirection-guard from blanket deny to recursive re-evaluation | done | 2026-07-30 |
| [[TASK-029]] | Ship fileSuggestion @-autocomplete restoration for info/exclude'd wiki dirs | done | 2026-07-30 |
| [[TASK-036]] | lib.sh MCP guard: reorder run_project_sync so MCP failures can't abort hook install or wiki sync | done | 2026-07-31 |
| [[TASK-032]] | Settings-hooks template | done | 2026-07-31 |
| [[TASK-033]] | Build lib/scripts/merge-settings-hooks.js — "template owns its blocks" hooks-wiring merge | done | 2026-07-31 |
| [[TASK-034]] | Add test/settings-hooks.test.js — template invariants and merge behavior coverage | done | 2026-07-31 |
| [[TASK-035]] | Reorder install-global.sh — local steps first, MCPs last and guarded, invoke hooks-wiring merge | done | 2026-07-31 |
| [[TASK-037]] | Document automated hooks wiring — lib/hooks/README.md is no longer a manual-paste instruction sheet | done | 2026-07-31 |
| [[TASK-038]] | Fake-HOME end-to-end verification of resilient hook install + hooks wiring, and the minor release | done | 2026-07-31 |
| [[TASK-040]] | Canonical preference key registry — bootstrap-prefs-schema.json | done | 2026-08-06 |
| [[TASK-041]] | bootstrap-prefs.js — four-state preference helper | done | 2026-08-06 |
| [[TASK-042]] | test/bootstrap-prefs.test.js — four-state and schema-bijection coverage | done | 2026-08-06 |
| [[TASK-018]] | Upgrade dashboard.html dark mode to a full explicit-override toggle | done | 2026-08-06 |
| [[TASK-019]] | Teach dashboard parseIndexMarkdown to parse archive/index.md table rows so Archived counts are correct | done | 2026-08-06 |
| [[TASK-043]] | Sticky prompt helpers in lib.sh — prompt_yn_sticky, prompt_choice_sticky, BOOTSTRAP_ASSUME_TTY | done | 2026-08-06 |
| [[TASK-044]] | Wire the install-mcps.sh prompt sites to the preference store | done | 2026-08-06 |
| [[TASK-045]] | Wire the sync-wiki-scaffold.sh, install-global.sh, and update-project.sh prompt sites | done | 2026-08-06 |
| [[TASK-046]] | merge-gitignore.sh — prefs.gitTracking three-way prompt and declines-only wiring | done | 2026-08-06 |
| [[TASK-047]] | test/prompt-stickiness.test.js — sticky-prompt coverage and the bijection un-skip | done | 2026-08-06 |
| [[TASK-030]] | User preferences: stop skills doing consequential things without consent | done | 2026-08-07 |
| [[TASK-048]] | /bootstrap-config skill — view, edit, and reset stored preferences | done | 2026-08-07 |
| [[TASK-049]] | Register /bootstrap-config in lib/skills/README.md and the CLAUDE.md Custom Commands table | done | 2026-08-07 |
| [[TASK-050]] | Document the helper, the four-state model, and the full key registry in lib/scripts/README.md | done | 2026-08-07 |
| [[TASK-051]] | Pin bootstrap-prefs.js and bootstrap-prefs-schema.json into test/npm-pack-contents.test.js | done | 2026-08-07 |
| [[TASK-052]] | End-to-end verification of the preference store against a scratch project | done | 2026-08-07 |
| [[TASK-055]] | Wire install-obsidian.sh into run_project_sync() | done | 2026-08-13 |
| [[TASK-058]] | Manually verify guarded Obsidian install end-to-end on at least one platform | done | 2026-08-13 |
| [[TASK-054]] | Add obsidian.installApp + obsidian.plugins keys to bootstrap-prefs-schema.json | done | 2026-08-14 |
| [[TASK-056]] | Add optional wiki/guides/ Dataview example-queries page | done | 2026-08-14 |
| [[TASK-057]] | Reconcile /task-audit's Depends-on/Blocks blockquote with rel::[[target]] | done | 2026-08-14 |
| [[TASK-059]] | Confirm setup/update stay non-fatal on Obsidian install failure and declining leaves everything untouched | done | 2026-08-14 |
| [[TASK-053]] | Add lib/scripts/install-obsidian.sh (app + plugin auto-install) | done | 2026-08-14 |
| [[TASK-061]] | Ship a default .obsidian/graph.json template into install-obsidian.sh | done | 2026-08-15 |
| [[TASK-065]] | Add aliases: [<ID>] to work-item frontmatter templates | done | 2026-08-15 |
| [[TASK-063]] | Bundle the Alias Linker plugin into install-obsidian.sh's plugin bundle | done | 2026-08-15 |
| [[TASK-068]] | Resolve the correct setup/update invocation entrypoint for the Docker harness's run.sh | done | 2026-08-22 |
| [[TASK-069]] | Confirm current Node LTS to pin as the Docker harness's ARG NODE_VERSION | done | 2026-08-22 |
| [[TASK-070]] | Decide whether the Docker harness needs an accept-path test lane | done | 2026-08-22 |
