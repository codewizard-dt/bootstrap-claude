---
title: UAT Archive
---

# UAT Archive

Terminal UAT files (`passed`, `skipped`, or `trashed`) moved here by `/wiki-archive` to reduce directory clutter. **Append-only** — archived items never move again.

| ID                                             | Title                                                                                                          | Final Status | Archived   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| [[UAT-078-docker-harness-live-hook-mode\|UAT-078]] | UAT: Docker harness live-hook mode (packageInstall.consent=true verification) | passed | 2026-08-27 |
| [[UAT-072-docker-harness-idempotency-check\|UAT-072]] | UAT: Docker harness idempotency check — run update twice, diff scratch state | passed | 2026-08-27 |
| [[UAT-066-file-suggestion-worktree-symlink\|UAT-066]] | Fix fileSuggestion @-autocomplete for git worktrees with symlinked wiki/raw | passed | 2026-08-21 |
| [[UAT-064-backfill-work-item-aliases\|UAT-064]] | Backfill aliases: [<ID>] onto every existing work-item file's frontmatter | passed | 2026-08-15 |
| [[UAT-006-hot-cache-template\|UAT-006]]        | Add wiki/hot.md template to lib/scripts/templates/wiki/                                                        | passed       | 2026-07-06 |
| [[UAT-009-activate-confidence-field\|UAT-009]] | Activate confidence: extracted\|inferred\|ambiguous in wiki/conventions.md                                     | skipped      | 2026-07-06 |
| [[UAT-004]]                                    | Add Auto Memory vs. wiki division-of-responsibility note to CLAUDE.md                                          | passed       | 2026-07-06 |
| [[UAT-002]]                                    | Audit lifecycle.md files and skill templates for stale completed/ references                                   | skipped      | 2026-07-06 |
| [[UAT-001]]                                    | Audit lib/skills for stale README.md-style family-index references                                             | skipped      | 2026-07-06 |
| [[UAT-007]]                                    | Update /wiki-ingest (and other wiki-writing skills) to refresh wiki/hot.md                                     | passed       | 2026-07-06 |
| [[UAT-011]]                                    | Update /wiki-lint to flag knowledge pages with weak or unset confidence provenance                             | skipped      | 2026-07-06 |
| [[UAT-003]]                                    | Fix roadmap-create and other skills drifting from the index.md/lifecycle.md convention                         | skipped      | 2026-07-06 |
| [[UAT-005]]                                    | Add Optional tooling pointer (qmd, Hindsight) to CLAUDE.md                                                     | passed       | 2026-07-06 |
| [[UAT-010]]                                    | Update /wiki-ingest to populate the confidence field on new/updated knowledge pages                            | skipped      | 2026-07-06 |
| [[UAT-008]]                                    | Update /primer to read wiki/hot.md first, before Serena memories                                               | skipped      | 2026-07-06 |
| [[UAT-012]]                                    | Build wiki-dashboard-server.js zero-dependency static file server                                              | passed       | 2026-07-06 |
| [[UAT-013]]                                    | Build dashboard.html self-contained live dashboard client                                                      | skipped      | 2026-07-06 |
| [[UAT-014]]                                    | Wire dashboard command into bin/cli.js                                                                         | passed       | 2026-07-06 |
| [[UAT-015]]                                    | Sync dashboard.html into projects as an always-refresh scaffold file                                           | passed       | 2026-07-06 |
| [[UAT-016]]                                    | Document the dashboard command in README.md, lib/scripts/README.md, and CLAUDE.md                              | passed       | 2026-07-06 |
| [[UAT-017]]                                    | Manually verify dashboard liveness and edge cases                                                              | passed       | 2026-07-06 |
| [[UAT-020]]                                    | UAT: Convert brave-search MCP setup to a single global Docker container                                        | skipped      | 2026-07-28 |
| [[UAT-021]]                                    | UAT: Shared plumbing for single-process HTTP MCP servers (constants, helpers, upgrade detection)               | passed       | 2026-07-28 |
| [[UAT-022]]                                    | UAT: brave-search → single HTTP-mode Docker container (supersedes TASK-020 exec-wrapper)                       | passed       | 2026-07-28 |
| [[UAT-023]]                                    | UAT: playwright → native launchd LaunchAgent HTTP server (darwin), stdio fallback elsewhere                    | passed       | 2026-07-28 |
| [[UAT-024]]                                    | UAT: Docs & guide alignment for single-process HTTP MCP servers                                                | passed       | 2026-07-28 |
| [[UAT-026]]                                    | UAT: Audit and harden the canonical settings deny list                                                         | passed       | 2026-07-29 |
| [[UAT-025]]                                    | UAT: Migrate this machine's MCP registrations to the single-process design                                     | skipped      | 2026-07-29 |
| [[UAT-027]]                                    | UAT: Tier-2 PreToolUse hooks — gate command classes deny rules cannot express                                  | passed       | 2026-07-29 |
| [[UAT-028]]                                    | UAT: Rework interpreter-indirection-guard from blanket deny to recursive re-evaluation                         | passed       | 2026-07-30 |
| [[UAT-029]]                                    | UAT: Ship fileSuggestion @-autocomplete restoration                                                            | passed       | 2026-07-30 |
| [[UAT-036]]                                    | UAT: Reorder and guard run_project_sync in lib.sh so MCP failures can't abort hook install or wiki sync        | passed       | 2026-07-31 |
| [[UAT-032]]                                    | UAT: Extract canonical hooks wiring into settings-hooks.json                                                   | passed       | 2026-07-31 |
| [[UAT-033]]                                    | UAT: Build lib/scripts/merge-settings-hooks.js — "template owns its blocks" hooks-wiring merge                 | passed       | 2026-07-31 |
| [[UAT-034]]                                    | UAT: Add test/settings-hooks.test.js — template invariants and merge behavior coverage                         | passed       | 2026-07-31 |
| [[UAT-035]]                                    | UAT: Reorder install-global.sh — local steps first, MCPs last and guarded, invoke hooks-wiring merge           | passed       | 2026-07-31 |
| [[UAT-037]]                                    | UAT: Document automated hooks wiring — lib/hooks/README.md is no longer a manual-paste instruction sheet       | passed       | 2026-07-31 |
| [[UAT-038]]                                    | UAT: Fake-HOME end-to-end verification of resilient hook install + hooks wiring, and the minor release         | passed       | 2026-07-31 |
| [[UAT-040]]                                    | UAT: Canonical preference key registry — bootstrap-prefs-schema.json                                           | passed       | 2026-08-06 |
| [[UAT-041]]                                    | UAT: bootstrap-prefs.js — four-state preference helper                                                         | passed       | 2026-08-06 |
| [[UAT-042]]                                    | UAT: test/bootstrap-prefs.test.js — four-state and schema-bijection coverage                                   | passed       | 2026-08-06 |
| [[UAT-043]]                                    | UAT: Sticky prompt helpers in lib.sh — prompt_yn_sticky, prompt_choice_sticky, BOOTSTRAP_ASSUME_TTY            | passed       | 2026-08-06 |
| [[UAT-044]]                                    | UAT: Wire the install-mcps.sh prompt sites to the preference store                                             | passed       | 2026-08-06 |
| [[UAT-045]]                                    | UAT: Wire the sync-wiki-scaffold.sh, install-global.sh, and update-project.sh prompt sites                     | passed       | 2026-08-06 |
| [[UAT-046]]                                    | UAT: merge-gitignore.sh — prefs.gitTracking three-way prompt and declines-only wiring                          | passed       | 2026-08-06 |
| [[UAT-047]]                                    | UAT: test/prompt-stickiness.test.js — sticky-prompt coverage and the bijection un-skip                         | passed       | 2026-08-06 |
| [[UAT-030]]                                    | UAT: User preferences: stop skills doing consequential things without consent                                  | passed       | 2026-08-07 |
| [[UAT-048]]                                    | UAT: /bootstrap-config skill — view, edit, and reset stored preferences                                        | passed       | 2026-08-07 |
| [[UAT-049]]                                    | UAT: Register /bootstrap-config in lib/skills/README.md and the CLAUDE.md Custom Commands table                | passed       | 2026-08-07 |
| [[UAT-050]]                                    | UAT: Document the helper, the four-state model, and the full key registry in lib/scripts/README.md             | passed       | 2026-08-07 |
| [[UAT-051]]                                    | UAT: Pin bootstrap-prefs.js and bootstrap-prefs-schema.json into test/npm-pack-contents.test.js                | passed       | 2026-08-07 |
| [[UAT-052]]                                    | UAT: End-to-end verification of the preference store against a scratch project                                 | passed       | 2026-08-07 |
| [[UAT-055]]                                    | UAT: Wire install-obsidian.sh into run_project_sync()                                                          | passed       | 2026-08-13 |
| [[UAT-058]]                                    | UAT: Manually verify guarded Obsidian install end-to-end on at least one platform                              | passed       | 2026-08-13 |
| [[UAT-054]]                                    | UAT: Add obsidian.installApp + obsidian.plugins keys to bootstrap-prefs-schema.json                            | passed       | 2026-08-14 |
| [[UAT-056]]                                    | UAT: Add optional wiki/guides/ Dataview example-queries page                                                   | passed       | 2026-08-14 |
| [[UAT-057]]                                    | UAT: Reconcile /task-audit's Depends-on/Blocks blockquote with rel::[[target]]                                 | passed       | 2026-08-14 |
| [[UAT-059]]                                    | UAT: Confirm setup/update stay non-fatal on Obsidian install failure and declining leaves everything untouched | passed       | 2026-08-14 |
| [[UAT-053]]                                    | UAT: Add lib/scripts/install-obsidian.sh (app + plugin auto-install)                                           | passed       | 2026-08-14 |
| [[UAT-061]]                                    | UAT: Ship a default .obsidian/graph.json template into install-obsidian.sh                                     | passed       | 2026-08-15 |
| [[UAT-065]]                                    | UAT: Add aliases: [<ID>] to work-item frontmatter templates                                                     | passed       | 2026-08-15 |
| [[UAT-063]]                                    | UAT: Bundle the Alias Linker plugin into install-obsidian.sh's plugin bundle                                    | passed       | 2026-08-15 |
| [[UAT-074-docker-harness-invocation-entrypoint\|UAT-074]] | UAT: Resolve the correct setup/update invocation entrypoint for the Docker harness's run.sh | skipped | 2026-08-22 |
| [[UAT-075-docker-harness-node-lts-pin\|UAT-075]] | UAT: Confirm current Node LTS to pin as the Docker harness's ARG NODE_VERSION | skipped | 2026-08-22 |
| [[UAT-076-docker-harness-accept-path-decision\|UAT-076]] | UAT: Decide whether the Docker harness needs an accept-path test lane | skipped | 2026-08-22 |
