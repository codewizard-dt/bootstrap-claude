---
title: Hot Cache
updated: 2026-07-29
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-07-29_

## Key Recent Facts

- **`.git/info/exclude` blinds Claude Code's `@` autocomplete** — new research (`git-exclude-at-autocomplete`) verified that rg-class tools honor `info/exclude` and recent Claude Code versions suggest only git-*tracked* files; no git-side layout (untracked, nested repos) fixes it. **Escape hatch: the documented `fileSuggestion` settings key** — a custom command replaces the picker and can re-include the bootstrap-excluded dirs. The prior "info/exclude is tool-invisible" claim is now narrowed to **Serena only**; concept page corrected, over-broad comments in `merge-gitignore.sh` + `templates/gitignore` still need fixing (queued task).
- **Deny rules ARE enforced under `bypassPermissions`** — as are ask rules, PreToolUse hooks, and the sandbox; only `permissions.allow` goes inert. Bypass destroys the built-in protected-path guard, so the deny list is worth **more** under bypass. See [Control Survival Across Permission Modes](knowledge/concepts/permission-mode-control-survival.md).
- **Deny matches a spelling, not a capability** — rules match per subcommand, pipe-containing patterns can never fire (no startup warning), bare `Bash(sh)` does fire. `Write(...)` path rules are accepted but never consulted. `settings-deny.json` at 116 entries, verified by UAT-026.
- **Six Tier-2 command-class hooks landed** (TASK-027) with `test/command-class-hooks.test.js`; `npm test` = 69/0. UAT-027 has 3 session-blocked cases pending `PreToolUse` wiring in `~/.claude/settings.json` — not archived, `in-progress`.
- **Release 2.14.0 still pending** — working tree holds interactive gitignore + playwright conflict flow + info/exclude + hooks; npm registry stuck at 2.11.2 (`npm login` expired).

## Recent Changes

- Created: `work/tasks/TASK-029-filesuggestion-autocomplete.md` (todo; renumbered from 028 — a concurrent session claimed TASK-028 for the interpreter-guard task); `knowledge/sources/git-exclude-at-autocomplete.md`; `knowledge/entities/tools/claude-code-file-picker.md`; `raw/research/git-exclude-at-autocomplete/{index,sources}.md` (research op).
- Updated: `knowledge/concepts/git-ignore-tool-visibility.md` (resolved contradiction — decision rule narrowed, `fileSuggestion` added); `knowledge/sources/gitignored-wiki-tool-visibility.md` (superseded_by callout); `wiki/index.md`, `wiki/log.md`.
- Flagged: **(1)** resolved — `info/exclude` "visible to agents" superseded by the @-autocomplete research (Serena-only). **(2)** still open — package-install consent mechanism disagreement (`ask` vs hook), callout on `consent-requires-a-yes-path`.

## Active Threads

- **TASK-029 (todo)** — fileSuggestion @-autocomplete restoration: template `file-suggestion.sh` (sentinel-scoped re-include), `--set-key` generalization of `merge-settings-deny.js` (absorbs the backlog item) wired into `install-global.sh`, prose corrections in `merge-gitignore.sh`/`templates/gitignore`/READMEs. parallel_safe_with TASK-027 and TASK-028 (interpreter guard, filed concurrently by another session); concept page already corrected during ingest.
- **UAT-027 (in-progress)** — 3 session-blocked cases need `PreToolUse` matcher wiring in `~/.claude/settings.json`; TASK-027 stays open until then. Two prose defects pinned (quoted-string examples in `lib/hooks/README.md` + `protected-write-guard.js:50-53`).
- **Not yet filed**: `permissions.ask` template (`--set-key` merge generalization now lands via TASK-028); `/decision-create` on enabling `/sandbox` for `power-mode`/`uat-auto-plus`.
- **Research reports awaiting ingest**: `raw/research/mcp-one-process-per-user/`, `brave-mcp-single-docker-container/`, `mcp-scope-conflict-handling/`, `mcp-add-scope-writes/`.
