---
id: TASK-050
title: "Document the helper, the four-state model, and the full key registry in lib/scripts/README.md"
status: done
created: 2026-08-07
updated: 2026-08-07
part_of: ROADMAP-005
depends_on: []
blocks: [TASK-052]
parallel_safe_with: [TASK-049, TASK-051]
uat: "[[UAT-050]]"
tags: [prefs, docs, roadmap-005]
---

# TASK-050 — Document the helper, the four-state model, and the full key registry in lib/scripts/README.md

part_of::[[ROADMAP-005]]

## Objective

`lib/scripts/README.md` documents every other script in the directory, but ROADMAP-005 Phases 1–3 added `bootstrap-prefs.js` and a whole preference subsystem without it. The file currently has a `## Preference-schema notes` section covering the *schema file's shape*, and nothing covering the **helper**, the **four-state model**, the **two values files**, or **what the 19 individual keys actually do**. Worse, two sentences in it are now factually wrong — one calls the helper "not built yet".

This task closes that gap: document `bootstrap-prefs.js` in the helpers table, document the installed `~/.claude/` layout that `install-global.sh` steps 6–7 create, add the four-state model, and add the full 19-key registry table that the file itself says is missing.

**This task owns `lib/scripts/README.md` exclusively.** It does not touch `lib/skills/README.md` or `CLAUDE.md` (TASK-049) or `test/npm-pack-contents.test.js` (TASK-051).

## Approach

**Two sentences in the existing file are stale and must be corrected, not appended around.** Both are load-bearing claims a reader would act on:

1. `lib/scripts/README.md:54` — the `templates/bootstrap-prefs-schema.json` row's "Read/copied by" cell reads **`bootstrap-prefs.js` (not built yet)**. It was built in TASK-041 and is now also installed into `~/.claude/`. Drop the parenthetical and add the sync pass in `install-global.sh` as a reader.
2. `lib/scripts/README.md:124-125` — *"(The human-readable table of what each individual key does is separate and is not in this file yet.)"* This task is what makes that false. Replace it with a pointer to the new registry section.

**`install-global.sh` gained two steps and the MCP step renumbered.** The current step list is:

| Step | What it does |
|---|---|
| 1 | Install hooks → `~/.claude/hooks/` |
| 2 | Install skills → `~/.claude/skills/` |
| 3 | Merge deny list → `~/.claude/settings.json` |
| 4 | Merge hooks wiring → `~/.claude/settings.json` |
| 5 | Install file-suggestion picker → `~/.claude/file-suggestion.sh` |
| **6** | **Install the preference helper** (`install-global.sh:126-153`) |
| **7** | **Settle skill-consent preferences** — the sync pass (`install-global.sh:155+`) |
| **8** | MCPs (renumbered from 6; last and guarded) |

**The installed layout is the reason the helper works with no `--schema` flag.** Step 6 puts the helper at `~/.claude/bootstrap-prefs.js` and the schema at `~/.claude/templates/bootstrap-prefs-schema.json` — i.e. `<helper dir>/templates/`, which is exactly where the helper's default schema resolution looks. That is what makes `consumer: skill` keys readable from an arbitrary project with no flags, and it is the single most useful fact for anyone writing a new consumer. Document the layout explicitly.

**The final summary line is stale, and updating it means updating two test pins — deliberately.** `install-global.sh:263` still reads:

```
Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + MCPs).
```

It names six steps; there are now eight. The string is pinned **twice** in `test/install-global.test.js` — at `:152` and `:267` — as exact `stdout.includes(...)` matches.

**This task's call:** update the line to name the two new steps, and update both pins in the same change. Do not leave the line stale (it is documentation that the summary is complete, and it is now wrong), and do not update the line without the pins (the suite goes red). Suggested wording, keeping the existing style:

```
Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + preferences + MCPs).
```

Two pins, one string, one edit each. If the wording changes from the suggestion, both pins must match it exactly.

> **Open question to resolve and record in this task's Notes** — the schema's `askedBy` for `gitCommit.versionBump` and `gitCommit.autoPush` is `/git-commit`, but the **settling** prompt now lives in `install-global.sh`'s step 7 sync pass; the skill only prompts in the `confirm` / `ask` states. The other three `consumer: skill` keys (`research.persistToRaw`, `uatGenerate.promoteTests`, `gitignore.offerSectionUpdates`) all say `askedBy: install-global.sh`, so the two `gitCommit.*` keys are the odd ones out. Decide whether `askedBy` should name both (e.g. `install-global.sh, /git-commit`) and **record the decision and its reasoning** — including "leave it alone" if that is the answer. Note that `askedBy` is asserted to be a non-empty string by `test/bootstrap-prefs.test.js:2128`, but its *content* is unconstrained, so either answer passes the suite. If the value changes, this task changes the schema string too; if it does not, the README must explain why the two differ, because the inconsistency will otherwise read as a bug to the next reader.

**Registry table: 19 keys, generated from the schema, not retyped.** Read the schema and transcribe; do not hand-write from memory. The 19 keys, with the three axes that matter:

- `scope: project` (9): `mcp.serenaMigrate`, `mcp.serena`, `mcp.playwrightConflict`, `mcp.playwrightReplace`, `update.legacyDocsAck`, `gitignore.infoExclude`, `prefs.gitTracking`, `guides.*` (dynamic), `gitignore.section.*` (dynamic)
- `scope: global` (5): `mcp.braveSearch`, `mcp.context7`, `mcp.context7Scope`, `mcp.playwright`, `skills.pruneOrphans`
- `scope: either` (5) — and **all five are the `consumer: skill` population**: `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests`, `gitignore.offerSectionUpdates`

The other 14 are all `consumer: installer`. Only the five `either`/`skill` keys carry a non-null `default` (`auto`, `false`, `true`, `true`, `true`); all 14 installer keys default to `null`, meaning they resolve to `unset` until answered.

## Steps

### 1. Read the current state before editing <!-- agent: general-purpose -->

- [x] Read `lib/scripts/README.md` in full — particularly the `## Shared helpers and internal scripts` table (lines 21–30), the `templates/` table row at line 54, and the whole `## Preference-schema notes` section (lines 119–197).
- [x] Read `lib/scripts/bootstrap-prefs.js` — the `USAGE` block (line ~59), `parseArgs`, `resolve` (`:353-379`), `loadSchema` / default schema path resolution, and `writeCompanion` / `renderCompanion`.
- [x] Read `lib/scripts/install-global.sh:126-250` — steps 6 and 7, including the `has_tty` gate and what the non-interactive branch does (installs the helper, writes **no** preferences file).
- [x] Read `lib/scripts/templates/bootstrap-prefs-schema.json` in full and transcribe all 19 entries for step 5's table.

### 2. Add `bootstrap-prefs.js` to the helpers table <!-- agent: general-purpose -->

- [x] `Edit` the `## Shared helpers and internal scripts` table, adding a row after `merge-settings-hooks.js` (line 30) — it is the closest neighbour, being the other zero-dependency Node helper reading a `templates/` canonical file.
- [x] "Used by" is: `install-global.sh`, `install-mcps.sh`, `sync-wiki-scaffold.sh`, `merge-gitignore.sh`, `update-project.sh` (via `lib.sh` wrappers), and `/bootstrap-config`.
- [x] Purpose cell must state: zero-dependency Node; five operations (`--get`, `--set`, `--unset`, `--list`, `--section-key`); `--set`/`--unset` require **exactly one** layer selector (`--global` / `--project <dir>` / `--target <path>`) and will not guess; atomic writes preserving indentation; regenerates the `bootstrap-prefs.README.md` companion beside every values file it writes.

### 3. Correct the two stale sentences <!-- agent: general-purpose -->

- [x] `Edit` line 54's "Read/copied by" cell: remove `(not built yet)` and list the real readers — `bootstrap-prefs.js` (default schema resolution), `install-global.sh`'s step 7 sync pass, the installer prompt sites, and `/bootstrap-config`.
- [x] `Edit` lines 124–125: replace *"(The human-readable table of what each individual key does is separate and is not in this file yet.)"* with a pointer to the new registry section added in step 5.

### 4. Add a `## Preference helper notes` section <!-- agent: general-purpose -->

Place it **before** the existing `## Preference-schema notes` — the helper is the thing a reader meets first; the schema's shape contract is the deeper reference. Cover, as subsections:

- [x] **Two values files, project wins per key.** `~/.claude/bootstrap-prefs.json` and `<project>/.claude/bootstrap-prefs.json`. Resolution is `project → global → schema default → unset`, and it is **scope-constrained**: `resolve()` only walks the layers a key's `scope` permits. `--list`/`--get` consult the project layer **only** when `--project <dir>` is passed; omitting it silently shows global-only, and the helper says so in its closing line.
- [x] **The four-state model.** Spell out all four and why the distinction exists:
  - `unset` — **absence from the file is the entire representation.** `null` and the string `"unset"` are never written; `--set --value unset` exits 1 and points at `--unset`.
  - a settled value — the answer, never re-asked.
  - `false` — a remembered **decline**. Not the same as `unset`. This is the state that fixes ROADMAP-005's original complaint: stickiness previously came from side effects, which is one-directional (accepting stops the prompt, declining does not).
  - `ask` — stored, and means *"keep prompting me, do not persist"*. Note the grammar exception: `gitCommit.versionBump` expresses this as **`confirm`**; it has no separate `ask` and offering one is a hard failure.
- [x] **The installed layout.** After `install-global.sh` step 6: helper at `~/.claude/bootstrap-prefs.js`, schema at `~/.claude/templates/bootstrap-prefs-schema.json`. State plainly that the schema sits at `<helper dir>/templates/` **because that is the helper's default resolution path** — so the installed copy works with no `--schema` flag, which is what makes `consumer: skill` keys readable from an arbitrary project. `--schema` is only for a non-default schema (chiefly a test seam).
- [x] **The generated companion.** Every successful `--set`/`--unset` rewrites `bootstrap-prefs.README.md` beside the values file. It is generated output; hand edits are overwritten without warning. Its `## Unrecognized keys` section is the forward-compatibility surface — and today it is also the **only** place a scope-inert key is visible (see `[[BUG-0009]]`).
- [x] **No preference key ever holds a secret.** No API key, token, or password belongs in a values file or the schema — the same warning the generated companion carries. State it as a rule for anyone adding a key.
- [x] Cross-reference `[[BUG-0009]]`: `--set` enforces a key's **value grammar** but not its **`scope`**, so a `global`-scope key can be written into a project file where nothing reads it. Document it as known and filed, not as intended behaviour.

### 5. Add the full 19-key registry table <!-- agent: general-purpose -->

- [x] Add a `### The key registry — all 19 entries` subsection under `## Preference-schema notes`, transcribed from `templates/bootstrap-prefs-schema.json`.
- [x] Columns: `Key` | `Scope` | `Consumer` | `Values` | `Default` | `Asked by` | `What it does` (the schema's `summary`). Escape the `|` inside every `values` string as `\|` — nearly every row contains one, and an unescaped pipe silently splits the cell.
- [x] Group the table by `consumer` — `installer` (14) then `skill` (5) — matching how `--list` and the generated companion group their output, so all three surfaces read the same way.
- [x] Mark the two `dynamic: true` patterns (`guides.*`, `gitignore.section.*`) as patterns rather than keys, and point at the existing wildcard/slug rules already documented at lines 147–165 rather than restating them.
- [x] Note that all 14 `installer` keys have `default: null` (they resolve to `unset` until answered) while all five `skill` keys carry a real default — which is why `prefs_get` alone cannot detect "unanswered" for a skill key, and why step 7's sync pass uses a stored-vs-default check instead.

### 6. Resolve and record the `askedBy` open question <!-- agent: general-purpose -->

- [x] Decide whether `gitCommit.versionBump` and `gitCommit.autoPush` should keep `askedBy: /git-commit`, or name both the settling prompt and the run-time prompt.
- [x] Record the decision **and its reasoning** in a `## Notes` section at the end of this task file — including if the answer is "leave it".
- [x] If the decision is to change it: edit those two `askedBy` strings in `lib/scripts/templates/bootstrap-prefs-schema.json`, and make the new registry table match. `test/bootstrap-prefs.test.js:2128` only requires a non-empty string, so no test needs changing either way.
- [n/a] If the decision is to leave it: add one sentence to the registry section explaining why these two differ from the other three skill keys, so the inconsistency does not read as a defect. — **not taken**; the decision was to change, so this branch does not apply. A `### Why every consumer: skill key says install-global.sh` subsection was added anyway, because the change itself needs a rationale on record.

### 7. Update the stale summary line and both test pins <!-- agent: general-purpose -->

- [x] `Edit` `lib/scripts/install-global.sh:263` to name all the steps actually run, e.g.:
  ```
  Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + preferences + MCPs).
  ```
- [x] `Edit` `test/install-global.test.js:152` and `test/install-global.test.js:267` to match the new string **exactly**. Both are `stdout.includes(...)` on the full sentence; a partial update leaves one red.
- [x] Change all three in the same commit. These pins exist to catch an accidental drift; this is a deliberate one, and updating them is this task's stated call.

### 8. Verify <!-- agent: general-purpose -->

- [x] Run `npm test` — expect 0 failures. If either `install-global` pin is red, step 7 was applied incompletely.
- [x] Confirm every one of the 19 registry rows matches `templates/bootstrap-prefs-schema.json` field-for-field. A drifted doc table is worse than none: it is the surface a reader trusts instead of opening the JSON.
- [x] Confirm no markdown table row is broken by an unescaped `|` from a `values` string — check the `Values` column of every row, especially `mcp.playwrightConflict` (`shared \| alongside \| skip`) and `prefs.gitTracking` (`gitignore \| exclude \| neither`).
- [x] Confirm the phrase "not built yet" no longer appears anywhere in `lib/scripts/README.md`.
- [x] Do **not** edit `lib/skills/README.md`, `CLAUDE.md` (TASK-049), or `test/npm-pack-contents.test.js` (TASK-051).

## Notes

<!-- Updated: 2026-08-07 -->

### `askedBy` decision — CHANGED, both `gitCommit.*` keys now say `install-global.sh`

**Decision.** `gitCommit.versionBump` and `gitCommit.autoPush` had
`askedBy: "/git-commit"`; both were changed to `askedBy: "install-global.sh"` in
`lib/scripts/templates/bootstrap-prefs-schema.json`. All five `consumer: skill`
keys now name the same owner.

**Reasoning.**

1. **The field records the *settling* prompt — the one site that writes the
   answer.** For all five skill keys that is `install-global.sh`'s step 7 sync
   pass. `/git-commit` only prompts once the key is already settled to a value
   that *means* "keep asking" (`confirm` for `versionBump`, `ask` for
   `autoPush`) — that is a consumer honouring a stored answer, not the question
   being asked.
2. **The two were not structurally special.** The other three skill keys have the
   identical two-site shape — `/research`, `/uat-generate`, and
   `merge-gitignore.sh` each prompt in their key's `ask` state — and none is named
   in `askedBy`. Keeping `/git-commit` meant the field followed one rule for three
   keys and a different rule for two.
3. **The old value was actively misleading, not merely inconsistent.** The
   operational meaning of `askedBy` is "unset this and where does the question come
   back?" `--unset gitCommit.autoPush` re-opens it on the next `install-global.sh`
   run; it does **not** come back inside `/git-commit`, which falls through to the
   schema default and acts. Pointing a user at a command that will not ask is a
   defect in a field whose entire job is to point at the prompt.
4. **Naming both was evaluated and is not available.** `"install-global.sh, /git-commit"`
   fails the existing suite by construction: `test/bootstrap-prefs.test.js:2389`
   requires `askedBy` to resolve to exactly one real `lib/scripts/` file or one real
   `lib/skills/<name>/SKILL.md`, and asserts a bare filename contains no `/`. The
   choice was genuinely binary. (The `:2128` non-empty-string check is the weaker
   one named in the task; `:2389` is the constraint that decided it.)
5. **Nothing is lost.** The run-time prompt sites live in each key's `detail`
   field, and `/bootstrap-config` names the affected command from `askedBy` **and**
   `summary` — and every skill key's `summary` already names its command
   ("How `/git-commit` handles the version bump…").

**Blast radius.** Two JSON strings. `askedBy` is rendered in the generated
`bootstrap-prefs.README.md` "Asked by" column and read prose-wise by
`/bootstrap-config`; it drives no branching. Suite green (289/289) after the
change, including `test/bootstrap-prefs.test.js`'s companion-row test at `:1670`,
which reads the expected value back out of the schema rather than hard-coding it.
The schema-field docs in `lib/scripts/README.md` were tightened in the same pass
to define `askedBy` as the settling prompt and to record that a compound value is
illegal, so the rule is written down where the next person adding a key will read it.

### Summary-line call — updated, with both pins

Taken as the task directed, using the suggested wording verbatim:
`Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + preferences + MCPs).`
One new term (`preferences`) covering both new local steps; a separate term per
step would have made the line name eight things and read as a changelog. Both
`stdout.includes(...)` pins in `test/install-global.test.js` (`:152`, `:267`) were
updated to the same string in the same change.
