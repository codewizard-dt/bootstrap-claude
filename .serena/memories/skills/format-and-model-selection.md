# Skills Format and Model-Selection Convention

## File Layout
Skills live at `lib/skills/<name>/SKILL.md` (directory format). Installed globally to `~/.claude/skills/` by `lib/scripts/install-global.sh`.

## Frontmatter Template
```yaml
---
name: <command-name>
description: <one-line description — max ~1536 chars combined>
model: <see selection table below>
effort: high          # omit unless the skill needs deep reasoning; only on planning skills
disable-model-invocation: true   # omit for skills where Claude auto-invoke is desired
argument-hint: <preserve from original if present>
---
```

## Model Selection

| Category | Model | Commands |
|---|---|---|
| **Planning** (deep reasoning, architecture, ambiguity) | `claude-opus-4-8` | `research`, `now`, `decision-create`, `decision-finalize`, `task-add`, `task-update`, `uat-generate`, `project-readme`, `req-create`, `req-finalize`, `req-extract-decisions`, `req-update` |
| **Execution** (mechanical, well-specified) | `claude-sonnet-4-6` | `tackle`, `lint`, `simplify`, `task-trash`, `uat-auto`, `uat-skip`, `uat-walk`, `update-docs`, `serena-config`, `marp-slideshow`, `mermaid-flowchart`, `req-retire`, `decision-walkthrough` |
| **Lightweight** (context refresh, simple commits) | `claude-haiku-4-5-20251001` | `primer`, `git-commit` |

## Adding a New Skill
1. Create `lib/skills/<name>/SKILL.md` (Write tool creates dir automatically)
2. Add frontmatter with `model:` and invocation flag per the table above
3. Preserve any `argument-hint:` from any legacy version
4. Skills are auto-picked up by `install-global.sh` rsync — no script changes needed
