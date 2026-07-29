---
id: TASK-029
title: "Ship fileSuggestion @-autocomplete restoration for info/exclude'd wiki dirs"
status: todo
created: 2026-07-29
updated: 2026-07-29
depends_on: []
blocks: []
parallel_safe_with: [TASK-027, TASK-028]
uat: ""
tags: [claude-code, autocomplete, settings-merge, install-global]
---

# TASK-029 — Ship fileSuggestion @-autocomplete restoration

derived_from::[[git-exclude-at-autocomplete]]

## Objective

Restore Claude Code `@` file autocomplete for the bootstrap-hidden dirs (`.serena/`, `raw/`, `wiki/`) that `.git/info/exclude` currently blinds. Ship a `fileSuggestion` custom-picker script that re-includes only the sentinel-scoped excluded paths, register it globally via a settings merge in `install-global.sh`, and correct the over-broad "invisible to the tools" claims in prompt/comment text. Research basis: `raw/research/git-exclude-at-autocomplete/index.md` — the built-in picker honors `info/exclude` and (recent versions) suggests only git-tracked files; the documented `fileSuggestion` settings key replaces the picker entirely.

## Approach

- Keep `.git/info/exclude` as the git mechanism (unchanged) — fix the picker side only.
- **Sentinel-scoped re-inclusion**: the script re-includes only paths listed under the `# bootstrap wiki & agent state (machine-local)` sentinel comment in `.git/info/exclude` (written by `merge-gitignore.sh:154-157`), so a user's other deliberately-hidden entries stay hidden, and non-bootstrap projects get built-in-equivalent listing.
- **Merge mechanism**: generalize the existing `lib/scripts/merge-settings-deny.js` with a key-merge mode rather than a new script (user-confirmed; was already on the backlog). Never clobber an existing different `fileSuggestion` — warn and skip.
- Defensive script contract (community-verified, not fully spec'd in docs): stdin JSON `{"query": ...}`, `CLAUDE_PROJECT_DIR` env, newline-separated relative paths on stdout, ≤15 results, always exit 0. Restart required to pick up the setting.
- Global `~/.claude/settings.json` registration (not per-project) — the script degrades to plain listing outside bootstrap projects.

## Steps

### 1. Generalize merge-settings-deny.js with a key-merge mode  <!-- agent: general-purpose -->

- [ ] In `lib/scripts/merge-settings-deny.js`, add a `--set-key <name> --set-value <json>` mode alongside the default deny-list merge (flags are additive to the existing `--target`/`--source` test seams).
  - Behavior: parse target settings; if `settings[name]` is **absent**, set it to the parsed JSON value and write atomically (preserve indentation, exit 0 semantics — reuse the existing write path); if **present and deep-equal**, no-op; if **present and different**, print a one-line warning naming the key and the skipped value, change nothing, exit 0.
  - Keep the default invocation (no flags) byte-identical in behavior — the deny merge is battle-tested (UAT-026) and must not regress.
- [ ] Extend `test/settings-deny.test.js` (zero-dep `node:test`, same style): absent-key set, deep-equal no-op (byte-identical file), present-different skip+warn, malformed-target fail-safe (exit 0, file untouched), and a regression case proving default deny-merge behavior is unchanged.

### 2. Create the file-suggestion template script  <!-- agent: general-purpose -->

- [ ] New file `lib/scripts/templates/file-suggestion.sh` (bash, executable, no `jq`/`fzf` dependency):
  - Read all of stdin; extract `query` with a POSIX-safe `sed` JSON pull (`.*"query"[[:space:]]*:[[:space:]]*"\([^"]*\)".*`); empty/missing stdin or query → empty query (list mode).
  - `cd "${CLAUDE_PROJECT_DIR:-.}"` (fail → exit 0 silently).
  - Base listing: `rg --files 2>/dev/null`; if `rg` is absent, fall back to `git ls-files --cached --others --exclude-standard 2>/dev/null` and, if that also fails (not a git repo), `find . -type f -not -path './.git/*'` with the `./` prefix stripped.
  - Re-include pass: if `.git/info/exclude` exists, collect the lines **after** the exact sentinel `# bootstrap wiki & agent state (machine-local)` up to the next `#`-comment line or EOF (expected values like `.serena/`, `raw/`, `wiki/`); for each existing dir, append `rg --files --no-ignore <dir> 2>/dev/null` (fallback `find <dir> -type f`).
  - Pipe the union through `sort -u`, then filter case-insensitively with `grep -iF -- "$QUERY"` when the query is non-empty, then `head -15`.
  - Every branch exits 0; no stderr chatter (the picker consumes stdout only).
- [ ] Smoke-test in this repo (which has the sentinel block in `.git/info/exclude`): `echo '{"query":"hot"}' | bash lib/scripts/templates/file-suggestion.sh` with `CLAUDE_PROJECT_DIR=$(pwd)` must print `wiki/hot.md`; `echo '{"query":"zzznope"}' | ...` must print nothing and exit 0; `bash -n` gate.

### 3. Wire installation in install-global.sh  <!-- agent: general-purpose -->

- [ ] In `lib/scripts/install-global.sh`, after the deny-list merge block (`lib/scripts/install-global.sh:77-81`): copy `templates/file-suggestion.sh` → `~/.claude/file-suggestion.sh` (`chmod +x`; overwrite is fine — the script is template-owned), then invoke `node "$SCRIPT_DIR/merge-settings-deny.js" --set-key fileSuggestion --set-value '{"type":"command","command":"~/.claude/file-suggestion.sh"}'`.
  - Echo a note on the skip+warn path (pre-existing different `fileSuggestion`) and, on fresh registration, print: restart Claude Code sessions to pick up the new file suggestion command.

### 4. Correct over-broad "invisible to the tools" prose  <!-- agent: general-purpose -->

- [ ] `lib/scripts/merge-gitignore.sh:137-143` comment block: replace the "invisible to those tools" rationale with the narrowed claim — invisible to **Serena** (GitignoreParser reads only `.gitignore` files); ripgrep-class tools and the Claude Code `@` picker DO honor `info/exclude`, which is why `install-global.sh` registers a `fileSuggestion` script that re-includes the sentinel-scoped paths.
- [ ] `lib/scripts/merge-gitignore.sh:151` prompt text: adjust the parenthetical (currently "keeps them visible to Serena/Claude") to "visible to Serena; @-autocomplete restored via the installed fileSuggestion script".
- [ ] `lib/scripts/templates/gitignore:137-141` maintainer note: same narrowing + pointer to the fileSuggestion mechanism.
- [ ] `lib/scripts/README.md`: update the `merge-gitignore.sh` row (remove the "would blind … Claude Grep" over-claim, mention the fileSuggestion pairing) and the `install-global.sh` + `merge-settings-deny.js` rows (new copy step + `--set-key` mode).
- [ ] Root `CLAUDE.md` (this repo, Key Files section): extend the `install-global.sh` bullet with the fileSuggestion script copy + settings-key merge. Do NOT touch `wiki/knowledge/concepts/git-ignore-tool-visibility.md` — already corrected during the 2026-07-29 ingest.

### 5. Verify  <!-- agent: general-purpose -->

- [ ] `npm test` green (existing 69 + new cases from step 1).
- [ ] `bash -n` on `install-global.sh`, `merge-gitignore.sh`, `templates/file-suggestion.sh`.
- [ ] Hermetic install check with a scratch `--target` settings file: fresh set, idempotent re-run (byte-identical), pre-existing-different skip+warn — **never merge into the real `~/.claude/settings.json` during verification** (precedent: UAT-026).
