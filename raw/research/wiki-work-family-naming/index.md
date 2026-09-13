---
topic: naming inconsistencies for the skills that manage the wiki work family file names and possible ways to normalize them
slug: wiki-work-family-naming
researched: 2026-09-13
sources: [./sources.md]
---

# Research: Wiki Work-Family Naming Inconsistencies

> The six `wiki/work/` families (tasks, UAT, bugs, decisions, requirements, roadmaps) each declare an authoritative `PREFIX-NNN(N)-slug.md` filename in their `lifecycle.md`, and four of the six creation skills (`task-add`, `uat-generate`, `decision-create`, `req-create`) write and reference exactly that. **`bug-file` and `roadmap-create` are the outliers**: their own SKILL.md instructions tell the agent to write a bare `NNN(N)-slug.md` filename (no `BUG-`/`ROADMAP-` prefix), which contradicts their own family's `lifecycle.md`, contradicts sibling skills in the same family (`bug-triage`, `bug-close`, `roadmap-next`, `roadmap-assess` all assume the prefixed form), and contradicts every file actually on disk. Separately, the ID *width* itself is genuinely inconsistent by design — bugs and decisions use 4-digit IDs while tasks/UAT/requirements/roadmaps use 3-digit IDs — with no documented rationale. The fix is mechanical: correct the two stale skill files to match their own lifecycle docs (already-established ground truth), and either document or collapse the 3-vs-4-digit split.

## Research Questions

1. What filename/ID convention does each of the six `wiki/work/` creation skills (`task-add`, `uat-generate`, `bug-file`, `decision-create`, `req-create`, `roadmap-create`) actually instruct, and does it match its family's `lifecycle.md`?
2. Do the on-disk files in each family match their `lifecycle.md`'s declared convention?
3. Are there other naming-adjacent inconsistencies (zero-pad width, slug rules, index-entry format, race-condition guarding on ID assignment) across the six creation skills?
4. Do any *other* skills (that read/parse these filenames rather than create them) encode assumptions that would break under either convention?
5. What does external prior art (ADR tooling, file-based ticketing systems) converge on for ID/filename conventions, and does it validate a specific fix?

## Current State (Codebase)

### The authoritative spec is consistent — every `lifecycle.md` says "prefixed filename"

All six `wiki/work/<family>/lifecycle.md` files declare the filename explicitly, and all six agree on the pattern `PREFIX-<digits>-slug.md`:

| Family | ID scheme (per lifecycle.md) | Declared filename |
|---|---|---|
| `tasks/` | `TASK-NNN` (3-digit) | `TASK-NNN-slug.md` |
| `uat/` | `UAT-NNN` (3-digit, mirrors task) | `UAT-NNN-slug.md` |
| `bugs/` | `BUG-NNNN` (4-digit) | `BUG-NNNN-slug.md` |
| `decisions/` | `DEC-NNNN` (4-digit; `DEC-NNNN#DM` per decision) | `DEC-NNNN-slug.md` |
| `requirements/` | `REQ-NNN` (3-digit) | `REQ-NNN-slug.md` |
| `roadmaps/` | `ROADMAP-NNN` (3-digit) | `ROADMAP-NNN-slug.md` |

Source: `wiki/work/tasks/lifecycle.md:8`, `wiki/work/uat/lifecycle.md:8`, `wiki/work/bugs/lifecycle.md:8`, `wiki/work/decisions/lifecycle.md:8`, `wiki/work/requirements/lifecycle.md:8`, `wiki/work/roadmaps/lifecycle.md:8`.

### On-disk files match the lifecycle spec, in every family, with no exceptions

Directory listings confirm every existing file — active and archived — carries the full prefix:

- `wiki/work/tasks/TASK-081-remove-deploy-doc-references.md`, `wiki/work/tasks/archive/TASK-001-...md` … up to `TASK-084`
- `wiki/work/uat/UAT-082-remove-github-actions.md`, `wiki/work/uat/archive/UAT-001-...md` …
- `wiki/work/bugs/BUG-0006-mv-guard-segment-split-omits-pipe.md`, `wiki/work/bugs/archive/BUG-0010-...md`
- `wiki/work/roadmaps/ROADMAP-012-sandbox-scaffolding-and-usage-visibility.md`, `wiki/work/roadmaps/archive/ROADMAP-002-...md`
- `wiki/work/decisions/` and `wiki/work/requirements/` currently hold **zero** actual decision/requirement files (only `lifecycle.md`, `index.md`, `archive/index.md`, `.gitkeep`) — so these two families have no on-disk evidence yet, only the skill/spec text to go on. [S1]

**There is no case in the repo of a bug or roadmap file existing without its prefix.** [S1]

### Two of six creation skills contradict this spec — in their own text

`bug-file/SKILL.md` and `roadmap-create/SKILL.md` instruct writing and reporting a **bare** filename, not the prefixed one their own family uses everywhere else:

| Skill | What it says to write | What it says elsewhere (same file) | What actually exists on disk |
|---|---|---|---|
| `bug-file` | Step 5: "Resolved filename: `wiki/work/bugs/NNNN-<slug>.md`"; Step 6: "Write to create `wiki/work/bugs/NNNN-<slug>.md`"; Step 8: "Created file: `wiki/work/bugs/NNNN-<slug>.md`" | Step 7 (same skill, one step later): index entry links to `BUG-NNNN-slug.md` (prefixed) | `BUG-NNNN-slug.md` (prefixed) — matches lifecycle.md, matches Step 7, contradicts Steps 5/6/8 |
| `roadmap-create` | Step 2: "Roadmaps live at `wiki/work/roadmaps/NNN-slug.md`"; Step 6: "Write to create `wiki/work/roadmaps/NNN-slug.md`"; Step 7 index link: `](NNN-slug.md)` | (internally consistent — bare throughout) | `ROADMAP-NNN-slug.md` (prefixed) — matches lifecycle.md, contradicts every step of this skill |

Source: `lib/skills/bug-file/SKILL.md:73,81,108`; `lib/skills/roadmap-create/SKILL.md:57,131,167`; cross-checked against `wiki/work/bugs/lifecycle.md:8` and `wiki/work/roadmaps/lifecycle.md:8`. [S2] [S3]

`bug-file`'s contradiction is *internal* — Step 7 of the very same skill already assumes the prefixed form (`BUG-NNNN-slug.md`) for the index link, one step after Steps 5/6 told the agent to write the bare form. Followed literally, the file that Step 6 creates would not be the file Step 7 links to.

`roadmap-create`'s contradiction is *external only* — the skill is self-consistent (bare form throughout) but disagrees with its own `lifecycle.md`, with sibling skills in the same family, and with all 12 roadmap files that exist.

### Sibling skills in both families already assume the prefixed form

The other skills that *read* bug/roadmap files (rather than create them) already encode the prefixed convention, meaning the bug-file/roadmap-create skills are the outliers even within their own command surface, not a second convention with its own following:

- `bug-triage/SKILL.md:139` — archived bug path: `wiki/work/bugs/archive/BUG-NNNN-slug.md` (prefixed)
- `bug-triage/SKILL.md:26`, `bug-close/SKILL.md:26` — argument hint example `BUG-NNNN (e.g. BUG-0042)` (prefixed)
- `bug-close/SKILL.md:125` — resolves linked tasks via `find_file` pattern `TASK-NNN-*` (prefixed, for the cross-referenced family)
- `roadmap-next/SKILL.md:42` — extracts the roadmap ID from "front matter **or filename prefix**, e.g. `003-billing.md` → `ROADMAP-003`" — this fallback path assumes the *bare* filename form, and would mis-parse the ID from every roadmap file that actually exists today (`ROADMAP-009-docker-fresh-machine-harness.md` does not start with a bare digit sequence). In practice this is likely a dead code path, since `lifecycle.md` guarantees `id: ROADMAP-NNN` is always present in frontmatter and would be read first — but it is dead code that documents the *wrong* filename shape, doubling down on `roadmap-create`'s stale convention. [S4]
- `roadmap-assess/SKILL.md`, `power-mode/SKILL.md`, `uat-walk/UAT-CORE.md:158` — all reference `ROADMAP-NNN` (prefixed) when constructing archive-index rows and links [S5]

### Git history suggests when the drift was introduced

`roadmap-create` and `bug-file` (as `file-bug`) both predate the wiki2 migration (`6717d8b`, 2026-05-12 "Rename skills to noun-first scheme, add roadmap-create/add/next skills"; `59d0638`, 2026-05-11 "Add bug tracking"). The wiki2 migration commit (`a36905e`, 2026-06-11 "Migrate to LLM Wiki architecture (wiki2)") is where `lifecycle.md` files and the current `PREFIX-NNN(N)-slug.md` convention were formalized across all six families — and appears to have updated `task-add`, `uat-generate`, `decision-create`, and `req-create` to match, but **missed** `bug-file` and `roadmap-create`, leaving their pre-migration bare-filename instructions in place while their lifecycle docs, sibling skills, and actual files moved on. [S6]

### The 3-digit vs. 4-digit ID width split is real, deliberate-looking, and undocumented

Every `lifecycle.md` states its digit width explicitly, and they do not agree:

| Width | Families |
|---|---|
| 3-digit (`NNN`) | tasks, UAT, requirements, roadmaps |
| 4-digit (`NNNN`) | bugs, decisions |

No memory, lifecycle doc, or `CLAUDE.md` passage explains *why* bugs and decisions get an extra digit while the other four families don't. [S1] Both groupings are internally consistent (every skill and file within a family respects its own family's width), so this is not itself a bug — but it is an unexplained asymmetry a new contributor (or a future skill author copying an existing skill as a template) has no way to discover the reasoning for, and could easily propagate incorrectly (e.g. a new family cloned from `bug-file` inheriting 4-digit width for no reason tied to its own expected volume).

### Other, smaller naming-adjacent inconsistencies found across the six creation skills

| Aspect | task-add | uat-generate | bug-file | decision-create | req-create | roadmap-create |
|---|---|---|---|---|---|---|
| Filename matches lifecycle.md | ✅ | ✅ (inherits task) | ❌ (Steps 5/6/8 bare) | ✅ | ✅ | ❌ (all steps bare) |
| Explicit slug quality bar in the skill itself | not restated | inherits task's slug | "lowercase, hyphen-separated, **2–5 words**, ≤60 chars" | "lowercase dash-separated ≤60 chars" | "lowercase dash-separated ≤60 chars" | "lowercase, dash-separated, ≤60 chars" |
| Re-verifies next-ID immediately before `Write` (closes the Q&A-pause race window) | ✅ Step 7a | N/A (ID mirrors task, no independent counter) | ❌ no re-verify step | ❌ no re-verify step | ❌ no re-verify step | ✅ Step 5 |
| Index entry format | flat bullet | flat bullet | flat bullet | flat bullet | flat bullet (SKILL.md text describes it as "Row/columns", but `requirements/index.md` itself specifies the same flat-bullet format as every other family) | flat bullet |

Sources: `lib/skills/task-add/SKILL.md` (Step 7a); `lib/skills/roadmap-create/SKILL.md` (Step 5); `lib/skills/bug-file/SKILL.md` (Step 4, no re-verify); `lib/skills/decision-create/SKILL.md` (Step 2, no re-verify); `lib/skills/req-create/SKILL.md` (Step 2 + Step 7, no re-verify, and the "Row/columns" wording at Step 7 versus `wiki/work/requirements/index.md:10`'s actual bullet-format spec). [S2][S7][S8]

The **race-condition guard** gap is worth calling out on its own: `task-add` and `roadmap-create` both explicitly re-scan for the next available number immediately before the `Write` call, specifically because their own Q&A/confirmation steps (which can take arbitrarily long, and during which another `/task-add` or `/roadmap-create` invocation could file first) sit between the initial number assignment and the write. `bug-file`, `decision-create`, and `req-create` have the same shape — assign a number early, then run a multi-step confirmation loop, then write — but none of them re-verify the number immediately before writing. This isn't a filename-*format* inconsistency, but it's a load-bearing pattern present in two of six skills and silently absent from three others (`uat-generate` doesn't need it, since its ID is derived from the task's).

## Constraints

- **`raw/` immutability and `wiki/` two-domain rules** apply to any fix — this research itself is filed under `raw/research/`, not written into `wiki/`, and any follow-on fix to `lib/skills/*/SKILL.md` is a `lib/` (source-of-truth-for-target-projects) change, not a `wiki/` change, since these are the *template* skill definitions this repo ships and syncs into consumer projects. Fixing them here does **not** retroactively rename anything in this repo's own `wiki/work/bugs/`/`wiki/work/roadmaps/` (those files already match the intended prefixed convention — it's the *skill instructions* that are stale, not the data).
- **No live decisions or requirements exist yet** in this repo's own wiki to test against — the `decision-create`/`req-create` conclusions rest on the skill text and lifecycle docs, not on-disk confirmation (unlike bugs/tasks/UAT/roadmaps, which have real files to check against).
- **`lib/skills/` is the single source of truth** copied to `~/.claude/skills/` by `install-global.sh` and referenced by every consumer project created via `bootstrap-claude` — a fix here propagates outward on the next `setup`/`update` run, so correctness matters beyond this one repo's own dogfood wiki.
- Any renumbering or width change to the **3-vs-4-digit split** would be a breaking, high-blast-radius change (every existing `BUG-NNNN`/`DEC-NNNN` reference, wikilink, and archived file would need to move) — this is categorically different in cost from fixing the two stale skill files, which requires editing text only, not renaming any file.

## Solution Comparison

| Criteria | A. Fix the two stale skills only (filename-prefix bug) | B. A + also collapse 3-vs-4-digit width to one standard | C. Leave as-is, document the split as intentional |
|---|---|---|---|
| **Approach** | Edit `bug-file/SKILL.md` (Steps 5/6/8) and `roadmap-create/SKILL.md` (Steps 2/6/7 and the Step-9/report text) to write/report the prefixed filename, matching their own `lifecycle.md` | Do A, then pick one width (3 or 4 digits) for all six families going forward; existing IDs keep their current width (append-only, never renumber) | Do nothing to the skills; add a one-line rationale to `CLAUDE.md`/`wiki/conventions.md` explaining why bugs/decisions get 4 digits |
| **Pros** | Fixes a real, verifiable, currently-live bug (agent following `bug-file`/`roadmap-create` literally today would write a file its own index step can't link to, or a file shaped unlike every other roadmap in the repo); zero data migration; low risk | Removes a second, harder-to-explain-to-newcomers asymmetry; a single width is one less thing to memorize per family | Zero engineering cost; preserves whatever historical reasoning existed (e.g. bugs/decisions anticipated higher volume) |
| **Cons** | Doesn't address the (much lower-severity) width inconsistency | Changing the *going-forward* width for tasks/UAT/req/roadmaps to 4 digits (or bugs/decisions to 3) is a template-level decision affecting every future consumer project, not just this repo; needs explicit sign-off | Leaves a real, reproducible documentation bug live in two skills indefinitely; the next agent invocation of `/bug-file` or `/roadmap-create` will still write a wrongly-shaped file unless a human notices and corrects it by hand |
| **Complexity** | Low — text-only edits to 2 files, no schema/ID changes | Medium — same 2 edits plus a template-wide width decision + doc update | Low — one doc sentence |
| **Dependencies** | None | None (no renumbering of existing IDs) | None |
| **Codebase fit** | Matches what `lifecycle.md`, sibling skills, and 100% of on-disk files already do — this is a correction toward existing consensus, not a new convention | Matches external prior art convergence on 4-digit width (adr-tools, sift) but breaks from this repo's own established 3-digit tasks/UAT/req/roadmap precedent, which has 90+ existing task/UAT files and 12 roadmap files already using 3 digits | Fit is fine either way; just adds an explanation, no behavior change |
| **Maintenance** | One-time; the also-inconsistent `roadmap-next` dead-code fallback (bare-filename ID parsing) is worth fixing in the same pass since it's the same root cause | Same as A plus a documented decision to point future skill authors at | Ongoing minor confusion cost for anyone who *does* ask "why 4 digits here" — currently unanswerable from the repo alone |

## Recommendation

**Do A now; treat B as optional and separate.** The filename-prefix bug in `bug-file` and `roadmap-create` is a genuine, reproducible defect — not a style preference — because it's independently falsifiable against each family's own `lifecycle.md` (the actual authoritative spec, per this repo's own conventions), against sibling skills in the same family, and against every file that already exists. It should be fixed regardless of what happens with the width question.

**Implementation outline**:
1. `lib/skills/bug-file/SKILL.md` — change Step 5's "Resolved filename", Step 6's `Write` target, and Step 8's "Created file" line from `wiki/work/bugs/NNNN-<slug>.md` to `wiki/work/bugs/BUG-NNNN-<slug>.md`, matching Step 7's index-link format (`BUG-NNNN-slug.md`) which is already correct.
2. `lib/skills/roadmap-create/SKILL.md` — change Step 2's "Roadmaps live at", Step 6's `Write` target, Step 7's index-link target (`](NNN-slug.md)` → `](ROADMAP-NNN-slug.md)`), and the Step-9 report/next-steps lines (which currently tell the user to run `/roadmap-next wiki/work/roadmaps/NNN-slug.md`) from bare to `ROADMAP-NNN-slug.md`.
3. `lib/skills/roadmap-next/SKILL.md` — correct the dead-but-wrong fallback comment at line 42 (`filename prefix, e.g. "003-billing.md" → "ROADMAP-003"`) to describe the real, prefixed filename shape, so a future reader doesn't re-derive the same stale convention from it.
4. Spot-check `lib/scripts/sync-wiki-scaffold.sh` and `lib/scripts/templates/wiki/` for any bundled example/placeholder bug or roadmap filenames that might also carry the bare form (not found in this pass, but the same historical drift could exist there).
5. No data migration needed — this repo's own `wiki/work/bugs/` and `wiki/work/roadmaps/` files are already correctly prefixed; only the *skill instructions* need to catch up to match them.

**Risks and mitigations**:
- Risk: a consumer project that already has bare-named bug/roadmap files (created by the buggy skill before this fix ships) would now get skill instructions describing a different shape than its own existing files. Mitigation: this is unlikely to have occurred in practice for roadmaps/bugs specifically, since the bug means agents were *told* to write bare names but the family's *own* lifecycle.md and sibling skills already expected prefixed names — meaning any agent that also consulted `lifecycle.md` (which `bug-file`/`roadmap-create` both explicitly instruct reading first) would likely have self-corrected toward the prefixed form already, as appears to have happened in this very repo (100% of on-disk files are prefixed despite the stale instructions). Still, `sync-wiki-scaffold.sh`'s copy-once vs. always-refresh handling of `lifecycle.md` (always-refresh) versus skills (rsynced wholesale by `install-global.sh`) means the fix reaches consumer projects on their next `update`.
- Risk: fixing `roadmap-next`'s fallback comment without also auditing whether *any* code path actually executes that fallback (versus only ever reading frontmatter). Mitigation: since this is a documentation/instruction file (not executable code), the "fix" is simply correcting the described filename shape in the example — low risk either way.

**Alternative if constraints change**: If a future audit finds this repo (or a consumer project) *does* have bare-named bug/roadmap files in the wild that predate the wiki2 migration, a one-time `git mv` rename pass (preserving history) would be needed before or alongside the skill-text fix, to bring data in line with the now-corrected instructions — the reverse of what's needed today, where data is already right and instructions are wrong.

## Next Steps

- To fix the concrete bug: `/task-add fix bug-file and roadmap-create SKILL.md to write/report BUG-NNNN-slug.md and ROADMAP-NNN-slug.md filenames matching their own lifecycle.md, sibling skills, and on-disk files; also correct the stale bare-filename fallback example in roadmap-next/SKILL.md`
- If the 3-vs-4-digit width split is worth settling explicitly rather than just living with: `/decision-create wiki-work ID zero-pad width standard` to record *why* bugs/decisions use 4 digits and tasks/UAT/requirements/roadmaps use 3 (or to formally collapse them), so a future skill author copying an existing family as a template has a documented answer instead of having to reverse-engineer it.
- Optional, lower-priority hygiene: add a `Step 2a`-style "re-verify next ID immediately before Write" step to `bug-file`, `decision-create`, and `req-create`, mirroring the pattern `task-add` (Step 7a) and `roadmap-create` (Step 5) already use, to close the same Q&A-pause ID-collision race window uniformly across all five independently-numbered families.
