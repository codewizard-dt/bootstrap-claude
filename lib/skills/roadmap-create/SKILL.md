---
name: roadmap-create
description: Create a structured execution-plan roadmap in wiki/work/roadmaps/ via short Socratic Q&A — captures goal, phases, and the initial hybrid (task-link OR inline) checklist
category: planning
model: claude-sonnet-4-6
argument-hint: <initiative/goal description>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`; run /primer if not done this session.
**Read `wiki/work/roadmaps/lifecycle.md` first — it is authoritative for the roadmap frontmatter schema, status lifecycle, and ID/filename rules. The file template, item-format rules, index format, and anti-patterns are specified inline in this skill below.**
**Run `/research <topic>` on the roadmap topic BEFORE any Q&A or file creation. Do not skip this step.**

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

Write a roadmap when work spans multiple discrete units, ordering matters, and you want at-a-glance visibility of what's next.

If the topic is a single task with several steps, **stop and tell the user** — the task file's own `## Steps` checklist already serves that purpose. Suggest `/task-add` instead.

---

## Instructions

### Step 1: Parse the topic and recall project context

1. **Extract** the core initiative from `$ARGUMENTS`. If it is too vague (e.g. "auth", "cleanup", "the next thing"), use `AskUserQuestion` to narrow it before any other work.
2. **Invoke `/research <topic>`** — run the research skill on the roadmap topic now. Do not proceed to Step 2 until this completes. Use its findings to inform phase ordering, known constraints, and item content throughout the Q&A.
3. **Recall Serena memories** that may inform the execution order:
   - `mcp__serena__list_memories`
   - `mcp__serena__read_memory` for any topic-relevant memory (sequencing constraints, prior roadmaps, known dependency rules)
3. **Read project context**:
   - `CLAUDE.md` (project conventions)
   - `wiki/work/roadmaps/lifecycle.md` (frontmatter schema, status lifecycle — authoritative)
   - A sample of recent roadmaps in `wiki/work/roadmaps/` to learn local conventions
   - The active-task bullets in `wiki/work/tasks/index.md` so you know what task files already exist and can be linked

### Step 2: Locate the roadmap directory and assign a number

Roadmaps live at `wiki/work/roadmaps/NNN-slug.md`. Numbers are 3-digit zero-padded.

1. **Use `mcp__serena__list_dir` on `wiki/work/roadmaps/`** to scan existing files. Collect every `NNN-` prefix.
2. **Use `mcp__serena__search_for_pattern`** against `wiki/work/roadmaps/index.md` for `ROADMAP-\d{3}` entries — these may reserve numbers not yet on disk.
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
| 4 | **Linked PRD / ADRs (may be empty)** | Existing `PRD-NNN` or `DEC-NNNN#DM` references, or `—` if standalone | Inventing references that don't exist |

**Suggested first batch (one `AskUserQuestion` call covering all four)**:

| Batch | Questions covered |
|-------|-------------------|
| 1 | Goal, Phases, Owner, Linked PRD/ADRs |

Then **per-phase**, in a single follow-up `AskUserQuestion` round (one question per phase, up to 4 — split into multiple rounds only if there are 5 phases):

| # | Elicitation | Quality bar |
|---|-------------|-------------|
| 5 | **Phase N items** | For each phase, the user names (a) any existing tasks (`TASK-NNN` or slug fragments) that belong in this phase, and (b) any inline placeholder items. Items may be empty if the user wants to fill in later via `/roadmap-add` — but **at least one phase must contain at least one item** (a roadmap with zero items is not a roadmap) |

When the user supplies a task reference:

- Look it up in `wiki/work/tasks/` via `mcp__serena__find_file` to confirm it exists. The link must read `[[TASK-NNN: <task title>]]`.
- If the user supplies a task reference that does **not** exist, treat it as an inline placeholder (do not fabricate a link). Note in the per-phase clarification that a task file must be created before this item can be worked on — it will be created automatically when `/roadmap-next` is run.

**Inline placeholders**: items without a corresponding task file are written as `- [ ] <description>`. They are valid at creation time because tasks may not exist yet. However, **inline items cannot be worked on** — `/roadmap-next` will automatically invoke `/task-add` to create a task file for each inline item before surfacing it. The roadmap item is then upgraded to a task-link in place.

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
| Per-phase items | One sub-list per phase showing each item's rendered form (`[[TASK-NNN: title]]` or inline text) |

The user confirms via `AskUserQuestion` with options like *Approve and write*, *Edit specific phase*, *Cancel*. Do **not** write the file until the user explicitly approves.

If the user requests edits, loop back to the relevant Step 3 elicitation, re-ask, and re-present.

### Step 5: Re-verify the next available number — IMMEDIATELY before writing

The number determined in Step 2 may now be stale (other roadmaps created mid-session, the README Index may list reservations not yet on disk). Do a fresh scan now:

- `mcp__serena__list_dir` on `wiki/work/roadmaps/`
- `mcp__serena__search_for_pattern` against `wiki/work/roadmaps/index.md` for `ROADMAP-\d{3}` entries
- Collect every `NNN-` prefix, take `max + 1`, zero-pad to 3 digits
- If the number you planned to use in Step 4 has been taken, silently bump to the new next-available number and use it. Do not re-prompt the user.
- **Never call `Write` before completing this re-scan.**

### Step 6: Write the roadmap file

Use `Write` to create `wiki/work/roadmaps/NNN-slug.md` following the field table below and the item-rendering rules **exactly**; the frontmatter must match the schema in `wiki/work/roadmaps/lifecycle.md`.

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

**Item rendering rules**:

- Task-link item: `- [ ] [[TASK-NNN: <task title>]]`
- Inline item: `- [ ] <free-form description>`

**Refuse to write** if:

- The Goal is missing or vague
- The Owner is missing or "the team"/"everyone"
- Every phase is empty (zero items total)

Loop back to Step 3 instead — do not silently invent content.

### Step 7: Update the roadmap index

Edit `wiki/work/roadmaps/index.md` to add a new bullet line (active items only — a flat list, no table).

1. `Read` `wiki/work/roadmaps/index.md` to locate the active-items list.
2. If the placeholder line (`_(none yet)_` or a "no roadmaps yet" note) exists, **replace** it with the new line. Otherwise **append** the new line in numerical order.
3. Use the entry format documented at the top of `index.md`:

   `- [ROADMAP-NNN — <title>](NNN-slug.md) — <one-line summary> · 0/<total> items checked`

   where `<title>` is the roadmap's H1 sub-title (without any `Roadmap NNN:` prefix), `<one-line summary>` is a short description of the goal, and `<total>` is the count of `- [ ]` checkboxes you just wrote across all phases.

Use `Edit` (not `sed`, `awk`, `echo >>`, or any shell redirection). See `.docs/guides/mcp-tools.md`.

### Step 8: Refresh the hot cache

The new roadmap is durable, cross-session-relevant wiki state. Run the **Hot Cache Refresh** procedure — defined in `/wiki-ingest` Step 8 (`lib/skills/wiki-ingest/SKILL.md`) — to regenerate `wiki/hot.md` in full, surfacing this roadmap under Recent Changes and its first wave under Active Threads. Do not restate the procedure here; follow it as written.

### Step 9: Report completion

Print a tabular summary:

| Field | Value |
|-------|-------|
| File path | `wiki/work/roadmaps/NNN-slug.md` |
| Status | `active` |
| Phases | N |
| Total items | M (task-link: X, inline: Y) |
| Owner | <name> |
| Linked PRD | PRD-NNN or `—` |
| Linked ADRs | list or `—` |
| Index updated | yes (1 row added) |
| Suggested next steps | `/roadmap-next wiki/work/roadmaps/NNN-slug.md` — surfaces the first item and creates task files for any inline placeholders  •  `/task-add --roadmap ROADMAP-NNN <description>` — file a new task auto-linked to this roadmap |

If any phase was left empty by design (user plans to fill via `/roadmap-add`), note it in a separate **Gaps** section so the user can address it before execution begins.

If the roadmap contains any inline placeholder items (items without a task-link), include a **Placeholders** section listing them:

> **Placeholders (task file pending):** These items will have task files created for them automatically when `/roadmap-next` runs. They cannot be tackled until a task file exists.
> - Phase N: "<item text>"
> - ...

This is informational only — no action required now.

---

## Output Formatting Rules (mandatory — these override any default style)

1. **Tables, not bullets, for every preview and summary in the conversation.** The roadmap file itself uses checklists (that's its format), but every Q&A preview and Step 8 report uses tables.
2. **Phase names are short and execution-flavored.** "Foundation", "API", "Tests", "Release" — not "Phase where we figure out the database stuff".
3. **Items are single checkbox-sized.** No sub-bullets, no indented steps, no embedded code blocks. If an item needs detail, it's a task — file one. Items without a task file are written as inline placeholders (`- [ ] <description>`) and are valid at creation time, but will be converted to task-links automatically by `/roadmap-next` before they can be worked on.
4. **Task-link items must use `[[TASK-NNN: <title>]]` format.** The `TASK-NNN:` prefix is required so the auto-checkoff machinery can detect references. Path-based markdown links break when files move to `archive/`; wiki-style ID links never do.
5. **At least one phase must contain at least one item.** An empty roadmap is a hard fail — loop back to Step 3 #5.
6. **Never invent task references.** If the user says "TASK-42" and no `042-*.md` file exists, render it as an inline placeholder, not a `[[TASK-NNN: ...]]` wiki link.

---

## CRITICAL Rules

1. **Refuse to write the file if any required field is empty or fails its quality bar** (Goal, Owner, ≥1 phase with ≥1 item). Loop back to Step 3 — do not silently fill gaps with invented content.
2. **Never invent task links.** Every `[[TASK-NNN: ...]]` wiki link must correspond to a real file under `wiki/work/tasks/`. Verify with `mcp__serena__find_file` before rendering.
3. **Never use `sed`, `awk`, `echo >>`, or shell redirection to edit markdown.** Always `Read` then `Edit`. See `.docs/guides/mcp-tools.md`.
4. **Never auto-create downstream artifacts.** This skill creates exactly one roadmap file (plus the index row edit). Do **not** create tasks, PRDs, or ADRs as a side effect — the user can file tasks afterward via `/task-add --roadmap ROADMAP-NNN`.
5. **Redirect step-level detail to task territory** — if the user starts specifying *how* under an item, restate the question as "what's the single checkable unit?" and re-elicit.
6. **Status starts as `active` and stays there.** This skill never writes `done`. The flip from `active` → `done` is a manual decision the human makes when every box is `[x]`. After flipping, the file may be moved to `wiki/work/roadmaps/archive/` — `/roadmap-next` will suggest this step.
