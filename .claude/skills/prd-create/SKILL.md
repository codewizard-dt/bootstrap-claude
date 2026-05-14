---
name: prd-create
description: Create a lean Product Requirements Document in .docs/prd/active/ via Socratic Q&A capturing problem, personas, user stories, success metrics, and non-goals
model: claude-sonnet-4-6
effort: high
argument-hint: <feature description, problem statement, or product initiative title>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**
**Read `.docs/prd/README.md` first — it is authoritative for the PRD template, the status lifecycle, the required-non-empty fields, the index format, and the anti-patterns this skill must enforce.**


# Create PRD

Create a new **Product Requirements Document** (PRD). A PRD captures **what to build and why** from a product perspective: the problem, the personas, the desired outcomes, and the explicit non-goals. PRDs sit **upstream** of ADRs and tasks — they define the *what* and *why*, never the *how*.

The hard boundary (from Joel Parker Henderson's PRD↔ADR pattern):

> *A PRD never justifies architecture. An ADR never redefines product scope.*

If the user starts specifying file paths, libraries, schemas, or framework choices, **redirect** them — that content belongs in a downstream ADR, not the PRD.

This skill drives a **Socratic Q&A session** via `AskUserQuestion`. The differentiator from "just write a doc" is that the skill *interrogates* the user rather than guessing.

---

**Topic**: $ARGUMENTS

---

## When to write a PRD

See `.docs/prd/README.md` for the canonical "When to Write" / "When NOT to Write" tables. In short: write a PRD when there is a real problem worth aligning on, more than one decision area, multiple stakeholders, and the *what* is not obvious from the codebase.

If the topic is a bug fix, a refactor, a one-line config change, or a question purely about *how* to implement something, **stop and tell the user** — don't pad the PRL. Suggest `/task-add` or `/adr-create` instead.

---

## Instructions

### Step 1: Parse the topic and recall project context

1. **Extract** the core topic from `$ARGUMENTS`. If the topic is too vague (e.g. "search", "make it better", "auth"), use `AskUserQuestion` to narrow it before any other work.
2. **Recall Serena memories** that may inform the product space:
   - `mcp__serena__list_memories`
   - `mcp__serena__read_memory` for any topic-relevant memory (personas, regulatory constraints, prior product attempts, known gotchas)
3. **Read project context**:
   - `CLAUDE.md` (project conventions)
   - `PROJECT_STATUS.md` (if it exists)
   - `.docs/prd/README.md` (the PRD template, lifecycle, and anti-patterns — this is authoritative)
   - A sample of recent PRDs in `.docs/prd/active/` to learn local conventions

### Step 2: Locate the PRD directory and assign a number

PRDs live at `.docs/prd/active/NNN-slug.md`. Numbers are 3-digit zero-padded.

1. **Use `mcp__serena__list_dir` on `.docs/prd/active/`** to scan existing files. Find the highest 3-digit prefix. Increment by 1. The first PRD is `001`.
2. **Derive the file slug** — names the **initiative**. Lowercase, dash-separated, ≤ 60 chars:
   - "Self-serve billing portal" → `004-self-serve-billing-portal.md`
   - "On-call runbook search" → `012-oncall-runbook-search.md`

Confirm the chosen number and slug with the user via `AskUserQuestion` if either is non-obvious.

### Step 3: Research (optional, scoped)

If the topic involves an unfamiliar product space, run a **lightweight** `/research` workflow. The research is for **product context only**:

| In scope for PRD research | Out of scope (defer to ADR/task) |
|---------------------------|----------------------------------|
| Competitive landscape | Library or framework choices |
| User-experience precedents | Schema or API design |
| Persona prior art (industry analyst writeups, role research) | File paths, function names |
| Regulatory or compliance context | Performance benchmarks of specific tools |
| Domain vocabulary | Implementation trade-offs |

Skip this step entirely for well-understood internal tooling, follow-up PRDs in an established product area, or anything where the user is already the domain expert.

If you do research, cap external lookups (Brave Search, Context7) to what is necessary to ask informed questions in Step 4. Do not use research output to *write* the PRD — every elicited field must come from user-confirmed input in Step 4.

### Step 4: Socratic Q&A via `AskUserQuestion` (the heart of this skill)

Walk through the elicitations below **in order**. Batch related questions into a single `AskUserQuestion` round when feasible to minimize round-trips, but never collapse two distinct elicitations into one cell. For each elicitation, the table below names the **quality bar** the answer must clear. If the user's answer fails the bar, ask follow-up questions until it passes — do **not** silently accept a weak answer or invent better content yourself.

| # | Elicitation | Quality bar | Anti-pattern to reject (re-ask) |
|---|-------------|-------------|---------------------------------|
| 1 | **Problem Statement** | 2-4 sentences capturing what is broken / missing / possible and *why now* | "Make the product better"; solution smuggled in ("we need to add a Postgres index") |
| 2 | **Personas (≥ 1)** | Each persona is a named individual or named role with context (where they sit, constraints) and primary goal in this PRD | "Users", "the team", "everyone" |
| 3 | **User Stories (≥ 1)** | Format: *"As `<persona>`, I want `<capability>` so that `<outcome>`."* + an Acceptance Criteria table of observable, testable behaviors | Story without acceptance criteria; AC written as test code (`assert X = Y`); AC describing implementation rather than user-visible behavior |
| 4 | **Success Metrics (≥ 1)** | Each row has **signal + threshold + timeframe** (e.g. *weekly active sessions, ≥ 1.5× baseline, 30 days post-launch*) | "Improve X" / "make it faster" with no numbers |
| 5 | **Goals (≥ 1)** | Each goal is an outcome-oriented sentence and **links to a Success Metric ID** (`SM-1`, `SM-2`, …) | Goal without a linked metric; goal that restates an output instead of an outcome |
| 6 | **Non-Goals (≥ 1, mandatory non-empty)** | At least one explicit out-of-scope item with a *why excluded* reason. Ask: "What would a reader incorrectly assume is in scope?" | "N/A", empty section, "TBD" |
| 7 | **Constraints (may be empty)** | Each row attributes a source: *legal / regulatory / business / technical* | Hand-waved "it has to be fast"; constraint with no source |
| 8 | **Assumptions (may be empty)** | Each row carries an *if false, impact* column | Untracked or implicit assumptions |
| 9 | **Open Questions (may be empty)** | Each has an owner and a target resolution date | Open question logged with no owner |
| 10 | **Owner + Stakeholders** | Single accountable Owner (one name or role) + named Stakeholders for review | "The team", "everyone", missing owner |
| 11 | **Tags (mandatory non-empty, 1-3)** | Short identifying area tags (`auth`, `billing`, `search`, `oncall`) | Empty; over-broad single tag like `product` |

**Suggested batching**:

| Batch | Questions covered |
|-------|-------------------|
| 1 | Problem Statement, Personas |
| 2 | User Stories + Acceptance Criteria, Success Metrics |
| 3 | Goals (linked to metrics), Non-Goals, Constraints, Assumptions |
| 4 | Owner, Stakeholders, Tags, Open Questions |

Adjust as the conversation flows — the rule is *every elicitation passes its quality bar before Step 5*.

**Redirection rule**: if at any point the user starts answering with implementation specifics (file paths, function names, library choices, schema fields), respond:

> That sounds like an architectural decision, not a product requirement. Let's keep the PRD to *what* and *why*; *how* is captured later in an ADR via `/adr-create` after `/prd-finalize` and `/prd-extract-decisions`.

Then re-ask for the user-visible behavior or outcome.

### Step 5: Present the plan and confirm before writing

Before writing the file, present a **tabular preview** of every elicited section. The user confirms via `AskUserQuestion` with options like *Approve and write*, *Edit specific section*, *Cancel*. Do **not** write the file until the user explicitly approves.

The preview must include, at minimum:

| Section | Preview format |
|---------|---------------|
| Header | Title, status (`draft`), Owner, Stakeholders, Tags |
| Problem Statement | Full text |
| Personas | Table |
| User Stories | List of `US-N` titles + AC counts |
| Success Metrics | Full table |
| Goals → Metrics | Full table showing the link |
| Non-Goals | Full table |
| Constraints / Assumptions / Open Questions | Tables (or "(empty — none elicited)") |

If the user requests edits, loop back to the relevant Step 4 elicitation, re-ask, and re-present.

### Step 6: Write the PRD file

After confirmation, use `Write` to create `.docs/prd/active/NNN-slug.md` following the template in `.docs/prd/README.md` **exactly**.

| Field | Value at draft time |
|-------|--------------------|
| `Status` | `draft` |
| `Created` | Today's date (use `date +%Y-%m-%d` or the conversation environment's `currentDate`) |
| `Last updated` | Same as `Created` |
| `Owner` | From Step 4 #10 |
| `Stakeholders` | From Step 4 #10 |
| `Tags` | From Step 4 #11 (1-3 short tags) |
| `## Problem Statement` | From Step 4 #1 |
| `## Goals` | Table from Step 4 #5; every row links a Success Metric ID |
| `## Non-Goals` | Table from Step 4 #6, ≥ 1 row |
| `## Personas` | Table from Step 4 #2 |
| `## User Stories` | Each as `### US-N. <title>` with the user-story sentence and an Acceptance Criteria table |
| `## Success Metrics` | Table from Step 4 #4 |
| `## Constraints` | Table or "(none — section retained as placeholder)" |
| `## Assumptions` | Table or placeholder |
| `## Open Questions` | Table or placeholder |
| `## Linked ADRs` | Empty — retain the explanatory blockquote from the README template |
| `## Linked Tasks` | Empty — retain the explanatory blockquote |
| `## Amendments` | Empty container with the HTML-comment placeholder `<!-- Amendments appear here as `## Amendment 1`, `## Amendment 2`, etc. -->` |

**Refuse to write** if any required-non-empty field (per `.docs/prd/README.md`'s "Required, non-empty fields" table) is missing or fails its quality bar. Loop back to Step 4 instead.

### Step 7: Update the PRD index

Edit `.docs/prd/README.md` to add a new row in the Index table.

1. `Read` the README to locate the Index table.
2. If the placeholder row `_No PRDs yet — use `/prd-create <idea>` to draft the first one._` exists, **replace** it with the new row. Otherwise **append** the new row in numerical order (sort by file number ascending).
3. Use the column format from `.docs/prd/README.md`:

   | Column | Format |
   |--------|--------|
   | `File` | `[PRD-NNN](active/NNN-slug.md)` |
   | `Title` | The PRD's H1 sub-title (without the `PRD NNN:` prefix) |
   | `Status` | `draft` |
   | `Created` | `YYYY-MM-DD` |
   | `Owner` | One name or role |
   | `Linked ADRs` | `—` (none yet) |
   | `Linked Tasks` | `—` (none yet) |

Use `Edit` (not `sed`, `awk`, `echo >>`, or any shell redirection). See `.docs/guides/mcp-tools.md`.

### Step 8: Cross-link from related artifacts

If the topic was prompted by an existing task, research note, or external reference, cross-link both directions:

| Site | Edit |
|------|------|
| Source artifact (task file, research note, etc.) | Append a `**PRD**: PRD-NNN ([file](<relative-link>))` line in a sensible header section |
| New PRD | Reference the source in a footer note (e.g. *"Originated from `.docs/tasks/active/012-runbook-triage.md`"*) below `## Amendments` or in the appropriate context section |

Use `Read` then `Edit` on each site — never `sed` or shell redirection.

If no related artifact exists, skip this step.

### Step 9: Update Serena memory if appropriate

`mcp__serena__write_memory` only when the PRD establishes a **non-obvious** product domain insight that future sessions will benefit from:

| Worth a memory | Skip — self-evident |
|----------------|--------------------|
| A new persona that didn't previously exist in the system (e.g. *SRE on-call*, *enterprise procurement reviewer*) | A persona already covered by an existing memory |
| A regulatory constraint (e.g. *SOC 2 access logging required for all admin actions*) | A constraint that is just "the obvious one" |
| A known product gotcha (e.g. *legacy customers on plan X cannot be migrated to plan Y without a new contract*) | Anything stated only as conjecture |

Use a topic-hierarchical memory name: `product/personas/sre-oncall`, `product/constraints/soc2-admin-logging`, `product/gotchas/legacy-plan-migration`. Reference the PRD (`PRD-NNN`) in the memory body.

Skip this step for self-evident PRDs.

### Step 10: Report completion

Print a tabular summary:

| Field | Value |
|-------|-------|
| File path | `.docs/prd/active/NNN-slug.md` |
| Status | `draft` |
| Personas count | N |
| User Stories count | N |
| Success Metrics count | N |
| Non-Goals count | N |
| Constraints / Assumptions / Open Questions | populated / empty (per section) |
| Index updated | yes (1 row added) |
| Cross-links | list of artifacts updated, or *none* |
| Memory written | name (or *skipped*) |
| Suggested next step | `/prd-finalize .docs/prd/active/NNN-slug.md` |

If any elicitation was challenging or any field was reduced to placeholder content (e.g. an Assumption could not be sourced), note it in a separate **Gaps** section so the user can address it before `/prd-finalize`.

---

## Output Formatting Rules (mandatory — these override any default style)

1. **Tables, not bullets, for every comparison and enumeration.** This applies to Goals→Metrics, Non-Goals, Personas, Acceptance Criteria, Success Metrics, Constraints, Assumptions, and Open Questions. If you find yourself writing `- Goal: ...`, stop and convert to a table row.
2. **Present tense, full sentences.** "Casey discovers the runbook within 30 seconds of paging." Not "discover runbook fast" or "30s find time".
3. **Personas are named individuals or named roles, never "users".** "Casey, the on-call SRE" is acceptable. "Users" is not.
4. **Every Goal links to a Success Metric ID.** Goals without a `SM-N` reference are rejected and re-elicited in Step 4.
5. **Every Success Metric has signal + threshold + timeframe.** "Improve X" is rejected. Loop back and ask for the missing piece.
6. **At least one Non-Goal.** An empty `## Non-Goals` section is a hard fail. The standing question to elicit one is *"What would a reader incorrectly assume is in scope?"*
7. **The PRD never contains implementation specifics.** No file paths, no function names, no library choices, no schema fragments, no API routes. If the user supplies any, redirect to ADR territory and re-ask the corresponding *what / why* question.
8. **Acceptance criteria describe observable user-visible behavior.** Not test cases, not assertions, not internal state checks.

---

## CRITICAL Rules

1. **Maximum 3 sub-processes at a time** if delegating Step 3 research
2. **Always terminate processes when done** (research subagents, dev servers, type checkers)
3. **Refuse to write the file if any required-non-empty field is empty or fails its quality bar.** Loop back to Step 4 — do not silently fill gaps with invented content
4. **Never invent personas, metrics, user stories, or non-goals.** Every entry comes from user-confirmed input via `AskUserQuestion`. Research from Step 3 only informs the *questions* you ask, never the *answers* you write
5. **Never use `sed`, `awk`, `echo >>`, or shell redirection to edit markdown.** Always `Read` then `Edit`. See `.docs/guides/mcp-tools.md`
6. **Tags non-empty is mandatory** — refuse to write the file if Step 4 #11 yielded zero tags
7. **Never auto-create downstream artifacts.** This skill creates exactly one PRD file (plus index + cross-link edits). Do **not** create ADRs, tasks, or research notes as a side effect — the next step in the pipeline is `/prd-finalize`, then `/prd-extract-decisions`, never direct creation of decisions or implementation plans
8. **Redirect implementation talk to ADR territory** — if the user starts specifying *how*, restate the question as *what* / *why* and re-elicit
