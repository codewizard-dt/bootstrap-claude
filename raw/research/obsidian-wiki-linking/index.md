---
topic: "Obsidian and how it's used in this repo as the basis for wiki linking, including the named relations like relates_to:: — and whether that actually uses a plugin"
slug: obsidian-wiki-linking
researched: 2026-08-13
sources: [./sources.md]
---

# Research: Obsidian and Typed Wiki Linking

> Obsidian's core `[[wikilink]]` syntax is untyped — a link only says two notes are connected, never *how*. This repo's `rel::[[target]]` convention (e.g. `implements::[[REQ-012]]`) is not a bespoke invention: it's Dataview's standard "inline field" syntax, using a wikilink as the field value. It works as plain markdown/frontmatter today with zero plugins installed, but *querying or visualizing* by relation type requires installing the Dataview plugin (and optionally Breadcrumbs or Graph Link Types on top of it). Right now this repo writes the syntax but never queries it — no `​```dataview` blocks exist anywhere in the vault, so the typed-link vocabulary is currently a human/LLM-readable convention only, not a wired-up query layer.

## Research Questions

1. What is Obsidian, and how does this repo currently reference/use it?
2. Is the `rel::[[target]]` typed-link syntax in `wiki/conventions.md` native to Obsidian, or does it require a plugin?
3. Which specific plugin(s) implement that syntax mechanism, and how do they work?
4. What alternative/complementary Obsidian plugins exist for typed relations, and how do they differ?
5. Does this repo actually consume Dataview today, or is the convention purely declarative?

## Current State (Codebase)

- **`raw/llm-wiki.md`** (the immutable pattern spec this repo is built from) frames Obsidian purely as the *human-side viewer*, never a hard dependency: "I have the LLM agent open on one side and Obsidian open on the other... Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase." It explicitly closes with "The wiki is just a git repo of markdown files. You get version history, branching, and collaboration for free" [S1] — i.e. the wiki must remain fully functional with zero Obsidian plugins.
- The same file's "Tips and tricks" section name-checks four Obsidian-ecosystem tools by role, not as requirements: **Obsidian Web Clipper** (web→markdown capture into `raw/`), **graph view** (spotting hubs/orphans), **Marp** (slide decks from wiki content), and **Dataview** — described exactly as: "an Obsidian plugin that runs queries over page frontmatter. If your LLM adds YAML frontmatter to wiki pages (tags, dates, source counts), Dataview can generate dynamic tables and lists" [S1]. This is the only plugin the spec names in connection with querying — no other typed-link plugin is mentioned in `raw/llm-wiki.md` itself.
- **`wiki/conventions.md` §3 "Typed links"** is where this repo's own convention lives: plain `[[wikilinks]]` remain always valid, and when a link "has a *meaning*," it's annotated inline as `rel::[[target]]`, e.g.:
  ```
  implements::[[REQ-012]]
  supersedes::[[DEC-0003#D2]]
  derived_from::[[sources/karpathy-llm-wiki]]
  ```
  with a fixed vocabulary: `derived_from`, `supersedes`, `superseded_by`, `implements`, `uses`, `depends_on`, `contradicts`, `relates_to`, `caused`, `fixed`. The convention is explicitly "declared now but not backfilled" — used going forward, with a future `/wiki-lint` pass expected to backfill older pages.
- This convention is **already in active use** across the existing wiki — e.g. `uses::[[claude-obsidian]]`, `derived_from::[[Andrej Karpathy]]`, `implements::[[wiki-tooling-improvements]]` all appear in `wiki/knowledge/` pages found during this research (`wiki-multi-writer-safety.md`, `andrej-karpathy.md`, `wiki-tooling-improvements.md`).
- **`.gitignore`** excludes `.obsidian/` — the per-vault Obsidian settings folder — confirming the repo expects someone may open `wiki/` (or the whole repo) as a live Obsidian vault locally, without that configuration ever being committed or shared.
- **No `​```dataview` query blocks exist anywhere in the repo** (confirmed by an exhaustive pattern search) — so today, nothing actually *executes* against the typed-link vocabulary. The lines render as ordinary text plus a clickable wikilink whether or not Dataview is installed; only the *querying/filtering/coloring* payoff is plugin-gated.
- There is a `wiki/knowledge/entities/tools/claude-obsidian.md` page, but **no dedicated entity page for Obsidian.md itself** despite it being referenced repeatedly in `raw/llm-wiki.md` and implicitly required for the graph-view/Dataview tips to mean anything. `claude-obsidian` is an unrelated third-party AI-wiki reimplementation project (`github.com/AgriciDaniel/claude-obsidian`) that merely shares "Obsidian" in its name — worth a disambiguation note if a reader could conflate the two.

## Key Findings

1. **Obsidian's core wikilink is untyped by design.** Official docs describe `[[Page Name]]` purely as a structural connection ("By linking notes, you can create a network of knowledge"); the only native customization is display text via `[[Page|Alias]]`, which changes appearance, not semantics. There is no built-in way to say a link *means* "supersedes" or "implements" [S2].

2. **The `rel::[[target]]` syntax is literally Dataview's "inline field" syntax, not a bespoke invention.** Dataview supports metadata as `key:: value` written inline in note content (as opposed to YAML frontmatter). When an entire line consists of nothing but `key:: value`, Dataview treats it as a **"full-line field"** — exactly the pattern this repo uses on its own line: `implements::[[REQ-012]]`. The value half can be any Dataview literal, including a wikilink, which Dataview indexes and can query on [S3, S4]. Confirmed directly: Dataview's own docs describe inline fields as "everywhere in your file... via a Key:: Value syntax" [S3], and DeepWiki's structural breakdown of the plugin's source confirms the full-line-field parsing rule explicitly [S4].

3. **The syntax degrades gracefully with zero plugins — but querying by type needs Dataview.** Without Dataview installed, `implements::[[REQ-012]]` in Obsidian just renders as plain text followed by a normal clickable link; nothing breaks. To actually ask "show me every page that `implements::` REQ-012" or list/table/filter by relation, the Dataview plugin (DQL, inline queries, or JS queries) has to be installed and the field queried [S3]. This matches `raw/llm-wiki.md`'s own framing of Dataview as generating "dynamic tables and lists" over frontmatter/fields the LLM already writes [S1] — the mechanism is real, it's just not wired up in this repo yet (no query blocks exist).

4. **Two mature plugins build on exactly this mechanism for graph/hierarchy visualization, and are natural next steps if the vocabulary should become visible, not just greppable:**
   - **Graph Link Types** (`natefrisch01/Graph-Link-Types`) — reads Dataview-indexed inline fields and renders them as labeled, colored edges directly in Obsidian's native graph view. Their own example: writing `related:: [[Note]]` makes the graph view display the word "related" on that edge [S5]. This would make this repo's `implements::`/`supersedes::`/`contradicts::` vocabulary visually distinguishable in the graph with no change to how pages are authored — it is a pure consumer of the syntax already in place.
   - **Breadcrumbs** (`michaelpporter/breadcrumbs`, formerly a community favorite) — a heavier tool aimed at hierarchical/associative navigation rather than free-form semantic typing. Ships five default "edge fields" (`up`, `down`, `same`, `next`, `prev`), each fully renameable/extensible (e.g. this repo's `depends_on`/`supersedes` vocabulary could become custom edge fields), reads structure from **frontmatter properties, Dataview inline fields, tags, or naming schemes** (Dendron-style, Johnny.Decimal, dates, custom regex) — so it can layer directly on the existing `rel::[[target]]` lines without any rewrite. It derives *implied* inverse relations automatically (if A is `up` from B, B is `down` from A) and adds a breadcrumb trail, tree/matrix side panels, and Mermaid/Markmap/Canvas export [S6, S7].

5. **A newer, differently-mechanized plugin — Wikilink Types (`penfieldlabs/obsidian-wikilink-types`) — targets the identical problem with a notably similar framing and vocabulary, though there is no evidence of a direct lineage.** Its pitch is almost verbatim what motivates this repo's own convention: "a link only tells you that two notes are connected, not how. 'This supersedes that.' 'This contradicts that.' 'This was caused by that.'" [S8]. Mechanically it differs from the Dataview-inline-field approach entirely — instead of a `rel::[[target]]` line, the author types `@` *inside a wikilink's alias* (e.g. `[[Analysis|The new research @supersedes and @contradicts the previous analysis]]`), picks a type from an autocomplete populated from a configurable set (24 defaults, stored in `data.json`), and the plugin auto-writes the resulting relationship into YAML frontmatter on save — explicitly so "users never manually edit YAML" [S9]. Notably, it ships its own "Vault Linker" Claude Code skill, explicitly designed for an AI agent to read a vault and *propose* typed relationships for user approval [S9] — the same "LLM proposes, human curates" loop this repo's own `/wiki-lint` and `/wiki-query` skills already implement, just targeting a different plugin's storage format.

## Constraints

- Anything adopted must keep working with **zero installed plugins**, per `raw/llm-wiki.md`'s explicit design goal that the wiki is "just a git repo of markdown files." Any plugin (Dataview, Breadcrumbs, Graph Link Types) can only be an *enhancement layer* on top of syntax that already degrades to plain readable markdown — which the current `rel::[[target]]` convention already satisfies.
- This repo's typed-link vocabulary (`derived_from`, `supersedes`, `superseded_by`, `implements`, `uses`, `depends_on`, `contradicts`, `relates_to`, `caused`, `fixed`) is fixed in `wiki/conventions.md` and already in live use across multiple pages — any plugin adopted should consume that vocabulary as-is rather than requiring a rewrite (Dataview and Breadcrumbs both can; Wikilink Types' `@type`-in-alias mechanic would require re-authoring existing links to switch to it).
- `.obsidian/` is already gitignored, so per-vault plugin configuration (which plugins are enabled, Dataview/Breadcrumbs settings) is inherently machine-local and would need to be documented in a guide rather than committed, consistent with how this repo already treats other machine-local MCP/tooling config.

## Solution Comparison

| Criteria | Do nothing (status quo) | Add Dataview only | Add Dataview + Graph Link Types | Add Dataview + Breadcrumbs |
|---|---|---|---|---|
| **Approach** | Keep writing `rel::[[target]]` lines as plain text/links | Install Dataview; author `​```dataview` query blocks (e.g. in family `index.md` files) | Dataview for querying + Graph Link Types to color/label graph-view edges | Dataview for querying + Breadcrumbs for hierarchical trails/tree/matrix views |
| **Pros** | Zero setup; already works exactly as `wiki/conventions.md` intends | Enables the "dynamic tables and lists" `raw/llm-wiki.md` already anticipates; no change to existing link syntax | Adds at-a-glance visual differentiation of relation types in graph view; no authoring change | Adds trail/tree/matrix navigation UI; can auto-imply inverse relations (e.g. `superseded_by` from `supersedes`) |
| **Cons** | Vocabulary stays LLM/grep-only — no human query surface | Graph view still shows all links identically (no per-type coloring) | One more plugin dependency; graph view can get visually busy with 10 relation types | Heaviest of the options; its "up/down/same/next/prev" model is hierarchy-first and would need custom edge-field mapping to fit this repo's flatter, more associative vocabulary |
| **Complexity** | None | Low | Low–Medium | Medium |
| **Dependencies** | None | Dataview (Obsidian plugin, machine-local) | Dataview + Graph Link Types | Dataview + Breadcrumbs |
| **Codebase fit** | Perfect — no changes needed | High — consumes existing syntax unmodified | High — consumes existing syntax unmodified | Medium — fits but the plugin's own mental model (hierarchy) doesn't fully match this repo's mostly-associative vocabulary |
| **Maintenance** | Zero | Low — query blocks live in specific `index.md`/dashboard files only | Low | Medium — edge-field config in `.obsidian/` needs documenting for new contributors |

## Recommendation

**No change is required for correctness** — the answer to "does this actually use a plugin?" is: *the syntax is plugin-shaped (it's Dataview's inline-field format) but the repo currently uses it purely as human/LLM-readable markdown, with no plugin wired up and no query blocks anywhere.* That's a deliberate, sound design given `raw/llm-wiki.md`'s "just a git repo of markdown files" goal.

If the user wants to realize the payoff the convention was designed for (querying/visualizing by relation type, which `raw/llm-wiki.md` already anticipates via Dataview), the lowest-friction next step is **Dataview alone**, since:
- it requires no changes to any existing wiki page — the `rel::[[target]]` lines already are valid Dataview inline fields
- it directly delivers on `raw/llm-wiki.md`'s own stated Dataview use case ("dynamic tables and lists")
- Graph Link Types and/or Breadcrumbs are optional visual layers that can be added later on top of the same Dataview index without further authoring changes

**Implementation outline** (only if the user opts in):
1. Add `wiki/knowledge/entities/tools/obsidian.md` and `.../dataview.md` entity pages (currently missing despite heavy reference) — `/wiki-ingest raw/research/obsidian-wiki-linking/index.md` would generate/update these.
2. Document (in a `wiki/guides/` page, not committed `.obsidian/` config) that Dataview is an optional local plugin, plus 2-3 example query blocks — e.g. a `​```dataview TABLE status FROM "wiki/work/tasks"​``` ` style query for a family `index.md`, or a `contradicts::` audit query for `/wiki-lint`.
3. Only add Graph Link Types / Breadcrumbs if/when the vocabulary's *visual* legibility in graph view becomes a felt need — no evidence yet that it is.

**Risks and mitigations:**
- Risk: treating Dataview as load-bearing would violate the "just markdown" design goal. Mitigation: keep all Dataview query blocks additive/optional (e.g. scoped to a `wiki/guides/` example or a dashboard file), never required for `/wiki-*` skills to function — the skills already work by reading files directly, not by querying Dataview.
- Risk: confusing the `claude-obsidian` entity page (an unrelated AI-wiki reimplementation project) with Obsidian.md itself. Mitigation: when creating the new `obsidian.md` entity page, add a disambiguation note cross-linking `[[claude-obsidian]]` as "an unrelated project that shares 'Obsidian' in its name."

**Alternative if constraints change:** if this repo ever wants AI-agent-*proposed* linking (an LLM scanning the vault and suggesting new `rel::[[target]]` annotations for approval, similar to what `/wiki-lint` could grow into), the Wikilink Types plugin's "Vault Linker" skill is worth revisiting as prior art for that exact workflow — though its `@type`-in-alias storage format is incompatible with this repo's existing full-line-field convention without a migration.

## Next Steps

- Run `/wiki-ingest raw/research/obsidian-wiki-linking/index.md` to synthesize this into the knowledge base — it should create `wiki/knowledge/entities/tools/obsidian.md` (and likely `dataview.md`), and update `wiki/conventions.md`'s §3 "Typed links" section with a note on the underlying Dataview mechanism (currently the section defines the vocabulary but doesn't name where the syntax comes from).
- No `/task-add` is warranted yet — this is informational unless the user decides to actually install Dataview and wire up query blocks, in which case `/task-add "Wire Dataview query blocks into wiki/work/*/index.md family indexes"` would be the natural follow-on.
