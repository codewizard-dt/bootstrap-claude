# 009 — Audit Skills vs. SDLC Best Practices

## Objective

Audit the existing 32+ Claude Code custom skills in this repository against best practices for full product lifecycle management and software development lifecycle (SDLC), identifying gaps, redundancies, and improvement opportunities.

The outcome is a written audit report (not implementation) documenting:
1. What phases of the product/SDLC lifecycle are well-covered by existing skills
2. What phases have gaps or missing skills
3. What improvements could be made to existing skills
4. Recommended new skills to close gaps

---

## Steps

### Step 1 — Inventory all current skills

<!-- agent: Explore -->

- [ ] List all skill folders under `.claude/skills/` using Serena `list_dir`
- [ ] For each skill, read its `SKILL.md` to understand purpose, invocation, and phase
- [ ] Categorize each skill into SDLC phases:
  - **Discovery** — research, ideation, requirements elicitation
  - **Planning** — task planning, roadmapping, prioritisation
  - **Architecture** — ADRs, design decisions, system structure
  - **Development** — coding, editing, scaffolding
  - **Testing** — UAT, automated tests, regression
  - **Review** — PR review, security review, code quality
  - **Deployment** — publish, release, CI/CD support
  - **Operations** — monitoring, bug tracking, incident response
  - **Documentation** — READMEs, guides, changelogs, diagrams

### Step 2 — Research best practices

<!-- agent: general-purpose -->

- [ ] Use Context7 or Brave Search to research best practices for AI-assisted development workflows and full product/SDLC lifecycle tooling
- [ ] Identify the canonical phases of a modern SDLC and what tooling typically covers each
- [ ] Note what AI coding assistants (e.g. GitHub Copilot, Cursor, Claude Code) typically support vs. what is commonly missing
- [ ] Capture relevant findings as notes to inform the gap analysis in Step 3

### Step 3 — Write gap analysis

<!-- agent: general-purpose -->

- [ ] Create the `.docs/audits/` directory if it does not already exist
- [ ] Compare current skill coverage (Step 1) vs. ideal SDLC coverage (Step 2)
- [ ] Create `.docs/audits/009-sdlc-audit.md` with the following sections:
  - **Executive Summary** — 2–3 sentence overview of findings
  - **Coverage Table** — one row per SDLC phase; columns: Phase | Covered Skills | Coverage Level (Full/Partial/Gap) | Notes
  - **Phase-by-Phase Analysis** — narrative for each phase: what exists, what's missing, what could improve
  - **Top Recommendations** — ranked list of 3–5 improvements or new skills (include rationale)
- [ ] Ensure the report is audit-only; no implementation or skill changes

### Step 4 — Create task stubs for top recommendations

<!-- agent: general-purpose -->

- [ ] For each of the top 3 recommendations from Step 3, add a brief outline stub to the audit report under a `## Task Stubs` section
- [ ] Each stub should note: recommended skill/improvement name, the gap it closes, and what a future `/task-add` would need to flesh it out (inputs, scope, acceptance criteria sketch)
- [ ] Do not create actual task files — stubs live in the audit report only

### Step 5 — Verification

<!-- agent: Verification -->

- [ ] Confirm `.docs/audits/009-sdlc-audit.md` exists and is readable
- [ ] Confirm the audit report contains all four required sections (Executive Summary, Coverage Table, Phase-by-Phase Analysis, Top Recommendations)
- [ ] Confirm no skill files were created, modified, or deleted during this task (audit only)
- [ ] Confirm `.docs/tasks/README.md` has a row for task 009
