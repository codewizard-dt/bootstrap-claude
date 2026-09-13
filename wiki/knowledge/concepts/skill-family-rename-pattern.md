---
id: skill-family-rename-pattern
title: "This Repo's Skill-Family Rename Pattern (ORPHAN_SKILLS Pruning)"
updated: 2026-09-13
sources:
  - ../../../raw/research/req-to-requirement-rename/index.md
confidence: extracted
tags: [skill-design, install-scripts, rename, work-families]
---

`derived_from::[[req-to-requirement-rename]]`. This repo has renamed a `wiki/work/` family's skill prefix twice already (`adr-*` → `decision-*`, `prd-*` → `req-*`), and both hops are captured in one place: `lib/scripts/install-global.sh`'s `ORPHAN_SKILLS` array, commented "Stale global skill folders from the wiki rename." At install/update time, after rsyncing the current `lib/skills/` into `~/.claude/skills/`, the script separately checks whether any of the array's old names still exist as folders in the user's global skills directory — left over from before they last updated — and offers to remove them.

**The repeatable steps for the next rename** (verified applicable to `req-*` → `requirement-*` and any future one):

1. `git mv` each old-prefixed skill directory to its new name.
2. Inside each moved `SKILL.md`, update its own `name:` frontmatter field and every cross-reference to a sibling skill in the same family.
3. Update every file that documents the command by name: `lib/skills/README.md`'s command table (plus its "directory name matches slash-command name" invariant example), `CLAUDE.md`'s command table, and any other skill's example mentions.
4. Update the **template source** for any touched `lifecycle.md` prose (`lib/scripts/templates/wiki/work/<family>/lifecycle.md`), never the local `wiki/` copy alone — it is always-refreshed and would silently lose a hand-edit.
5. Add a new batch of old names to `ORPHAN_SKILLS` in `lib/scripts/install-global.sh`, matching the existing `adr`/`prd` entries' shape exactly.
6. Update any test file that hardcodes the old name or path (two were found hardcoding `req-create` ahead of this rename).
7. Run the full test suite as the final check — a reference sweep this way catches stragglers no grep pass guarantees.

**Not a packaging concern**: `package.json`'s `files` field ships `lib/` as a whole directory rather than listing individual skill paths, so a rename inside `lib/skills/` never requires an npm-manifest edit — only the `ORPHAN_SKILLS` step matters for already-installed consumers.

Do the rename as **one atomic task**, not split per-skill — a partially-renamed family leaves some commands pointing at old names and others at new ones mid-way through, which is a worse user-facing state than either endpoint.
