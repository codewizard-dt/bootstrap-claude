---
id: TASK-0097
aliases: [TASK-0097]
title: "Extract a shared 'archive a work item' reference doc and wire six skills to it"
status: pending-uat
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: []
uat: "[[UAT-0097]]"
tags: [skill-design, wiki-conventions, redundancy, archive]
---

# TASK-0097 — Extract a shared 'archive a work item' reference doc and wire six skills to it

relates_to::[[wiki-skill-boilerplate-duplication]]
relates_to::[[wiki-skill-simplification]]

## ⚠️ Shares files with other ROADMAP-0014 Phase 2 items — do not tackle simultaneously

This task edits `lib/skills/{wiki-archive,task-audit,task-trash,roadmap-next,bug-triage,bug-close}/SKILL.md`. Three sibling Phase 2 roadmap items also touch some of these files. **`TASK-0096`** (wiki-tidy rewrite) has a Step 2 that adds an active-index-removal line to `wiki-archive` Step 4 — the same lines this task's Step 2 replaces. Either order works: if this task lands first, the ARCHIVE-WORK-ITEM procedure already removes the active-index row (its step 3) and `TASK-0096` Step 2 is a verify-only no-op, as that task's own "Shared-file caution" anticipates; if `TASK-0096` lands first, this task's Step 2 overwrites its one-line addition with the reference (harmless — the behavior moves into the doc). `TASK-0096` also depends on `TASK-0093`'s UAT passing, so landing this task first is the lower-friction order. The other two: the shared ID/file-resolution doc (rewrites the resolution steps of `task-trash`, `bug-triage`, `bug-close`, `roadmap-next`, among ~10), and the shared boilerplate doc (rewrites the prereqs line and hygiene rules in most skills). They edit different sections, so a merge is mechanical, but run them sequentially, not in parallel worktrees. This is an orchestration note, not a logical dependency, so `depends_on`/`blocks` stay empty.

## Objective

The "archive a work item" mechanic — flip status, `git mv` into `<family>/archive/`, remove the active-index row, append the `archive/index.md` row, append a `wiki/log.md` entry — is independently written out in six skills (`task-audit` 2d, `task-trash` Steps 4–6, `roadmap-next` "Archive a fully-complete roadmap", `bug-triage` Step 7/7a, `bug-close` Step 7/8, `wiki-archive` Steps 4–5). It has already drifted (see Approach). Write it once as a shared reference doc, parameterized by family and terminal status, and reduce each of the six skills to a pointer plus its own parameters.

## Approach

**Home and name.** Put the doc at `lib/skills/_shared/ARCHIVE-WORK-ITEM.md` and reference it as `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md`. `lib/skills/_shared/` is the directory convention for every ROADMAP-0014 shared doc (the sibling boilerplate task `TASK-0099` creates `lib/skills/_shared/SKILL-BOILERPLATE.md` and names this doc `ARCHIVE-WORK-ITEM.md` beside it), so all Phase 2 shared docs live in one place. The read-on-demand idiom is the proven `UAT-CORE.md` one ("Read `~/.claude/skills/uat-walk/UAT-CORE.md` now"). `install-global.sh` rsyncs all of `lib/skills/` verbatim, so the directory installs with no installer change, and a directory without `SKILL.md` is not registered as a slash command. If `TASK-0099` has not yet created `_shared/`, create it here; whichever task lands first creates it. Filenames stay in the `UPPER-CASE.md` style of `UAT-CORE.md`.

**Scope of the doc** — one procedure, called once per work item, with these inputs: `family` (`tasks | uat | bugs | requirements | roadmaps | decisions`), `file` (the item's current path), `terminal_status` (must be in the family's terminal set per its `lifecycle.md` — the doc points at `lifecycle.md` and never hardcodes the set), `log` (`entry` text, or `skip` when the caller writes its own entry). Procedure: (1) verify the status is terminal and, if the status is not already set, flip it and bump `updated:` with one `Edit`; (2) `git mv` the file into `archive/`; (3) remove the item's row from `<family>/index.md` (skip if already absent); (4) append `| [[ID]] | <title> | <terminal_status> | YYYY-MM-DD |` to `<family>/archive/index.md` (the row shape is identical across all families, including `decisions/archive/index.md`); (5) append the log entry. CRITICAL rules carried over from `wiki-archive`: archive, never delete; `archive/index.md` is append-only; the moved file's body is never edited beyond the status/`updated:` flip; `Bash` is for `git mv` only, every other edit is `Read` then `Edit`; the `archive/` directory already exists — do not create it.

**Drift the extraction must resolve (decided here, not left open):**

| Drift | Decision |
|---|---|
| `wiki-archive` Step 4 uses plain `mv`; the other five use `git mv` | Doc mandates `git mv` (history-preserving, matches conventions.md §5). `wiki-archive` adopts it. |
| `bug-close` writes status `verified` (and `fixed`), but `bugs/lifecycle.md`'s enum has `closed` and no `verified`/`fixed` | `lifecycle.md` is the schema authority: the terminal status handed to the doc is `closed`. `bug-close`'s "Verify and close" outcome maps to `closed`. The non-terminal "Mark fixed" outcome is out of scope for the doc (no move) — leave its behavior alone and record in the final report that `fixed` is not a lifecycle status, for a separate bug. |
| `bug-triage` reject path appends to `wiki/log.md` twice (Step 7a item 4, then Step 9) | `bug-triage` passes `log: skip` on reject and keeps its single Step 9 entry. |
| `task-audit` 2d moves a completed task but never writes a log entry | The doc's log step is mandatory unless `skip` is passed; `task-audit` gains the entry (CLAUDE.md wiki rule 3: every work-item status flip updates the family index and `wiki/log.md`). |
| Log op names differ (`archive`, `task-trashed`, `bug-triage`) | Keep each caller's existing op name via the caller-supplied `entry`; the doc supplies only the default (`archive | <ID> — <status>, moved to archive`) used by `roadmap-next`/`wiki-archive`. Nothing in the repo parses op names, so no rename is forced. |
| `wiki-archive` never flips status (items arrive already terminal) and writes one batch log entry | The doc's step 1 flips only when the status is not already terminal; `wiki-archive` runs steps 1–4 per file and writes its single batch entry itself (`log: skip` per item). |

**Out of scope.** Four other skills implement the same mechanic but are not named in the roadmap item: `uat-skip` Step 3a/4, `UAT-CORE.md` Closure, `req-retire`, and `decision-finalize` Step 6.5 (plus a `git mv` proposal in `wiki-lint`). Do not rewire them here; list them in the doc's closing "Other consumers (not yet wired)" note so a follow-up can. `task-audit`'s `/task-update` suggestion and `task-trash`'s stale `<number>-<slug>.uat.md` naming are also untouched (Phase 4 renames, and a separate naming bug).

**Testing approach.** Follow the repo's static skill-content suite idiom (`test/bug-close-clustering-offer.test.js`, `test/task-typed-links.test.js`): `node:test` + `node:assert/strict`, hermetic, reads repo-local files only.

## Steps

### 1. Write ARCHIVE-WORK-ITEM.md <!-- agent: general-purpose -->

- [x] Create `lib/skills/_shared/ARCHIVE-WORK-ITEM.md`, headed `# ARCHIVE-WORK-ITEM — shared procedure for archiving a work item`, opening with the same framing as `UAT-CORE.md` (one paragraph: the procedure lives here once; each `SKILL.md` supplies only its parameters and any deltas). No frontmatter (matches `UAT-CORE.md`).
- [x] Add an **Inputs** table (`family`, `file`, `terminal_status`, `log`) and a **Procedure** section with the five numbered steps in Approach, each naming the exact tool (`Edit` for the flip and index edits, `Bash` for `git mv` only, `Read` before every `Edit`).
- [x] Step 1 must say: read the family's `wiki/work/<family>/lifecycle.md` and confirm `terminal_status` is a terminal value — do not hardcode the per-family sets. If the status is already terminal, do not touch the file's content.
- [x] Add a **Row and log formats** section: the four-column archive row (`| [[ID]] | <title> | <terminal_status> | YYYY-MM-DD |`, today's date) and the default log entry `## [YYYY-MM-DD] archive | <ID> — <terminal_status>, moved to archive` + one sentence.
- [x] Add a **Caller deltas** section listing, per consumer, what it passes: `wiki-archive` (already terminal, batch log), `task-audit` (`done`), `task-trash` (`trashed`, run once for the task then once per related UAT, log op `task-trashed`), `roadmap-next` (`done`, default log), `bug-triage` (`wontfix|duplicate|cannot-reproduce`, `log: skip`), `bug-close` (`closed|wontfix|cannot-reproduce`).
- [x] Add a **CRITICAL rules** section (never delete; archive index append-only; no body edits beyond status/`updated:`; `Bash` only for `git mv`; `archive/` already exists; never `sed`/`awk`/`echo >>`) and the closing "Other consumers (not yet wired)" note naming `uat-skip`, `UAT-CORE.md` Closure, `req-retire`, `decision-finalize` Step 6.5.

### 2. Wire wiki-archive <!-- agent: general-purpose -->

- [x] In `lib/skills/wiki-archive/SKILL.md`, replace the body of "## Step 4: Move files and update archive/index.md" (the `mv` line, the frontmatter read, the row template) with "Read `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` now and run its Procedure once per confirmed file: `terminal_status` is the file's existing `status:`, `log: skip`." Keep the batch confirmation (Step 3), the per-family terminal-set lookup (Steps 1–2), and the single batch log entry (Step 5) — those are wiki-archive's own.
- [x] Keep the "Never move an active item" CRITICAL rule; delete the CRITICAL bullets that ARCHIVE-WORK-ITEM now owns (archive/index.md append-only, never delete, `archive/` exists) — replace with one line: "Move mechanics and their invariants: ARCHIVE-WORK-ITEM.md."

### 3. Wire task-audit and task-trash <!-- agent: general-purpose -->

- [x] `lib/skills/task-audit/SKILL.md` "### 2d. Move Fully-Completed Tasks": replace items 1–2 with a reference to ARCHIVE-WORK-ITEM.md (`family: tasks`, `terminal_status: done`, default log entry). Keep item 3 (now-resolved-dependency scan) and item 4 (`completed: true` node record) — they are audit-specific.
- [x] `lib/skills/task-trash/SKILL.md`: collapse Step 4's `git mv` + row-append blocks (task and UAT) and Step 5's index-row removal and Step 6's log block into: "Run ARCHIVE-WORK-ITEM.md's Procedure for the task (`family: tasks`, `terminal_status: trashed`, log op `task-trashed`), then once per related UAT file (`family: uat`, `terminal_status: trashed`, `log: skip`)." Keep Step 3's confirmation, the "do NOT remove references from roadmaps/decisions" rule, and Step 7's report table.

### 4. Wire roadmap-next <!-- agent: general-purpose -->

- [x] `lib/skills/roadmap-next/SKILL.md` "### Archive a fully-complete roadmap": replace the five numbered items with "Run ARCHIVE-WORK-ITEM.md's Procedure: `family: roadmaps`, `terminal_status: done`, default log entry; no prompt." Keep the heading and the "run automatically, no prompt" contract.
- [x] Keep "Step 3: Report"'s reference to the shared procedure and the CRITICAL-rules bullets; update the "Permitted content writes" bullet (2) wording only if it names steps that no longer exist inline.
- [x] Check `lib/skills/roadmap-assess/SKILL.md` (~lines 145–146), which delegates its auto-archive to `roadmap-next`'s procedure; it must still read correctly and needs no edit unless it quotes the removed numbered items.

### 5. Wire bug-triage and bug-close <!-- agent: general-purpose -->

- [x] `lib/skills/bug-triage/SKILL.md`: replace Step 7a's four-item list with "Run ARCHIVE-WORK-ITEM.md's Procedure: `family: bugs`, `terminal_status: <wontfix|duplicate|cannot-reproduce>`, `log: skip` — Step 9 writes the single log entry." Step 7's "Reject: remove the entire row" line is now performed by the procedure; reword it to point at 7a rather than restating it. Step 6's status flip stays (the bug file needs the `## Resolution`/`## Related` edits made before the move); the procedure's flip is then a no-op because the status is already terminal.
- [x] `lib/skills/bug-close/SKILL.md`: replace the "Archive-move sequence" block (Step 7) with an ARCHIVE-WORK-ITEM.md reference (`family: bugs`, `terminal_status: closed | wontfix | cannot-reproduce`, default log entry), and delete Step 8's paragraph that restates what the sequence already did (keep the `fixed`/no-move index-row update). Change the "Verify and close" outcome status from `verified` to `closed` everywhere in the file (the outcome table, Step 7, the Step 10 "For `verified`" clustering check), matching `bugs/lifecycle.md`.
- [x] Re-run `test/bug-close-clustering-offer.test.js` after the `verified`→`closed` rename; if it pins the literal string `verified`, update that assertion in the same commit and note it.

### 6. Docs and knowledge page <!-- agent: general-purpose -->

- [x] `lib/skills/README.md` line 5: the sentence says `uat-walk/` is the one skill with an extra file. Update it to name `uat-walk/UAT-CORE.md` and the `_shared/` directory (`ARCHIVE-WORK-ITEM.md`, plus whatever `TASK-0099` adds there — write the sentence so it does not enumerate `_shared/` files, to avoid a merge conflict with that task's README edit, which revises the same paragraph).
- [x] `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md`: add `ARCHIVE-WORK-ITEM.md` as a fourth row of the "reference, don't restate" exemplar table, and mark the "Archive a work item" bullet under "Duplicated mechanics" as resolved with a pointer to this task (`implemented_by::[[TASK-0097]]`). Revise in place; knowledge pages carry no `status` field. Bump `updated:`.

### 7. Regression test <!-- agent: general-purpose -->

- [x] Create `test/archive-work-item.test.js` (`node:test`, `node:assert/strict`, hermetic, header comment in the style of `test/bug-close-clustering-offer.test.js` explaining why static assertions pin a markdown-as-program contract). Assertions: (a) `lib/skills/_shared/ARCHIVE-WORK-ITEM.md` exists and contains `git mv`, `archive/index.md`, and `lifecycle.md`; (b) each of the six SKILL.md files contains `ARCHIVE-WORK-ITEM.md`; (c) none of `task-audit`, `task-trash`, `roadmap-next`, `bug-triage`, `bug-close`, `wiki-archive` contains an inline `git mv wiki/work/` or a bare `mv wiki/work/` command; (d) `wiki-archive/SKILL.md` contains no plain `mv wiki/work/`; (e) `bug-close/SKILL.md` contains no `verified` status; (f) `bug-triage/SKILL.md` has exactly one `wiki/log.md` append instruction on its reject path (assert `Step 7a` block does not contain `wiki/log.md`).
- [x] Run `npm test` (or `node --test test/archive-work-item.test.js test/bug-close-clustering-offer.test.js`) and confirm the new and all existing skill-content suites pass.

### 8. Log and hand off <!-- agent: general-purpose -->

- [x] Append a `wiki/log.md` entry for the implementation (`## [YYYY-MM-DD] task | TASK-0097 ...`), refresh `wiki/hot.md`, and confirm each of the six edited skills still reads end-to-end (no orphaned step references such as "Step 7a below" pointing at removed text).
