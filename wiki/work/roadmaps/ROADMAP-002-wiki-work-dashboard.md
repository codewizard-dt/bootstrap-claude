---
id: ROADMAP-002
title: Live HTML dashboard for wiki/work families
status: active
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

- [ ] Build `lib/scripts/wiki-dashboard-server.js` — zero-dependency static file server with no-cache headers and port fallback

## Phase 2: Dashboard Client

- [ ] Build `lib/scripts/templates/wiki/dashboard.html` — self-contained live dashboard client (parsers, rendering, polling)

## Phase 3: CLI & Distribution

- [ ] Wire a `dashboard` command into `bin/cli.js`
- [ ] Sync `dashboard.html` into projects as an always-refresh scaffold file via `sync-wiki-scaffold.sh`

## Phase 4: Docs

- [ ] Document the `dashboard` command in `README.md`, `lib/scripts/README.md`, and `CLAUDE.md`

## Phase 5: Verification

- [ ] Manually verify dashboard liveness and edge cases against the plan's verification checklist

## Notes

