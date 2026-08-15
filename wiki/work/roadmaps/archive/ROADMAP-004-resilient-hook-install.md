---
id: ROADMAP-004
aliases: [ROADMAP-004]
title: Resilient hook install + automated settings.json hooks wiring
status: done
created: 2026-07-31
updated: 2026-07-31
owner: David Taylor
linked_requirements: []
linked_decisions: []
tags: [install, hooks, settings]
---

# Roadmap 004: Resilient hook install + automated settings.json hooks wiring

## Goal

A fresh machine or interrupted install always ends up with hook scripts both copied and registered: local install steps (hooks, skills, settings merges) run before the failure-prone MCP step, MCP failures warn-and-continue instead of aborting, and the settings.json hooks wiring is auto-merged from a canonical template with "template owns its blocks" semantics — so new and updated repo hooks flow through every `update`, with tests guarding the template↔hooks bijection.

Implementation detail lives in the approved plan at `~/.claude/plans/ok-now-parallel-cerf.md`.

## Phase 1: Wiring Engine

- [x] [[TASK-032: Extract canonical hooks wiring from lib/hooks/README.md into lib/scripts/templates/settings-hooks.json]]
- [x] [[TASK-033: Build lib/scripts/merge-settings-hooks.js — "template owns its blocks" hooks-wiring merge]]
- [x] [[TASK-034: Add test/settings-hooks.test.js — template invariants and merge behavior coverage]]

## Phase 2: Install Flow

- [x] [[TASK-035: Reorder install-global.sh — local steps first, MCPs last and guarded, invoke hooks-wiring merge]]
- [x] [[TASK-036: Reorder and guard run_project_sync in lib.sh so MCP failures can't abort hook install or wiki sync]]

## Phase 3: Docs & Release

- [x] [[TASK-037: Document automated hooks wiring — lib/hooks/README.md is no longer a manual-paste instruction sheet]]
- [x] [[TASK-038: Fake-HOME end-to-end verification of resilient hook install + hooks wiring, and the minor release]]

## Notes

