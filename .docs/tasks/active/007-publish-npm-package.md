# 007 — Publish @codewizard-dt/bootstrap-claude to npm

## Objective

Ship `@codewizard-dt/bootstrap-claude@1.0.0` to the public npm registry with all required files included so `npx bootstrap-claude setup` and `npx bootstrap-claude update` actually work end-to-end against fresh target projects.

## Approach

Replace the narrow file-list in `package.json` `files` with directory entries plus the two helper scripts that current setup/update flows depend on; add a `prepublishOnly` guard that asserts the tarball contains everything `bin/cli.js` will eventually invoke; verify locally by installing the packed tarball and running it against a tmp dir; then `npm publish` and re-verify with a real `npx` invocation against a clean directory.

## Prerequisites

- [ ] `setup-project.sh`, `update-project.sh`, `sync-docs-scaffold.sh`, and `bootstrap-serena.sh` exist and pass `bash -n`
- [ ] Operator has an npm account with publish access to the `@codewizard-dt` scope (verify via `npm whoami`)
- [ ] Operator has run `npm login` interactively in this shell (`npm publish` will not work without it)
- [ ] Working tree is clean or only contains the changes from this task — no unrelated WIP

---

## Steps

### 1. Audit the current npm tarball  <!-- agent: Explore -->

- [ ] Run `npm pack --dry-run --json` and capture the file list
  - Save the file count and total size for comparison after Step 2
- [ ] Cross-check the tarball file list against every script reference:
  - `bin/cli.js` invokes `setup-project.sh` and `update-project.sh` via `execFileSync` — both must be in the tarball ✅ (already present)
  - `setup-project.sh` invokes `"$TEMPLATE_DIR/sync-docs-scaffold.sh"` and `"$TEMPLATE_DIR/bootstrap-serena.sh"` — confirm whether each is present
  - `update-project.sh` invokes the same two scripts — confirm whether each is present
  - `sync-docs-scaffold.sh` rsyncs `.docs/guides/`, `.docs/tasks/active/README.md`, `.docs/adr/README.md`, and `.claude/skills/` — confirm each source path is present in the tarball
- [ ] Produce a gap report (table form, not bullets) listing every referenced path that is **NOT** in the current tarball
  - Expected gaps based on prior research: `bootstrap-serena.sh`, `sync-docs-scaffold.sh`, `.docs/guides/task-lifecycle.md`, `.docs/guides/command-anti-patterns.md`, `.docs/adr/README.md`, `.docs/adr/.gitkeep`, `.claude/skills/**`
- [ ] Output the gap report to stdout — do not write any files in this step

### 2. Fix `package.json` `files` field  <!-- agent: general-purpose -->

- [ ] Edit `package.json` to replace the `files` array with directory entries and the two missing scripts. The new array must include exactly:
  - `bin/`
  - `setup-project.sh`
  - `update-project.sh`
  - `sync-docs-scaffold.sh`
  - `bootstrap-serena.sh`
  - `.claude/skills/`  (directory — `.claude/commands/` was migrated to Skills format; this single entry covers all 20 skill directories)
  - `.docs/guides/`  (directory — replaces the single `mcp-tools.md` entry; will pick up `task-lifecycle.md`, `command-anti-patterns.md`, and any future guides)
  - `.docs/tasks/README.md`
  - `.docs/tasks/active/.gitkeep`
  - `.docs/tasks/active/README.md`
  - `.docs/tasks/completed/.gitkeep`
  - `.docs/tasks/trashed/.gitkeep`
  - `.docs/uat/completed/.gitkeep`
  - `.docs/uat/pending/.gitkeep`
  - `.docs/uat/skipped/.gitkeep`
  - `.docs/uat/screenshots/.gitkeep`
  - `.docs/uat/trashed/.gitkeep`
  - `.docs/adr/.gitkeep`
  - `.docs/adr/README.md`
- [ ] Validate the JSON: `node -e "JSON.parse(require('fs').readFileSync('package.json'))"`
- [ ] Re-run `npm pack --dry-run` and confirm the new file count is higher and includes every previously-missing path from Step 1's gap report
  - Acceptance: zero entries from Step 1's gap list remain absent

### 3. Add a `prepublishOnly` validation script  <!-- agent: general-purpose -->

- [ ] Create `scripts/verify-tarball.sh` at the repo root:
  - `#!/usr/bin/env bash` + `set -euo pipefail`
  - Runs `npm pack --dry-run --json` and pipes through `node` (or `jq` if available) to extract the path list
  - Asserts each REQUIRED path is present; exits 1 with a clear message naming any missing path
  - Required-path list lives in the script as a Bash array (single source of truth):
    ```
    REQUIRED=(
      "bin/cli.js"
      "setup-project.sh"
      "update-project.sh"
      "sync-docs-scaffold.sh"
      "bootstrap-serena.sh"
      ".docs/guides/mcp-tools.md"
      ".docs/guides/task-lifecycle.md"
      ".docs/guides/command-anti-patterns.md"
      ".docs/adr/README.md"
      ".claude/skills/create-adr/SKILL.md"
      ".claude/skills/finalize-adr/SKILL.md"
    )
    ```
  - For each REQUIRED entry, grep the path list; if absent, append to a missing-list and continue
  - At end: if missing-list is non-empty, print "Tarball missing required files:" followed by each missing path one per line, then exit 1
  - On success: `echo "Tarball includes all required files (count: $TOTAL)"` and exit 0
- [ ] `chmod +x scripts/verify-tarball.sh`
- [ ] Add to `package.json` `scripts`:
  - `"prepublishOnly": "./scripts/verify-tarball.sh"`
  - `"verify-tarball": "./scripts/verify-tarball.sh"` (so the operator can run it manually)
- [ ] Run `npm run verify-tarball` and confirm it exits 0
- [ ] Sanity test: temporarily remove one entry from the `files` array, re-run `npm run verify-tarball`, confirm it fails with the missing path in the output, then restore the entry

### 4. Local end-to-end verification (pre-publish)  <!-- agent: general-purpose -->

- [ ] `npm pack` (NOT `--dry-run`) — produces `codewizard-dt-bootstrap-claude-1.0.0.tgz`
- [ ] Create a tmp target dir for testing: `mkdir -p ./tmp/publish-test/setup-target && cd ./tmp/publish-test/setup-target`
  - Initialize as a fresh git repo: `git init` (some setup behaviors expect a git repo)
- [ ] From inside the tmp target dir, install the local tarball globally to a temp prefix:
  - `npm install --global --prefix ./tmp/publish-test/npm-prefix /path/to/codewizard-dt-bootstrap-claude-1.0.0.tgz`
- [ ] Invoke the binary via the temp prefix: `./tmp/publish-test/npm-prefix/bin/bootstrap-claude setup` (run from inside the setup-target dir)
- [ ] Acceptance criteria for setup run:
  - Exit code 0
  - `setup-target/.claude/skills/` is populated with all 20 skill directories (each containing a `SKILL.md`)
  - `setup-target/.docs/guides/mcp-tools.md`, `task-lifecycle.md`, `command-anti-patterns.md` all exist
  - `setup-target/.docs/adr/README.md` and `.docs/adr/.gitkeep` exist
  - `setup-target/.serena/project.yml` exists (bootstrap-serena ran successfully)
  - No `command not found` or `No such file or directory` errors in the output
- [ ] Run `bootstrap-claude update` from the same tmp target and confirm exit 0 and no missing-file errors
- [ ] Clean up: `rm -rf ./tmp/publish-test/`

### 5. Publish to npm  <!-- agent: general-purpose -->

- [ ] Confirm `npm whoami` returns the correct user with publish access to `@codewizard-dt`
  - If not logged in: STOP and tell the operator to run `npm login` interactively (this command cannot be automated)
- [ ] Confirm `npm view @codewizard-dt/bootstrap-claude` still returns 404 (i.e. nothing has been published in the meantime)
- [ ] Run `npm publish --access public`
  - The `prepublishOnly` script from Step 3 will run automatically; if it fails, fix and retry
  - `--access public` is required because the package is in a scoped namespace
- [ ] Capture the publish output and confirm:
  - `+ @codewizard-dt/bootstrap-claude@1.0.0` appears in stdout
  - No npm errors or 4xx HTTP responses
- [ ] Verify on the registry: `npm view @codewizard-dt/bootstrap-claude version` should return `1.0.0`

### 6. Post-publish end-to-end verification  <!-- agent: general-purpose -->

- [ ] Create a fresh tmp dir: `mkdir -p ./tmp/postpublish-test/target && cd ./tmp/postpublish-test/target && git init`
- [ ] Run `npx -y @codewizard-dt/bootstrap-claude@1.0.0 setup` from inside the target dir
  - The `-y` flag auto-confirms the npx prompt; the `@1.0.0` pin ensures we test exactly what was published
- [ ] Acceptance criteria for the npx setup:
  - Exit code 0
  - All file checks from Step 4 pass
  - The downloaded package contents match the local tarball byte-for-byte (compare via `npm view ... dist.tarball` URL if needed)
- [ ] Run `npx -y @codewizard-dt/bootstrap-claude@1.0.0 update` and confirm it works
- [ ] Clean up: `rm -rf ./tmp/postpublish-test/`

### 7. Update README and project-overview memory  <!-- agent: general-purpose -->

- [ ] Edit `README.md` to confirm the published-to-npm claim is now factually true; if there is any phrasing implying it is *only planned* or *not yet published*, update to past tense ("published to the npm registry")
  - Add the install command line near the top of the README: `npx @codewizard-dt/bootstrap-claude setup` (no version pin in the public-facing instruction)
- [ ] Edit `basic-project-setup.md` if it documents installation — confirm the `npx` instructions are correct and unversioned
- [ ] Update Serena memory `project/overview` (use `mcp__serena__edit_memory`):
  - Replace any "to be published" language with "published to npm registry as @codewizard-dt/bootstrap-claude@1.0.0"
- [ ] Write a new Serena memory `infra/npm-publish` documenting:
  - How `npm publish` is invoked for this repo
  - The `prepublishOnly` guard and its required-files list location
  - How to bump version (semver) and re-publish for future updates
  - Known gotcha: scoped packages require `--access public` on first publish

### 8. Verification gate  <!-- agent: general-purpose -->

- [ ] `bash -n setup-project.sh update-project.sh sync-docs-scaffold.sh bootstrap-serena.sh scripts/verify-tarball.sh` — all five must pass
- [ ] `node -e "JSON.parse(require('fs').readFileSync('package.json'))"` — must succeed
- [ ] `npm run verify-tarball` — must exit 0 with the success message
- [ ] `npm view @codewizard-dt/bootstrap-claude@1.0.0 version` — must return `1.0.0`
- [ ] `git status --short` shows only the intended changes from this task: `package.json`, `scripts/verify-tarball.sh` (new), `README.md`, `basic-project-setup.md` (if edited), and the project/overview + new infra/npm-publish memory files
- [ ] [DEFERRED-TO-UAT] Real npx invocation against a fresh project from a clean shell, in a directory the operator does not control, to confirm registry distribution works for arbitrary users (UAT will create the tmp dir, run npx, and assert on file structure)
