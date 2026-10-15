---
name: prd-assess
description: Survey all active PRDs together — flag approved requirements with no downstream ADRs or tasks and stale drafts, detect blocking open decisions, and rank them into one prioritized list with a status update for each
category: researching
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# PRD Assessment

Assess every active PRD in `wiki/work/requirements/` together — this is the multi-PRD counterpart to `/prd-finalize` (drafts) and `/adr-extract` (approved requirements needing decisions), which each operate on exactly one PRD you've already picked. Use this skill first when several requirements exist and you need to decide which to advance next.

This skill is strictly read-only: it never flips a status, never creates a file, and never asks questions. Acting on a PRD is the job of the commands named in each `Next` line.

---

## Step 1: Discover active PRDs

Read the Family table in `lib/skills/_shared/ID-RESOLUTION.md` for the requirements directory and prefixes — do not hardcode them. Legacy `REQ-` files coexist with `PRD-` files until migrated, so match both prefixes.

`list_dir` the requirements directory for `.md` files **directly** in it (ignore every subdirectory); skip `lifecycle.md`, `index.md`, `README.md`. None found → STOP: `No active PRDs found in wiki/work/requirements/. Use /prd-create <idea> to draft one.`

Read the status names and which are terminal from `wiki/work/requirements/lifecycle.md` (currently `draft | approved | retired`, with `retired` terminal). Decide active vs. closed by each file's `status:`, never by location. Closed PRDs are excluded from ranking and counted once in the report footer. If nothing is active after this filter, STOP with the same empty-family text.

## Step 2: Parse every active PRD

`Read` each file in full and extract:

- **Frontmatter**: `id`, `aliases`, `title`, `status`, `owner`, `created`, `updated`, `tags`, `stakeholders`.
- **Amendments**: each `## Amendment N` block (count and latest date).

A `status:` outside the lifecycle's enum is reported in Step 5c, and the PRD is ranked as a fresh draft.

## Step 3: Downstream and blocking analysis

For each active PRD, `search_for_pattern` for its ID and every alias (under both prefixes) across `wiki/work/decisions/`, `wiki/work/tasks/`, and `wiki/work/roadmaps/`. Count a hit whether it is frontmatter (`linked_requirements`, `linked_prds`), a typed link (`derived_from::`, `implements::`, `relates_to::`), or a plain `[[…]]` link. Record per PRD: linked ADR groups, linked tasks, linked roadmaps.

For each linked ADR group, `Read` it and resolve every `## D1.`-style block's `Status:` as laid out in `wiki/work/decisions/lifecycle.md`. If a block is `superseded`, follow its `superseded by` pointer to the successor block and re-check that status instead. Any resolved block still `proposed` is an **open decision** blocking the PRD: record `{PRD, ADR-NNNN#DM, title}`. A missing linked file is a broken reference — note it, don't block on it.

## Step 4: Rank PRDs

**Stale-draft threshold: 30 days** — a draft is stale when `updated` is more than 30 days before today.

Order the active PRDs, highest priority first, using this precedence:

1. **Approved with no linked ADRs and no linked tasks** — approved but nothing downstream exists; oldest `updated` first.
2. **Approved and blocked by open decisions** — at least one linked ADR block is still `proposed` (Step 3).
3. **Stale drafts** — `status: draft` with `updated` older than 30 days.
4. **Fresh drafts.**
5. **Approved and fully flowing** — every linked ADR block accepted and at least one task exists; needs nothing.

Tie-break within a tier: oldest `updated`, then ID ascending. Record a one-sentence rationale per PRD — a judgment call the user can override, not a fact.

## Step 5: Report

Print, in this order:

### 5a. Prioritized PRDs

```
## Prioritized PRDs

| Rank | PRD | Status | Updated | Rationale | Blocks / Blocked by |
|------|-----|--------|---------|-----------|---------------------|
| 1 | PRD-NNNN — <title> | approved | YYYY-MM-DD | <one sentence> | no downstream items |
| 2 | PRD-MMMM — <title> | approved | YYYY-MM-DD | <one sentence> | blocked by ADR-NNNN#DM |
```

`Blocks / Blocked by` lists open decisions from Step 3 and, for flowing PRDs, the linked task/roadmap; `—` if none.

### 5b. Status update per PRD

One block per PRD, in ranked order:

```
### PRD-NNNN — <title>
- Owner: <owner, or "unassigned">
- Status: <draft | approved> — <fresh | stale | unlinked | blocked | flowing>
- Summary: <one line>
- Next: <see below>
```

`Next` by state:

- Approved, unlinked → `/adr-extract <file>`, or `/task-create <description>` when the PRD needs no architectural decision
- Approved, blocked → `/adr-finalize <adr-file>#DM`
- Draft → `/prd-finalize <file>`; a stale draft: or `/prd-deprecate <file>` if abandoned
- Flowing → none needed; cite the linked task/roadmap

### 5c. Warnings (omit if none found)

Flag, each as its own short block: broken references from Step 3, and PRDs with an unrecognized `status:`.

Footer, when Step 1 excluded any closed PRD: `Closed: N (not assessed)`.

---

## Constraints

- Read-only — no exception. No file edits, no shell, no prompts, no log or index changes, no status flips. `/prd-finalize`, `/adr-extract`, `/adr-finalize`, and `/task-create` are the follow-up actions the user runs once they act on this report.
- Permitted tools: `list_dir`, `find_file`, `search_for_pattern`, `Read`.
- Never bash reads (`cat`/`find`/`grep`/`sed`/`ls`).
- Keep the report terse — no preamble, no closing summary beyond the tables above.
