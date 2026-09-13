---
id: TASK-0092
aliases: [TASK-0092]
title: "New wiki-lint check: validate typed-link targets actually resolve"
status: pending-uat
created: 2026-09-13
updated: 2026-09-13
depends_on: []
blocks: []
parallel_safe_with: [TASK-0086, TASK-0087, TASK-0088, TASK-0089, TASK-0090, TASK-0091]
uat: ""
tags: [wiki-lint, wiki-conventions]
---

# TASK-0092 — New wiki-lint check: validate typed-link targets actually resolve

relates_to::[[wiki-work-family-cross-linking-gaps]]

## ⚠️ Shares a file with TASK-0093 — do not tackle simultaneously

Both this task and `TASK-0093` edit `lib/skills/wiki-lint/SKILL.md` (this task adds a new "## 2.11" check; `TASK-0093` adds "## 2.12"). Tackle this one first, then `TASK-0093` — sequential, not parallel, to avoid a lost edit. This is an orchestration note, not a logical dependency, so `depends_on`/`blocks` stay empty; if a future re-run finds `TASK-0093` already landed first, adapt the section number so `2.11`/`2.12` don't collide.

## Objective

`/wiki-lint`'s existing "### 2.5 Typed-link vocabulary (LOW)" check only validates that the *keyword* before `::` is in `wiki/conventions.md`'s declared vocabulary — it never checks whether the *target* the link points at actually exists. With 391+ typed links already in `wiki/knowledge/` alone (per the `wiki-work-family-synergy` research), a rename or archive can silently produce a dead link that nothing surfaces. Add a new check that resolves every typed-link target.

## Approach

**Source-of-truth note**: edit `lib/skills/wiki-lint/SKILL.md` in this repo, never `~/.claude/skills/wiki-lint/SKILL.md` — the latter is a machine-local copy installed by `install-global.sh`, overwritten on the next sync.

Extend the existing `::[[` pattern scan from 2.5 rather than writing a second independent scanner — the two checks share the same discovery step (find every `keyword::[[target]]` occurrence across the wiki) and differ only in what they validate about each match.

## Steps

### 1. Add check 2.11 to wiki-lint <!-- agent: general-purpose -->

- [ ] In `lib/skills/wiki-lint/SKILL.md`, immediately after "### 2.10 Provenance / confidence (LOW)", add "### 2.11 Typed-link target resolution (MEDIUM)".
- [ ] For every `keyword::[[target]]` match found (reuse 2.5's `::[[` scan via `mcp__serena__search_for_pattern` across `wiki/`), resolve `target`:
  - A `DEC-NNNN` or `DEC-NNNN#DM` target: confirm the decision file exists in `wiki/work/decisions/` or `archive/`, and if `#DM` is given, confirm that block exists in the file.
  - A `TASK-NNNN`/`BUG-NNNN`/`UAT-NNNN`/`REQ-NNNN`/`ROADMAP-NNNN` target: confirm the file exists in its family's active dir or `archive/` via `mcp__serena__find_file`.
  - A bare slug (knowledge page reference, e.g. `[[typed-wiki-links]]`): confirm a page with that `id:`/`aliases:` exists under `wiki/knowledge/`.
- [ ] Report unresolved targets: `[MEDIUM] dangling typed link — <file>:<line> — <keyword>::[[<target>]] does not resolve to any existing page or work item`.
- [ ] For a target resolving to a *superseded* decision block specifically (`Status: superseded by DEC-N#DX`), report separately as `[LOW] typed link to superseded decision — <file>:<line> — consider updating to DEC-N#DX` (informational, not broken).

### 2. Wire it into Step 3's severity grouping and Step 4's fix proposals <!-- agent: general-purpose -->

- [ ] Confirm "## Step 3: Report findings" and "## Step 4: Propose fixes" (which already iterate "for each HIGH finding") pick up 2.11's MEDIUM findings under the existing severity grouping — no structural change needed there, just confirm the new check's output format matches the `[SEVERITY] <finding-type> — <detail>` shape every other check uses.
