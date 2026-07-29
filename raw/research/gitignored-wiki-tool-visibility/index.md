---
topic: Reconsider gitignoring .serena/, raw/, wiki/ — Serena relies on .gitignore. Find a way to keep these folders out of the git repository while Serena AND Claude Code can still see and access them without difficulty.
slug: gitignored-wiki-tool-visibility
researched: 2026-07-30
sources: [./sources.md]
---

# Research: Keeping `.serena/`, `raw/`, `wiki/` out of git without blinding Serena or Claude

> The just-added "Bootstrap wiki & agent state" `.gitignore` template section is self-defeating: Serena (with its default `ignore_all_files_in_gitignore: true`) and Claude Code's Grep both honor `.gitignore`, so accepting that section would make the wiki invisible to the very tools that maintain it. The fix is **`.git/info/exclude`**: identical ignore semantics for git, never committed or shared, and — verified in Serena's source — completely invisible to Serena, whose `GitignoreParser` discovers only files named exactly `.gitignore`. Claude's Read/Glob are unaffected either way. Replace the gitignore template section with an interactive offer to append the three paths to `.git/info/exclude`.

## Research Questions
- Does Serena support un-ignoring specific gitignored paths (negation/allowlist)?
- Which Claude Code tools skip gitignored paths, and can that be overridden?
- Does either tool honor `.git/info/exclude`?
- What mechanism keeps the dirs out of git while both tools retain full visibility?

## Current State (Codebase)
- Uncommitted 2.14.0 work adds a "Bootstrap wiki & agent state — keep machine-local (opt in for team repos)" section (`.serena/`, `raw/`, `wiki/`) to `lib/scripts/templates/gitignore`, offered per-section by `merge-gitignore.sh --interactive` [S1].
- `.serena/project.yml` (this repo and every bootstrap-configured project) sets `ignore_all_files_in_gitignore: true`, `ignored_paths: []` [S1].
- The whole bootstrap ecosystem routes exploration through Serena (serena-first hooks), and wiki navigation is index-link-driven (explicit `Read` paths) — but `search_for_pattern`/symbol tools would go blind on gitignored dirs.

## Key Findings
- **Serena ignores exactly what git ignores when `ignore_all_files_in_gitignore: true`**: `Project.__init__` builds ignore specs via `GitignoreParser(self.project_root)` [S4]. **No allowlist/negation escape exists**: gitignore-style negation (`!`) in `ignored_paths` is broken/unsupported (upstream issue #600, closed) [S6], and negating in `.gitignore` itself would un-ignore for git too.
- **Serena does NOT read `.git/info/exclude`** — verified in source: `_iter_gitignore_files` yields only entries where `entry.name == ".gitignore"` (src/serena/util/file_system.py:176); repo-wide search finds zero `info/exclude` references [S5]. A user log confirms the mechanism ("Parsing all gitignore files … Found 30 gitignore files") [S7].
- **Claude Code tool behavior** (documented): `Grep` respects `.gitignore` (workaround: pass a path directly); `Glob` does NOT respect `.gitignore` by default; `Read` works on any explicit path; automatic context gathering respects `.gitignore` [S2][S3]. Whether Grep also honors `.git/info/exclude` is **undocumented** — ripgrep's defaults do, so assume wiki content may be skipped by Claude's Grep either way *(inference — no primary source)*; in bootstrap projects Serena is the mandated search surface, which `info/exclude` leaves fully sighted.
- **`.git/info/exclude`** has identical ignore semantics to `.gitignore` but lives inside `.git/` — never committed, never shared, per-clone [S8].

## Constraints
- Must not blind Serena's `search_for_pattern`/`find_file`/symbol indexing on `raw/` + `wiki/` (wiki ops depend on them).
- Must not require enumerating junk dirs manually (flipping `ignore_all_files_in_gitignore: false` would).
- Team-file semantics: whatever mechanism is chosen must not force itself into a committed file.

## Solution Comparison

| Criteria | A. `.git/info/exclude` (recommended) | B. `.gitignore` + Serena `ignore_all_files_in_gitignore: false` | C. Keep `.gitignore` section as shipped |
|---|---|---|---|
| Git keeps dirs out | Yes (this clone) | Yes (all clones) | Yes (all clones) |
| Serena sees dirs | **Yes — untouched config** | Yes, but must hand-maintain `ignored_paths` (node_modules, .venv, …) or Serena indexes everything | **No** |
| Claude Grep sees dirs | Likely no (rg default honors info/exclude — unverified); Read/Glob/Serena unaffected | No | No |
| Team coverage | Per-clone opt-in (each member runs setup/update once) | Committed, covers everyone | Committed, covers everyone |
| Maintenance | None | High (junk-dir list drifts) | None |
| Verdict | Best tool visibility | Worst of both | Self-defeating |

## Recommendation
**Option A.** Remove the `.serena/`/`raw/`/`wiki/` section from `lib/scripts/templates/gitignore` (never let these three into `.gitignore`), and instead have the interactive sync offer: *"Keep .serena/, raw/, wiki/ out of git on this machine (.git/info/exclude — not shared with the team)? [y/N]"* — appending the three lines idempotently to `$PROJECT_DIR/.git/info/exclude` when accepted (skip when not a git repo). Serena config stays untouched; wiki reads/searches keep working.

Risks & mitigations:
- *Per-clone only*: a teammate who never opts in could commit the wiki. If a team wants a hard guarantee, they can commit the entries to `.gitignore` themselves — accepting Serena blindness — or use pre-commit hooks; document the trade-off in the prompt text.
- *Claude Grep possibly skipping wiki content*: unverified for `info/exclude`; mitigated because Serena is the mandated search tool and wiki navigation is index-driven. Document "pass the explicit path to Grep" as the fallback.

## Next Steps
- Amend the uncommitted 2.14.0 work: drop the gitignore template section; add the `info/exclude` offer (natural home: `merge-gitignore.sh` after the section loop, or a small step in `sync-wiki-scaffold.sh`).
- `/wiki-ingest raw/research/gitignored-wiki-tool-visibility/index.md` after shipping.
