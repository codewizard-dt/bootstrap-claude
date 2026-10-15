---
id: TASK-0108
aliases: [TASK-0108]
title: "Create a /usage-report skill that locally parses Claude Code session logs for per-project token/cost rollups"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: [TASK-0109]
parallel_safe_with: []
uat: "[[UAT-0108]]"
tags: [usage-report, cost-tracking, skill, roadmap-012]
---

# TASK-0108 — Create a /usage-report skill that locally parses Claude Code session logs for per-project token/cost rollups

relates_to::[[claude-code-ecosystem-2026]]
blocks::[[TASK-0109]]

## Objective

Add a new `/usage-report` skill (`lib/skills/usage-report/`) that parses the local Claude Code session transcripts under `~/.claude/projects/**/*.jsonl` (ccusage-style: no API key, no network call) and reports token and estimated-cost rollups **scoped to the current project**, broken down per model and per skill so the haiku/sonnet/opus tier curation in each skill's frontmatter can be verified instead of assumed. The parsing lives in a small zero-dependency Node script that emits **machine-readable JSON** on stdout; the SKILL.md runs it and renders a human summary. This is ROADMAP-012 Phase 2, item 1; [[TASK-0109]] consumes the JSON contract defined here.

## Approach

**Shape.** Skill dir with two files: `SKILL.md` (thin — run the script, summarise) and `scripts/usage-report.js` (all parsing/aggregation). `install-global.sh` already rsyncs the whole `lib/skills/` tree to `~/.claude/skills/`, so the script lands at `~/.claude/skills/usage-report/scripts/usage-report.js` with no installer change; the SKILL.md invokes it by that absolute-home path (same convention as `uat-walk` reading `~/.claude/skills/uat-walk/UAT-CORE.md`). Node is already a hard dependency of this repo (`bin/cli.js`, hooks, `wiki-dashboard-server.js`), so the script adds no new runtime requirement. Zero npm dependencies (`node:fs`, `node:path`, `node:os` only) — matches the hooks and dashboard server.

**Project scoping.** Claude Code stores transcripts in `~/.claude/projects/<encoded-cwd>/`, where `<encoded-cwd>` is the absolute project path with every non-alphanumeric character replaced by `-`. Default scope = `process.cwd()` encoded that way; `--project <path>` overrides; `--all-projects` walks every directory. Subagent transcripts (`<session-id>/subagents/*.jsonl` and sidechain entries) are included — parallel-agent skills (`now`, `tackle`, `power-mode`) are where most cost sits, so excluding them would defeat the purpose.

**Parsing rules (the parts that are easy to get wrong).**
- Only `type: "assistant"` entries carry `message.usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) and `message.model`.
- Streaming writes the same API response several times: **dedupe on `message.id` + `requestId`** (last entry wins) or totals are inflated. Entries missing both ids are counted once by line.
- Skip `<synthetic>` model entries and lines that fail `JSON.parse` (count them in `meta.skippedLines`; never abort).
- Stream files line-by-line (`readline`) — transcripts run to tens of MB.

**Per-skill attribution.** A turn is attributed to the most recently invoked skill in the same session (and its subagents) until the next skill invocation. Invocation is detected two ways: an assistant `tool_use` block with `name: "Skill"` (`input.skill`), and a user message containing `<command-name>/<skill></command-name>` (slash-command form). Turns before any invocation go to a `(none)` bucket. This is a heuristic — document it in the SKILL.md and expose the bucket so the dashboard does not overstate precision.

**Cost.** Offline estimate = tokens × a per-model price table shipped in the script directory as `pricing.json` (input, output, cache-write, cache-read USD per million tokens; keyed by model-id prefix so dated ids like `claude-haiku-4-5-20251001` resolve). Prices are verified against the current Anthropic pricing page (Context7 / `claude-api` skill) when the task is implemented and stamped with an `asOf` date; unknown models report tokens with `cost: null` and are listed in `meta.unpricedModels` rather than guessed. Costs are labelled **estimates** everywhere (subscription plans are not billed per token).

**JSON output contract** (stable; TASK-0109 depends on it — bump `schemaVersion` on any breaking change):

```json
{
  "schemaVersion": 1,
  "generatedAt": "ISO-8601",
  "scope": { "project": "/abs/path", "encodedDir": "-Users-...", "allProjects": false },
  "range": { "since": "ISO|null", "until": "ISO|null" },
  "totals": { "input": 0, "output": 0, "cacheCreation": 0, "cacheRead": 0, "cost": 0.0, "turns": 0 },
  "byModel": [ { "model": "claude-...", "tier": "haiku|sonnet|opus|other", "input": 0, "output": 0, "cacheCreation": 0, "cacheRead": 0, "cost": 0.0, "turns": 0 } ],
  "bySkill": [ { "skill": "tackle", "declaredModel": "claude-sonnet-5|null", "models": { "claude-...": 0 }, "input": 0, "output": 0, "cacheCreation": 0, "cacheRead": 0, "cost": 0.0, "turns": 0 } ],
  "byDay": [ { "date": "YYYY-MM-DD", "cost": 0.0, "turns": 0 } ],
  "meta": { "files": 0, "skippedLines": 0, "unpricedModels": [], "pricingAsOf": "YYYY-MM-DD", "attribution": "last-invoked-skill" }
}
```

`bySkill[].declaredModel` is read from `~/.claude/skills/<skill>/SKILL.md` frontmatter `model:` (null when absent) so a consumer can flag skills whose observed models differ from their declared tier — this is the verification the roadmap Goal calls for. An empty project (no transcripts) yields valid JSON with zero totals and exit 0, not an error.

**CLI.** `node usage-report.js [--project <path>] [--all-projects] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--pretty]` — JSON to stdout by default (`--pretty` = indented; no table mode in the script, rendering is the SKILL.md's job so there is one output format to keep in sync). Unknown flag → usage on stderr, exit 2.

**Skill metadata.** `category: researching`, `model: claude-haiku-4-5-20251001` (runs a script and reformats its output — matches the other haiku-tier utility skills `primer`, `bootstrap-config`), `disable-model-invocation: false`, `user-invocable: true`, `argument-hint: "[--all-projects] [--since YYYY-MM-DD]"`. Read-only: the skill never writes files.

**Coordination constraints.**
- ROADMAP-0014 Phase 4 renames skills and edits the `lib/skills/README.md` and `CLAUDE.md` command tables. Keep this task's edits to **one added row per file**, appended at the end of the relevant table section, re-reading each file immediately before the edit. Do not reformat surrounding rows.
- Do not run `install-global.sh` as part of this task.
- Follow the README `## Security`-adjacent conventions: no network access, no writes outside stdout.

## Steps

### 1. Verify log format assumptions  <!-- agent: Explore -->

- [x] Sample 2–3 transcripts under `~/.claude/projects/-Users-davidtaylor-Repositories-bootstrap-claude/` (read-only, head/tail only — they are large) and confirm: assistant entry shape (`message.id`, `message.model`, `message.usage.*`, `requestId`, `sessionId`, `timestamp`, `isSidechain`), the `Skill` tool_use block shape, the `<command-name>` slash-command form, and the subagent transcript location (`<session-id>/subagents/`).
- [x] Record any divergence from the Approach section above as a note in the task file before step 2; if the format differs materially, adjust the parsing rules here rather than in code.

  **Step 1 findings (verified 2026-09-19 against real transcripts; field names/counts only).** All five Approach assumptions hold. Refinements that bind Step 2:
  - Dedupe globally across **all** files (main + subagents), not per file: 8 `message.id`s recur across a subagent file and its parent (fork context) and 3 across subagent files. Key `message.id|requestId`; fall back to `message.id` alone when `requestId` is absent (the `<synthetic>` row has none). Duplicate `usage` objects are byte-identical, so first-wins == last-wins.
  - `message.usage` also carries `cache_creation.{ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}`; token fields are always numeric. Price the 1h portion at the 1h write rate when the nested object is present, else treat all `cache_creation_input_tokens` as 5m. `byModel`/`bySkill` still expose a single `cacheCreation` total (contract unchanged).
  - Subagent files are `<session-id>/subagents/agent-<agentId>.jsonl` (+ `.meta.json`, ignore). Entries there have `isSidechain: true` and `agentId`; 2 of 279 files have a `sessionId` that differs from the parent directory, so attribute a subagent to its **parent directory's session** (skill events from the parent session's timeline), not by the entry's own `sessionId`. Files may contain `fork-context-ref` rows — ignore.
  - `Skill` tool_use: `{type:"tool_use", name:"Skill", input:{skill, args?}, caller}`; `input.skill` never namespaced here (still tolerate a `plugin:skill` colon form).
  - Slash form: only in `type:"user"` entries with **string** content (`<command-name>/skill</command-name>`, optional `<command-message>`/`<command-args>` in varying order). Array-content matches are quoted tool results — skip them.
  - `type:"cost-state"` rows carry cumulative `modelUsage` — ignore (never sum). No other entry type carries `usage`; parent transcripts do not embed subagent usage.
  - Encoded dir: `abs.replace(/[^A-Za-z0-9]/g, "-")` confirmed (dots/underscores → `-`, so `/.` gives `--`). Spaces and >200-char hash truncation unverified.
  - Model ids seen: `claude-sonnet-5`, `claude-haiku-4-5-20251001`, `claude-opus-5`, `claude-fable-5`, `<synthetic>`.
  - **Pricing (USD/MTok, verified 2026-09-19 from platform.claude.com/docs/en/about-claude/pricing):** fable-5-1 10/50, write 12.50 (5m) / 20 (1h), read 0.25; fable-5 same but read 1.00; opus-5 and opus-4-5..4-8 5/25, 6.25/10, read 0.50; opus-4-1 and opus-4-2025 15/75, 18.75/30, 1.50; sonnet-5 2/10, 2.50/4, 0.20; sonnet-4-6/4-5/4-2025 3/15, 3.75/6, 0.30; haiku-4-5 1/5, 1.25/2, 0.10; 3-5-haiku 0.80/4, 1/1.60, 0.08. No long-context surcharge. Match longest prefix first (never a bare `claude-opus-4`); unlisted models (3.x Sonnet/Opus/Haiku 3, mythos-preview) → `cost: null`.
- [x] Look up current per-model USD/MTok rates (Context7 / `claude-api` skill) for the Claude 5 family and Haiku 4.5 including cache-write and cache-read multipliers; keep the numbers for step 2.

### 2. Implement the parser script  <!-- agent: general-purpose -->

- [x] Create `lib/skills/usage-report/scripts/pricing.json` — `{ "asOf": "YYYY-MM-DD", "models": { "<id-prefix>": { "tier": "...", "input": n, "output": n, "cacheWrite": n, "cacheRead": n } } }` (USD per million tokens).
- [x] Create `lib/skills/usage-report/scripts/usage-report.js` (`#!/usr/bin/env node`, `'use strict'`, `node:` built-ins only, top-of-file comment stating purpose and the JSON contract per repo hook-script style). Functions: `encodeProjectDir(absPath)`, `listTranscripts(dir)` (recursive, includes `subagents/`), `parseTranscript(file)` (readline stream → usage records + skill-invocation events, tolerant of bad lines), `dedupe(records)`, `attributeSkills(records, events)`, `price(record, table)`, `aggregate(records)`, `readDeclaredModel(skill)`, `main(argv)`.
- [x] Implement CLI flags exactly as in the Approach (`--project`, `--all-projects`, `--since`, `--until`, `--pretty`); exit 0 with zero-total JSON when no transcripts exist; exit 2 with usage on unknown flag.
- [x] Make the file executable (`chmod +x`) and export the pure functions via `module.exports` guarded by `require.main === module` so the test can import them without running `main`.

  **Step 2 implementation notes (for Step 4 tests):** `parseTranscript(file)` and `main(argv)` are async (`main` resolves to the exit code); env overrides `USAGE_REPORT_PROJECTS_DIR` and `USAGE_REPORT_SKILLS_DIR` exist for hermetic tests; `aggregate(records, opts?)` expects records pre-priced with `cost`/`tier`/`skill` (`opts.declaredModel`); row `cost` is null only when every turn in it is unpriced; costs rounded to 6 dp; `range.until` is end-of-day inclusive; flags accept only the `--flag value` form; `tierOf` also exported.
<!-- Updated: 2026-09-19 -->


### 3. Write the SKILL.md  <!-- agent: general-purpose -->

- [x] Create `lib/skills/usage-report/SKILL.md` with the frontmatter from the Approach (`name: usage-report`, one-line `description`, `category`, `model`, `argument-hint`, `disable-model-invocation`, `user-invocable`) and the standard `**Prereqs:**` line used by sibling skills.
- [x] Body: run `node ~/.claude/skills/usage-report/scripts/usage-report.js $ARGUMENTS`; parse the JSON; render (a) totals, (b) a per-model table with tier, (c) a per-skill table sorted by cost with a `declared vs observed` column flagging mismatches, (d) the top 5 cost days. State that costs are estimates, that per-skill attribution is a last-invoked heuristic, and that unpriced models are listed under `meta.unpricedModels`. Handle the empty-project case with a one-line message.
- [x] State explicitly that the skill is read-only, offline, and does not write files or call any API.

### 4. Tests  <!-- agent: general-purpose -->

- [x] Create `test/usage-report.test.js` (node:test + node:assert, zero-dependency, header comment in the style of `test/task-typed-links.test.js`; picked up by `npm test`'s `test/*.test.js` glob).
- [x] Add a small synthetic fixture under `test/fixtures/usage-report/` (a project dir with one session JSONL and one `subagents/` JSONL, including a duplicated streaming entry, a `<synthetic>` entry, a malformed line, a `Skill` tool_use, and a `<command-name>` slash command) — no real transcript content.
- [x] Assert: dedupe removes the streaming duplicate; malformed line counted in `meta.skippedLines`; `<synthetic>` excluded; totals equal the hand-computed fixture sums; per-skill attribution follows last-invoked-skill; unknown model → `cost: null` and listed in `unpricedModels`; empty dir → valid zero-total JSON, exit 0; `encodeProjectDir` matches the Claude Code convention; unknown flag exits 2; output validates against the schema keys in the Approach (`schemaVersion: 1`).
- [x] Assert the SKILL.md contract: frontmatter has `name: usage-report` and a `model:` line, and it references the `scripts/usage-report.js` path.

### 5. Register the skill in the two command tables  <!-- agent: general-purpose -->

- [x] Re-read `lib/skills/README.md` immediately before editing; add **one** row after the `debug-logs` row (`| \`usage-report\` | Locally parse session logs for per-project token/cost rollups by model and skill (offline, read-only) |`). No other edits.
- [x] Re-read `CLAUDE.md` immediately before editing; add **one** row to the Custom Commands table after the `/debug-logs [symptom]` row (`| \`/usage-report [--all-projects] [--since YYYY-MM-DD]\` | ... |`). No other edits.
- [x] Do not touch `wiki/hot.md`, `wiki/index.md` component pages, or run `install-global.sh`; a component page for the skill is out of scope for this task.

### 6. Static gates  <!-- agent: general-purpose -->

- [x] `node --check lib/skills/usage-report/scripts/usage-report.js`
- [x] `node --test test/usage-report.test.js`, then `npm test` to confirm no other suite regressed.
- [x] Smoke-run the script against this repo (`node lib/skills/usage-report/scripts/usage-report.js --pretty`) and confirm valid JSON with plausible totals and no network access (runtime verification of the skill itself is the UAT phase).

  **Step 6 results (2026-09-19):** `node --check` clean; `test/usage-report.test.js` 21/21; `npm test` 723/738 — the 15 failures are none in usage-report: 5 known pre-existing (skill-frontmatter-aliases x4, task-typed-links x1), 9 from the concurrent TASK-0110 rename (missing `task-trash/SKILL.md`), 1 from concurrent TASK-0107 (`sandbox.scaffold` README cell vs schema). Smoke run: valid JSON, schemaVersion 1, 6132 turns for this repo (4 models, 27 skill buckets, 0 skipped lines, no unpriced models) in 0.65 s; `--all-projects` 65052 turns in 4.7 s; script imports only `node:fs/path/os/readline`.
<!-- Updated: 2026-09-19 -->

