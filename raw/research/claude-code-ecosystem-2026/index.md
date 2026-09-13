---
topic: other harnesses, skill libraries, hook implementations, etc and identify potential new features
slug: claude-code-ecosystem-2026
researched: 2026-09-13
sources: [./sources.md]
---

# Research: Claude Code Ecosystem Survey — New Feature Candidates for bootstrap-claude

> bootstrap-claude already covers most of what the community ecosystem builds ad hoc — an LLM-wiki knowledge base, 61+ skills, a mature layered hook-security system, MCP setup automation, and multi-agent orchestration (`now`/`tackle`/`power-mode`). The genuine gaps against 2026 harnesses, skill libraries, and hook implementations cluster around six areas: native plugin-marketplace distribution, first-class git-worktree isolation for parallel subagents, OS-level sandboxing (which the repo's own hook docs already name as the missing containment layer), tool-output content scanning for prompt injection, cost/token usage visibility, and a statusline surfacing this repo's own state (Serena health, active roadmap/task). The highest-leverage, lowest-risk additions are worktree isolation on code-writing subagents and scaffolding native sandbox config — both wire directly into infrastructure this repo already documents as desirable but unbuilt.

## Research Questions
- What do other "harnesses" (SuperClaude, Superpowers, claude-code-templates) add on top of raw Claude Code that this repo doesn't?
- What do community skill/subagent libraries (wshobson/agents, awesome-claude-code, claude-code-subagents-collection) do differently from this repo's 61-skill suite?
- What hook patterns exist elsewhere (observability, prompt-injection defense, auto-lint-on-save) that this repo's hook system doesn't cover?
- What official Claude Code platform features (plugins, worktrees, sandboxing, statuslines, cost APIs) has this repo not yet adopted?
- Which of these gaps are worth building, given bootstrap-claude's existing architecture and stated design constraints?

## Current State (Codebase)

- **Distribution**: 100% custom — `lib/scripts/install-global.sh` rsyncs `lib/skills/` and `lib/hooks/` to `~/.claude/` and merges deny-list/hook-wiring JSON templates. No `.claude-plugin/marketplace.json` or `plugin.json` exists anywhere in the repo [S4].
- **Skills**: 61 skills in `lib/skills/<name>/SKILL.md`, categorized `researching | planning | executing | wiki`, with a deliberate three-tier model-selection convention (opus for deep reasoning, sonnet default, haiku for mechanical work) [memory: `skills/format-and-model-selection`].
- **Hooks**: A mature, two-tier hook system — safety/policy hooks (`env-file-guard.js`, `git-protected-ops-block.js`) plus six "command-class guards" that parse Bash segments to catch invocation forms a `deny` rule structurally cannot (`interpreter-indirection-guard.js`, `package-install-consent.js`, `absolute-path-guard.js`, `protected-write-guard.js`, `claude-settings-guard.js`, `env-content-read-guard.js`) — plus nine Serena-first enforcement hooks with documented fail-open health tracking [`lib/hooks/README.md`].
- **No worktree isolation** anywhere in `lib/skills/` — confirmed by pattern search; the only "worktree" hits are `git-commit`'s unrelated `--show-toplevel` discussion [S4].
- **No sandbox configuration scaffolding** — `/sandbox` is referenced four times across `lib/hooks/README.md` and `lib/scripts/README.md`, every time as the acknowledged answer to a hook's own stated residual risk ("the only real containment for a compromised agent is OS-level sandboxing"), but nothing in `lib/scripts/` sets it up [S4].
- **No cost/token tracking** anywhere in `lib/` [S4].
- **Existing dashboard precedent**: `lib/scripts/wiki-dashboard-server.js` is a zero-dependency Node server serving the wiki's `wiki/work/` state read-only over HTTP — the repo already has the pattern (and the taste) for a lightweight local dashboard, just scoped to wiki data today, not hook/agent events.

## Key Findings

**1. Plugins are now the platform-native distribution unit, and the ecosystem has moved onto it fast.** Anthropic's official marketplace (`claude-plugins-official`) auto-registers on first interactive launch and ships ~100 first-party/partner plugins bundling skills+agents+hooks+MCP servers together [S7][S8]; a marketplace is just a git repo with `.claude-plugin/marketplace.json` naming plugin sources, each with its own `plugin.json` [S9][S10]. Community indexing tools now track over 15,000 third-party plugin repos [S5]. `obra/superpowers` — a brainstorm→plan→TDD→review workflow skill pack, structurally similar in ambition to this repo's `req-create → decision-create → task-add → tackle → uat` pipeline — was accepted into the official marketplace and crossed ~94-170k stars [S5][S13], and installs via `/plugin install superpowers@claude-plugins-official` rather than a custom CLI script.

**2. `isolation: "worktree"` is now a first-class Claude Code primitive for subagents**, not just a manual git pattern. A subagent's own frontmatter can declare `isolation: worktree` so every invocation of that agent role gets its own working directory backed by the shared `.git`, and — notably — a fan-out call (the same agent invoked N times in parallel, which is exactly `now`/`power-mode`'s shape) gets N separate worktrees automatically [S21][S22]. This is not adopted anywhere in `lib/skills/` today [S4], even though `now`, `tackle`, and `power-mode` are explicitly described (in this repo's own CLAUDE.md optional-tooling section) as running "heavy concurrent subagent orchestration."

**3. Native OS-level sandboxing (bubblewrap on Linux, Seatbelt on macOS) shipped as an official Claude Code feature**, giving filesystem and network isolation with a proxy-mediated domain allowlist, addressable via a `sandbox` block in settings [S17][S18]. This is significant specifically *because* `lib/hooks/README.md` already states, four separate times, that hooks are a "guardrail, not a boundary" and that real containment requires exactly this OS layer — the repo has already done the design thinking, it just hasn't scaffolded the config.

**4. Prompt-injection defense-in-depth via PostToolUse content scanning is an established, non-redundant hook pattern.** Lasso Security's `claude-hooks` scans Read/WebFetch/Bash/Grep/Task/MCP tool *outputs* (not inputs) against 50+ injection-pattern signatures and injects a warning into Claude's context rather than blocking — deliberately, because false positives on legitimate security research or docs are common [S16]. bootstrap-claude's `env-content-read-guard.js` scans for `.env` *secrets* leaving via tool output, but nothing scans untrusted *incoming* content (web fetches in `/research`, ingested sources in `/wiki-ingest`) for injected instructions — a structurally different threat the existing guard doesn't cover.

**5. Token/cost visibility is a mature, well-solved community problem with no footprint in this repo.** `ccusage` parses local `~/.claude/projects/**/*.jsonl` session logs entirely offline (no API key, no network call) into daily/monthly/per-session cost and cache-hit reports [S19]; Anthropic's own docs point enterprise users toward the same JSONL source or OTel export for the same reason: Claude Code doesn't self-report per-user cost anywhere else [S20]. Given this repo already curates a haiku/sonnet/opus tier per skill specifically to manage cost (`skills/format-and-model-selection` memory), it currently has no way to verify that tiering is actually saving money.

**6. Native memory and statuslines are both platform features this repo interacts with only partially.** Claude Code's own per-project `~/.claude/projects/<path>/memory/MEMORY.md` mechanism — which is exactly the Auto Memory system already in use in this session — is confirmed by community reverse-engineering as a first-party (if under-documented) feature, not a plugin [S15], validating that this repo's CLAUDE.md distinction between Auto Memory and the wiki is already correctly drawn. Statuslines, however, are a fully generic official mechanism (`/statusline`, a shell command fed a JSON blob per tick) [S23] that several community tools use to surface exactly the kind of state bootstrap-claude tracks internally but never displays: Serena health (`should_enforce`/`healthy` in the per-project state file), active roadmap/task, or wiki staleness.

## Constraints

- Any plugin-marketplace path must coexist with, not replace, the npm `@codewizard-dt/bootstrap` CLI without a breaking migration — existing installs rely on `install-global.sh`'s rsync+merge semantics (deny-list and hook-wiring are additive-only merges into `~/.claude/settings.json`).
- New hooks must follow the established commenting standard and fail-open/fail-closed contract documented in `lib/hooks/README.md` — a new content-scanning guard, if built, is a `PostToolUse` hook and cannot block (per that doc's own stated rule: "PostToolUse can prompt Claude with feedback but cannot undo the tool execution" — consistent with Lasso's warn-only design).
- `isolation: worktree` is an Agent-tool/subagent frontmatter property, not something a `SKILL.md` file controls directly — adopting it means updating the `now`/`tackle`/`power-mode` skill prompts to request worktree isolation when spawning code-writing subagents, not a hooks or scripts change.
- Sandbox scaffolding must not conflict with existing hook-based controls; `lib/scripts/README.md` and `lib/hooks/README.md` already frame OS sandboxing as complementary defense-in-depth, not a replacement.
- Any cost-tracking feature should reuse `ccusage`'s approach (parse local JSONL, no network, no API key) rather than requiring org Admin API access, to keep it usable by every individual developer install.

## Solution Comparison

| Candidate | Effort | Risk | Fit with existing architecture | Adopted elsewhere |
|---|---|---|---|---|
| **Worktree isolation for `now`/`tackle`/`power-mode`** | Low (prompt/frontmatter change) | Low | High — directly addresses this repo's own stated "heavy concurrent subagent orchestration" | Official Claude Code primitive [S21] |
| **Sandbox config scaffolding in setup scripts** | Medium (new setup step + docs) | Low | High — closes a gap the repo's own docs already name | Official Claude Code feature [S17][S18] |
| **Cost/usage report skill (`ccusage`-style)** | Low–Medium (new skill, JSONL parsing) | Low | Medium-high — validates the existing haiku/sonnet/opus tiering | Widely adopted community pattern [S19][S20] |
| **PostToolUse prompt-injection content scanner** | Medium (new hook + pattern list to maintain) | Medium (false positives, upkeep) | Medium — real gap, but adds a new signature list to maintain, unlike this repo's existing preference for parsing over blocklists | Established pattern (Lasso) [S16] |
| **Native plugin marketplace (`.claude-plugin/`)** | High (dual-distribution, versioning, migration) | Medium — could fragment install paths | Low-medium — competes with, doesn't obviously replace, the existing npm CLI + rsync model | Platform-native; fast-growing ecosystem norm [S7][S9] |
| **Statusline surfacing Serena health / active task** | Low | Low | Medium — nice-to-have, not load-bearing | Common community pattern [S23] |
| **Auto-lint-on-save PostToolUse hook (Builder/Validator pattern)** | Low–Medium | Low | Medium — this repo already has `/lint`/`/typecheck` as pull-based skills; making one push-based is a design choice, not a gap | Common community pattern (disler, GitButler) |

## Recommendation

Pursue the two lowest-risk, highest-fit items first, then evaluate the rest as separate decisions:

1. **Adopt `isolation: "worktree"` in `now`, `tackle`, and `power-mode`.** These skills already spawn parallel code-writing subagents; the only reason file collisions haven't bitten yet is discipline, not architecture. This is a skill-prompt edit, not new infrastructure — update each skill's agent-spawn instructions to request `isolation: "worktree"` for any subagent that writes code, and document the cleanup expectation (stale worktrees) the same way `git-commit`'s worktree-safety note already models good practice.
2. **Scaffold `sandbox` settings during `install-global.sh` / `setup-project.sh`.** Since the repo's own hook documentation has already concluded four times over that hooks are a guardrail and OS sandboxing is the real boundary, closing that gap is finishing work already started, not new scope. Suggest an opt-in step (interactive prompt, like the MCP install) rather than an unconditional default, given sandboxing can break workflows (`docker` commands are incompatible with the sandbox per Anthropic's own docs [S18]).
3. **Add a `/usage-report` (or similar) skill** that shells out to (or reimplements the core of) `ccusage`-style local JSONL parsing, scoped per-project, and surface a rollup in the wiki dashboard alongside `wiki/work/` state. This is cheap to build, has zero network/API dependency, and directly answers whether the existing model-tier curation is working.
4. **Treat the plugin-marketplace question as a decision, not a task.** It's the highest-effort, most architecturally significant item here (dual distribution paths, versioning semantics, how `bootstrap-prefs.js` and the deny-list merge would coexist with plugin-scoped settings) and deserves `/decision-create` rather than being folded into an ad hoc task.
5. **Defer the prompt-injection content scanner and the auto-lint hook** — both are real, well-precedented patterns, but neither addresses a gap this repo's own documentation already flags as unfinished (unlike sandboxing and worktrees), so they're good candidates for a future research pass once the higher-fit items land.

### Risks and mitigations

- **Worktree isolation**: stale worktrees accumulating on disk. Mitigation: document a cleanup step in the affected skills, mirroring the community guidance to wire a periodic `git worktree prune` [S22].
- **Sandbox scaffolding**: breaks workflows that need `docker` or other sandbox-incompatible tools (this repo's own `frontend-taste` skill runs `npm i && npm run dev`, which sandboxing wouldn't block, but Docker-based flows elsewhere would need `excludedCommands`). Mitigation: interactive opt-in, not a forced default, with a documented escape hatch.
- **Plugin marketplace**: risks fragmenting "how do I install this" into two answers (npm CLI vs. `/plugin install`). Mitigation: a decision file should explicitly settle whether the marketplace becomes the primary path, a secondary path, or is deferred.

### Alternative if constraints change

If this repo ever adopts a policy of centralizing hook enforcement across a team/org (rather than per-machine `~/.claude/hooks/` installs), the newer HTTP-type hook (`"type": "http"`, posting to a remote endpoint with auth headers) [community docs, noted but not separately sourced — see Excerpts] becomes relevant as a way to enforce the deny-list and command-class guards centrally instead of via rsync. Not recommended now — it's a significant architecture change with no current driver.

## Next Steps

- `/decision-create native plugin marketplace distribution` — frame the trade-off between the current npm/rsync installer and a `.claude-plugin/marketplace.json`-based path (or a dual-track approach).
- `/task-add Add isolation: worktree to now/tackle/power-mode subagent spawns for code-writing agents`
- `/task-add Scaffold optional sandbox config prompt in install-global.sh / setup-project.sh`
- `/task-add Add a /usage-report skill for local, offline Claude Code token/cost reporting scoped to the current project`
- Run `/wiki-ingest raw/research/claude-code-ecosystem-2026/index.md` to fold this into the wiki (see confirmation below for whether that ran automatically).
