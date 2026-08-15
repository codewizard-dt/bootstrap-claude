---
id: TASK-004
aliases: [TASK-004]
title: "Add Auto Memory vs. wiki division-of-responsibility note to CLAUDE.md"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: [TASK-005]
parallel_safe_with: []
uat: "[[UAT-004]]"
tags: [wiki-tooling, documentation]
---

# TASK-004 — Add "Auto Memory vs. wiki" division-of-responsibility note to `CLAUDE.md`

## Objective

`CLAUDE.md`'s "## LLM Wiki" section documents the wiki schema but says nothing about Claude Code's own native Auto Memory feature, or which facts belong in which system. Per `wiki/knowledge/entities/tools/claude-code-auto-memory.md`, this is an identified open gap: no file currently documents the boundary, risking silent duplication or contradiction between the two systems. Add a short, concrete bridging note.

## Approach

Key facts to draw from (already ingested, do not re-research):
- **Auto Memory** (`wiki/knowledge/entities/tools/claude-code-auto-memory.md`): typed memory files (`user`, `feedback`, `project`, `reference`) under `~/.claude/projects/<hash>/memory/`, indexed by `MEMORY.md`, auto-loaded at session start, cross-project and un-versioned (lives outside the git repo). Exempted from context compaction along with `CLAUDE.md`.
- **This repo's wiki**: per-project and git-versioned, lives in `wiki/`.
- **The division**: Auto Memory holds facts about the *user* and cross-project working style (how David likes to collaborate, standing preferences) that apply regardless of which repo is open. The wiki holds facts about *this project* — its architecture, decisions, requirements, tasks — that should be versioned, reviewable, and shared with anyone who clones the repo. A fact that's true only because "David told me once" and applies everywhere → Auto Memory. A fact that's true because "this project decided X" and should survive in git history → wiki.

Note there is a near-identical companion item (Phase 1 item 2, tracked separately) that also edits `CLAUDE.md`'s LLM Wiki section — do this task first since the other depends on it, to avoid two conflicting edits to the same section.

## Steps

### 1. Add the division-of-responsibility note  <!-- agent: general-purpose -->

- [x] Read `CLAUDE.md`'s `## LLM Wiki` section (the copy-once section synced from `lib/scripts/templates/CLAUDE-wiki.md`)
- [x] `Edit` to add a short subsection (e.g. `### Auto Memory vs. this wiki`) immediately after the "Navigation" paragraph and before "### Wiki operations", covering: what Auto Memory is, what it's for, and the rule of thumb above for which system a new fact belongs in
- [x] Make the identical edit to `lib/scripts/templates/CLAUDE-wiki.md` (the source template `sync-wiki-scaffold.sh` delivers into target projects) so future projects get this note too — check both files list the same section structure before writing to avoid drift between source template and this repo's own already-synced copy

### 2. Verify  <!-- agent: general-purpose -->

- [x] Confirm the new subsection doesn't duplicate or contradict existing wording elsewhere in `CLAUDE.md`'s LLM Wiki section
- [x] Confirm `lib/scripts/templates/CLAUDE-wiki.md` and this repo's `CLAUDE.md` LLM Wiki section stay structurally in sync (same sentinel markers, same section order)
