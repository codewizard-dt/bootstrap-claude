---
id: wiki-multi-writer-safety
title: Wiki Multi-Writer Safety
aliases: [concurrent wiki edits, wiki locking]
updated: 2026-07-07
sources:
  - ../../../raw/research/wiki-tooling-improvements/index.md
  - ../../../raw/research/wiki-tooling-improvements/sources.md
  - ../../../raw/research/serena-mcp-disconnect/index.md
  - ../../../raw/research/serena-mcp-disconnect/sources.md
tags: [wiki-tooling, concurrency, hooks]
confidence: ambiguous
---

The problem of two or more agents writing to the same shared wiki file (a family `index.md`, `wiki/index.md`, or `wiki/log.md`) at the same time, corrupting or losing one write. Documented independently by multiple reimplementations of `derived_from::[[Andrej Karpathy]]`'s LLM Wiki pattern:

- `uses::[[claude-obsidian]]` added per-file advisory locking (`scripts/wiki-lock.sh`) in v1.7 specifically to close what its changelog calls "a latent multi-writer corruption hole" — parallel ingest sub-agents now acquire a lock before writing.
- `MehmetGoekce/llm-wiki`'s docs warn directly: "If you have multiple Claude sessions writing to wiki files simultaneously, concurrent edits can cause conflicts. Treat wiki files as a shared resource."
- A community report (r/hermesagent, two-agent Hermes + Obsidian + `uses::[[Hindsight]]` setup) describes a lighter ad hoc pattern: a YAML soft-lock (set true / edit / set false in one write), a 30-minute staleness override with a log entry, and an append-only "Proposals" section so agents that can't coordinate can still both write without conflicting (appends never collide).

**Relevance to this repo**: `power-mode`, `tackle`, and `now` already run concurrent subagents, several of which (`/wiki-ingest`, `/task-add`, `/decision-create`) write to the same shared index files — the exact risk surface other implementers have already hit. The recommended design (per the research report) mirrors this repo's existing fail-open Serena health-tracking pattern in `lib/hooks/lib/serena.js` (enforce by default, degrade gracefully on confirmed failure, auto-recover) rather than inventing new locking semantics — scoped only to the specific shared index files that concurrent skills actually touch, not every wiki page. Recommended to hold until concrete (not hypothetical) concurrent-write corruption is observed.

> **Contradiction:** the paragraph above cites `uses::[[Serena Health-Tracking Hook]]` as the exemplar "fail-open... degrade gracefully... auto-recover" pattern this repo should imitate. `derived_from::[[Research: Serena MCP server disconnects mid-session]]` (2026-07-07) found and live-reproduced the exact class of bug this concept page warns about, *inside that same hook*: its per-project state file (`~/.claude/state/lsp-ready-<hash>`) is read-modified-written with no locking, and concurrent Serena tool calls were observed racing and corrupting the recorded health state (`should_enforce: true` left standing even after the process was confirmed dead). That hook also has a separate, more severe defect — it actively `pkill`s a live Serena process on a misclassified error (see `relates_to::[[Responded Error Proves Liveness]]`), which is worse than "degrade gracefully." **It should no longer be cited as the model to mirror until both bugs are fixed**; if anything it is now the concrete (not hypothetical) concurrent-write corruption incident this page's last sentence says to wait for.
