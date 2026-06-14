---
name: wiki-tidy
description: One-shot wiki cleanup — runs lint, archives terminal items across all families, and rotates the log if overgrown, in sequence with user confirmation at each phase
category: wiki
model: claude-sonnet-4-6
user-invocable: true
---

# Wiki Tidy

Three-phase cleanup for a neglected wiki. Runs in order: **lint → archive → rotate-log**. Each phase summarises its findings and asks for confirmation before making changes. You can stop after any phase.

---

## Phase 1: Lint

Run the full wiki-lint audit by following every step in `/wiki-lint` exactly as written:

1. Inventory the wiki tree.
2. Run all 9 checks (family-index drift, two-domain violations, ID/filename mismatch, UAT↔task cross-links, typed-link vocabulary, orphan pages, never-ingested raw sources, contradictions, stale frontmatter).
3. Report findings grouped by severity (HIGH / MEDIUM / LOW).
4. For each HIGH finding, propose the exact fix.
5. Ask: **"Which findings should I fix? Reply with 'all', specific IDs, or 'none' to skip. Type 'stop' to end wiki-tidy here."**
6. Apply approved fixes. Append one `lint` entry to `wiki/log.md`.

If the user types `stop`, end the skill here. Otherwise continue to Phase 2.

---

## Phase 2: Archive

Run `/wiki-archive` across all 6 families in sequence: `tasks`, `uat`, `bugs`, `requirements`, `decisions`, `roadmaps`.

For each family:
1. Read its `lifecycle.md` to confirm the terminal statuses (do NOT hardcode).
2. Use `mcp__serena__list_dir` on the family directory.
3. Identify files whose `status:` frontmatter is terminal (exclude `lifecycle.md`, `index.md`, `.gitkeep`, and anything already under `archive/`).

After scanning all 6 families, show a combined summary:

```
Archive candidates:
  tasks       — N items  (TASK-012 done, TASK-019 trashed, …)
  uat         — N items  (UAT-012 passed, …)
  bugs        — N items
  requirements— N items
  decisions   — N items
  roadmaps    — N items

Total: N items across N families.
```

Ask: **"Archive all, specific families (e.g. 'tasks uat'), or 'none' to skip? Type 'stop' to end wiki-tidy here."**

For each confirmed family:
1. Move each terminal file: `mv wiki/work/<family>/<file> wiki/work/<family>/archive/<file>`
2. Read the file's `id`, `title`, `status`, and `updated` frontmatter.
3. Append a row to `wiki/work/<family>/archive/index.md`:
   ```
   | [[ID]] | Title | final-status | YYYY-MM-DD |
   ```
4. Remove the item's row from the family's active `index.md` if it is still listed there.

After all moves, append one `archive` entry to `wiki/log.md`:
```
## [YYYY-MM-DD] archive | wiki-tidy — N items archived across K families
Moved N terminal items: <comma-separated IDs>.
```

If the user types `stop`, end the skill here. Otherwise continue to Phase 3.

---

## Phase 3: Rotate log

Run `/wiki-rotate-log`:

1. Read `wiki/log.md` and count entries (lines matching `^## \[`).
2. If under 400: report the count and ask **"Log has N entries (threshold: 400). Rotate anyway? (yes / no / stop)"**. If `no`, skip this phase; if `stop`, end the skill.
3. If 400 or more: proceed directly.
4. Determine the archive filename from the date range of entries (`log-YYYY.md`, with collision handling).
5. Show the rotation plan and ask **"Proceed with rotation? (yes / no)"**.
6. On confirmation: rename `wiki/log.md` → `wiki/log-YYYY.md`, create a fresh `wiki/log.md` with an archive-pointer header and a `rotate` entry as its first log line.

---

## Final report

After all three phases, print a one-paragraph summary:

```
Wiki tidy complete.
  Lint:    N issues found, M fixed.
  Archive: N items moved to archive/ across K families.
  Log:     rotated / not rotated (N entries).
```

---

## CRITICAL rules

- Follow each sub-skill's CRITICAL rules exactly — they take precedence over brevity.
- Never move an active item. Never edit archived file content. Never delete anything.
- Always confirm with the user before applying changes in each phase.
- `stop` at any phase prompt ends the skill immediately without proceeding further.
