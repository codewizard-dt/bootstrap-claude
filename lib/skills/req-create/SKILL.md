---
name: req-create
description: Draft a new requirement in wiki/work/requirements/ via Socratic Q&A capturing problem, personas, user stories, success metrics, and non-goals
category: planning
model: claude-sonnet-4-6
effort: high
argument-hint: <feature description, problem statement, or product initiative title>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**
**Check `wiki/work/requirements/lifecycle.md` for the REQ template, status lifecycle, required-non-empty fields, and anti-patterns this skill must enforce; `wiki/work/requirements/index.md` for the index row format.**


# Create Requirement

Create a new **Requirement** (REQ). A requirement captures **what to build and why** from a product perspective: the problem, the personas, the desired outcomes, and the explicit non-goals. Requirements sit **upstream** of decisions and tasks — they define the *what* and *why*, never the *how*.

The hard boundary (from Joel Parker Henderson's REQ↔Decision pattern):

> *A requirement never justifies architecture. A decision never redefines product scope.*

If the user starts specifying file paths, libraries, schemas, or framework choices, **redirect** them — that content belongs in a downstream decision, not the requirement.

This skill drives a **Socratic Q&A session** via `AskUserQuestion`. The differentiator from "just write a doc" is that the skill *interrogates* the user rather than guessing.

---

**Topic**: $ARGUMENTS

---

## When to write a requirement

Write a requirement when there is a real problem worth aligning on, more than one decision area, multiple stakeholders, and the *what* is not obvious from the codebase.

If the topic is a bug fix, a refactor, a one-line config change, or a question purely about *how* to implement something, **stop and tell the user** — don't pad the requirement. Suggest `/task-add` or `/decision-create` instead.

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
   - `wiki/work/requirements/lifecycle.md` (template, lifecycle, and anti-patterns — authoritative)
   - A sample of recent requirements in `wiki/work/requirements/` to learn local conventions

### Step 2: Locate the requirements directory and assign a number

Requirements live at `wiki/work/requirements/REQ-NNN-slug.md`. Numbers are 3-digit zero-padded.

1. **Use `mcp__serena__list_dir` on `wiki/work/requirements/`** to scan existing files. Find the highest 3-digit prefix. Increment by 1. The first requirement is `REQ-001`.
2. **Derive the file slug** — names the **initiative**. Lowercase, dash-separated, ≤ 60 chars:
   - "Self-serve billing portal" → `REQ-004-self-serve-billing-portal.md`
   - "On-call runbook search" → `REQ-012-oncall-runbook-search.md`

Confirm the chosen number and slug with the user via `AskUserQuestion` if either is non-obvious.

### Step 3: Research (optional, scoped)

If the topic involves an unfamiliar product space, run a **lightweight** `/research` workflow. The research is for **product context only**:

| In scope for research | Out of scope (defer to decision/task) |
|-----------------------|---------------------------------------|
| Competitive landscape | Library or framework choices |
| User-experience precedents | Schema or API design |
| Persona prior art (industry analyst writeups, role research) | File paths, function names |
| Regulatory or compliance context | Performance benchmarks of specific tools |
| Domain vocabulary | Implementation trade-offs |

Skip this step entirely for well-understood internal tooling, follow-up requirements in an established product area, or anything where the user is already the domain expert.

If you do research, cap external lookups (Brave Search, Context7) to what is necessary to ask informed questions in Step 4. Do not use research output to *write* the requirement — every elicited field must come from user-confirmed input in Step 4.

### Step 4: Socratic Q&A via `AskUserQuestion` (the heart of this skill)

Walk through the elicitations below **in order**. Batch related questions into a single `AskUserQuestion` round when feasible to minimize round-trips, but never collapse two distinct elicitations into one cell. For each elicitation, the table below names the **quality bar** the answer must clear. If the user's answer fails the bar, ask follow-up questions until it passes — do **not** silently accept a weak answer or invent better content yourself.

| # | Elicitation | Quality bar | Anti-pattern to reject (re-ask) |
|---|-------------|-------------|---------------------------------|
| 1 | **Problem Statement** | 2-4 sentences capturing what is broken / missing / possible and *why now* | "Make the product better"; solution smuggled in ("we need to add a Postgres index") |
| 2 | **Personas (≥ 1)** | Each persona is a named individual or named role with context (where they sit, constraints) and primary goal in this requirement | "Users", "the team", "everyone" |
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

> That sounds like an architectural decision, not a product requirement. Let's keep the requirement to *what* and *why*; *how* is captured later in a decision via `/decision-create` after `/req-finalize` and `/req-extract-decisions`.

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

### Step 6: Write the requirement file

After confirmation, use `Write` to create `wiki/work/requirements/REQ-NNN-slug.md` with the following YAML frontmatter and sections.

**YAML frontmatter** (required fields):

```yaml
---
id: REQ-NNN
type: requirement
status: draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
owner: <name or role>
stakeholders: [<name or role>, ...]
superseded-by: ""
tags: [<tag1>, <tag2>]
---
```

**Document sections** (in order):

| Field | Value at draft time |
|-------|--------------------|
| `# REQ-NNN: <Title>` | H1 heading |
| `## Problem Statement` | From Step 4 #1 |
| `## Goals` | Table from Step 4 #5; every row links a Success Metric ID |
| `## Non-Goals` | Table from Step 4 #6, ≥ 1 row |
| `## Personas` | Table from Step 4 #2 |
| `## User Stories` | Each as `### US-N. <title>` with the user-story sentence and an Acceptance Criteria table |
| `## Success Metrics` | Table from Step 4 #4 |
| `## Constraints` | Table or "(none — section retained as placeholder)" |
| `## Assumptions` | Table or placeholder |
| `## Open Questions` | Table or placeholder |
| `## Linked Decisions` | Empty — retain explanatory blockquote placeholder |
| `## Linked Tasks` | Empty — retain explanatory blockquote |
| `## Notes` | Empty placeholder |
| `## Amendments` | Empty container with HTML-comment placeholder `<!-- Amendments appear here as ## Amendment 1, ## Amendment 2, etc. -->` |

**Refuse to write** if any required-non-empty field is missing or fails its quality bar. Loop back to Step 4 instead.

### Step 7: Update the family index and wiki index

1. **Update `wiki/work/requirements/index.md`**: Append a new row to the requirements family index table.
   - If the placeholder row `_No requirements yet — use /req-create to draft the first one._` exists, **replace** it with the new row. Otherwise **append** the new row in numerical order (sort by REQ number ascending).
   - Row format: `- [REQ-NNN — Title](REQ-NNN-slug.md) — one-line summary · draft`

2. **Update `wiki/work/requirements/index.md`**: add the new requirement's row (active index).
   - If the placeholder row exists, replace it. Otherwise append in numerical order.
   - Column format:

   | Column | Format |
   |--------|--------|
   | `ID` | `[REQ-NNN](../work/requirements/REQ-NNN-slug.md)` |
   | `Title` | The requirement's initiative title |
   | `Status` | `draft` |
   | `Created` | `YYYY-MM-DD` |
   | `Owner` | One name or role |
   | `Linked Decisions` | `—` (none yet) |
   | `Linked Tasks` | `—` (none yet) |

Use `Edit` (not `sed`, `awk`, `echo >>`, or any shell redirection). See `.docs/guides/mcp-tools.md`.

Append to `wiki/log.md`:

```
## [YYYY-MM-DD] req-create | REQ-NNN <title>
```

### Step 8: Cross-link from related artifacts

If the topic was prompted by an existing task, research note, or external reference, cross-link both directions:

| Site | Edit |
|------|------|
| Source artifact (task file, research note, etc.) | Append a `**Requirement**: REQ-NNN ([file](<relative-link>))` line in a sensible header section |
| New requirement | Reference the source in `## Notes` (e.g. *"Originated from `wiki/work/tasks/TASK-012-runbook-triage.md`"*) |

Use `Read` then `Edit` on each site — never `sed` or shell redirection.

If no related artifact exists, skip this step.

### Step 9: Update Serena memory if appropriate

`mcp__serena__write_memory` only when the requirement establishes a **non-obvious** product domain insight that future sessions will benefit from:

| Worth a memory | Skip — self-evident |
|----------------|--------------------|
| A new persona that didn't previously exist in the system | A persona already covered by an existing memory |
| A regulatory constraint | A constraint that is just "the obvious one" |
| A known product gotcha | Anything stated only as conjecture |

Use a topic-hierarchical memory name: `product/personas/sre-oncall`, `product/constraints/soc2-admin-logging`. Reference the requirement (`REQ-NNN`) in the memory body.

### Step 10: Report completion

Print a tabular summary:

| Field | Value |
|-------|-------|
| File path | `wiki/work/requirements/REQ-NNN-slug.md` |
| Status | `draft` |
| Personas count | N |
| User Stories count | N |
| Success Metrics count | N |
| Non-Goals count | N |
| Constraints / Assumptions / Open Questions | populated / empty (per section) |
| Family index updated | yes (1 row added to wiki/work/requirements/index.md) |

| Log entry | appended to wiki/log.md |
| Cross-links | list of artifacts updated, or *none* |
| Memory written | name (or *skipped*) |
| Suggested next step | `/req-finalize wiki/work/requirements/REQ-NNN-slug.md` |

If any elicitation was challenging or any field was reduced to placeholder content, note it in a separate **Gaps** section so the user can address it before `/req-finalize`.

---

## Output Formatting Rules (mandatory — these override any default style)

1. **Tables, not bullets, for every comparison and enumeration.** This applies to Goals→Metrics, Non-Goals, Personas, Acceptance Criteria, Success Metrics, Constraints, Assumptions, and Open Questions.
2. **Present tense, full sentences.** "Casey discovers the runbook within 30 seconds of paging." Not "discover runbook fast" or "30s find time".
3. **Personas are named individuals or named roles, never "users".** "Casey, the on-call SRE" is acceptable. "Users" is not.
4. **Every Goal links to a Success Metric ID.** Goals without a `SM-N` reference are rejected and re-elicited in Step 4.
5. **Every Success Metric has signal + threshold + timeframe.** "Improve X" is rejected. Loop back and ask for the missing piece.
6. **At least one Non-Goal.** An empty `## Non-Goals` section is a hard fail.
7. **The requirement never contains implementation specifics.** No file paths, no function names, no library choices, no schema fragments, no API routes.
8. **Acceptance criteria describe observable user-visible behavior.** Not test cases, not assertions, not internal state checks.

---

## CRITICAL Rules

1. **Maximum 3 sub-processes at a time** if delegating Step 3 research
2. **Always terminate processes when done**
3. **Refuse to write the file if any required-non-empty field is empty or fails its quality bar.** Loop back to Step 4
4. **Never invent personas, metrics, user stories, or non-goals.** Every entry comes from user-confirmed input via `AskUserQuestion`
5. **Never use `sed`, `awk`, `echo >>`, or shell redirection to edit markdown.** Always `Read` then `Edit`
6. **Tags non-empty is mandatory** — refuse to write the file if Step 4 #11 yielded zero tags
7. **Never auto-create downstream artifacts.** This skill creates exactly one requirement file (plus family index + wiki index + log + cross-link edits). Do **not** create decisions, tasks, or research notes as a side effect
8. **Redirect implementation talk to decision territory** — if the user starts specifying *how*, restate the question as *what* / *why* and re-elicit
9. **Two-domain rule** — requirements are stateful work artifacts; they live under `wiki/work/requirements/` and must never be filed under `wiki/knowledge/`
