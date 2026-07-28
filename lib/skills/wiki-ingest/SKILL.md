---
name: wiki-ingest
description: Process a source from raw/ into the wiki — write a summary page, update affected entity and concept pages, record the ingest in the index and log, and refresh the hot cache
category: researching
model: claude-sonnet-5
argument-hint: <raw-file-path>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `.docs/guides/mcp-tools.md`.

# Wiki Ingest

Integrate a raw source document into the persistent wiki. The source is read once, distilled, and woven into the existing page network — summary page, entity pages, concept pages, index, and log — so the wiki compounds rather than the source sitting unprocessed. See `raw/llm-wiki.md` for the underlying pattern.

---

**Source to ingest**: $ARGUMENTS

---

## Step 1: Read the Source Fully

1. Resolve `$ARGUMENTS` to a file under `raw/`. If the path is ambiguous or missing, use `mcp__serena__find_file` against `raw/` to locate candidates and confirm with the user.
2. Read the source **in full** with `Read` — never summarize from a partial read. For long files, read in sequential chunks until complete.
3. Note the source type (article, spec, notes, data) and its date if discernible — recency matters when claims conflict.

## Step 2: Discuss Key Takeaways

Before writing anything, present a brief summary to the user:

- 3–7 bullet key takeaways from the source
- Which existing wiki pages this source will touch (read `wiki/index.md` to determine this)
- Any apparent **contradictions** with existing wiki pages (see Rules below)

Keep this short — it is a checkpoint, not a report. Incorporate any emphasis or corrections the user offers.

## Step 3: Write or Update the Summary Page

1. Use `mcp__serena__list_dir` on `wiki/knowledge/sources/` to check whether a summary page for this source already exists.
2. Write (or update) a summary page in `wiki/knowledge/sources/` with a **kebab-case filename** derived from the source title (e.g. `raw/Some Article.md` → `wiki/knowledge/sources/some-article.md`). Create the directory if it does not exist.
3. Frontmatter:
   ```yaml
   ---
   id: some-article
   title: Some Article
   updated: YYYY-MM-DD
   sources:
     - ../../raw/some-article.md
   confidence: extracted
   tags: []
   ---
   ```
   Set `confidence` per the confidence decision rule (see CRITICAL RULES) — choose `extracted`, `inferred`, or `ambiguous` based on how the page's claims relate to the source; do not leave it hard-coded at `extracted`.

   **Choosing `confidence`:** this field applies to `knowledge/` pages only (`sources/`, `concepts/`, `entities/`) — `work/` artifacts track state with `status` instead. Pick one value per page based on the page's dominant claims (aligned with `wiki/conventions.md` §4):
   - **`extracted`** (default) — the page restates what a `raw/` source directly says.
   - **`inferred`** — the page's claims are LLM synthesis or reasoning that goes beyond what any source states directly.
   - **`ambiguous`** — sources disagree, or the claim is genuinely uncertain.

   Omitting `confidence` means `extracted`; set it explicitly only for `inferred` or `ambiguous` pages. Steps 4 and 5 use this same note.
4. Body: 2–4 paragraph distillation. Bold key claims. Add typed links to entities and concepts mentioned: `rel::[[Entity Name]]` (e.g. `derived_from::`, `uses::`, `relates_to::`).

## Step 4: Update or Create Entity Pages

For each person, organisation, tool, or component mentioned significantly in the source:

1. Determine the entity sub-type: `people`, `organisations`, `tools`, or `components` (components = this project's own modules/skills/scripts).
2. Check `wiki/knowledge/entities/<sub-type>/` for an existing page.
3. **Existing page**: add a new section or bullet noting what this source says. Never remove existing content. Use a `> **Contradiction:**` callout if the new claim conflicts.
4. **New page**: create `wiki/knowledge/entities/<sub-type>/<entity-slug>.md` with frontmatter:
   ```yaml
   ---
   id: entity-slug
   title: Entity Name
   aliases: [Alternative Name]
   updated: YYYY-MM-DD
   sources:
     - ../../../raw/some-article.md
   confidence: extracted
   tags: []
   ---
   ```
   Body: 1–2 paragraphs with key facts. Add typed links.

## Step 5: Update or Create Concept Pages

For each pattern, idea, convention, or recurring theme the source illuminates:

1. Check `wiki/knowledge/concepts/` for an existing page.
2. **Existing**: extend or cross-link; add contradiction callout if needed.
3. **New**: create `wiki/knowledge/concepts/<concept-slug>.md` with frontmatter (`id`, `title`, `updated`, `sources`, `confidence`, `tags`) and a focused distillation.

## Step 6: Update the Home Index

In `wiki/index.md`:
- Under **Sources**: add `- [Source Title](knowledge/sources/source-slug.md) — one-line summary` (knowledge pages are listed in the home index; work items are not).
- Under the relevant entity sub-type: add or update the entity listing.
- Under **Concepts**: add any new concept pages.

Use a single `Edit` call per section.

## Step 7: Append to the Log

Append to `wiki/log.md`:
```
## [YYYY-MM-DD] ingest | <source title>
Ingested from raw/<filename>. Key claims: [2–3 bullet summary]. [N] entity pages touched, [M] concept pages touched.
```

## Step 8: Refresh the Hot Cache

This is the canonical **Hot Cache Refresh** procedure — other wiki-writing skills reference it by name rather than restating it.

`wiki/hot.md` is a small, always-read-first session-handoff summary of "what changed most recently" (see `wiki/knowledge/concepts/llm-wiki-hot-cache.md`). It is a **regenerated summary, never an append log** — you rewrite it in full each time. Overwrite the whole file with `Write`; do not `Edit` in new lines.

1. **Read for continuity** — if `wiki/hot.md` exists, `Read` it (chiefly for its `## Active Threads` section, which carries forward in-flight work the current operation may not touch). If it does not exist, start from the template at `lib/scripts/templates/wiki/hot.md`.
2. **Read recent context** — read the last ~5–10 entries of `wiki/log.md` (the tail) plus the pages this operation just created or updated. These are the raw material for "what changed."
3. **Regenerate all four sections**, keeping the whole file **under ~500 words**:
   - Frontmatter: `title: Hot Cache`, `updated: <today>`.
   - `# Hot Cache` heading, the intro sentence, and `_Last updated: <today>_`.
   - `## Key Recent Facts` — the handful of things a fresh session most needs to know right now (include what this operation just did).
   - `## Recent Changes` — `Created:` / `Updated:` / `Flagged:` sub-bullets naming the pages/files this operation (and other very recent ones still worth surfacing) touched.
   - `## Active Threads` — in-flight work (roadmaps mid-execution, tasks in progress, waves pending), carried forward from the prior `hot.md` and adjusted for what just changed.
4. **Drop stale items** — if a fact is no longer "recent," remove it; its durable form already lives in a knowledge or work page.
5. **Overwrite** `wiki/hot.md` with `Write`.

---

## CRITICAL RULES

1. `raw/` is **immutable** — never create, modify, move, or delete files under `raw/`.
2. The **two-domain rule** — timeless synthesis belongs under `wiki/knowledge/`; never file a source summary or concept page under `wiki/work/`.
3. **Flag contradictions explicitly** — add a `> **Contradiction:**` callout citing both the new source and the conflicting page; never silently overwrite.
4. Use **relative links** from the file's location: a page at `wiki/knowledge/sources/` reaches `raw/` as `../../raw/`, reaches concepts as `../concepts/`, reaches entities as `../entities/`.
5. Add `id:` and `aliases:` frontmatter to every page you create or touch.
6. Use typed links (`derived_from::`, `uses::`, `relates_to::`, `contradicts::`) wherever a link has a meaning — see `wiki/conventions.md` for the full vocabulary.
7. **Work artifacts** (requirements, decisions, tasks, bugs) are never modified by this skill — only knowledge pages and the home index.
8. **Set `confidence` on every knowledge page** you create or update, chosen per the "Choosing `confidence`" note in Step 3 (omission defaults to `extracted`, but set it explicitly for `inferred`/`ambiguous` pages). When rule 3 makes you flag a `> **Contradiction:**` callout, the affected page carries `confidence: ambiguous` (or otherwise lower confidence) — a flagged contradiction and an `ambiguous` value travel together.
