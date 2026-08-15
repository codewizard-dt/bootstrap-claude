---
topic: the links aren't working — TASK-009 shows "is not created yet" even though the file exists; why, and can links work by the id: frontmatter field via a setting or plugin?
slug: obsidian-alias-link-resolution
researched: 2026-08-15
sources: [./sources.md]
---

# Research: Why `[[TASK-009]]`-Style Links Don't Resolve, and How to Make Them Work

> Obsidian's wikilink **click-resolution** step only ever matches a bare `[[TASK-009]]` against a real **filename** — never against frontmatter, including this repo's `id:` field and even Obsidian's own native `aliases:` property. That's confirmed as *intentional design*, not a bug, by an Obsidian moderator on a still-open forum feature request. Since every work-item file in this wiki is named `TASK-NNN-slug.md` (not bare `TASK-NNN.md`) and carries `id: TASK-NNN` but no `aliases:` field, every `[[TASK-NNN]]`/`[[UAT-NNN]]`/`[[BUG-NNNN]]`/`[[DEC-NNNN]]` link ever written across the wiki is cosmetically blue but never actually resolves — Obsidian offers to create a new empty note instead. The fix costs one plugin (**Alias Linker**, `johannrichard/alias-linker`) plus one new frontmatter field (`aliases: [TASK-NNN]`) added to every work-item template and backfilled onto existing files — no rename, and no change to any of the thousands of already-written link occurrences across the wiki.

## Research Questions
- Why does `[[TASK-009]]` show "is not created yet" when `TASK-009-activate-confidence-field.md` genuinely exists and its frontmatter has `id: TASK-009`?
- Does Obsidian's link resolver consult frontmatter at all — the repo's own `id:` field, or Obsidian's native `aliases:` property?
- Is this scoped to Task 9, or does it affect every work-item link across the wiki?
- Can this be fixed via a core Obsidian setting, or does it require a plugin?
- If a plugin is the answer, which one, how mature is it, and what does adopting it cost?

## Current State (Codebase)

- **Confirmed directly**: `wiki/work/tasks/archive/TASK-009-activate-confidence-field.md`'s frontmatter is `id: TASK-009`, `title: "..."`, `status: done`, … — **no `aliases:` field anywhere**. The filename is `TASK-009-activate-confidence-field.md`, not `TASK-009.md`.
- **This is systemic, not a one-off**: `lib/skills/task-add/SKILL.md`'s frontmatter template (Step 8) is `id: TASK-NNN, title, status, created, updated, depends_on, blocks, parallel_safe_with, uat, tags` — no `aliases:` key. `lib/skills/uat-generate/SKILL.md`'s UAT frontmatter template (Step 3) is `id: UAT-NNN, title, status, task, created, updated` — same gap. By inspection, this pattern is repo-wide across all 6 work families (`wiki/work/{tasks,uat,bugs,decisions,roadmaps,requirements}/`) — every skill that creates a work-item file sets `id:` but never `aliases:`.
- **By contrast, `wiki/knowledge/` pages already do this correctly**: every entity/concept/source page's frontmatter template includes `aliases: [Alternative Name]` (confirmed in `lib/skills/wiki-ingest/SKILL.md` Step 3/4's templates, and in every entity page created earlier in this session, e.g. `graph-styler.md`'s `aliases: [moonweave/obsidian-graph-styler]`). The `work/` half of the wiki never got the equivalent.
- Every `[[TASK-NNN]]`/`implements::[[TASK-NNN]]`/`depends_on::[[TASK-NNN]]`/`> **Source task**: [[TASK-NNN]]` occurrence across the entire wiki (task files, UAT files, decision files, roadmap files, `wiki/log.md`) is affected identically — this is not specific to TASK-009.

## Key Findings

1. **Obsidian's wikilink resolver is filename-only; frontmatter is never consulted at click time.** The internal API Obsidian uses to resolve `[[X]]` to a real file (`getFirstLinkpathDest`/`getLinkpathDest`) matches only a real filename (case-insensitive, `.md` optional, path optional) [S1, S2]. A repo's own custom frontmatter key — like this wiki's `id: TASK-009` — is invisible to Obsidian core entirely; Obsidian has no concept of it.
2. **This is true even of Obsidian's own native `aliases:` property — confirmed as intentional, not a bug.** A 2026 forum bug report, "Wikilink resolution does not honor frontmatter aliases," showed that a bare `[[the illusion of knowledge]]` matching a note's `aliases:` entry still creates a new empty note on click. An Obsidian moderator (WhiteNoise) replied this is by design: aliases only power the **autocomplete/suggestion** step while *composing* a link — selecting a suggested alias produces a piped link `[[real-filename|alias-text]]`, and only that piped form (which names the real file) actually resolves. A bare `[[alias-text]]` typed or generated directly — exactly how every skill in this repo writes `[[TASK-NNN]]` — has no such piped target and never resolves [S3]. The matching, still-open forum feature request is literally titled "Ability to use aliases as working links" [S4].
3. **A plugin exists that patches exactly this gap: Alias Linker (`johannrichard/alias-linker`, id `alias-linker`).** It "extends Obsidian's link lookup step with an alias fallback: Obsidian tries its normal file-path resolution first, and only if that fails does Alias Linker look for notes whose `aliases` match the link text" — and this fallback is applied consistently "across graph view, backlinks, embeds, and preview link state," not just click-navigation [S5, S6]. When multiple notes share the same alias, it picks the nearest one by folder distance from the linking note [S5]. It can be disabled at any time to instantly revert to stock Obsidian behavior [S5]. Its own manifest self-describes it as "an experimental plugin" [S7] — moderately maintained (12 releases over ~2 years, latest 1.0.2 released last month) [S6], not one of Obsidian's high-download flagship plugins, so it carries more trust risk than Dataview-tier plugins already bundled in this repo's installer.
4. **Other Zettelkasten/PKM users hit this exact problem independently, converging on the same two answers.** A Zettelkasten-forum thread about linking The Archive (a UID-based app) into Obsidian confirms: "in Obsidian, linking by ID alone isn't straightforward — each time I click a link, a new blank note opens... What I'm looking for: a way for Obsidian to recognize and resolve ID-based links properly," with the community answer being either (a) always author full piped links, or (b) accept the aliases-are-suggestion-only limitation [S8]. No one in that thread had yet found Alias Linker specifically, suggesting it is a relatively under-discovered fix for a well-known pain point.
5. **A zero-plugin alternative exists: name files by bare ID.** Obsidian's resolver matches filenames natively with no plugin — renaming every work-item file from `TASK-NNN-slug.md` to bare `TASK-NNN.md` would make `[[TASK-009]]` resolve directly, no `aliases:` or plugin needed at all [S1]. This repo already installed **Front Matter Title** earlier today specifically to show a note's `title:` frontmatter instead of its filename everywhere (including the graph) — so the usual objection to bare-ID filenames ("ugly, unreadable in the file explorer") is already mitigated for this vault. This is the option other Zettelkasten users converge on when they don't want to add a plugin [S9], but it is a much larger migration here: every skill that globs `TASK-NNN-*.md` (`find_file` calls in `task-add`, `uat-generate`, `roadmap-next`, `task-audit`, etc.), every path-based markdown link (`(TASK-NNN-slug.md)` used throughout `wiki/work/*/index.md` and `archive/index.md` tables), and git history for every renamed file would all need updating — a structural rename, not a one-line addition.

## Constraints

- The fix must not require rewriting the thousands of already-written `[[TASK-NNN]]`-style link occurrences across the wiki — only the Alias Linker approach achieves that (fixing the *target*, once, makes every existing reference start working).
- Whatever fix is chosen must not silently break for users who don't install the plugin/theme — this repo's `raw/llm-wiki.md` pattern spec states the wiki must remain "just a git repo of markdown files" with zero plugins *required*. A plugin-based fix is therefore an enhancement (like Dataview, Front Matter Title, etc.), not something the wiki's correctness can depend on — the underlying `id:`/frontmatter data must stay the source of truth regardless of whether any given reader has the plugin installed.
- `aliases:` is a genuinely different frontmatter key from this repo's existing `id:` — both would need to coexist (`id:` for LLM/grep-based lookups and skill logic, `aliases:` for Obsidian's alias index) rather than one replacing the other.
- Backfill scope: every existing file across all 6 work families (active + archived) needs one `aliases: [TASK-NNN]`-style line added — a bulk mechanical edit, not per-file judgment, but touching potentially 100+ files.

## Solution Comparison

| Criteria | A: Alias Linker plugin + `aliases:` backfill | B: Rename files to bare `TASK-NNN.md` | C: Do nothing (status quo) |
|----------|---|---|---|
| **Approach** | Install `alias-linker`; add `aliases: [TASK-NNN]` to every work-item's frontmatter (templates + backfill existing files) | Rename every `TASK-NNN-slug.md` → `TASK-NNN.md` (and equivalent for UAT/BUG/DEC/ROADMAP/REQ); rely on Front Matter Title (already installed) for readable display | Leave links cosmetically blue but non-functional; readers navigate via `find_file`/search instead |
| **Pros** | Zero changes to existing link text anywhere; low, mechanical backfill (one new frontmatter line per file); reversible (disable plugin, nothing breaks further) | Zero new plugin dependency; matches Obsidian's core resolution model exactly, no fallback logic involved | No effort at all |
| **Cons** | New plugin dependency, self-described "experimental"; frontmatter-only fix depends on every reader having it installed to *click* through, though `aliases:` itself is inert/harmless without it | High blast radius: every skill's `find_file 'TASK-NNN-*.md'` glob, every path-based markdown link, git history for every renamed file, needs updating; a structural migration, not a one-line addition | The exact problem the user reported persists indefinitely |
| **Complexity** | Low (plugin install mirrors the existing 4-plugin bundle mechanism; frontmatter backfill is mechanical) | High (touches every skill that names or globs work-item files, plus every existing cross-reference) | None |
| **Dependencies** | +1 community plugin (5th, alongside Dataview/Graph Link Types/Breadcrumbs/Front Matter Title) | None | None |
| **Codebase fit** | Extends the already-established `install-obsidian.sh` `obsidian.plugins` bundle pattern directly | Would need a dedicated migration task/roadmap, higher risk of breaking something | N/A |
| **Maintenance** | Low — one more line in each new work-item template going forward | Low after migration, but the migration itself is the expensive part | Zero, but the pain persists |

## Recommendation

**Option A (Alias Linker + `aliases:` backfill)** — clearly the lower-risk, lower-effort fix, and consistent with how this repo already treats Obsidian enhancements as optional layers on top of a plugin-free-correct wiki.

**Implementation outline:**
1. Add `aliases: [TASK-NNN]` (matching the file's own `id:` value) to the frontmatter template in each of the 6 work-family skill files that create files: `task-add`, `uat-generate`, `bug-file`, `decision-create`, `roadmap-create`, `req-create` — one new line each, placed alongside `id:`.
2. Backfill `aliases:` onto every existing work-item file (active + `archive/` — likely 100+ files across `wiki/work/{tasks,uat,bugs,decisions,roadmaps,requirements}/`) — a mechanical, scriptable edit (frontmatter already has `id:`; `aliases:` is just `[<same value>]`).
3. Add `alias-linker` (repo `johannrichard/alias-linker`, plugin id `alias-linker`) as a 5th plugin in `install-obsidian.sh`'s `obsidian.plugins` bundle, following the exact `_install_obsidian_plugin`/`_enable_obsidian_plugin` mechanism already used for the other four.
4. Update `bootstrap-prefs-schema.json`'s `obsidian.plugins` detail text and `lib/scripts/README.md`'s registry row to mention all five plugins.
5. Verify end-to-end: install into this repo's own vault, confirm `[[TASK-009]]` now resolves (blue, not offering to create), confirm the graph view now draws a real edge for it.

**Risks and mitigations:**
- *Plugin marked "experimental" by its own author* → mitigate by treating it as opt-in (same `obsidian.plugins` consent gate as the other four, never silently defaulted), and by keeping `id:` as the load-bearing field for anything LLM/skill-driven — `aliases:` is purely an Obsidian-side convenience layer on top.
- *A reader without the plugin still sees non-functional links* → acceptable and consistent with this repo's stated design ("Obsidian is never a hard dependency"); the wiki's correctness (grep-ability, `id:`-based cross-referencing by skills) is unaffected either way.
- *Backfill touches many files* → mechanical, not judgment-heavy; a single script/pass can add `aliases: [<id>]` derived directly from each file's own existing `id:` field.

**Alternative if constraints change:** if this repo later wants zero plugin dependencies for this specific fix, Option B (bare-ID filenames) becomes viable specifically *because* Front Matter Title is now already installed for display — but it should be scoped as its own deliberate migration task, not bundled into this fix.

## Next Steps

- `/task-add Add aliases: [<id>] to the frontmatter templates in task-add, uat-generate, bug-file, decision-create, roadmap-create, and req-create SKILL.md files`
- `/task-add Backfill aliases: [<id>] onto every existing work-item file across all 6 families (active + archive)`
- `/task-add Bundle the Alias Linker plugin (johannrichard/alias-linker) into install-obsidian.sh's obsidian.plugins bundle, update schema/README docs, add tests`
- Given this spans 3 related but independently-shippable pieces of work (template edits, backfill, plugin wiring), consider `/roadmap-create` to sequence them rather than three unordered tasks.
