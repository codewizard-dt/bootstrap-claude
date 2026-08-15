---
topic: what are the implications of defining a mcp server in ./.mcp.json versus ~/.claude.json ?? like are there performance or behavior differences??
slug: mcp-scope-performance-behavior
researched: 2026-08-15
sources: [./sources.md]
---

# Research: `.mcp.json` vs `~/.claude.json` — implications, performance, and behavior

> **Answer in brief:** No — there is no performance or runtime-speed difference. Server-process spawning, connection handshake, and timeouts are governed entirely by **transport type** (stdio vs HTTP/SSE/WebSocket), not by which file the config lives in. What actually differs between `.mcp.json` (project scope) and `~/.claude.json` (local/user scope) is **visibility, sharing, precedence, and trust/approval behavior** — and those differences are substantial enough to have caused two real incidents in this repo's own history.

## Research Questions
- Where exactly is each scope stored on disk, and what does `claude mcp add --scope <x>` map to?
- If the same server name exists in more than one scope, which one wins, and does Claude Code merge or fully override?
- What are the practical team/sharing consequences of `.mcp.json` being git-tracked vs `~/.claude.json` being machine-local?
- Are there real behavioral differences (approval prompts, per-machine disabling, headless vs interactive) beyond "which projects see it"?
- Is there any actual performance or startup-time difference tied to scope specifically?

## Current State (Codebase)

This repo has hands-on history with exactly this question, predating this report:

- `lib/scripts/install-mcps.sh` registers four MCP servers across three different scopes on purpose: Serena at `--scope local`, Brave Search and Playwright (macOS) at `--scope user` (shared HTTP/Docker/launchd servers), Context7 at a user-chosen scope [S1].
- Two real incidents already document scope-collision failure modes in this exact codebase:
  - **Serena mis-scoped to `project`** — an earlier version of the installer ran `claude mcp add --scope project serena -- uvx … --project <absolute-path>`, baking a machine-specific absolute path into a file (`.mcp.json`) meant to be shared via git. Every other clone got an entry pointing at a directory that doesn't exist for them, and Serena silently failed to start. Fixed by switching to `--scope local` [S2].
  - **Playwright scope conflict on a teammate's machine ("steno")** — a pre-existing project-scoped stdio `playwright` entry in `.mcp.json` collided with an installer upgrade path that only knew how to remove *user*-scoped entries, producing Claude Code's `[Conflicting scopes]` warning and silently leaving the (unwanted) project-scope entry as the one actually in effect, because local/project scope always outranks user scope [S3].
- `CLAUDE.md`'s own "Manual setup steps" section documents the same rule this research confirms: Serena must be `--scope local` because project/user scope either leaks a machine-specific path into the shared `.mcp.json` or bleeds language config across unrelated projects [S1 / memory: Serena per-project scope].
- **Stale inconsistency spotted during this research**: `README.md` line 139/208 (architecture diagram) correctly say "Serena (local scope)", but line 247 ("Design Decisions") still says *"Serena is registered against an absolute project path in `.mcp.json`"* — describing the old, already-fixed project-scope behavior. Worth a doc fix; flagged here rather than silently corrected, per the wiki's contradiction-flagging convention.

## Key Findings

### 1. Three scopes, three storage locations — confirmed against the current official docs

| Scope | Loads in | Shared with team | Stored in |
|---|---|---|---|
| **Local** (default) | Current project only | No | `~/.claude.json`, under that project's own entry (keyed by absolute project path) |
| **Project** | Current project only | Yes, via version control | `.mcp.json` at the project root |
| **User** | All your projects | No | `~/.claude.json`, at the top level |

`claude mcp add --scope local|project|user <name> ...` maps directly to these three; `local` is the default when `--scope` is omitted [S4]. Both "local" and "user" scope live in the *same physical file* (`~/.claude.json`) but at different keys — local is nested under the current project's path, user is top-level and therefore visible from every project on the machine [S4].

### 2. Precedence is a strict override, never a merge

When the same server name exists in more than one scope, Claude Code connects using **only** the highest-precedence definition — it does not combine fields from multiple scopes. The order is:

1. Local scope
2. Project scope
3. User scope
4. Plugin-provided servers
5. claude.ai connectors

The first three are matched by server **name**; plugins and claude.ai connectors are matched by **endpoint** (same URL/command counts as a duplicate even under a different name) [S4]. This is exactly the mechanism behind this repo's Playwright incident: the project-scope stdio entry silently outranked the newly-installed user-scope HTTP entry, so the "upgrade" had no effect until the conflicting scope was manually removed [S3][S4].

One extra edge case: in the Desktop app's Code tab, if the *same* stdio server name exists at user scope in `~/.claude.json` and in `.mcp.json`, the Code tab specifically uses the `~/.claude.json` (user-scope) definition — a Desktop-only exception to the local/project/user ordering above [S4].

### 3. Sharing and versioning have real, asymmetric consequences

- `.mcp.json` is meant to be committed — "everyone on your team gets the same MCP tools." `~/.claude.json` is per-machine and is never meant to be committed (it also holds unrelated session state) [S4].
- Because `.mcp.json` "arrives with cloned code," Claude Code does **not** trust it automatically: in interactive sessions it shows a per-teammate approval prompt the first time a project-scoped server is used, and `claude mcp reset-project-choices` clears previously-made approval decisions [S4].
- **Headless paths skip that prompt entirely.** `claude -p`, Agent SDK sessions, and cloud (web) sessions load project-scoped servers **without asking** — there's no interactive surface to prompt on. A session started in `bypassPermissions` mode with `skipDangerousModePermissionPrompt` set also skips it. The only way to keep an unwanted project-scoped server out under those conditions is `disabledMcpjsonServers` (blocks it in *every* mode, interactive or not) or excluding project settings entirely via `--setting-sources` / the SDK's `settingSources` option [S4]. This is a meaningful behavior difference the user's question implies but doesn't ask directly: **a checked-in `.mcp.json` server that a human would be prompted to approve interactively runs unprompted in every headless/CI/cloud context** unless explicitly disabled.
- **Workspace-trust interaction (as of Claude Code v2.1.196):** `claude mcp list`/`claude mcp get` only honor `.mcp.json` approvals recorded in settings files that are **not** checked into the repo, until the workspace is explicitly trusted (accepting the trust dialog by running `claude` interactively in that folder). Concretely: a freshly cloned repo cannot "self-approve" its own project-scoped servers by committing `enableAllProjectMcpServers`/`enabledMcpjsonServers` into `.claude/settings.json` — that setting is ignored in an untrusted folder, and the server sits at `⏸ Pending approval` regardless. Approvals from `~/.claude/settings.json` (user settings), managed settings, or `--settings <file>` still apply even in an untrusted folder [S4].
- **Portability nuance not previously confirmed in this repo's own research**: Claude Code supports environment-variable expansion (`${VAR}`, `${VAR:-default}`) inside `command`/`args`/`env` of a project-scoped `.mcp.json` entry, *and* inside local- or user-scoped entries in `~/.claude.json`. Claude Code also sets `CLAUDE_PROJECT_DIR` in the spawned stdio server's own environment automatically. However, `CLAUDE_PROJECT_DIR` is only set inside the *server's* environment, not Claude Code's own — so referencing it via `${CLAUDE_PROJECT_DIR}` inside a config value requires a fallback default, e.g. `${CLAUDE_PROJECT_DIR:-.}` [S4].

  > **Contradiction / update to prior research:** `wiki/knowledge/sources/serena-mcp-scope.md` (2026-08-14) states *"No variable-expansion mechanism for `.mcp.json` paths was found in the sources reviewed, so there's currently no way to make a project-scoped entry portable."* The current official docs describe exactly such a mechanism (`${CLAUDE_PROJECT_DIR:-.}` expansion, general `${VAR}`/`${VAR:-default}` support). This doesn't overturn the recommendation to keep Serena at local scope (its `--project <path>` argument still needs to resolve correctly, and no test was run here to confirm `${CLAUDE_PROJECT_DIR}` actually substitutes cleanly for that specific `--project` flag position, nor whether it was newly documented or simply missed in the prior pass) — but it is new information worth a follow-up check before restating the "no portability mechanism exists" claim as settled fact. *(flagged as an open question, not independently verified here)*

### 4. No documented performance or startup-time difference tied to scope

A full read of the "MCP installation scopes" section and the surrounding server-lifecycle documentation (timeouts, reconnection/backoff, idle timeout, automatic backgrounding of long tool calls) contains **no mention of scope affecting speed, spawn behavior, or connection mechanics** [S4]. Every performance-relevant behavior documented is keyed to **transport type**, not scope:

- Stdio servers are spawned as local subprocesses; HTTP/SSE servers connect over the network with automatic reconnection (up to 5 attempts, exponential backoff from 1s) if they disconnect mid-session; stdio servers are *not* auto-reconnected [S4].
- Idle timeout defaults differ by transport (5 minutes for HTTP/SSE/WebSocket/connectors, 30 minutes for stdio), again transport-keyed, not scope-keyed [S4].
- This repo's own prior research on MCP process counts confirms the same conclusion from a different angle: **stdio's "one client : one subprocess" behavior is an MCP protocol property**, independent of scope. A stdio server registered at user scope still spawns one fresh process **per Claude Code session** — scope does not reduce or share processes. The only way to get one shared server process across concurrent sessions is to register the server over HTTP against a long-lived server process (this is exactly why brave-search and Playwright are registered as user-scope **HTTP** servers backed by a persistent Docker container / launchd agent in this repo, not because user scope itself is faster) [S5].

So: **scope changes where config is read from and who/what can see and trust it — never how the server process is spawned, how fast it connects, or how many processes exist.**

### 5. Gotchas and pitfalls (from this repo's own incident history + docs)

- **Silent shadowing on name collision.** Because precedence is override-not-merge, a stale local- or project-scope entry can silently shadow a newly-installed, intentionally-shared user-scope server — no error, just the wrong server winning, surfaced only via `claude mcp list`'s `[Conflicting scopes]` warning or by noticing the "upgrade" had no effect [S3][S4].
- **Committing a machine-specific value into `.mcp.json` is the structural equivalent of committing a personal credential** — it works for exactly the machine that wrote it and silently breaks for every other clone (Serena's `--project <absolute-path>` incident) [S2].
- **No `--json` output from `claude mcp get`** as of the versions checked in this repo's own scripts, forcing scope-detection tooling to text-grep a `Scope:` line — brittle, and this repo's install script had to build a dedicated `mcp_user_scoped()` helper that fails safe (skip, never auto-remove) specifically because of this [S3].
- **`claude mcp add`'s variadic flags (`-H`/`--header`, `-e`/`--env`) swallow positional arguments** if placed before the server name/command — unrelated to scope specifically, but a live footgun in any scripted `claude mcp add --scope ...` call in this repo (memory: `gotchas/claude-mcp-add-variadic-options`).
- **A cloned repo cannot self-trust its own `.mcp.json`.** Team leads sometimes assume committing `enabledMcpjsonServers` to `.claude/settings.json` is enough to make project-scope servers "just work" for new teammates — as of v2.1.196 it is not, until each teammate individually accepts the workspace-trust dialog [S4].

## Constraints

- This report answers the general Claude Code question; it does not re-run or re-verify this repo's own install scripts (no `install-mcps.sh` edits were made or proposed here).
- The `${CLAUDE_PROJECT_DIR}` portability finding (§3) is documented but not independently tested against Serena's actual `--project` argument in this session — treat it as a lead for a follow-up, not a verified fix.

## Recommendation

For anyone deciding where to put a new MCP server registration:

- **Use `project` scope (`.mcp.json`, committed)** only when the config is *identical for every teammate* — a URL-based connector, a hosted docs server, nothing containing an absolute path, API key, or other machine/person-specific value. Expect a one-time approval prompt per teammate in interactive sessions (and none in headless/CI/cloud paths — plan around `disabledMcpjsonServers` if that's a problem).
- **Use `local` scope (`~/.claude.json`, default)** for anything machine- or person-specific: local dev servers, anything with an absolute path argument (like Serena's `--project`), personal experimentation.
- **Use `user` scope (`~/.claude.json`, top-level)** for genuinely cross-project personal tools you want available everywhere, or as the target for a shared long-lived HTTP server (Docker container, launchd/systemd service) that every session should reuse rather than re-spawn.
- **Do not choose scope for performance reasons** — there isn't one. Choose scope purely for the visibility/sharing/trust semantics above; choose **transport** (stdio vs HTTP) if process-count/perf actually matters (one shared HTTP server vs. N per-session stdio subprocesses).

**Risks and mitigations:** the biggest real-world risk is the silent-override precedence rule — always check `claude mcp list` for `[Conflicting scopes]` after any bulk MCP re-registration, and prefer scripted scope-detection over assuming a name is unclaimed.

**If constraints change:** if Claude Code ships first-class `.mcp.json` path templating that's confirmed to work with flags like `--project` (see the `${CLAUDE_PROJECT_DIR}` lead above), the "never put Serena in `.mcp.json`" guidance could soften to "put it in `.mcp.json` using `${CLAUDE_PROJECT_DIR}`" — worth a dedicated follow-up test before changing any code.

## Next Steps

- Optional doc fix: `README.md` line 247 still describes Serena as registered "against an absolute project path in `.mcp.json`" — stale relative to the local-scope fix already shipped and already reflected elsewhere in the same file (lines 139, 208). Low-risk one-line correction.
- Optional follow-up research: test whether `${CLAUDE_PROJECT_DIR:-.}` expansion actually resolves correctly when substituted into Serena's `--project` argument specifically, which would reopen the "can project-scope ever be portable" question for machine-specific-path servers in general.
- `/wiki-ingest raw/research/mcp-scope-performance-behavior/index.md` to fold this into the knowledge base — it directly extends `mcp-server-scope-model` and `serena-mcp-scope`, and should probably record the `${CLAUDE_PROJECT_DIR}` contradiction as a `> **Contradiction:**` callout on the existing `serena-mcp-scope.md` page rather than only living here.
