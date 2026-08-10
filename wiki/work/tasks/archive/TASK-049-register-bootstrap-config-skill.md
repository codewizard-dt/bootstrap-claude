---
id: TASK-049
title: "Register /bootstrap-config in lib/skills/README.md and the CLAUDE.md Custom Commands table"
status: done
created: 2026-08-07
updated: 2026-08-07
part_of: ROADMAP-005
depends_on: []
blocks: [TASK-052]
parallel_safe_with: [TASK-050, TASK-051]
uat: "[[UAT-049]]"
tags: [prefs, skills, docs, roadmap-005]
---

# TASK-049 — Register /bootstrap-config in lib/skills/README.md and the CLAUDE.md Custom Commands table

part_of::[[ROADMAP-005]]

## Objective

`lib/skills/bootstrap-config/SKILL.md` shipped in ROADMAP-005 Phase 3 (TASK-048), which deliberately excluded its registration so a concurrent Phase 4 pass could own the two index files without a collision. This task closes that gap: add `/bootstrap-config` to `lib/skills/README.md`'s `## Misc utility` table and to the `## Custom Commands` table in the root `CLAUDE.md`. It also removes the tripwire test that TASK-048 left behind to make this exact moment visible.

**Two files are edited, and only two** — plus the deletion of one test block. See "Registration points" below: the other candidate files were checked and are deliberately out of scope.

## Approach

**The skill's frontmatter is the source of truth for every cell.** Do not paraphrase from the SKILL.md body. `lib/skills/bootstrap-config/SKILL.md` declares:

```yaml
name: bootstrap-config
description: View, edit, and reset the stored bootstrap preferences that decide which installer prompts are asked and how consent-gated skills behave
category: executing
model: claude-haiku-4-5-20251001
argument-hint: [view | edit | reset] [--global | --project]
```

The `argument-hint` is what belongs in `CLAUDE.md`'s command column, matching how every other argument-taking command in that table is written (`/wiki-archive [family]`, `/task-add <desc>`). The `description` is the basis for the Purpose cell, condensed — `CLAUDE.md` rows are one line.

**Registration points — exactly two, verified.** These were checked so the task does not fan out into files that only look relevant:

| File | Table | In scope? |
|---|---|---|
| `lib/skills/README.md` | `## Misc utility` (line ~129) | **Yes** |
| `CLAUDE.md` | `## Custom Commands` | **Yes** |
| `lib/scripts/templates/CLAUDE-wiki.md` | Wiki operations | **No** — wiki skills only; `/bootstrap-config` is not a wiki operation, and this template is delivered into *target* projects |
| Root `README.md` | — | **No** — it has no command list at all |

Do **not** touch the two out-of-scope files. `lib/skills/README.md:145` states the convention this task is satisfying: *"New skills should be added as a new subdirectory with a `SKILL.md`, then listed in the appropriate table above and in the root `CLAUDE.md` Custom Commands table."*

**`## Misc utility` is the right table.** The skill's own `category: executing` is Claude Code frontmatter, not a `lib/skills/README.md` section name — the README's sections are topical (`Wiki operations`, `Tasks`, `Docs & quality`, …), and there is no `Executing` section. `/bootstrap-config` is an interactive config editor, which makes `serena-config` its nearest neighbour; both live under `## Misc utility`.

**The Phase 3/4 tripwire must be deleted, not worked around.** `test/bootstrap-config-skill.test.js:364-376` asserts that *neither* `lib/skills/README.md` nor `CLAUDE.md` contains the string `bootstrap-config`. It will fail the moment this task's first edit lands. That is by design — its own failure message says so:

> `${rel} now mentions bootstrap-config. If ROADMAP-005 Phase 4 has landed, that is correct — delete this test. If not, the Phase 3/4 boundary was crossed by an unplanned edit`

Deleting the whole `test(...)` block **and** its now-orphaned `// Phase boundary` banner comment is the correct resolution. Do not weaken the assertion, skip the test, or add an exception — a skipped test reads as a passing one and the boundary it guarded no longer exists.

## Steps

### 1. Read the three inputs <!-- agent: general-purpose -->

- [x] Read `lib/skills/bootstrap-config/SKILL.md` frontmatter (lines 1–12) — copy `description` and `argument-hint` verbatim rather than re-deriving them.
- [x] Read `lib/skills/README.md` around `## Misc utility` (line ~129) to capture the exact table shape: header `| Skill | Purpose |`, and entries written as a **bare skill name in backticks** (`` `serena-config` ``) with **no** leading slash.
- [x] Read the `## Custom Commands` table in `CLAUDE.md` to capture its contrasting shape: header `| Command | Purpose |`, entries written **with** a leading slash and their argument hints (`` `/serena-config` ``, `` `/task-add <desc>` ``).
  - The two tables use different conventions. Matching each one locally matters more than making them match each other.

### 2. Add the row to `lib/skills/README.md` <!-- agent: general-purpose -->

- [x] `Edit` the `## Misc utility` table, inserting immediately **after** the `serena-config` row (line ~135) so the two interactive config editors sit together:
  ```
  | `bootstrap-config` | View, edit, and reset the stored bootstrap preferences that decide which installer prompts are asked and how consent-gated skills behave |
  ```
- [x] Bare name, no leading slash — match the surrounding rows exactly. Landed at `lib/skills/README.md:137`.

### 3. Add the row to the `CLAUDE.md` Custom Commands table <!-- agent: general-purpose -->

- [x] `Edit` the `## Custom Commands` table, inserting immediately **after** the `/serena-config` row:
  ```
  | `/bootstrap-config [view \| edit \| reset] [--global \| --project]` | View, edit, and reset stored bootstrap preferences — which installer prompts get asked, and how consent-gated skills behave |
  ```
- [x] **Escape the pipes.** The `argument-hint` contains `|` characters, which terminate a markdown table cell. They must be written `\|` or the row renders broken. This is the single most likely defect in this task.
- [x] Verify the rendered row still has exactly two cells. Landed at `CLAUDE.md:99`.

### 4. Delete the Phase 3/4 tripwire test <!-- agent: general-purpose -->

- [x] Open `test/bootstrap-config-skill.test.js` and delete the entire test block at lines 364–376:
  `test('bootstrap-config: registration is still Phase 4 — the skill is not listed in README or CLAUDE.md', ...)`.
- [x] Also delete its section banner immediately above (lines ~360–362):
  ```js
  // ---------------------------------------------------------------------------
  // Phase boundary
  // ---------------------------------------------------------------------------
  ```
  It documented only this one test and is orphaned once the test is gone.
- [x] Do **not** replace it with a skip, an inverted assertion, or a "now it must be listed" test. If a positive registration check is wanted, that is a separate decision — the tripwire's stated resolution is deletion.
- [x] Leave every other test in the file untouched (file now 13/13 passing, was 14); they cover the skill's claims about the helper and schema and are unrelated.

### 5. Verify <!-- agent: general-purpose -->

- [x] Run `npm test`. Expect the suite total to drop by exactly **1** (290 → 289) with 0 failures and 0 skipped. A failure count above zero here almost certainly means the tripwire was left in place. **Observed: tests 289 / pass 289 / fail 0 / skipped 0, exit 0.**
- [x] Confirm both tables render: no broken row in `CLAUDE.md` (the escaped pipes), and the new `lib/skills/README.md` row aligned with its neighbours.
- [x] Confirm `grep`-equivalent search for `bootstrap-config` now returns hits in exactly `lib/skills/README.md`, `CLAUDE.md`, `lib/skills/bootstrap-config/SKILL.md`, and `test/bootstrap-config-skill.test.js` (the remaining tests) — and **not** in `lib/scripts/templates/CLAUDE-wiki.md` or the root `README.md`.
- [x] Do **not** edit `lib/scripts/README.md` — the helper's documentation is TASK-050's job, and a duplicate edit would collide. Not touched.

<!-- Updated: 2026-08-07 -->

**Execution notes**
- `lib/skills/README.md:137` — new row inserted between `serena-config` (136) and `anti-slop` (now 138).
- `CLAUDE.md:99` — new row inserted between `/serena-config` (98) and `/research <topic>` (now 100); pipes escaped as `\|` per the existing `/security-audit` convention.
- `test/bootstrap-config-skill.test.js` — deleted the tripwire test plus its orphaned `// Phase boundary` banner (old lines 361–378); file went 14 → 13 tests, all passing.
- Suite total: 290 → 289, 0 fail, 0 skipped.
- Out of scope and untouched, as specified: `lib/scripts/templates/CLAUDE-wiki.md`, root `README.md`, `lib/scripts/README.md` (TASK-050), `test/npm-pack-contents.test.js` (TASK-051).
