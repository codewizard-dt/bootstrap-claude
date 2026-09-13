---
id: bootstrap-prefs-editor-tui
title: "Research: A non-Claude-Code editor for bootstrap-prefs.json"
updated: 2026-09-13
sources:
  - ../../../raw/research/bootstrap-prefs-editor-tui/index.md
  - ../../../raw/research/bootstrap-prefs-editor-tui/sources.md
confidence: extracted
tags: [bootstrap-prefs, cli, tui, dashboard, security]
---

Research into how to let a user edit `bootstrap-prefs.json` — this repo's flat, schema-driven global/project preference store — without a running Claude Code session. The user floated two directions: a standalone interactive TUI, or piggybacking on the existing `dashboard` command. Scope was explicitly narrowed (by user choice, not inference) to `bootstrap-prefs.json` only, not Claude Code's own `~/.claude/settings.json` / `.claude/settings.local.json`.

**The recommendation is a standalone, zero-dependency Node CLI** (`bootstrap-prefs-tui.js`, wired into `bin/cli.js` as a new `config` subcommand) that ports `/bootstrap-config`'s existing Step A–G algorithm onto Node's built-in `readline` module, delegating every read/write to `lib/scripts/bootstrap-prefs.js` unchanged — inheriting its schema validation, `scopePermitsLayer` write guard, and atomic writes for free. Current 2025–2026 Node guidance supports `readline` as the correct zero-dependency choice for a minimal interactive CLI, reserving external prompt libraries (`@clack/prompts` ~2KB, `enquirer` ~100KB, `inquirer`/`prompts` at ~43M weekly downloads each) for cases needing masked input or richer widgets — none of which this flat, enum-valued schema needs.

**Making the read-only `dashboard` command (`wiki-dashboard-server.js`) writable instead was evaluated and not recommended.** That server is explicitly documented — in its own header comment and in `components/wiki-dashboard` (Serena memory) — as serving the wiki tree read-only, with zero authentication, relying entirely on "only you can reach your loopback interface." Turning it into a write path is a real design reversal, not a neutral extension: implements::[[localhost-server-security]] catalogues why a write-capable local HTTP server needs deliberate CSRF/Origin defenses that "bind to localhost" alone does not provide, and this research also surfaced that the dashboard **already binds to all interfaces** (`0.0.0.0`, not `127.0.0.1`) because `listen(port, callback)` passes no host — a pre-existing exposure, worse than believed, that should be fixed regardless of the settings-editor decision.

See uses::[[bootstrap-prefs-store]] for the component this research is about, and relates_to::[[bootstrap-guarded-install-pattern]] for the broader sticky-preference system `bootstrap-prefs.json` belongs to.
