# skills/

One directory per Claude Code skill, each containing a `SKILL.md` (Skills directory format). `install-global.sh` copies this whole folder verbatim to `~/.claude/skills/`, which makes every skill below available as a `/slash-command` in any Claude Code session on the machine — not just in this repo.

Most skills operate on the LLM Wiki (`wiki/`, `raw/`) described in the root `CLAUDE.md`; a handful are general-purpose utilities unrelated to the wiki. Two things sit beside the per-skill `SKILL.md` files: `uat-walk/UAT-CORE.md`, a shared module of UAT walkthrough logic factored out so other UAT skills (`uat-auto`, `uat-auto-plus`) can reference it instead of duplicating it, and the `_shared/` directory, which holds reference docs (for example `ARCHIVE-WORK-ITEM.md`, `ID-RESOLUTION.md`, and `SKILL-BOILERPLATE.md` — the Prereqs grammar, Edit hygiene, and Number allocation) that several skills point at instead of restating. `_shared/` has no `SKILL.md` and is not a slash command.

## Wiki operations

| Skill | Purpose |
|-------|---------|
| `wiki-ingest` | Process a source from `raw/` into the wiki — summary page, entity/concept updates, index + log entry |
| `wiki-query` | Answer a question from the wiki with citations; auto-ingest relevant un-ingested `raw/` sources when coverage is missing; offer to file the answer back as a new page |
| `wiki-lint` | Health-check the wiki — contradictions, stale claims, orphan pages, missing concept pages, missing cross-references, never-ingested raw sources |
| `wiki-archive` | Batch-move terminal tasks, UAT and bugs into `<family>/archive/`, update `archive/index.md`, log the operation (roadmaps, decisions and requirements close in place and are never archived) |
| `wiki-rotate-log` | Rotate `wiki/log.md` into a timestamped archive file once it exceeds ~500 lines |
| `wiki-tidy` | One-shot cleanup: lint, archive terminal tasks/UAT/bugs, rotate the log if overgrown — phases confirmed in sequence |

## Requirements

| Skill | Purpose |
|-------|---------|
| `prd-create` | Draft a new requirement (PRD-NNNN) via Socratic Q&A — problem, personas, user stories, success metrics, non-goals |
| `prd-finalize` | Run a completeness audit on a draft requirement, resolve gaps via Q&A, flip `status: draft → approved` |
| `prd-compile` | Compile a requirement into a running, self-verifying system — routes every claim to its cheapest re-runnable check |
| `prd-deprecate` | Deprecate a PRD — set `status: retired`, document why, move its index row to Closed, log it; the file never moves |
| `prd-assess` | Survey all active PRDs together — flag approved requirements with no downstream ADRs or tasks and stale drafts, detect blocking open decisions, and rank them into one prioritized list with a status update for each (read-only) |

## Decisions

| Skill | Purpose |
|-------|---------|
| `adr-extract` | Extract Architecturally Significant Requirements from a PRD (or any document), cross-check existing ADRs, and propose Decision Group candidates for `/adr-create` |
| `adr-create` | Create a Decision Group file with one or more proposed decisions, table-only comparisons, and mermaid flowcharts |
| `adr-finalize` | Finalize a single proposed decision — E-C-A-D-R audit, supersession check, flip to `accepted` |
| `adr-walkthrough` | Walk a decision file decision-by-decision, confirming each architecture choice with the user via Q&A |
| `adr-deprecate` | Deprecate a single accepted decision (no successor) — set `status: deprecated`, document why, move its index row to Closed, log it; the file never moves |
| `adr-next` | Read-only — find the first accepted decision missing a task reference; suggest `/task-create` |
| `adr-assess` | Survey all active ADRs together — surface proposed decisions and accepted decisions with no task, follow supersession chains, and rank decision blocks into one prioritized list with a status update for each (read-only) |

## Roadmaps

| Skill | Purpose |
|-------|---------|
| `roadmap-create` | Create an execution-plan roadmap via short Socratic Q&A — goal, phases, hybrid task-link/inline checklist |
| `roadmap-assess` | Survey all active roadmaps together — cross-roadmap dependencies, prioritized list, status update per roadmap |
| `roadmap-next` | Point at the first unchecked item(s) in a single roadmap (argument required), grouped into parallelizable waves; flips a fully checked roadmap to `done` and moves its index row to Closed (file stays in place) |

## Tasks

| Skill | Purpose |
|-------|---------|
| `task-create` | Create a structured, execution-ready task file in `wiki/work/tasks/` |
| `task-assess` | Generate a dependency graph of active tasks — what blocks what, what can run in parallel; flags unannotated implementations |
| `task-close` | Close out an abandoned task and its related UAT files — set status `trashed`, move to `archive/`, remove all active-index references |

## UAT (user acceptance testing)

| Skill | Purpose |
|-------|---------|
| `uat-create` | Create UAT tests in `wiki/work/uat/` for a task |
| `uat-walk` | Interactively walk a pending UAT file test-by-test with the user (shares logic via `UAT-CORE.md`) |
| `uat-auto` | Non-interactively run every test in a pending UAT file and auto-judge verdicts (headless, fail-closed) |
| `uat-auto-plus` | Autonomous-fix variant of `uat-auto` — diagnoses failures, fixes them, re-runs until green or attempts exhausted; for `--dangerously-skip-permissions` agents |
| `uat-skip` | Skip UAT for a task — set UAT and task `status: skipped/done`, remove index rows, auto-checkoff the roadmap |
| `uat-assess` | Survey all active UATs together — group them by what each is waiting on (failing cases, partial walks, auto-runnable, manual-only cases, stubs), rank by what each unblocks, and give a status update with a suggested next command for each (read-only) |
| `whats-next` | Survey ALL open work across every family — tasks (in or out of a roadmap), UATs, bugs, roadmaps, ADR blocks and PRDs — and rank one prioritized do-next list with parallel waves (read-only) |

## Bugs

| Skill | Purpose |
|-------|---------|
| `bug-create` | Create a new bug report with required-on-report fields; append it to the bug index |
| `bug-assess` | Survey all active bugs together — batch-triage any still-open reports first, then rank the active set by priority, severity, and impact into a single prioritized fix order with a status update for each bug |
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
| `power-mode` | Orchestrator for parallel agent teams — drives roadmap or task files through the full tackle → uat-create → uat-auto pipeline |
| `autopilot` | One unattended tick for `/loop 1h /autopilot` — if idle, `/whats-next` then `/power-mode` on the first drivable item; if no work is left, `/research` similar products against this codebase; if still none, create a roadmap from the newest research |

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
| `usage-report` | Locally parse session logs for per-project token/cost rollups by model and skill (offline, read-only) |

## Security

| Skill | Purpose |
|-------|---------|
| `security-audit` | Audit an LLM/AI application across 11 categories — internal posture (observability, rate limiting, access controls, HITL policy, benchmarking) and external threats (prompt injection, data leakage, output XSS, excessive agency, supply chain, token DoS) |
| `architecture-audit` | Audit an AI agent/application's architecture across 9 categories — design fit (single- vs. multi-agent justification, orchestration topology, delegation hygiene, framework/SDK fit, compounding-error containment) and operational readiness (observability, cost/resource controls, context/state management, cross-agent safety composition) |

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
| `bootstrap-config` | View, edit, and reset the stored bootstrap preferences that decide which installer prompts are asked and how consent-gated skills behave |
| `anti-slop` | Detect and remove AI writing patterns from copy so it reads like a person, not a language model |
| `frontend-taste` | Wire the house-style design system (`~/code/house-style`) into the current project — tokens, Tailwind preset, component patterns, base CSS layer |
| `elevator-pitch` | Generate a short, punchy elevator pitch for a project |

## Conventions

- Every skill directory name matches its slash-command name (`lib/skills/prd-create/` → `/prd-create`).
- Frontmatter in each `SKILL.md` (`name`, `description`, optional `category`/`model`) drives Claude Code's skill picker — the `description` is what decides relevance, so it should stay specific about triggers and scope.
- Skills that read/write the wiki follow the family lifecycle files under `wiki/work/*/lifecycle.md` in the target project, not anything hardcoded here — this repo's own `wiki/` is just the reference instance.
- New skills should be added as a new subdirectory with a `SKILL.md`, then listed in the appropriate table above and in the root `CLAUDE.md` Custom Commands table.
