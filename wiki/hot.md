---
title: Hot Cache
updated: 2026-08-07
---

# Hot Cache

Session-handoff summary of what changed most recently — the small file an agent reads first to get oriented fast. **Fully regenerated at the end of every wiki-writing session, never appended to.** Keep it under ~500 words; if a fact stops being "recent", it drops off (its durable form lives in a knowledge or work page).

_Last updated: 2026-08-07_

## Key Recent Facts

- **`/wiki-query` now self-heals on a coverage miss (2026-08-06).** Its old dead-end ("no coverage → suggest `/wiki-ingest`") is a real fallback Step 4: diff `raw/` against the `sources:` back-links in `knowledge/sources/` (the back-link is authoritative, not the filename slug), rank candidates cheaply, then run the full `/wiki-ingest` procedure with its Step 2 checkpoint downgraded to a non-blocking announcement. **Hard caps: 3 sources and one re-answer per invocation** — a query can never cascade into an ingest loop. This matters for the 10 never-ingested raw sources the lint flagged: they will now get pulled in on demand rather than sitting unprocessed.
- **Release 2.17.0 (b85cbe9) is still committed-but-unpushed and unpublished** — `git push` + `npm publish` remain the user's move (npm login was previously expired). Post-release bookkeeping is still uncommitted in the tree.
- **Serena memory `skills/format-and-model-selection` was corrected (2026-08-06)** — it had retired model IDs (`claude-opus-4-8`, `claude-sonnet-4-6`) and a phantom Fable tier. Reality: `claude-opus-5` (7 skills), `claude-sonnet-5` (default), `claude-haiku-4-5-20251001` (9 skills). It also missed a fourth category, `wiki`, used by `wiki-archive`/`wiki-rotate-log`/`wiki-tidy` — while `wiki-query`/`wiki-lint`/`wiki-ingest` are filed as `researching`.
- **Hook comment coverage is uneven, and that is the real defect** — command-class guards sit at 35–50% comments (headers near-verbatim restating README prose), Serena-first hooks at 4–18% while holding the densest heuristics. TASK-039 addresses it asymmetrically rather than uniformly.
- **There is no preference store in this repo, and declined prompts re-ask forever (2026-08-06).** All ~17 installer prompts infer stickiness from side effects, which only works in the "yes" direction. `sync-wiki-scaffold.sh:171` is the sole correct one (both answers write a sentinel); the Playwright conflict menu is the worst (re-asks even after being answered). ROADMAP-005 fixes this.
- **ROADMAP-005 absorbed TASK-030 rather than duplicating it.** TASK-030 had already designed the skill-consent half, including a **four-state model** — `unset` / value / `false` / `ask` — where `ask` means "keep prompting me, don't persist". Conflating `unset` with `ask` is the design's central trap. TASK-030 is now `part_of: ROADMAP-005`, narrowed to its steps 3–4.
- **TASK-030's "project prefs file must never be committed" is superseded (2026-08-06)** by a `prefs.gitTracking` three-way choice (`.gitignore` / `.git/info/exclude` / neither). `.git/info/exclude` stays the sensible default; committing is a deliberate opt-in. Don't reinstate the old rule from a stale reading.
- **ROADMAP-005 Phase 1 is DONE and Phase 2 is now TASK-043 → {044 ∥ 045 ∥ 046} → 047 (2026-08-06).** TASK-043 (`lib.sh` sticky helpers) gates the three wiring tasks, which touch disjoint scripts. Two traps carried into them from Phase 1: `mcp.playwrightConflict` stores the **names** `shared|alongside|skip` while `install-mcps.sh:415` branches on the digits `1`/`2`/`*`, so a stored name falls through every branch and silently behaves like `skip`; and `.gitignore` section keys must be computed by `bootstrap-prefs.js --section-key`, never slugified in `awk`/`sed`, because one banner title carries an em dash (U+2014) that a byte-wise slugifier turns into three dashes. Also note `test/bootstrap-prefs.test.js` pins every `script.sh:line` citation in the schema — **any edit to a wired script must re-cite in both the schema and `CITATION_PINS`**, and 044/045/046 share those two files while running concurrently.
- **Phase 1's earlier naming/behaviour calls still stand (2026-08-06).** Three naming/behaviour calls were settled while writing them, and re-deriving them from the plan alone would get them wrong: `gitignore.review` is **dropped** (it and TASK-030's `gitignore.offerSectionUpdates` are one prompt); `--get` **resolves by default** rather than behind the plan's proposed `--resolve` flag, because forgetting the flag would silently return `unset` and re-prompt; and schema `default` encodes *today's* behaviour (`research.persistToRaw` → `true`, `gitCommit.autoPush` → `false`, `gitCommit.versionBump` → `"auto"`, every installer key → `null`) but is metadata that is **never written to a values file**.
- **The helper's exit codes encode whose fault it is.** `exit 0` for any unexpected *world* state (missing file, malformed JSON, unset key) so a corrupt prefs file can never abort an install under `set -euo pipefail` or block a `/git-commit`; `exit 1` only for a wrong *caller* (invalid `--value`, unknown flag, write with no layer selector). A malformed file degrades to empty on read but **blocks writes rather than being overwritten**.

- **ROADMAP-005 Phases 1 and 2 are DONE; Phase 3 is TASK-030 ∥ TASK-048 (2026-08-07).** The two Phase 3 items are parallel-safe: TASK-030 wires the five skill consumers and touches `install-global.sh`, `merge-gitignore.sh`, and five SKILL.md files; TASK-048 creates exactly one new file, `lib/skills/bootstrap-config/SKILL.md`. Suite is at 264 (264 pass, 0 fail, 0 skipped).
- **`/bootstrap-config` is referenced before it exists.** The generated `bootstrap-prefs.README.md` companion already tells users to run it, and `bootstrap-prefs.js` prints the same pointer. TASK-048 builds it: three modes (view / edit / reset), reading `bootstrap-prefs-schema.json` for per-key `detail`/`values`/`scope` since `--list` prints only `summary`, and never offering a value the grammar omits (`gitCommit.versionBump`'s ask state IS `confirm`; `gitignore.section.*` is `false`-only). Registering it in `lib/skills/README.md` and `CLAUDE.md` is **Phase 4**, deliberately not TASK-048.

## Recent Changes

- Created: `TASK-048` (`/bootstrap-config` skill), ROADMAP-005 Phase 3 item 2, `todo`, `parallel_safe_with: [TASK-030]`.
- Closed: ROADMAP-005 Phase 2 — `TASK-043`–`047` all done and archived with their UATs; the bijection test is un-skipped with `PHASE_3_PENDING` holding exactly the four `consumer: skill` keys, which empties itself when Phase 3 lands.
- Created: ROADMAP-005 Phase 2's five tasks — `TASK-043` (`lib.sh` sticky helpers + `BOOTSTRAP_ASSUME_TTY`), `TASK-044` (`install-mcps.sh`), `TASK-045` (`sync-wiki-scaffold.sh` / `install-global.sh` / `update-project.sh`), `TASK-046` (`merge-gitignore.sh` + `prefs.gitTracking`), `TASK-047` (`test/prompt-stickiness.test.js` + the bijection un-skip), all `todo`.
- Closed: ROADMAP-005 Phase 1 — `TASK-040`/`041`/`042` done and archived with their UATs; the suite sits at 209 (208 pass, 1 deliberate skip).
- Updated: `ROADMAP-005` Phase 1 and Phase 2 — all inline items replaced with task links; no checkbox flipped.
- Updated: `TASK-030` (scope narrowed to sync prompt + consumer wiring; `part_of: ROADMAP-005`; two superseding callouts), both family indexes.
- Updated: `lib/skills/wiki-query/SKILL.md` (new Step 4 auto-ingest fallback; old Step 4 → 5; two new CRITICAL RULES), `CLAUDE.md` (3 command rows), `lib/scripts/templates/CLAUDE-wiki.md`, `lib/skills/README.md`, `wiki/work/tasks/index.md`.
- Synced: `./lib/scripts/install-global.sh` run twice (`--skip-mcps`, then full) — skills/hooks/deny/wiring/fileSuggestion all current; all three MCPs already installed.

## Active Threads

- **Publish 2.17.0** — user action: `git push` + `npm publish`; one release commit unpushed on main plus post-release bookkeeping and this session's edits to commit.
- **TASK-039 (pending-uat)** — implementation done; needs `/uat-walk` or `/uat-auto`, not `/tackle`.
- **ROADMAP-005 (8/16, active)** — preference store. Phases 1–2 done; Phase 3 is two parallel-safe tasks, then Phase 4 (docs, npm-pack pins, end-to-end verification).
- **TASK-030 (todo)** — ROADMAP-005 Phase 3 item 1: the sync-time prompt pass plus wiring the five skill consumers. Its step-1 design decision (sentinel block canonical form) is **no longer blocking** — the prefs file's git treatment is a user choice now, not a fixed `.git/info/exclude` entry.
- **TASK-048 (todo)** — ROADMAP-005 Phase 3 item 2: create `lib/skills/bootstrap-config/SKILL.md`. Ready for `/tackle`; runs in parallel with TASK-030 (disjoint files). Landing TASK-030 is what empties `PHASE_3_PENDING` in the bijection test, not this one.
- **TASK-031 (todo)** — Tier 3 `/sandbox`; note `install-global.sh` + `merge-settings-hooks.js` are TWO settings-writing scripts the measurement must account for.
- **ROADMAP-001 (11/12)** — Phase 4 advisory locking deliberately deferred.
- **10 never-ingested raw sources** — 5 `raw/research/` dirs plus `llm-wiki.md`, `llm-wiki-2.md`, `design-principles.md`, `harness-notes.md`, a case-study PDF. `/wiki-query` will now ingest these opportunistically.
