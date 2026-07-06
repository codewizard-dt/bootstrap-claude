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
**Prereqs:** obey `.docs/guides/mcp-tools.md`; run /primer if not done this session.
**Check `wiki/work/requirements/lifecycle.md`** for the REQ template, status lifecycle, required-non-empty fields, and anti-patterns this skill enforces; **`wiki/work/requirements/index.md`** for the index row format.

# Create Requirement

Create a **Requirement** (REQ) — **what to build and why** from a product perspective: problem, personas, desired outcomes, explicit non-goals. Requirements sit **upstream** of decisions and tasks; they define *what* and *why*, never *how*.

> *A requirement never justifies architecture. A decision never redefines product scope.* (Joel Parker Henderson's REQ↔Decision pattern)

If the user specifies file paths, libraries, schemas, or frameworks, **redirect** — that belongs in a downstream decision. This skill drives a **Socratic Q&A** via `AskUserQuestion`: it *interrogates* the user rather than guessing.

**Topic**: $ARGUMENTS

## When to write

Write when there's a real problem worth aligning on, more than one decision area, multiple stakeholders, and the *what* is not obvious from the codebase. For a bug fix, refactor, one-line config change, or a pure *how* question — **stop and tell the user**; suggest `/task-add` or `/decision-create`.

---

## Step 1: Parse topic, recall context
1. Extract the topic from `$ARGUMENTS`; too vague ("search", "make it better", "auth") → `AskUserQuestion` to narrow first.
2. Recall memories: `list_memories`, `read_memory` for topic-relevant ones (personas, regulatory constraints, prior attempts, gotchas).
3. Read `CLAUDE.md`, `PROJECT_STATUS.md` (if present), `wiki/work/requirements/lifecycle.md` (authoritative template/lifecycle/anti-patterns), and a sample of recent requirements for local conventions.

## Step 2: Locate directory, assign number
Requirements live at `wiki/work/requirements/REQ-NNN-slug.md` (3-digit zero-padded). `list_dir` the directory, highest prefix + 1 (first is `REQ-001`). Derive the slug — names the **initiative**, lowercase dash-separated ≤60 chars (e.g. "Self-serve billing portal" → `REQ-004-self-serve-billing-portal.md`). Confirm number + slug via `AskUserQuestion` if non-obvious.

## Step 3: Research (optional, scoped)
For an unfamiliar product space, run a **lightweight** `/research` for **product context only**:

| In scope | Out of scope (defer to decision/task) |
|----------|---------------------------------------|
| Competitive landscape · UX precedents · persona prior art · regulatory/compliance context · domain vocabulary | Library/framework choices · schema/API design · file paths/function names · tool benchmarks · implementation trade-offs |

Skip entirely for well-understood internal tooling, follow-ups in an established area, or when the user is the domain expert. Cap external lookups (Brave, Context7) to what's needed to ask informed Step 4 questions. **Never** write requirement fields from research output — every field comes from user-confirmed Step 4 input.

## Step 4: Socratic Q&A via `AskUserQuestion` (the heart of this skill)
Walk the elicitations **in order**. Batch related ones into a single round when feasible, but never collapse two distinct elicitations into one cell. Each answer must clear its **quality bar**; if it fails, ask follow-ups until it passes — never silently accept a weak answer or invent content.

| # | Elicitation | Quality bar | Reject & re-ask if |
|---|-------------|-------------|--------------------|
| 1 | **Problem Statement** | 2-4 sentences: what's broken/missing/possible and *why now* | "Make it better"; solution smuggled in ("add a Postgres index") |
| 2 | **Personas (≥1)** | Named individual or role with context (where they sit, constraints) + primary goal | "Users", "the team", "everyone" |
| 3 | **User Stories (≥1)** | *"As `<persona>`, I want `<capability>` so that `<outcome>`."* + an Acceptance Criteria table of observable, testable behaviors | No AC; AC as test code (`assert X = Y`); AC describing implementation |
| 4 | **Success Metrics (≥1)** | Each row: **signal + threshold + timeframe** (e.g. weekly active sessions, ≥1.5× baseline, 30 days post-launch) | "Improve X" / "make it faster" with no numbers |
| 5 | **Goals (≥1)** | Outcome-oriented sentence **linking a Success Metric ID** (`SM-1`, …) | Goal without a linked metric; restates an output not an outcome |
| 6 | **Non-Goals (≥1, mandatory)** | ≥1 explicit out-of-scope item with a *why excluded*. Ask: "What would a reader wrongly assume is in scope?" | "N/A", empty, "TBD" |
| 7 | **Constraints (may be empty)** | Each attributes a source: legal/regulatory/business/technical | Hand-waved "must be fast"; no source |
| 8 | **Assumptions (may be empty)** | Each carries an *if false, impact* column | Untracked/implicit assumptions |
| 9 | **Open Questions (may be empty)** | Each has an owner + target resolution date | Logged with no owner |
| 10 | **Owner + Stakeholders** | Single accountable Owner (one name/role) + named Stakeholders | "The team", "everyone", missing owner |
| 11 | **Tags (mandatory, 1-3)** | Short area tags (`auth`, `billing`, `search`) | Empty; over-broad single tag like `product` |

**Suggested batching:** (1) Problem, Personas · (2) User Stories+AC, Success Metrics · (3) Goals, Non-Goals, Constraints, Assumptions · (4) Owner, Stakeholders, Tags, Open Questions. Adjust as the conversation flows — the rule is *every elicitation passes its bar before Step 5*.

**Redirection rule:** if the user answers with implementation specifics (file paths, function names, libraries, schema fields), respond: *"That sounds like an architectural decision, not a product requirement. Let's keep this to what and why; how is captured later in a decision via `/decision-create` after `/req-finalize` and `/req-extract-decisions`."* Then re-ask for the user-visible behavior/outcome.

## Step 5: Preview and confirm before writing
Present a **tabular preview** of every elicited section; user confirms via `AskUserQuestion` (*Approve and write* / *Edit specific section* / *Cancel*). **Do not write until explicit approval.** Preview must include at least: Header (Title, status `draft`, Owner, Stakeholders, Tags), Problem Statement (full), Personas (table), User Stories (`US-N` titles + AC counts), Success Metrics (full table), Goals→Metrics (full table showing the link), Non-Goals (full table), Constraints/Assumptions/Open Questions (tables or "(empty — none elicited)"). Edits → loop back to the relevant Step 4 elicitation and re-present.

## Step 6: Write the file
After confirmation, `Write` `wiki/work/requirements/REQ-NNN-slug.md`.

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

Sections in order: `# REQ-NNN: <Title>` · `## Problem Statement` · `## Goals` (table, every row links a Success Metric ID) · `## Non-Goals` (≥1 row) · `## Personas` (table) · `## User Stories` (each `### US-N. <title>` with the story sentence + an AC table) · `## Success Metrics` (table) · `## Constraints` / `## Assumptions` / `## Open Questions` (table or "(none — placeholder retained)") · `## Linked Decisions` (empty, retain explanatory blockquote) · `## Linked Tasks` (empty, blockquote) · `## Notes` (empty) · `## Amendments` (empty, `<!-- Amendments appear here as ## Amendment 1, ## Amendment 2, etc. -->`).

**Refuse to write** if any required-non-empty field is missing or fails its bar — loop back to Step 4.

## Step 7: Update indexes + log (`Edit` only, never `sed`/`awk`/`echo >>`)
Update `wiki/work/requirements/index.md` — if the placeholder row `_No requirements yet …_` exists, **replace** it; else **append** in ascending REQ order. Row/columns: `ID` = `[REQ-NNN](../work/requirements/REQ-NNN-slug.md)` · `Title` · `Status` = `draft` · `Created` = `YYYY-MM-DD` · `Owner` · `Linked Decisions` = `—` · `Linked Tasks` = `—`. Append to `wiki/log.md`: `## [YYYY-MM-DD] req-create | REQ-NNN <title>`.

## Step 8: Cross-link related artifacts
If prompted by an existing task/research note/reference, link both ways (`Read` then `Edit`, never `sed`): source artifact gets `**Requirement**: REQ-NNN ([file](<relative-link>))` in a sensible section; the new requirement references the source in `## Notes` (e.g. "Originated from `wiki/work/tasks/TASK-012-runbook-triage.md`"). No related artifact → skip.

## Step 9: Update memory if appropriate
`mcp__serena__write_memory` only for a **non-obvious** product insight future sessions benefit from (a genuinely new persona; a regulatory constraint; a known product gotcha) — skip self-evident ones or conjecture. Topic-hierarchical name (`product/personas/sre-oncall`, `product/constraints/soc2-admin-logging`), referencing `REQ-NNN` in the body.

## Step 10: Report
Tabular summary: File path, Status (`draft`), Personas/User Stories/Success Metrics/Non-Goals counts, Constraints/Assumptions/Open Questions (populated/empty per section), index updated (1 row), log appended, cross-links (list or *none*), memory (name or *skipped*), suggested next step `/req-finalize wiki/work/requirements/REQ-NNN-slug.md`. Note any placeholder-reduced field under a **Gaps** section for the user to address before `/req-finalize`.

---

## Output formatting rules (mandatory — override default style)
1. **Tables not bullets** for every comparison/enumeration (Goals→Metrics, Non-Goals, Personas, Acceptance Criteria, Success Metrics, Constraints, Assumptions, Open Questions).
2. **Present tense, full sentences** — "Casey discovers the runbook within 30 seconds of paging", not "discover runbook fast".
3. **Personas are named individuals or roles, never "users"** — "Casey, the on-call SRE" ✅.
4. **Every Goal links a Success Metric ID** — goals without `SM-N` are rejected and re-elicited.
5. **Every Success Metric has signal + threshold + timeframe** — "Improve X" is rejected.
6. **≥1 Non-Goal** — an empty `## Non-Goals` is a hard fail.
7. **No implementation specifics** — no file paths, function names, library choices, schema fragments, or API routes.
8. **Acceptance criteria describe observable user-visible behavior** — not test cases, assertions, or internal state checks.

## CRITICAL rules
1. **Max 3 sub-processes at a time** if delegating Step 3 research; **always terminate processes when done**.
2. **Refuse to write if any required-non-empty field is empty or fails its bar** — loop back to Step 4.
3. **Never invent personas, metrics, user stories, or non-goals** — every entry from user-confirmed `AskUserQuestion` input.
4. **Never `sed`/`awk`/`echo >>`/shell redirection to edit markdown** — always `Read` then `Edit`.
5. **Tags non-empty is mandatory** — refuse to write if Step 4 #11 yielded zero tags.
6. **Never auto-create downstream artifacts** — exactly one requirement file (+ index + log + cross-link edits); no decisions, tasks, or research notes as a side effect.
7. **Redirect implementation talk to decision territory** — restate as *what*/*why* and re-elicit.
8. **Two-domain rule** — requirements are stateful work artifacts under `wiki/work/requirements/`; never file under `wiki/knowledge/`.
