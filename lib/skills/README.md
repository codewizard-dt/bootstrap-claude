# skills/

One directory per Claude Code skill, each containing a `SKILL.md` (Skills directory format). `install-global.sh` copies this whole folder verbatim to `~/.claude/skills/`, which makes every skill below available as a `/slash-command` in any Claude Code session on the machine — not just in this repo.

Most skills operate on the LLM Wiki (`wiki/`, `raw/`) described in the root `CLAUDE.md`; a handful are general-purpose utilities unrelated to the wiki. `uat-walk/` is the one skill with an extra file beyond `SKILL.md` — `UAT-CORE.md`, a shared module of UAT walkthrough logic factored out so other UAT skills (`uat-auto`, `uat-auto-plus`) can reference it instead of duplicating it.

## Wiki operations

| Skill | Purpose |
|-------|---------|
| `wiki-ingest` | Process a source from `raw/` into the wiki — summary page, entity/concept updates, index + log entry |
| `wiki-query` | Answer a question from the wiki with citations; offer to file the answer back as a new page |
| `wiki-lint` | Health-check the wiki — contradictions, stale claims, orphan pages, missing concept pages, missing cross-references, never-ingested raw sources |
| `wiki-archive` | Batch-move terminal work items into `<family>/archive/`, update `archive/index.md`, log the operation |
| `wiki-rotate-log` | Rotate `wiki/log.md` into a timestamped archive file once it exceeds ~500 lines |
| `wiki-tidy` | One-shot cleanup: lint, archive terminal items across all families, rotate the log if overgrown — phases confirmed in sequence |

## Requirements

| Skill | Purpose |
|-------|---------|
| `req-create` | Draft a new requirement (REQ-NNN) via Socratic Q&A — problem, personas, user stories, success metrics, non-goals |
| `req-finalize` | Run a completeness audit on a draft requirement, resolve gaps via Q&A, flip `status: draft → approved` |
| `req-extract-decisions` | Extract Architecturally Significant Requirements from an approved requirement and propose Decision Group candidates |
| `req-update` | Amend an approved requirement with a tracked, append-only Amendment block; direct edits for drafts |
| `req-compile` | Compile a requirement into a running, self-verifying system — routes every claim to its cheapest re-runnable check |
| `req-retire` | Retire a requirement — set `status: retired`, document why, move to `archive/`, log it |

## Decisions

| Skill | Purpose |
|-------|---------|
| `decision-create` | Create a Decision Group file with one or more proposed decisions, table-only comparisons, and mermaid flowcharts |
| `decision-finalize` | Finalize a single proposed decision — E-C-A-D-R audit, supersession check, flip to `accepted` |
| `decision-walkthrough` | Walk a decision file decision-by-decision, confirming each architecture choice with the user via Q&A |
| `decision-next` | Read-only — find the first accepted decision missing a task reference; suggest `/task-add` |

## Roadmaps

| Skill | Purpose |
|-------|---------|
| `roadmap-create` | Create an execution-plan roadmap via short Socratic Q&A — goal, phases, hybrid task-link/inline checklist |
| `roadmap-add` | Append a new item to an existing roadmap, optionally under a named phase |
| `roadmap-next` | Point at the first unchecked roadmap item(s), grouped into parallelizable waves; auto-archive fully-checked roadmaps |

## Tasks

| Skill | Purpose |
|-------|---------|
| `task-add` | Create a structured, execution-ready task file in `wiki/work/tasks/` |
| `task-update` | Assess and modify an existing task's scope or steps |
| `task-audit` | Generate a dependency graph of active tasks — what blocks what, what can run in parallel; flags unannotated implementations |
| `task-trash` | Trash a task and its related UAT files — move to `archive/`, remove all active-index references |

## UAT (user acceptance testing)

| Skill | Purpose |
|-------|---------|
| `uat-generate` | Generate UAT tests in `wiki/work/uat/` for a task |
| `uat-walk` | Interactively walk a pending UAT file test-by-test with the user (shares logic via `UAT-CORE.md`) |
| `uat-auto` | Non-interactively run every test in a pending UAT file and auto-judge verdicts (headless, fail-closed) |
| `uat-auto-plus` | Autonomous-fix variant of `uat-auto` — diagnoses failures, fixes them, re-runs until green or attempts exhausted; for `--dangerously-skip-permissions` agents |
| `uat-skip` | Skip UAT for a task — set UAT and task `status: skipped/done`, remove index rows, auto-checkoff the roadmap |

## Bugs

| Skill | Purpose |
|-------|---------|
| `bug-file` | File a new bug report with required-on-report fields; append it to the bug index |
| `bug-triage` | Set priority/assignee/tags/impact, then advance to `in-progress`, keep `triaged`, or reject (wontfix/duplicate/cannot-reproduce) and archive |
| `bug-close` | Close an in-progress bug — record root cause and resolution, require a regression test, move to `archive/` |

## Evals

| Skill | Purpose |
|-------|---------|
| `eval-create` | Assess eval coverage against the 5-stage framework and create new evals one at a time, with user approval at each step |
| `eval-run` | Execute the eval suite (golden sets, scenarios, replays), report pass/fail, surface regressions |
| `eval-gap` | Read-only gap report against the 5-stage framework — what's missing, what's thin, what to build next |

## Execution / orchestration

| Skill | Purpose |
|-------|---------|
| `now` | Plan and delegate a task to subagents (max 3 concurrent) |
| `tackle` | Execute an outlined task file step-by-step with subagent delegation |
| `power-mode` | Orchestrator for parallel agent teams — drives roadmap or task files through the full tackle → uat-generate → uat-auto pipeline |

## Docs & quality

| Skill | Purpose |
|-------|---------|
| `lint` | Get IDE diagnostics, then fix issues one-by-one in verify cycles |
| `update-docs` | Update task, UAT, and project documentation to reflect implementation work just completed |
| `simplify` | Analyze files or directories to remove redundancy and simplify complexity |
| `project-readme` | Generate or update a portfolio-ready project README |
| `demo` | Audit all project functionality and produce a 2-3 minute demo run book plus a Marp slideshow |
| `gap-assess` | Audit actual vs. expected functionality; produce an approvable gap-assessment plan (subagent-delegated, runs in plan mode) |
| `debug-logs` | Diagnose points of failure from session context, running processes, and log stores; produce ranked likely causes without applying fixes |

## Security

| Skill | Purpose |
|-------|---------|
| `security-audit` | Audit an LLM/AI application across 11 categories — internal posture (observability, rate limiting, access controls, HITL policy, benchmarking) and external threats (prompt injection, data leakage, output XSS, excessive agency, supply chain, token DoS) |

## Porting & extraction

| Skill | Purpose |
|-------|---------|
| `extract-feature` | Analyze a feature and produce a SOLID-compliant standalone module extraction plan (compatible with `port-feature`) |
| `port-feature` | Assess a feature in an external project and produce a concrete porting plan into the current project's conventions |

## Research

| Skill | Purpose |
|-------|---------|
| `research` | Deep research on a topic — codebase analysis, library docs, web search — writes the report plus primary sources to `raw/research/<slug>/` |
| `research-company` | Comprehensive company research — mission, operations, leadership, products/services, ~5 years of recent news |
| `company-align` | Analyse project–company fit against researched company context; surface gaps, strengths, and talking points |

## Presentation

| Skill | Purpose |
|-------|---------|
| `marp-slideshow` | Summarize a file and emit a Marp/Marpit slideshow markdown deck |
| `mermaid-flowchart` | Summarize an architecture file (markdown, YAML, Compose) into a Mermaid flowchart |
| `flashcard` | Turn markdown/research files into a self-contained interactive flashcard HTML page |

## Misc utility

| Skill | Purpose |
|-------|---------|
| `git-commit` | Stage all changes and commit with an auto-generated message |
| `primer` | Refresh codebase context via Serena memories |
| `serena-config` | Interactively configure Serena language servers in `.serena/project.yml` |
| `anti-slop` | Detect and remove AI writing patterns from copy so it reads like a person, not a language model |
| `frontend-taste` | Wire the house-style design system (`~/code/house-style`) into the current project — tokens, Tailwind preset, component patterns, base CSS layer |
| `elevator-pitch` | Generate a short, punchy elevator pitch for a project |

## Conventions

- Every skill directory name matches its slash-command name (`lib/skills/req-create/` → `/req-create`).
- Frontmatter in each `SKILL.md` (`name`, `description`, optional `category`/`model`) drives Claude Code's skill picker — the `description` is what decides relevance, so it should stay specific about triggers and scope.
- Skills that read/write the wiki follow the family lifecycle files under `wiki/work/*/lifecycle.md` in the target project, not anything hardcoded here — this repo's own `wiki/` is just the reference instance.
- New skills should be added as a new subdirectory with a `SKILL.md`, then listed in the appropriate table above and in the root `CLAUDE.md` Custom Commands table.
