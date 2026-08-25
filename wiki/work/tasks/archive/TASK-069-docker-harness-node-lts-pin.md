---
id: TASK-069
aliases: [TASK-069]
title: "Confirm current Node LTS to pin as the Docker harness's ARG NODE_VERSION"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
blocks: [TASK-060]
parallel_safe_with: [TASK-068, TASK-070, TASK-031, TASK-039]
uat: ""
tags: [docker, testing, dev-tooling, research]
---

# TASK-069 — Confirm current Node LTS to pin as the Docker harness's `ARG NODE_VERSION`

implements::[[ROADMAP-009]]

## Objective

TASK-060 step 1 specifies installing Node.js via the NodeSource setup script with `ARG NODE_VERSION` set to "a current LTS (e.g. 20 or 22 — confirm current LTS at implementation time)". `package.json` has no `engines` field pinning a version, so this is a free choice, but it should be made deliberately once (not re-guessed inside TASK-060's own implementation) so the Dockerfile's `ARG` default and this repo's actual CI/dev Node version (if any is documented elsewhere, e.g. `.github/workflows/`) don't quietly diverge.

## Approach

Check the Node.js release schedule for the current Active LTS at implementation time (Node's LTS lines move roughly every October), and cross-check whether this repo's own `.github/workflows/` (if present) or any other CI config already pins a Node version — if so, match it rather than picking independently, since a harness that emulates "a fresh machine running this project's tooling" should use the same Node version this project actually targets elsewhere.

## Steps

### 1. Confirm and record the Node LTS version <!-- agent: general-purpose -->

- [x] Check `.github/workflows/*.yml` (if any exist in this repo) for an existing pinned Node version via `actions/setup-node`; if found, use that version and note it was matched from CI rather than independently chosen.
- [x] If no existing pin exists, determine the current Active LTS Node.js major version (check nodejs.org's release schedule or Context7/web research — do not guess from training-data memory, since LTS lines change annually).
- [x] Record the chosen major version number and rationale (matched-to-CI vs. independently-chosen-current-LTS) in this task's `## Notes` section, so TASK-060 step 1 can set `ARG NODE_VERSION=<N>` directly without re-researching.

<!-- Updated: 2026-08-21 (checked off — see Notes) -->

## Notes

**Decision: `ARG NODE_VERSION=24`** (rationale: independently-chosen-current-LTS, not matched-to-CI — see below).

- **CI check:** `.github/workflows/` contains only `security.yml` (gitleaks secret-scan job). It has no `actions/setup-node` step and sets no `node-version:`. It does set `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`, but that's a GitHub Actions runtime toggle forcing bundled JS actions onto Node 24 internally — it is not an application/CI Node version pin and does not count as one. No `.nvmrc` exists in the repo root. `package.json` has no `engines` field. **Conclusion: no existing Node version pin exists anywhere in this repo to match.**
- **Current Active LTS (confirmed 2026-08-22, not from training-data memory):** Node.js **24** ("Krypton"), released 2025-05-06, entered Active LTS in October 2025, running through ~October 2026 (then Maintenance LTS until April 2027). Node 22 moved to Maintenance LTS as of October 2025. Node 26 is the current "Current" (non-LTS) line and becomes Active LTS in October 2026. Sources: https://endoflife.date/nodejs (fetched 2026-08-22), corroborated by independent web search results citing the same Node 24 Active LTS / Node 22 Maintenance / Node 26 Current breakdown.
- **Rationale:** since no CI pin exists to match, the Dockerfile should pin to today's Active LTS directly rather than inventing a CI match that doesn't exist. TASK-060 step 1 can set `ARG NODE_VERSION=24` directly.

