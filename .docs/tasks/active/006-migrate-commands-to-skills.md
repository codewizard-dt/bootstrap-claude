# 006 — Migrate commands to skills

## Objective

Migrate all 20 legacy `.claude/commands/*.md` flat-files to `.claude/skills/<name>/SKILL.md` (modern directory format) with explicit `model:`, invocation-flag, and optional `effort:` frontmatter per command.

## Approach

Delete-and-replace: create all 20 `SKILL.md` files, then remove `.claude/commands/`. Both formats produce identical `/name` entries so co-existence causes conflicts. Update `sync-docs-scaffold.sh` to handle `.claude/skills/` syncing (consolidating it out of `update-project.sh`). Fix `package.json` to reference `skills/` and add missing `sync-docs-scaffold.sh` and `bootstrap-serena.sh` entries.

## Prerequisites

- [x] `.claude/commands/` directory exists with 20 `.md` files

---

## Steps

### 1. Create `.claude/skills/` SKILL.md files  <!-- agent: general-purpose -->

**Frontmatter spec** — apply to every SKILL.md (see per-command table below for values):

```yaml
---
name: <command-name>
description: <from table>
model: <from table>
effort: <from table, omit if not listed>
disable-model-invocation: true   # omit for primer and uat-auth (default = both)
argument-hint: <preserve if present in original .md frontmatter>
---
```

**Per-command reference table**:

| Command | Model | Effort | disable-model-invocation | Notes |
|---|---|---|---|---|
| `add-task` | `claude-opus-4-7` | — | `true` | Planning |
| `create-adr` | `claude-opus-4-7` | `high` | `true` | Planning |
| `finalize-adr` | `claude-opus-4-7` | `high` | `true` | Planning |
| `now` | `claude-opus-4-7` | `high` | `true` | Planning |
| `project-readme` | `claude-opus-4-7` | — | `true` | Planning |
| `research` | `claude-opus-4-7` | `high` | `true` | Planning |
| `uat-generator` | `claude-opus-4-7` | — | `true` | Planning |
| `update-task` | `claude-opus-4-7` | — | `true` | Planning |
| `git-commit` | `claude-sonnet-4-6` | — | `true` | Execution |
| `lint` | `claude-sonnet-4-6` | — | `true` | Execution |
| `serena-config` | `claude-sonnet-4-6` | — | `true` | Execution |
| `simplify` | `claude-sonnet-4-6` | — | `true` | Execution |
| `tackle` | `claude-sonnet-4-6` | — | `true` | Execution |
| `trash-task` | `claude-sonnet-4-6` | — | `true` | Execution |
| `uat-auth` | `claude-sonnet-4-6` | — | omit (both) | Model auto-invokes; keep in `/` menu |
| `uat-auto` | `claude-sonnet-4-6` | — | `true` | Execution |
| `uat-skip` | `claude-sonnet-4-6` | — | `true` | Execution |
| `uat-walkthrough` | `claude-sonnet-4-6` | — | `true` | Execution |
| `update-docs` | `claude-sonnet-4-6` | — | `true` | Execution |
| `primer` | `claude-haiku-4-5-20251001` | — | omit (both) | Lightweight; Claude may auto-invoke |

**Description values** (use verbatim as `description:` in frontmatter):

| Command | description |
|---|---|
| `add-task` | Create a structured, execution-ready task file in .docs/tasks/active/ |
| `create-adr` | Create an ADR Decision Group file in .docs/adr/ with one or more proposed decisions, table-only comparisons, and mermaid flowcharts |
| `finalize-adr` | Finalize a single proposed decision block; run E-C-A-D-R audit, supersession check, and flip status to accepted |
| `git-commit` | Stage all changed files and create a commit with an auto-generated message |
| `lint` | Get IDE diagnostics then fix issues one-by-one in verify cycles |
| `now` | Plan and delegate a task to subagents (max 3 concurrent) |
| `primer` | Refresh codebase context via Serena memories |
| `project-readme` | Generate or update a portfolio-ready project README |
| `research` | Deep research on a topic using codebase analysis, library docs, and web search |
| `serena-config` | Interactively configure Serena language servers in .serena/project.yml |
| `simplify` | Analyze files or directories to remove redundancy and simplify complexity |
| `tackle` | Execute an outlined task file step-by-step with subagent delegation |
| `trash-task` | Move a task and its related UAT files to trashed directories and update references |
| `uat-auth` | Authenticate a test user and export UAT_AUTH_TOKEN for UAT tools; auto-invoked by /uat-auto on auth-gated tests |
| `uat-auto` | Non-interactively run every test in a pending UAT file and auto-judge verdicts (headless, fail-closed) |
| `uat-generator` | Generate UAT tests in .docs/uat/pending/ mirroring task naming conventions |
| `uat-skip` | Skip UAT for a task, moving it to completed and archiving a skeleton UAT in skipped |
| `uat-walkthrough` | Walk through a pending UAT file test-by-test with the user |
| `update-docs` | Update all project documentation after implementation work |
| `update-task` | Assess and modify an existing task's scope or steps |

**For each command** (do all 20):

- [x] Read `.claude/commands/<name>.md` — note any existing frontmatter fields (`argument-hint`, `arguments`, etc.) to preserve
- [x] Create directory `.claude/skills/<name>/`
- [x] Write `.claude/skills/<name>/SKILL.md` — frontmatter from the tables above (merging any preserved fields), then the full body of the original `.md` stripped of its old frontmatter block

The 20 commands to process:
- [x] `add-task`
- [x] `create-adr`
- [x] `finalize-adr`
- [x] `git-commit`
- [x] `lint`
- [x] `now`
- [x] `primer`
- [x] `project-readme`
- [x] `research`
- [x] `serena-config`
- [x] `simplify`
- [x] `tackle`
- [x] `trash-task`
- [x] `uat-auth`
- [x] `uat-auto`
- [x] `uat-generator`
- [x] `uat-skip`
- [x] `uat-walkthrough`
- [x] `update-docs`
- [x] `update-task`

### 2. Delete `.claude/commands/`  <!-- agent: general-purpose -->

- [x] Delete all 20 files in `.claude/commands/` and the directory itself
  - Use `git rm -r .claude/commands/` so the deletion is tracked

### 3. Update `sync-docs-scaffold.sh`  <!-- agent: general-purpose -->

Add `.claude/skills/` syncing immediately after the existing `.docs/` blocks. The script currently handles only `.docs/`; it should now also scaffold `.claude/skills/` so both setup and update flows get the skills directory.

- [x] Open `sync-docs-scaffold.sh`
- [x] Add `mkdir -p "$PROJECT_DIR/.claude/skills"` near the top with the other `mkdir -p` calls
- [x] Append a new rsync block at the end of the file (before the final echo):
  ```bash
  # Sync .claude/skills/ (all skill directories and SKILL.md files)
  rsync -av "$TEMPLATE_DIR/.claude/skills/" "$PROJECT_DIR/.claude/skills/"
  ```
- [x] Update the final echo from `.docs/ scaffold synced.` to `.docs/ scaffold and .claude/skills/ synced.`

### 4. Update `update-project.sh`  <!-- agent: general-purpose -->

Remove the explicit `.claude/commands/` sync block (now handled by `sync-docs-scaffold.sh`).

- [x] Open `update-project.sh`
- [x] Delete the `# 1. Sync .claude/commands/` block (lines 25–29: the echo, mkdir, rsync, and blank line)
- [x] Update the `# 2. Sync .docs/` comment to `# 1. Sync .claude/skills/ and .docs/` and update its echo accordingly
- [x] Update the `# 3. Bootstrap Serena` comment to `# 2. Bootstrap Serena`
- [x] The final `echo "Update complete!"` block numbering in comments only needs the above renumbering — no logic changes

### 5. Update `package.json` `files` field  <!-- agent: general-purpose -->

- [x] Open `package.json`
- [x] Replace `".claude/commands/"` with `".claude/skills/"`
- [x] Add `"sync-docs-scaffold.sh"` to the `files` array (it is called by both setup and update scripts but was missing)
- [x] Add `"bootstrap-serena.sh"` to the `files` array (same — called by setup and update but was missing)
  - Insert these after `"update-project.sh"` to keep the scripts grouped

### 6. Update documentation and memories  <!-- agent: general-purpose -->

For each file below, replace all occurrences of `.claude/commands/` with `.claude/skills/` and update any prose that says "commands" to say "skills" where it refers to the directory or command format.

- [x] `CLAUDE.md`
  - Line referencing `- `.claude/commands/` — All custom slash command definitions`: update path and description to reflect skills dir
  - Line referencing `update-project.sh` description: update "sync `.claude/commands/`" → "sync `.claude/skills/`"
  - Custom Commands table: update description column entries that link to `.claude/commands/` paths
- [x] `README.md`
  - The paragraph mentioning `.claude/commands/` and "20 markdown-defined slash commands": update path and terminology
- [x] `basic-project-setup.md`
  - Any mention of `.claude/commands/` or the copy step: update path
- [x] `.serena/memories/project/overview.md`
  - Line: `- `.claude/commands/` — Custom slash commands (20 total)`: update to `.claude/skills/`
- [x] `.docs/adr/README.md`
  - Lines referencing `../../.claude/commands/create-adr.md` and `../../.claude/commands/finalize-adr.md`: update to `../../.claude/skills/create-adr/SKILL.md` and `../../.claude/skills/finalize-adr/SKILL.md`
- [x] `bin/cli.js`
  - The error message `update  Sync .claude/commands/ and .docs/ into the current project`: update to `.claude/skills/`

### 7. Update active task files and pending UAT  <!-- agent: general-purpose -->

Replace `.claude/commands/<name>.md` path references with `.claude/skills/<name>/SKILL.md` throughout all active task files and pending UAT files. Do NOT rewrite content — path substitution only.

Files to update:
- [x] `.docs/tasks/active/003-sync-docs-scaffold.md` — search for `.claude/commands/` references
- [x] `.docs/tasks/active/004-harden-uat-auth-command.md` — many references to `.claude/commands/uat-auth.md`; each becomes `.claude/skills/uat-auth/SKILL.md`
- [x] `.docs/tasks/active/005-command-anti-patterns.md` — references to `.claude/commands/tackle.md` and `.claude/commands/uat-generator.md`
- [x] `.docs/uat/pending/005-command-anti-patterns.uat.md` — references to `.claude/commands/tackle.md` and `.claude/commands/uat-generator.md`

For each file: use `mcp__serena__search_for_pattern` to confirm references exist, then use the `Edit` tool to replace each occurrence (one `Edit` call per occurrence).

### 8. Verification  <!-- agent: general-purpose -->

- [x] Confirm `.claude/skills/` exists with exactly 20 subdirectories, each containing `SKILL.md`
  - Use `mcp__serena__list_dir(relative_path=".claude/skills", recursive=true)`
- [x] Confirm `.claude/commands/` no longer exists
  - Use `mcp__serena__find_file(file_mask="*.md", relative_path=".claude/commands")` — should return empty
- [x] Confirm no remaining `.claude/commands/` references anywhere in the repo
  - Use `mcp__serena__search_for_pattern(substring_pattern=".claude/commands", relative_path=".")`
  - Expected: zero matches (6 stale body refs in SKILL.md files fixed post-check; remaining refs are in 006 task file itself and historical task/README prose — acceptable)
- [x] Confirm each SKILL.md has the correct `model:` value
  - Spot-check: `research`, `tackle`, `primer` — read each SKILL.md and verify frontmatter
- [x] Confirm `sync-docs-scaffold.sh` contains the new `.claude/skills/` rsync block
- [x] Confirm `update-project.sh` no longer contains a `commands` block
- [x] Confirm `package.json` `files` includes `.claude/skills/`, `sync-docs-scaffold.sh`, and `bootstrap-serena.sh` — and does NOT include `.claude/commands/`
