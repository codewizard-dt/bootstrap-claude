---
name: wiki-query
description: Answer a question from the wiki — locate pages via the index, synthesize a cited answer, auto-ingest relevant un-ingested raw sources when the wiki has no coverage, and offer to file valuable answers back as new wiki pages
category: researching
model: claude-sonnet-5
argument-hint: <question>
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`.

# Wiki Query

Answer a question using the wiki as the primary source of truth. If the wiki lacks coverage, fall back to ingesting relevant un-ingested `raw/` sources (Step 4), then answer from the enlarged wiki. **Never answer from general knowledge alone when a wiki page exists — cite it.**

---

**Question**: $ARGUMENTS

---

## Step 1: Orient via the Index

1. Read `wiki/index.md` in full — it is the home Map of Content.
2. Identify the most relevant sections (Sources, Concepts, Entities, and the Work family indexes if the question is about in-flight work).
3. Read the linked pages. For work items, the family `index.md` files (`wiki/work/<family>/index.md`) list only active items — read those first, then read the individual files needed.

## Step 2: Gather Evidence

Read each relevant page completely before synthesizing. Do not summarize from the first paragraph — check for contradictions, confidence caveats, and supersession markers throughout the page.

If a page cites a `sources:` raw file, read the raw source only if the page's distillation is insufficient.

## Step 3: Synthesize and Cite

Answer the question in 2–5 paragraphs. For each claim, cite the wiki page: `([page title](relative/path/to/page.md))`.

If you found contradictions between pages, surface them explicitly with a `> **Contradiction:**` callout and note which source is more recent.

If the wiki has no coverage at all — no page matched, or the pages that matched do not actually contain what was asked — **do not stop here**. Go to Step 4.

## Step 4: Fallback — Ingest Relevant Raw Sources

Run this step **only** when Step 3 produced no answer. Partial-but-sufficient coverage is not a trigger; neither is an answer you merely wish were more detailed.

### 4.1 Find un-ingested sources

1. `mcp__serena__list_dir` on `raw/` (recursive) for the full candidate list; skip `.gitkeep`.
2. `mcp__serena__list_dir` on `wiki/knowledge/sources/` and read the `sources:` frontmatter of each summary page.
3. A raw file is **un-ingested** when no summary page's `sources:` list resolves to it. The `sources:` back-link is authoritative — a matching filename slug is a hint, not proof.
4. Treat each `raw/research/<slug>/` and `raw/companies/<slug>/` directory as a **single candidate** represented by its main report file, not as one candidate per supporting file.

### 4.2 Rank by relevance — cheaply

Do not read candidate files in full at this stage. Triage with:

- filename and directory slugs against the question's keywords;
- `mcp__serena__search_for_pattern` for question keywords restricted to `raw/`;
- frontmatter and headings only, for the surviving few.

Keep only sources that plausibly answer *this* question. If none survive, say so and stop:
```
This question isn't covered in the wiki, and no un-ingested raw source looks relevant.
To add coverage: add a source to raw/ then run /wiki-ingest raw/<file>
```

### 4.3 Ingest the relevant sources

Announce before writing anything:
```
No wiki coverage for this question. Un-ingested raw sources that look relevant:
  1. raw/<file> — <one line on why>
Ingesting these now, then re-answering.
```

For each selected source, run the `/wiki-ingest` procedure (`lib/skills/wiki-ingest/SKILL.md`) in full against that path. One deviation only: its **Step 2 checkpoint becomes a non-blocking announcement** — print the takeaways and continue instead of waiting for the user. Every other step (summary page, entity pages, concept pages, index, log, hot cache) runs exactly as written there.

**Cap: at most 3 sources per invocation.** If more look relevant, ingest the 3 strongest and list the remainder for the user to run manually.

### 4.4 Re-answer once

Redo Steps 1–3 against the now-updated wiki and cite the newly created pages like any other. **Re-enter Step 4 at most once per invocation** — if the answer is still not there, report the gap plainly and list what was ingested. Never loop.

## Step 5: Offer to File the Answer Back

If the synthesized answer represents **durable, timeless knowledge** (a pattern, a design decision rationale, an entity summary) that doesn't currently exist as its own wiki page, offer:

```
Worth filing this answer as a new wiki page?
Target: wiki/knowledge/concepts/<concept-slug>.md
```

**Never file stateful work artifacts here** — requirements, decisions, tasks, bugs belong in `wiki/work/` and are created by their own skills (`/req-create`, `/decision-create`, etc.).

If the user says yes:
1. Create `wiki/knowledge/concepts/<concept-slug>.md` with proper frontmatter (`id`, `title`, `updated`, `tags`, `sources` if derived from a raw source).
2. Add a typed link `derived_from::[[source-slug]]` if the answer came from an ingested source.
3. Add the new page to the **Concepts** section of `wiki/index.md`.
4. Append to `wiki/log.md`: `## [YYYY-MM-DD] query | <question summary>\nFiled answer as wiki/knowledge/concepts/<slug>.md.`
5. **Only on this filing path** (never on the read-only answer path): run the **Hot Cache Refresh** procedure — defined in `/wiki-ingest` Step 8 (`lib/skills/wiki-ingest/SKILL.md`) — to regenerate `wiki/hot.md` in full, surfacing the newly filed page under Recent Changes. Do not restate the procedure here; follow it as written. Step 4's ingests refresh the hot cache on their own as part of the `/wiki-ingest` procedure — that is a write path, not the read-only answer path.

---

## CRITICAL RULES

1. **Answer from the wiki, not general knowledge** — if the wiki still lacks coverage after Step 4, say so.
2. **The two-domain rule** — filed answers (durable synthesis) go to `wiki/knowledge/`; never file under `wiki/work/`.
3. All citations use relative markdown links to the wiki page, not raw file paths.
4. Do not modify any `wiki/work/` files — this skill is read-only for work artifacts.
5. `raw/` is **immutable** — Step 4 reads and ingests raw sources; it never creates, edits, moves, or deletes anything under `raw/`.
6. **Step 4 runs at most once per invocation and ingests at most 3 sources.** A query must never trigger an ingest cascade or a re-query loop.
