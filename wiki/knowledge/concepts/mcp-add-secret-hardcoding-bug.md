---
id: mcp-add-secret-hardcoding-bug
title: "claude mcp add Can Hardcode Secrets Into a Placeholder-Based .mcp.json"
updated: 2026-08-15
sources:
  - ../../../raw/research/mcp-scope-performance-behavior/index-2.md
confidence: extracted
tags: [mcp, security, gotcha, secrets]
---

# `claude mcp add` Can Hardcode Secrets Into a Placeholder-Based `.mcp.json`

Claude Code documents `${VAR}`/`${VAR:-default}` environment-variable expansion in `.mcp.json` specifically so teams can share a committed config while keeping secrets (API tokens, keys) out of version control — the placeholder stays literal in the file and only resolves at runtime, in the developer's own environment.

**The bug**: running `claude mcp add` a second time against a `.mcp.json` that already contains a `${VAR}`-style placeholder causes the CLI to resolve that placeholder and write the *literal resolved value* back into the file — even when the new `add` call is only adding an unrelated server entry. Confirmed via GitHub issue [anthropics/claude-code#18692](https://github.com/anthropics/claude-code/issues/18692) (reported against v2.1.9, independently re-verified 2026-08-15). **Status: closed as "not planned"** — Anthropic has not committed to a fix, so this is a live, standing risk, not a resolved historical bug.

**Practical rule**: never run `claude mcp add` against a `.mcp.json` that already contains placeholder secrets without diffing the resulting file before committing. The safest posture is to treat any `claude mcp add` invocation targeting `project` scope as potentially secret-unsafe and review the diff every time, not just the first time.

**Relevance to this repo**: no code path currently commits `${VAR}`-style secret placeholders into a checked-in `.mcp.json` — Context7's API key, for example, is passed via `--header` at add-time rather than templated into a file (see `install-mcps.sh`). Not an active exposure today, but worth a one-line callout in `wiki/guides/mcp-tools.md` if this repo's guidance ever shifts toward committed placeholder-based `.mcp.json` secrets.

Discovered as an addendum to derived_from::[[mcp-scope-performance-behavior]]; relates_to::[[mcp-server-scope-model]] for the broader scope model this sits alongside.
