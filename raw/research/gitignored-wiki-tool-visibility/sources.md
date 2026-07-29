---
topic: Reconsider gitignoring .serena/, raw/, wiki/ — keep them out of git while Serena and Claude Code retain full visibility.
slug: gitignored-wiki-tool-visibility
researched: 2026-07-30
---

# Primary Sources — gitignored wiki tool visibility

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/templates/gitignore` (new "Bootstrap wiki & agent state" section, uncommitted) + `.serena/project.yml` (`ignore_all_files_in_gitignore: true`, `ignored_paths: []`) | 2026-07-30 | The conflicting pieces: proposed gitignore entries vs Serena's gitignore-mirroring default |
| S2 | web | https://code.claude.com/docs/en/tools-reference.md (Grep/Glob tool behavior) | 2026-07-30 | Grep respects .gitignore (explicit path bypasses); Glob does not respect .gitignore by default; via claude-code-guide agent |
| S3 | web | https://code.claude.com/docs/en/large-codebases.md | 2026-07-30 | "Claude's content searches respect `.gitignore` by default" |
| S4 | web | https://raw.githubusercontent.com/oraios/serena/main/src/serena/project.py | 2026-07-30 | `if self.project_config.ignore_all_files_in_gitignore: gitignore_parser = GitignoreParser(self.project_root)` — gitignore specs feed Serena's ignore list |
| S5 | web | https://raw.githubusercontent.com/oraios/serena/main/src/serena/util/file_system.py | 2026-07-30 | `_iter_gitignore_files` matches only `entry.name == ".gitignore"` (line ~176) — `.git/info/exclude` is never read; `gh search code --repo oraios/serena "info/exclude"` returns nothing |
| S6 | web | https://github.com/oraios/serena/issues/600 | 2026-07-30 | "GitIgnore-style negation patterns (!) don't work in ignored_paths configuration" (closed; resolution comments not retrievable — treated as: negation is not a usable escape hatch) |
| S7 | web | https://github.com/oraios/serena/issues/450 | 2026-07-30 | Runtime log confirming mechanism: "serena.project:__init__:31 - Parsing all gitignore files in … Found 30 gitignore files." |
| S8 | web | https://nelson.cloud/.gitignore-isnt-the-only-way-to-ignore-files-in-git/ | 2026-07-30 | `.git/info/exclude` as a per-clone, uncommitted ignore mechanism with .gitignore semantics |

## Excerpts

### S2 — Claude Code tools reference (via claude-code-guide agent)
https://code.claude.com/docs/en/tools-reference.md
> "Grep respects `.gitignore`, so gitignored files are skipped. To search a gitignored file, Claude passes its path directly."
> "Glob doesn't respect `.gitignore` by default, so it finds gitignored files alongside tracked ones."

### S4 — serena/src/serena/project.py
> ```python
> if self.project_config.ignore_all_files_in_gitignore:
>     gitignore_parser = GitignoreParser(self.project_root)
>     for spec in gitignore_parser.get_ignore_specs():
> ```

### S5 — serena/src/serena/util/file_system.py (GitignoreParser)
> ```python
> elif entry.is_file(follow_symlinks=follow_symlinks) and entry.name == ".gitignore":
> ```
> (`_iter_gitignore_files` — "Iteratively discover .gitignore files in a top-down fashion, starting from the repository root.")

### S7 — oraios/serena issue #450 (user log)
> `INFO 2025-08-08 18:59:50,895 [MainThread] serena.project:__init__:31 - Parsing all gitignore files in /home/colin/projects/my/server INFO ... Found 30 gitignore files.`
