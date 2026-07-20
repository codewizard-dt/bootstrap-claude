---
id: TASK-018
title: "Upgrade dashboard.html dark mode to a full explicit-override toggle"
status: done
created: 2026-07-06
updated: 2026-07-06
depends_on: []
blocks: []
parallel_safe_with: []
uat: ""
tags: [wiki-tooling, dashboard, theming]
---

# TASK-018 — Upgrade dashboard.html dark mode to a full explicit-override toggle

## Objective

`lib/scripts/templates/wiki/dashboard.html` (shipped by the now-archived TASK-002/ROADMAP-002) currently implements dark mode as a bare `@media (prefers-color-scheme: dark)` swap only — it satisfied that task's stated minimum but has no manual override. Upgrade it to the full tri-state toggle (`localStorage` explicit choice > OS `prefers-color-scheme` > default) designed in `raw/research/dark-mode-theme/index.md`, so a developer whose OS theme doesn't match their preference for this one tool has a way to override it.

## Approach

Full spec, palette table, and rationale already researched — see `raw/research/dark-mode-theme/index.md` and `sources.md`. Summary:

- Keep the existing `:root` (light) + `@media (prefers-color-scheme: dark)` variables as the passive fallback — do not remove them, they cover the pre-script/no-JS instant.
- Add `:root[data-theme="light"] { ... }` / `:root[data-theme="dark"] { ... }` blocks *after* the media query in source order, using the dashboard's *existing* variable names (`--bg`, `--text`, `--text-muted`, `--text-faint`, `--accent`, `--accent-contrast`, etc. — check the current `:root`/media-query block in `dashboard.html` for the full list before writing the override blocks, since the shipped implementation may use different variable names than the research doc's illustrative palette table).
- Add an inline `<script>` near the top of `<body>` (before the rest of the page paints): read `localStorage.getItem('dashboard-theme')` in a `try/catch`; if present, `document.documentElement.setAttribute('data-theme', saved)` immediately; if absent, leave the attribute unset (media query governs) and attach a `matchMedia('(prefers-color-scheme: dark)')` change listener so a live OS flip is reflected while no explicit choice exists.
- Add a toggle `<button aria-label="Switch color theme">` in the static header — outside the panel container that `renderFamily()`/the 5s polling loop regenerates, so a poll tick never wipes it out or its listener.
- On click: compute the currently-resolved theme (attribute if set, else `matchMedia` result), flip it, `setAttribute('data-theme', next)` + `localStorage.setItem('dashboard-theme', next)` (wrapped in `try/catch`).
- Add `<meta name="color-scheme" content="light dark">` to `<head>` if not already present, so native scrollbars/form controls theme correctly.
- Gate any color-transition animation behind `@media (prefers-reduced-motion: no-preference)`.

## Steps

### 1. Add the explicit-override CSS layer <!-- agent: general-purpose -->

- [x] Read the current `:root` / `@media (prefers-color-scheme: dark)` block in `lib/scripts/templates/wiki/dashboard.html` and enumerate its actual variable names
- [x] Add `:root[data-theme="light"]` and `:root[data-theme="dark"]` blocks after the existing media query, mirroring those same variable names/values
- [x] Add `<meta name="color-scheme" content="light dark">` to `<head>`

### 2. Add the toggle button and resolution script <!-- agent: general-purpose -->

- [x] Add a `<button aria-label="Switch color theme">` in the static header markup (not inside the panel container the polling loop regenerates)
- [x] Add an inline `<script>` that resolves and applies the saved/system theme before the panels first render, wrapping `localStorage` access in `try/catch`
- [x] Wire the button's click handler to flip the resolved theme, set `data-theme`, and persist to `localStorage`
- [x] Attach a `matchMedia('(prefers-color-scheme: dark)')` change listener that updates the page live only when no explicit `data-theme` choice is set

### 3. Verify <!-- agent: general-purpose -->

- [x] Confirm the toggle survives multiple polling cycles (button + listener untouched after several 5s ticks)
- [x] Confirm explicit choice persists across a page reload and overrides a live OS theme flip
- [x] Confirm clearing `localStorage` reverts to live OS-tracking behavior
- [x] Spot-check contrast (devtools contrast checker) on text/background pairs in both themes
