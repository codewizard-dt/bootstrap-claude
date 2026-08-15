---
id: UAT-065
aliases: [UAT-065]
title: "UAT: Add aliases: [<ID>] to work-item frontmatter templates"
status: passed
task: TASK-065
created: 2026-08-15
updated: 2026-08-15
---

# UAT-065 — UAT: Add aliases: [<ID>] to work-item frontmatter templates

implements::[[TASK-065]]

> **Source task**: [[TASK-065]]
> **Generated**: 2026-08-15

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude` with TASK-065's changes present (6 `lib/skills/*/SKILL.md` files edited)
- [ ] Node.js available on PATH (for the repeatable unit test command, `node --test`)

---

## Test Cases

### UAT-EDGE-001: Direct id-adjacent inserts render aliases: [<ID>] in task-add, uat-generate, req-create
- **Scenario**: The three SKILL.md files that already had a literal fenced frontmatter block with an `id:` line (`task-add`, `uat-generate`, `req-create`) must each now render `aliases: [<ID>]` immediately after their `id:` line, before the next field.
- **Steps**:
  1. Open `lib/skills/task-add/SKILL.md` and locate the task-file frontmatter template (` ```yaml ` block containing `id: TASK-NNN`).
  2. Confirm the line immediately after `id: TASK-NNN` is `aliases: [TASK-NNN]`, and the line after that is `title: "<task title>"` (unchanged).
  3. Repeat for `lib/skills/uat-generate/SKILL.md` (`id: UAT-NNN` → `aliases: [UAT-NNN]` → `title: "UAT: [Task Title]"`).
  4. Repeat for `lib/skills/req-create/SKILL.md` (`id: REQ-NNN` → `aliases: [REQ-NNN]` → `type: requirement`).
- **Expected Result**: All three files show the new `aliases:` line landing directly after `id:` and before the pre-existing next field, with nothing else in the template altered.
- **Repeatable Unit Test**: Created: `test/skill-frontmatter-aliases.test.js`
- **Unit Test Command**: `node --test test/skill-frontmatter-aliases.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-002: Prose/table templates render an aliases entry in bug-file and roadmap-create
- **Scenario**: The two SKILL.md files that describe their frontmatter as prose bullets (`bug-file`) or a field table (`roadmap-create`) — deferring the literal schema to their family's `lifecycle.md` — must each gain a new `aliases` entry matching their existing style.
- **Steps**:
  1. Open `lib/skills/bug-file/SKILL.md`, Step 6 ("Write the Bug File"). Confirm the field bullet list now includes, immediately after `` - `Last updated`: today's date ``, a new bullet `` - `aliases: [BUG-NNNN]` — mirrors this file's own id: field so Obsidian's wikilink resolver can find it by short ID (ROADMAP-008) ``.
  2. Open `lib/skills/roadmap-create/SKILL.md`, Step 6 ("Write the roadmap file"). Confirm the field table now includes a new row `` | `aliases` | `[ROADMAP-NNN]` — mirrors the file's own `id:` value | `` positioned immediately after the `Status` row.
- **Expected Result**: Both files carry exactly one new `aliases`-bearing addition, in the surrounding template's own idiom (bullet for bug-file, table row for roadmap-create), with no other bullets/rows disturbed.
- **Repeatable Unit Test**: Created: `test/skill-frontmatter-aliases.test.js`
- **Unit Test Command**: `node --test test/skill-frontmatter-aliases.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-003: decision-create gains a new minimal frontmatter block with id: and aliases: only
- **Scenario**: `lib/skills/decision-create/SKILL.md` had no YAML frontmatter block at all in its Step 5 generated-file template (it opened directly with `# DEC-NNNN: <Decision-Group Title>`). TASK-065 adds a brand-new, deliberately minimal block — `id:` and `aliases:` only — without touching the existing `- **File created**` / `- **Last updated**` / `- **Tags (group)**` bullets or introducing `title:`/`created:`/`updated:`/`tags:` keys (reconciling with the fuller schema in `wiki/work/decisions/lifecycle.md` is explicitly out of scope).
- **Steps**:
  1. Open `lib/skills/decision-create/SKILL.md`, Step 5 ("Generate the file"), and locate the ` ````markdown ` fence.
  2. Confirm the fence now opens with `---` / `id: DEC-NNNN` / `aliases: [DEC-NNNN]` / `---`, a blank line, then the unchanged `# DEC-NNNN: <Decision-Group Title>` heading.
  3. Confirm the new block contains exactly two keys (`id:`, `aliases:`) — no `title:`, `created:`, `updated:`, or `tags:` — and that the `- **File created**` / `- **Last updated**` / `- **Tags (group)**` bullets further down are unchanged.
- **Expected Result**: A new 4-line frontmatter block (`---`/`id: DEC-NNNN`/`aliases: [DEC-NNNN]`/`---`) precedes the H1, containing only `id:` and `aliases:`; everything else in the template is untouched.
- **Repeatable Unit Test**: Created: `test/skill-frontmatter-aliases.test.js`
- **Unit Test Command**: `node --test test/skill-frontmatter-aliases.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-MANUAL-001: A task created via /task-add actually carries a working aliases: [TASK-NNN] line
- **Scenario**: The unit test and UAT-EDGE-001 confirm the *template prompt text* in `task-add/SKILL.md` now instructs the alias insertion. This case verifies the template change actually produces the expected output when `/task-add` is run end-to-end and a real task file is written — the thing a human ultimately cares about.
- **Steps**:
  1. Run `/task-add` for any trivial throwaway description (or observe the next real task creation in this repo).
  2. Open the resulting `wiki/work/tasks/TASK-NNN-slug.md`.
  3. Confirm its frontmatter contains `aliases: [TASK-NNN]` (matching its own `id: TASK-NNN`) immediately after the `id:` line.
- **Expected Result**: The newly created task file's frontmatter includes a correct, self-referencing `aliases: [TASK-NNN]` line — not just present in the SKILL.md prompt text, but actually rendered into a real generated file.
- **Repeatable Unit Test**: Not applicable: requires an actual `/task-add` skill invocation against the live task index (file creation, ID allocation, index update) — not deterministic, hermetic, pure logic that belongs in a `node:test` unit test; this is genuine end-to-end skill-output verification.
- [x] Pass <!-- 2026-08-15 -->

---

## Gaps

- The five sibling skills to `task-add` (`uat-generate`, `req-create`, `bug-file`, `roadmap-create`, `decision-create`) are not each given their own end-to-end MANUAL case here — their template-text change is structurally identical to `task-add`'s (confirmed by UAT-EDGE-001/002/003 and the unit test), and running all six skills end-to-end for this UAT would be disproportionate to the risk for an additive, single-line-per-file change. If a future regression is suspected in one of the other five, extend UAT-MANUAL-001's pattern to that skill.
- Obsidian actually resolving `[[TASK-NNN]]`-style short-ID links by clicking through requires the **Alias Linker** plugin, which is explicitly Phase 3 (a separate task/roadmap item) and not installed as part of TASK-065. No test case here exercises that resolution — it is out of scope until Phase 3 lands.
