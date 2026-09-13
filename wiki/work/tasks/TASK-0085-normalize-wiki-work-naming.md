---
id: TASK-0085
aliases: [TASK-0085]
title: "Fix bug-file/roadmap-create filename bugs and standardize wiki/work/ IDs at 4 digits going forward"
status: pending-uat
created: 2026-09-13
updated: 2026-09-13
depends_on: []
blocks: []
parallel_safe_with: []
uat: "[[UAT-0085]]"
tags: [wiki-work, skills, naming]
---

# TASK-0085 — Fix bug-file/roadmap-create filename bugs and standardize wiki/work/ IDs at 4 digits going forward

## Objective

Fix the two confirmed naming defects found in `raw/research/wiki-work-family-naming/index.md` (`bug-file` and `roadmap-create` write filenames that contradict their own `lifecycle.md`, sibling skills, and every file on disk), and — per explicit user decision — standardize `tasks`, `uat`, `requirements`, and `roadmaps` on 4-digit zero-padded IDs going forward, matching `bugs`/`decisions` which are already 4-digit. This is a **forward-only** convention change: no existing file is renamed or renumbered. `TASK-0001`..`TASK-0084` and their siblings keep their current 3-digit names permanently; only IDs assigned *after* this task lands use 4 digits. `wiki/log.md` history is never edited — a single new entry documents the convention change going forward instead. This task itself is filed as `TASK-0085`, the first ID under the new convention.

Full research, root-cause dating (both bugs predate the 2026-06-11 wiki2 migration), and external prior-art validation: `raw/research/wiki-work-family-naming/{index,sources}.md`, `wiki/knowledge/concepts/wiki-work-filename-convention.md`.

**Shared-file note (not a hard dependency):** `TASK-0081` (in-progress) also edits `CLAUDE.md`, for an unrelated section (removing deploy/CI doc references). This task's `CLAUDE.md` edits are confined to the wiki-schema family-ID bullets (Step 9 below) and should not overlap textually, but whoever runs `/tackle` on this task should re-read `CLAUDE.md` fresh immediately before editing it, in case `TASK-0081` has landed first.

## Approach

Two independent fix classes:

1. **Structural/logic fixes** — exact, hand-specified edits to the skills whose filename-writing or number-scanning behavior is actually wrong or now needs to be width-agnostic (bug-file, roadmap-create, roadmap-next, task-add, req-create, decision-create).
2. **Mechanical token relabeling** — every doc that states the ID scheme using the literal placeholder tokens `TASK-NNN`, `UAT-NNN`, `REQ-NNN`, `ROADMAP-NNN` (never `DEC-NNNN`/`BUG-NNNN`, which are already correct and unchanged) gets those tokens swapped to their 4-digit form (`TASK-NNNN`, `UAT-NNNN`, `REQ-NNNN`, `ROADMAP-NNNN`). Do this with `mcp__serena__replace_in_files` (dry-run first) rather than by hand, scoped to the exact files listed in Step 10 — **never** run it as an unscoped repository-wide sweep: `raw/**` is immutable and must never be touched, and the real data files under `wiki/work/{tasks,uat,requirements,roadmaps}/*.md` contain concrete IDs like `TASK-074` (no literal `NNN` substring), not placeholder tokens, so they are naturally unaffected by a literal-string replace but are explicitly excluded from the tool's file-list anyway as a safety margin.

**Critical correctness point for width-agnostic scanning** (Steps 2 and 4 below): once 3-digit and 4-digit filenames coexist in the same family, a number-scan that assumes fixed width would either miss existing high numbers (causing an ID collision, e.g. writing `ROADMAP-0001` when `ROADMAP-001` already exists and both represent the number 1) or fail to find new 4-digit files on a later run. The fix is to extract the **numeric value** from `PREFIX-<digits>-*.md` regardless of how many digits are present (ignore leading zeros when comparing), take the max across every match in both the active and `archive/` directories, add 1, and zero-pad **the result** to 4 digits.

**Verification-regex note**: after relabeling, `TASK-NNNN` contains `TASK-NNN` as a literal substring, so a plain-substring search for `TASK-NNN` cannot distinguish "still needs fixing" from "already fixed." Use the negative-lookahead pattern `TASK-NNN(?!N)` (and the `UAT-`/`REQ-`/`ROADMAP-` equivalents) for both the initial find (Step 10) and the final verification (Step 11).

## Steps

### 1. Fix `bug-file`'s filename bug and add the missing re-verify race guard  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

File: `lib/skills/bug-file/SKILL.md`

- [x] Step 5 ("Present and Confirm"): change `Resolved filename: \`wiki/work/bugs/NNNN-<slug>.md\`` → `Resolved filename: \`wiki/work/bugs/BUG-NNNN-<slug>.md\``.
- [x] Step 6 ("Write the Bug File"): change `Use \`Write\` to create \`wiki/work/bugs/NNNN-<slug>.md\`` → `Use \`Write\` to create \`wiki/work/bugs/BUG-NNNN-<slug>.md\``.
- [x] Step 8 ("Report Completion"): change `Created file: \`wiki/work/bugs/NNNN-<slug>.md\`` → `Created file: \`wiki/work/bugs/BUG-NNNN-<slug>.md\``.
- [x] Insert a new sub-step **"Step 5a: Re-verify next bug number — IMMEDIATELY before writing"** between the existing Step 5 (Present and Confirm) and Step 6 (Write the Bug File), mirroring `task-add`'s Step 7a / `roadmap-create`'s Step 5 pattern exactly:
  ```
  ### Step 5a: Re-verify next bug number — IMMEDIATELY before writing

  Re-run the scan from Step 4. If the number planned in Step 4/5 is now taken, silently bump to the new next-available number. **Never call `Write` before completing this re-scan.**
  ```
- [x] No width change here — bugs stay 4-digit, unchanged; this file only had the filename-prefix bug, not a width problem.

### 2. Fix `roadmap-create`'s filename bug and switch to 4-digit going forward  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

File: `lib/skills/roadmap-create/SKILL.md`

- [x] Step 2 ("Locate the roadmap directory and assign a number"): change `Roadmaps live at \`wiki/work/roadmaps/NNN-slug.md\`. Numbers are 3-digit zero-padded.` → `Roadmaps live at \`wiki/work/roadmaps/ROADMAP-NNNN-slug.md\`. Numbers are 4-digit zero-padded.`
  - Update the numbered sub-steps: "Collect every `NNN-` prefix from **both** directories" → "Collect the numeric value from every `ROADMAP-<digits>-` prefix across **both** directories, regardless of digit count (existing files are 3-digit; new ones are 4-digit) — ignore leading zeros when comparing."
  - "Take `max + 1`, zero-pad to 3 digits. The first roadmap is `001`." → "Take `max + 1`, zero-pad the result to 4 digits. In a brand-new project the first roadmap is `ROADMAP-0001`; in this repo, continue from the current max (do not restart at 1)."
  - Update the slug examples: `"Ship the billing portal" → \`001-ship-billing-portal.md\`` → `"Ship the billing portal" → \`ROADMAP-0001-ship-billing-portal.md\``; `"Migrate to Postgres 17" → \`004-migrate-postgres-17.md\`` → `"Migrate to Postgres 17" → \`ROADMAP-0004-migrate-postgres-17.md\``.
- [x] Step 5 ("Re-verify the next available number — IMMEDIATELY before writing"): apply the same width-agnostic scan wording as Step 2 above (numeric value regardless of digit count, ignore leading zeros, zero-pad the result to 4 digits).
- [x] Step 6 ("Write the roadmap file"): change `Use \`Write\` to create \`wiki/work/roadmaps/NNN-slug.md\`` → `Use \`Write\` to create \`wiki/work/roadmaps/ROADMAP-NNNN-slug.md\``.
- [x] Step 7 ("Update the roadmap index"): change the entry-format line `\`- [ROADMAP-NNN — <title>](NNN-slug.md) — <one-line summary> · 0/<total> items checked\`` → `\`- [ROADMAP-NNNN — <title>](ROADMAP-NNNN-slug.md) — <one-line summary> · 0/<total> items checked\``.
- [x] Step 9 ("Report completion"): change the `File path` row `\`wiki/work/roadmaps/NNN-slug.md\`` → `\`wiki/work/roadmaps/ROADMAP-NNNN-slug.md\``, and the `Suggested next steps` row's `/roadmap-next wiki/work/roadmaps/NNN-slug.md` → `/roadmap-next wiki/work/roadmaps/ROADMAP-NNNN-slug.md`.

### 3. Fix `roadmap-next`'s stale bare-filename example  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

File: `lib/skills/roadmap-next/SKILL.md` (around line 42)

- [x] Replace the fallback ID-extraction example `the \`roadmap_id\` (\`- **ID**: ROADMAP-NNN\` front matter or filename prefix, e.g. \`003-billing.md\` → \`ROADMAP-003\`)` with a version reflecting the real, always-prefixed filename and mixed-width reality, e.g.: `the \`roadmap_id\` (\`- **ID**: ROADMAP-NNNN\` front matter — always read this first — or, as a fallback, the filename prefix, e.g. \`ROADMAP-0013-billing.md\` → \`ROADMAP-0013\`, or a legacy 3-digit file \`ROADMAP-012-billing.md\` → \`ROADMAP-012\`)`.

### 4. Fix `task-add`'s width and make its number-scan width-agnostic  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

File: `lib/skills/task-add/SKILL.md`

- [x] Step 4 ("Determine the next task number"): change `Take \`max + 1\`, zero-pad to 3 digits. The first task is \`TASK-001\`.` → `Take \`max + 1\`, zero-pad the result to 4 digits. In a brand-new project the first task is \`TASK-0001\`; in this repo, continue from the current max (do not restart at 1).` Also add: "Collect the numeric value from every `TASK-<digits>-` prefix regardless of digit count — existing tasks are 3-digit, new ones are 4-digit — ignoring leading zeros when comparing."
- [x] Step 7a ("Re-verify next task number"): apply the same width-agnostic wording (numeric value regardless of digit count, zero-pad the result to 4 digits).
- [x] Leave the `TASK-NNN` placeholder tokens used elsewhere in this file (frontmatter template, body template, argument-hint, index-entry format, decision/roadmap cross-references) for the mechanical sweep in Step 10 — do not hand-edit them here.

### 5. Fix `req-create`'s width, its Row/columns wording mismatch, and add the missing race guard  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

File: `lib/skills/req-create/SKILL.md`

- [x] Step 2 ("Locate directory, assign number"): change `Requirements live at \`wiki/work/requirements/REQ-NNN-slug.md\` (3-digit zero-padded).` → `Requirements live at \`wiki/work/requirements/REQ-NNNN-slug.md\` (4-digit zero-padded).` And `highest prefix across both + 1 (first is \`REQ-001\`)` → `highest prefix across both + 1 (first is \`REQ-0001\`)`. Update the slug example `"Self-serve billing portal" → \`REQ-004-self-serve-billing-portal.md\`` → `"Self-serve billing portal" → \`REQ-0004-self-serve-billing-portal.md\``. (No existing requirement files exist yet, so no width-agnostic legacy-scan logic is needed here — this is a clean cutover.)
- [x] Step 7 ("Update indexes + log"): the current text describes the index update as "Row/columns: `ID` = ... · `Title` · `Status` = ... · `Created` = ... · `Owner` · `Linked Decisions` = `—` · `Linked Tasks` = `—`", which reads as a table but `wiki/work/requirements/index.md`'s own documented entry format is a flat bullet line (`- [REQ-NNN — Title](REQ-NNN-slug.md) — one-line summary · status`), matching every other family. Rewrite Step 7's index-update instruction to state the flat-bullet entry format explicitly, e.g.: `Append (or replace the placeholder row) in \`wiki/work/requirements/index.md\` using the format documented at the top of that file: \`- [REQ-NNNN — Title](REQ-NNNN-slug.md) — one-line summary · status\`, in ascending REQ order.`
- [x] Insert a new **"Step 5a: Re-verify next requirement number — IMMEDIATELY before writing"** between the existing Step 5 (Preview and confirm) and Step 6 (Write the file), same pattern as Step 1 above:
  ```
  ### Step 5a: Re-verify next requirement number — IMMEDIATELY before writing

  Re-run the scan from Step 2. If the number planned earlier is now taken, silently bump to the new next-available number. **Never call `Write` before completing this re-scan.**
  ```
  Note: Step 6's own file-write example (frontmatter/heading showing `REQ-NNN`) and other `REQ-NNN` occurrences elsewhere in the file were deliberately left untouched here — the mechanical sweep in Step 10 below covers them.

### 6. Add the missing race guard to `decision-create`  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

File: `lib/skills/decision-create/SKILL.md`

- [x] Inserted **"Step 4.5: Re-verify next decision number — IMMEDIATELY before writing"** at lines 80-82, immediately between Step 4 (Clarify with the user) and Step 5 (Generate the file):
  ```
  ## Step 4.5: Re-verify next decision number — IMMEDIATELY before writing

  Re-run the scan from Step 2 (`list_dir` on `wiki/work/decisions/` and `archive/`, highest 4-digit prefix + 1). If the number planned earlier is now taken, silently bump to the new next-available number. **Never call `Write` before completing this re-scan.**
  ```
- [x] No width change — decisions stay 4-digit, unchanged.

### 7. Update this repo's own family `lifecycle.md` docs to 4-digit  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

Edit each of these 4 lines (leave `wiki/work/bugs/lifecycle.md` and `wiki/work/decisions/lifecycle.md` untouched — already 4-digit):

- [x] `wiki/work/tasks/lifecycle.md:7`: `ID scheme: **TASK-NNN** (3-digit, zero-padded). Filename: \`TASK-NNN-slug.md\`. UAT test files mirror task naming (**UAT-NNN**) ...` → `ID scheme: **TASK-NNNN** (4-digit, zero-padded). Filename: \`TASK-NNNN-slug.md\`. UAT test files mirror task naming (**UAT-NNNN**) ...`
- [x] `wiki/work/uat/lifecycle.md:7`: `ID scheme: **UAT-NNN** (3-digit, zero-padded) — the number **mirrors the task it verifies** (\`UAT-014\` ↔ \`TASK-014\`). Filename: \`UAT-NNN-slug.md\`.` → `ID scheme: **UAT-NNNN** (4-digit, zero-padded) — the number **mirrors the task it verifies** (\`UAT-0085\` ↔ \`TASK-0085\`). Filename: \`UAT-NNNN-slug.md\`.` (Also note in the same file, one line, that legacy pairs created before this change stay 3-digit, e.g. `UAT-014` ↔ `TASK-014`, permanently.)
- [x] `wiki/work/requirements/lifecycle.md:7`: `ID scheme: **REQ-NNN** (3-digit, zero-padded, globally unique). Filename: \`REQ-NNN-slug.md\`.` → `ID scheme: **REQ-NNNN** (4-digit, zero-padded, globally unique). Filename: \`REQ-NNNN-slug.md\`.` (No legacy note added here — no existing requirement files exist, clean cutover.)
- [x] `wiki/work/roadmaps/lifecycle.md:7`: `... a **task link** (\`[TASK-NNN](../tasks/TASK-NNN-slug.md)\`) or an **inline** checkbox item. ID scheme: **ROADMAP-NNN** (3-digit, zero-padded). Filename: \`ROADMAP-NNN-slug.md\`.` → `... a **task link** (\`[TASK-NNNN](../tasks/TASK-NNNN-slug.md)\`) or an **inline** checkbox item. ID scheme: **ROADMAP-NNNN** (4-digit, zero-padded). Filename: \`ROADMAP-NNNN-slug.md\`.`
- [x] Added the forward-only legacy note to tasks/uat/roadmaps lifecycle.md (requirements skipped — clean cutover, no legacy files).

### 8. Mirror Step 7's edits into the template copies shipped to future projects  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

These are delivered to every new `bootstrap-claude` consumer project by `sync-wiki-scaffold.sh` — apply the identical 4 line-edits (plus the forward-only note, which can be omitted here since a fresh project has no legacy 3-digit files):

- [x] `lib/scripts/templates/wiki/work/tasks/lifecycle.md:7` — same edit as Step 7's task line.
- [x] `lib/scripts/templates/wiki/work/uat/lifecycle.md:7` — same edit as Step 7's UAT line (used the 4-digit example pair `UAT-0014` ↔ `TASK-0014`, since a fresh project has no legacy pairs).
- [x] `lib/scripts/templates/wiki/work/requirements/lifecycle.md:7` — same edit as Step 7's requirements line.
- [x] `lib/scripts/templates/wiki/work/roadmaps/lifecycle.md:7` — same edit as Step 7's roadmap line.

### 9. Update `CLAUDE.md`, `wiki/conventions.md`, and the `CLAUDE.md` template  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

- [x] `CLAUDE.md` — updated 11 lines across 4 locations (Wiki Schema bullets, Custom Commands `--roadmap` mention, Key Files lifecycle bullets, appended `## LLM Wiki` family list). `DEC-NNNN`/`BUG-NNNN` left untouched throughout; verified via regex sweep, no stale `-NNN` forms remain.
- [x] `wiki/conventions.md:24` (line shifted by 1 from prior edits): `REQ-NNN`/`ROADMAP-NNN`/`TASK-NNN`/`UAT-NNN` → 4-digit forms; `DEC-NNNN`/`BUG-NNNN` unchanged.
- [x] `lib/scripts/templates/CLAUDE-wiki.md` (lines 22,24,25,26) — same 4 bullet edits applied.
- [x] `lib/scripts/templates/wiki/conventions.md` — same edit applied.

### 10. Mechanical sweep: relabel every remaining literal placeholder token  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

- [x] Used `mcp__serena__search_for_pattern` with negative-lookahead regex `TASK-NNN(?!N)` / `UAT-NNN(?!N)` / `REQ-NNN(?!N)` / `ROADMAP-NNN(?!N)` restricted to `lib/skills` — found matches across 23 skill files.
- [x] Applied via `mcp__serena__replace_in_files` (regex mode, not literal — `ROADMAP-NNNN` already existed as a real token in some files post-Step-2/3, so literal substring replace would have double-mangled it; negative-lookahead regex avoided that). 218 occurrences relabeled across 31 files total (23 in `lib/skills/`, 4 `wiki/work/*/index.md`, 4 `lib/scripts/templates/wiki/work/*/index.md`).
- [x] Confirmed zero files under `raw/**` touched (git status check — only pre-existing unrelated `/research` untracked dirs); confirmed zero real work-item data files touched (`replace_in_files` calls scoped only to `lib/skills/` + `index.md` files, never a broader `wiki/work/**` sweep).
- [x] `wiki/work/*/index.md` + template counterparts' "Entry format" lines updated (9 occurrences each set).
- **Gap surfaced by this step, carried into Step 11**: the 8 `lifecycle.md` files (4 repo + 4 template) still contain un-migrated `TASK-NNN`/`UAT-NNN`/`REQ-NNN`/`ROADMAP-NNN` mentions in their frontmatter-schema **tables** (e.g. `| \`id\` | yes | \`TASK-NNN\` |`) beyond the single ID-scheme sentence fixed in Steps 7/8 — this sub-agent's scope was deliberately `lib/skills/` + `index.md` only, so it correctly left these for Step 11 rather than guessing at scope expansion.
- **Minor wording nit flagged, not fixed**: `lib/skills/task-add/SKILL.md:62` now reads slightly awkwardly ("Collect every `TASK-NNNN` prefix... Collect the numeric value from every `TASK-<digits>-` prefix regardless of digit count — existing tasks are 3-digit, new ones are 4-digit") — logic is correct, just a clarity polish opportunity, deferred to Step 11.

### 11. Verify: no remaining stale tokens, no fixed-width parsing code  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

- [x] Re-ran the 4 regexes across `lib/skills/`, `wiki/work/*/lifecycle.md`, `wiki/work/*/index.md`, `CLAUDE.md`, `wiki/conventions.md`: zero stale matches. Also fixed a gap this verification surfaced: all 8 `lifecycle.md` files' frontmatter-schema **tables** (e.g. `| \`id\` | yes | \`TASK-NNN\` |`) still had un-migrated rows beyond the single ID-scheme sentence fixed in Steps 7/8 — fixed across all 8 (4 repo + 4 template), leaving the intentional "legacy files keep 3-digit names" sentences untouched. Also polished a wording nit at `lib/skills/task-add/SKILL.md:62` ("Collect every `TASK-NNNN` prefix" → "Collect every `TASK-<digits>` prefix", removing a misleading implication). Two more stale template occurrences surfaced and fixed in a follow-up pass: `lib/scripts/templates/wiki/dashboard.html` (2 comment-example lines) and `lib/scripts/templates/wiki/index.md` (4 scaffold home-index bullets) — both confirmed zero remaining matches after the fix.
- [x] `\d{3}` search across `lib/scripts/*.js` and `lib/hooks/**/*.js`: zero matches — no fixed-3-digit-width parsing code exists anywhere in the codebase.

### 12. Log the convention change and confirm completion  <!-- agent: general-purpose --> <!-- Updated: 2026-09-13 -->

- [x] Appended completion log entry to `wiki/log.md` (distinct from the earlier task-creation entry), verbatim as planned.
- [x] `wiki/work/tasks/index.md` entry confirmed already present (added at task creation), status `in-progress`.
- [x] Full `git diff --stat` cross-check: all ~34 expected files present (23 `lib/skills/` files from the mechanical sweep, 4+4 `lifecycle.md` repo+template, 4+4 `index.md` repo+template, `CLAUDE.md`, `wiki/conventions.md`, 2 CLAUDE/conventions templates, `dashboard.html`, template `wiki/index.md`, `wiki/log.md`, plus the new `TASK-0085-...md` file itself as untracked). **Zero `raw/**` files modified** (only new untracked `raw/research/` dirs from the unrelated `/research` skill). **Zero existing `wiki/work/{tasks,uat,requirements,roadmaps}/*.md` data files renamed or modified by this task** (only `lifecycle.md`/`index.md` touched). All other working-tree changes (Docker-harness/GitHub-Actions removal chain, other `/research` runs, other roadmaps) confirmed pre-existing and unrelated to this task. `bug-assess/SKILL.md` correctly has zero diff — it only ever contained `BUG-NNNN` mentions (unchanged, out of scope), never a `TASK-NNN`/`UAT-NNN`/`REQ-NNN`/`ROADMAP-NNN` token.
