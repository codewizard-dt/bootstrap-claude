---
id: responded-error-proves-liveness
title: "Responded Error Proves Liveness (Health-Check Anti-Pattern)"
aliases: [erroring is not hanging, kill-on-misclassification]
updated: 2026-07-07
sources:
  - ../../../raw/research/serena-mcp-disconnect/index.md
  - ../../../raw/research/serena-mcp-disconnect/sources.md
tags: [hooks, reliability, health-checks, anti-pattern]
confidence: inferred
---

A health-check design flaw: treating "a process returned an error" as evidence the process might be **hung** or **dead**, when a returned error is actually proof of the opposite — a process that answers, even with an error payload, has by definition completed a full round-trip and is alive and responsive. A genuinely hung or dead process produces no response to classify at all (a timeout, or no event firing), not a parseable error.

Discovered and reproduced live in `derived_from::[[Research: Serena MCP server disconnects mid-session]]`: the `uses::[[Serena Health-Tracking Hook]]`'s `attemptSerenaRestart()` sees `isSerenaProcessAlive() === true` after a tool-call failure and concludes the live process must be "presumably hung," then `pkill`s it. The failure that triggered this was a completely benign, expected error (Serena declining to parse a file in an unsupported language) — not a hang. Compounding the inversion, `classifySerenaFailure()`'s default for any error string it doesn't recognize is `'transport'` (assess-and-possibly-kill) rather than `'tool'` (log-and-continue), so the destructive path is the *default*, not an edge case.

**The general lesson**: in a fail-open health-check/self-healing system, the asymmetry of consequences should drive the default direction of an "unknown" classification. Here, missing a genuine transport failure only delays detection to the next failed call (cheap, recoverable). Wrongly killing a live process is expensive and — when there's no documented way to reconnect the transport mid-session, as is the case for stdio MCP servers — irreversible for the rest of the session. Defaults should bias toward the cheaper mistake, not the more expensive one.

**Where else this applies**: any fail-open watchdog/restart hook (rate limiters, connection poolers, sidecar supervisors) that decides to kill-and-hope-for-respawn based on a heuristic guess rather than a genuine "no response received" signal is vulnerable to the same inversion. The correct signal for "the transport is actually broken" is the *absence* of an event to classify (a timeout on the caller's side) or an explicit disconnect notification from the host — never a successfully-classified error payload, since receiving one already disproves the hang hypothesis.
