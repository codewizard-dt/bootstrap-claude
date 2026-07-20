# Wiki Dashboard (server + client)

- **Server**: `lib/scripts/wiki-dashboard-server.js` — zero-dependency Node static server. Routes: `/` → dashboard client, `/wiki/**` → read-only wiki tree (path-traversal guarded). Port 4317, EADDRINUSE fallback +1 up to 10 tries. Reads files per-request, so template edits show on browser reload without restart. Never needs changes for client-side view additions.
- **Client**: `lib/scripts/templates/wiki/dashboard.html` — self-contained hash-routed SPA (reworked 2026-07-06):
  - `#/` overview (per-family summary cards: active count + status-keyword breakdown badges + archived count)
  - `#/<family>` family page (two-line rows, color-coded status badges, archived `<details>`)
  - `#/<family>/<file>.md` item page (escape-first client-side markdown renderer: frontmatter grid, headings, checkbox lists, tables, fenced code)
- **Parser**: `parseIndexMarkdown` handles BOTH active-index bullet lines (`- [Title](path) — summary · status`) AND archive-index pipe-table rows (`| [[ID]] | Title | Final Status | Archived |`), splitting on unescaped pipes only (`/(?<!\\)\|/`, unescapes `\|`). Archive rows have `path: null` (wiki-links carry no slug) so they render unlinked.
- **Theme**: tri-state — `localStorage['dashboard-theme']` explicit choice > `prefers-color-scheme` > light. Override blocks `:root[data-theme=light|dark]` sit after the media query; early inline script in `<body>` applies the saved theme pre-paint.
- **XSS rule**: all fetched wiki text goes through `textContent`/DOM builders — never `innerHTML`. Keep it that way for any new view.
- **Gotcha**: item links must be hash routes (`#/<family>/<path>`), never raw relative hrefs — raw paths resolve against `/` and 404.
- Template is an always-refresh scaffold file (synced by `sync-wiki-scaffold.sh`), so fixes must land in the template, not a target project's copy.
- This repo's Serena config only runs bash/markdown/yaml language servers — JS files (`bin/cli.js`, dashboard server) are not symbol-navigable; use Read.
