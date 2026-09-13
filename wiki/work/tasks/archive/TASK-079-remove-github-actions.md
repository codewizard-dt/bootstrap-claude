---
id: TASK-079
aliases: [TASK-079]
title: "Delete all GitHub Actions workflows from this repo"
status: done
created: 2026-09-04
updated: 2026-09-13
depends_on: []
blocks: [TASK-082]
parallel_safe_with: [TASK-078, TASK-080]
uat: "[[UAT-082]]"
tags: [ci, cleanup]
---

# TASK-079 — Delete all GitHub Actions workflows from this repo

implements::[[ROADMAP-010]]
blocks::[[TASK-082]]

> **Blocks**: [[TASK-082]]

## Objective

Per ROADMAP-010, no GitHub Actions should run against this repo at all. Remove `.github/workflows/docker-harness.yml`, `.github/workflows/security.yml` (Gitleaks secret scanning), and the root `.gitleaks.toml` that `security.yml` depends on.

## Approach

Plain deletion via `git rm`. This is independent of TASK-078 (harness deletion) and TASK-080 (deploy feature removal) — no shared files, safe to run in parallel with either.

## Steps

### 1. Delete the workflow files and gitleaks config  <!-- agent: general-purpose -->

- [x] `git rm .github/workflows/docker-harness.yml`
- [x] `git rm .github/workflows/security.yml`
- [x] `git rm .gitleaks.toml`
- [x] Confirm `.github/workflows/` has no remaining files (an empty directory is fine — git does not track empty dirs)

<!-- Updated: 2026-09-03 -->


### 2. Verify nothing else references the removed workflows  <!-- agent: general-purpose -->

- [x] `mcp__serena__search_for_pattern` across the repo (excluding `wiki/log.md`, `wiki/hot.md`, and `wiki/work/*/archive/`) for `docker-harness.yml`, `security.yml`, and `.gitleaks.toml` — confirm no live code or non-archival doc still references them as if they exist

Fixed one orphaned stale reference in scope: `package.json` `"files"` array still listed `.github/` and `.gitleaks.toml`; removed both. All other hits (`security.yml`/`.gitleaks.toml` in README.md, CLAUDE.md, lib/scripts/README.md, lib/prompts/README.md, raw/guides/deployment-strategy.md; `docker-harness.yml`/`.gitleaks.toml` in bin/cli.js) belong to TASK-080 or TASK-081's explicit scope and were left untouched. `.serena/memories/project/overview.md` flagged as ambiguous (not claimed by any task) — left alone per "err on not touching."

<!-- Updated: 2026-09-03 -->

