---
name: wiki-lint
description: Health-check the wiki — find contradictions, stale claims, orphan pages, missing concept pages, missing cross-references, and never-ingested raw sources; fix only with approval
category: researching
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`.

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

For each work family, scan the active directory (excluding `lifecycle.md`, `index.md`, `.gitkeep`, and anything under `archive/`). For each file, read its `status:` frontmatter. If the status is in the terminal set for that family (read each family's `lifecycle.md` — do NOT hardcode), report it as a stranded file.

Report format:
```
[HIGH] stranded terminal file — wiki/work/tasks/TASK-014-some-slug.md has status: done but is not in archive/
```

Proposed fix for each: `git mv wiki/work/<family>/<file>.md wiki/work/<family>/archive/<file>.md`

These should have been auto-archived by the skill that set the terminal status.

### 2.1 Family-index drift (HIGH)

For each work family (`requirements`, `decisions`, `roadmaps`, `tasks`, `uat`, `bugs`):
1. Read the family's `index.md`.
2. For each row in the index: verify the linked file exists in the family directory; verify the file's `status:` frontmatter matches an **active** status for that family (read each family's `lifecycle.md` for the valid active statuses — do NOT hardcode them).
3. For each file in the family directory (excluding `lifecycle.md`, `index.md`, `.gitkeep`, and anything under `archive/`): read its `status:` frontmatter; if the status is **not** in the active set, verify its row is absent from the active index. Files in `archive/` are terminal by definition — they should not appear in the active `index.md` but their presence in `archive/` is correct.

Report:
- Active item missing from index
- Non-active item still listed in index
- Index row pointing at a missing file

### 2.2 Two-domain violations (HIGH)

- Any file under `wiki/knowledge/` that has a `status:` frontmatter key (stateful artifacts don't belong in knowledge)
- Any file under `wiki/work/` that lacks a `status:` frontmatter key (work artifacts must be status-driven)
- Any file under `wiki/knowledge/` whose name matches a work-family ID pattern (REQ-NNN, TASK-NNN, BUG-NNNN, etc.)

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
