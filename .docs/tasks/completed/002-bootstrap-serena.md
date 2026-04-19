# 002 — Bootstrap Serena project.yml with Optional Tools

## Objective

Add a `bootstrap-serena.sh` script that triggers `.serena/` creation via a headless `claude --print` call, then enables 11 optional Serena tools in `project.yml`, and wire it into both `setup-project.sh` and `update-project.sh` (idempotent).

## Approach

`setup-project.sh` registers the Serena MCP but never actually starts Claude, so `.serena/project.yml` is not created until the user opens Claude Code. The new script runs `claude --print "exit"` in the target project directory — the CLI starts, MCP servers initialize (creating `.serena/project.yml`), then exits cleanly. The script then replaces `included_optional_tools: []` with a pre-populated list of 11 optional tools using a Python one-liner (portable across macOS/Linux; `uv`/`python3` already assumed by preflight). The operation is idempotent: if the `[]` marker is absent, the script reports "already configured" and exits 0, which is the expected state on `update-project.sh` re-runs.

## Prerequisites

- [x] `setup-project.sh` and `update-project.sh` exist and are functional
- [x] `claude` CLI is installed (already enforced by `setup-project.sh` preflight)
- [x] `python3` is available on the system (ships with macOS, standard on Linux)

---

## Steps

### 1. Create bootstrap-serena.sh  <!-- agent: general-purpose --> <!-- Completed: 2026-04-19 -->

- [x] Create `bootstrap-serena.sh` at the repo root with `#!/usr/bin/env bash` and `set -euo pipefail`
- [x] Resolve `TEMPLATE_DIR` the same way as the other scripts: `"$(cd "$(dirname "$0")" && pwd)"` (not used directly here but matches house style)
- [x] Enforce single-argument usage: if `$#` is not 1, print `Usage: $0 <path-to-project>` and exit 1
- [x] Resolve `PROJECT_DIR` from `$1` using the exact same pattern as `setup-project.sh` / `update-project.sh`:
  - `PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)" || { echo "Error: Cannot resolve path: $1"; exit 1; }`
  - Then `[ -d "$PROJECT_DIR" ]` check with a clear error
- [x] Preflight: verify `claude` is on `PATH` (`command -v claude &>/dev/null`). Exit 1 with install hint if missing.
- [x] Preflight: verify `python3` is on `PATH`. Exit 1 with a clear error if missing.
- [x] Print a banner: `echo "Bootstrapping Serena for: $PROJECT_DIR"`
- [x] `cd "$PROJECT_DIR"`
- [x] If `.serena/project.yml` does not already exist:
  - Print `echo "Triggering Claude Code to initialize Serena (.serena/ will be created)..."`
  - Run `claude --print "exit" >/dev/null 2>&1 || true` — headless invocation; errors are tolerated because the side effect (folder creation) is what we care about
  - After the call, re-check for `.serena/project.yml`. If still missing, print `Error: .serena/project.yml was not created by 'claude --print'. Ensure Serena MCP is registered for this project (run setup-project.sh first).` and exit 1.
- [x] Else print `echo ".serena/project.yml already exists, skipping claude --print step."`
- [x] Find-and-replace `included_optional_tools: []` with the 11-tool block using a Python one-liner (portable replacement; avoids `sed -i` portability issues between macOS and GNU). The replacement block must be exactly:
  ```yaml
  included_optional_tools:
    - list_dir
    - find_file
    - find_symbol
    - find_referencing_symbols
    - search_for_pattern
    - replace_content
    - replace_lines
    - insert_at_line
    - insert_after_symbol
    - insert_before_symbol
    - delete_lines
  ```
  - Implementation: capture stdout of a python3 call into a temp var, then write back only if the replacement count is > 0:
    ```bash
    PROJECT_YML="$PROJECT_DIR/.serena/project.yml"
    REPLACED=$(python3 - "$PROJECT_YML" <<'PY'
    import sys, pathlib
    p = pathlib.Path(sys.argv[1])
    text = p.read_text()
    needle = "included_optional_tools: []"
    repl = (
        "included_optional_tools:\n"
        "  - list_dir\n"
        "  - find_file\n"
        "  - find_symbol\n"
        "  - find_referencing_symbols\n"
        "  - search_for_pattern\n"
        "  - replace_content\n"
        "  - replace_lines\n"
        "  - insert_at_line\n"
        "  - insert_after_symbol\n"
        "  - insert_before_symbol\n"
        "  - delete_lines"
    )
    count = text.count(needle)
    if count:
        p.write_text(text.replace(needle, repl, 1))
    print(count)
    PY
    )
    ```
  - If `REPLACED` == `0`: print `echo "Serena optional tools already configured, skipping."` and exit 0
  - If `REPLACED` == `1`: print `echo "added 11 optional tools"` and exit 0
  - If `REPLACED` > `1`: print a warning `echo "Warning: replaced $REPLACED occurrences of the marker (expected 1)"` and still exit 0
- [x] Make the script executable: `chmod +x bootstrap-serena.sh`

### 2. Wire bootstrap-serena.sh into setup-project.sh  <!-- agent: general-purpose --> <!-- Completed: 2026-04-19 -->

- [x] Open `setup-project.sh`. Insert a new step **between** the `.claude/` + `.docs/` copy block (ends at line 104 with the trailing `echo ""`) and the `# Done` banner (line ~106 `echo "============================="`).
- [x] New block header: `echo "Bootstrapping Serena project.yml..."`
- [x] Call: `"$TEMPLATE_DIR/bootstrap-serena.sh" "$PROJECT_DIR"`
  - Do not wrap in `|| true` — if bootstrap fails, setup should fail visibly
- [x] Trailing `echo ""` to separate from the next section
- [x] Update the "Next steps" section (lines ~111–115): remove step `4. Run /primer to set up Serena's memory structure` **only if** it depends on .serena being fresh — keep as-is otherwise. Default: leave untouched; the bootstrap step does not conflict with `/primer`.

### 3. Wire bootstrap-serena.sh into update-project.sh  <!-- agent: general-purpose --> <!-- Completed: 2026-04-19 -->

- [x] Open `update-project.sh`. Insert a new step **after** the `.docs/` sync block (ends around line 36 with `echo ""`) and **before** the `# Done` banner.
- [x] New block header: `echo "Re-checking Serena project.yml bootstrap..."`
- [x] Call: `"$TEMPLATE_DIR/bootstrap-serena.sh" "$PROJECT_DIR"`
  - Must be idempotent — on already-bootstrapped projects, the script prints "already configured" and exits 0 (covered by Step 1's `[]`-absent branch)
- [x] Trailing `echo ""` to separate from the done banner

### 4. Verification  <!-- agent: general-purpose --> <!-- Completed: 2026-04-19 -->

- [x] Run `bash -n bootstrap-serena.sh`, `bash -n setup-project.sh`, `bash -n update-project.sh` to confirm no syntax errors
- [x] Create a throwaway directory (e.g. `/tmp/bootstrap-serena-test`) and:
  - Run `./bootstrap-serena.sh /tmp/bootstrap-serena-test`
  - Confirm `.serena/project.yml` exists after the run
  - Confirm the `included_optional_tools:` block has all 11 entries (verified via `Read` tool, not `cat`)
  - Confirm final line printed is exactly `added 11 optional tools`
  - Adjustment: pre-created `.serena/project.yml` with the `[]` placeholder to avoid registering Serena MCP against a throwaway `/tmp/` path; the `claude --print` branch is exercised only on real setup-project.sh runs.
- [x] Re-run `./bootstrap-serena.sh /tmp/bootstrap-serena-test` on the same directory
  - Confirm it prints `Serena optional tools already configured, skipping.`
  - Confirm it exits 0
- [x] Run `./update-project.sh /tmp/bootstrap-serena-test` and confirm the bootstrap step runs idempotently without error
- [x] Clean up: `rm -rf /tmp/bootstrap-serena-test`
- [x] Confirm `bootstrap-serena.sh` has the executable bit set (`test -x` passes). Commit check deferred to the end-of-task `/git-commit` flow.

---
**UAT**: [`.docs/uat/skipped/002-bootstrap-serena.uat.md`](../../uat/skipped/002-bootstrap-serena.uat.md) *(skipped)*
