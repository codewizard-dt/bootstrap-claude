---
id: UAT-007
title: "UAT: Update /wiki-ingest (and other wiki-writing skills) to refresh wiki/hot.md"
status: passed
task: TASK-007
created: 2026-07-06
updated: 2026-07-06
---

# UAT-007 — UAT: Update `/wiki-ingest` (and other wiki-writing skills) to refresh `wiki/hot.md`

implements::[[TASK-007]]

> **Source task**: [[TASK-007]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`
- [ ] `bash` and `grep` available (macOS default toolchain)

---

## Test Cases

### UAT-CONTENT-001: /wiki-ingest defines the canonical Step 8 Hot Cache Refresh procedure
- **File**: `lib/skills/wiki-ingest/SKILL.md`
- **Description**: `/wiki-ingest` must define a `## Step 8: Refresh the Hot Cache` section as the canonical Hot Cache Refresh procedure — it targets `wiki/hot.md` and specifies full regeneration (rewrite/overwrite, never append), per `wiki/knowledge/concepts/llm-wiki-hot-cache.md` and TASK-006's template.
- **Steps**:
  1. Run the command below as-is.
- **Command**:
  ```bash
  f=/Users/davidtaylor/Repositories/bootstrap-claude/lib/skills/wiki-ingest/SKILL.md; if grep -q '## Step 8: Refresh the Hot Cache' "$f" && grep -q 'wiki/hot.md' "$f" && grep -qi 'regenerated summary, never an append' "$f"; then echo PASS; else echo FAIL; fi
  ```
- **Expected Result**: Prints `PASS` — the Step 8 heading, the `wiki/hot.md` target, and the regenerate-not-append semantics are all present.
- **Repeatable Unit Test**: Not applicable: asserts on skill-definition markdown prose; repo has no markdown/skill test harness — this command is the deterministic re-runnable check.
- [x] Pass <!-- 2026-07-06 -->

### UAT-CONTENT-002: /wiki-ingest frontmatter description advertises the hot-cache refresh
- **File**: `lib/skills/wiki-ingest/SKILL.md`
- **Description**: The skill's frontmatter `description` must no longer undersell it — it should mention refreshing the hot cache so the skill index reflects the new Step 8 behavior.
- **Steps**:
  1. Run the command below as-is.
- **Command**:
  ```bash
  f=/Users/davidtaylor/Repositories/bootstrap-claude/lib/skills/wiki-ingest/SKILL.md; if grep -m1 '^description:' "$f" | grep -qi 'refresh the hot cache'; then echo PASS; else echo FAIL; fi
  ```
- **Expected Result**: Prints `PASS` — the `description:` line contains "refresh the hot cache".
- **Repeatable Unit Test**: Not applicable: asserts on skill frontmatter prose; no markdown test harness in repo.
- [x] Pass <!-- 2026-07-06 -->

### UAT-CONTENT-003: The four wiki-writing skills reference the shared procedure (not restate it)
- **Files**: `lib/skills/{roadmap-create,task-add,decision-finalize,req-finalize}/SKILL.md`
- **Description**: Each of `/roadmap-create`, `/task-add`, `/decision-finalize`, `/req-finalize` must add a short final step that runs the **Hot Cache Refresh** procedure by pointing at `/wiki-ingest` Step 8 — referencing the shared procedure by name rather than duplicating the regeneration logic.
- **Steps**:
  1. Run the command below as-is. It counts how many of the four skills reference both "Hot Cache Refresh" and "wiki-ingest".
- **Command**:
  ```bash
  d=/Users/davidtaylor/Repositories/bootstrap-claude/lib/skills; n=0; for s in roadmap-create task-add decision-finalize req-finalize; do if grep -q 'Hot Cache Refresh' "$d/$s/SKILL.md" && grep -q 'wiki-ingest' "$d/$s/SKILL.md"; then n=$((n+1)); fi; done; if [ "$n" -eq 4 ]; then echo PASS; else echo "FAIL($n/4)"; fi
  ```
- **Expected Result**: Prints `PASS` — all four skills reference the shared Hot Cache Refresh procedure defined in `/wiki-ingest`.
- **Repeatable Unit Test**: Not applicable: asserts on skill-definition markdown prose across four files; no markdown test harness in repo.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-001: /wiki-query refreshes hot.md only on the file-back path, never read-only
- **Scenario**: `/wiki-query` is primarily a read-only skill. The hot-cache refresh must be wired **only** into its "file the answer back as a new page" branch and explicitly excluded from the read-only answer path — otherwise a plain query would churn `wiki/hot.md`.
- **Steps**:
  1. Run the command below as-is. It confirms the skill both invokes the Hot Cache Refresh and explicitly scopes it away from the read-only path.
- **Command**:
  ```bash
  f=/Users/davidtaylor/Repositories/bootstrap-claude/lib/skills/wiki-query/SKILL.md; if grep -q 'Hot Cache Refresh' "$f" && grep -qi 'never on the read-only answer path' "$f"; then echo PASS; else echo FAIL; fi
  ```
- **Expected Result**: Prints `PASS` — the refresh is present and explicitly excluded from the read-only answer path.
- **Repeatable Unit Test**: Not applicable: asserts on skill-definition markdown prose; no markdown test harness in repo.
- [x] Pass <!-- 2026-07-06 -->

---

## Notes

TASK-007 only wires the hot-cache-refresh step into wiki-writing skills. Actually executing `/wiki-ingest` end-to-end and observing a regenerated `wiki/hot.md` would require running a full ingest (a Claude-driven skill), which is out of scope for these deterministic content checks; the regeneration behavior itself is exercised naturally the next time any of these skills runs.
