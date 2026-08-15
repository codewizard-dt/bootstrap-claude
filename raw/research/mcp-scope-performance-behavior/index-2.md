---
topic: what are the implications of defining a mcp server in ./.mcp.json versus ~/.claude.json ?? like are there performance or behavior differences?? (addendum — teammate cross-check)
slug: mcp-scope-performance-behavior
researched: 2026-08-15
sources: [./sources-2.md]
---

# Research: `.mcp.json` vs `~/.claude.json` — addendum from an independent cross-check

> Builds on [index.md](index.md); this update covers only what's new or changed, not a restatement. A parallel `claude-code-guide` agent, launched earlier in the same session but slow to return, delivered its own independent pass against the same official doc after `index.md` was already written and ingested. Its core conclusions (scope table, precedence, approval-prompt/headless-skip behavior, no scope-tied performance difference) match `index.md` exactly — no contradiction. Two items are genuinely new and worth recording; a few of the agent's other claims are explicitly flagged as unconfirmed and are **not** carried into this addendum.

## What's new

**1. A confirmed, unfixed secret-leak footgun in `claude mcp add` itself (independently re-verified in this session, not just relayed).** GitHub issue [anthropics/claude-code#18692](https://github.com/anthropics/claude-code/issues/18692), reported against Claude Code v2.1.9: running `claude mcp add` against an existing `.mcp.json` that already contains `${VAR}`-style placeholders (e.g. `${GITHUB_PERSONAL_ACCESS_TOKEN}`) causes the CLI to **resolve those placeholders and write the literal secret value back into the file**, rather than preserving the placeholder syntax — even though only a new, unrelated server entry was being added. **Status: closed as "not planned"** — Anthropic has not committed to fixing this. This directly undercuts the "env var expansion keeps secrets out of `.mcp.json`" safety story documented elsewhere on the same page: the expansion mechanism is safe to *read*, but re-running `claude mcp add` against a file that already uses it is not safe to *write*. Practical implication for a team relying on a committed `.mcp.json` with placeholder secrets: **never run `claude mcp add` a second time against that file without diffing the result before committing** — it can silently hardcode a live credential into version control.

**2. Documented performance-adjacent mechanics that are still transport/flag-driven, not scope-driven — refines rather than reverses `index.md` §4's conclusion.** The docs describe a discovery cache and blocking/non-blocking startup behavior for remote servers, none of it scope-conditional:
- Previously-used HTTP/SSE servers can load from a cached discovery result at startup (shown as `cached 2h ago · connects on first use · N tools`) instead of reconnecting immediately, connecting lazily on first tool call instead. `MCP_DISCOVERY_CACHE=0` forces a fresh startup connection for every server. (Requires Claude Code v2.1.221+.)
- A server entry can set `alwaysLoad: true` to make session startup wait for that specific server's tools (capped at a 5-second connect timeout); other servers connect in the background by default unless `MCP_CONNECTION_NONBLOCKING=0` is set globally.
- Both mechanisms apply identically to a server regardless of which scope it's registered at — an HTTP server with `alwaysLoad: true` blocks startup the same way whether it lives in `.mcp.json` or `~/.claude.json`. This is additional confirming evidence for `index.md`'s "no performance difference tied to scope" conclusion, not a revision of it.

## What was flagged as unconfirmed and is deliberately NOT carried forward

The cross-check agent explicitly distinguished verified from unverified claims from its own sub-agent's earlier pass, and this addendum preserves that distinction rather than laundering it into fact:
- A list of ~10 other GitHub issue numbers (env-var-blind deduplication, etc.) — only #18692 above was independently verified (by the cross-check agent, and separately re-verified in this session via direct fetch). The others are not cited here and should not be treated as confirmed until someone opens them directly.
- Whether `claude mcp list` prints a scope label per server in its output — the cross-check agent found no documented column/flag for this. Note this doesn't contradict `index.md`'s S3 (this repo's own `install-mcps.sh` tooling successfully greps a `Scope:` line from `claude mcp get <name>` output in practice) — `claude mcp get` (single-server detail) and `claude mcp list` (table) may simply differ in what they print; this remains unresolved rather than reconciled.
- Precise file-location constraints for `disabledMcpjsonServers`/`enabledMcpjsonServers` beyond "any settings file" — not fetched by either pass.

## Recommendation (unchanged, with one addition)

`index.md`'s recommendations stand. Add one operational rule for any team (including this repo, if `.mcp.json` config with placeholder secrets is ever adopted): **treat `claude mcp add` as unsafe to run against a `.mcp.json` that already contains `${VAR}` placeholders without reviewing the diff before committing** — per confirmed, unfixed GitHub issue #18692.

## Next Steps

- No code in this repo currently stores secrets as `${VAR}` placeholders inside a committed `.mcp.json` (Context7's API key, for example, is registered via `--header` at add-time, not templated in a checked-in file), so issue #18692 is not an active risk here today — but worth a one-line callout in `wiki/guides/mcp-tools.md` or `CLAUDE.md`'s MCP section if this repo's guidance ever shifts toward committed placeholder-based `.mcp.json` secrets.
- `/wiki-ingest raw/research/mcp-scope-performance-behavior/index-2.md` to fold the #18692 finding into the existing `mcp-server-scope-model` concept page's gotchas list.
