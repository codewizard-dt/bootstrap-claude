---
name: adr-deprecate
description: Deprecate a single ADR decision block — set Status to deprecated, document the reason, update the family index, append a log entry. Status-only: the file never moves.
category: planning
model: claude-haiku-4-5-20251001
argument-hint: <ADR-NNNN#DM | NNNN-slug#DM | path#DM> [reason]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.
**Read `wiki/work/decisions/lifecycle.md` first** — it defines the Decision Group model, the per-decision status lifecycle, and the terminal states.

# Deprecate ADR

Set a **single decision block's** `Status` to `deprecated`, document why, and update the decision group's row in the family index. A Decision Group has no group-level status — each `## DM.` block carries its own `Status:` — so this skill works per decision, and **sibling blocks are never touched**. The file stays in `wiki/work/decisions/`, so cross-references using `[[ADR-NNNN]]` and `ADR-NNNN#DM` (and legacy `DEC-NNNN` links, which still resolve) are unaffected.

`deprecated` withdraws a decision **without a successor**: a `proposed` decision is abandoned, or an `accepted` decision is withdrawn. When a replacement decision exists, do not use this skill — write it with `/adr-create` and let `/adr-finalize` supersede the old block. **`superseded` is set only by `/adr-finalize` — never by this skill.**

---

**ADR**: $ARGUMENTS

---

## Instructions

### Step 1: Resolve the file and the decision

Parse `$ARGUMENTS`:
- **First token(s)** — the reference: `<path>#DM`, `ADR-NNNN#DM`, `<NNNN-slug>#DM`, or the same without the suffix
- **Remaining text** — optional reason for deprecation (may be elicited in Step 3 if absent)

Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: decisions · scope: active · ambiguous: interactive · empty: list every Decision Group in `wiki/work/decisions/` and ask the user via `AskUserQuestion` to pick

The `#DM` suffix is split off and handed back per that doc's **`#DM` suffix** section; decision = `DM`. Both `ADR-NNNN` and legacy `DEC-NNNN` references are accepted.

| Input | Resolution |
|-------|------------|
| `#DM` given | decision = `DM` |
| No `#DM`, group has exactly **one** non-terminal block (`proposed` or `accepted`) | default to it, after the user confirms in Step 3 |
| No `#DM`, group has **several** non-terminal blocks | list them and ask via `AskUserQuestion` which one |

An item still sitting in a legacy holding folder from the older layout is already terminal: if the resolver STOPs and the ID appears in that legacy folder's index, report "already closed" instead of "not found".

If the file or the decision block cannot be located, **stop** and report — never invent or create.

### Step 2: Read the group and verify the block's status

1. **Read** the group file with `Read`; locate the `## DM. <title>` H2 and everything up to the next `## D*` or end of file.
2. **Check that block's `Status:`:**

   | Current status | Action |
   |----------------|--------|
   | `proposed` | Continue — abandon a draft decision |
   | `accepted` | Continue — withdraw a decision with no successor |
   | `deprecated` | **STOP.** Tell the user: "ADR-NNNN#DM is already deprecated. No action needed." |
   | `superseded by …` | **STOP.** Tell the user: "ADR-NNNN#DM is already superseded — it is no longer authoritative." Point at the successor named in the status. |

3. **Find downstream artifacts** (Serena `search_for_pattern`, read-only):
   - Other blocks (in this group or any other) whose `Supersedes:` names `ADR-NNNN#DM` (or its legacy `DEC-NNNN#DM` form), or that link to it in `### Links`
   - Tasks with `implements::[[ADR-NNNN#DM]]` in `wiki/work/tasks/`, plus the block's own `Source task(s):` links
   - Build a downstream artifacts table for Step 3

### Step 3: Confirm with the user

Use `AskUserQuestion` to confirm. Show:

- The group file (full path), the `ADR-NNNN#DM` ID, and the decision title
- The block's current status
- Downstream artifacts table (if any):

| Artifact | Type | Current status | Suggested action |
|----------|------|----------------|------------------|
| `[[ADR-0009-caching\|ADR-0009#D1]]` | dependent decision | accepted | Review independently — it may rest on the withdrawn decision; this skill never edits it |
| `[[0042-cache-layer\|TASK-0042]]` | linked task | todo | Run `/task-close wiki/work/tasks/TASK-0042-cache-layer.md` if the task is also cancelled |

Ask the user:

1. **"Deprecate ADR-NNNN#DM? (yes / no)"**
2. **"Reason for deprecating ADR-NNNN#DM?"** (if not provided in `$ARGUMENTS` — required, one line or more)

If the user says **No**, STOP. Do not proceed.

If a replacement decision exists or is wanted, say so and suggest `/adr-create <topic> (supersedes ADR-NNNN#DM)` followed by `/adr-finalize` instead — that is the supersession path, and it is not this skill.

**Do NOT ask whether to close linked tasks or edit dependent decisions** — they are surfaced as suggestions only. This skill never auto-cascades.

### Step 4: Apply the deprecation edits

Edit only — see `~/.claude/skills/_shared/SKILL-BOILERPLATE.md § Edit hygiene`. **Touch only the target block; sibling decisions are inviolate.**

Apply in this order:

1. **Block `Status:` → `deprecated`** (`- **Status**: <current>` becomes `- **Status**: deprecated`).
2. **Insert the callout directly under that decision's H2** — between the H2 and its metadata bullets, the same placement `/adr-finalize` uses for its supersession callout, so a reader sees it first:

   ```
   > **Deprecated** on YYYY-MM-DD: <reason provided by user>
   ```
3. **Update the group frontmatter `updated:`** (or the `Last updated` line, whichever the file carries) to today's date — the only file-level edit.
4. **Keep the index and graph sections in agreement.** If the group file or `wiki/work/decisions/lifecycle.md` carries the sections `/adr-finalize` maintains — an Index table with a `Status` column and a `Relationship Graph` mermaid block with `class` lines — flip the target row's `Status` to `deprecated` and the target node's class to `deprecated`. Define a `deprecated` class in the graph only if the graph already declares classes; otherwise reuse `superseded`'s style. Verify all sections agree before saving (an index saying `deprecated` while the graph shows the node `accepted` is a broken commit). If neither carries these sections, skip this item.

The block's content is otherwise untouched: an accepted decision is immutable except for this status change and its callout.

### Step 5: Update the family index

Update the group's row in `wiki/work/decisions/index.md`. Its trailing per-block summary lists each block's status (`D1 proposed, D2 deprecated, …`) — change the target block's entry to `deprecated`.

Then place the row by the rule for decisions: a group is Active while any block is `proposed`. Moving a row to Closed is the in-place close mechanic defined once in `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` § In-place close (roadmaps, decisions, requirements) with `family: decisions` (the block `Status:` was already set in Step 4, and Step 6 writes this skill's own log entry).

| State after the flip | Row placement |
|----------------------|---------------|
| At least one block still `proposed` | Leave the row in Active |
| No block remains `proposed` | Move the row from Active to the `## Closed` section |

When moving, delete the row from Active and add the same entry under a `## Closed` heading, using the Active bullet format (the trailing per-block summary carries the terminal statuses):

```
- [ADR-NNNN — Title](ADR-NNNN-slug.md) — one-line summary · D1 accepted, D2 deprecated
```

If the index has no `## Closed` heading yet, create it at the end of the file (with the entry-format line if the Active section carries one). Keep Closed rows in numeric-ID order. If the row is already in Closed (an accepted block deprecated in an already-closed group), only update its summary.

Use `Read` then `Edit`. If the row is absent, note it and continue.

### Step 6: Append to wiki/log.md

Append one entry to `wiki/log.md`:

```
## [YYYY-MM-DD] adr-deprecated | ADR-NNNN#DM <title> — reason: <one-line summary of reason>
```

Use `Read` then `Edit`.

### Step 7: Surface downstream artifacts for independent action

Print the downstream artifacts table from Step 3 again, with suggested next-action commands:

```
Linked tasks and dependent decisions surfaced for independent review:

To act on linked tasks (each independently):
  /task-close wiki/work/tasks/TASK-0042-cache-layer.md   # if the task is also cancelled

To act on dependent decisions (each independently):
  # Accepted decisions are immutable — review whether they still hold;
  # if one should change, write a successor with /adr-create and finalize it
  /adr-create <topic> (supersedes ADR-0009#D1)
```

### Step 8: Report completion

Print a tabular summary:

| Field | Value |
|-------|-------|
| Decision | `ADR-NNNN#DM <title>` |
| File path | `wiki/work/decisions/ADR-NNNN-slug.md` (unchanged) |
| Old status | `proposed` or `accepted` |
| New status | `deprecated` |
| Reason | <one-line summary> |
| Family index updated | yes (row stays in Active / row moved to Closed / summary only) |
| wiki/log.md entry | yes |
| Dependent decisions surfaced | count |
| Linked tasks surfaced | count |

---

## Output Formatting Rules

1. Use tables for the downstream artifacts list and the completion report — never paragraph prose.
2. **One `Edit` call per change** — never bulk rewrites.
3. **The file never moves**, so all ID cross-references remain valid.
4. **The skill never auto-closes tasks or edits dependent decisions** — it surfaces them with suggested commands.
5. **The deprecation callout is permanent** — it is the audit trail for why this decision was withdrawn.

---

## CRITICAL Rules

1. **Status-only.** Set the block's `Status: deprecated`, add the callout, and update the index; **never move the file**, and this skill needs no shell access — it is pure `Read` and `Edit`.
2. **Touch only the target block.** Sibling decisions in the group stay byte-for-byte unchanged.
3. **`superseded` is set only by `/adr-finalize`** — never by this skill. A decision with a successor goes through `/adr-create` then `/adr-finalize`.
4. **Never auto-cascade** to linked tasks or dependent decisions. Surface them as suggestions only (`/task-close <path>`, independent review).
5. **Confirm with the user before any edits** — `AskUserQuestion` is mandatory in Step 3.
6. **Deprecation reason is required** — refuse to deprecate without a documented reason.
7. **Refuse if already `deprecated` or `superseded`** — these are terminal states; running again is a no-op, not an error.
8. Maximum 3 sub-processes at a time if delegating any step.
9. Always terminate background processes when done.
