# basic-project-setup — Project Overview

## Purpose
Project setup template for Claude Code. Contains reusable `.claude/` configurations (custom skills, guides) and MCP server setup instructions meant to be copied into other project repositories. Published as an npm package (`@codewizard-dt/bootstrap-claude`) with CLI commands `setup` and `update` (`npx bootstrap-claude setup` / `npx bootstrap-claude update`).

## Structure
- `.claude/skills/` — Custom skills in Skills directory format (20 total)
- `.docs/guides/mcp-tools.md` — MCP tool reference (cross-links to command-anti-patterns.md)
- `.docs/guides/task-lifecycle.md` — Task lifecycle conventions
- `.docs/guides/command-anti-patterns.md` — Shell-command and file-operation hygiene rules; defines the /tackle-vs-UAT verification split: static gates only in /tackle (bash -n, typecheck, lint, unit tests), runtime/E2E in UAT
- `.docs/tasks/` — Task tracking (`active/` → `completed/` → `trashed/`)
- `.docs/adr/` — Architecture Decision Log (ADL). Each file is a **Decision Group** with 1+ `## DM. <title>` blocks; each decision has independent `Status`, `Date`, `Deciders`, `Tags`. Identifier `ADR-NNNN#DM`. Per-decision supersession (atomic two-block cross-reference). README.md defines glossary, supersession rule, E-C-A-D-R Definition of Done, anti-patterns, file template, index format (one row per decision), relationship graph (per-decision nodes). Scaffold-only sync: `.gitkeep` propagates, ADR files are project-specific and never copied.
- `.docs/prd/` — Product Requirements Log (PRL). PRDs sit **upstream** of ADRs and tasks, capturing *what to build and why* (product perspective). Status lifecycle: `draft → approved → archived/superseded/trashed`. Subfolders: `active/`, `archived/`, `trashed/`. Scaffold-only sync: README.md + per-subfolder `.gitkeep` propagate; PRD files are project-specific and never copied. Hard boundary rule: **"A PRD never justifies architecture. An ADR never redefines product scope."** Approved PRDs are immutable in substance — changes via append-only `## Amendment N` blocks.
- `.docs/uat/` — UAT test tracking (`pending/` → `completed/` / `skipped/` / `trashed/`)
- `basic-project-setup.md` — MCP installation guide
- `setup-project.sh` / `update-project.sh` — Template install + incremental sync (rsync-based). Both scripts delegate `.docs/` sync to `sync-docs-scaffold.sh` and invoke `bootstrap-serena.sh` at the end.
- `sync-docs-scaffold.sh` — Syncs the scaffold structure of `.docs/` into target projects (guides, directory shells, `.gitkeep` files, `tasks/active/README.md`) AND syncs `.claude/skills/` (all 22 skill directories + SKILL.md files). Never copies template task/UAT content — protects target-project work on idempotent re-runs. Called by both `setup-project.sh` and `update-project.sh`.
- `bootstrap-serena.sh` — Headlessly triggers `.serena/project.yml` creation via `claude --print "exit"` and enables 11 optional Serena tools (list_dir, find_file, find_symbol, find_referencing_symbols, search_for_pattern, replace_content, replace_lines, insert_at_line, insert_after_symbol, insert_before_symbol, delete_lines). Idempotent — skips already-configured projects. Uses a Python one-liner for the find/replace to avoid macOS/GNU `sed -i` portability issues.
- `CLAUDE.md` — Project instructions for Claude Code
- `bin/cli.js` — CLI entry point for the npm package
- `package.json` — npm package configuration

## Custom Skills (29)
- `/primer` — Refresh codebase context via Serena memories
- `/serena-config` — Interactively configure Serena language servers in `.serena/project.yml`; reads current config + auto-detects repo languages, then asks one add/remove question (free-text with `-` prefix for removals)
- `/research <topic>` — Deep research (codebase + Context7 + Brave)
- `/now <task>` — Plan and delegate to subagents (max 3 concurrent)
- `/tackle <path>` — Execute task file step-by-step; verification restricted to static gates only (bash -n, typecheck, lint, unit tests); runtime/E2E verification deferred to UAT via [DEFERRED-TO-UAT] marker
- `/add-task <desc>` — Create task in `.docs/tasks/active/`
- `/create-prd <idea>` — Socratic Q&A elicitation → `.docs/prd/active/NNN-slug.md` (status: `draft`). Enforces named personas, measurable success metrics, explicit non-goals, acceptance criteria on every story.
- `/finalize-prd <file>` — Completeness audit + stakeholder gate → flip `draft → approved`. Re-audits after each gap resolution; refuses to flip while any required field is empty.
- `/prd-to-decisions <file>` — Bridge skill: extracts ASRs from an approved PRD, cross-checks existing ADRs, groups into Decision Group candidates, surfaces `/create-adr` commands, writes bidirectional cross-links.
- `/update-prd <file> [change]` — Approved PRDs: append-only `## Amendment N` blocks + `[amended N]` markers; drafts: direct edits. Always surfaces downstream ADR/task impact.
- `/trash-prd <file>` — Move to `.docs/prd/trashed/`; never auto-cascades to linked ADRs/tasks; preserves index row and cross-links (path updated, not deleted).
- `/create-adr <topic>` — Create an ADR file in `.docs/adr/`. Each file is a **Decision Group** containing 1+ decision blocks (`D1`, `D2`, …); each decision has its own `Status`, `Date`, `Deciders`, `Tags`, and supersession state. Table-only comparisons, mermaid flowcharts. Status defaults to `proposed`; finalization deferred to `/finalize-adr`.
- `/walkthrough-adr <file>` — Interactive Q&A walkthrough of every decision in an ADR file. For each `proposed` decision, presents drivers + options + currently-chosen option, then asks the user to **Confirm**, **Change**, **Defer**, or **Skip**. Light edits only (bold chosen option, rewrite outcome justification, fill blank metadata on request). Never flips status; suggests `/finalize-adr <file>#<DM>` per confirmed decision. Treats `accepted`/`superseded`/`deprecated` siblings as informational-only. Sibling blocks remain byte-for-byte unchanged.\n- `/finalize-adr <file>#<DM>` — Ratify a **single decision block** (e.g. `0007-session#D2`). Per-decision audit (E-C-A-D-R DoD), per-decision supersession check across the entire log, atomic two-block cross-reference if superseding. Siblings in the same file are byte-for-byte untouched. Refuses to run on already-accepted decisions (suggests `/create-adr` successor instead).
- `/trash-task <path>` — Move task + UAT to `trashed/`
- `/update-task <path> <changes>` — Modify existing task
- `/uat-generator <target>` — Generate UAT tests; owns runtime and end-to-end verification (what /tackle cannot run); shell script execution against ./tmp/ scratch dirs belongs here, not in /tackle. **Test integrity rule (non-negotiable)**: tests encode required functionality from the task's acceptance criteria — never weakened, narrowed, or reshaped to match buggy/incomplete implementation. Source code grounds *how to invoke*; the requirement grounds *what should happen*. Discrepancies → write the test against the requirement, let it fail, report the gap.
- `/uat-walkthrough <path>` — Interactive UAT (human at keyboard)
- `/uat-auto <path>` — Headless UAT auto-judging (fail-closed, for orchestrators like tmux-conductor)
- `/uat-auth [--role=user|guest]` — Authenticate test user and export `$UAT_AUTH_TOKEN`; invoked by `/uat-auto` Step 2.5 on auth-gated tests; env-var-only credentials, no disk persistence
- `/uat-skip <path>` — Skip UAT, move task to completed + UAT to skipped
- `/lint` — IDE diagnostics with fix cycles
- `/debug-logs [symptom]` — Read-only failure diagnosis: gather session context (recent diff, background processes, recent errors), pick log stores by symptom (TaskOutput, IDE diagnostics, gh run logs, DigitalOcean app logs, conventional `./logs`/`./tmp` paths, Puppeteer console), correlate with code, and produce ranked hypotheses with concrete next actions. Never auto-applies fixes.
- `/simplify <path>` — Remove redundancy, simplify complexity
- `/git-commit` — Stage and commit with auto message
- `/update-docs` — Update docs + audit/update Serena memories
- `/project-readme` — Generate/update portfolio-ready README
- `/marp-slideshow <input> [output]` — Summarize a source file into a Marp/Marpit slide deck; output: `<stem>.slides.md`
- `/mermaid-flowchart <input> [output]` — Summarize an architecture file (markdown, YAML, Docker Compose) into a Mermaid flowchart; output: `<stem>.flowchart.md`

## Workflow Pipeline
`/create-prd → /finalize-prd → /prd-to-decisions → /create-adr → /finalize-adr → /add-task → /tackle → /update-docs → /uat-generator → /uat-walkthrough` (human) OR `/uat-auto` (headless)

PRD layer is optional for small/internal work — jump directly to `/add-task` or `/create-adr` when below the PRD threshold (bug fixes, refactors, single-engineer choices). See `.docs/prd/README.md` "When NOT to Write a PRD".

- Task lifecycle: `active/` → (tackle + UAT all pass) → `completed/`
- UAT lifecycle: `pending/` → (all pass) → `completed/`
- `/uat-auto` never writes `[SKIP]` (human-only verdict) and never auto-passes without machine-verifiable evidence; manual tests always fail-closed for human re-triage.

## Required MCPs
- Serena — code exploration, editing, memory
- Brave Search — web research (1 req/sec, sequential)
- Context7 — library documentation
- Puppeteer — browser automation + screenshots for UI UAT tests
