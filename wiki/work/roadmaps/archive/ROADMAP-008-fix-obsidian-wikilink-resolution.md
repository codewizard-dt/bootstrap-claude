---
id: ROADMAP-008
aliases: [ROADMAP-008]
title: Fix Obsidian Wikilink Resolution for Work-Item IDs
status: done
created: 2026-08-15
updated: 2026-08-15
owner: David Taylor
derived_from: [raw/research/obsidian-alias-link-resolution/index.md, ../../knowledge/sources/obsidian-alias-link-resolution.md]
linked_requirements: []
linked_decisions: []
tags: [obsidian, wikilinks, tooling]
---

# Roadmap 008: Fix Obsidian Wikilink Resolution for Work-Item IDs

## Goal

Fix Obsidian wikilink resolution for every `TASK-NNN`/`UAT-NNN`/`BUG-NNNN`/`DEC-NNNN`-style reference in the wiki. End state: every work-item file carries an `aliases: [ID]` field mirroring its `id:`, the Alias Linker plugin is bundled into `install-obsidian.sh`'s plugin set, and clicking any existing short-ID link (e.g. `[[TASK-009]]`) navigates to the real file instead of offering to create a new one.

Derived from [raw/research/obsidian-alias-link-resolution/index.md](../../../raw/research/obsidian-alias-link-resolution/index.md) and its wiki summary at [wiki/knowledge/sources/obsidian-alias-link-resolution.md](../../knowledge/sources/obsidian-alias-link-resolution.md).

## Phase 1: Frontmatter Templates

- [x] [[TASK-065: Add aliases: [<ID>] to work-item frontmatter templates]]

## Phase 2: Backfill Existing Files

- [x] [[TASK-064: Backfill aliases: [<ID>] onto every existing work-item file's frontmatter]]

## Phase 3: Plugin Wiring

- [x] [[TASK-063: Bundle the Alias Linker plugin into install-obsidian.sh's plugin bundle]]

## Notes

