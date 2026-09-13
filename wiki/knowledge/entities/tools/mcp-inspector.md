---
id: mcp-inspector
title: MCP Inspector
aliases: ["@modelcontextprotocol/inspector"]
updated: 2026-09-13
sources:
  - ../../../../raw/research/settings-editor-prior-art/index.md
confidence: extracted
tags: [mcp, security, cve]
---

The official Model Context Protocol reference tool for interactively testing and debugging MCP servers — a browser-based React web client paired with a local Node proxy server that connects to MCP servers over stdio, SSE, or streamable HTTP and lets a developer inspect tools, resources, prompts, and raw protocol traffic. Launched via `npx @modelcontextprotocol/inspector`.

**Shipped a Critical RCE (CVE-2025-49596, CVSS 9.4) from having no authentication between the browser client and the local proxy.** Any webpage a developer merely had open in another tab could reach the local proxy via a DNS-rebinding CSRF technique — the attacker's domain first resolves publicly, then (after the browser grants trust) to `127.0.0.1`/`0.0.0.0` — and issue a request that caused the proxy to execute an arbitrary command, achieving full remote code execution on the developer's machine. Fixed in 0.14.1 (June 2025) by adding an auto-generated session token required on every proxy request, plus explicit Host/Origin header validation rejecting cross-origin requests.

This is the most directly comparable real-world precedent found in derived_from::[[settings-editor-prior-art]] for the architecture a writable version of this repo's own `wiki-dashboard-server.js` would take on — a local web UI with a backend that can act on the developer's behalf. relates_to::[[localhost-server-security]] cites this CVE as concrete evidence that "bind to localhost" is not itself a security boundary for a write-capable local server.
