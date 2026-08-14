# Dataview Queries for the Wiki

> An optional, local-only guide for readers who open this wiki in Obsidian and want live, exploratory views over `wiki/` — on top of, not instead of, the hand/LLM-maintained index files.

---

## 1. What this is (and isn't)

[Dataview](https://github.com/blacksmithgu/obsidian-dataview) is a community plugin for Obsidian that lets you write query blocks — `TABLE`, `LIST`, `TASK`, `CALENDAR` — over your vault's markdown files and their frontmatter, and see live, auto-updating results rendered inline in any note.

It is **optional**. Nothing in this wiki's schema, tooling, or `/wiki-*` commands depends on Dataview being installed. It is a personal, local convenience for readers who happen to use Obsidian as their markdown viewer — not a wiki dependency, not something CI checks, and not something every contributor needs.

**Install it** one of two ways:

- Once [`TASK-053`](../../wiki/work/tasks/) lands, run `lib/scripts/install-obsidian.sh` to set up Obsidian with the recommended plugin set (including Dataview) in one step.
- Or install it manually: open Obsidian → Settings → Community plugins → Browse → search "Dataview" → Install → Enable.

Once enabled, paste any of the query blocks below into a scratch note inside your vault (they do not need to live in a committed file) and Dataview will render a live table or list beneath the block, kept in sync as the underlying `wiki/` files change.

**Important caveat, repeated at every example below:** these queries are illustrative, exploratory views for your own personal use in Obsidian. They are **not** a replacement for this repo's committed `index.md` files. Per [`wiki/conventions.md`](../../wiki/conventions.md)'s Maps-of-Content convention, those indexes stay flat, hand/LLM-maintained bullet lists — the canonical, git-versioned source of truth that every contributor can read without Obsidian or any plugin installed. Dataview queries are a local lens on top of that canonical data, not a substitute for it.

---

## 2. Example queries

### 2.1 Tasks by status

A live table of every task file under `wiki/work/tasks/`, grouped by its `status` frontmatter field — useful for eyeballing what's `todo`, `in-progress`, or `done` without opening `wiki/work/tasks/index.md`.

```dataview
TABLE status
FROM "wiki/work/tasks"
SORT status
```

*Illustrative only — this is a personal, exploratory view. The committed source of truth for active tasks remains [`wiki/work/tasks/index.md`](../../wiki/work/tasks/index.md), maintained by hand/LLM per the wiki's Maps-of-Content convention.*

### 2.2 Pages with a `contradicts::` link

A quick scan for any page that has flagged a contradiction with another page — a useful companion to `/wiki-lint`, which formally audits for these. This matches on the literal `contradicts::` typed-link text appearing anywhere in a page's body (see [`wiki/conventions.md`](../../wiki/conventions.md) for the typed-link convention, `rel::[[target]]`).

```dataview
LIST
FROM "wiki"
WHERE contains(file.text, "contradicts::")
```

*Illustrative only — a simple text-containment scan, not a substitute for `/wiki-lint`'s structured contradiction audit or the `> **Contradiction:**` callouts it produces. Treat this as a "where should I look" pointer, not a verdict.*

### 2.3 Tools by tag

A table of every tool entity page under `wiki/knowledge/entities/tools/`, alongside its `tags` frontmatter field, sorted by filename — handy for spotting which tools share a tag (e.g. "search", "mcp", "deferred") at a glance.

```dataview
TABLE tags
FROM "wiki/knowledge/entities/tools"
SORT file.name
```

*Illustrative only — a personal cross-cut by tag. The canonical listing of tool entities is whatever links into them from [`wiki/index.md`](../../wiki/index.md) and the concept/source pages that reference them; this query does not replace that link network.*

---

## 3. Why these stay out of the committed wiki

Dataview query blocks only render inside Obsidian with the plugin enabled — a plain markdown viewer, GitHub's file preview, or a teammate without the plugin would see the raw ` ```dataview ` fence and nothing else. Committing them into `index.md` files would silently break the wiki for every non-Obsidian reader. Keep queries like these in your own local scratch notes, and let the committed `index.md` files do the job of being readable by everyone, everywhere, with no plugin required.
