---
id: bootstrap-prefs-store
title: "Bootstrap Preferences Store (bootstrap-prefs.js)"
aliases: ["bootstrap-prefs.json", "bootstrap-prefs-tui"]
updated: 2026-09-13
sources:
  - ../../../raw/research/bootstrap-prefs-editor-tui/index.md
  - ../../../raw/research/settings-editor-prior-art/index.md
confidence: extracted
tags: [bootstrap-prefs, cli, tui]
---

The flat global/project preference store behind installer prompts and skill behavior — `lib/scripts/bootstrap-prefs.js` (a dependency-free Node script) reads and writes two plain JSON layers, global `~/.claude/bootstrap-prefs.json` and project `<repo>/.claude/bootstrap-prefs.json`, validated against `lib/scripts/templates/bootstrap-prefs-schema.json`. The schema is ~20 concrete keys plus two `dynamic: true` families (`guides.*`, `gitignore.section.*`), each entry carrying `scope` (`global`/`project`/`either`), `consumer` (`installer`/`skill`), `summary`, a long `detail`, a pipe-delimited `values` grammar, an optional `default`, and `askedBy`.

The engine already does the hard parts any editor needs: schema-driven value validation, a `scopePermitsLayer` guard that refuses writing a key into a layer its `scope` forbids (fixed under BUG-0009 — a global-scope key silently landing in a project file used to write successfully but do nothing), atomic writes via temp-file-then-rename, indentation preservation, and regeneration of a human-readable companion doc (`bootstrap-prefs.README.md`) on every write.

**Today's only front end is `/bootstrap-config`** ([lib/skills/bootstrap-config/SKILL.md](../../../../lib/skills/bootstrap-config/SKILL.md)), a Claude Code slash command implementing a 7-step algorithm (locate helper+schema → run `--list` → print a grouped summary → mode menu → key menu → value+layer menu parsed straight from the schema's `values` string → confirm → write → re-verify). That algorithm is fully deterministic — a schema read plus menu choices — which is why derived_from::[[bootstrap-prefs-editor-tui]] recommends porting it directly into a standalone, zero-dependency `readline`-based CLI (`bootstrap-prefs-tui.js`) rather than requiring a Claude session to change a preference. The recommended integration point is `bin/cli.js`'s flat `SCRIPTS` dispatch map (same pattern as its existing `dashboard` entry), as a new `config` subcommand.

**Recommendation reinforced by prior-art research** (derived_from::[[settings-editor-prior-art]], 2026-09-13): comparable tools that piggyback a writable web dashboard onto config/state editing (Serena's own dashboard, MCP Inspector, Prisma Studio) show a consistent pattern of security issues up to and including a Critical RCE (CVE-2025-49596 in MCP Inspector) — see relates_to::[[localhost-server-security]]. Tools that instead stay terminal-native (`lazygit`, `nmtui`) achieve easy config/state editing with zero network exposure — see relates_to::[[terminal-native-config-tui-pattern]]. This is direct precedent for building `bootstrap-prefs-tui.js` as specified rather than extending `wiki-dashboard-server.js` to accept writes.
