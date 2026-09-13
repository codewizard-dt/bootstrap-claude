---
topic: other harnesses, skill libraries, hook implementations, etc and identify potential new features
slug: claude-code-ecosystem-2026
researched: 2026-09-13
---

# Primary Sources — Claude Code Ecosystem Survey

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S4 | codebase | `mcp__serena__search_for_pattern` over `lib/skills/`, `lib/hooks/`, `lib/scripts/`, repo root | 2026-09-13 | Confirmed no `isolation: worktree` usage in any skill, four sandbox-as-residual-risk mentions with no scaffolding, zero cost/token tracking code, no `.claude-plugin/`/`marketplace.json` anywhere in the repo |
| S5 | web | https://claudefa.st/blog/tools/resources/awesome-claude-code | 2026-09-13 | 2026 ecosystem scale: quemsah/awesome-claude-plugins indexed 15,134 plugin repos by May 2026; obra/superpowers crossed 94k stars and was accepted into the official Anthropic skills marketplace |
| S7 | web | https://code.claude.com/docs/en/discover-plugins | 2026-09-13 | Official plugin marketplace mechanics: auto-registers `claude-plugins-official` on first interactive launch; `/plugin marketplace add`, `/plugin install` |
| S8 | web | https://github.com/anthropics/claude-plugins-official | 2026-09-13 | Canonical plugin directory structure (`.claude-plugin/plugin.json`, `commands/`, `agents/`, `skills/`, `.mcp.json`) |
| S9 | web | https://dev.to/nagell/build-your-own-claude-code-marketplace-scaffold-structure-and-auto-updates-4n3f | 2026-09-13 | Concrete marketplace repo layout: `.claude-plugin/marketplace.json` registry + per-plugin `plugin.json`/`hooks/hooks.json`/`skills/`/`agents/`/`.mcp.json` |
| S10 | web | https://code.claude.com/docs/en/plugin-marketplaces | 2026-09-13 | `marketplace.json` schema fields (source, category, tags, strict, relevance, headers) |
| S13 | web | https://blog.fsck.com/2025/10/09/superpowers/ ; https://github.com/obra/superpowers | 2026-09-13 | Superpowers' SessionStart-hook-injected "you have Superpowers, go read this skill" forcing pattern; official-marketplace install path (`/plugin install superpowers@claude-plugins-official`) |
| S15 | web | https://www.reddit.com/r/ClaudeAI/comments/1qw9hr4/claude_code_has_an_undocumented_persistent_memory/ | 2026-09-13 | Confirms Claude Code's native per-project `~/.claude/projects/<path>/memory/MEMORY.md` mechanism is a first-party platform feature (not a plugin), corroborating this repo's Auto-Memory-vs-wiki distinction |
| S16 | web | https://github.com/lasso-security/claude-hooks ; https://www.lasso.security/blog/the-hidden-backdoor-in-claude-coding-assistant | 2026-09-13 | PostToolUse prompt-injection content scanner architecture: scans Read/WebFetch/Bash/Grep/Task/MCP outputs against 50+ patterns, warns (does not block) to avoid false-positive blocking on legitimate security content |
| S17 | web | https://www.anthropic.com/engineering/claude-code-sandboxing | 2026-09-13 | Official sandboxing architecture: filesystem + network isolation, proxy-mediated domain allowlisting, Claude Code on the web running each session in an isolated cloud sandbox |
| S18 | web | https://code.claude.com/docs/en/sandboxing | 2026-09-13 | `sandbox` settings config detail: `enableWeakerNestedSandbox` for Docker-nested use, `excludedCommands`, explicit note that `docker` commands are incompatible with the sandbox |
| S19 | web | https://ccusage.com/ | 2026-09-13 | Local, offline JSONL-based token/cost CLI pattern (no API key, no network call) — daily/monthly/session/5-hour-block reports |
| S20 | web | https://code.claude.com/docs/en/costs | 2026-09-13 | Official confirmation that Claude Code doesn't self-report per-user cost outside the Console/OTel/JSONL paths; recommends the same local-parsing approach as ccusage for individual visibility |
| S21 | web | https://code.claude.com/docs/en/worktrees | 2026-09-13 | Official `isolation: worktree` subagent frontmatter primitive; explicit statement that a fan-out call to the same agent role gets one worktree per invocation |
| S22 | web | https://www.developersdigest.tech/blog/git-worktrees-claude-code-parallel-agents-guide | 2026-09-13 | Per-worktree MCP-server scoping guidance and the "wire cleanup into your daily flow, stale worktrees are the biggest reason teams give up" caveat used in the Risks section |
| S23 | web | https://code.claude.com/docs/en/statusline | 2026-09-13 | Official statusline mechanism: arbitrary shell command fed a per-tick JSON blob, generatable via `/statusline` |

## Excerpts

### S16 — Lasso Security, "The Hidden Backdoor in Claude Code"
https://www.lasso.security/blog/the-hidden-backdoor-in-claude-coding-assistant
> The defender operates as a PostToolUse hook—a mechanism in Claude Code that runs after any tool execution but before Claude processes the results. Think of it as a security scanner sitting between the untrusted world and Claude's context window... We deliberately chose not to block suspicious content outright. Why? False positives happen. Security research, documentation about attacks, and legitimate code can trigger patterns.

### S18 — Claude Code Docs, "Configure the sandboxed Bash tool"
https://code.claude.com/docs/en/sandboxing
> The `enableWeakerNestedSandbox` mode... enables it to work inside Docker environments without privileged namespaces... docker commands fail: docker is incompatible with the sandbox.

### S21 — Claude Code Docs, "Run parallel sessions with worktrees"
https://code.claude.com/docs/en/worktrees
> This subagent in `.claude/agents/` always runs in its own worktree: `isolation: worktree`... The `isolation: worktree` field applies per agent invocation, not per agent definition. If the orchestrator calls the researcher agent three times in parallel, each invocation gets its own worktree.

### S5 — Claudefast, "Awesome Claude Code: 11 Curated Lists Worth Bookmarking"
https://claudefa.st/blog/tools/resources/awesome-claude-code
> Three forces reshaped the list ecosystem in 2026. quemsah/awesome-claude-plugins indexed 15,134 Claude Code plugin repositories by May 1, 2026, up from roughly 4,000 a year earlier. obra/superpowers crossed 94,000 stars and was officially accepted into the Anthropic skills marketplace, signalling that community frameworks are now first-class citizens.
