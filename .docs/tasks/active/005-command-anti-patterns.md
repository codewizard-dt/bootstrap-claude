# 005 — Command Anti-Patterns Guide and Tackle/UAT Verification Split

## Objective

Document shell-command and file-operation anti-patterns in a new guide, and update `/tackle` and `/uat-generator` so runtime/end-to-end verification is routed exclusively to the UAT phase.

## Approach

Create `.docs/guides/command-anti-patterns.md` as the canonical reference for shell hygiene (no `&&`-chains, no `/tmp/` scratch, no `echo` banners, no temp-file round-trips, no parse-`ls`, etc.). Tighten `/tackle` to only permit static gates (`bash -n`, typecheck, lint, unit tests) in its verification steps, explicitly banning runtime/behavioral verification. Update `/uat-generator` to own runtime/end-to-end verification, including shell script execution. Cross-link from `mcp-tools.md`'s existing "Common anti-patterns" section.

## Prerequisites

- [ ] `.docs/guides/mcp-tools.md` and `.docs/guides/task-lifecycle.md` exist (they do)
- [ ] `.claude/commands/tackle.md` and `.claude/commands/uat-generator.md` exist (they do)
- [ ] Task 003 (sync-docs-scaffold) resolved or paused — this task was triggered by a verification step in 003 that itself exhibited the anti-pattern

---

## Steps

### 1. Create `.docs/guides/command-anti-patterns.md`  <!-- agent: general-purpose -->

- [x] Create new file `.docs/guides/command-anti-patterns.md`
  - Header structure mirrors `mcp-tools.md`: title, `**Purpose**` line, then sections separated by `---`
  - Purpose: "Shell-command and file-operation hygiene rules for AI agents running verification, setup, and one-off tasks."
- [x] Section: **TOP RULE — One command, one job**
  - Every shell invocation should do exactly one thing
  - Do NOT chain `A && B && C && D` just because all must succeed — run them as separate invocations so (a) each is independently re-runnable, (b) approval prompts aren't ganged, (c) failures pinpoint the offending step
  - Bad example (the real incident that triggered this guide):
    ```bash
    SCRATCH=$(mktemp -d) && echo "SCRATCH=$SCRATCH" && mkdir -p "$SCRATCH" && /path/sync-docs-scaffold.sh "$SCRATCH" && echo "---SCRATCH_PATH---" && echo "$SCRATCH" > /tmp/scratch_path.txt && cat /tmp/scratch_path.txt
    ```
  - Good example: one `mkdir -p ./tmp/scratch`, then one `./sync-docs-scaffold.sh ./tmp/scratch`, then one `mcp__serena__list_dir relative_path="tmp/scratch/.docs" recursive=true`
- [x] Section: **Prefer project-local scratch (`./tmp/`) over `/tmp/` or `$(mktemp -d)`**
  - Rule: when a script needs a scratch directory, create `./tmp/<purpose>/` inside the project root and add `tmp/` to `.gitignore` if not already present
  - Why: project-local paths are (a) visible to MCP Serena (which is project-scoped), (b) inspectable without leaving the project tree, (c) deleted by a single `rm -rf ./tmp/<purpose>` that is obviously safe
  - `/tmp/` and `mktemp -d` paths live outside Serena's project scope, force shell-based inspection, and accumulate if not cleaned
  - Include one short bash snippet: `mkdir -p ./tmp/scratch && ./sync-docs-scaffold.sh ./tmp/scratch` (two invocations, both single-purpose)
- [x] Section: **No intermediate `echo` progress banners**
  - Banners like `echo "---SCRATCH_PATH---"` or `echo "===== API-2 DONE ====="` add no information the tool result doesn't already convey and clutter the transcript
  - Read the command's actual output; do not wrap it in decorative banners
- [x] Section: **No temp-file round-trips**
  - Anti-pattern: `echo "$X" > /tmp/foo && cat /tmp/foo` just to surface a value
  - Rule: if you need the value, print it directly (`echo "$X"`); if it's already known to the agent, don't surface it at all
- [x] Section: **Classic shell footguns**
  - `cat file | grep pattern` — use `grep pattern file` (or the `Grep` tool, or `mcp__serena__search_for_pattern`)
  - `ls | grep foo` — parse-ls is broken on filenames with spaces/newlines; use a glob or `mcp__serena__find_file`
  - `rm -rf $var` — always quote: `rm -rf "$var"`, and guard against empty: `[ -n "$var" ] && rm -rf "$var"`
  - Unquoted `$var` in paths/arguments — always double-quote unless you specifically want word-splitting
  - Missing `set -euo pipefail` at the top of any `bash` script — every new helper script must include it (`sync-docs-scaffold.sh`, `bootstrap-serena.sh` are precedent)
- [x] Section: **Verification belongs to the right phase** (this is the `/tackle` ↔ UAT split)
  - `/tackle` verification = **static gates only**: `bash -n <script>`, `pnpm typecheck`, `mypy`, lint, unit tests. Any command that produces deterministic pass/fail text without executing runtime behavior or touching the live filesystem beyond reading it.
  - **NOT** allowed in `/tackle` verification: running the script against a scratch dir, creating temp dirs, rsync dry-runs, curl calls, spawning servers, seeding fixtures, asserting on output contents.
  - Everything above belongs in **UAT** (`/uat-generator` → `/uat-walkthrough` / `/uat-auto`). UAT is the phase designed for end-to-end runtime verification.
  - Rule of thumb: if the verification step needs more than one command, or creates any file, or reads any file's contents — move it to UAT.
- [x] Section: **See also**
  - Link back to `mcp-tools.md` ("Common anti-patterns") — it owns the MCP-tool side (no `sed`/`cat`/`ls` on files)
  - Link to `task-lifecycle.md` — for the `/tackle` vs UAT flow

### 2. Tighten `/tackle` verification scope  <!-- agent: general-purpose -->

- [x] Edit `.claude/commands/tackle.md`
  - Locate the `### Subagent Requirements` block (currently item 3 reads: "Run quality gates after completing the work: After any code changes: run the project's typecheck command...")
  - Replace its body with stricter language that explicitly restricts verification to static gates and redirects runtime checks to UAT. Use these exact points:
    - "Run **static gates only**: `bash -n` for shell scripts, project typecheck (`pnpm typecheck` / `mypy` / etc.), lint, and unit tests"
    - "**Do NOT** perform runtime/end-to-end verification inside `/tackle`: no creating scratch dirs, no running helper scripts against real paths, no curl calls, no rsync dry-runs, no spawning servers, no fixture seeding, no asserting on file contents produced by the code you just wrote"
    - "Anything that requires *executing* the code to observe behavior belongs in the UAT phase (generated by `/uat-generator`, walked through by `/uat-walkthrough` or `/uat-auto`). If a step as written calls for runtime verification, mark it `[DEFERRED-TO-UAT]` and move on"
    - "If typecheck fails, ALL errors are from your changes..." — keep this sub-point verbatim (it's still correct)
    - Keep the existing `git stash` ban verbatim
- [x] Locate the existing `### 4. Verification  <!-- agent: general-purpose -->` *example* pattern in tackle.md (if present in the example block around line 155-164) and update the example to reflect static-only gates
- [x] Add a one-line callout near the top of the command (right under the "MANDATORY: MCP Serena for All Code Operations" table) that reads: `**Verification scope**: Static gates only (bash -n, typecheck, lint, unit tests). Runtime/E2E verification is the UAT phase's job — see .docs/guides/command-anti-patterns.md#verification-belongs-to-the-right-phase.`
- [x] Do not touch the Step 0 (resolve task file), Step 1 (read outline), Step 2 (execute), or Step 3 (update) section skeletons — the change is scoped to the verification-requirement language and one new callout

### 3. Update `/uat-generator` to own runtime verification  <!-- agent: general-purpose -->

- [x] Edit `.claude/commands/uat-generator.md`
  - In the opening section (above "## Instructions"), add a short paragraph: "UAT is the phase that owns **runtime and end-to-end verification**. `/tackle` only runs static gates (typecheck, `bash -n`, lint, unit tests). Any behavior that requires executing the feature — running a helper script against real paths, hitting an API, walking a user flow, asserting on produced files — is a UAT test, not a tackle verification step. See `.docs/guides/command-anti-patterns.md`."
  - In Step 4 ("Test Case Guidelines") → sub-section "Coverage Categories", add a new bullet: `**Shell scripts and helpers**: UAT is the right place to execute scripts against a project-local scratch dir (./tmp/) and assert on produced files. Do NOT try to do this in /tackle.`
  - Do not touch the research-gate block (Step 2.3 / 2.4) — that content is orthogonal
- [x] In the "Curl command standards" block (Step 4, item 2), add a one-line entry reinforcing `./tmp/` over `/tmp/`: `**Scratch paths**: if a test needs to write temporary files, use ./tmp/<purpose>/ (project-local, gitignored). Never write to /tmp/ or use $(mktemp -d) — those paths are outside Serena's project scope and cannot be inspected without shell listings.`

### 4. Cross-link from `mcp-tools.md`  <!-- agent: general-purpose -->

- [x] Edit `.docs/guides/mcp-tools.md`
  - At the end of the existing "### Common anti-patterns and their fixes" section (just before the `---` separator that follows it), append a short "**See also**" line: `**See also**: [`command-anti-patterns.md`](./command-anti-patterns.md) — shell hygiene, scratch-dir rules, and the /tackle-vs-UAT verification split.`
  - Do not modify any of the existing anti-pattern entries in mcp-tools.md (they already cover `sed`/`cat`/`ls`/`grep` on files from the MCP-tool angle)

### 5. Ensure `./tmp/` is gitignored  <!-- agent: general-purpose -->

- [x] Use `mcp__serena__find_file` (file_mask=".gitignore", relative_path=".") to locate the repo's `.gitignore`
  - If one exists, `Read` it; if it already contains `tmp/` or `/tmp/` on its own line, skip
  - If it does not contain a `tmp/` entry, `Edit` to append a new line: `tmp/`
  - If no `.gitignore` exists at repo root, `Write` one containing just `tmp/` followed by a newline
- [x] Do not add any other entries; the scope of this step is solely the scratch-dir ignore rule

### 6. Update the task index  <!-- agent: general-purpose -->

- [x] Edit `.docs/tasks/README.md`
  - Under "## Active Tasks", add a new line (in numeric order — after task 003): `- [005 — Command Anti-Patterns Guide and Tackle/UAT Verification Split](active/005-command-anti-patterns.md) — New guide documenting shell-hygiene anti-patterns; /tackle restricted to static gates; /uat-generator owns runtime verification.`
  - Do not touch existing task entries

### 7. Verification (static gates only)  <!-- agent: general-purpose -->

- [x] `bash -n` is not applicable (no shell scripts were created or modified in this task — pure markdown edits)
- [x] Confirm the new guide exists at `.docs/guides/command-anti-patterns.md` using `mcp__serena__find_file`
- [x] Confirm the new guide contains all required sections using `mcp__serena__search_for_pattern` for each section heading text (TOP RULE, scratch, echo banners, temp-file round-trips, footguns, verification, see also)
- [x] Confirm `.claude/commands/tackle.md` contains the new "Verification scope" callout using `mcp__serena__search_for_pattern` for the string `Static gates only`
- [x] Confirm `.claude/commands/uat-generator.md` contains the new runtime-verification paragraph using `mcp__serena__search_for_pattern` for the string `runtime and end-to-end verification`
- [x] Confirm `.docs/guides/mcp-tools.md` contains the new "See also" cross-link using `mcp__serena__search_for_pattern` for `command-anti-patterns.md`
- [x] Confirm `.gitignore` contains `tmp/` using `Read`
- [x] **Do NOT** run the helper against a scratch dir, do not create any `./tmp/` directory, do not invoke any script — those are UAT concerns and explicitly outside /tackle's scope (this task is the one that codifies that rule)

---
**UAT**: [`.docs/uat/pending/005-command-anti-patterns.uat.md`](../../uat/pending/005-command-anti-patterns.uat.md)
