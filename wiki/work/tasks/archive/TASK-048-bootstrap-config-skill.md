---
id: TASK-048
title: "/bootstrap-config skill — view, edit, and reset stored preferences"
status: done
created: 2026-08-07
updated: 2026-08-07
part_of: ROADMAP-005
depends_on: []
blocks: []
parallel_safe_with: [TASK-030]
uat: "[[UAT-048]]"
tags: [prefs, skills, consent, roadmap-005]
---

# TASK-048 — /bootstrap-config skill — view, edit, and reset stored preferences

<!-- Updated: 2026-08-07 -->

part_of::[[ROADMAP-005]]

## Objective

Create `lib/skills/bootstrap-config/SKILL.md`, the user-facing front end to the ask-once preference store that ROADMAP-005 Phase 1 shipped. Today the only ways to inspect or change a stored answer are hand-editing `~/.claude/bootstrap-prefs.json` / `<project>/.claude/bootstrap-prefs.json` or remembering the `bootstrap-prefs.js` flag grammar; the generated `bootstrap-prefs.README.md` companion already points users at `/bootstrap-config` for exactly this, and the command does not yet exist. The skill gives three modes — **view**, **edit**, **reset** — driving `lib/scripts/bootstrap-prefs.js` for every read and every write, and reading `lib/scripts/templates/bootstrap-prefs-schema.json` so the user never sees a bare key name without an explanation of what it controls and who asks it.

This task creates **one file only**: `lib/skills/bootstrap-config/SKILL.md`. It does not touch the helper, the schema, any installer script, or any other skill.

## Approach

**Model the house pattern on `serena-config`.** `lib/skills/serena-config/SKILL.md` is the closest existing analogue — a small, interactive, config-editing skill on the mechanical/bookkeeping model tier. Copy its shape: numbered `Step A/B/C/D` sections, a **CRITICAL ORDERING RULE** that forbids any `AskUserQuestion` before current state has been read and printed, a mandatory "No changes" escape on the first question, a final confirm-before-write question, and `Edit` rather than `Write` for any file touched in place.

**The helper is the only writer.** The skill never writes `bootstrap-prefs.json` itself and never hand-edits the generated `bootstrap-prefs.README.md` companion (the helper regenerates that companion on every successful `--set`/`--unset`, and hand edits are overwritten). All state comes from `bootstrap-prefs.js --list`; all changes go through `--set` and `--unset`. This keeps value validation, `true`/`false` JSON coercion, atomic writes, and companion regeneration in the one place that already implements them.

**The schema supplies every explanation.** Each of the 19 registry entries carries `summary` (one line), `detail` (the full paragraph, including grammar quirks), `values` (the legal value list, the single source of truth for validation), `askedBy`, `scope`, and `consumer`. The skill reads the schema file directly for `detail`/`values`/`scope` — `--list` prints only `summary`. Never offer a value the entry's `values` string does not list, and never invent an `ask` state for a key whose grammar has none (`gitCommit.versionBump` deliberately expresses "ask me" as `confirm`; `gitignore.section.*` is deliberately `false`-only).

**Two consumer populations, presented separately.** `consumer: installer` keys only change whether a setup/update script prompts. `consumer: skill` keys change what a slash command *does* at run time — `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests`, `gitignore.offerSectionUpdates`. The helper's `--list` already emits them as a separate group with a warning line; the skill mirrors that split in its own output and attaches a heavier confirmation to any edit of a `consumer: skill` key.

**Four states must all be representable.** `unset` (absence from the file — the whole representation; `null` and the string `"unset"` are never stored), a settled value, `false` (a real, remembered decline, distinct from unset), and `ask` (keep prompting, do not persist). The view must render all four distinguishably, edit must be able to reach `false` and `ask` where the grammar allows them, and reset is `--unset` — `--set --value unset` is rejected by the helper with exit 1.

**Layer selection follows `scope`.** `--get`/`--list` resolve project → global → default, but only consult the project layer when `--project <dir>` is passed; the skill always passes the project directory when run inside a project. `--set`/`--unset` require exactly one layer selector and will not guess. The layer offered per key must respect the entry's `scope`: `project`-scope keys only in the project layer, `global`-scope keys only in the global layer, `either` offering both. A `global`-scope key parked in a project file is inert — the companion lists it under "Unrecognized keys" for that reason, and the skill must not create that situation.

**Out of scope — Phase 4 owns registration.** Adding `/bootstrap-config` to `lib/skills/README.md` and to the `CLAUDE.md` Custom Commands tables is ROADMAP-005 **Phase 4**, not this task. Do not edit those files here; a concurrent Phase 4 pass owns them and a duplicate edit would collide.

## Steps

### 1. Re-read the three inputs before writing anything <!-- agent: general-purpose -->

- [x] Read `lib/skills/serena-config/SKILL.md` — the structural template being copied (frontmatter shape, `**Prereqs:**` line at line 10, CRITICAL ORDERING RULE, Step A–D layout, confirm-then-`Edit` ending).
- [x] Read `lib/scripts/templates/bootstrap-prefs-schema.json` in full — all 19 entries. Note the two `dynamic: true` pattern entries (`guides.*`, `gitignore.section.*`) and the per-key `values` grammars, which are not uniform.
- [x] Read `lib/scripts/bootstrap-prefs.js` — specifically `USAGE` (line 59), `parseArgs`, `resolve`, `scopePermitsLayer`, the `--list` output format, and the `--set` guard that rejects the literal values `unset` and `null`.

<!-- Updated: 2026-08-07 -->
Notes: `--list` group headers are `installer — read by the setup/update scripts`, `skill — read by slash commands at run time; changing these changes what a command does`, and `unrecognized — present in a values file, absent from the schema (kept untouched)`. Rows render as `  <key> = <value>  [<layer>]` with the summary indented beneath. `--set` does **not** enforce `scope` (only `renderCompanion` does), so the skill's layer offer is the only guard against writing an inert key.

### 2. Create the skill file with frontmatter and prereqs line <!-- agent: general-purpose -->

- [x] `Write` a new file at `lib/skills/bootstrap-config/SKILL.md` (the Write tool creates the directory; the filename is uppercase `SKILL.md`).
- [x] Frontmatter, exactly these keys and values:
  ```yaml
  ---
  name: bootstrap-config
  description: View, edit, and reset the stored bootstrap preferences that decide which installer prompts are asked and how consent-gated skills behave
  category: executing
  model: claude-haiku-4-5-20251001
  argument-hint: [view | edit | reset] [--global | --project]
  disable-model-invocation: false
  user-invocable: true
  ---
  ```
- [x] Line 10 — immediately after the closing `---` — is the short Prereqs form, serena-config's without the `/primer` clause:
  ```
  **Prereqs:** obey `wiki/guides/mcp-tools.md`.
  ```
- [x] H1: `# /bootstrap-config — View, edit, and reset stored preferences`.
- [x] Follow with a two-sentence intro naming the two values files (`~/.claude/bootstrap-prefs.json`, `<project>/.claude/bootstrap-prefs.json`), the helper `lib/scripts/bootstrap-prefs.js`, and the schema `lib/scripts/templates/bootstrap-prefs-schema.json`.

### 3. Write the ordering rule and the argument contract <!-- agent: general-purpose -->

- [x] Add a **CRITICAL ORDERING RULE** block, mirroring serena-config's: Steps A and B (locate + read current state) MUST complete and the state summary MUST be printed before any `AskUserQuestion` call. Never prompt against an unread store.
- [x] Add a **Writes go through the helper** rule: the skill never writes `bootstrap-prefs.json` with `Write` or `Edit`, and never edits `bootstrap-prefs.README.md` at all — that companion is generated output, regenerated on every successful `--set`/`--unset`, and hand edits are overwritten without warning. Where the skill must change a file in place for any other reason, it uses `Edit`, never `Write`.
- [x] Document argument handling for `argument-hint: [view | edit | reset] [--global | --project]`:
  - A mode word (`view` / `edit` / `reset`) preselects the mode and skips the mode question in Step C — but Steps A and B still run and still print state first.
  - `--global` / `--project` preselects the layer for reads and pins the write layer, subject to the per-key `scope` check in Step E.
  - No arguments = full interactive flow.

### 4. Step A — locate the helper, the schema, and the layers <!-- agent: general-purpose -->

- [x] Resolve the helper path: prefer `lib/scripts/bootstrap-prefs.js` relative to the current project root; fall back to the installed copy if the current project is not this repo. If neither exists, abort with this exact message and stop:
  > No bootstrap preference helper found. Run `npx @codewizard-dt/bootstrap update` (or `./lib/scripts/install-global.sh --skip-mcps`) to install it, then re-run `/bootstrap-config`.
- [x] Resolve the schema path: `lib/scripts/templates/bootstrap-prefs-schema.json` next to the helper. The helper defaults to it, so `--schema` is only passed when a non-default schema was located.
- [x] Determine `PROJECT_DIR`: the current working directory when inside a git repo / project, otherwise none. Record whether a project layer exists (`<PROJECT_DIR>/.claude/bootstrap-prefs.json`) and whether the global layer exists (`~/.claude/bootstrap-prefs.json`). **Neither file existing is a normal state, not an error** — it means every key is `unset`.

### 5. Step B — read current state before prompting <!-- agent: general-purpose -->

- [x] Run the helper once via `Bash`:
  - Inside a project: `node <helper> --list --project "$PROJECT_DIR"`
  - Otherwise, or when `--global` was passed: `node <helper> --list`
- [x] Spell out in the skill text that **`--list` without `--project` consults the global layer only** — omitting it silently hides every project answer, which is precisely the confusion this command exists to remove. Always pass `--project` when a project directory was resolved.
- [x] `Read` the schema JSON to obtain `detail`, `values`, `scope`, and `consumer` per key. `--list` prints only `summary`; the longer `detail` text is what makes an unfamiliar key legible, and `values` is the only legal source for the options offered in Step E.
- [x] Note that `--list` annotates every row with its supplying layer in brackets — `[project]`, `[global]`, `[default]`, `[unset]`, or `[target]`. Carry that annotation through to the printed summary verbatim; "which layer supplied this" is half the answer.

### 6. Step B2 — print the grouped state summary <!-- agent: general-purpose -->

- [x] Print a plain-text summary, grouped exactly as the helper groups: **Installer preferences** first, then **Skill preferences**, then any **Unrecognized keys**.
- [x] Per key show: key name, current value, supplying layer, and the schema `summary`. Never print a key without its summary.
- [x] Render the four states distinguishably and label them:
  - `unset` — absent from every consulted file and the entry has no `default`; the next run will ask.
  - a settled value — e.g. `shared`, `auto`, `user`, `true`.
  - `false` — a remembered decline. Say so explicitly: this is *not* the same as unset, and it is why the prompt stopped coming back.
  - `ask` — stored, and means "keep prompting me, do not persist an answer".
  - Also mark rows whose layer is `[default]`: nothing is stored, the schema default is being used, and the key can still be answered.
- [x] Handle the two `dynamic: true` families explicitly: `guides.*` and `gitignore.section.*` are patterns, not keys. When concrete keys exist, list them; when none exist, show the pattern row and explain the family (one key per optional guide; one key per titled `.gitignore` section).
- [x] For `gitignore.section.*`, state the one-value grammar: only `false` is storable, an accepted section is deliberately never recorded, and `--unset` is the only way to make a declined section be offered again.
- [x] In view mode, stop here and print the two follow-ups: `/bootstrap-config edit` and `/bootstrap-config reset`.

### 7. Step C — the mode question (first AskUserQuestion) <!-- agent: general-purpose -->

- [x] Issue **one** `AskUserQuestion` (`multiSelect: false`) — only after Step B2 has printed. Options:
  - `Edit a preference` — change a stored value.
  - `Reset a preference` — remove a key so the installer or skill asks again.
  - `No changes` — exit without writing anything. This option is **mandatory and always offered**, per serena-config.
- [x] Skip this question entirely when a mode word was supplied as an argument, but never skip Step B2's printed summary.

### 8. Step D — choose the key <!-- agent: general-purpose -->

- [x] Issue one `AskUserQuestion` listing the candidate keys, grouped so `consumer: skill` keys are visibly separate from `consumer: installer` keys, with an `Other` free-text affordance for typing a key name directly (needed for the dynamic families, which can have many concrete keys).
- [x] Label each option with `<key> — <summary>` and its current value/layer. Include a `Back / No changes` option.
- [x] For reset mode, only offer keys that are actually stored in a writable layer — a key that is already `unset` or supplied by `[default]` has nothing to remove; say so rather than running a no-op `--unset`.
- [x] Once a key is chosen, print its schema `detail` paragraph in full before going further. This is the point of the schema: the user decides against the real explanation, not a key name.
- [x] Add a heavier warning banner when the chosen key has `consumer: skill`:
  > This is a **skill preference**. Changing it changes what a slash command actually does the next time it runs — not merely whether the installer asks you a question.
  Name the affected command from `askedBy` / `summary` (e.g. `gitCommit.versionBump` changes `/git-commit`'s behavior on every commit). `consumer: installer` keys get the lighter framing: they only affect prompting.

### 9. Step E — choose the value and the layer (edit mode) <!-- agent: general-purpose -->

- [x] Offer values parsed from the entry's `values` string, split on `|` and trimmed — never a hardcoded list, and never a value the grammar omits. Call out the two grammar traps in the skill text:
  - `gitCommit.versionBump` = `auto | confirm | never`; `confirm` **is** this key's ask state, so do not offer a separate `ask`.
  - `gitignore.section.*` = `false` only; there is intentionally no `true`, and widening it would break merge-gitignore.sh's "nothing is added without asking" invariant.
- [x] Offer the layer subject to `scope`: `scope: project` → project layer only; `scope: global` → global layer only; `scope: either` → ask which, explaining that **project wins over global per key**. Never offer a layer the key's scope makes inert.
- [x] If `scope` requires the project layer but no project directory was resolved, abort that edit with an explanation rather than writing to global.
- [x] Confirm with one final `AskUserQuestion` showing the exact command about to run — `Yes, apply` / `No, cancel`:
  ```
  node <helper> --set <key> --value <v> --global
  node <helper> --set <key> --value <v> --project "$PROJECT_DIR"
  ```
- [x] Run it with `Bash` only after confirmation. Note in the skill text that `--set` exits 1 on an illegal value (this is a loud, correct failure — surface the helper's message verbatim rather than retrying), and that it refuses the literal values `unset` and `null`, directing the user to `--unset` instead.

### 10. Step F — reset a key (reset mode) <!-- agent: general-purpose -->

- [x] Explain in the skill text that reset means `--unset`: the key is **deleted** from the values file, absence is the entire representation of `unset`, and the next installer run or skill invocation will ask that question again.
- [x] Pick the layer the key is actually stored in (from the `[layer]` annotation captured in Step B). If the same key is stored in both layers, say so and ask which to clear — clearing project alone re-exposes the global answer rather than re-opening the question.
- [x] Confirm with one `AskUserQuestion` showing the exact command:
  ```
  node <helper> --unset <key> --global
  node <helper> --unset <key> --project "$PROJECT_DIR"
  ```
- [x] Run it with `Bash` only after confirmation.

### 11. Step G — report and re-verify <!-- agent: general-purpose -->

- [x] After any successful write, re-run the Step B `--list` command and print the changed rows so the user sees the new state and its layer, not just a success line.
- [x] Mention that the helper regenerated `bootstrap-prefs.README.md` alongside the values file, and that this companion is generated output the user should not hand-edit.
- [x] Print the closing pointers:
  ```
  View again:  /bootstrap-config view
  Re-open a question:  /bootstrap-config reset
  ```
- [x] Add a closing note that a preference file never holds a secret — no API key, token, or password belongs in it — matching the same warning the generated companion carries.

### 12. Verify <!-- agent: general-purpose -->

- [x] Confirm the file exists at `lib/skills/bootstrap-config/SKILL.md`, its frontmatter matches step 2 exactly, and line 10 is the `**Prereqs:**` line.
- [x] Sanity-check the helper invocations quoted in the skill against `USAGE` in `lib/scripts/bootstrap-prefs.js` — every flag spelled in the skill must exist, and `--set`/`--unset` must always carry exactly one layer selector.
- [x] Confirm every value list quoted in the skill traces back to a `values` string in `lib/scripts/templates/bootstrap-prefs-schema.json`, with no second copy of any grammar invented in prose.
- [DEFERRED-TO-UAT] Run `./lib/scripts/install-global.sh --skip-mcps` to sync the new skill into `~/.claude/skills/` (a skill edit is not live until this runs), then confirm `/bootstrap-config` is offered. — **Not run.** Runtime step that mutates the real `~/.claude/skills/`; also blocked because TASK-030 is concurrently editing `lib/scripts/install-global.sh`. The user must run it before `/bootstrap-config` is live.
- [x] **Do not** edit `lib/skills/README.md` or `CLAUDE.md` — registration is ROADMAP-005 Phase 4 and is owned by a separate pass.
