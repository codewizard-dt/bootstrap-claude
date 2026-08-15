---
id: TASK-061
aliases: [TASK-061]
title: "Ship a default .obsidian/graph.json template into install-obsidian.sh"
status: done
created: 2026-08-15
updated: 2026-08-15
depends_on: []
blocks: []
parallel_safe_with: [TASK-031, TASK-039, TASK-060]
uat: "[[UAT-061]]"
tags: [obsidian, tooling, graph-view]
---

# TASK-061 — Ship a default .obsidian/graph.json template into install-obsidian.sh

## Objective

Every new project's Obsidian graph view currently arrives unstyled and unscoped — a fresh vault shows the whole repo (`lib/`, `node_modules/`, `.git`-adjacent noise, etc.) with every node the same color. Ship a hand-authored `.obsidian/graph.json` template, wired into `lib/scripts/install-obsidian.sh`, that (a) scopes the default graph view to the wiki subtree via a top-level `"search": "path:wiki"` filter, and (b) colors nodes by wiki family using two complementary `colorGroups` color families — a cool hue with 3 shades for `wiki/knowledge/{sources,concepts,entities}`, a warm hue with 6 shades for `wiki/work/{tasks,bugs,decisions,roadmaps,requirements,uat}`. `raw/` gets no color group at all, since the `path:wiki` filter already excludes it from the graph — a color group for hidden nodes would never render. Write-if-absent: never clobber a user's own customized `graph.json`.

## Approach

This is a **native Obsidian feature, zero plugin dependency** — `.obsidian/graph.json`'s `colorGroups` array is plain JSON read directly by Obsidian's core graph view (confirmed in `raw/research/obsidian-graph-defaults/index.md` and `sources.md`). Because this repo's wiki taxonomy is identical across every project `sync-wiki-scaffold.sh` scaffolds, the template can be hand-authored once rather than auto-detected at install time (unlike community plugins such as Graph Styler, which solve the different problem of an *unknown* vault structure).

Follow the exact "guarded, write-if-absent, sticky-preference" pattern `install-obsidian.sh` already uses for its three plugin installs (`_install_obsidian_plugin`/`_enable_obsidian_plugin`, gated by `obsidian.plugins`): every risky step warns to stderr and returns rather than aborting, and the new `obsidian.graphDefaults` preference key is independent of `obsidian.plugins` — a user can accept one without the other.

**Color values** (`{"a": 1, "rgb": <decimal>}`, where `<decimal>` is the packed 24-bit integer for the hex color — compute each via `node -e "console.log(parseInt('RRGGBB', 16))"`, do not hand-compute):

| Path | Family | Hex |
|------|--------|-----|
| `path:wiki/knowledge/sources` | knowledge (cool blue, light→dark) | `#90B8E8` |
| `path:wiki/knowledge/concepts` | knowledge | `#5A8FD6` |
| `path:wiki/knowledge/entities` | knowledge | `#2F5FA8` |
| `path:wiki/work/tasks` | work (warm amber/orange) | `#F2B84B` |
| `path:wiki/work/bugs` | work | `#E2703A` |
| `path:wiki/work/decisions` | work | `#D4914B` |
| `path:wiki/work/roadmaps` | work | `#C9762E` |
| `path:wiki/work/requirements` | work | `#E8975C` |
| `path:wiki/work/uat` | work | `#B85C3E` |

## Steps

### 1. Author the graph.json template <!-- agent: general-purpose -->

- [x] Create `lib/scripts/templates/obsidian/graph.json` (new directory `lib/scripts/templates/obsidian/`). Structure:
  - `"search": "path:wiki"` — top-level filter scoping the default graph view to the wiki subtree.
  - `"colorGroups"`: array of exactly 9 entries, one per row in the Approach table above, each shaped `{"query": "<path>", "color": {"a": 1, "rgb": <computed-int>}}`. Compute every `rgb` value via `node -e "console.log(parseInt('RRGGBB', 16))"` for the corresponding hex (substitute the hex digits, no `#`) — do not hand-compute or guess the integers.
  - No entry for `raw/` anywhere in the file.
  - Remaining keys, copied from real-world `graph.json` examples so the file is well-formed and matches Obsidian's expected shape: `"collapse-filter": false, "showTags": true, "showAttachments": false, "hideUnresolved": false, "showOrphans": true, "collapse-color-groups": false, "collapse-display": false, "showArrow": false, "collapse-forces": false`. Force/layout keys (`centerStrength`, `repelStrength`, `linkStrength`, `linkDistance`, `scale`, `nodeSizeMultiplier`, `lineSizeMultiplier`, `textFadeMultiplier`, `close`) may be omitted entirely — Obsidian applies its own defaults for anything absent.
  - Validate the file is syntactically valid JSON (`node -e "JSON.parse(require('fs').readFileSync('lib/scripts/templates/obsidian/graph.json','utf8'))"`).

### 2. Wire the template into install-obsidian.sh <!-- agent: general-purpose -->

- [x] In `lib/scripts/install-obsidian.sh`, add a new function `_install_obsidian_graph_defaults <vault_dir>` placed after `_enable_obsidian_plugin` (around line 228) and before the "App install gate" comment block. Behavior:
  - `mkdir -p "$vault_dir/.obsidian"` first (warn + return on failure, matching every other function in this file).
  - If `"$vault_dir/.obsidian/graph.json"` already exists: `echo "  .obsidian/graph.json already present — leaving your customization in place, skipping."` and return 0 (write-if-absent; never overwrite).
  - Otherwise `cp "$SCRIPT_DIR/templates/obsidian/graph.json" "$vault_dir/.obsidian/graph.json"`, warning to stderr and returning (not aborting) on copy failure.
- [x] Add a new gate below the existing "Plugin install gate" block (after line 294, inside the same `if [ -z "$PROJECT_DIR" ]; ... else ... fi` structure or as a sibling block using the same `$PROJECT_DIR` empty-check), keyed `obsidian.graphDefaults` (project scope — same `$PROJECT_DIR` selector convention as `obsidian.plugins`, per the selector-consistency rule documented on `prompt_yn_sticky` in `lib.sh`):
  - Interactive: `prompt_yn_sticky obsidian.graphDefaults "$PROJECT_DIR" "Install default graph-view styling (.obsidian/graph.json — colors wiki/knowledge and wiki/work/* by family, scopes the graph to path:wiki)? [Y/n]: "` → on true, call `_install_obsidian_graph_defaults "$PROJECT_DIR"`.
  - Non-interactive: mirror the plugin gate exactly — only a stored `prefs_get obsidian.graphDefaults "$PROJECT_DIR"` of `false` skips; `true`/`ask`/`unset` all proceed with the install.
  - Empty `$PROJECT_DIR` → warn and skip outright, matching the plugin gate's existing message pattern.

### 3. Register the new preference key <!-- agent: general-purpose -->

- [x] Add an `obsidian.graphDefaults` entry to `lib/scripts/templates/bootstrap-prefs-schema.json`, adjacent to the existing `obsidian.plugins` entry, modeled on its structure: `"scope": "project"`, `"consumer": "installer"`, a `summary` ("Install default graph-view styling (.obsidian/graph.json)"), a `detail` explaining write-if-absent semantics, that it is independent of `obsidian.plugins` (accepting/declining one has no effect on the other), and that the file lives inside this project's own `.obsidian/` (hence project scope, matching `obsidian.plugins`'s reasoning), `"values": "true | false"`, `"default": null`, `"askedBy": "install-obsidian.sh"`.

### 4. Tests <!-- agent: general-purpose -->

- [x] In `test/install-obsidian.test.js`, add regression cases: (a) a fresh vault (no pre-existing `.obsidian/graph.json`) gets the file written with exactly 9 `colorGroups` entries and `"search": "path:wiki"`; (b) an existing `.obsidian/graph.json` is left byte-for-byte unchanged after running the installer (write-if-absent); (c) the `obsidian.graphDefaults` non-interactive gate only skips on a stored `false`, mirroring the existing `obsidian.plugins` test coverage.
- [x] Check `test/bootstrap-prefs.test.js` and `test/bootstrap-prefs-schema.json`-adjacent tests for any assertion that enumerates the full schema key set/count; update it to include `obsidian.graphDefaults` if so, so the suite stays green.
- [x] Run the full suite (`npm test` or the project's actual test command — check `package.json`) and confirm it passes before marking this task's implementation complete. (347/347 passing; also required fixing 2 pre-existing tests and updating `lib/scripts/README.md`'s preference registry table via a doc-drift check discovered during this step.)

### 5. Docs <!-- agent: general-purpose -->

- [x] If `lib/scripts/README.md` documents `install-obsidian.sh` in a table row, extend that row's description to mention the new graph-defaults behavior alongside the existing plugin-install description. (Verified: `install-obsidian.sh` has no dedicated scripts-catalog table row in this README — it appears only in the preference registry table, which Step 4's doc-drift test already forced to include the new `obsidian.graphDefaults` row. No further edit needed.)

<!-- Updated: 2026-08-15 -->
