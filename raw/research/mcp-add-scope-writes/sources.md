---
topic: Research the specific 'claude mcp add' lines in this repo's history and any changes to the 'mcp add' API to determine why steno's .mcp.json was modified (playwright project-scope entry).
slug: mcp-add-scope-writes
researched: 2026-07-29
---

# Primary Sources — `mcp add` scope writes

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/install-mcps.sh` (working tree): serena block, `_add_brave`, `_add_context7`, `_add_playwright`, `register_optional_mcp` | 2026-07-29 | All current `claude mcp add` call sites; serena always `--scope project`; context7 + non-mac playwright still honor a "p" scope answer; brave/playwright-mac ignore the prompt |
| S2 | git | `git show bca82bc:lib/scripts/install-mcps.sh` (bootstrap 2.7.0, "Add interactive MCP setup"); history via `git log -S playwright` (bca82bc → 6bc3d16 → 47b4e0a) | 2026-07-29 | Historical capability only: 2.7.0–2.10.0 could write project-scope playwright entries on a "p" prompt answer (identical command shape) — NOT the confirmed origin for steno (see S6); rewritten 2026-07-28 in 2.11.0 (`47b4e0a`) |
| S3 | cli | `claude mcp add --help` output on this machine | 2026-07-29 | `-s, --scope <scope>` … `(default: "local")` — default never applies because every script version passes `--scope` explicitly |
| S4 | codebase | `lib/scripts/install-mcps.sh::register_optional_mcp` upgrade branch as shipped in 2.11.0–2.11.2 | 2026-07-29 | `claude mcp remove "$name" -s user` is the only removal attempted before re-adding — no-op for project-scope entries |
| S5 | web | https://code.claude.com/docs/en/mcp (scope sections + hierarchy) | 2026-07-29 | Scope storage semantics (project → `.mcp.json`, local → `~/.claude.json` per-project; approval gate applies to `.mcp.json` servers) and precedence local > project > user |
| S6 | user | David Taylor, this session (2026-07-29) | 2026-07-29 | Attestation: steno's playwright `.mcp.json` entry was pre-existing repository config, not written by bootstrap; the serena entry was NOT pre-existing — bootstrap's setup script added it to `.mcp.json`, and it should instead live in `~/.claude.json` under the project's entry (local scope) |
| S7 | screenshot | `/Users/davidtaylor/Downloads/Screenshot 2026-07-29 at 9.35.45 AM.png` | 2026-07-29 | Steno's project entry is exactly `npx @playwright/mcp@latest` under `/Users/david/Repositories/steno/.mcp.json`; serena also listed there |

## Excerpts

### S2 — bootstrap 2.7.0 `install-mcps.sh` (git show bca82bc)
> ```bash
> scope=$(prompt_scope "playwright")
> if [ "$scope" = "project" ] && [ -n "$PROJECT_DIR" ]; then
>   ( cd "$PROJECT_DIR" && \
>     claude mcp add --scope project playwright -- npx @playwright/mcp@latest )
> ```

### S3 — `claude mcp add --help`
> `-s, --scope <scope>          Configuration scope (local, user, or project) (default: "local")`

### S5 — Claude Code docs: Connect Claude Code to tools via MCP
https://code.claude.com/docs/en/mcp
> When the same server is defined in more than one place, Claude Code connects to it once, using the definition from the highest-precedence source. … 1. Local scope 2. Project scope 3. User scope

### S7 — user screenshot (steno /mcp screen)
> `Project MCPs (/Users/david/Repositories/steno/.mcp.json)` … `playwright · ✔ connected · 24 tools`
> `Server "playwright" is defined in multiple scopes with different endpoints: user (http://localhost:8931/mcp), project (npx @playwright/mcp@latest).`
