---
id: TASK-054
title: "Add obsidian.installApp + obsidian.plugins keys to bootstrap-prefs-schema.json"
status: done
created: 2026-08-13
updated: 2026-08-14
depends_on: []
blocks: [TASK-055]
parallel_safe_with: [TASK-053, TASK-056, TASK-057]
uat: "[[UAT-054]]"
tags: [obsidian, installer, preferences]
---

# TASK-054 — Add obsidian.installApp + obsidian.plugins keys to bootstrap-prefs-schema.json

## Objective

Document the two new sticky preference keys used by the Obsidian installer (`lib/scripts/install-obsidian.sh`, created in parallel by TASK-053) in `lib/scripts/templates/bootstrap-prefs-schema.json`, following the exact documentation shape every existing entry in that file already uses.

## Approach

Read the existing file in full first to match its JSON shape precisely: each entry has `scope`, `consumer`, `summary`, `detail`, `values`, `default`, `askedBy` (some also have `dynamic: true`, not needed here). Model the `detail` prose's tone/depth on `mcp.playwright` and `guides.evals-framework.md` — explain the mechanism, the consequence of true/false, and any prerequisites, in the same voice.

Two new keys:

- **`obsidian.installApp`** — scope: `global` (the app is machine-wide, matching `mcp.playwright`'s scope choice). consumer: `installer`. values: `true | false`. default: `null`. askedBy: `install-obsidian.sh`. detail should explain: this gates whether the Obsidian desktop app itself gets installed via the native package manager (brew/flatpak); true installs and keeps offering on every run per the standard sticky-prompt semantics; false means the installer stops offering it until changed via `/bootstrap-config`.
- **`obsidian.plugins`** — scope: `project` (plugin files live inside this project's own `.obsidian/`, matching `guides.*`'s project scope). consumer: `installer`. values: `true | false`. default: `null`. askedBy: `install-obsidian.sh`. detail should explain: this is a SINGLE bundled prompt covering all three recommended plugins together (Dataview, Graph Link Types, Breadcrumbs) rather than one key per plugin, because Dataview is a hard prerequisite for the other two (they read Dataview-indexed fields) — installing them separately would let a user accept Graph Link Types/Breadcrumbs without Dataview, which wouldn't work. True installs/refreshes all three plugin folders into `.obsidian/plugins/` and enables them in `.obsidian/community-plugins.json` on every run; false stops the installer offering the bundle again.

## Steps

### 1. Read and extend the schema file <!-- agent: general-purpose -->

- [x] `Read` `lib/scripts/templates/bootstrap-prefs-schema.json` in full to confirm current formatting (2-space indent, trailing comma conventions, key ordering — new global-scope entries and project-scope entries both currently appear interleaved by rough thematic grouping rather than strictly sorted by scope, so insert near the other `mcp.*`/`guides.*` entries where it reads naturally).
  - [x] Add the two new keys (`obsidian.installApp`, `obsidian.plugins`) as described above, using `Edit` (never raw shell redirection), preserving valid JSON syntax (comma placement) throughout the file. Inserted directly after `mcp.playwright` and before `skills.pruneOrphans`.
  - [x] Verify the result is still valid JSON by re-reading it after the edit (no trailing comma on the last key, etc). Confirmed via `python3 -m json.tool` — VALID JSON.

<!-- Updated: 2026-08-13 (time not tracked by this session) -->

## Notes

Derived from `raw/research/obsidian-setup-automation/index.md`'s Recommendation section (step 4: "Add both keys to `lib/scripts/templates/bootstrap-prefs-schema.json`") and `wiki/work/roadmaps/ROADMAP-006-obsidian-plugin-automation.md` Phase 1. Companion script (TASK-053) and wiring (TASK-055) are separate, parallel/sequenced tasks — do not create or edit `lib/scripts/install-obsidian.sh` or `lib/scripts/lib.sh` here.
