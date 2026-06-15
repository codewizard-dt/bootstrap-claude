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
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


# Finalize Decision

Take a **single proposed decision block** within a decision file, surface every open question or unresolved placeholder, ratify the decision with the user, **enforce the supersession rule** against any prior accepted decision in the same area, then flip *that decision's* status to **accepted**.

Each decision is finalized **independently**. A file with three proposed decisions is finalized via three separate `/decision-finalize` invocations. Sibling decisions in the same file are never touched.

Once a decision is accepted, it becomes immutable — to change a past decision, write a new one (in any decision file) via `/decision-create` and finalize it via `/decision-finalize` to supersede the old one.

**Read `wiki/work/decisions/lifecycle.md` first.** It defines the Decision Group model, the per-decision supersession rule, the two-block cross-reference rule, and the relationship graph that finalization must keep in sync.

---

**Target**: $ARGUMENTS

---

## Instructions

### Step 1: Locate the file and the decision block

Parse `$ARGUMENTS` to identify the **(file, decision)** pair:

| Input form | Resolution |
|------------|------------|
| `<path>#DM` (e.g. `wiki/work/decisions/DEC-0007-session.md#D2`) | Use file as-is; decision = `D2` |
| `<NNNN-slug>#DM` (e.g. `0007-session#D2`) | Search `wiki/work/decisions/` for `NNNN-slug.md`; decision = `D2` |
| `<NNNN>#DM` (e.g. `7#D2` or `0007#D2`) | Pad number to 4 digits; `mcp__serena__find_file` with mask `NNNN-*.md`; decision = `D2` |
| `<path>` or `<NNNN-slug>` (no `#DM`) — file has **one** proposed decision | Auto-resolve to that decision's ID and continue |
| `<path>` or `<NNNN-slug>` (no `#DM`) — file has **multiple** proposed decisions | List all proposed decisions in the file and ask the user via `AskUserQuestion` to pick one |
| Empty / missing | List every `proposed` decision across all decision files (one row per `DEC-NNNN#DM`) and ask the user to pick |

If the file or decision cannot be located, **stop** and report — do not invent or create.

### Step 2: Read and audit the target decision

1. **Read** the decision file with `Read`.
2. **Locate the target decision block** — the `## DM. <title>` H2 and everything beneath it up to the next `## D*` H2 or end-of-file.
3. **Verify the decision's status is `proposed`**:

   | Current Status | Action |
   |----------------|--------|
   | `proposed` | Continue to Step 2.5 |
   | `accepted` | Stop. Tell the user this decision is already accepted and immutable; suggest `/decision-create` to write a successor that supersedes it |
   | `deprecated` or `superseded by ...` | Stop. The decision is no longer authoritative; finalizing makes no sense |

4. **Audit the target decision block for unresolved content** — look ONLY at the target block. Sibling decisions in the same file are **out of scope**:

   | Gap Type | Detection Pattern |
   |----------|-------------------|
   | Placeholder text | `<...>`, `TBD`, `TODO`, `???`, `FIXME`, `[fill in]`, `<!-- ... -->` HTML comments |
   | Empty table cells | Cells containing only `…`, `...`, dashes used as placeholders, or whitespace |
   | Empty driver/option/consequence rows | Rows where the substance column is blank or templated |
   | Missing recommended option | `### Decision Outcome` without a bolded chosen option |
   | Missing/blank `Date` | `Date:` line is blank, `YYYY-MM-DD`, or in the future |
   | Missing `Deciders` | Blank or `<names or roles>` |
   | Missing `Tags` | Empty (required for supersession detection) |
   | Missing validation signals | `### Validation` empty or all rows are placeholders |
   | Missing flow diagram | A decision involving a flow/sequence/before-after has no mermaid block (skip only if purely static) |
   | Asymmetric option analysis | Some options have full pro/con tables, others do not |
   | Bullet-list comparisons | `- Good, because ...` / `- Bad, because ...` style — convert to tables |
   | Stale "Considered Options" | Option discussed in trade-offs but missing from comparison matrix (or vice versa) |

5. **Build the Audit Report** in your working context:

   ```
   File: wiki/work/decisions/DEC-0007-session-management.md
   Decision: D2 — Session Lifetime
   Current status: proposed
   Sibling decisions in this file (out of scope): D1 (accepted), D3 (proposed)
   Gaps found: N
   ```

   Followed by a gaps table (priority, section, gap, resolution strategy).

### Step 2.5: Detect prior decision in the same area (mandatory supersession check)

The lifecycle doc's supersession rule operates **per decision**, not per file. The check searches across **every decision file** for accepted decision blocks sharing this decision's tags.

**Detection procedure:**

1. Use `mcp__serena__list_dir` to enumerate all files in `wiki/work/decisions/` (exclude `lifecycle.md`)
2. `Read` each file and walk every `## D*` block; collect blocks where `Status: accepted`
3. Score each candidate against the target:

| Tier | Signal | Detection |
|------|--------|-----------|
| 1 | Tag overlap on the decision blocks | ≥ 1 shared tag |
| 2 | Decision sub-title noun-phrase overlap | Substantial overlap |
| 3 | File-slug stem overlap | Only when both candidate and target are the sole `D1` of single-decision files |
| 4 | Explicit `Supersedes:` already set in the target block | Authoritative — verify named target exists and is `accepted` |

**Build the candidate report:**

| Candidate | Status | Tags overlap | Title overlap | Slug overlap | Verdict |
|-----------|--------|--------------|---------------|--------------|---------|
| DEC-0003#D2 | accepted | yes (`session-lifetime`) | yes | n/a | likely supersede |
| DEC-0005#D1 | accepted | no | no | no | unrelated |

**Resolution rules:**

| Situation | Required Action |
|-----------|-----------------|
| Zero candidates | Continue to Step 3 — fresh decision area |
| One candidate, all signals strong | Surface to user via `AskUserQuestion`, default to "supersede this candidate" |
| Multiple candidates | Surface ranked list; user picks at most one |
| Candidate with status `proposed` | Skip — only `accepted` decisions can be superseded; flag two-proposed-in-same-area to user as a consolidation hint |
| Candidate already `superseded by DEC-X#DY` | Walk the chain to DEC-X#DY; that's the area's current head — supersede it instead |
| User declares "different decision area" despite signals | Honor the declaration; recommend revising the target's tags to keep future detection clean |

**Persist the supersession target** (or explicit "none") for use in Step 4. Do NOT proceed to Step 3 without resolving this.

### Step 3: Present the audit and resolve open questions

1. **Present the audit report** as a single tabular summary — never bullets.

2. **Resolve gaps in priority order** using `AskUserQuestion`:

   | Priority | Gap Type | Why first |
   |----------|----------|-----------|
   | 1 | Chosen option not specified | Everything else flows from this |
   | 2 | Empty/placeholder decision drivers | Drivers determine which option is justified |
   | 3 | Empty/placeholder option trade-offs | Comparison is incomplete without these |
   | 4 | Empty `Tags` | Required for supersession detection |
   | 5 | Empty/placeholder consequences | Shape follow-up work |
   | 6 | Missing validation signals (E-C-A-D-R "R") | Required by Definition of Done |
   | 7 | Date, Deciders, Supersedes | Metadata; quickest to resolve |

3. **Question style:**
   - Frame each question with the relevant context from this decision block (not its siblings)
   - For the chosen option, present the comparison table inline
   - For trade-offs and consequences, ask focused questions ("What's the biggest operational risk of Option B for this decision?")
   - For validation, demand at least one **measurable** signal with threshold and timeframe

4. **Format-correction gaps** (bullet→table, asymmetric tables, missing mermaid) do **not** require user questions — fix them in place during Step 4.

### Step 4: Apply edits to the target decision block

Use **`Edit`** for every change — never `sed`/`awk`/`echo >>`. **Touch only the target decision block; sibling blocks are inviolate.**

Apply edits in this order:

1. **Fill resolved content** — every placeholder cell, empty row, TBD becomes the user's confirmed answer. One `Edit` call per distinct old_string. Constrain `old_string` matches to the target block by including unique surrounding text from that block.
2. **Bold the chosen option** in `### Decision Outcome`.
3. **Convert any bullet-list comparisons to tables** within this block.
4. **Add the mermaid diagram** if the audit flagged it as missing.
5. **Update the decision's metadata block:**

   | Field | New value |
   |-------|-----------|
   | `Status` | `accepted` |
   | `Date` | Today's date (YYYY-MM-DD) — overwrite if blank/wrong; preserve if user explicitly wants the original |
   | `Deciders` | Confirmed names/roles |
   | `Tags` | Confirmed non-empty tag list |
   | `Supersedes` | Confirmed `DEC-MMMM#DK` or `none` |

6. **If Step 2.5 identified a supersession target**, apply the lifecycle doc's two-block cross-reference rule **atomically**. Both blocks must change or neither does. The supersession target may be in the same file or a different file:

   | Site | Required Edit |
   |------|---------------|
   | This decision (the superseder) | `Supersedes: DEC-MMMM#DK` in metadata; `### Links` lists `Supersedes [[MMMM-slug\|DEC-MMMM#DK: title]]` |
   | Superseded decision block (in `wiki/work/decisions/DEC-MMMM-slug.md`, possibly the same file) | Flip `Status: accepted` → `Status: superseded by DEC-NNNN#DX`; insert callout `> **Superseded by [[NNNN-slug\|DEC-NNNN#DX: title]]** on YYYY-MM-DD` directly **under the superseded decision's H2** (NOT the file's H1) |
   | Superseded decision's siblings | **Untouched** — they retain their own status |

   The callout placement matters: it must sit between the H2 and the metadata bullets of the superseded block, so a reader scanning the block sees the supersession before any other content.

7. **Update `Last updated` in the file's front matter** to today's date — this is the only file-level edit.

### Step 5: Re-audit before finalizing

Re-read the target decision block. Finalization is allowed **only when**:

- [ ] No placeholder text in the target block
- [ ] Every option in `### Considered Options` has a complete trade-off table
- [ ] The criterion comparison matrix has no empty cells
- [ ] `### Decision Outcome` names a bolded chosen option with a one-sentence justification
- [ ] `### Consequences` table has at least one positive and one negative row, no placeholders
- [ ] `### Validation` has at least one row with a concrete signal, threshold, and timeframe (E-C-A-D-R "R")
- [ ] No bullet-list comparisons remain — every comparison is a table
- [ ] If the decision involves a flow/sequence/before-after, a mermaid block is present
- [ ] `Status: accepted`, `Date` is today (or user-confirmed), `Deciders` is filled, `Tags` is non-empty
- [ ] If Step 2.5 named a supersession target, **both** decision blocks are updated atomically (target's `Supersedes` + `Links`; superseded block's `Status` + callout)
- [ ] No other accepted decision in the same decision area exists across the log (i.e. no parallel `accepted` after this finalize)
- [ ] **Sibling decisions in this file are byte-for-byte unchanged** (compare against the pre-edit content of every other `D*` block in this file)

If any item fails, return to the relevant earlier step. **Do not flip status to `accepted` while gaps remain.**

### Step 6: Update the index and relationship graph

Edit `wiki/work/decisions/lifecycle.md`:

1. **Index — target row** (the decision being finalized):

   | Column | New Value |
   |--------|-----------|
   | `Status` | `accepted` |
   | `Date` | Today's date `YYYY-MM-DD` |
   | `Supersedes` | `[[MMMM-slug\|DEC-MMMM#DK: title]]` if Step 2.5 named one, else `—` |
   | `Superseded By` | `—` (unchanged) |

2. **Index — superseded row** (if applicable):

   | Column | New Value |
   |--------|-----------|
   | `Status` | `superseded by DEC-NNNN#DX` |
   | `Superseded By` | `[[NNNN-slug\|DEC-NNNN#DX: title]]` |

3. **Relationship Graph** (the mermaid `flowchart` block):
   - Add a node for the newly accepted decision (`DEC-NNNN#DM`) with its title and date
   - If a supersession occurred, add an edge from the superseded node to the new node, labelled `superseded by`, with the date
   - Update the `class` lines: new node → `accepted`; superseded node → `superseded`
   - If the graph is still placeholder content, replace it with a real graph for the current chain
   - Subgraphs may group nodes per decision file or per decision area — choose what reads best

If the lifecycle doc does not exist, create it from the template structure documented under `/decision-create` Step 6.

**Verify all three sections agree** before saving — index says `superseded by DEC-7#D1` while the graph still shows the old node as `accepted` is a broken commit.

### Step 6.5: Update the family index and archive if fully terminal

A Decision Group stays listed in `wiki/work/decisions/index.md` only while **at least one of its blocks is `proposed`**. After this finalization:

- If proposed blocks remain in the group: update the row's per-decision status note (e.g. `D1 accepted, D2 proposed`). Do NOT move the file.
- If **no** proposed blocks remain (all are `accepted` or `superseded`):
  1. **Delete the group's row** from `wiki/work/decisions/index.md`.
  2. **Archive the file** (Bash — `git mv` only):
     ```
     git mv wiki/work/decisions/<file>.md wiki/work/decisions/archive/<file>.md
     ```
  3. **Append to `wiki/work/decisions/archive/index.md`** (use the dominant final status — `accepted` unless all are `superseded`):
     ```
     | [[DEC-NNNN]] | <Title> | accepted | YYYY-MM-DD |
     ```

Use `Read` then `Edit` for all index edits — never `sed`.

### Step 7: Append accepted/superseded log entry

Append to `wiki/log.md`:

- If no supersession: `## [YYYY-MM-DD] decision-accepted | DEC-NNNN#DM <Decision Title>`
- If supersession: `## [YYYY-MM-DD] decision-superseded | DEC-MMMM#DK superseded by DEC-NNNN#DM`

Use `Edit` to append — never `echo >>`.

### Step 8: Cross-link follow-up work

Scan the finalized decision's `### Consequences` for `🔁 Follow-up` rows. For each:

| Follow-up Type | Action |
|----------------|--------|
| Implementation work ("write task: ...") | Suggest `/task-add <description referencing DEC-NNNN#DM>` |
| Time-based revisit ("revisit in 6 months") | Offer to `/schedule` a background agent for the revisit date |
| Metric to instrument | Suggest `/task-add` or fold into existing task — ask the user |

Do **not** auto-create tasks or schedules — present them as suggestions.

### Step 9: Update memory if the ratified decision establishes a new pattern

If the accepted decision creates a non-obvious pattern, integration constraint, or operational gotcha:

- `mcp__serena__write_memory` with a topic-hierarchical name (e.g. `architecture/data-layer/cache-strategy`)
- Reference the decision (`DEC-NNNN#DM`), not just the file
- Prefer `mcp__serena__edit_memory` if a memory already covers this area

### Step 10: Report completion

Print:

| Field | Value |
|-------|-------|
| Decision | `DEC-NNNN#DM` |
| File | `wiki/work/decisions/DEC-NNNN-slug.md` |
| Old → New status | `proposed → accepted` |
| Gaps resolved | count |
| Format fixes applied | count (bullet→table conversions, mermaid added, etc.) |
| Supersession | `DEC-MMMM#DK` (also updated) or `none` |
| Sibling decisions in this file | `D1: <status>`, `D3: <status>` (unchanged by this run) |
| Index updated | yes |
| Graph updated | yes |
| Log entry appended | yes |
| Suggested next steps | `/task-add ...`, `/schedule ...`, `/decision-finalize <file>#Dother`, `/decision-next` once all decisions have tasks |

If other proposed siblings remain in the same file, mention them so the user can finalize them next when ready.

If all decisions in the group are now terminal, the file is moved to `wiki/work/decisions/archive/` as part of Step 6.5 — mention this in the report. Cross-references using `[[DEC-NNNN]]` remain valid regardless of file location.

---

## Output Formatting Rules (mandatory)

1. **Tables not bullets** — every comparison and audit summary uses tables, in your output and in edits applied to the decision
2. **One Edit per gap** — keep edits surgical; do not rewrite whole blocks to fix a single placeholder
3. **Never alter accepted decisions** — refuse to run on an already-accepted target; suggest `/decision-create` to write a successor
4. **Never touch sibling decisions** — only the target block changes (plus the superseded block if applicable, possibly in another file)
5. **Present tense, full sentences** when filling content
6. **No fabrication** — if the user lacks an answer for a gap (e.g. concrete validation thresholds), keep status as `proposed`, leave the section honestly marked, and report which gaps remain

---

## CRITICAL Rules

1. **Status flip is one-way and final** — only flip the target decision to `accepted` after every Step 5 checklist item passes
2. **Supersession is atomic and bidirectional** — if Step 2.5 identifies a target, the new decision block, the superseded decision block, the index, and the relationship graph all change together or none of them change
3. **Per-decision scope** — operate only on the target block; sibling blocks are out of scope and must be byte-for-byte unchanged at the end
4. **No parallel `accepted` decisions in the same area** — the chain invariant; if you cannot resolve which decision supersedes which, leave status as `proposed` and report
5. **Never use `sed`/`echo >>`/`cat <<EOF`** — always `Edit`
6. **Never auto-create tasks or schedules** — suggest them
7. **Maximum 3 sub-processes at a time** if delegating
8. **Always terminate processes when done**
