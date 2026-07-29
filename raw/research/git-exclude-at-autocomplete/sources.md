---
topic: Keep raw/, wiki/, .serena/ out of git while remaining compatible with Claude Code's @ file autocomplete.
slug: git-exclude-at-autocomplete
researched: 2026-07-29
---

# Primary Sources — git exclude vs @ autocomplete

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/merge-gitignore.sh:137-161` + `lib/scripts/templates/gitignore:137-141` | 2026-07-29 | Current implementation: interactive `.git/info/exclude` offer with sentinel comment `# bootstrap wiki & agent state (machine-local)`; comment asserts info/exclude is "invisible to those tools" |
| S2 | codebase | `raw/research/gitignored-wiki-tool-visibility/index.md` | 2026-07-29 | Prior research this builds on: Serena reads only files named `.gitignore`, so info/exclude keeps Serena sighted; Grep/info-exclude interaction was left unverified |
| S3 | experiment | scratch git repo (session scratchpad `ignoretest/`): `rg --files` + `git status` + `git add -A` under info/exclude, nested-repo, and excluded-nested-repo layouts | 2026-07-29 | `rg --files` omits info/exclude'd dirs; nested embedded repos ARE rg-visible; outer `git add -A` fails pre-commit ("does not have a commit checked out") and afterwards stages only a gitlink with "warning: adding embedded git repository"; excluding the nested repo re-blinds rg; rg rooted AT an excluded dir still lists its contents |
| S4 | web | https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md | 2026-07-29 | Ripgrep documents honoring `$GIT_DIR/info/exclude` and global excludes; ignore filtering applies only to recursive traversal, not explicitly-passed paths |
| S5 | web | https://github.com/anthropics/claude-code/issues/5657 | 2026-07-29 | `@` autocompletion excludes files listed in `.git/info/exclude` (v1.0.73); closed as duplicate, no fix |
| S6 | web | https://github.com/anthropics/claude-code/issues/40082 | 2026-07-29 | v2.1.85 regression: `@` picker shows no untracked files — "appears to rely exclusively on `git ls-files`"; closed as duplicate of #26464 |
| S7 | web | https://github.com/anthropics/claude-code/issues/15192 | 2026-07-29 | Nested `.git` dirs treated as repository boundaries and excluded from `@` indexing; listed workaround includes "use custom `fileSuggestion` with `git ls-files`" |
| S8 | web | https://github.com/anthropics/claude-code/issues/45012 (via claude-code-guide agent) | 2026-07-29 | Since v2.1.94 the picker "only suggests Git-tracked files"; proposed toggles (settings option, `.claudeinclude`, env var) not implemented; manual full-path typing still works |
| S9 | web | https://code.claude.com/docs/en/settings (settings reference; full quote surfaced via Brave snippet of the same page) | 2026-07-29 | Official `fileSuggestion` setting: "Configure a custom command for @ file path autocomplete… { \"fileSuggestion\": { \"type\": \"command\", \"command\": \"~/.claude/file-suggestion.sh\" } } The command runs with the same environment variables as hooks, including CLAUDE_PROJECT_DIR." |
| S10 | web | https://martinemde.com/blog/fast-claude-file-suggestion-in-big-repos | 2026-07-29 | Working `fileSuggestion` setup: settings JSON shape, restart required, stdout line output; custom scripts are faster than built-in in large repos |
| S11 | web | https://ricardoanderegg.com/posts/claude-code-file-suggestion-hook/ | 2026-07-29 | I/O contract from a working script: stdin JSON with `query` field, `CLAUDE_PROJECT_DIR` env, prints up to ~15 newline-separated paths |
| S12 | web | https://x.com/thayto_dev/status/2009401734213554494 | 2026-07-29 | Community pattern of re-including ignored paths inside a fileSuggestion script: `rg --files --follow --hidden --no-ignore-vcs .notes` for "additional paths — include even if gitignored" |
| S13 | web | https://github.com/anthropics/claude-code/issues/43470 (via claude-code-guide agent) | 2026-07-29 | "@-file autocomplete ignores gitignored files even when includeIgnoredFiles is configured" — closed as duplicate of #30176; confirms no existing setting reaches the picker |

## Excerpts

### S4 — ripgrep GUIDE.md
https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md
> "ripgrep's `.gitignore` handling actually goes a bit beyond just `.gitignore` files. ripgrep will also respect repository specific rules found in `$GIT_DIR/info/exclude`, as well as any global ignore rules in your `core.excludesFile`"

### S5 — anthropics/claude-code#5657
https://github.com/anthropics/claude-code/issues/5657
> "Since one of the recent updates, the \"@\" file autocompletion does not include files anymore, that are listed in \".git/info/exclude\". I'm not sure if this is intended or not but it breaks my setup, unfortunately 😅"

### S6 — anthropics/claude-code#40082
https://github.com/anthropics/claude-code/issues/40082
> "The `@` file picker only shows directories and the plan option. Untracked files don't appear in the dropdown… The picker appears to rely exclusively on `git ls-files`, which excludes untracked files"

### S7 — anthropics/claude-code#15192
https://github.com/anthropics/claude-code/issues/15192
> "Filesystem traversal treats nested .git directories as repository boundaries and excludes them from indexing"

### S9 — Claude Code settings reference
https://code.claude.com/docs/en/settings
> "Configure a custom command for @ file path autocomplete. The built-in file suggestion uses fast filesystem traversal, but large monorepos may benefit from project-specific indexing such as a pre-built file index or custom tooling. { \"fileSuggestion\": { \"type\": \"command\", \"command\": \"~/.claude/file-suggestion.sh\" } } The command runs with the same environment variables as hooks, including CLAUDE_PROJECT_DIR."

### S11 — ricardoanderegg.com (fileSuggestion contract)
https://ricardoanderegg.com/posts/claude-code-file-suggestion-hook/
> `input_data = json.load(sys.stdin)` … `query = input_data.get("query", "")` … `project_dir = os.environ.get("CLAUDE_PROJECT_DIR", ".")` … `for line in result.stdout.splitlines()[:15]: print(line)`

### S12 — @thayto_dev fileSuggestion script pattern
https://x.com/thayto_dev/status/2009401734213554494
> "# Additional paths - include even if gitignored (uncomment and customize) # [ -e .notes ] && rg --files --follow --hidden --no-ignore-vcs .notes 2>/dev/null"

### S3 — local experiment (scratch repo)
Session scratchpad, macOS, git + system `rg`:
> `--- rg --files (info/exclude active) ---` → `src/app.md` (wiki/raw omitted)
> `--- rg --files (wiki/ and raw/ are nested git repos, no excludes) ---` → all files listed
> `git add -A` (nested repos without commits) → `error: 'raw/' does not have a commit checked out / fatal: adding files failed`
> `git add -A` (with commits) → `warning: adding embedded git repository: raw` (gitlink only)
> nested repo added to outer info/exclude → rg omits it again
