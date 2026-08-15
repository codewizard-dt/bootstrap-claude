---
name: bootstrap-config
description: View, edit, and reset the stored bootstrap preferences that decide which installer prompts are asked and how consent-gated skills behave
category: executing
model: claude-haiku-4-5-20251001
argument-hint: [view | edit | reset] [--global | --project]
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`.

# /bootstrap-config — View, edit, and reset stored preferences

Bootstrap remembers your answers to installer and skill prompts in two flat JSON files — the global `~/.claude/bootstrap-prefs.json` and the per-project `<project>/.claude/bootstrap-prefs.json` — and every read and write of them goes through the helper `lib/scripts/bootstrap-prefs.js`. This command is the front end to that store: it reads current state with the helper, explains each key from the registry at `lib/scripts/templates/bootstrap-prefs-schema.json`, and changes exactly what you confirm.

**CRITICAL ORDERING RULE**: Steps A and B (locate + read current state) MUST complete, and the Step B2 state summary MUST be printed, before any `AskUserQuestion` call. Never prompt against an unread store — the whole point of this command is that the user decides against real current state, not a guess.

**Writes go through the helper.** Never write `bootstrap-prefs.json` with `Write` or `Edit`; every change is a `--set` or `--unset` invocation, which is where value validation, `true`/`false` JSON coercion, and atomic writes already live. Never edit `bootstrap-prefs.README.md` at all — that companion is generated output, rewritten on every successful `--set`/`--unset`, and hand edits are overwritten without warning. If this skill ever has to change some *other* file in place, it uses `Edit`, never `Write`.

## Arguments

`argument-hint: [view | edit | reset] [--global | --project]`

- A mode word (`view` / `edit` / `reset`) preselects the mode and skips the Step C question. Steps A and B still run, and the Step B2 summary is still printed first — a mode word skips a question, never the state read.
- `--global` / `--project` preselects the layer for reads and pins the write layer. A pinned layer that the chosen key's `scope` forbids is refused by the helper itself (BUG-0009), not silently redirected — Step E offers only permitted layers so the refusal is rarely hit in practice.
- No arguments = the full interactive flow.

---

## Step A — Locate the helper, the schema, and the layers

1. Resolve the helper path. There are exactly two valid locations — never search anywhere else, and never search under a project's own `lib/scripts/` (that path exists only inside the bootstrap-claude source repo checkout itself, never in a project that merely installed it):
   - **If the current project is this bootstrap-claude repo itself** (dev checkout — `lib/scripts/bootstrap-prefs.js` exists relative to the project root): use that repo-local copy.
   - **Otherwise (any installed/target project, the common case):** the helper lives at the fixed, project-independent path `~/.claude/bootstrap-prefs.js`, installed there by `install-global.sh` precisely so it's reachable from arbitrary projects. Use that path directly — do not `ls`/`find` for it first.
   - If neither location has the file, abort with this exact message and stop:
   > No bootstrap preference helper found. Run `npx @codewizard-dt/bootstrap update` (or `./lib/scripts/install-global.sh --skip-mcps`) to install it, then re-run `/bootstrap-config`.
2. Resolve the schema path — it is **not** beside the helper when installed:
   - Repo-local case: `lib/scripts/templates/bootstrap-prefs-schema.json`.
   - Installed case: `~/.claude/templates/bootstrap-prefs-schema.json`. (The helper resolves the schema as `<its own dir>/templates/...`, and the installer deliberately places it there — see `install-global.sh`'s step 6 comment.)
   The helper already defaults to the path matching its own location, so pass `--schema <path>` **only** when a non-default schema was located.
3. Determine `PROJECT_DIR` — the current working directory when inside a git repo / project, otherwise none. Record whether each layer's file exists:
   - project layer: `<PROJECT_DIR>/.claude/bootstrap-prefs.json`
   - global layer: `~/.claude/bootstrap-prefs.json`

   **Neither file existing is a normal state, not an error.** It means nothing has been answered yet and every key is `unset`. Report it as such and continue — there is still a useful summary to print and still keys that can be set.

## Step B — Read current state before prompting

1. Run the helper exactly once via `Bash`:
   - Inside a project: `node <helper> --list --project "$PROJECT_DIR"`
   - Outside a project, or when `--global` was passed: `node <helper> --list`

   **`--list` without `--project` consults the global layer only.** Omitting it silently hides every project-layer answer, which is precisely the confusion this command exists to remove — a user staring at a summary that says `unset` while a project file says otherwise. Always pass `--project` when a project directory was resolved. The helper says so itself in its closing line (`No --project given: the project layer was not consulted; showing the global layer only.`); pass that line through if it appears.
2. `Read` the schema JSON to obtain `detail`, `values`, `scope`, and `consumer` per key. `--list` prints only the one-line `summary`; the longer `detail` paragraph is what makes an unfamiliar key legible, and the entry's `values` string is the **only** legal source for the options offered in Step E.
3. `--list` annotates every row with the layer that supplied it, in brackets — `[project]`, `[global]`, `[default]`, `[unset]`, or `[target]`. Carry that annotation through to the printed summary verbatim. "Which layer supplied this" is half the answer: a value shown without its layer cannot tell the user whether editing global will change anything.

## Step B2 — Print the grouped state summary

Print a plain-text summary grouped exactly the way the helper groups it, in this order:

1. **Installer preferences** (`consumer: installer` — read by the setup/update scripts)
2. **Skill preferences** (`consumer: skill` — read by slash commands at run time; changing these changes what a command does)
3. **Unrecognized keys** (present in a values file, absent from the schema; the helper keeps them untouched) — omit this group when empty

Per key show the key name, its current value, the supplying layer in brackets, and the schema `summary`. **Never print a key without its summary** — a bare key name is the exact failure this command exists to fix.

### Render all four states distinguishably, and label them

| State | What it means |
|---|---|
| `unset` | Absent from every consulted file, and the entry has no `default`. The next run will ask this question. |
| a settled value | A real stored answer (e.g. `shared`, `auto`, `user`, `true`). |
| `false` | A **remembered decline** — say so explicitly. This is *not* the same as `unset`; it is stored, it is why the prompt stopped coming back, and only a reset re-opens it. |
| `ask` | Stored, and means "keep prompting me, do not persist an answer". |

Also mark rows whose layer is `[default]`: nothing is stored for that key, the schema default is what is in effect, and the question can still be answered.

### The two dynamic families

`guides.*` and `gitignore.section.*` are `dynamic: true` **patterns, not keys**. When the consulted files hold concrete keys under a pattern, `--list` lists those concrete keys and the summary should show them individually. When none exist, `--list` shows the pattern row instead — print it and explain the family rather than showing a literal `.*` with no context:

- `guides.*` — one key per optional guide that `sync-wiki-scaffold.sh` can deliver into `wiki/guides/`.
- `gitignore.section.*` — one key per titled section of the `.gitignore` template, slugified from the section's banner title. Ask the helper for a slug rather than deriving one by hand: `node <helper> --section-key "<banner title>"`.

For `gitignore.section.*`, state the one-value grammar plainly: the schema's `values` is `false` **only**. An accepted section is deliberately never recorded (a remembered yes would let a later template version append lines to a project's `.gitignore` without asking), so the only storable answer is a decline, and `--unset` is the only way to make a declined section be offered again.

### View mode ends here

In view mode, stop after the summary and print the two follow-ups:

```
/bootstrap-config edit
/bootstrap-config reset
```

## Step C — The mode question (first `AskUserQuestion`)

Issue **one** `AskUserQuestion` (`multiSelect: false`) — only after Step B2 has printed. Options:

- `Edit a preference` — change a stored value.
- `Reset a preference` — remove a key so the installer or skill asks that question again.
- `No changes` — exit without writing anything. This option is **mandatory and always offered**.

Skip this question entirely when a mode word was supplied as an argument — but never skip Step B2's printed summary.

## Step D — Choose the key

1. Issue one `AskUserQuestion` listing the candidate keys, grouped so `consumer: skill` keys are **visibly separate** from `consumer: installer` keys. Include an `Other` free-text affordance for typing a key name directly — the dynamic families can hold more concrete keys than fit in an option list.
2. Label each option `<key> — <summary>`, and include its current value and supplying layer. Include a `Back / No changes` option.
3. **Reset mode only offers keys that are actually stored in a writable layer.** A key showing `[unset]` or `[default]` has nothing to remove; say so rather than running a no-op `--unset`.
4. Once a key is chosen, print its schema `detail` paragraph **in full** before going any further. This is the entire point of the registry: the user decides against the real explanation, including its grammar quirks, not against a key name.
5. When the chosen key has `consumer: skill`, print this heavier banner:
   > This is a **skill preference**. Changing it changes what a slash command actually does the next time it runs — not merely whether the installer asks you a question.

   Name the affected command from the entry's `askedBy` / `summary` — e.g. `gitCommit.versionBump` changes what `/git-commit` does on every commit. The `consumer: skill` population is `gitCommit.versionBump`, `gitCommit.autoPush`, `research.persistToRaw`, `research.autoIngest`, `uatGenerate.promoteTests`, and `gitignore.offerSectionUpdates`. Every other key is `consumer: installer` and gets the lighter framing: it only affects whether a setup/update script prompts you.

## Step E — Choose the value and the layer (edit mode)

1. **Offer values parsed from the entry's `values` string** — split on `|`, trim each token. Never a hardcoded list, and never a value the grammar omits. The helper validates against this same string, so an option that is not in it is guaranteed to fail. Two grammars trip people up and must be handled as written:
   - `gitCommit.versionBump` — `values` is `auto | confirm | never`. **`confirm` IS this key's ask state.** Do not offer a separate `ask`; there is none, and offering one produces a hard failure.
   - `gitignore.section.*` — `values` is `false` only. There is intentionally no `true`. Widening it would break `merge-gitignore.sh`'s invariant that nothing is ever added to a project's `.gitignore` without asking.
2. **Offer the layer subject to the entry's `scope`:**
   - `scope: project` → the project layer only.
   - `scope: global` → the global layer only.
   - `scope: either` → ask which, explaining that **project wins over global, per key**.

   Never offer a layer the key's `scope` makes inert. The helper's `--set` itself now refuses a write into a layer the key's `scope` forbids (exit 1, nothing written — BUG-0009) — attempting to write a `global`-scope key into a project file is rejected rather than silently accepted and later filed under "Unrecognized keys" with a never-consulted reason. This step exists so the user is never offered a choice that would hit that refusal, not because the helper depends on it.
3. If `scope` requires the project layer but no project directory was resolved in Step A, abort that edit with an explanation. Do not fall back to the global layer.
4. Confirm with one final `AskUserQuestion` (`Yes, apply` / `No, cancel`) showing the exact command about to run:
   ```
   node <helper> --set <key> --value <v> --global
   node <helper> --set <key> --value <v> --project "$PROJECT_DIR"
   ```
   `--set` takes **exactly one** layer selector — `--global` or `--project <dir>` (or `--target <path>`, the explicit single-file escape hatch). Zero selectors and two selectors are both usage errors; the helper will not guess which file to write.
5. Run it with `Bash` only after confirmation. Two failure modes are loud and correct — surface the helper's message verbatim rather than retrying or working around it:
   - An illegal value exits 1 with the legal list. That is the grammar rejecting a typo, not a bug to route around.
   - The literal values `unset` and `null` are refused outright, with a pointer to `--unset`. Absence is how a key is unset; there is no value that spells it.

## Step F — Reset a key (reset mode)

1. Reset means `--unset`: the key is **deleted** from the values file. Absence is the entire representation of `unset` — `null` and the string `"unset"` are never stored — so the next installer run or skill invocation asks that question again.
2. Pick the layer the key is actually stored in, using the `[layer]` annotation captured in Step B. If the same key is stored in **both** layers, say so and ask which to clear: clearing the project layer alone re-exposes the global answer rather than re-opening the question.
3. Confirm with one `AskUserQuestion` showing the exact command:
   ```
   node <helper> --unset <key> --global
   node <helper> --unset <key> --project "$PROJECT_DIR"
   ```
   Like `--set`, `--unset` requires exactly one layer selector.
4. Run it with `Bash` only after confirmation.

## Step G — Report and re-verify

1. After **any** successful write, re-run the Step B `--list` command and print the changed rows, so the user sees the new value *and its layer* rather than a bare success line. A write that landed in a layer the user did not expect is invisible otherwise.
2. Mention that the helper regenerated `bootstrap-prefs.README.md` next to the values file, and that this companion is generated output — read it, never hand-edit it.
3. Print the closing pointers:
   ```
   View again:  /bootstrap-config view
   Re-open a question:  /bootstrap-config reset
   ```
4. Close with the same warning the generated companion carries: **a preference file never holds a secret.** No API key, token, or password belongs in it — not in the values file, not in the companion, not in a new schema key.
