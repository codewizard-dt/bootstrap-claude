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

- [ ] [[TASK-0103: Build bootstrap-prefs-tui.js: readline menu porting /bootstrap-config Step A-G]]

## Phase 2: CLI Wiring

- [x] [[TASK-0104: Wire bootstrap-prefs-tui.js into bin/cli.js as a `config` subcommand]]

## Phase 3: Verification & Docs

- [ ] [[TASK-0105: Verify the bootstrap-prefs TUI: automated tests for the menu flow, scope refusal, and the guides.* / gitignore.section.* families]]
- [x] [[TASK-0106: Document `bootstrap config` as the non-Claude-Code path for editing preferences]]

## Notes

- Originated from two `/research` passes this session (not a REQ/DEC): [bootstrap-prefs-editor-tui](../../knowledge/sources/bootstrap-prefs-editor-tui.md) recommended this approach over making the read-only `dashboard` command writable; [settings-editor-prior-art](../../knowledge/sources/settings-editor-prior-art.md) reinforced it with real-world corroboration (Serena's dashboard, MCP Inspector's CVE-2025-49596, Prisma Studio's bind-address bug).
- Scope is explicitly limited to `bootstrap-prefs.json` — not Claude Code's own `~/.claude/settings.json` / `.claude/settings.local.json`, which the user separately confirmed is out of scope for this effort.
- All items are inline placeholders (no task files exist yet) — `/roadmap-next` will create them automatically.
