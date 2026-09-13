---
id: TASK-081
aliases: [TASK-081]
title: "Remove deployment-strategy.md and strip every deploy/CI doc reference"
status: done
created: 2026-09-04
updated: 2026-09-13
depends_on: [TASK-078, TASK-080]
blocks: []
parallel_safe_with: []
uat: "[[UAT-081]]"
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

- [x] `git rm raw/guides/deployment-strategy.md`
<!-- Updated: 2026-09-13 -->

### 2. Strip references in lib/scripts/README.md and lib/prompts/README.md  <!-- agent: general-purpose -->

- [x] `lib/scripts/README.md`: remove the `setup-deployment.sh` table row (TASK-078 already removed the harness's own row in this same file — read the current file state first, don't assume the old content)
- [x] `lib/prompts/README.md`: remove the `setup-deployment.md` table row
<!-- Updated: 2026-09-13 -->

**Discovered during execution (not yet actioned, flagged for follow-up):** `lib/scripts/README.md`'s "Standalone infra scripts (not wired to the CLI)" section documents `setup-runner.sh` and `startup.sh`, which still exist on disk and whose section intro still references the now-removed `deploy` command ("...invoked manually when standing up self-hosted CI infrastructure for a project that used `deploy`."). This is a scope decision (remove the scripts vs. reword the doc) beyond this task's two checkboxes — needs an explicit call, possibly a new task.

### 3. Strip references in CLAUDE.md  <!-- agent: general-purpose -->

- [x] Remove the `npx @codewizard-dt/bootstrap deploy` bullet from the "Setup Workflow" section
- [x] Remove the `lib/scripts/setup-deployment.sh` bullet from "Key Files"
- [x] Remove the `deployment-strategy.md` mention from the `raw/guides/` bullet in "Key Files" (keep the rest of that bullet describing the other guides)
<!-- Updated: 2026-09-13 -->

**Discovered during execution (not part of the three checkboxes, fixed as part of the same doc-cleanup pass):** three other dangling references to the removed `deploy` feature in CLAUDE.md were also stale and were cleaned up — the `setup`/`update` bullets' "does NOT set up deployment" / "does NOT touch `.github/` workflows" qualifiers (meaningless once `deploy` no longer exists to contrast against), the `setup-project.sh` Key Files bullet's "deployment setup is explicit via `deploy`" clause, and the `lib/prompts/` Key Files bullet's "`setup-deployment.md` drives `setup-deployment.sh`" clause (both files already removed by TASK-080). The template "## LLM Wiki" section near the bottom was checked and contains no deploy/CI references — no change needed there.

### 4. Strip legacy migration logic in lib/scripts/sync-wiki-scaffold.sh  <!-- agent: general-purpose -->

- [x] `mcp__serena__search_for_pattern` on `lib/scripts/sync-wiki-scaffold.sh` for `deployment-strategy` — remove the legacy `deployment-strategy.md` migration/removal logic (the block that moves or deletes a legacy `.docs/guides/deployment-strategy.md` based on whether `deploy` artifacts are present) since there is no longer a deploy feature to migrate artifacts for
- [x] Remove the "Optional: run 'npx @codewizard-dt/bootstrap deploy'" suggestion line in `lib/scripts/setup-project.sh`
<!-- Updated: 2026-09-13 -->

`bash -n` passed on both scripts; a follow-up case-insensitive scan for `deploy` on both files returned zero matches.

### 5. Strip references in the root README.md  <!-- agent: general-purpose -->

This is the largest single file to edit — be thorough, `Read` it in full first.

- [x] Remove or rewrite the "GitHub Actions Templates" section (tech stack, dependencies bullets)
- [x] Remove the `DEPLOY`/`WORKFLOWS`/`GHA` nodes from the architecture diagram(s)
- [x] Remove the "CI/CD Pipeline Configuration (GitHub Actions)" section describing security scanning and container build/push workflow templates
- [x] Update the "Deployment" / operations section: this project no longer offers GitHub Actions scaffolding as a feature; publishing to npm is the only release process
- [x] Update the `GITHUB_TOKEN` environment-variable row and any other row that assumes GitHub Actions runs against this repo
- [x] Remove references to `.github/workflows/security.yml` and `.github/workflows/build.yml` running or existing
- [x] Update the Observability/Testing sections that cite "GitHub Actions logs" as an operational signal or "Security workflow should pass in GitHub Actions" as a check
<!-- Updated: 2026-09-13 -->

**Discovered during execution (flagged, not actioned):** in the root README's architecture mermaid diagram, the `PROMPTS` (`lib/prompts/`) and `RAW` (`raw/guides/`) nodes now have no inbound/outbound edges since their only edges came from the removed `DEPLOY` node. Left as orphaned nodes per the checkbox's literal scope (remove only DEPLOY/WORKFLOWS/GHA); a true fix would need new edges reflecting `lib/prompts/`'s actual current consumers (`migrate-project.sh`, `setup-strict-typechecks.sh`), which isn't in this diagram — worth a follow-up if the diagram should be fully reconnected.

### 6. Verify  <!-- agent: general-purpose -->

- [x] `mcp__serena__search_for_pattern` across the repo (excluding `wiki/log.md`, `wiki/hot.md`, `wiki/work/*/archive/`, and this roadmap/task's own files) for `setup-deployment`, `deployment-strategy`, and `bootstrap deploy` — confirm no remaining live reference describes the feature as if it still exists
- [x] Run `npm test` and confirm the full suite still passes
<!-- Updated: 2026-09-13 -->

Repo-wide sweep found and fixed 5 additional stale live references beyond the 6 files edited in steps 2-5: `lib/scripts/migrate-project.sh`, `wiki/work/tasks/TASK-031-sandbox-tier3.md`, `wiki/knowledge/concepts/permission-mode-control-survival.md`, `wiki/knowledge/sources/bypass-mode-enforcement.md`, and `.serena/memories/project/overview.md`. Also fixed one unrelated line-number citation-pin drift caused by the sync-wiki-scaffold.sh edit in step 4 (`lib/scripts/templates/bootstrap-prefs-schema.json` + `test/bootstrap-prefs.test.js` `CITATION_PINS`). Final `npm test`: 409/409 passing.
