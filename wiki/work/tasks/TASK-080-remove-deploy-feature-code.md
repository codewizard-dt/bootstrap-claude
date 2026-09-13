---
id: TASK-080
aliases: [TASK-080]
title: "Remove the /bootstrap deploy feature code (setup-deployment.sh, its prompt, and bin/cli.js wiring)"
status: pending-uat
created: 2026-09-04
updated: 2026-09-04
depends_on: []
blocks: [TASK-081]
parallel_safe_with: [TASK-078, TASK-079]
uat: "[[UAT-080]]"
tags: [cleanup]
---

# TASK-080 — Remove the /bootstrap deploy feature code

implements::[[ROADMAP-010]]
blocks::[[TASK-081]]

> **Blocks**: [[TASK-081]]

## Objective

Per ROADMAP-010, the `/bootstrap deploy` product feature (which scaffolds GitHub Actions CI into other people's projects) is being removed entirely, not just this repo's own instance of the workflows it can generate. This task removes the feature's code: `lib/scripts/setup-deployment.sh`, `lib/prompts/setup-deployment.md`, and the `deploy`/`deployment` command wiring + usage text in `bin/cli.js`.

## Approach

`bin/cli.js`'s `SCRIPTS` map currently has:
```js
deploy: { script: 'setup-deployment.sh', args: ['.', ...extraArgs] },
deployment: { script: 'setup-deployment.sh', args: ['.', ...extraArgs] },
```
Remove both entries, and remove the corresponding `deploy` block from the usage/help text (`console.error` lines describing the `deploy` command and its example invocation). Doc references to the feature (README.md, CLAUDE.md, lib/scripts/README.md, lib/prompts/README.md) are handled separately by TASK-081, which depends on this task completing first.

## Steps

### 1. Delete the script and its prompt template  <!-- agent: general-purpose -->

- [x] `git rm lib/scripts/setup-deployment.sh`
- [x] `git rm lib/prompts/setup-deployment.md`
<!-- Updated: 2026-09-03 -->>

### 2. Remove deploy/deployment wiring from bin/cli.js  <!-- agent: general-purpose -->

- [x] `mcp__serena__find_symbol` or `search_for_pattern` on `bin/cli.js` for `deploy:` — remove both the `deploy:` and `deployment:` entries from the `SCRIPTS` object
- [x] Remove the `deploy` command's two `console.error` usage-text lines (the command description line and the "Optional: pass extra context..." + example lines)
<!-- Updated: 2026-09-03 -->>

### 3. Verify the CLI still works  <!-- agent: general-purpose -->

- [x] Run `node bin/cli.js` with no arguments and confirm the printed usage text no longer mentions `deploy`/`deployment`, and every remaining command (`setup`, `update`, `install`, `migrate`, `typechecks`, `dashboard`) still lists correctly
- [x] Run `node bin/cli.js deploy` and confirm it now falls through to the "unknown command" usage/error path (exit 1), not the old deploy script
<!-- Updated: 2026-09-03 -->>
