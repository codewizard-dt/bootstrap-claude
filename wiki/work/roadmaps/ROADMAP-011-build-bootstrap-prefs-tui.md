---
id: ROADMAP-011
aliases: [ROADMAP-011]
title: Build bootstrap-prefs-tui.js
status: active
created: 2026-09-13
updated: 2026-09-13
owner: David Taylor
derived_from: []
linked_requirements: []
linked_decisions: []
tags: [cli, tui, bootstrap-prefs]
---

# Roadmap 011: Build bootstrap-prefs-tui.js

## Goal

A user can view and change any `bootstrap-prefs.json` key from a plain terminal — no Claude Code session required — via a new `bootstrap config` CLI subcommand: a zero-dependency readline TUI that ports `/bootstrap-config`'s existing Step A–G algorithm and delegates every read/write to the existing `bootstrap-prefs.js` engine unchanged.

## Phase 1: Core TUI Engine

- [ ] Build bootstrap-prefs-tui.js: a readline-driven menu porting /bootstrap-config's Step A–G flow, shelling out to bootstrap-prefs.js for every get/set/unset/list and reading the schema directly (including the guides.* and gitignore.section.* dynamic families)

## Phase 2: CLI Wiring

- [ ] Wire bootstrap-prefs-tui.js into bin/cli.js as a new `config` subcommand (mirrors the existing `dashboard` entry), supporting both a no-args interactive menu and flag-driven passthrough (e.g. `bootstrap config --get/--set <key> ...`) for scripting

## Phase 3: Verification & Docs

- [ ] UAT covering the interactive menu flow, scope enforcement (BUG-0009-style refusal), and both dynamic families
- [ ] Update README.md / relevant docs to mention `bootstrap config` as the non-Claude-Code path for editing preferences

## Notes

- Originated from two `/research` passes this session (not a REQ/DEC): [bootstrap-prefs-editor-tui](../../knowledge/sources/bootstrap-prefs-editor-tui.md) recommended this approach over making the read-only `dashboard` command writable; [settings-editor-prior-art](../../knowledge/sources/settings-editor-prior-art.md) reinforced it with real-world corroboration (Serena's dashboard, MCP Inspector's CVE-2025-49596, Prisma Studio's bind-address bug).
- Scope is explicitly limited to `bootstrap-prefs.json` — not Claude Code's own `~/.claude/settings.json` / `.claude/settings.local.json`, which the user separately confirmed is out of scope for this effort.
- All items are inline placeholders (no task files exist yet) — `/roadmap-next` will create them automatically.
