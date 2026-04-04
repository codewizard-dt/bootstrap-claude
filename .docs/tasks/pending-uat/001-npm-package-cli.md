# 001 — Bundle as npm Package with CLI

## Objective

Configure this repository as a publishable npm package so that `npx bootstrap-claude setup` runs `setup-project.sh .` and `npx bootstrap-claude update` runs `update-project.sh .`.

## Approach

Create a thin `bin/cli.js` Node.js wrapper that parses subcommands (`setup`, `update`) and spawns the corresponding shell script with `.` as the argument. Update `package.json` with `bin` and `files` fields to produce a clean, minimal npm package.

## Prerequisites

- [ ] `package.json` already exists with name `bootstrap-claude`

---

## Steps

### 1. Create CLI Entry Point
<!-- Completed: 2026-04-04 -->

- [x] Create `bin/cli.js` with `#!/usr/bin/env node` shebang
- [x] Parse `process.argv[2]` for the subcommand (`setup` or `update`)
- [x] For `setup`: spawn `setup-project.sh` with argument `.` (current working directory), inheriting stdio
- [x] For `update`: spawn `update-project.sh` with argument `.` (current working directory), inheriting stdio
- [x] For unknown/missing commands: print usage help and exit with code 1
- [x] Make the file executable (`chmod +x bin/cli.js`)

### 2. Update package.json
<!-- Completed: 2026-04-04 -->

- [x] Add `"bin"` field: `{ "bootstrap-claude": "./bin/cli.js" }`
- [x] Add `"files"` array to include only: `bin/`, `setup-project.sh`, `update-project.sh`, `.claude/`, `.docs/`
  - These are the files needed at runtime — the shell scripts copy `.claude/` and `.docs/` into the target project
- [x] Remove `"main": "index.js"` (not applicable for a CLI-only package)
- [x] Add a meaningful `"description"` field
- [x] Ensure `"type": "commonjs"` is retained (needed for `require`)

### 3. Ensure Shell Scripts Are Executable
<!-- Completed: 2026-04-04 -->

- [x] Verify `setup-project.sh` and `update-project.sh` have executable permissions in git
- [x] If not, `chmod +x` both and stage the permission change

### 4. Verification
<!-- Completed: 2026-04-04 -->

- [x] Run `node bin/cli.js` with no args — should print usage and exit 1
- [x] Run `node bin/cli.js setup` from a test directory — should execute setup-project.sh
- [x] Run `node bin/cli.js update` from a test directory — should execute update-project.sh
- [x] Run `npm pack --dry-run` to verify only intended files are included in the package
