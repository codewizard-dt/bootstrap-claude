---
name: usage-report
description: Locally parse Claude Code session logs into per-project token and estimated-cost rollups by model and skill (offline, read-only)
category: researching
model: claude-haiku-4-5-20251001
argument-hint: "[--all-projects] [--since YYYY-MM-DD]"
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`.

# /usage-report — Token and cost rollups from local session logs

Runs a bundled zero-dependency Node script over the Claude Code transcripts in `~/.claude/projects/**/*.jsonl` and renders the JSON it emits as a short human summary. Its purpose is to let the haiku/sonnet/opus tier declared in each skill's frontmatter be verified against what actually ran.

**This skill is read-only and offline.** It reads local transcript files only; it writes no files, makes no network request, and calls no API. Do not save the JSON or the summary anywhere.

## Step 1 — Run the script

```
node ~/.claude/skills/usage-report/scripts/usage-report.js $ARGUMENTS
```

Pass `$ARGUMENTS` through unchanged. Supported flags: `--project <path>`, `--all-projects`, `--since YYYY-MM-DD`, `--until YYYY-MM-DD`, `--pretty`. Default scope is the current project (subagent transcripts included); `--all-projects` widens it to every project.

- **Exit 2** = unknown or malformed flag. Show the usage text from stderr verbatim and stop.
- Any other non-zero exit: show stderr and stop; do not guess at numbers.
- If the script file is missing, tell the user to run `npx @codewizard-dt/bootstrap update` (or `./lib/scripts/install-global.sh --skip-mcps`) to install it, then stop.

## Step 2 — Parse and render

Parse stdout as JSON (`schemaVersion: 1`).

**Empty project.** If `totals.turns == 0`, print one line — `No usage found for <scope.project> (no transcripts, or none in the requested range).` — and stop.

Otherwise render, in this order:

1. **Totals** — scope (`scope.project`, or "all projects"), range (`range.since` / `range.until` when set), input / output / cache-write / cache-read tokens, estimated cost, turns.
2. **By model** — table from `byModel`: model, tier, turns, input, output, cache-write, cache-read, est. cost. Sort by cost, highest first.
3. **By skill** — table from `bySkill`, sorted by cost, highest first: skill, turns, est. cost, `declaredModel`, observed models (keys of `models` with turn counts), and a `declared vs observed` column. Render the `modelCheck` field in the `declared vs observed` column — do not re-compare `declaredModel` to the `models` keys yourself, because the script compares model families (haiku/sonnet/opus), so an alias like `sonnet` matches `claude-sonnet-5`. Show `MISMATCH` for `mismatch`, `ok` for `match`, and `-` for `undeclared` (no declared model, or `inherit`) or `unknown` (a model outside the known families, so it cannot be compared). Keep the `(none)` bucket in the table.
4. **Top 5 cost days** — the five `byDay` entries with the highest `cost` (date, est. cost, turns).

Show a `null` cost as `n/a` and never sum it as zero.

## Step 3 — State the caveats

Close with these notes, briefly:

- **Costs are estimates.** They are tokens times a shipped per-model price table (`meta.pricingAsOf`); subscription plans are not billed per token.
- **Per-skill attribution is a heuristic.** A turn is credited to the last skill invoked in that session (subagents included) until the next invocation; turns before any invocation fall in the `(none)` bucket. A `MISMATCH` can be legitimate (a skill's subagents or the user's model choice) and is a prompt to look, not a verdict.
- **Unpriced models.** If `meta.unpricedModels` is non-empty, list them: their tokens are counted but their cost is `n/a` and excluded from cost totals.
- If `meta.skippedLines > 0`, mention that many unparseable transcript lines were skipped.
