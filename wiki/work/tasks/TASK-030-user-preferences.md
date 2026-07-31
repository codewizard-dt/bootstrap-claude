---
id: TASK-030
title: "User preferences: stop skills doing consequential things without consent"
status: todo
created: 2026-07-30
updated: 2026-07-30
depends_on: []
blocks: []
parallel_safe_with: []
uat: ""
tags: [preferences, skills, install-global, consent]
---

# TASK-030 — User preferences: stop skills doing consequential things without consent

## Objective

Introduce a preference store so skills stop taking consequential actions the user never agreed to. Two motivating cases: `/git-commit` bumps `package.json`'s version on every commit whether or not the project versions that way, and `/research` always writes its report into `raw/research/` whether or not the user wants it kept. Preferences are answered **once, during the skill sync** (`install-global.sh`), stored in a two-level file (global default, per-project override), and read by skills at run time. `/research` additionally gets a **per-run** override so a single report can be discarded without changing the default.

## Approach

**Preferences are not Claude Code settings.** `~/.claude/settings.json` is now guarded unconditionally by `claude-settings-guard.js` (TASK-027, hardened 2026-07-30), and it is Claude Code's own schema — adding bootstrap keys to it would be both blocked and wrong. Preferences get their own file. The guard covers `settings*.json` and `hooks/**` only, so a sibling file in `~/.claude/` is writable.

**Two levels, project wins.** The two motivating settings pull in opposite directions: version-bumping is a property of the *project* (a published library wants it; an app usually does not), while research-persistence is a personal habit that should carry across repos. Global file supplies defaults; a project file overrides per key.

**The project file must never be committed** (user requirement). It is a machine-local answer, not a team decision — the same reasoning that puts `.serena/`/`raw/`/`wiki/` in `.git/info/exclude` rather than `.gitignore`. It therefore lives at the repo root and is excluded via `.git/info/exclude`.

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

### 1. Decide and document where the project file is excluded  <!-- agent: general-purpose -->

**This is the one genuinely open design decision — resolve it first, because steps 2–4 depend on it.**

The sentinel block written by `merge-gitignore.sh` currently has a canonical form of **exactly** `.serena/`, `raw/`, `wiki/` in that order, enforced by `exclude_is_canonical` and repaired by `exclude_normalize` (TASK-029 step 6, 8 UAT cases). Adding a fourth entry is not a free change.

- [ ] Choose between the two viable options and record the choice plus reasoning in this task file before implementing:
  - **(a) Extend the sentinel block to four entries.** All bootstrap-owned exclusions stay in one place, and the existing normalizer repairs drift automatically. Cost: canonical form changes, so `exclude_is_canonical`, `exclude_normalize`, and the `UAT-EXCLUDE-*` cases in `test/file-suggestion.test.js` all need updating, and every already-normalized repo re-normalizes on next update (idempotent, prints the existing reorder line). Also means the `fileSuggestion` picker re-includes the prefs file in `@` autocomplete — harmless, arguably useful.
  - **(b) Write it as a standalone line outside the sentinel block.** No change to canonical form, no test churn; `exclude_normalize` preserves unrecognized lines verbatim so it survives repair. Cost: bootstrap-owned exclusions are now in two places, and a future reader may not know why that line is there without a comment.
  - **Recommendation: (a).** The split in (b) is the kind of thing that rots — someone normalizing later will not know the stray line is ours. Pay the test churn once.
- [ ] Whichever is chosen, the exclusion must be **idempotent** and must not require the user to have accepted the `.serena/`/`raw/`/`wiki/` exclude offer. A user who declined that offer still gets a preferences file, and it still must not be committed.

### 2. Build the preference store  <!-- agent: general-purpose -->

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

### 3. Prompt during the skill sync  <!-- agent: general-purpose -->

- [ ] In `lib/scripts/install-global.sh`, after the `fileSuggestion` registration block, add a preferences pass that prompts **only for keys that are currently `unset`**
- [ ] The prompt is **three-way — yes / no / ask each time** — so `prompt_yn` is not sufficient. Follow `prompt_scope` in `lib.sh` as the multi-choice precedent, or add a small `prompt_choice` helper beside it if `prompt_scope` is too MCP-specific to reuse cleanly
- [ ] **Must be tty-guarded like its neighbours.** `prompt_yn` (`lib.sh:167`) prints a skip notice and returns 1 without a tty; whatever you use must do the same. A non-interactive install must leave every key `unset` rather than silently answering. **Assert this**: a non-interactive run writes no preferences file at all
- [ ] Prompt **only** for keys currently `unset`. A key already set to `false` or `ask` is a settled answer and must not be re-asked — re-prompting a decline is precisely the annoyance this design exists to prevent. `--unset` is the documented way to re-open one
- [ ] Prompts are batched and each states the consequence, not just the name:
  - `gitCommit.autoVersionBump` — *"Should /git-commit bump the version in package.json automatically? (Say no for apps and private repos; yes for published packages.)"*
  - `research.persistToRaw` — *"Should /research save its reports to raw/research/ by default? (You can still decline any single report.)"*
  - `gitignore.offerSectionUpdates` — *"Should setup/update offer .gitignore section updates? (No means the gate added in TASK-029 stops asking entirely.)"*
  - `gitCommit.autoPush` — *"Should /git-commit push after committing? (Default no — this turns a local action into a published one.)"*
  - `uatGenerate.promoteTests` — *"Should /uat-generate write repeatable assertions into test/ automatically?"*
- [ ] Prompts are **global-scope** at sync time (`--global`). Per-project overrides are set by hand or by a later skill; the sync script does not know which project the user means, and `install-global.sh` takes no project path
- [ ] Print a closing line naming the file and how to change answers later, so a wrong answer is obviously recoverable

### 4. Wire the five consumers  <!-- agent: general-purpose -->

**Every consumer handles all four states.** The shared contract, stated once so each site below only notes its exceptions:

| State | Consumer behavior |
|---|---|
| `true` | do it, no prompt |
| `false` | skip it, no prompt, and say so once in the summary rather than silently |
| `ask` | **prompt at run time, every run, and do not persist the answer** — the answer governs this run only |
| `unset` | keep today's behavior, and note once that the preference is unanswered and how to set it |

The `unset` row is the compatibility guarantee: **do not silently change behavior for a user who has never been prompted.** A user who upgrades and never runs the sync must see exactly what they see today.

- [ ] `lib/skills/git-commit/SKILL.md` — Step 4 (version bump) gated on `gitCommit.autoVersionBump`. `unset` keeps today's behavior (bump)
- [ ] `lib/skills/git-commit/SKILL.md` — new push step after the commit, gated on `gitCommit.autoPush`. **`unset` means do not push** — today's behavior is never pushing, and defaulting an unanswered key to an outward-facing action would violate the rule above. Keep the existing "never create a branch" rule intact
- [ ] `lib/skills/research/SKILL.md` — Phase 5 (write output files) gated on `research.persistToRaw`, **plus a per-run override that exists even when the pref is `true`**. Requirement verbatim: the user must be able to say *don't save this specific one* AND *don't save by default*. Note that `ask` and the per-run override are different mechanisms serving the same need from opposite directions — `ask` prompts every time by standing choice; the override is an escape from a standing `true`. Both must work. When a report is not persisted, the findings still go in the response; only the file write is skipped
- [ ] `lib/scripts/merge-gitignore.sh` — the section gate added in TASK-029 consults `gitignore.offerSectionUpdates`. `false` skips the section pass without prompting; `ask` is equivalent to today's behavior (the gate prompts). **The `.git/info/exclude` block stays outside this**, exactly as it is today: declining `.gitignore` changes must not disable the sentinel repair
- [ ] `lib/skills/uat-generate/SKILL.md` — test promotion gated on `uatGenerate.promoteTests`; `unset` keeps today's behavior (promote)

### 5. Tests and docs  <!-- agent: general-purpose -->

- [ ] New `test/preferences.test.js` (`node:test`, zero deps, `fs.mkdtemp` fixtures, cleaned up in `finally` — follow `test/settings-deny.test.js`): resolution order (project beats global beats unset), **all four states round-trip** including `ask`, `unset` is absence rather than `null` or `"unset"`, `--unset` returns a key to `unset`, an invalid `--value` exits 1 without writing, project `ask` overrides global `true`, atomic write preserves indentation, malformed file at either layer degrades to `unset` and exits 0, `--set` creates a missing file, `--list` reports the supplying layer
- [ ] **Pin the two states that both produce prompts, since conflating them is the design's central trap:** a key set to `ask` must be reported as `ask` (not `unset`) by `--get`, and the sync must prompt for `unset` while leaving `ask` and `false` untouched
- [ ] **Never target the real `~/.claude/bootstrap-preferences.json`** in any test — always `--target`/`--global` into a scratch dir
- [ ] Document in `lib/scripts/README.md` (new `preferences.js` row, and the `install-global.sh` row gains the prompt pass) and `CLAUDE.md`'s Key Files section
- [ ] Add a short **"Preferences"** section to `lib/hooks/README.md`'s sibling doc set or `lib/scripts/README.md` listing every known key, its default, and which skill reads it — one table, so the registry has a human-readable mirror
- [ ] `npm test` green; `bash -n` on `install-global.sh` and `merge-gitignore.sh`

### 6. Verify  <!-- agent: general-purpose -->

- [ ] Hermetic end-to-end with `HOME` redirected to a scratch dir (precedent: TASK-029 step 5 proved `os.homedir()` follows a redirected `HOME`): fresh install prompts for all five, answers persist, a second install prompts for none
- [ ] Confirm a **non-interactive** install writes no preferences file and leaves every key `unset`
- [ ] Confirm the project file is excluded from git in a scratch repo — `git status --porcelain` must not list it
- [ ] **Do not run `install-global.sh` against the real `~/.claude/`** during verification
