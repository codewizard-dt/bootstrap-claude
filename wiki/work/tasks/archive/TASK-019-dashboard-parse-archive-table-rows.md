---
id: TASK-019
aliases: [TASK-019]
title: "Teach dashboard parseIndexMarkdown to parse archive/index.md table rows so Archived counts are correct"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: []
parallel_safe_with: []
uat: ""
tags: [dashboard, bugfix, wiki-tooling]
---

# TASK-019 — Teach dashboard parseIndexMarkdown to parse archive/index.md table rows

## Objective

`lib/scripts/templates/wiki/dashboard.html` ships a client-side `parseIndexMarkdown(text)` that only recognizes bullet-list lines (`- [Title](path) — summary · status`), the format used by each family's **active** `index.md`. But every family's `archive/index.md` uses a **Markdown table** instead (`| ID | Title | Final Status | Archived |` with `[[TASK-NNN]]` wiki-link cells). Because the parser ignores table rows, every panel's "Archived" section renders a count of `0` no matter how many items are actually archived. This task extends the parser to also recognize archive table rows and emit the same `{ title, path, summary, status }` item shape the render layer already consumes, so archive counts and lists populate correctly.

## Approach

**Scope is the parser only.** The render layer already handles the target item shape: `renderFamily` reads `archived.length` for the count badge (dashboard.html:654-655) and calls `buildArchiveRow` per item (dashboard.html:590-613), which renders **only** `id + linked label` via `splitTitle(item.title)` — it does not use `summary` or `status`. So the fix is confined to `parseIndexMarkdown`; no render-layer change is needed.

**Item shape mapping** (archive table → item object):
- `title` — combine the ID and Title columns as `"<ID> — <Title>"` (e.g. `"TASK-006 — Add wiki/hot.md template…"`). This lets the existing `splitTitle` (dashboard.html:533) cleanly split it back into `{ id, label }` so `buildArchiveRow` renders the monospace ID chip plus the label exactly like active rows.
- `path` — `null`. Archive rows use `[[TASK-NNN]]` wiki-link syntax, not markdown links, so there is no reliable relative path to link to; `buildArchiveRow` already renders a non-link `<a>` when `path` is falsy (dashboard.html:606-609). Deriving a filename from the ID is unreliable (slugs vary), so leave it null rather than guess.
- `summary` — `null` (not rendered for archive rows).
- `status` — the Final Status column value (e.g. `done`, `trashed`). Not rendered today, but populate it for shape-consistency and future use.

**Parsing strategy — must survive escaped pipes.** At least one existing archive row has an escaped pipe *inside* a cell: TASK-009's title is `Activate confidence: extracted\|inferred\|ambiguous in wiki/conventions.md`. A naive `split('|')` would mis-split that row. Split each candidate row on **unescaped** pipes only, then unescape `\|` → `|` within each cell.

**Distinguishing table rows from the header/separator/other lines:**
- A data row is identified by its **first non-empty cell being a `[[…]]` wiki-link**. The header row (`| ID | Title | …`) has a plain-text first cell and the separator row (`|----|----|…`) is all dashes — neither has a `[[…]]` first cell, so both are naturally excluded. No explicit header/separator skipping logic is required beyond the `[[…]]` gate.
- Keep the existing bullet-line parsing intact and additive: a single pass over the lines should try the bullet regex first (unchanged) and, if that fails, try the table-row match. A file is only ever one format or the other, so there is no double-counting risk, but the additive design keeps the function correct if a file ever mixed them.

**XSS note:** all extracted strings continue to flow through the existing `textContent`/property-based DOM builders (`buildArchiveRow`, `buildItemRow`), so no new injection surface is introduced — do not switch any rendering to `innerHTML`.

**Shared-file coordination:** TASK-018 (dark-mode toggle) also edits `dashboard.html`, but a different region (theme CSS + toggle JS) — this task touches only `parseIndexMarkdown`. They are logically independent; avoid running both in the *same* concurrent `/tackle` wave to prevent a same-file edit conflict, but neither blocks the other.

## Steps

### 1. Extend the parser <!-- agent: general-purpose -->

- [x] Open `lib/scripts/templates/wiki/dashboard.html` and locate `function parseIndexMarkdown(text)` (currently dashboard.html:462-486).
- [x] Add a helper (module-local, above or beside `parseIndexMarkdown`) that parses a single Markdown table data row into cells, splitting on **unescaped** pipes and unescaping `\|` → `|`:
  - Trim the line; require it to start and end with `|`.
  - Split on a pipe not preceded by a backslash (e.g. regex `/(?<!\\)\|/`), drop the empty leading/trailing segments produced by the outer pipes, then replace `\|` with `|` and trim each remaining cell.
  - Return the cell array (or `null` if it does not look like a table row).
- [x] Inside `parseIndexMarkdown`'s line loop, keep the existing bullet-regex branch first. When the bullet regex does **not** match, attempt the table-row branch:
  - Parse the line into cells with the helper.
  - Require at least 3 cells **and** the first cell to match a wiki-link, e.g. `/^\[\[([^\]]+)\]\]$/` — capture the inner ID. (This gate excludes the `| ID | Title |…` header and the `|----|` separator.)
  - Read column 2 as the Title and column 3 as the Final Status (columns are ID, Title, Final Status, Archived).
  - Push `{ title: id + ' — ' + titleCol, path: null, summary: null, status: statusCol || null }`.
- [x] Update the function's doc-comment block (dashboard.html:445-461) to note that archive `index.md` **table rows** (`| [[ID]] | Title | Final Status | Archived |`) are also parsed, and that escaped pipes inside cells are handled.

### 2. Verify against real archive data <!-- agent: general-purpose -->

- [x] Sanity-check the regex/logic against the two trickiest real rows in `wiki/work/tasks/archive/index.md`:
  - `| [[TASK-006]] | Add wiki/hot.md template to lib/scripts/templates/wiki/ | done | 2026-07-06 |` → `{ title: "TASK-006 — Add wiki/hot.md template to lib/scripts/templates/wiki/", path: null, summary: null, status: "done" }`.
  - `| [[TASK-009]] | Activate confidence: extracted\|inferred\|ambiguous in wiki/conventions.md | done | 2026-07-06 |` → title's label must read `Activate confidence: extracted|inferred|ambiguous in wiki/conventions.md` (escaped pipes collapsed to literal `|`, NOT split into extra cells), status `done`.
  - Confirm the header row `| ID | Title | Final Status | Archived |` and separator `|----|-------|--------------|----------|` both yield **no** item.
- [x] Confirm the active-index bullet format still parses unchanged (e.g. the TASK-018 line in `wiki/work/tasks/index.md`) — the additive branch must not regress bullet parsing.
- [x] Start the dashboard locally (`node lib/scripts/wiki-dashboard-server.js` from the repo root, or `npx @codewizard-dt/bootstrap dashboard` — confirm the exact invocation in `bin/cli.js`), open the served page, expand the Tasks panel's Archived `<details>`, and confirm the archive count now shows the real number (17 for tasks at time of writing) and the rows render with their ID chips. Check at least one other family that has archived items (e.g. UAT, roadmaps).

## Notes

- Root cause was noted as a non-blocking observation during TASK-017's manual verification (`wiki/work/tasks/archive/TASK-017-wiki-dashboard-verification.md`) but never filed until now. The dashboard feature (ROADMAP-002) is fully done and archived; this is a standalone follow-up fix, not part of an active roadmap.
- Affected files at runtime: every `wiki/work/<family>/archive/index.md`. The template lives at `lib/scripts/templates/wiki/dashboard.html`; the fix must land in the template so it propagates to projects on the next sync.
