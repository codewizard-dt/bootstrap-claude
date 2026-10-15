# ID-RESOLUTION — shared procedure for resolving a work-item reference to a file

How a skill turns a user-supplied reference (`<path>`, `TASK-0086`, `0086-some-slug`, bare `86`) into exactly one file under `wiki/work/<family>/` lives here once. **Each consuming skill states only: family, search scope, ambiguity mode (interactive|headless), empty-input behavior, and any post-resolution gate. Everything else is defined here.** Run the Procedure once per reference.

Use Serena `find_file` / `list_dir` for every lookup — never `ls`, `find`, or `grep` (see `wiki/guides/mcp-tools.md`).

## Wiring block

Consumers replace their inline resolution table with one line in this form:

`Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: tasks · scope: active · ambiguous: interactive · empty: <behavior>`

Any post-resolution gate (a status check, a "found in `archive/`" message) follows the line in the consumer's own prose. Behavior for empty input and for the gate is the caller's; the resolution mechanics are not.

## Inputs

| Input | Meaning |
|-------|---------|
| `family` | One of the rows in **Family table** — selects the directory and ID prefix. |
| `scope` | `active`, `active+archive`, or `active-then-archive-gate` — see **Search scope**. Default `active`. |
| `ambiguous` | `interactive` or `headless` — see **Match outcomes**. |
| `empty` | What the caller does when the input is empty or free text. Not resolved here. |

## Family table

The only place a family's facts live. Renaming a family or its prefix is a one-table edit here.

| Family | Directory | ID prefix | Notes |
|--------|-----------|-----------|-------|
| requirements | `wiki/work/requirements/` | `PRD` | new items; legacy prefix `REQ` (files not yet migrated) is also tried, after `PRD` — see Procedure step 4 |
| decisions | `wiki/work/decisions/` | `ADR` | new items; legacy prefix `DEC` (files not yet migrated) is also tried, after `ADR` — see Procedure step 4; reference may carry a `#DM` suffix (see **`#DM` suffix**) |
| roadmaps | `wiki/work/roadmaps/` | `ROADMAP` | |
| tasks | `wiki/work/tasks/` | `TASK` | |
| uat | `wiki/work/uat/` | `UAT` | one per task; the number mirrors the task's number |
| bugs | `wiki/work/bugs/` | `BUG` | |

Terminal items live in the `archive/` subdirectory for `tasks`, `uat`, and `bugs` only; `requirements`, `decisions`, and `roadmaps` keep finished items in place (closed in the family `index.md`). `index.md` and `lifecycle.md` in the family directory are never resolution targets.

## Accepted forms

The input is one token; any trailing free text is the caller's concern.

| # | Form | Recognized by | Examples |
|---|------|---------------|----------|
| 1 | **Path** | contains `/` or ends in `.md` | `wiki/work/tasks/TASK-0086-uat-fail-offers-bug-file.md` |
| 2 | **Full ID or ID-slug** | `PREFIX-` then digits, optionally `-slug`; a family's declared legacy prefix (Family table Notes) is accepted as input too | `TASK-0086`, `TASK-0086-uat-fail-offers-bug-file`, legacy `TASK-074`, legacy-prefix `REQ-0003`, legacy-prefix `DEC-0001` |
| 3 | **`NNN-slug` / `NNNN-slug`** | digits, then `-slug` | `0086-uat-fail-offers-bug-file`, `074-serena-project-from-cwd` |
| 4 | **Bare number** | digits only | `86`, `086`, `0086` |
| 5 | **Empty / free-text description** | nothing, or words that are not forms 1-4 | not resolved here — the caller states its own behavior (pick-list, auto-pick, survey, or STOP) |

## Procedure

1. **Split off a `#DM` suffix** if the family is `decisions` and the input contains `#D<n>` (see **`#DM` suffix**). Resolve the rest.
2. **Path (form 1).** Confirm the file exists with `find_file`. Missing: STOP `File not found: <path>`. Never create the file. A path outside the family's directory (or its `archive/`, when scope allows) is a resolution error: STOP and report.
3. **Otherwise extract the number.** Parse the digits of the input to an **integer**, so `3`, `003`, and `0003` are equal. Never derive a mask by string-concatenating the raw input.
4. **Build the masks** from the family's `PREFIX` and the integer, zero-padded:
   1. `PREFIX-<pad4>-*.md` (current 4-digit IDs), then
   2. `PREFIX-<pad3>-*.md` (legacy 3-digit IDs), then
   3. for a family whose Notes declare a **legacy prefix** (`requirements`: `REQ`; `decisions`: `DEC`), the same two masks with `LEGACY-` in place of `PREFIX-` (`REQ-<pad4>-*.md`, `REQ-<pad3>-*.md`; `DEC-<pad4>-*.md`, `DEC-<pad3>-*.md`) — same integer, both widths, always after every `PREFIX` mask.

   Try them in that order with `find_file` over the search scope; stop at the first mask that matches. When the input carried a slug (forms 2-3 with `-slug`), try `PREFIX-<padN>-<slug>.md` first for each width (then the legacy-prefix equivalents), then fall back to the prefix-only masks above. A legacy-prefix input (for example `REQ-0003`, `DEC-0001`) is reduced to its integer like any other, so it resolves to a migrated `PRD-0003-*.md` / `ADR-0001-*.md` file as well as to an unmigrated `REQ-0003-*.md` / `DEC-0001-*.md`; the number, not the input's prefix, selects the file.
5. **Apply the match outcome** (below).

## Match outcomes

| Matches | Result |
|---------|--------|
| 0 | STOP `No <family> matching '<input>' found.` Never invent a file or guess a nearby number. |
| 1 | Resolved. Hand the path back to the caller, plus which directory matched when scope is not `active`. |
| more than 1 | **Ambiguous** — handled per the caller's declared mode (below). |

- **interactive** — list the matches and ask which one via `AskUserQuestion`. Never pick silently.
- **headless** (`uat-auto`, `uat-auto-plus`) — never prompt. STOP and report the ambiguity in the completion summary.

## Search scope

The caller declares exactly one:

| Scope | Behavior |
|-------|----------|
| `active` | Search the family directory only. The default. |
| `active+archive` | Search the family directory, then its `archive/`. Report which one matched. |
| `active-then-archive-gate` | Search the family directory first. A hit only in `archive/` means the item is **already terminal** — hand that back to the caller as a gate result rather than as a normal resolution (used by `bug-close`). |

`active+archive` and `active-then-archive-gate` are valid only for `tasks`, `uat`, and `bugs` — the families that still archive.

**Legacy fallback (permanent) for `requirements`, `decisions`, `roadmaps`.** These families no longer archive, so `scope: active` searches the family directory and, on zero matches, falls back to `<family>/archive/` if that directory exists, reporting the hit as a legacy location. Projects that archived items under the older layout keep resolving. New code never writes to that `archive/`.

## `#DM` suffix (decisions)

A decisions reference may end in `#D<n>` (for example `ADR-0001#D2`, legacy `DEC-0001#D2`, or `0001-wiki-cross-family-linking-schema#D2`). Strip the suffix **before** resolving the file, resolve the file by the usual masks, and hand the suffix back separately so the caller can select the decision block. Choosing among several decision blocks (one proposed vs. many) is the caller's logic, not resolution.

## Worked examples

Every filename below was verified to exist in this repo.

| Form | Family | Input | Resolves to |
|------|--------|-------|-------------|
| 1 Path | tasks | `wiki/work/tasks/TASK-0086-uat-fail-offers-bug-file.md` | that file, after `find_file` confirms it |
| 2 Full ID | tasks | `TASK-0086` | `wiki/work/tasks/TASK-0086-uat-fail-offers-bug-file.md` via mask `TASK-0086-*.md` |
| 2 ID-slug | tasks | `TASK-0086-uat-fail-offers-bug-file` | same file via `TASK-0086-uat-fail-offers-bug-file.md` |
| 2 Legacy ID | tasks | `TASK-074` | `wiki/work/tasks/TASK-074-serena-project-from-cwd.md` — `TASK-0074-*.md` matches nothing, so the legacy mask `TASK-074-*.md` matches |
| 3 NNNN-slug | tasks | `0086-uat-fail-offers-bug-file` | `wiki/work/tasks/TASK-0086-uat-fail-offers-bug-file.md` |
| 3 NNN-slug | tasks | `074-serena-project-from-cwd` | `wiki/work/tasks/TASK-074-serena-project-from-cwd.md` |
| 4 Bare number | roadmaps | `11` | `wiki/work/roadmaps/ROADMAP-011-build-bootstrap-prefs-tui.md` — legacy 3-digit fallback after `ROADMAP-0011-*.md` misses |
| 4 Bare number | bugs | `6` | `wiki/work/bugs/BUG-0006-mv-guard-segment-split-omits-pipe.md` |
| 4 Bare number | uat | `87` | `wiki/work/uat/UAT-0087-bug-close-clustering-offers-regression-task.md` |
| 2 Full ID + `#DM` | decisions | `DEC-0001#D2` | legacy-prefix input; suffix `#D2` split off; the `ADR` masks (`ADR-0001-*.md`, `ADR-001-*.md`) match nothing, then the legacy mask `DEC-0001-*.md` matches `wiki/work/decisions/archive/DEC-0001-wiki-cross-family-linking-schema.md` (scope `active+archive` — this decision is archived); caller gets `D2` back separately |
| 2 Full ID + `#DM` | decisions | `ADR-0001#D2` | same integer, so it resolves to that same `DEC-0001-wiki-cross-family-linking-schema.md` file before migration, and to `ADR-0001-*.md` after it (the migration keeps the number); caller gets `D2` back separately |
| 2 Full ID + `#DM` | decisions | `ADR-0002#D1` | a new-item input: mask `ADR-0002-*.md` matches the file `adr-create` writes as `ADR-0002-<group-slug>.md` (no such file exists in this repo yet); caller gets `D1` back separately |
| 4 Bare number | requirements | `3` | no requirement files exist in this repo yet; would try `PRD-0003-*.md`, `PRD-003-*.md`, `REQ-0003-*.md`, then `REQ-003-*.md` |
| 2 Legacy prefix | requirements | `REQ-0003` | legacy input; same integer, so it resolves to `PRD-0003-*` after migration, or to `REQ-0003-*` before it (no such files exist in this repo yet) |
| 5 Empty | any | *(nothing)* | not resolved here — the caller's `empty:` behavior applies |
| any | tasks | `9999` | 0 matches — STOP `No tasks matching '9999' found.` |

## CRITICAL rules

- **Integer, not string.** Compare and pad numbers as integers; never build a mask from raw input.
- **Both widths.** Always try the 4-digit mask, then the 3-digit legacy mask. Files with either width coexist. A declared legacy prefix (Family table Notes) is accepted as input and is tried after the current prefix, at both widths.
- **Never create or guess.** A missing path or zero matches is a STOP, never a fabricated file.
- **Headless never prompts.** Ambiguity in `headless` mode STOPs and is reported, never asked.
- **Tools.** `find_file` / `list_dir` only for lookups — no `ls`, `find`, or `grep`.
- **Number allocation is elsewhere.** Picking the next free number (`max+1`) is a different algorithm and is not defined here.

## Caller deltas

What each consumer supplies. Anything not listed is the caller's own logic and stays in its `SKILL.md`.

| Consumer | `family` | `scope` | `ambiguous` | Empty input / gate |
|----------|----------|---------|-------------|--------------------|
| `prd-deprecate`, `prd-finalize` | requirements | `active` | interactive | per skill; legacy `archive/` fallback applies (see Search scope) |
| `adr-extract` | requirements | `active` | interactive | PRD mode only: empty → pick-list of `approved` PRDs; gate `status: approved`. A path outside `wiki/work/requirements/` is document mode and skips resolution entirely. Legacy `archive/` fallback applies |
| `prd-compile` | requirements | `active` | interactive | empty: auto-look for `status: approved`; gate: `status: approved`. Legacy `archive/` fallback applies |
| `adr-finalize`, `adr-deprecate`, `adr-walkthrough`, `adr-next` | decisions | `active` | interactive | per skill; `#DM` handled per this doc; legacy `archive/` fallback applies |
| `roadmap-next` | roadmaps | `active` | interactive | empty: STOP; legacy `archive/` fallback applies |
| `bug-triage` | bugs | `active` | interactive | not found: STOP |
| `bug-close` | bugs | `active-then-archive-gate` | interactive | gates: found in root, "must be triaged and worked first"; found in `archive/`, "already terminal" |
| `tackle`, `uat-skip`, `uat-create` | tasks | `active` | interactive | per skill |
| `task-close` | tasks | `active+archive` | interactive | per skill |
| `uat-walk` (via `UAT-CORE.md`) | uat | `active` | interactive | empty: STOP and report |
| `uat-auto`, `uat-auto-plus` (via `UAT-CORE.md`) | uat | `active` | headless | empty: auto-pick lowest pending `<NNN>` |
| `uat-assess` | tasks | `active+archive` | headless | n/a — follows a UAT's `task:` back-link; not found: report as an orphan, never STOP |
