---
id: TASK-0095
aliases: [TASK-0095]
title: "Align bug-file with bugs/lifecycle.md: write status open, not new"
status: pending-uat
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: [TASK-0094]
uat: "[[UAT-0095]]"
tags: [bugs, skill-design, schema-drift, correctness]
---

# TASK-0095 — Align bug-file with bugs/lifecycle.md: write status open, not new

relates_to::[[wiki-skill-boilerplate-duplication]]

## Objective

`lib/skills/bug-create/SKILL.md` tells the agent to create bugs with status `new`, but `wiki/work/bugs/lifecycle.md` defines the status enum as `open | triaged | in-progress | closed | wontfix | duplicate | cannot-reproduce` and names `open` as the filed state ("**open** — filed (`/bug-create`)"). Every downstream consumer (`bug-triage`, `bug-assess`, the bugs `index.md` header) already keys on `open`, so `new` is a value no other skill recognizes. Change `bug-create` to write, index, and report `open`, and lock it in with a repeatable test. Roadmap item: ROADMAP-0014 Phase 1.

## Approach

**Source-of-truth note**: edit `lib/skills/bug-create/SKILL.md` in this repo, never `~/.claude/skills/bug-create/` — that is a machine-local copy overwritten by `install-global.sh`.

**Research findings** (codebase-grounded; the drift is fully determined by two in-repo files, so no external sources were needed):

- `lifecycle.md` is the authority (line 18 enum; line 35 "open — filed (`/bug-create`)"). It needs **no change** — `new` appears nowhere in it.
- `new` occurs in exactly three places in `bug-create/SKILL.md`: the intro sentence (line 13, "with status `new`"), the Step 6 field list (line 88, `- Status: new`), and the Step 8 report (line 127, ``- Status: `new` ``). Step 7's index entry says `<status>` is "the status you set in Step 6", so it inherits the fix with no edit.
- `bug-triage` (Step 1 gate: "If `status: open` or `status: triaged` → proceed") and `bug-assess` (batch-triage runs "if at least one bug is `status: open`") would silently ignore a bug filed as `new`. Every existing bug on disk already says `open` (the agent filing BUG-0001..0008 followed the lifecycle over the skill), and `TASK-039` records this exact drift as "worth reconciling in the skill".
- No other `lib/`, `README.md`, `CLAUDE.md`, or test file references status `new` for bugs. `lib/skills/README.md` and `CLAUDE.md` describe `/bug-create` without naming a status, so they need no edit.

**Scope decision**: change the status value only. The same Step 6 list also uses Title-Case keys (`Priority`, `Assignee`, `Tags`, `Reported`, `Last updated`) and `—` placeholders where `lifecycle.md` specifies lowercase keys (`priority`, `assignee`, `tags`, `created`, `updated`, `reporter`) and `unassigned` as the assignee default. That is a separate, wider drift. It is deliberately **not** folded in, because `test/skill-frontmatter-aliases.test.js` asserts the exact adjacency of the `Last updated` and `aliases: [BUG-NNNN]` bullets, so a key-casing rewrite needs its own task and test update. Surface it to the lead as a candidate follow-up in the completion report.

**Concurrency note**: the ROADMAP-0014 Phase 2 boilerplate-extraction items may also edit `bug-create/SKILL.md` (prereqs line, number-allocation algorithm). This task touches only three status-value sites, so a merge is trivial, but do not `/tackle` it in the same parallel batch as such a task — read-then-write on the same file risks a lost edit. This is an orchestration note, not a logical dependency, so `depends_on`/`blocks` stay empty.

## Steps

### 1. Fix the three status sites in bug-create <!-- agent: general-purpose -->

- [x] In `lib/skills/bug-create/SKILL.md` line 13, change "with status `new`" to "with status `open`".
- [x] In Step 6 (line 88), change ``- `Status: new` `` to ``- `Status: open` ``. Leave the neighbouring bullets untouched — in particular the adjacent `Last updated` / `aliases: [BUG-NNNN]` pair, which `test/skill-frontmatter-aliases.test.js` asserts verbatim.
- [x] In Step 8 (line 127), change ``- Status: `new` `` to ``- Status: `open` ``.
- [x] Use `Edit` (one targeted call per site) — markdown file, per `wiki/guides/mcp-tools.md`. Never `sed`.
- [x] Do not edit `wiki/work/bugs/lifecycle.md` (already correct), Step 7 (inherits the value), or the `TASK-039` drift note (historical record).

### 2. Add a regression test <!-- agent: general-purpose -->

- [x] Create `test/bug-file-status-open.test.js`, zero-dependency (`node:test` + `node:assert` + `node:fs` + `node:path`), mirroring the header and helper style of `test/wiki-work-naming-convention.test.js` (`'use strict'`, `REPO = path.resolve(__dirname, '..')`, a `read(relPath)` helper).
- [x] Test 1: `bug-create/SKILL.md` contains `- \`Status: open\`` and ``- Status: `open` `` and the intro phrase ``with status `open` ``.
- [x] Test 2: `bug-create/SKILL.md` has no remaining status `new` — `assert.doesNotMatch` on `/Status: `?new\b/`, `/with status `new`/`, and ``/- Status: `new`/``.
- [x] Test 3 (schema anchor, guards against re-drift in either direction): parse the `status` row of `wiki/work/bugs/lifecycle.md`'s frontmatter table, extract the enum, and assert that `open` is its first member and that the status value written by `bug-create` Step 6 is a member of that enum.
- [x] Run `node --test test/bug-file-status-open.test.js` and then `npm test` to confirm the sibling suites (notably `skill-frontmatter-aliases.test.js`, `wiki-work-naming-convention.test.js`, `knowledge-link-flag.test.js`, `uat-fail-offers-bug-file.test.js`) still pass. (New test 3/3 pass; `npm test` 529/535 — 6 failures in `skill-frontmatter-aliases.test.js` [req-create, roadmap-create, task-add, uat-generate templates] and `task-typed-links.test.js` [task-add/task-audit], none touching bug-file; attributed to other in-flight tasks' files, not fixed here.)

### 3. Verify no other consumer references the old value <!-- agent: Explore -->

- [x] `mcp__serena__search_for_pattern` across `lib/`, `README.md`, `CLAUDE.md`, `wiki/work/bugs/`, and `test/` for status `new` applied to bugs (e.g. `/[Ss]tatus[: ]+[`"]?new\b/`); confirm zero hits outside historical records (`TASK-039`'s drift note, `TASK-065` archive, `ROADMAP-0014` itself, `wiki/log.md`).
- [x] Confirm that the bug rows in `wiki/work/bugs/index.md` all read `open`, consistent with the skill's Step 7 entry format.
- [x] Report any residual hit to the lead rather than editing historical wiki records.
