# Skills Format and Model-Selection Convention

## File Layout
Skills live at `lib/skills/<name>/SKILL.md` (directory format). Installed globally to `~/.claude/skills/` by `lib/scripts/install-global.sh`.

## Frontmatter Template
```yaml
---
name: <command-name>
description: <one-line description — max ~1536 chars combined>
category: <researching | planning | executing>
model: <see selection table below>
effort: high          # omit unless the skill needs deep reasoning
disable-model-invocation: true   # omit for skills where Claude auto-invoke is desired
argument-hint: <preserve from original if present>
---
```

## Category Field

Every skill carries a `category:` denoting what kind of work it does:

- **researching** — gathers/analyzes information; deliverable is a report, answer, or diagnosis; read-mostly. (`research`, `research-company`, `company-align`, `gap-assess`, `security-audit`, `debug-logs`, `eval-gap`, `task-audit`, `wiki-query`, `wiki-lint`, `wiki-ingest`, `primer`, `decision-next`, `roadmap-next`)
- **planning** — creates or maintains planning artifacts: requirements, decisions, roadmaps, tasks, UAT specs, porting/extraction plans, and their lifecycle bookkeeping. (`port-feature`, `extract-feature`, `decision-create`, `decision-finalize`, `decision-walkthrough`, `req-create`, `req-finalize`, `req-update`, `req-retire`, `req-extract-decisions`, `roadmap-create`, `roadmap-add`, `task-add`, `task-update`, `task-trash`, `uat-generate`, `uat-skip`, `bug-file`, `bug-triage`)
- **executing** — changes code/docs/config, runs or verifies the system, or produces final deliverable artifacts. (`req-compile`, `power-mode`, `uat-auto-plus`, `now`, `tackle`, `uat-walk`, `uat-auto`, `eval-create`, `eval-run`, `lint`, `bug-close`, `simplify`, `update-docs`, `serena-config`, `git-commit`, `frontend-taste`, `demo`, `elevator-pitch`, `project-readme`, `marp-slideshow`, `mermaid-flowchart`, `anti-slop`)

## Model Selection

Model is chosen by reasoning depth, not category — each category spans all three tiers. `claude-opus-4-8` is retired from the lineup (replaced by Fable 5 at the top).

| Tier | Model | Commands |
|---|---|---|
| **Deep reasoning / autonomous** (open-ended research, architecture, headless autonomy) | `claude-opus-4` | `research`, `research-company`, `company-align`, `gap-assess`, `security-audit`, `port-feature`, `extract-feature`, `decision-create`, `req-extract-decisions`, `req-compile`, `power-mode`, `uat-auto-plus` |
| **Default** (well-specified work needing judgment) | `claude-sonnet-4-6` | everything not listed in the other two tiers |
| **Mechanical / bookkeeping** (status flips, appends, simple commits, context refresh) | `claude-haiku-4-5-20251001` | `primer`, `git-commit`, `task-trash`, `req-retire`, `decision-next`, `roadmap-next`, `roadmap-add`, `uat-skip`, `serena-config` |

## Adding a New Skill
1. Create `lib/skills/<name>/SKILL.md` (Write tool creates dir automatically; filename is uppercase `SKILL.md`)
2. Add frontmatter with `category:`, `model:`, and invocation flag per the tables above
3. Preserve any `argument-hint:` from any legacy version
4. Skills are auto-picked up by `install-global.sh` rsync — no script changes needed
