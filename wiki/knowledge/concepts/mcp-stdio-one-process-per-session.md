---
id: mcp-stdio-one-process-per-session
title: Stdio MCP Servers Spawn One Process Per Client Session
updated: 2026-08-15
sources:
  - ../../../raw/research/mcp-one-process-per-user/index.md
  - ../../../raw/research/serena-single-instance-transport/index.md
confidence: extracted
tags: [mcp, stdio, concurrency]
---

# Stdio MCP Servers Spawn One Process Per Client Session

A stdio-registered MCP server's process count scales with the number of **Claude Code sessions**, not with anything about the server's registration scope. This is dictated by the MCP spec's stdio transport: the client launches the server as a subprocess, and the process's lifetime is bound to that one client connection ("close stdin, terminate subprocess") — there is no in-protocol multiplexing. Each Claude Code session (each window, each interactive instance) is its own independent MCP client, and nothing coordinates processes between sessions. N concurrent sessions each running M stdio-registered servers means N×M separate processes, full stop — this holds whether those servers are registered at `local`, `project`, or `user` scope, because relates_to::[[mcp-server-scope-model]] scope only governs config visibility, never process lifecycle.

**Host-level sharing does not exist today.** Two GitHub feature requests track this as a known, unimplemented gap (anthropics/claude-code#28860 "shared MCP daemon," #40220 "singleton/shared mode") — there is no config flag, setting, or scope choice that collapses N sessions down to one process for a stdio server.

**The only fix is a transport change.** Streamable HTTP servers "operate as an independent process that can handle multiple client connections" by spec design — registering against one long-lived HTTP server (a Docker container, a launchd/systemd service) gives every session the same shared process instead of spawning its own. This repo already applies the pattern: brave-search and Playwright (macOS) are registered as user-scope **HTTP** servers backed by persistent processes specifically to get this sharing; uses::[[serena]] remains **stdio-registered in this repo today** and therefore still spawns one fresh process per session — but this is a configuration choice, not a limitation of Serena itself: Serena also ships a `streamable-http` transport, and switching to it (pointing every same-project client at one shared endpoint) is the maintainer-endorsed fix for exactly this, with one caveat — it only shares sessions of the *same* project, since an HTTP-mode Serena instance holds only one active project at a time. See derived_from::[[serena-single-instance-transport]] for the full analysis of why this repo hasn't adopted it (yet).

Extracted from derived_from::[[mcp-one-process-per-user]]; see also relates_to::[[mcp-scope-performance-behavior]] for the companion finding that scope has no bearing on MCP performance or process count generally.
