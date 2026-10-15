---
id: TASK-0098
aliases: [TASK-0098]
title: "Extract a shared ID/file-resolution reference doc and wire the consuming skills to it"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: [TASK-0095, TASK-0100]
uat: "[[UAT-0098]]"
tags: [skill-design, redundancy, id-resolution, wiki-conventions]
---

# TASK-0098 — Extract a shared ID/file-resolution reference doc and wire the consuming skills to it

relates_to::[[wiki-skill-boilerplate-duplication]]

## ⚠️ Shares files with other ROADMAP-0014 Phase 2 tasks — do not tackle simultaneously

This task edits the **"resolve the file" step** of 16 `lib/skills/*/SKILL.md` files plus `lib/skills/uat-walk/UAT-CORE.md` (the roadmap's "~10" undercounts). Other tasks touch some of the same files in *different* sections: `TASK-0094` edits `req-update` (retire branch); `TASK-0097` (shared archive-a-work-item doc) edits the archive step of `task-trash`, `roadmap-next`, `bug-triage`, `bug-close`, `task-audit`, `wiki-archive`; `TASK-0099` (shared boilerplate doc) edits the header/prereqs and number-allocation text of many skills. Sections do not overlap, but concurrent `Edit`s to one file race. Run this task **sequentially** with those (tackle order among them is free). This is an orchestration note, not a logical dependency, so `depends_on`/`blocks` stay empty.

## Objective

Every `wiki/work/` skill that accepts a work-item reference (`<path>`, `NNN-slug`, or bare `NNN`) carries its own copy of a resolution table. Fifteen-plus copies have drifted, and several are **already wrong against the files that actually exist**: the `req-*` skills say "pad to 3 digits" and search `NNN-*.md` while real files are `REQ-NNNN-slug.md` (the mask matches nothing); `decision-*` skills use mask `NNNN-*.md` against `DEC-NNNN-slug.md`; the `task-*` skills' examples are `3-user-auth.md` while real files are `TASK-NNNN-slug.md`; and tasks/roadmaps/UAT carry a mix of legacy 3-digit (`TASK-074-…`, `ROADMAP-011-…`) and current 4-digit IDs that no copy handles consistently. Extract **one** width-agnostic, prefix-aware resolution reference, parameterized by family, and reduce each consumer to a short delta (family, search scope, ambiguity behavior, empty-input behavior).

## Approach

**Source-of-truth note**: edit files under `lib/skills/` in this repo, never `~/.claude/skills/` — those are machine-local copies overwritten by `install-global.sh` (`rsync` of `lib/skills/`).

**Follows the `UAT-CORE.md` pattern** (already proven: `uat-walk`/`uat-auto`/`uat-auto-plus` say "Read `~/.claude/skills/uat-walk/UAT-CORE.md` now"). Skills are prompts an LLM follows, so "reference, don't restate" means each SKILL.md points at the doc by its installed path and states only its own deltas; behavior, not just wording, must stay identical apart from fixing the broken masks.

**Placement decision**: `lib/skills/_shared/ID-RESOLUTION.md`, referenced from consumers as `~/.claude/skills/_shared/ID-RESOLUTION.md` (same path style as `~/.claude/skills/uat-walk/UAT-CORE.md`). This follows the convention `TASK-0099` set for every ROADMAP-0014 shared doc: the `_shared/` directory holds `SKILL-BOILERPLATE.md` (`TASK-0099`), `ARCHIVE-WORK-ITEM.md` (`TASK-0097`), and `ID-RESOLUTION.md` (this task) — no single skill owns any of them, unlike `UAT-CORE.md`. `install-global.sh` rsyncs `lib/skills/` verbatim, so the directory installs with no installer change, and a directory without a `SKILL.md` is not registered as a slash command. **Before writing, check whether `lib/skills/_shared/` already exists (created by `TASK-0099`); if not, create it — both tasks may create it, and either order is fine.**

**Doc design** (what `ID-RESOLUTION.md` defines once):

- **Family table** — the only place a family's facts live, so the Phase 4 renames (`requirements`→PRD, `decisions`→ADR) become a one-table edit here:

  | Family | Directory | ID prefix | Notes |
  |---|---|---|---|
  | requirements | `wiki/work/requirements/` | `REQ` | |
  | decisions | `wiki/work/decisions/` | `DEC` | reference may carry a `#DM` suffix |
  | roadmaps | `wiki/work/roadmaps/` | `ROADMAP` | |
  | tasks | `wiki/work/tasks/` | `TASK` | |
  | uat | `wiki/work/uat/` | `UAT` | one per task; number mirrors the task |
  | bugs | `wiki/work/bugs/` | `BUG` | |

- **Accepted forms** (input is one token; trailing free text is the caller's concern):
  1. **Path** — contains `/` or ends `.md`; confirm it exists (`find_file`); missing → STOP `File not found: <path>`. Never create.
  2. **Full ID or ID-slug** — `PREFIX-N…` (`TASK-0086`, `TASK-0086-uat-fail-offers-bug-file`, legacy `TASK-074`).
  3. **`NNN-slug` / `NNNN-slug`** — digits then slug (`0086-uat-fail-offers-bug-file`, `003-search`).
  4. **Bare number** — `86`, `086`, `0086`.
  5. **Empty / free-text description** — not resolved here; each consumer states its own behavior (pick-list, auto-pick, or STOP).
- **Algorithm** — parse the digits to an integer (so `3`, `003`, `0003` are equal); for the family's `PREFIX` try `find_file` masks in order: `PREFIX-<pad4>-*.md` (current), then `PREFIX-<pad3>-*.md` (legacy). Where a slug was supplied, use `PREFIX-<padN>-<slug>.md` first and fall back to a prefix-only match. Never derive the mask by string-concatenating the raw input. (This is what fixes the broken `NNN-*.md` masks.)
- **Match outcomes** — 0 matches → STOP `No <family> matching '<input>' found.` (never invent); 1 → resolved; >1 → **ambiguous**, handled per the caller's declared mode: *interactive* lists the matches and asks via `AskUserQuestion`, *headless* (uat-auto/uat-auto-plus) STOPs and reports in the completion summary.
- **Search scope parameter** — the caller declares one of: `active` (the family directory only — the default), `active+archive` (also `archive/`, reporting which one matched), or `active-then-archive-gate` (search active first; a hit only in `archive/` is "already terminal", used by `bug-close`).
- **`#DM` suffix (decisions)** — strip `#D<n>` before resolving the file; hand it back separately for the caller to select the decision block.
- **Worked-example table** — one row per accepted form × family, using real filenames from this repo.

## Steps

### 1. Write the shared reference doc <!-- agent: general-purpose -->

- [x] Re-read `lib/skills/uat-walk/UAT-CORE.md` (style model) and, if it already exists, `lib/skills/_shared/SKILL-BOILERPLATE.md` (`TASK-0099`) — match its heading/tone conventions.
- [x] Create `lib/skills/_shared/ID-RESOLUTION.md` (create the `_shared/` directory if absent) with the sections in **Doc design** above: family table, accepted forms, algorithm (4-digit then legacy 3-digit masks, integer comparison), match outcomes, search-scope parameter, `#DM` handling, worked examples using real files (e.g. `TASK-0086-uat-fail-offers-bug-file.md`, legacy `TASK-074-serena-project-from-cwd.md`, legacy `ROADMAP-011-build-bootstrap-prefs-tui.md`, `BUG-0006-mv-guard-segment-split-omits-pipe.md`, `DEC-0001-wiki-cross-family-linking-schema.md`).
- [x] State the wiring contract at the top: "Each consuming skill states only: family, search scope, ambiguity mode (interactive|headless), empty-input behavior, and any post-resolution gate. Everything else is defined here."
- [x] Use the tool split from `wiki/guides/mcp-tools.md`: `find_file`/`list_dir`, never `ls`/`find`/`grep`. Prose only — no code.
<!-- Updated: 2026-09-19 Step 1 done; no REQ-*.md exists in repo so the requirements worked example is hypothetical (documented as such) -->



### 2. Wire the requirements-family skills <!-- agent: general-purpose -->

For each file, replace the inline resolution table (approx. lines given) with a compact block: `Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: requirements · scope: <…> · ambiguous: <…> · empty: <…>` plus any post-resolution gate the skill already has. **Read each skill's existing table first and carry its empty/ambiguous behavior over verbatim** — only the resolution mechanics change. Leave `argument-hint:` frontmatter untouched.

- [x] `lib/skills/req-update/SKILL.md` — Step 1 table (~L39-46); keep "stop if not found" and the empty-change-instructions elicitation (that part is not resolution). **Overlaps `TASK-0094` (retire branch, different section) — sequence after it.**
- [x] `lib/skills/req-retire/SKILL.md` — Step 1 table (~L35-40); keep the trailing reason-text parse.
- [x] `lib/skills/req-finalize/SKILL.md` — Step 1 table (~L34-38).
- [x] `lib/skills/req-compile/SKILL.md` — "Locating the requirement" table (~L47-52); keep the empty-input rule (auto-look for `status: approved`) and the `status: approved` gate below it.
- [x] `lib/skills/req-extract-decisions/SKILL.md` — Step 1 table (~L33-38); keep the `draft` refusal gate.
<!-- Updated: 2026-09-19 Step 2 done -->


### 3. Wire the decisions, roadmaps, and bugs skills <!-- agent: general-purpose -->

- [x] `lib/skills/decision-finalize/SKILL.md` — Step 1 table (~L26-33): family `decisions`; the `#DM` suffix is handled per the doc; **keep** the decision-selection rows (one proposed → auto-resolve; multiple → list + `AskUserQuestion`; empty → list every `proposed` decision) — those are decision-block logic, not file resolution.
- [x] `lib/skills/decision-walkthrough/SKILL.md` — Step 1 table (~L41-46); keep the empty-input rule (files with ≥1 `proposed` decision).
- [x] `lib/skills/decision-next/SKILL.md` — Step 0 table (~L30-35); keep "empty → all decision files, exclude `lifecycle.md`" and the `No decisions directory found` message. (`TASK-0093` already touched this file's header — no overlap.)
- [x] `lib/skills/roadmap-next/SKILL.md` — Step 1 table (~L27-31); keep the Step 0 empty-argument STOP. Family `roadmaps`, scope `active`. **Section separate from the sibling archive-doc task's edits to the same file.**
- [x] `lib/skills/bug-triage/SKILL.md` — Step 1 (~L24-37): family `bugs`, scope `active`, not found → STOP.
- [x] `lib/skills/bug-close/SKILL.md` — Step 1 (~L24-37): family `bugs`, scope `active-then-archive-gate`; **keep** the two gates verbatim (found in root → "must be triaged and worked first"; found in `archive/` → "already terminal").
<!-- Updated: 2026-09-19 Step 3 done -->


### 4. Wire the tasks/UAT skills and UAT-CORE <!-- agent: general-purpose -->

- [x] `lib/skills/tackle/SKILL.md` — Step 0 table (~L24-30): family `tasks`, scope `active`; **keep** rows for empty (Roadmap Auto-Discovery 0a) and non-empty-but-unresolved (task survey, recommend never auto-pick) — those fall through, they are not resolution errors.
- [x] `lib/skills/task-trash/SKILL.md` — Step 1 (~L26-43): family `tasks`, scope `active+archive`; keep the "determine which directory it lives in" and "extract number-slug" sub-steps. **Sibling archive-doc task edits this file's later steps.**
- [x] `lib/skills/task-update/SKILL.md` — Step 1 (~L24-37): family `tasks`, scope `active`; keep "remaining text = user instructions". (Phase 4 later deletes this skill; wire it anyway — it ships until then.)
- [x] `lib/skills/uat-skip/SKILL.md` — Step 1 (~L32-36): family `tasks`, scope `active`; keep the "Ambiguous / description only → ask" row.
- [x] `lib/skills/uat-generate/SKILL.md` — Step 1 (~L43-47): family `tasks` (resolves the *source task*, then derives the UAT path); keep "feature description → scan, else offer `/task-add`" and the UAT-ID-mirrors-task-number rule.
- [x] `lib/skills/uat-walk/UAT-CORE.md` — Step 1 table (~L25-30): family `uat`, scope `active`; keep the **Mode differences (resolution)** block (uat-walk interactive / uat-auto and uat-auto-plus headless auto-pick lowest pending `<NNN>`). This covers `uat-walk`, `uat-auto`, `uat-auto-plus` without touching their SKILL.md files.
- [x] Sanity check by search (`search_for_pattern`, not grep): no consumer still contains `Pad to 3 digits`, a `NNN-*.md` mask, or a `3-user-auth.md` or bare `003-<slug>.md` example. (Found and fixed two extra resolution masks in `lib/skills/task-add/SKILL.md` — decision and roadmap file lookup; `bug-file` line ~65 is number allocation, left alone.)
<!-- Updated: 2026-09-19 Step 4 done -->


### 5. Contract test <!-- agent: general-purpose -->

- [x] Create `test/shared-id-resolution.test.js` in the sibling-suite style (`#!/usr/bin/env node`, header comment with WHY + SCOPE + HERMETIC, `node:test` + `node:assert/strict` + `node:fs` + `node:path`, `REPO = path.resolve(__dirname, '..')`; see `test/task-typed-links.test.js`, `test/wiki-work-naming-convention.test.js`).
- [x] Assertions: (a) `lib/skills/_shared/ID-RESOLUTION.md` exists and mentions all six prefixes (`REQ`, `DEC`, `ROADMAP`, `TASK`, `UAT`, `BUG`), the four accepted forms, and the legacy 3-digit fallback; (b) each of the 17 wired files (16 SKILL.md + `UAT-CORE.md`) contains `ID-RESOLUTION.md`; (c) none contains `/Pad to 3 digits/` or a bare `mask \`NNN-\*\.md\``; (d) each wired SKILL.md still has its `argument-hint:` frontmatter line unchanged in shape (regex on the first frontmatter block).
- [x] Run `node --test test/shared-id-resolution.test.js`, then `npm test` — confirm no other suite pins the removed table text (`test/wiki-work-naming-convention.test.js` and `test/skill-frontmatter-aliases.test.js` assert on several of these SKILL.md files; adjust only if a removed string was being pinned, and say so in the completion notes). (New suite 54/54 pass; `npm test` 659/664 — the 5 failures are pre-existing NNN-vs-NNNN placeholder pins in `skill-frontmatter-aliases` and `task-typed-links`, none pinned removed resolution text; no other suite adjusted. The test wires 18 files: the 17 planned plus `task-add`.)
<!-- Updated: 2026-09-19 Step 5 done -->


### 6. Delivery and docs <!-- agent: general-purpose -->

- [x] Confirm `lib/scripts/install-global.sh`'s `rsync` of `lib/skills/` picks up the `_shared/` directory, and that `package.json` `files` plus `test/npm-pack-contents.test.js` include `lib/skills/_shared/ID-RESOLUTION.md` in the published tarball; fix the pack allow-list only if it excludes it.
- [x] In `lib/skills/README.md`, add `_shared/ID-RESOLUTION.md` to the shared-docs note (`TASK-0099` introduces the "Shared reference docs" paragraph/`_shared/` mention — extend it if present, otherwise add a one-line entry; `uat-walk/UAT-CORE.md` is the earlier exemplar).
- [x] In `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md`, add `ID-RESOLUTION.md` as a fourth row in the "reference, don't restate" exemplar table (timeless page, revised in place); do not touch `raw/`.
- [x] Append a `wiki/log.md` entry for the change; check the `roadmap` box for this item via the normal `/tackle` closure flow.
<!-- Updated: 2026-09-19 Step 6 done -->


## Out of scope

- The "archive a work item" mechanics and the universal boilerplate (prereqs, `sed`/`awk` rule, number allocation) — sibling Phase 2 tasks.
- Number *allocation* (`max+1`) — a different algorithm from resolution; belongs to the boilerplate doc.
- Renaming skills or families (Phase 4) — the family table is written so that work is a one-table edit later.
