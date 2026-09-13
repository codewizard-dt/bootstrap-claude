---
id: terminal-native-config-tui-pattern
title: "Terminal-Native Config/State TUIs as the Zero-Network-Exposure Pattern"
updated: 2026-09-13
sources:
  - ../../../raw/research/settings-editor-prior-art/index.md
confidence: extracted
tags: [tui, cli, security]
---

Real, popular prior art for "let a user edit local structured config or state easily, without needing the primary tool's own conversational/CLI loop" that solves the problem with **zero network exposure**, in contrast to a local web-server dashboard (see relates_to::[[localhost-server-security]] for why that alternative carries real, demonstrated risk):

- **`lazygit`** and **`lazydocker`** (same author, both built on the Go `gocui` terminal-UI library) — full-screen, keyboard-driven terminal interfaces wrapping `git` and `docker`/`docker-compose` respectively. Neither opens a port; they invoke the underlying CLI directly and render a terminal view. Widely adopted, frequently cited as the reference example of "a TUI done well" for a CLI tool that would otherwise require memorizing subcommands.
- **`nmtui`** (NetworkManager's official TUI) — a curses-based menu application for editing/activating network connections and setting the hostname, talking to NetworkManager over local D-Bus rather than any network transport. `raspi-config`'s text-mode settings menu is the same family.
- **`npm config edit`** — the simplest member of the pattern: no custom UI at all, just shells out to `$EDITOR`/`$VISUAL` (falling back to `vi` or Notepad) to open the raw config file. Trades away schema-driven guidance (validation, per-key explanations, scope enforcement) for zero implementation cost.

**Why this matters for uses::[[bootstrap-prefs-store]]**: derived_from::[[settings-editor-prior-art]] surfaced this pattern while evaluating whether to extend `lib/scripts/wiki-dashboard-server.js` into a writable settings page instead of building a standalone CLI. These tools are direct precedent for the standalone-TUI recommendation already made in [[bootstrap-prefs-editor-tui]] — the same "menu/keyboard-driven, wraps an existing engine, no daemon" shape, just realized in Go with a real TUI library rather than Node's bare `readline`. None of them carry the CSRF/auth risk class documented on [[localhost-server-security]], because there is no server to attack.
