---
id: ROADMAP-002
title: Live HTML dashboard for wiki/work families
status: done
created: 2026-07-06
updated: 2026-07-06
owner: David Taylor
linked_requirements: []
linked_decisions: []
tags: [wiki-tooling, dashboard]
---

# Roadmap 002: Live HTML dashboard for wiki/work families

## Goal

Ship a zero/near-zero-dependency, always-current HTML dashboard visualizing the six `wiki/work/` families (requirements, decisions, roadmaps, tasks, uat, bugs), served locally via `bootstrap dashboard`, and synced to every project via the wiki scaffold.

Derived from a plan-mode design session (2026-07-06) that researched `wiki/work/` frontmatter conventions and this repo's zero-dependency Node scripting conventions before settling on the approach: a static, dependency-free client that polls each family's `index.md`/`archive/index.md` via `fetch({cache: 'no-store'})`, served by a builtin-only Node static file server. Full design rationale, rejected alternatives, parser/regex details, and a manual verification checklist live in the plan file this roadmap was created from.

## Phase 1: Static Server

- [x] [[TASK-012: Build wiki-dashboard-server.js zero-dependency static file server]]

## Phase 2: Dashboard Client

- [x] [[TASK-013: Build dashboard.html self-contained live dashboard client]]

## Phase 3: CLI & Distribution

- [x] [[TASK-014: Wire dashboard command into bin/cli.js]]
- [x] [[TASK-015: Sync dashboard.html into projects as an always-refresh scaffold file]]

## Phase 4: Docs

- [x] [[TASK-016: Document the dashboard command in README.md, lib/scripts/README.md, and CLAUDE.md]]

## Phase 5: Verification

- [x] [[TASK-017: Manually verify dashboard liveness and edge cases]]

## Notes

> **Renumbered 2026-07-06**: this roadmap's tasks were originally created as TASK-001 through TASK-006 / UAT-001 through UAT-006, colliding with the pre-existing archived ROADMAP-001 tasks of the same numbers (task-add's next-number scan only checked the active `wiki/work/tasks/` directory, not `archive/`). Renumbered to TASK-012–017 / UAT-012–017. Root cause fixed in `lib/skills/task-add/SKILL.md` (and, proactively, `roadmap-create`, `decision-create`, `req-create`, which had the same bug).

