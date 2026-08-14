---
id: bootstrap-guarded-install-pattern
title: Guarded, Opt-In, Sticky-Preference Install Pattern
aliases: [register_optional_mcp, prompt_yn_sticky, OPTIONAL_GUIDES pattern, guarded install pattern]
updated: 2026-08-13
sources:
  - ../../../../raw/research/obsidian-setup-automation/index.md
confidence: extracted
tags: [component, bootstrap-scripts, install-pattern, preferences]
---

This repo's own recurring shape for adding any new optional, machine-affecting piece of setup — reverse-engineered a second time by `derived_from::[[obsidian-setup-automation]]` from the same two call sites it was first derived from, which is exactly why a canonical writeup earns its place here rather than being re-derived a third time. **This page describes this repo's own code, not a third-party tool** — unlike the other pages under `entities/tools/`, there is no independent `raw/` source about the pattern itself; the pattern lives in `lib/scripts/install-mcps.sh` and `lib/scripts/sync-wiki-scaffold.sh` (code, not a `raw/` document), so the `sources:` link above cites the research report that most recently analyzed it instead. This is the same legitimate case as `uses::[[bootstrap-claude-hooks]]`, which documents `lib/hooks/` the same way.

**The shape, as implemented twice already:**

1. **Short-circuit if already installed/present.** `register_optional_mcp` checks `mcp_installed` before doing anything; the `OPTIONAL_GUIDES` loop checks whether the guide file already exists on disk.
2. **In interactive mode, ask once via a sticky yes/no prompt.** `prompt_yn_sticky <pref-key> <selector> "<prompt text>"` (`lib/scripts/lib.sh:251`) reads/writes a preference key scoped either `global` (machine-wide, e.g. `mcp.playwright`) or per-project (e.g. `guides.evals-framework.md`). A stored `true` or `false` is honored silently on every subsequent run without re-asking; only an unset/`ask` value prompts.
3. **In non-interactive mode, only a stored `false` diverts.** An unset preference never silently installs on a headless run — consent must have been recorded by a prior interactive run.
4. **Install via native tooling, non-fatally.** The adder (`_add_playwright`, `_add_brave`, or a guide's copy step) runs the real install command and reports failure as a warning, never aborting the parent `setup`/`update` script — callers wrap the call in `if ! step; then echo "Warning: ..."; fi`.
5. **Document the key in the schema.** `lib/scripts/templates/bootstrap-prefs-schema.json` gives every key the same shape: `scope`, `consumer`, `summary`, `detail`, `values`, `default`, `askedBy`, with an optional `dynamic: true` flag for per-item key families like `guides.*`.

**Where it's been applied:** MCP registration (`mcp.playwright`, `mcp.braveSearch`, single sticky toggles per tool) and optional wiki guides (`guides.*`, a dynamic per-item key family, bundled-optional-item precedent). `derived_from::[[obsidian-setup-automation]]` proposes a third application — `obsidian.installApp` (global scope, one toggle, mirrors `mcp.playwright`) and `obsidian.plugins` (project scope, one bundled toggle for all three plugins together, mirroring `guides.*`'s bundling rather than MCP's per-tool independence, because Dataview is a hard prerequisite for the other two plugins rather than an independently useful item).

**Why this page exists:** the research that surfaced this pattern the second time noted explicitly that a canonical writeup "would save re-deriving it a third time" — the next optional-install feature this repo adds (of which there will likely be more) should read this page and `lib/scripts/install-mcps.sh`/`sync-wiki-scaffold.sh` directly, rather than re-discovering the shape from scratch.
