---
id: ROADMAP-010
aliases: [ROADMAP-010]
title: Remove Docker Test Harness and GitHub Actions
status: done
created: 2026-09-04
updated: 2026-09-13
owner: David Taylor
derived_from: []
linked_requirements: []
linked_decisions: []
tags: [ci, docker, cleanup]
---

# Roadmap 010: Remove Docker Test Harness and GitHub Actions

## Goal

No GitHub Actions run against this repo — `docker-harness.yml` and `security.yml` are both removed, along with the Docker fresh-machine test harness itself (`test/docker/fresh-machine/`, `test/docker-fresh-machine.test.js`) — the idea turned out to be too much hassle for the value it added. The `/bootstrap deploy` product feature that scaffolds GitHub Actions into consumers' own projects is removed/deprecated too. TASK-073/UAT-073 are trashed, ROADMAP-009 is closed with an honest note that it was reverted rather than completed as designed, and the wiki knowledge page describing the harness is marked retired.

## Phase 1: Remove the Docker harness and all GitHub Actions

- [x] [[TASK-078: Delete the Docker fresh-machine test harness entirely]]
- [x] [[TASK-079: Delete all GitHub Actions workflows from this repo]]

## Phase 2: Remove the /bootstrap deploy feature

- [x] [[TASK-080: Remove the /bootstrap deploy feature code (setup-deployment.sh, its prompt, and bin/cli.js wiring)]]
- [x] [[TASK-081: Remove deployment-strategy.md and strip every deploy/CI doc reference]]

## Phase 3: Close out open work items and wiki records

- [x] [[TASK-082: Trash TASK-073 and UAT-073 (descoped by GitHub Actions removal)]]
- [x] [[TASK-083: Close ROADMAP-009 with an explicit reverted-not-completed note]]
- [x] [[TASK-084: Mark the Docker harness wiki knowledge page as retired]]

## Notes

- Superseded scope: an earlier version of this roadmap's plan only removed the Docker harness's CI wiring (keeping the harness itself for local-only use) — expanded during Q&A to remove the harness entirely per direct user decision ("the docker harness testing idea was a fun idea but it's too much hassle").
- Archived task/UAT records for the harness (TASK-060, TASK-069, TASK-071, TASK-072, TASK-077 and their UATs) are left untouched in `archive/` — they are historical fact (the work did happen and did pass its own UAT at the time), not current state; this roadmap does not retroactively edit them.
