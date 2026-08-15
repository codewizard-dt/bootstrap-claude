---
title: Hot Cache
updated: 2026-08-15
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-15_

## Key Recent Facts

- **ROADMAP-008 in progress**: Fix Obsidian Wikilink Resolution for Work-Item IDs (`wiki/work/roadmaps/ROADMAP-008-fix-obsidian-wikilink-resolution.md`, `active`, 0/3 items checked, all 3 phases now have task files). Fixes why `[[TASK-009]]`-style links show "not created yet" despite the file existing — Obsidian's click-resolver matches only real filenames, never frontmatter (confirmed intentional, not even native `aliases:`). 3 phases, fully parallel-safe (disjoint files): **Phase 1** — [[TASK-065]] (`todo`), adds `aliases: [<ID>]` to the 6 work-family skill templates (`task-add`, `uat-generate`, `req-create`, `bug-file`, `decision-create`, `roadmap-create`); investigation found the 6 templates aren't uniform — 3 have a literal `id:`-bearing frontmatter block, 2 defer to `lifecycle.md` and only list fields in prose/table form, and `decision-create`'s template has **no YAML frontmatter at all today** (task adds a new minimal block, doesn't touch the broader schema gap). **Phase 2** — [[TASK-064]] (`todo`), backfills `aliases:` onto every existing work-item file across all 6 families (active + archive). **Phase 3** — [[TASK-063]] (`todo`), bundles the **Alias Linker** plugin (`johannrichard/alias-linker`, self-described "experimental") into `install-obsidian.sh` (5th plugin), updates schema/README docs, adds tests. All 3 ready for `/tackle`. Note: heavy task-numbering contention this session from concurrent agents filing all 3 phases in parallel — final numbers are 065/064/063 for Phase 1/2/3 respectively (each renumbered at least once); all index/roadmap/log references reflect the final numbers. See `wiki/knowledge/sources/obsidian-alias-link-resolution.md` for the full research.
- **Serena MCP reconnected** mid-session (was disconnected earlier, causing intermittent Read/Bash hook blocks) — back to normal tool access.
- **Obsidian graph/vault polish landed, uncommitted** (prior turns, unrelated to ROADMAP-008): archive `index.md` frontmatter titles, rescoped `graph.json` search filter, **Front Matter Title** bundled as a 4th plugin (manual "enable Graph" toggle still needed per-vault). Full suite 349/349.
- **ROADMAP-007 is done and archived.**
- **Update: Serena DOES support a single-shared-instance mode** (`--transport streamable-http`, maintainer-endorsed for same-project concurrency) — not adopted, stdio remains default. See [[serena-single-instance-transport]].
- **MCP scope has no performance difference**; a live unfixed CLI bug was found (`claude mcp add` can hardcode secrets into placeholder `.mcp.json` entries, GitHub #18692). See [[mcp-scope-performance-behavior]], [[mcp-add-secret-hardcoding-bug]].
- **All three open bugs from earlier sessions fixed, verified, archived: [[BUG-0009]], [[BUG-0010]], [[BUG-0011]].** Only [[BUG-0001]]–[[BUG-0008]] remain open (older, unrelated).

## Recent Changes

- Created (2026-08-15): `wiki/work/roadmaps/ROADMAP-008-fix-obsidian-wikilink-resolution.md`. Updated `wiki/work/roadmaps/index.md`, `wiki/log.md`.
- Created (2026-08-15): `wiki/work/tasks/TASK-065-add-aliases-frontmatter-templates.md` (ROADMAP-008 Phase 1, renumbered from an initial TASK-064 collision), `wiki/work/tasks/TASK-064-backfill-work-item-aliases.md` (Phase 2, renumbered twice from an initial TASK-062 collision), and `wiki/work/tasks/TASK-063-alias-linker-plugin.md` (Phase 3). Updated `wiki/work/tasks/index.md`, `wiki/work/roadmaps/ROADMAP-008-fix-obsidian-wikilink-resolution.md` (all 3 phase checklist lines now link their task files), `wiki/log.md`.
- Created (2026-08-15, uncommitted): `raw/research/obsidian-alias-link-resolution/` (`index.md` + `sources.md`); `wiki/knowledge/sources/obsidian-alias-link-resolution.md`; `wiki/knowledge/entities/tools/alias-linker.md`. Updated `wiki/index.md`.
- Modified (2026-08-15, uncommitted, earlier this session): 6 live + 6 template `archive/index.md` files, `.obsidian/graph.json` + its template, `lib/scripts/install-obsidian.sh` (4th plugin), `bootstrap-prefs-schema.json`, `lib/scripts/README.md`, `test/install-obsidian.test.js`; new `wiki/knowledge/entities/tools/front-matter-title.md`.
- Committed (2026-08-15, `eb92073`, `[minor] 2.22.0`): ROADMAP-007/TASK-061 original graph.json defaults + a concurrent session's MCP-scope-performance research.
- Note: an earlier `wiki/log.md` append this session landed mid-file instead of at the true bottom (a concurrent session appended between read and write) — content intact, just slightly out of chronological position.

## Active Threads

- **ROADMAP-008 (active, 0/3)** — all 3 phases now have task files: [[TASK-065]] (Phase 1), [[TASK-064]] (Phase 2), [[TASK-063]] (Phase 3), all `todo`, ready for `/tackle` or `/power-mode` (parallel-safe, disjoint files).
- **Uncommitted work from prior turns** (Obsidian graph/vault polish) — likely wants `/git-commit` once the user is ready.
- **User should manually enable "Graph" in Front Matter Title's plugin settings**, per vault.
- **Unresolved `update`-specific bug under active investigation** (carried from earlier): user re-testing a `prompt_yn`/interactive-read issue on `update-project.sh` on a different machine.
- **TASK-060 (todo)** — Docker fresh-machine harness, ready for `/tackle`.
- **Optional doc fix flagged**: `README.md` line 247 stale re: Serena scope.
- **Optional follow-up research flagged**: `${CLAUDE_PROJECT_DIR:-.}` expansion inside Serena's `--project` argument.
- **ROADMAP-001 (11/12, active)**, **TASK-031 (todo)**, **TASK-039 (pending-uat)**, **BUG-0001–0008 (open, older, unrelated)**.
