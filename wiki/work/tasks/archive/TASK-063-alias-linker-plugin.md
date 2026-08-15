---
id: TASK-063
aliases: [TASK-063]
title: "Bundle the Alias Linker plugin into install-obsidian.sh's plugin bundle"
status: done
created: 2026-08-15
updated: 2026-08-15
depends_on: []
blocks: []
parallel_safe_with: [TASK-031, TASK-039, TASK-060]
uat: "[[UAT-063]]"
tags: [obsidian, wikilinks, tooling]
---

# TASK-063 — Bundle the Alias Linker plugin into install-obsidian.sh's plugin bundle

## Objective

Add the Alias Linker community plugin (`johannrichard/alias-linker`, plugin id `alias-linker`) as a 5th member of the existing `obsidian.plugins` bundle in `lib/scripts/install-obsidian.sh`, alongside Dataview, Graph Link Types, Breadcrumbs, and Front Matter Title. This is Phase 3 of `wiki/work/roadmaps/ROADMAP-008-fix-obsidian-wikilink-resolution.md` — the plugin half of the fix for why `[[TASK-NNN]]`-style wikilinks don't resolve in Obsidian (Alias Linker patches Obsidian's link-lookup step to fall back to a note's `aliases:` frontmatter when literal filename resolution fails, across graph view, backlinks, embeds, and preview). The `aliases:` frontmatter half of the fix is Phase 1/2 of the roadmap — separate sibling tasks (Phase 2's backfill is TASK-064), out of scope here.

## Approach

Follow the existing 4-plugin pattern in `lib/scripts/install-obsidian.sh` exactly — do not invent a new mechanism. That pattern is: a named `PLUGIN_*` bash constant holding the `owner/repo` slug (never fetched or derived at runtime), added to the single `for plugin_repo in ...` loop that calls the shared `_install_obsidian_plugin`/`_enable_obsidian_plugin` functions (GitHub Releases API fetch, manifest.json-derived plugin id, warn-and-continue on any failure — never aborts the script). All 5 plugins stay under the single `obsidian.plugins` sticky-preference prompt; this task does not add a new preference key.

Alias Linker has no dependency relationship with Dataview (unlike Graph Link Types/Breadcrumbs, which read fields Dataview indexes) — it patches Obsidian's own link resolver directly and works standalone. It carries more trust risk than the flagship-tier plugins already bundled: moderately maintained (12 releases over ~2 years) and self-described as "experimental" in its own `manifest.json` — call this out in an inline comment next to the constant (mirroring the existing maintainer-transition caveat comment already present next to `PLUGIN_BREADCRUMBS`) and in the `bootstrap-prefs-schema.json` detail text, but it does not change the installer's mechanics: it installs, is enabled, and any failure warns-and-continues exactly like the other four.

Source context: `raw/research/obsidian-alias-link-resolution/index.md`, `wiki/knowledge/sources/obsidian-alias-link-resolution.md`, `wiki/knowledge/entities/tools/alias-linker.md`.

## Steps

### 1. Add the plugin to install-obsidian.sh  <!-- agent: general-purpose -->

- [x] In `lib/scripts/install-obsidian.sh`, add a new named constant after `PLUGIN_FRONT_MATTER_TITLE` (now lines 39-46):
  ```bash
  # Patches Obsidian's link-lookup step with an alias fallback (tries real
  # filename resolution first, then a note's `aliases:` frontmatter) — the
  # plugin half of ROADMAP-008's wikilink-resolution fix; the `aliases:`
  # frontmatter half is scripted elsewhere. Self-described "experimental" in
  # its own manifest.json and less widely used than the other four bundled
  # plugins — verify johannrichard/alias-linker is still maintained at
  # install time before relying on this constant.
  PLUGIN_ALIAS_LINKER="johannrichard/alias-linker"
  ```
- [x] Add `"$PLUGIN_ALIAS_LINKER"` to the `for plugin_repo in "$PLUGIN_DATAVIEW" "$PLUGIN_GRAPH_LINK_TYPES" "$PLUGIN_BREADCRUMBS" "$PLUGIN_FRONT_MATTER_TITLE"; do` loop (now line 319), making it a 5-element list. Loop body untouched.
- [x] Updated the interactive prompt string (now line 305): `"Install recommended Obsidian plugins (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker) into this project's vault config? [Y/n]: "`.
- [x] Left the trailing `echo "  NOTE: Front Matter Title is installed..."` line (now line 327) untouched.

`bash -n lib/scripts/install-obsidian.sh` → SYNTAX_OK.
<!-- Updated: 2026-08-15 -->

### 2. Update bootstrap-prefs-schema.json  <!-- agent: general-purpose -->

- [x] In `lib/scripts/templates/bootstrap-prefs-schema.json`, updated the `obsidian.plugins` entry (now lines 130-138):
  - `"summary"`: now mentions all five plugins: `"Install the bundled Obsidian plugin set (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker)"`.
  - `"detail"`: "all four recommended community plugins" → "all five recommended community plugins"; "all four plugin folders" → "all five plugin folders". Added sentence: Alias Linker has no Dataview dependency (patches Obsidian's core link resolver directly) but is self-described "experimental" upstream — that's why it stays bundled under the single consent gate, consistent with the Front Matter Title "prompt-count simplicity" framing.
  - No new schema key added — stays inside existing `obsidian.plugins` key.

JSON validity confirmed via `JSON.parse()`.
<!-- Updated: 2026-08-15 -->

### 3. Update lib/scripts/README.md  <!-- agent: general-purpose -->

- [x] In `lib/scripts/README.md`'s preferences registry table, updated the `obsidian.plugins` row (line 397, not 396 — an earlier `obsidian.installApp` row shifted it) to mention all five plugins: "Install the bundled Obsidian plugin set (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker)".

<!-- Updated: 2026-08-15 -->

### 4. Add test coverage  <!-- agent: general-purpose -->

- [x] In `test/install-obsidian.test.js`, extended the existing end-to-end test (now line 711): renamed to `'install-obsidian.sh: the plugin bundle installs and enables all five plugins (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker) with distinct ids, and prints the Front Matter Title manual-toggle note'`. Added `'johannrichard/alias-linker': 'alias-linker'` to `repoToId` (line 724). `assert.strictEqual(enabled.length, ...)` updated 4→5 with matching message (line 780). Also fixed two doc-comment "four" references (lines 704-705) found during the sweep.
- [x] Left `pluginFetchEnv`, single-plugin failure-path tests, and graph-defaults tests untouched.

`node --test test/install-obsidian.test.js` → 21/21 pass.
<!-- Updated: 2026-08-15 -->

### 5. Verify  <!-- agent: general-purpose -->

- [x] Ran `npm test` from repo root: 349/349 pass, 0 fail, no regressions.
- [x] Swept the repo (Serena `search_for_pattern`) for stale "four plugin(s)" wording. No genuinely stale forward-looking references remain: the one "other four bundled plugins" phrase in `install-obsidian.sh`'s new comment correctly refers to the four plugins besides Alias Linker itself; remaining hits are either `raw/` (immutable), `wiki/log.md`/`wiki/hot.md` historical narration (append-only, left untouched per instructions), the task file's own before/after notes, or unrelated numeric coincidences. No edits needed.

<!-- Updated: 2026-08-15 -->

## Notes

- Out of scope: the `aliases: [<ID>]` frontmatter work (ROADMAP-008 Phase 1/2, tracked as TASK-064) — do not add frontmatter fields to any skill templates or backfill existing work-item files as part of this task.
- Out of scope: verifying Alias Linker's actual link-resolution behavior inside a running Obsidian vault — this task only wires the installer/docs/tests, matching the existing bundle's own scope (installer mechanics, not runtime plugin behavior verification).
