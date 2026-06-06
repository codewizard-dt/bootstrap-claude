# 008 — Rename Skills to Noun-First, Action-Second

## Objective

Rename 21 slash commands from action-first/inconsistent names (`/create-prd`, `/triage-bug`, `/add-task`, `/create-roadmap`) to a uniform **noun-first, action-second** kebab-flat pattern (`/prd-create`, `/bug-triage`, `/task-add`, `/roadmap-create`) and sweep every cross-reference in the repo to match.

## Approach

Hard cutover — rename each skill's folder under `.claude/skills/`, flip its `name:` frontmatter, then sweep every cross-reference (other SKILL.md files, all `.docs/*/README.md`, `CLAUDE.md`, Serena memories, root markdown). No aliases, no deprecation grace period. The rename map is fixed (table below); 17 verb-only or already-prefixed skills are explicitly out of scope.

## Prerequisites

- [ ] Roadmap doc-class wiring complete (task 008 builds on the roadmap auto-checkoff that landed in /tackle, /uat, /uat-auto, /uat-auto-plus, /uat-skip)
- [ ] No in-flight branches mid-rename — coordinate so this lands atomically

---

## Rename Map (authoritative)

This table is the single source of truth for the rename. Every step below references it.

| # | Old slash command | Old skill folder | New slash command | New skill folder | New `name:` frontmatter |
|---|-------------------|------------------|-------------------|------------------|-------------------------|
| 1 | `/create-prd` | `.claude/skills/create-prd/` | `/prd-create` | `.claude/skills/prd-create/` | `prd-create` |
| 2 | `/finalize-prd` | `.claude/skills/finalize-prd/` | `/prd-finalize` | `.claude/skills/prd-finalize/` | `prd-finalize` |
| 3 | `/prd-to-decisions` | `.claude/skills/prd-to-decisions/` | `/prd-extract-decisions` | `.claude/skills/prd-extract-decisions/` | `prd-extract-decisions` |
| 4 | `/update-prd` | `.claude/skills/update-prd/` | `/prd-update` | `.claude/skills/prd-update/` | `prd-update` |
| 5 | `/trash-prd` | `.claude/skills/trash-prd/` | `/prd-trash` | `.claude/skills/prd-trash/` | `prd-trash` |
| 6 | `/create-adr` | `.claude/skills/create-adr/` | `/adr-create` | `.claude/skills/adr-create/` | `adr-create` |
| 7 | `/finalize-adr` | `.claude/skills/finalize-adr/` | `/adr-finalize` | `.claude/skills/adr-finalize/` | `adr-finalize` |
| 8 | `/walkthrough-adr` | `.claude/skills/walkthrough-adr/` | `/adr-walkthrough` | `.claude/skills/adr-walkthrough/` | `adr-walkthrough` |
| 9 | `/add-task` | `.claude/skills/add-task/` | `/task-add` | `.claude/skills/task-add/` | `task-add` |
| 10 | `/update-task` | `.claude/skills/update-task/` | `/task-update` | `.claude/skills/task-update/` | `task-update` |
| 11 | `/trash-task` | `.claude/skills/trash-task/` | `/task-trash` | `.claude/skills/task-trash/` | `task-trash` |
| 12 | `/file-bug` | `.claude/skills/file-bug/` | `/bug-file` | `.claude/skills/bug-file/` | `bug-file` |
| 13 | `/triage-bug` | `.claude/skills/triage-bug/` | `/bug-triage` | `.claude/skills/bug-triage/` | `bug-triage` |
| 14 | `/close-bug` | `.claude/skills/close-bug/` | `/bug-close` | `.claude/skills/bug-close/` | `bug-close` |
| 15 | `/uat` | `.claude/skills/uat/` | `/uat-walk` | `.claude/skills/uat-walk/` | `uat-walk` |
| 16 | `/uat-generator` | `.claude/skills/uat-generator/` | `/uat-generate` | `.claude/skills/uat-generate/` | `uat-generate` |
| 17 | `/create-roadmap` | `.claude/skills/create-roadmap/` | `/roadmap-create` | `.claude/skills/roadmap-create/` | `roadmap-create` |
| 18 | `/add-to-roadmap` | `.claude/skills/add-to-roadmap/` | `/roadmap-add` | `.claude/skills/roadmap-add/` | `roadmap-add` |
| 19 | `/next-step` | `.claude/skills/next-step/` | `/roadmap-next` | `.claude/skills/roadmap-next/` | `roadmap-next` |

**Explicitly NOT renamed** (out of scope — do not touch their folders, frontmatter, or any reference to them):

`/primer`, `/now`, `/tackle`, `/research`, `/lint`, `/typecheck`, `/debug-logs`, `/simplify`, `/git-commit`, `/update-docs`, `/project-readme`, `/marp-slideshow`, `/mermaid-flowchart`, `/serena-config`, `/uat-auto`, `/uat-auto-plus`, `/uat-skip`.

---

## Steps

### 1. Pre-flight inventory  <!-- agent: Explore -->

- [x] Use `mcp__serena__list_dir` on `.claude/skills/` (non-recursive) to enumerate the current 32 skill folders. Confirm each of the 19 old folder names in the rename map exists on disk.
  - If any old folder is missing, STOP and report which ones — the rename map is stale.
- [x] Use `mcp__serena__list_dir` on `.claude/skills/` again after renaming would conflict — i.e. confirm none of the 19 new folder names already exists.
  - If any new folder name already exists, STOP and report the conflict.
- [x] For each of the 17 "explicitly NOT renamed" skills, confirm the folder exists and record the path. These are guardrails for step 9's straggler search. <!-- Completed: 2026-05-12 -->

### 2. Rename skill folders  <!-- agent: general-purpose -->

For each row in the rename map (in order, 19 rows):

- [x] `git mv .claude/skills/<old>/ .claude/skills/<new>/` — use `git mv` (NOT `mv`) so git tracks the rename and preserves blame history. Run via the Bash tool.
- [x] After all 19 renames, verify with `mcp__serena__list_dir` that every new folder exists and no old folder remains. <!-- Completed: 2026-05-12 -->

### 3. Update each renamed skill's `name:` frontmatter  <!-- agent: general-purpose -->

For each of the 19 renamed skills (in order):

- [x] Read `.claude/skills/<new>/SKILL.md` (target frontmatter line: `name: <old-name>`).
- [x] Use `Edit` (NEVER `sed`) to flip `name: <old-name>` → `name: <new-name>`. The old name appears exactly once per file in the frontmatter; replace it.
- [x] If the skill's `description:` or body text references its own old slash command (e.g. `/Users/davidtaylor/Repositories/basic-project-setup/.claude/skills/create-prd/SKILL.md` calls itself `/create-prd` in body text), flip those too. <!-- Completed: 2026-05-12 -->

### 4. Update inter-skill references inside SKILL.md files  <!-- agent: general-purpose -->

Most renamed skills reference *other* renamed skills (e.g. `/task-add` mentions `/tackle`, `/uat-walk`, `/roadmap-add`; `/prd-create` mentions `/prd-finalize`, `/adr-create`). After step 3, sweep every SKILL.md in `.claude/skills/` (all ~32 skills, not just the 19 renamed) for stale old-name references.

- [x] For each of the 19 old slash commands in the rename map, use `mcp__serena__search_for_pattern` across `.claude/skills/` looking for the literal old token (e.g. `/create-prd`, `/add-task`, `/uat-generator`). Be careful with substring overlaps:
  - `/uat` (short) is a substring of `/uat-auto`, `/uat-auto-plus`, `/uat-skip`, `/uat-generator`, `/uat-walk`, `/uat-generate`. Only replace `/uat` when it appears as a standalone token (followed by whitespace, end-of-line, backtick, parenthesis, period, comma, or hyphen-followed-by-non-letter). When in doubt, inspect the line.
  - `/add-task` is NOT a substring of any other command, safe to literal-replace.
  - `/create-prd` is NOT a substring of any other command, safe to literal-replace.
- [x] For each match, use `Edit` to replace the old slash command with the new one. Inspect the surrounding context — sometimes the reference is in a code example (still rename) and sometimes in a "this command moved to X" note (also rename).
- [x] Do not touch references to the 17 NOT-renamed skills. <!-- Completed: 2026-05-12 -->

### 5. Update CLAUDE.md  <!-- agent: general-purpose -->

- [x] Read `/Users/davidtaylor/Repositories/basic-project-setup/CLAUDE.md`.
- [x] In the `## Custom Commands` table, replace every row whose `Command` cell references an old slash command with its new name. Verify all 19 renamed entries are updated. Preserve the row order or re-order alphabetically by new name — pick one and be consistent.
- [x] If any text in the body of CLAUDE.md (outside the table) references an old command, update those too.
- [x] Use `Edit` only. <!-- Completed: 2026-05-12 -->

### 6. Update `.docs/*/README.md` files  <!-- agent: general-purpose -->

Each lifecycle README references its associated commands. Update them all.

- [x] `.docs/prd/README.md` — table at top references all 5 PRD commands; body has cross-links and a mermaid diagram. Update all old→new.
- [x] `.docs/adr/README.md` — references `/create-adr`, `/finalize-adr`, `/walkthrough-adr`, `/add-task --adr`, possibly mermaid.
- [x] `.docs/tasks/README.md` — references `/add-task`, `/tackle`, `/uat`, `/uat-skip`, `/trash-task`. Update old→new only for the 19 renamed ones; leave `/tackle` and `/uat-skip` alone.
- [x] `.docs/tasks/active/README.md` — references `/tackle` (NOT renamed, leave alone), possibly other commands.
- [x] `.docs/uat/README.md` if it exists — references `/uat`, `/uat-generator`, etc. Update old→new for the 2 renamed UAT commands.
- [x] `.docs/bugs/README.md` — references `/file-bug`, `/triage-bug`, `/close-bug`. Update all three.
- [x] `.docs/bugs/open/README.md` — likely references the bug commands.
- [x] `.docs/roadmaps/README.md` — references `/create-roadmap`, `/add-to-roadmap`, `/next-step`, `/add-task --roadmap`, `/tackle`. Update old→new for the 4 renamed.
- [x] `.docs/guides/mcp-tools.md` — may reference commands.
- [x] `.docs/guides/command-anti-patterns.md` — references `/tackle`, possibly others.
- [x] `.docs/guides/bug-lifecycle.md` — references bug commands.
- [x] `.docs/guides/task-lifecycle.md` — references task commands.
- [x] Use `mcp__serena__search_for_pattern` first to enumerate matches across `.docs/`, then `Read` + `Edit` per file. <!-- Completed: 2026-05-12 -->

### 7. Update Serena memories  <!-- agent: general-purpose -->

- [x] `project/overview` — long memory with a full Custom Skills section. Replace all 19 old slash commands with their new names. Also bump any skill-count references (e.g. "Custom Skills (29)" should be re-counted — it is now 32: 19 renamed + 17 unchanged - actually the count doesn't change because we're renaming, not adding, but verify).
- [x] `workflow/prd-layer` — references all 5 PRD commands + `/create-adr` + `/finalize-adr` + `/add-task --prd` + a mermaid diagram. Update all old→new.
- [x] `architecture/adr-conventions` — references ADR commands. Update.
- [x] `skills/format-and-model-selection` — likely references skills by name. Update.
- [x] `tech/serena_tools_reference` — probably unaffected, but search for slash-command tokens to be sure.
- [x] Use `mcp__serena__edit_memory` (regex or literal mode). NEVER `Write` to a memory. <!-- Completed: 2026-05-12 -->

### 8. Update root-level docs and config  <!-- agent: general-purpose -->

- [x] `basic-project-setup.md` — search for command references and update.
- [x] Any root `README.md` if it exists.
- [x] `setup-project.sh`, `update-project.sh`, `sync-docs-scaffold.sh`, `bootstrap-serena.sh` — these are shell scripts and unlikely to reference slash commands by name, but `grep` to confirm. If any do, update.
- [x] `bin/cli.js`, `package.json` — same: unlikely but verify.
- [x] Use the `Grep` tool (NOT `bash grep`) to scan the repo root excluding `.git/`, `node_modules/`, `.docs/`, `.claude/`, `.serena/` — those have already been swept in prior steps. <!-- Completed: 2026-05-12 -->

### 9. Straggler verification  <!-- agent: Explore -->

Final pass — no old command should appear ANYWHERE in the repo.

- [x] For each of the 19 old slash commands, use `mcp__serena__search_for_pattern` to grep the entire repo (no path filter, no glob restriction). Expected result: zero hits per command.
  - Exception: if a `.docs/tasks/active/008-rename-skills-noun-first.md` (this very file) contains the old commands inside the Rename Map table — that's expected and fine. Any other hit is a miss.
  - Exception: `.serena/memories/` is the memory store; old-command hits there mean step 7 missed something — go back and fix.
- [x] Report any straggler hits with file path + line number for manual review. Do not auto-fix from this step — the task is done only when this list is empty (modulo the in-file exception). <!-- Completed: 2026-05-12; stragglers in memories fixed; stale settings.local.json mv-permissions removed -->

### 10. Sanity-check the renamed skills work  <!-- agent: general-purpose -->

- [x] For 3 spot-check skills (`/prd-create`, `/task-add`, `/roadmap-create`), `Read` the SKILL.md to confirm:
  - `name:` matches the folder name
  - `argument-hint:` makes sense
  - No leftover references to the skill's old name in its own body
  - References to OTHER skills use new names
- [x] List `.claude/skills/` and confirm exactly the expected set of folders: 17 unchanged + 19 renamed = 36 total (no leftover old folders, no surprise extras). <!-- Completed: 2026-05-12; all 3 spot-checks passed, 36 folders confirmed -->

### 11. Update Custom Commands count in CLAUDE.md and memory  <!-- agent: general-purpose -->

- [x] Total skill count remains the same (~32), but verify the "Custom Skills (NN)" header in `project/overview` Serena memory is accurate after the rename. If the count is stale, fix it.
- [x] If CLAUDE.md's Command table has a sub-header or count, verify it matches reality. <!-- Completed: 2026-05-12; count updated to 36 in project/overview memory -->

### 12. Add orphan-skill cleanup prompt to `update-project.sh` (and/or `sync-docs-scaffold.sh`)  <!-- agent: general-purpose -->

After this rename lands, any **target project** that previously ran `setup-project.sh` will still have the 19 OLD skill folders (`create-prd/`, `add-task/`, `triage-bug/`, etc.) sitting alongside the newly-rsynced NEW folders (`prd-create/`, `task-add/`, `bug-triage/`, etc.). `update-project.sh` must detect those orphans and offer to delete them.

- [x] Decide which script owns the prompt. Recommended: add the logic to `update-project.sh` (NOT `setup-project.sh` — on a fresh install there are no orphans). `sync-docs-scaffold.sh` is unconditional and should stay non-interactive, so leave it alone.
- [x] Define the **canonical orphan list** as a bash array near the top of `update-project.sh`:
  ```bash
  ORPHAN_SKILLS=(
    create-prd finalize-prd prd-to-decisions update-prd trash-prd
    create-adr finalize-adr walkthrough-adr
    add-task update-task trash-task
    file-bug triage-bug close-bug
    uat uat-generator
    create-roadmap add-to-roadmap next-step
  )
  ```
  This is the same 19 names from the rename map. Comment the array with a link back to this task file for the rationale.
- [x] After `sync-docs-scaffold.sh` runs, iterate the array and check which directories still exist under `$PROJECT_DIR/.claude/skills/`. Build a list of those that do.
- [x] If the list is empty, silently continue. If non-empty:
  - Print the list of orphan folder paths under a clear header (e.g. `Orphan skill folders detected from the noun-first rename:`).
  - Prompt the user: `Delete these N folders? [y/N]:` (read from stdin with `read -r -p`).
  - On `y`/`Y`, `rm -rf` each orphan folder and report `Removed.`. On any other answer (including empty/`n`/`N`/EOF), skip deletion and print a one-line instruction telling the user how to remove them later (e.g. `rm -rf .claude/skills/{create-prd,finalize-prd,...}`).
  - **Default to NO** so a `yes |` or piped invocation does not silently delete files.
- [x] If the script is invoked non-interactively (no TTY on stdin), default to NO and just print the orphan list as a warning. Detect with `[ -t 0 ]`.
- [x] Test against a scratch target directory: create a mock `.claude/skills/create-prd/` and `.claude/skills/add-task/`, run `update-project.sh <scratch>`, confirm the prompt fires and the answer is honored.
- [x] Update CLAUDE.md's `## Key Files` entry for `update-project.sh` to mention the orphan-cleanup step. <!-- Completed: 2026-05-12 -->

### 13. Verification  <!-- agent: general-purpose -->

- [x] Run `git status` to confirm only expected files changed.
- [x] Spot-check 3 cross-reference files (`CLAUDE.md`, `.docs/prd/README.md`, `.docs/roadmaps/README.md`) by `Read`-ing them and grepping for old command names — expect zero hits.
- [x] Confirm `.claude/skills/` directory listing shows exactly 36 entries: 17 unchanged + 19 renamed.
- [x] Confirm each renamed skill's `name:` frontmatter matches its folder name (loop through the 19 new folders, `Read` each SKILL.md, verify).
- [x] Confirm no old slash command appears anywhere in the repo except inside this task file's Rename Map table. <!-- Completed: 2026-05-12; all checks pass -->

---

## Notes

- **No aliases**: this is a hard cutover. Anyone with muscle memory will get "command not found" on the old names. Worth a one-line note in the next release/commit.
- **Cross-references in `.serena/memories/`**: these are stored on the local machine, not in the repo. Step 7 must use `mcp__serena__edit_memory` and not Write to a markdown file.
- **`/uat` is a substring trap**: when sweeping, `/uat` is a substring of every other UAT command. Use word-boundary regex or inspect each match to avoid corrupting `/uat-auto`, `/uat-auto-plus`, `/uat-skip`.
- **`/add-task --adr` and similar flag invocations**: rename to `/task-add --adr`. Same for `/add-task --roadmap` → `/task-add --roadmap`.
- **Mermaid diagrams in READMEs**: contain slash commands inside flowchart node labels. Sweep these too.
- **Documentation count drift**: the `project/overview` Serena memory says "Custom Skills (29)" but reality is now 32 (after the roadmap additions). Step 11 fixes it.

---

**UAT**: [`.docs/uat/skipped/008-rename-skills-noun-first.uat.md`](../../uat/skipped/008-rename-skills-noun-first.uat.md) *(skipped)*
