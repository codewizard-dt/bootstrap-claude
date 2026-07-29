---
topic: How should install-mcps.sh handle an MCP server that is already registered at project/local scope when it wants to install the shared user-scope server? What solutions exist and which fits this repo?
slug: mcp-scope-conflict-handling
researched: 2026-07-29
---

# Primary Sources — MCP scope-conflict handling

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/install-mcps.sh::register_optional_mcp` (upgrade branch) + `lib/scripts/lib.sh::mcp_installed/mcp_matches` | 2026-07-29 | The bug: upgrade path removes only `-s user` before re-adding, so a project-scoped stale entry survives and gets duplicated; house grep-probe conventions |
| S2 | codebase | `lib/scripts/install-mcps.sh` Darwin end-of-run warning block (comment "Hint only — never edit a project's .mcp.json") | 2026-07-29 | Existing house rule that project `.mcp.json` is user-owned; setup only hints |
| S3 | cli | `claude mcp get playwright` and `claude mcp get --help` output on this machine | 2026-07-29 | Detection surface: `Scope: User config (available in all your projects)` line exists; no `--json` flag on `mcp get`/`mcp list` |
| S4 | web | https://code.claude.com/docs/en/mcp (Scope hierarchy and precedence) | 2026-07-29 | Precedence order and no-merge behavior |
| S5 | screenshot | `/Users/davidtaylor/Downloads/Screenshot 2026-07-29 at 9.35.45 AM.png` (user-supplied, steno machine) | 2026-07-29 | Observed failure: `[Conflicting scopes]` warning, playwright at user (http://localhost:8931/mcp) + project (npx @playwright/mcp@latest); steno `.mcp.json` also carries clickup/figma/guru/serena |

## Excerpts

### S3 — `claude mcp get playwright` (local CLI output)
> `Scope: User config (available in all your projects)`
> `claude mcp get --help` → Options: `-h, --help` only (no JSON output mode)

### S4 — Claude Code docs: Connect Claude Code to tools via MCP
https://code.claude.com/docs/en/mcp
> When the same server is defined in more than one place, Claude Code connects to it once, using the definition from the highest-precedence source. The entire server entry from that source is used; fields are not merged across scopes.
> 1. Local scope
> 2. Project scope
> 3. User scope

### S5 — user screenshot (steno machine, /mcp screen)
> Server "playwright" is defined in multiple scopes with different endpoints: user (http://localhost:8931/mcp), project (npx @playwright/mcp@latest). OAuth tokens are stored per endpoint, so authenticating in one context will not carry over.
> Keep the correct endpoint and remove the others: `claude mcp remove playwright -s user` or `claude mcp remove playwright -s project`
