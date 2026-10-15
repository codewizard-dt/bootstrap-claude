---
name: adr-assess
description: Survey all active ADRs together — surface proposed decisions and accepted decisions with no task, follow supersession chains, and rank decision blocks into one prioritized list with a status update for each
category: researching
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# ADR Assessment

Assess every active decision in `wiki/work/decisions/` together — this is the multi-ADR counterpart to `/adr-finalize` (one proposed block) and `/adr-walkthrough` (one group), which each operate on exactly one item you've already picked. Status lives on each decision block, so the ranked unit is the block (`ADR-NNNN#DM`), listed under its group. This skill folds in the `/adr-next` check (accepted with no task) and leaves `/adr-next` in place as the fast single-gap form.

This skill is strictly read-only: it never flips a status, never creates a file, and never asks questions. Acting on a decision is the job of the commands named in each `Next` line.

---

## Step 1: Discover active ADR groups

Read the Family table in `lib/skills/_shared/ID-RESOLUTION.md` for the decisions directory and prefixes — do not hardcode them. Legacy `DEC-` files coexist with `ADR-` files until migrated, so match both prefixes.

`list_dir` the decisions directory for `.md` files **directly** in it (ignore every subdirectory); skip `lifecycle.md`, `index.md`, `README.md`. None found → STOP: `No active ADRs found in wiki/work/decisions/. Use /adr-create <topic> to create one.`

Read the block statuses and which are terminal from `wiki/work/decisions/lifecycle.md` (currently `proposed | accepted | deprecated | superseded`). Status is read per block, never from the file's location or its group frontmatter.

## Step 2: Parse every group

`Read` each file in full and extract:

- **Group frontmatter**: `id`, `aliases`, `title`, `created`, `updated`, `tags`.
- **Per block** (each `## D1.`-style H2): title, `Status`, `Date`, `Supersedes`, `Tags`, and the `### Links` section's `Source task(s):` line.

A block `Status` outside the lifecycle's enum is reported in Step 6c, and the block is ranked as an other-proposed block.

## Step 3: Task-reference and gating analysis

For each `accepted` block, decide whether it has a task. It has one when `Source task(s):` lists at least one task path or `[[TASK-NNNN]]` link. It also has one when `search_for_pattern` over `wiki/work/tasks/` finds `implements::[[ADR-NNNN#DM]]` (under both prefixes, and by the group's aliases) — a task that exists but was never written into `### Links` still counts. Otherwise the block is **accepted with no task**. A listed task path that no longer exists is a broken reference — note it and treat the block as having no task.

Build the gating set for each `proposed` block. For every active roadmap in `wiki/work/roadmaps/` (by `status:`, not location), run the **Parse a roadmap** procedure defined in `lib/skills/roadmap-next/SKILL.md` — do not restate it here, follow it as written — and take its decision-reference set (`linked_decisions` plus inline `rel::[[ADR-…]]` / legacy `DEC-` links). A reference to a bare group counts for every proposed block in it. Also `search_for_pattern` the block's `ADR-NNNN#DM` (and group ID and aliases, both prefixes) across `wiki/work/requirements/` and `wiki/work/tasks/`. Record per proposed block the roadmaps, PRDs, and tasks that reference it; the count is its **gated count**. A block with a gated count above zero is a **proposed block that gates live work**; one with zero is a proposed block with no task or other dependent.

## Step 4: Supersession chains

Follow every `Supersedes:` field and every `superseded by` pointer between blocks and render each chain as `ADR-0001#D2 → ADR-0004#D1` (oldest to newest, using each file's own `id:`). Flag as chain problems:

- a **cycle** in the chain;
- **asymmetry** — `Supersedes:` set on the new block but the old block not marked `superseded by`, or the reverse;
- a `superseded` block whose successor is not `accepted`;
- a pointer to a block or file that does not exist.

Annotate any `proposed` block that would supersede an `accepted` one in its report row. The supersession rules themselves live in `wiki/work/decisions/lifecycle.md`; do not re-derive them here.

## Step 5: Rank decision blocks

**Long-idle threshold: 60 days** — a proposed block is long-idle when today − `Date` is more than 60 days.

Blocks that are `superseded` or `deprecated`, and `accepted` blocks that have a task, are closed: excluded from ranking and counted once in the report footer. Order the remaining blocks, highest priority first, using this precedence:

1. **Proposed blocks that gate live work** (Step 3) — more gated first; oldest `Date` breaks ties.
2. **Accepted blocks with no task** — decided but never scheduled; oldest `Date` first.
3. **Other proposed blocks** — oldest `Date` first (age = today − `Date`).

Tie-break within a tier: oldest `Date`, then `ADR-NNNN#DM` ascending. Record a one-sentence rationale per block — a judgment call the user can override, not a fact. If nothing is left to rank, STOP with the empty-family text from Step 1.

## Step 6: Report

Print, in this order:

### 6a. Prioritized decisions

```
## Prioritized Decisions

| Rank | Decision | Status | Date | Rationale | Gates / Chain |
|------|----------|--------|------|-----------|---------------|
| 1 | ADR-NNNN#DM — <title> | proposed | YYYY-MM-DD | <one sentence> | gates ROADMAP-NNNN, TASK-NNNN |
| 2 | ADR-MMMM#DM — <title> | accepted | YYYY-MM-DD | <one sentence> | no task |
```

`Gates / Chain` lists what a proposed block gates (Step 3), any supersession chain it sits in (Step 4), and `no task` for an accepted block with none; `—` if none.

### 6b. Status update per decision

One block per ranked decision, in ranked order:

```
### ADR-NNNN#DM — <title>
- Group: <ADR-NNNN — group title>
- Status: <proposed | accepted> — <gating | no task | idle | long-idle>
- Summary: <one line>
- Next: <see below>
```

`Next` by state:

- Proposed → `/adr-finalize <file>#DM`; a group with several proposed blocks: `/adr-walkthrough <file>`; a long-idle proposed block: or `/adr-deprecate <file>#DM`
- Accepted with no task → `/task-create <description> --decision ADR-NNNN#DM`

### 6c. Warnings (omit if none found)

Flag, each as its own short block: chain problems from Step 4, broken references from Step 3, and blocks with an unrecognized `Status`.

Footer, when Step 5 excluded any block: `Closed: N (not assessed)`.

---

## Constraints

- Read-only — no exception. No file edits, no shell, no prompts, no log or index changes, no status flips. `/adr-finalize`, `/adr-walkthrough`, `/task-create`, and `/adr-deprecate` are the follow-up actions the user runs once they act on this report.
- Permitted tools: `list_dir`, `find_file`, `search_for_pattern`, `Read`.
- Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Keep the report terse — no preamble, no closing summary beyond the tables above.
