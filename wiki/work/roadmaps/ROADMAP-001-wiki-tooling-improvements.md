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

- [ ] Audit `lib/skills/*.md` and `lib/scripts/templates/wiki/` for stale references to README.md-style family docs; confirm each skill matches the actual `index.md` + `lifecycle.md` convention in `wiki/conventions.md`
- [ ] Check all `lifecycle.md` files as well as skills/templates for any reference to `wiki/work/<family>/completed` which should be updated to `wiki/work/<family>/archive`
- [ ] Fix `/roadmap-create` (and any other skill found drifting) to reference `index.md`/`lifecycle.md` and this repo's actual task-link format, not an assumed `README.md`/`[[TASK-NNN: title]]` convention

## Phase 1: Documentation Bridge

- [ ] Add an "Auto Memory vs. wiki" division-of-responsibility note to `CLAUDE.md`'s LLM Wiki section
- [ ] Add an "Optional tooling" pointer (qmd, Hindsight) cross-linking the already-ingested `wiki/knowledge/entities/tools/` pages, without editing immutable `raw/llm-wiki.md`

## Phase 2: Session Continuity

- [ ] Add a `wiki/hot.md` template to `lib/scripts/templates/wiki/` (copy-once)
- [ ] Update `/wiki-ingest` (and other wiki-writing skills) to refresh `wiki/hot.md` as a final step
- [ ] Update `/primer` to read `wiki/hot.md` first, before Serena memories

## Phase 3: Provenance & Quality

- [ ] Activate `confidence: extracted|inferred|ambiguous` in `wiki/conventions.md`'s reserved-keys section
- [ ] Update `/wiki-ingest` to populate the `confidence` field on new claims/pages
- [ ] Update `/wiki-lint` to flag pages with no `extracted`-tagged claims

## Phase 4: Concurrency Safety (deferred)

- [ ] Design advisory locking for shared wiki index files, modeled on `lib/hooks/lib/serena.js`'s fail-open pattern — deferred until concrete concurrent-write corruption is observed in `power-mode`/`tackle` usage

## Notes

