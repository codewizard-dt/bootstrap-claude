---
topic: plan to implement a dark mode theme
slug: dark-mode-theme
researched: 2026-07-06
---

# Primary Sources — Dark Mode Theme for the Wiki Dashboard

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `wiki/work/tasks/TASK-002-wiki-dashboard-client.md` (lines 27, 36) | 2026-07-06 | The only theming requirement in the repo: "support light/dark via `prefers-color-scheme` media query at minimum" |
| S2 | codebase | `wiki/work/tasks/TASK-001-wiki-dashboard-server.md`, `TASK-003-wiki-dashboard-cli-wiring.md`, `TASK-004-wiki-dashboard-sync-scaffold.md`, `TASK-005-wiki-dashboard-docs.md`, `wiki/work/roadmaps/` (ROADMAP-002) | 2026-07-06 | Confirmed zero mentions of dark mode/theming anywhere else in the roadmap or sibling tasks; established that TASK-002 is the sole owner of `dashboard.html` content |
| S3 | codebase | `raw/house-style/tokens/tokens.json` | 2026-07-06 | The repo's only color-token source of truth; confirmed light-mode-only (no dark values, no `data-theme` reference) — basis for deriving the dark palette |
| S4 | web | https://whitep4nth3r.com/blog/best-light-dark-mode-theme-toggle-javascript/ | 2026-07-06 | Tri-state "preference cascade" pattern: `localStorage` choice, falling back to `matchMedia('(prefers-color-scheme: dark)')`, falling back to a default |
| S5 | web | https://blog.openreplay.com/build-dark-mode-toggle-css-js/ | 2026-07-06 | `<meta name="color-scheme" content="light dark">` for native control theming; `data-theme` on `<html>`; script-before-paint to prevent flash; accessible toggle button with `aria-label` |
| S6 | web | https://www.magicpatterns.com/blog/implementing-dark-mode | 2026-07-06 | `:root[data-theme="dark"]` custom-property override pattern so consuming component CSS never needs to change per theme |
| S7 | web | https://medium.com/@cerutti.alexander/a-mostly-complete-guide-to-theme-switching-in-css-and-js-c4992d5fd357 | 2026-07-06 | Confirms `@media (prefers-color-scheme)` + `[data-theme]` attribute can coexist, covering all four system/setting combinations; explains why the attribute override must come after the media query in source order |
| S8 | web | https://www.srfdeveloper.com/2025/08/css-javascript-dark-mode-toggle.html | 2026-07-06 | "A user's explicit choice (clicking our toggle) should always win" over OS preference; avoid pure-black dark backgrounds |
| S9 | codebase | `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/project-artifact/skills/project-artifact/template.html` | 2026-07-06 | Reference implementation of `:root` custom properties + `@media (prefers-color-scheme: dark)` override (no manual toggle) — structural starting point |

## Excerpts

### S1 — TASK-002-wiki-dashboard-client.md
`wiki/work/tasks/TASK-002-wiki-dashboard-client.md`
> Theme: support light/dark via `prefers-color-scheme` media query at minimum (this repo's Artifact convention favors theme-awareness; apply the same care here since it's a long-running local tool a developer will have open).

### S3 — tokens.json
`raw/house-style/tokens/tokens.json`
> "color": { "canvas": "#f6f7f9", "surface": "#f1f2f4", "paper": "#ffffff", "card": "#ffffff", "ink": "#0b0b0d", "ink-2": "#33353b", "muted": "#6b6e76", "muted-2": "#9a9da5", "line": "#e7e8ea", "line-2": "#f0f1f3", "accent": "#4f5a78", "accent-red": "#e5484d", "accent-green": "#30a46c", "accent-blue": "#3b6ef6", "accent-amber": "#e0901a", "accent-violet": "#8b5cf6", "accent-rose": "#f43f5e" }

### S4 — whitep4nth3r.com
https://whitep4nth3r.com/blog/best-light-dark-mode-theme-toggle-javascript/
> If there's no stored theme preference in localStorage, we'll detect the user's system settings using the window.matchMedia() method by passing in a media query string... const systemSettingDark = window.matchMedia("(prefers-color-scheme: dark)");

### S5 — openreplay.com
https://blog.openreplay.com/build-dark-mode-toggle-css-js/
> Place a script immediately after the body tag that checks localStorage and applies the saved theme before the page paints to prevent this flash... Should I use pure black for dark mode backgrounds? No, pure black can cause eye strain... Use dark grays like #1a1a1a or #121212 instead.

### S6 — magicpatterns.com
https://www.magicpatterns.com/blog/implementing-dark-mode
> :root { --primary-color: #9f7aea; --border-color: #000000; } :root[data-theme="dark"] { --primary-color: #6B46C1; --border-color: #ffffff; } ... The beauty with this implementation is that the consuming code doesn't need to change at all.

### S7 — Alexander Cerutti, Medium
https://medium.com/@cerutti.alexander/a-mostly-complete-guide-to-theme-switching-in-css-and-js-c4992d5fd357
> Now, using @media (prefers-color-scheme: dark | light) in CSS code is completely optional, as we can use exclusively the newly created [data-theme] attribute. If you still want to use it, you should be prepared to handle all the four cases: system:light-setting:light, system:light-setting:dark, system:dark-setting:dark, system:dark-setting-light.

### S8 — srfdeveloper.com
https://www.srfdeveloper.com/2025/08/css-javascript-dark-mode-toggle.html
> Our logic should be: a user's *explicit choice* (clicking our toggle) should always win. But if they've never made a choice on our site, we should respect their OS setting as the default.
