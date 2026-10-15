# SKILL-BOILERPLATE — shared boilerplate for wiki-family skills

The **Prereqs** grammar, **Edit hygiene** rules, and **Number allocation** algorithm that recur across the wiki-family skills live here once. Consumers: the `task-*`, `bug-*`, `uat-*`, `prd-*`, `req-*`, `adr-*`, `roadmap-*`, `wiki-*`, `tackle`, and `power-mode` skills. **Each consuming skill references a section by name and never restates it.** Only the Prereqs line stays inline (see below); `test/skill-boilerplate.test.js` enforces it.

Pointer forms, from a consumer's `SKILL.md`: `Edit only — see ~/.claude/skills/_shared/SKILL-BOILERPLATE.md § Edit hygiene.` and `Allocate the next ID per ~/.claude/skills/_shared/SKILL-BOILERPLATE.md § Number allocation (family: <dir>, prefix: <PREFIX>).`

## Prereqs

Every consuming skill opens with exactly one of these verbatim forms:

1. `**Prereqs:** obey \`wiki/guides/mcp-tools.md\`.`
2. `**Prereqs:** obey \`wiki/guides/mcp-tools.md\`; run /primer if not done this session.`
3. Either form with ` + \`wiki/work/<family>/lifecycle.md\`` after the `mcp-tools.md` reference, where `<family>` is one of `tasks`, `bugs`, `uat`.

Choosing:

- Add the `/primer` clause when the skill does codebase or wiki exploration.
- Add the lifecycle reference when the skill reads or writes that family's files.

The line stays inline because it is the instruction to read `mcp-tools.md`: hiding it behind a pointer costs an extra Read on every invocation with no drift benefit. Single-sourcing the grammar here plus test enforcement gives drift protection without that Read.

## Edit hygiene

- Never use `sed`, `awk`, `perl -i`, `echo >>`, `cat <<EOF`, or any shell redirection to modify a markdown or config file.
- Use `Read` then `Edit`: one `Edit` per change, even when there are many. Never `Write` to rewrite an existing file in full.
- Appending to `wiki/log.md` or an index file is a `Read` then `Edit`, not `echo >>`.
- Bash is reserved for commands with no dedicated tool (for example `git mv`).

See `wiki/guides/mcp-tools.md` "Common anti-patterns". Each violation triggers a permission prompt.

## Number allocation

Parameterized by (family directory, ID prefix); values in the table below.

1. `list_dir` both `wiki/work/<family>/` and `wiki/work/<family>/archive/`; skip either that does not exist.
2. Collect the numeric value of every `<PREFIX><digits>-` filename prefix across both, regardless of digit count (legacy files are 3-digit, new ones 4-digit). Compare as integers, ignoring leading zeros.
3. Families flagged **Index scan: yes** also scan the family `index.md` for reserved IDs and include them in the max. Match both widths (for roadmaps, `ROADMAP-\d+`, never a 3-digit-only pattern).
4. New number = `max + 1`, zero-padded to 4 digits. In a brand-new project the first ID is `<PREFIX>0001`; in an existing project continue from the current max, never restart at 1.
5. Never re-use a number. Terminal items keep their ID forever, in `archive/`.
6. **Re-verify immediately before `Write`:** repeat steps 1-4. If the planned number is now taken, silently bump to the next free number. Never call `Write` before completing the re-scan.

| Family | Directory | Prefix | Index scan | Notes |
|--------|-----------|--------|------------|-------|
| tasks | `wiki/work/tasks/` | `TASK-` | yes | e.g. `TASK-NNNN-slug.md` |
| roadmaps | `wiki/work/roadmaps/` | `ROADMAP-` | yes | index scan must match 3- and 4-digit IDs |
| bugs | `wiki/work/bugs/` | `BUG-` | yes | real filenames are `BUG-NNNN-slug.md`; `bug-create` previously said a bare `NNNN-` prefix, and the lifecycle prefix wins |
| requirements | `wiki/work/requirements/` | `PRD-` | no | also count legacy `REQ-` filenames until migrated, so a number is never reused (the migration keeps numbers) |
| decisions | `wiki/work/decisions/` | `ADR-` | no | also count legacy `DEC-` filenames until migrated — one number sequence across both prefixes, so a new ADR never collides with an existing `DEC-` item (the migration keeps numbers); new filenames are `ADR-NNNN-slug.md`, blocks are `ADR-NNNN#DM`; `adr-create` previously said a bare `NNNN-` prefix, and the lifecycle prefix wins |

`uat` is excluded: its number mirrors its task's number, so it is never allocated.
