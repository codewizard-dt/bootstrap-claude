---
topic: The setup/update scripts hide raw/, wiki/, and .serena/ from git via .git/info/exclude. That works for Serena, but Claude Code's @ file autocomplete no longer suggests those files. Research an alternative that keeps the dirs out of git AND compatible with Claude Code's @ autocomplete.
slug: git-exclude-at-autocomplete
researched: 2026-07-29
sources: [./sources.md]
---

# Research: Keeping wiki dirs out of git without breaking `@` autocomplete

> Builds on [gitignored-wiki-tool-visibility](../gitignored-wiki-tool-visibility/index.md) — that research chose `.git/info/exclude` to keep Serena sighted, but its "Claude tools unaffected" assumption does not hold for the `@` file picker. Verified here: ripgrep-class walkers and Claude Code's built-in `@` picker both honor `info/exclude`, recent Claude Code versions suggest only *git-tracked* files at all, and no built-in toggle exists. **No git-side mechanism fixes this** — every layout that keeps files out of the outer repo (info/exclude, plain untracked, nested embedded repos) is invisible to the current built-in picker. The fix is on the Claude Code side: the officially documented **`fileSuggestion` setting** replaces the built-in picker with a custom command, which can list `rg --files` plus the `info/exclude`-hidden dirs re-included. Recommendation: **keep `.git/info/exclude` exactly as shipped, and add a bootstrap-installed `fileSuggestion` script** that re-includes the bootstrap-excluded paths.

## Research Questions
- Why does `.git/info/exclude` break `@` autocomplete — which ignore rules does the picker honor?
- Is there a Claude Code setting/env var to include ignored files in `@` suggestions?
- Does any alternative git layout (untracked, nested embedded repo, `--add-dir`) keep files both out of git and visible to the picker?
- What is the cleanest mechanism that preserves the prior research's wins (Serena sighted, git quiet, per-machine, nothing forced into committed files)?

## Current State (Codebase)
- `lib/scripts/merge-gitignore.sh:137-161` — interactive offer appending `.serena/`, `raw/`, `wiki/` to `$PROJECT_DIR/.git/info/exclude`, with a comment block asserting `info/exclude` is "invisible to those tools" [S1]. True for Serena; now known false for the `@` picker.
- `lib/scripts/templates/gitignore:137-141` — maintainer note "never add .serena/, raw/, or wiki/ here", pointing at the info/exclude offer [S1].
- `wiki/knowledge/concepts/git-ignore-tool-visibility.md` — states `info/exclude` "keeps the paths tool-visible".
  > **Contradiction:** that claim holds for Serena only. Verified here: ripgrep documents honoring `$GIT_DIR/info/exclude` [S4], local `rg --files` tests confirm it [S3], and Claude Code's `@` picker filters those files too [S5]. The concept page needs a scope-narrowing update on ingest.

## Key Findings
- **`.git/info/exclude` is honored by ripgrep-class tooling, not just git.** Ripgrep's guide: "ripgrep will also respect repository specific rules found in `$GIT_DIR/info/exclude`" [S4]. Empirically, `rg --files` in a scratch repo with `wiki/`+`raw/` in `info/exclude` lists only the non-excluded files [S3].
- **Claude Code's `@` picker filters `info/exclude`d files** — confirmed by issue #5657 (v1.0.73, closed as duplicate, no fix) [S5], matching the user-observed behavior.
- **Worse: recent versions suggest only git-*tracked* files.** Issue #40082 (v2.1.85 regression): "The picker appears to rely exclusively on `git ls-files`, which excludes untracked files" [S6]. Issue #45012 (v2.1.94): the picker "only suggests Git-tracked files" [S8]. So even plain-untracked dirs (no ignore rule at all) don't autocomplete.
- **Nested embedded git repos don't help the built-in picker.** They *are* visible to raw `rg --files` and give a nice safety property — `git add -A` on the outer repo hard-fails until the nested repo has a commit, and afterwards stages only a gitlink stub with a loud "adding embedded git repository" warning, never the contents [S3] — but Claude Code's traversal "treats nested `.git` directories as repository boundaries and excludes them from indexing" (issue #15192) [S7]. And silencing the resulting `?? wiki/` status noise via `info/exclude` re-blinds rg [S3].
- **No built-in toggle exists.** Requested options (`fileDiscovery.respectGitignore`, `includeGitignored`, `.claudeinclude`, `CLAUDE_CODE_IGNORE_GITIGNORE`) are unimplemented; the issues are closed as duplicates with no official workaround [S8][S13]. Manually typing the full `@wiki/...` path still works — only the *suggestions* are missing [S8].
- **The escape hatch is official: `fileSuggestion`.** The settings reference documents "Configure a custom command for `@` file path autocomplete … `{ "fileSuggestion": { "type": "command", "command": "~/.claude/file-suggestion.sh" } }` The command runs with the same environment variables as hooks, including `CLAUDE_PROJECT_DIR`." [S9]. A custom command **replaces the built-in indexing entirely**, so gitignore/info-exclude/tracked-only filtering no longer applies — the script decides what is suggestible. Community-verified contract: the command receives JSON on stdin with a `query` field, prints newline-separated relative paths to stdout (~15 useful), and requires a Claude Code restart to take effect [S10][S11]. Issue #15192's listed workaround ("use custom `fileSuggestion`") corroborates this as the sanctioned path [S7]. Re-including ignored paths from such a script is an established community pattern (`rg --files --no-ignore-vcs <dir>`) [S12].

## Constraints
- Preserve everything the prior research won: Serena fully sighted (no `.gitignore` entries), git quiet on the three dirs, per-machine opt-in, nothing forced into committed team files.
- Zero new hard dependencies for the suggestion script (`jq`/`fzf` optional at best); `rg` is the one assumed tool (Claude Code environments have it; `find`+`grep` fallback is possible).
- A *global* `~/.claude/settings.json` `fileSuggestion` applies to **every** project on the machine — the script must degrade to exactly-built-in-like behavior in projects with no bootstrap excludes.
- Must not clobber a user's pre-existing custom `fileSuggestion`.

## Solution Comparison

| Criteria | A. Keep `info/exclude` + custom `fileSuggestion` script | B. Nested embedded git repos for `wiki/`+`raw/` | C. Stop hiding — commit the dirs | D. Status quo (type paths manually) |
|---|---|---|---|---|
| Git keeps dirs out | Yes (unchanged) | Yes (contents uncommittable; gitlink stub risk only) | **No** | Yes |
| `@` autocomplete | **Yes — script replaces built-in picker** | No — picker excludes nested repos [S7]; untracked never suggested [S6] | Yes | No (manual full paths only) |
| Serena visibility | Yes (unchanged) | Yes | Yes | Yes |
| `git status` noise | None | `?? wiki/` `?? raw/` untracked lines (unsilenceable without re-blinding) | None | None |
| Complexity | Medium (one script + settings merge, restart note) | Medium-high (repo init per dir, teammate confusion) | Low | None |
| Fragility | Low — `fileSuggestion` is documented; contract could still evolve | High — depends on picker internals staying broken-in-our-favor | None | UX cost forever |
| Codebase fit | High — install-global.sh already merges settings (`merge-settings-deny.js` precedent) | Poor | Violates the point of the feature | Poor |

## Recommendation
**Option A.** The git mechanism was never the problem — `info/exclude` remains the only ignore surface that keeps Serena sighted and git quiet. Fix the picker instead, with the documented `fileSuggestion` setting:

1. **Ship `~/.claude/file-suggestion.sh`** (template under `lib/scripts/templates/`). Behavior: parse `query` from stdin JSON (pure-shell `sed`, no `jq` dependency); `cd "$CLAUDE_PROJECT_DIR"`; emit `rg --files`; then re-include hidden dirs with `rg --files --no-ignore <dir>` **only for paths listed under the bootstrap sentinel** (`# bootstrap wiki & agent state (machine-local)`) in `.git/info/exclude` — precise re-inclusion, so a user's *other* deliberately-hidden `info/exclude` entries stay hidden; case-insensitive filter by query; `head -15`. In a project with no sentinel block the script is equivalent to plain `rg --files`.
2. **Register it in `install-global.sh`**: merge `"fileSuggestion": {"type": "command", "command": "~/.claude/file-suggestion.sh"}` into `~/.claude/settings.json` — additive like the deny-list merge; **skip with a warning if the user already has a different `fileSuggestion`**.
3. **Update the offer text** in `merge-gitignore.sh` (and its comment block + `templates/gitignore` note + the concept page) to stop claiming Claude-tool invisibility, and print a "restart Claude Code to pick up the new file suggestion" note after install.

Risks & mitigations:
- *Contract drift*: `fileSuggestion`'s stdin/stdout details are community-documented, not spelled out in the settings table. Mitigate with a defensive script (no stdin → treat query as empty; always exit 0) and a manual `echo '{"query":"wiki"}' | file-suggestion.sh` smoke test in UAT.
- *Global blast radius*: the setting affects all projects. Mitigated by the sentinel-scoped design (non-bootstrap projects get built-in-equivalent listing). If a user prefers per-project scoping, the same key can go in `.claude/settings.local.json` instead *(inference — standard settings-hierarchy behavior; verify during implementation)*.
- *Pre-existing custom scripts*: never overwrite; warn and print the snippet for manual merging.
- *Performance in huge repos*: `rg --files` is the same class of work the built-in picker does; community reports custom commands are *faster* in big repos [S10].

## Next Steps
- `/task-add Ship fileSuggestion @ autocomplete restoration: template script re-including bootstrap info/exclude paths, settings merge in install-global.sh, prompt-text + concept-page corrections --decision none`
- On ingest, update `wiki/knowledge/concepts/git-ignore-tool-visibility.md`: narrow "visible to (most) agents" to "visible to Serena; ripgrep-class tools and the Claude Code @ picker honor info/exclude" and link this research.
- `/wiki-ingest raw/research/git-exclude-at-autocomplete/index.md` after review.
