---
id: mcp-one-process-per-user
title: "Research: Why User-Scoped MCPs Spawn One Process Per Session"
updated: 2026-08-15
sources:
  - ../../../raw/research/mcp-one-process-per-user/index.md
  - ../../../raw/research/serena-single-instance-transport/index.md
confidence: extracted
tags: [mcp, stdio, concurrency, architecture]
---

# Research: Why User-Scoped MCPs Spawn One Process Per Session

Investigates a concrete concurrency question this repo hit while building its shared brave-search MCP container: if multiple Claude Code sessions are open at once, why does each one spawn its own MCP server process, and can that be enforced down to one process globally?

**It's an MCP protocol property, not a Claude Code choice, and it applies regardless of scope.** The stdio transport spec defines a strict 1-client : 1-subprocess relationship — "the client launches the MCP server as a subprocess," and the server's lifetime ends when that client closes stdin. There is no in-protocol multiplexing for stdio. Each Claude Code session is an independent MCP client with no daemon coordinating processes between sessions — 4 sessions × 6 stdio-registered servers really does mean 24 separate processes. Host-level sharing is tracked as two **open, unimplemented** GitHub feature requests (anthropics/claude-code#28860 "shared MCP daemon," #40220 "singleton/shared mode") — confirming this is a known gap, not a documented-but-missed setting.

**The only sanctioned fix is switching transport, not scope.** Streamable HTTP is explicitly designed so "the server operates as an independent process that can handle multiple client connections," with per-client session IDs. Registering a server over HTTP against one long-lived process (a Docker container with `--restart unless-stopped`, a launchd/systemd service) yields exactly one process shared by every session — this is precisely why this repo's brave-search and Playwright (macOS) servers are registered as **user-scope HTTP** servers backed by persistent processes, not because user scope itself shares anything. relates_to::[[mcp-scope-performance-behavior]] independently reached the same conclusion from the official docs: scope changes visibility and trust, never process-sharing; only transport does that.

**Direct implication for uses::[[serena]]**: Serena is registered as a **stdio** server (`uvx ... serena start-mcp-server`) at **local** scope. Neither of those facts affects process count — as a stdio server, it spawns one fresh `uvx`-launched process per Claude Code session regardless of scope. Three windows/sessions open against the same project means three independent Serena processes today, in this repo's current configuration.

> **Contradiction (corrected same day):** this paragraph originally continued "there is no daemon-sharing mechanism available to it today (and none is on a committed roadmap)... the only documented fix would be switching it to an HTTP-mode registration (if Serena ever ships one)." That was wrong — derived_from::[[serena-single-instance-transport]] found Serena **already ships** a `streamable-http` transport, and the maintainer-endorsed fix for exactly this scenario is starting one Serena process in HTTP mode and pointing every client at it (confirmed via GitHub issue [oraios/serena#1235](https://github.com/oraios/serena/issues/1235), closed same-day as "completed"). The important caveat that survives: an HTTP-mode Serena instance can only have **one active project at a time**, so this only collapses same-project sessions, not different projects — and it isn't currently adopted in this repo (see that report for the full trade-off analysis and why the status quo remains the recommendation).

See derived_from::[[mcp-scope-performance-behavior]] and relates_to::[[mcp-server-scope-model]] for the scope side of this question, and uses::[[serena]] for the concrete instance this resolves.
