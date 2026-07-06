---
name: decision-finalize
description: Finalize a single proposed decision block; run E-C-A-D-R audit, supersession check, and flip status to accepted
category: planning
model: claude-sonnet-4-6
effort: high
argument-hint: <path/to/decision.md#DM, NNNN-slug#DM, or NNNN#DM>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`; run /primer if not done this session.
**Read `wiki/work/decisions/lifecycle.md` first** — it defines the Decision Group model, the per-decision supersession rule, the two-block cross-reference rule, and the relationship graph that finalization must keep in sync.

# Finalize Decision

Take a **single proposed decision block** in a decision file, surface every open question/placeholder, ratify it with the user, **enforce the supersession rule** against any prior accepted decision in the same area, then flip *that decision's* status to **accepted**.

Each decision is finalized **independently** — a file with three proposed decisions takes three invocations; **sibling decisions are never touched**. Once accepted, a decision is immutable; to change it, write a successor via `/decision-create` and finalize it to supersede the old one.

**Target**: $ARGUMENTS

---

## Step 1: Locate the (file, decision) pair

| Input | Resolution |
|-------|------------|
| `<path>#DM` | file as-is; decision = `DM` |
| `<NNNN-slug>#DM` | search `wiki/work/decisions/` for `NNNN-slug.md` |
| `<NNNN>#DM` | pad to 4 digits; `find_file` mask `NNNN-*.md` |
| `<path>`/`<NNNN-slug>`, file has **one** proposed decision | auto-resolve to it |
| same, **multiple** proposed | list them, `AskUserQuestion` to pick |
| Empty/missing | list every `proposed` decision across all files (one row per `DEC-NNNN#DM`), ask user |

Can't locate file or decision → **stop and report**; never invent or create.

## Step 2: Read and audit the target block

1. `Read` the file; locate the `## DM. <title>` H2 and everything to the next `## D*` or EOF.
2. **Verify status is `proposed`:** `accepted` → stop (immutable; suggest `/decision-create` successor). `deprecated`/`superseded by …` → stop (no longer authoritative).
3. **Audit the target block only** (siblings out of scope) for unresolved content:

| Gap | Detection |
|-----|-----------|
| Placeholder text | `<...>`, `TBD`, `TODO`, `???`, `FIXME`, `[fill in]`, HTML comments |
| Empty table cells | only `…`/`...`/placeholder dashes/whitespace |
| Empty driver/option/consequence rows | substance column blank or templated |
| Missing chosen option | `### Decision Outcome` with no bolded option |
| Missing/blank `Date` | blank, `YYYY-MM-DD`, or future |
| Missing `Deciders` | blank or `<names or roles>` |
| Missing `Tags` | empty (required for supersession detection) |
| Missing validation signals | `### Validation` empty or all placeholders |
| Missing flow diagram | flow/sequence/before-after decision has no mermaid (skip if purely static) |
| Asymmetric option analysis | some options have full pro/con tables, others don't |
| Bullet-list comparisons | `- Good/Bad, because …` → convert to tables |
| Stale "Considered Options" | option in trade-offs but missing from matrix (or vice versa) |

4. **Build an Audit Report** in context: file, decision (`DM — title`), current status, siblings + their status (out of scope), gaps found (N), then a gaps table (priority, section, gap, resolution strategy).

## Step 2.5: Supersession check (mandatory, per-decision)

The rule operates **per decision, across every file**. Procedure:
1. `list_dir` `wiki/work/decisions/` (exclude `lifecycle.md`); `Read` each, walk every `## D*`, collect `Status: accepted` blocks.
2. Score each candidate: **Tier 1** ≥1 shared tag · **Tier 2** sub-title noun-phrase overlap · **Tier 3** file-slug stem overlap (only when both are the sole `D1` of single-decision files) · **Tier 4** explicit `Supersedes:` already in target (authoritative — verify the named target exists and is `accepted`).
3. Build a candidate report (Candidate, Status, Tags overlap, Title overlap, Slug overlap, Verdict).

**Resolution:**
| Situation | Action |
|-----------|--------|
| Zero candidates | continue — fresh area |
| One candidate, all signals strong | `AskUserQuestion`, default "supersede this candidate" |
| Multiple | ranked list; user picks at most one |
| Candidate is `proposed` | skip (only `accepted` can be superseded); flag two-proposed-in-area as a consolidation hint |
| Candidate already `superseded by DEC-X#DY` | walk the chain to DEC-X#DY (the area's head) and supersede that instead |
| User declares "different area" despite signals | honor it; recommend revising target's tags to keep detection clean |

Persist the supersession target (or explicit "none") for Step 4. Do NOT proceed without resolving this.

## Step 3: Present audit, resolve open questions

1. Present the audit report as one tabular summary — never bullets.
2. Resolve gaps via `AskUserQuestion` in priority order: (1) chosen option not specified — everything flows from it; (2) empty decision drivers; (3) empty option trade-offs; (4) empty `Tags` (supersession detection); (5) empty consequences; (6) missing validation signals (E-C-A-D-R "R", Definition of Done); (7) Date/Deciders/Supersedes metadata.
3. **Question style:** frame with context from this block (not siblings); for the chosen option show the comparison table inline; for trade-offs/consequences ask focused questions; for validation demand ≥1 **measurable** signal with threshold + timeframe.
4. **Format-correction gaps** (bullet→table, asymmetric tables, missing mermaid) need no questions — fix in Step 4.

## Step 4: Apply edits to the target block

**`Edit` only** (never `sed`/`awk`/`echo >>`). **Touch only the target block; siblings are inviolate.** Order:
1. Fill resolved content — each placeholder/empty row/TBD → user's confirmed answer; one `Edit` per distinct old_string, constrained to the target block via unique surrounding text.
2. Bold the chosen option in `### Decision Outcome`.
3. Convert any bullet-list comparisons to tables (within this block).
4. Add the mermaid diagram if flagged missing.
5. Update metadata: `Status` → `accepted`; `Date` → today (overwrite if blank/wrong, preserve if user wants original); `Deciders` → confirmed; `Tags` → confirmed non-empty; `Supersedes` → `DEC-MMMM#DK` or `none`.
6. **If Step 2.5 named a supersession target**, apply the two-block cross-reference rule **atomically** (both change or neither); target may be in the same or a different file:
   - **This decision (superseder):** `Supersedes: DEC-MMMM#DK` in metadata; `### Links` lists `Supersedes [[MMMM-slug\|DEC-MMMM#DK: title]]`.
   - **Superseded block:** flip `Status: accepted` → `Status: superseded by DEC-NNNN#DX`; insert callout `> **Superseded by [[NNNN-slug\|DEC-NNNN#DX: title]]** on YYYY-MM-DD` directly **under that decision's H2** (not the file H1), between the H2 and its metadata bullets so a reader sees it first.
   - **Superseded decision's siblings:** untouched.
7. Update `Last updated` in the file front matter to today — the only file-level edit.

## Step 5: Re-audit before finalizing

Re-read the target block. Finalize **only when all** hold:
- [ ] No placeholder text in the target block
- [ ] Every option in `### Considered Options` has a complete trade-off table
- [ ] The criterion comparison matrix has no empty cells
- [ ] `### Decision Outcome` names a bolded chosen option with a one-sentence justification
- [ ] `### Consequences` has ≥1 positive and ≥1 negative row, no placeholders
- [ ] `### Validation` has ≥1 row with a concrete signal, threshold, and timeframe (E-C-A-D-R "R")
- [ ] No bullet-list comparisons remain — every comparison is a table
- [ ] If flow/sequence/before-after, a mermaid block is present
- [ ] `Status: accepted`, `Date` today (or user-confirmed), `Deciders` filled, `Tags` non-empty
- [ ] If Step 2.5 named a target, **both** blocks updated atomically (target's `Supersedes`+`Links`; superseded block's `Status`+callout)
- [ ] No other accepted decision in the same area exists across the log (no parallel `accepted` after this finalize)
- [ ] **Sibling decisions in this file are byte-for-byte unchanged**

Any failure → return to the relevant step. **Do not flip to `accepted` while gaps remain.**

## Step 6: Update index and relationship graph (`wiki/work/decisions/lifecycle.md`)

1. **Index — target row:** `Status` → `accepted`; `Date` → today; `Supersedes` → `[[MMMM-slug\|DEC-MMMM#DK: title]]` if named else `—`; `Superseded By` → `—`.
2. **Index — superseded row (if any):** `Status` → `superseded by DEC-NNNN#DX`; `Superseded By` → `[[NNNN-slug\|DEC-NNNN#DX: title]]`.
3. **Relationship Graph** (mermaid `flowchart`): add a node for `DEC-NNNN#DM` (title + date); if superseding, add an edge superseded→new labelled `superseded by` with date; update `class` lines (new → `accepted`, superseded → `superseded`); if still placeholder, replace with a real graph for the chain; subgraphs may group per file or per area.

If `lifecycle.md` doesn't exist, create it from the template under `/decision-create` Step 6. **Verify all three sections agree** before saving (index saying `superseded` while the graph shows the node `accepted` is a broken commit).

## Step 6.5: Family index + archive if fully terminal

A group stays in `wiki/work/decisions/index.md` only while ≥1 block is `proposed`.
- Proposed blocks remain → update the row's per-decision note (e.g. `D1 accepted, D2 proposed`); don't move the file.
- No proposed blocks remain (all `accepted`/`superseded`):
  1. Delete the group's row from `index.md`.
  2. `git mv wiki/work/decisions/<file>.md wiki/work/decisions/archive/<file>.md` (Bash — `git mv` only).
  3. Append to `wiki/work/decisions/archive/index.md` (dominant final status — `accepted` unless all `superseded`): `| [[DEC-NNNN]] | <Title> | accepted | YYYY-MM-DD |`.

`Read` then `Edit` for all index edits — never `sed`.

## Step 7: Append log entry (`wiki/log.md`, `Edit` — never `echo >>`)
- No supersession: `## [YYYY-MM-DD] decision-accepted | DEC-NNNN#DM <Decision Title>`
- Supersession: `## [YYYY-MM-DD] decision-superseded | DEC-MMMM#DK superseded by DEC-NNNN#DM`

## Step 8: Cross-link follow-up work

Scan `### Consequences` for `🔁 Follow-up` rows (suggest only, never auto-create):
| Type | Suggestion |
|------|-----------|
| Implementation ("write task: …") | `/task-add <desc referencing DEC-NNNN#DM>` |
| Time-based revisit ("revisit in 6 months") | offer `/schedule` for the revisit date |
| Metric to instrument | `/task-add` or fold into an existing task — ask the user |

## Step 9: Update memory if a new pattern emerges

If the accepted decision creates a non-obvious pattern, integration constraint, or gotcha: `mcp__serena__write_memory` (topic-hierarchical name, e.g. `architecture/data-layer/cache-strategy`), referencing `DEC-NNNN#DM` not just the file; prefer `edit_memory` if a memory already covers the area.

## Step 10: Report

Table: Decision (`DEC-NNNN#DM`), File, Old→New status (`proposed → accepted`), Gaps resolved (count), Format fixes (count), Supersession (`DEC-MMMM#DK` or `none`), Sibling decisions + status (unchanged), Index updated, Graph updated, Log appended, Suggested next steps (`/task-add …`, `/schedule …`, `/decision-finalize <file>#Dother`, `/decision-next`). Mention remaining proposed siblings. If the group is now fully terminal, note the file moved to `archive/` (Step 6.5) — `[[DEC-NNNN]]` cross-refs stay valid regardless of location.

---

## Output formatting rules (mandatory)

1. **Tables not bullets** — every comparison and audit summary, in output and edits.
2. **One Edit per gap** — surgical; don't rewrite whole blocks for one placeholder.
3. **Never alter accepted decisions** — refuse an already-accepted target; suggest `/decision-create`.
4. **Never touch sibling decisions** — only the target (plus the superseded block if applicable).
5. **Present tense, full sentences** when filling content.
6. **No fabrication** — if the user lacks an answer (e.g. concrete validation thresholds), keep `proposed`, mark the section honestly, and report remaining gaps.

## CRITICAL rules

1. **Status flip is one-way and final** — only after every Step 5 item passes.
2. **Supersession is atomic and bidirectional** — new block, superseded block, index, and graph all change together or none do.
3. **Per-decision scope** — only the target block; siblings byte-for-byte unchanged at the end.
4. **No parallel `accepted` in the same area** — the chain invariant; if you can't resolve which supersedes which, leave `proposed` and report.
5. **Never `sed`/`echo >>`/`cat <<EOF`** — always `Edit`.
6. **Never auto-create tasks or schedules** — suggest them.
7. **Max 3 sub-processes at a time** if delegating; **always terminate processes when done**.
