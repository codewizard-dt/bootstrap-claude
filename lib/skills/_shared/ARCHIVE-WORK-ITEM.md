# ARCHIVE-WORK-ITEM — shared procedure for archiving a work item

The mechanic for archiving one terminal work item in the `tasks`, `uat`, or `bugs` families — set the terminal status, `git mv` the file into `<family>/archive/`, drop its active-index row, append its `archive/index.md` row, append a `wiki/log.md` entry — lives here once. Each `SKILL.md` that archives an item supplies only its parameters (see **Inputs**) and any deltas (see **Caller deltas**); it does not restate the steps. Run the Procedure once per item. Roadmaps, decisions, and requirements are **not** archived: finished items stay in place and move from `## Active` to `## Closed` in their family index — see **In-place close (roadmaps, decisions, requirements)** below.

## Inputs

| Input | Meaning |
|-------|---------|
| `family` | One of `tasks`, `uat`, `bugs` — the directory under `wiki/work/`. Roadmaps, decisions, and requirements use the in-place close section below, not this procedure. |
| `file` | The item's current path, e.g. `wiki/work/<family>/<file>.md`. |
| `terminal_status` | The status the item ends in. Must be a terminal value for `family` per `wiki/work/<family>/lifecycle.md`. |
| `log` | The `wiki/log.md` entry text to append, or `skip` when the caller writes its own entry. Omitted means the default entry (see **Row and log formats**). |

## Procedure

1. **Verify and set the status.** `Read` `wiki/work/<family>/lifecycle.md` and confirm `terminal_status` is a terminal value for the family — do not hardcode the per-family sets. `Read` `file`. If its `status:` is already terminal, do not touch the file's content and go to step 2. Otherwise `Edit` once: set `status: <terminal_status>` and bump `updated:` to today's date.
2. **Move the file.** `Bash`, `git mv` only: `git mv wiki/work/<family>/<file>.md wiki/work/<family>/archive/<file>.md`. `git mv` (not plain `mv`) preserves history. `archive/` already exists — do not create it.
3. **Remove the active-index row.** `Read` `wiki/work/<family>/index.md`, then `Edit` to remove the item's row. If the row is already absent, note it and continue.
4. **Append the archive-index row.** `Read` `wiki/work/<family>/archive/index.md`, then `Edit` to append one row in the four-column format below, using the item's `id` and `title` from its frontmatter and today's date.
5. **Append the log entry.** Unless `log` is `skip`, `Read` `wiki/log.md`, then `Edit` to append the caller's `log` text, or the default entry.

## Row and log formats

Archive-index row (identical shape in every family's `archive/index.md`, including `decisions/`; the table header is `| ID | Title | Final Status | Archived |`):

```
| [[ID]] | <title> | <terminal_status> | YYYY-MM-DD |
```

`YYYY-MM-DD` is today's date. Some archive indexes are column-padded by a formatter (e.g. `uat/archive/index.md`); an unpadded row is still valid — do not reformat existing rows.

Default log entry (used when the caller passes no `log`):

```
## [YYYY-MM-DD] archive | <ID> — <terminal_status>, moved to archive
<One sentence: moved to wiki/work/<family>/archive/<file>.md, and why if the caller knows.>
```

## Caller deltas

What each consumer passes. Anything not listed here is the caller's own logic and stays in its `SKILL.md`.

| Consumer | `family` | `terminal_status` | `log` / other deltas |
|----------|----------|-------------------|----------------------|
| `wiki-archive` | `tasks`, `uat` or `bugs` | the file's existing terminal `status:` (step 1 is a no-op) | `log: skip` per item; writes one batch entry itself (`archive | <family> — N items archived`) |
| `task-assess` | `tasks` | `done` | default entry |
| `task-close` | `tasks`, then `uat` | `trashed` | run once for the task, then once per related UAT file; task uses log op `task-trashed`, UAT runs pass `log: skip` |
| `bug-triage` | `bugs` | `wontfix` \| `duplicate` \| `cannot-reproduce` | `log: skip` — its own Step 9 writes the single entry |
| `bug-close` | `bugs` | `closed` \| `wontfix` \| `cannot-reproduce` | default entry |

## CRITICAL rules

- **Never delete.** Archiving is moving, not deleting.
- **`archive/index.md` is append-only** — add rows, never edit or remove existing ones.
- **No body edits.** The only content change to the item is the `status:` / `updated:` flip in step 1. Never reformat or edit anything else in the moved file.
- **`Bash` only for `git mv`.** Every other edit is `Read` then `Edit`; never `sed`, `awk`, or `echo >>`.
- **`archive/` already exists** in `tasks`, `uat`, and `bugs` — do not create it. It is never created or used in `requirements`, `decisions`, or `roadmaps`.

## Other consumers (not yet wired)

These implement the same mechanic inline and have not been pointed at this doc yet: `uat-skip` (Step 3a/4) and `UAT-CORE.md` Closure (`~/.claude/skills/uat-walk/UAT-CORE.md`). Their task/UAT archiving is unchanged; their roadmap-completion step uses the in-place close below. A follow-up can rewire the task/UAT part to this procedure.

## In-place close (roadmaps, decisions, requirements)

For `roadmaps`, `decisions`, and `requirements`, a finished item **stays where it is**. Closing it flips its status (when it has one to flip) and moves its row in the family `index.md` from `## Active` to `## Closed`. There is no `git mv` and no `archive/index.md`. The Inputs `file`, `terminal_status`, and `log` have the same meaning as above.

| Family | Active while | Closed when |
|--------|--------------|-------------|
| `requirements` | `draft`, `approved` | `retired` |
| `roadmaps` | `active` | `done` |
| `decisions` | a group is Active while any block is `proposed` | every block is `accepted`, `deprecated`, or `superseded` |

### Procedure

1. **Verify and set the status.** `Read` `wiki/work/<family>/lifecycle.md` and confirm `terminal_status` is a terminal value for the family. `Read` `file`. If its `status:` is already terminal, do not touch the file's content and go to step 2. Otherwise `Edit` once: set `status: <terminal_status>` and bump `updated:` to today's date. Decisions carry a per-block `Status:` instead of a file `status:`; the decision skills set it themselves before calling this step.
2. **Move the index row.** `Read` `wiki/work/<family>/index.md`, then `Edit` to remove the item's row from `## Active` and add it under `## Closed`, in numeric-ID order. If `## Closed` is missing, create it at the end of the file. If the row is already in `## Closed`, only update its trailing segment; if it is absent from `## Active`, note it and continue.
3. **Append the log entry.** `Read` `wiki/log.md`, then `Edit` to append `## [YYYY-MM-DD] close | <ID> — <terminal_status>, closed in place`, unless the caller writes its own entry (`log: skip`).

### Row format

A Closed row is the Active bullet with the terminal status as a trailing ` · ` segment:

```
- [ROADMAP-NNNN — Title](ROADMAP-NNNN-slug.md) — one-line summary · done
```

For a decision group the trailing segment is the per-block summary instead (`D1 accepted, D2 superseded`).

### Caller deltas

| Consumer | `family` | `terminal_status` / other deltas |
|----------|----------|----------------------------------|
| `roadmap-next`, `roadmap-assess` | `roadmaps` | `done` |
| `prd-deprecate` | `requirements` | `retired` |
| `adr-deprecate`, `adr-finalize` (only when the group is fully terminal) | `decisions` | the group's per-block summary as the trailing segment; the skill sets the block `Status:` itself |
| `uat-skip`, `UAT-CORE.md` roadmap-completion step | `roadmaps` | `done` |

### CRITICAL rules

- **Never `git mv`** an item in these families.
- **Never create `archive/`** in these families.
- **No body edits.** The only content change to the item is the `status:` / `updated:` flip in step 1.
- **Every edit is `Read` then `Edit`**; never `sed`, `awk`, or `echo >>`.
