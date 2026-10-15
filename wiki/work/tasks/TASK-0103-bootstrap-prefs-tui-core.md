---
id: TASK-0103
aliases: [TASK-0103]
title: "Build bootstrap-prefs-tui.js: readline menu porting /bootstrap-config Step A-G"
status: pending-uat
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: [TASK-0104]
parallel_safe_with: []
uat: "[[UAT-0103]]"
tags: [cli, tui, bootstrap-prefs]
---

# TASK-0103 — Build bootstrap-prefs-tui.js: readline menu porting /bootstrap-config Step A-G

relates_to::[[bootstrap-prefs-editor-tui]]
relates_to::[[settings-editor-prior-art]]
blocks::[[TASK-0104]]

> **Blocks**: TASK-0104
> **Roadmap**: [ROADMAP-011](../roadmaps/ROADMAP-011-build-bootstrap-prefs-tui.md) Phase 1

## Objective

Create `lib/scripts/bootstrap-prefs-tui.js`, a zero-dependency Node `readline` menu that lets a user view, edit, and reset any `bootstrap-prefs.json` key from a plain terminal with no Claude Code session. It ports `/bootstrap-config`'s Step A–G algorithm (`lib/skills/bootstrap-config/SKILL.md`) and delegates every get/set/unset/list to the existing `lib/scripts/bootstrap-prefs.js` engine, unchanged, by spawning it as a child process. The TUI reads `lib/scripts/templates/bootstrap-prefs-schema.json` directly for `detail`, `values`, `scope`, `consumer`, and `askedBy`. Scope is `bootstrap-prefs.json` only — never Claude Code's `settings.json`. CLI wiring into `bin/cli.js` is TASK-0104, not this task.

## Approach

- **Location and resolution.** The file sits beside the engine in `lib/scripts/`, so it works both from the repo checkout and from the npm package (`bin/cli.js` resolves scripts from `lib/scripts/`). Resolve the engine as `path.join(__dirname, 'bootstrap-prefs.js')` and the default schema as `path.join(__dirname, 'templates', 'bootstrap-prefs-schema.json')`. Accept `--schema <path>` and pass it through to the engine only when non-default. This replaces the skill's Step A two-location lookup, which exists only because a skill cannot know where the package lives.
- **Engine is the only writer.** Every read is `node bootstrap-prefs.js --list|--get|--section-key` and every write is `--set|--unset`, run with `child_process.spawnSync(process.execPath, [engine, ...args])`. Never `require()` the engine and never write `bootstrap-prefs.json` or `bootstrap-prefs.README.md` from the TUI. This inherits schema validation, the `scopePermitsLayer` refusal (BUG-0009), `true`/`false` coercion, and atomic writes for free. On a non-zero exit, print the engine's stderr verbatim and return to the menu. Never retry or work around it.
- **Schema read directly.** `JSON.parse` the schema for per-key metadata. The legal value list is always `entry.values.split('|').map(trim)`, never hardcoded. This keeps the two grammar quirks correct with no special-casing: `gitCommit.versionBump` is `auto | confirm | never` (no separate `ask`), and `gitignore.section.*` is `false` only.
- **Dynamic families.** `guides.*` and `gitignore.section.*` are `dynamic: true` patterns. When `--list` shows concrete keys under a pattern, list them individually. When none exist, show the pattern row with a one-line explanation of the family and offer "enter a key" via free-text input. For `gitignore.section.*`, offer "derive a slug from a section title" that calls `--section-key "<title>"` instead of slugifying by hand, and state the false-only grammar plainly. Schema lookup for a concrete key matches the pattern by prefix, mirroring the engine's `dynamicPrefixes` behaviour.
- **Layer handling.** Project dir = `--project <dir>` if given, else the current working directory when a `.git` ancestor or `.claude/` is found, else none. Always pass `--project <dir>` to `--list` when one is resolved (omitting it silently hides project answers). Layer choice follows the key's `scope`: `project` offers only the project layer, `global` offers only global, `either` asks and explains that project wins over global per key. If `scope: project` and no project dir resolved, abort that edit with an explanation and do not fall back to global. `--global` / `--project` flags pin the layer, and the engine's refusal for a forbidden pin is surfaced as-is.
- **Menu flow (Step A–G port).**
  - A/B: resolve engine, schema, and layers, run `--list`, and parse the rows. Neither values file existing is a normal state, not an error.
  - B2: print the grouped summary in the skill's order (Installer preferences, Skill preferences, Unrecognized keys when non-empty). Every row shows key, value, `[layer]`, and the schema `summary`. Render `unset`, settled values, `false` (labelled "remembered decline"), `ask`, and `[default]` distinguishably. This summary prints before the first prompt.
  - C: main menu is Edit a preference / Reset a preference / View again / Quit (No changes). Quit is always offered and writes nothing.
  - D: key picker is a numbered list with `consumer: skill` keys visibly separated from `consumer: installer` keys, each labelled `<key> — <summary> (current, layer)`, plus a free-text key entry and Back. Reset mode lists only keys stored in a writable layer, and says so for keys that are `[unset]` or `[default]`. After a pick, print the schema `detail` in full. For `consumer: skill` keys print the heavier "skill preference" banner naming the affected command from `askedBy`/`summary`.
  - E: numbered value picker from the `values` string, then layer per scope, then a confirmation showing the exact `node <engine> --set <key> --value <v> --global|--project <dir>` command (y/N). The engine's refusals of `unset`/`null` and of illegal values surface verbatim.
  - F: reset via `--unset`, using the `[layer]` annotation; if the key is stored in both layers, say so and ask which to clear (clearing project alone re-exposes the global answer). Confirm with the exact command.
  - G: after any successful write, re-run `--list` and print the changed rows with their layer. Mention that `bootstrap-prefs.README.md` was regenerated (generated output, never hand-edit). Print the closing warning that a preference file never holds a secret.
- **Input handling.** Use `readline.createInterface` with a small promisified `ask(question)` helper. Handle EOF and Ctrl-C (`close` event / SIGINT) by exiting 0 with "No changes." when nothing was written. Non-TTY stdin is supported so the menu is testable by piping scripted answers. Reject and re-prompt on out-of-range numbers or empty input.
- **Testability.** Export the pure helpers (`parseListOutput`, `parseValues`, `resolveEntry`, `permittedLayers`, `groupRows`) via `module.exports` and run `main()` only under `require.main === module`, so tests can import them without launching the menu.
- **Deliberately out of scope.** No external prompt library (the schema is flat and enum-valued; see the research note on `readline` vs `@clack/prompts`). No ANSI-heavy TUI. No write path other than the engine. No `bin/cli.js` change (TASK-0104). No flag-driven passthrough (TASK-0104). No docs (ROADMAP-011 Phase 3). No edit to `bootstrap-prefs.js` or the schema.

## Steps

### 1. Confirm the engine's `--list` output format  <!-- agent: Explore -->

- [x] Read `lib/scripts/bootstrap-prefs.js` (`--list` rendering, `formatValue`, group headers, the `[project]/[global]/[default]/[unset]/[target]` annotation, the closing "No --project given" line, and the "Unrecognized keys" group) via Serena `get_symbols_overview` / `find_symbol`, plus `test/bootstrap-prefs.test.js` for the actual line shapes.
  - Record the exact row grammar the TUI parser must accept, including how dynamic-family pattern rows and concrete keys are printed.
  - Do not modify the engine. If the output is not machine-parseable enough, do not add a `--json` mode. Parse the existing text, and note any gap for the report.

### 2. Implement the module skeleton and engine wrappers  <!-- agent: general-purpose -->

- [x] Create `lib/scripts/bootstrap-prefs-tui.js` (`#!/usr/bin/env node`, `'use strict'`, CommonJS, node built-ins only: `fs`, `path`, `os`, `readline`, `child_process`). Match the surrounding `lib/scripts/*.js` style (header comment stating purpose and the "engine is the only writer" rule).
  - `parseArgs(argv)`: `--global`, `--project <dir>`, `--schema <path>`, `-h/--help`. Unknown args give a usage error with exit 2.
  - `runEngine(args)`: `spawnSync(process.execPath, [ENGINE, ...args, ...schemaArgs], { encoding: 'utf8' })`, returning `{ status, stdout, stderr }`. It never throws on a non-zero exit.
  - `loadSchema(path)` and `resolveEntry(schema, key)`, with exact match first, then dynamic-prefix match (`guides.`, `gitignore.section.`).
  - `parseValues(entry)` splitting on `|` and trimming. `permittedLayers(entry, projectDir, pin)` implements the scope rules from Approach.
  - Export the pure helpers and guard `main()` with `require.main === module`.

### 3. Implement state read and grouped summary (Steps A, B, B2)  <!-- agent: general-purpose -->

- [x] `resolveProjectDir(cwd, projectFlag)`, `readState()` (`runEngine(['--list', ...projectArgs])`, then `parseListOutput`), and `printSummary(rows, schema)`.
  - Group by schema `consumer` (installer, then skill, then unrecognized). Print key, value, `[layer]`, and `summary` per row. Label `false` as a remembered decline and `[default]` rows explicitly.
  - Show concrete dynamic-family keys individually, and the pattern row with a family explanation when none exist. Pass the engine's "No --project given" closing line through when it appears.
  - Print the summary before any prompt.

### 4. Implement the interactive menu (Steps C, D)  <!-- agent: general-purpose -->

- [x] `ask(rl, prompt)` helper, `pickFromList(rl, title, options)` (numbered, validated, re-prompt on bad input, Back always present), and the main menu loop (Edit / Reset / View again / Quit).
  - Key picker with `skill` and `installer` groups visibly separated, current value and layer per option, free-text key entry, and reset-mode filtering to keys stored in a writable layer.
  - After a key is chosen, print `detail` in full, the heavier skill banner for `consumer: skill`, and the lighter installer framing otherwise.
  - Dynamic families: `gitignore.section.*` gets a "derive slug from title" action calling `runEngine(['--section-key', title])`. `guides.*` gets a free-text guide name (with an example from the schema `detail`).

### 5. Implement edit, reset, and re-verify (Steps E, F, G)  <!-- agent: general-purpose -->

- [x] `editKey(...)`: value picker from `parseValues`, layer picker from `permittedLayers` (abort with an explanation if `scope: project` and no project dir), exact-command confirmation (y/N), then `runEngine(['--set', key, '--value', v, ...layerArgs])`.
- [x] `resetKey(...)`: layer from the captured `[layer]` annotation (ask when stored in both), exact-command confirmation, then `runEngine(['--unset', key, ...layerArgs])`.
  - On a non-zero exit, print the engine stderr verbatim and return to the menu without retrying.
  - After any successful write, re-run `--list` and print the changed rows with their layers, the README-regeneration note, and the "never store a secret" warning.
  - Handle EOF and SIGINT cleanly (exit 0, "No changes." if nothing was written).

### 6. Add tests  <!-- agent: general-purpose -->

- [x] Create `test/bootstrap-prefs-tui.test.js` using `node:test` + `node:assert`, following the fixture style of `test/bootstrap-prefs.test.js` (temp `HOME`/project dirs and a scratch schema passed via `--schema`; never touch the real `~/.claude`).
  - Pure helpers: `parseValues` (`auto | confirm | never` gives 3 options, `false` gives 1, no `ask` for `gitCommit.versionBump`), `resolveEntry` for both dynamic families, `permittedLayers` for `project` / `global` / `either` / no project dir.
  - `parseListOutput` against real engine `--list` output for all layer annotations and the unrecognized-keys group.
  - End-to-end via `spawnSync` with piped stdin scripting the menu: edit a `scope: either` key to project layer and assert the file changed via the engine. Reset it. Quit with no changes and assert no file was written.
  - Scope enforcement: script an edit of a `scope: global` key while a project layer is pinned and assert the engine's refusal text reaches stdout/stderr and nothing is written (BUG-0009 style).
  - Both dynamic families: `gitignore.section.<slug>` accepts `false` only and a stored `guides.<name>` round-trips.
  - Assert the TUI never writes the values file itself (no `writeFileSync` of `bootstrap-prefs.json` in the module source).

### 7. Verify  <!-- agent: general-purpose -->

- [x] Run `node --test test/bootstrap-prefs-tui.test.js` and then the full `npm test`, and confirm nothing else regressed (notably `test/bootstrap-prefs.test.js`, `test/bootstrap-config-skill.test.js`, and `test/npm-pack-contents.test.js`).
  - Confirm `lib/scripts/bootstrap-prefs-tui.js` is included in the package (`lib/` is in `package.json` `files`).
  - Smoke-run `node lib/scripts/bootstrap-prefs-tui.js` against a temp `HOME`, choosing Quit, and confirm that it exits 0 with no files written.
  - Do not run `install-global.sh`.
