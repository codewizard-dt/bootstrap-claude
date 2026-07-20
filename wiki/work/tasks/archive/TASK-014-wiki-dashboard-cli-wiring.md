---
id: TASK-014
title: "Wire dashboard command into bin/cli.js"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-012]
blocks: []
parallel_safe_with: [TASK-015]
uat: "[[UAT-014]]"
tags: [wiki-tooling, dashboard]
---

# TASK-014 — Wire dashboard command into bin/cli.js

## Objective

Add a `dashboard` command to `bin/cli.js` that launches `lib/scripts/wiki-dashboard-server.js` (built in TASK-012) against the current project directory, so a developer can run `npx @codewizard-dt/bootstrap dashboard` (or the local `bootstrap dashboard` bin alias) from any project root to view the live wiki dashboard. This is part of Phase 3 of ROADMAP-002.

## Approach

- `bin/cli.js` currently drives every other command via `SCRIPTS` map entries of the form `{ script: '<name>.sh', args: [...] }`, executed with `execFileSync(scriptPath, scriptArgs, { stdio: 'inherit' })` (see `bin/cli.js:9-44`).
- `wiki-dashboard-server.js` is a long-running process (an HTTP server), unlike the other one-shot `.sh` scripts — `execFileSync` blocks until the child exits, which is fine here since the dashboard server should run in the foreground until the user Ctrl-C's it (matches the `stdio: 'inherit'` pattern already used for the other commands, which forwards signals normally).
- Add `dashboard: { script: 'wiki-dashboard-server.js', args: ['.', ...extraArgs] }` to the `SCRIPTS` map — passing `.` as the project dir (resolved by the script itself, mirroring `setup`/`update`'s `args: ['.']` pattern) plus any extra CLI args (e.g. an explicit port override) passed straight through.
- Add a `dashboard` line to the usage/help text block (`bin/cli.js:20-32`).
- No changes needed to the `execFileSync` call itself — it already works for any executable file with a shebang, regardless of extension, since TASK-012 ships `wiki-dashboard-server.js` with `#!/usr/bin/env node` + execute permission.

## Steps

### 1. Add the SCRIPTS entry and help text <!-- agent: general-purpose -->

- [x] In `bin/cli.js`, add to the `SCRIPTS` map: `dashboard: { script: 'wiki-dashboard-server.js', args: ['.', ...extraArgs] }`
- [x] Add a help line: `console.error('  dashboard     Launch the live wiki/work dashboard in this project (Ctrl-C to stop)');`
  - [x] Optionally note the port-override usage if TASK-012's script accepts a port arg, e.g. `console.error('                Optional: pass a port number, e.g. bootstrap dashboard 4400');`
- [x] Verify `lib/scripts/wiki-dashboard-server.js` (from TASK-012) is executable and has the correct shebang so `execFileSync` can invoke it directly, same as every other `.sh` entry in `SCRIPTS`

<!-- Updated: 2026-07-06 -->
<!-- Renumbered: 2026-07-06 — was TASK-003, collided with the pre-existing archived ROADMAP-001 TASK-003. Renumbered to TASK-014 (task-add's next-number scan didn't check archive/; fixed in lib/skills/task-add/SKILL.md Step 4). -->
