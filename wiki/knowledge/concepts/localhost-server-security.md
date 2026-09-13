---
id: localhost-server-security
title: "Localhost HTTP Server Security (bind address & CSRF)"
updated: 2026-09-13
sources:
  - ../../../raw/research/bootstrap-prefs-editor-tui/index.md
  - ../../../raw/research/bootstrap-prefs-editor-tui/sources.md
  - ../../../raw/research/settings-editor-prior-art/index.md
  - ../../../raw/research/settings-editor-prior-art/sources.md
confidence: extracted
tags: [security, dashboard, http]
---

Two distinct, commonly conflated facts about any local-only Node `http` server, surfaced while evaluating whether to make this repo's read-only `dashboard` command (`lib/scripts/wiki-dashboard-server.js`) writable:

**1. Bind address matters, and the default is wrong for "local-only" intent.** `http.Server#listen(port, callback)` with no host argument binds **all interfaces** (`0.0.0.0`), not loopback — reachable from any other device on the same LAN/Wi-Fi, not just the machine running it. Current guidance is unambiguous: "some people will wrongly suggest exposing on 0.0.0.0 which is not loopback, and WILL expose your server to the local network... 127.0.0.1 or the localhost keyword is what you want." **This repo's `wiki-dashboard-server.js` has exactly this bug today** — its `listen()` call passes no host — which is a live LAN exposure of the (currently read-only) wiki tree, independent of any future write capability.

**2. Binding to loopback does not, by itself, defend against CSRF.** From a browser's perspective "`localhost` (or `127.0.0.1`) is just another domain name" — any web page open in the same browser, on any origin, can still direct the browser to send a request to a loopback server. "The attacker doesn't need to access your server directly. They access it through your browser." A JSON `POST` (a non-"simple" content type) does trigger a CORS preflight that a server with no deliberate CORS/Origin handling will typically fail closed on, but that protection has to be designed in — it is not a side effect of "it's just localhost." `localhost` and `127.0.0.1` are also treated as different origins by browsers for cookie/CSRF purposes, a frequent source of same-origin-check bugs.

**Practical rule derived here:** any local tool meant for one machine should bind explicitly to `127.0.0.1`/`localhost`, never leave the host argument implicit; and any state-changing route on such a server needs an explicit CSRF defense (Origin/Referer check, a custom header only same-origin `fetch()` can set, or a token) rather than relying on the bind address alone — this is exactly the gap identified in implements::[[bootstrap-prefs-editor-tui]]'s recommendation against making uses::[[bootstrap-prefs-store]]'s planned editor a writable HTTP dashboard.

> **Real-world corroboration, not just theory** (derived_from::[[settings-editor-prior-art]], 2026-09-13): three independent tools converge on exactly the failures described above. (1) **MCP Inspector**, the official MCP debugging tool, shipped a Critical CVSS-9.4 RCE (CVE-2025-49596) because its local proxy had no session token or Origin/Host validation — any webpage a developer had open could reach it via DNS-rebinding CSRF and execute arbitrary commands; fixed by adding exactly the two defenses this page recommends. See relates_to::[[mcp-inspector]]. (2) **Prisma Studio** independently shipped the identical "binds `0.0.0.0` instead of `localhost`" bug this repo found and fixed in its own `wiki-dashboard-server.js` (`prisma/studio#805`). (3) **Serena's own dashboard** (relates_to::[[serena]]) has unauthenticated state-mutating routes and is deliberately rebound to `0.0.0.0` in its Docker image, with a maintainer calling the tradeoff "really not an issue" — a live example of a maintained tool accepting this exact risk rather than defending against it. The contrasting positive pattern — solving the same problem with no server at all — is documented at relates_to::[[terminal-native-config-tui-pattern]].
