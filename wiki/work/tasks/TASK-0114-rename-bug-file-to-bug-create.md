---
id: TASK-0114
aliases: [TASK-0114]
title: "Rename bug-file to bug-create and sweep every live reference"
status: pending-uat
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0113, TASK-0095]
blocks: [TASK-0115]
parallel_safe_with: []
uat: "[[UAT-0114]]"
tags: [skill-design, rename, wiki-conventions, bugs]
---

# TASK-0114 — Rename bug-file to bug-create and sweep every live reference

relates_to::[[wiki-skill-boilerplate-duplication]]
depends_on::[[TASK-0113]]
depends_on::[[TASK-0095]]
blocks::[[TASK-0115]]

## Objective

Hard-rename the `bug-file` skill to `bug-create` so the `bugs` family shares the `create`/`assess` action vocabulary that ROADMAP-0014 Phase 4 standardizes across every `wiki/work/` family. Only the name changes — the skill's behavior, steps, and output are untouched. Every live reference (skills, shared docs, lifecycle docs and their template copies, tests, README/CLAUDE.md, non-historical wiki pages) is updated, and a residue-sweep test asserts no live `bug-file` reference remains outside historical records. Roadmap item: ROADMAP-0014 Phase 4 ("Rename `bug-file` → `bug-create`"); decisions recorded in that roadmap's Notes (Q&A 2026-09-19): old skill names are hard-renamed with no redirect stubs.

## Approach

**Sequencing**: runs after TASK-0113 (the previous rename in the Phase 4 chain) and TASK-0095 (which edits `bug-file/SKILL.md`'s status lines and created `test/bug-file-status-open.test.js`; the rename must land on top of it). Precedes TASK-0115. Both neighbours and TASK-0085/0086/0091 touch overlapping files, so every edit is a minimal exact-string edit made after a fresh re-read — never a whole-file rewrite.

**Source-of-truth note**: edit `lib/skills/`, never `~/.claude/skills/`. Do **not** touch the installed `~/.claude/skills/bug-file/` copy and do **not** run `install-global.sh` — TASK-0122 (the installer prune) removes stale installed skills.

**Reference inventory** (from a Serena sweep of the repo at task-creation time; re-run the sweep in Step 6 because TASK-0113 and concurrent tasks may add or remove hits):

| Area | Files |
|------|-------|
| Skill itself | `lib/skills/bug-file/SKILL.md` (only file in the dir) — `name:` line 2, description line 3, self-references |
| Other skills | `lib/skills/uat-walk/SKILL.md` (Fail bullet, `Skill` `bug-file` + `/bug-file`), `lib/skills/uat-auto/SKILL.md` (summary `→ /bug-file` example; Rules line "Bug-file suggestions … never call `/bug-file`"), `lib/skills/bug-assess/SKILL.md` (no-bugs STOP message `Use /bug-file <description>`), `lib/skills/README.md` (table row) |
| Shared docs | `lib/skills/_shared/SKILL-BOILERPLATE.md` (bugs row note "`bug-file` previously said …"); `lib/skills/_shared/ID-RESOLUTION.md` only contains the `…-uat-fail-offers-bug-file` **task slug** — leave as is (see retained slugs) |
| Lifecycle docs | `wiki/work/bugs/lifecycle.md` line 34 and its template copy `lib/scripts/templates/wiki/work/bugs/lifecycle.md` line 34 (`open — filed (\`/bug-file\`)`) |
| Repo docs | `CLAUDE.md` Custom Commands row (`/bug-file <description>`); `README.md`, `lib/scripts/**`, `lib/hooks/**`, `lib/prompts/**`, `lib/scripts/templates/CLAUDE-wiki.md` had **no** hits at inventory time — confirm in Step 6 |
| Tests | `test/skill-frontmatter-aliases.test.js` (L41 path const, L77/L82 titles+messages), `test/uat-fail-offers-bug-file.test.js` (L1, 7, 13-14, 72-73, 77-154), `test/knowledge-link-flag.test.js` (L2-3, 11, 23, 39, 137-237), `test/bug-file-status-open.test.js` (L1, 6, 23, 26-60), `test/skill-boilerplate.test.js` (L68 `ALLOCATION_CONSUMERS`, L72 `HYGIENE_CONSUMERS`), `test/wiki-work-naming-convention.test.js` (L2, 25-28). `test/shared-id-resolution.test.js` L279 only uses the `TASK-0086-uat-fail-offers-bug-file` slug — no change |
| Non-historical wiki | `wiki/knowledge/concepts/wiki-work-filename-convention.md` (L14 path, L19/30/38 prose), `wiki/knowledge/concepts/wiki-work-family-cross-linking-gaps.md` (L23, L32), `.serena/memories/skills/format-and-model-selection.md` (L25) |
| Open work items pointing at the old path | non-terminal tasks/UATs whose steps read or invoke the skill: `TASK-0085`, `TASK-0086`, `TASK-0091`, `TASK-0095` and `UAT-0085`, `UAT-0086`, `UAT-0091`, `UAT-0095`, `UAT-0099`/`TASK-0099` consumer lists — update **live paths and invocations** (`lib/skills/bug-file/…`, `` `Skill` `bug-file` ``, `~/.claude/skills/bug-file/`) so tackle/uat-walk against them still resolves after the rename |

**Retained on purpose (not residue)**:

- **Task-slug-derived names**: `TASK-0086-uat-fail-offers-bug-file.md`, `UAT-0086-…`, `TASK-0095-bug-file-status-open-alignment.md`, `UAT-0095-…`, `test/uat-fail-offers-bug-file.test.js`, `test/bug-file-status-open.test.js`. IDs and slugs are stable identifiers (wiki `conventions.md` — link by ID/alias, never re-slug), and open UATs cite the two test filenames in their `Unit Test Command` lines; renaming the test files would break those and the `ID-RESOLUTION.md` examples for no behavior gain. This resolves the lead's "rename `bug-file-status-open.test.js` if appropriate" question: **not appropriate** — keep both test filenames, update only their contents.
- **Work-item titles** (`title:` frontmatter, H1, family-index lines, roadmap `[[TASK-NNNN: …]]` link text such as TASK-0085/0086/0091/0095) — names of past work; leave.
- **Historical records — never edited**: `wiki/log.md` and rotated logs (append-only), `raw/**` (immutable), every `**/archive/**` file, `wiki/knowledge/sources/**` (summaries of immutable raw sources), `wiki/hot.md` (regenerated by the hot-cache refresh, not hand-edited here), `wiki/index.md` (catalog of historical page summaries), `.docs/**` dated audit reports, and terminal (`done`/`passed`/`skipped`/`trashed`) work-item bodies.

**Residue-sweep test design**: a new zero-dependency `node:test` file `test/bug-create-rename-residue.test.js` that walks the repo itself (no `git grep`), skips `node_modules/`, `.git/`, `raw/`, `.docs/`, `**/archive/**`, `wiki/log*.md`, `wiki/hot.md`, `wiki/index.md`, `wiki/knowledge/sources/**`, and the test file itself; blanks the retained slugs `uat-fail-offers-bug-file` and `bug-file-status-open` from each file's text; then asserts no `bug-file` (case-insensitive `bug-file`, covering `Bug-file`) remains in (a) `lib/**`, `test/**`, `README.md`, `CLAUDE.md`, `.serena/memories/**`, `wiki/knowledge/{concepts,entities}/**`, `wiki/conventions.md`, `wiki/work/*/lifecycle.md`; and (b) the literal live-path forms `lib/skills/bug-file` and `skills/bug-file` inside any non-archive `wiki/work/**` file. It also asserts `lib/skills/bug-file/` does not exist, and that `lib/skills/bug-create/SKILL.md` exists with `name: bug-create` in its frontmatter.

## Steps

### 1. Rename the skill directory and its own text  <!-- agent: general-purpose -->

- [x] Re-read `lib/skills/bug-file/SKILL.md` (TASK-0095 and concurrent tasks edit it) and confirm `lib/skills/bug-file/` is git-tracked (`git ls-files lib/skills/bug-file`); it is expected to be tracked (it shows as modified in `git status`)
- [x] `git mv lib/skills/bug-file lib/skills/bug-create` (plain `mv` only if the directory turns out to be untracked); confirm `lib/skills/bug-create/SKILL.md` exists and `lib/skills/bug-file/` is gone
- [x] In `lib/skills/bug-create/SKILL.md`, change frontmatter `name: bug-file` → `name: bug-create` and the `description:` verb "File a new bug report" → "Create a new bug report" (rest of the sentence unchanged); change the H1 `# File Bug` → `# Create Bug` and the intro wording only where it names the skill; replace every self-reference `/bug-file` / `bug-file` in the body with `bug-create`. Do **not** change any step, field, status (`open`), filename rule, or the `--knowledge` flag
- [x] Use Serena `search_for_pattern` for `bug-file` within `lib/skills/bug-create/` and confirm zero hits

### 2. Update other skills and shared docs  <!-- agent: general-purpose -->

- [x] `lib/skills/uat-walk/SKILL.md` — in the `- **Fail** →` bullet change `` `Skill` `bug-file` `` → `` `Skill` `bug-create` `` and `After \`/bug-file\` completes` → `After \`/bug-create\` completes`; leave the user-facing prompt "File a bug for this? (y/n)" and everything else untouched (a test pins the wording)
- [x] `lib/skills/uat-auto/SKILL.md` — change the summary example `→ /bug-file "UAT-API-003: …"` → `→ /bug-create "UAT-API-003: …"` and the Rules sentence "Bug-file suggestions in the summary are informational text only — never call `/bug-file` itself." → "Bug-create suggestions … never call `/bug-create` itself."
- [x] `lib/skills/bug-assess/SKILL.md` — the no-bugs STOP message `Use /bug-file <description> to file one.` → `Use /bug-create <description> to file one.`
- [x] `lib/skills/README.md` — change the table row `` `bug-file` `` → `` `bug-create` `` (keep the description consistent with the new SKILL.md description, and keep row position or re-sort only if the table is alphabetical)
- [x] `lib/skills/_shared/SKILL-BOILERPLATE.md` — bugs row: "`bug-file` previously said a bare `NNNN-` prefix" → "`bug-create` previously said …" (the skill's history under its new name; no other change)
- [x] `lib/skills/_shared/ID-RESOLUTION.md` — **no edit**: its only hits are the retained `…-uat-fail-offers-bug-file` slug
- [x] Confirm `bug-triage`, `bug-close`, `task-add`/`task-create`, `wiki-lint`, `roadmap-*`, `uat-auto-plus` carry no `bug-file` reference (inventory found none; `uat-auto-plus` must stay reference-free — a test pins that, so if the renamed test now asserts `bug-create` absence there, that is intended)

### 3. Update lifecycle docs, CLAUDE.md, and repo docs  <!-- agent: general-purpose -->

- [x] `wiki/work/bugs/lifecycle.md` line 34: `` **open** — filed (`/bug-file`) `` → `` (`/bug-create`) ``; apply the identical edit to the template copy `lib/scripts/templates/wiki/work/bugs/lifecycle.md` (template-owned files are always-refreshed, so keep the two in lockstep)
- [x] `CLAUDE.md` Custom Commands table: `/bug-file <description>` → `/bug-create <description>` (keep the `--knowledge <slug>` note — `test/knowledge-link-flag.test.js` reads this row); update the row's leading verb "File a new bug" only if consistent with the SKILL.md description
- [x] Confirm `README.md`, `lib/scripts/templates/CLAUDE-wiki.md`, `lib/scripts/**`, `lib/hooks/**`, `lib/prompts/**` have no `bug-file` hit; fix any that TASK-0113 or concurrent work introduced

### 4. Update the existing tests (contents only; filenames retained)  <!-- agent: general-purpose -->

- [x] `test/skill-frontmatter-aliases.test.js` — `BUG_FILE_SKILL` path → `lib/skills/bug-create/SKILL.md` (rename the const `BUG_CREATE_SKILL`); L77/L82 test title and assertion message `bug-file/SKILL.md` → `bug-create/SKILL.md`
- [x] `test/uat-fail-offers-bug-file.test.js` — replace every asserted `bug-file` / `/bug-file` / `Bug-file` string with the `bug-create` equivalents (L79 `On yes: invoke \`Skill\` \`bug-create\``, L90, L106, L110-154 including the `/^ {4}→ \/bug-create …/` regex, the "Bug-file suggestions" → "Bug-create suggestions" Rules assertion, the `invoke \`Skill\` \`bug-create\`` negative check, and the `uat-auto-plus` no-mention check); update the header comments at L1, 7, 13-14 but keep the file's own filename in the `Run:` line
- [x] `test/knowledge-link-flag.test.js` — `BUG_FILE_SKILL` const path (L39) and every test title/message/comment referencing `bug-file/SKILL.md`, and the CLAUDE.md row lookup (L221-225: `includes('/bug-create')`, message `/bug-create row not found`)
- [x] `test/bug-file-status-open.test.js` — `SKILL` const (L23) → `lib/skills/bug-create/SKILL.md`; test titles/messages `bug-file` → `bug-create`; header comment L1 wording; keep the `Run: node --test test/bug-file-status-open.test.js` filename
- [x] `test/skill-boilerplate.test.js` — `ALLOCATION_CONSUMERS` (L68) and `HYGIENE_CONSUMERS` (L72): replace only the `'bug-file'` entries with `'bug-create'`; do **not** alter other entries (they belong to TASK-0113/0115 and the later renames — re-read the array immediately before editing)
- [x] `test/wiki-work-naming-convention.test.js` — L2 comment and L25-28 (`read('lib/skills/bug-file/SKILL.md')` → `bug-create`, test title, EDGE-001 comment)
- [x] Run `node --test test/skill-frontmatter-aliases.test.js test/uat-fail-offers-bug-file.test.js test/knowledge-link-flag.test.js test/bug-file-status-open.test.js test/skill-boilerplate.test.js test/wiki-work-naming-convention.test.js test/shared-id-resolution.test.js` and confirm every file passes; any pre-existing failure caused by other in-flight tasks is reported, not fixed here

### 5. Update non-historical wiki pages, memory, and open work items  <!-- agent: general-purpose -->

- [x] `wiki/knowledge/concepts/wiki-work-filename-convention.md` — path and prose references to `lib/skills/bug-file/SKILL.md` → `lib/skills/bug-create/SKILL.md`, and skill-name mentions → `bug-create` (a page describing the *current* naming convention; where a sentence narrates the historical filename bug, reword so it names the skill `bug-create` and the literal old name does not appear)
- [x] `wiki/knowledge/concepts/wiki-work-family-cross-linking-gaps.md` — L23 and L32 `/bug-file` → `/bug-create`
- [x] `.serena/memories/skills/format-and-model-selection.md` — L25 skill-list mention → `bug-create` (edit with Serena memory or Read/Edit; it is a markdown memory)
- [x] For each open work item in the inventory table (`TASK-0085`, `TASK-0086`, `TASK-0091`, `TASK-0095`, `TASK-0099`; `UAT-0085`, `UAT-0086`, `UAT-0091`, `UAT-0095`, `UAT-0099`): re-read, then update **only** live-path/invocation forms — `lib/skills/bug-file/…` → `lib/skills/bug-create/…`, `` `Skill` `bug-file` `` and `/bug-file` in Steps/Scenario/Steps-to-run text, `~/.claude/skills/bug-file/` → `bug-create` — and the skill-name mentions in consumer lists. Leave `title:`, H1, family-index lines, roadmap link text, retained slugs/test filenames, and the `Repeatable Unit Test` / `Unit Test Command` filenames as they are. Do not change any `status:`
- [x] Do **not** touch `wiki/log.md`, `raw/**`, `**/archive/**`, `wiki/knowledge/sources/**`, `wiki/hot.md`, `wiki/index.md`, `.docs/**`, `~/.claude/skills/**`

### 6. Residue sweep and residue test  <!-- agent: general-purpose -->

- [x] Re-run the sweep with Serena `search_for_pattern` (`bug-file|Bug-file`) over `.` (exclude `raw/**`, `wiki/log*.md`, `node_modules`, `.git`) and reconcile every remaining hit against the retained/historical lists above; fix any live hit missed at inventory time (TASK-0113 and concurrent tasks may have added some)
- [x] Create `test/bug-create-rename-residue.test.js` per the "Residue-sweep test design" above: zero-dependency `node:test` + `node:assert/strict`, own recursive walker with the skip list, retained-slug blanking, scope (a) and (b) assertions, directory-gone and new-`SKILL.md` assertions; every failing assertion message lists the offending `path:line` pairs
- [x] Run `node --test test/bug-create-rename-residue.test.js`; then run the full suite `npm test` and confirm no new failures attributable to this task
- [x] Confirm `git status` shows the directory as a rename (`R lib/skills/bug-file/SKILL.md -> lib/skills/bug-create/SKILL.md`) and that `~/.claude/skills/bug-file/` was not touched
