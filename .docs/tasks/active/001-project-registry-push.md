# 001 — Project Registry and Push Updates Script

## Objective

Track all projects set up via `setup-project.sh` in a plain-text registry file, and provide a `push-updates.sh` script that syncs the latest commands/docs to every registered project.

## Approach

Append `PROJECT_DIR` to `registered-projects.txt` at the repo root on each successful `setup-project.sh` run (idempotent — no duplicates). A new `push-updates.sh` script reads the registry, skips blank lines, comment lines, and missing paths (with warnings), and calls `update-project.sh` on each valid entry.

## Prerequisites

- [ ] `setup-project.sh` and `update-project.sh` exist and are functional

---

## Steps

### 1. Create the registry file  <!-- agent: general-purpose -->

- [ ] Create `registered-projects.txt` at the repo root with a header comment block explaining the format
  - First line: `# registered-projects.txt — list of projects set up via setup-project.sh`
  - Second line: `# One absolute path per line. Lines starting with # are ignored. Managed automatically.`
  - Third line: empty (blank line before any entries)
- [ ] Ensure the file is committed (not gitignored)

### 2. Modify setup-project.sh to register on success  <!-- agent: general-purpose -->

- [ ] At the end of `setup-project.sh`, after the "Setup complete!" banner, append `PROJECT_DIR` to `registered-projects.txt`
  - Registry file path: `"$TEMPLATE_DIR/registered-projects.txt"`
  - Idempotent: only append if the path is not already present in the file
  - Use a `grep -qxF` check before appending with `echo`
  - Print a confirmation line: `echo "  Registered: $PROJECT_DIR"` after appending (or `echo "  Already registered: $PROJECT_DIR"` if skipped)

### 3. Create push-updates.sh  <!-- agent: general-purpose -->

- [ ] Create `push-updates.sh` at the repo root with `#!/usr/bin/env bash` and `set -euo pipefail`
- [ ] Resolve `SCRIPT_DIR` the same way as the other scripts: `"$(cd "$(dirname "$0")" && pwd)"`
- [ ] Set `REGISTRY="$SCRIPT_DIR/registered-projects.txt"`
- [ ] Check that `registered-projects.txt` exists; exit 1 with a clear error if not
- [ ] Read the registry line by line, skipping:
  - Blank lines
  - Lines starting with `#`
- [ ] For each valid line:
  - If the directory does not exist on disk: print a warning (`echo "WARNING: path not found, skipping: $line"`) and increment a `skipped` counter; continue
  - Otherwise: print `echo "Updating: $line"` and call `"$SCRIPT_DIR/update-project.sh" "$line"`
- [ ] After processing all lines, print a summary: `echo "Done. Updated: $updated  Skipped: $skipped"`
- [ ] Exit 0 even if some paths were skipped; exit 1 only if zero paths were successfully updated AND at least one was registered (i.e. the registry is non-empty but everything failed)
- [ ] Make the script executable: `chmod +x push-updates.sh`

### 4. Verification  <!-- agent: general-purpose -->

- [ ] Run `bash -n setup-project.sh` and `bash -n push-updates.sh` to confirm no syntax errors
- [ ] Manually verify `setup-project.sh` appends a test path correctly and does not duplicate on re-run
  - Test: add a dummy path to `registered-projects.txt`, run the append logic, confirm no duplicate
- [ ] Run `push-updates.sh` with the registry pointing at a valid local path and confirm `update-project.sh` is invoked
- [ ] Run `push-updates.sh` with a missing path entry and confirm warning is printed and script continues
- [ ] Confirm `registered-projects.txt` is present in the repo and not gitignored
