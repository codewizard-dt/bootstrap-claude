---
id: TASK-0099
aliases: [TASK-0099]
title: "Extract a shared skill-boilerplate doc (prereqs line, Edit-hygiene rule, number-allocation algorithm) and wire consuming skills to it"
status: pending-uat
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: []
uat: "[[UAT-0099]]"
tags: [skill-design, wiki-conventions, redundancy]
---

# TASK-0099 — Extract a shared skill-boilerplate doc (prereqs line, Edit-hygiene rule, number-allocation algorithm) and wire consuming skills to it

relates_to::[[wiki-skill-boilerplate-duplication]]

## ⚠️ Shares files with the other ROADMAP-0014 Phase 2 tasks — do not tackle simultaneously

This task makes line-targeted edits to many `lib/skills/*/SKILL.md` files that the sibling Phase 2 tasks also touch: the `wiki-tidy` rewrite, the shared "archive a work item" doc (`task-audit`, `task-trash`, `roadmap-next`, `bug-triage`, `bug-close`, `wiki-archive`), and the shared ID/file-resolution doc (~10 skills). It also overlaps `TASK-0094` (`req-update`) and `TASK-0095` (`bug-create`). This is an orchestration note, not a logical dependency, so `depends_on`/`blocks` stay empty. Recommended order: tackle the archive-doc and ID-resolution tasks first, because they establish the `lib/skills/_shared/` directory and the pointer-line style this task should match. If this task runs first, it creates `_shared/` and the siblings reuse it. Either way, re-read each `SKILL.md` immediately before every `Edit`.

## Objective

Three pieces of boilerplate recur across the `wiki/work/`-family skills: the `**Prereqs:**` line (about 48 skills), the "never `sed`/`awk`/`echo >>` — use `Edit`" hygiene rule (about 20 skills, each phrased slightly differently), and the number-allocation algorithm (restated in `task-add`, `roadmap-create`, `bug-create`, `req-create`, `adr-create`; `task-add`, `roadmap-create`, and `adr-create` each state it twice, once at planning time and once at the pre-`Write` re-scan). Extract all three into one shared doc, modeled on `UAT-CORE.md`, and reduce each consuming skill to a pointer plus its own parameters or exceptions. Advances the Phase 2 boilerplate item of [[ROADMAP-0014]].

## Approach

**Source-of-truth note**: edit `lib/skills/**` in this repo, never the `~/.claude/skills/` copies. `install-global.sh` rsyncs `lib/skills/` verbatim, so the new directory installs to `~/.claude/skills/_shared/` with no installer change. A directory with no `SKILL.md` is not registered as a slash command. `test/install-global.test.js` builds its own fixture template and does not enumerate `lib/skills/`, so it is unaffected.

**Location and name**: `lib/skills/_shared/SKILL-BOILERPLATE.md`, referenced as `~/.claude/skills/_shared/SKILL-BOILERPLATE.md`, the same path style as `~/.claude/skills/uat-walk/UAT-CORE.md`. Not `uat-walk/`, because no skill owns these three items. The `_shared/` directory is the convention for every ROADMAP-0014 shared doc (siblings add `ARCHIVE-WORK-ITEM.md` and `ID-RESOLUTION.md` beside it).

**The three items are treated differently on purpose:**

| Item | Treatment | Why |
|---|---|---|
| Edit-hygiene rule | Skill restatements are replaced by a one-line pointer to `§ Edit hygiene`; skill-specific exceptions stay inline | Verbatim-ish duplicate today, read on demand at the edit step. |
| Number allocation | Skill restatements are replaced by a pointer plus a parameter line (family dir, ID prefix); the "re-verify immediately before `Write`" pointer stays at the existing re-scan step | Same algorithm five times; the per-family parameters are the only real difference. |
| `**Prereqs:**` line | **Stays inline in every skill.** The shared doc defines its grammar; a test enforces it | It is the instruction to read `mcp-tools.md`, so hiding it behind a pointer would cost an extra `Read` on every invocation for no drift benefit. Single-sourcing plus test enforcement gives the drift protection without the Read. |

**Pointer timing**: pointers are section-anchored ("per `_shared/SKILL-BOILERPLATE.md` § Number allocation") and read at the step that needs them, not at skill start. This matches the `UAT-CORE.md` precedent while avoiding an unconditional extra read.

**Deliberately not consumers**: `uat-walk`, `uat-auto`, `uat-auto-plus`, and `UAT-CORE.md` (already de-duplicated; UAT-CORE's Bash hygiene is UAT-specific); the `IMPORTANT:` prompt text `power-mode` injects into subagents, which must stay self-contained because subagents will not have read the shared doc; `lifecycle.md` files; `lib/hooks/README.md`.

**Test-suite gotcha**: `test/wiki-work-naming-convention.test.js` (EDGE-009) fails on any bare 3-digit placeholder (`TASK-NNN`, `UAT-NNN`, `REQ-NNN`, `ROADMAP-NNN`) in any `lib/skills/**/*.md`, including the new doc. Use `NNNN` throughout.

## Steps

### 1. Baseline inventory <!-- agent: Explore -->

- [x] Use Serena `search_for_pattern` over `lib/skills` to record, per skill, the current state of the three items: (a) the `**Prereqs:**` line text, (b) each hygiene-rule sentence (patterns: `sed`, `awk`, `perl -i`, `echo >>`, `cat <<EOF`, "shell redirection"), (c) each number-allocation sentence (patterns: `max + 1`, `highest`, `zero-pad`, `never re-use`, "re-scan").
  - Known hygiene consumers to confirm: `git-commit`, `req-update`, `update-docs`, `req-extract-decisions`, `adr-create`, `bug-triage`, `prd-finalize`, `uat-skip`, `adr-walkthrough`, `bug-create`, `adr-finalize`, `task-update`, `prd-create`, `roadmap-create`, `tackle`, `task-trash`, `req-retire`, `bug-close`.
  - Known allocation consumers to confirm: `task-add` (Step 4 and Step 7a), `roadmap-create` (Step 2/3 and Step 5), `bug-create` (Step ~4), `prd-create` (Step ~2), `adr-create` (Step 2 and the Step ~5 re-scan). Not `uat-generate`, whose UAT number mirrors its task's.
  - Record the exact per-family filename prefix from each family's `lifecycle.md` (`TASK-`, `ROADMAP-`, `REQ-`, `BUG-`, `DEC-`). `bug-create` and `adr-create` currently say bare `NNNN-`, which may be stale after the TASK-0085 naming normalization. Do not assume; if a skill's wording disagrees with its lifecycle, the lifecycle wins, and record the discrepancy in the shared doc's parameter table.
- [x] Record the total line count of the three items across `lib/skills/` for the before/after summary. <!-- Baseline: 49 Prereqs lines (0 non-conforming); hygiene 42 lines (34 known + 8 other, task-trash has none); allocation 26 lines; (b)+(c) = 68 lines. Prefixes: TASK-/ROADMAP-/BUG-/REQ-/DEC-; bug-file + decision-create say bare NNNN- (stale, lifecycle wins). No family index reserves IDs. -->
<!-- Updated: 2026-09-19 -->


### 2. Write the shared doc <!-- agent: general-purpose -->

- [x] Create `lib/skills/_shared/SKILL-BOILERPLATE.md` (if the `_shared/` directory already exists from a sibling task, reuse it). Open with a header in the `UAT-CORE.md` style: what the file is, which skills consume it, and the rule that consumers reference sections and never restate them. Sections:
  - **`## Prereqs`**: the canonical grammar and its three verbatim forms: (1) `**Prereqs:** obey \`wiki/guides/mcp-tools.md\`.`; (2) form 1 plus `; run /primer if not done this session` before the period; (3) either form with ` + \`wiki/work/<family>/lifecycle.md\`` after the `mcp-tools.md` reference, where `<family>` is one of `tasks`, `bugs`, `uat`. State the rule for choosing: add the `/primer` clause when the skill does codebase or wiki exploration; add the lifecycle reference when the skill reads or writes that family's files. Explain why the line stays inline (see Approach).
  - **`## Edit hygiene`**: never use `sed`, `awk`, `perl -i`, `echo >>`, `cat <<EOF`, or any shell redirection to modify a markdown or config file. Use `Read` then `Edit`, one `Edit` per change even when there are many, and never `Write` to rewrite an existing file in full. Appending to `wiki/log.md` or an index file is a `Read` then `Edit`, not `echo >>`. Bash is reserved for commands with no dedicated tool (for example `git mv`). Cross-reference `wiki/guides/mcp-tools.md` "Common anti-patterns". Note that each violation triggers a permission prompt.
  - **`## Number allocation`**: the algorithm, parameterized by (family directory, ID prefix). (1) `list_dir` both `wiki/work/<family>/` and `wiki/work/<family>/archive/`, skipping either that does not exist. (2) Collect the numeric value of every `<PREFIX><digits>-` filename prefix across both, regardless of digit count (legacy files are 3-digit, new ones 4-digit) and ignoring leading zeros when comparing. (3) Families whose `index.md` can reserve IDs ahead of files also scan the index (tasks: yes). (4) `max + 1`, zero-padded to 4 digits; the first ID in a brand-new project is `<PREFIX>0001`, and in an existing project continue from the current max, never restart at 1. (5) Never re-use a number. Terminal items keep their ID forever, in `archive/`. (6) **Re-verify immediately before `Write`**: repeat steps 1-4; if the planned number is now taken, silently bump to the next free number. Never call `Write` before completing the re-scan. Close with a parameter table: family, directory, prefix, and notes (`uat` is excluded because its number mirrors its task). Use only `NNNN` placeholders.
- [x] Keep the doc tight. It is a reference, not a tutorial, and each section should be shorter than the sum of the restatements it replaces.

### 3. Wire the hygiene rule <!-- agent: general-purpose -->

- [x] For each hygiene consumer confirmed in Step 1, `Read` the skill, then replace each hygiene sentence with one pointer: `Edit only — see \`~/.claude/skills/_shared/SKILL-BOILERPLATE.md\` § Edit hygiene.` Where a skill has both a step-level sentence and a trailing "Rules" bullet saying the same thing (for example `req-update`, `prd-finalize`, `req-retire`, `roadmap-create`, `adr-finalize`), collapse to a single pointer.
- [x] Preserve skill-specific exceptions and additions verbatim: `req-retire`'s "`Bash` is permitted only for `git mv`"; `tackle`'s status-marker list (`[x]`/`[WIP]`/`[BLOCKED: reason]`/`[FAILED: reason]`); `adr-finalize`'s "touch only the target block; siblings are inviolate"; `git-commit`'s per-file `Edit` rule; `update-docs`'s "never `perl -i`".
- [x] Do not touch `uat-walk`, `uat-auto`, `uat-auto-plus`, or `UAT-CORE.md` (see Approach). <!-- Step 3 done: 19 skills wired; task-trash is not a consumer (no hygiene text); task-update no longer permits Write for full rewrite (doc forbids it); uat-generate ~248 left (new-file Write legit); power-mode line 48 left (out of scope) -->
<!-- Updated: 2026-09-19 -->


### 4. Wire number allocation <!-- agent: general-purpose -->

- [x] In `task-add` (Step 4 and Step 7a), `roadmap-create` (Step 2/3 and Step 5), `bug-create`, `prd-create`, and `adr-create` (Step 2 and its re-scan), replace each restated algorithm with a pointer plus its parameters, for example: `Allocate the next ID per \`~/.claude/skills/_shared/SKILL-BOILERPLATE.md\` § Number allocation (family: \`wiki/work/tasks/\`, prefix: \`TASK-\`, also scan \`index.md\` for reserved IDs).`
- [x] Keep each skill's re-verify step as its own numbered step (Step 7a, Step 5, and so on), reduced to "repeat § Number allocation step 6; never call `Write` before completing it". The ordering guarantee must stay visible in the skill flow, not buried in the shared doc.
<!-- Step 4 note: test/wiki-work-naming-convention.test.js EDGE-004 pinned the removed task-add text (`zero-pad the result to 4 digits`), contradicting this task's own absence requirement; retargeted to assert the pointer in task-add and the padding/width text in the shared doc. Flagged to team-lead. Also fixed stale bare NNNN- in bug-file/decision-create. -->
- [x] Preserve non-algorithm content in the same sentences: `req-create`'s slug-derivation rules and example, `roadmap-create` and `task-add`'s "continue from the current max" repo note (now covered by the shared doc; drop the duplicate), and the `AskUserQuestion` confirm-if-non-obvious clause.

### 5. Normalize the Prereqs lines <!-- agent: general-purpose -->

<!-- Step 5 result: 45 Prereqs lines in lib/skills/*/SKILL.md (Step 1's "49" was an overcount), 0 non-conforming, all lifecycle families correct; no edits. 13 skills have no Prereqs line (out of scope). Observation: task-add/uat-generate/bug-triage lack a lifecycle ref; uat-skip spans two families (grammar allows one) — left as-is per "edit only non-conforming". -->
- [x] Compare every `**Prereqs:**` line found in Step 1 against the grammar in `§ Prereqs`. Edit only the non-conforming ones (`Edit`, one per skill, minimal change). Do not convert any to a pointer.
- [x] Where a skill legitimately needs a different lifecycle reference than its current line names, adjust to the grammar. Where the grammar cannot express a real need, extend the grammar in the shared doc and the test regex in Step 7 rather than special-casing the skill.

### 6. Register the new directory <!-- agent: general-purpose -->

- [x] `lib/skills/README.md`: revise the intro paragraph, which currently says `uat-walk/` is "the one skill with an extra file beyond `SKILL.md`". State that `_shared/` holds reference docs consumed by other skills (it has no `SKILL.md` and is not a slash command), and keep the `uat-walk`/`UAT-CORE.md` sentence accurate.
- [x] `CLAUDE.md` "Key Files" `lib/skills/` bullet: add one clause noting `_shared/` reference docs. If sibling tasks have already added this clause, do not duplicate it.
- [x] `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md`: revise the "Universal boilerplate" section in place to note the prereqs / hygiene / number-allocation extraction is done, with a link to the `_shared/` doc path, and update `updated:`. Leave the file/ID-resolution bullet as-is, since the sibling task covers it. Add a `wiki/log.md` entry and refresh `wiki/hot.md` per the normal wiki-edit procedure.

### 7. Add a contract test <!-- agent: general-purpose -->

- [x] Create `test/skill-boilerplate.test.js`, zero-dependency (`node:test` + `node:assert/strict`), hermetic (repo-local reads only), header-commented in the style of `test/task-add-origin-bug-scan.test.js` and `test/prior-art-scan.test.js`. Cases:
  - The doc `lib/skills/_shared/SKILL-BOILERPLATE.md` exists and contains the three headings `## Prereqs`, `## Edit hygiene`, `## Number allocation`.
  - Every `lib/skills/*/SKILL.md` that has a line beginning `**Prereqs:**` matches the grammar regex `^\*\*Prereqs:\*\* obey \`wiki/guides/mcp-tools\.md\`( \+ \`wiki/work/(tasks|bugs|uat)/lifecycle\.md\`)?(; run /primer if not done this session)?\.$`. Report all offenders in the assertion message.
  - Each of the five allocation consumers references `_shared/SKILL-BOILERPLATE.md` and no longer contains the restated algorithm (assert the absence of `zero-pad the result to 4 digits`).
  - The hygiene consumers from Step 3 reference the shared doc, and none contains a hygiene sentence matching `never .*sed.*awk` outside an explicit allow-list (name the allow-list entries and why).
  - The doc contains no bare 3-digit placeholder tokens (`TASK-NNN(?!N)` and the three siblings).
- [x] Run `node --test test/skill-boilerplate.test.js test/wiki-work-naming-convention.test.js test/skill-frontmatter-aliases.test.js` and confirm all pass. `skill-frontmatter-aliases` and other suites pin literal text in `task-add`, `bug-create`, `prd-create`, `roadmap-create`, and `adr-create`, so if a wiring edit breaks an existing assertion, restore the pinned text rather than editing the assertion.

### 8. Verify <!-- agent: general-purpose -->

<!-- Step 8 result: hygiene 42 -> 15 lines (all remaining are documented exceptions/excluded/read-hygiene/unrelated); allocation 26 -> ~1 real (uat-skip:51 "highest existing NNN + 1" for a UAT stub is pre-existing, contradicts "uat number mirrors its task" and was left: uat-skip is not a consumer). npm test: 701 tests, 696 pass, 5 known pre-existing failures. Pre-existing unrelated: task-add Step 3 says "Step 9" for roadmap update (actually Step 11). -->
- [x] Re-run the Step 1 pattern searches and confirm that no allocation algorithm and no `sed`/`awk`/`echo >>` hygiene sentence remains in any wired skill apart from the documented exceptions. Report the before/after line counts.
- [x] Run `npm test` and confirm the full suite is green.
- [x] Simulate the pointer path: read one wired skill (`task-add`) end to end and confirm the pointer, parameters, and re-verify step read coherently without opening the shared doc for anything except the algorithm itself.
