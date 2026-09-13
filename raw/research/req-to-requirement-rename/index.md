---
topic: "Renaming lib/skills/req-* skills to requirement-* and finalizing the wiki-skill-simplification fix list into an execution roadmap"
slug: req-to-requirement-rename
researched: 2026-09-13
sources: [./sources.md]
---

# Research: Renaming `req-*` Skills to `requirement-*`

> This repo has already done this exact kind of rename twice (`adr-*` → `decision-*`, `prd-*` → `req-*`) and ships a working mechanism for it — `install-global.sh`'s `ORPHAN_SKILLS` pruning array. Renaming `req-*` → `requirement-*` is mechanically the same operation a third time: rename 6 skill directories + their internal `name:`/self-references, update ~5 files that name the commands, update 2 test files that hardcode the old paths, and extend `ORPHAN_SKILLS` so downstream installs clean up the stale global folders automatically. No new risk category — the codebase already validated this exact pattern survives.

## Research Questions
1. Which files reference `req-create`, `req-finalize`, `req-extract-decisions`, `req-update`, `req-retire`, or `req-compile` by name, and what needs to change in each?
2. Does this repo have prior art for this kind of rename, and does it still apply?
3. What breaks if the rename is done without updating every reference (tests, downstream installs)?
4. Is this a breaking change for the published npm package, and if so, of what kind?
5. What is the status of the `wiki-skill-simplification` findings since they were ingested — has anything already moved, and does the new roadmap need to account for it?

## Current State (Codebase)

**The `req-*` family is itself the product of a prior rename.** `lib/scripts/install-global.sh` lines 9-13 carry an `ORPHAN_SKILLS` array with a comment: *"Stale global skill folders from the wiki rename (adr -> decision, prd -> req)"* — listing `adr-create`, `adr-finalize`, `adr-next`, `adr-walkthrough`, `prd-create`, `prd-finalize`, `prd-extract-decisions`, `prd-update`, `prd-trash`, `prd-compile`. At install/update time, the script rsyncs the current `lib/skills/` into `~/.claude/skills/`, then separately checks for any of these old-named folders still sitting in the user's global skills directory (left over from before they last ran `bootstrap update`) and offers to delete them (lines 46-77) [S1].

**Full inventory of `req-*` references** (excluding the freshly-ingested `wiki/knowledge/` pages from this session, which are historical research artifacts, not live code, and are correctly left referring to the old names as a record of what was found):

| File | What references `req-*` |
|---|---|
| `lib/skills/req-create/SKILL.md` | `name: req-create` frontmatter; self-refs to `/req-finalize`, `/decision-create` in redirect text |
| `lib/skills/req-finalize/SKILL.md` | `name: req-finalize`; refs to `/req-update`, `/req-extract-decisions` |
| `lib/skills/req-extract-decisions/SKILL.md` | `name: req-extract-decisions`; refs to `/req-finalize`, `/req-create` |
| `lib/skills/req-update/SKILL.md` | `name: req-update`; refs to `/req-retire`, `/req-create`, `/req-finalize` (5+ occurrences) |
| `lib/skills/req-retire/SKILL.md` | `name: req-retire`; refs to `/req-update` (x2) |
| `lib/skills/req-compile/SKILL.md` | `name: req-compile`; ref to `/req-finalize` |
| `lib/skills/wiki-query/SKILL.md:92` | Example mention: `"(/req-create, /decision-create, etc.)"` |
| `lib/skills/README.md` | Command table rows for all 6 skills (lines 21-26) **plus** the documented invariant "every skill directory name matches its slash-command name" (line 145), given `req-create/` → `/req-create` as its own example |
| `CLAUDE.md` | Command table rows for `req-create`, `req-finalize`, `req-extract-decisions`, `req-update`, `req-compile` (lines 107-111) — **`req-retire` is missing from this table entirely**, a pre-existing doc-drift bug independent of the rename [S2] |
| `wiki/work/requirements/lifecycle.md` (local, always-refreshed copy) | Prose status descriptions cite `/req-create`, `/req-finalize`, `/req-update` (lines 31-32) |
| `lib/scripts/templates/wiki/work/requirements/lifecycle.md` (template source) | Identical prose, same lines — **this is the one that must actually be edited**; the local copy is overwritten by `sync-wiki-scaffold.sh` on the next `bootstrap update` regardless [S3] |
| `lib/scripts/install-global.sh` | The `ORPHAN_SKILLS` array itself needs a new batch of 6 old names added, following the existing `adr`/`prd` pattern exactly |
| `test/skill-frontmatter-aliases.test.js` | Hardcodes `path.join(REPO, 'lib', 'skills', 'req-create', 'SKILL.md')` and an assertion message string naming `req-create` |
| `test/wiki-work-naming-convention.test.js` | Hardcodes `read('lib/skills/req-create/SKILL.md')` in a test titled around `req-create SKILL.md` |
| `package.json` | **No change needed** — `files` ships `lib/` as a whole directory, not per-skill entries [S4] |

No hook (`lib/hooks/`) or `lib/scripts/templates/settings-*.json` file references `req-*` by name — hook matchers operate on tool names and Bash command patterns, not skill/slash-command names [S5].

## Key Findings

- **This is the third hop of an established rename pattern, not a novel operation.** The `ORPHAN_SKILLS` mechanism in `install-global.sh` exists specifically to absorb exactly this kind of churn for already-installed users [S1].
- **A pre-existing documentation bug, unrelated to the rename, was found**: `CLAUDE.md`'s Custom Commands table omits `/req-retire` even though `lib/skills/README.md` documents it — worth fixing in the same pass since both files are being touched anyway for the rename [S2].
- **The template-source constraint applies here too**: `wiki/work/requirements/lifecycle.md`'s prose (not just schema files edited by the DEC-0001 effort) must be edited in `lib/scripts/templates/wiki/work/requirements/lifecycle.md`, since the local `wiki/` copy is always-refreshed and silently overwritten [S3].
- **Two test files will fail immediately post-rename** unless updated in the same change — they hardcode the literal string `req-create` and the path `lib/skills/req-create/SKILL.md` [S6].
- **No npm packaging change required** — `package.json`'s `files` field ships `lib/` wholesale, so no per-skill-name entry needs editing there; this is not a breaking change to the published file manifest [S4]. It is, however, a behavior change for any project that already ran `bootstrap install`/`setup`/`update` — those installs need the `ORPHAN_SKILLS` fix landed before their *next* `update` to avoid accumulating both old and new skill folders side-by-side.
- **Status check on the `wiki-skill-simplification` findings** (per `wiki/hot.md`, read fresh before this research): `ROADMAP-0013` already exists and covers the separate cross-family-linking-gap fixes (`DEC-0001`, `TASK-0086`–`TASK-0093`) — that roadmap is **not** the same body of work as the skill-boilerplate-duplication findings from this session (`req-update`/`req-retire` bug, `wiki-tidy` rewrite, shared archive/ID-resolution docs, universal boilerplate extraction, `power-mode` shrink). None of those are yet on any roadmap or task. A bonus, still-unfiled finding also surfaced in `hot.md`: `bug-file/SKILL.md` writes `Status: new` but `bugs/lifecycle.md`'s enum starts at `open` — a third schema/skill drift bug in the bug family, same shape as `TASK-0085`'s fixes, not yet filed anywhere. *(inference — flagged in hot.md, not independently re-verified in this pass)*

## Constraints

- No library docs or web best-practices research applies here — this is a pure internal-repo mechanics question (file rename + reference update), so Phase 3 (Context7/Brave Search) was not used.
- The rename must not touch `wiki/knowledge/` pages created during the `wiki-skill-simplification` ingest — those are a historical record of what was found and correctly keep the old names.
- Must preserve the documented invariant "skill directory name matches its slash-command name" (`lib/skills/README.md:145`) — `requirement-create/` → `/requirement-create`, etc.
- Must not touch the unrelated `req-*`-adjacent but out-of-scope skill `req-trash` — it does not exist; the current family already renamed that slot to `req-retire` in a prior cleanup, so there is no orphan to carry forward from that name.

## Recommendation

Treat the rename as one atomic task (all 6 skills renamed together, plus every reference updated in the same change) rather than splitting per-skill — a partial rename would leave the family in a self-contradictory state (some commands say `/req-update`, others already say `/requirement-update`) for however long the split takes. Implementation outline:

1. `git mv` each of the 6 `lib/skills/req-*` directories to `lib/skills/requirement-*`.
2. Inside each moved `SKILL.md`, update its own `name:` frontmatter field and every internal cross-reference to a sibling skill (the ~15 occurrences catalogued above).
3. Update `lib/skills/README.md` (6 table rows + the invariant example at line 145), `CLAUDE.md` (5 existing rows, plus add the missing `req-retire`/`requirement-retire` row while touching this table anyway), `lib/skills/wiki-query/SKILL.md:92`.
4. Update `lib/scripts/templates/wiki/work/requirements/lifecycle.md` (the template source — this repo's own `wiki/work/requirements/lifecycle.md` will pick it up on the next scaffold sync, not by hand-editing it directly).
5. Add a new batch to `install-global.sh`'s `ORPHAN_SKILLS` array (`req-create req-finalize req-extract-decisions req-update req-retire req-compile`) so downstream `bootstrap update` runs clean up the old folders, exactly mirroring the existing `adr`/`prd` entries.
6. Update the two hardcoded test files.
7. Run the test suite (`node --test 'test/*.test.js'`) before considering the task done.

**Risks and mitigations:** the only real risk is an incomplete reference sweep leaving a dangling `/req-*` mention that confuses a user mid-flow — mitigated by doing the rename as one task with a final grep/search-for-pattern sweep as its last step, not by splitting the work. Command-name muscle-memory churn is a real but accepted cost — this repo has already normalized it twice.

## Next Steps
- Fold both this rename and the unfixed `wiki-skill-simplification` findings into one roadmap (`/roadmap-create` — already in progress in this session).
- `/task-add` for the rename as a single task once the roadmap's phase structure is confirmed.
- Separately worth a future `/bug-file` (not part of this roadmap unless the user wants it folded in): the `bug-file`/`Status: new` vs. `bugs/lifecycle.md`/`open` drift noted in `wiki/hot.md`.
