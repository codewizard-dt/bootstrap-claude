---
id: ROADMAP-012
aliases: [ROADMAP-012]
title: Sandbox Config Scaffolding and Local Usage Visibility
status: active
created: 2026-09-13
updated: 2026-09-19
owner: David Taylor
derived_from: [claude-code-ecosystem-2026]
linked_requirements: []
linked_decisions: []
tags: [sandbox, security, cost-tracking, tooling]
---

# Roadmap 012: Sandbox Config Scaffolding and Local Usage Visibility

## Goal

Close two of the concrete gaps the Claude Code ecosystem research found against this repo's own stated intentions: an opt-in native `/sandbox` config step becomes available in `install-global.sh` / `setup-project.sh` (closing the "guardrail, not a boundary" gap `lib/hooks/README.md` already names four times), and a local, offline usage-report skill exists — surfaced in the wiki dashboard — so the existing per-skill haiku/sonnet/opus model-tier curation can actually be verified rather than assumed.

## Phase 1: Sandbox Config Scaffolding

- [ ] [[TASK-0107: Add an opt-in sandbox-config prompt to install-global.sh / setup-project.sh]]

## Phase 2: Local Usage Report

- [x] [[TASK-0108: Create a /usage-report skill that locally parses Claude Code session logs for per-project token/cost rollups]]
- [ ] [[TASK-0109: Surface the /usage-report JSON in the wiki dashboard (read-only /api/usage endpoint + #/usage panel)]]

## Notes

- Originated from `/research other harnesses, skill libraries, hook implementations, etc and identify potential new features` this session (not a REQ/DEC): [Claude Code Ecosystem Survey](../../knowledge/sources/claude-code-ecosystem-2026.md) — the 3rd candidate from that report (a native `.claude-plugin/marketplace.json` distribution path) was deliberately excluded from this roadmap and routed to `/decision-create` instead, given its scope (dual distribution paths, versioning semantics, `bootstrap-prefs.js`/deny-list interaction).
- Worktree isolation (`isolation: "worktree"` for `now`/`tackle`/`power-mode` subagent spawns) was also a candidate from the same research but was explicitly dropped from this roadmap's scope during Q&A — not covered here.
- Phase 2's sandbox-hardening goal is deliberately kept separate from the existing [TASK-031 — Tier 3: adopt /sandbox](../tasks/TASK-031-sandbox-tier3.md) (`todo`), which is narrowly scoped to closing the settings.json script-write path that no hook can parse. That task addresses a different, already-filed concern and is referenced here, not merged or superseded.
- All items are inline placeholders (no task files exist yet) — `/roadmap-next` will create them automatically.
