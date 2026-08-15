---
topic: the links aren't working — TASK-009 shows "is not created yet" even though the file exists; why, and can links work by the id: frontmatter field via a setting or plugin?
slug: obsidian-alias-link-resolution
researched: 2026-08-15
---

# Primary Sources — Why `[[TASK-009]]`-Style Links Don't Resolve, and How to Make Them Work

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `wiki/work/tasks/archive/TASK-009-activate-confidence-field.md` (frontmatter) | 2026-08-15 | Direct confirmation: `id: TASK-009`, no `aliases:` field, filename is `TASK-009-activate-confidence-field.md` not `TASK-009.md` |
| S2 | codebase | `lib/skills/task-add/SKILL.md` Step 8, `lib/skills/uat-generate/SKILL.md` Step 3 (frontmatter templates) | 2026-08-15 | Confirms the gap is systemic: neither work-item template ever sets `aliases:`, only `id:` |
| S3 | web | https://forum.obsidian.md/t/wikilink-resolution-does-not-honor-frontmatter-aliases-1-12-7/113902 | 2026-08-15 | Moderator-confirmed: wikilink click-resolution (`getFirstLinkpathDest`/`getLinkpathDest`) never consults `aliases:` frontmatter — only the autocomplete/suggestion step does, producing a piped link; a bare `[[alias]]` never resolves. Explicitly "not a bug" — intentional design |
| S4 | web | https://forum.obsidian.md/t/ability-to-use-aliases-as-working-links/8993 | 2026-08-15 | The matching, still-open feature request confirming this limitation is known and unresolved by Obsidian core |
| S5 | web | https://community.obsidian.md/plugins/alias-linker | 2026-08-15 | Alias Linker plugin description: alias-fallback link resolution across graph/backlinks/embeds/preview; nearest-note tiebreak; disable-anytime reversibility |
| S6 | web | https://github.com/johannrichard/alias-linker | 2026-08-15 | Repo confirmation; maintenance signal (12 releases/~2yr, latest 1.0.2 released last month) |
| S7 | web | https://raw.githubusercontent.com/johannrichard/alias-linker/master/manifest.json | 2026-08-15 | Exact manifest: `id: "alias-linker"`, self-description "An experimental plugin that resolves bare alias links" |
| S8 | web | https://forum.zettelkasten.de/discussion/3182/seeking-a-better-way-to-handle-id-based-links-between-archive-and-obsidian | 2026-08-15 | Independent confirmation from a different PKM community: same exact pain point (ID-only links don't resolve, click creates a blank note), same two community-known workarounds (full piped links, or accept the limitation) |
| S9 | web | https://deepwiki.com/kepano/obsidian-skills/2.2-internal-links-and-wikilinks | 2026-08-15 | "Obsidian resolves these links by filename, without requiring file extensions or full paths" — confirms filename-only resolution as the core rule |

## Excerpts

### S3 — Wikilink resolution does not honor frontmatter aliases (1.12.7)
https://forum.obsidian.md/t/wikilink-resolution-does-not-honor-frontmatter-aliases-1-12-7/113902
> Summary In Obsidian 1.12.7, frontmatter aliases are correctly parsed and surfaced by autocomplete (getLinkSuggestions), but the wikilink resolver (getFirstLinkpathDest / getLinkpathDest) does not consult them. Clicking [[ ]] creates a new note instead of resolving to the file that declares the alias.
>
> [Moderator WhiteNoise]: When you start writing `[[the illus` it should suggest the note with the alias and will create a link `[[illusion-of-knowledge|the illusion of knowledge]]` that's all it does.

### S5 — Alias Linker - Obsidian Plugin
https://community.obsidian.md/plugins/alias-linker
> Internally, the plugin extends Obsidian's link lookup step with an alias fallback. In practice, this means Obsidian tries its normal file-path resolution first, and only if that fails does Alias Linker look for notes whose aliases match the link text.
>
> Link to notes by alias using bare [[alias]] wikilinks and resolve them to the note that defines that alias whenever a matching filename doesn't exist. Keep standard filename links when a file matches, pick the nearest note if multiple share an alias, and apply alias resolution across graph view, backlinks, embeds, and previews.

### S7 — alias-linker manifest.json
https://raw.githubusercontent.com/johannrichard/alias-linker/master/manifest.json
> "description": "An experimental plugin that resolves bare alias links."

### S8 — Seeking a Better Way to Handle ID-Based Links Between Archive and Obsidian
https://forum.zettelkasten.de/discussion/3182/seeking-a-better-way-to-handle-id-based-links-between-archive-and-obsidian
> In The Archive, my notes are linked using unique IDs, while the file names follow the format "ID Title". However, in Obsidian, linking by ID alone isn't straightforward as each time I click a link, a new blank note opens. I know I can use aliases to make the links compatible, but I don't like how they appear in my notes—I'd prefer to keep just the ID visible... What I'm looking for: A way for Obsidian to recognize and resolve ID-based links properly.

### S9 — Internal Links and Wikilinks | kepano/obsidian-skills | DeepWiki
https://deepwiki.com/kepano/obsidian-skills/2.2-internal-links-and-wikilinks
> Wikilinks connect notes using double-bracket notation. Obsidian resolves these links by filename, without requiring file extensions or full paths.
