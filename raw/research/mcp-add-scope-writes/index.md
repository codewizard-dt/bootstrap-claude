---
topic: Research the specific 'claude mcp add' lines in this repo (history + present) and the 'mcp add' scope API to determine why steno ended up with conflicting playwright scopes and why serena landed in the project's .mcp.json.
slug: mcp-add-scope-writes
researched: 2026-07-29
sources: [./sources.md]
---

# Research: This repo's `mcp add` lines vs the `mcp add` scope API — why steno broke

> Builds on [mcp-scope-conflict-handling](../mcp-scope-conflict-handling/index.md). Two distinct defects, neither caused by any change to the `claude mcp add` API (every script version passes `--scope` explicitly, so the CLI's `local` default never applied). **(1) Playwright:** steno's project-scoped stdio entry was pre-existing repository config (user attestation [S6]); the 2.11.0 upgrade path only knows how to replace user-scoped entries (`claude mcp remove -s user`), so it added the shared HTTP server on top → `[Conflicting scopes]`. **(2) Serena:** bootstrap registers serena with `--scope project`, which writes a machine-specific absolute path (`--project /Users/<user>/…`) into the repo's shared `.mcp.json` — the wrong scope. It belongs at **local scope** (`--scope local`), stored in `~/.claude.json` under the project's entry: still per-project (no serena language-config bleed, oraios/serena#895) but machine-local, and local-scope servers load headlessly without the `.mcp.json` approval gate.

## Research Questions
- Did a `claude mcp add` API change cause either problem?
- Where did steno's project-scoped playwright entry come from?
- Why did serena land in `.mcp.json`, and what scope should it use?
- Which current `mcp add` call sites can still write to a project's `.mcp.json`?

## Current State (Codebase)
`claude mcp add` call sites in `lib/scripts/install-mcps.sh` (working tree):
- **serena** — `claude mcp add --scope project serena -- uvx …` run in `$PROJECT_DIR` → writes `.mcp.json` with a machine-specific absolute path. **Defect: should be `--scope local`** [S1][S6].
- **brave-search** — `mcp_add_scoped user …` (hardcoded user; shared Docker container) [S1].
- **context7** — `mcp_add_scoped "$1" …` where `$1` comes from `prompt_scope` → a "p" answer writes `.mcp.json` (legitimate: URL-based, no machine-specific paths) [S1].
- **playwright** — Darwin: hardcoded user (shared HTTP); non-Darwin: scope-prompt honored (stdio) [S1].
- UX inconsistency: `register_optional_mcp` asks `prompt_scope` for every optional MCP, then brave (and playwright-on-macOS) silently ignore the answer [S1].

## Key Findings
- **No `mcp add` API change involved**: `-s/--scope` (local | user | project, default `local`) — all script versions pass it explicitly [S2][S3] *(that the default never changed is an inference — no primary source; irrelevant given explicit flags)*.
- **Scope storage semantics**: `project` scope → `.mcp.json` in the repo (shareable, requires per-user approval, wins over user scope); `local` scope → `~/.claude.json` under the project's entry (machine-local, per-project, no approval gate); precedence local > project > user, no field merging [S3][S5].
- **Playwright**: steno's `.mcp.json` entry (`npx @playwright/mcp@latest`) was pre-existing repo config [S6]. (Historical note: bootstrap 2.7.0–2.10.0 *could* produce identical entries via its scope prompt [S2], but that is not what happened here.) The 2.11.0-2.11.2 upgrade path removes only `-s user` before re-adding → duplicate registration [S4].
- **Serena**: the entry in steno's `.mcp.json` was written by bootstrap's own setup script (it was not pre-existing) [S6]. `--scope project` bakes `--project /Users/david/Repositories/steno` into a file that may be committed/team-shared — broken for every other machine that clones the repo, and it forces the `.mcp.json` approval gate that broke headless `bootstrap-serena.sh` yesterday. Local scope fixes all three: machine-local storage, valid absolute path, no approval prompt [S3][S5][S6].

## Constraints
- `.mcp.json` is repository-owned config; the script may only *remove* entries from it with explicit interactive consent (Option C decision, prior report).
- bash 3.2; no `--json` on `claude mcp get` — scope detection greps the `Scope:` line and must fail safe (unknown → touch nothing).
- Existing installs have serena in `.mcp.json` (this repo included) — need a consented migration path, not just a new default.

## Recommendation
1. **Serena → `--scope local`** in `install-mcps.sh` (and every doc/error message that teaches the `--scope project` form); detection switches from grepping `.mcp.json` to `claude mcp get serena` run in the project dir (covers all scopes). Offer an interactive migration when serena is found in `.mcp.json`.
2. **Option C for the shared-server upgrade path**: `mcp_scope_of()` helper (user | project | local | unknown); user-scoped stale entry → silent upgrade as today; project/local-scoped → interactive y/N "migrate to the shared server (removes the <scope>-scope entry)?"; non-interactive or unknown → skip + print the manual command.
3. **Stop asking scope questions that are ignored**: `fixed_scope` argument so brave (always) and playwright (macOS) skip `prompt_scope`.
4. `bootstrap-serena.sh`: use `--mcp-config .mcp.json --strict-mcp-config` only when `.mcp.json` actually contains serena (legacy layout); plain `claude --print` otherwise — local-scope serena loads headlessly without the approval gate.

## Next Steps
- Implement the four changes; ship as 2.11.3.
- Steno: on next `bootstrap update`, answer "y" to migrate playwright; serena entry in its `.mcp.json` gets the same consented migration.
- `/wiki-ingest raw/research/mcp-add-scope-writes/index.md` (pairs with `mcp-scope-conflict-handling`).
