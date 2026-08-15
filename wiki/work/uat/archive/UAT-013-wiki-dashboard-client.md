---
id: UAT-013
aliases: [UAT-013]
title: "UAT: Build dashboard.html self-contained live dashboard client"
status: skipped
task: TASK-013
created: 2026-07-06
updated: 2026-07-06
---

# UAT-013 — UAT: Build dashboard.html self-contained live dashboard client

implements::[[TASK-013]]

> **Source task**: [[TASK-013]]
> **Generated**: 2026-07-06

Scope: verifies only what TASK-013 introduced — the self-contained `lib/scripts/templates/wiki/dashboard.html` client (shell + styles, fetch/parse layer, render + polling loop). The STATIC and EDGE cases below run headlessly and deterministically from the repo root. The UI cases require the TASK-012 server plus a browser; full manual browser verification of the whole dashboard feature is owned separately by TASK-017.

---

## Prerequisites

- [ ] Commands run from the repository root (`/Users/davidtaylor/Repositories/bootstrap-claude`)
- [ ] Node.js available on `PATH` (for the STATIC/EDGE `node` checks)
- [ ] For UI cases only: the TASK-012 server is running — `node lib/scripts/wiki-dashboard-server.js` from the repo root — and the dashboard is open at `http://localhost:4317/`
- [ ] For UI cases only: a browser (or Playwright) able to load the page and honour `prefers-color-scheme`

---

## Test Cases

### UAT-STATIC-001: File is a single self-contained HTML asset (zero external dependencies)
- **Description**: The client must ship with no external CDN scripts, stylesheets, or fonts — it runs inside an npm package with no runtime internet guarantee.
- **Steps**:
  1. Run the command below; it searches the file for any external-resource reference.
- **Command**:
  ```bash
  grep -nE '<script[^>]+src=|<link |href="https?:|@import|cdnjs|googleapis|unpkg|jsdelivr' lib/scripts/templates/wiki/dashboard.html
  ```
- **Expected Result**: No matches (grep exits non-zero, prints nothing) — confirms all CSS/JS is inline and no external host is referenced.
- **Repeatable Unit Test**: Not applicable: static file-shape assertion, not business logic; the grep itself is the repeatable check.
- [x] Pass <!-- 2026-07-06 -->

### UAT-STATIC-002: Inline script is syntactically valid JavaScript
- **Description**: The entire inline `<script>` body must compile cleanly.
- **Steps**:
  1. Run the command; it extracts the inline script and compiles it with `new Function` (compiles without executing `init()`).
- **Command**:
  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync('lib/scripts/templates/wiki/dashboard.html','utf8');const m=h.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('SYNTAX OK')"
  ```
- **Expected Result**: Prints `SYNTAX OK` and exits 0. Any syntax error throws and exits non-zero.
- **Repeatable Unit Test**: Not applicable: compile-check of an inline HTML script, no importable module.
- [x] Pass <!-- 2026-07-06 -->

### UAT-STATIC-003: Exactly six family panels present, one per wiki/work family
- **Description**: The layout must expose one `section.panel[data-family]` per family (requirements, decisions, roadmaps, tasks, uat, bugs).
- **Steps**:
  1. Run the command counting the panel section elements.
- **Command**:
  ```bash
  grep -c 'section class="panel" data-family=' lib/scripts/templates/wiki/dashboard.html
  ```
- **Expected Result**: Prints `6`.
- **Repeatable Unit Test**: Not applicable: static DOM-shape assertion.
- [x] Pass <!-- 2026-07-06 -->

### UAT-STATIC-004: Polling uses no-store fetch at a 5000ms interval
- **Description**: The live-refresh contract requires `cache: 'no-store'` fetches and a 5s poll interval.
- **Steps**:
  1. Run the command; it surfaces both the no-store fetch option and the poll-interval constant.
- **Command**:
  ```bash
  grep -nE "cache: 'no-store'|POLL_INTERVAL_MS = 5000" lib/scripts/templates/wiki/dashboard.html
  ```
- **Expected Result**: Output includes both a line with `cache: 'no-store'` and a line with `POLL_INTERVAL_MS = 5000`.
- **Repeatable Unit Test**: Not applicable: static source assertion.
- [x] Pass <!-- 2026-07-06 -->

### UAT-STATIC-005: Required header/DOM hooks present
- **Description**: The header must expose the last-updated element, refresh button, and status banner the script wires to.
- **Steps**:
  1. Run the command checking for the three stable ids.
- **Command**:
  ```bash
  grep -nE 'id="last-updated"|id="refresh-btn"|id="status-banner"' lib/scripts/templates/wiki/dashboard.html
  ```
- **Expected Result**: Three matching lines, one for each id.
- **Repeatable Unit Test**: Not applicable: static DOM-shape assertion.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-001: parseIndexMarkdown parses a standard family bullet into {title, path, summary, status}
- **Scenario**: A normal index line `- [TASK-001 — Build server](TASK-001-slug.md) — a summary · in-progress` must parse into all four fields, splitting the em-dash summary and the middle-dot status suffix.
- **Steps**: Run the command; it extracts `parseIndexMarkdown` from the file and evaluates it against the sample line.
- **Command**:
  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync('lib/scripts/templates/wiki/dashboard.html','utf8');const m=h.match(/function parseIndexMarkdown[\s\S]*?return items;\n {4}\}/);eval(m[0]);console.log(JSON.stringify(parseIndexMarkdown('- [TASK-001 — Build server](TASK-001-slug.md) — a summary · in-progress')))"
  ```
- **Expected Result**: `[{"title":"TASK-001 — Build server","path":"TASK-001-slug.md","summary":"a summary","status":"in-progress"}]`
- **Repeatable Unit Test**: Blocked: `parseIndexMarkdown` is embedded in the single self-contained HTML file (TASK-013's zero-build, zero-dependency, single-file constraint) with no module export, and the repo has no wired test runner (`package.json` `test` is a stub, no devDependencies, no existing test files). A permanent unit test would require either extracting the parser into an importable module (violating the single-file constraint) or standing up new test infrastructure. This UAT command is the deterministic repeatable check in the interim.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-002: Empty-state placeholder and prose yield zero items, not a parse error
- **Scenario**: A family index containing only the `_(none yet)_` placeholder (or prose, no bullet-links) must parse to an empty array.
- **Steps**: Run the command against a placeholder + a prose line.
- **Command**:
  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync('lib/scripts/templates/wiki/dashboard.html','utf8');const m=h.match(/function parseIndexMarkdown[\s\S]*?return items;\n {4}\}/);eval(m[0]);console.log(JSON.stringify(parseIndexMarkdown('_(none yet)_\nSome prose line, not a bullet.')))"
  ```
- **Expected Result**: `[]`
- **Repeatable Unit Test**: Blocked: same blocker as UAT-EDGE-001 (parser embedded in single-file HTML, no wired test runner).
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-003: Bare bullet-link with no summary or status still parses
- **Scenario**: A minimal line `- [DEC-0001 — Wiki model](DEC-0001-wiki-model.md)` (no em-dash tail) must parse with `summary: null` and `status: null`.
- **Steps**: Run the command against the bare bullet.
- **Command**:
  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync('lib/scripts/templates/wiki/dashboard.html','utf8');const m=h.match(/function parseIndexMarkdown[\s\S]*?return items;\n {4}\}/);eval(m[0]);console.log(JSON.stringify(parseIndexMarkdown('- [DEC-0001 — Wiki model](DEC-0001-wiki-model.md)')))"
  ```
- **Expected Result**: `[{"title":"DEC-0001 — Wiki model","path":"DEC-0001-wiki-model.md","summary":null,"status":null}]`
- **Repeatable Unit Test**: Blocked: same blocker as UAT-EDGE-001 (parser embedded in single-file HTML, no wired test runner).
- [x] Pass <!-- 2026-07-06 -->

### UAT-UI-001: Served dashboard renders six panels and populates live counts
- **Page**: `http://localhost:4317/`
- **Description**: With the TASK-012 server running from the repo root, the dashboard loads and each family panel shows its real active-item count and items fetched from `/wiki/work/<family>/index.md`.
- **Steps**:
  1. Start the server: `node lib/scripts/wiki-dashboard-server.js` from the repo root.
  2. Open `http://localhost:4317/` in a browser.
  3. Observe the six panels (Requirements, Decisions, Roadmaps, Tasks, UAT, Bugs).
  4. Compare the Tasks panel's count and listed items against the real `wiki/work/tasks/index.md`.
- **Expected Result**: Six panels render; the Tasks panel count matches the number of active bullets in `wiki/work/tasks/index.md` and lists those task ids/titles; empty families show "No active items." rather than an error.
- **Repeatable Unit Test**: Not applicable: browser rendering + live HTTP wiring.
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-07-06 -->

### UAT-UI-002: Manual refresh button triggers an immediate out-of-cycle refetch
- **Page**: `http://localhost:4317/`
- **Description**: Clicking Refresh re-fetches immediately and updates the "last updated" timestamp.
- **Steps**:
  1. With the dashboard open, note the header "Last updated:" time.
  2. Click the **Refresh** button.
  3. Observe the timestamp and the button state.
- **Expected Result**: The "last updated" time updates to the current local time on click; the button briefly shows its loading state (`data-loading`) and re-enables; panels re-render without a full page reload.
- **Repeatable Unit Test**: Not applicable: browser interaction + timing.
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-07-06 -->

### UAT-UI-003: Live polling reflects a wiki edit within ~5s without reload
- **Page**: `http://localhost:4317/`
- **Description**: The 5s poll loop picks up edits to a family index file with no page reload.
- **Steps**:
  1. With the dashboard open, add a new bullet line to `wiki/work/bugs/index.md` (or any family index) following the `- [ID — Title](slug.md) — summary · status` format, and save.
  2. Wait up to ~5 seconds without reloading the page.
  3. Observe the corresponding panel.
  4. Revert the edit afterwards.
- **Expected Result**: Within one poll interval (~5s) the edited family's count increments and the new item appears, with no manual reload.
- **Repeatable Unit Test**: Not applicable: live filesystem→server→poll integration.
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-07-06 -->

### UAT-UI-004: A missing/404 family degrades to an empty state, not a broken page
- **Page**: `http://localhost:4317/`
- **Description**: If a family's `index.md` (or `archive/index.md`) 404s, that panel shows empty rather than breaking the whole dashboard.
- **Steps**:
  1. Confirm archive index files are typically absent for some families (a `GET /wiki/work/<family>/archive/index.md` may 404).
  2. Load the dashboard and expand a family's "Archived" section whose archive index does not exist.
  3. Observe the other panels remain functional.
- **Expected Result**: The archive section shows "Nothing archived." (count 0) with no console-fatal error; all other panels continue to render and poll normally.
- **Repeatable Unit Test**: Not applicable: browser + HTTP 404 handling. (Parser/fetch degradation-to-empty is covered deterministically by UAT-EDGE-002.)
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-07-06 -->

### UAT-UI-005: Dark theme applies under prefers-color-scheme: dark
- **Page**: `http://localhost:4317/`
- **Description**: The dashboard is theme-aware via `@media (prefers-color-scheme: dark)`.
- **Steps**:
  1. Set the OS/browser to dark mode (or emulate `prefers-color-scheme: dark` in devtools).
  2. Load or reload `http://localhost:4317/`.
- **Expected Result**: The page uses the dark palette (dark background `#0e1117`, light text) rather than the light default; switching to light mode restores the light palette.
- **Repeatable Unit Test**: Not applicable: visual/CSS media-query rendering.
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-07-06 -->
<!-- Renumbered: 2026-07-06 — was UAT-002/TASK-002, collided with the pre-existing archived ROADMAP-001 UAT-002/TASK-002. Renumbered to UAT-013/TASK-013. Note: the "TASK-001"/"DEC-0001" strings inside UAT-EDGE-001..003's test commands are synthetic parser-fixture examples, not real cross-references — left unchanged. -->
