---
id: TASK-041
aliases: [TASK-041]
title: "bootstrap-prefs.js — four-state preference helper"
status: done
created: 2026-08-06
updated: 2026-08-06
part_of: ROADMAP-005
depends_on: [TASK-040]
blocks: [TASK-042]
parallel_safe_with: [TASK-031, TASK-039]
uat: "[[UAT-041]]"
tags: [prefs, install, consent, node, roadmap-005]
---

# TASK-041 — bootstrap-prefs.js — four-state preference helper

part_of::[[ROADMAP-005]]

## Objective

Build `lib/scripts/bootstrap-prefs.js`: a zero-dependency Node helper that reads and writes the two preference values files — `~/.claude/bootstrap-prefs.json` (global) and `<project>/.claude/bootstrap-prefs.json` (project). It implements the four-state model (`unset` / a settled value / `false` / `ask`, where **absence is `unset`** and `null` is never written), resolves project → global → schema default → `unset` according to each key's `scope`, writes atomically, degrades to `unset` rather than failing when a file is malformed, and regenerates a `bootstrap-prefs.README.md` companion beside every file it writes. Every later phase of ROADMAP-005 — the sticky shell prompts, the skill consumers, and `/bootstrap-config` — goes through this one binary.

## Approach

**Sibling of `merge-settings-deny.js`, not a fork of it.** That file is the repo's precedent for "small zero-dependency JSON manipulator with a `--target` test seam", and this one copies its posture verbatim: `parseArgs`, `warnSkip` (stderr warning + `exit(0)`), `readTarget` returning `null` for a missing file, `detectIndent` reusing tabs-or-N-spaces, and `writeSettings`'s `${file}.tmp-${process.pid}` → `renameSync` with `unlinkSync` cleanup in the catch. Read it first and mirror its shape.

But **`merge-settings-deny.js --set-key` is deliberately not reused.** It has no read mode, and its never-clobber rule (`:133-145`) makes flipping a stored `true` → `false` impossible. That rule is right for a settings deny list — where the user's own edits must survive a merge — and wrong for preferences, where changing your mind is the entire point.

**Exit codes encode *whose* fault it is.** This is the single most load-bearing decision in the file, because these calls run inside `set -euo pipefail` shell scripts and inside a `/git-commit` run:

- **`exit 0` — the world is in an unexpected state.** Missing file, malformed JSON, unknown key on read, key not set. A corrupt prefs file must never abort an install or block a commit. Every read path exits 0, so no call site needs `|| true`.
- **`exit 1` — the caller is wrong.** An invalid `--value` for the key's grammar, an unknown flag, `--set` without `--value`, a write with no layer selector. These are bugs in a calling script, surfaced at development time, and aborting loudly is correct. A typo'd value must never land in the file and read back later as `unset`.

**CLI surface** — reconciling the plan's `--target`/`--resolve` form with TASK-030's `--global`/`--project` form. Both are kept, with distinct jobs:

```
node lib/scripts/bootstrap-prefs.js --get   <key> [--project <dir>] [--global] [--target <path>]
node lib/scripts/bootstrap-prefs.js --set   <key> --value <v> (--global | --project <dir> | --target <path>)
node lib/scripts/bootstrap-prefs.js --unset <key>             (--global | --project <dir> | --target <path>)
node lib/scripts/bootstrap-prefs.js --list  [--project <dir>] [--target <path>]
```

- `--global` and `--project <dir>` are **semantic layer selectors**, resolving to `~/.claude/bootstrap-prefs.json` and `<dir>/.claude/bootstrap-prefs.json`.
- `--target <path>` is an **explicit single file**, bypassing layer resolution entirely. It is the test seam — the repo's established name for one — and doubles as the escape hatch for reading exactly one layer.
- **On `--get`, resolution is the default, not a flag.** The plan proposed a separate `--resolve` mode; that is rejected. Forgetting the flag would silently return `unset` and cause a re-prompt — the exact failure this roadmap exists to remove — and every real caller wants the resolved value. `--global` or `--target` narrows to one file when you specifically need to know *which layer* holds a value; `--project <dir>` supplies the project directory and resolution still runs.
- **On `--set`/`--unset`, a layer selector is mandatory.** Guessing which file to write is unrecoverable in a way that guessing which to read is not.

**Resolution order is `scope`-constrained, not universal.** Read the key's schema `scope` first:

| `scope` | Layers consulted, in order |
|---|---|
| `either` | project → global → schema `default` → `unset` |
| `global` | global → schema `default` → `unset` (**never** reads the project file) |
| `project` | project → schema `default` → `unset` (**never** reads the global file) |

A `global`-scope key sitting in a project file is not consulted and is reported as unrecognized-for-this-layer by the companion README. Silently honoring it would make a machine-wide answer overridable per checkout, which several installer keys are not designed for.

**Value coercion — the tokens `true` and `false` become JSON booleans; everything else becomes a JSON string.** So `--value false` writes `false`, and `--value ask` writes `"ask"`. This matches the plan's example file (`"mcp.braveSearch": false`) and TASK-030's (`"research.persistToRaw": "ask"`). Getting this wrong in the obvious way — storing `"false"` as a string — produces a value that is truthy in every shell test and reads back as a settled `true`. Pin it in TASK-042.

**`--value unset` and `--value null` are rejected with exit 1**, pointing the caller at `--unset`. Not aliased: a script that captures `--get` output and feeds it back would otherwise delete the key, and `null` is the representation the four-state model specifically forbids on disk.

**Validation comes from the schema's `values` string.** Split on `|`, trim, compare. No second copy of any value list lives in this file — that is the whole reason TASK-040 exists. A key whose grammar is a single value (`gitignore.section.*` → `false`) therefore enforces the `.gitignore` declines-only invariant for free, with no call-site cooperation.

**An unknown key on `--set` warns on stderr but is written, exiting 0.** Forward compatibility: a values file written by a newer bootstrap must round-trip through an older helper unchanged, and refusing unknown keys would break that. Invalid *values* are the thing that must hard-fail, not unfamiliar *keys*.

**Wildcard schema lookup** — exact key first, then any `dynamic: true` entry whose pattern matches (single trailing `*` segment). `guides.evals-framework.md` matches `guides.*`; `gitignore.section.node-typescript-javascript` matches `gitignore.section.*`.

**A malformed file blocks writes rather than being overwritten.** On read it degrades to empty with a stderr warning and resolution continues to the next layer. On `--set`/`--unset` it warns and exits **0 without writing** — the `warnSkip` posture. Clobbering a file the user may have hand-edited into invalidity would destroy answers to recover a machine convenience. The warning must name the file and say to fix or delete it, otherwise this silently swallows every subsequent write.

**The companion is output, never input.** `bootstrap-prefs.README.md` is regenerated beside the values file on every successful `--set`/`--unset`, **including a no-op set** (the schema may have changed since the last write). It is written through the same atomic path, its header states that hand edits are overwritten, and a values-file key with no schema entry appears under an `## Unrecognized keys` heading rather than being dropped. It is covered by `prefs.gitTracking` alongside the values file, so it must always sit in the same directory.

## Steps

### 1. Read the precedent  <!-- agent: general-purpose -->

- [x] Read `lib/scripts/merge-settings-deny.js` in full — specifically `parseArgs` (`:30`), `warnSkip` (`:46`), `readTarget` (`:69`), `parseSettings` (`:78`), `detectIndent` (`:93`), `writeSettings` (`:100`)
- [x] Note whether it carries a `#!/usr/bin/env node` shebang and an executable bit, and match it exactly — call sites invoke it as `node <path>`, and diverging here creates a silent inconsistency in how `install-global.sh` may call the new file
- [x] Read `lib/scripts/merge-settings-hooks.js` for how a second consumer of a `templates/*.json` file locates it (`path.join(__dirname, 'templates', ...)`), and use the same form so the helper works from any cwd

### 2. Build the argument layer  <!-- agent: general-purpose -->

- [x] Create `lib/scripts/bootstrap-prefs.js` with a `parseArgs(argv)` modelled on the precedent
- [x] Recognize exactly: `--get <key>`, `--set <key>`, `--unset <key>`, `--list`, `--value <v>`, `--global`, `--project <dir>`, `--target <path>`, `--schema <path>` (test seam for the schema file itself, defaulting to `path.join(__dirname, 'templates', 'bootstrap-prefs-schema.json')`)
- [x] Exit 1 with a usage message on: an unknown flag, more than one of `--get`/`--set`/`--unset`/`--list`, no operation at all, `--set` without `--value`, `--value` without `--set`
- [x] Exit 1 when `--set`/`--unset` is given none of `--global` / `--project <dir>` / `--target <path>`
- [x] Exit 1 when more than one layer selector is given to `--set`/`--unset`
- [x] Resolve paths: `--global` → `path.join(os.homedir(), '.claude', 'bootstrap-prefs.json')`; `--project <dir>` → `path.join(dir, '.claude', 'bootstrap-prefs.json')`; `--target` used verbatim
  - `os.homedir()` follows a redirected `HOME`, proven by TASK-029 step 5 — that is what makes hermetic testing possible, so do not read `process.env.HOME` directly

### 3. Load and index the schema  <!-- agent: general-purpose -->

- [x] Read and `JSON.parse` the schema from `--schema` (default `templates/bootstrap-prefs-schema.json`)
- [x] **A missing or malformed schema is a `warnSkip` (stderr warning, exit 0), not a crash.** The schema ships in the tarball, but a partial install must not break a `/git-commit`. With no schema: no validation, no defaults, no `--list` descriptions — `--get` still resolves from the files and `--set` still writes. Say this in the warning
- [x] Implement `lookupSchema(key)` — exact match first; then scan entries with `dynamic: true` whose key ends in `.*`, matching on the literal prefix. Return `null` if neither matches
- [x] Implement `allowedValues(entry)` — `entry.values.split('|').map(s => s.trim())`. No hard-coded value list anywhere in this file

### 4. Implement reads  <!-- agent: general-purpose -->

- [x] `readLayer(file)` — missing file returns `{}`; unreadable or unparseable returns `{}` **after** a stderr warning naming the file; never throws
- [x] `--get <key>`:
  - With `--target` or `--global`: read that one file only
  - Otherwise: resolve by the key's schema `scope` per the table in *Approach*, using `--project <dir>` for the project layer (skip the project layer entirely if no `--project` was given)
  - Fall through to the schema `default` when it is not `null`, then to `unset`
  - Print exactly one line: `true`, `false`, or the string value, or `unset`. **Print the literal word `unset`, not an empty line** — an empty capture is indistinguishable from a crashed script, and a shell caller would treat it as a decline
  - Exit 0 always
- [x] `--list`:
  - Print every schema key with its resolved value and **which layer supplied it** (`project`, `global`, `default`, or `unset`), plus the entry's `summary`
  - Group by `consumer`, and mark `consumer: "skill"` rows as behavior-changing — `/bootstrap-config` relies on that distinction to warn more heavily
  - Append any key present in a values file but absent from the schema under an `unrecognized` heading
  - Without `--project`, list the global layer only and say so in a footer line
  - Exit 0 always

### 5. Implement writes  <!-- agent: general-purpose -->

- [x] `--set <key> --value <v>`:
  - Reject `unset` and `null` as values — exit 1, message naming `--unset` as the correct operation
  - Look up the schema entry. If found, reject any value outside `allowedValues(entry)` — exit 1, listing the legal values, **without writing anything**
  - If not found, warn on stderr that the key is unrecognized and continue
  - Coerce: `'true'` → `true`, `'false'` → `false`, anything else → the string verbatim
  - If the target file exists but is malformed: `warnSkip` (exit 0, no write)
  - `mkdirSync(path.dirname(file), { recursive: true })`, then atomic tmp + `renameSync`, indentation from `detectIndent` on the existing text (default 2 spaces), trailing newline
  - **Never write a `null` value and never materialize a key that was not explicitly set** — the schema `default` is metadata for resolution only. Writing defaults would convert unanswered questions into settled answers and permanently suppress their prompts, which is the exact bug ROADMAP-005 exists to fix
- [x] `--unset <key>` — delete the key if present, write atomically; a key that was already absent is a success, not an error (exit 0, message says so). This is the documented way to re-open a question
- [x] Regenerate the companion after every successful `--set`/`--unset`, **including when the value was unchanged**

### 6. Generate the companion README  <!-- agent: general-purpose -->

- [x] `writeCompanion(valuesFile, layerName)` writes `bootstrap-prefs.README.md` in the same directory, through the same atomic tmp + rename path
- [x] Header: what the file is, that it is **generated on every write and hand edits are overwritten**, which values file it describes, and the timestamp
- [x] A `| Key | Current value | Layer | What it does | Asked by |` table covering every schema key whose `scope` permits this layer, sorted with `consumer: "skill"` keys in their own section under a heading that says changing them changes what a command does
- [x] An `## Unrecognized keys` section listing values-file keys with no schema entry — present but not explained. Never drop them
- [x] A closing line naming the exact `--unset` command to re-open a question, and pointing at `/bootstrap-config`
- [x] The companion never contains a secret, because no schema key holds one — but state the rule in the header so a future key author sees it

### 7. Verify  <!-- agent: general-purpose -->

Formal tests are TASK-042; this step is the smoke pass that proves the file works before tests are written against it.

- [x] `node --check lib/scripts/bootstrap-prefs.js`
- [x] Against a `fs.mkdtemp` scratch dir via `--target`, exercise by hand: set → get → list → unset → get. Confirm the round trip and that the final `--get` prints `unset`
- [x] Confirm the written file is parseable by plain `JSON.parse` with **zero** preprocessing, and contains no `null` values
- [x] Confirm an invalid `--value` exits 1 and leaves the file byte-identical
- [x] Confirm a malformed target degrades to `unset` on `--get` (exit 0) and refuses to write on `--set` (exit 0, file untouched)
- [x] Confirm no `.tmp-*` residue remains in the scratch dir after any operation, including the failure paths
- [x] Confirm `bootstrap-prefs.README.md` appears beside the values file and lists the set key with its current value
- [x] **Never run this against the real `~/.claude/bootstrap-prefs.json`.** Always `--target` into a scratch dir, or redirect `HOME`
- [x] `npm test` still green — this task adds no test, so the count must be unchanged

## Notes

<!-- Updated: 2026-08-06 -->

### Implementation record (2026-08-06)

Built as specified. Three departures from the text above, all deliberate:

1. **Added `--section-key <title>`** — a fifth operation, printing `gitignore.section.<slug>` for a `.gitignore` banner title. Not in the task file; added to act on a finding handed over from TASK-040. `lib/scripts/templates/gitignore` carries the title `Claude Code — machine-local MCP registration (absolute paths; regenerated by setup)`, which contains an **em dash (U+2014)**. A byte-wise `[^a-z0-9]` slugifier (the obvious `sed`/`tr` implementation in shell) sees that one character as three UTF-8 bytes and, without a squeeze step, emits three dashes — producing a key that does not match the one the schema documents, so a remembered decline silently stops matching and the prompt re-asks forever. Putting the slug rule in this helper gives it exactly one implementation, and JS regex with the `u` flag is Unicode-aware by construction. Phase 2's `merge-gitignore.sh` should shell out to `--section-key` rather than reimplement the rule in `awk`/`sed`.
2. **Added `test/bootstrap-prefs.test.js` (4 tests)** — step 7 said "this task adds no test, so the count must be unchanged". Overridden to cover the em-dash slug case above, per the same handover. The file is deliberately scoped to the slugifier only, with a header comment saying so; **TASK-042 should extend this file** rather than create a second one. Suite went 144 → 148, all passing.
3. **Companion `## Unrecognized keys` now also lists scope-inert keys.** *Approach* asks for a global-scope key parked in a project file to be "reported as unrecognized-for-this-layer by the companion README", while step 6 describes that section as "values-file keys with no schema entry". A first pass implemented only the second reading, which dropped scope-inert keys entirely — the exact silent-drop the section exists to prevent. Both are now listed, each with a reason (`no entry in the preference schema` vs ``scope is `global` — this layer never consults it, so it has no effect here``).

Two smaller judgment calls worth knowing about:

- **`--unset` on a values file that does not exist creates nothing** — it prints `was already unset (no preferences file at <path>)` and exits 0. Materializing an empty `{}` plus a companion README for a question nobody has ever answered is noise, and the file's absence is already the correct state.
- **The schema `default` fallthrough applies to narrowed reads too** (`--get --global`, `--get --target`), following the literal step-4 ordering. So a narrowed `--get` answers "what would this layer's resolution produce", not "does this exact file hold the key". `--list` is the tool that names the supplying layer.

### Phase 2 hand-off: `mcp.playwrightConflict` needs a name→branch mapping

`mcp.playwrightConflict`'s values are `shared | alongside | skip` — **names for menu options 1/2/3**, deliberately stored by name so the meaning survives a menu reorder. `install-mcps.sh:415` only reads the raw digits. This helper stores and returns the names and knows nothing about the menu, so **Phase 2 must add an explicit name→branch mapping at the call site** (`shared`→1, `alongside`→2, `skip`→3) rather than feeding the stored value into the digit comparison. Feeding a name straight in would fall through every branch and silently behave like `skip`. Not solved here by design — this helper has no concept of a menu.

- **Blocked on TASK-040**: the schema file must exist first. The `--schema` seam means TASK-042 can point at fixtures, but the default path must resolve to the real template.
- **Deferred to Phase 4**: the `lib/scripts/README.md` helper row, the `CLAUDE.md` Key Files entry, and pinning `bootstrap-prefs.js` into `test/npm-pack-contents.test.js`.
- **Phase 2 consumes this**, not the other way round: `prompt_yn_sticky` / `prompt_choice_sticky` in `lib.sh` shell out to `--get` and `--set`. Their load-bearing rule — only record an answer that was actually asked interactively — lives in `lib.sh`, not here. This helper writes whatever it is told to; it has no concept of a tty.
- **`package.json` `files`** already ships `lib/`, so no manifest change is needed; verify with `npm pack --dry-run` rather than assuming.
