---
id: TASK-0106
aliases: [TASK-0106]
title: "Document `bootstrap config` as the non-Claude-Code path for editing preferences"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0104]
blocks: []
parallel_safe_with: []
uat: "[[UAT-0106]]"
tags: [docs, cli, bootstrap-prefs, roadmap-011]
---

# TASK-0106 — Document `bootstrap config` as the non-Claude-Code path for editing preferences

depends_on::[[TASK-0104]]

> **Depends on**: TASK-0104 (wires the `config` subcommand into `bin/cli.js`) — the docs must describe the shipped flag surface, so tackle after it lands.
> **Blocks**: none.
> **Roadmap**: [ROADMAP-011](../roadmaps/ROADMAP-011-build-bootstrap-prefs-tui.md) Phase 3.
> **Contention note**: `README.md` and `CLAUDE.md` are also touched by in-flight ROADMAP-0014 Phase 4 skill-rename work. Make small, section-anchored `Edit` calls (unique `old_string` per anchor); never rewrite or `Write` either file wholesale, and re-read each file immediately before editing.

## Objective

Once `bootstrap config` exists (ROADMAP-011 Phases 1-2), users who are not inside a Claude Code session can view and change `bootstrap-prefs.json` keys from a plain terminal. Make that discoverable: mention the subcommand in `README.md`, in the `CLAUDE.md` Setup Workflow list of `npx` subcommands, and cross-reference it from `/bootstrap-config`'s SKILL.md as the terminal equivalent.

## Approach

Documentation-only, three surgical edits plus one verification pass. No code, no schema, no behavior changes.

- Wording is fixed by what TASK-0104 actually shipped: read `bin/cli.js` first and copy the real usage/flags (no-args interactive menu; flag passthrough such as `--get` / `--set <key> ...`) rather than the roadmap's illustrative examples. If TASK-0104's surface differs from the roadmap text, the shipped code wins.
- Position it as the non-Claude-Code path and the same store as `/bootstrap-config` — both front ends delegate to `lib/scripts/bootstrap-prefs.js`, so they always agree. Scope stays `bootstrap-prefs.json` only, not Claude Code's own `settings.json`.
- Mirror how `dashboard` is already documented at each site so the new entry reads as a peer subcommand.
- The `lib/skills/README.md` skill index is intentionally not touched (it is being edited by the ROADMAP-0014 Phase 4 renames and `/bootstrap-config`'s own row there does not change).

## Steps

### 1. Confirm the shipped CLI surface  <!-- agent: Explore -->

- [x] Read `bin/cli.js` (Serena `get_symbols_overview` / `search_for_pattern` for the `config` entry, mirroring the `dashboard` entry) and note: the exact usage string, the no-args behavior, the supported passthrough flags, and any scope flags (`--global` / `--project`).
- [x] Read `lib/scripts/bootstrap-prefs-tui.js` header/usage output (the ROADMAP-011 Phase 1 deliverable) to confirm flag names. Record the facts to reuse verbatim in Steps 2-4.

### 2. README.md — three anchored edits  <!-- agent: general-purpose -->

- [x] Re-read `README.md` immediately before editing. Use `Edit` with unique anchors only.
- [x] **Components > CLI Entry Point > Inputs** (currently line ~29: "Commands such as `setup`, `update`, `install`, `migrate`, `typechecks`, and `dashboard`, plus optional extra arguments for migration and dashboard (port override) flows."): add `config` to the command list and mention its passthrough flags in the "optional extra arguments" clause.
- [x] **Deployment > Run Locally** bash block (after the `node bin/cli.js dashboard 4400` line, ~line 343): append a commented pair of examples, e.g. `# Edit bootstrap preferences from a plain terminal (no Claude Code session needed)` then `node bin/cli.js config`, plus one flag-driven example using the flags confirmed in Step 1.
- [x] Add a short paragraph (2-3 sentences) stating that `bootstrap config` (`npx @codewizard-dt/bootstrap config`) is the non-Claude-Code way to view/edit `bootstrap-prefs.json`, that `/bootstrap-config` is the in-session equivalent, and that both share the `bootstrap-prefs.js` store. Anchor it in the section that already discusses stored preferences; if README has no such section, place it directly under the CLI Entry Point component block (after its `Depends on:` line) rather than creating a new top-level section.

### 3. CLAUDE.md — Setup Workflow subcommand list  <!-- agent: general-purpose -->

- [x] Re-read `CLAUDE.md` immediately before editing.
- [x] In `## Setup Workflow`, insert one bullet after the `dashboard` bullet, in the same shape: `` - `npx @codewizard-dt/bootstrap config [flags]` — runs `lib/scripts/bootstrap-prefs-tui.js` (zero-dependency readline TUI for `bootstrap-prefs.json`: no-args interactive menu porting `/bootstrap-config`'s Step A-G flow, or flag-driven get/set passthrough for scripting; every read/write delegates to `lib/scripts/bootstrap-prefs.js`; the non-Claude-Code counterpart of `/bootstrap-config`) ``. Adjust the wording to the flags confirmed in Step 1.
- [x] Update the `/bootstrap-config` row of the `## Custom Commands` table only if a one-clause "terminal equivalent: `bootstrap config`" pointer fits without disturbing the row; skip if it makes the row unwieldy.
- [x] Do not touch the `bin/cli.js` Key Files line unless it enumerates subcommands (if it does, add `config` there).

### 4. `/bootstrap-config` SKILL.md cross-reference  <!-- agent: general-purpose -->

- [x] Re-read `lib/skills/bootstrap-config/SKILL.md` immediately before editing.
- [x] In the intro paragraph (line 14, "This command is the front end to that store: ..."), add one sentence: outside a Claude Code session, the same store is editable from a terminal with `npx @codewizard-dt/bootstrap config` (interactive menu or flag passthrough); both front ends go through `bootstrap-prefs.js`, so results are identical.
- [x] Also update the Step A "No bootstrap preference helper found" message only if it already lists alternative entry points; otherwise leave it.
- [x] Do not alter the frontmatter, the `argument-hint`, the CRITICAL ORDERING RULE, or any Step A-G procedure text. Use `Edit`, never `Write`.

### 5. Verify  <!-- agent: general-purpose -->

- [x] Search (Serena `search_for_pattern`) for `bootstrap config` across `README.md`, `CLAUDE.md`, and `lib/skills/bootstrap-config/SKILL.md` and confirm each of the three sites mentions it exactly once in the intended place, with flags matching `bin/cli.js`.
- [x] Run the repo's existing tests that assert on `README.md` / `CLAUDE.md` / skill-file structure (e.g. the skill-frontmatter and README contract tests under `test/`) and confirm they still pass; the edits are prose-only so none should change.
- [x] Confirm no other in-flight edit was clobbered: `git diff` on the three files should show only the additions from Steps 2-4.
