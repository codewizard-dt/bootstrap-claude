## LLM Wiki

This project maintains a three-layer LLM Wiki. This section is the **schema** — it tells you how the wiki is structured and what rules govern it.

```
raw/          Immutable ground-truth sources. Read them; NEVER modify, move, or delete them.
wiki/         LLM-maintained knowledge base. You own this layer — except wiki/guides/ and the
              other template-owned files (conventions.md, work/*/lifecycle.md, dashboard.html).
CLAUDE.md     This schema section.
```

### Two domains with opposite organizing laws

**`wiki/knowledge/`** — timeless synthesis, organized by links not status. Pages are revised in place as understanding evolves; no `status` field.

- `wiki/knowledge/sources/` — one summary page per ingested `raw/` source
- `wiki/knowledge/concepts/` — patterns, ideas, conventions, recurring themes
- `wiki/knowledge/entities/{people,organisations,tools,components}/` — one page per entity, filed by sub-type

**`wiki/work/`** — stateful lifecycle artifacts, organized by status. Active files are **never moved** after creation; state lives in the `status:` frontmatter field. Each family has a `lifecycle.md` (schema + valid transitions), an `index.md` listing **only active items**, and an `archive/` subdirectory for terminal items. When an item leaves the active set, delete its line from the family index; terminal items may be moved to `archive/` by `/wiki-archive`.

- `wiki/work/requirements/` — REQ-NNN
- `wiki/work/decisions/` — DEC-NNNN (per-decision `#DM`)
- `wiki/work/roadmaps/` — ROADMAP-NNN
- `wiki/work/tasks/` — TASK-NNN
- `wiki/work/uat/` — UAT-NNN (own family, one per task)
- `wiki/work/bugs/` — BUG-NNNN

**`wiki/guides/`** — template-owned reference guides delivered by the bootstrap tooling (MCP tool rules in `mcp-tools.md`, shell anti-patterns, opted-in frameworks like evals or type-checking templates). Read them and obey them; **never edit them** — they are refreshed by `npx @codewizard-dt/bootstrap update` and any local edit will be overwritten. They are infrastructure, not wiki content: no frontmatter, no index entries, exempt from the atomic-page rule.

**Navigation:** `wiki/index.md` is the home Map of Content — read it first on every wiki query. Knowledge pages are listed there individually; work items live only in their family index. `wiki/log.md` is the append-only operation log. `wiki/conventions.md` holds the page rules (atomic pages, stable IDs/aliases, typed links, frontmatter namespace). Tool-usage rules live in `wiki/guides/mcp-tools.md`.

### Auto Memory vs. this wiki

Claude Code has its own native **Auto Memory** feature — typed memory files (`user`, `feedback`, `project`, `reference`) kept under `~/.claude/projects/<hash>/memory/`, indexed by `MEMORY.md`, auto-loaded at session start. It is **cross-project and un-versioned**: it lives outside this git repo and follows the user across every project. This wiki, by contrast, is **per-project and git-versioned**: it lives in `wiki/`, is reviewable in diffs, and is shared with anyone who clones the repo.

Rule of thumb for where a new fact belongs:

- **Auto Memory** — facts about the *user* and their cross-project working style: how they like to collaborate, standing preferences, feedback that applies regardless of which repo is open. If a fact is true only because "the user told me once" and holds everywhere → Auto Memory.
- **This wiki** — facts about *this project*: its architecture, decisions, requirements, tasks, and synthesized knowledge that should be versioned, reviewable, and survive in git history. If a fact is true because "this project decided X" → wiki.

Keep the two from duplicating or contradicting each other: project-specific state does not go in Auto Memory, and cross-project user preferences do not go in the wiki.

### Wiki operations

| Command | Purpose |
|---------|---------|
| `/wiki-ingest <raw-file>` | Process a source from `raw/` into the wiki — summary page, entity/concept updates, index + log entries |
| `/wiki-query <question>` | Answer from the wiki with citations; offer to file valuable synthesis back as a new page |
| `/wiki-lint` | Health-check — contradictions, orphan pages, stale claims, index drift, never-ingested raw sources |
| `/wiki-archive [family]` | Batch-move terminal work items into `<family>/archive/`; update `archive/index.md` and log the operation |
| `/wiki-rotate-log` | Rotate `wiki/log.md` to a timestamped archive file when it exceeds ~500 lines; create a fresh `log.md` with an archive pointer |
| `/wiki-tidy` | One-shot cleanup — lint, archive terminal items across all families, then rotate log if overgrown; phases run in sequence with user confirmation |

### CRITICAL wiki rules

1. `raw/` is immutable — never create, modify, move, or delete files under `raw/`
2. Cross-link aggressively — related pages link to each other with relative markdown links; the link network is as valuable as the pages
3. Index and log updates are mandatory — every ingest and filed answer updates `wiki/index.md` + `wiki/log.md`; every work-item create or status flip updates the family `index.md` + `wiki/log.md`
4. Flag contradictions explicitly — when a new source conflicts with an existing page, add a `> **Contradiction:**` callout citing both; never silently overwrite
5. Answer from the wiki, not general knowledge — if the wiki lacks coverage, say so and suggest `/wiki-ingest` for relevant sources
6. Atomic pages — one concept, entity, or artifact per file; split a page rather than let it cover two things
7. Typed links — when a link has a meaning, annotate it inline as `rel::[[target]]` (e.g. `implements::[[REQ-012]]`, `supersedes::[[DEC-0003#D2]]`); keep the two domains separate — never file a stateful artifact under `knowledge/` or a timeless synthesis under `work/`
8. Template-owned files are read-only — never edit `wiki/guides/*`, `wiki/conventions.md`, `wiki/work/*/lifecycle.md`, or `wiki/dashboard.html`; they are refreshed from the bootstrap templates and local edits will be lost
