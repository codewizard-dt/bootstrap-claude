---
name: wiki-rotate-log
description: Rotate wiki/log.md into a dated archive file when it grows past ~400 entries; create a fresh log.md with an archive-pointer header
category: wiki
model: claude-sonnet-4-6
---

# Wiki Rotate Log

Rotate `wiki/log.md` into a dated archive file (`log-YYYY.md` or `log-YYYY-hN.md`) when it exceeds ~400 entries. Create a fresh `log.md` with an archive-pointer header. **Never truncate** — all content moves to the dated file.

---

## Step 1: Check current log size

Read `wiki/log.md`. Count the number of `## [` entry headers (each entry starts with `## [`).

- If entry count is **under 400**: report the count and warn the user: "The log has N entries — rotation is recommended at ~400. Proceed anyway? (yes / no)"
- If entry count is **400 or more**: proceed directly.

## Step 2: Determine the archive filename

Read the dates of the entries in `wiki/log.md` to determine the year(s) covered:
- If all entries are in the same year (e.g., 2026): use `log-2026.md`
- If entries span two calendar halves within a year: use `log-2026-h1.md` for Jan–Jun, `log-2026-h2.md` for Jul–Dec
- If entries span multiple years: use `log-YYYY.md` for the dominant year, or split by year if roughly balanced

Check whether a file with that name already exists in `wiki/`. If it does, append a sequence suffix: `log-2026-2.md`.

## Step 3: Confirm with the user

Show the plan:
```
Log rotation plan:
  Current: wiki/log.md (N entries)
  Archive: wiki/log-2026.md
  New log: wiki/log.md (empty, with archive pointer)

The existing log.md will be renamed — no content is deleted.
Proceed? (yes / no)
```

Wait for confirmation.

## Step 4: Rotate

1. **Rename** `wiki/log.md` → `wiki/log-YYYY.md` using Bash `mv`.
2. **Check** for any existing archive pointers in the old log (lines starting with `> Archives:`). If present, carry them forward into the new log.
3. **Create** a new `wiki/log.md` with:

```markdown
# Wiki Log

Append-only record of wiki operations — ingests, queries filed back, lint passes, scaffolding. **Never edit existing entries**; only append new ones at the bottom.

Entry format (consistent prefix keeps the log greppable — `grep "^## \[" log.md | tail -5`):

```
## [YYYY-MM-DD] <op> | <subject>
1–3 sentences on what happened.
```

Operations: `scaffold`, `ingest`, `query`, `lint`, `decision`, `task`, `bug`, `requirement`, `roadmap`, `archive`, `rotate`.

> Archives: [YYYY](log-YYYY.md)

---

## [YYYY-MM-DD] rotate | log.md rotated — N entries archived to log-YYYY.md
Previous log archived to log-YYYY.md. Fresh log started.
```

Replace `YYYY` with the actual year and `N` with the entry count. If there were prior archive pointers, add them to the `> Archives:` line separated by ` · `.

## Step 5: Report

Confirm rotation is complete:
```
Done. wiki/log.md rotated:
  - N entries moved to wiki/log-2026.md
  - New wiki/log.md created with archive pointer
```

---

## CRITICAL rules

- **Never delete** any log content — rotation is renaming + creating a new file.
- **Never edit** the archived file after renaming.
- The `> Archives:` header line in the new `log.md` must link to ALL prior archive files, not just the most recent one.
- The first entry in the new `log.md` must be the rotation event itself.
