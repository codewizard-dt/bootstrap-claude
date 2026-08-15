---
topic: what are the implications of defining a mcp server in ./.mcp.json versus ~/.claude.json ?? like are there performance or behavior differences??
slug: mcp-scope-performance-behavior
researched: 2026-08-15
---

# Primary Sources — `.mcp.json` vs `~/.claude.json` scope implications

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/install-mcps.sh` + `CLAUDE.md` "Manual setup steps" | 2026-08-15 | Confirms this repo already registers 4 MCP servers across 3 different scopes deliberately, and documents the Serena local-scope rationale |
| S2 | codebase (via wiki) | `raw/research/serena-mcp-scope/index.md`, `raw/research/mcp-add-scope-writes/index.md` | 2026-08-15 | Prior incident: Serena mis-registered at project scope, baking a machine-specific `--project <path>` into shared `.mcp.json`, breaking on every other clone; fixed by switching to local scope |
| S3 | codebase (via wiki) | `raw/research/mcp-scope-conflict-handling/index.md` | 2026-08-15 | Prior incident: teammate's pre-existing project-scope Playwright entry conflicted with a user-scope install, producing `[Conflicting scopes]`; documents precedence (local > project > user) and the `mcp_user_scoped()` grep-based detection workaround (no `--json` on `claude mcp get`) |
| S4 | web | https://code.claude.com/docs/en/mcp | 2026-08-15 | Official "MCP installation scopes" section: storage-location table, scope hierarchy/precedence, project-scope approval prompt + `claude mcp reset-project-choices`, headless/`-p`/Agent SDK/cloud sessions skip the approval prompt, `disabledMcpjsonServers`, workspace-trust interaction (v2.1.196+), `${VAR}`/`${VAR:-default}` env expansion in `.mcp.json` and in local/user `~/.claude.json` entries, `CLAUDE_PROJECT_DIR` injected into spawned stdio server env, Desktop Code-tab precedence exception, reconnection/backoff/idle-timeout behavior (all keyed to transport, not scope) |
| S5 | codebase (via wiki) | `raw/research/mcp-one-process-per-user/index.md` | 2026-08-15 | Confirms stdio's one-subprocess-per-client behavior is an MCP protocol property, not a Claude Code or scope-specific behavior — a user-scoped stdio server still spawns one process per session; only HTTP registration against a shared long-lived server achieves one process across sessions |
| S6 | codebase | `README.md` lines 139, 208, 247 | 2026-08-15 | Spotted stale internal inconsistency: line 247 still describes Serena as project-scoped (`.mcp.json`), contradicting the correct local-scope description at lines 139/208 |

## Excerpts

### S4 — Claude Code docs: "MCP installation scopes"
https://code.claude.com/docs/en/mcp

> MCP servers can be configured at three scopes. The scope you choose controls which projects the server loads in and whether the configuration is shared with your team.

> | Scope | Loads in | Shared with team | Stored in |
> |---|---|---|---|
> | Local | Current project only | No | `~/.claude.json` |
> | Project | Current project only | Yes, via version control | `.mcp.json` in project root |
> | User | All your projects | No | `~/.claude.json` |

> When the same server is defined in more than one place, Claude Code connects to it once, using the definition from the highest-precedence source. The entire server entry from that source is used; fields are not merged across scopes.
> 1. Local scope
> 2. Project scope
> 3. User scope
> 4. Plugin-provided servers
> 5. claude.ai connectors

> For security reasons, Claude Code prompts for approval in interactive sessions before using project-scoped servers from `.mcp.json` files. To reset those approval choices, run `claude mcp reset-project-choices`.
>
> `claude -p` runs, Agent SDK sessions, and cloud sessions can't show that prompt: Claude Code loads project-scoped servers there without asking. A session you start in `bypassPermissions` mode with `skipDangerousModePermissionPrompt` set skips the prompt too. To keep a server out anyway, add it to `disabledMcpjsonServers`, which blocks it in every mode, or exclude project settings entirely with `--setting-sources` or the SDK's `settingSources` option.

> As of v2.1.196, `claude mcp list` and `claude mcp get` read `.mcp.json` approvals only from settings files that aren't checked into the repository until you trust the workspace by running `claude` in it and accepting the workspace trust dialog. A cloned repository can't approve its own servers: `enableAllProjectMcpServers` or `enabledMcpjsonServers` committed to the project's `.claude/settings.json` is ignored in an untrusted folder, and the server stays at `⏸ Pending approval` instead of being connected and health-checked.

> This variable is set in the server's environment, not in Claude Code's own environment, so referencing it via `${VAR}` expansion in the `command` or `args` of a project-scoped `.mcp.json` entry or a local- or user-scoped server entry in `~/.claude.json` requires a default such as `${CLAUDE_PROJECT_DIR:-.}`.

> If you open a local session in the Desktop app's Code tab with the same stdio server name at the top level of `~/.claude.json` (user scope) and in `.mcp.json`, the Code tab uses the `~/.claude.json` definition.

### S3 — This repo's own scope-conflict research
`raw/research/mcp-scope-conflict-handling/index.md`

> Scope precedence is 1. Local, 2. Project, 3. User; Claude Code connects once using the highest-precedence definition and does not merge fields — so after the buggy run, the project stdio entry still wins and the shared HTTP server is unused.

### S5 — This repo's own MCP process-count research
`raw/research/mcp-one-process-per-user/index.md`

> The MCP spec defines stdio as "the client launches the MCP server as a subprocess" and the message loop ends with "Close stdin, terminate subprocess" — the server's lifetime is the client connection. ... Each Claude Code session is an independent MCP client. Nothing coordinates MCP processes between sessions.
