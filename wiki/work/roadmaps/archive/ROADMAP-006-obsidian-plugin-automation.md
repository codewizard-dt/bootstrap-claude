---
id: ROADMAP-006
title: Automate Obsidian + Plugin Setup
status: done
created: 2026-08-13
updated: 2026-08-14
owner: David Taylor
derived_from: [raw/research/obsidian-wiki-linking/index.md, raw/research/obsidian-setup-automation/index.md, ../../knowledge/sources/obsidian-wiki-linking.md, ../../knowledge/sources/obsidian-setup-automation.md]
linked_requirements: []
linked_decisions: []
tags: [obsidian, tooling, automation]
---

# Roadmap 006: Automate Obsidian + Plugin Setup

## Goal

The bootstrap scripts (`setup-project.sh` / `update-project.sh`) automatically offer to install the Obsidian app and the Dataview, Graph Link Types, and Breadcrumbs plugins — opt-in, guarded, sticky-preference-gated — a `wiki/guides/` page documents example Dataview queries, and `/task-audit`'s dependency graph is reconciled with the `rel::[[target]]` convention so it's Breadcrumbs-visualizable. End state: a fresh project gets a fully wired typed-link wiki-viewing experience with zero manual plugin setup.

Derived from [raw/research/obsidian-wiki-linking/index.md](../../../raw/research/obsidian-wiki-linking/index.md), [raw/research/obsidian-setup-automation/index.md](../../../raw/research/obsidian-setup-automation/index.md), and their wiki summaries at [wiki/knowledge/sources/obsidian-wiki-linking.md](../../knowledge/sources/obsidian-wiki-linking.md) and [wiki/knowledge/sources/obsidian-setup-automation.md](../../knowledge/sources/obsidian-setup-automation.md).

## Phase 1: Installer Foundation

- [x] [[TASK-053: Add lib/scripts/install-obsidian.sh (app + plugin auto-install)]]
- [x] [[TASK-054: Add obsidian.installApp + obsidian.plugins keys to bootstrap-prefs-schema.json]]

## Phase 2: Wire-Up & Guide

- [x] [[TASK-055: Wire install-obsidian.sh into run_project_sync()]]
- [x] [[TASK-056: Add optional wiki/guides/ Dataview example-queries page]]

## Phase 3: Task Graph Compatibility

- [x] [[TASK-057: Reconcile /task-audit's Depends-on/Blocks blockquote with rel::[[target]]]]

## Phase 4: Verification

- [x] [[TASK-058: Manually verify guarded Obsidian install end-to-end on at least one platform]]
- [x] [[TASK-059: Confirm setup/update stay non-fatal on Obsidian install failure and declining leaves everything untouched]]

## Notes

