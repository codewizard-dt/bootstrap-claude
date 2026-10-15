---
name: wiki-lint
description: Health-check the wiki — find contradictions, stale claims, orphan pages, missing concept pages, missing cross-references, and never-ingested raw sources; fix only with approval
category: researching
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`.

# Wiki Lint

Audit the wiki for structural and semantic problems. Report findings ranked by severity. **Never fix anything without explicit user approval.**

---

## Step 1: Inventory the wiki tree

Use `mcp__serena__list_dir` on:
- `wiki/` (top-level)
- `wiki/knowledge/` (recursive)
- `wiki/work/` (recursive)
- `raw/` (to find never-ingested sources)

Build a complete file list.

## Step 2: Run all checks

### 2.0 Stranded terminal files (HIGH)

For each **archiving** work family (`tasks`, `uat`, `bugs` only), scan the active directory (excluding `lifecycle.md`, `index.md`, `.gitkeep`, and anything under `archive/`). For each file, read its `status:` frontmatter. If the status is in the terminal set for that family (read each family's `lifecycle.md` — do NOT hardcode), report it as a stranded file. Roadmaps, decisions and requirements close in place — a terminal file in those families is correct where it is and is never reported here (check 2.1 verifies its index section instead).

Report format:
```
[HIGH] stranded terminal file — wiki/work/tasks/TASK-014-some-slug.md has status: done but is not in archive/
```

Proposed fix for each: `git mv wiki/work/<family>/<file>.md wiki/work/<family>/archive/<file>.md`

These should have been auto-archived by the skill that set the terminal status.

### 2.1 Family-index drift (HIGH)

For each work family (`requirements`, `decisions`, `roadmaps`, `tasks`, `uat`, `bugs`), branching on how the family closes items:

**Archiving families (`tasks`, `uat`, `bugs`):**
1. Read the family's `index.md`.
2. For each row in the index: verify the linked file exists in the family directory; verify the file's `status:` frontmatter matches an **active** status for that family (read each family's `lifecycle.md` for the valid active statuses — do NOT hardcode them).
3. For each file in the family directory (excluding `lifecycle.md`, `index.md`, `.gitkeep`, and anything under `archive/`): read its `status:` frontmatter; if the status is **not** in the active set, verify its row is absent from the active index. Files in `archive/` are terminal by definition — they should not appear in the active `index.md` but their presence in `archive/` is correct.

**In-place families (`requirements`, `decisions`, `roadmaps`):** finished items stay in the family directory and the family `index.md` moves the row from `## Active` to `## Closed`.
1. Read the family's `index.md`; each row must link to an existing file in the family directory.
2. For each file in the family directory (excluding `lifecycle.md`, `index.md`, `.gitkeep`): read its `status:` frontmatter (for decisions, a group is Active while any block is `proposed`, otherwise Closed) and verify its row sits in the right section — `## Active` for active statuses, `## Closed` for terminal ones (read each family's `lifecycle.md`; do NOT hardcode) — and is absent from the wrong one.
3. If `wiki/work/<family>/archive/` still exists and is non-empty, report it as `[MEDIUM] un-migrated archive/` — informational, leftover from the old archive model; the fix is `npx @codewizard-dt/bootstrap update`, not a manual move.

Report:
- Active item missing from index (or in-place item missing from its correct section)
- Non-active item still listed in index (or in-place item listed in the wrong section)
- Index row pointing at a missing file
- `[MEDIUM] un-migrated archive/ — wiki/work/<family>/archive/ still holds N files (run npx @codewizard-dt/bootstrap update to migrate)`

### 2.2 Two-domain violations (HIGH)

- Any file under `wiki/knowledge/` that has a `status:` frontmatter key (stateful artifacts don't belong in knowledge)
- Any file under `wiki/work/` that lacks a `status:` frontmatter key (work artifacts must be status-driven)
- Any file under `wiki/knowledge/` whose name matches a work-family ID pattern (PRD-NNNN, REQ-NNNN, TASK-NNNN, BUG-NNNN, etc.)

### 2.3 ID / filename mismatch (MEDIUM)

For each file in `wiki/work/`: verify that the `id:` frontmatter value matches the filename prefix (e.g. `id: TASK-014` → filename must start with `TASK-014`). Report mismatches.

### 2.4 UAT ↔ Task cross-link integrity (MEDIUM)

For each UAT file in `wiki/work/uat/`:
- The `task:` frontmatter must point to an existing task file in `wiki/work/tasks/`.
- The referenced task file must have a `uat:` frontmatter link back to this UAT.

Report broken or asymmetric links.

### 2.5 Typed-link vocabulary (LOW)

Scan all wiki pages for `::[[` patterns. Verify the relationship keyword (the part before `::`) is in the vocabulary defined in `wiki/conventions.md`. Report unknown keywords.

### 2.6 Orphan pages (LOW)

Pages that appear in the file tree but are not linked from any other wiki page (including `wiki/index.md`).

### 2.7 Never-ingested raw sources (LOW)

List files in `raw/` (excluding `.gitkeep`) that have no matching summary page in `wiki/knowledge/sources/`.

### 2.8 Contradictions (MEDIUM)

Scan all pages for `> **Contradiction:**` callouts; list them so the user can resolve or confirm they are intentional.

### 2.9 Stale frontmatter (LOW)

Pages where `updated:` is more than 90 days old — these may contain outdated claims.

### 2.10 Provenance / confidence (LOW)

**Knowledge pages only.** Scan every page under `wiki/knowledge/sources/`, `wiki/knowledge/concepts/`, and `wiki/knowledge/entities/` (recursive, excluding `index.md` and `.gitkeep`). Skip `wiki/work/` entirely — work artifacts track state with `status`, not `confidence`.

Read each page's `confidence:` frontmatter value (defined in `wiki/conventions.md` §4: `extracted` (default, source-backed), `inferred` (LLM synthesis beyond the source), `ambiguous` (sources disagree / uncertain)) and classify:

- **Weak provenance** — `confidence: inferred` or `confidence: ambiguous`. The page's claims are not source-backed; surface so the user can weigh or re-ground them. This is the primary signal.
- **Untagged provenance** — no `confidence` key at all. Per the convention this defaults to `extracted`, so it is **not** a defect — report it only as an informational nudge to add an explicit tag on the page's next revision (`/wiki-ingest` populates the field on pages it writes going forward).
- **`confidence: extracted`** (or the default) — no finding.

Report format:
```
[LOW] weak provenance — wiki/knowledge/concepts/foo.md is confidence: inferred (not source-backed)
[LOW] untagged provenance — wiki/knowledge/entities/tools/bar.md has no confidence key (defaults to extracted; add an explicit tag on next revision)
```

Report-only — provenance is a human judgment (whether a page is genuinely `inferred`), so these are never auto-fixed (see Step 4).

### 2.11 Typed-link target resolution (MEDIUM)

Reuse the `::[[` scan from 2.5 (`mcp__serena__search_for_pattern` across `wiki/`) rather than running a second scanner — 2.5 validates the keyword before `::` (vocabulary in `wiki/conventions.md` §3); this check validates the target after it. For each `keyword::[[target]]` match, resolve the target to confirm it exists:

**Resolution logic:**
- **Decision targets** (`ADR-NNNN` or `ADR-NNNN#DM`, plus legacy `DEC-NNNN` or `DEC-NNNN#DM` until migrated — the number, not the prefix, selects the file): Confirm the file exists in `wiki/work/decisions/` or, for legacy un-migrated wikis, `wiki/work/decisions/archive/` (`mcp__serena__find_file`). If a `#DM` anchor is present, confirm that decision block exists in the file — an H2 matching `## DM.` (e.g. `## D2.`) with a `- **Status**: <status>` line.
- **Work-family targets** (`TASK-NNNN`, `BUG-NNNN`, `UAT-NNNN`, `PRD-NNNN`, `REQ-NNNN`, `ROADMAP-NNNN`): Confirm the file exists in the respective family directory (`wiki/work/<family>/`) or `wiki/work/<family>/archive/` (`mcp__serena__find_file`; `archive/` is the normal location only for `tasks`, `uat` and `bugs` — for the other families it is a legacy-tolerance fallback).
- **Knowledge page targets** (bare slugs, e.g. `[[typed-wiki-links]]`): Confirm a page with a matching `id:` or entry in `aliases:` frontmatter, or a matching filename, exists under `wiki/knowledge/`.

**Reporting:**
- **Unresolved targets** — report as `[MEDIUM] dangling typed link — <file>:<line> — <keyword>::[[<target>]] does not resolve to any existing page or work item`.
- **Superseded decision targets** — if a target resolves to a decision block whose status is `superseded by ADR-N#DX` (or legacy `superseded by DEC-N#DX`), report separately as `[LOW] typed link to superseded decision — <file>:<line> — consider updating to ADR-N#DX` (informational, not broken; the link still resolves).

### 2.12 Task-less accepted decisions (MEDIUM)

For each decision file in `wiki/work/decisions/` (excluding `lifecycle.md`; include `archive/` for legacy un-migrated wikis), parse every `## D*` decision block — each H2 matching `## D\d+\.` is a decision block, collected in document order. For each block:

- Skip unless `Status: accepted` — only accepted decisions need a follow-up task; skip `proposed`, `deprecated`, `superseded by …`.
- A decision is task-less if its `### Links` section is absent, or has no `Source task(s):` line, or the `Source task(s):` line is blank / contains only a placeholder (e.g. "none yet").

Unlike `/adr-next` (which stops at the first gap), report **every** task-less accepted decision found across all decision files — matching this skill's "report all, fix none without approval" contract.

Report format:
```
[MEDIUM] task-less accepted decision — ADR-NNNN#DM (<title>) has no Source task(s) link
```

Report each file's own `id:` in place of `ADR-NNNN` (a not-yet-migrated file reports its legacy `DEC-NNNN`).

## Step 3: Report findings

Group by severity (HIGH / MEDIUM / LOW). For each finding:
```
[HIGH] family-index drift — tasks/index.md row for TASK-014 but file status is: done
```

Summarize total counts per severity.

## Step 4: Propose fixes

For each HIGH finding, propose the exact `Edit` operation that would fix it. Do not apply without approval.

Ask: **"Which findings should I fix?"** — wait for the user's reply before making any edits.

## Step 5: Apply approved fixes only

For each approved fix, apply it with a single `Edit` call. After all fixes, append one log entry to `wiki/log.md`:
```
## [YYYY-MM-DD] lint | <N> issues found, <M> fixed
Summary of findings and fixes applied.
```
