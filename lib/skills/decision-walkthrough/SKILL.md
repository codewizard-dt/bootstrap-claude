---
name: decision-walkthrough
description: Walk through a decision file decision-by-decision, presenting each architecture choice and confirming it with the user via Q&A
category: planning
model: claude-sonnet-4-6
argument-hint: <path/to/decision.md, NNNN-slug, or NNNN>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**


# Walkthrough Decision

Systematically walk through every decision block in a decision file. For each decision, present a compact summary of drivers, options, the recommended choice, and trade-offs, then ask the user via `AskUserQuestion` to **confirm**, **change**, **defer**, or **skip**. Sibling decisions are treated independently; the file's other blocks are never touched while one block is being discussed.

This skill is a **review pass**, not a finalizer. It does **not** flip status to `accepted` — that responsibility belongs to `/decision-finalize <file>#<DM>`, which runs the full E-C-A-D-R audit and supersession check. Use this command when you want a low-friction walkthrough to ratify (or revise) the architecture choices in a draft decision file before sending each decision through `/decision-finalize`.

**Read `wiki/work/decisions/lifecycle.md` first.** It defines the Decision Group model and the per-decision rules this command must respect (especially: siblings are inviolate; per-decision metadata is mandatory; tables not bullets; mermaid for flows).

---

**Target Decision**: $ARGUMENTS

---

## Pipeline Context

`/decision-create` → **`/decision-walkthrough`** → `/decision-finalize <file>#<DM>` (per decision) → `/task-add` → `/tackle`

The walkthrough is optional — `/decision-finalize` alone is sufficient when only one decision needs ratifying. Use `/decision-walkthrough` when a decision file has 2+ proposed decisions and you want a single guided pass to align on every choice before finalizing each.

---

## Instructions

### Step 1: Locate the decision file

Parse `$ARGUMENTS` to identify the file:

| Input form | Resolution |
|------------|------------|
| `<path>` (e.g. `wiki/work/decisions/DEC-0007-session.md`) | Use as-is |
| `<NNNN-slug>` (e.g. `0007-session`) | Search `wiki/work/decisions/` for `NNNN-slug.md` |
| `<NNNN>` (e.g. `7` or `0007`) | Pad to 4 digits; `mcp__serena__find_file` with mask `NNNN-*.md` |
| Empty / missing | List every decision file in `wiki/work/decisions/` with at least one `proposed` decision; ask the user via `AskUserQuestion` to pick |

If the file cannot be located, **stop** and report — do not invent or create.

### Step 2: Read and enumerate decisions

1. **Read** the decision file with `Read`.
2. **Enumerate every `## D*` H2 block** in file order. For each, capture:
   - Decision ID (`D1`, `D2`, …)
   - Sub-title
   - `Status` (from the metadata bullets)
   - `Tags`
   - Whether `### Decision Outcome` already names a bolded chosen option
3. **Build the walkthrough roster** as a single table presented to the user:

   | # | Decision | Title | Status | Chosen Option | Tags |
   |---|----------|-------|--------|---------------|------|
   | 1 | D1 | Storage backend | accepted | **Redis** | session, cache |
   | 2 | D2 | Session lifetime | proposed | (none yet) | session, lifetime |
   | 3 | D3 | Invalidation trigger | proposed | **Webhook** | session, invalidation |

4. **Classify per status:**

   | Status | Walkthrough behavior |
   |--------|---------------------|
   | `proposed` | **In scope** — runs the full Q&A confirm/change loop in Step 3 |
   | `accepted` | **Informational only** — print a one-line summary; skip Q&A (decision is immutable) |
   | `deprecated` | **Informational only** — print summary; skip Q&A |
   | `superseded by DEC-X#DY` | **Informational only** — print summary with the supersession target; skip Q&A |

   If **no** decisions are `proposed`, print the roster, note that nothing requires confirmation, and stop.

### Step 3: Walk each proposed decision (one at a time)

For each `proposed` decision in roster order:

1. **Present the decision summary** as tables (never bullets):

   ```
   ─── DEC-NNNN#DM — <title> ───────────────────────────────────────
   Status: proposed   Tags: <list>   Date: <YYYY-MM-DD or blank>
   ```

   Followed by these tables, copied verbatim from the decision block (no rewriting):

   - **Decision Drivers** (full table from `### Decision Drivers`)
   - **Considered Options** (one-line summaries from `### Considered Options`)
   - **Option Comparison** matrix from `### Option Comparison`
   - **Currently chosen option** (the bolded option in `### Decision Outcome`, or `(none yet)` if absent)
   - **Top 2 trade-off rows** for the chosen option from `### Trade-off Detail per Option` (Pros + Cons)

   Cap the summary at ~25 lines. If a section is missing or all-placeholder, mark it `⚠️ gap — surface at finalize time`. **Do not edit gaps here** — that is `/decision-finalize`'s job.

2. **Ask the user via `AskUserQuestion`** with these four options:

   | Verdict | Meaning | Effect |
   |---------|---------|--------|
   | **Confirm** | The currently chosen option is correct; proceed | Record confirmation; no edit unless the chosen option is unbolded (then bold it) |
   | **Change** | A different option is the right choice | Ask follow-up to pick the new option, then update `### Decision Outcome` to bold the new option and rewrite the one-sentence justification |
   | **Defer** | Not ready to confirm; keep `proposed`, revisit later | No edit; skip to next decision |
   | **Skip** | Walk past without recording (e.g., the wrong reviewer) | No edit; no record |

   If the decision has **no** chosen option yet, replace `Confirm` with `Choose` (same Change-flow follow-up).

3. **Apply edits only when the verdict is Confirm-without-bold or Change.** Use `Edit` (never `sed`/`echo`). Constrain `old_string` to text unique within the target block to avoid touching siblings.

   | Trigger | Edit |
   |---------|------|
   | Confirm, but `### Decision Outcome` lacks a bolded option | Bold the chosen option; add a one-sentence justification anchored to the highest-priority driver |
   | Change | Unbold the previous option; bold the new one; rewrite the justification; if user volunteers replacement context for `### Consequences` or `### Validation`, capture only what they explicitly state — never fabricate |
   | Any verdict | **Never** flip `Status` to `accepted` (that is `/decision-finalize`'s gate); **never** edit sibling decision blocks; **never** edit the index or relationship graph |

4. **Record the per-decision verdict** in working memory for the Step 5 report.

### Step 4: Optional — light metadata fixes (only on explicit user request)

After Step 3 completes for every proposed decision, ask once via `AskUserQuestion` whether the user wants to fix any obviously-empty per-decision metadata (`Date`, `Deciders`, `Tags`) on decisions that were confirmed or changed.

| Field | Allowed fix |
|-------|-------------|
| `Date` | Today's date (`YYYY-MM-DD`) — only if the existing value is blank or the literal placeholder |
| `Deciders` | Names/roles supplied by the user — only if blank |
| `Tags` | 1–3 short tags supplied by the user — only if blank |

Anything beyond these three fields, or any change requiring research (drivers, consequences, validation thresholds), is **out of scope** — defer to `/decision-finalize` and report it in Step 5.

### Step 5: Report and recommend next steps

Print a single tabular completion report:

| Decision | Title | Pre-walkthrough status | Verdict | Edits applied | Next step |
|----------|-------|------------------------|---------|---------------|-----------|
| D1 | Storage backend | accepted | (informational) | none | n/a — already accepted |
| D2 | Session lifetime | proposed | Confirmed | bolded chosen option | `/decision-finalize 0007-session#D2` |
| D3 | Invalidation trigger | proposed | Changed (Webhook → Polling) | rewrote outcome | `/decision-finalize 0007-session#D3` |

Append:

- **Confirmed proposed decisions** — list `/decision-finalize <file>#<DM>` commands the user can run next (one per confirmed decision).
- **Deferred decisions** — list IDs the user chose to revisit; suggest re-running `/decision-walkthrough` later.
- **Gaps surfaced but not fixed** (placeholders, missing mermaid, asymmetric tables, etc.) — flag explicitly so the user knows `/decision-finalize` will pick them up.
- **Sibling status confirmation** — restate which decisions in the file were left byte-for-byte unchanged.

---

## Output Formatting Rules (mandatory)

1. **Tables not bullets** for the roster, the per-decision summary, and the completion report.
2. **One decision at a time** — present, ask, edit, then move on. Never bundle Q&A across multiple decisions in one `AskUserQuestion`.
3. **Surgical edits only** — `Edit` calls are scoped to the target decision block. Anchor `old_string` with text from that block (e.g., the `## DM. <title>` line plus a few characters) to guarantee no sibling drift.
4. **Present tense, full sentences** when rewriting a Decision Outcome justification.
5. **Never invent content** — if the user picks a new option that lacks a comparison row, do **not** synthesize one; flag it and recommend `/decision-finalize` (which will demand the research).

---

## CRITICAL Rules

1. **No status flips** — this command never writes `Status: accepted`, `Status: deprecated`, or `Status: superseded by …`. Those transitions belong to `/decision-finalize` (and to the supersession path `/decision-finalize` enforces).
2. **Per-decision scope** — only the currently-discussed block changes. All other `D*` blocks must be byte-for-byte unchanged at end-of-run; verify before reporting.
3. **No supersession work** — supersession detection and the two-block cross-reference rule are `/decision-finalize`'s job. Do not search other decision files; do not edit the index or relationship graph.
4. **Refuse on missing-`Tags` write requests** — if the user asks to confirm a decision whose `Tags` line is empty and they decline to fill it in Step 4, leave the block as-is and tell them `/decision-finalize` will block on it.
5. **Never use `sed`/`awk`/`echo >>`/`cat <<EOF`** — always `Edit`.
6. **Maximum 3 sub-processes at a time** if delegating reads.
7. **Always terminate processes when done.**
