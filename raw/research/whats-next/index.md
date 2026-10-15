---
topic: a new skill that combines 'power-mode', 'roadmp-assess', and 'task-assess' .. some tasks aren't part of a roadmap! this skill should assess ALL open work and prioritize from there. maybe soimething silly like '/whats-next
slug: whats-next
researched: 2026-09-20
sources: [./sources.md]
---

# Research: `/whats-next` — one skill to assess and prioritize ALL open work

> **Recommendation:** build `/whats-next` as a new, **strictly read-only** cross-family advisor (in the mould of `uat-assess` / `prd-assess` / `adr-assess`), not as a wrapper that calls the six existing `*-assess` skills and not as a mode of `power-mode`. It sweeps the frontmatter of every active task, UAT, bug, roadmap, ADR block and PRD in one cheap pass, builds one dependency graph across all of them (roadmap membership becomes a column, not a gate), and ranks with **deterministic lexicographic tiers** — fix broken → finish in-flight → unblock → start ready → triage — tie-broken by downstream critical-path depth. Execution stays in `power-mode`: an explicit `--go` flag hands the top wave to it, which needs one small addition to `power-mode` (accept a task-ID list). Two prerequisites: `pending-uat` is a live task status but is missing from `tasks/lifecycle.md`, and the installed skill set lags the repo's renames. Build after ROADMAP-0014 Phase 4 lands.

## Research Questions

1. What do `power-mode`, `roadmap-assess` and `task-assess` each do, and where do they overlap or go blind?
2. How much open work is invisible to roadmap-centric tooling in this repo today?
3. What cross-family ranking model is defensible given the data the wiki actually holds (no effort/value fields)?
4. What architecture — read-only advisor vs. executor, composition vs. new logic — fits repo conventions and Claude Code's skill mechanics?
5. What are the risks, prerequisites and delivery sequence?

## Current State (Codebase)

**Three skills, three different jobs.**

- `power-mode` is an **executor**. It dispatches on a *roadmap path* or a *single task path/ID* only, runs `tackle → uat-create → uat-auto` in waves, mandates ≥5 parallel agents when ≥5 collision-safe tasks exist, spawns everything with `mode: "bypassPermissions"`, and is autonomous ("do NOT pause between waves") [S1]. It has no notion of tasks outside a roadmap unless you name one.
- `roadmap-assess` is a **roadmap-only advisor**. Discovers `status: active` roadmaps, checks outstanding ADR decisions, cross-roadmap edges, ranks roadmaps by hard-dependency → functional priority → momentum. It has one write side-effect: auto-closing fully-checked roadmaps [S2].
- `task-assess` is **index-driven** ("Do **not** scan the directory directly"). Step 2 has heavy side effects: it auto-checks step boxes it can verify in code, moves fully-complete tasks to done via `ARCHIVE-WORK-ITEM.md`, and always overwrites `wiki/work/tasks/dependency-graph.md` [S3]. It builds waves by topological sort but treats a dependency as resolved only when the referenced task has left the active index [S3].

**The repo already has six per-family assess skills** (`roadmap`, `task`, `bug`, `uat`, `prd`, `adr`) plus `roadmap-next`, `adr-next` and `tackle`'s no-arg task survey [S2–S9]. Each ranks *within* its family. Nothing ranks *across* families. Their conventions differ: `uat-assess`, `prd-assess`, `adr-assess` are "strictly read-only — no exception" [S5–S7]; `bug-assess` prompts the user for batch triage and edits files [S4]; `roadmap-assess` and `task-assess` write [S2, S3].

**The roadmap blind spot is real and measurable** (live state, 2026-09-20; sweeps in S15–S18):

| Family | Active | Inside an active roadmap | Outside |
|---|---|---|---|
| Tasks | 31 (24 `pending-uat`, 6 `todo`, 1 `in-progress`) | 26 | **5** (TASK-031, -039, -074, -075, -0085) |
| Bugs | 9 (all `open`, all `priority: "—"`; 3 high / 3 medium / 3 low severity) | 0 — bugs are never roadmap items | **9** |
| UATs | 24 (all `pending`, none walked) | via their task | via their task |
| PRDs / ADR groups | 0 / 0 | — | — |

14 of the 40 open tasks + bugs (35%) are invisible to `power-mode`, `roadmap-assess` and `roadmap-next`; `tackle`'s no-arg Roadmap Auto-Discovery is likewise roadmap-first and only falls back to a status-only index survey [S9].

**Family indexes are stale as a state source.** `roadmaps/index.md` reports ROADMAP-0014 as 0/9, ROADMAP-011 as 0/4 and ROADMAP-012 as 0/3; the roadmap files show 9 of 23 task-links checked, 2/4 and 1/3 respectively [S14, S16]. Any ranking must read file frontmatter/checkboxes, not index text.

**The frontmatter is machine-sweepable.** Every active task has `status` (line 4), `depends_on` (line 7) and `blocks` (line 8) arrays [S15]. Edges are mostly symmetric but not always: TASK-0096 `depends_on: [TASK-0093]` while TASK-0093 has `blocks: []`; likewise TASK-0114→TASK-0095 and TASK-0121→TASK-0097 [S15]. So the graph should be the union of both directions, with asymmetry flagged (as `task-assess` already does [S3]).

**A dependency does not always mean "done".** TASK-0121 is `in-progress` while two of its `depends_on` prerequisites (TASK-0120, TASK-0097) are only `pending-uat` [S15]. *(Inference — no primary source states the rule.)* In practice a prerequisite is treated as satisfied-for-start once implemented, and only needed as `done` for closure. `task-assess`'s "resolved only when it leaves the active index" rule [S3] would mis-wave this chain.

**`pending-uat` is a live status missing from its own lifecycle doc.** `tackle` sets it, `roadmap-next`, `power-mode` and `UAT-CORE` consume it, and 24 of 31 active tasks carry it [S8, S9, S1, S15]; `tasks/lifecycle.md` still enumerates `todo | in-progress | done | trashed` [S10].

**Installed skills lag the repo.** This session's available-skill list still shows `task-audit`, `decision-*`, `req-*`, `task-add`, `uat-generate`, `bug-file`, while the repo has `task-assess`, `adr-*`, `prd-*`, `task-create`, `uat-create`, `bug-create` (ROADMAP-0014 Phase 4, mostly `pending-uat`) [S21, S14]. Skill edits are not live until `install-global.sh` syncs `~/.claude/skills/` [S13].

## Key Findings

1. **The right unit of ranking is the work item, and roadmaps are metadata.** Ranking within each family and then merging cannot answer "task or bug first?". One graph over all active items, with roadmap membership as a column, answers the user's actual complaint (some tasks aren't part of a roadmap) [S14–S18].
2. **The wiki holds no effort or value estimates**, so numeric frameworks would be fake precision. Tasks have no priority/effort field [S10]; bugs have `priority`/`severity` but all 9 are untriaged [S17, S32]. RICE needs reach/impact/confidence/effort; WSJF needs three cost-of-delay scores plus job size [S27]. Every existing assess skill instead uses an explicit lexicographic precedence with a one-sentence, user-overridable rationale [S2, S4–S7]. Follow that convention.
3. **The substantive economic insight *is* usable without estimates.** Reinertsen's CD3 and WSJF "divide value by a size term so small bets float up" [S27, S29]; Little's Law — "lead time equals WIP divided by throughput" — argues for finishing in-flight work before starting more [S26]; Kanban's rule is "stop starting, start finishing" [S25]. Cheap proxies available from the graph: *state* (in-flight beats not-started) and *downstream critical-path depth* — the longest chain of dependents, i.e. the CPM notion that critical-path tasks "must finish on time to avoid delaying the entire project" [S30, S31].
4. **Applied to this repo, that reframes the bottleneck as verification, not implementation** *(inference from S15/S18)*: 24/24 UATs are pending and 24/31 tasks are `pending-uat` — nearly all WIP sits in one state. Whether those UATs are auto-runnable (unit-backed) vs. manual was **not measured** here; `uat-assess` defines the check [S5].
5. **Composition by calling the six assess skills is the wrong reuse level.** They carry side effects and prompts (`bug-assess` `AskUserQuestion`; `roadmap-assess` auto-close; `task-assess` edits + `dependency-graph.md` write) that would fire inside a "what's next?" query [S2–S4]; each re-reads its whole family; and none yields a cross-family order. Reuse *by reference* instead — the repo's own pattern (`roadmap-assess` says "follow it as written" for `roadmap-next`'s Parse-a-roadmap procedure [S2, S8]).
6. **Executor logic should stay in one place.** `power-mode` was deliberately shrunk in TASK-0100 to remove duplicated pipeline logic [S19]; its Single-Task Executor already encodes the resume rule (`pending-uat` with a UAT file → stage 3) that Tier-2 items need [S1]. Adding a small "task-ID list" dispatch to `power-mode` lets `/whats-next --go` delegate rather than re-implement.
7. **Claude Code mechanics allow either shape.** Skills accept `context: fork`, `disable-model-invocation`, `model`, `effort`; a forked skill runs in the background unless `background: false` [S23]. Subagents may nest up to three layers by default [S24]. A read-only advisor gains little from forking (its output is the deliverable and its sweeps are small), so keep it inline.
8. **Serena sweep pitfalls are now known** (empirical, S22): with the default `multiline=true`, `.` matches newlines, so `^status:.*` returned 459,518 characters; use `[^\n]*`. `multiline=false` returns *nothing* for `^`-anchored patterns. `paths_include_glob` must be spelled as a full repo-relative path (`wiki/work/tasks/TASK-*.md`); the bare basename glob returned nothing. Also exclude `archive/`: `ROADMAP-009` (archived) still has an unchecked `[[TASK-073]]` that would otherwise read as live work [S16].
9. **Parallel agents share write targets.** `wiki/log.md` and family `index.md` are shared files that concurrent skills already both edit; the wiki records multi-writer corruption as a documented risk pattern with no locking adopted [S20]. `--go` waves inherit that risk; a read-only default avoids it.

## Constraints

- **Repo conventions for a new skill** [S13]: `lib/skills/whats-next/SKILL.md`; frontmatter `category` (researching), `model` (default tier `claude-sonnet-5`; do not move to opus), invocation flag; register in `lib/skills/README.md`, the `CLAUDE.md` command table, `lib/scripts/templates/CLAUDE-wiki.md`, and the Serena `skills/format-and-model-selection` memory; a per-skill contract test (TASK-0120 set this precedent [S14]).
- **Prereqs line grammar** is contract-tested: `**Prereqs:** obey \`wiki/guides/mcp-tools.md\` + \`wiki/work/tasks/lifecycle.md\`; run /primer if not done this session.` — only one `wiki/work/<family>/lifecycle.md` reference form is legal [S11].
- **Resolution and archive rules**: resolve refs per `ID-RESOLUTION.md` (both 3- and 4-digit IDs coexist: `TASK-031` vs `TASK-0086`) [S12]; decide active vs closed from `status:`, never from directory [S5–S7].
- **Tooling rules**: Serena for exploration; `Read`/`Edit` only for markdown; never bash reads [S5].
- **Skill-file collisions**: ROADMAP-0014 Phase 4 tasks are simultaneously editing `lib/skills/README.md`, `CLAUDE.md` and the templates [S14]; a new skill registering in the same tables should sequence after them.

## Solution Comparison

| Criteria | **A. Thin router** — call the 6 `*-assess` skills, concatenate | **B. New read-only cross-family skill** (recommended) | **C. Add a no-arg "assess-all" mode to `power-mode`** | **D. Extend `task-assess` to cover orphans** |
|---|---|---|---|---|
| **Approach** | `Skill` each family assess, merge reports | One frontmatter sweep, one graph, one tiered ranking, terse report; optional `--go` handoff | `power-mode` with no args assesses then executes | Widen `task-assess` scope |
| **Pros** | Zero new ranking logic | Cross-family order; no side effects; cheap; matches `uat/prd/adr-assess` | Single entry point | Smallest diff |
| **Cons** | Fires prompts + writes; 6× reads; no cross-family rank; merge step is the hard part anyway | New skill to maintain; ranking logic overlaps family skills' precedence rules | Mixes advisor and autonomous bypass-permissions executor; reverses TASK-0100's shrink | Still task-only: bugs, UAT, ADR, PRD stay invisible; name/scope lie |
| **Complexity** | Low to write, high to make coherent | Medium | Medium–High | Low |
| **Dependencies** | None | Small `power-mode` list-mode change for `--go` | Large power-mode rewrite | None |
| **Codebase fit** | Poor (side effects) | Good (follows read-only assess pattern + "reference, don't restate") | Poor | Poor |
| **Maintenance** | Family skills change → merge breaks | Precedence rules must stay aligned with family skills (by reference) | Two responsibilities in one skill | Scope creep |

## Recommendation

**Build option B.** Specification sketch:

```yaml
---
name: whats-next
description: Survey ALL open work — tasks (roadmap or not), UATs, bugs, roadmaps, ADR blocks, PRDs — and rank one "do next" list with parallel waves; read-only by default, --go hands the top wave to /power-mode
category: researching
model: claude-sonnet-5
argument-hint: "[--go] [--limit N] [--family tasks,bugs,uat,...]"
disable-model-invocation: false   # safe: read-only unless --go
---
```

**Procedure.**

1. **Sweep** (frontmatter only, one `search_for_pattern` per family, `[^\n]*` patterns, full-path globs, archive excluded): tasks → `status|depends_on|blocks|uat`; UATs → `status|task`; bugs → `status|priority|severity`; roadmaps → `status` + `\[\[TASK-\d+` item lines with checkbox; ADR/PRD → per the family `*-assess` Steps 1–3 *by reference*. Never trust `index.md` for state; cross-check it for drift warnings only.
2. **Graph**: nodes = all active tasks; edges = union of `depends_on` and reverse `blocks`; flag asymmetry, cycles, stale refs (terminal dependency = satisfied). A dependency is **start-satisfied** when the prerequisite is `pending-uat` or `done` and **close-satisfied** only when `done`; a task with a `pending-uat` prerequisite is marked *soft-blocked-for-closure*. Compute per node: `downstream_depth` (longest chain of dependents) and `fan_out` (transitive dependents).
3. **Rank** by lexicographic tier, then `downstream_depth` ↓, `fan_out` ↓, age ↑, ID ↑ — never an opaque score:

   | Tier | Contents | Default `Next` |
   |---|---|---|
   | 1 Fix what's broken | bugs `in-progress`, triaged P0/P1, or `critical` | `/bug-close` · `/task-create` |
   | 2 Finish what's started | tasks `in-progress`; `pending-uat` tasks (UAT run) | `/tackle` · `/uat-auto` · `/uat-walk` · `/uat-create` |
   | 3 Unblock | proposed ADR blocks gating live work; approved PRDs with no downstream | `/adr-finalize` · `/adr-extract` |
   | 4 Start ready work | `todo` tasks with start-satisfied deps; inline roadmap items | `/tackle` · `/task-create` |
   | 5 Triage & hygiene | untriaged bugs (**one batch row**, promoted to Tier 2 if any is `high`/`critical`), stale drafts, index drift | `/bug-assess` · `/prd-finalize` |
   | — Blocked | listed with what each waits on; not ranked as actionable | the blocker's `Next` |

   Roadmap membership is a display column, **not** a ranking input, so orphans cannot starve; the report adds a warning counting orphans and suggests adopting them into a roadmap.
4. **Waves**: group Tier 1–4 task-pipeline actions with no edge between them into waves (default cap 5 = `power-mode`'s minimum team size [S1]; `--limit N`). Collision safety beyond graph edges is `power-mode`'s own protocol at execution time.
5. **Report** (terse, no preamble): snapshot line per family and the WIP-by-state histogram → **Wave 1 / Wave 2** with copy-pasteable commands → ranked table (`Rank · Item · Family · Roadmap · Why · Unblocks · Next`) → blocked list → warnings (cycles, asymmetric edges, index drift, orphan count, `pending-uat` lifecycle drift).
6. **`--go`** (explicit only): run Wave 1's *task-pipeline* items via `Skill power-mode TASK-a,TASK-b,…`; bug/ADR/PRD items are printed as manual. Ask one `AskUserQuestion` confirm first because `power-mode` spawns `bypassPermissions` agents [S1]. **Required `power-mode` change:** a third dispatch form (comma-separated task IDs) that skips roadmap Steps 1–2 and runs Step 3 once plus the reap sweep; the existing per-task resume rule already covers `pending-uat` items [S1].
7. **Constraints block** (same shape as `uat-assess`): read-only, permitted tools `list_dir`, `find_file`, `search_for_pattern`, `Read`, `Skill` (only under `--go`), `AskUserQuestion` (only under `--go`).

**Illustrative dry run** (hand-derived from the sweeps, *not* tool output; ranks would come from the algorithm above). The dependency chain `0118 → 0119 → 0120 → 0121 → 0122 → 0123 → 0124` has downstream depth 6 from its head, and TASK-0107 and TASK-0097 additionally gate TASK-0122 and TASK-0121 [S15]. TASK-0118, -0119, -0120, -0097 and -0107 are `pending-uat` with UATs pending, and TASK-0121 is `in-progress`, so Wave 1 would be UAT runs for those plus continuing TASK-0121; `TASK-0093` (gates `TASK-0096`) and `TASK-0095` (gates `TASK-0114`) follow. Ready `todo` tasks (TASK-0101, and orphan TASK-074) land in Tier 4. The 9 untriaged bugs — three `high` severity — appear as one triage row promoted to Tier 2.

**Risks & mitigations**

| Risk | Mitigation |
|---|---|
| Ranking is opinionated without effort/value data | Deterministic tiers, one-sentence rationale per row, explicit "judgment call — override freely" note (same as every family assess) |
| `pending-uat` undocumented in lifecycle | Fix `lifecycle.md` (repo + template) **first** — file a bug/task; whats-next hard-codes the enum only after that |
| Dead commands in `Next` until install | Ship after Phase 4 lands and `install-global.sh` has run |
| Precedence rules drift from family skills | Reference each family skill's Rank step by name instead of copying; contract test asserts the references exist |
| `--go` autonomy + shared `index.md`/`log.md` writers [S20] | Off by default; confirm prompt; cap wave size; `power-mode` reap sweep unchanged |
| Sweep queries silently return `{}` | Encode the S22 pitfalls in the skill text; treat an empty sweep on a non-empty family index as a warning, not "no work" |
| Untested claim: UATs are auto-runnable | Skill computes it (per `uat-assess`); this report did not |

**Alternative if constraints change:** if the team later adds effort/value fields to task frontmatter, layer a WSJF/CD3 score *inside* each tier as a tie-break, keeping tiers as the outer order — do not replace tiers.

## Next Steps

- File the prerequisite: `/bug-create` — "`pending-uat` is a live task status but absent from `wiki/work/tasks/lifecycle.md` and its template" (evidence: S9, S10, S15).
- When ROADMAP-0014 Phase 4 is closed and `install-global.sh` has run, create the work: `/task-create` for (a) the `power-mode` task-ID-list dispatch, and (b) the `whats-next` skill + contract test + four registrations, with `depends_on: [TASK-0114, TASK-0120]`. Consider a small new roadmap rather than ROADMAP-0014 (which is scoped to de-duplication), so the work itself is not an orphan.
- Optional follow-ups after v1: point `roadmap-next`'s Step 0 stop message and `tackle`'s no-arg survey at `/whats-next`; a Mermaid `--graph` output (not persisted, unlike `task-assess`).
- Still unmeasured: how many of the 24 pending UATs are auto-runnable — worth a one-off `/uat-assess` before sizing the `--go` value.
