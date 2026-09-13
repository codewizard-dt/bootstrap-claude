---
id: wiki-skill-simplification
title: "Research: Simplifying the wiki/work/ Family Skills"
updated: 2026-09-13
sources:
  - ../../../raw/research/wiki-skill-simplification/index.md
  - ../../../raw/research/wiki-skill-simplification/sources.md
confidence: extracted
tags: [wiki-conventions, work-families, skill-design, redundancy]
---

A structural audit of the ~30 `SKILL.md` files and 6 `lifecycle.md` files that make up the `wiki/work/` family subsystem (~6,000 lines total), looking for redundant or verbose text and for skills safe to merge or delete. **No `SKILL.md` in the family is a safe outright deletion** — every family skill was confirmed to provide a genuinely distinct entry point or behavior. The leverage instead is in de-duplicating shared *mechanics* using a pattern this repo already proves works: `uat-walk`/`uat-auto`/`uat-auto-plus` all defer to a shared `UAT-CORE.md` rather than restating its steps, `roadmap-assess` explicitly defers to `roadmap-next`'s parse/archive procedure, and `bug-assess` explicitly defers to `bug-triage`'s edit mechanics — each says "do not restate" in so many words.

The clearest counter-example is `wiki-tidy`, which does the opposite of that pattern: instead of referencing `wiki-lint`/`wiki-archive`/`wiki-rotate-log`, it re-embeds their full procedures (all 10 lint checks, the entire archive loop, the entire rotation steps), and this has **already caused an observed wording drift** between `wiki-tidy`'s and `wiki-archive`'s confirmation prompts for the identical action. **A genuine correctness bug was also found, independent of verbosity**: `req-update`'s inline retire branch skips the `git mv` archive step that `/req-retire` performs, leaving retired requirements in different end states depending which command was used.

Beyond these two, the audit catalogued several duplicated *mechanics* (not just prose) that risk silent drift: an "archive a work item" procedure (status flip + `git mv` + dual-index edit + log append) independently implemented at least 5 times across `task-audit`, `task-trash`, `roadmap-next`, `bug-triage`, `bug-close`, and `wiki-archive`; a number-allocation algorithm restated twice each in `roadmap-create` and `task-add`; and a decision-supersession scoring algorithm duplicated between `decision-create` and `decision-finalize`. It also corroborates and extends `relates_to::[[wiki-work-family-cross-linking-gaps]]`'s finding on task dependency encoding — that page found *three incompatible formats* for the same concept; this research adds that even the schema-consistent parts of that format are specified three separate times in skill bodies (`task-add`, `task-update`, `task-audit`) rather than once in `tasks/lifecycle.md`, where schema-level content belongs.

Universal boilerplate — a prereqs line, a "never `sed`/`awk`/`echo >>`, use `Edit`" hygiene rule, and a file/ID-resolution table — recurs verbatim across roughly 10–20 skills each, a pure token-cost issue with no drift risk, extractable into short shared reference docs the same way `UAT-CORE.md` already works. Conversely, some length was confirmed as **justified, not boilerplate**: `wiki-query`'s capped fallback-ingest gate and `wiki-lint`'s 10 sub-checks are explicit judgment/safety logic, not restated ceremony.

**Constraint carried over from `relates_to::[[wiki-work-family-synergy]]`**: this repo is the bootstrap template's own source, so any schema-level fix (the dependency-blockquote format, the supersession algorithm) must land in `lib/scripts/templates/wiki/work/<family>/lifecycle.md` via `/decision-create`, never hand-edited only in this repo's local `wiki/` copy, which is silently overwritten on the next `sync-wiki-scaffold.sh` run.

See `relates_to::[[wiki-skill-boilerplate-duplication]]` for the full duplication catalogue and prioritized fix order.
