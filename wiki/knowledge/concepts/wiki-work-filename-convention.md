---
id: wiki-work-filename-convention
title: "wiki/work/ Filename Convention: PREFIX-NNN(N)-slug.md, and Where Two Skills Drifted From It"
updated: 2026-09-13
sources:
  - ../../../raw/research/wiki-work-family-naming/index.md
confidence: extracted
tags: [wiki-work, skills, naming, conventions]
---

Every `wiki/work/<family>/lifecycle.md` declares the same shape for its filenames: the full ID prefix, the zero-padded number, a slug, `.md` — e.g. `TASK-014-api-refactor.md`, `BUG-0006-mv-guard-segment-split-omits-pipe.md`, `ROADMAP-012-sandbox-scaffolding-and-usage-visibility.md`. This is the authoritative spec (per `wiki/conventions.md`'s stable-ID rule), and 100% of files that currently exist in any family — tasks, UAT, bugs, roadmaps — already match it.

**Two of the six creation skills disagree with this spec in their own instructions**, despite it being settled everywhere else:

- `lib/skills/bug-file/SKILL.md` (Steps 5/6/8) tells the agent to write/report `wiki/work/bugs/NNNN-<slug>.md` — bare, no `BUG-` prefix — one step before its own Step 7 links to the correctly-prefixed `BUG-NNNN-slug.md` in the index.
- `lib/skills/roadmap-create/SKILL.md` (Steps 2/6/7/9) is internally consistent but entirely bare (`NNN-slug.md`) throughout, disagreeing with `wiki/work/roadmaps/lifecycle.md`, with `roadmap-next`/`roadmap-assess`/`power-mode`/`uat-walk` (all of which already assume the prefixed form), and with all 12 roadmap files on disk.

Root cause (dated via `git log`): both skills predate the wiki2 migration commit (`a36905e`, 2026-06-11) that formalized `lifecycle.md` + the prefixed-filename convention across all six families. That migration updated `task-add`, `uat-generate`, `decision-create`, and `req-create` to match, but missed these two pre-existing skills. `roadmap-next/SKILL.md:42` still carries a stale example reflecting the old bare convention.

**Fix is text-only, no data migration**: this repo's own `wiki/work/bugs/` and `wiki/work/roadmaps/` files are already correctly named — only `bug-file`'s and `roadmap-create`'s *instructions* need to catch up to what their own `lifecycle.md`, their sibling skills, and reality already agree on.

## A separate, undocumented asymmetry: ID width

Independent of the above bug, the six families do **not** agree on zero-pad width, and nothing in the repo explains why:

| Width | Families |
|---|---|
| 3-digit (`NNN`) | tasks, UAT, requirements, roadmaps |
| 4-digit (`NNNN`) | bugs, decisions |

Each family is internally consistent, so this isn't broken — but it's a silent asymmetry a future skill author (e.g. copying `bug-file` as a template for a new family) could propagate without any documented reason to.

## External prior art

ADR tooling converges on the same *shape* this repo uses but splits on whether the prefix is textual: classic `adr-tools`/Nygard/Thunderbird use bare `NNNN-slug.md` (4-digit), while `adr-mcp` uses `ADR-NNNN-slug.md`. The closer analog — `sift`, a markdown+frontmatter multi-family file-based ticketing system — documents `<PREFIX>-<NNNN>--<kebab-slug>.md`, "zero-padded to at least four digits," immutable and globally unique: i.e., always-prefixed and single-width, which is what this repo's own `lifecycle.md` files already specify (modulo the width split). This validates fixing the two stale skills toward the existing prefixed convention rather than toward the bare alternative — the repo's own spec, sibling skills, and 100% of its own data already agree on "always prefix."

## Recommended next step

`/task-add` fix `bug-file`/`roadmap-create`/`roadmap-next` SKILL.md text to match their own `lifecycle.md` (see `raw/research/wiki-work-family-naming/index.md` for the exact line-level diffs). Optionally `/decision-create` to either document or collapse the 3-vs-4-digit split.

See also `source::[[wiki-work-family-naming]]`.
