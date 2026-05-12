# Bug Lifecycle

How bug files move through `.docs/bugs/`, what each state means, and what must be true before a move is permitted.

This is the operational companion to [`.docs/bugs/README.md`](../bugs/README.md) (glossary, severity/priority rubric, file template) and the parallel of [`task-lifecycle.md`](./task-lifecycle.md).

---

## Directory Layout

```
.docs/bugs/
├── open/           # Reported; not yet being actively worked on
├── in-progress/    # Fix in flight
├── closed/         # Fix verified; terminal
└── trashed/        # wontfix / duplicate / cannot-reproduce; terminal
```

Folder location is the **coarse** status. The `Status:` field inside each file carries the **fine** status (e.g. `new` vs `triaged` while still in `open/`; `in-progress` vs `fixed` while still in `in-progress/`).

---

## Happy Path

```
   file bug          triage              start work              fix merged             verified
       │                │                    │                       │                     │
       ▼                ▼                    ▼                       ▼                     ▼
   open/             open/             in-progress/             in-progress/            closed/
   (new)             (triaged)         (in-progress)            (fixed)                 (verified)
```

Each arrow is a deliberate action with required preconditions (below). The file's `Status:` field changes on every arrow; the folder changes only on the bold arrows.

---

## State Transitions

| From | To | Fine-status change | Folder move | Required before transition |
|------|----|--------------------|-------------|----------------------------|
| — | `open/` (`new`) | — | **create** | `Steps to Reproduce`, `Expected`, `Actual`, `Environment`, `Severity`, `Reporter`, `Reported` date all filled |
| `open/` (`new`) | `open/` (`triaged`) | `new` → `triaged` | — | `Priority`, `Assignee`, `Tags` set; `Impact` summarized |
| `open/` (`triaged`) | `in-progress/` (`in-progress`) | `triaged` → `in-progress` | **`open/` → `in-progress/`** | Assignee has actually started work; bug is reproducible (or a repro plan is documented) |
| `in-progress/` (`in-progress`) | `in-progress/` (`fixed`) | `in-progress` → `fixed` | — | Patch merged to main; `Root Cause Analysis` filled in; fix commit recorded under `Resolution` |
| `in-progress/` (`fixed`) | `closed/` (`verified`) | `fixed` → `verified` | **`in-progress/` → `closed/`** | Regression test exists and passes; fix confirmed in the relevant environment (test/UAT/staging/prod as appropriate); `Resolution` block complete |
| any | `trashed/` (`wontfix`) | → `wontfix` | **→ `trashed/`** | A note added to `## Resolution` explaining the decision and who made it |
| any | `trashed/` (`duplicate`) | → `duplicate` | **→ `trashed/`** | `Duplicate of: BUG-NNNN` set in `## Related`; canonical bug exists |
| `open/` or `in-progress/` | `trashed/` (`cannot-reproduce`) | → `cannot-reproduce` | **→ `trashed/`** | A note in `## Resolution` listing what was attempted; cooldown period (suggested ≥ 14 days in `open/` with no new sighting) |

**On every transition**, update `Last updated: YYYY-MM-DD` and refresh the row in `.docs/bugs/README.md`'s Index (status, closed-date, assignee).

---

## Required Fields by State

| State | Newly required fields (beyond prior state) |
|-------|--------------------------------------------|
| `new` | Title, Severity, Reported, Reporter, Summary, Environment, Steps to Reproduce, Expected, Actual, Reproducibility |
| `triaged` | Priority, Assignee, Tags, Impact |
| `in-progress` | (no new required fields — work is underway) |
| `fixed` | Root Cause Analysis; Resolution: fix commit, linked PR |
| `verified` | Resolution: regression test path, fix version (if applicable) |
| `wontfix` | Resolution: decision rationale + decider |
| `duplicate` | Related: `Duplicate of: BUG-NNNN` (canonical must exist) |
| `cannot-reproduce` | Resolution: log of reproduction attempts |

A bug cannot advance to a later state with earlier-state fields blank. Audit on every move.

---

## Naming and IDs

```
NNNN-<short-slug>.md          # the bug file
BUG-NNNN                      # the stable handle used in commits, PRs, related-bug links
```

- `NNNN`: 4-digit zero-padded, unique **across all four folders**. Scan everywhere before assigning. Never re-number.
- `<short-slug>`: lowercase, hyphen-separated, 2–5 words, ≤ 60 chars. Describe the symptom.

When a bug moves folders, the **filename does not change** — only the directory does. The bug ID (`BUG-NNNN`) and slug are permanent.

---

## Cross-Linking to Other Artifacts

| Artifact | When to link | How |
|----------|--------------|-----|
| Task (`.docs/tasks/...`) | When the fix is large enough to warrant a structured task (multiple steps, schema/API changes) | `## Resolution → Linked task` in the bug; bug ID referenced in the task's footer |
| ADR (`.docs/adr/...`) | When the fix changes an architectural decision (e.g. swapping a library, changing an API contract) | Decision's `### Links` references `BUG-NNNN`; bug's `## Related` cites the ADR decision |
| PRD (`.docs/prd/...`) | Rare — only when a class of bugs reframes product requirements | PRD `Amendment` references the bug(s); bug `## Related` cites the PRD |
| UAT (`.docs/uat/...`) | When verification of the fix is part of a UAT walkthrough rather than an automated test | Bug's `Resolution → Regression test` points to the UAT file or test entry |
| Commit / PR | Always, on the fix | Commit message includes `BUG-NNNN`; PR description links to the bug file path |

---

## Triage Cadence

| Cadence | Action |
|---------|--------|
| Per new report | Within 1 business day: confirm reproducibility, set severity/priority/assignee, flip `new` → `triaged` |
| Weekly | Walk `open/` — re-prioritize, age stale items, escalate criticals that have not started |
| Monthly | Walk `in-progress/` — flag bugs stuck > 30 days; either resource them, downgrade priority, or move to `trashed/` with rationale |
| Quarterly | Walk `closed/` for the period — surface clusters that indicate a systemic issue (informs ADR or refactor tasks) |

Triage never edits a closed bug's substance — if new information emerges that invalidates a `verified` or `wontfix` decision, file a new bug and cross-link.

---

## See Also

- [`.docs/bugs/README.md`](../bugs/README.md) — index, glossary, severity/priority rubric, file template
- [`.docs/bugs/open/README.md`](../bugs/open/README.md) — bug file structure spec
- [`task-lifecycle.md`](./task-lifecycle.md) — parallel model for tasks and UAT
- [`command-anti-patterns.md`](./command-anti-patterns.md) — verification split (static gates vs runtime/UAT) — informs where regression tests live
