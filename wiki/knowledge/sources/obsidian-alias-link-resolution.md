---
id: obsidian-alias-link-resolution
title: Why TASK-NNN-Style Links Don't Resolve, and How to Fix It
updated: 2026-08-15
sources:
  - ../../../raw/research/obsidian-alias-link-resolution/index.md
  - ../../../raw/research/obsidian-alias-link-resolution/sources.md
confidence: extracted
tags: [obsidian, wikilinks, aliases, wiki-conventions]
---

Every `[[TASK-NNN]]`/`[[UAT-NNN]]`/`[[BUG-NNNN]]`/`[[DEC-NNNN]]`-style link in this wiki looks like a link (blue, clickable) but **never actually resolves** — clicking one offers to create a new empty note, even when the real target file genuinely exists. Root cause, confirmed directly against `wiki/work/tasks/archive/TASK-009-activate-confidence-field.md`: Obsidian's wikilink click-resolver matches **only against real filenames** — never against any frontmatter field, including this repo's own `id:` key and even Obsidian's *native* `aliases:` property. This is confirmed **intentional design**, not a bug, by an Obsidian moderator on a still-open forum feature request ("Ability to use aliases as working links") — `aliases:` only powers the autocomplete/suggestion step while composing a link (producing a piped `[[real-filename|alias]]`), never the resolution of an already-written bare `[[alias]]`. Since every work-item file here is named `TASK-NNN-slug.md` (not bare `TASK-NNN.md`) and carries `id:` but no `aliases:` field at all, the gap is systemic across all 6 work families, not specific to Task 9.

**Fix: `relates_to::[[alias-linker]]` plugin + an `aliases:` backfill, no rename needed.** The plugin patches Obsidian's link-lookup step with an alias fallback — real filename first, then `aliases:` frontmatter — applied consistently across graph view, backlinks, embeds, and previews. Adding `aliases: [TASK-NNN]` (mirroring the existing `id:` value) to every work-item's frontmatter, once, at the target, makes every existing and future bare `[[TASK-NNN]]` reference across the whole wiki start resolving — with zero changes to any of the link text already written. The zero-plugin alternative (rename every file to bare `TASK-NNN.md`, matching Obsidian's core resolution rule directly) is a much larger structural migration — every skill's `TASK-NNN-*.md` glob and every path-based markdown link would need updating — though it's newly viable now that `derived_from::[[front-matter-title]]` is installed to keep bare-ID filenames readable in the UI, should this repo ever want to drop the plugin dependency.

Not yet implemented — three follow-on pieces identified: (1) add `aliases:` to the frontmatter templates in `task-add`, `uat-generate`, `bug-file`, `decision-create`, `roadmap-create`, `req-create`; (2) backfill `aliases:` onto every existing work-item file; (3) bundle `alias-linker` into `install-obsidian.sh`'s plugin set.
