---
id: TASK-081
aliases: [TASK-081]
title: "Remove deployment-strategy.md and strip every deploy/CI doc reference"
status: in-progress
created: 2026-09-04
updated: 2026-09-04
depends_on: [TASK-078, TASK-080]
blocks: []
parallel_safe_with: []
uat: ""
tags: [cleanup, docs]
---

# TASK-081 — Remove deployment-strategy.md and strip every deploy/CI doc reference

implements::[[ROADMAP-010]]
depends_on::[[TASK-078]]
depends_on::[[TASK-080]]

> **Depends on**: [[TASK-078]], [[TASK-080]]

## Objective

Complete ROADMAP-010 Phase 2's documentation half: remove `raw/guides/deployment-strategy.md` (the guide the removed `deploy` feature used to copy into consumer projects) and strip every remaining doc reference to the `/bootstrap deploy` feature, GitHub Actions scaffolding, and this repo's own now-removed workflows. Runs after TASK-078 (harness removed) and TASK-080 (deploy script/CLI removed) so the docs describe the post-removal state accurately, and because this task also edits `lib/scripts/README.md` — the same file TASK-078 edits — sequencing avoids a concurrent-edit collision on it.

## Approach

This is a documentation-only pass across several files. Read each file fully before editing (do not guess at exact text) and use `Edit`, never `sed`/sh redirection, per `wiki/guides/mcp-tools.md`.

## Steps

### 1. Remove the deployment-strategy guide  <!-- agent: general-purpose -->

- [ ] `git rm raw/guides/deployment-strategy.md`

### 2. Strip references in lib/scripts/README.md and lib/prompts/README.md  <!-- agent: general-purpose -->

- [ ] `lib/scripts/README.md`: remove the `setup-deployment.sh` table row (TASK-078 already removed the harness's own row in this same file — read the current file state first, don't assume the old content)
- [ ] `lib/prompts/README.md`: remove the `setup-deployment.md` table row

### 3. Strip references in CLAUDE.md  <!-- agent: general-purpose -->

- [ ] Remove the `npx @codewizard-dt/bootstrap deploy` bullet from the "Setup Workflow" section
- [ ] Remove the `lib/scripts/setup-deployment.sh` bullet from "Key Files"
- [ ] Remove the `deployment-strategy.md` mention from the `raw/guides/` bullet in "Key Files" (keep the rest of that bullet describing the other guides)

### 4. Strip legacy migration logic in lib/scripts/sync-wiki-scaffold.sh  <!-- agent: general-purpose -->

- [ ] `mcp__serena__search_for_pattern` on `lib/scripts/sync-wiki-scaffold.sh` for `deployment-strategy` — remove the legacy `deployment-strategy.md` migration/removal logic (the block that moves or deletes a legacy `.docs/guides/deployment-strategy.md` based on whether `deploy` artifacts are present) since there is no longer a deploy feature to migrate artifacts for
- [ ] Remove the "Optional: run 'npx @codewizard-dt/bootstrap deploy'" suggestion line in `lib/scripts/setup-project.sh`

### 5. Strip references in the root README.md  <!-- agent: general-purpose -->

This is the largest single file to edit — be thorough, `Read` it in full first.

- [ ] Remove or rewrite the "GitHub Actions Templates" section (tech stack, dependencies bullets)
- [ ] Remove the `DEPLOY`/`WORKFLOWS`/`GHA` nodes from the architecture diagram(s)
- [ ] Remove the "CI/CD Pipeline Configuration (GitHub Actions)" section describing security scanning and container build/push workflow templates
- [ ] Update the "Deployment" / operations section: this project no longer offers GitHub Actions scaffolding as a feature; publishing to npm is the only release process
- [ ] Update the `GITHUB_TOKEN` environment-variable row and any other row that assumes GitHub Actions runs against this repo
- [ ] Remove references to `.github/workflows/security.yml` and `.github/workflows/build.yml` running or existing
- [ ] Update the Observability/Testing sections that cite "GitHub Actions logs" as an operational signal or "Security workflow should pass in GitHub Actions" as a check

### 6. Verify  <!-- agent: general-purpose -->

- [ ] `mcp__serena__search_for_pattern` across the repo (excluding `wiki/log.md`, `wiki/hot.md`, `wiki/work/*/archive/`, and this roadmap/task's own files) for `setup-deployment`, `deployment-strategy`, and `bootstrap deploy` — confirm no remaining live reference describes the feature as if it still exists
- [ ] Run `npm test` and confirm the full suite still passes
