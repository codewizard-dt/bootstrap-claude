# Skills Format and Model-Selection Convention

_Verified against `lib/skills/*/SKILL.md` on 2026-08-06 (60 skills)._

## File Layout
Skills live at `lib/skills/<name>/SKILL.md` (directory format). Installed globally to `~/.claude/skills/` by `lib/scripts/install-global.sh`.

**A skill edit is not live until `install-global.sh` runs** — the `~/.claude/skills/` copy is an rsync of `lib/skills/`. Use `./lib/scripts/install-global.sh --skip-mcps` to sync skills/hooks/settings without touching MCP registration.

## Frontmatter Template
```yaml
---
name: <command-name>
description: <one-line description — max ~1536 chars combined>
category: <researching | planning | executing | wiki>
model: <see selection table below>
effort: high          # omit unless the skill needs deep reasoning
disable-model-invocation: true   # omit for skills where Claude auto-invoke is desired
argument-hint: <preserve from original if present>
---
```

## Category Field

- **researching** — gathers/analyzes information; deliverable is a report, answer, or diagnosis; read-mostly. (`research`, `research-company`, `company-align`, `gap-assess`, `security-audit`, `debug-logs`, `eval-gap`, `task-audit`, `flashcard`, `wiki-query`, `wiki-lint`, `wiki-ingest`, `primer`, `decision-next`, `roadmap-next`, `roadmap-assess`)
- **planning** — creates or maintains planning artifacts and their lifecycle bookkeeping. (`port-feature`, `extract-feature`, `decision-create`, `decision-finalize`, `decision-walkthrough`, `req-create`, `req-finalize`, `req-update`, `req-retire`, `req-extract-decisions`, `roadmap-create`, `task-add`, `task-update`, `task-trash`, `uat-generate`, `uat-skip`, `bug-file`, `bug-triage`)
- **executing** — changes code/docs/config, runs or verifies the system, or produces final deliverables. (`req-compile`, `power-mode`, `uat-auto-plus`, `now`, `tackle`, `uat-walk`, `uat-auto`, `eval-create`, `eval-run`, `lint`, `bug-close`, `simplify`, `update-docs`, `serena-config`, `git-commit`, `frontend-taste`, `demo`, `elevator-pitch`, `project-readme`, `marp-slideshow`, `mermaid-flowchart`, `anti-slop`)
- **wiki** — wiki-maintenance operations. Only three skills use it: `wiki-archive`, `wiki-rotate-log`, `wiki-tidy`. Note the asymmetry: the other wiki skills (`wiki-query`, `wiki-lint`, `wiki-ingest`) are filed as **researching**, not `wiki`.

## Model Selection

Model is chosen by reasoning depth, not category — each category spans all three tiers. The lineup is the Claude 5 family; older ids (`claude-opus-4-8`, `claude-sonnet-4-6`) are retired and must not be reintroduced. No skill uses Fable.

| Tier | Model | Commands |
|---|---|---|
| **Deep reasoning / autonomous** | `claude-opus-5` | `decision-create`, `extract-feature`, `gap-assess`, `port-feature`, `req-compile`, `req-extract-decisions`, `security-audit` (7 total) |
| **Default** (well-specified work needing judgment) | `claude-sonnet-5` | everything not listed in the other two tiers |
| **Mechanical / bookkeeping** | `claude-haiku-4-5-20251001` | `decision-next`, `git-commit`, `primer`, `req-retire`, `roadmap-next`, `serena-config`, `task-trash`, `uat-skip` (8 total) |

**Watch the deep tier — it shrank.** `research`, `research-company`, `company-align`, `power-mode`, and `uat-auto-plus` were once top-tier and now run on `claude-sonnet-5`. Do not "restore" them to opus from an older reading of this table.

## Adding a New Skill
1. Create `lib/skills/<name>/SKILL.md` (Write tool creates dir automatically; filename is uppercase `SKILL.md`)
2. Add frontmatter with `category:`, `model:`, and invocation flag per the tables above
3. Preserve any `argument-hint:` from any legacy version
4. Skills are auto-picked up by `install-global.sh` rsync — no script changes needed
5. If the skill is user-facing, add its one-line description to `lib/skills/README.md` **and** the command tables in `CLAUDE.md` (it appears in 2–3 places) plus `lib/scripts/templates/CLAUDE-wiki.md` for wiki skills — these drift easily
