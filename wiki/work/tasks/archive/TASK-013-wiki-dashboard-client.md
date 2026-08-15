---
id: TASK-013
aliases: [TASK-013]
title: "Build dashboard.html self-contained live dashboard client"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: []
parallel_safe_with: [TASK-012]
uat: "[[UAT-013]]"
tags: [wiki-tooling, dashboard]
---

# TASK-013 — Build dashboard.html self-contained live dashboard client

## Objective

Create `lib/scripts/templates/wiki/dashboard.html`, a single self-contained HTML file (inline CSS + JS, zero external dependencies, zero build step) that visualizes the six `wiki/work/` families — requirements, decisions, roadmaps, tasks, uat, bugs — by polling each family's `index.md` and `archive/index.md` via `fetch(url, {cache: 'no-store'})`. This is Phase 2 of ROADMAP-002. It is served by the static server built in TASK-012 (`GET /` in that server serves this exact file) but has no build-time or runtime dependency on TASK-012's code — it is a static asset the server merely serves, so the two tasks are independent and collision-safe.

## Approach

- Single `.html` file: `<style>` and `<script>` inline, no external CDN scripts/fonts/stylesheets — matches the same self-contained constraint as Claude Artifacts in this repo's conventions (see `artifact-design` skill guidance) even though this isn't an Artifact; the reasoning (must work with zero network dependencies) still applies since this ships inside an npm package with no internet guarantee at runtime.
- Data source: each family directory (`wiki/work/{requirements,decisions,roadmaps,tasks,uat,bugs}/`) has an `index.md` (active items) and an `archive/index.md` (terminal items). Fetch both per family from `/wiki/work/<family>/index.md` and `/wiki/work/<family>/archive/index.md` (paths relative to the server root wired in TASK-012).
- Parsing: each `index.md` is a markdown bullet list (`- [TITLE](path) — summary` per family conventions in `wiki/conventions.md`). Write a small regex-based line parser — no markdown library dependency. Handle "none yet" placeholder bodies gracefully (render as empty state, not an error).
- Polling: re-fetch every family's files on an interval (e.g. every 5s) using `cache: 'no-store'` so the dashboard reflects live edits to the wiki without a page reload. Debounce/guard against overlapping fetches if a poll is slow.
- Rendering: one section/panel per family, showing active items (from `index.md`) and a collapsed/secondary view of archived items (from `archive/index.md`). Show a family's item count. No routing library — plain DOM manipulation (`document.createElement` / `innerHTML` templating) is fine for this scope.
- Theme: support light/dark via `prefers-color-scheme` media query at minimum (this repo's Artifact convention favors theme-awareness; apply the same care here since it's a long-running local tool a developer will have open).
- Error handling: if a fetch 404s (e.g. family not yet scaffolded in an older project), show an empty/"not found" state for that family rather than breaking the whole page.

## Steps

### 1. Build the client shell and styles <!-- agent: general-purpose -->

- [x] Create `lib/scripts/templates/wiki/dashboard.html` with a `<!doctype html>` document, inline `<style>` block
  - [x] Layout: a grid/flex layout with six panels, one per family (requirements, decisions, roadmaps, tasks, uat, bugs)
  - [x] Light/dark theme via `@media (prefers-color-scheme: dark)`
  - [x] Header showing "last updated" timestamp and a manual refresh button
<!-- Updated: 2026-07-06 — DOM contract: section.panel[data-family], [data-count], [data-active], [data-archive], [data-archive-count], [data-archive-list]; #last-updated, #refresh-btn, #status-banner; FAMILIES array + stub fns fetchWikiData/renderPanels/updateTimestamp/setBanner/refresh/startPolling/init; POLL_INTERVAL_MS=5000 -->

### 2. Implement fetch + parse logic <!-- agent: general-purpose -->

- [x] Inline `<script>`: a `fetchFamily(familyName)` function that fetches `/wiki/work/<familyName>/index.md` and `/wiki/work/<familyName>/archive/index.md` with `{cache: 'no-store'}`, handling 404s gracefully
- [x] A `parseIndexMarkdown(text)` function using regex to extract bullet items (`- [Title](path) — summary` and any status/date suffix conventions used across families — check one real example, e.g. `wiki/work/tasks/index.md`'s entry format comment, before finalizing the regex)
- [x] Handle the `_(none yet)_` empty-state placeholder as zero items, not a parse error
<!-- Updated: 2026-07-06 — item shape {title,path,summary,status}; fetchFamily→{active,archived} (never rejects), fetchWikiData→{[family]:{active,archived}} keyed by FAMILIES, parseIndexMarkdown pure/sync; helper fetchIndexFile added -->

### 3. Implement rendering and polling loop <!-- agent: general-purpose -->

- [x] A `renderFamily(familyName, activeItems, archivedItems)` function that updates that family's panel DOM
- [x] A polling loop (`setInterval`, ~5000ms) that re-fetches and re-renders all six families, updating the "last updated" timestamp
- [x] Guard against overlapping polls (skip a tick if the previous fetch cycle hasn't resolved)
- [x] Wire the manual refresh button to trigger an immediate out-of-cycle poll
<!-- Updated: 2026-07-06 — renderPanels→renderFamily(exact sig); XSS-safe via textContent/createElement; refreshInFlight overlap guard cleared in finally; init() immediate first paint + setInterval; helpers splitTitle/buildItemRow/buildArchiveRow/emptyNote; node --check OK -->
<!-- Renumbered: 2026-07-06 — was TASK-002, collided with the pre-existing archived ROADMAP-001 TASK-002. Renumbered to TASK-013 (task-add's next-number scan didn't check archive/; fixed in lib/skills/task-add/SKILL.md Step 4). -->
