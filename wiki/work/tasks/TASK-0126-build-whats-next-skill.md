---
id: TASK-0126
aliases: [TASK-0126]
title: "Build /whats-next: a read-only cross-family skill that ranks ALL open work (v1, no --go)"
status: pending-uat
created: 2026-09-20
updated: 2026-09-20
depends_on: [TASK-0114, TASK-0120, TASK-0125]
blocks: []
parallel_safe_with: []
origin_bug: ""
uat: "[[UAT-0126]]"
tags: [skill-design, assess, prioritization, work-families]
---

# TASK-0126 — Build /whats-next: a read-only cross-family skill that ranks ALL open work (v1, no --go)

relates_to::[[whats-next]]
relates_to::[[cross-family-work-prioritization]]
depends_on::[[TASK-0114]]
depends_on::[[TASK-0120]]
depends_on::[[TASK-0125]]

## Objective

Add `lib/skills/whats-next/SKILL.md`: a **strictly read-only** skill that sweeps every active task (in a roadmap or not), UAT, bug, roadmap item, ADR block and PRD, builds one dependency graph, and prints one prioritized "do next" report with parallel waves and a suggested command per row. It closes the roadmap blind spot measured on 2026-09-20: 5 of 31 active tasks and all 9 bugs sit outside every active roadmap, invisible to `/power-mode`, `/roadmap-assess` and `/roadmap-next`. Register it in `lib/skills/README.md`, the `CLAUDE.md` Custom Commands table and the Serena skill-category memory, and pin it with a contract test.

**Out of scope for v1:** the `--go` handoff. `/power-mode` accepts only a roadmap or single-task path/ID today; handing it a ranked wave needs a comma-separated task-ID dispatch there, which is a separate task not created here. v1 prints copy-pasteable per-item commands instead. No other skill changes; nothing under `~/.claude/` is touched.

## Approach

Full rationale, options compared and risks: `raw/research/whats-next/index.md` (summary at `wiki/knowledge/sources/whats-next.md`, ranking model at `wiki/knowledge/concepts/cross-family-work-prioritization.md`). Decisions carried into this task:

- **New skill, not a wrapper and not a power-mode mode.** Calling the six `*-assess` skills would fire their side effects (`bug-assess` prompts, `roadmap-assess` auto-close, `task-assess` edits and the `dependency-graph.md` write) and gives no cross-family order. Mirror the skeleton of `uat-assess` / `prd-assess` / `adr-assess`: Discover, Parse, cross-item analysis, Rank with an explicit precedence list, Report, `## Constraints`. Frontmatter tier is copied from `roadmap-assess` at implementation time (`category: researching`, `model: claude-sonnet-5`, `disable-model-invocation: false`, `user-invocable: true`; the contract test reads it from that file rather than hardcoding).
- **Reference, don't restate.** Take mechanics from `lib/skills/_shared/` and sibling skills by name: the ID/prefix Family table in `ID-RESOLUTION.md` (read at run time, not hardcoded; both 3- and 4-digit IDs and legacy `REQ-`/`DEC-` prefixes coexist), `roadmap-next`'s **Parse a roadmap** procedure, and each family `*-assess` skill's Rank step for its in-family precedence. Do not restate any of them.
- **Prereqs line** (grammar is contract-tested by `test/skill-boilerplate.test.js`; only one `wiki/work/<family>/lifecycle.md` reference is legal): ``**Prereqs:** obey `wiki/guides/mcp-tools.md` + `wiki/work/tasks/lifecycle.md`; run /primer if not done this session.``
- **Ranking = deterministic lexicographic tiers, never a numeric score.** Tier order: (1) fix what's broken — bugs `in-progress`, triaged P0/P1, or `critical`; (2) finish what's started — `in-progress` tasks and `pending-uat` tasks (run the UAT), plus untriaged bugs as **one batch row** promoted here when any is `high`/`critical`; (3) unblock — proposed ADR blocks gating live work, approved PRDs with no downstream; (4) start ready work — `todo` tasks with start-satisfied dependencies, inline roadmap items; (5) triage & hygiene — untriaged bugs, stale drafts, index drift; then a separate **Blocked** list (never ranked as actionable). Within a tier: downstream dependency depth ↓, fan-out ↓, age ↑, ID ↑. Roadmap membership is a display column, **not** a ranking input; the report counts orphans and suggests adopting them.
- **Dependency semantics** *(inference from live data: TASK-0121 is `in-progress` while its prerequisites are `pending-uat`)*: a `depends_on` edge is **start-satisfied** when the prerequisite is `pending-uat` or `done` (or has left the active set as terminal), **close-satisfied** only when `done`; a task with a `pending-uat` prerequisite is flagged *soft-blocked for closure*. Build the graph from the union of `depends_on` and reverse `blocks`, and flag asymmetric edges, cycles and stale references (real cases today: TASK-0096←0093, TASK-0114←0095, TASK-0121←0097 have no matching `blocks`).
- **Sweep by frontmatter, never by index text** (family indexes are stale: ROADMAP-0014 reads 0/9 while its file has 9 of 23 task-links checked). One `search_for_pattern` per family. Encode the verified Serena pitfalls in the skill text: use `[^\n]*` rather than `.*` under the default multiline (`.` matches newlines — a `^status:.*` sweep returned 459,518 characters); never `multiline=false` with `^` anchors (returns `{}`); `paths_include_glob` needs a full repo-relative path (`wiki/work/tasks/TASK-*.md`, not `TASK-*.md`); exclude `archive/` (archived ROADMAP-009 still shows an unchecked `[[TASK-073]]`); an empty sweep against a non-empty family index is a **warning**, not "no work". Decide active vs. closed from `status:`, never from directory.
- **Waves:** group Tier 1-4 task-pipeline items with no edge between them; default cap 5 (`--limit N` overrides). Collision-safety beyond graph edges is `/power-mode`'s own protocol at execution time.

## Steps

### 1. Write the skill  <!-- agent: general-purpose -->
<!-- Updated: 2026-09-20 -->


- [x] `Read` `lib/skills/roadmap-assess/SKILL.md`, `uat-assess/SKILL.md`, `adr-assess/SKILL.md`, `prd-assess/SKILL.md`, `roadmap-next/SKILL.md` (Parse procedure) and `lib/skills/_shared/ID-RESOLUTION.md` fresh — TASK-0120 and the Phase 4 tasks are still editing sibling lines — then `Write` `lib/skills/whats-next/SKILL.md`.
- [x] Frontmatter: `name: whats-next`; `description` beginning "Survey ALL open work — tasks (in or out of a roadmap), UATs, bugs, roadmaps, ADR blocks and PRDs — and rank one prioritized do-next list with parallel waves (read-only)"; `category`/`model`/`disable-model-invocation`/`user-invocable` matching `roadmap-assess`; `argument-hint: "[--limit N] [--family tasks,bugs,uat,roadmaps,adr,prd]"`.
- [x] Body sections, in order: Step 1 Discover & sweep (per-family recipes with the pitfalls above; STOP text `No open work found — nothing to rank. Use /task-create, /bug-create or /roadmap-create to add some.` only when every family is genuinely empty); Step 2 Build the graph (edge union, start/close-satisfied rule, asymmetry/cycle/stale-ref detection, `downstream_depth` and `fan_out`); Step 3 Rank (the tier table above); Step 4 Waves; Step 5 Report — (5a) snapshot line per family plus a WIP-by-state histogram, (5b) Wave 1 / Wave 2 with copy-pasteable commands, (5c) ranked table `Rank · Item · Family · Roadmap · Why · Unblocks · Next`, (5d) Blocked list with what each waits on, (5e) Warnings (cycles, asymmetric edges, index drift, orphan count, empty-sweep suspicion); `## Constraints` (read-only — no exception; permitted tools `list_dir`, `find_file`, `search_for_pattern`, `Read`; never bash reads; never run a case's Unit Test Command; keep the report terse — no preamble).
- [x] `Next` mapping per item (every command must resolve to a real `lib/skills/<name>/` directory): task `in-progress`/`todo` → `/tackle <path>`; `pending-uat` with UAT → `/uat-auto <uat>` when every unresolved case is unit-backed else `/uat-walk <uat>`; `pending-uat` without UAT → `/uat-create <task>`; bug `open` → `/bug-assess` (batch) or `/bug-triage BUG-NNNN`; `triaged` → `/bug-triage` or `/task-create`; `in-progress` → `/bug-close`; proposed ADR block → `/adr-finalize <file>#DM`; accepted-without-task → `/task-create --decision ADR-NNNN#DM`; approved PRD → `/adr-extract <file>`; draft PRD → `/prd-finalize <file>`; fully-checked roadmap → `/roadmap-next <roadmap>`; inline roadmap item → `/roadmap-next <roadmap>`.
- [x] Do **not** add a `--go` flag, a `Skill` or `AskUserQuestion` permission, or any write. Note in one sentence under Constraints that handing a wave to `/power-mode` awaits a task-ID-list dispatch there.

### 2. Register the skill  <!-- agent: general-purpose -->
<!-- Updated: 2026-09-20 -->


- [x] `lib/skills/README.md`: add one row for `whats-next` adjacent to the `*-assess` rows (near line 64, after a fresh `Read`), in the same "Survey …(read-only)" phrasing.
- [x] `CLAUDE.md`: add one `| /whats-next |` row to the Custom Commands table adjacent to `/uat-assess` (near line 127). Anchored `Edit` only.
- [x] `.serena/memories/skills/format-and-model-selection.md`: add `` `whats-next` `` to the **researching** category list (line 24) and bump the "Verified against …" skill count/date line if it states one. Use `Read` then `Edit`; memory files are markdown.

### 3. Contract test  <!-- agent: general-purpose -->
<!-- Updated: 2026-09-20 -->


- [x] Create `test/whats-next-skill.test.js` — zero-dependency `node:test` + `node:assert/strict`, read-only, no subprocess, header comment explaining WHY it is tested (skills are markdown-as-program), mirroring `test/assess-skills-contract.test.js`. Cases: (1) frontmatter tier equals `roadmap-assess`'s, read at test time; `argument-hint` present; description starts "Survey ALL open work"; (2) Prereqs line matches the boilerplate grammar; (3) read-only contract — `## Constraints` block present, permitted-tools line lists exactly `list_dir`, `find_file`, `search_for_pattern`, `Read`, no `AskUserQuestion`/`Skill`/`Edit`/`Write` in that line, no log/index append instruction, the "never run a case's Unit Test Command" sentence; (4) shared docs are pointed at, not restated — `ID-RESOLUTION.md` Family-table reference and `roadmap-next` Parse-a-roadmap reference by path; (5) the sweep pitfalls are encoded — `[^\n]*`, a full-path glob example, `archive/` exclusion, the empty-sweep warning; (6) the five tier names appear in order with the Blocked list after them, and "roadmap membership" is stated as not a ranking input; (7) start-satisfied vs close-satisfied rule and `pending-uat` both named; (8) every suggested `/command` in the skill resolves to an existing `lib/skills/<name>/SKILL.md`; (9) the three registration rows exist (skills README, `CLAUDE.md`, Serena memory).
- [x] Run file-scoped: `node --test test/whats-next-skill.test.js`, then `node --test test/skill-boilerplate.test.js test/assess-skills-contract.test.js test/assess-skills-crossrefs.test.js` to confirm the new skill did not disturb the skill-iterating suites. The five known pre-existing failures (`shared-id-resolution` (f), `skill-frontmatter-aliases` ×4) are out of scope; do not use the full suite as a gate.

### 4. Log  <!-- agent: general-purpose -->
<!-- Updated: 2026-09-20 -->


- [x] Append one `edit` entry to `wiki/log.md`: `## [2026-09-20] edit | TASK-0126 /whats-next skill added` with a one-sentence summary. Do not run `install-global.sh` — the skill is not invocable until the next normal install syncs `~/.claude/skills/` (TASK-0122 owns the installer prune).

## Notes

- **Live validation is manual and post-install:** after `install-global.sh` runs, `/whats-next` on this repo should list the `TASK-0118 → 0119 → 0120 → 0121 → 0122 → 0123 → 0124` chain first (through its UAT runs), surface the five orphan tasks and the nine untriaged bugs, and warn about the asymmetric edges above. The UAT should carry this as a manual case; the unit test cannot execute the skill.
- **Precondition for runtime use:** ROADMAP-0014 Phase 4 landed and `install-global.sh` run, otherwise suggested commands (`/task-create`, `/adr-*`, `/prd-*`, `/uat-create`, `/bug-create`) are dead in the installed set. The repo-local contract test is unaffected.
- **Follow-ups (not created):** a `/power-mode` task-ID-list dispatch to enable `--go`; point `roadmap-next`'s Step 0 stop message and `tackle`'s no-arg survey at `/whats-next`; an optional non-persisted Mermaid `--graph` output.
