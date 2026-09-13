---
topic: naming inconsistencies for the skills that manage the wiki work family file names and possible ways to normalize them
slug: wiki-work-family-naming
researched: 2026-09-13
---

# Primary Sources — Wiki Work-Family Naming Inconsistencies

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `wiki/work/{tasks,uat,bugs,decisions,requirements,roadmaps}/lifecycle.md` (all six, line 8 in each) + `mcp__serena__list_dir` recursive listings of all six `wiki/work/<family>/` directories | 2026-09-13 | Authoritative per-family filename/ID-width declarations; confirmed every on-disk file (tasks, UAT, bugs, roadmaps) already carries its full prefix; confirmed decisions/requirements have zero real files to check against |
| S2 | codebase | `lib/skills/bug-file/SKILL.md` (Steps 5, 6, 7, 8) | 2026-09-13 | Found the internal self-contradiction: Steps 5/6/8 instruct a bare `NNNN-<slug>.md` filename while Step 7's index-link format is already the prefixed `BUG-NNNN-slug.md` |
| S3 | codebase | `lib/skills/roadmap-create/SKILL.md` (Steps 2, 5, 6, 7, 9) | 2026-09-13 | Found the skill is internally self-consistent (bare `NNN-slug.md` throughout) but externally wrong versus lifecycle.md, sibling skills, and all 12 on-disk roadmap files |
| S4 | codebase | `lib/skills/roadmap-next/SKILL.md:42` (via `mcp__serena__search_for_pattern` for `wiki/work/roadmaps` across `lib/skills`) | 2026-09-13 | Found a stale fallback example ("`003-billing.md` → `ROADMAP-003`") that assumes the bare filename form, doubling down on the same wrong convention in a second skill that only *reads* roadmap files |
| S5 | codebase | `lib/skills/{bug-triage,bug-close,roadmap-assess,power-mode}/SKILL.md`, `lib/skills/uat-walk/UAT-CORE.md:158` (via `mcp__serena__search_for_pattern` for `BUG-NNNN`/`ROADMAP-NNN` across `lib/skills`) | 2026-09-13 | Confirmed every *other* skill touching bug/roadmap files (not just the creation skills) already assumes the prefixed filename form — establishing that `bug-file`/`roadmap-create` are the outliers, not a competing convention with any following |
| S6 | codebase | `git log --follow` on `lib/skills/bug-file/SKILL.md` and `lib/skills/roadmap-create/SKILL.md`; `git log -1` on `wiki/work/bugs/lifecycle.md` / `wiki/work/roadmaps/lifecycle.md` | 2026-09-13 | Dated the drift: both skills predate commit `a36905e` (2026-06-11, "Migrate to LLM Wiki architecture (wiki2)"), which is where the current `lifecycle.md`-declared prefixed-filename convention was formalized; the migration appears to have updated 4 of 6 creation skills but missed these two |
| S7 | codebase | `lib/skills/task-add/SKILL.md` (Step 7a) and `lib/skills/roadmap-create/SKILL.md` (Step 5) | 2026-09-13 | Identified the "re-verify next ID immediately before Write" race-guard pattern present in these two skills |
| S8 | codebase | `lib/skills/bug-file/SKILL.md` (Step 4), `lib/skills/decision-create/SKILL.md` (Step 2), `lib/skills/req-create/SKILL.md` (Steps 2, 7), `wiki/work/requirements/index.md:10` | 2026-09-13 | Confirmed no re-verify-before-write step in bug-file/decision-create/req-create; confirmed req-create's Step 7 "Row/columns" wording is a documentation mismatch against its own family's actual flat-bullet index format |
| S9 | web | https://github.com/npryce/adr-tools | 2026-09-13 | Canonical ADR tooling; classic Nygard/adr-tools convention uses bare `NNNN-title-with-dashes.md`, 4-digit |
| S10 | web | https://source-docs.thunderbird.net/en/latest/adr/README.html | 2026-09-13 | Independent confirmation of the bare `NNNN-title-with-dashes.md`, 4-digit convention in a real production ADR process |
| S11 | web | https://glama.ai/mcp/servers/wooxogh/adr-mcp-setup | 2026-09-13 | Shows a *prefixed* variant of the same family of tools (`ADR-NNNN-slug.md`), demonstrating both bare and prefixed conventions genuinely coexist in ADR tooling in the wild |
| S12 | web | https://github.com/e0ipso/sift | 2026-09-13 | Closest external analog to this repo's multi-family markdown+frontmatter work-item system; documents `<PREFIX>-<NNNN>--<kebab-slug>.md` with IDs "zero-padded to at least four digits" and "immutable, globally unique across both buckets" — supports standardizing on one consistent, always-prefixed, fixed-width pattern |

## Excerpts

### S9 — adr-tools (GitHub)
https://github.com/npryce/adr-tools
> This will create a directory named doc/architecture/decisions containing the first ADR, which records that you are using ADRs to record architectural decisions and links to Michael Nygard's article on the subject.

(Companion snippet from the production-ready.de writeup of the same tool, same search result set: `$ adr init doc/adrs` → `doc/adrs/0001-record-architecture-decisions.md` — bare 4-digit numeric prefix, no `ADR-` text prefix.)

### S10 — Thunderbird ADR Process docs
https://source-docs.thunderbird.net/en/latest/adr/README.html
> The ADRs will be stored in a directory named docs/adr, and each ADR will be a file named NNNN-title-with-dashes.md where NNNN is a four-digit number that is increased by 1 for every new ADR.

### S11 — adr-mcp-setup (Glama / GitHub)
https://glama.ai/mcp/servers/wooxogh/adr-mcp-setup
> Markdown export — Every ADR exported as ADR-NNNN-slug.md, ready to commit alongside your code.
> Database: ~/.adr-mcp/sessions.db ADR files: ~/.adr-mcp/adrs/ADR-NNNN-slug.md

### S12 — sift (file-based ticketing)
https://github.com/e0ipso/sift
> Use <PREFIX>-<NNNN>--<kebab-slug>.md. IDs are immutable, globally unique across both buckets, and zero-padded to at least four digits.
