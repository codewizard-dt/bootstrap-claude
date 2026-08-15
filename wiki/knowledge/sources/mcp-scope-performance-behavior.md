---
id: mcp-scope-performance-behavior
title: "Research: .mcp.json vs ~/.claude.json — implications, performance, and behavior"
updated: 2026-08-15
sources:
  - ../../../raw/research/mcp-scope-performance-behavior/index.md
  - ../../../raw/research/mcp-scope-performance-behavior/index-2.md
confidence: extracted
tags: [mcp, scope, performance, decision-review, security]
---

# Research: `.mcp.json` vs `~/.claude.json` — implications, performance, and behavior

A general-purpose follow-up to derived_from::[[serena-mcp-scope]], prompted by a direct question: does registering an MCP server in project-scope `.mcp.json` vs. local/user-scope `~/.claude.json` carry any performance or runtime difference, beyond the visibility/sharing implications already documented for uses::[[serena]]?

**No performance difference exists.** Server-process spawning, connection handshake, reconnection/backoff, and idle timeouts are governed entirely by **transport type** (stdio vs HTTP/SSE/WebSocket) — nothing in Claude Code's official docs ties any of that to scope. This repo's own prior process-count research (relates_to::[[mcp-one-process-per-user]]) already established the same conclusion from a different angle: a stdio server registered at *any* scope spawns one fresh subprocess per Claude Code session — scope never reduces or shares processes; only switching to a shared HTTP server does.

**What does differ is visibility, precedence, and trust.** Precedence on a name collision is strict override (local > project > user > plugin > claude.ai connector), never a field merge. Project-scoped `.mcp.json` servers trigger a one-time approval prompt in interactive sessions (`claude mcp reset-project-choices` clears it) — but **headless paths (`claude -p`, Agent SDK, cloud/web sessions) load them without ever prompting**, so a server a human would have to approve interactively runs unprompted in CI/cloud contexts unless explicitly blocked via `disabledMcpjsonServers`. As of Claude Code v2.1.196, a freshly cloned repo also cannot self-approve its own `.mcp.json` servers via committed settings until each teammate individually accepts a workspace-trust dialog.

**New finding that updates prior research:** Claude Code documents `${VAR}`/`${VAR:-default}` environment-variable expansion inside `.mcp.json` (and local/user `~/.claude.json`) entries, including a `CLAUDE_PROJECT_DIR` variable injected into the spawned server's own environment. This directly contradicts derived_from::[[serena-mcp-scope]]'s claim that no path-portability mechanism exists for `.mcp.json` — see the `> **Contradiction:**` callout added to that page. It is flagged as an unverified lead (not tested against Serena's actual `--project` flag), not a settled reversal of the "keep Serena at local scope" recommendation.

This research also surfaced a stale doc inconsistency: `README.md` line 247 still describes Serena as registered "against an absolute project path in `.mcp.json`," contradicting the correct local-scope description at the same file's lines 139 and 208 — flagged for a follow-up doc fix, not corrected here (out of scope for a knowledge-layer ingest).

**Addendum (independently cross-checked, 2026-08-15):** a parallel research pass against the same official doc confirmed all of the above with no contradictions, and surfaced one genuinely new, security-relevant finding, independently re-verified in this session by fetching the issue directly: GitHub issue [anthropics/claude-code#18692](https://github.com/anthropics/claude-code/issues/18692) (reported v2.1.9, **closed as "not planned"** — unfixed) documents that `claude mcp add`, when run against a `.mcp.json` that already contains `${VAR}`-style placeholder secrets, resolves and hardcodes the literal secret value back into the file instead of preserving the placeholder — undercutting the file's own env-var-expansion safety story for any team relying on it. Also confirmed: a discovery cache and `alwaysLoad`/`MCP_CONNECTION_NONBLOCKING` control remote-server startup latency, but both are transport/flag-driven, not scope-driven — reinforcing rather than revising the "no performance difference by scope" conclusion above. See derived_from::[[mcp-add-secret-hardcoding-bug]] for the standalone gotcha this was promoted to.

See relates_to::[[mcp-server-scope-model]] for the general three-scope concept this research extends, and derived_from::[[serena-mcp-scope]] for the prior Serena-specific decision review this builds on.
