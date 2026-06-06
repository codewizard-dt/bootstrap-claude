# Skills Format and Model-Selection Convention

## File Layout
Skills live at `.claude/skills/<name>/SKILL.md` (modern directory format).
Legacy `.claude/commands/<name>.md` flat-files were removed in task 006.

## Frontmatter Template
```yaml
---
name: <command-name>
description: <one-line description used for auto-invocation matching — max ~1536 chars combined>
model: <see selection table below>
effort: high          # omit unless the skill needs deep reasoning; only on planning skills
disable-model-invocation: true   # omit for skills where Claude auto-invoke is desired
argument-hint: <preserve from original if present>
---
```

## Model Selection

| Category | Model | Commands |
|---|---|---|
| **Planning** (deep reasoning, architecture, ambiguity) | `claude-opus-4-7` | `research`, `now`, `adr-create`, `adr-finalize`, `task-add`, `task-update`, `uat-generate`, `project-readme`, `prd-create`, `prd-finalize`, `prd-extract-decisions`, `prd-update` |
| **Execution** (mechanical, well-specified) | `claude-sonnet-4-6` | `tackle`, `lint`, `simplify`, `task-trash`, `uat-auto`, `uat-skip`, `uat-walk`, `update-docs`, `serena-config`, `marp-slideshow`, `mermaid-flowchart`, `prd-trash`, `adr-walkthrough`, `typecheck` |
| **Lightweight** (context refresh, simple commits, no heavy reasoning) | `claude-haiku-4-5-20251001` (or `haiku` shorthand) | `primer`, `git-commit` |

`effort: high` applies to: `research`, `now`, `adr-create`, `adr-finalize`, `prd-create`, `prd-finalize`, `prd-extract-decisions`.

## Invocation Flags

- **`disable-model-invocation: true`** — 18 of 20 skills; user must type `/name` to trigger. Use for any skill with side effects (commits, file moves, deployments) or that requires explicit user initiation.
- **Default (omit flag)** — `primer` only. Claude may auto-invoke `primer` to refresh context.

## Adding a New Skill
1. Create `.claude/skills/<name>/SKILL.md` (Write tool creates dir automatically)
2. Add frontmatter with `model:` and invocation flag per the table above
3. Preserve any `argument-hint:` from any legacy version
4. Update `sync-docs-scaffold.sh` rsync will automatically pick it up — no script changes needed
