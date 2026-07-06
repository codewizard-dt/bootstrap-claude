---
id: ROADMAP-001
title: Improve wiki tooling based on 2026-07-06 research
status: active
created: 2026-07-06
updated: 2026-07-06
owner: David Taylor
derived_from: [raw/research/wiki-tooling-improvements/index.md, ../../knowledge/sources/wiki-tooling-improvements.md]
linked_requirements: []
linked_decisions: []
tags: [wiki-tooling, memory]
---

# Roadmap 001: Improve wiki tooling based on 2026-07-06 research

## Goal

The wiki tooling adopts the research's top recommendations — a session-handoff hot cache, activated provenance/confidence tagging, and a documented Auto-Memory-vs-wiki boundary in `CLAUDE.md` — while any stale skill/template drift discovered along the way gets fixed, and heavier infrastructure (multi-writer locking, dedicated memory frameworks) stays explicitly deferred rather than silently built.

Derived from [raw/research/wiki-tooling-improvements/index.md](../../../raw/research/wiki-tooling-improvements/index.md) and its wiki summary at [wiki/knowledge/sources/wiki-tooling-improvements.md](../../knowledge/sources/wiki-tooling-improvements.md).

## Phase 0: Audit & Fix Drift

- [x] [[TASK-001: Audit lib/skills for stale README.md-style family-index references]]
- [x] [[TASK-002: Audit lifecycle.md files and skill templates for stale wiki/work/<family>/completed references]]
- [x] [[TASK-003: Fix roadmap-create and other skills drifting from the index.md/lifecycle.md convention]]

## Phase 1: Documentation Bridge

- [x] [[TASK-004: Add Auto Memory vs. wiki division-of-responsibility note to CLAUDE.md]]
- [x] [[TASK-005: Add Optional tooling pointer (qmd, Hindsight) to CLAUDE.md]]

## Phase 2: Session Continuity

- [x] [[TASK-006: Add wiki/hot.md template to lib/scripts/templates/wiki/]]
- [x] [[TASK-007: Update /wiki-ingest (and other wiki-writing skills) to refresh wiki/hot.md]]
- [x] [[TASK-008: Update /primer to read wiki/hot.md first, before Serena memories]]

## Phase 3: Provenance & Quality

- [x] [[TASK-009: Activate confidence: extracted|inferred|ambiguous in wiki/conventions.md]]
- [x] [[TASK-010: Update /wiki-ingest to populate the confidence field on new/updated knowledge pages]]
- [x] [[TASK-011: Flag pages with weak/missing confidence provenance in /wiki-lint]]

## Phase 4: Concurrency Safety (deferred)

- [ ] Design advisory locking for shared wiki index files, modeled on `lib/hooks/lib/serena.js`'s fail-open pattern — deferred until concrete concurrent-write corruption is observed in `power-mode`/`tackle` usage

## Notes

