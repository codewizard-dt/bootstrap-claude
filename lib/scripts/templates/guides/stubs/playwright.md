
## Playwright (Browser Automation)

### Tools

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Navigate to a URL |
| `browser_take_screenshot` | Screenshot current page |
| `browser_snapshot` | Get accessibility tree (use to get element `ref` IDs before clicking/typing) |
| `browser_click` | Click element by `ref` ID from snapshot |
| `browser_type` | Type into an input field by `ref` ID |
| `browser_evaluate` | Execute JavaScript in browser |
| `browser_select_option` | Select dropdown option by `ref` ID |
| `browser_hover` | Hover over element by `ref` ID |
| `browser_close` | Close the browser |

### Workflow

1. **No explicit launch step** — the browser starts automatically on the first tool call.
2. **Accessibility-tree first** — always call `browser_snapshot` to get the current page structure and element `ref` IDs before interacting. Pass the `ref` to `browser_click`, `browser_type`, etc.
3. Use `browser_take_screenshot` for visual verification after navigation or interaction.

Use for visual verification, form interaction, and browser-rendered content. Do NOT use for static content fetching or library docs.

---
