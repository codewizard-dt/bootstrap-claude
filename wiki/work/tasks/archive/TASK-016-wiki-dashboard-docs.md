---
id: TASK-016
title: "Document the dashboard command in README.md, lib/scripts/README.md, and CLAUDE.md"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-012, TASK-013, TASK-014, TASK-015]
blocks: []
parallel_safe_with: []
uat: "[[UAT-016]]"
tags: [wiki-tooling, dashboard]
---

# TASK-016 — Document the dashboard command in README.md, lib/scripts/README.md, and CLAUDE.md

## Objective

Document the new `bootstrap dashboard` command (built across TASK-012 through TASK-015) in the three places this repo's other CLI commands are documented, so the feature is discoverable the same way `setup`/`update`/`deploy`/etc. are. This is Phase 4 of ROADMAP-002.

## Approach

Depends on all four implementation tasks because accurate docs require the final command name, args, and behavior as actually implemented (port default/override syntax from TASK-012/TASK-014, and the always-refresh sync behavior from TASK-015) — writing this before they land risks documenting a command surface that doesn't match reality.

Three doc sites, matching existing patterns exactly:
- Root `README.md` — wherever the other `npx @codewizard-dt/bootstrap <command>` commands are listed/explained (search for `bootstrap setup` or `bootstrap deploy` to find the section).
- `lib/scripts/README.md` — the "CLI-facing scripts (one per `bootstrap` command)" table (`lib/scripts/README.md:7-16`) — add a `wiki-dashboard-server.js` row following the exact same column format (`Script | bootstrap command | What it does`).
- `CLAUDE.md` (this repo's own, root-level) — the "Setup Workflow" bullet list (`npx @codewizard-dt/bootstrap setup` etc.) and/or the "Custom Commands" table, whichever section is the better fit for a dashboard-viewing command versus a setup command — read the current structure before deciding placement.

## Steps

### 1. Update root README.md <!-- agent: general-purpose -->

- [x] Find where `bootstrap setup`/`update`/`deploy`/etc. are documented in `README.md` and add a `bootstrap dashboard` entry describing what it launches, the default port, and how to override it (per TASK-012/TASK-014's actual implementation)

<!-- Updated: 2026-07-06 -->
Added `dashboard` to the CLI Entry Point command enumeration (README.md:29) and two `node bin/cli.js dashboard` examples (default port 4317 + `4400` override) in the Run Locally block.

### 2. Update lib/scripts/README.md <!-- agent: general-purpose -->

- [x] Add a row to the "CLI-facing scripts" table for `wiki-dashboard-server.js` / `dashboard` command, following the existing table's column conventions
- [x] If TASK-012 already added a placeholder note there, replace it with the full, accurate row

<!-- Updated: 2026-07-06 -->
Replaced the "forthcoming, TASK-014 / docs owned by TASK-015" placeholder row (lib/scripts/README.md:17) with the accurate final row: default port 4317, `bootstrap dashboard 4400` override, port fallback, no-store headers, foreground/long-running Node server.

### 3. Update root CLAUDE.md <!-- agent: general-purpose -->

- [x] Add a `dashboard` entry to the "Setup Workflow" bullet list or "Custom Commands" table (whichever fits; check current structure first) describing the command and its purpose

<!-- Updated: 2026-07-06 -->
Added a `dashboard [port]` bullet to the Setup Workflow list (after `typechecks`), the section where every other `npx @codewizard-dt/bootstrap <command>` lives — best fit for discoverability. Notes zero-dep Node server, read-only wiki/work dashboard, default port 4317 + override + fallback.
<!-- Renumbered: 2026-07-06 — was TASK-005, collided with the pre-existing archived ROADMAP-001 TASK-005. Renumbered to TASK-016 (task-add's next-number scan didn't check archive/; fixed in lib/skills/task-add/SKILL.md Step 4). -->
