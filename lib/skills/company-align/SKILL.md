---
name: company-align
description: Analyse project–company fit — maps project implementation, style, and functionality against company mission, values, and likely needs; surfaces gaps and strengths
category: researching
model: claude-sonnet-5
effort: high
argument-hint: [company-slug]
disable-model-invocation: false
user-invocable: true
---

# Company Align

Analyse how well this project aligns with a researched company. Read all company context files from `raw/companies/`, perform a deep read of the project, then produce a structured alignment report covering mission fit, technical fit, functional gaps, and style alignment.

Output is written to `raw/companies/<slug>/alignment.md`.

---

**Company slug (optional)**: $ARGUMENTS

---

## Phase 1: Resolve Target Company

1. Use `mcp__serena__list_dir` on `raw/companies/` to discover available company slugs
2. **If `$ARGUMENTS` is non-empty**: use it as the slug directly
3. **If `$ARGUMENTS` is empty and exactly one company exists**: use that company
4. **If `$ARGUMENTS` is empty and multiple companies exist**: list the available slugs and ask the user which one to align against, then stop and wait
5. Confirm the slug, then read **every file** in `raw/companies/<slug>/` using `mcp__serena__list_dir` + Read:
   - `index.md`, `overview.md`, `leadership.md`, `news.md`, `competitive.md`, `culture.md` (if present)
   - Any other `.md` files present (e.g. a prior `alignment.md` — note it exists but proceed to overwrite)

Build an internal **Company Context** object from these files capturing:
- Mission / values / value proposition
- Products, customers, market segment
- Business model and revenue drivers
- Tech stack and engineering culture (if known)
- Recent strategic priorities and news signals
- Competitive pressures and differentiators

---

## Phase 2: Project Analysis

Use Serena to build a complete picture of this project. Do NOT use Bash, Read, Grep, or Glob on code files.

### 2a. Structure & Architecture
- `mcp__serena__list_dir(".", recursive=true)` — overall directory shape
- `mcp__serena__get_symbols_overview` on key source directories — modules, classes, entry points
- Identify: project type (web app / API / CLI / library / data pipeline / etc.), primary language(s), frameworks

### 2b. Functionality — What Does This Project Do?
- Read README, `package.json` / `pyproject.toml` / equivalent for declared purpose and scripts
- `mcp__serena__get_symbols_overview` on main source files to enumerate features and capabilities
- Check `wiki/work/tasks/`, `wiki/work/requirements/`, `wiki/work/roadmaps/` for declared scope and in-progress work
- Summarise: core features, key user flows, integrations, APIs exposed or consumed

### 2c. Technical Style & Quality Signals
- Identify: coding conventions, test coverage presence, CI/CD setup, linting/type-checking, documentation quality
- Note: patterns used (DDD, hexagonal, REST, event-driven, etc.), dependency choices, any AI/LLM integrations
- Check for: accessibility, internationalisation, security practices, observability (logging, metrics, tracing)

### 2d. Project Maturity & Completeness
- What is clearly production-ready vs. prototype/scaffold?
- Are there obvious TODOs, stub implementations, or known gaps in `wiki/work/bugs/` or task backlogs?
- What is the deployment story (Docker, cloud, serverless, etc.)?

---

## Phase 3: Alignment Analysis

With both the Company Context (Phase 1) and Project Analysis (Phase 2) in hand, perform the following structured assessments.

### 3a. Mission & Values Alignment
For each of the company's stated values or mission pillars, assess how the project demonstrates (or fails to demonstrate) that value:

| Company Value / Mission Pillar | Evidence in Project | Alignment | Notes |
|-------------------------------|--------------------:|:---------:|-------|
| <value> | <what shows it> | Strong / Partial / Weak / None | |

Score: **Strong** = concrete, visible implementation. **Partial** = present but underdeveloped. **Weak** = implicit or aspirational only. **None** = no evidence.

### 3b. Technical Fit
Does the project's tech stack, architecture, and engineering practices align with what is known about the company's engineering culture and preferences?

- Stack overlap (languages, frameworks, cloud platforms)
- Engineering practices match (testing rigour, CI/CD maturity, code style)
- Scalability / reliability posture vs. company's product scale
- Any tech the company is known to use that is notably absent

### 3c. Functional Fit — What Does the Company Likely Need?
Based on the company's products, customers, strategic priorities, and recent news, infer the types of problems or capabilities they likely value. Then map the project's functionality against these:

| Inferred Company Need | Project Capability | Gap Level | Notes |
|----------------------|-------------------|:---------:|-------|
| <need> | <what project does> | None / Minor / Major / Missing | |

**Gap Level**: **None** = project covers it well. **Minor** = partial coverage, easy to extend. **Major** = present but shallow or different approach needed. **Missing** = no coverage at all.

### 3d. Style & Presentation Alignment
- Does the project's README, documentation, and code organisation reflect the professionalism expected?
- Does the project's domain or problem space resonate with the company's industry or customer base?
- Would a senior engineer at this company find the codebase immediately legible and idiomatic?
- Tone of documentation vs. company's public communication style

### 3e. Differentiating Strengths
What does the project do *especially well* that the company would likely find impressive or immediately useful? List 3–5 specific, concrete strengths with evidence.

### 3f. Actionable Gaps
What are the highest-value improvements that would most increase alignment with this company? Rank by impact:

| Priority | Gap | Effort | Suggested Fix |
|----------|-----|:------:|---------------|
| 1 | | Low/Med/High | |
| 2 | | | |
| ... | | | |

---

## Phase 4: Write Output

**Never overwrite an existing `raw/` file.** Writing new files into `raw/` is allowed, but if the target path already exists, write to the next free numeric sibling instead — `alignment-2.md`, then `alignment-3.md`, and so on. The existing file is immutable ground truth; leave it untouched. **The new `-N` file must not repeat data already present in the prior file(s)** — read the existing file(s) first and capture only what is new, changed, or contradicts the prior analysis, cross-referencing the existing file for everything unchanged (e.g. `> Unchanged since [alignment.md](alignment.md); this delta covers …`).

Write `raw/companies/<slug>/alignment.md` (or the next free `alignment-N.md`) with the following structure:

```
---
company: <Company Name>
slug: <slug>
analysed: <YYYY-MM-DD>
overall-alignment: <Strong / Moderate / Weak>
---

# <Company Name> — Project Alignment Report

> **Overall alignment: <Strong / Moderate / Weak>**
> <One sentence verdict.>

## Mission & Values Fit

<table from 3a>

**Summary**: <2–3 sentences on how well the project embodies the company's mission>

## Technical Fit

<narrative + bullet points from 3b>

## Functional Fit & Gaps

<table from 3c>

**Summary**: <2–3 sentences on coverage>

## Style & Presentation

<narrative from 3d>

## Differentiating Strengths

1. **<Strength>**: <evidence>
2. ...

## Actionable Gaps (ranked by impact)

<table from 3f>

## Suggested Talking Points

Based on the alignment above, these are the strongest angles to emphasise when presenting this project to <Company Name>:

1. ...
2. ...
3. ...

## Suggested Improvements Before Presenting

If time permits before engaging with <Company Name>, these changes would meaningfully increase alignment:

- [ ] <improvement> — <why it matters to this company>
- [ ] ...
```

---

## Phase 5: Report to User

After writing the file, tell the user:
- The path written: `raw/companies/<slug>/alignment.md`
- Overall alignment verdict and one-sentence rationale
- Top 3 strengths and top 3 gaps (brief, scannable)
- Suggest: "Run `/company-align <other-slug>` to compare against another company" if multiple companies exist in `raw/companies/`

---

## CRITICAL Rules

1. **Serena for all code navigation** — no Bash `ls`/`cat`/`grep`, no Read on code files
2. **Ground every claim in evidence** — cite specific files, symbols, or company context sources; no speculation presented as fact
3. **Distinguish project reality from roadmap intentions** — what exists in code now vs. what is planned
4. **Be direct about weaknesses** — a gap listed honestly is more useful than an inflated alignment score
5. **No Brave Search in this skill** — all company data comes from the already-researched context files; do not re-search
