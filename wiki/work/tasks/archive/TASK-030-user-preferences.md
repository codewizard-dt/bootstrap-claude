---
id: TASK-030
aliases: [TASK-030]
title: "User preferences: stop skills doing consequential things without consent"
status: done
created: 2026-07-30
updated: 2026-08-07
part_of: ROADMAP-005
depends_on: []
blocks: []
parallel_safe_with: []
uat: "[[UAT-030]]"
tags: [preferences, skills, install-global, consent]
---

# TASK-030 — User preferences: stop skills doing consequential things without consent

## Objective

Introduce a preference store so skills stop taking consequential actions the user never agreed to. Two motivating cases: `/git-commit` bumps `package.json`'s version on every commit whether or not the project versions that way, and `/research` always writes its report into `raw/research/` whether or not the user wants it kept. Preferences are answered **once, during the skill sync** (`install-global.sh`), stored in a two-level file (global default, per-project override), and read by skills at run time. `/research` additionally gets a **per-run** override so a single report can be discarded without changing the default.

> **Scope narrowed 2026-08-06 — absorbed into `part_of::[[ROADMAP-005]]`.**
> This task now covers **steps 3 and 4 only**: the sync-time preferences pass and wiring the five consumers. The store itself (steps 1–2) is ROADMAP-005 Phase 1, and tests/docs/verification (steps 5–6) are its Phase 4. Those steps are retained below as the specification the roadmap phases implement — do not build them twice.
>
> Four reconciled decisions, all superseding the text below where they conflict:
> 1. **Filenames** — `~/.claude/bootstrap-prefs.json` + `<project>/.claude/bootstrap-prefs.json`, helper `lib/scripts/bootstrap-prefs.js`. Not `bootstrap-preferences.json` / `preferences.js` / a repo-root project file.
> 2. **The project file may be committed.** The "must never be committed" requirement in *Approach* is **superseded** — a new `prefs.gitTracking` preference offers `.gitignore` / `.git/info/exclude` / neither, making a committed, team-shared answers file a deliberate opt-in. Step 1's open design decision is therefore no longer blocking.
> 3. **`gitCommit.autoVersionBump` becomes `gitCommit.versionBump`** with `auto` / `confirm` / `never` instead of a boolean. `confirm` *is* this key's `ask` state, so both do not exist.
> 4. **Two prompt populations.** The schema's `consumer` field decides who asks: `skill` keys are prompted by the `install-global.sh` pass described in step 3; `installer` keys are asked in situ by the script that owns them (ROADMAP-005 Phase 2).

## Approach

**Preferences are not Claude Code settings.** `~/.claude/settings.json` is now guarded unconditionally by `claude-settings-guard.js` (TASK-027, hardened 2026-07-30), and it is Claude Code's own schema — adding bootstrap keys to it would be both blocked and wrong. Preferences get their own file. The guard covers `settings*.json` and `hooks/**` only, so a sibling file in `~/.claude/` is writable.

**Two levels, project wins.** The two motivating settings pull in opposite directions: version-bumping is a property of the *project* (a published library wants it; an app usually does not), while research-persistence is a personal habit that should carry across repos. Global file supplies defaults; a project file overrides per key.

~~**The project file must never be committed** (user requirement). It is a machine-local answer, not a team decision — the same reasoning that puts `.serena/`/`raw/`/`wiki/` in `.git/info/exclude` rather than `.gitignore`. It therefore lives at the repo root and is excluded via `.git/info/exclude`.~~

> **Superseded 2026-08-06.** The user asked for an explicit three-way choice instead: `prefs.gitTracking` = `.gitignore` / `.git/info/exclude` / neither, with `.git/info/exclude` remaining the sensible default. The reasoning above still holds for the *default*, but "never" is now "not unless you say so" — a team that wants shared answers can commit the file. The file also moves from the repo root to `<project>/.claude/`.

**Four states, not boolean.** Every key is `unset` / `true` / `false` / `ask`.

| State | Meaning | Who prompts, and when |
|---|---|---|
| `unset` | never answered | the **sync** prompts once, to settle it |
| `true` | always do it | nobody |
| `false` | never do it | nobody |
| `ask` | *"I want to be asked every time"* | the **skill**, at run time, every run — and it does **not** persist the answer |

`unset` and `ask` both produce a prompt, and conflating them is the trap: `unset` is an unanswered question the sync should settle, while `ask` is a settled answer whose content is "keep asking me". A user who picks `ask` must never be re-prompted *by the sync* to change it, and a user who picked `false` must never be re-prompted at all — otherwise a decline re-asks forever, which is the failure this design exists to avoid.

Consequently the sync prompt is **three-way** (yes / no / ask each time), not a yes-no. `prompt_yn` in `lib.sh` cannot express it; `prompt_scope` in the same file is the existing multi-choice precedent to follow.

**Prompt at sync, not on first skill run.** User-confirmed: the prompting belongs in `install-global.sh`, which already runs on `install`/`setup`/`update`. Skills only *read*. This keeps skill files declarative, avoids every skill re-implementing a prompt-and-persist dance, and means a user answers a short batch once rather than being interrupted mid-task.

## Steps

### 1. Decide and document where the project file is excluded  <!-- agent: general-purpose --> [x] SHIPPED BY ROADMAP-005 PHASE 1/2 — NOT IN SCOPE HERE

> Superseded and delivered elsewhere: `prefs.gitTracking` (TASK-046) replaced this binary choice with an explicit three-way `.gitignore` / `.git/info/exclude` / neither prompt in `merge-gitignore.sh`, and the files moved to `<project>/.claude/`. Retained below as the specification that decision came from. **Do not implement.**

**This is the one genuinely open design decision — resolve it first, because steps 2–4 depend on it.**

The sentinel block written by `merge-gitignore.sh` currently has a canonical form of **exactly** `.serena/`, `raw/`, `wiki/` in that order, enforced by `exclude_is_canonical` and repaired by `exclude_normalize` (TASK-029 step 6, 8 UAT cases). Adding a fourth entry is not a free change.

- [ ] Choose between the two viable options and record the choice plus reasoning in this task file before implementing:
  - **(a) Extend the sentinel block to four entries.** All bootstrap-owned exclusions stay in one place, and the existing normalizer repairs drift automatically. Cost: canonical form changes, so `exclude_is_canonical`, `exclude_normalize`, and the `UAT-EXCLUDE-*` cases in `test/file-suggestion.test.js` all need updating, and every already-normalized repo re-normalizes on next update (idempotent, prints the existing reorder line). Also means the `fileSuggestion` picker re-includes the prefs file in `@` autocomplete — harmless, arguably useful.
  - **(b) Write it as a standalone line outside the sentinel block.** No change to canonical form, no test churn; `exclude_normalize` preserves unrecognized lines verbatim so it survives repair. Cost: bootstrap-owned exclusions are now in two places, and a future reader may not know why that line is there without a comment.
  - **Recommendation: (a).** The split in (b) is the kind of thing that rots — someone normalizing later will not know the stray line is ours. Pay the test churn once.
- [ ] Whichever is chosen, the exclusion must be **idempotent** and must not require the user to have accepted the `.serena/`/`raw/`/`wiki/` exclude offer. A user who declined that offer still gets a preferences file, and it still must not be committed.

### 2. Build the preference store  <!-- agent: general-purpose --> [x] SHIPPED BY ROADMAP-005 PHASE 1 — NOT IN SCOPE HERE

> Delivered as `lib/scripts/bootstrap-prefs.js` + `lib/scripts/templates/bootstrap-prefs-schema.json` (TASK-040/041/042), under the reconciled filenames at the top of this file rather than the names written below. **Do not rebuild.**

- [ ] Create `lib/scripts/preferences.js` — zero-dependency Node, matching the style of `merge-settings-deny.js` (which is the precedent for "small JSON manipulator with `--target` test seams")
- [ ] File locations:
  - Global: `~/.claude/bootstrap-preferences.json`
  - Project: `<project>/.bootstrap-preferences.json`
- [ ] Shape — flat, namespaced keys, three storable values (`true`, `false`, `"ask"`):
  ```json
  { "gitCommit.autoVersionBump": true, "research.persistToRaw": "ask", "gitCommit.autoPush": false }
  ```
  A key that is absent is `unset` — the fourth state, and the only one with no on-disk representation. Do **not** write `null` or `"unset"`; absence is the representation, so a file never accumulates keys the user did not answer, and deleting a line is how you re-open a question.
- [ ] CLI surface, all exiting 0 on expected paths:
  - `--get <key> [--project <dir>]` → prints `true`, `false`, `ask`, or `unset`. Resolution order: project file → global file → `unset`
  - `--set <key> --value <true|false|ask> [--global|--project <dir>]` → writes atomically (tmp + rename), preserving indentation, creating the file if absent. Reject any other value with exit 1 — a typo'd value must not land in the file and silently read back as `unset`
  - `--unset <key> [--global|--project <dir>]` → removes the key, returning it to `unset` so the next sync re-asks. This is the documented way to change your mind about a `false`
  - `--list [--project <dir>]` → every known key with its resolved value and which layer supplied it
- [ ] **Fail safe on a malformed file** — warn on stderr, treat every key as `unset`, exit 0. This is read by skills and by a script running under `set -euo pipefail`; a corrupt prefs file must never break a commit or an install. Precedent: `merge-settings-deny.js`'s malformed-target handling
- [ ] Define the known-key registry in one place in this file, so `--list` and the sync prompts cannot drift from each other. Each entry carries: key, prompt text, default-if-declined, and a one-line description

### 3. Prompt during the skill sync  <!-- agent: general-purpose --> [x]

- [x] In `lib/scripts/install-global.sh`, after the `fileSuggestion` registration block, add a preferences pass that prompts **only for keys that are currently `unset`** — new **step 7** at `install-global.sh:156-250`, immediately after step 5's `fileSuggestion` block and the new step 6 below
- [x] The prompt is **three-way — yes / no / ask each time** — so `prompt_yn` is not sufficient. Follow `prompt_scope` in `lib.sh` as the multi-choice precedent, or add a small `prompt_choice` helper beside it if `prompt_scope` is too MCP-specific to reuse cleanly — added `prompt_letter_choice` at the **end** of `lib.sh` (first-letter resolver, the `prompt_scope` precedent). `prompt_choice_sticky` was deliberately **not** reused or refactored: it consults the store before prompting, and for a key with a non-null schema default that read can never return `unset`, so it would resolve to the default and return without ever asking
- [x] **Must be tty-guarded like its neighbours.** A non-interactive install must leave every key `unset` rather than silently answering. **Assert this**: a non-interactive run writes no preferences file at all — guarded **once for the whole pass** rather than per key, so an unattended run prints one note and never even reaches the read probe. Verified: no `bootstrap-prefs.json` is created
- [x] Prompt **only** for keys currently `unset`. A key already set to `false` or `ask` is a settled answer and must not be re-asked — verified across three consecutive runs

> **Step 6 added (not in the original plan, and required for step 4 to do anything).** Skills are installed to `~/.claude/skills/` and then run inside arbitrary projects, so they cannot reach `lib/scripts/bootstrap-prefs.js` the way the installer scripts do. A new step 6 copies the helper to `~/.claude/bootstrap-prefs.js` and its schema to `~/.claude/templates/bootstrap-prefs-schema.json` — the schema keeps its `<helper dir>/templates/` layout so a skill invokes the helper with no `--schema` flag and still gets validation and defaults. Same precedent and same directory as the step 5 file-suggestion picker.

> **The load-bearing discovery: `prefs_get` cannot detect `unset` for these keys.** Resolution falls through to the schema `default` after the files (`bootstrap-prefs.js:376`), and four of the five `consumer: skill` keys carry a non-null default (`auto`, `false`, `true`, `true`). A `prefs_get`-based "is this unanswered?" test therefore reports **every** one of them as settled, and the pass would silently ask nothing, forever, while the install looked clean. New `prefs_stored_global` in `lib.sh` reads `--list`'s `[layer]` column instead — the only surface that separates a stored answer (`[global]`) from a schema default (`[default]`) or absence (`[unset]`). It is read-only, so probing never materialises a values file.
- [x] Prompts are batched and each states the consequence, not just the name:
  - `gitCommit.autoVersionBump` — *"Should /git-commit bump the version in package.json automatically? (Say no for apps and private repos; yes for published packages.)"*
  - `research.persistToRaw` — *"Should /research save its reports to raw/research/ by default? (You can still decline any single report.)"*
  - `gitignore.offerSectionUpdates` — *"Should setup/update offer .gitignore section updates? (No means the gate added in TASK-029 stops asking entirely.)"*
  - `gitCommit.autoPush` — *"Should /git-commit push after committing? (Default no — this turns a local action into a published one.)"*
  - `uatGenerate.promoteTests` — *"Should /uat-generate write repeatable assertions into test/ automatically?"*
- [x] Prompts are **global-scope** at sync time (`--global`). Per-project overrides are set by hand or by a later skill; the sync script does not know which project the user means, and `install-global.sh` takes no project path
- [x] Print a closing line naming the file and how to change answers later, so a wrong answer is obviously recoverable — names the values file, its companion README, the `--set`/`--unset` commands, and `/bootstrap-config`; printed only when at least one question was actually asked

> **One refinement to the three-way prompt.** Each prompt offers a fourth option, `[s]kip for now`, which is also what a bare Enter or an EOF resolves to. `yes` / `no` / `ask` remain the three *answers*; `skip` is declining to answer, and it records nothing. Without it the default for an empty reply would have to be a real value, and a stray keystroke would settle a question permanently — the same "only record what was actually typed" rule the sticky helpers already enforce for the non-interactive case.

### 4. Wire the five consumers  <!-- agent: general-purpose --> [x]

**Every consumer handles all four states.** The shared contract, stated once so each site below only notes its exceptions:

| State | Consumer behavior |
|---|---|
| `true` | do it, no prompt |
| `false` | skip it, no prompt, and say so once in the summary rather than silently |
| `ask` | **prompt at run time, every run, and do not persist the answer** — the answer governs this run only |
| `unset` | keep today's behavior, and note once that the preference is unanswered and how to set it |

The `unset` row is the compatibility guarantee: **do not silently change behavior for a user who has never been prompted.** A user who upgrades and never runs the sync must see exactly what they see today.

**Every consumer reads with `--project .`** — all five keys are `scope: either`, so the answer must resolve project file → global file → schema default. Dropping the flag reads the machine-wide answer even in a repo that overrides it. A failed read (bootstrap never installed globally, or no `node`) degrades to `unset`, which is the compatibility-safe state for all five.

- [x] `lib/skills/git-commit/SKILL.md` — Step 4 (version bump) gated on ~~`gitCommit.autoVersionBump`~~ **`gitCommit.versionBump`**. New **Step 0** reads both keys once, before Step 1. Step 4 gains an `auto | confirm | never` table; the skill is told explicitly that there is no `ask` value because `confirm` *is* the ask state. `never` skips every manifest edit but **still writes the `[patch]`/`[minor]`/`[major]` subject prefix**, because release tooling reads it. `unset` behaves exactly as `auto`. Step 3's old "proceed immediately — no user confirmation needed" line now defers to the Step 4 gate
- [x] `lib/skills/git-commit/SKILL.md` — new **Step 6** push step after the commit, gated on `gitCommit.autoPush`. **`unset` means do not push.** The "never create a branch" rule is restated and unchanged; the push is additionally constrained to a bare `git push` (no `--force`, `--force-with-lease`, `-u`, `--all`, `--tags`, no remote or refspec) and a failure stops and reports rather than retrying with flags. New **Step 7** collects the once-per-run preference notes so they never appear inline
- [x] `lib/skills/research/SKILL.md` — Phase 5 gated on `research.persistToRaw`, **plus the per-run override**. The override is recognised from the invocation rather than prompted, which is what keeps it distinct from `ask`: `--no-save` / `--no-persist` / "don't save this one" beats a stored `true`; `--save` beats a stored `false`; neither is ever written to the store. Phase 6 gained a not-persisted branch that skips the `/wiki-ingest` suggestion (there is no `raw/` file to ingest) and rule 6 is now conditional on the gate. Rules 7 and 9 (never overwrite `raw/`; `raw/research/` only) are untouched
- [x] `lib/scripts/merge-gitignore.sh` — **already wired by TASK-046 (Phase 2) at `merge-gitignore.sh:158-177`; not re-wired here.** Verified end-to-end instead: a global `false` set by the new sync pass makes the section pass print `.gitignore: skipped entirely — no sections offered. (remembered answer gitignore.offerSectionUpdates=false …)`, and flipping it to `true` prints the opening-gate-off line with each section still offered by title. The `.git/info/exclude` block is outside the gate and was unaffected in both runs
- [x] `lib/skills/uat-generate/SKILL.md` — test promotion gated on `uatGenerate.promoteTests`, read **once per invocation** rather than per case. `false` still runs the promotability *analysis* and records `Skipped by preference (uatGenerate.promoteTests=false)` per case, writing nothing under `test/`; the UAT file and how verdicts are judged are never affected. `unset` keeps today's behavior (promote)

### 5. Tests and docs  <!-- agent: general-purpose --> [DEFERRED-TO-ROADMAP-005-PHASE-4]

> Owned by ROADMAP-005 Phase 4, not by this task. What already exists: `test/bootstrap-prefs.test.js` and `test/prompt-stickiness.test.js` (Phase 1/2) cover the store and the sticky helpers. What this task did touch in that file: the `PHASE_3_PENDING` allowlist is now **empty** — all four keys it exempted are wired, so the `schema -> scripts` bijection is live over the whole non-dynamic key set with nothing exempted. The three guards around it were kept, not deleted, so re-adding an entry stays expensive on purpose. The `lib/scripts/README.md` and `CLAUDE.md` rows below remain Phase 4's.

- [ ] New `test/preferences.test.js` (`node:test`, zero deps, `fs.mkdtemp` fixtures, cleaned up in `finally` — follow `test/settings-deny.test.js`): resolution order (project beats global beats unset), **all four states round-trip** including `ask`, `unset` is absence rather than `null` or `"unset"`, `--unset` returns a key to `unset`, an invalid `--value` exits 1 without writing, project `ask` overrides global `true`, atomic write preserves indentation, malformed file at either layer degrades to `unset` and exits 0, `--set` creates a missing file, `--list` reports the supplying layer
- [ ] **Pin the two states that both produce prompts, since conflating them is the design's central trap:** a key set to `ask` must be reported as `ask` (not `unset`) by `--get`, and the sync must prompt for `unset` while leaving `ask` and `false` untouched
- [ ] **Never target the real `~/.claude/bootstrap-preferences.json`** in any test — always `--target`/`--global` into a scratch dir
- [ ] Document in `lib/scripts/README.md` (new `preferences.js` row, and the `install-global.sh` row gains the prompt pass) and `CLAUDE.md`'s Key Files section
- [ ] Add a short **"Preferences"** section to `lib/hooks/README.md`'s sibling doc set or `lib/scripts/README.md` listing every known key, its default, and which skill reads it — one table, so the registry has a human-readable mirror
- [ ] `npm test` green; `bash -n` on `install-global.sh` and `merge-gitignore.sh`

### 6. Verify  <!-- agent: general-purpose --> [DEFERRED-TO-ROADMAP-005-PHASE-4]

> Owned by Phase 4. The first two bullets were nonetheless exercised while implementing step 3, against a scratch `HOME` and a scratch git project, never the real `~/.claude/`: a non-interactive run wrote no values file; a simulated-tty run settled `confirm` / `true` / `false` / `ask` and left a bare-Enter key unanswered; the next run re-asked **only** that unanswered key; the run after that asked nothing; and a project-layer `ask` beat a global `true`. `npm test` 264/264, 0 skipped. The third bullet (the project file's git treatment) is `prefs.gitTracking`'s, i.e. TASK-046's.

<!-- Updated: 2026-08-07 15:20 -->


- [ ] Hermetic end-to-end with `HOME` redirected to a scratch dir (precedent: TASK-029 step 5 proved `os.homedir()` follows a redirected `HOME`): fresh install prompts for all five, answers persist, a second install prompts for none
- [ ] Confirm a **non-interactive** install writes no preferences file and leaves every key `unset`
- [ ] Confirm the project file is excluded from git in a scratch repo — `git status --porcelain` must not list it
- [ ] **Do not run `install-global.sh` against the real `~/.claude/`** during verification
