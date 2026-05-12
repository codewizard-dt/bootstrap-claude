# Bug File Specification

Bug files in `open/` (and the rest of `.docs/bugs/`) follow a fixed shape so that every report can be triaged, fixed, and verified without back-and-forth.

## Naming Convention

```
NNNN-<short-slug>.md
```

- **NNNN**: 4-digit zero-padded sequential integer. To find the next number, scan **all four** folders (`open/`, `in-progress/`, `closed/`, `trashed/`) and take `max + 1`.
- **short-slug**: lowercase, hyphen-separated, 2–5 words, ≤ 60 chars. Describe the symptom, not the suspected cause.

Examples: `0001-login-fails-on-safari.md`, `0042-csv-export-drops-utf8.md`.

The bug ID `BUG-NNNN` is the stable cross-reference handle. Never re-number.

## Required Structure

See the **File Template** section in [`.docs/bugs/README.md`](../README.md) for the full shape. The required-on-report fields are:

| Field | Why |
|-------|-----|
| `Status` | Drives folder location and triage |
| `Severity` | Impact — set by reporter, refined in triage |
| `Priority` | Urgency — set during triage |
| `Reported` (date) + `Reporter` | Audit trail |
| `Summary` | One-paragraph orientation |
| `Environment` | OS / runtime / version / config |
| `Steps to Reproduce` | The contract that defines "fixed" |
| `Expected Behavior` / `Actual Behavior` | The gap |
| `Reproducibility` | Frequency, first/last seen |

Fields filled in **later**:

| Field | When filled |
|-------|-------------|
| `Assignee` | Triage |
| `Impact` | Triage or as data arrives |
| `Workaround` | Triage or anytime a workaround is discovered |
| `Root Cause Analysis` | During or after fix |
| `Resolution` | On close |
| `Related` | Anytime cross-references surface |

## Rules

- One bug per file. If a report covers multiple symptoms, split it and cross-link via `## Related`.
- Severity describes user impact, priority describes scheduling urgency. They are independent — assign both.
- "Steps to Reproduce" must be deterministic enough that another engineer can hit the bug. If reproduction is flaky, say so in `Reproducibility` and record what conditions trigger it.
- Do not write speculation in `Actual Behavior` — only observed output (errors, stack traces, screenshots).
- `Root Cause Analysis` is written *after* investigation. Leave it blank on initial report.
- A bug cannot move to `closed/` without a `Resolution` block citing the fix commit and a regression test (automated test path or a manual UAT checklist).

## Lifecycle

```
open/  →  in-progress/  →  closed/
                  ↘
                   trashed/   (wontfix / duplicate / cannot-reproduce)
```

See [`.docs/guides/bug-lifecycle.md`](../../guides/bug-lifecycle.md) for the full state machine and the rules for each folder move.
