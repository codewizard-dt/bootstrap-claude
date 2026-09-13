---
id: TASK-084
aliases: [TASK-084]
title: "Mark the Docker harness wiki knowledge page as retired"
status: done
created: 2026-09-04
updated: 2026-09-13
depends_on: [TASK-078]
blocks: []
parallel_safe_with: []
uat: "[[UAT-084]]"
tags: [cleanup, wiki]
---

# TASK-084 — Mark the Docker harness wiki knowledge page as retired

implements::[[ROADMAP-010]]
depends_on::[[TASK-078]]

> **Depends on**: [[TASK-078]]

## Objective

`wiki/knowledge/sources/docker-fresh-machine-test-harness.md` is a knowledge-base summary page describing the (now-removed, per TASK-078) Docker harness. Per this repo's contradiction-flagging convention, mark it as describing a retired/removed feature rather than leaving it silently stale — a future `/wiki-query` or reader should not mistake it for current state.

## Approach

Knowledge pages are timeless synthesis and are normally revised in place, not deleted — add a prominent callout rather than removing the page (it remains valid historical/technical documentation of what was built and why).

## Steps

### 1. Add a retirement callout  <!-- agent: general-purpose -->

- [x] `Read` `wiki/knowledge/sources/docker-fresh-machine-test-harness.md`
- [x] `Edit` to insert, immediately after the frontmatter/H1, a callout: `> **Retired (2026-09-04):** The Docker fresh-machine harness this page describes was removed entirely per [[ROADMAP-010]] — the harness was judged too much operational hassle for its value. This page is kept as historical/technical record only; do not treat it as describing current functionality.`
- [x] Check `wiki/index.md` for this page's entry and add a `(retired)` marker to its one-line summary if it does not already convey this

<!-- Updated: 2026-09-13 -->

