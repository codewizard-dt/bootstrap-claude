---
id: req-to-requirement-rename
title: "Research: Renaming req-* Skills to requirement-*"
updated: 2026-09-13
sources:
  - ../../../raw/research/req-to-requirement-rename/index.md
  - ../../../raw/research/req-to-requirement-rename/sources.md
confidence: extracted
tags: [skill-design, work-families, rename, install-scripts]
---

An inventory-and-risk pass for renaming the `req-*` requirement-family skills (`req-create`, `req-finalize`, `req-extract-decisions`, `req-update`, `req-retire`, `req-compile`) to `requirement-*`. **The `req-*` family is itself the product of a prior rename** — `lib/scripts/install-global.sh` carries an `ORPHAN_SKILLS` array with the comment "Stale global skill folders from the wiki rename (adr -> decision, prd -> req)", meaning this repo has already executed this exact class of change twice. Renaming `req-*` → `requirement-*` is the third hop of an established, working pattern, not a novel risk.

The full reference inventory spans 6 skill directories (each with a self-referential `name:` frontmatter field plus cross-references to sibling `req-*` skills), `lib/skills/README.md`'s command table and its "directory name matches slash-command name" invariant, `CLAUDE.md`'s command table (which was found to already be missing a `/req-retire` row — a pre-existing doc-drift bug unrelated to the rename), `lib/skills/wiki-query/SKILL.md`'s example mention, and the template-sourced `lib/scripts/templates/wiki/work/requirements/lifecycle.md` (its prose, not just its schema table, names `/req-create`/`/req-finalize`/`/req-update`). **Two test files hardcode the literal name `req-create` and its path** and will fail immediately post-rename unless updated in the same change. `package.json` requires no edit — it ships `lib/` wholesale, so this is not an npm-manifest breaking change, though existing installs still need the `ORPHAN_SKILLS` array extended so their next `bootstrap update` prunes the old folders.

`relates_to::[[wiki-skill-boilerplate-duplication]]` — this research was commissioned alongside finalizing that page's fix list into an execution roadmap; the two are separate bodies of work (this is a rename, that is a de-duplication effort) that happen to be scheduled together.
