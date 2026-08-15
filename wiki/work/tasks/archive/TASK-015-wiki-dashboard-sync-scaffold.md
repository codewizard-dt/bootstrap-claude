---
id: TASK-015
aliases: [TASK-015]
title: "Sync dashboard.html into projects as an always-refresh scaffold file"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: [TASK-013]
blocks: []
parallel_safe_with: [TASK-014]
uat: "[[UAT-015]]"
tags: [wiki-tooling, dashboard]
---

# TASK-015 — Sync dashboard.html into projects as an always-refresh scaffold file

## Objective

Wire `lib/scripts/sync-wiki-scaffold.sh` to always deliver the latest `lib/scripts/templates/wiki/dashboard.html` (built in TASK-013) into every target project's `wiki/dashboard.html`, so projects always run the current dashboard client rather than a stale copy-once snapshot. This is part of Phase 3 of ROADMAP-002.

## Approach

- `sync-wiki-scaffold.sh` already has two distinct sync tiers (`lib/scripts/sync-wiki-scaffold.sh:37-48`):
  - **COPY-ONCE** (step 2, `rsync --ignore-existing`): project-owned files, never overwritten once created.
  - **ALWAYS-REFRESH** (step 3): template-owned spec docs (`conventions.md`, per-family `lifecycle.md`) that are `rsync`'d unconditionally every run.
- `dashboard.html` must be **always-refresh** (per ROADMAP-002's Phase 3 item), matching the `conventions.md`/`lifecycle.md` treatment, not the copy-once treatment — a project should always get the newest dashboard client on `bootstrap update`.
- `dashboard.html` lives at `$TEMPLATES/dashboard.html` (i.e. `lib/scripts/templates/wiki/dashboard.html`, same root as `$TEMPLATES` used in the script) — note step 2's copy-once `rsync` already targets this same `$TEMPLATES/` root, so `dashboard.html` must be explicitly excluded from step 2 (alongside the existing `--exclude 'conventions.md'` / `--exclude 'lifecycle.md'`) to avoid being copy-once'd there before step 3 has a chance to always-refresh it.
- Target path in the project: `wiki/dashboard.html` (sits alongside `wiki/index.md`, `wiki/log.md`, etc., not nested in a family dir — it's a cross-family tool, not wiki content).

## Steps

### 1. Update sync-wiki-scaffold.sh <!-- agent: general-purpose -->

- [x] In `lib/scripts/sync-wiki-scaffold.sh`, add `--exclude 'dashboard.html'` to the step 2 copy-once `rsync` command (alongside the existing `conventions.md`/`lifecycle.md` excludes)
- [x] In step 3 (ALWAYS-REFRESH block), add: `rsync -av "$TEMPLATES/dashboard.html" "$PROJECT_DIR/wiki/dashboard.html"`
- [x] Update the comment above step 3 (currently `# 3. ALWAYS-REFRESH: spec docs that remain template-owned; always overwrite`) to also mention `dashboard.html` so the always-refresh set is self-documenting
- [x] Confirm `lib/scripts/templates/wiki/dashboard.html` (from TASK-013) exists at the expected path before considering this done

<!-- Updated: 2026-07-06 -->
<!-- Renumbered: 2026-07-06 — was TASK-004, collided with the pre-existing archived ROADMAP-001 TASK-004. Renumbered to TASK-015 (task-add's next-number scan didn't check archive/; fixed in lib/skills/task-add/SKILL.md Step 4). -->
