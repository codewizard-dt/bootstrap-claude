---
topic: plan to implement a dark mode theme
slug: dark-mode-theme
researched: 2026-07-06
sources: [./sources.md]
---

# Research: Dark Mode Theme for the Wiki Dashboard

> `TASK-002-wiki-dashboard-client.md` requires light/dark theming for `dashboard.html` via `@media (prefers-color-scheme: dark)` "at minimum," but no concrete palette, CSS-variable structure, or toggle mechanism exists anywhere in this repo. Recommendation: implement a full explicit-override toggle (`localStorage` > OS `prefers-color-scheme` > default), backed by a dark palette derived from the existing `raw/house-style` light tokens, following the CSS-custom-property + `data-theme` attribute pattern that is the 2025 industry-converged approach for self-contained static pages.

## Research Questions

- Does this repo have any existing dark-mode/theme convention `dashboard.html` should follow?
- What does the wiki-dashboard roadmap (ROADMAP-002) and its sibling tasks (TASK-001/003/004/005) say about theming?
- What is current (2025) best practice for implementing a light/dark toggle in a dependency-free vanilla HTML/CSS/JS file?
- What palette should the dark theme use, given `raw/house-style` is light-mode only?
- How does theming interact with `dashboard.html`'s live-polling render loop?

## Current State (Codebase)

- `wiki/work/tasks/TASK-002-wiki-dashboard-client.md` (lines 27, 36) is the only place in the repo that mentions theming: "Theme: support light/dark via `prefers-color-scheme` media query at minimum" — stated as a floor, not a full spec.
- `wiki/work/tasks/TASK-001-wiki-dashboard-server.md`, `TASK-003-wiki-dashboard-cli-wiring.md`, `TASK-004-wiki-dashboard-sync-scaffold.md`, `TASK-005-wiki-dashboard-docs.md`, and the parent `ROADMAP-002` file contain zero mentions of "dark," "theme," "light mode," `prefers-color-scheme`, CSS variables, or a toggle. They cover the static server, CLI wiring, scaffold distribution, and docs respectively — none touch `dashboard.html`'s markup/CSS/JS content, which is entirely TASK-002's scope.
- `raw/house-style/tokens/tokens.json` (the repo's design-token source of truth) defines only light-mode colors: `canvas #f6f7f9`, `surface #f1f2f4`, `card #ffffff`, `ink #0b0b0d`, `ink-2 #33353b`, `muted #6b6e76`, `muted-2 #9a9da5`, `line #e7e8ea`, `accent #4f5a78`, plus status accents (`red #e5484d`, `green #30a46c`, `blue #3b6ef6`, `amber #e0901a`, `violet #8b5cf6`). No dark variants exist.
- `raw/house-style/preview/src/index.css` confirms there is no dark-mode handling anywhere in the house-style preview — no `prefers-color-scheme`, no `data-theme`.
- `dashboard.html` itself does not exist yet; TASK-002 (status: `todo`) is what will create `lib/scripts/templates/wiki/dashboard.html`, and it plans a 5-second polling loop (`renderFamily()` / `setInterval`) that re-renders all six family panels — any theme toggle must live outside that regenerated DOM subtree.
- The nearest usable structural reference on this machine (outside this repo) is `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/project-artifact/skills/project-artifact/template.html`, which implements `:root` custom properties + `@media (prefers-color-scheme: dark)` overrides (no manual toggle) — the right shape to extend, but missing the explicit-override layer.

## Key Findings

- No dark-mode precedent or convention exists anywhere in `bootstrap-claude` to reuse — this had to be designed fresh. [S1][S2][S3]
- `dashboard.html` is a plain static file served by TASK-001's Node server and opened directly in a browser; it is **not** a Claude Artifact, so the Artifact tool's "host stamps `data-theme`" behavior does not apply — the toggle logic must be fully self-contained in the file itself. *(inference from Artifact tool documentation — no primary source file)*
- 2025 best-practice consensus across multiple independent sources is a **tri-state cascade**: explicit `localStorage` choice > OS `prefers-color-scheme` > default, resolved via an inline script that runs before first paint to avoid a flash of the wrong theme (FOUC/FOWT). [S4][S5][S6]
- CSS structure: define color tokens as custom properties in `:root` (light defaults) and override them in `@media (prefers-color-scheme: dark)` as a passive fallback; then define `:root[data-theme="light"]` / `:root[data-theme="dark"]` blocks after the media query so an explicit attribute always wins at equal specificity. [S6][S7]
- Accessibility/UX details repeatedly emphasized: avoid pure-black backgrounds (use ~`#17181c`–`#1c1d21`); add `<meta name="color-scheme" content="light dark">` so native scrollbars/form controls theme correctly; give the toggle a real `aria-label`; respect `prefers-reduced-motion` for any color-transition animation. [S5][S8]
- `localStorage` reads/writes should be wrapped in `try/catch` since they can throw in locked-down or private-browsing contexts — theming should degrade gracefully to media-query-only rather than break the page. *(inference — no single primary source states this explicitly, but it follows from standard defensive JS practice)*

## Constraints

- No build step and no external dependencies — `dashboard.html` must remain a single self-contained file (per TASK-002's stated constraint), so no CSS/theming library or framework can be introduced.
- Must not regress the existing 5-second polling/re-render loop; the toggle button and its listener must survive every re-render cycle.
- Must derive from `raw/house-style` tokens where possible for light-mode consistency with the rest of the ecosystem, even though house-style has no dark equivalents to copy directly.

## Recommendation

**Recommended approach: full explicit-override toggle**, not a bare media query.

**Palette** (dark values derived from the existing light `tokens.json`, keeping hue relationships, lightening saturated accents ~10–15% for contrast on dark backgrounds, avoiding pure black):

| Token | Light (existing, from `tokens.json`) | Dark (new) |
|---|---|---|
| `--bg` | `#f6f7f9` | `#16171a` |
| `--surface` | `#f1f2f4` | `#1c1d21` |
| `--card` | `#ffffff` | `#202127` |
| `--text` | `#0b0b0d` | `#e8e9ec` |
| `--text-2` | `#33353b` | `#c3c5cb` |
| `--muted` | `#6b6e76` | `#9a9da5` |
| `--border` | `#e7e8ea` | `#303238` |
| `--accent` | `#4f5a78` | `#8891ab` |
| `--red` | `#e5484d` | `#ff6b70` |
| `--green` | `#30a46c` | `#3ddc91` |
| `--blue` | `#3b6ef6` | `#6e93ff` |
| `--amber` | `#e0901a` | `#f0a83a` |
| `--violet` | `#8b5cf6` | `#a78bfa` |

**Implementation outline** (for TASK-002 steps 1 and 3):

1. `:root { --bg: #f6f7f9; ... }` (light defaults) + `@media (prefers-color-scheme: dark) { :root { --bg: #16171a; ... } }` as the passive fallback.
2. `:root[data-theme="light"] { ... }` / `:root[data-theme="dark"] { ... }` blocks placed *after* the media query in source order, so an explicit attribute wins over the media query.
3. An inline `<script>` near the top of `<body>`, run synchronously before the rest of the page paints: read `localStorage.getItem('dashboard-theme')`; if present, set `document.documentElement.setAttribute('data-theme', saved)` immediately. If absent, leave the attribute unset (media query governs) and attach a `matchMedia('(prefers-color-scheme: dark)')` change listener so a live OS flip is reflected while no explicit choice exists.
4. A toggle `<button aria-label="Switch color theme">` in the static header: on click, compute the currently-resolved theme, flip it, `setAttribute('data-theme', next)` + `localStorage.setItem('dashboard-theme', next)`.
5. `<meta name="color-scheme" content="light dark">` in `<head>`.
6. Wrap any theme-swap transition in `@media (prefers-reduced-motion: no-preference)`.

**Risks and mitigations:**
- Polling loop could wipe the toggle button if rendering is scoped too broadly → keep `renderFamily()`/panel rendering confined to a container below the static header.
- `localStorage` can throw in private/locked-down browsing → wrap in `try/catch`, degrade to media-query-only.
- Dark palette values above are a starting point, not contrast-checked — verify WCAG AA (4.5:1 body text) once real markup exists.

**Alternative if constraints change**: if a future requirement demands matching an exact design tool's dark palette (e.g. a rebuilt house-style with real dark tokens), swap only the palette table above — the CSS-variable/`data-theme` structure does not need to change.

## Next Steps

- Implementation: this is guidance for existing `TASK-002` (`wiki/work/tasks/TASK-002-wiki-dashboard-client.md`) — no new task needed. Consider amending TASK-002 steps 1 & 3 with the palette table and toggle structure above so the implementer doesn't re-derive it.
- To ingest into the knowledge base: `/wiki-ingest raw/research/dark-mode-theme/index.md`
