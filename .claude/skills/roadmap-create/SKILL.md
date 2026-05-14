---
name: roadmap-create
description: Create a structured execution-plan roadmap in .docs/roadmaps/ via short Socratic Q&A — captures goal, phases, and the initial hybrid (task-link OR inline) checklist
model: claude-sonnet-4-6
argument-hint: <initiative/goal description>
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Read `.docs/roadmaps/README.md` first — it is authoritative for the roadmap template, file template, status lifecycle, item format rules, index format, and anti-patterns this skill must enforce.**
**Run `/primer` first if you have not already this session.**


# Create Roadmap

Create a new **Roadmap** — a structured, phased execution checklist that sits **orthogonal** to the PRD → ADR → Task pipeline. A roadmap answers exactly one question: *in what sequence will we execute the work?*

The hard boundary:

> *A roadmap shows order. A task contains implementation steps. Never smuggle step-level detail into a roadmap item.*

If a checkbox starts growing sub-bullets like "run `pnpm install`" or "edit `src/foo.ts`", that content belongs in a real task file — created via `/task-add` (or `/task-add --roadmap ROADMAP-NNN` to auto-link). Redirect the user when this happens.

This skill drives a **short** Socratic Q&A session via `AskUserQuestion`. Roadmap creation is execution planning, not product strategy — keep questions focused and tight. Aim for one or two batched `AskUserQuestion` rounds plus per-phase follow-ups, not a full PRD-style interrogation.

---

**Topic**: $ARGUMENTS

---

## When to write a Roadmap

See `.docs/roadmaps/README.md` for the canonical "When to Write" / "When NOT to Write" tables. In short: write a roadmap when work spans multiple discrete units, ordering matters, and you want at-a-glance visibility of what's next.

If the topic is a single task with several steps, **stop and tell the user** — the task file's own `## Steps` checklist already serves that purpose. Suggest `/task-add` instead.

---

## Instructions

### Step 1: Parse the topic and recall project context

1. **Extract** the core initiative from `$ARGUMENTS`. If it is too vague (e.g. "auth", "cleanup", "the next thing"), use `AskUserQuestion` to narrow it before any other work.
2. **Recall Serena memories** that may inform the execution order:
   - `mcp__serena__list_memories`
   - `mcp__serena__read_memory` for any topic-relevant memory (sequencing constraints, prior roadmaps, known dependency rules)
3. **Read project context**:
   - `CLAUDE.md` (project conventions)
   - `.docs/roadmaps/README.md` (template, lifecycle, anti-patterns — authoritative)
   - A sample of recent roadmaps in `.docs/roadmaps/` to learn local conventions
   - The Active Tasks table in `.docs/tasks/README.md` so you know what task files already exist and can be linked

### Step 2: Locate the roadmap directory and assign a number

Roadmaps live at `.docs/roadmaps/NNN-slug.md`. Numbers are 3-digit zero-padded.

1. **Use `mcp__serena__list_dir` on `.docs/roadmaps/`** to scan existing files. Collect every `NNN-` prefix.
2. **Use `mcp__serena__search_for_pattern`** against `.docs/roadmaps/README.md` for `ROADMAP-\d{3}` entries in the Index — these may reserve numbers not yet on disk.
3. Take `max + 1`, zero-pad to 3 digits. The first roadmap is `001`.
4. **Derive the file slug** — names the **initiative**. Lowercase, dash-separated, ≤ 60 chars:
   - "Ship the billing portal" → `001-ship-billing-portal.md`
   - "Migrate to Postgres 17" → `004-migrate-postgres-17.md`

Confirm the chosen number and slug with the user via `AskUserQuestion` only if either is non-obvious.

### Step 3: Socratic Q&A via `AskUserQuestion` (short — this is the heart of this skill)

Walk through the elicitations below. Batch related questions into a single `AskUserQuestion` round (max 4 questions per call) to minimize round-trips. For each elicitation, the table names the **quality bar** the answer must clear. If the user's answer fails the bar, ask a follow-up — do **not** silently accept a weak answer or invent better content yourself.

| # | Elicitation | Quality bar | Anti-pattern to reject (re-ask) |
|---|-------------|-------------|---------------------------------|
| 1 | **Goal** | 1-2 sentences describing the destination — what state will the system be in when every box is checked? | "Make X better"; vague aspiration with no observable end state |
| 2 | **Phases (2-5)** | Each phase is a short name capturing an execution stage. Order matters | One mega-phase ("Build it"); >5 phases (suggests over-planning) |
| 3 | **Owner** | One named person or role accountable for execution | "The team", "everyone", missing owner |
| 4 | **Linked PRD / ADRs (may be empty)** | Existing `PRD-NNN` or `ADR-NNNN#DM` references, or `—` if standalone | Inventing references that don't exist |

**Suggested first batch (one `AskUserQuestion` call covering all four)**:

| Batch | Questions covered |
|-------|-------------------|
| 1 | Goal, Phases, Owner, Linked PRD/ADRs |

Then **per-phase**, in a single follow-up `AskUserQuestion` round (one question per phase, up to 4 — split into multiple rounds only if there are 5 phases):

| # | Elicitation | Quality bar |
|---|-------------|-------------|
| 5 | **Phase N items** | For each phase, the user names (a) any existing tasks (`TASK-NNN` or slug fragments) that belong in this phase, and (b) any inline placeholder items. Items may be empty if the user wants to fill in later via `/roadmap-add` — but **at least one phase must contain at least one item** (a roadmap with zero items is not a roadmap) |

When the user supplies a task reference:

- Look it up in `.docs/tasks/active/` (and `completed/` if not found) via `mcp__serena__find_file` to confirm the slug and path. The link must read `[TASK-NNN: <task title>](../tasks/active/NNN-slug.md)` (or `../tasks/completed/` if completed).
- If the user supplies a task reference that does **not** exist, treat it as an inline placeholder (do not fabricate a link). Note in the per-phase clarification that the task can be filed later via `/task-add --roadmap ROADMAP-NNN`.

**Redirection rule**: if the user starts spelling out implementation detail under an item (file paths, function names, sub-steps), respond:

> That sounds like task content, not a roadmap item. Roadmaps show *ordering*. The *how* belongs in a task file — file one with `/task-add --roadmap ROADMAP-NNN <description>` and the roadmap will auto-link to it.

Then re-ask for a single checkbox-sized item.

### Step 4: Present the plan and confirm before writing

Before writing the file, present a **tabular preview** of the roadmap:

| Section | Preview format |
|---------|---------------|
| Header | Title, Status (`active`), Owner, Linked PRD, Linked ADRs, Tags |
| Goal | Full text |
| Phases | Table of `Phase N` → `Name` → `# items` (task-link + inline counts) |
| Per-phase items | One sub-list per phase showing each item's rendered form (`[TASK-NNN: title](path)` or inline text) |

The user confirms via `AskUserQuestion` with options like *Approve and write*, *Edit specific phase*, *Cancel*. Do **not** write the file until the user explicitly approves.

If the user requests edits, loop back to the relevant Step 3 elicitation, re-ask, and re-present.

### Step 5: Re-verify the next available number — IMMEDIATELY before writing

The number determined in Step 2 may now be stale (other roadmaps created mid-session, the README Index may list reservations not yet on disk). Do a fresh scan now:

- `mcp__serena__list_dir` on `.docs/roadmaps/`
- `mcp__serena__search_for_pattern` against `.docs/roadmaps/README.md` for `ROADMAP-\d{3}` entries
- Collect every `NNN-` prefix, take `max + 1`, zero-pad to 3 digits
- If the number you planned to use in Step 4 has been taken, silently bump to the new next-available number and use it. Do not re-prompt the user.
- **Never call `Write` before completing this re-scan.**

### Step 6: Write the roadmap file

Use `Write` to create `.docs/roadmaps/NNN-slug.md` following the template in `.docs/roadmaps/README.md` **exactly**.

| Field | Value at creation time |
|-------|------------------------|
| `Status` | `active` |
| `Created` | Today's date (derive at runtime — use the conversation environment's `currentDate`, otherwise `date +%Y-%m-%d`) |
| `Last updated` | Same as `Created` |
| `Owner` | From Step 3 #3 |
| `Linked PRD` | From Step 3 #4, or `—` |
| `Linked ADRs` | From Step 3 #4, or `—` |
| `Tags` | 1-3 short area tags inferred from the topic (e.g. `auth`, `billing`, `infra`). If the user did not name any, propose tags during Step 4's confirmation rather than inventing them silently |
| `## Goal` | From Step 3 #1 |
| `## Phase N: <name>` | One block per phase from Step 3 #2, each containing the items from Step 3 #5. **At least one phase must contain at least one item.** |
| `## Notes` | Empty placeholder line (the section header is retained for future use) |

**Item rendering rules** (must match `.docs/roadmaps/README.md` "Item Format Rules" exactly):

- Task-link item: `- [ ] [TASK-NNN: <task title>](../tasks/active/NNN-slug.md)`
- Inline item: `- [ ] <free-form description>`

**Refuse to write** if:

- The Goal is missing or vague
- The Owner is missing or "the team"/"everyone"
- Every phase is empty (zero items total)

Loop back to Step 3 instead — do not silently invent content.

### Step 7: Update the roadmap index

Edit `.docs/roadmaps/README.md` to add a new row in the `## Index` table.

1. `Read` the README to locate the Index table.
2. If the placeholder row `_No roadmaps yet — use `/roadmap-create <topic>` to draft the first one._` exists, **replace** it with the new row. Otherwise **append** the new row in numerical order.
3. Use the column format from `.docs/roadmaps/README.md`:

   | Column | Format |
   |--------|--------|
   | `File` | `[ROADMAP-NNN](NNN-slug.md)` |
   | `Title` | The roadmap's H1 sub-title (without the `Roadmap NNN:` prefix) |
   | `Status` | `active` |
   | `Progress` | `0/<total>` where `<total>` is the count of `- [ ]` checkboxes you just wrote across all phases |
   | `Owner` | One name or role |
   | `Linked PRD` | `PRD-NNN` or `—` |

Use `Edit` (not `sed`, `awk`, `echo >>`, or any shell redirection). See `.docs/guides/mcp-tools.md`.

### Step 8: Report completion

Print a tabular summary:

| Field | Value |
|-------|-------|
| File path | `.docs/roadmaps/NNN-slug.md` |
| Status | `active` |
| Phases | N |
| Total items | M (task-link: X, inline: Y) |
| Owner | <name> |
| Linked PRD | PRD-NNN or `—` |
| Linked ADRs | list or `—` |
| Index updated | yes (1 row added) |
| Suggested next steps | `/roadmap-next .docs/roadmaps/NNN-slug.md` — see what's first  •  `/task-add --roadmap ROADMAP-NNN <description>` — file a new task auto-linked to this roadmap |

If any phase was left empty by design (user plans to fill via `/roadmap-add`), note it in a separate **Gaps** section so the user can address it before execution begins.

---

## Output Formatting Rules (mandatory — these override any default style)

1. **Tables, not bullets, for every preview and summary in the conversation.** The roadmap file itself uses checklists (that's its format), but every Q&A preview and Step 8 report uses tables.
2. **Phase names are short and execution-flavored.** "Foundation", "API", "Tests", "Release" — not "Phase where we figure out the database stuff".
3. **Items are single checkbox-sized.** No sub-bullets, no indented steps, no embedded code blocks. If an item needs detail, it's a task — file one.
4. **Task-link items must include the `TASK-NNN:` prefix in the visible link text.** Otherwise the auto-checkoff machinery cannot detect references. See the `.docs/roadmaps/README.md` "Auto-Checkoff Contract" section.
5. **At least one phase must contain at least one item.** An empty roadmap is a hard fail — loop back to Step 3 #5.
6. **Never invent task references.** If the user says "TASK-42" and no `042-*.md` file exists, render it as an inline placeholder, not a broken markdown link.

---

## CRITICAL Rules

1. **Refuse to write the file if any required field is empty or fails its quality bar** (Goal, Owner, ≥1 phase with ≥1 item). Loop back to Step 3 — do not silently fill gaps with invented content.
2. **Never invent task links.** Every `[TASK-NNN: ...](path)` link must point at a real file under `.docs/tasks/active/` or `.docs/tasks/completed/`. Verify with `mcp__serena__find_file` before rendering.
3. **Never use `sed`, `awk`, `echo >>`, or shell redirection to edit markdown.** Always `Read` then `Edit`. See `.docs/guides/mcp-tools.md`.
4. **Never auto-create downstream artifacts.** This skill creates exactly one roadmap file (plus the index row edit). Do **not** create tasks, PRDs, or ADRs as a side effect — the user can file tasks afterward via `/task-add --roadmap ROADMAP-NNN`.
5. **Redirect step-level detail to task territory** — if the user starts specifying *how* under an item, restate the question as "what's the single checkable unit?" and re-elicit.
6. **Status starts as `active` and stays there.** This skill never writes `done`. The flip from `active` → `done` is a manual decision the human makes when every box is `[x]`.
